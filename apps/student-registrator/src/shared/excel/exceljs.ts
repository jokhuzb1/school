type ExcelJsModule = typeof import("exceljs");

export async function getExcelJs(): Promise<ExcelJsModule> {
  return import("exceljs");
}
