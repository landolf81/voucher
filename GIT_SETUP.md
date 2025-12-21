# 🔧 Git Commit & Push 설정 가이드

## 현재 상태
- ✅ Remote 저장소: `https://github.com/landolf81/voucher.git`
- ❌ Git 사용자 정보 미설정

## 필수 설정

### 1. Git 사용자 정보 설정

#### 전역 설정 (모든 프로젝트에 적용)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### 이 프로젝트만 설정 (권장)
```bash
cd /Users/jeongbyeong-geun/Documents/Voucher
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 2. 설정 확인
```bash
git config user.name
git config user.email
```

## Commit & Push 절차

### 1. 변경사항 확인
```bash
git status
```

### 2. 변경사항 스테이징
```bash
# 모든 변경사항 추가
git add .

# 또는 특정 파일만 추가
git add app/admin/dashboard/page.tsx
git add package.json
```

### 3. 커밋
```bash
git commit -m "커밋 메시지"
```

#### 커밋 메시지 예시
```bash
# 기능 추가
git commit -m "feat: 관리자 대시보드 사이드바 및 본문 영역 상단 고정"

# 버그 수정
git commit -m "fix: Next.js 16 Turbopack 설정 오류 수정"

# 패키지 업데이트
git commit -m "chore: 의존성 패키지 업데이트 (Next.js 16, React 19, Supabase)"

# 문서 추가
git commit -m "docs: Supabase 이메일 설정 가이드 추가"
```

### 4. Push
```bash
# main 브랜치에 push
git push origin main

# 또는 현재 브랜치에 push
git push
```

## 현재 변경사항

다음 파일들이 수정되었습니다:
- `app/admin/dashboard/page.tsx` - 사이드바 및 본문 영역 상단 고정
- `components/admin/dashboard/OverviewComponents.tsx` - 중복 헤더 제거
- `next.config.js` - Turbopack 설정 추가
- `package.json` - 패키지 업데이트
- `tsconfig.json` - TypeScript 설정
- `yarn.lock` - 의존성 업데이트
- `SUPABASE_EMAIL_SETUP.md` - 새 문서 추가

## 빠른 실행 명령어

```bash
# 1. 사용자 정보 설정 (한 번만)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 2. 변경사항 추가 및 커밋
git add .
git commit -m "feat: 관리자 대시보드 UI 개선 및 패키지 업데이트"

# 3. Push
git push origin main
```

## 인증 설정 (필요한 경우)

### Personal Access Token 사용 (GitHub)
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" 클릭
3. 권한 선택: `repo` (전체 저장소 접근)
4. 토큰 생성 후 복사
5. Push 시 비밀번호 대신 토큰 사용

### SSH 키 사용 (권장)
```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "your.email@example.com"

# 공개키 복사
cat ~/.ssh/id_ed25519.pub

# GitHub에 추가
# Settings → SSH and GPG keys → New SSH key
```

## 문제 해결

### Push 거부되는 경우
```bash
# 원격 저장소의 최신 변경사항 가져오기
git pull origin main

# 충돌 해결 후 다시 push
git push origin main
```

### 커밋 메시지 수정
```bash
# 마지막 커밋 메시지 수정
git commit --amend -m "새로운 메시지"

# 이미 push한 경우 (주의!)
git push --force origin main
```

### 변경사항 되돌리기
```bash
# 스테이징 취소
git restore --staged <file>

# 변경사항 취소
git restore <file>
```

## 참고사항

- `.env.local` 파일은 `.gitignore`에 포함되어 있어 커밋되지 않습니다.
- `node_modules`는 자동으로 제외됩니다.
- 커밋 전에 `npm run build`로 빌드 오류 확인 권장

