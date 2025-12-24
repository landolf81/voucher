# 🔧 Supabase 실제 DB 연결 설정

## 현재 문제
`.env.local` 파일의 URL에 `dummy-mock-db.local`이 설정되어 있어 Mock DB를 사용 중입니다.

## 해결 방법

### 1. Supabase 프로젝트 정보 확인
1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인
2. 프로젝트 선택
3. **Settings → API** 메뉴 이동
4. 다음 정보 복사:
   - **Project URL**: `https://xxxxx.supabase.co` 형식
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` 형식

### 2. `.env.local` 파일 수정
```bash
# 실제 값으로 변경 필요
NEXT_PUBLIC_SUPABASE_URL=https://imxeownmecybrajjeklr.supabase.co  # 예시
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx  # 실제 키
```

### 3. 서버 재시작
```bash
# 서버 완전 종료 (Ctrl+C)
# 다시 시작
npm run dev
```

### 4. 연결 확인
브라우저 콘솔에서:
- ❌ "Mock DB 사용" → 여전히 더미 데이터
- ✅ "Supabase 사용" → 실제 DB 연결 성공

## 체크리스트
- [ ] `.env.local`에 실제 Supabase URL 입력 (dummy 문자열 없음)
- [ ] `.env.local`에 실제 anon key 입력
- [ ] 서버 재시작
- [ ] 브라우저 캐시 삭제 (Ctrl+Shift+R)

## 주의사항
- URL에 `dummy` 문자열이 포함되면 자동으로 Mock DB 사용
- 실제 Supabase URL은 `https://[project-id].supabase.co` 형식
- anon key는 JWT 토큰 형식 (eyJ로 시작)