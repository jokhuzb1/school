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
