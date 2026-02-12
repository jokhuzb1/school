# Backend DDD Map

## Bounded Contexts

| Context | Ownership | Why |
|---|---|---|
| `auth` | Login/session/JWT token issuance | Security boundary va identity lifecycle shu yerda |
| `schools` | School settings + webhook secret management | Tenant-level konfiguratsiya markazi |
| `classes` | Class schedule va class-level scoping | Attendance va teacher scope uchun asosiy aggregate |
| `students` | Student profile, import/provisioning/device sync | Eng katta business oqim va external integratsiya shu yerda |
| `attendance` | Attendance status rules, dashboard stats, webhook ingest | Core domain logic shu kontekstda |
| `devices` | Device CRUD + operation metrics | Face terminal lifecycle mustaqil |
| `cameras` | NVR/camera/onvif/stream config | Video infra bounded context |
| `users` | School staff + teacher-class assignment | Authorization model bilan bevosita bog'liq |
| `sse` | Real-time stream endpoints | Delivery interface, domain emas |
| `search` | Unified search read-model | Cross-context query interface |

## Old -> New Path Mapping (Incremental)

| Old Path | New Path | Status |
|---|---|---|
| `server.ts` | `src/app/**` composition root + `server.ts` bootstrap wrapper | DONE |
| `src/modules/*/presentation/*.routes.ts` | `src/modules/*/interfaces/http/*.routes.ts` | DONE |
| `src/routes/*.ts` | (unchanged externally) thin re-export wrappers | KEEP_COMPAT |
| `src/config.ts` | `src/shared/config/*` + compatibility export | PLANNED |
| `src/prisma.ts` | `src/infrastructure/db/prisma/*` + compatibility export | PLANNED |
| `src/eventEmitter.ts` | `src/infrastructure/events/*` + compatibility export | PLANNED |
| `src/utils/*` | `src/shared/lib/*` (incremental) + compatibility export | PLANNED |

### Implemented Module Moves (Current)

| Old Path | New Path | Status |
|---|---|---|
| `src/modules/attendance/presentation/attendance.routes.ts` | `src/modules/attendance/interfaces/http/attendance.routes.ts` (+ split registrators) | DONE |
| `src/modules/attendance/presentation/dashboard.routes.ts` | `src/modules/attendance/interfaces/http/dashboard.routes.ts` (+ admin/school/events split) | DONE |
| `src/modules/attendance/presentation/webhook.routes.ts` | `src/modules/attendance/interfaces/http/webhook.routes.ts` (+ prepare/handler split) | DONE |
| `src/modules/schools/presentation/schools.routes.ts` | `src/modules/schools/interfaces/http/schools.routes.ts` (+ split registrators) | DONE |
| `src/modules/users/presentation/users.routes.ts` | `src/modules/users/interfaces/http/users.routes.ts` (+ split registrators) | DONE |
| `src/modules/sse/presentation/sse.routes.ts` | `src/modules/sse/interfaces/http/sse.routes.ts` (+ split registrators) | DONE |
| `src/modules/cameras/presentation/cameras.routes.ts` | `src/modules/cameras/interfaces/http/cameras.routes.ts` (+ split registrators) | DONE |
| `src/modules/students/presentation/students.routes.ts` | `src/modules/students/interfaces/http/students.routes.ts` (+ import/provision split) | DONE |
| `src/modules/auth/presentation/auth.routes.ts` | `src/modules/auth/interfaces/http/auth.routes.ts` | DONE |
| `src/modules/classes/presentation/classes.routes.ts` | `src/modules/classes/interfaces/http/classes.routes.ts` | DONE |
| `src/modules/devices/presentation/devices.routes.ts` | `src/modules/devices/interfaces/http/devices.routes.ts` | DONE |
| `src/modules/holidays/presentation/holidays.routes.ts` | `src/modules/holidays/interfaces/http/holidays.routes.ts` | DONE |
| `src/modules/search/presentation/search.routes.ts` | `src/modules/search/interfaces/http/search.routes.ts` | DONE |

## Layer Ownership Target

- `src/app`
  - Fastify instance setup, plugins/hooks/decorators registration, route wiring, startup/shutdown.
- `src/modules/<context>/interfaces/http`
  - Route/controller registration, transport-level mapping, HTTP error mapping.
- `src/modules/<context>/application`
  - Use-case orchestration, workflow coordination, transaction boundaries.
- `src/modules/<context>/domain`
  - Business rules, invariants, domain services/value logic.
- `src/modules/<context>/infrastructure`
  - Prisma/DB adapters, external service clients, OS/network adapters.
- `src/shared`
  - Cross-cutting helpers, base errors, shared types/constants.

## Line-Limit Gate

- `src/**` ichida `>300` qatorli fayl qolmadi.
- Eng yirik backend route fayllari endpoint-guruhlarga va helper/service fayllarga bo'lindi.

## Boundary Rules

- Domain qatlami `interfaces` va `infrastructure`dan import qilmaydi.
- Interfaces qatlami to'g'ridan-to'g'ri DB driverga bog'lanmasligi kerak (incremental kamaytiriladi).
- Infrastructure qatlami ports/adaptersni implement qiladi.
- Backward-compat uchun migration davrida wrapper-exportlarga ruxsat beriladi.
