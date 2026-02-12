import type React from "react";
import type { MessageInstance } from "antd/es/message/interface";
import { studentsService } from "@entities/student";

type ImportErrorItem = { row: number; message: string };

type CreateStudentsFileActionsParams = {
  schoolId: string | null;
  message: MessageInstance;
  allowCreateMissingClass: boolean;
  fetchStudents: () => Promise<void>;
  setImportErrors: React.Dispatch<React.SetStateAction<ImportErrorItem[]>>;
  setImportErrorOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const createStudentsFileActions = ({
  schoolId,
  message,
  allowCreateMissingClass,
  fetchStudents,
  setImportErrors,
  setImportErrorOpen,
}: CreateStudentsFileActionsParams) => {
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId) return;
    const hide = message.loading("Yuklanmoqda...", 0);
    try {
      const result = await studentsService.importExcel(schoolId, file, {
        createMissingClass: allowCreateMissingClass,
      });
      const skipped = result.skipped || 0;
      const errors = result.errors || [];
      if (errors.length > 0) {
        message.warning(`${result.imported} ta yuklandi, ${skipped} ta o'tkazib yuborildi`);
        setImportErrors(errors);
        setImportErrorOpen(true);
      } else {
        message.success(`${result.imported} ta o'quvchi yuklandi`);
      }
      await fetchStudents();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Yuklashda xatolik. Fayl formatini tekshiring.");
    } finally {
      hide();
      e.target.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    if (!schoolId) return;
    try {
      const blob = await studentsService.downloadTemplate(schoolId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "talabalar-shablon.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      message.error("Shablonni yuklab bo'lmadi");
    }
  };

  const handleExport = async () => {
    if (!schoolId) return;
    try {
      const blob = await studentsService.exportExcel(schoolId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `students-${schoolId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success("Eksport muvaffaqiyatli");
    } catch {
      message.error("Eksport xatolik");
    }
  };

  return {
    handleImport,
    handleDownloadTemplate,
    handleExport,
  };
};

