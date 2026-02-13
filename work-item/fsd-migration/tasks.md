# FSD Migration Tasks

## Meta
- Scope: `apps/frontend/` to'liq FSD migratsiya (behavior o'zgarmaydi)
- Branch: `refactor/fsd-migration`
- Rule: Har bosqichdan keyin `npm run typecheck` va `npm run build` (`apps/frontend/` ichida)

## Phase Status

| Phase | Goal | Status | Risks | Done Criteria |
|---|---|---|---|---|
| 0 | Audit va inventory + baseline check | DONE | Noto'g'ri baseline bo'lsa keyingi regressiya aniqlanmaydi | Frontend struktura, 300+ fayllar, baseline typecheck/build qayd etilgan |
| 1 | FSD skelet + alias + boundary qoidalari | DONE | Import yo'llari sinishi | `app/processes/pages/widgets/features/entities/shared` skeleti, path alias, lint boundary qoidasi ishlashi |
| 2 | Shared qatlam migratsiyasi | DONE | Keng import update xatolari | `shared` ichida ui/lib/constants/config/types/api bazasi va index public API |
| 3 | Entities qatlam migratsiyasi | DONE | Entity API importlari uzilishi | entity bo'yicha `model/api/ui/index.ts` public API ishlashi |
| 4 | Features + Widgets migratsiyasi | DONE | Cross-slice coupling | feature/widget public API va qatlam yo'nalishlari saqlangan |
| 5 | Pages migratsiyasi + 300-line split | DONE | Eng katta regressiya riski | Har page slice public API bilan, barcha fayl <=300 qator |
| 6 | App yakuniy integratsiya + cleanup | DONE | Route/provider regressiyasi | Router/provider/app init toza FSD holatida, dead code tozalangan |
| 7 | Final verification + mapping docs | DONE | Qoldiq circular dependency | Yakuniy typecheck/build pass, fsd-map to'liq |

## Task Checklist

- [x] T0.1 Audit: frontend joriy struktura va import yo'nalishlarini inventarizatsiya qilish.
  - Goal: amaldagi bog'liqlik va 300+ fayllarni aniqlash.
  - Files: `apps/frontend/src/**`
  - Risks: noto'liq inventarizatsiya keyingi bosqichga ta'sir qiladi.
  - Done: 300+ qatorli fayllar ro'yxati olindi.

- [x] T0.2 Baseline verification.
  - Goal: refaktor oldidan sog'lom holatni qayd etish.
  - Files: `apps/frontend/package.json`, build output
  - Risks: yo'q.
  - Done: typecheck/build PASS log mavjud.

- [x] T1.1 FSD skelet kataloglarini yaratish (`app/processes/pages/widgets/features/entities/shared`).
  - Goal: qatlamli asos yaratish.
  - Files: `apps/frontend/src/**`
  - Risks: noto'g'ri joylashtirish.
  - Done: har qatlamda bazaviy `index.ts` va kerakli quyi papkalar mavjud.

- [x] T1.2 Path alias va boundary qoidalarini sozlash.
  - Goal: importlarni qatlamlar bo'yicha boshqarish.
  - Files: `apps/frontend/tsconfig.app.json`, `apps/frontend/vite.config.ts`, `apps/frontend/eslint.config.js`
  - Risks: compile/lint xatolari.
  - Done: alias orqali import ishlaydi, taqiqlangan importlar lintda ushlanadi.

- [x] T2.1 Shared modullarni ko'chirish (`ui`, `lib`, `constants`, `config`, `types`, `api-base`).
  - Goal: umumiy kodni markazlashtirish.
  - Files: `apps/frontend/src/shared/**`, eski `hooks/services/context/types` dan ko'chmalar
  - Risks: importlar buzilishi.
  - Done: `shared/api` (client+sse+search), `shared/config`, `shared/types`, `shared/ui` va wrapperlar bilan public API ishlaydi.

- [x] T2.2 Mock modulini bo'lish va 300-line qoidani bajarish.
  - Goal: `mock/services.ts` va `mock/data.ts` ni xavfsiz submodule'larga ajratish.
  - Files: `apps/frontend/src/mock/**`
  - Risks: mock endpoint contractlarining sinishi.
  - Done: mock bo'limi barrel export bilan ishlaydi, typecheck/build PASS.

- [x] T3.1 Entity bo'yicha model/api/ui ajratish.
  - Goal: domen qatlamini tozalash.
  - Files: `apps/frontend/src/entities/**`
  - Risks: entity va service o'rtasida kontrakt xatosi.
  - Done: `auth/school/class/student/user/device/holiday/attendance/camera` slice'larda `index.ts` public API ishlaydi.

- [x] T4.1 Feature slice'larni ajratish.
  - Goal: user action/business logic'ni page'dan chiqarish.
  - Files: `apps/frontend/src/features/**`
  - Risks: event handler regressiyasi.
  - Done: `features/realtime` (SSE hooklar), `features/dashboard` (dashboard API) public API orqali ishlaydi.

- [x] T4.2 Widget slice'larni ajratish (yirik UI bloklar).
  - Goal: page'larni soddalashtirish.
  - Files: `apps/frontend/src/widgets/**`
  - Risks: layout/render regressiyasi.
  - Done: `widgets/layout` ichiga asosiy Layout ko'chirildi, app router widget orqali ishlaydi.

- [x] T5.1 Barcha 300+ qatorli fayllarni <=300 ga tushirish.
  - Goal: majburiy line-limit bajarilishi.
  - Files: katta fayllar ro'yxati (pages/layout/mock/types)
  - Risks: eng yuqori regressiya riski.
  - Done: `apps/frontend/src` ichida 300+ qatorli `.ts/.tsx` fayl qolmadi.

- [x] T5.2 `shared/ui/Layout.tsx`ni 300-qator ostiga tushirish.
  - Goal: katta layout faylini submodule'ga bo'lish.
  - Files: `apps/frontend/src/shared/ui/Layout.tsx`, `apps/frontend/src/shared/ui/LayoutSearch.tsx`, `apps/frontend/src/shared/ui/useLayoutSearch.tsx`, `apps/frontend/src/shared/ui/layout.constants.ts`
  - Risks: header qidiruv va navigation xatti-harakati regressiyasi.
  - Done: Layout 277 qator, typecheck/build PASS.

- [x] T5.3 `pages/Holidays.tsx`ni 300-qator ostiga tushirish.
  - Goal: holidays page jadval konfiguratsiyasini ajratish.
  - Files: `apps/frontend/src/pages/Holidays.tsx`, `apps/frontend/src/pages/holidaysColumns.tsx`
  - Risks: jadvaldagi action/render regressiyasi.
  - Done: Holidays 260 qator, typecheck/build PASS.

- [x] T5.4 `pages/Devices.tsx`ni 300-qator ostiga tushirish.
  - Goal: webhook blok, table columns va form modalni alohida modullarga ajratish.
  - Files: `apps/frontend/src/pages/Devices.tsx`, `apps/frontend/src/pages/devicesColumns.tsx`, `apps/frontend/src/pages/DeviceCopyField.tsx`, `apps/frontend/src/pages/DeviceFormModal.tsx`, `apps/frontend/src/pages/DeviceWebhookCard.tsx`
  - Risks: device CRUD va webhook nusxalash oqimida regressiya.
  - Done: Devices 188 qator, typecheck/build PASS.

- [x] T5.5 `pages/Users.tsx`, `pages/Schools.tsx`, `pages/Attendance.tsx`ni 300-qator ostiga tushirish.
  - Goal: katta page'larni columns/filter/modal bo'laklariga ajratish.
  - Files: `apps/frontend/src/pages/{Users.tsx,Schools.tsx,Attendance.tsx}` va ularga tegishli yangi subfayllar.
  - Risks: CRUD oqimlari, assign/attendance update va modal validation regressiyasi.
  - Done: Users 181, Schools 180, Attendance 234 qator; typecheck/build PASS.

- [x] T5.6 `pages/SuperAdminDashboard.tsx`ni 300-qator ostiga tushirish.
  - Goal: jadval ustunlari va view render qismini alohida modullarga ajratish.
  - Files: `apps/frontend/src/pages/SuperAdminDashboard.tsx`, `apps/frontend/src/pages/SuperAdminDashboardView.tsx`, `apps/frontend/src/pages/superAdminColumns.tsx`, `apps/frontend/src/pages/superAdminTypes.ts`
  - Risks: admin realtime event paneli, ranking jadval va filter UI regressiyasi.
  - Done: SuperAdminDashboard 205 qator; typecheck/build PASS.

- [x] T5.7 `pages/Students.tsx`ni 300-qator ostiga tushirish.
  - Goal: columns/header/import-controls/form-modal qismlarini ajratish.
  - Files: `apps/frontend/src/pages/Students.tsx`, `apps/frontend/src/pages/{studentsColumns.tsx,StudentFormModal.tsx,ImportErrorsModal.tsx,StudentImportControls.tsx,StudentsHeader.tsx}`
  - Risks: import/export oqimi, qidiruv/debounce, period stats render regressiyasi.
  - Done: Students 266 qator; typecheck/build PASS.

- [x] T5.8 `pages/Dashboard.tsx`, `pages/StudentDetail.tsx`, `pages/Cameras.tsx`ni 300-qator ostiga tushirish.
  - Goal: eng katta route-level fayllarni xavfsiz submodule'larga ajratish.
  - Files:
    - `apps/frontend/src/pages/Dashboard.tsx`
    - `apps/frontend/src/pages/useDashboardPageState.ts`
    - `apps/frontend/src/pages/Dashboard{StatsHeader,Filters,TopRow,BottomRow,RulesFooter,HistoryModal}.tsx`
    - `apps/frontend/src/pages/dashboard.utils.ts`
    - `apps/frontend/src/pages/StudentDetail.tsx`
    - `apps/frontend/src/pages/StudentDetail{Header,Filters,TopRow,WeeklyCard,HistoryTable,DayModal}.tsx`
    - `apps/frontend/src/pages/studentDetail.utils.tsx`
    - `apps/frontend/src/pages/Cameras.tsx`
    - `apps/frontend/src/pages/useCameras{CrudActions,OpsActions}.ts`
    - `apps/frontend/src/pages/Cameras{Tabs,PreviewModal,Drawers,OperationModals}.tsx`
    - `apps/frontend/src/pages/cameras{.utils,Columns}.tsx`
  - Risks: kamera CRUD/deploy/sync va realtime dashboard oqimlarida regressiya.
  - Done: yuqoridagi barcha fayllar <=300 qator; typecheck/build PASS.

- [x] T7.2 Work-item hujjatlarini `work-item/fsd-migration/` papkasida markazlashtirish.
  - Goal: ish hujjatlarining yagona joylashuvi.
  - Files: `work-item/fsd-migration/*`
  - Risks: eski hujjat bilan chalkashlik.
  - Done: frontend FSD hujjatlari `work-item/fsd-migration/`da saqlandi; rootdagi `student-registrator` va `backend-ddd` hujjatlari ham `work-item/fsd-migration/*` ichiga ko'chirildi.

- [x] T6.1 App layer yakuniy compose.
  - Goal: router, provider, global styles app qatlamida bo'lishi.
  - Files: `apps/frontend/src/app/**`, `apps/frontend/src/main.tsx`
  - Risks: route/protected route regressiyasi.
  - Done: `AppProvider`, `AppRouter`, `app/router/ProtectedRoute` orqali app compose yakunlandi.

- [x] T6.2 Dead code va unused export tozalash.
  - Goal: toza struktura.
  - Files: `apps/frontend/src/**`
  - Risks: noto'g'ri o'chirish.
  - Done: `shared/ui/Layout.tsx` va `shared/ui/ProtectedRoute.tsx` legacy implementatsiyalari olib tashlandi, lint'da boundary error qolmadi.

- [x] T7.1 FSD map va final hujjatlar.
  - Goal: old->new mappingni to'liq yozish.
  - Files: `work-item/fsd-migration/fsd-map.md`, `work-item/fsd-migration/implementation-plan.md`, `work-item/fsd-migration/tasks.md`
  - Risks: noto'liq dokumentatsiya.
  - Done: mapping yangilandi, phase loglar yakunlandi, yakuniy verify log qo'shildi.

- [x] T7.3 Cross-agent impact audit (backend -> frontend contract drift tekshiruvi).
  - Goal: boshqa agentlarning backend refaktori frontend FSD migratsiyaga regressiya kiritmaganini tasdiqlash.
  - Files: `work-item/fsd-migration/cross-agent-impact-audit.md`, `work-item/fsd-migration/backend-ddd/*`
  - Risks: endpoint/prefix kontrakt drift ko'zdan qochishi.
  - Done: frontend-vs-backend endpoint diff bajarildi; yangi regressiya topilmadi, bitta pre-existing gap (`DELETE /schools/:id`) hujjatlashtirildi.

- [x] T7.4 Apps-separation backend o'zgarishlari bo'yicha re-audit.
  - Goal: backend agentning so'nggi `unstaged` o'zgarishlari frontend FSD qatlamiga ta'sir qilmaganini qayta tasdiqlash.
  - Files: `README.md`, `apps/backend/src/{config.ts,app/runtime/paths.ts}`, `work-item/fsd-migration/apps-separation/*`, `work-item/fsd-migration/cross-agent-impact-audit.md`
  - Risks: `.env` lookup yo'li o'zgarishi yoki app-local command policy drifti.
  - Done: diff ko'rildi, frontend source o'zgarmagani tasdiqlandi, `apps/frontend` va `apps/backend` gate'lari qayta PASS bo'ldi.

- [x] T7.5 Frontend lint warning cleanup (`react-hooks/exhaustive-deps` 6 ta).
  - Goal: warninglarni behaviorni o'zgartirmasdan bartaraf etish.
  - Files: `apps/frontend/src/pages/{Attendance.tsx,Devices.tsx,Holidays.tsx,Schools.tsx,Students.tsx,Users.tsx}`
  - Risks: memo/callback dependencylarni noto'g'ri yangilash oqibatida render oqimi regressiyasi.
  - Done: handlerlar `useCallback`ga stabilizatsiya qilindi, `useMemo` dependencylari to'liqlandi, lint 0 warningga tushdi.

- [x] T6.3 Legacy wrapper stabilizatsiyasi (`hooks/services/context`).
  - Goal: eski import yo'llarni buzmasdan FSD qatlamiga ko'chirish.
  - Files: `apps/frontend/src/hooks/**`, `apps/frontend/src/services/**`, `apps/frontend/src/context/**`
  - Risks: backward-compat importlarning sinishi.
  - Done: legacy fayllar wrapper holatiga o'tdi va yakunda `work-item/fsd-migration/legacy-src/`ga ko'chirildi; `apps/frontend/src` ichida FSD qatlamlari qoldirildi.

- [x] T6.4 Import yo'llarni yakuniy normalizatsiya (`@shared/types`, `@shared/config`) va root wrapperlarni olib tashlash.
  - Goal: `../types` va `../config`ga bog'liqlikni tugatish, FSD boundaryni tozalash.
  - Files: `apps/frontend/src/**`, `apps/frontend/src/{config.ts,types/index.ts,App.css}`
  - Risks: import update xatolari.
  - Done: barcha relative type/config importlar `@shared/*`ga o'tkazildi; `apps/frontend/src/config.ts`, `apps/frontend/src/types/index.ts`, `apps/frontend/src/App.css` olib tashlandi; bo'sh `apps/frontend/src/components` va `apps/frontend/src/types` papkalari tozalandi.

## Verification Log

| Phase | Command | Result | Notes |
|---|---|---|---|
| 0 | `npm run typecheck` (apps/frontend) | PASS | `tsc -p tsconfig.app.json --noEmit` xatolarsiz o'tdi |
| 0 | `npm run build` (apps/frontend) | PASS | `tsc -b && vite build` muvaffaqiyatli, faqat chunk-size warning mavjud |
| 1 | `npm run typecheck` (apps/frontend) | PASS | App provider/router, alias va lint-boundary bilan xatolarsiz o'tdi |
| 1 | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 2 (partial) | `npm run typecheck` (apps/frontend) | PASS | `shared/config`, `shared/api/client`, `shared/types` ko'chirishidan keyin xatolarsiz o'tdi |
| 2 (partial) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 2 (partial-2) | `npm run typecheck` (apps/frontend) | PASS | `mock` bo'linishi va eksportlar yangilangach xatolarsiz o'tdi |
| 2 (partial-2) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 5 (partial) | `npm run typecheck` (apps/frontend) | PASS | Layout split (`LayoutSearch`, `useLayoutSearch`, `layout.constants`) dan keyin xatolarsiz o'tdi |
| 5 (partial) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 5 (partial-2) | `npm run typecheck` (apps/frontend) | PASS | `Holidays.tsx` split (`holidaysColumns.tsx`)dan keyin xatolarsiz o'tdi |
| 5 (partial-2) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 5 (partial-3) | `npm run typecheck` (apps/frontend) | PASS | `Devices.tsx` split (`devicesColumns`, `DeviceCopyField`, `DeviceFormModal`, `DeviceWebhookCard`)dan keyin xatolarsiz o'tdi |
| 5 (partial-3) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 5 (partial-4) | `npm run typecheck` (apps/frontend) | PASS | `Users/Schools/Attendance` splitdan keyin xatolarsiz o'tdi |
| 5 (partial-4) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 5 (partial-5) | `npm run typecheck` (apps/frontend) | PASS | `SuperAdminDashboard` splitdan keyin xatolarsiz o'tdi |
| 5 (partial-5) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 5 (partial-6) | `npm run typecheck` (apps/frontend) | PASS | `Students.tsx` splitdan keyin xatolarsiz o'tdi |
| 5 (partial-6) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 5 (final split) | `npm run typecheck` (apps/frontend) | PASS | `Dashboard`, `StudentDetail`, `Cameras` bo'linishidan keyin xatolarsiz o'tdi |
| 5 (final split) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 7 (final verify) | `npm run typecheck` (apps/frontend) | PASS | Yakuniy hujjat yangilanishidan keyin ham xatolarsiz o'tdi |
| 7 (final verify) | `npm run build` (apps/frontend) | PASS | Yakuniy build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 6 (boundary cleanup) | `npm run typecheck` (apps/frontend) | PASS | `hooks/services/context` migratsiyasi va `Layout/ProtectedRoute` ko'chirilgach xatolarsiz o'tdi |
| 6 (boundary cleanup) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 6 (boundary cleanup) | `npm run lint` (apps/frontend) | PASS (warnings) | `no-restricted-imports` xatolari yo'q; faqat `react-hooks/exhaustive-deps` warninglar qoldi (behavior xavfi sabab o'zgartirilmadi) |
| 7 (final post-cleanup) | `npm run typecheck` (apps/frontend) | PASS | Legacy papkalar `work-item/fsd-migration/legacy-src/`ga ko'chirilgach xatolarsiz o'tdi |
| 7 (final post-cleanup) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 7 (final post-cleanup) | `npm run lint` (apps/frontend) | PASS (warnings) | Lint error yo'q, 6 ta `react-hooks/exhaustive-deps` warning saqlanib qoldi |
| 6 (import-normalization) | `npm run typecheck` (apps/frontend) | PASS | `../types` va `../config` importlari `@shared/*`ga o'tkazilib, wrapper fayllar olib tashlangach xatolarsiz o'tdi |
| 6 (import-normalization) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 6 (import-normalization) | `npm run lint` (apps/frontend) | PASS (warnings) | Lint error yo'q, avvalgi 6 ta `react-hooks/exhaustive-deps` warning saqlanib qoldi |
| 6 (import-normalization) | `300-line scan` (`apps/frontend/src/**/*.ts(x)`) | PASS | `.ts/.tsx` fayllar orasida 300 qatordan oshgani aniqlanmadi |
| 7 (cross-agent impact) | `npm run typecheck` (backend root) | PASS | Backend DDD refaktordan keyin compile kontrakt tekshirildi |
| 7 (cross-agent impact) | `npm run build` (backend root) | PASS | Backend build xatolarsiz |
| 7 (cross-agent impact) | `npm run lint` (backend root) | PASS | Backend lint xatolarsiz |
| 7 (cross-agent impact) | `npm test` (backend root) | PASS | 4 test file, 15 test pass |
| 7 (cross-agent impact) | `npm run typecheck` (apps/frontend) | PASS | Frontend FSD qatlami backend o'zgarishlaridan keyin ham barqaror |
| 7 (cross-agent impact) | `npm run build` (apps/frontend) | PASS | Frontend build xatolarsiz (chunk-size warning oldingi holat) |
| 7 (cross-agent impact) | `npm run lint` (apps/frontend) | PASS (warnings) | Lint error yo'q, 6 ta oldingi `react-hooks/exhaustive-deps` warning saqlangan |
| 7 (cross-agent impact) | Endpoint diff audit | PASS (1 pre-existing gap) | Prefix-aware diffda yangi regressiya yo'q; `DELETE /schools/:id` oldindan mavjud gap sifatida qayd etildi |
| 7 (apps relocation recheck) | `npm run typecheck` (apps/frontend) | PASS | Frontend `apps/frontend`ga ko'chirilgandan keyin gate qayta tekshirildi |
| 7 (apps relocation recheck) | `npm run build` (apps/frontend) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 7 (apps relocation recheck) | `npm run lint` (apps/frontend) | PASS (warnings) | Lint error yo'q, 6 ta oldingi warning saqlangan |
| 7 (apps relocation recheck) | `300-line scan` (`apps/frontend/src/**/*.ts(x)`) | PASS | `.ts/.tsx` fayllar orasida 300 qatordan oshgani yo'q |
| 7 (backend unstaged re-audit) | `npm run typecheck` (`apps/frontend`) | PASS | Backend `.env` path fallback refaktoridan keyin frontend compile barqaror |
| 7 (backend unstaged re-audit) | `npm run build` (`apps/frontend`) | PASS | Frontend build muvaffaqiyatli, chunk-size warning oldingi holatda |
| 7 (backend unstaged re-audit) | `300-line scan` (`apps/frontend/src/**/*.{ts,tsx,css}`) | PASS | Frontend source fayllarda 300+ qator aniqlanmadi |
| 7 (backend unstaged re-audit) | `npm run typecheck` (`apps/backend`) | PASS | Backend app-local typecheck muvaffaqiyatli (`apps/backend/src/config.ts` o'zgarishi bilan) |
| 7 (backend unstaged re-audit) | `npm run build` (`apps/backend`) | PASS | Backend build muvaffaqiyatli, kontrakt bo'yicha yangi regressiya topilmadi |
| 7 (lint warning cleanup) | `npm run lint` (`apps/frontend`) | PASS | 0 error, 0 warning (`react-hooks/exhaustive-deps` warninglar yopildi) |
| 7 (lint warning cleanup) | `npm run typecheck` (`apps/frontend`) | PASS | Callback/dependency refaktordan keyin typecheck toza |
| 7 (lint warning cleanup) | `npm run build` (`apps/frontend`) | PASS | Build muvaffaqiyatli, chunk-size warning saqlanib qoldi |
| 7 (lint warning cleanup) | `300-line scan` (`apps/frontend/src/pages/*.tsx` target files) | PASS | O'zgargan 6 ta page faylning barchasi 300 qatordan kichik |
