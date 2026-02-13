# IMPLEMENTATION PLAN - Audit Log Expansion

## Objective
Audit tizimini provisioningdan tashqariga kengaytirish: auth, CRUD va security eventlari uchun to'liq kuzatuv izi yaratish.

## Current State
- Mavjud audit oqimi asosan `ProvisioningLog` atrofida.
- `import-audit` orqali ba'zi UI telemetry yozilmoqda.
- Actor metadata qisman payload ichida, standart emas.

## Target State
- Yagona audit contract.
- Har eventda actor + request metadata.
- Auth va CRUD eventlari majburiy audit.
- UI'da filter va payload ko'rish imkoniyati.

## Phases
## Progress Snapshot (2026-02-10)
- Phase 1: Completed
- Phase 2: Completed
- Phase 3: Partially completed (student CRUD audit pending)
- Phase 4: Mostly completed (CSV admin-only restriction pending)
- Phase 5: In progress (existing test suite green, dedicated audit tests pending)

### Phase 0 - Design Freeze (0.5 kun)
1. Event taxonomy ni yakunlash.
2. Payload contract va sensitive-data siyosatini tasdiqlash.
3. Retention policy ni tasdiqlash.

Deliverable:
- Tasdiqlangan event ro'yxati va field contract.
Status: In progress

### Phase 1 - Backend Audit Foundation (1-2 kun)
1. Markaziy audit helper/service yaratish (`logAuditEvent`).
2. Actor/request metadata avtomatik inject qilish.
3. Taxonomy validation va payload sanitization qo'shish.

Deliverable:
- Barcha yangi audit yozuvlari helper orqali o'tadi.
Status: Completed

### Phase 2 - Auth + Security Logging (1 kun)
1. `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT` eventlarini qo'shish.
2. `ACCESS_DENIED` eventini role/scope xatolarida qo'shish.
3. Security-friendly message format (no secrets).

Deliverable:
- Auth oqimi audit trail bilan kuzatiladi.
Status: Completed

### Phase 3 - CRUD + Import Audit (1-2 kun)
1. Student/Class/Device create/update/delete eventlarini qo'shish.
2. Bulk import start/finish/fail eventlari.
3. `before`/`after` diff va masklash mexanizmi.

Deliverable:
- "Kim qo'shdi / kim o'zgartirdi / kim o'chirdi" bo'yicha audit tayyor.
Status: In progress

### Phase 4 - Audit Logs UI Upgrade (1 kun)
1. Event type filter.
2. Actor filter.
3. Payload detail panel (read-only, masklangan).
4. CSV export (admin-only).

Deliverable:
- Operatsion va incident tahlili uchun qulay UI.
Status: Mostly completed

### Phase 5 - Validation + Rollout (0.5-1 kun)
1. Unit + integration testlar.
2. UAT ssenariylar (`who did what`) tekshiruvi.
3. Staged rollout va monitoring.

Deliverable:
- Production-ready audit kengaytmasi.
Status: In progress

## Risks and Mitigation
1. Logda maxfiy ma'lumot chiqib ketishi.
Mitigation: centralized masking + blocklist + test.

2. Payload juda katta bo'lib ketishi.
Mitigation: size limit, truncation, only key fields.

3. DB o'sishi va query sekinlashishi.
Mitigation: index review, retention, archival job.

## Acceptance Criteria
1. Auth eventlari auditda ko'rinadi.
2. CRUD eventlarda actor metadata mavjud.
3. Sensitive maydonlar masklangan.
4. Audit Logs sahifasida event/actor filter ishlaydi.
5. Incident paytida `requestId` bo'yicha end-to-end iz topiladi.

## Rollout Strategy
1. Feature flag bilan backend audit kengaytmasini yoqish.
2. 1 ta pilot schoolda kuzatish.
3. KPI: audit completeness, error rate, query latency.
4. Muammo bo'lsa eski modega rollback.

## Rollback
1. Yangi event yozishni feature flag orqali o'chirish.
2. UI'dagi yangi filter/payload panelni hidden modega o'tkazish.
3. Incident runbookga rollback natijasini qayd etish.
