# FSD Map (Old -> New)

## Notes
- Bu fayl migratsiya davomida to'ldiriladi.
- Maqsad: har bir ko'chirilgan modul uchun aniq old/new mapping va sababini yozish.

| Old Path | New Path | Reason |
|---|---|---|
| `apps/frontend/src/App.tsx` | `apps/frontend/src/app/providers/AppProvider.tsx` + `apps/frontend/src/app/router/AppRouter.tsx` + `apps/frontend/src/app/App.tsx` | App init, provider va routerni app qatlamiga ajratish |
| `apps/frontend/src/main.tsx` | `apps/frontend/src/app/main.tsx` (entry) + `apps/frontend/src/main.tsx` (thin proxy) | Entry-pointni app qatlamiga o'tkazish |
| `apps/frontend/src/context/*` | `apps/frontend/src/app/providers/auth/*` + `apps/frontend/src/entities/auth/model/*` | Auth context/provider app+entity chegarasiga ajratildi (legacy wrapper saqlandi) |
| `apps/frontend/src/services/api.ts` | `apps/frontend/src/shared/api/client.ts` | Global API client shared qatlamda bo'lishi kerak |
| `apps/frontend/src/services/*` | `apps/frontend/src/entities/*/api/*` yoki `apps/frontend/src/shared/api/*` | Domen va shared API ajratish |
| `apps/frontend/src/hooks/useSchool.ts` | `apps/frontend/src/entities/school/model/useSchool.ts` | School domeniga yaqin hook |
| `apps/frontend/src/hooks/use*SSE.ts` | `apps/frontend/src/features/realtime/*` | Realtime interaction feature sifatida |
| `apps/frontend/src/shared/ui/Layout.tsx` | `apps/frontend/src/widgets/layout/ui/Layout.tsx` (+ submodules) | Katta kompozit blok widget qatlamiga ko'chadi |
| `apps/frontend/src/pages/*.tsx` | `apps/frontend/src/pages/*.tsx` + `apps/frontend/src/pages/*(helper files)` | Route-level page saqlanib, yirik fayllar yordamchi modullarga bo'lindi |
| `apps/frontend/src/types/index.ts` | `apps/frontend/src/shared/types/{core.ts,attendance.ts,api.ts,index.ts}` | 300-line split va type ownershipni `shared`ga tozalash |
| `apps/frontend/src/mock/*` | `apps/frontend/src/mock/{generators.ts,services/*.ts}` + barrel `apps/frontend/src/mock/services.ts` | Mock logikani bo'lib SRP va line-limitni saqlash |

## Completed Moves
- `apps/frontend/src/App.tsx` -> `apps/frontend/src/app/App.tsx` (eski fayl endi thin-proxy, app compose yangi qatlamda).
- `apps/frontend/src/App.tsx` route/provider logikasi -> `apps/frontend/src/app/providers/AppProvider.tsx` va `apps/frontend/src/app/router/AppRouter.tsx`.
- `apps/frontend/src/shared/ui/Layout.tsx` ga to'g'ridan-to'g'ri bog'liqlik -> `apps/frontend/src/widgets/layout/ui/Layout.tsx` (widget public API wrapper).
- `apps/frontend/tsconfig.app.json`, `apps/frontend/vite.config.ts` -> FSD layer aliaslari qo'shildi.
- `apps/frontend/eslint.config.js` -> qatlam bo'yicha `no-restricted-imports` boundary qoidalari qo'shildi.
- `apps/frontend/src/config.ts` -> `apps/frontend/src/shared/config/index.ts` (yakunda wrapper olib tashlandi, importlar `@shared/config`ga o'tkazildi).
- `apps/frontend/src/services/api.ts` -> `apps/frontend/src/shared/api/client.ts` (eski yo'l wrapper orqali saqlandi).
- `apps/frontend/src/types/index.ts` -> `apps/frontend/src/shared/types/{core.ts,attendance.ts,api.ts,index.ts}` (yakunda wrapper olib tashlandi, importlar `@shared/types`ga o'tkazildi).
- `work-item/*.md` -> `work-item/fsd-migration/*.md` (hujjatlar bitta joyga yig'ildi).
- `apps/frontend/src/mock/data.ts` -> `apps/frontend/src/mock/data.ts` + `apps/frontend/src/mock/generators.ts` (generatorlar ajratildi, fayl hajmi pasaydi).
- `apps/frontend/src/mock/services.ts` -> `apps/frontend/src/mock/services/{auth-schools-classes.ts,students-devices.ts,analytics-misc.ts}` + barrel `apps/frontend/src/mock/services.ts`.
- `apps/frontend/src/pages/Holidays.tsx` -> `apps/frontend/src/pages/Holidays.tsx` + `apps/frontend/src/pages/holidaysColumns.tsx` (table config ajratildi, behavior saqlandi).
- `apps/frontend/src/pages/Devices.tsx` -> `apps/frontend/src/pages/Devices.tsx` + `apps/frontend/src/pages/{devicesColumns.tsx,DeviceCopyField.tsx,DeviceFormModal.tsx,DeviceWebhookCard.tsx}` (CRUD/webhook oqimi saqlangan holda 300-line split).
- `apps/frontend/src/pages/Users.tsx` -> `apps/frontend/src/pages/Users.tsx` + `apps/frontend/src/pages/{usersColumns.tsx,UserCreateModal.tsx,UserAssignClassesModal.tsx,UserEditModal.tsx}` (user CRUD va class-assignment oqimi saqlandi).
- `apps/frontend/src/pages/Schools.tsx` -> `apps/frontend/src/pages/Schools.tsx` + `apps/frontend/src/pages/{schoolsColumns.tsx,SchoolFormModal.tsx}` (school management va admin-create validatsiyasi saqlandi).
- `apps/frontend/src/pages/Attendance.tsx` -> `apps/frontend/src/pages/Attendance.tsx` + `apps/frontend/src/pages/{attendanceColumns.tsx,AttendanceFiltersBar.tsx,AttendanceExcuseModal.tsx}` (filter/export/status update oqimi saqlandi).
- `apps/frontend/src/pages/SuperAdminDashboard.tsx` -> `apps/frontend/src/pages/SuperAdminDashboard.tsx` + `apps/frontend/src/pages/{SuperAdminDashboardView.tsx,superAdminColumns.tsx,superAdminTypes.ts}` (SSE/data logika va render qatlamlari ajratildi).
- `apps/frontend/src/pages/Students.tsx` -> `apps/frontend/src/pages/Students.tsx` + `apps/frontend/src/pages/{studentsColumns.tsx,StudentFormModal.tsx,ImportErrorsModal.tsx,StudentImportControls.tsx,StudentsHeader.tsx}` (table/header/import/form oqimlari ajratildi).
- `apps/frontend/src/pages/Students.tsx` -> `apps/frontend/src/pages/Students.tsx` + `apps/frontend/src/pages/studentsFileActions.ts` (import/export/template handlerlari ajratildi, page soddalashtirildi).
- `apps/frontend/src/pages/Dashboard.tsx` -> `apps/frontend/src/pages/{Dashboard.tsx,useDashboardPageState.ts,DashboardStatsHeader.tsx,DashboardFilters.tsx,DashboardTopRow.tsx,DashboardBottomRow.tsx,DashboardRulesFooter.tsx,DashboardHistoryModal.tsx,dashboard.utils.ts}` (state, section va util qatlamlari ajratildi).
- `apps/frontend/src/pages/StudentDetail.tsx` -> `apps/frontend/src/pages/{StudentDetail.tsx,StudentDetailHeader.tsx,StudentDetailFilters.tsx,StudentDetailTopRow.tsx,StudentDetailWeeklyCard.tsx,StudentDetailHistoryTable.tsx,StudentDetailDayModal.tsx,studentDetail.utils.tsx}` (render bloklar va table utils ajratildi).
- `apps/frontend/src/pages/Cameras.tsx` -> `apps/frontend/src/pages/{Cameras.tsx,useCamerasCrudActions.ts,useCamerasOpsActions.ts,camerasColumns.tsx,CamerasTabs.tsx,CamerasPreviewModal.tsx,CamerasDrawers.tsx,CamerasOperationModals.tsx,cameras.utils.tsx}` (monolit CRUD+ops+UI bloklari modullarga bo'lindi).
- `work-item/ddd-map.md` -> `work-item/fsd-migration/ddd-map.md` (work-item hujjatlari bitta papkaga yig'ildi).
- `work-item/implementation-plan.md` -> `work-item/fsd-migration/implementation-plan.legacy.md` (eski nusxa arxivlandi).
- `work-item/tasks.md` -> `work-item/fsd-migration/tasks.legacy.md` (eski nusxa arxivlandi).
- `work-item/{tasks.md,implementation-plan.md,architecture-map.md}` -> `work-item/fsd-migration/student-registrator/*` (rootdagi ish hujjatlari modul papkasiga ko'chirildi).
- `work-item/backend-ddd/*` -> `work-item/fsd-migration/backend-ddd/*` (rootdagi backend DDD hujjatlari fsd-migration ichiga ko'chirildi).
- `backend agent changes` -> `work-item/fsd-migration/cross-agent-impact-audit.md` (frontend-backend contract drift audit hujjati qo'shildi).
- `apps/frontend/src/hooks/useAuth.ts` -> `apps/frontend/src/entities/auth/model/useAuth.ts` (legacy hook wrapper saqlandi).
- `apps/frontend/src/hooks/useSchool.ts` -> `apps/frontend/src/entities/school/model/useSchool.ts` (legacy hook wrapper saqlandi).
- `apps/frontend/src/hooks/use{AttendanceSSE,SchoolSnapshotSSE,ClassSnapshotSSE,AdminSSE}.ts` -> `apps/frontend/src/features/realtime/model/*` (legacy hook wrapper saqlandi).
- `apps/frontend/src/services/auth.ts` -> `apps/frontend/src/entities/auth/api/auth.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/classes.ts` -> `apps/frontend/src/entities/class/api/class.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/students.ts` -> `apps/frontend/src/entities/student/api/student.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/attendance.ts` -> `apps/frontend/src/entities/attendance/api/attendance.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/schools.ts` -> `apps/frontend/src/entities/school/api/school.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/users.ts` -> `apps/frontend/src/entities/user/api/user.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/devices.ts` -> `apps/frontend/src/entities/device/api/device.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/holidays.ts` -> `apps/frontend/src/entities/holiday/api/holiday.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/dashboard.ts` -> `apps/frontend/src/features/dashboard/api/dashboard.service.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/search.ts` -> `apps/frontend/src/shared/api/search.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/services/sse.ts` -> `apps/frontend/src/shared/api/sse.ts` (legacy service wrapper saqlandi).
- `apps/frontend/src/shared/ui/Layout.tsx` -> `apps/frontend/src/widgets/layout/ui/Layout.tsx` (real implementatsiya widgetga ko'chdi, shared'dagi legacy fayl olib tashlandi).
- `apps/frontend/src/shared/ui/ProtectedRoute.tsx` -> `apps/frontend/src/app/router/ProtectedRoute.tsx` (route guard app qatlamiga ko'chdi, shared'dagi legacy fayl olib tashlandi).
- `apps/frontend/src/{hooks,services,context}` -> `work-item/fsd-migration/legacy-src/{hooks,services,context}` (legacy wrapperlar source tree'dan chiqarildi, FSD qatlami tozalandi).
- `apps/frontend/src/{config.ts,types/index.ts}` -> removed (alias importlar `@shared/config` va `@shared/types`ga to'liq o'tkazildi).
- `apps/frontend/src/App.css` -> removed (foydalanilmagan legacy stylesheet).
- `apps/frontend/src/{components,types}` (bo'sh papkalar) -> removed.
