import boySampleImg from '../../assets/boy_sample.png';
import girlSampleImg from '../../assets/girl_sample.png';
import { appLogger } from '../../utils/logger';
import { getExcelJs } from './exceljs';

export async function downloadStudentsTemplate(classNames: string[]): Promise<void> {
  const ExcelJS = await getExcelJs();
  const cleanedNames = [...new Set(classNames.map((name) => name.trim()).filter(Boolean))];
  if (cleanedNames.length === 0) {
    throw new Error("Kamida bitta sinf tanlang");
  }

  const colors = {
    headerBg: "FFF1F5F9",
    headerText: "FF334155",
    border: "FFE2E8F0",
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Student Registrator";
  workbook.created = new Date();
  const validationSheet = workbook.addWorksheet("_validation");
  validationSheet.state = "veryHidden";
  validationSheet.getCell("A1").value = "Erkak";
  validationSheet.getCell("A2").value = "Ayol";
  const genderValidationFormula = "=_validation!$A$1:$A$2";

  let boyImageId: number | undefined;
  let girlImageId: number | undefined;

  try {
    const boyResponse = await fetch(boySampleImg);
    const boyArrayBuffer = await boyResponse.arrayBuffer();
    boyImageId = workbook.addImage({ buffer: boyArrayBuffer, extension: "png" });

    const girlResponse = await fetch(girlSampleImg);
    const girlArrayBuffer = await girlResponse.arrayBuffer();
    girlImageId = workbook.addImage({ buffer: girlArrayBuffer, extension: "png" });
  } catch (err) {
    appLogger.error("Template images could not be loaded:", err);
  }

  for (const className of cleanedNames) {
    const worksheet = workbook.addWorksheet(className);

    worksheet.getColumn(1).width = 5;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 20;
    worksheet.getColumn(5).width = 10;
    worksheet.getColumn(6).width = 18;
    worksheet.getColumn(7).width = 14;

    const headers = ["#", "Familiya", "Ism", "Otasining ismi", "Jinsi", "Telefon", "Photo"];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: colors.headerText } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: colors.border } },
      };
    });
    headerRow.height = 24;

    const sampleData = [
      { lastName: "Aliyev", firstName: "Vali", fatherName: "Aliyev Sobir", gender: "Erkak", phone: "+998901234567" },
      { lastName: "Karimova", firstName: "Nodira", fatherName: "Karimova Malika", gender: "Ayol", phone: "+998907654321" },
    ];

    const applyGenderValidation = (rowNumber: number, allowBlank: boolean) => {
      worksheet.getCell(`E${rowNumber}`).dataValidation = {
        type: "list",
        allowBlank,
        formulae: [genderValidationFormula],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Noto'g'ri qiymat",
        error: "Faqat Erkak yoki Ayol tanlang",
      };
    };

    sampleData.forEach((student, index) => {
      const row = worksheet.addRow([
        index + 1,
        student.lastName,
        student.firstName,
        student.fatherName,
        student.gender,
        student.phone,
        "",
      ]);

      row.height = 65;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: colNumber === 1 ? "center" : "left", vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: colors.border } },
        };
      });

      if (boyImageId !== undefined && girlImageId !== undefined) {
        const imageId = student.gender === "Erkak" ? boyImageId : girlImageId;
        const rowIndex = row.number - 1;
        worksheet.addImage(imageId, {
          tl: { col: 6, row: rowIndex },
          ext: { width: 60, height: 60 },
        });
      }

      applyGenderValidation(row.number, false);
    });

    for (let i = 0; i < 10; i++) {
      const row = worksheet.addRow([sampleData.length + i + 1, "", "", "", "", "", ""]);
      row.height = 65;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: colNumber === 1 ? "center" : "left", vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: colors.border } },
        };
      });

      applyGenderValidation(row.number, true);
    }

    for (let rowNumber = 2; rowNumber <= 500; rowNumber++) {
      applyGenderValidation(rowNumber, true);
      for (const col of ["A", "B", "C", "D", "E", "F", "G"]) {
        worksheet.getCell(`${col}${rowNumber}`).protection = { locked: false };
      }
    }

    await worksheet.protect("students-template-lock", {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      insertHyperlinks: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
      pivotTables: false,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
