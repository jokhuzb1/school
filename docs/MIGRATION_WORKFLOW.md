# Migratsiya Ishlash Tartibi

Bu loyiha hozir **`prisma migrate dev`** bilan to'liq ishlamaydi, sababi shadow DB'da eski migratsiyalar (`Camera` jadvali) yo'q. Data yo'qotmaslik uchun **migrate diff + deploy** ishlatiladi.

## Tavsiya etilgan ish tartibi (data saqlanadi)

1) Schema o'zgartiring (`apps/backend/prisma/schema.prisma`)
2) Migratsiya generatsiya qiling:

```powershell
npm run db:diff
```

3) Migratsiyani DB ga qo'llang:

```powershell
npm run db:deploy
```

## Eslatma
- `migrate dev` faqat reset qilinganda to'liq ishlaydi.
- Reset esa barcha data o'chiradi, shuning uchun bu tartib production va mavjud DB uchun xavfsizroq.
