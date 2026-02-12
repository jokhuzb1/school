# Backend DDD Map

## Ownership (Bounded Context)

| Context | Domain ownership | Hozirgi holat |
|---|---|---|
| `attendance` | attendance status rules, dashboard stats, webhook ingest | PARTIAL DDD (`application` + `infrastructure` stats qismi mavjud) |
| `students` | profile, import/provisioning/device sync | PARTIAL (yirik route split qilingan, lekin Prisma hali interfaces'da ko'p) |
| `cameras` | NVR/camera/onvif/stream operations | PARTIAL (split qilingan, lekin use-case/infra to'liq emas) |
| `schools` | school settings + webhook secret | PARTIAL |
| `users` | account + teacher-class assignment | PARTIAL |
| `classes` | class schedule and scope | PARTIAL |
| `devices` | terminal CRUD + status helpers | PARTIAL |
| `auth` | login/session token | PARTIAL |
| `holidays` | holiday CRUD | PARTIAL |
| `search` | cross-context read-model search | PARTIAL |
| `sse` | realtime delivery endpoints | PARTIAL |

## Old -> New Mapping (asosiy)

| Old path | New path | Status |
|---|---|---|
| `server.ts` heavy bootstrap | `src/app/server/create-server.ts` + `src/app/server/start-server.ts` + `server.ts` thin entry | DONE |
| `src/modules/*/presentation/*.routes.ts` | `src/modules/*/interfaces/http/*.routes.ts` (presentation wrapper saqlangan) | DONE |
| `src/modules/attendance/application/attendanceStats.ts` monolith | `src/modules/attendance/application/attendance-stats/*` + infra repo | DONE |
| `src/modules/attendance/interfaces/http/dashboard-school.routes.ts` monolith | `dashboard-school.routes.ts` + `dashboard-school.handler.ts` + `dashboard-school.response.ts` | DONE |
| `src/modules/students/interfaces/http/students-device-import-commit.routes.ts` monolith | `students-device-import-commit.routes.ts` + `students-device-import-commit.handler.ts` + `students-device-import-commit.rows.ts` | DONE |

## Gap Map (Strict DDD uchun)

| Current path (muammo) | Target path (yakuniy) |
|---|---|
| `src/modules/auth/interfaces/http/auth.routes.ts` bevosita Prisma | `src/modules/auth/application/*` + `src/modules/auth/infrastructure/*` |
| `src/modules/classes/interfaces/http/classes.routes.ts` bevosita Prisma + business orchestration | `src/modules/classes/application/*` + `src/modules/classes/infrastructure/*` |
| `src/modules/devices/interfaces/http/devices.routes.ts` bevosita Prisma | `src/modules/devices/application/*` + `src/modules/devices/infrastructure/*` |
| `src/modules/holidays/interfaces/http/holidays.routes.ts` bevosita Prisma | `src/modules/holidays/application/*` + `src/modules/holidays/infrastructure/*` |
| `src/modules/schools/interfaces/http/*.routes.ts` bevosita Prisma | `src/modules/schools/application/*` + `src/modules/schools/infrastructure/*` |
| `src/modules/search/interfaces/http/search.routes.ts` bevosita Prisma | `src/modules/search/application/*` + `src/modules/search/infrastructure/*` |
| `src/modules/sse/interfaces/http/*.routes.ts` bevosita Prisma read model | `src/modules/sse/application/*` + `src/modules/sse/infrastructure/*` |
| `src/modules/students/interfaces/http/*`da transaction/import/provision orchestration | `src/modules/students/application/*` + `src/modules/students/infrastructure/*` |
| `src/modules/users/interfaces/http/*.routes.ts` bevosita Prisma | `src/modules/users/application/*` + `src/modules/users/infrastructure/*` |
| `src/modules/cameras/interfaces/http/*.routes.ts` bevosita Prisma + external ops orchestration | `src/modules/cameras/application/*` + `src/modules/cameras/infrastructure/*` |
