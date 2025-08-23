# 🔐 Supabase Authentication vs Custom Auth 비교

## Supabase Authentication 용도

### 1. **Row Level Security (RLS) 연동**
```sql
-- auth.uid()를 사용한 정책
create policy "user_own_data" on users 
for select to authenticated 
using (auth.uid() = id);

-- 현재 방식 (Custom Auth)  
create policy "user_own_data" on users
for select to authenticated
using (current_user_id = id); -- 직접 구현 필요
```

### 2. **내장 인증 기능**
- OAuth (Google, GitHub, Apple 등)
- 이메일/비밀번호 로그인
- 매직 링크
- 전화번호 인증 (Twilio 연동)

### 3. **세션 관리**
- JWT 토큰 자동 관리
- 토큰 갱신
- 로그아웃 처리

## 비교 분석

| 기능 | Custom Auth (현재) | Supabase Auth |
|------|-------------------|---------------|
| **설정 복잡도** | 🔴 복잡 | 🟢 간단 |
| **RLS 연동** | 🔴 수동 구현 | 🟢 자동 연동 |
| **토큰 관리** | 🔴 직접 구현 | 🟢 자동 처리 |
| **보안** | 🟡 개발자 책임 | 🟢 검증된 구현 |
| **커스터마이징** | 🟢 완전 자유 | 🟡 제한적 |
| **한국 환경** | 🟢 SMS 특화 | 🟡 글로벌 표준 |

## RLS(Row Level Security) 차이점

### Supabase Auth 사용 시
```sql
-- 간단한 정책
create policy "users_select_own" on users
for select to authenticated
using (auth.uid() = id);

-- 역할 기반 정책
create policy "admin_all_access" on vouchers
for all to authenticated
using (
  exists(
    select 1 from users 
    where id = auth.uid() 
    and role = 'admin'
  )
);
```

### Custom Auth 사용 시 (현재)
```sql
-- 복잡한 JWT 파싱 필요
create policy "users_select_own" on users
for select to authenticated
using (
  (current_setting('app.current_user_id', true))::uuid = id
);

-- 세션 변수 설정 필요
SET app.current_user_id = '33333333-3333-3333-3333-333333333333';
```

## 실제 예시

### 현재 방식 (Custom)
```javascript
// API에서 권한 체크
const user = await supabase
  .from('users')
  .select('role')
  .eq('id', userId)
  .single();

if (user.role !== 'admin') {
  return { error: '권한 없음' };
}

// 데이터 조회
const vouchers = await supabase
  .from('vouchers')
  .select('*');
```

### Supabase Auth 방식
```javascript
// 자동 권한 체크 (RLS)
const { data: vouchers } = await supabase
  .from('vouchers')
  .select('*'); // RLS가 자동으로 권한 체크
```

## 마이그레이션 방법

### 1. auth.users 사용자 생성
```sql
-- public.users와 동일한 ID로 생성
INSERT INTO auth.users (id, email, phone)
SELECT id, email, phone FROM public.users;
```

### 2. RLS 정책 활성화
```sql
-- 기존 정책 삭제
DROP POLICY IF EXISTS "existing_policy" ON vouchers;

-- Supabase Auth 정책 생성
CREATE POLICY "voucher_access" ON vouchers
FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);
```

### 3. 클라이언트 코드 수정
```javascript
// 로그인 시 Supabase Auth 사용
const { data, error } = await supabase.auth.signInWithOtp({
  phone: '+821012345678'
});

// 세션 자동 관리
const { data: { user } } = await supabase.auth.getUser();
```

## 권장사항

### 🎯 **현재 프로젝트에는 Custom Auth 유지**
**이유:**
1. **이미 구현 완료**: SMS 인증 로직 완성
2. **한국 환경 특화**: 전화번호 기반 로그인
3. **단순한 권한 구조**: admin/staff 2단계
4. **마이그레이션 비용**: 큰 변경 불필요

### 📈 **Supabase Auth 고려 시점**
- 다국가 서비스 확장 시
- OAuth 로그인 필요 시  
- 복잡한 권한 체계 필요 시
- RLS 정책이 매우 복잡해질 때

## 결론

**현재는 Custom Auth로 충분하지만, Supabase Auth가 DB 접근 권한 설정은 더 쉽습니다.**

- **RLS 연동**: `auth.uid()` 자동 사용
- **보안**: 검증된 구현체
- **관리**: 토큰/세션 자동 처리

하지만 **마이그레이션 비용 vs 이익**을 고려하면 현재 구조 유지가 합리적입니다.