# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Voucher management system built with Next.js 16 and Supabase for voucher issuance, verification, usage tracking, and PDF generation with QR codes. Supports multi-site operations with role-based access control.

## Development Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Architecture Overview
- **Framework**: Next.js 16 with App Router
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with email/magic link and SMS OTP (via mock SMS in dev)
- **Frontend**: React 19 with TypeScript, inline CSS-in-JS
- **Tooling**: ESLint 9 (flat config, `eslint.config.mjs`), TypeScript 6
- **PDF Generation**: pdfmake with Pretendard font for Korean support
- **QR/Barcode**: qrcode for generation, @zxing/browser for scanning
- **Email Editor**: Unlayer (react-email-editor) for voucher templates
- **Icons**: lucide-react (2026-07 이모지 아이콘 전면 교체)

## Critical Patterns & Conventions

### UI Icons (lucide-react)
- JSX에서 시각적 아이콘은 lucide-react 컴포넌트 사용 (`<Search size={16} />`). 새 이모지 아이콘 추가 금지.
- 탭/메뉴 데이터의 icon 필드는 `LucideIcon` 컴포넌트 참조 타입 (`import type { LucideIcon } from 'lucide-react'`), 렌더링은 `<item.icon size={16} />`.
- 이모지가 **의도적으로 남아 있는 곳** (SVG를 넣을 수 없어 교체 불가 — 다시 교체 시도하지 말 것): alert()/confirm()/toast·setMessage 문자열, console 로그, SMS/카카오/이메일 본문 문자열, GrapesJS 블록 라벨·캔버스 HTML 문자열, Unlayer 디자인 HTML, `window.open()` 인쇄용 HTML, `<option>` 태그 텍스트.
- `MobileShell`의 `title` prop은 `React.ReactNode` — 아이콘+텍스트 조합 가능.

### Authentication Flow
1. Email uses Magic Links (not OTP) - redirects handled via emailRedirectTo
2. SMS uses OTP codes with mock SMS service in development
3. User profile data lives in `auth.users.user_metadata` (name, display_name, role, site_id, is_active). The legacy `user_profiles` table was removed and migrated into metadata (see `/api/admin/migrate-user-metadata`). RLS reads role via `auth.jwt() -> 'user_metadata' ->> 'role'`.
4. Auto-logout when the user/metadata lookup fails
5. Duplicate auth state prevention with loadingUserId tracking

### Phone Number Formatting
- Database stores clean numbers: "01012345678"
- Display format: "010-1234-5678" using `formatPhoneForDisplay()`
- Input formatting: `formatPhoneInput()` for real-time formatting
- Clean before saving: `cleanPhoneInput()`

### Voucher Security
- HMAC-signed QR codes prevent forgery (lib/hmac.ts)
- Atomic voucher usage via RPC `use_voucher_by_serial`
- QR payload format: `VCH:{serial}|TS:{timestamp}|SIG:{hmac}`
- All voucher operations use database transactions

### Device-Specific UI
- Device detection in `lib/device.ts` and `lib/hooks/useDevice.ts`
- Mobile: Scan-focused interface
- Desktop: Full administrative interface
- UI routes automatically adapt based on device type

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
VOUCHER_HMAC_SECRET=
```

## Key Database Tables
- User profile data is stored in `auth.users.user_metadata` (no `user_profiles` table; it was removed). A `users` view/relation exposes auth users for admin listing (see `/api/users`).
- `sites` - Business locations/branches
- `vouchers` - Core voucher data with atomic status transitions
- `voucher_templates` - Configurable voucher templates
- `voucher_design_templates` - Email/visual templates for vouchers
- `audit_logs` - Comprehensive action logging

## API Endpoints Structure
- `/api/auth/*` - Authentication (SMS, magic link, profile)
- `/api/v1/vouchers/*` - Core voucher operations (verify, use, templates)
- `/api/v1/pdf/*` - PDF generation (voucher-a4, statement, usage-report)
- `/api/vouchers/*` - Extended voucher management (bulk operations, Excel import)
- `/api/sites/*` - Site management
- `/api/users/*` - User management (reads/writes auth.users + user_metadata)
- `/api/v1/messages/*` - Staff-to-staff direct/group messages (쪽지)
- `/api/v1/announcements/*` - Company/site announcements with read tracking (공지)

## Common Tasks & Troubleshooting

### Adding New Users
- Admin creates user via dashboard (no self-registration)
- Temporary password generated, user must authenticate via SMS/email
- Required fields: email, name, phone, role, site_id

### Voucher Operations
- Issue: Via Excel upload or manual entry
- Verify: QR scan or serial number lookup
- Use: Atomic transaction via `use_voucher_by_serial` RPC
- Recall/Cancel: Bulk operations available with audit logging

### PDF Generation
- Uses pdfmake with embedded Pretendard font
- A4 vouchers include HMAC-signed QR codes
- Statement PDFs for period reporting
- Font files in `/font/public/static/`

## Known Issues & Solutions

### Email/Auth Issues
- Supabase email mismatch: Check Dashboard → Authentication → Settings
- Magic Link emails only (no OTP for email auth)
- 100ms debounce prevents duplicate auth events

### Form Validation
- User management: No password field required (temp password auto-generated)
- Phone validation: Must be 11 digits starting with 010
- All forms validate required fields before submission

### Unlayer Email Editor
- Custom tools registered via customJS (base64 encoded)
- UTF-8 encoding issues resolved with English labels
- 7 voucher blocks: association, member_id, name, amount, serial_no, qr_code, barcode

### Mobile Template System (2025-08-21)
- **완료된 구현사항**:
  - 모바일 템플릿 데이터베이스 마이그레이션 스크립트
  - 모바일 템플릿 관리 API 엔드포인트 (/api/mobile-templates)
  - 모바일 바우처 렌더러 (Puppeteer 기반)
  - 모바일 템플릿 관리자 UI 컴포넌트
- **템플릿 아키텍처**:
  - **디자인 템플릿**: 시각적 디자인/스타일링 (mobile_design_templates 테이블)
  - **교환권 템플릿**: 교환권 데이터/비즈니스 로직 관리 (voucher_templates 테이블)
  - 각각 다른 목적: 디자인 vs 데이터 관리

## Development Guidelines
- Always run `npm run typecheck` and `npm run lint` before committing
- Update CLAUDE.md when discovering important patterns or fixes
- Use atomic transactions for all voucher state changes
- Maintain comprehensive audit logging for all critical operations
- Test RLS policies when modifying database access patterns

### Lint 상태에 대한 주의 (중요)
- `npm run lint`에 React Compiler 권고 경고가 다수 남아 있음(`set-state-in-effect`, `error-boundaries`, `immutability`, `purity`, `preserve-manual-memoization` 등). 이는 **버그가 아니라** Next 16 + `eslint-plugin-react-hooks` v7로 판올림하면서 **새로 추가된 규칙이 기존 정상 코드에 소급 적용**된 것. 빌드/런타임은 정상.
- **이 경고들을 일괄 자동 수정하지 말 것** — 잘 동작하는 코드를 건드려 무한루프·동작 변경을 유발할 수 있음. 건드릴 땐 파일 단위로 신중히.
- 이미 정리된 안전 규칙(`no-unescaped-entities`, `static-components`, `no-img-element`, `no-anonymous-default-export`)은 재발 시에만 수정.
- `react-hooks/exhaustive-deps`는 `eslint.config.mjs`에서 의도적으로 `warn`으로 강등됨.
  