# Apps Separation Map

## Target Layout

| Current | Target | Status |
|---|---|---|
| `frontend/**` | `apps/frontend/**` | DONE (legacy root removed) |
| `server.ts` | `apps/backend/server.ts` | DONE (legacy root removed) |
| `src/**` | `apps/backend/src/**` | DONE (legacy root removed) |
| `prisma/**` | `apps/backend/prisma/**` | DONE (legacy root removed) |
| `scripts/**` (backend scripts) | `apps/backend/scripts/**` | DONE (legacy root removed) |
| Root backend util skriptlar (`fix-*`, `update-*`, `check_schools.ts`, `seed-today.ts`, `test-camera-stream.ts`, `get_secrets.ts`) | `apps/backend/*.ts` | DONE (legacy root removed) |
| `vitest.config.ts` (backend test config) | `apps/backend/vitest.config.ts` | DONE (legacy root removed) |
| `Dockerfile` | `apps/backend/Dockerfile` | DONE (root `Dockerfile` removed, canonical inside app) |
| `docker-compose.yml` | root orchestration, backend build -> `apps/backend/Dockerfile` | DONE (updated) |
| Root temp/build artifactlari (`.tmp`, `.cargo-target-sr`, `target_verify_*`, `image-for-face-id`, `tmp_rovodev_*`, root `dist`) | removed | DONE (dependency audit bilan tozalangan) |
| Root `package.json` + `package-lock.json` | removed (fully app-local package management) | DONE |

## Runtime Path Sensitive Areas

| File | Current Assumption | Migration Risk |
|---|---|---|
| `apps/backend/src/modules/attendance/interfaces/http/webhook.routes.ts` | helper (`getUploadsDir`) | mitigated |
| `apps/backend/src/modules/students/interfaces/http/students.routes.helpers.ts` | helper (`getUploadsDir`) | mitigated |
| `apps/backend/src/modules/cameras/services/mediamtx-runner.service.ts` | helper (`getToolsDir`) | mitigated |
| `apps/backend/scripts/setup-mediamtx.ts` | helper (`getToolsDir`) | mitigated |
| `apps/backend/src/prisma.ts` | helper (`getEnvFilePath`) | mitigated |
| `apps/backend/server.ts` | helper (`getUploadsDir`) | mitigated |

## Remaining Gap

- Docker runtime verify (`docker build`, `docker compose up`) local envda `docker` yo'qligi sabab pending.

## Cross-Agent Safety

- `apps/student-registrator/**`ga tegilmaydi.
- Frontend business logic/UXga tegilmaydi; faqat location/wiring.
- Backend API behavior o'zgarmaydi; move-only.
