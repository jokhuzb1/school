# Backend DDD Refactor Tasks

## Meta
- Scope: `server.ts` va `src/**` backend qatlamini DDD bo'yicha qayta tashkil qilish (behavior o'zgarmaydi).
- Branch: joriy branch (`refactor/fsd-migration`), yangi branch ochilmaydi.
- Non-negotiable: endpoint/method/path, contract, status code, authz/authn, validation, DB side-effectlar o'zgarmaydi.
- Frontend safety: `frontend/**` ga tegilmaydi (parallel agent bilan konflikt qilinmaydi).

## Phase Status

| Phase | Goal | Status | Risks | Done Criteria |
|---|---|---|---|---|
| 0 | Audit & inventory + backend baseline | DONE | Noto'g'ri baseline keyingi regressiyani yashiradi | Route/module/DB kirish nuqtalari ro'yxati, baseline typecheck/build log bor |
| 1 | DDD skeleton + app composition root | IN_PROGRESS | Route order/prefix yoki plugin behavior buzilishi | `src/app` orqali bootstrap, plugin/route order aynan saqlangan |
| 2 | Medium route split (<=300) | DONE | Import/dependency uzilishi | `attendance/schools/users/sse` route fayllari <=300, behavior saqlangan |
| 3 | Heavy route split (<=300) | IN_PROGRESS | Yirik handlerlarda regressiya | `cameras/dashboard/webhook/students` va `attendanceStats` fayllari <=300 |
| 4 | Interfaces qatlamini standartlash | TODO | Old import path sinishi | `src/modules/*/interfaces/http` asosiy qatlam, `presentation` wrapperlar bilan backward-compat |
| 5 | Final cleanup + boundary + docs | TODO | Circular dependency, dead code | Yakuniy typecheck/build PASS, docs to'liq, line-limit to'liq bajarilgan |
