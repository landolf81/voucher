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
import time

import requests

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
HERMES_TIMEOUT = int(os.environ.get("HERMES_TIMEOUT", "120"))

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

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in history.data or []:
        # 안전장치: 빈 내용 스킵
        if m.get("content"):
            messages.append({"role": m["role"], "content": m["content"]})

    # ⚠️ 현재 pending 메시지는 위에서 processing 으로 바뀌어 completed 필터에 안 잡힌다.
    #    따라서 명시적으로 추가해야 Hermes 가 실제 질문을 받는다. (원본 스펙의 누락 보완)
    messages.append({"role": "user", "content": current_content})
    return messages


def poll() -> None:
    result = (
        supabase.table("chat_messages")
        .select("*")
        .eq("role", "user")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not result.data:
        return

    msg = result.data[0]
    msg_id = msg["id"]
    session_id = msg["session_id"]

    set_status(msg_id, "processing")
    print(f"→ 처리 중: session={session_id[:8]} msg={msg_id[:8]}")

    try:
        messages = build_context(session_id, msg["content"])

        resp = requests.post(
            HERMES_API,
            headers={"Authorization": f"Bearer {HERMES_KEY}"},
            json={"model": HERMES_MODEL, "messages": messages, "stream": False},
            timeout=HERMES_TIMEOUT,
        )

        if resp.status_code != 200:
            print(f"✗ Hermes 오류 {resp.status_code}: {resp.text[:200]}")
            set_status(msg_id, "error")
            return

        answer = resp.json()["choices"][0]["message"]["content"]

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
    print(f"Polling every {POLL_INTERVAL}s...")
    recover_orphaned()
    while True:
        try:
            poll()
        except Exception as e:  # noqa: BLE001
            print(f"Polling error: {e}")
        time.sleep(POLL_INTERVAL)
