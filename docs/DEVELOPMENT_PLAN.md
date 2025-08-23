# 🚀 교환권 시스템 개발 계획

## 📅 전체 개발 일정

### **Phase 1: 기반 구축 (1-2주) ✅ 완료**
- [x] 프로젝트 초기 설정
- [x] 데이터베이스 스키마 설계
- [x] 기본 API 엔드포인트 구현
- [x] PDF 생성 기능 (Pretendard 폰트 적용)
- [x] QR 코드 생성 및 검증

### **Phase 2: 인증 시스템 (2-3주) 🔄 진행중**
- [x] Mock SMS 서비스 구현
- [ ] SMS 인증 API 구현
- [ ] 로그인/로그아웃 시스템
- [ ] 권한 관리 시스템
- [ ] 디바이스 감지 기능

### **Phase 3: UI/UX 개선 (1-2주)**
- [ ] 모바일/PC UI 분기
- [ ] 관리자 메뉴 구현
- [ ] 사용자 등록 시스템
- [ ] 반응형 디자인 적용

### **Phase 4: 보안 및 최적화 (1-2주)**
- [ ] RLS 정책 구현
- [ ] 감사 로그 시스템
- [ ] 성능 최적화
- [ ] 에러 처리 개선

### **Phase 5: 테스트 및 배포 (1주)**
- [ ] 단위 테스트 작성
- [ ] 통합 테스트
- [ ] 사용자 테스트
- [ ] 운영 환경 배포

## 🎯 현재 단계 상세 계획

### **Phase 2: 인증 시스템 (현재 진행중)**

#### **2-1. Mock SMS 서비스 구현 (1-2일)**
```typescript
// lib/sms.ts
interface SMSService {
  sendVerificationCode(phone: string): Promise<boolean>;
  verifyCode(phone: string, code: string): Promise<boolean>;
}

class MockSMSService implements SMSService {
  // 콘솔 출력 기반 Mock 서비스
}
```

**구현 항목:**
- [ ] Mock SMS 서비스 클래스
- [ ] 인증번호 생성 및 저장
- [ ] 유효시간 관리 (5분)
- [ ] 재시도 제한 로직

#### **2-2. SMS 인증 API 구현 (2-3일)**
```typescript
// app/api/auth/send-sms/route.ts
// app/api/auth/verify-sms/route.ts
// app/api/auth/login/route.ts
```

**구현 항목:**
- [ ] SMS 발송 API
- [ ] 인증번호 검증 API
- [ ] 로그인 API
- [ ] JWT 토큰 발급

#### **2-3. 권한 관리 시스템 (2-3일)**
```typescript
// lib/auth.ts
interface UserRole {
  role: 'admin' | 'staff';
  permissions: string[];
  site_id: string;
}
```

**구현 항목:**
- [ ] 사용자 역할 정의
- [ ] 권한 검사 함수
- [ ] 미들웨어 구현
- [ ] 컨텍스트 제공자

#### **2-4. 디바이스 감지 기능 (1일)**
```typescript
// lib/device.ts
interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}
```

**구현 항목:**
- [ ] User-Agent 기반 감지
- [ ] 화면 크기 기반 감지
- [ ] 터치 지원 여부 감지
- [ ] 훅으로 제공

## 🛠️ 기술적 구현 계획

### **1. Mock SMS 서비스 아키텍처**

#### **메모리 기반 저장**
```typescript
class MockSMSService {
  private codes = new Map<string, {
    code: string;
    expiresAt: Date;
    attempts: number;
  }>();
  
  // 인증번호 발송
  async sendVerificationCode(phone: string): Promise<boolean>
  
  // 인증번호 검증
  async verifyCode(phone: string, code: string): Promise<boolean>
  
  // 인증번호 생성
  private generateCode(): string
  
  // 정리 (만료된 코드 제거)
  private cleanup(): void
}
```

#### **보안 고려사항**
- 인증번호 6자리 (0-9)
- 5분 유효시간
- 최대 3회 재시도
- 1분 간격 재발송 제한

### **2. 인증 플로우 설계**

#### **사용자 인증 과정**
```
1. 휴대폰 번호 입력
2. SMS 인증번호 발송 (Mock: 콘솔 출력)
3. 인증번호 입력
4. 검증 및 JWT 토큰 발급
5. 권한별 메뉴 접근
```

#### **JWT 토큰 구조**
```typescript
interface JWTPayload {
  sub: string;        // 사용자 ID
  phone: string;      // 휴대폰 번호
  role: string;       // 역할 (admin/staff)
  site_id: string;    // 사업장 ID
  iat: number;        // 발급 시간
  exp: number;        // 만료 시간
}
```

### **3. 권한 관리 시스템**

#### **역할별 권한 정의**
```typescript
const PERMISSIONS = {
  admin: [
    'user:read', 'user:write', 'user:delete',
    'voucher:read', 'voucher:write', 'voucher:delete',
    'site:read', 'site:write', 'site:delete',
    'audit:read', 'audit:write'
  ],
  staff: [
    'voucher:read', 'voucher:use',
    'scan:read', 'scan:write'
  ]
} as const;
```

#### **권한 검사 미들웨어**
```typescript
// lib/middleware.ts
export function requirePermission(permission: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // 권한 검사 로직
  };
}
```

## 📱 UI/UX 구현 계획

### **1. 디바이스별 메뉴 분기**

#### **모바일 메뉴**
```tsx
// components/MobileMenu.tsx
export function MobileMenu() {
  return (
    <nav>
      <MenuItem href="/scan">스캔</MenuItem>
      <MenuItem href="/my-vouchers">내 교환권</MenuItem>
      <MenuItem href="/logout">로그아웃</MenuItem>
    </nav>
  );
}
```

#### **PC 관리자 메뉴**
```tsx
// components/AdminMenu.tsx
export function AdminMenu() {
  return (
    <nav>
      {/* 모바일 메뉴 + */}
      <MenuItem href="/admin/users">사용자 관리</MenuItem>
      <MenuItem href="/admin/vouchers">교환권 관리</MenuItem>
      <MenuItem href="/admin/sites">사업장 관리</MenuItem>
      <MenuItem href="/admin/audit">감사 로그</MenuItem>
    </nav>
  );
}
```

### **2. 반응형 디자인**

#### **CSS 변수 활용**
```css
:root {
  --mobile-breakpoint: 768px;
  --tablet-breakpoint: 1024px;
  --desktop-breakpoint: 1200px;
  
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
}
```

#### **미디어 쿼리 전략**
```css
/* 모바일 우선 */
.menu { /* 기본 스타일 */ }

/* 태블릿 */
@media (min-width: 768px) { .menu { /* 태블릿 스타일 */ } }

/* 데스크톱 */
@media (min-width: 1024px) { .menu { /* 데스크톱 스타일 */ } }
```

## 🧪 테스트 계획

### **1. 단위 테스트**

#### **SMS 서비스 테스트**
```typescript
// __tests__/sms.test.ts
describe('MockSMSService', () => {
  test('인증번호 발송 성공', async () => {
    const service = new MockSMSService();
    const result = await service.sendVerificationCode('010-1234-5678');
    expect(result).toBe(true);
  });
  
  test('인증번호 검증 성공', async () => {
    // 테스트 로직
  });
  
  test('만료된 인증번호 거부', async () => {
    // 테스트 로직
  });
});
```

#### **권한 관리 테스트**
```typescript
// __tests__/auth.test.ts
describe('Permission System', () => {
  test('admin 권한으로 모든 기능 접근 가능', () => {
    // 테스트 로직
  });
  
  test('staff 권한으로 제한적 기능만 접근 가능', () => {
    // 테스트 로직
  });
});
```

### **2. 통합 테스트**

#### **인증 플로우 테스트**
```typescript
// __tests__/auth-flow.test.ts
describe('Authentication Flow', () => {
  test('전체 인증 과정', async () => {
    // 1. SMS 발송
    // 2. 인증번호 검증
    // 3. 로그인
    // 4. 권한 확인
  });
});
```

### **3. 사용자 테스트**

#### **모바일 사용성 테스트**
- 실제 모바일 기기에서 스캔 기능 테스트
- 터치 인터페이스 사용성 확인
- 네트워크 불안정 환경에서의 동작

#### **PC 관리자 기능 테스트**
- 관리자 메뉴 사용성 확인
- 데이터 입력/수정/삭제 기능 테스트
- 대량 데이터 처리 성능 확인

## 📊 성능 최적화 계획

### **1. 데이터베이스 최적화**

#### **인덱스 추가**
```sql
-- 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_sms_verifications_phone ON sms_verifications(phone);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

#### **쿼리 최적화**
```sql
-- N+1 문제 방지
SELECT v.*, u.name as user_name, s.site_name
FROM vouchers v
JOIN users u ON v.used_by_user_id = u.id
JOIN sites s ON v.used_at_site_id = s.id
WHERE v.site_id = $1;
```

### **2. 프론트엔드 최적화**

#### **코드 스플리팅**
```typescript
// 동적 임포트로 번들 크기 최적화
const AdminPanel = dynamic(() => import('../components/AdminPanel'), {
  loading: () => <div>로딩 중...</div>,
  ssr: false
});
```

#### **메모이제이션**
```typescript
// React.memo로 불필요한 리렌더링 방지
const VoucherList = React.memo(({ vouchers }: VoucherListProps) => {
  // 컴포넌트 로직
});
```

## 🚀 배포 계획

### **1. 환경별 설정**

#### **개발 환경**
```bash
# .env.development
NODE_ENV=development
SMS_SERVICE=mock
DATABASE_URL=postgresql://localhost:5432/voucher_dev
```

#### **스테이징 환경**
```bash
# .env.staging
NODE_ENV=staging
SMS_SERVICE=ncp
DATABASE_URL=postgresql://staging-db:5432/voucher_staging
```

#### **운영 환경**
```bash
# .env.production
NODE_ENV=production
SMS_SERVICE=ncp
DATABASE_URL=postgresql://prod-db:5432/voucher_production
```

### **2. 배포 프로세스**

#### **자동화 파이프라인**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main, develop]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: npm test
  
  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - name: Deploy to staging
        run: echo "Deploy to staging"
  
  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: echo "Deploy to production"
```

## 📈 모니터링 및 로깅

### **1. 로깅 시스템**

#### **구조화된 로그**
```typescript
// lib/logger.ts
interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  userId?: string;
  action?: string;
  details?: any;
}

export function log(entry: LogEntry) {
  console.log(JSON.stringify(entry));
  // 파일 또는 외부 로깅 서비스로 전송
}
```

#### **성능 모니터링**
```typescript
// lib/performance.ts
export function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    log({
      level: 'info',
      message: `Performance: ${name}`,
      timestamp: new Date().toISOString(),
      details: { duration: `${duration.toFixed(2)}ms` }
    });
  });
}
```

### **2. 알림 시스템**

#### **에러 알림**
```typescript
// lib/notifications.ts
export async function sendErrorAlert(error: Error, context: string) {
  // 이메일 또는 SMS로 에러 알림
  await log({
    level: 'error',
    message: `Error in ${context}`,
    timestamp: new Date().toISOString(),
    details: { error: error.message, stack: error.stack }
  });
}
```

## 🎯 성공 지표 (KPI)

### **1. 기능 완성도**
- [ ] Mock SMS 서비스: 100%
- [ ] 인증 시스템: 100%
- [ ] 권한 관리: 100%
- [ ] 디바이스별 UI: 100%

### **2. 성능 지표**
- [ ] 인증번호 발송: 1초 이내
- [ ] 인증번호 검증: 500ms 이내
- [ ] 로그인 처리: 2초 이내
- [ ] 페이지 로딩: 3초 이내

### **3. 품질 지표**
- [ ] 코드 커버리지: 80% 이상
- [ ] 에러 발생률: 1% 이하
- [ ] 사용자 만족도: 4.5/5.0 이상

## 🔄 다음 단계 준비

### **1. 네이버 클라우드 SENS 연동**
- [ ] 계정 생성 및 설정
- [ ] API 키 발급
- [ ] 발신번호 등록
- [ ] 실제 SMS 발송 테스트

### **2. 운영 환경 준비**
- [ ] 도메인 및 SSL 인증서
- [ ] CDN 설정
- [ ] 모니터링 도구 연동
- [ ] 백업 시스템 구축

### **3. 사용자 매뉴얼 작성**
- [ ] 관리자 매뉴얼
- [ ] 사용자 매뉴얼
- [ ] 운영 매뉴얼
- [ ] 문제 해결 가이드
