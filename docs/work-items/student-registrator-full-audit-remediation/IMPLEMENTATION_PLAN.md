# IMPLEMENTATION PLAN - Student Registrator Full Audit Remediation

## Objective
Student Registrator desktop loyihasini production-grade standartga olib chiqish: reliability, maintainability, security va UX quality bo'yicha audit topilmalarini bosqichma-bosqich yopish.

## Problem Summary (Current State)
1. Frontend/Tauri qatlamida yirik monolit fayllar mavjud (`api.ts`, `commands.rs`, yirik page/hooklar).
2. Lint va clippy gate to'liq yashil emas.
3. Bir nechta kritik sifat muammolari mavjud: panic risklari, CSS corruption, invalid DOM structure.
4. `catch {}` va noaniq error handling tufayli troubleshooting qiyin.
5. UX/a11y consistency to'liq emas (alert/confirm, modal focus, aria coverage).
6. Performance warninglar mavjud (exceljs chunking, bundle size).

## Target State
1. Har katta flow kichik, mas'uliyati aniq modullarga bo'lingan (SRP).
2. Frontend + Tauri quality gates to'liq yashil.
3. Security-sensitive data handling qat'iy va hujjatlashtirilgan.
4. UX/a11y standartlari (keyboard, aria, modal behavior) bir xil qo'llangan.
5. Dublikat/ortiqcha kodlar tozalangan, shared util/service layer mustahkam.
6. Rollout, rollback va incident operatsiyasi uchun hujjatlar yakunlangan.

## Constraints
1. Mavjud product behavior buzilmasligi kerak.
2. Incremental rollout talab qilinadi (big-bang refactor yo'q).
3. Desktop (Tauri) va React o'rtasidagi contract backward-compatible bo'lishi kerak.

## Guiding Principles
1. DRY: takrorlanayotgan logic bitta manbaga ko'chadi.
2. KISS: murakkab alternativ oqimlar kamaytiriladi.
3. SOLID:
- SRP: page orchestration, business logic service/use-case.
- OCP: yangi policy qo'shishda core minimal o'zgaradi.
- ISP: komponent propslari kichik va aniq.
- DIP: sahifalar concrete implementation emas, abstractionga tayanadi.
4. Security-first: secret/token/credential handling doimo masklanadi yoki himoyalanadi.

## Work Breakdown Structure

### Phase 0 - Baseline and Safety Net (0.5-1 kun)
Tasks:
1. Baseline commandlar: `npm run typecheck`, `npm run lint`, `npm run build`, `cargo check`, `cargo clippy -- -D warnings`.
2. Critical flow smoke checklist tayyorlash.
3. Regression capture (before-state metrics) yaratish.

Deliverables:
1. Baseline hisobot.
2. Critical flow checklist.

Exit Criteria:
1. Hozirgi holat to'liq dokumentatsiya qilingan.

---

### Phase 1 - P0 Stabilization (1-2 kun)
Tasks:
1. ESLint ignore scope fix (`src-tauri/target/**`, generated assets).
2. Rust panic nuqtalarini (`expect/unwrap`) safe handlingga o'tkazish.
3. Invalid table/modal DOM tuzatish.
4. `src/index.css` corruption va duplicate bloklarni tozalash.
5. Encoding/mojibake xatolarini tozalash.

Deliverables:
1. Green lint parse scope.
2. Panic-free critical paths.
3. Valid DOM/CSS structure.

Exit Criteria:
1. P0 blockerlar yopilgan.

---

### Phase 2 - Security Hardening (1-2 kun)
Tasks:
1. Auth token storage risk tahlili va xavfsizroq strategy tanlash.
2. Local credentials (`devices.json`) at-rest himoya strategiyasi.
3. Centralized redaction util (logs/errors/payloads).
4. Secret leakage regression testlar.

Deliverables:
1. Security design note.
2. Redaction layer.
3. Updated security checklist.

Exit Criteria:
1. Sensitive data exposure yo'li test bilan yopilgan.

---

### Phase 3 - Error Handling and Type Safety (1-2 kun)
Tasks:
1. `catch {}` va generic catch bloklarini typed fallbackga o'tkazish.
2. Frontend/Tauri error code taxonomy joriy qilish.
3. `any` va unsafe castlarni olib tashlash.
4. Clippy warninglarini to'liq yopish.

Deliverables:
1. Typed error model.
2. Clippy clean Rust layer.

Exit Criteria:
1. Error handling predictable va observability-friendly.

---

### Phase 4 - Architecture Refactor (2-4 kun)
Tasks:
1. `api.ts` ni domain modullarga bo'lish.
2. `commands.rs` ni command handlers + domain servicesga ajratish.
3. Katta page/hooklarni decomposition qilish.
4. Contract boundarylarni typed interfaces bilan mustahkamlash.

Deliverables:
1. Modular frontend API layer.
2. Modularized Tauri command architecture.
3. Reduced page complexity.

Exit Criteria:
1. Katta fayllar bo'yicha complexity pasaygan.

---

### Phase 5 - DRY/KISS Consolidation (1-2 kun)
Tasks:
1. Name split/gender normalize/image pipeline dublikatlarini birlashtirish.
2. Import workflowsni shared canonical flowga yakuniy ulash.
3. Dead code va duplicate helpers cleanup.

Deliverables:
1. Shared utility/service katalogi.
2. Duplicate logic removal report.

Exit Criteria:
1. Takroriy business logic minimal holatga tushgan.

---

### Phase 6 - UX and Accessibility Hardening (1-2 kun)
Tasks:
1. `alert/confirm` -> app modal/dialog pattern.
2. Icon-only buttonlarda `aria-label` coverage.
3. Modal focus trap, ESC close, tab-cycle.
4. Toast `aria-live` va semantic role.
5. Form validation UX standardization.

Deliverables:
1. A11y compliance checklist (desktop scope).
2. UX consistency updates.

Exit Criteria:
1. Keyboard-only navigation critical flowlarda ishlaydi.

---

### Phase 7 - Performance and Bundle Optimization (1 kun)
Tasks:
1. `exceljs` import strategiyasini standartlash.
2. Large table render/sort complexity optimizatsiyasi.
3. Image processing va import concurrency tuning.
4. Bundle budget threshold qo'yish.

Deliverables:
1. Build performance report.
2. Bundle warning reduction.

Exit Criteria:
1. No avoidable high-severity performance warning.

---

### Phase 8 - Verification and Release Readiness (1-2 kun)
Tasks:
1. Unit + integration + smoke testlarni to'ldirish.
2. CI quality gate yakunlash.
3. Docs update: architecture, runbook, rollback, release notes.
4. Pilot rollout checklist.

Deliverables:
1. Green pipeline.
2. Signed-off docs pack.

Exit Criteria:
1. Release candidate tayyor.

## Dependency and Execution Order
1. Phase 0 -> barcha keyingi fazalar uchun shart.
2. Phase 1 -> Phase 4 va 6 ga kirishdan oldin.
3. Phase 2 va Phase 3 parallel boshlanishi mumkin (separate owners bilan).
4. Phase 4 tugamasdan Phase 5 boshlanmaydi.
5. Phase 6/7 Phase 4-5 bilan qisman parallel bo'lishi mumkin, lekin final merge oldidan retest talab qilinadi.
6. Phase 8 hamma phase yakunida.

## Owner Model (Suggested)
1. Frontend Lead: Phase 1 (frontend qismi), 4 (frontend), 5, 6, 7.
2. Tauri/Rust Lead: Phase 1 (rust qismi), 3 (rust), 4 (rust).
3. Security Reviewer: Phase 2 sign-off.
4. QA Lead: Phase 0 baseline, Phase 8 verification.

## Milestones
1. M1: Stabilization complete (Phase 1) - P0 blockerlar yopilgan.
2. M2: Secure and typed core (Phase 2+3) - critical risklar kamaygan.
3. M3: Modular architecture complete (Phase 4+5).
4. M4: UX/performance hardening (Phase 6+7).
5. M5: Release ready (Phase 8).

## Validation Matrix
1. Static quality:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `cargo check`
- `cargo clippy -- -D warnings`

2. Functional:
- Device CRUD
- Register single/bulk
- Device mode import
- Student edit + sync
- Clone DB->Device va Device->Device
- Audit logs page filters/actions

3. Reliability:
- Tarmoq xatolari
- Offline/expired credentials
- Invalid payload handling
- Rollback scenarios

4. Security:
- Secret redaction
- Credential/token leakage checks

## Risk Matrix
1. Hidden coupling refactor paytida regressiya keltirishi mumkin.
Mitigation: incremental PR + per-phase smoke checks.

2. Contract drift (frontend <-> tauri).
Mitigation: typed interfaces + integration tests.

3. Security hardening UX'ni yomonlashtirishi mumkin.
Mitigation: security review + UX review parallel.

4. Performance tuning behavior driftga olib kelishi mumkin.
Mitigation: benchmark before/after + targeted tests.

## Rollout Strategy
1. Internal QA build.
2. Pilot school rollout (limited user set).
3. Production rollout with monitoring:
- error rate
- import success rate
- sync failure rate
- critical action latency

## Rollback Strategy
1. Oxirgi barqaror desktop releasega rollback.
2. Risky change setni feature-flag/config toggle bilan o'chirish.
3. Incident runbook bo'yicha rollback verification.
4. Post-rollback root-cause va patch plan.

## Acceptance Criteria
1. P0/P1 audit topilmalari yopilgan.
2. Lint/type/build/rust gate to'liq yashil.
3. Critical flowsda blocker regressiya yo'q.
4. Security checklist bo'yicha sign-off olingan.
5. UX/a11y checklist bo'yicha sign-off olingan.
6. Documentation va rollout artifacts to'liq.

## Deliverables
1. `TASK.md` bo'yicha yakunlangan backlog.
2. Refactored frontend/tauri codebase.
3. Test suite va CI gate updates.
4. Security + QA sign-off pack.
5. Release notes + rollback paket.

## Progress Update (2026-02-11)
1. Phase 0 completed:
- Baseline gates successfully re-run (`lint`, `typecheck`, `build`, `cargo check`, `cargo clippy`).
- Smoke checklist va risk register yaratildi.

2. Phase 1 completed (major items):
- ESLint scope fix (`src-tauri/target/**` ignore).
- CSS corruption va duplicate blocks tozalandi.
- Mojibake issue tozalandi (Excel parse filter line).

3. Phase 3 partially completed:
- Frontend `any`/unsafe casts cleaned.
- Rust clippy warnings fully closed.

4. Phase 6 partially completed:
- `alert/confirm` -> app toast/modal flow.
- Modal accessibility hook (`ESC` + tab trap) bir nechta modalga qo'llandi.
- Toast semantics (`aria-live`, `role`) qo'shildi.

5. Phase 7 completed (targeted):
- `exceljs` lazy chunk strategy standardlashtirildi.
- Vite bundle warning policy qo'shildi (`manualChunks`, `chunkSizeWarningLimit`).

6. Phase 2/5/8/9 progress (incremental):
- Auth token saqlash memory + `sessionStorage` strategiyasiga o'tkazildi (legacy localStorage migration bilan).
- `catch {}` bloklari typed `catch (error: unknown)` ko'rinishiga to'liq o'tkazildi.
- Device status derivation shared helperga standartlashtirildi (`utils/deviceStatus.ts`).
- Unit tests kengaytirildi (`deviceResolver`, import dedupe/metrics, status helpers).
- Operations docs pack qo'shildi (`ARCHITECTURE`, `INCIDENT_RUNBOOK`, `ROLLBACK_PLAYBOOK`, `RELEASE_NOTES`, `PILOT_ROLLOUT_CHECKLIST`, `SECURITY_CHECKLIST`, `SECURITY_SIGNOFF`).

7. Final completion tranche:
- Domain adapter layer added for frontend API boundaries (`src/api/{auth,devices,students,provisioning,images}.ts` + barrel).
- Tauri command helper services extracted to `src-tauri/src/command_services.rs` (command/domain separation start completed in production paths).
- Shared person/image/error utilities consolidated to reduce duplication and standardize user-safe messaging.
- Table rendering optimized (row index map memoization) and debug `console` usage centralized to logger.
- Rust unit tests added for webhook normalization helpers; frontend unit suite re-verified.
