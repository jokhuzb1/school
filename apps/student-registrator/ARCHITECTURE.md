# Student Registrator - Architecture Documentation

> Boshqa agentlar uchun arxitektura hujjati

## Overview

Bu **Tauri** desktop ilovasi bo'lib, **Hikvision** yuz tanish qurilmalariga o'quvchilarni ro'yxatdan o'tkazish uchun ishlatiladi.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DESKTOP APP                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   React UI      │───>│   Tauri Rust Backend        │ │
│  │   (src/)        │    │   (src-tauri/src/)          │ │
│  │                 │    │                             │ │
│  │ • App.tsx       │    │ • main.rs (entry)           │ │
│  │ • api.ts        │    │ • commands.rs (IPC handlers)│ │
│  │ • index.css     │    │ • hikvision.rs (ISAPI)      │ │
│  └─────────────────┘    │ • storage.rs (local JSON)   │ │
│         │               │ • api.rs (backend sync)     │ │
│         │ invoke()      │ • types.rs                  │ │
│         └──────────────>│                             │ │
│                         └───────────────┬─────────────┘ │
└─────────────────────────────────────────┼───────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
            ┌───────▼───────┐                          ┌────────▼────────┐
            │ Hikvision     │                          │ Main Backend    │
            │ FaceID Device │                          │ (Remote VPS)    │
            │ (LAN)         │                          │                 │
            └───────────────┘                          └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7, TypeScript |
| Desktop | Tauri 1.5 (Rust) |
| Device Communication | Hikvision ISAPI |
| Local Storage | JSON file (`devices.json`) |
| Backend Sync | HTTP POST to main server |

---

## File Structure

```
apps/student-registrator/
├── src/                          # React Frontend
│   ├── App.tsx                   # Main UI component
│   ├── api.ts                    # Tauri invoke wrappers
│   ├── index.css                 # Styles
│   └── main.tsx                  # Entry point
│
├── src-tauri/                    # Tauri Rust Backend
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri config
│   └── src/
│       ├── main.rs               # Entry, registers commands
│       ├── commands.rs           # Tauri commands (IPC handlers)
│       ├── hikvision.rs          # Hikvision ISAPI client
│       ├── storage.rs            # Local device storage
│       ├── api.rs                # Main backend sync
│       └── types.rs              # Type definitions
│
├── package.json                  # NPM scripts
└── .env.example                  # Environment template
```

---

## Tauri Commands (IPC API)

Frontend `invoke()` orqali quyidagi Rust funksiyalarni chaqiradi:

### Device Management
| Command | Parameters | Returns |
|---------|------------|---------|
| `get_devices` | - | `DeviceConfig[]` |
| `create_device` | name, host, port, username, password | `DeviceConfig` |
| `update_device` | id, name, host, port, username, password | `DeviceConfig` |
| `delete_device` | id | `bool` |
| `test_device_connection` | device_id | `bool` |

### Student Registration
| Command | Parameters | Returns |
|---------|------------|---------|
| `register_student` | name, gender, face_image_base64, backend_url? | `RegisterResult` |

### User Management
| Command | Parameters | Returns |
|---------|------------|---------|
| `fetch_users` | device_id, offset?, limit? | `UserInfoSearchResponse` |
| `delete_user` | device_id, employee_no | `bool` |
| `recreate_user` | device_id, employee_no, name, gender, new_employee_no, reuse_existing_face, face_image_base64? | `RecreateUserResult` |

---

## Hikvision ISAPI Endpoints

```
Base URL: http://{host}:{port}

GET  /ISAPI/System/deviceInfo?format=json          # Test connection
POST /ISAPI/AccessControl/UserInfo/Record          # Create user
POST /ISAPI/AccessControl/UserInfo/Search          # Search users
PUT  /ISAPI/AccessControl/UserInfo/Delete          # Delete user
POST /ISAPI/Intelligent/FDLib/FaceDataRecord       # Upload face (multipart)
```

**Authentication**: Qurilmaga qarab Basic/Digest bo'lishi mumkin (bu repo’dagi joriy Rust implementatsiya Basic Auth’dan foydalanadi).

---

## Data Flow

### Student Registration
```
1. User fills form (name, gender, face image)
2. React: converts image to base64
3. React: invoke('register_student', {...})
4. Rust: iterates all configured devices
5. Rust: for each device:
   - test_connection()
   - create_user() via ISAPI
   - upload_face() via ISAPI
6. Rust: sync_student() to main backend (optional)
7. Rust: returns RegisterResult
8. React: displays results
```

---

## Local Storage

Device credentials are stored in:
```
Windows: %LOCALAPPDATA%/student-registrator/devices.json
```

Structure:
```json
[
  {
    "id": "uuid",
    "name": "Main Entrance",
    "host": "192.168.1.100",
    "port": 80,
    "username": "admin",
    "password": "..."
  }
]
```

---

## Development

```bash
# Install dependencies
npm install

# Run in development
npm run dev:desktop

# Build for production
npm run build:desktop
```

---

## Environment Variables

```env
VITE_BACKEND_URL=http://localhost:3000  # Main backend URL for sync
```

---

## Important Notes

1. **No separate server needed** - Tauri Rust backend handles everything
2. **Hikvision devices must be on LAN** - No internet access needed for devices
3. **Face image limit** - Max 200KB per image
4. **Max 6 devices** - Hardcoded limit in the app
5. **Auth (Basic/Digest)** - Hikvision qurilmasiga qarab Basic yoki Digest talab qilishi mumkin; client Basic → Digest fallback qiladi
6. **Optional backend-first provisioning** - If `VITE_BACKEND_URL` + `VITE_SCHOOL_ID` are set, the app creates the student on the Fastify backend first and reports per-device results back (supports rollback logic via status).
7. **Provisioning token** - Set `VITE_BACKEND_TOKEN` in desktop and `PROVISIONING_TOKEN` in backend to allow service-to-service calls without JWT.
8. **UI provisioning panel** - Register panel now shows backend provisioning status and allows retry for failed devices.
