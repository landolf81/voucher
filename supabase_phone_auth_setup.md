# Supabase 휴대폰 인증 설정 가이드

## 1. Supabase 대시보드 설정

### Authentication 설정
1. Supabase 대시보드 → **Authentication** → **Settings**
2. **Phone Auth** 섹션에서:
   - **Enable phone signup** 체크
   - SMS Provider 선택 (Twilio, MessageBird 등)
   - API 키 설정

### SMS Provider 설정 (Twilio 예시)
```
Twilio Account SID: ACxxxxx...
Twilio Auth Token: xxxxx...
Twilio Phone Number: +1234567890
```

## 2. 클라이언트 코드 - 휴대폰 인증

### 회원가입 (휴대폰 번호)
```javascript
const { data, error } = await supabase.auth.signUp({
  phone: '+821012345678',
  password: 'your-password'
})
```

### OTP 확인
```javascript
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+821012345678',
  token: '123456',
  type: 'sms'
})
```

### 로그인
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  phone: '+821012345678',
  password: 'your-password'
})
```

## 3. 사용자 프로필 생성

인증 성공 후 user_profiles 테이블에 추가 정보 저장:

```javascript
// 인증 성공 후
const user = data.user;

// 프로필 생성
const { data: profile, error } = await supabase
  .from('user_profiles')
  .insert([{
    id: user.id,  // auth.users.id와 연결
    name: '사용자 이름',
    role: 'staff',
    site_id: 'site-uuid',
    is_active: true
  }])
```

## 4. RLS 정책으로 권한 관리

```sql
-- 관리자만 모든 사용자 관리 가능
CREATE POLICY "Admin access" ON user_profiles
FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 일반 사용자는 자신의 정보만 조회
CREATE POLICY "Self access" ON user_profiles
FOR SELECT TO authenticated 
USING (id = auth.uid());
```

## 5. API 라우트 수정

기존 `/api/users` 대신 `/api/auth` 사용:

```typescript
// 현재 사용자 정보 조회
const { data: { user } } = await supabase.auth.getUser()

// 프로필 정보 조회
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*, sites(site_name)')
  .eq('id', user.id)
  .single()
```

## 6. 마이그레이션 과정

1. **백업**: 기존 users 테이블 데이터 백업
2. **Auth 설정**: 휴대폰 인증 활성화
3. **테이블 생성**: user_profiles 테이블 생성
4. **데이터 이관**: 기존 사용자를 auth.users + user_profiles로 이전
5. **코드 수정**: 인증 로직 변경
6. **테스트**: 로그인/회원가입 테스트

## 7. 혜택

- ✅ **보안**: JWT 토큰, 자동 세션 관리
- ✅ **휴대폰 인증**: SMS OTP 지원
- ✅ **이메일 인증**: 이메일 링크/OTP 지원
- ✅ **권한 관리**: RLS로 자동 권한 제어
- ✅ **확장성**: 소셜 로그인 등 추가 인증 방식 지원