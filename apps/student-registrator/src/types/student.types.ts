// Student related types

export interface StudentRow {
  id: string; // Local unique ID
  firstName: string;
  lastName: string;
  fatherName?: string;
  gender: string;
  className?: string;
  classId?: string;
  parentPhone?: string;
  imageBase64?: string;
  status: "pending" | "success" | "error";
  error?: string;
  errorCode?: string;
  errorRaw?: string;
  source: "manual" | "import"; // Qayerdan kelgani
  deviceStudentId?: string;
  sourceDeviceBackendId?: string;
  isEditing?: boolean; // Inline edit uchun
}

export interface ExcelImportMapping {
  sheet: string;
  classId: string;
  className: string;
  rowCount: number;
}
