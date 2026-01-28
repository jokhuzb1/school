# Standartlashtirish reja (Backend + Frontend)

Maqsad: kod bazani DRY/KISS/SOLID tamoyillariga moslashtirish, hisoblash/label/status va servis logikalarini yagona standartga keltirish.

## Hozirgi holat (bajarilgan)
- Backend DDD-lite boshlandi: route'lar modullarga ko'chirildi (attendance, dashboard, webhook, schools, users, devices, classes, students, holidays, sse, auth) va `src/routes/*` re-export bo'lib qoldi.
- Attendance stats yagona manbaga ko'chirildi: `src/modules/attendance/application/attendanceStats.ts` (+ `src/services/attendanceStats.ts` re-export).
- Attendance status util domain qatlamga ko'chirildi: `src/modules/attendance/domain/attendanceStatus.ts` (+ `src/utils/attendanceStatus.ts` re-export).
- Frontend status mapping yagona faylga o'tkazildi: `frontend/src/shared/attendance/status.ts`.
- Backend attendance foizi hisoblash helperi qo'shildi va dashboard/schools/students hisoblarida qo'llanildi: `calculateAttendancePercent`.
- Frontend event type rang/label mappinglari yagona manbaga ko'chirildi (`EVENT_TYPE_BG`, `EVENT_TYPE_COLOR`, `EVENT_TYPE_TAG`) va sahifalarda ishlatilmoqda.
- FSD-lite boshlanishi: `frontend/src/entities/attendance` yaratildi (shared mappinglar re-export), pages importlari shu qatlamga o'tkazildi.
- FSD-lite UI: `StatusTag` va `StatusBar` `frontend/src/entities/attendance/ui` ga ko'chirildi, `frontend/src/components` da re-exportlar qoldi.
- Backend dashboard class breakdown hisoblash `getClassBreakdown` orqali attendance service qatlamiga ko'chirildi.
- Frontend `shared/attendance/status.tsx` shim olib tashlandi (yagona manba `status.ts`).
- Backend dashboard "not yet arrived/pending" ro'yxati `getPendingNotArrivedList` helperiga ko'chirildi.
- Test infrasi qo'shildi (vitest) va `computeAttendanceStatus` uchun 4 ta asosiy scenario testlari yozildi.
- Frontend `entities/attendance/model` qatlamiga stats/tag selectorlar ajratildi va Attendance/Students/StudentDetail/ClassDetail sahifalari shu helperlarni ishlatadi.
- Frontend umumiy UI komponentlari `shared/ui` ga ko'chirildi (Layout, ProtectedRoute, PageHeader, StatItem) va sahifalar shu qatlamdan import qiladi; `components/*` shim sifatida qoldi.
- `components/*` shimlar olib tashlandi (to'liq `shared/ui` va `entities/attendance` qatlamlari ishlatiladi).
- Minimal UI docs: `shared/ui/README.md` va `UiGallery` demo komponenti qo'shildi.
- UI komponentlarda DRY/KISS/SOLID: umumiy style konstantalar ajratildi.
- UI tavsiyalariga ko'ra: Layout menu helper, `shared/ui/styles.ts` va StatusBar tooltip helper qo'shildi.
- UI inline style'lar maksimal darajada `shared/ui/styles.ts` ga ko'chirildi.
- StatusTag/StatusBar va Layout qolgan inline style'lari ham `shared/ui/styles.ts` helperlariga ko'chirildi.
- DRY refaktor: period options va date filter helperlar `shared/constants/periodOptions.ts` va `shared/utils/dateFilters.ts` ga ko'chirildi; backend teacher class scope filtri helper bilan birlashtirildi.
- Kamera monitoring (mock) uchun FSD-lite qatlamlar qo'shildi: `entities/camera/*`, `pages/Cameras.tsx`, `shared/ui/layoutMenu.tsx` da menu qo'shildi.
- Kamera monitoring refinements: search/filter, lastSeen ko'rsatish, snapshot interval config (`CAMERA_SNAPSHOT_REFRESH_MS`), backend skeleton (`/camera-areas`, `/cameras`) qo'shildi.

## 1. Audit va xaritalash (1-2 kun)
- Barcha status va statistika hisoblanadigan joylarni ro'yxatlash.
- Backend: `dashboard`, `schools`, `students`, `attendance`, `webhook`, `cron`.
- Frontend: `Dashboard`, `Schools`, `Students`, `Attendance`, `ClassDetail`, `SuperAdminDashboard`.
- Qaysi joyda qanday "source of truth" ishlatilayotganini aniqlash.

## 2. Backend: yagona service qatlam (2-4 kun)
### 2.1. AttendanceStats service
- Yagona service: `src/modules/attendance/application/attendanceStats.ts`
- Moslik uchun re-export: `src/services/attendanceStats.ts`
- Mas'ul vazifalar:
  - Period bo'yicha `present/late/absent/excused` counts.
  - `pendingEarly/pendingLate` hisoblash.
  - `classBreakdown` va `weeklyStats` uchun yagona hisob.
  - `attendancePercent` standart formulasi.

### 2.2. Route'lar refaktori
- `/schools` -> service'dan foydalanish.
- `/schools/:id/dashboard` -> service'dan foydalanish.
- `/admin/dashboard` -> service'dan foydalanish.
- `/students` va `/attendance` -> service'dan foydalanish.

### 2.3. Testlar (minimal)
- 4 ta asosiy scenario:
  1) Dars boshlanmagan (pendingEarly)
  2) Dars boshlangan (pendingLate)
  3) Cutoffdan o'tgan (absent)
  4) IN scan (present/late)

## 3. Frontend: yagona mapping va UI logika (2-3 kun)
### 3.1. Status mapping
- Bitta fayl: `frontend/src/shared/attendance/status.ts`
- Barcha sahifalarda bitta mapping (label, color, tooltip, icon).

### 3.2. KPI/Stats standard
- "Present" faqat PRESENT.
- "Late" faqat LATE.
- "Arrived" = PRESENT + LATE (alohida ko'rsatilsa).
- "Pending" faqat PENDING_EARLY + PENDING_LATE.

### 3.3. UI komponentlar
- `StatusBar`, `StatItem`, `Charts` yagona utilitydan foydalanadi.

## 4. Utils va hooklar (1-2 kun)
- Date/time util: yagona format.
- Polling/refresh: yagona hook.
- Query param handling: yagona helper.

## 5. Dokumentatsiya (0.5 kun)
- "Attendance standard" qoidalari.
- Statuslar va formulalar yozuvi.
- Endpoints standart javob strukturalari.

---

# Qisqa prioritet
1) Backend attendanceStats service (eng muhim)
2) Frontend status mapping
3) Testing va docs

# Arxitektura bo'yicha qaror (FSD/DDD)
To'liq FSD/DDD hozircha overengineering bo'lishi mumkin. Amaliy yechim sifatida **lite** yondashuvni tanlaymiz.

## Frontend: FSD-lite
- shared/ – UI atomlar, utils, status mapping
- entities/attendance – attendance logika (selectors, mappers)
- pages/ – faqat view + orchestration

## Backend: DDD-lite
- modules/*/application – biznes logika (AttendanceStats va boshqalar)
- modules/*/presentation – request parsing + response
- utils/ – pure helpers

Keyin zarurat bo'lsa to'liq FSD/DDD ga bosqichma-bosqich kengaytiramiz.
