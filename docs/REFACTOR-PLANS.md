# 리팩토링 계획 (2026-06-19 작성)

코드 리뷰에서 지적된 3가지 중, **죽은 파일 정리는 완료**. 아래는 나머지 2건의 단계별 계획.

> 현황 측정값 (작성 시점)
> - API: `route.ts` 103개, 총 **19,280줄** (평균 187줄, 최대 537줄). 비즈니스 로직이 라우트에 직접 박혀 있음. **서비스 레이어 없음**.
> - 교환권 도메인이 `vouchers/`(38) · `voucher-templates/` · `voucher-recipients/` · `voucher-design-templates/` · `mobile-templates/` · `v1/vouchers/` 6갈래로 분산.
> - `fetch('/api...')` 호출 지점 **107곳** → API 경로는 클라이언트 계약.
> - 인라인 스타일 `style={{}}` **1,980곳 / 55개 파일** (전체 57개 중). Tailwind·CSS Module 없음, `globals.css`만.

---

## 계획 ②: API 구조 재편

### 핵심 판단: "폴더 이동"이 아니라 "서비스 레이어 추출"이 우선
App Router에서 폴더 경로 = URL이다. 폴더를 옮기면 107곳의 `fetch` 경로가 깨진다.
진짜 문제는 **폴더 위치가 아니라 400~537줄짜리 라우트에 검증·DB·SMS·PDF 로직이 뒤섞여 있는 것**.
→ URL은 그대로 두고 로직을 `lib/services/`로 빼내 라우트를 얇게 만드는 게 저위험·고효율.

### 단계
1. **서비스 레이어 신설** `lib/services/`
   - `voucher.service.ts` (발행/사용/회수/조회), `voucher-template.service.ts`, `recipient.service.ts`, `mobile-voucher.service.ts`, `pdf.service.ts`, `sms.service.ts`(기존 `lib/sms.ts` 흡수)
   - 라우트는 "요청 파싱 → zod 검증 → 서비스 호출 → 응답"만 담당 (목표: 라우트당 ≤ 80줄)
2. **괴물 라우트부터 시범 적용** (효과 큰 순):
   - `vouchers/bulk-register-use-csv` (537) → CSV 파싱/검증/대량처리 분리
   - `vouchers/mobile-bulk-issue` (525), `vouchers/bulk-print` (469), `vouchers/pdf` (461)
   - 한 번에 하나씩, 각 작업 후 `npm run typecheck` + 해당 엔드포인트 수동 검증
3. **공통 패턴 표준화**
   - zod 스키마를 `lib/schemas/`로 모으기 (현재 각 라우트에 흩어짐)
   - 응답 형태 통일 헬퍼 `apiOk()/apiError()` (현재 `{success,message,errors}` 수기 반복)
   - 에러 핸들링 래퍼 `withApiHandler()` (try/catch + 로깅 중복 제거)
4. **(선택, 별도 트랙·고위험) URL 통합**: `voucher-*` 5갈래를 `/api/vouchers/{templates,recipients,designs,...}` 한 트리로.
   - 반드시 **107곳 fetch 경로 동시 수정 + 구 경로 리다이렉트 유지**가 전제. 서비스 레이어 정리 후에만 착수.

### 영향/리스크
- 1~3단계: URL 불변 → 클라이언트 영향 0. 내부 리팩토링이라 안전.
- 4단계: 계약 변경. 별도 PR, 충분한 검증 필요.

### CLAUDE.md 갱신 필요
- `/api/v1/pdf/*` 엔드포인트는 이미 죽어 있었음(`.bak`만 존재, 이번에 삭제). 문서의 "PDF Generation" 경로 설명을 실제(`/api/vouchers/pdf`)에 맞게 수정.

---

## 계획 ③: 스타일 시스템 도입

### 핵심 판단: 1,980곳을 한 번에 못 바꾼다 → 신규는 막고 기존은 점진 이관
Tailwind 도입을 권장 (Next 16 + 인라인 위주 코드와 궁합, 점진 도입 용이).

### 단계
1. **Tailwind 설치·설정** (`tailwindcss`, `postcss`, `autoprefixer`, `globals.css`에 directives). 기존 인라인과 **공존 가능** — 한 번에 안 갈아엎어도 됨.
2. **디자인 토큰 정의**: 현재 인라인에 반복되는 색/간격/폰트(예: `#6b7280`, `#374151`, `Pretendard`)를 `tailwind.config`의 theme로 추출. 먼저 인라인에서 반복 값 빈도 분석.
3. **공통 컴포넌트화** (가장 효과 큼): 반복되는 버튼/카드/배지/모달을 `components/ui/`로. 인라인 1,980곳의 상당수가 동일 버튼·레이아웃 복붙 → 컴포넌트 하나로 수백 곳 흡수.
4. **점진 이관 우선순위** (인라인 최다 파일부터):
   - `MobileVoucherManagement.tsx` (226), `VoucherRecipientsForm.tsx` (159), `VoucherInquiryContent.tsx` (108), `VoucherUsageContent.tsx` (98)
5. **신규 코드 규칙**: 새 컴포넌트는 인라인 금지(Tailwind/`components/ui` 사용). lint 규칙으로 강제 가능.

### 대안
- 큰 도입이 부담이면 **CSS Module**로 파일별 점진 이관(런타임 0, 학습비용 낮음). 단 디자인 토큰·재사용성은 Tailwind가 우위.

### 리스크
- 공존 전략이라 빌드/런타임 영향 없음. 이관은 파일 단위로 시각 회귀만 확인하며 진행.

---

## 권장 진행 순서
1. (완료) 죽은 파일 정리
2. API ②-1~3 (서비스 레이어) — 내부 리팩토링, 안전, 즉시 가치
3. 스타일 ③-1~3 (Tailwind + ui 컴포넌트) — 신규 출혈 차단
4. 이후 여유 시 ②-4 URL 통합, ③-4 대량 이관
