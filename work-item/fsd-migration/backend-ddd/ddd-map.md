# Backend DDD Map

## Ownership (Bounded Context)

| Context | Domain ownership | Hozirgi holat |
|---|---|---|
| `attendance` | attendance status rules, dashboard stats, webhook ingest | CORE EXTRACTION DONE (`attendanceRepo` adapter + application stats qatlamlari) |
| `students` | profile, import/provisioning/device sync | CORE EXTRACTION DONE (`studentsRepo` adapter + orchestration handler/service split) |
| `cameras` | NVR/camera/onvif/stream operations | CORE EXTRACTION DONE (`camerasRepo` adapter + split registratorlar) |
| `schools` | school settings + webhook secret | CORE EXTRACTION DONE (`schools.service.ts` + `schools.prisma-repository.ts`) |
| `users` | account + teacher-class assignment | CORE EXTRACTION DONE (`users.service.ts` + `users.prisma-repository.ts`) |
| `classes` | class schedule and scope | CORE EXTRACTION DONE (`application` + `infrastructure` qo'shilgan) |
| `devices` | terminal CRUD + status helpers | CORE EXTRACTION DONE (`devices.service.ts` + `devices.prisma-repository.ts`) |
| `auth` | login/session token | CORE EXTRACTION DONE (`application` + `infrastructure` qo'shilgan) |
| `holidays` | holiday CRUD | CORE EXTRACTION DONE (`application` + `infrastructure` qo'shilgan) |
| `search` | cross-context read-model search | CORE EXTRACTION DONE (`application` + `infrastructure` qo'shilgan) |
| `sse` | realtime delivery endpoints | CORE EXTRACTION DONE (`sse-access.service.ts` + `sse.prisma-repository.ts`) |

## Old -> New Mapping (asosiy)

| Old path | New path | Status |
|---|---|---|
| `server.ts` heavy bootstrap | `src/app/server/create-server.ts` + `src/app/server/start-server.ts` + `server.ts` thin entry | DONE |
| `src/modules/*/presentation/*.routes.ts` | `src/modules/*/interfaces/http/*.routes.ts` (presentation wrapper saqlangan) | DONE |
| `src/modules/attendance/application/attendanceStats.ts` monolith | `src/modules/attendance/application/attendance-stats/*` + infra repo | DONE |
| `src/modules/attendance/interfaces/http/dashboard-school.routes.ts` monolith | `dashboard-school.routes.ts` + `dashboard-school.handler.ts` + `dashboard-school.response.ts` | DONE |
| `src/modules/students/interfaces/http/students-device-import-commit.routes.ts` monolith | `students-device-import-commit.routes.ts` + `students-device-import-commit.handler.ts` + `students-device-import-commit.rows.ts` | DONE |
| `src/modules/auth/interfaces/http/auth.routes.ts` direct DB access | `src/modules/auth/application/auth.service.ts` + `src/modules/auth/infrastructure/auth.prisma-repository.ts` | DONE |
| `src/modules/classes/interfaces/http/classes.routes.ts` direct DB/orchestration | `src/modules/classes/application/classes.service.ts` + `src/modules/classes/infrastructure/classes.prisma-repository.ts` | DONE |
| `src/modules/holidays/interfaces/http/holidays.routes.ts` direct DB access | `src/modules/holidays/application/holidays.service.ts` + `src/modules/holidays/infrastructure/holidays.prisma-repository.ts` | DONE |
| `src/modules/search/interfaces/http/search.routes.ts` direct DB access | `src/modules/search/application/search.service.ts` + `src/modules/search/infrastructure/search.prisma-repository.ts` | DONE |
| `src/modules/devices/interfaces/http/devices.routes.ts` direct DB access | `src/modules/devices/application/devices.service.ts` + `src/modules/devices/infrastructure/devices.prisma-repository.ts` | DONE |
| `src/modules/users/interfaces/http/{users-account,users-teacher-class}.routes.ts` direct DB access | `src/modules/users/application/users.service.ts` + `src/modules/users/infrastructure/users.prisma-repository.ts` | DONE |
| `src/modules/schools/interfaces/http/*.routes.ts` direct DB access | `src/modules/schools/application/schools.service.ts` + `src/modules/schools/infrastructure/schools.prisma-repository.ts` | DONE |
| `src/modules/sse/interfaces/http/*.routes.ts` direct DB access | `src/modules/sse/application/sse-access.service.ts` + `src/modules/sse/infrastructure/sse.prisma-repository.ts` | DONE |
| `src/modules/attendance/interfaces/http/*.ts` direct DB access | `src/modules/attendance/infrastructure/attendance-http.prisma-repository.ts` (`attendanceRepo`) | DONE |
| `src/modules/students/interfaces/http/*.ts` direct DB access | `src/modules/students/infrastructure/students-http.prisma-repository.ts` (`studentsRepo`) | DONE |
| `src/modules/cameras/interfaces/http/*.ts` direct DB access | `src/modules/cameras/infrastructure/cameras-http.prisma-repository.ts` (`camerasRepo`) | DONE |

## Gap Map (Strict DDD uchun)

- Hozirgi audit bo'yicha ochiq gap qolmadi: `interfaces/http` qatlamida bevosita `prisma.` chaqiriqlari yo'q.
- Hozirgi audit bo'yicha ochiq gap qolmadi: `application` qatlamida bevosita `../infrastructure` import yo'q (ports/interfacelar orqali bog'langan).
- `DELETE /schools/:id` endpoint backend tarixiy contractiga kirmagan; zero-behavior-change policy bo'yicha backendda qo'shilmadi (cross-team frontend contract track sifatida qoldirilgan).
