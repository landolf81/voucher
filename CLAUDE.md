# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Voucher management system built with Next.js 15 and Supabase for voucher issuance, verification, usage tracking, and PDF generation with QR codes. Supports multi-site operations with role-based access control.

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
- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with email/magic link and SMS OTP (via mock SMS in dev)
- **Frontend**: React 19 with TypeScript, inline CSS-in-JS
- **PDF Generation**: pdfmake with Pretendard font for Korean support
- **QR/Barcode**: qrcode for generation, @zxing/browser for scanning
- **Email Editor**: Unlayer (react-email-editor) for voucher templates

## Critical Patterns & Conventions

### Authentication Flow
1. Email uses Magic Links (not OTP) - redirects handled via emailRedirectTo
2. SMS uses OTP codes with mock SMS service in development
3. User profiles in `user_profiles` table linked to auth.users
4. Auto-logout when profile not found or query fails
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
- `user_profiles` - Extended user data (name, role, site_id) linked to auth.users
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
- `/api/user-profiles/*` - User management

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
- **서버 관리**: 사용자가 직접 서버 관리 담당
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
- **서버 관리**: 사용자가 직접 담당, 코드 구현에 집중
  **서버 포트 3000포트 고정. 다른 포트 실행 금지 **
  