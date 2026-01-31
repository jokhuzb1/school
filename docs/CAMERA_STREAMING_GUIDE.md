# 📹 Camera Streaming System - Qo'llanma

## 📋 Umumiy Ma'lumot

Bu tizim maktablar uchun kamera monitoring tizimi bo'lib, quyidagi imkoniyatlarni taqdim etadi:

- **Multi-School Support**: Har bir maktab o'z NVR va kameralarini boshqaradi
- **Multi-Vendor Support**: Hikvision, Dahua, Seetong va Generic ONVIF
- **Codec Support**: H.264 va H.265 (HEVC)
- **Streaming**: WebRTC va HLS orqali

---

## 🚀 Tizimni Ishga Tushirish

### 1. Backend Server

```bash
cd d:\projects-advanced\school
npm run dev
```

### 2. Frontend

```bash
cd d:\projects-advanced\school\frontend
npm run dev
```

### 3. MediaMTX Streaming Server

```bash
# Usul 1: Script orqali (tavsiya)
d:\projects-advanced\school\tools\mediamtx\start-mediamtx.bat

# Usul 2: Manual
cd d:\projects-advanced\school\tools\mediamtx
.\mediamtx.exe .\mediamtx.yml
```

---

## 📹 Kamera Qo'shish

### 1. NVR Qo'shish

1. Cameras sahifasiga o'ting
2. "NVR" tabini tanlang
3. "Yangi NVR" tugmasini bosing
4. Ma'lumotlarni kiriting:
   - **Vendor**: Hikvision, Dahua, Seetong yoki Generic
   - **Host**: NVR IP manzili (masalan: 192.168.100.58)
   - **Portlar**: HTTP (80), ONVIF (8000), RTSP (554)
   - **Login/Parol**: Admin ma'lumotlari

### 2. Kamera Qo'shish

1. "Kameralar" tabini tanlang
2. "Yangi kamera" tugmasini bosing
3. Ma'lumotlarni kiriting:
   - **NVR**: Yuqorida yaratilgan NVR
   - **Kanal raqami**: 1, 2, 3...
   - **Stream sifati**:
     - `Main` = H.265 (yuqori sifat)
     - `Sub` = H.264 (WebRTC uchun mos)
   - **Avtomatik URL**: Yoqilgan bo'lsa, NVR dan avtomatik URL generatsiya

### 3. MediaMTX Deploy

1. "Sync" tabini tanlang
2. "Deploy (Maktab)" tugmasini bosing
3. Sozlamalarni tekshiring:
   - **Local Path**: mediamtx.yml joylashuvi
   - **Restart Command**: restart script yo'li
   - **Avtomatik deploy**: Kamera saqlanganida auto-update

---

## 🎥 Stream Ko'rish

### Codec bo'yicha Player

| Codec | Player | Izoh                         |
| ----- | ------ | ---------------------------- |
| H.264 | WebRTC | Kam kechikish, real-time     |
| H.265 | HLS    | Yuqori sifat, 2-5s kechikish |

Tizim avtomatik ravishda to'g'ri player'ni tanlaydi.

### URL'lar

- **WebRTC**: `http://localhost:8889/{path}/whep`
- **HLS**: `http://localhost:8888/{path}/index.m3u8`
- **RTSP**: `rtsp://localhost:8554/{path}`

---

## 🔧 Muammolar va Yechimlar

### "Native HLS playback error"

**Sabab**: H.265 codec bilan HLS
**Yechim**: Kamera sozlamalarida `Sub` stream tanlang (H.264)

### "MediaMTX ulanmadi"

**Sabab**: MediaMTX ishlamayapti
**Yechim**: `start-mediamtx.bat` ni ishga tushiring

### "RTSP serverga ulanib bo'lmadi"

**Sabab**: NVR yoki Kamera offline
**Yechim**:

1. NVR IP to'g'riligini tekshiring
2. Parolni tekshiring
3. Firewall sozlamalarini tekshiring

---

## 📁 Fayl Strukturasi

```
tools/mediamtx/
├── mediamtx.exe          # MediaMTX server
├── mediamtx.yml          # Konfiguratsiya (auto-generated)
├── start-mediamtx.bat    # Ishga tushirish
├── stop-mediamtx.bat     # To'xtatish
├── restart-mediamtx.bat  # Qayta ishga tushirish
└── mediamtx-startup.vbs  # Windows startup uchun
```

---

## 🔐 Xavfsizlik

- Har bir maktab faqat o'z kameralarini ko'radi
- RTSP URL'lar faqat admin'larga ko'rinadi
- Parollar shifrlangan holda saqlanadi

---

## 📞 Yordam

Muammo bo'lsa:

1. Server loglarini tekshiring
2. MediaMTX loglarini ko'ring
3. Browser console'ni tekshiring
