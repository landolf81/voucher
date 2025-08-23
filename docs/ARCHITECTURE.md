# 🏗️ 교환권 시스템 아키텍처

## 🎯 시스템 개요

### 전체 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (Next.js API) │◄──►│   (Supabase)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile UI     │    │   External      │    │   File Storage  │
│   (PWA)         │    │   Services      │    │   (PDF, QR)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🏛️ 레이어 구조

### 1. Presentation Layer (UI)
- **Next.js App Router**: 페이지 기반 라우팅
- **React Components**: 재사용 가능한 UI 컴포넌트
- **Responsive Design**: 모바일/PC 디바이스별 UI 분기
- **PWA Support**: 모바일 앱과 유사한 사용자 경험

### 2. Application Layer (Business Logic)
- **API Routes**: Next.js API 엔드포인트
- **Service Classes**: 비즈니스 로직 처리
- **Validation**: 입력 데이터 검증
- **Error Handling**: 에러 처리 및 로깅

### 3. Data Access Layer
- **Supabase Client**: 데이터베이스 접근
- **Repository Pattern**: 데이터 접근 추상화
- **Transaction Management**: 원자적 작업 처리
- **Caching**: 성능 최적화

### 4. Infrastructure Layer
- **Supabase**: 데이터베이스, 인증, 스토리지
- **External APIs**: SMS 서비스, 결제 등
- **File System**: PDF 생성, 임시 파일 관리

## 🔐 인증 아키텍처

### 인증 플로우
```
1. 사용자 휴대폰 번호 입력
2. SMS 인증번호 발송 (Mock/실제)
3. 인증번호 입력 및 검증
4. JWT 토큰 발급
5. 권한별 메뉴 접근
```

### 권한 관리
- **Role-Based Access Control (RBAC)**
- **Row Level Security (RLS)**: 데이터베이스 레벨 보안
- **JWT Claims**: 사용자 역할 및 권한 정보

## 📱 디바이스 감지 및 UI 분기

### 디바이스 감지 방법
```typescript
// lib/device.ts
interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  userAgent: string;
}

// User-Agent 기반 감지
// 화면 크기 기반 감지
// 터치 지원 여부 감지
```

### UI 분기 전략
- **Mobile First**: 모바일을 기본으로 설계
- **Progressive Enhancement**: PC에서 추가 기능 제공
- **Responsive Design**: 화면 크기에 따른 레이아웃 조정

## 🗄️ 데이터베이스 아키텍처

### 테이블 구조
```sql
-- 핵심 테이블
sites (사업장)
├── id (UUID, PK)
├── site_name (TEXT)
└── created_at (TIMESTAMPTZ)

users (사용자)
├── id (UUID, PK)
├── phone (TEXT, UNIQUE)
├── name (TEXT)
├── role (admin/staff)
├── site_id (UUID, FK)
└── created_at (TIMESTAMPTZ)

vouchers (교환권)
├── id (UUID, PK)
├── serial_no (TEXT, UNIQUE)
├── amount (NUMERIC)
├── association (TEXT)
├── name (TEXT)
├── dob (DATE)
├── status (issued/used/canceled)
├── issued_at (TIMESTAMPTZ)
├── used_at (TIMESTAMPTZ)
├── used_by_user_id (UUID, FK)
└── used_at_site_id (UUID, FK)

-- 인증 관련 테이블
sms_verifications (SMS 인증)
├── id (UUID, PK)
├── phone (TEXT)
├── code (TEXT)
├── expires_at (TIMESTAMPTZ)
└── created_at (TIMESTAMPTZ)

-- 감사 로그
audit_logs (감사 로그)
├── id (UUID, PK)
├── voucher_id (UUID, FK)
├── action (TEXT)
├── actor_user_id (UUID, FK)
├── site_id (UUID, FK)
├── created_at (TIMESTAMPTZ)
└── details (JSONB)
```

### RLS 정책
```sql
-- 사업장별 접근 제어
CREATE POLICY "site_based_access" ON vouchers
  FOR ALL USING (site_id IN (
    SELECT site_id FROM users WHERE id = auth.uid()
  ));

-- 역할별 권한 제어
CREATE POLICY "admin_full_access" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
```

## 🔄 API 아키텍처

### RESTful API 설계
```
POST   /api/auth/send-sms          # SMS 인증번호 발송
POST   /api/auth/verify-sms        # SMS 인증번호 검증
POST   /api/auth/login             # 로그인
POST   /api/auth/logout            # 로그아웃

GET    /api/v1/vouchers            # 교환권 목록 조회
POST   /api/v1/vouchers/verify     # 교환권 검증
POST   /api/v1/vouchers/use        # 교환권 사용처리
GET    /api/v1/vouchers/:id        # 교환권 상세 조회

GET    /api/v1/pdf/voucher-a4/:serial  # A4 PDF 생성
GET    /api/v1/pdf/statement           # 정산서 PDF 생성

GET    /api/v1/admin/users             # 사용자 관리 (admin)
POST   /api/v1/admin/users             # 사용자 등록 (admin)
PUT    /api/v1/admin/users/:id         # 사용자 수정 (admin)
DELETE /api/v1/admin/users/:id         # 사용자 삭제 (admin)
```

### API 응답 형식
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

interface VoucherData {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  dob: string;
  status: 'issued' | 'used' | 'canceled';
  issued_at: string;
  used_at?: string;
}
```

## 🔒 보안 아키텍처

### 데이터 암호화
- **전송 중**: HTTPS/TLS 1.3
- **저장 시**: 민감한 데이터 암호화
- **비밀번호**: bcrypt 해싱 (필요시)

### 접근 제어
- **API 레벨**: JWT 토큰 검증
- **데이터베이스 레벨**: RLS 정책
- **애플리케이션 레벨**: 역할별 권한 검사

### 감사 및 모니터링
- **모든 API 호출**: 로깅 및 모니터링
- **데이터 변경**: 감사 로그 기록
- **보안 이벤트**: 즉시 알림

## 📊 성능 아키텍처

### 캐싱 전략
- **메모리 캐시**: Redis (필요시)
- **데이터베이스 쿼리**: 인덱스 최적화
- **정적 파일**: CDN 활용

### 비동기 처리
- **SMS 발송**: 백그라운드 작업
- **PDF 생성**: 비동기 처리
- **로깅**: 비동기 로그 기록

### 확장성
- **수평 확장**: 여러 인스턴스 실행
- **데이터베이스**: 읽기/쓰기 분리
- **로드 밸런싱**: 트래픽 분산

## 🚀 배포 아키텍처

### 환경별 구성
```
개발 환경 (Development)
├── Mock SMS 서비스
├── 테스트 데이터베이스
├── 로컬 파일 시스템
└── 디버그 모드

스테이징 환경 (Staging)
├── 실제 SMS 서비스
├── 운영 데이터베이스 구조
├── 클라우드 스토리지
└── 모니터링 활성화

운영 환경 (Production)
├── 실제 SMS 서비스
├── 운영 데이터베이스
├── CDN 및 로드 밸런서
└── 자동 스케일링
```

### CI/CD 파이프라인
```
1. 코드 커밋 → GitHub
2. 자동 테스트 실행
3. 빌드 및 도커 이미지 생성
4. 스테이징 환경 배포
5. 자동 테스트 및 승인
6. 운영 환경 배포
7. 헬스 체크 및 모니터링
```

## 🔧 기술 스택 상세

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.6
- **UI Library**: React 18
- **Styling**: CSS-in-JS (인라인 스타일)
- **State Management**: React Hooks + Context
- **PWA**: Service Worker, Manifest

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Next.js API Routes
- **Language**: TypeScript 5.6
- **Authentication**: Supabase Auth + JWT
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage

### External Services
- **SMS**: 네이버 클라우드 SENS (Mock SMS 개발용)
- **PDF**: pdfmake
- **QR Code**: qrcode
- **Barcode Scanner**: @zxing/browser

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Version Control**: Git
- **Environment**: .env 파일

## 📈 모니터링 및 로깅

### 로깅 시스템
- **Application Logs**: 구조화된 JSON 로그
- **Access Logs**: API 접근 로그
- **Error Logs**: 에러 및 예외 로그
- **Performance Logs**: 성능 지표 로그

### 모니터링 지표
- **Response Time**: API 응답 시간
- **Throughput**: 초당 요청 처리량
- **Error Rate**: 에러 발생률
- **Resource Usage**: CPU, 메모리, 디스크 사용량

### 알림 시스템
- **Email Alerts**: 중요 이벤트 알림
- **SMS Alerts**: 긴급 상황 알림
- **Dashboard**: 실시간 모니터링 대시보드
- **Escalation**: 문제 발생 시 단계별 알림
