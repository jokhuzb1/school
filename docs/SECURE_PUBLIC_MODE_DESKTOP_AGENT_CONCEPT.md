# Secure Public Mode + Desktop Agent (Tauri) — Konsepsiya

Maqsad: maktab LAN ichida turgan paytda desktop agent (Tauri) NVR/kameralar va FaceID qurilmalarni topadi, “remote” ishlashi uchun kerakli sozlamalarni VPS’dagi backend/MediaMTX’ga yozadi yoki qurilmalarga webhook sozlaydi. Keyin agent yopiladi va tizim uzluksiz ishlayveradi.

Bu konsepsiyada **ultra-xavfsizlik** talabi: NVR/FaceID qurilmalarga internetdan kirish **faqat VPS IP** orqali bo‘ladi (router firewall allowlist).

---

## 1) Asosiy real-cheklovlar

1. **MediaMTX oqimi “pull”**: VPS’dagi MediaMTX RTSP’ni NVR/kameradan tortib oladi va browserga WHEP/HLS beradi (NVR push qilmaydi).
2. “Agent yopilgandan keyin ham ishlashi” uchun VPS’dan NVR/FaceID’ga tarmoq yo‘li bo‘lishi shart:
   - Public mode: port-forward + firewall allowlist (faqat VPS IP).
   - FaceID attendance: webhook push (qurilma o‘zi VPS’ga yuboradi) — bu NAT uchun ham qulay.
3. ISP **CGNAT** bo‘lsa public mode ishlamaydi (VPN/agent doimiy rejim yoki boshqa kanal kerak).

---

## 2) Komponentlar

### 2.1 VPS (Cloud)
- **Backend API** (hozirgi loyiha): DB, auth, NVR/camera CRUD, ONVIF sync, MediaMTX config generatsiya/deploy.
- **MediaMTX**: RTSP pull → WebRTC (WHEP) va HLS.

### 2.2 Maktab LAN (Onboarding paytida)
- **Desktop Agent (Tauri)**: LAN discovery + remote mapping + provisioning.
  - Agent **stream relay qilmaydi** (data-plane emas), faqat “control-plane”.

---

## 3) Xavfsizlik modeli (“faqat VPS IP ruxsat”)

### 3.1 Router / Firewall siyosati (har maktabda)
Router’da quyidagilar **faqat VPS public IP**’dan kirishga ruxsat etiladi:
- RTSP port (odatda 554 yoki forward qilingan port)
- ONVIF/HTTP port (faqat ONVIF sync/health kerak bo‘lsa)

Qolgan barcha source IP’lar: **DROP**.

### 3.2 NVR/FaceID qurilma hardening
- Default admin user’larni o‘chirish yoki nomini o‘zgartirish.
- Kuchli parol (uzun, random), per-school unique.
- Keraksiz servislarni o‘chirish (UPnP, P2P cloud, telnet va h.k. imkon bo‘lsa).
- Firmware update (vendor tavsiyasiga ko‘ra).

### 3.3 Backend tomon (bizning kod bazada)
- NVR paroli DB’da shifrlangan (`passwordEncrypted`, AES‑GCM).
- RTSP URL paroli API’da default maskalanadi (faqat super-admin + explicit flag bilan to‘liq).
- Webhook secretlar URL’da bo‘lsa ham loglarda/monitoringda redaction va rotate reja bo‘lishi kerak.

---

## 4) Resurs tejamkorlik (isrofni kamaytirish)

### 4.1 MediaMTX “sourceOnDemand”
Konfiguratsiyada `sourceOnDemand: yes` bo‘lgani uchun:
- tomoshabin bo‘lmasa RTSP “pull” qilinmaydi;
- bandwidth/CPU isrof bo‘lmaydi;
- NVR resursi ham kamroq ishlaydi.

### 4.2 H.265/H.264 strategiya
- H.264: WebRTC (WHEP) juda yaxshi.
- H.265: ko‘p browserlarda native emas — HLS fallback yoki sub stream (H.264) tavsiya.

---

## 5) Desktop Agent (Tauri) ish oqimi

### 5.1 Pre-check (agent ishga tushganda)
- Agent “LAN mode” ekanini tekshiradi (masalan: gateway mavjud, private IP, yoki “school LAN” shablon CIDR).
- Agar LAN emas: scan funksiyasi yashiriladi yoki disabled.

### 5.2 LAN discovery (NVR/kamera)
Agent LAN’da quyidagilarni qiladi:
- Subnet tanlash (default: current NIC subnet).
- Port probe (misol: 80/443/554/8000/8899).
- Vendor fingerprint (HTTP response header/banner, login realm, va h.k.).
- ONVIF discovery (WS-Discovery) — agar implement qilinsa.

Natija: topilgan obyektlar ro‘yxati:
- `localIp`, `vendorGuess`, `localRtspPort`, `localHttpPort`, `localOnvifPort`, `model/serial` (imkon bo‘lsa).

### 5.3 Public mapping (admin input)
Har topilgan NVR uchun agent UI’da admin kiritadi:
- `publicHost` (DDNS yoki public IP)
- `publicRtspPort` (port-forward qilingan)
- `publicOnvifPort` (ixtiyoriy, sync kerak bo‘lsa)
- `username/password`

### 5.4 “Test from VPS” (kritik bosqich)
Agent backend’ga “test” so‘rovi yuboradi; backend esa VPS’dan:
- `probeTcp(publicHost, publicRtspPort)`
- optional: ONVIF init / deviceInfo

Test muvaffaqiyatli bo‘lsa, demak:
- router port-forward to‘g‘ri,
- firewall allowlist to‘g‘ri,
- NVR tashqaridan faqat VPS’ga ochiq.

### 5.5 Save + Sync + MediaMTX deploy
Test OK bo‘lgach:
1) backend DB’ga NVR’ni saqlaydi (publicHost/ports + encrypted password)
2) ONVIF sync (ixtiyoriy): kameralarni DB’ga tushiradi
3) MediaMTX config regenerate qiladi va deploy qiladi (deployment rejimiga qarab)

---

## 6) FaceID boshqarish (public mode + webhook)

### 6.1 Tavsiya: webhook push
FaceID qurilma attendance event’larni VPS backend’ga yuboradi:
- `/webhook/:schoolId/in?secret=...`
- `/webhook/:schoolId/out?secret=...`

Agentning vazifasi:
- LAN’da FaceID’ni topish
- admin credential bilan qurilmaga kirib, webhook URL’larni sozlab qo‘yish
- keyin agent yopiladi (qurilma o‘zi yuboradi)

### 6.2 Agar FaceID’ni VPS’dan “pull” bilan boshqarish kerak bo‘lsa
Bu NVR kabi public host + allowlist talab qiladi (firewall faqat VPS IP).

---

## 7) Operatsion checklist (Public mode)

Har maktab uchun minimal checklist:
1) DDNS (yoki static IP) tayyor: `publicHost`
2) Router port-forward:
   - RTSP (required)
   - ONVIF/HTTP (optional)
3) Router firewall allowlist:
   - **faqat VPS public IP** (RTSP/ONVIF/HTTP)
4) Backend’da NVR qo‘shiladi va `test-connection` OK chiqadi
5) ONVIF sync OK (agar ishlatilsa)
6) MediaMTX stream test: UI’da WHEP/HLS ko‘rinadi

---

## 8) Xavf tahlili va mitigatsiya (qisqa)

### 8.1 Internet exposure riski
- Risk: port-forward bo‘lsa internetdan skanerlar/bruteforce.
- Mitigatsiya: router allowlist (faqat VPS IP) — bu konsepsiyaning asosiy qismi.

### 8.2 SSRF / scanning abuse
- Agent discovery LAN’da bo‘ladi; backend esa faqat admin tasdiqlagan `publicHost`ni tekshiradi.
- Backend’ga “test from VPS” endpointlar qo‘shilsa: CIDR/hostname allowlist + rate-limit + audit talab.

### 8.3 Credential leakage
- UI/API’da RTSP parol maskalanadi.
- Loglarda URL/secret redaction.
- Secret rotation jarayoni (FaceID webhook secretlar).

---

## 9) Integratsiya nuqtalari (hozirgi kod bazaga mos)

Backend’da mavjud:
- NVR CRUD: `POST /schools/:schoolId/nvrs`
- NVR health: `POST /nvrs/:id/test-connection`
- ONVIF sync: `POST /nvrs/:id/onvif-sync`
- MediaMTX config: `GET /schools/:schoolId/mediamtx-config`
- MediaMTX deploy: `POST /schools/:schoolId/mediamtx-deploy` (deploy flaglar bilan)

Konsepsiya bo‘yicha desktop agent ishlatadigan minimal API:
- “Create NVR” (publicHost/ports/credential)
- “Test from VPS” (yangi bo‘lishi mumkin, yoki mavjud test-connectionga bog‘lash)
- “Trigger ONVIF sync”
- “Trigger MediaMTX deploy/regenerate”

---

## 10) Keyingi qadam (implementatsiya bo‘linishi)

1) Desktop Agent UI flow (scan → map → test → save)
2) Backend’da “public mapping” fieldlar va validation
3) MediaMTX deploy avtomatlashtirish (production rejimga mos)
4) FaceID webhook provisioning (agent orqali)
5) Audit + rate-limit + redaction yakunlash

---

## 11) Desktop Agent vakolatlari (faqat vakolat doirasida)

Maqsad: desktop agent “o‘zi kerakli ishlarni qiladi”, ya’ni VPS backend’ga ulanib ayrim operatsiyalarni avtomatik bajaradi, lekin **least privilege** tamoyili bilan (agent hech qachon to‘liq admin vakolatiga ega bo‘lmasin).

### 11.1 Agent autentifikatsiyasi (VPS bilan ishonchli aloqa)
Tavsiya etiladigan model:
- Agent **school-level** scoped token oladi (masalan `agent_token`) va u:
  - qisqa TTL (masalan 10–30 minut) bo‘ladi;
  - faqat bitta `schoolId` doirasida ishlaydi;
  - faqat “agent” ruxsatlari bilan cheklangan bo‘ladi.
- Token olish:
  - admin UI’dan “Agent Pairing” (QR-code yoki one-time pairing code) orqali;
  - pairing code 1 marta ishlatiladi va tez eskiradi.
- Transport: faqat HTTPS (TLS), certificate pinning (desktop tomonda) tavsiya.

### 11.2 Ruxsatlar (RBAC/Scope)
Agent uchun alohida role/scope konsepti:
- `AGENT` yoki `SCHOOL_AGENT` roli
- scope: `school:{schoolId}`
- opsionally: `capabilities` ro‘yxati (feature flags):
  - `nvr.discover` (faqat lokal discovery; VPS’da hech narsa qilmaydi)
  - `nvr.create_or_update` (NVR create/update, credential encryption server-side)
  - `nvr.test_connection_from_vps` (VPS’dan port probe)
  - `nvr.onvif_sync` (VPS’dan ONVIF sync trigger)
  - `mediamtx.config_generate` (config generate)
  - `mediamtx.deploy` (deploy faqat allowlisted mode’da; restartCommand default o‘chiq)
  - `diagnostics.run` (hisobot eksport)

**Muhim:** agentga quyidagilar berilmaydi:
- boshqa school’larni ko‘rish/boshqarish
- user/role boshqarish
- full DB export
- webhook secretlarni “list” qilish (faqat rotate/refresh kerak bo‘lsa alohida minimal endpoint bilan)

### 11.3 “O‘zi bajaradigan ishlar” (automation)
Agent UI ichida (admin tasdig‘i bilan) quyidagi workflow’larni 1 klikka birlashtirish mumkin:
- **Onboarding**: scan → map → test-from-vps → save NVR → onvif-sync → mediamtx deploy
- **Recovery** (uzilish bo‘lsa): diagnostics → muammo topish → kerakli re-deploy yoki port mapping tekshirish
- **Periodic check (manual run)**: admin agentni ochadi va “Run checks” qiladi (agent doimiy ishlamaydi).

### 11.4 Audit va kuzatuv
Agent bilan bog‘liq har bir VPS operatsiya uchun:
- audit log: `actor=agent`, `schoolId`, `requestId`, `action`, `params` (redacted)
- rate-limit (agent token uchun alohida limit)
- sensitive qiymatlar (password/secret) logga tushmasligi shart

---

## 12) MediaMTX skalalash (minglab maktablar uchun professional yechim)

Maqsad: minglab maktab va o‘n minglab kameralarni qo‘llab-quvvatlash, lekin:
- bitta ulkan `mediamtx.yml` faylga hamma kamerani yozib, bitta instance’ni “monolit” qilishdan qochish;
- resurs isrofini kamaytirish (`sourceOnDemand` asosida);
- xavfsizlikni yuqori darajada ushlash (public mode + allowlist).

### 12.1 Data-plane / Control-plane ajratish
- **Control-plane**: backend (DB, provisioning, audit, scheduler, deploy).
- **Data-plane**: MediaMTX node’lar (stream relay: RTSP pull → WHEP/HLS).

Control-plane qaysi kamera qaysi node’da xizmat qilishini belgilaydi, data-plane faqat stream qiladi.

### 12.2 Multi-node (sharding) arxitekturasi
Professional yondashuv: bir nechta MediaMTX node ishlatish.

Sharding strategiyalari:
- **Region bo‘yicha**: har hudud uchun alohida node pool (`eu-1`, `asia-1`, ...).
- **SchoolId hash bo‘yicha**: `schoolId` → node tanlash (deterministik).
- **Capacity-based**: node’lar load’iga qarab dinamik assignment (eng murakkab, lekin eng optimal).

Har bir school (yoki NVR) uchun DB’da “qaysi MediaMTX node” biriktiriladi.

### 12.3 DB modeli (konseptual)
Qo‘shimcha jadval/fieldlar:
- `MediaNode`:
  - `id`, `name`, `region`, `webrtcBaseUrl`, `hlsBaseUrl`, `rtspPullEgressIp` (VPS IP), `isActive`, `capacityWeight`
- `School.mediaNodeId` (yoki `Nvr.mediaNodeId`):
  - school darajasida bir node (sodda)
  - yoki NVR darajasida (moslashuvchan)

Izoh: `rtspPullEgressIp` field public mode’dagi router allowlist uchun “faqat shu VPS IP” tamoyilini boshqarishda kerak bo‘ladi.

### 12.4 URL routing (frontend/backend)
Hozirgi kod `WEBRTC_BASE_URL`/`MEDIAMTX_*_URL` ni bitta qiymat deb oladi. Skalalash uchun:
- `GET /cameras/:id/stream` javobida `mediaNode`’ga mos `webrtcUrl`/`hlsUrl` qaytariladi.
- Frontend “global” `MEDIAMTX_WEBRTC_URL`ga qaram bo‘lmaydi; API bergan node URL’ni ishlatadi (yoki `mediaNodeId` orqali mapping qiladi).

Natija: bitta UI, lekin har school o‘z node’iga ulanadi.

### 12.5 Konfiguratsiya strategiyasi (ultra-operatsion barqarorlik)
Monolit config o‘rniga:
- **Per-node config**: har MediaMTX node faqat o‘ziga biriktirilgan school/camera path’larni biladi.
- **Per-school “bundle”** (opsional): node config ichida school bo‘yicha segmentlangan bloklar (diagnostika osonlashadi).

Deploy oqimi:
1) backend DB’dan node bo‘yicha kamera ro‘yxatini oladi
2) `buildMediaMtxConfig(...)` ni node-specific ishlatadi
3) deploy: `ssh/docker/local` rejimlardan biri bilan (bu repo’da allaqachon bor)
4) restart/reload: imkon qadar “restartCommand” o‘chiq, faqat opsional flag bilan

### 12.6 Masshtab va limitlar (resursni nazorat qilish)
Resurs isrofini kamaytirish uchun standartlar:
- `sourceOnDemand: yes` + `sourceOnDemandCloseAfter` (hozirgi konfiguratsiya) — majburiy.
- Node bo‘yicha concurrency limit (simultaneous viewers/paths), rate-limit va queue.
- “Hot paths” (ko‘p ko‘riladigan kamera) uchun alohida node pool (opsional).

### 12.7 Monitoring va diagnostika (SRE yondashuv)
Har MediaMTX node uchun:
- health endpoint probe (HTTP) + process metrics
- active sessions (WHEP/HLS) soni, RTSP pull count, reconnect rate
- alertlar: “RTSP pull failures”, “high CPU”, “high egress”, “excessive restarts”

Desktop agentning “Diagnostics” bo‘limi node tanlangan bo‘lsa, shu node bo‘yicha ham tekshiruvlar qiladi:
- WHEP/HLS URL probe
- path mavjudligi (config deployedmi)

### 12.8 Xavfsizlik (public mode + allowlist’ni saqlab qolish)
Public mode’da asosiy qoida o‘zgarmaydi:
- NVR/RTSP/ONVIF portlari internetga ochiq bo‘lsa ham, router firewall **faqat MediaNode egress IP**’ni allowlist qiladi.
- Shuning uchun “mediaNode egress IP”lar ro‘yxati boshqariladi (minimal son, statik IP).

### 12.9 Minimal roadmap (hozirgi kod bazadan evolyutsiya)
1) `MediaNode` jadvali + `School.mediaNodeId` qo‘shish
2) `GET /cameras/:id/stream` webrtc/hls URL’ni node’dan generatsiya qilish
3) `buildLocalMediaMtxConfigFromDb()` ni node-specific qilish (per-node build)
4) deploy flow’ni node bo‘yicha trigger qilish (admin/agent capability bilan)
5) observability + alerting

---

## 13) Professional xavfsizlik va governance (V2 qo'shimcha konsepsiya)

Bu bo'lim oldingi xulosalarga tayangan holda ultra-xavfsizlik va operatsion barqarorlikni kuchaytiradi.

### 13.1 Auth va sessiya siyosati
- Dev: soddaroq login oqimi (masalan, access token JS-da) mumkin.
- Prod: faqat `httpOnly + secure + sameSite` cookie, refresh rotation va sessiya ro'yxati.
- Multi-device: bir foydalanuvchi bir nechta qurilmada ishlashi mumkin, lekin har sessiya alohida revocation qilingan bo'lishi shart.
- MFA: superadmin va mediamtx deploy vakolatlari uchun majburiy.

### 13.2 SUPER_ADMIN va MediaMTX boshqaruvi (nozik ruxsat modeli)
Superadmin barcha maktablarni ko'ra oladi, lekin MediaMTX konfiguratsiya va deploy masalasi alohida nazorat bilan bo'lishi kerak:
- Separate role: `STREAM_ADMIN` yoki `MEDIA_NODE_ADMIN` (superadmin ko'rish huquqiga ega, lekin deploy huquqi yo'q).
- Two-step approval: deploy/reload uchun tasdiq (peer approval yoki "change ticket").
- Dry-run: konfiguratsiya diff preview va syntax validation.
- Restart command: default o'chirilgan, faqat flag bilan va allowlist qilingan script.

### 13.3 Nginx va tarmoq chegaralari
- Backend oldida Nginx reverse proxy: TLS termination, rate limit, IP-based ACL.
- Webhook endpointlar uchun: secret + optional IP allowlist + strict method.
- Admin endpointlar (deploy, secrets rotate) uchun alohida rate limit va audit.

### 13.4 Public mode + CGNAT fallback
Public mode faqat router port-forward va allowlist (faqat VPS egress IP) bilan ishlaydi.
CGNAT bo'lsa 3 ta yo'l:
1) Reverse tunnel (WireGuard/OpenVPN/SSH) - tavsiya etiladi, data-plane emas, faqat control-plane.
2) Agent doimiy (data-plane relay) - resurs isrofi, faqat vaqtinchalik yechim.
3) ISP static IP - ideal, lekin qimmat.

### 13.5 Browser orqali discovery cheklovi
Browser LAN skan qila olmaydi (security sandbox). Shuning uchun:
- discovery faqat desktop agent yoki local gateway orqali;
- web UI faqat natijalarni ko'rsatadi.

### 13.6 FaceID siyosati (public inbound yo'q)
Talab: FaceID webhook public IP orqali kelmasin.
Tavsiya:
- FaceID qurilma faqat outbound webhook yuboradi (NAT ichidan chiqadi).
- Desktop agent qurilmaga webhook URL ni yozib qo'yadi.
- Agar IP kerak bo'lsa, agent LAN'da ko'rib, DB ga saqlaydi (publicga ochmasdan).

### 13.7 Upload va media saqlash siyosati
- Uploadlar faqat auth bilan.
- Event photo (FaceID eventdagi raw foto) qabul qilinmaydi.
- Faqat statik profil foto saqlanadi (masalan o'quvchi profili).
- Fayl scanning (MIME allowlist), size limit, antivirus (opsional).

### 13.8 Webhook xavfsizligi va rate limit
- Secret + timestamp + nonce (replaydan himoya).
- `idempotency key` yoki event hash.
- Rate limit: bir o'quvchi uchun X soniya ichida 1 event (global rate limit emas).

### 13.9 IP allowlist va egress IP boshqaruvi
- Router allowlistda faqat MediaNode egress IP bo'lishi kerak.
- MediaNode IP'lari statik va minimal bo'lishi kerak (ko'paymasligi uchun).
- Egress IP o'zgarsa, allowlist avtomatik yangilanish rejasi bo'lishi kerak (agent orqali tekshiruv).

### 13.10 Diagnostika va auto-recovery (desktop agent)
- Link/port check (RTSP/HTTP/ONVIF).
- NVR health probe va snapshot test.
- MediaMTX path mavjudligini tekshirish (WHEP/HLS).
- Failure bo'lsa: adminga ko'rsatma va audit yozuvi.
- Agent faqat o'z school doirasida ishlaydi.

### 13.11 Observability va audit
- Har deploy, secret rotate, webhook event uchun audit log.
- Metrics: RTSP pull failure rate, active streams, reconnect count, latency.
- Alertlar: repeated failures, suspected brute-force, secret misuse.

---

## 14) Qarorlar va yakuniy tavsiyalar (V2)

### 14.1 Tavsiya etilgan defaultlar
- Prod cookie: `httpOnly + secure + sameSite=strict`.
- Webhook: secret + timestamp + nonce.
- MediaMTX: `sourceOnDemand: yes` har doim.
- SUPER_ADMIN: ko'rish mumkin, deploy huquqi alohida role.

### 14.2 Professional tavsiyalar (yakuniy qarorlar)
1) **CGNAT strategiya**: default `Public Mode` (port-forward + allowlist) faqat static IP/real public IP bo'lsa. CGNAT aniqlansa avtomatik **reverse tunnel** (WireGuard/OpenVPN) yoqiladi. Tunnel faqat control-plane uchun, data-plane (stream relay) faqat zarurat bo'lsa va vaqtinchalik.
2) **Webhook idempotency**: qurilma `eventId` bersa shu ishlatiladi. Aks holda hash: `deviceId + eventTime + personId + direction + confidence` (eventTime 30s oynada normalizatsiya). Dedupe store: Redis/DB (TTL 5–15 min).
3) **Audit log retention**: default 180 kun, compliance talab bo'lsa 365 kun. Retention policy konfiguratsiya orqali boshqariladi.

### 14.3 Qo'shimcha aniq defaultlar (operatsion)
- Webhook clock-skew tolerance: ±120s.
- Idempotency TTL: 10 min.
- Reverse tunnel monitoring: heartbeat 30s, 3 marta fail bo'lsa admin alert.

---

## 15) Implementatsiya roadmap va professional jarayon (FSD/DDD + DRY/KISS/SOLID)

Bu bo'lim konsepsiyani real loyihaga professional tarzda yetkazish uchun fazalar, branch va quality gate'larni belgilaydi.

### 15.1 Ishni fazalarga bo'lish (tavsiya)
**Phase 0 — Audit + dizayn**  
Maqsad: mavjud kod bazani tekshirish, xavf tahlili, yakuniy scope.  
Deliverable: yakuniy konsepsiya, risk register, tech decisions.

**Phase 1 — Security hardening**  
Maqsad: auth/session, webhook security, secret handling, rate limit.  
Deliverable: prod-ready auth policy, webhook protection, audit.

**Phase 2 — MediaMTX multi-node**  
Maqsad: MediaNode DB modeli, node-aware URL routing, per-node deploy.  
Deliverable: sharding/assignment, per-node config build, deploy flow.

**Phase 3 — Desktop Agent MVP**  
Maqsad: LAN discovery, mapping, test-from-VPS, provisioning.  
Deliverable: agent onboarding workflow + minimal diagnostics.

**Phase 4 — Observability + Auto-recovery**  
Maqsad: metrics, alerts, health checks, recovery playbooks.  
Deliverable: monitoring dashboards + alert policies.

**Phase 5 — Polishing + Compliance**  
Maqsad: UX refinements, docs, privacy, retention policies.  
Deliverable: prod release checklist va qonunchilikka moslik.

### 15.2 Branch strategiya (professional yondashuv)
- Har bir faza alohida branch: `phase-1-security`, `phase-2-mediamtx`, ...
- Har fazadan so'ng **typecheck + build** majburiy (backend va frontend).
- Har faza yakunida: `git commit` (conventional format) va `git push`.
- Main branchga faqat PR orqali merge (peer review tavsiya).

### 15.3 Quality gates (har fazada)
- `typecheck` (TS) + `lint` + `unit tests`
- `build` (backend + frontend)
- Migration va config validation (mediamtx config dry-run)
- Security check: secrets redaction, webhook replay, rate limit

### 15.4 Arxitektura qoidalari (FSD + DDD)
- **Frontend (FSD)**: `entities/`, `features/`, `widgets/`, `pages/`, `shared/` qatlamlariga qat'iy amal.
- **Backend (DDD)**: domain, application, infrastructure, presentation qatlamlari ajratiladi.
- Integratsiyalar (MediaMTX, ONVIF) infrastructure layer'da bo'ladi.
- Cross-module coupling minimal, public API orqali bog'lanadi.

### 15.5 Prinsiplar (DRY / KISS / SOLID)
- **DRY**: takroriy RTSP/URL/secret logic bitta joyda.
- **KISS**: agent faqat control-plane, data-plane minimal.
- **SOLID**: servislar kichik, bitta mas'uliyatli.

### 15.6 Definition of Done (DoD)
- Typecheck + build OK
- Tests OK
- Docs updated (concept + guide)
- Security checks OK
- Monitoring hooks mavjud

---

## 16) Fazalar bo'yicha aniq tasklar (to'liq ish rejasi)

### 16.1 Phase 0 - Audit + dizayn (1-2 hafta)
- Kod bazada security audit (secrets, SSRF, mass-assignment, logging).
- Endpoint inventory + data classification (PII/secret).
- Threat model va risk register (CVE-level emas, amaliy xavflar).
- Arxitektura qarorlari: MediaNode modeli, agent pairing, webhook signature.
- Migration rejasi (DB va config).

### 16.2 Phase 1 - Security hardening (2-3 hafta)
**Backend**
- Prod auth: httpOnly cookie, refresh rotation, session revoke.
- Webhook replay himoya: timestamp + nonce + idempotency.
- Per-student rate limit va global throttling.
- Secret rotation va redaction (log/monitoring).
- Admin endpoints ACL + audit log.
**Frontend**
- Admin settings UI (secret rotate, webhook info).
- Sensitive fieldlarni hidden default.
**Infra**
- Nginx rate limit, IP ACL, TLS, HSTS.

### 16.3 Phase 2 - MediaMTX multi-node (2-4 hafta)
**Backend**
- `MediaNode` jadvali + `School.mediaNodeId`.
- Node assignment service (deterministic yoki capacity-based).
- `GET /cameras/:id/stream` node-aware URL.
- Per-node config build + deploy trigger.
**Frontend**
- Stream URL API asosida ishlashi (global env emas).
- Admin node status ko'rish paneli (minimal).
**Infra**
- MediaMTX node pool + static egress IP.

### 16.4 Phase 3 - Desktop Agent MVP (3-5 hafta)
**Agent**
- LAN scan (ports + vendor fingerprint).
- Manual mapping (publicHost/ports).
- Pairing (QR/one-time code) + scoped token.
- Test-from-VPS trigger va natija UI.
- Provisioning: NVR create + ONVIF sync + deploy.
**Backend**
- Agent scoped endpoints + audit + rate limit.

### 16.5 Phase 4 - Observability + Auto-recovery (2-3 hafta)
- Metrics (streams, failures, latency).
- Alerts (RTSP pull failures, tunnel down).
- Diagnostics workflow (agent + backend).
- Runbooks (operatsion playbook).

### 16.6 Phase 5 - Polishing + Compliance (1-2 hafta)
- UX silliqlash, onboarding checklist.
- Data retention policy (180/365) va privacy.
- Docs: user guide + ops guide.
- Release checklist + training.

### 16.7 Har faza yakuni uchun checklist
- `typecheck` + `build` + `tests`
- Security review (secrets/redaction/rate limit)
- Doc update (concept + guide)
- `git commit` + `git push` + PR review

---

## 17) Yakuniy holat va scope freeze

Ushbu konsepsiya **yakuniy** hisoblanadi. Quyidagi tamoyillar o'zgarmaydi:
- Public mode faqat VPS egress IP allowlist bilan ishlaydi.
- Desktop agent faqat control-plane, data-plane minimal.
- MediaMTX multi-node va sourceOnDemand majburiy.
- Webhook outbound-only va replay himoyali.
- FSD/DDD arxitektura va DRY/KISS/SOLID qat'iy.

**Change management**: keyingi o'zgarishlar faqat yozma change request va tasdiqdan so'ng kiritiladi.
