# FSD Map (Old -> New)

## Notes
- Bu fayl migratsiya davomida to'ldiriladi.
- Maqsad: har bir ko'chirilgan modul uchun aniq old/new mapping va sababini yozish.

| Old Path | New Path | Reason |
|---|---|---|
| `frontend/src/App.tsx` | `frontend/src/app/providers/AppProvider.tsx` + `frontend/src/app/router/AppRouter.tsx` + `frontend/src/app/App.tsx` | App init, provider va routerni app qatlamiga ajratish |
| `frontend/src/main.tsx` | `frontend/src/app/main.tsx` (entry) + `frontend/src/main.tsx` (thin proxy) | Entry-pointni app qatlamiga o'tkazish |
| `frontend/src/context/*` | `frontend/src/app/providers/auth/*` + `frontend/src/entities/auth/model/*` | Auth context/provider app+entity chegarasiga ajratildi (legacy wrapper saqlandi) |
| `frontend/src/services/api.ts` | `frontend/src/shared/api/client.ts` | Global API client shared qatlamda bo'lishi kerak |
| `frontend/src/services/*` | `frontend/src/entities/*/api/*` yoki `frontend/src/shared/api/*` | Domen va shared API ajratish |
| `frontend/src/hooks/useSchool.ts` | `frontend/src/entities/school/model/useSchool.ts` | School domeniga yaqin hook |
| `frontend/src/hooks/use*SSE.ts` | `frontend/src/features/realtime/*` | Realtime interaction feature sifatida |
| `frontend/src/shared/ui/Layout.tsx` | `frontend/src/widgets/layout/ui/Layout.tsx` (+ submodules) | Katta kompozit blok widget qatlamiga ko'chadi |
| `frontend/src/pages/*.tsx` | `frontend/src/pages/*.tsx` + `frontend/src/pages/*(helper files)` | Route-level page saqlanib, yirik fayllar yordamchi modullarga bo'lindi |
| `frontend/src/types/index.ts` | `frontend/src/shared/types/{core.ts,attendance.ts,api.ts,index.ts}` | 300-line split va type ownershipni `shared`ga tozalash |
| `frontend/src/mock/*` | `frontend/src/mock/{generators.ts,services/*.ts}` + barrel `frontend/src/mock/services.ts` | Mock logikani bo'lib SRP va line-limitni saqlash |

## Completed Moves
- `frontend/src/App.tsx` -> `frontend/src/app/App.tsx` (eski fayl endi thin-proxy, app compose yangi qatlamda).
- `frontend/src/App.tsx` route/provider logikasi -> `frontend/src/app/providers/AppProvider.tsx` va `frontend/src/app/router/AppRouter.tsx`.
- `frontend/src/shared/ui/Layout.tsx` ga to'g'ridan-to'g'ri bog'liqlik -> `frontend/src/widgets/layout/ui/Layout.tsx` (widget public API wrapper).
- `frontend/tsconfig.app.json`, `frontend/vite.config.ts` -> FSD layer aliaslari qo'shildi.
- `frontend/eslint.config.js` -> qatlam bo'yicha `no-restricted-imports` boundary qoidalari qo'shildi.
- `frontend/src/config.ts` -> `frontend/src/shared/config/index.ts` (yakunda wrapper olib tashlandi, importlar `@shared/config`ga o'tkazildi).
- `frontend/src/services/api.ts` -> `frontend/src/shared/api/client.ts` (eski yo'l wrapper orqali saqlandi).
- `frontend/src/types/index.ts` -> `frontend/src/shared/types/{core.ts,attendance.ts,api.ts,index.ts}` (yakunda wrapper olib tashlandi, importlar `@shared/types`ga o'tkazildi).
- `work-item/*.md` -> `work-item/fsd-migration/*.md` (hujjatlar bitta joyga yig'ildi).
- `frontend/src/mock/data.ts` -> `frontend/src/mock/data.ts` + `frontend/src/mock/generators.ts` (generatorlar ajratildi, fayl hajmi pasaydi).
- `frontend/src/mock/services.ts` -> `frontend/src/mock/services/{auth-schools-classes.ts,students-devices.ts,analytics-misc.ts}` + barrel `frontend/src/mock/services.ts`.
- `frontend/src/pages/Holidays.tsx` -> `frontend/src/pages/Holidays.tsx` + `frontend/src/pages/holidaysColumns.tsx` (table config ajratildi, behavior saqlandi).
- `frontend/src/pages/Devices.tsx` -> `frontend/src/pages/Devices.tsx` + `frontend/src/pages/{devicesColumns.tsx,DeviceCopyField.tsx,DeviceFormModal.tsx,DeviceWebhookCard.tsx}` (CRUD/webhook oqimi saqlangan holda 300-line split).
- `frontend/src/pages/Users.tsx` -> `frontend/src/pages/Users.tsx` + `frontend/src/pages/{usersColumns.tsx,UserCreateModal.tsx,UserAssignClassesModal.tsx,UserEditModal.tsx}` (user CRUD va class-assignment oqimi saqlandi).
- `frontend/src/pages/Schools.tsx` -> `frontend/src/pages/Schools.tsx` + `frontend/src/pages/{schoolsColumns.tsx,SchoolFormModal.tsx}` (school management va admin-create validatsiyasi saqlandi).
- `frontend/src/pages/Attendance.tsx` -> `frontend/src/pages/Attendance.tsx` + `frontend/src/pages/{attendanceColumns.tsx,AttendanceFiltersBar.tsx,AttendanceExcuseModal.tsx}` (filter/export/status update oqimi saqlandi).
- `frontend/src/pages/SuperAdminDashboard.tsx` -> `frontend/src/pages/SuperAdminDashboard.tsx` + `frontend/src/pages/{SuperAdminDashboardView.tsx,superAdminColumns.tsx,superAdminTypes.ts}` (SSE/data logika va render qatlamlari ajratildi).
- `frontend/src/pages/Students.tsx` -> `frontend/src/pages/Students.tsx` + `frontend/src/pages/{studentsColumns.tsx,StudentFormModal.tsx,ImportErrorsModal.tsx,StudentImportControls.tsx,StudentsHeader.tsx}` (table/header/import/form oqimlari ajratildi).
- `frontend/src/pages/Students.tsx` -> `frontend/src/pages/Students.tsx` + `frontend/src/pages/studentsFileActions.ts` (import/export/template handlerlari ajratildi, page soddalashtirildi).
- `frontend/src/pages/Dashboard.tsx` -> `frontend/src/pages/{Dashboard.tsx,useDashboardPageState.ts,DashboardStatsHeader.tsx,DashboardFilters.tsx,DashboardTopRow.tsx,DashboardBottomRow.tsx,DashboardRulesFooter.tsx,DashboardHistoryModal.tsx,dashboard.utils.ts}` (state, section va util qatlamlari ajratildi).
- `frontend/src/pages/StudentDetail.tsx` -> `frontend/src/pages/{StudentDetail.tsx,StudentDetailHeader.tsx,StudentDetailFilters.tsx,StudentDetailTopRow.tsx,StudentDetailWeeklyCard.tsx,StudentDetailHistoryTable.tsx,StudentDetailDayModal.tsx,studentDetail.utils.tsx}` (render bloklar va table utils ajratildi).
- `frontend/src/pages/Cameras.tsx` -> `frontend/src/pages/{Cameras.tsx,useCamerasCrudActions.ts,useCamerasOpsActions.ts,camerasColumns.tsx,CamerasTabs.tsx,CamerasPreviewModal.tsx,CamerasDrawers.tsx,CamerasOperationModals.tsx,cameras.utils.tsx}` (monolit CRUD+ops+UI bloklari modullarga bo'lindi).
- `work-item/ddd-map.md` -> `work-item/fsd-migration/ddd-map.md` (work-item hujjatlari bitta papkaga yig'ildi).
- `work-item/implementation-plan.md` -> `work-item/fsd-migration/implementation-plan.legacy.md` (eski nusxa arxivlandi).
- `work-item/tasks.md` -> `work-item/fsd-migration/tasks.legacy.md` (eski nusxa arxivlandi).
- `work-item/{tasks.md,implementation-plan.md,architecture-map.md}` -> `work-item/fsd-migration/student-registrator/*` (rootdagi ish hujjatlari modul papkasiga ko'chirildi).
- `work-item/backend-ddd/*` -> `work-item/fsd-migration/backend-ddd/*` (rootdagi backend DDD hujjatlari fsd-migration ichiga ko'chirildi).
- `frontend/src/hooks/useAuth.ts` -> `frontend/src/entities/auth/model/useAuth.ts` (legacy hook wrapper saqlandi).
- `frontend/src/hooks/useSchool.ts` -> `frontend/src/entities/school/model/useSchool.ts` (legacy hook wrapper saqlandi).
- `frontend/src/hooks/use{AttendanceSSE,SchoolSnapshotSSE,ClassSnapshotSSE,AdminSSE}.ts` -> `frontend/src/features/realtime/model/*` (legacy hook wrapper saqlandi).
- `frontend/src/services/auth.ts` -> `frontend/src/entities/auth/api/auth.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/classes.ts` -> `frontend/src/entities/class/api/class.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/students.ts` -> `frontend/src/entities/student/api/student.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/attendance.ts` -> `frontend/src/entities/attendance/api/attendance.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/schools.ts` -> `frontend/src/entities/school/api/school.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/users.ts` -> `frontend/src/entities/user/api/user.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/devices.ts` -> `frontend/src/entities/device/api/device.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/holidays.ts` -> `frontend/src/entities/holiday/api/holiday.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/dashboard.ts` -> `frontend/src/features/dashboard/api/dashboard.service.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/search.ts` -> `frontend/src/shared/api/search.ts` (legacy service wrapper saqlandi).
- `frontend/src/services/sse.ts` -> `frontend/src/shared/api/sse.ts` (legacy service wrapper saqlandi).
- `frontend/src/shared/ui/Layout.tsx` -> `frontend/src/widgets/layout/ui/Layout.tsx` (real implementatsiya widgetga ko'chdi, shared'dagi legacy fayl olib tashlandi).
- `frontend/src/shared/ui/ProtectedRoute.tsx` -> `frontend/src/app/router/ProtectedRoute.tsx` (route guard app qatlamiga ko'chdi, shared'dagi legacy fayl olib tashlandi).
- `frontend/src/{hooks,services,context}` -> `work-item/fsd-migration/legacy-src/{hooks,services,context}` (legacy wrapperlar source tree'dan chiqarildi, FSD qatlami tozalandi).
- `frontend/src/{config.ts,types/index.ts}` -> removed (alias importlar `@shared/config` va `@shared/types`ga to'liq o'tkazildi).
- `frontend/src/App.css` -> removed (foydalanilmagan legacy stylesheet).
- `frontend/src/{components,types}` (bo'sh papkalar) -> removed.
