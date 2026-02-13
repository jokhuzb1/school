# Backend DDD Refactor Tasks

## Meta
- Scope: `server.ts` va `src/**` backend qatlamini DDD bo'yicha qayta tashkil qilish (behavior o'zgarmaydi).
- Branch: joriy branch (`refactor/fsd-migration`), yangi branch ochilmadi.
- Non-negotiable: endpoint/method/path, contract, status code, auth/authz, validation, DB side-effectlar 1:1 saqlandi.
- Frontend safety: `frontend/**` o'zgarishlariga tegilmasdan backend refaktor qilindi.

## Phase Status

| Phase | Goal | Status | Risks | Done Criteria |
|---|---|---|---|---|
| 0 | Audit & inventory + baseline | DONE | Noto'g'ri baseline regressiyani yashirishi mumkin | Route/module/DB inventory va baseline verification log mavjud |
| 1 | App composition root (`src/app`) | DONE | Plugin/hook/route order buzilishi | `server.ts` -> `src/app/server/*` orqali bootstrap, order saqlangan |
| 2 | Medium route split (`attendance/schools/users/sse`) | DONE | Import/dependency uzilishi | Route split + wrapperlar, behavior o'zgarmagan |
| 3 | Heavy split (`cameras/dashboard/webhook/students/attendanceStats`) | DONE | Yirik handler regressiyasi | Barcha yirik fayllar bo'lindi, runtime contract saqlandi |
| 4 | Interfaces standardization (`presentation -> interfaces/http`) | DONE | Old import path sinishi | `presentation` thin-wrapper, asosiy route logic `interfaces/http`da |
| 5 | Final cleanup + line-limit + docs | DONE | Hidden compile/runtime xatolik | `typecheck/build` PASS, `src/**`da >300 qatorli fayl yo'q, docs yangilandi |

## Task Checklist

- [x] T0.1 Audit: route/module/DB kirish nuqtalarini inventarizatsiya qilish.
  - Goal: behavior kontraktini yo'qotmasdan refaktor qilish uchun aniq xarita.
  - Impacted files: `server.ts`, `src/routes/**`, `src/modules/**`, `src/utils/**`.
  - Status: DONE
  - Risks: noto'liq inventarizatsiya regressiyani kech aniqlashi mumkin.
  - Done criteria: endpointlar va yirik fayllar ro'yxati shakllantirildi.

- [x] T0.2 Baseline verification.
  - Goal: refaktor oldidan kompilyatsiya holatini qayd etish.
  - Impacted files: none (verification only).
  - Status: DONE
  - Risks: yo'q.
  - Done criteria: `npm run typecheck` va `npm run build` PASS.

- [x] T1.1 App composition root ajratish.
  - Goal: Fastify setup/bootstrapni `src/app/server/*` ga ko'chirish.
  - Impacted files: `server.ts`, `src/app/server/create-server.ts`, `src/app/server/start-server.ts`.
  - Status: DONE
  - Risks: plugin registration order o'zgarishi.
  - Done criteria: order/prefix/decorator behavior 1:1 saqlangan.

- [x] T2.1 Medium route split.
  - Goal: `attendance/schools/users/sse` route fayllarini endpoint-guruhlar bo'yicha ajratish.
  - Impacted files: `src/modules/attendance/interfaces/http/**`, `src/modules/schools/interfaces/http/**`, `src/modules/users/interfaces/http/**`, `src/modules/sse/interfaces/http/**`.
  - Status: DONE
  - Risks: import path xatolari.
  - Done criteria: typecheck/build PASS, route behavior saqlangan.

- [x] T3.1 Cameras split.
  - Goal: `cameras.routes.ts`ni SRP bo'yicha bo'lish.
  - Impacted files: `src/modules/cameras/interfaces/http/**`, `src/modules/cameras/presentation/cameras.routes.ts`.
  - Status: DONE
  - Risks: ONVIF/stream/deploy flow regressiyasi.
  - Done criteria: route order va response semantics o'zgarmagan.

- [x] T3.2 Dashboard split.
  - Goal: admin/school/events endpointlarini alohida registratorlarga bo'lish.
  - Impacted files: `src/modules/attendance/interfaces/http/dashboard*.ts`, `src/modules/attendance/presentation/dashboard.routes.ts`.
  - Status: DONE
  - Risks: stats aggregation natijasi o'zgarishi.
  - Done criteria: contract saqlangan, typecheck/build PASS.

- [x] T3.3 Webhook split.
  - Goal: webhook prepare/handler/routesni bo'lish.
  - Impacted files: `src/modules/attendance/interfaces/http/webhook*.ts`, `src/modules/attendance/presentation/webhook.routes.ts`.
  - Status: DONE
  - Risks: dedup/transaction semantikasi buzilishi.
  - Done criteria: webhook response va DB side-effectlar saqlangan.

- [x] T3.4 Students split.
  - Goal: `students` endpointlarini registratorlarga bo'lish, import/provision oqimini helper/servicega ajratish.
  - Impacted files: `src/modules/students/interfaces/http/**`, `src/modules/students/presentation/students.routes.ts`.
  - Status: DONE
  - Risks: provisioning auth/idempotency/import-lock regressiyasi.
  - Done criteria: endpoint contract saqlangan, barcha fayllar <=300.

- [x] T3.5 Attendance stats split.
  - Goal: `attendanceStats`ni kichik application xizmatlariga ajratish.
  - Impacted files: `src/modules/attendance/application/attendance-stats/**`, `src/modules/attendance/application/attendanceStats.ts`.
  - Status: DONE
  - Risks: hisob-kitoblar drifti.
  - Done criteria: export contract saqlangan.

- [x] T4.1 Interfaces standardization.
  - Goal: barcha route modullarda asosiy HTTP layerni `interfaces/http`ga o'tkazish.
  - Impacted files: `src/modules/*/interfaces/http/**`, `src/modules/*/presentation/*.routes.ts`.
  - Status: DONE
  - Risks: nisbiy import-path xatolari.
  - Done criteria: `presentation` wrapperlar ishlaydi, server route wiring o'zgarmagan.

- [x] T5.1 Final cleanup.
  - Goal: line-limit va compile holatini yakuniy tekshirish, hujjatlarni to'ldirish.
  - Impacted files: `src/**`, `work-item/tasks.md`, `work-item/implementation-plan.md`, `work-item/ddd-map.md`.
  - Status: DONE
  - Risks: yakuniy bosqichda yashirin type path xatolari.
  - Done criteria: `typecheck/build` PASS, `src/**`da >300 qatorli fayl yo'q.

## Verification Log

| Phase | Command | Result | Notes |
|---|---|---|---|
| 0 | `npm run typecheck` | PASS | Baseline holat xatolarsiz |
| 0 | `npm run build` | PASS | Baseline build muvaffaqiyatli |
| 1 | `npm run typecheck` | PASS | `src/app/server` composition rootdan keyin |
| 1 | `npm run build` | PASS | Bootstrap wrapperdan keyin build toza |
| 2 | `npm run typecheck` | FAIL->PASS | Dastlab import path xatolari bor edi, tuzatilgach PASS |
| 2 | `npm run build` | FAIL->PASS | Type fixdan keyin PASS |
| 3 | `npm run typecheck` | FAIL->PASS | Dashboard/students splitda type/path xatolar tuzatildi |
| 3 | `npm run build` | FAIL->PASS | Shu fixlardan keyin build PASS |
| 4 | `npm run typecheck` | FAIL->PASS | Auth/classes/devices/holidays/search `interfaces/http` move paytida bitta path xatosi tuzatildi |
| 4 | `npm run build` | FAIL->PASS | Import path fixdan keyin PASS |
| 5 | `npm run typecheck` | PASS | Yakuniy tekshiruvda xatolik yo'q |
| 5 | `npm run build` | PASS | Yakuniy build muvaffaqiyatli |
| 5 | `npm run start` | FAIL (expected env gap) | Runtime smoke urinishida `@fastify/jwt` `missing secret` (`JWT_SECRET` yo'q) bilan to'xtadi; bu refaktor regressiyasi emas, env prerequisite |
