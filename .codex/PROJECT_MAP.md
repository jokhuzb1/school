docs/ - reference docs for planning, monitoring, and standardization notes for the attendance/monitoring platform.
frontend/ - Vite + React SPA (entrypoint `frontend/src/main.tsx`) with Ant Design UI, services, pages, and shared hooks for interacting with the Fastify API.
frontend/src/assets, context, entities, hooks, pages, services, shared, and types/ describe how UI data is structured and fetched.
frontend/src/App.tsx - orchestrates routing, layouts, and the MediaMTX-related dialogs described in the README.
server.ts - Fastify bootstrap that wires Prisma, JWT auth, webhook routes, cron jobs, SSE, MediaMTX runner, and all src/routes/* modules.
src/ - backend implementation (config, prisma client, routes, services, modules, cron jobs, realtime snapshot scheduler, and utilities) powering the API surface.
src/routes/ - each folder (auth, schools, cameras, etc.) registers Fastify routes; tagged services and modules drive camera sync, attendance, dashboards, and webhook handling.
src/modules/ & src/services/ - reusable business logic (camera, NVR, metrics, etc.) consumed by routes and jobs.
prisma/ - schema, seed script, and migration history for the Postgres/Prisma data layer.
scripts/ - command-line helpers (setup-mediamtx, Excel helpers, id fixes) used during onboarding or maintenance.
tools/mediamtx/ - MediaMTX YAML config and Windows batch helpers for starting/stopping the relay per README guidance.
student-register/ - standalone fullstack helper app (server + web) for enrolling students to Hikvision devices on the LAN.
apps/student-registrator/ - Tauri + Vite desktop app for student registration; `src-tauri/` contains the native shell and `package.json` exposes `build:desktop:*` installer scripts.
.env & .env.example - backend runtime secrets (JWT, CORS, SSE token TTL, Redis URL, MediaMTX flags) plus stored webhook credentials.
frontend/.env - UI feature flags (base URLs, API host) referenced by Vite.
README.md & realtime_school_monitoring_saas.md - product overview, setup steps, and integration notes (webhooks, NVR sync, MediaMTX deployment).
