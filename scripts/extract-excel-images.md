# Extract embedded photos from Excel (iVMS-4200 prep)

iVMS-4200 odatda Excel ichidagi “embedded” rasmlarni import qilmaydi. Excel ichiga rasm qo‘shib qo‘ygan bo‘lsangiz ham, amaliy yo‘l:

1) Excel’dan person ma’lumotlarini import qilish (PersonID / Person No.)
2) Excel ichidagi rasmlarni alohida fayllarga chiqarib olish
3) Rasmlarni `PersonID_Anything.jpg` tarzida nomlash va ZIP qilib iVMS-4200’ga import qilish

Bu repo’dagi skript 2-qadamni qiladi: Excel ichidagi rasmlarni **anchori turgan qator** bo‘yicha topadi va o‘sha qatordagi `Person ID` qiymati bilan nomlab chiqadi.

## Run

```powershell
ts-node scripts/extract-excel-images.ts --input "Person Information Template.xlsx" --out ".\\out\\faces"
```

Ixtiyoriy:

```powershell
ts-node scripts/extract-excel-images.ts --input "file.xlsx" --out ".\\out\\faces" --sheet "Sheet1" --id-header "Person ID" --name-header "Name"
```

## Notes

- Rasm qaysi qatorda tursa, shu qatordagi `Person ID` bilan nomlanadi.
- Bir odamda bir nechta rasm bo‘lsa, skript `-1`, `-2` suffix qo‘shadi.
- `Person ID` header nomi sizdagi shablonda boshqacha bo‘lsa `--id-header` bilan moslang.

