# Hikvision Qurilmalarini Boshqarish (Student Registrator)

Bu hujjat **Student Registrator** desktop ilovasi orqali Hikvision qurilmalari bilan ishlashning to‘liq texnik tavsifini beradi. Unda ulanish, ma’lumot yuborish/olish, tahrirlash, klonlash (clone), va backend bilan sinxron ishlash oqimlari jamlangan.

## 1) Arxitektura va oqim

**Student Registrator** — Tauri desktop ilovasi.

- **UI (React)**: `apps/student-registrator/src`
- **Rust backend (Tauri)**: `apps/student-registrator/src-tauri/src`
- **Hikvision ISAPI**: Rust orqali HTTP chaqiruvlar
- **Backend server (Fastify)**: maktab va o‘quvchilar ma’lumotlari

Asosiy oqim:
1. UI foydalanuvchidan ma’lumot oladi.
2. UI Tauri `invoke()` orqali Rust komandalarni chaqiradi.
3. Rust Hikvision ISAPI bilan ishlaydi.
4. Natija UI’ga qaytadi.
5. Agar backend integratsiya yoqilgan bo‘lsa, provisioning ma’lumotlari backendga yuboriladi.

## 2) Qurilma bilan ulanish

### 2.1. Qurilma konfiguratsiyasi (local)
- Mahalliy saqlash: `%LOCALAPPDATA%/student-registrator/devices.json`
- Har bir yozuv:
  - `host`, `port`, `username`, `password`
  - `deviceId` (Hikvision device ID)
  - `backendId` (serverdagi device ID)
  - `credentialsExpiresAt` (30 kun TTL)

Rust: `apps/student-registrator/src-tauri/src/storage.rs`

### 2.2. Ulanishni tekshirish
- ISAPI: `GET /ISAPI/System/deviceInfo?format=json`
- Rust: `HikvisionClient::test_connection()`
- Avtorizatsiya:
  - Avval **Digest** challenge tekshiriladi
  - Topilmasa **Basic** auth fallback

Rust: `apps/student-registrator/src-tauri/src/hikvision.rs`

## 3) Hikvision’dan ma’lumot olish

### 3.1. User qidirish (search)
- Endpoint: `POST /ISAPI/AccessControl/UserInfo/Search`
- `searchID`, `maxResults`, `searchResultPosition`

Rust: `HikvisionClient::search_users()`

### 3.2. User ma’lumotini olish
- `EmployeeNoList` bo‘yicha qidiriladi

Rust: `HikvisionClient::get_user_by_employee_no()`

### 3.3. Face rasm olish
- Hikvision qaytargan `faceURL` bo‘yicha rasm olinadi

Rust: `HikvisionClient::fetch_face_image()`

## 4) Qurilmaga o‘quvchi yozish (register)

### 4.1. Oqim
1. `test_connection`
2. `create_user` (`/UserInfo/Record`)
3. `upload_face` (`/FaceDataRecord`)

Rust: `register_student` (Tauri command)

### 4.2. Muhim shartlar
- `faceImageBase64` **majburiy** (Hikvision face limit: 200KB)
- `deviceStudentId` — numeric bo‘lishi mumkin (config ga bog‘liq)

### 4.3. All‑or‑nothing
- Bitta device xato bo‘lsa, qolganiga o‘tmaydi
- Muvaffaqiyatli yozilganlar rollback qilinadi (`delete_user`)

## 5) Qurilmada user tahrirlash

### 5.1. Amaldagi yo‘l: Recreate
- Eski user o‘chiriladi
- Yangi user yaratiladi
- Face qayta yuklanadi

Rust: `recreate_user` command

### 5.2. Update endpoint
- Hozir to‘g‘ridan‑to‘g‘ri update endpoint ishlatilmaydi

## 6) Qurilmadan user o‘chirish

- ISAPI: `PUT /ISAPI/AccessControl/UserInfo/Delete`
- Rust: `delete_user` command

## 7) Backend bilan provisioning

### 7.1. Provisioning start
`POST /schools/:schoolId/students/provision`

- Student yoziladi yoki update qilinadi
- `StudentProvisioning` yaratiladi
- `StudentDeviceLink` yoziladi

### 7.2. Device result report
`POST /provisioning/:id/device-result`

- Har bir device bo‘yicha SUCCESS/FAILED qaytariladi
- Backend provisioning holatini yangilaydi

### 7.3. Provisioning status/logs
- `GET /provisioning/:id`
- `GET /provisioning/:id/logs`

## 8) Clone (DB → Device)

### 8.1. Maqsad
Bazadagi barcha o‘quvchilarni bitta device’ga yozish.

### 8.2. Talab
`photoUrl` bo‘lishi shart, chunki face rasm shu orqali olinadi.

### 8.3. Oqim
- Backenddan `/schools/:schoolId/students?page=N`
- Har bir student:
  - `photoUrl` yuklash
  - `create_user` + `upload_face`

Rust: `clone_students_to_device`

## 9) Clone (Device → Device)

### 9.1. Maqsad
Manba device’dagi barcha userlarni boshqa device’ga ko‘chirish.

### 9.2. Oqim
- Manba device’dan `search_users`
- Har user uchun:
  - `faceURL` bo‘yicha face rasm olinadi
  - Maqsad device’da user bo‘lmasa yaratadi
  - Face rasm yuklanadi

### 9.3. Dublikat
- Agar user allaqachon mavjud bo‘lsa, xato bermaydi, **skip** qiladi.

Rust: `clone_device_to_device`

## 10) Rasmni backendda saqlash

### 10.1. Qachon saqlanadi
- Student provisioning yoki edit paytida `faceImageBase64` yuborilsa.

### 10.2. Qayerga
- `uploads/student-faces/{studentId}.jpg`
- DB: `Student.photoUrl`

Backend: `src/modules/students/presentation/students.routes.ts`

## 11) UI qismidagi boshqaruv

### 11.1. Qurilmalar sahifasi
`apps/student-registrator/src/pages/DevicesPage.tsx`

- Device qo‘shish / tahrirlash
- Credentials saqlash
- Ulanish testi
- O‘chirish
- Clone (DB → Device)
- Clone (Device → Device)
- Webhook URL’larni ko‘rish (read‑only)

### 11.2. O‘quvchilar sahifasi
`apps/student-registrator/src/pages/StudentsPage.tsx`

- Rasm ko‘rinadi (`photoUrl`)
- Rasmni qo‘lda yuklash

## 15) Webhooklar: ulanish va o‘zgartirish bo‘yicha ko‘rsatma

### 15.1. Hozirgi holat (read‑only)
- Desktop UI’da **Webhook URL’lar faqat ko‘rinadi**, tahrirlanmaydi.
- UI: `apps/student-registrator/src/pages/DevicesPage.tsx`

### 15.2. Backenddagi webhook endpointlar
Webhook endpointlar **backend** tomonida ro‘yxatga olinadi:
- `src/modules/attendance/presentation/webhook.routes.ts`
- `server.ts` da `webhookRoutes` prefix `"/"` bilan ulanadi.

Hozirgi umumiy format:
```
POST /webhook/:schoolId/:direction
```
`direction` — `in` yoki `out`.

### 15.3. Webhook URL’larni o‘zgartirish mumkinmi?
**Ha, lekin bu backend konfiguratsiya/route darajasida** amalga oshiriladi.
UI’dan to‘g‘ridan‑to‘g‘ri tahrirlash hozir yo‘q.

O‘zgartirish variantlari:
1. **Route formatini o‘zgartirish**  
   `src/modules/attendance/presentation/webhook.routes.ts` ichida `fastify.post(...)` yo‘li o‘zgartiriladi.
2. **Prefix o‘zgartirish**  
   `server.ts` ichida `webhookRoutes` registratsiya prefixini almashtirish mumkin.
3. **Secret/Token orqali himoya**  
   Backend `webhook-info` endpointi orqali secret URLlar beriladi (UI’da ko‘rinadi).

### 15.4. Eslatma
Webhook URL o‘zgarganda:
- Hikvision device’lar konfiguratsiyasini ham yangilash shart.
- Aks holda eventlar kelmaydi.

## 16) Kelajakda Hikvision sozlamalarini kengaytirish (tadqiqot yo‘riqnoma)

Hozirgi implementatsiya faqat **asosiy ISAPI** chaqiruvlarni ishlatadi (device info, user yaratish/search/delete, face upload). Kengroq sozlamalar (time/NTP, network, door settings, access policy va h.k.) **model/firmwarega qarab** farq qiladi. Shu sababli kengaytirishdan oldin **rasmiy ISAPI hujjatlarini** topib, endpointlarni **anig‘ini** tekshirish kerak. citeturn0search0

### 16.1. Minimal tekshiruv strategiyasi
1. Qurilma **ISAPI ishlayotganini** tekshirish: `GET /ISAPI/System/deviceInfo`  
2. Qurilma holatini olish: `GET /ISAPI/System/status`  
   Bu endpointlar ko‘p Hikvision qurilmalarda mavjud bo‘ladi va monitoring tizimlarida ishlatiladi. citeturn0search0

### 16.2. Time/NTP sozlamalari
Hikvision tizimlarida NTP sozlash amaliyotda mavjud, lekin aniq ISAPI endpointlari **modelga bog‘liq**. Rasmiy portal va UI yo‘riqnomalarda NTP sozlash bo‘limi ko‘rsatilgan. citeturn0search1turn0search2  
**Tavsiyalar:**  
- NTP/datetime sozlamalarini qo‘shishdan oldin, qurilma modeliga mos ISAPI spec olish.  
- DNS/NTP ishlashi uchun tarmoq sozlamalari to‘g‘ri ekanini tekshirish (amaliy muammo ko‘p uchraydi). citeturn0reddit12

### 16.3. Qo‘shiladigan yangi funksiyalar (yo‘l xaritasi)
Quyidagi bo‘limlar qo‘shilishi mumkin, ammo **aniq endpointlar** rasmiy ISAPI spec’dan olinadi:
- Vaqt/NTP sozlamalari (GET/PUT)
- Network sozlamalari (IP/DNS/Gateway)
- Door/Access control policy
- Event/notification sozlamalari
- Face library konfiguratsiyasi

### 16.4. Implementatsiya tartibi (tavsiya)
1. Rasmiy ISAPI doc’ni topish (model/firmware bo‘yicha).  
2. Endpointlarni **read‑only** rejimda sinab ko‘rish.  
3. `HikvisionClient` ichiga yangi metodlar qo‘shish.  
4. UI’da faqat kerakli parametrlar uchun inputlar qo‘shish.  
5. Har bir sozlama uchun **rollback** va **validatsiya** qo‘shish.

## 12) Hikvision ISAPI endpointlar

- `GET  /ISAPI/System/deviceInfo?format=json`
- `POST /ISAPI/AccessControl/UserInfo/Record`
- `POST /ISAPI/AccessControl/UserInfo/Search`
- `PUT  /ISAPI/AccessControl/UserInfo/Delete`
- `POST /ISAPI/Intelligent/FDLib/FaceDataRecord`

## 13) Xatolar va muammolar

- **Timeout**: tarmoq yoki device offline
- **BadRequest**: gender yoki format muammo bo‘lishi mumkin
- **Duplicate**: clone jarayonida skip qilinadi

## 14) Checklist (ishlatishdan oldin)

- Device IP/Port to‘g‘ri
- Login/parol to‘g‘ri
- `deviceId` backendda bor
- `photoUrl` DB’da bor (clone uchun)

---

## Fayl va kod yo‘llari

- Rust: `apps/student-registrator/src-tauri/src/commands.rs`
- Rust Hikvision: `apps/student-registrator/src-tauri/src/hikvision.rs`
- Backend Students: `src/modules/students/presentation/students.routes.ts`
- UI Devices: `apps/student-registrator/src/pages/DevicesPage.tsx`
- UI Students: `apps/student-registrator/src/pages/StudentsPage.tsx`

