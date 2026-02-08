import { useState } from 'react';
import { fileToBase64, syncStudentToDevices, updateStudentProfile } from '../../api';
import type { StudentDiagnosticsRow } from '../../types';

type UseStudentEditParams = {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  loadDiagnostics: () => Promise<void>;
  buildPhotoUrl: (url?: string | null) => string;
  extractNameComponents: (fullName: string) => {
    firstName: string;
    lastName: string;
    fatherName: string;
  };
};

type UseStudentEditReturn = {
  editingStudent: StudentDiagnosticsRow | null;
  editFirstName: string;
  editLastName: string;
  editFatherName: string;
  editClassId: string;
  savingEdit: boolean;
  editImagePreview: string;
  startEdit: (student: StudentDiagnosticsRow) => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<void>;
  handleEditImageChange: (file: File | null) => void;
  setEditFirstName: (value: string) => void;
  setEditLastName: (value: string) => void;
  setEditFatherName: (value: string) => void;
  setEditClassId: (value: string) => void;
};

export function useStudentEdit({
  addToast,
  loadDiagnostics,
  buildPhotoUrl,
  extractNameComponents,
}: UseStudentEditParams): UseStudentEditReturn {
  const [editingStudent, setEditingStudent] = useState<StudentDiagnosticsRow | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState('');

  const startEdit = (student: StudentDiagnosticsRow) => {
    setEditingStudent(student);
    const { firstName, lastName, fatherName } = extractNameComponents(student.studentName);
    setEditFirstName(student.firstName || firstName);
    setEditLastName(student.lastName || lastName);
    setEditFatherName(student.fatherName || fatherName);
    setEditClassId(student.classId || '');
    setEditImageFile(null);
    setEditImagePreview(student.photoUrl ? buildPhotoUrl(student.photoUrl) : '');
  };

  const cancelEdit = () => setEditingStudent(null);

  const saveEdit = async () => {
    if (!editingStudent) return;
    setSavingEdit(true);
    try {
      let faceImageBase64: string | undefined;
      if (editImageFile) {
        const base64 = await fileToBase64(editImageFile);
        faceImageBase64 = base64;
      }
      await updateStudentProfile(editingStudent.studentId, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        fatherName: editFatherName.trim() || undefined,
        classId: editClassId,
        faceImageBase64,
      });
      addToast("O'quvchi yangilandi", 'success');
      cancelEdit();
      await loadDiagnostics();

      try {
        const syncResult = await syncStudentToDevices(editingStudent.studentId);
        if (syncResult.ok) {
          addToast("Qurilmalar bilan sinxronizatsiya qilindi", 'success');
        } else {
          addToast("Qurilmalarga yuborishda xato yoki provisioning topilmadi", 'error');
        }
      } catch (syncErr) {
        console.error('Device sync error:', syncErr);
      }
    } catch (err) {
      addToast('Yangilashda xato', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditImageChange = (file: File | null) => {
    setEditImageFile(file);
    if (!file) {
      setEditImagePreview('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditImagePreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  return {
    editingStudent,
    editFirstName,
    editLastName,
    editFatherName,
    editClassId,
    savingEdit,
    editImagePreview,
    startEdit,
    cancelEdit,
    saveEdit,
    handleEditImageChange,
    setEditFirstName,
    setEditLastName,
    setEditFatherName,
    setEditClassId,
  };
}
