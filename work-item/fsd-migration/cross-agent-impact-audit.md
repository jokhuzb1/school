# Cross-Agent Impact Audit (2026-02-12)

## Scope
- Maqsad: backend agentlar kiritgan o'zgarishlar frontend FSD migratsiyaga ta'sir qilgan-qilmaganini tekshirish.
- Tekshiruv sohasi:
  - `apps/frontend/src/**` API chaqiriqlari
  - `src/modules/*/interfaces/http/*.routes.ts` backend endpointlari
  - `server.ts` va `src/app/server/*` route registratsiya wiring
  - `work-item/fsd-migration/**` hujjat qatlamlari

## Findings

### 1) Backend strukturaviy refaktor tasdiqlandi
- `src/modules/*/presentation/*.routes.ts` fayllarining asosiy qismi thin-wrapper holatiga o'tgan:
  - `export { default ... } from "../interfaces/http/*.routes"`
- `server.ts` bootstrap `src/app/server/start-server.ts`ga ko'chirilgan.
- Route registration/prefixlar `src/app/server/create-server.ts`da saqlangan.

### 2) Frontend FSD qatlamiga to'g'ridan-to'g'ri ta'sir aniqlanmadi
- `git status --short apps/frontend` bo'yicha o'zgarish yo'q.
- Frontend gate'lar PASS:
  - `npm run typecheck` (`apps/frontend`) PASS
  - `npm run build` (`apps/frontend`) PASS
  - `npm run lint` (`apps/frontend`) PASS (6 warning, oldingi holat bilan bir xil)
  - `300-line scan` PASS

### 3) Endpoint contract diff (frontend vs backend)
- Backend (`interfaces/http`) endpointlar soni: `98`
- Frontend (`api.*`) endpoint chaqiriqlari: `70`
- Prefix-aware diffdan keyin mos kelmagan endpointlar: `1`
  - `DELETE /schools/:id` (frontendda mavjud, backendda yo'q)

#### Muhim izoh
- `DELETE /schools/:id` nomutanosibligi yangi backend refaktor natijasi emas.
- `HEAD~1`dagi eski `src/modules/schools/presentation/schools.routes.ts`da ham bu endpoint bo'lmagan.
- Xulosa: bu eski (pre-existing) contract gap, cross-agent regressiya sifatida baholanmadi.

### 4) Work-item izolyatsiyasi
- Boshqa agentlarning work-item o'zgarishlari faqat:
  - `work-item/fsd-migration/backend-ddd/ddd-map.md`
  - `work-item/fsd-migration/backend-ddd/implementation-plan.md`
  - `work-item/fsd-migration/backend-ddd/tasks.md`
- Frontend FSD hujjatlariga (`work-item/fsd-migration/tasks.md`, `work-item/fsd-migration/implementation-plan.md`, `work-item/fsd-migration/fsd-map.md`) konflikt topilmadi.

### 5) Apps-separation bo'yicha so'nggi `unstaged` diff re-auditi
- Kuzatilgan fayllar:
  - `README.md`
  - `apps/backend/src/app/runtime/paths.ts`
  - `apps/backend/src/config.ts`
  - `work-item/fsd-migration/apps-separation/apps-map.md`
  - `work-item/fsd-migration/apps-separation/tasks.md`
- Mazmuniy ta'sir:
  - Backend `.env` yuklash yo'li app-local (`apps/backend/.env`) prioritetga o'tgan, fallback root `.env` saqlangan.
  - Root `package.json`/`package-lock.json` olib tashlangan mode hujjatlashtirilgan (to'liq app-local package management).
  - Frontend source qatlamida kod diff topilmadi.
- Re-check gate natijalari:
  - `npm run typecheck` (`apps/frontend`) PASS
  - `npm run build` (`apps/frontend`) PASS
  - `300-line scan` (`apps/frontend/src/**/*.{ts,tsx,css}`) PASS
  - `npm run typecheck` (`apps/backend`) PASS
  - `npm run build` (`apps/backend`) PASS

## Conclusion
- Hozirgi snapshot bo'yicha backend agentlar o'zgarishlari frontend FSD migratsiyani buzmagan.
- Joriy risk: keyingi backend commitlarda API contract drift paydo bo'lishi mumkin (ayniqsa `schools` delete flow bo'yicha follow-up ochiq).
- Tavsiya: backend yakuniy bosqichdan keyin shu auditni qayta ishlatish (same-day contract recheck).
