# FSD Implementation Plan

## Principles
- Zero behavior change: UI, route, API contract, state behavior o'zgarmaydi.
- Refactor only: move/split/rename/export boundary.
- Har bosqichdan keyin verification: `npm run typecheck` + `npm run build` (`apps/frontend/`).

## Phase 0 - Audit va baseline (DONE)
- Scope: joriy frontend struktura, 300+ fayllar, import yo'nalishlari.
- Expected changes: kod o'zgarishi yo'q, faqat hujjatlashtirish.
- Rollback: kerak emas.
- Verification:
  - `npm run typecheck`
  - `npm run build`

## Phase 1 - FSD skeleton + import boundary (DONE)
- Scope:
  - `src/app`, `src/processes`, `src/pages`, `src/widgets`, `src/features`, `src/entities`, `src/shared` qatlamlarini standartlashtirish.
  - Path alias sozlash.
  - ESLint import-boundary qoidalarini qo'shish.
- Expected changes (move/refactor only):
  - App router/providers entry qatlamini ajratish.
  - Public API (`index.ts`) nuqtalarini ochish.
- Rollback strategy:
  - Alias va lint qoidalarini alohida commitda saqlash, muammo bo'lsa o'sha commitni revert qilish.
- Verification:
  - `npm run typecheck`
  - `npm run build`

## Phase 2 - Shared layer migration (DONE)
- Scope:
  - Umumiy util/config/constants/types/ui elementlarni `shared`ga ko'chirish.
  - API client bazasini `shared/api`ga yig'ish.
- Expected changes (move/refactor only):
  - Import yo'llarni yangilash.
  - Barrel exportlar.
- Rollback strategy:
  - Shared bo'limlar bo'yicha incremental commitlar.
- Verification:
  - `npm run typecheck`
  - `npm run build`

### Phase 2 progress
- DONE:
  - `apps/frontend/src/config.ts` -> `apps/frontend/src/shared/config/index.ts` (keyin Phase 6 da root wrapper olib tashlandi).
  - `apps/frontend/src/services/api.ts` -> `apps/frontend/src/shared/api/client.ts` (wrapper saqlangan).
  - `apps/frontend/src/services/sse.ts` -> `apps/frontend/src/shared/api/sse.ts` (wrapper saqlangan).
  - `apps/frontend/src/services/search.ts` -> `apps/frontend/src/shared/api/search.ts` (wrapper saqlangan).
  - `apps/frontend/src/types/index.ts` 300+ split -> `apps/frontend/src/shared/types/{core,attendance,api,index}.ts` (keyin Phase 6 da root wrapper olib tashlandi).
  - `apps/frontend/src/mock/services.ts` va `apps/frontend/src/mock/data.ts` bo'lindi:
    - `apps/frontend/src/mock/services/{auth-schools-classes,students-devices,analytics-misc}.ts`
    - `apps/frontend/src/mock/generators.ts`
    - `apps/frontend/src/mock/services.ts` barrel saqlandi.
  - `apps/frontend/src/shared/ui/useLayoutSearch.tsx` -> `@shared/api/search`ga ulandi.

## Phase 3 - Entities migration (DONE)
- Scope:
  - Domen bo'yicha `entities/*/{model,api,ui,index.ts}`.
- Expected changes (move/refactor only):
  - Entity API va model/type ajratish.
- Rollback strategy:
  - Har entity alohida commit.
- Verification:
  - `npm run typecheck`
  - `npm run build`

### Phase 3 progress
- `entities/auth` qo'shildi: `api/auth.service.ts`, `model/{AuthContext,useAuth}.ts`, public API.
- `entities/school` kengaytirildi: `api/school.service.ts`, `model/useSchool.ts`, public API.
- `entities/class`, `entities/student`, `entities/user`, `entities/device`, `entities/holiday` API slice'lari yaratildi.
- `entities/attendance`ga `api/attendance.service.ts` qo'shildi.
- `entities/camera/api/index.ts` `@shared/api` va `@shared/types`ga moslashtirildi.
- `services/*` fayllari wrapper holatiga o'tkazildi (`@entities/*` yoki `@features/*`ga delegatsiya).

## Phase 4 - Features/Widgets migration (DONE)
- Scope:
  - Page ichidagi user-action logikalarni `features`ga.
  - Yirik qayta ishlatiladigan UI bloklarni `widgets`ga.
- Expected changes (move/refactor only):
  - Page fayllari soddalashadi, behavior saqlanadi.
- Rollback strategy:
  - Har page extraction alohida commit.
- Verification:
  - `npm run typecheck`
  - `npm run build`

### Phase 4 progress
- `features/realtime` yaratildi: `useAttendanceSSE`, `useSchoolSnapshotSSE`, `useClassSnapshotSSE`, `useAdminSSE`.
- `features/dashboard` yaratildi: `api/dashboard.service.ts`.
- `widgets/layout/ui/Layout.tsx`ga real implementatsiya ko'chirildi.
- `app/router/ProtectedRoute.tsx` app qatlamiga ko'chirildi.
- `shared/ui` ichidan yuqori qatlamga bog'liq eski implementatsiyalar chiqarildi.

## Phase 5 - Pages migration + 300-line enforcement (DONE)
- Scope:
  - Har route-level page uchun page slice (`pages/<name>/ui/...`, `model/...`, `index.ts`).
  - 300+ fayllarni submodule'ga bo'lish.
- Expected changes (move/refactor only):
  - UI va logic o'zgarmagan holda fayl bo'linishi.
- Rollback strategy:
  - Har katta fayl uchun alohida commit va revert imkoniyati.
- Verification:
  - `npm run typecheck`
  - `npm run build`

### Phase 5 progress
- DONE (partial):
  - `apps/frontend/src/shared/ui/Layout.tsx` 464 -> 277 qatorga tushirildi.
  - Ajratilgan modullar:
    - `apps/frontend/src/shared/ui/LayoutSearch.tsx`
    - `apps/frontend/src/shared/ui/useLayoutSearch.tsx`
    - `apps/frontend/src/shared/ui/layout.constants.ts`
  - `apps/frontend/src/pages/Holidays.tsx` 315 -> 260 qatorga tushirildi (`apps/frontend/src/pages/holidaysColumns.tsx`ga ajratildi).
  - `apps/frontend/src/pages/Devices.tsx` 449 -> 188 qatorga tushirildi.
    - Ajratilgan modullar:
      - `apps/frontend/src/pages/devicesColumns.tsx`
      - `apps/frontend/src/pages/DeviceCopyField.tsx`
      - `apps/frontend/src/pages/DeviceFormModal.tsx`
      - `apps/frontend/src/pages/DeviceWebhookCard.tsx`
  - `apps/frontend/src/pages/Users.tsx` 435 -> 181 qatorga tushirildi.
    - Ajratilgan modullar:
      - `apps/frontend/src/pages/usersColumns.tsx`
      - `apps/frontend/src/pages/UserCreateModal.tsx`
      - `apps/frontend/src/pages/UserAssignClassesModal.tsx`
      - `apps/frontend/src/pages/UserEditModal.tsx`
  - `apps/frontend/src/pages/Schools.tsx` 504 -> 180 qatorga tushirildi.
    - Ajratilgan modullar:
      - `apps/frontend/src/pages/schoolsColumns.tsx`
      - `apps/frontend/src/pages/SchoolFormModal.tsx`
  - `apps/frontend/src/pages/Attendance.tsx` 520 -> 234 qatorga tushirildi.
    - Ajratilgan modullar:
      - `apps/frontend/src/pages/attendanceColumns.tsx`
      - `apps/frontend/src/pages/AttendanceFiltersBar.tsx`
      - `apps/frontend/src/pages/AttendanceExcuseModal.tsx`
  - `apps/frontend/src/pages/SuperAdminDashboard.tsx` 816 -> 205 qatorga tushirildi.
    - Ajratilgan modullar:
      - `apps/frontend/src/pages/SuperAdminDashboardView.tsx`
      - `apps/frontend/src/pages/superAdminColumns.tsx`
      - `apps/frontend/src/pages/superAdminTypes.ts`
  - `apps/frontend/src/pages/Students.tsx` 744 -> 299 qatorga tushirildi.
    - Ajratilgan modullar:
      - `apps/frontend/src/pages/studentsColumns.tsx`
      - `apps/frontend/src/pages/StudentFormModal.tsx`
      - `apps/frontend/src/pages/ImportErrorsModal.tsx`
      - `apps/frontend/src/pages/StudentImportControls.tsx`
      - `apps/frontend/src/pages/StudentsHeader.tsx`
  - `apps/frontend/src/pages/ClassDetail.tsx` split va tip regressiyasi tuzatildi (`ClassDetailContent`, `ClassDetailEditModal`).
  - `apps/frontend/src/pages/Students.tsx` qo'shimcha bo'linib 266 qatorga tushirildi (`studentsFileActions.ts`).
  - `apps/frontend/src/pages/Dashboard.tsx` 1076 -> 123 qatorga tushirildi (state-hook + section komponentlar).
  - `apps/frontend/src/pages/StudentDetail.tsx` 955 -> 163 qatorga tushirildi (header/filter/top-row/weekly/table/modal modullarga ajratildi).
  - `apps/frontend/src/pages/Cameras.tsx` 1760 -> 282 qatorga tushirildi (CRUD/ops hooklari, tabs/preview/drawers/modals bo'linishi).
- Current status:
  - `apps/frontend/src` ichida 300+ qatorli `.ts/.tsx` fayl qolmadi (tekshirildi).
  - Hujjatlar markazlashuvi: `work-item/fsd-migration/` ichida yuritilmoqda.

## Phase 6 - Final cleanup (DONE)
- Scope:
  - Dead code, unused export/import, circular dependency tozalash.
  - Import boundary buzilishlarini yakuniy tekshirish.
- Expected changes (move/refactor only):
  - Faqat strukturaviy tozalash.
- Rollback strategy:
  - Cleanup commit alohida.
- Verification:
  - `npm run typecheck`
  - `npm run build`

### Phase 6 progress
- `hooks/*`, `context/*`, `services/*` legacy import yo'llari wrapperlar orqali saqlandi.
- Boundary tozalash:
  - `shared` -> `entities` bog'liqligi olib tashlandi (`Layout` va `ProtectedRoute` shared'dan chiqarildi).
- Lint tekshiruvida `no-restricted-imports` errorlari tozalandi.
- Yakuniy tozalashda `apps/frontend/src/{hooks,services,context}` papkalari `work-item/fsd-migration/legacy-src/`ga ko'chirildi.
- Import normalizatsiya:
  - `../types`, `../../types`, `../../../types` importlari `@shared/types`ga o'tkazildi.
  - `../config` importlari `@shared/config`ga o'tkazildi.
  - `apps/frontend/src/config.ts`, `apps/frontend/src/types/index.ts`, `apps/frontend/src/App.css` olib tashlandi.
  - Bo'sh `apps/frontend/src/components` va `apps/frontend/src/types` papkalari olib tashlandi.

## Phase 7 - Documentation finalization (DONE)
- Scope:
  - `tasks.md`, `implementation-plan.md`, `fsd-map.md`ni yakuniy holatga keltirish.
- Expected changes: hujjatlar to'liq va izchil.
- Rollback strategy: hujjat commitini revert qilish.
- Verification:
  - Hujjatlar va verification loglar to'liq.
- Progress:
  - Rootdagi `work-item/{tasks.md,implementation-plan.md,architecture-map.md}` fayllari `work-item/fsd-migration/student-registrator/` papkasiga ko'chirildi.
  - Rootdagi `work-item/backend-ddd/*` fayllari `work-item/fsd-migration/backend-ddd/` papkasiga ko'chirildi.
  - FSD frontend hujjatlari `work-item/fsd-migration/`da saqlandi.
  - Cross-agent impact audit qo'shildi: `work-item/fsd-migration/cross-agent-impact-audit.md`.
  - Frontend API endpointlar va backend `interfaces/http` endpointlari prefix-aware solishtirildi.
  - Yangi regressiya topilmadi; `DELETE /schools/:id` pre-existing gap ekanligi (`HEAD~1` bilan) tasdiqlandi.
  - Apps-separation bo'yicha backend agentning so'nggi `unstaged` diffi qayta audit qilindi (`README.md`, `apps/backend/src/{config.ts,app/runtime/paths.ts}`) va frontendga ta'sir yo'qligi tasdiqlandi.

## Latest Verification
- `npm run typecheck` (`apps/frontend/`) - PASS
- `npm run build` (`apps/frontend/`) - PASS
- `npm run lint` (`apps/frontend/`) - PASS (warnings only)
- `300-line scan` (`apps/frontend/src/**/*.ts(x)`) - PASS
- `npm run typecheck` (backend root) - PASS
- `npm run build` (backend root) - PASS
- `npm run lint` (backend root) - PASS
- `npm test` (backend root) - PASS
- `apps/frontend` relocation re-check (`typecheck/build/lint/300-line scan`) - PASS
- `backend unstaged re-audit` (`apps/frontend` typecheck/build/300-line scan) - PASS
- `backend unstaged re-audit` (`apps/backend` typecheck/build) - PASS
- `post-lint-warning-cleanup` (`apps/frontend` lint/typecheck/build) - PASS (`lint`: 0 warning)
- Eslatma: Vite chunk-size warning saqlanib qolgan, lekin build muvaffaqiyatli yakunlangan.
