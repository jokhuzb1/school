# Standartlashtirish reja (Backend + Frontend)

Maqsad: kod bazani DRY/KISS/SOLID tamoyillariga moslashtirish, hisoblash/label/status va servis logikalarini yagona standartga keltirish.

## 1. Audit va xaritalash (1–2 kun)
- Barcha status va statistika hisoblanadigan joylarni ro‘yxatlash.
- Backend: `dashboard`, `schools`, `students`, `attendance`, `webhook`, `cron`.
- Frontend: `Dashboard`, `Schools`, `Students`, `Attendance`, `ClassDetail`, `SuperAdminDashboard`.
- Qaysi joyda qanday “source of truth” ishlatilayotganini aniqlash.

## 2. Backend: yagona service qatlam (2–4 kun)
### 2.1. AttendanceStats service
- Yagona service: `src/services/attendanceStats.ts`
- Mas’ul vazifalar:
  - Period bo‘yicha `present/late/absent/excused` counts.
  - `pendingEarly/pendingLate` hisoblash.
  - `classBreakdown` va `weeklyStats` uchun yagona hisob.
  - `attendancePercent` standart formulasi.

### 2.2. Route’lar refaktori
- `/schools` → service’dan foydalanish.
- `/schools/:id/dashboard` → service’dan foydalanish.
- `/admin/dashboard` → service’dan foydalanish.
- `/students` va `/attendance` → service’dan foydalanish.

### 2.3. Testlar (minimal)
- 4 ta asosiy scenario:
  1) Dars boshlanmagan (pendingEarly)
  2) Dars boshlangan (pendingLate)
  3) Cutoffdan o‘tgan (absent)
  4) IN scan (present/late)

## 3. Frontend: yagona mapping va UI logika (2–3 kun)
### 3.1. Status mapping
- Bitta fayl: `frontend/src/utils/attendanceUi.ts`
- Barcha sahifalarda bitta mapping (label, color, tooltip, icon).

### 3.2. KPI/Stats standard
- “Present” faqat PRESENT.
- “Late” faqat LATE.
- “Arrived” = PRESENT + LATE (alohida ko‘rsatilsa).
- “Pending” faqat PENDING_EARLY + PENDING_LATE.

### 3.3. UI komponentlar
- `StatusBar`, `StatItem`, `Charts` yagona utilitydan foydalanadi.

## 4. Utils va hooklar (1–2 kun)
- Date/time util: yagona format.
- Polling/refresh: yagona hook.
- Query param handling: yagona helper.

## 5. Dokumentatsiya (0.5 kun)
- “Attendance standard” qoidalari.
- Statuslar va formulalar yozuvi.
- Endpoints standart javob strukturalari.

---

# Qisqa prioritet
1) Backend attendanceStats service (eng muhim)
2) Frontend status mapping
3) Testing va docs

Agar bu reja tasdiqlansa, keyingi chatda 2‑bosqichni kodga tushirishni boshlaymiz.

# Arxitektura bo�yicha qaror (FSD/DDD)
To�liq FSD/DDD hozircha overengineering bo�lishi mumkin. Amaliy yechim sifatida ** lite** yondashuvni tanlaymiz.

## Frontend: FSD-lite
- shared/ � UI atomlar, utils, status mapping
- entities/attendance � attendance logika (selectors, mappers)
- pages/ � faqat view + orchestration

## Backend: DDD-lite
- services/ � biznes logika (AttendanceStats va boshqalar)
- outes/ � request parsing + response
- utils/ � pure helpers

Keyin zarurat bo�lsa to�liq FSD/DDD ga bosqichma-bosqich kengaytiramiz.
