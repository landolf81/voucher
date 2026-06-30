#!/usr/bin/env python3
"""
Hermes Chat Relay (맥북 상시 실행)

흐름:
  Supabase(chat_messages, status='pending') 폴링
    → 같은 세션의 이전 대화 + 현재 질문으로 context 구성
    → Hermes API (localhost:8642) 호출
    → assistant 응답을 chat_messages 에 INSERT
    → user 메시지를 completed 처리

설치:
  pip install supabase requests python-dotenv

환경변수 (.env 또는 셸):
  SUPABASE_URL                 = https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY    = (권장) RLS 우회용 service_role 키
  SUPABASE_ANON_KEY            = service_role 가 없을 때 fallback
  HERMES_API_URL               = http://localhost:8642/v1/chat/completions
  HERMES_API_KEY               = change-me-local-dev
  HERMES_MODEL                 = hermes-agent

실행:
  python scripts/relay.py
  (백그라운드: nohup python scripts/relay.py > relay.log 2>&1 &)
"""

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

# 한국 표준시 (KST, UTC+9)
KST = timezone(timedelta(hours=9))

try:
    from dotenv import load_dotenv

    # 프로젝트 .env.local, .env, 또는 ~/.hermes/.env 등에서 로드
    load_dotenv(".env.local")
    load_dotenv()
    load_dotenv(os.path.expanduser("~/.hermes/.env"))
except ImportError:
    pass

from supabase import create_client, Client

# ── 설정 ────────────────────────────────────────────────
# Next.js 프로젝트는 NEXT_PUBLIC_* 를 쓰지만, 릴레이는 별도 변수명을 우선한다.
SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
)
# 릴레이는 status UPDATE / assistant INSERT 를 해야 하므로 service_role 키를 권장.
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)

HERMES_API = os.environ.get("HERMES_API_URL", "http://localhost:8642/v1/chat/completions")
HERMES_KEY = os.environ.get("HERMES_API_KEY", "change-me-local-dev")
HERMES_MODEL = os.environ.get("HERMES_MODEL", "hermes-agent")
POLL_INTERVAL = float(os.environ.get("RELAY_POLL_INTERVAL", "2"))
# 감정평가 등 도구로 토지/실거래 정보를 수집하는 작업은 응답까지 수 분 걸릴 수 있어
# 기본값을 넉넉히(600초=10분) 둔다. 더 길게 필요하면 env HERMES_TIMEOUT 으로 덮어쓴다.
HERMES_TIMEOUT = int(os.environ.get("HERMES_TIMEOUT", "600"))
# 동시 처리 워커 수. 모델이 클라우드(DeepSeek 등)라 맥북 추론 부하가 없으므로 여유 있게 5.
# 긴 작업 1건이 도는 동안에도 짧은 질문이 추월해 처리된다. env RELAY_CONCURRENCY 로 조절.
RELAY_CONCURRENCY = int(os.environ.get("RELAY_CONCURRENCY", "5"))
# Hermes 호출이 일시적으로 실패(연결 끊김/5xx 등)할 때만 재시도. backoff(초)는 선형.
# ⚠️ 타임아웃(=오래 걸린 정상 작업일 가능성)은 재시도하지 않는다 — 무거운 작업을 처음부터
#    재실행하면 워커를 오래 점유하고 도구 호출이 중복될 뿐이다.
HERMES_RETRIES = int(os.environ.get("HERMES_RETRIES", "2"))
HERMES_RETRY_BACKOFF = float(os.environ.get("HERMES_RETRY_BACKOFF", "3"))

SYSTEM_PROMPT = os.environ.get(
    "HERMES_SYSTEM_PROMPT",
    "당신은 교환권 관리 시스템의 내부 업무 보조 AI입니다. "
    "관리자와 직원을 대상으로 업무 규정 안내, 기안문 등 문서 작성 보조, "
    "회원/교환권 데이터 관련 질문에 정확하고 간결하게 한국어로 답합니다. "
    "확실하지 않은 사실은 추측하지 말고 모른다고 답하세요.",
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit(
        "환경변수 누락: SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY(또는 ANON_KEY)를 설정하세요."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def set_status(message_id: str, status: str) -> None:
    supabase.table("chat_messages").update({"status": status}).eq("id", message_id).execute()


def claim(message_id: str) -> bool:
    """pending → processing 원자적 claim. 실제로 내가 잡았으면 True.

    `status='pending'` 조건부 UPDATE 라, 동시에 여러 워커(또는 폴)가 같은 행을 노려도
    UPDATE 가 성공해 행을 돌려받은 쪽만 True 가 된다(compare-and-swap). 중복 처리 방지.
    """
    res = (
        supabase.table("chat_messages")
        .update({"status": "processing"})
        .eq("id", message_id)
        .eq("status", "pending")
        .execute()
    )
    return bool(res.data)


# 세션→사용자 정보 캐시 (admin 조회 반복 방지)
_user_cache: dict = {}


def get_user_label(session_id: str):
    """세션 소유자(사용자)의 식별 정보 조회 → (user_id, '이름 / 역할 / 소속') 반환."""
    if session_id in _user_cache:
        return _user_cache[session_id]
    uid = None
    label = None
    try:
        s = (
            supabase.table("chat_sessions")
            .select("user_id")
            .eq("id", session_id)
            .single()
            .execute()
        )
        uid = (s.data or {}).get("user_id")
        if uid:
            # service_role 키라야 admin 조회 가능
            ures = supabase.auth.admin.get_user_by_id(uid)
            meta = (ures.user.user_metadata or {}) if ures and ures.user else {}
            name = meta.get("name") or meta.get("display_name") or "이름미상"
            role = meta.get("role") or ""
            site_id = meta.get("site_id")
            site_name = ""
            if site_id:
                site = (
                    supabase.table("sites")
                    .select("site_name")
                    .eq("id", site_id)
                    .single()
                    .execute()
                )
                site_name = (site.data or {}).get("site_name", "") if site.data else ""
            parts = [name]
            if role:
                parts.append(f"역할:{role}")
            if site_name:
                parts.append(f"소속:{site_name}")
            label = " / ".join(parts)
    except Exception as e:  # noqa: BLE001
        print(f"사용자 정보 조회 실패: {e}")
    _user_cache[session_id] = (uid, label)
    return uid, label


def build_context(session_id: str, current_content: str) -> list:
    """이전 완료 메시지 + 현재 질문으로 OpenAI 형식 messages 구성."""
    history = (
        supabase.table("chat_messages")
        .select("role, content, status, created_at")
        .eq("session_id", session_id)
        .in_("status", ["completed"])
        .order("created_at")
        .execute()
    )

    # system 프롬프트에 "누가 대화 중인지" 주입 + user_id 로 사용자별 기억/활용 유도
    system_prompt = SYSTEM_PROMPT

    # 채널 표시 — 이 대화는 외부 API(웹 채팅) 채널임을 명시.
    # 봇 기억(SOUL/USER/MEMORY)의 "API 응답 규칙"(시스템 용어 금지·개인정보 차단·호칭은
    # 발신자 값에 따름 등)이 데스크탑 GUI(마스터)와 구분되어 적용되도록 한다.
    system_prompt += (
        "\n\n[채널] 이 대화는 외부 API(웹 채팅) 채널이다 — 데스크탑 GUI(마스터)가 아니다. "
        "API 응답 규칙을 적용하라: 시스템/기술 용어 노출 금지, 개인정보 차단, "
        "인프라·접속 정보 노출 금지, 호칭은 '[현재 대화 사용자]' 값을 따른다."
    )

    # 현재 시각(KST)을 매 요청마다 주입 — 모델이 '오늘/지금'을 정확히 인지하도록
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"]
    now_kst = datetime.now(KST)
    system_prompt += (
        f"\n\n[현재 시각(KST)] {now_kst.strftime('%Y-%m-%d %H:%M')} "
        f"({weekday_kr[now_kst.weekday()]}요일). "
        "날짜·시간 관련 질문은 이 값을 기준으로 답하라."
    )

    uid, label = get_user_label(session_id)
    if label:
        system_prompt += (
            f"\n\n[현재 대화 사용자] {label} (user_id: {uid}).\n"
            "이 정보는 오직 지금 이 대화의 맥락 파악용 배경일 뿐이다. "
            "매 답변마다 이름이나 호칭을 붙이지 말 것 — 특히 단답·사실 안내에는 호칭 없이 본론만 말한다. "
            "⚠️ 이 사용자의 이름·호칭·소속을 기억(메모리/노트)에 저장하지 말고, "
            "다른 대화에서 이전 사용자의 이름이나 호칭을 절대 사용하지 마라. "
            "각 대화의 상대는 매번 다를 수 있으니, 반드시 지금 이 [현재 대화 사용자] 값만 신뢰하라."
        )

    messages = [{"role": "system", "content": system_prompt}]
    for m in history.data or []:
        # 안전장치: 빈 내용 스킵
        if m.get("content"):
            messages.append({"role": m["role"], "content": m["content"]})

    # ⚠️ 현재 pending 메시지는 위에서 processing 으로 바뀌어 completed 필터에 안 잡힌다.
    #    따라서 명시적으로 추가해야 Hermes 가 실제 질문을 받는다. (원본 스펙의 누락 보완)
    messages.append({"role": "user", "content": current_content})
    return messages


def process_message(msg: dict) -> None:
    """이미 claim 된(processing) 메시지 1건을 Hermes 로 처리. 워커 스레드에서 실행됨."""
    msg_id = msg["id"]
    session_id = msg["session_id"]
    print(f"→ 처리 중: session={session_id[:8]} msg={msg_id[:8]}")

    try:
        messages = build_context(session_id, msg["content"])

        # 연결 끊김/5xx 등 일시적 실패만 backoff 재시도로 흡수한다.
        # 타임아웃은 '오래 걸린 정상 작업'일 가능성이 커서 재시도하지 않고 바로 error.
        answer = None
        last_err = None
        total_attempts = HERMES_RETRIES + 1
        for attempt in range(1, total_attempts + 1):
            try:
                resp = requests.post(
                    HERMES_API,
                    headers={"Authorization": f"Bearer {HERMES_KEY}"},
                    json={"model": HERMES_MODEL, "messages": messages, "stream": False},
                    timeout=HERMES_TIMEOUT,
                )
                if resp.status_code == 200:
                    answer = resp.json()["choices"][0]["message"]["content"]
                    break
                last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
            except requests.exceptions.Timeout:
                # 재시도 금지: 무거운 작업을 처음부터 재실행하면 워커 점유·도구 중복만 늘어난다.
                print(f"✗ Hermes 타임아웃({HERMES_TIMEOUT}s) msg={msg_id[:8]} — 재시도 안 함")
                set_status(msg_id, "error")
                return
            except Exception as e:  # noqa: BLE001  (연결오류 등)
                last_err = repr(e)

            if attempt < total_attempts:
                wait = HERMES_RETRY_BACKOFF * attempt
                print(
                    f"✗ Hermes 실패(시도 {attempt}/{total_attempts}): {last_err} "
                    f"— {wait:.0f}s 후 재시도"
                )
                time.sleep(wait)

        if answer is None:
            print(f"✗ Hermes 최종 실패({total_attempts}회): {last_err}")
            set_status(msg_id, "error")
            return

        supabase.table("chat_messages").insert(
            {
                "session_id": session_id,
                "role": "assistant",
                "content": answer,
                "status": "completed",
            }
        ).execute()

        set_status(msg_id, "completed")
        print(f"✓ 응답 완료: msg={msg_id[:8]}")

    except Exception as e:  # noqa: BLE001
        print(f"✗ 처리 실패: {e}")
        set_status(msg_id, "error")


def poll(executor: ThreadPoolExecutor, inflight: set, lock: threading.Lock) -> None:
    """여유 슬롯만큼 pending 을 가져와 claim 후 워커에 던진다(동시 처리).

    - 여유 슬롯 = RELAY_CONCURRENCY - 현재 진행 중(inflight) 수
    - claim 에 실패한 행(다른 워커가 이미 가져감)은 건너뛴다
    - 긴 작업이 워커를 물고 있어도, 짧은 질문은 남은 슬롯으로 추월 처리된다
    """
    with lock:
        free = RELAY_CONCURRENCY - len(inflight)
    if free <= 0:
        return

    result = (
        supabase.table("chat_messages")
        .select("*")
        .eq("role", "user")
        .eq("status", "pending")
        .order("created_at")
        .limit(free)
        .execute()
    )
    for msg in result.data or []:
        if not claim(msg["id"]):
            continue  # 다른 워커/폴이 이미 가져감
        fut = executor.submit(process_message, msg)
        with lock:
            inflight.add(fut)
        fut.add_done_callback(lambda f: _retire(f, inflight, lock))


def _retire(fut, inflight: set, lock: threading.Lock) -> None:
    with lock:
        inflight.discard(fut)


def recover_orphaned() -> None:
    """시작 시 'processing' 에 갇힌 메시지를 'pending' 으로 되돌린다.

    이전 릴레이가 Hermes 호출 도중 종료되면 해당 메시지는 'processing' 상태로 남는데,
    폴링은 'pending' 만 보므로 영영 처리되지 않는다(고아 메시지). 단일 릴레이 운영을
    전제로, 새로 뜰 때 그런 메시지를 모두 큐로 되돌려 재처리한다.
    ⚠️ 릴레이를 2개 이상 동시에 돌리면 서로의 진행 중 메시지를 되돌릴 수 있으니 금지.
    """
    try:
        res = (
            supabase.table("chat_messages")
            .update({"status": "pending"})
            .eq("role", "user")
            .eq("status", "processing")
            .execute()
        )
        n = len(res.data or [])
        if n:
            print(f"↺ 고아 메시지 {n}건을 pending 으로 복구함")
    except Exception as e:  # noqa: BLE001
        print(f"복구 중 오류: {e}")


if __name__ == "__main__":
    print(f"Relay started. Supabase={SUPABASE_URL}  Hermes={HERMES_API}  model={HERMES_MODEL}")
    print(f"Polling every {POLL_INTERVAL}s... (동시 처리 {RELAY_CONCURRENCY}건, 타임아웃 {HERMES_TIMEOUT}s)")
    recover_orphaned()
    inflight: set = set()
    lock = threading.Lock()
    executor = ThreadPoolExecutor(max_workers=RELAY_CONCURRENCY)
    while True:
        try:
            poll(executor, inflight, lock)
        except Exception as e:  # noqa: BLE001
            print(f"Polling error: {e}")
        time.sleep(POLL_INTERVAL)
