import { Icons } from '../ui/Icons';
import type { StudentDiagnosticsRow, SchoolDeviceInfo } from '../../types';

interface ExportButtonProps {
  students: StudentDiagnosticsRow[];
  selectedIds?: Set<string>;
  devices: SchoolDeviceInfo[];
  disabled?: boolean;
}

export function ExportButton({ students, selectedIds, devices, disabled }: ExportButtonProps) {
  const handleExport = async () => {
    // Dynamically import exceljs to avoid bundle size issues
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("O'quvchilar");

    // Filter students if selection exists
    const toExport = selectedIds && selectedIds.size > 0
      ? students.filter((s) => selectedIds.has(s.studentId))
      : students;

    // Header row
    const headers = ['#', 'Ism', 'Sinf', 'Device ID'];
    devices.forEach((d) => headers.push(d.name));
    sheet.addRow(headers);

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    // Data rows
    toExport.forEach((student, idx) => {
      const row: (string | number)[] = [
        idx + 1,
        student.studentName,
        student.className || '-',
        student.deviceStudentId || '-',
      ];

      // Add device statuses
      devices.forEach((device) => {
        const deviceStatus = student.devices.find((d) => d.deviceId === device.id);
        if (deviceStatus) {
          row.push(deviceStatus.status === 'SUCCESS' ? 'OK' : deviceStatus.status);
        } else {
          row.push('-');
        }
      });

      sheet.addRow(row);
    });

    // Auto-width columns
    sheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLength) maxLength = len;
      });
      column.width = Math.min(maxLength + 2, 40);
    });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oqvchilar-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const count = selectedIds && selectedIds.size > 0 ? selectedIds.size : students.length;

  return (
    <button
      className="button button-secondary"
      onClick={handleExport}
      disabled={disabled || students.length === 0}
      title={`${count} ta o'quvchini export qilish`}
    >
      <Icons.Download />
      Export ({count})
    </button>
  );
}
