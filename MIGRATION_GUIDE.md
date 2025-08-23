# 🔄 Mock DB → Supabase 마이그레이션 가이드

## 현재 상황
- Mock DB 임시 접근 코드 제거됨
- 이제 Supabase만 사용
- **필수**: Supabase에 초기 데이터 추가 필요

## 마이그레이션 단계

### 1. Supabase SQL 실행 (필수)
Supabase SQL Editor에서 다음 순서로 실행:

```sql
-- 1. 기본 스키마
\i '/supabase/schema.sql'

-- 2. 초기 사용자 데이터
\i '/supabase/seed_users.sql'  

-- 3. auth.users 동기화
\i '/supabase/complete_fix.sql'
```

### 2. 테스트 계정 확인
마이그레이션 후 사용 가능한 계정:

| 사용자 ID | 전화번호 | 역할 | 비고 |
|----------|---------|------|------|
| admin | 01087654321 | admin | 관리자 |
| staff | 01023456789 | staff | 직원 |
| viewer | 01012345678 | staff | 조회용 |

### 3. 서버 재시작
```bash
# 서버 완전 종료
Ctrl + C

# 캐시 삭제 (선택)
rm -rf .next

# 재시작
npm run dev
```

### 4. 로그인 테스트
1. `/login` 페이지 접속
2. `admin` 입력
3. SMS 인증 (Mock SMS 사용)
4. 개발 환경에서는 콘솔에 인증번호 표시

## 주의사항

### ⚠️ Mock DB 조건 제거됨
- URL에 `dummy` 없으면 Supabase 사용
- 반드시 `seed_users.sql` 실행 필요
- 그렇지 않으면 "등록되지 않은 사용자" 오류

### 🔐 인증 플로우
1. 사용자 ID → Supabase users 테이블 조회
2. 전화번호로 SMS 발송
3. 인증번호 검증
4. JWT 토큰 생성

### 📊 데이터 확인
```sql
-- 사용자 목록 확인
SELECT id, email, phone, name, role FROM users;

-- auth.users 동기화 확인  
SELECT COUNT(*) FROM auth.users;
SELECT COUNT(*) FROM public.users;
```

## 롤백 방법 (긴급시)
임시로 Mock DB로 되돌리려면:

```bash
# .env.local 수정
NEXT_PUBLIC_SUPABASE_URL=https://dummy-mock-db.local
```

이 경우 다시 Mock DB 사용됨.