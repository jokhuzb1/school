import type { StudentRow } from '../../types';
import { appLogger } from '../../utils/logger';
import { splitPersonName } from '../../utils/name';
import { normalizeGenderValue } from '../../utils/person';
import { getExcelJs } from './exceljs';

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\*/, "")
    .trim()
    .toLowerCase();
}

export async function parseExcelFile(file: File): Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]> {
  const ExcelJS = await getExcelJs();
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const media = (workbook.model as { media?: Array<{ type: string; name: string; buffer: ArrayBuffer }> }).media || [];
  appLogger.debug(`[Parse] Workbook media count: ${media.length}`);

  const allRows: Omit<StudentRow, 'id' | 'source' | 'status'>[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    appLogger.debug(`[Parse] Processing sheet: "${sheetName}"`);

    const worksheetImages = worksheet.getImages();
    appLogger.debug(`[Parse] Sheet "${sheetName}" has ${worksheetImages.length} images`);
    const imageByRow: Record<number, string> = {};

    for (const img of worksheetImages) {
      const rowNum = img.range.tl.nativeRow + 1;
      const mediaIndex = typeof img.imageId === 'number' ? img.imageId : parseInt(img.imageId, 10);
      appLogger.debug(`[Parse] Image at row ${rowNum}, mediaIndex: ${mediaIndex}`);

      const mediaItem = media[mediaIndex];
      if (mediaItem && mediaItem.buffer) {
        const uint8Array = new Uint8Array(mediaItem.buffer);
        appLogger.debug(`[Parse] Image buffer size: ${uint8Array.length} bytes`);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        imageByRow[rowNum] = base64;
        appLogger.debug(`[Parse] Image added to row ${rowNum}, base64 length: ${base64.length}`);
      } else {
        appLogger.debug(`[Parse] No media found for index ${mediaIndex}`);
      }
    }

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
        const parts = splitPersonName(fullName);
        lastName = String(colLastName ? row.getCell(colLastName).value || "" : parts.lastName).trim();
        firstName = String(colFirstName ? row.getCell(colFirstName).value || "" : parts.firstName).trim();
        fatherName = String(colFatherName ? row.getCell(colFatherName).value || "" : "").trim();
        gender = normalizeGenderValue(
          String(colGender ? row.getCell(colGender).value || "unknown" : "unknown"),
        );
        parentPhone = String(colPhone ? row.getCell(colPhone).value || "" : "").trim();
      } else if (hasNumberColumn) {
        const fullName = String(row.getCell(2).value || "").trim();
        const parts = splitPersonName(fullName);
        lastName = parts.lastName;
        firstName = parts.firstName;
        fatherName = String(row.getCell(4).value || "").trim();
        gender = normalizeGenderValue(String(row.getCell(3).value || "unknown"));
        parentPhone = String(row.getCell(5).value || "").trim();
      } else {
        const fullName = String(row.getCell(1).value || "").trim();
        const parts = splitPersonName(fullName);
        lastName = parts.lastName;
        firstName = parts.firstName;
        fatherName = String(row.getCell(4).value || "").trim();
        gender = normalizeGenderValue(String(row.getCell(2).value || "unknown"));
        parentPhone = String(row.getCell(5).value || "").trim();
      }

      const fullName = `${lastName} ${firstName}`.trim();
      if (fullName) {
        appLogger.debug(`[Parse] Row ${rowNumber}: name="${fullName}", gender="${gender}", class="${sheetName}"`);
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

  appLogger.debug(`[Parse] Total rows parsed: ${allRows.length}`);
  return allRows;
}
