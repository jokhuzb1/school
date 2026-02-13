# Hikvision bilan ishlash bo'yicha tajriba (Student Registrator)

## Qisqa xulosa
Bu hujjat Hikvision qurilmasiga student yozishda uchragan real muammolar va amaliy yechimlarni jamlaydi. Maqsad - keyingi safar tez diagnostika qilish va barqaror ishlashni ta'minlash.

## 1) Auth muammosi: `Unauthorized (no digest challenge)`
**Belgi:**
- Hikvisionga yozish paytida `Unauthorized (no digest challenge)` yoki shunga o‘xshash xato chiqadi.

**Sabab:**
- Qurilma `WWW-Authenticate` challenge qaytarmaydi yoki auth rejimi noto‘g‘ri.

**Yechim:**
- Hikvision'ning **Web Authentication** sozlamasini `digest/basic` qilib qo'yish tavsiya etiladi.
- HTTPS/HTTP mosligini tekshirish.
- ISAPI yoqilganligini tekshirish.

**Koddagi yondashuv:**
- `apps/student-registrator/src-tauri/src/hikvision.rs` ichida auth oqimi **unauth -> digest -> basic fallback** tarzida yozildi.

## 2) `HTTP 400 Bad Request: Invalid Content (employeeNo)`
**Belgi:**
- Qurilma `badJsonContent` va `errorMsg: "employeeNo"` qaytaradi.

**Sabab:**
- Hikvision `employeeNo` faqat **raqam** bo'lishini talab qiladi.

**Yechim:**
- `employeeNo` ni **raqamli** generatsiya qilish.
- Backend provisioningga ham **raqamli `deviceStudentId`** yuborish.

**Koddagi tuzatish:**
- `apps/student-registrator/src-tauri/src/commands.rs` ichida `start_provisioning` chaqiruvida `deviceStudentId` raqamli yuboriladi.

## Tavsiya etiladigan tekshiruvlar
1. Qurilma porti: ISAPI uchun odatda `80` yoki `8080`.
2. URL: `http://IP:PORT/ISAPI/System/deviceInfo?format=json`
3. Web Authentication: `digest/basic`.
4. ISAPI yoqilganligini tekshirish.

## Tezkor checklist
- [ ] IP/Port to‘g‘ri
- [ ] Login/parol to‘g‘ri
- [ ] ISAPI yoqilgan
- [ ] Web Auth: digest/basic
- [ ] employeeNo raqamli
