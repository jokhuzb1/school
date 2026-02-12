# TASKS - Audit Log Expansion

## Goal
Maqsad: Student Registrator va backend bo'ylab audit izini kuchaytirish, "kim nima qildi" savoliga aniq javob berish.

## Scope
- `student-registrator` frontend audit event yuborishlari
- backend audit yozuvlarini standartlash
- auth, CRUD, security eventlarini qamrab olish
- mavjud `ProvisioningLog` bilan mos ishlash

## Backlog
Status snapshot (2026-02-10):
- Done: backend audit foundation, auth/security audit, class/device/school CRUD audit, audit UI filter+payload+csv
- In progress: taxonomy/contract formalization, student CRUD eventlari
- Pending: retention policy, dedicated audit tests, runbook updates

### 1) Audit event taxonomy ni joriy qilish
- [x] Event nomlash standartini belgilash (`AUTH_*`, `STUDENT_*`, `DEVICE_*`, `CLASS_*`, `SECURITY_*`, `PROVISIONING_*`)
- [ ] Har event uchun minimal payload contract yozish
- [ ] Stage/status qiymatlarini whitelist qilish

### 2) Actor metadata ni majburiy qilish
- [x] Har audit yozuviga `actorId`, `actorRole`, `actorName` qo'shish
- [x] Transport metadata qo'shish: `ip`, `userAgent`, `requestId`
- [ ] System actor (cron/job) uchun `actorType=SYSTEM` belgilash

### 3) Auth audit
- [x] `LOGIN_SUCCESS` log yozish
- [x] `LOGIN_FAILED` log yozish (sababi bilan)
- [x] `LOGOUT` log yozish
- [x] Token/permission xatolarini `ACCESS_DENIED` sifatida loglash

### 4) CRUD audit (asosiy obyektlar)
- [ ] Student create/update/delete eventlari
- [x] Device create/update/delete eventlari
- [x] Class create/update/delete eventlari
- [x] Bulk import eventlari (`START`, `FINISH`, `FAIL`)

### 5) Before/after snapshot siyosati
- [ ] O'zgaradigan fieldlar uchun `before`/`after` saqlash
- [x] Sensitive maydonlarni masklash (`password`, `token`, biometrik data)
- [ ] Payload size limiti va truncation qoidasi

### 6) Audit Logs UI yaxshilash
- [x] Event type/filter qo'shish
- [x] Actor bo'yicha filter qo'shish
- [x] Payload detail drawer (read-only, masklangan)
- [ ] CSV export (admin-only)

### 7) Retention va operatsion boshqaruv
- [ ] Audit retention policy (masalan 180 kun) hujjatlashtirish
- [ ] Arxivlash yoki tozalash jobi
- [ ] Incident payti tez qidiruv uchun indeks tekshiruvi

### 8) Test va qabul mezonlari
- [ ] Unit test: audit helper, masklash, taxonomy validation
- [ ] Integration test: auth + CRUD endpointlar audit yozishi
- [ ] UAT: "kim qo'shdi, kim login bo'ldi" ssenariylari

## Definition of Done
- [ ] Auth + CRUD + Provisioning eventlari auditda ko'rinadi
- [x] Har yozuvda actor metadata mavjud
- [x] Sensitive ma'lumotlar logga chiqmaydi
- [x] Audit sahifasida actor/event bo'yicha filter ishlaydi
- [ ] Testlar yashil, runbook yangilangan
