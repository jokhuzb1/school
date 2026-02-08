# IMPLEMENTATION PLAN

## Project
Desktop Refactor: DRY/KISS/SOLID Hardening (Devices, Students, Add Students)

## Problem Statement
Desktop qismida bir xil featurelar bir nechta page ichida parallel implement qilingan. Natijada behavior drift, regressiya xavfi va maintenance narxi oshgan. Katta page komponentlar (1000+ qator) SRPga zid, mapping va sync logikalari ko'p joyda takrorlangan.

## Goal
1. Devices, Device Detail, Students, Add Students oqimlarini yagona arxitektura qoidalariga keltirish.
2. Dublikat business-logikani shared service/use-case qatlamiga ko'chirish.
3. DB-only va device-target policy semantikasini qat'iy va testlangan holatga keltirish.
4. Kod bazani KISS/DRY/SOLID tamoyillariga moslash va keyingi featurelar uchun xavfsiz platforma yaratish.

## Scope
In scope:
1. `apps/student-registrator/src/pages/DevicesPage.tsx`
2. `apps/student-registrator/src/pages/DeviceDetailPage.tsx`
3. `apps/student-registrator/src/pages/StudentsPage.tsx`
4. `apps/student-registrator/src/pages/AddStudentsPage.tsx`
5. `apps/student-registrator/src/hooks/useStudentTable.ts`
6. `apps/student-registrator/src-tauri/src/commands.rs`
7. `apps/student-registrator/src-tauri/src/api.rs`

Out of scope:
1. Yangi product feature qo'shish (faqat refactor + reliability)
2. UI redesign (minimal UX fixlardan tashqari)
3. Server modulelarni to'liq qayta yozish

## Architecture Principles (Mandatory)
1. DRY: Device resolution, sync policy, import mapping va photo pipeline bitta manbadan ishlaydi.
2. KISS: Har flow uchun bitta canonical path; alternativ pathlar chiqarib tashlanadi.
3. SOLID:
- SRP: Page faqat orchestration qiladi; business logic service/use-casega ketadi.
- OCP: Yangi sync policy qo'shish core codega minimal tegish bilan bo'ladi.
- ISP: UI komponentlarga kichik, aniq typed props beriladi.
- DIP: Page to'g'ridan-to'g'ri murakkab implementatsiyaga emas, abstractionga tayanadi.

## Target Design
### 1. Shared Device Resolver
Yagona helper/service:
- input: `backendDevices[]`, `localCredentials[]`, `backendId/deviceId`
- output: local device match, credentials status, reason code

Bu helper quyidagi joylardan dublikatni olib tashlaydi:
- DevicesPage `getCredentialsForBackend`
- DeviceDetailPage `findLocalForBackend`
- AddStudentsPage `findLocalByBackendDeviceId`

### 2. Shared Save Policy Contract
Yagona semantics:
- `undefined` => legacy/default policy
- `[]` => explicit DB-only (no device push)
- `[ids...]` => selected devices only

Tauri loop selection shu semanticani qat'iy qo'llaydi.

### 3. Import Unification
Device user import uchun yagona use-case:
- source devices -> fetch users -> dedupe -> optional face pull -> table rows
- retry/backoff/concurrency bitta joyda boshqariladi

`AddStudentsPage` va `DeviceDetailPage` dagi dublikat import flowlar bitta implementationga ulanadi.

### 4. Page Decomposition
Katta page'lar modulga bo'linadi:
- `features/devices/*`
- `features/device-detail/*`
- `features/student-import/*`

Har feature:
- `view` (UI)
- `state` (hook)
- `service` (business logic)

### 5. Dead Code Cleanup
Ishlatilmayotgan legacy komponentlar va fayllar chiqariladi yoki archive qilinadi.

## Phases

### Phase 0 - Baseline and Safety
1. Current behavior freeze (smoke checklist)
2. Critical invariants document
3. Refactor guard tests skeleton

Exit:
- Regression baseline tayyor

### Phase 1 - Critical Correctness Fixes
1. DB-only save semanticsni Tauri selection loop bilan align qilish
2. Source/target device mapping xatolarini yopish
3. Device-not-found sinflarini standard error codega o'tkazish

Exit:
- DB-only flow deterministic
- Local device mismatch paths testlangan

### Phase 2 - DRY Extraction
1. Shared device resolver service
2. Shared face pull with retry/backoff
3. Shared import normalization/splitName/dedupe utilities

Exit:
- 3+ dublikat blok yagona servicega ko'chgan

### Phase 3 - Page Modularization
1. DeviceDetail page state/actionsni custom hooklarga ajratish
2. AddStudents page modal/import/save orchestrationni feature hookga ajratish
3. Students page edit/sync pipeline ajratish

Exit:
- Har page < 700 qator (target)

### Phase 4 - Type Hardening
1. `any` va unsafe castlarni yo'qotish
2. Domain typelarni (`DeviceResolution`, `SavePolicy`, `ImportSource`) qat'iylash
3. Compile-time contract checks

Exit:
- audit qilingan area'da `any` nolga yaqin

### Phase 5 - Cleanup and Verification
1. Dead files/components cleanup
2. Full regression + lint + tauri check
3. Developer handoff docs update

Exit:
- CI green
- Cleanup checklist complete

## QA Strategy
1. Unit tests:
- device resolver
- save policy semantics
- import dedupe + face retry

2. Integration tests:
- AddStudents DB-only
- AddStudents selected devices
- DeviceDetail import + sync

3. Manual tests:
- devices CRUD
- webhook flow
- clone flow
- students edit/sync

## Acceptance Criteria
1. Devices/Students/AddStudents flowlarida dublikat critical logic yo'q.
2. DB-only save hech qachon device push qilmaydi.
3. Source/target device tanlash semantikasi barcha sahifalarda bir xil.
4. Katta page'lar modular va o'qilishi aniq.
5. DRY/KISS/SOLID auditida critical/high finding qolmaydi.

## Risks
1. Refactor paytida hidden coupling chiqishi.
Mitigation: feature-flag bo'lmasa ham incremental commits + smoke checks.

2. Tauri/backend contract drift.
Mitigation: typed request/response wrapper va integration tests.

3. UX regressiya.
Mitigation: existing flow labels/actionsni saqlab qolish, faqat behaviorni standard qilish.

## Deliverables
1. Refactored desktop modules
2. Updated Tauri save-policy contract
3. Test suite updates
4. Audit closure report (before/after)

## Progress Update (2026-02-07)
Completed:
1. Shared device resolver (`src/utils/deviceResolver.ts`) introduced and wired into Devices/AddStudents/DeviceDetail flows.
2. Shared name/photo utilities (`src/utils/name.ts`, `src/utils/photo.ts`) adopted.
3. Add Students device-mode import moved to feature hook (`src/features/add-students/useDeviceModeImport.ts`) and selection modals unified.
4. Device Detail logic decomposed to feature hooks/components (`src/features/device-detail/*`) and page reduced below 700 lines target.
5. Students page edit/sync flow moved to dedicated hook (`src/features/students/useStudentEdit.ts`), table wiring typed.
6. Tauri register flow now honors explicit DB-only policy (`targetDeviceIds=[]` skips local device push).
7. Legacy unused student components removed (`AddStudentInline`, `FilterBar`, `DiagnosticRow`, `DeviceTargetsPanel`).
8. `App.old.tsx` removed from desktop app root.
9. Baseline docs created: `REGRESSION_CHECKLIST.md`, `CRITICAL_INVARIANTS.md`, `SMOKE_BASELINE.md`.
10. Verification pipeline is green: `npm run typecheck`, `npm run lint`, `cargo check`.

Remaining:
1. Integration/unit tests for resolver/save-policy/import dedupe are pending.
2. Manual end-to-end QA checklist execution is pending.
