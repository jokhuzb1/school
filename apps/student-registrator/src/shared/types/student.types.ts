export interface StudentRow {
  id: string;
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
  source: "manual" | "import";
  deviceStudentId?: string;
  sourceDeviceBackendId?: string;
  isEditing?: boolean;
}

export interface ExcelImportMapping {
  sheet: string;
  classId: string;
  className: string;
  rowCount: number;
}
