# TASKS

## Desktop Refactor: DRY/KISS/SOLID Hardening

## Epic 1 - Baseline and Safety
- [x] Desktop flowlar uchun regression checklist yaratish (Devices/Students/AddStudents)
- [x] Critical invariants hujjatini yozish (save policy, device resolution, import behavior)
- [x] Refactordan oldin smoke test natijalarini yozib qo'yish

## Epic 2 - Critical Correctness
- [x] DB-only (`targetDeviceIds=[]`) holatida device push bo'lmasligini qat'iylash
- [x] Tauri selection loopni explicit policy bilan moslashtirish
- [x] Device not found / credentials mismatch xatolarini standard codega o'tkazish
- [x] AddStudents multi-source import mapping buglarini yopish

## Epic 3 - DRY Extraction
- [x] Shared `resolveLocalDevice` helper/service yaratish
- [x] DevicesPage `getCredentialsForBackend`ni shared resolverga o'tkazish
- [x] DeviceDetailPage `findLocalForBackend`ni shared resolverga o'tkazish
- [x] AddStudentsPage `findLocalByBackendDeviceId`ni shared resolverga o'tkazish
- [x] Shared `splitName` utilga o'tish (AddStudents + DeviceDetail)
- [x] Shared face-pull retry utilga o'tish

## Epic 4 - Import Flow Consolidation
- [x] Device import normalization/dedupe uchun shared use-case yaratish
- [x] AddStudents import oqimini shared use-casega ulash
- [x] DeviceDetail import oqimini shared use-casega ulash
- [x] Import success/failure metrics bir xil formatga o'tkazish

## Epic 5 - Page Modularization
- [x] DeviceDetail state/actionsni hook + presentational componentlarga ajratish
- [x] AddStudents modal/import/save logikasini feature hookga ajratish
- [x] Students edit/sync logikasini alohida hookga ajratish
- [x] Page file size reduction target: DeviceDetail < 700 qator
- [x] Page file size reduction target: AddStudents < 700 qator

## Epic 6 - Type Safety Hardening
- [x] `any` ishlatilgan joylarni typed model bilan almashtirish
- [x] `as any` castlarni olib tashlash (`StudentsPage` DataTable handlers)
- [x] Diagnostic component props uchun aniq type contract yozish
- [x] Config snapshot/capabilities uchun typed interfaces kiritish

## Epic 7 - Dead Code and Duplicate Feature Cleanup
- [x] `App.old.tsx` bo'yicha qaror: archive yoki remove
- [x] Foydalanilmayotgan komponentlarni tozalash (`AddStudentInline`, `FilterBar`, `DiagnosticRow`, `DeviceTargetsPanel`)
- [x] Foydalanilmayotgan helperlarni tozalash (`refreshAllMissingFaces` va boshqalar)

## Epic 8 - Verification
- [ ] Unit tests: resolver, save policy, import dedupe
- [ ] Integration tests: DB-only, selected devices, import+face pull
- [x] `npm run typecheck` toza o'tishi
- [x] `npm run lint` desktop scope bo'yicha toza o'tishi
- [x] `cargo check` warninglar auditini yozish

## Acceptance Checklist
- [x] DB-only save mode devicega yubormaydi
- [x] Device selection semantics barcha sahifada bir xil
- [x] Dublikat critical business logic shared modulga ko'chirilgan
- [x] DRY/KISS/SOLID bo'yicha high severity finding qolmagan
- [ ] Manual QA: Devices/Students/AddStudents blocker buglarsiz

## Suggested Execution Order
1. Epic 2
2. Epic 3
3. Epic 4
4. Epic 5
5. Epic 6
6. Epic 7
7. Epic 8
