# Backend DDD Refactor Tasks

## Meta
- Scope: `server.ts` va `src/**` backend DDD refaktori (behavior 1:1 saqlanadi).
- Branch: joriy branch, yangi branch ochilmadi.
- Frontend safety: `frontend/**` va `apps/student-registrator/**` ga tegilmadi.
- Sana: `2026-02-12` holati.

## Phase Status

| Phase | Goal | Status | Risks | Done Criteria |
|---|---|---|---|---|
| 0 | Audit & inventory + baseline | DONE | Noto'g'ri inventory regressiyani yashiradi | Route/module/DB kirish nuqtalari aniqlangan, baseline verification bor |
| 1 | App composition root + interfaces move | DONE | Route order/prefix buzilishi | `src/app/**` bootstrap va `src/modules/*/interfaces/http` wiring saqlangan |
| 2 | 300-line enforcement | DONE | Split paytida handler drift | `src/**` ichida >300 qatorli fayl yo'q |
| 3 | Attendance application/infrastructure extraction | DONE | Stats hisob-kitobi drifti | `attendance-stats` port/repo ajratilgan, build/typecheck PASS |
| 4 | Strict DDD boundary hardening (barcha modullar) | IN_PROGRESS | Katta ko'chirishda behavior drift | HTTP -> application -> infrastructure oqimi barcha modullarda to'liq bo'lishi |
| 5 | Final cleanup + docs + gates | IN_PROGRESS | Hidden coupling/circular dep | Typecheck/build/lint/test PASS + docs final |

## Remaining Work (Strict DDD uchun qolganlar)

- [ ] R1. `auth` modulini application + infrastructure ga ajratish (hozir `interfaces/http/auth.routes.ts` ichida bevosita Prisma bor).
- [ ] R2. `classes` modulida query/business orchestration ni route'dan chiqarish.
- [ ] R3. `devices` modulida CRUD/metrics oqimini application service va infra repositoryga ajratish.
- [ ] R4. `holidays` modulini to'liq application/infra patterniga o'tkazish.
- [ ] R5. `schools` modulida list/detail/webhook oqimlarini application use-case'ga ko'chirish.
- [ ] R6. `search` modulini read-model application service + infra query adapterga ko'chirish.
- [ ] R7. `sse` modulida DB read logikasini application read-service orqali ajratish.
- [ ] R8. `students` modulida provisioning/import oqimlarini application orchestration qatlamiga yakuniy ko'chirish.
- [ ] R9. `users` modulida account/teacher-class oqimlarini application + infra ga ko'chirish.
- [ ] R10. `cameras` modulida NVR/ONVIF/stream CRUD oqimlarini application use-case + infra adapterlarga to'liq ajratish.

## Today Completed (2026-02-12)

- [x] C1. `src/modules/attendance/interfaces/http/dashboard-school.routes.ts` ni handlerga ajratish.
- [x] C2. `src/modules/attendance/interfaces/http/dashboard-school.handler.ts` + `dashboard-school.response.ts` qo'shish.
- [x] C3. `src/modules/students/interfaces/http/students-device-import-commit.routes.ts` ni handlerga ajratish.
- [x] C4. `src/modules/students/interfaces/http/students-device-import-commit.handler.ts` + `students-device-import-commit.rows.ts` qo'shish.
- [x] C5. `src/**` line-limit audit: >300 qatorli fayl `0` ta.

## Verification Log

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-02-12 | `npm run typecheck` | PASS | `tsc -p tsconfig.json --noEmit` xatolarsiz |
| 2026-02-12 | `npm run build` | PASS | `tsc -p tsconfig.json` xatolarsiz |
| 2026-02-12 | `npm test` | PASS | 4 file, 15 test PASS |
| 2026-02-12 | `npm run lint` | PASS | ESLint error yo'q |
