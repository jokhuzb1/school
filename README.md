Attendance System

Setup & run

1. Install dependencies:

```
npm install
```

2. Run Prisma migrate:

```
npm run db:migrate
```

3. Seed database:

```
npm run db:seed
```

4. Start dev server:

```
npm run dev
```

Webhook URLs: use `/webhook/:schoolId/in` and `/webhook/:schoolId/out` (see `/schools/:id/webhook-info`).

Production notes:
- Set `JWT_SECRET`, `CORS_ORIGINS`, `SSE_TOKEN_TTL_SECONDS`, and `REDIS_URL` (for horizontal scale pub/sub).
- SSE uses short-lived tokens via `/auth/sse-token` when `NODE_ENV=production`.
- Webhook secrets are enforced in production (query param `secret` or header `x-webhook-secret`).

NVR setup (camera management)

- Add `CREDENTIALS_SECRET` (used to encrypt NVR passwords). In production it is required.
- Create NVR: `POST /schools/:schoolId/nvrs`
- Health check: `POST /nvrs/:id/test-connection`
- Sync areas/cameras manually: `POST /nvrs/:id/sync`
- List cameras: `GET /schools/:schoolId/cameras`
- List areas: `GET /schools/:schoolId/camera-areas`

Sample NVR payload:

```json
{
  "name": "Main NVR",
  "vendor": "ONVIF",
  "model": "8232C",
  "host": "192.168.1.50",
  "httpPort": 80,
  "onvifPort": 80,
  "rtspPort": 554,
  "username": "admin",
  "password": "secret",
  "protocol": "ONVIF",
  "isActive": true
}
```

Sample sync payload:

```json
{
  "areas": [
    { "name": "Entrance", "externalId": "area-1" },
    { "name": "Backyard", "externalId": "area-2" }
  ],
  "cameras": [
    {
      "name": "Gate Cam",
      "externalId": "cam-001",
      "channelNo": 1,
      "streamUrl": "rtsp://user:pass@192.168.1.50:554/Streaming/Channels/101",
      "status": "ONLINE",
      "areaExternalId": "area-1"
    }
  ]
}
```

WebRTC (Hikvision standard)

- This project returns WHEP URLs at `GET /cameras/:id/stream`.
- You must run a WebRTC/RTSP relay (recommended: MediaMTX).
- Set `WEBRTC_BASE_URL` to your MediaMTX host (e.g. `http://localhost:8889`).
- For each camera, create a MediaMTX path that pulls from its RTSP URL.

Example MediaMTX path (one camera):

```yaml
paths:
  schools/school-1/cameras/cam-1:
    source: rtsp://user:pass@192.168.1.50:554/Streaming/Channels/101
```

The UI will request WHEP at `WEBRTC_BASE_URL + /schools/<schoolId>/cameras/<cameraId|externalId>/whep`.

Security note:
- RTSP URLs returned by the API are masked by default to avoid password leakage. Only `SUPER_ADMIN` can request the full RTSP URL by adding `?includeRtspPassword=true` to `GET /cameras/:id/stream` (and to `POST /schools/:schoolId/preview-rtsp-url`).

ONVIF Auto-Sync

- Endpoint: `POST /nvrs/:id/onvif-sync`
- It reads ONVIF profiles and creates/updates cameras with stream URLs.
- For Hikvision NVRs, channel numbers are parsed from RTSP (e.g. `/Streaming/Channels/101` -> channel 1).
- Timeout and concurrency are controlled by `ONVIF_TIMEOUT_MS` and `ONVIF_CONCURRENCY`.

MediaMTX Config Export (UI)

- In UI -> NVR tab -> "MediaMTX Config" downloads a ready YAML file.
- Upload it to your MediaMTX server and restart MediaMTX.
- School-wide config is available at `GET /schools/:schoolId/mediamtx-config`.

MediaMTX Deploy (UI)

- If `MEDIAMTX_DEPLOY_ENABLED=true`, UI can deploy config via SSH or Docker.
- Local deploy writes the config to a local path and can optionally run a restart command.
- Endpoints:
  - `POST /nvrs/:id/mediamtx-deploy`
  - `POST /schools/:schoolId/mediamtx-deploy`

WebRTC ICE (STUN/TURN)

- Configure in UI (Cameras -> NVR tab -> "WebRTC sozlama") or via `VITE_WEBRTC_ICE_SERVERS`.
- Example: `[{"urls":"stun:stun.l.google.com:19302"}]`

Excel (iVMS-4200 face import prep)

- Extract embedded images and name by `Person ID`:
  - `npm run excel:extract-images -- --input "<file.xlsx>" --out ".\\out\\faces" [--sheet "<sheet>"] [--id-header "Person ID"] [--name-header "Name"]`
  - Docs: `scripts/extract-excel-images.md`

- Simple web UI (upload XLSX → download ZIP):
  - Open: `GET /tools/excel-face-export`
