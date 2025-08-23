# 🏗️ 교환권 관리 시스템 프로젝트 구조

## 📋 프로젝트 개요
- **프로젝트명**: Voucher Management System
- **버전**: 0.2.0
- **프레임워크**: Next.js 14.2.5 + React 18.2.0
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth
- **스타일**: CSS-in-JS (인라인 스타일)

## 🗂️ 폴더 구조

```
D:\voucher\
├── 📱 app\                        # Next.js 14 App Router
│   ├── admin\                     # 관리자 페이지
│   │   ├── dashboard\            
│   │   │   └── page.tsx          # 통합 관리 대시보드
│   │   └── page.tsx              
│   ├── api\                       # API 라우트
│   │   ├── audit\                # 감사 로그
│   │   ├── auth\                 # 인증 관련
│   │   │   ├── admin\           
│   │   │   ├── login\           
│   │   │   ├── profile\         
│   │   │   ├── send-sms\        # SMS 발송
│   │   │   └── verify-sms\      # SMS 검증
│   │   ├── sites\                # 사업장 관리
│   │   ├── user-profiles\        # 사용자 프로필
│   │   ├── users\                # 사용자 관리
│   │   ├── v1\                   # API v1
│   │   │   ├── pdf\             # PDF 생성
│   │   │   │   ├── statement\   # 정산서
│   │   │   │   └── voucher-a4\  # A4 교환권
│   │   │   └── vouchers\        # 교환권 API
│   │   │       ├── use\         # 사용 처리
│   │   │       └── verify\      # 검증
│   │   ├── voucher-recipients\   # 수령인 관리
│   │   ├── voucher-templates\    # 템플릿 관리
│   │   └── vouchers\             # 교환권 관리
│   │       ├── assign-serial\    # 일련번호 할당
│   │       ├── bulk-issue\      # 대량 발행
│   │       ├── bulk-recall\     # 대량 회수
│   │       ├── issue-batch\     # 배치 발행
│   │       ├── manual-issue\    # 수동 발행
│   │       ├── mobile\          # 모바일 교환권
│   │       ├── recall\          # 회수
│   │       ├── search-new\      # 검색
│   │       ├── upload-excel\    # 엑셀 업로드
│   │       └── use\             # 사용 처리
│   ├── login\                    # 로그인 페이지
│   ├── scan\                     # QR 스캔 페이지
│   ├── test-auth\               # 인증 테스트
│   ├── voucher\[id]\            # 교환권 상세
│   └── page.tsx                 # 홈페이지
│
├── 🧩 components\                # 공통 컴포넌트
│   ├── Navigation.tsx           # 네비게이션
│   └── ProtectedRoute.tsx      # 라우트 보호
│
├── 📚 lib\                       # 라이브러리/유틸리티
│   ├── auth.ts                  # 인증 관련
│   ├── auth\                    
│   │   ├── middleware.ts       # 인증 미들웨어
│   │   └── permissions.ts      # 권한 관리
│   ├── contexts\                
│   │   └── AuthContext.tsx     # 인증 컨텍스트
│   ├── crypto.ts                # 암호화
│   ├── device.ts                # 디바이스 감지
│   ├── encryption.ts            # 암호화 유틸
│   ├── hmac.ts                  # HMAC 서명
│   ├── hooks\                   
│   │   └── useDevice.ts        # 디바이스 훅
│   ├── jwt.ts                   # JWT 처리
│   ├── middleware.ts            # 미들웨어
│   ├── mock-db.ts               # Mock 데이터베이스
│   ├── serial-number.ts         # 일련번호 생성
│   ├── sms.ts                   # SMS 서비스
│   └── supabase.ts             # Supabase 클라이언트
│
├── 🗄️ supabase\                  # 데이터베이스 스크립트
│   ├── schema.sql               # 기본 스키마
│   ├── auth-schema.sql         # 인증 스키마
│   ├── policies.sql            # RLS 정책
│   ├── test-data.sql           # 테스트 데이터
│   └── 기타 마이그레이션 파일들
│
├── 🖼️ font\                      # 폰트 파일
│   ├── public\static\          # Pretendard OTF
│   └── web\                    # 웹폰트
│
├── 📝 docs\                      # 문서
│   ├── ARCHITECTURE.md         # 아키텍처
│   ├── DEVELOPMENT_PLAN.md     # 개발 계획
│   └── REQUIREMENTS.md         # 요구사항
│
└── 📦 설정 파일
    ├── package.json             # 프로젝트 의존성
    ├── tsconfig.json           # TypeScript 설정
    └── next.config.js          # Next.js 설정
```

## 🔗 주요 의존성

### 핵심 프레임워크
- **next**: 14.2.5 - React 풀스택 프레임워크
- **react**: 18.2.0 - UI 라이브러리
- **react-dom**: 18.2.0 - React DOM 렌더러
- **typescript**: 5.6.2 - 타입 안전성

### 데이터베이스 & 인증
- **@supabase/supabase-js**: 2.45.4 - Supabase 클라이언트

### PDF & QR 코드
- **pdfmake**: 0.2.10 - PDF 생성
- **qrcode**: 1.5.4 - QR 코드 생성
- **@zxing/browser**: 0.1.5 - QR 코드 스캔

### 유틸리티
- **xlsx**: 0.18.5 - 엑셀 파일 처리
- **nanoid**: 5.1.5 - 고유 ID 생성
- **zod**: 3.23.8 - 스키마 검증

### 폰트
- **@fontsource/pretendard**: 5.2.5 - 한글 폰트

## 🗃️ 데이터베이스 구조

### 핵심 테이블
1. **vouchers** - 교환권 정보
   - serial_no (일련번호)
   - amount (금액)
   - association (영농회)
   - name (이름)
   - dob (생년월일)
   - status (상태: issued/used/canceled)
   - used_at, used_by_user_id, used_at_site_id

2. **users** - 사용자 (레거시)
   - email, phone, name
   - role (admin/staff/viewer/part_time)
   - site_id (소속 사업장)

3. **user_profiles** - 사용자 프로필
   - id (auth.users와 연동)
   - name, role
   - site_id (소속 사업장)
   - employee_id (사번)
   - is_active (활성 상태)

4. **sites** - 사업장
   - site_name (사업장명)
   - address, phone, fax
   - business_number (사업자번호)
   - status (active/inactive)

5. **voucher_templates** - 교환권 템플릿
   - voucher_name (템플릿명)
   - voucher_type (fixed/amount)
   - expires_at (만료일)
   - selected_sites (사용 가능 사업장)
   - field_positions (필드 위치 JSON)

6. **audit_logs** - 감사 로그
   - voucher_id, action
   - actor_user_id, site_id
   - details (상세 정보 JSON)

## 🔐 인증 & 권한 시스템

### 권한 레벨 (4단계)
1. **admin** - 전체 관리자
   - 모든 기능 접근 가능
   - 사용자 관리, 사업장 관리
   - 시스템 설정

2. **staff** - 직원
   - 교환권 발행/사용/조회
   - 소속 사업장 데이터만 접근
   - 정산서 조회

3. **part_time** - 아르바이트
   - 교환권 사용 처리만 가능
   - 제한적 조회 권한

4. **viewer** - 조회자
   - 읽기 전용
   - 교환권 조회만 가능

### 인증 흐름
1. 현재: 이메일 + 패스워드 (임시)
2. 계획: 사번 + SMS 인증
3. 향후: 카카오톡 인증 추가

## 🎯 핵심 기능

### 1. 교환권 관리
- **발행**: 엑셀 업로드, 수동 입력, 대량 발행
- **사용**: QR 스캔, 수동 검색, 원자적 상태 변경
- **조회**: 다양한 필터 (기간, 상태, 사업장 등)
- **회수**: 교환권 취소 및 재발행

### 2. PDF 생성
- **A4 단일 교환권**: QR 코드 포함
- **기간별 정산서**: 사업장별 사용 내역
- **한글 폰트**: Pretendard 적용

### 3. 보안 기능
- **HMAC 서명**: QR 코드 무결성 검증
- **RLS 정책**: 사업장별 데이터 격리
- **감사 로그**: 모든 작업 추적
- **원자적 트랜잭션**: 중복 사용 방지

### 4. 모바일 대응
- **반응형 UI**: 디바이스별 최적화
- **PWA 지원**: 오프라인 사용 가능
- **카메라 스캔**: ZXing 라이브러리 활용

## 🚀 개발 현황

### ✅ 완료된 기능
- 기본 데이터베이스 구조
- 교환권 CRUD API
- PDF 생성 (A4, 정산서)
- QR 코드 생성/스캔
- 사용자 관리 시스템
- 관리자 대시보드
- 엑셀 업로드/다운로드

### 🔄 진행 중
- SMS 인증 시스템
- RLS 정책 강화
- 모바일 UI 최적화

### 📅 예정 기능
- 카카오톡 인증
- n8n 자동화 연동
- 고급 정산 기능
- 대시보드 통계

## 📝 개발 가이드

### 시작하기
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 타입 체크
npm run typecheck

# 린트
npm run lint
```

### 환경 변수 (.env)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
HMAC_SECRET=your_hmac_secret
SMS_API_KEY=your_sms_api_key (optional)
```

### 데이터베이스 초기화
1. Supabase 프로젝트 생성
2. `/supabase/schema.sql` 실행
3. `/supabase/policies.sql` 실행
4. 테스트 데이터 추가 (선택사항)

## 🔒 보안 고려사항
- HMAC 시크릿 키 관리
- 환경 변수 분리
- RLS 정책 적용
- HTTPS 강제
- 세션 관리
- 감사 로그 기록

## 📊 성능 목표
- 스캔→사용처리: 3초 이내
- PDF 생성: 1분 이내
- 페이지 로드: 2초 이내
- 중복 사용: 0건

## 🤝 팀 구성 및 역할
- 관리자: 전체 시스템 관리
- 직원: 일상 운영
- 아르바이트: 현장 사용 처리
- 조회자: 모니터링

---
*마지막 업데이트: 2025년 1월*