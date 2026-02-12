# IMPLEMENTATION PLAN

## Project
Hikvision Device Management UX

## Problem Statement
Hozirgi oqimda qurilma qo'shish va ulash alohida bo'lib qolgan, `deviceId` ni ko'p holatda operator qo'lda kiritadi, webhook boshqaruvi read-only, va har bir qurilma uchun chuqur boshqaruv (detail) sahifasi yo'q. Bu onboarding vaqtini uzaytiradi va xatolik riskini oshiradi.

## Product Goal
Desktop ilovada quyidagilarni bitta, operatorga qulay oqimga birlashtirish:
1. Avval ulanish (`IP/port/login/parol`), keyin auto identify (`deviceId` avtomatik topish)
2. Qurilma detail sahifasi orqali konfiguratsiya, webhook, user management
3. Provisioning va clone jarayonlarini device detail kontekstida boshqarish

## Scope
In-scope:
1. Unified Add/Connect flow (single wizard/modal)
2. Auto `deviceId` discovery va backendga sync
3. Device Detail page (Overview, Configuration, Users, Webhook)
4. Device-level webhook amallari (view, copy, test, rotate secret)
5. User management (search, recreate/edit, delete)
6. API contract update va error model standardizatsiyasi
7. QA test plan, rollout va rollback
8. Rasmiy ISAPI capability-driven konfiguratsiya (model/firmwarega mos fallback bilan)
9. Operatsion standartlar (SLO, monitoring, audit depth, incident response)

Out-of-scope (phase-1):
1. Full advanced network/NTP config barcha firmware variantlari uchun
2. Bulk migration script for historical inconsistent devices
3. Multi-tenant realtime webhook simulator

## Standards Baseline (Official-First)
1. Hikvision official ISAPI docs birlamchi manba hisoblanadi.
2. Har bir yangi endpoint capability check bilan ishlaydi (`read capability -> allow write`).
3. Endpointlar firmware/modelga qarab farqlansa, UI’da explicit “supported/not supported” ko'rsatiladi.
4. “Write” operatsiyalar oldidan:
- connection check
- permission/auth check
- dry-read snapshot
- validation
5. Har bir kritik o'zgarish audit logga tushadi (who/when/what/before/after).

## Current Architecture (As-Is)
1. Desktop UI: `apps/student-registrator/src/pages/DevicesPage.tsx`
2. Tauri commands: `apps/student-registrator/src-tauri/src/commands.rs`
3. Hikvision client: `apps/student-registrator/src-tauri/src/hikvision.rs`
4. Backend device CRUD: `src/modules/devices/presentation/devices.routes.ts`
5. Webhook endpoint: `src/modules/attendance/presentation/webhook.routes.ts`
6. Provisioning APIs: `src/modules/students/presentation/students.routes.ts`

## Target Architecture (To-Be)
1. Device identity source of truth: backend `Device` + validated `deviceId`
2. Desktop local credentials: backend device bilan qat'iy bog'langan (`backendId`)
3. Add/Connect flow:
- Step 1: connection info
- Step 2: `test_connection` -> discovered `deviceId`
- Step 3: backend upsert/link + metadata save
4. Device Detail route:
- `/devices/:id` (desktop app)
5. Device operations are grouped by tabs:
- Overview
- Configuration
- Users
- Webhook
- Sync/Clone

## UX Design Principles
1. Manual `deviceId` optional bo'ladi (default: auto detect)
2. Har critical action oldidan pre-check: credentials valid, device online
3. Inline errorlar aniq va operator tilida bo'ladi
4. Har yozuvdan keyin immediate feedback: status badge + last checked time
5. Dangerous actions (delete/recreate/rotate secret) uchun confirmation

## API and Contract Changes

### Backend
1. `POST /schools/:schoolId/devices`:
- `deviceId` optional (phase-1), lekin connect success bo'lgach to'ldiriladi
2. `PUT /devices/:id`:
- `deviceId` conflict policy aniq xato bilan (`409` + reason)
3. New (proposed): `POST /schools/:id/webhook/rotate`
- `direction: in|out` bo'yicha secret rotate
4. New (proposed): `POST /schools/:id/webhook/test`
- webhook test request dry-run/health signal

### Desktop-Tauri
1. `test_device_connection` natijasini add/connect flow markaziga o'tkazish
2. `save/update local credentials` faqat backend device bilan linked holda
3. User operations unified response model (`ok`, `code`, `message`, `details`)

## Data and Validation Rules
1. `deviceId` avtomatik topilganda trim/lowercase normalize qilinadi
2. Bir school ichida duplicate device mappingga yo'l qo'yilmaydi
3. Cross-school `deviceId` conflict explicit blocking bilan qaytariladi
4. Webhook secretlar UI'da masked default, reveal explicit action bilan
5. Credentials expiry (`30 days`) har action oldidan tekshiriladi

## Security Considerations
1. Local credential storage hardening (phase-2 encryption path)
2. Debug loglarni production-safe holatga o'tkazish
3. Webhook secret rotate audit loglari
4. Provisioning endpoints authni qat'iy tekshirish
5. Secret lifecycle: generate, rotate, mask, reveal-control, revoke
6. Minimal-privilege principle: faqat kerakli rolelar yozuvchi endpointlarga kira oladi

## Implementation Phases

### Phase 0 - Discovery and Contract Finalization
1. Current flow mapping (UI + Tauri + Backend)
2. Error taxonomy va conflict policyni yakunlash
3. API payload/response specs (documented)

Exit criteria:
1. Contract freeze approved
2. Edge-case matrix documented

### Phase 1 - Unified Add/Connect (MVP)
1. Add va credentials modallarini bitta flowga birlashtirish
2. `deviceId` manual required emas
3. Connection testdan keyin discovered `deviceId` backendga sync
4. Existing local credentialni link/update qilish policy

Exit criteria:
1. New device onboarding without manual `deviceId`
2. Success path < 1 minute (operator test)

### Phase 2 - Device Detail Page
1. Route: `/devices/:id`
2. Overview tab: status, identity, lastSeen, credentials status
3. Configuration tab: name/type/location/device fields
4. Users tab: search/list/edit(recreate)/delete
5. Sync tab: DB->Device, Device->Device controls

Exit criteria:
1. Operator daily operations detail page orqali bajariladi

### Phase 3 - Webhook Management
1. Device detail ichida webhook section
2. Copy URL, reveal/hide secret, rotate secret
3. Webhook test action va natija ko'rsatish

Exit criteria:
1. Webhook setup va maintenance desktop ichida to'liq

### Phase 4 - Hardening and Release
1. Regression tests (manual + automated smoke)
2. Performance checks (large user list)
3. Rollout checklist + rollback instructions

Exit criteria:
1. No blocker bugs
2. Release note + support playbook tayyor

### Phase 5 - Capability-Driven Device Configuration (100% target)
1. Device capability probing layer (`system`, `network`, `time`, `access`, `security`)
2. Configuration tabni full CRUD qilish:
- General device settings
- Time/NTP settings
- Network settings (where supported)
- Access policy related settings (where supported)
3. Unsupported capability uchun safe fallback UI (read-only + reason)

Exit criteria:
1. Configuration tab rasmiy capability asosida ishlaydi
2. Unsupported modelda hech qanday “blind write” qilinmaydi

### Phase 6 - Operational Excellence and Compliance
1. Observability:
- structured logs
- request correlation id
- device operation metrics
2. SLO:
- onboarding success rate target
- webhook processing latency target
- device action failure budget
3. Runbook:
- common incident playbooks
- recovery steps
- escalation matrix

Exit criteria:
1. Operatsion metrikalar dashboard orqali kuzatiladi
2. Incident response hujjatlari amalda ishlatiladigan holatda

## QA Strategy
1. Functional:
- add/connect happy path
- deviceId auto discovery
- conflict handling
- webhook rotate/test
- user recreate/delete
2. Negative:
- offline device
- wrong credentials
- expired credentials
- duplicate device mapping
3. Integration:
- provisioning status updates
- clone workflows

## Acceptance Criteria
1. Operator yangi qurilmani manual `deviceId`siz qo'sha oladi
2. Connection successdan keyin `deviceId` avtomatik to'ldiriladi
3. Har qurilma uchun alohida detail sahifa mavjud
4. Webhook ma'lumotlari detail sahifada boshqariladi (kamida view/copy/test)
5. User management operatsiyalari detail sahifadan bajariladi
6. Configuration tab capability-driven full flowga ega
7. Webhook lifecycle (view/test/rotate/health) production-ready
8. Security checklistdagi “must-have” bandlar to'liq yopilgan

## Risks and Mitigations
1. Firmware variability:
- Mitigation: endpoint capability detection + graceful fallback
2. Device ID mismatch:
- Mitigation: strict normalization + explicit conflict UI
3. Secret leakage risk:
- Mitigation: masked defaults + audit logging + minimal debug logs
4. Migration friction:
- Mitigation: backward-compatible API + incremental rollout

## Rollout Plan
1. Internal pilot (1-2 school)
2. Controlled rollout (10-20%)
3. Full rollout

## Rollback Plan
1. Feature flags orqali detail/webhook controlsni vaqtincha o'chirish
2. Legacy Devices page flowga qaytish
3. API backward compatibility saqlanadi

## Deliverables
1. Updated desktop UX flows
2. Device detail page
3. Webhook management controls
4. Updated API contracts and docs
5. Test report and release notes
6. Capability matrix (model x feature support)
7. Operations runbook + SLO dashboard spec
8. Compliance checklist and sign-off artifact

## Definition of Done (Strict)
1. Functional:
- barcha tasklar implementatsiya + demo bilan tasdiqlangan
2. Quality:
- root build/typecheck green
- student-registrator build green
3. Security:
- debug leakage yo'q
- secrets masked by default
- rotate/test audited
4. Documentation:
- plan, tasks, API contract, rollback, release notes updated
5. UAT:
- school admin operator bilan real scenario sign-off

## Addendum - Student Sync Strategy (Final)
1. Source of truth:
- Primary source: `DB (Student)`; Hikvision device projection sifatida ishlaydi.
2. Read strategy:
- Device users list: minimal fields faqat device API dan.
- Student detail: row clickdan keyin `deviceStudentId` orqali DB lookup (`lazy load`).
3. Edit strategy (DB + Device):
- Step 1: DB update.
- Step 2: Device update/recreate.
- Step 3: Device update fail bo'lsa DB rollback (kompensatsion tranzaksiya).
4. Pagination:
- Device users endpoint (`offset/limit`) asosida incremental loading.
- UI `loaded/total` ko'rsatadi, yirik ro'yxatlarda first paint tez qoladi.

## Addendum - Device-to-DB Import and Selective Sync Plan
1. New product flow:
- Device Users tab ichida `Import to DB` wizard ochiladi.
- Wizard 3 qadamdan iborat bo'ladi:
- Step 1: Device'dan userlarni yuklash (staging).
- Step 2: Excel-like mapping jadvalda qo'lda to'ldirish.
- Step 3: Save policy tanlash va commit.

2. Import data model (staging):
- Device payload: `employeeNo`, `name`, `gender`, `hasFace`, `faceURL`.
- UI-only mapped fields: `firstName`, `lastName`, `fatherName`, `classId`, `parentPhone`.
- Identity key: `schoolId + employeeNo` (`deviceStudentId`ga map).

3. Save policy (professional):
- `syncMode = none`: faqat DB save.
- `syncMode = current`: faqat joriy detail device.
- `syncMode = all`: barcha active device.
- `syncMode = selected`: operator tanlagan device ro'yxati.
- Contract fields:
- `syncMode`, `targetDeviceIds[]`, `sourceDeviceId`.

4. Image strategy (device-first for face):
- Device source-of-truth for face image.
- `Qurilmadan rasmni sync qilish` action:
- device `faceURL`dan image bytes olish,
- server upload,
- DB `photoUrl` update.
- DBda binary/base64 saqlanmaydi; faqat URL saqlanadi.

5. Transaction and consistency:
- DB write + device writes distributed transaction emas.
- Pattern: DB commit + per-device sync result + retry queue.
- Optional strict mode:
- device fail bo'lsa kompensatsion rollback.
- Default mode:
- DB saqlanadi, device fail bo'lsa `FAILED` status + retry.

6. Backend changes (planned):
- `POST /devices/:id/import-users/preview`
- `POST /devices/:id/import-users/commit`
- `POST /devices/:id/users/:employeeNo/sync-face-to-db`
- `POST /students/:id/sync-to-devices` (`syncMode`, `targetDeviceIds`)
- `GET /sync-jobs/:id` / `POST /sync-jobs/:id/retry`

7. UX changes (planned):
- Device users listda `Import to DB` CTA.
- Mapping table: row-level validation va inline errors.
- Save panel: sync mode select + device multi-select.
- Result drawer: per-device status (`SUCCESS/FAILED/SKIPPED`) + retry.
- Face status badges: `NO_FACE`, `SYNCED`, `FAILED`.

8. QA matrix extension:
- Device'da rasm bor/yo'q holatlari.
- DB-only save vs selected devices sync.
- Partial failure (offline device) va retry.
- Duplicate `deviceStudentId` va class validation.
- Large import (1k+ users) performance va pagination.
