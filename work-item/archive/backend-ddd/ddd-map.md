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
