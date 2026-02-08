import ExcelJS from "exceljs";
import boySampleImg from "../assets/boy_sample.png";
import girlSampleImg from "../assets/girl_sample.png";
import type { StudentRow } from '../types';

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\*/, "")
    .trim()
    .toLowerCase();
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = String(fullName || "").trim();
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
}

function normalizeGenderValue(value: string): "male" | "female" | "unknown" {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "unknown";
  if (["male", "erkak", "m", "1"].includes(v)) return "male";
  if (["female", "ayol", "f", "2"].includes(v)) return "female";
  return "unknown";
}

// Excel parse qilish (App.tsx dan ko'chirilgan)
export async function parseExcelFile(file: File): Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  // Get images from workbook
  const media = (workbook.model as { media?: Array<{ type: string; name: string; buffer: ArrayBuffer }> }).media || [];
  console.log(`[Parse] Workbook media count: ${media.length}`);
  
  const allRows: Omit<StudentRow, 'id' | 'source' | 'status'>[] = [];
  
  // Process each worksheet (each represents a class)
  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    console.log(`[Parse] Processing sheet: "${sheetName}"`);
    
    // Create image map by row for this worksheet
    const worksheetImages = worksheet.getImages();
    console.log(`[Parse] Sheet "${sheetName}" has ${worksheetImages.length} images`);
    const imageByRow: Record<number, string> = {};
    
    for (const img of worksheetImages) {
      const rowNum = img.range.tl.nativeRow + 1; // 1-indexed
      const mediaIndex = typeof img.imageId === 'number' ? img.imageId : parseInt(img.imageId, 10);
      console.log(`[Parse] Image at row ${rowNum}, mediaIndex: ${mediaIndex}`);
      
      const mediaItem = media[mediaIndex];
      if (mediaItem && mediaItem.buffer) {
        const uint8Array = new Uint8Array(mediaItem.buffer);
        console.log(`[Parse] Image buffer size: ${uint8Array.length} bytes`);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        imageByRow[rowNum] = base64;
        console.log(`[Parse] Image added to row ${rowNum}, base64 length: ${base64.length}`);
      } else {
        console.log(`[Parse] No media found for index ${mediaIndex}`);
      }
    }
    
    // Find data start row
    let dataStartRow = 2;
    let headerRowNumber = 1;
    
    worksheet.eachRow((row, rowNumber) => {
      const firstCell = String(row.getCell(1).value || "").trim();
      const normalized = normalizeHeader(firstCell);
      if (
        firstCell === "#" ||
        normalized === "name" ||
        normalized === "full name" ||
        normalized === "familiya" ||
        normalized === "last name"
      ) {
        dataStartRow = rowNumber + 1;
        headerRowNumber = rowNumber;
      }
    });

    const headerRow = worksheet.getRow(headerRowNumber);
    const headerMap = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const key = normalizeHeader(String(cell.value || ""));
      if (!key) return;
      if (!headerMap.has(key)) headerMap.set(key, colNumber);
    });

    const colLastName = headerMap.get("familiya") ?? headerMap.get("last name");
    const colFirstName = headerMap.get("ism") ?? headerMap.get("first name");
    const colFatherName =
      headerMap.get("otasining ismi") ??
      headerMap.get("father name");
    const colGender = headerMap.get("jinsi") ?? headerMap.get("gender");
    const colPhone = headerMap.get("telefon") ?? headerMap.get("parent phone");
    const colFullName = headerMap.get("full name") ?? headerMap.get("name");

    // Parse data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;
      
      const hasNumberColumn = String(row.getCell(1).value || "").trim().match(/^\d+$/);
      
      let firstName = "";
      let lastName = "";
      let fatherName = "";
      let gender = "unknown";
      let parentPhone = "";

      if (colLastName || colFirstName || colFullName) {
        const fullName = colFullName ? String(row.getCell(colFullName).value || "").trim() : "";
        const parts = splitFullName(fullName);
        lastName = String(colLastName ? row.getCell(colLastName).value || "" : parts.lastName).trim();
        firstName = String(colFirstName ? row.getCell(colFirstName).value || "" : parts.firstName).trim();
        fatherName = String(colFatherName ? row.getCell(colFatherName).value || "" : "").trim();
        gender = normalizeGenderValue(
          String(colGender ? row.getCell(colGender).value || "unknown" : "unknown"),
        );
        parentPhone = String(colPhone ? row.getCell(colPhone).value || "" : "").trim();
      } else if (hasNumberColumn) {
        const fullName = String(row.getCell(2).value || "").trim();
        const parts = splitFullName(fullName);
        lastName = parts.lastName;
        firstName = parts.firstName;
        fatherName = String(row.getCell(4).value || "").trim();
        gender = normalizeGenderValue(String(row.getCell(3).value || "unknown"));
        parentPhone = String(row.getCell(5).value || "").trim();
      } else {
        const fullName = String(row.getCell(1).value || "").trim();
        const parts = splitFullName(fullName);
        lastName = parts.lastName;
        firstName = parts.firstName;
        fatherName = String(row.getCell(4).value || "").trim();
        gender = normalizeGenderValue(String(row.getCell(2).value || "unknown"));
        parentPhone = String(row.getCell(5).value || "").trim();
      }
      
      const fullName = `${lastName} ${firstName}`.trim();
      if (fullName && !fullName.startsWith("📚") && !fullName.startsWith("📖") && !fullName.startsWith("💡")) {
        console.log(`[Parse] Row ${rowNumber}: name="${fullName}", gender="${gender}", class="${sheetName}"`);
        allRows.push({
          firstName,
          lastName,
          fatherName: fatherName || undefined,
          gender,
          className: sheetName,
          parentPhone: parentPhone || undefined,
          imageBase64: imageByRow[rowNumber],
        });
      }
    });
  }
  
  console.log(`[Parse] Total rows parsed: ${allRows.length}`);
  return allRows;
}

export async function downloadStudentsTemplate(classNames: string[]): Promise<void> {
  // Remove duplicates and empty values
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
    console.error("Template images could not be loaded:", err);
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

    // Reserve additional rows with strict gender validation
    for (let rowNumber = 2; rowNumber <= 500; rowNumber++) {
      applyGenderValidation(rowNumber, true);
      for (const col of ["A", "B", "C", "D", "E", "F", "G"]) {
        worksheet.getCell(`${col}${rowNumber}`).protection = { locked: false };
      }
    }

    // Keep data-entry range editable, but protect validation/rules from being modified.
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

