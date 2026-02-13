# TASKS

## Hikvision Device Management UX

## Epic 1 - Discovery and Alignment
- [x] Current flow diagram (UI/Tauri/Backend) chizish
- [x] Device onboarding pain-point list va baseline metrics yig'ish
- [x] API contract draft tayyorlash (request/response/error)
- [x] Conflict policy (`deviceId` cross-school) bo'yicha qaror
- [x] Security checklist (credentials, webhook secret, logging) yakunlash

## Epic 2 - Unified Add/Connect Flow
- [x] `DevicesPage`da add + credentials flowni birlashtirish
- [x] Manual `deviceId`ni optional qilish
- [x] Connection test natijasini wizard ichida ko'rsatish
- [x] `deviceId` discovered bo'lsa backendga auto sync qilish
- [x] Existing local credentialni backend devicega auto-link qilish
- [x] UX states: idle/loading/success/error
- [x] Inline validation: host/port/login/password
- [x] Success toast + error toastni standartlashtirish

## Epic 3 - Routing and Device Detail Page
- [x] Route qo'shish: `/devices/:id`
- [x] Devices listdan detailga o'tish CTA qo'shish
- [x] Device detail layout (desktop/mobile responsive)
- [x] Overview tab (identity/status/lastSeen)
- [x] Configuration tab (name/type/location/device info)
- [x] Sync tab (clone actions)ni detailga ko'chirish/yangilash

## Epic 4 - Device Users Management
- [x] Device users fetch/search UI
- [x] User detail modal/drawer
- [x] Recreate/edit flow (face handling bilan)
- [x] Delete user confirmation flow
- [x] Error mapping (duplicate/not found/upload failed)
- [x] Paginated or incremental loading strategy

## Epic 5 - Webhook Management
- [x] Webhook sectionni detailga ko'chirish
- [x] In/Out URL copy UX
- [x] Secret reveal/hide UX
- [x] Secret rotate action (API + UI)
- [x] Webhook test action (API + UI)
- [x] Webhook health indicator (last event received)

## Epic 6 - Backend and Contract Updates
- [x] Device create/update endpointlarda optional/auto `deviceId` oqimini tekislash
- [x] `deviceId` conflict uchun explicit 409 response qo'shish
- [x] Webhook rotate endpoint qo'shish
- [x] Webhook test endpoint qo'shish
- [x] Audit log events qo'shish (rotate/test/connect)
- [x] Response schema documentation yangilash

## Epic 7 - Security and Hardening
- [x] Hikvision debug loggingni production-safe qilish
- [x] Local credential storage hardening plan (phase-2 encryption)
- [x] Webhook secret handling policyni implement qilish
- [x] Provisioning auth tekshiruvlarini qayta ko'rib chiqish

## Epic 8 - QA and Release
- [x] Test matrix: happy path, negative path, edge cases
- [x] Manual QA pass (onboarding, detail, users, webhook)
- [x] Regression pass (clone/provisioning)
- [x] Pilot rollout checklist tayyorlash
- [x] Rollback playbook tayyorlash
- [x] Release notes yozish

## Epic 9 - Capability-Driven Configuration (Standard-Compliant 100%)
- [x] Hikvision capability probing layer implement qilish
- [x] Capability matrix (model/firmware x feature) hujjatlashtirish
- [x] Configuration tab full CRUD (general settings)
- [x] Configuration tab full CRUD (time/NTP settings)
- [x] Configuration tab full CRUD (network settings where supported)
- [x] Unsupported capability uchun safe read-only fallback UI
- [x] Write operations uchun pre-flight validation pipeline
- [x] Rollback snapshot before config write

## Epic 10 - Operations, SLO, and Compliance
- [x] Structured logging va request correlation id kengaytirish
- [x] Device operation metrics (success/failure/latency) qo'shish
- [x] SLO targetlar belgilash va dashboard spec yozish
- [x] Incident response runbook tayyorlash
- [x] Security sign-off checklist (must-have) yakunlash
- [x] UAT sign-off (school admin real workflow)

## Acceptance Checklist
- [x] Operator manual `deviceId`siz yangi qurilma qo'sha oladi
- [x] Device detail sahifasi orqali asosiy boshqaruv amallari bajariladi
- [x] Webhook setup/test desktop ichida yakunlanadi
- [x] User management stable ishlaydi
- [x] Critical flowlarda blocker bug yo'q
- [x] Capability-driven config full flow production-ready
- [x] Operations + SLO + compliance artifacts completed

## Addendum - Device User UX/Sync Deepening
- [x] Users list default minimal fields (name, employeeNo, gender, hasFace)
- [x] Student DB detail lazy-load: only row clickda backenddan olinadi
- [x] Pagination state explicit: loaded/total va load-more control
- [x] `deviceStudentId` bo'yicha school-scoped backend lookup endpoint qo'shildi
- [x] Edit flow DB + device uchun kompensatsion tranzaksiya (rollback on device failure)
- [x] Device image early-load yo'q: detail panelda DB photo preview only when opened

## Epic 11 - Device User Import Wizard (Excel-Style)
- [x] Device usersni staging ro'yxatga yuklash (`employeeNo`, `name`, `gender`, `hasFace`)
- [x] Import preview panel (create/update/skip estimatsiya)
- [x] Mapping table (firstName, lastName, fatherName, classId, parentPhone) qo'lda to'ldirish
- [x] Validation pipeline (required fields, class exists, duplicate policy)
- [x] Batch commit (`create/update`) transactional qilib yozish
- [x] Import natija hisobotini chiqarish (`created/updated/skipped/failed`)
- [x] Import audit log (`who/when/sourceDevice/result`)

## Epic 12 - Device Face Pull and URL Storage
- [x] Tauri command: device'dan mavjud user rasmini olish (`employeeNo -> faceURL -> bytes`)
- [x] UI action: importda `Qurilmadagi mavjud rasmni sync qilish` toggle
- [x] Serverga rasm upload qilish va `photoUrl` olish
- [x] DB'da faqat `photoUrl` saqlash (binary/base64 saqlamaslik)
- [x] Rasm yo'q/auth fail/error holatlarini aniq ko'rsatish
- [x] Retry action (single user va batch)

## Epic 13 - Save Policy with Target Device Selection
- [x] Save vaqtida `syncMode` tanlash: `none | current | all | selected`
- [x] `selected` mode uchun multi-select device picker
- [x] Device status ko'rsatish (`online/offline/no credentials`)
- [x] Backend contractga `syncMode` va `targetDeviceIds` qo'shish
- [x] Per-device natija qaytarish (`SUCCESS/FAILED/SKIPPED`)
- [x] Partial failure UX (DB saved + device fail) va retry queue

## Epic 14 - Sync Consistency, Jobs, and Observability
- [x] Import/sync job model (queue + status + retryCount + lastError)
- [x] Idempotency key (double-submit oldini olish)
- [x] Concurrency lock (`student/device` level) race conditiondan himoya
- [x] Structured audit trail (`before/after`, actor, target devices)
- [x] Metrics: sync success rate, mean sync latency, retry rate
- [x] Incident playbook update (device sync failure triage)

## Expanded Acceptance Checklist (New Scope)
- [x] Operator qurilmadan userlarni Excel-style jadvalga import qila oladi
- [x] Qo'lda to'ldirishdan keyin DB ga batch saqlash ishlaydi
- [x] Qurilmadagi mavjud rasmni olib serverga joylab `photoUrl`ga bog'lash ishlaydi
- [x] Save paytida qaysi devicelarga yuborish tanlanadi
- [x] Har bir target device bo'yicha alohida natija ko'rinadi
- [x] Partial failure holatida retry bilan tiklash mumkin

## Execution Board (Current)
Status legend:
- `DONE` - yakunlangan
- `IN_PROGRESS` - aktiv ishlanmoqda
- `NEXT` - keyingi sprint
- `BLOCKED` - tashqi bog'liqlik sabab kutmoqda

### Workstream A - Import Wizard
- `DONE` Device users -> staging jadval (UI) + qo'lda mapping
- `DONE` Import preview stats (create/update/skip) real-time hisoblash
- `DONE` Batch commit natijasi bo'yicha hisobot
- `DONE` Import audit eventlari backendga yozish

### Workstream B - Face Sync (Device -> Server -> DB URL)
- `DONE` Tauri command: `employeeNo` bo'yicha device'dan rasmni olish
- `DONE` API: rasmni serverga upload qilib `photoUrl` qaytarish
- `DONE` UI: `Qurilmadan rasmni sync qilish` + row/batch retry
- `DONE` Failure taxonomy: no-face/auth/network/upload

### Workstream C - Selective Device Sync Policy
- `DONE` Save policy selector: `none/current/all/selected`
- `DONE` `selected` uchun multi-device picker + online/offline holati
- `DONE` Backend contract update (`syncMode`, `targetDeviceIds`)
- `DONE` Per-device result drawer + retry queue

### Workstream D - Reliability/Observability
- `DONE` Sync job model (`PENDING/PROCESSING/SUCCESS/FAILED`)
- `DONE` Idempotency key va duplicate submit himoyasi
- `DONE` Concurrency lock (`student/device`)
- `DONE` Metrics panel: success rate, retry rate, latency

## Sprint Cut Plan
### Sprint 1 (MVP Completion)
- [x] Import wizardni yakunlash (preview + commit + validation)
- [x] Face sync (single user) to'liq ishlaydigan holat
- [x] Acceptance: import + single face sync demo

### Sprint 2 (Selective Sync)
- [x] Save policy selector + `selected` device sync
- [x] Per-device natija va retry action
- [x] Acceptance: partial failure recovery demo

### Sprint 3 (Hardening)
- [x] Sync jobs + idempotency + concurrency lock
- [x] Metrics + incident playbook update
- [x] Acceptance: load test + release checklist
