# Voucher Starter (A4 Single Template) — Supabase + Next.js

## 포함
- A4 단일 교환권 PDF 라우트: `/api/v1/pdf/voucher-a4/[serial]`
- 스캔 페이지 `/scan`: 검증/사용처리/A4 PDF 열기
- Supabase 스키마 + 원자적 사용처리 RPC
- HMAC QR 페이로드(`lib/hmac.ts`)

## 사용법
1. `.env` 만들기 (`.env.example` 참고)
2. Supabase에 `/supabase/schema.sql` 실행
3. `npm i && npm run dev` → `/scan` 접속

## PDF 폰트
- pdfmake는 기본 한글 폰트가 없습니다. 배포 시 `font/public/static/Pretendard-Regular.otf` 등을 추가하고
  라우트의 `fonts`에 파일 버퍼를 읽어 등록하세요.
  (현재 Pretendard 폰트가 적용되어 한글이 정상 표시됩니다.)

## QR
- PDF에는 `VCH:{serial}|TS|SIG` 형태의 QR이 자동 포함됩니다.

## 🚀 새로운 개발 계획 (2024년 12월)

### 📱 인증 시스템 개선
- **문자 인증**: 네이버 클라우드 SENS 연동 (Mock SMS로 개발)
- **회원가입**: 관리자가 사용자 등록 후 휴대폰 인증
- **권한 관리**: admin/staff 역할별 접근 제어
1
### 🎯 디바이스별 UI 분기
- **모바일**: 스캔 전용 메뉴
- **PC**: 스캔 + 데이터베이스 관리자 메뉴

### 🔐 보안 강화
- **RLS 정책**: 사업장별 데이터 접근 제어
- **감사 로그**: 모든 작업 기록 및 추적

---

개요(Overview)
목표: 교환권 발행·조회·사용처리를 전산화하고, A4 단건 PDF와 모바일 링크/QR로 제시·검증 가능하게 만들기.

핵심가치: 중복 사용 방지, 현장 스캔 속도, 간편한 정산(PDF), 감사 추적.

스택: Supabase(Postgres+Auth+RLS), Next.js(PWA), pdfmake(PDF), ZXing(카메라 스캔), n8n(업로드/알림 자동화).

산출물:

모바일 스캐너 웹앱(PWA)

A4 단일 교환권 PDF 템플릿

기간별 정산서 PDF

엑셀→DB 업로드 자동화(n8n)

운영 매뉴얼(발행/사용/정산)

기능 범위(Scope)
발행: 엑셀→DB 등록(일련번호·금액·성명·DOB·영농회)

제시: 링크/이미지 또는 종이(A4) QR

검증/사용: 스캔→유효성 검증→원자적 issued→used 전환

조회: 기간/상태/성명/영농회/사업장 필터

출력: A4 단권 PDF, 기간 정산서 PDF

로그: 모든 행위 감사로그(issue/use/cancel/print)

데이터 모델(요지)
vouchers(serial_no UNIQUE, amount, association, name, dob, status, issued_at, used_at, used_by_user_id, used_at_site_id, notes)

sites(id, site_name) / users(id, role, site_id) / audit_logs(...)

QR 페이로드: VCH:{serial}|TS:{yyyymmddHHMM}|SIG:{HMAC}(서버 시크릿)

API(요지)
POST /api/v1/vouchers/verify (검증)

POST /api/v1/vouchers/use (사용처리, 원자적 RPC)

GET /api/v1/pdf/voucher-a4/[serial] (A4 단건)

GET /api/v1/pdf/statement?site_id&from&to (정산서)

단계별 로드맵(3개월 기준)
1단계 — 요구정의 & 설계(주 1~2) ✅ 완료
산출물: 요구사항 명세(필드/양식/권한/플로우), 화면 와이어프레임, QR 규격 확정, 운영 규칙(재발행·취소·분실 대응).

체크: 일련번호 체계(YY-SITE-번호), 성명/생년월일 표기 범위(마스킹), 사업장 권한 경계.

2단계 — DB/RLS/RPC 구축(주 2~3) ✅ 완료
Supabase 스키마 적용, RLS(사업장 단위 접근) 초안, use_voucher_by_serial RPC 구현.

체크: 인덱스/제약, 트랜잭션 충돌 테스트(중복 스캔 방지), 샘플 데이터 시드.

3단계 — PWA 기본 & 스캔/사용처리(주 3~4) 🔄 진행중
로그인, 스캔 페이지(카메라/수기 입력), 검증/사용처리 API 연동, 상태/오류 UX.

체크: 카메라 권한, 약전파 환경에서 스캔 안정성, 이중탭 방지.

4단계 — PDF 출력(주 5~6) ✅ 완료
A4 단건 교환권 PDF(QR 포함) + 기간 정산서 PDF.

체크: 한글 폰트 내장(Pretendard), 프린터 여백/용지 맞춤, 시계·서체 일관성.

5단계 — 인증 시스템 & 권한 관리(주 7~8) 🆕 추가됨
Mock SMS 인증, 사용자 등록, 권한별 메뉴, 디바이스 감지.

체크: 인증 플로우, 권한 제어, 모바일/PC UI 분기.

6단계 — 업로드/알림 자동화(주 9~10)
n8n: 엑셀→DB 업로드(중복 검사), 일일 정산서 PDF 생성/전송(메일·카톡·SMS).

체크: 업로드 실패/부분성공 리포트, 알림 발송 로그.

7단계 — 보안·권한 강화 & 운영도구(주 11~12)
RLS 세분화(관리자/직원/감사), 감사로그 뷰, 취소/재발행 프로세스(사유 필수).

체크: 환경변수 시크릿, 키 순환(반기), 접근 로그.

8단계 — 파일럿 & 안정화(주 13~14) 🆕 추가됨
1~2개 사업장 파일럿 → 이슈 반영(UX, 속도, 프린트 품질, 네트워크 불안 대응).

Go-Live 체크리스트: 데이터 이행, 계정/권한, 백업/롤백, 매뉴얼 배포, 책임자 연락체계.

운영 체크리스트(요약)
보안: HMAC 시크릿 분리(.env), HTTPS 강제, RLS 검증 테스트.

신뢰성: 사용처리 온라인 전용, 실패 재시도 로직(멱등).

감사: 모든 변경에 audit_logs 기록(누가/언제/어디서/무엇을).

인쇄 품질: 프린터 드라이버/여백·해상도 표준화(사무실 프린터 기준).

지원 프로세스: 분실/오손 → canceled 후 재발행(상호참조 기록).

성공 기준(KPI)
중복 사용 0건, 스캔→사용처리 평균 3초 이내, 정산서 생성 1분 이내, 파일럿 기간 클레임 0건.

## 📋 상세 요구사항

### 🔐 인증 시스템
- **로그인 방식**: 문자 인증만 사용
- **회원가입**: 관리자가 사용자 정보 등록 후 휴대폰 인증
- **권한**: admin(관리자), staff(직원)

### 📱 디바이스별 UI
- **모바일**: 스캔 전용 메뉴
- **PC**: 스캔 + 데이터베이스 관리자 메뉴

### 💬 SMS 서비스
- **개발 단계**: Mock SMS (콘솔 출력)
- **운영 단계**: 네이버 클라우드 SENS
- **비용**: 22원/건 (대량 할인 가능)

## 🛠️ 기술 스택

### 백엔드
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth + SMS 인증
- **API**: Next.js API Routes

### 프론트엔드
- **프레임워크**: Next.js 14 + React 18
- **스타일링**: CSS-in-JS (인라인 스타일)
- **폰트**: Pretendard (한글 지원)

### 외부 서비스
- **SMS**: 네이버 클라우드 SENS
- **PDF**: pdfmake
- **QR**: qrcode
- **스캔**: @zxing/browser
