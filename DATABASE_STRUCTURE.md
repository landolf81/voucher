# 🗄️ 교환권 관리 시스템 - 데이터베이스 구조

## 📊 개요

현재 교환권 관리 시스템은 **이중 데이터베이스 시스템**을 사용하고 있습니다:

- **개발환경**: Mock Database (메모리 기반) - `/lib/mock-db.ts`
- **프로덕션환경**: Supabase (PostgreSQL) - `/supabase/schema.sql`

---

## 🗂️ Mock Database (개발용)

### 1. 사용자 관리 (`MockUser`)

```typescript
interface MockUser {
  id: string;                       // UUID
  user_id: string;                  // 로그인 ID (예: admin, staff, viewer)
  encrypted_phone: string;          // 암호화된 전화번호
  name: string;                     // 사용자 이름
  role: 'admin' | 'staff' | 'viewer'; // 3단계 권한
  site_id: string;                  // 소속 사업장 ID
  created_at: string;               // 계정 생성일
  last_login?: string;              // 마지막 로그인
  is_active: boolean;               // 계정 활성화 상태
}
```

**권한 체계:**
- `admin`: 모든 기능 접근 가능 (시스템 관리)
- `staff`: 교환권 발행, 사용, 회수 가능 (사업장 운영)
- `viewer`: 조회 기능만 가능 (읽기 전용)

### 2. 사업장 관리 (`MockSite`)

```typescript
interface MockSite {
  id: string;                       // UUID
  site_name: string;                // 사업장명
  address?: string;                 // 주소
  phone?: string;                   // 전화번호
  fax?: string;                     // 팩스
  business_number?: string;         // 사업자번호
  status: 'active' | 'inactive';    // 운영 상태
  created_at: string;               // 등록일
  updated_at: string;               // 수정일
}
```

### 3. 교환권 템플릿 (`MockVoucherTemplate`)

```typescript
interface MockVoucherTemplate {
  id: string;                       // UUID
  voucher_name: string;             // 교환권명 (예: 쌀 10kg, 사과 3kg)
  voucher_type: 'fixed' | 'amount'; // 정액권/정량권
  expires_at: string;               // 유효기간
  usage_location: string;           // 사용처
  status: 'draft' | 'active' | 'inactive'; // 템플릿 상태
  created_at: string;               // 생성일
  notes?: string;                   // 메모
  
  // 인쇄 서식 정보
  template_image?: string;          // Base64 인코딩된 배경 이미지
  image_width?: number;             // 이미지 너비 (픽셀)
  image_height?: number;            // 이미지 높이 (픽셀)
  field_positions?: FieldPosition[]; // 필드 배치 정보
}
```

### 4. 필드 배치 정보 (`FieldPosition`)

```typescript
interface FieldPosition {
  field: 'voucher_name' | 'member_id' | 'name' | 'amount' | 
         'expires_at' | 'usage_location' | 'serial_no' | 
         'issued_at' | 'qr_code' | 'barcode';
  x: number;                        // X 좌표 (픽셀)
  y: number;                        // Y 좌표 (픽셀)
  width: number;                    // 필드 너비
  height: number;                   // 필드 높이
  fontSize: number;                 // 폰트 크기
  fontColor: string;                // 폰트 색상
  fontWeight: 'normal' | 'bold';    // 폰트 굵기
  textAlign: 'left' | 'center' | 'right'; // 텍스트 정렬
}
```

### 5. 발행대상자 (`MockVoucherRecipient`)

```typescript
interface MockVoucherRecipient {
  id: string;                       // UUID
  template_id: string;              // 교환권 템플릿 ID
  member_id: string;                // 조합원 ID
  farming_association: string;      // 영농회명
  encrypted_name: string;           // 암호화된 이름
  encrypted_dob: string;            // 암호화된 생년월일
  encrypted_phone: string;          // 암호화된 전화번호
  amount: number;                   // 개별 금액 (개인별로 다를 수 있음)
  status: 'registered' | 'issued' | 'printed' | 'delivered'; // 상태
  created_at: string;               // 등록일
  notes?: string;                   // 메모
}
```

### 6. 발행된 교환권 (`MockVoucher`)

```typescript
interface MockVoucher {
  id: string;                       // UUID
  template_id: string;              // 교환권 템플릿 ID
  recipient_id: string;             // 발행대상자 ID
  serial_no: string;                // 일련번호 (YYYY-MM-XXXXXX-CC)
  amount: number;                   // 금액 (발행대상자에서 복사)
  status: 'issued' | 'printed' | 'delivered' | 
          'used' | 'expired' | 'recalled'; // 교환권 상태
  issued_at: string;                // 발행일
  printed_at?: string;              // 인쇄일
  delivered_at?: string;            // 배송일
  used_at?: string;                 // 사용일
  recalled_at?: string;             // 회수일
  notes?: string;                   // 메모
  mobile_image?: string;            // 모바일용 이미지 (Base64)
}
```

### 7. 감사 로그 (`MockAuditLog`)

```typescript
interface MockAuditLog {
  id: string;                       // UUID
  action: string;                   // 수행된 작업 (예: voucher_used, voucher_recalled)
  actor_user_id: string;            // 수행자 사용자 ID
  site_id: string;                  // 수행 사업장 ID
  created_at: string;               // 작업 시간
  details: any;                     // 상세 정보 (JSON)
}
```

---

## 🐘 Supabase Database (프로덕션)

### 1. 사업장 테이블 (`sites`)

```sql
CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL
);
```

### 2. 사용자 테이블 (`users`)

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE,
  phone text UNIQUE,
  name text,
  role text CHECK (role IN ('admin','staff','viewer')) DEFAULT 'staff',
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL
);
```

### 3. 교환권 테이블 (`vouchers`)

```sql
CREATE TABLE vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no text UNIQUE NOT NULL,
  amount numeric NOT NULL,
  association text NOT NULL,
  name text NOT NULL,
  dob date NOT NULL,
  status text NOT NULL DEFAULT 'issued' 
    CHECK (status IN ('issued','used','canceled','recalled')),
  issued_at timestamptz DEFAULT NOW(),
  used_at timestamptz,
  recalled_at timestamptz,
  used_by_user_id uuid REFERENCES users(id),
  used_at_site_id uuid REFERENCES sites(id),
  recalled_by_user_id uuid REFERENCES users(id),
  recalled_at_site_id uuid REFERENCES sites(id),
  recall_method text CHECK (recall_method IN ('manual','barcode','qrcode')),
  notes text
);
```

### 4. 감사 로그 테이블 (`audit_logs`)

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid REFERENCES vouchers(id),
  action text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  site_id uuid REFERENCES sites(id),
  created_at timestamptz DEFAULT NOW(),
  details jsonb,
  recall_method text,
  recall_reason text,
  ip_address text,
  user_agent text
);
```

### 5. 인덱스

```sql
-- 교환권 테이블 인덱스
CREATE INDEX idx_vouchers_serial ON vouchers(serial_no);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_used_at ON vouchers(used_at);
CREATE INDEX idx_vouchers_recalled_at ON vouchers(recalled_at);
CREATE INDEX idx_vouchers_recalled_by ON vouchers(recalled_by_user_id);
CREATE INDEX idx_vouchers_recall_method ON vouchers(recall_method);

-- 감사 로그 테이블 인덱스
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_actor_user ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

### 6. 뷰 (Views)

#### 회수된 교환권 뷰
```sql
CREATE VIEW recalled_vouchers_view AS
SELECT 
  v.id, v.serial_no, v.amount, v.association, v.name,
  v.status, v.issued_at, v.recalled_at, v.recall_method,
  u.name as recalled_by_name,
  s.site_name as recalled_at_site,
  v.notes
FROM vouchers v
LEFT JOIN users u ON v.recalled_by_user_id = u.id
LEFT JOIN sites s ON v.recalled_at_site_id = s.id
WHERE v.status = 'recalled'
ORDER BY v.recalled_at DESC;
```

#### 교환권 상태별 통계 뷰
```sql
CREATE VIEW voucher_status_stats AS
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM vouchers 
GROUP BY status;
```

### 7. 저장 프로시저

#### 교환권 사용 처리
```sql
CREATE FUNCTION use_voucher_by_serial(p_serial text)
RETURNS json
LANGUAGE plpgsql
AS $$
-- 교환권 상태 확인 및 사용 처리 로직
$$;
```

#### 교환권 회수 처리
```sql
CREATE FUNCTION recall_voucher_by_id(
  p_voucher_id uuid,
  p_reason text DEFAULT '',
  p_recalled_by_user_id uuid DEFAULT NULL,
  p_recalled_at_site_id uuid DEFAULT NULL,
  p_recall_method text DEFAULT 'manual'
)
RETURNS json
LANGUAGE plpgsql
$$;
```

---

## 🔢 일련번호 시스템

### 형식
```
YYYY-MM-XXXXXX-CC
 │    │   │      │
 │    │   │      └─ 검증번호 (2자리 체크섬)
 │    │   └────────── 순서번호 (6자리, 000001-999999)
 │    └────────────── 월 (01-12)
 └─────────────────── 년도 (YYYY)
```

### 예시
- `2024-12-000001-43`
- `2024-12-000002-51`
- `2025-01-000001-27`

### 구현 위치
- **유틸리티**: `/lib/serial-number.ts`
- **생성 함수**: `generateSerialNumber(sequenceNumber, issueDate?)`
- **검증 함수**: `validateSerialNumber(serialNumber)`
- **파싱 함수**: `parseSerialNumber(serialNumber)`

---

## 🔐 보안 기능

### 1. 개인정보 암호화
- **위치**: `/lib/encryption.ts`
- **알고리즘**: AES-256
- **암호화 대상**: 이름, 생년월일, 전화번호
- **함수**: `encrypt()`, `decrypt()`, `maskPersonalInfo()`

### 2. 권한 관리
```typescript
type UserRole = 'admin' | 'staff' | 'viewer';

// 권한별 접근 가능 기능
const permissions = {
  admin: ['*'],                    // 모든 기능
  staff: ['voucher_*', 'site_*'],  // 교환권 관리, 사업장 관리
  viewer: ['voucher_read']         // 조회만 가능
};
```

### 3. 감사 로그
모든 중요 작업은 자동으로 감사 로그에 기록됩니다:
- 교환권 발행/사용/회수
- 사용자 로그인/로그아웃
- 시스템 설정 변경

---

## 🚀 API 엔드포인트 구조

```
/api/
├── auth/
│   ├── login                    # 로그인
│   ├── send-sms                 # SMS 인증 발송
│   └── verify-sms               # SMS 인증 확인
├── vouchers/
│   ├── types                    # 교환권 종류 조회
│   ├── search-new               # 통합 검색 (이름/ID/일련번호)
│   ├── use                      # 사용 등록
│   ├── assign-serial            # 일련번호 일괄 부여
│   ├── recall                   # 회수 처리
│   ├── bulk-issue               # 대량 발행
│   ├── manual-issue             # 개별 발행
│   └── mobile/[id]              # 모바일 교환권 조회
├── voucher-templates/           # 템플릿 관리
├── voucher-recipients/          # 발행대상자 관리
│   ├── excel                    # 엑셀 업로드
│   └── [template_id]            # 템플릿별 대상자 조회
└── sites/                       # 사업장 관리
```

---

## 📊 현재 테스트 데이터

### Mock Database 초기 데이터

#### 사용자 (3명)
- **admin**: 관리자 계정 (모든 권한)
- **staff**: 직원 계정 (교환권 관리)
- **viewer**: 조회 계정 (읽기 전용)

#### 사업장 (2개)
- 농협하나로마트 강남점
- 농협하나로마트 서초점

#### 교환권 템플릿 (5개)
1. 쌀 10kg (정량권, 50,000원)
2. 고구마 5kg (정량권, 25,000원)
3. 사과 3kg (정량권, 30,000원)
4. 배추 2포기 (정량권, 8,000원)
5. 농산물 상품권 (정액권, 100,000원)

#### 발행대상자 (10명)
- 암호화된 개인정보 포함
- 다양한 영농회 소속
- 개별 금액 설정

#### 발행된 교환권 (15개)
- 다양한 상태: issued, used, recalled, expired
- 일련번호 자동 부여
- 실제 테스트 가능한 데이터

---

## 🔄 데이터 흐름

### 교환권 생명주기
```
1. 템플릿 생성 → 2. 발행대상자 등록 → 3. 교환권 발행 → 
4. 인쇄/배송 → 5. 사용 또는 회수
```

### 상태 전이
```
registered → issued → printed → delivered → used
                              ↓
                            recalled
```

---

## 📝 개발/운영 가이드

### 개발 환경 설정
1. Mock DB 사용: `NODE_ENV=development`
2. Supabase URL에 `dummy` 포함 시 자동으로 Mock DB 사용
3. 테스트 데이터 자동 생성

### 프로덕션 환경 설정
1. Supabase 프로젝트 설정
2. 환경변수 설정 (`.env.local`)
3. 스키마 마이그레이션 실행

### 확장 가능성
- 교환권 템플릿 확장 (디자인 커스터마이징)
- 다중 사업장 지원
- 모바일 앱 연동
- 외부 결제 시스템 연동
- AI 기반 사기 탐지

---

*최종 업데이트: 2024년 12월*
*문서 버전: 1.0*