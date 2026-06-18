# Hermes Chat 설정 가이드

Supabase 큐 패턴으로 Vercel 프론트엔드와 맥북의 Hermes를 연결합니다.

```
Vercel (Chat UI) ──INSERT──▶ Supabase ◀──poll── Mac Relay ──▶ Hermes API (:8642)
       ▲                                                         
       └──────────── Realtime 구독 (assistant 응답) ────────────┘
```

## 1. Supabase 마이그레이션 적용

`supabase/migrations/20260618_hermes_chat_system.sql` 실행.

- Supabase 대시보드 → SQL Editor 에 파일 내용 붙여넣고 실행, 또는
- `supabase db push` (CLI 사용 시)

생성물: `chat_sessions`, `chat_messages` 테이블 + 인덱스 + Realtime publication 등록.

> Realtime 이 동작하려면 마이그레이션의 `ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages` 가 반드시 적용돼야 합니다. 대시보드 → Database → Replication 에서 `chat_messages` 가 켜져 있는지 확인하세요.

## 2. 프론트엔드 (이미 구현됨)

- 컴포넌트: `components/admin/chat/ChatAssistant.tsx`
- 진입점: 관리자 대시보드 → **AI 어시스턴트** 메뉴 (admin/staff 노출)
- 환경변수: 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 그대로 사용 (추가 불필요)

## 3. Hermes API 서버 (맥북)

`~/.hermes/.env`:
```
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
```
실행:
```bash
hermes gateway
```

## 4. 릴레이 스크립트 (맥북 상시 실행)

```bash
pip install supabase requests python-dotenv
```

환경변수 (셸 또는 `~/.hermes/.env`):
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role 키>      # 권장 (RLS 우회)
HERMES_API_URL=http://localhost:8642/v1/chat/completions
HERMES_API_KEY=change-me-local-dev
HERMES_MODEL=hermes-agent
```

실행:
```bash
python scripts/relay.py
# 백그라운드 상시 실행
nohup python scripts/relay.py > relay.log 2>&1 &
```

> **service_role 키 권장**: 릴레이는 메시지 status 변경과 assistant INSERT를 수행합니다.
> 현재 마이그레이션 RLS는 anon에도 쓰기를 허용하므로 anon 키로도 동작하지만,
> service_role 키를 쓰면 RLS를 우회하고 정책을 authenticated로 좁힐 수 있어 더 안전합니다.

## 5. 테스트

1. `hermes gateway` 실행 확인 (`curl http://localhost:8642/v1/models` 등)
2. `python scripts/relay.py` 실행 → "Relay started" 출력 확인
3. 웹앱 로그인 → AI 어시스턴트 메뉴 → 메시지 전송
4. 릴레이 로그에 `→ 처리 중` → `✓ 응답 완료` 출력 후, 화면에 답변이 실시간 표시되면 성공

## 알려진 차이점 / 주의사항

- **스펙 버그 수정**: 원본 relay 의사코드는 현재 질문을 `processing`으로 바꾼 뒤
  `completed` 메시지만 모아 컨텍스트를 구성해서 **현재 질문이 누락**됩니다.
  `scripts/relay.py`는 현재 질문을 명시적으로 context 끝에 추가해 이를 보완했습니다.
- **환경변수명**: 스펙은 `VITE_*`를 사용하지만 이 프로젝트는 Next.js라 `NEXT_PUBLIC_*` /
  `SUPABASE_*`를 사용합니다.
- **보안(v1 한계)**: 현재 RLS는 "모두 허용"이라 인증된(또는 anon) 누구나 모든 대화를
  읽을 수 있습니다. 내부 도구 전제의 v1 설정입니다. 사용자별 격리가 필요하면
  `chat_sessions.user_id` 추가 + RLS를 `auth.uid()` 기준으로 좁히세요.
- **RAG / 데이터 조회 에이전트**: 업무 규정 검색(pgvector)이나 바우처/회원 데이터
  툴 호출은 이번 범위에 미포함입니다. Hermes 측 에이전트 설정 또는 후속 단계에서 연동합니다.
```
