# Supabase 실제 DB 연결 가이드

## 현재 상황
- **Mock DB 사용 중**: 메모리 기반 더미 데이터 사용
- **데이터 영구 저장 안 됨**: 서버 재시작 시 초기화

## 실제 Supabase DB 연결 방법

### 1. 환경 변수 파일 생성
`.env.local` 파일을 프로젝트 루트에 생성:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
VOUCHER_HMAC_SECRET=your-secret-key-here
PDF_FOOTER_NOTICE=본 이용권은 지정된 사업장에서만 사용 가능합니다.
```

### 2. Supabase 프로젝트에서 값 가져오기
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. Settings → API 메뉴
4. 다음 값 복사:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`에 입력
   - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 입력

### 3. 데이터베이스 스키마 실행
Supabase SQL Editor에서 다음 파일들 실행:
1. `/supabase/schema.sql` - 기본 테이블 생성
2. `/supabase/complete_fix.sql` - auth.users 동기화
3. `/supabase/policies.sql` - RLS 정책 (있는 경우)

### 4. 서버 재시작
```bash
npm run dev
```

## Mock DB vs 실제 DB 구분 방법

### Mock DB 사용 시 (현재 상태)
- URL에 'dummy' 포함 또는 `.env.local` 파일 없음
- 콘솔에 "Mock DB 사용" 메시지 출력
- 데이터 변경이 저장되지 않음

### 실제 DB 사용 시
- 유효한 Supabase URL과 Key 설정
- 콘솔에 "Supabase 사용" 메시지 출력
- 데이터 영구 저장

## 트러블슈팅

### auth.users와 public.users 불일치
- `/supabase/complete_fix.sql` 실행하여 동기화

### 사용자 등록 시 반영 안 됨
- 트리거 설정 확인 (`complete_fix.sql` 실행)
- RLS 정책 확인

### Mock DB로 계속 연결됨
1. `.env.local` 파일 존재 확인
2. URL에 'dummy' 문자열 없는지 확인
3. 브라우저 캐시 삭제 후 재시도
4. Next.js 서버 완전 재시작 (`Ctrl+C` 후 `npm run dev`)

## 데이터 마이그레이션
Mock DB에서 실제 DB로 데이터 이전이 필요한 경우:
1. Mock DB 데이터를 Excel로 export
2. Supabase Dashboard에서 CSV import
3. 또는 API를 통한 bulk insert