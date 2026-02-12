# Backend DDD Refactor Tasks

## Meta
- Scope: `server.ts` va `src/**` backend DDD refaktori (behavior 1:1 saqlanadi).
- Branch: joriy branch, yangi branch ochilmadi.
- Frontend safety: `apps/frontend/**` va `apps/student-registrator/**` ga tegilmadi.
- Sana: `2026-02-12` holati.

## Phase Status

| Phase | Goal | Status | Risks | Done Criteria |
|---|---|---|---|---|
| 0 | Audit & inventory + baseline | DONE | Noto'g'ri inventory regressiyani yashiradi | Route/module/DB kirish nuqtalari aniqlangan, baseline verification bor |
| 1 | App composition root + interfaces move | DONE | Route order/prefix buzilishi | `src/app/**` bootstrap va `src/modules/*/interfaces/http` wiring saqlangan |
| 2 | 300-line enforcement | DONE | Split paytida handler drift | `src/**` ichida >300 qatorli fayl yo'q |
| 3 | Attendance application/infrastructure extraction | DONE | Stats hisob-kitobi drifti | `attendance-stats` port/repo ajratilgan, build/typecheck PASS |
| 4 | Strict DDD boundary hardening (barcha modullar) | DONE | Katta ko'chirishda behavior drift | HTTP -> application -> infrastructure oqimi barcha modullarda to'liq bo'lishi |
| 5 | Final cleanup + docs + gates | DONE | Hidden coupling/circular dep | Typecheck/build/lint/test PASS + docs final |

## Remaining Work (Strict DDD uchun qolganlar)

- [x] R1. `auth` modulini application + infrastructure ga ajratish.
- [x] R2. `classes` modulida query/business orchestration ni route'dan chiqarish.
- [x] R3. `devices` modulida CRUD/metrics oqimini application service va infra repositoryga ajratish.
- [x] R4. `holidays` modulini to'liq application/infra patterniga o'tkazish.
- [x] R5. `schools` modulida list/detail/webhook oqimlarini application use-case'ga ko'chirish.
- [x] R6. `search` modulini read-model application service + infra query adapterga ko'chirish.
- [x] R7. `sse` modulida DB read logikasini application read-service orqali ajratish.
- [x] R8. `students` modulida provisioning/import oqimlarini application orchestration qatlamiga yakuniy ko'chirish.
- [x] R9. `users` modulida account/teacher-class oqimlarini application + infra ga ko'chirish.
- [x] R10. `cameras` modulida NVR/ONVIF/stream CRUD oqimlarini application use-case + infra adapterlarga to'liq ajratish.

## Cross-Team Follow-up (Backend Scope Closed)

- [x] F1. `DELETE /schools/:id` contract gapi bo'yicha backend-scope qaror yakunlandi.
  - Audit: backend tarixida bu endpoint mavjud bo'lmagan; qo'shish `zero behavior change` qoidasini buzadi.
  - Qaror: backendda yangi `DELETE /schools/:id` qo'shilmadi (refactor-only policy saqlandi).
  - Natija: backend DDD refactor scope yopildi; frontend contract qarori frontend owner tomonidan alohida yuritiladi.

## Today Completed (2026-02-12)

- [x] C1. `src/modules/attendance/interfaces/http/dashboard-school.routes.ts` ni handlerga ajratish.
- [x] C2. `src/modules/attendance/interfaces/http/dashboard-school.handler.ts` + `dashboard-school.response.ts` qo'shish.
- [x] C3. `src/modules/students/interfaces/http/students-device-import-commit.routes.ts` ni handlerga ajratish.
- [x] C4. `src/modules/students/interfaces/http/students-device-import-commit.handler.ts` + `students-device-import-commit.rows.ts` qo'shish.
- [x] C5. `src/**` line-limit audit: >300 qatorli fayl `0` ta.
- [x] C6. `auth` modulida `auth.service.ts` + `auth.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C7. `holidays` modulida `holidays.service.ts` + `holidays.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C8. `search` modulida `search.service.ts` + `search.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C9. `classes` modulida `classes.service.ts` + `classes.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C10. `devices` modulida `devices.service.ts` + `devices.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C11. `users` modulida `users.service.ts` + `users.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C12. `schools` modulida `schools.service.ts` + `schools.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C13. `sse` modulida `sse-access.service.ts` + `sse.prisma-repository.ts` qo'shildi, route bevosita Prisma'dan chiqarildi.
- [x] C14. `attendance` modulida HTTP qatlami `attendanceRepo` adapterga o'tkazildi (`attendance-http.prisma-repository.ts`).
- [x] C15. `students` modulida HTTP qatlami `studentsRepo` adapterga o'tkazildi (`students-http.prisma-repository.ts`).
- [x] C16. `cameras` modulida HTTP qatlami `camerasRepo` adapterga o'tkazildi (`cameras-http.prisma-repository.ts`).
- [x] C17. `application -> infrastructure` type-import bog'liqligi olib tashlandi (`auth/users/holidays/classes/devices/schools/sse`).
- [x] C18. Yakuniy boundary audit: `application` qatlamida `../infrastructure` import yo'q.

## Verification Log

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-02-12 | `npm run typecheck` | PASS | `tsc -p tsconfig.json --noEmit` xatolarsiz |
| 2026-02-12 | `npm run build` | PASS | `tsc -p tsconfig.json` xatolarsiz |
| 2026-02-12 | `npm test` | PASS | 4 file, 15 test PASS |
| 2026-02-12 | `npm run lint` | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run typecheck` | PASS | `auth/holidays/search` extractiondan keyin qayta tekshiruv |
| 2026-02-12 | `npm run build` | PASS | extractiondan keyin build toza |
| 2026-02-12 | `npm test` | PASS | 4 file, 15 test PASS |
| 2026-02-12 | `npm run lint` | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run typecheck` | PASS | `classes` extractiondan keyin qayta tekshiruv |
| 2026-02-12 | `npm run build` | PASS | `classes` extractiondan keyin build toza |
| 2026-02-12 | `npm run typecheck` | PASS | Final gate |
| 2026-02-12 | `npm run build` | PASS | Final gate |
| 2026-02-12 | `npm test` | PASS | Final gate (4 file, 15 test) |
| 2026-02-12 | `npm run lint` | PASS | Final gate |
| 2026-02-12 | `npm run typecheck` | PASS | `devices/users/schools/sse/attendance/students/cameras` repo-adapter migrationdan keyin |
| 2026-02-12 | `npm run build` | PASS | Yakuniy compile toza |
| 2026-02-12 | `npm test` | PASS | 4 file, 15 test PASS |
| 2026-02-12 | `npm run lint` | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run typecheck` | PASS | Docs finalizationdan keyin qayta gate |
| 2026-02-12 | `npm run build` | PASS | Docs finalizationdan keyin qayta gate |
| 2026-02-12 | `npm test` | PASS | Final smoke (4 file, 15 test) |
| 2026-02-12 | `npm run lint` | PASS | Final lint gate |
| 2026-02-12 | `npm run typecheck` | PASS | Application port extractiondan keyin |
| 2026-02-12 | `npm run build` | PASS | Application port extractiondan keyin |
| 2026-02-12 | `npm test` | PASS | 4 file, 15 test PASS |
| 2026-02-12 | `npm run lint` | PASS | ESLint error yo'q |
| 2026-02-12 | `rg -n "../infrastructure/" src/modules -g "*application*.ts"` | PASS | Match topilmadi (`application` -> `infrastructure` yo'q) |
| 2026-02-12 | `rg -n "\\bprisma\\." src/modules -g "*interfaces/http*.ts"` | PASS | Match topilmadi (`interfaces/http` bevosita Prisma ishlatmaydi) |
| 2026-02-12 | `npm run typecheck` | PASS | Final re-check (docs update'dan keyin) |
| 2026-02-12 | `npm run build` | PASS | Final re-check (docs update'dan keyin) |
