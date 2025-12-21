# 📧 Supabase 이메일 인증 설정 가이드

## 문제 상황
Supabase 로그에는 메일 발송이 성공했다고 나오지만(`mail.send` 이벤트), 실제로 이메일이 도착하지 않는 경우가 있습니다.

## 원인 분석

### 1. Supabase 기본 SMTP 제한사항
- Supabase는 기본적으로 **제한된 메일 발송 기능**만 제공합니다
- 개발 환경에서는 작동하지만, 프로덕션에서는 **자체 SMTP 서버 설정이 필요**합니다
- 기본 메일 서비스는 스팸 필터에 걸릴 가능성이 높습니다

### 2. 가능한 원인들
1. **SMTP 서버 미설정**: Supabase 대시보드에서 SMTP 설정이 안 되어 있음
2. **스팸 폴더 이동**: 메일이 스팸 폴더로 분류됨
3. **이메일 도메인 제한**: `noreply@mail.app.supabase.io`에서 발송되어 스팸 처리됨
4. **Rate Limiting**: 일일 발송 한도 초과

## 해결 방법

### 방법 1: Supabase 대시보드에서 SMTP 설정 (권장)

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **Authentication → Settings → SMTP Settings**
   - **Enable Custom SMTP** 활성화
   - 다음 정보 입력:

#### Gmail SMTP 설정 예시
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Password: [앱 비밀번호] (일반 비밀번호 아님!)
Sender Email: your-email@gmail.com
Sender Name: Voucher System
```

#### 네이버 메일 SMTP 설정 예시
```
SMTP Host: smtp.naver.com
SMTP Port: 587
SMTP User: your-email@naver.com
SMTP Password: [네이버 메일 비밀번호]
Sender Email: your-email@naver.com
Sender Name: 교환권 관리 시스템
```

#### Outlook/Hotmail SMTP 설정 예시
```
SMTP Host: smtp-mail.outlook.com
SMTP Port: 587
SMTP User: your-email@outlook.com
SMTP Password: [Outlook 비밀번호]
Sender Email: your-email@outlook.com
Sender Name: Voucher System
```

### 방법 2: Gmail 앱 비밀번호 생성 (Gmail 사용 시)

Gmail을 사용하는 경우 일반 비밀번호가 아닌 **앱 비밀번호**가 필요합니다:

1. Google 계정 설정 → 보안
2. 2단계 인증 활성화 (필수)
3. 앱 비밀번호 생성:
   - "앱 선택" → "메일"
   - "기기 선택" → "기타(맞춤 이름)" → "Supabase" 입력
   - 생성된 16자리 비밀번호를 SMTP Password에 입력

### 방법 3: 이메일 템플릿 커스터마이징

Supabase 대시보드에서:
1. **Authentication → Email Templates**
2. Magic Link 템플릿 수정
3. 발신자 정보 및 메일 내용 커스터마이징

### 방법 4: 스팸 폴더 확인

1. 받는 사람의 **스팸 폴더** 확인
2. `noreply@mail.app.supabase.io`를 **허용 발신자**로 추가
3. 메일 클라이언트의 스팸 필터 설정 확인

## 테스트 방법

### 1. Supabase 대시보드에서 테스트
1. **Authentication → Users**
2. 사용자 선택 → **Send Magic Link** 클릭
3. 실제 메일 도착 확인

### 2. 코드에서 테스트
```typescript
// app/api/auth/test-email/route.ts
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signInWithOtp({
    email: 'test@example.com',
    options: {
      emailRedirectTo: 'https://your-domain.com/login'
    }
  });

  return Response.json({ data, error });
}
```

## 환경 변수 확인

`.env.local` 파일에 다음이 설정되어 있는지 확인:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://your-domain.com  # 리다이렉트 URL용
```

## 로그 확인

### Supabase 대시보드
1. **Logs → Auth Logs**
2. `mail.send` 이벤트 확인
3. 에러 메시지 확인

### 로그에서 확인할 사항
- ✅ `"event":"mail.send"` → 메일 발송 시도 성공
- ❌ `"error"` 필드 존재 → SMTP 설정 문제 가능성
- ❌ `"status":"failed"` → SMTP 연결 실패

## 대안: 외부 이메일 서비스 사용

Supabase SMTP 대신 외부 서비스를 사용할 수도 있습니다:

### Resend (추천)
- 무료 플랜: 월 3,000건
- 간단한 API
- 좋은 전달률

### SendGrid
- 무료 플랜: 일일 100건
- 안정적인 서비스

### AWS SES
- 저렴한 비용
- 높은 확장성

## 체크리스트

- [ ] Supabase 대시보드에서 SMTP 설정 확인
- [ ] SMTP 서버 정보 정확히 입력 (호스트, 포트, 인증 정보)
- [ ] Gmail 사용 시 앱 비밀번호 생성 및 사용
- [ ] 스팸 폴더 확인
- [ ] 이메일 템플릿 커스터마이징 (선택)
- [ ] 테스트 메일 발송 및 수신 확인
- [ ] 로그에서 에러 메시지 확인

## 문제 해결

### 여전히 메일이 오지 않는 경우

1. **SMTP 연결 테스트**
   ```bash
   # telnet으로 SMTP 서버 연결 테스트
   telnet smtp.gmail.com 587
   ```

2. **Supabase 로그 확인**
   - Authentication → Logs
   - 에러 메시지 확인

3. **이메일 서비스 제공자 확인**
   - 일부 이메일 서비스는 SMTP 접근을 제한할 수 있음
   - 방화벽 설정 확인

4. **Rate Limiting 확인**
   - 일일 발송 한도 초과 여부 확인
   - 필요시 플랜 업그레이드

## 참고 자료

- [Supabase Email Auth 문서](https://supabase.com/docs/guides/auth/auth-email)
- [Supabase SMTP 설정](https://supabase.com/docs/guides/auth/auth-smtp)
- [Gmail 앱 비밀번호 가이드](https://support.google.com/accounts/answer/185833)

