import { useCallback, useState } from 'react';
import {
  fetchStudentByDeviceStudentId,
  fileToFaceBase64,
  getAuthUser,
  getUserFace,
  recreateUser,
  updateStudentProfile,
  type DeviceConfig,
  type StudentProfileDetail,
  type UserInfoEntry,
} from '../../api';

type UseDeviceUserDetailParams = {
  localDevice: DeviceConfig | null;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  buildPhotoUrl: (value?: string | null) => string;
  loadUsers: (reset?: boolean) => Promise<void>;
  withBusy: (key: string, fn: () => Promise<void>) => Promise<void>;
};

type UseDeviceUserDetailReturn = {
  selectedUser: UserInfoEntry | null;
  selectedStudentDetail: StudentProfileDetail | null;
  deviceFaceMap: Record<string, string>;
  deviceFaceLoading: Record<string, boolean>;
  detailLoading: boolean;
  editFirstName: string;
  editLastName: string;
  editFatherName: string;
  editParentPhone: string;
  editClassId: string;
  editGender: 'MALE' | 'FEMALE';
  editFacePreview: string;
  isEditingUser: boolean;
  setIsEditingUser: (value: boolean | ((prev: boolean) => boolean)) => void;
  setEditFirstName: (value: string) => void;
  setEditLastName: (value: string) => void;
  setEditFatherName: (value: string) => void;
  setEditParentPhone: (value: string) => void;
  setEditClassId: (value: string) => void;
  setEditGender: (value: 'MALE' | 'FEMALE') => void;
  handleSelectUser: (user: UserInfoEntry) => Promise<void>;
  loadDeviceFace: (user: UserInfoEntry) => Promise<void>;
  closeSelectedUserDetail: () => void;
  handleFaceFileChange: (file?: File) => Promise<void>;
  handleSaveUserEdit: () => Promise<void>;
};

export function useDeviceUserDetail({
  localDevice,
  addToast,
  buildPhotoUrl,
  loadUsers,
  withBusy,
}: UseDeviceUserDetailParams): UseDeviceUserDetailReturn {
  const [selectedUser, setSelectedUser] = useState<UserInfoEntry | null>(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentProfileDetail | null>(null);
  const [deviceFaceMap, setDeviceFaceMap] = useState<Record<string, string>>({});
  const [deviceFaceLoading, setDeviceFaceLoading] = useState<Record<string, boolean>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editGender, setEditGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [editFaceBase64, setEditFaceBase64] = useState('');
  const [editFacePreview, setEditFacePreview] = useState('');
  const [isEditingUser, setIsEditingUser] = useState(false);

  const loadDeviceFace = async (user: UserInfoEntry) => {
    if (!localDevice?.id || !user.employeeNo) return;
    if (!(user.numOfFace && user.numOfFace > 0)) return;
    if (deviceFaceMap[user.employeeNo]) return;
    if (deviceFaceLoading[user.employeeNo]) return;

    setDeviceFaceLoading((prev) => ({ ...prev, [user.employeeNo]: true }));
    try {
      const face = await getUserFace(localDevice.id, user.employeeNo);
      setDeviceFaceMap((prev) => ({
        ...prev,
        [user.employeeNo]: `data:image/jpeg;base64,${face.imageBase64}`,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Qurilmadan rasmni olib bo'lmadi";
      addToast(message, 'error');
    } finally {
      setDeviceFaceLoading((prev) => ({ ...prev, [user.employeeNo]: false }));
    }
  };

  const handleSelectUser = async (user: UserInfoEntry) => {
    setSelectedUser(user);
    setSelectedStudentDetail(null);
    setIsEditingUser(false);
    setEditFaceBase64('');
    setEditFacePreview('');
    if ((user.numOfFace || 0) > 0) {
      void loadDeviceFace(user);
    }

    const auth = getAuthUser();
    if (!auth?.schoolId || !user.employeeNo) return;

    setDetailLoading(true);
    try {
      const detail = await fetchStudentByDeviceStudentId(auth.schoolId, user.employeeNo);
      setSelectedStudentDetail(detail);
      setEditFirstName(detail.firstName || '');
      setEditLastName(detail.lastName || '');
      setEditFatherName(detail.fatherName || '');
      setEditParentPhone(detail.parentPhone || '');
      setEditClassId(detail.classId || '');
      setEditGender((detail.gender || 'MALE') as 'MALE' | 'FEMALE');
      setEditFacePreview(buildPhotoUrl(detail.photoUrl));
    } catch {
      setSelectedStudentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeSelectedUserDetail = useCallback(() => {
    setSelectedUser(null);
    setSelectedStudentDetail(null);
    setIsEditingUser(false);
  }, []);

  const handleFaceFileChange = async (file?: File) => {
    if (!file) return;
    try {
      const base64 = await fileToFaceBase64(file);
      setEditFaceBase64(base64);
      setEditFacePreview(`data:image/jpeg;base64,${base64}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rasmni qayta ishlashda xato';
      addToast(message, 'error');
    }
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser?.employeeNo || !selectedStudentDetail?.id || !localDevice?.id) {
      addToast("Edit uchun ma'lumot yetarli emas", 'error');
      return;
    }

    const oldState = {
      firstName: selectedStudentDetail.firstName || '',
      lastName: selectedStudentDetail.lastName || '',
      fatherName: selectedStudentDetail.fatherName || '',
      parentPhone: selectedStudentDetail.parentPhone || '',
      classId: selectedStudentDetail.classId || '',
      gender: selectedStudentDetail.gender || 'MALE',
    };

    const fullName = `${editLastName} ${editFirstName}`.trim();
    await withBusy(`save-edit-${selectedUser.employeeNo}`, async () => {
      try {
        await updateStudentProfile(selectedStudentDetail.id, {
          firstName: editFirstName,
          lastName: editLastName,
          fatherName: editFatherName || undefined,
          parentPhone: editParentPhone || undefined,
          classId: editClassId || undefined,
          gender: editGender,
          deviceStudentId: selectedUser.employeeNo,
          faceImageBase64: editFaceBase64 || undefined,
        });

        const recreate = await recreateUser(
          localDevice.id,
          selectedUser.employeeNo,
          fullName,
          editGender.toLowerCase(),
          false,
          !editFaceBase64,
          editFaceBase64 || undefined,
        );

        if (!recreate.faceUpload?.ok) {
          throw new Error(recreate.faceUpload?.errorMsg || 'Device edit failed');
        }

        addToast('DB + Device edit muvaffaqiyatli', 'success');
        setIsEditingUser(false);
        await Promise.all([loadUsers(true), handleSelectUser({ ...selectedUser, name: fullName })]);
      } catch (err) {
        await updateStudentProfile(selectedStudentDetail.id, {
          firstName: oldState.firstName,
          lastName: oldState.lastName,
          fatherName: oldState.fatherName || undefined,
          parentPhone: oldState.parentPhone || undefined,
          classId: oldState.classId || undefined,
          gender: oldState.gender as 'MALE' | 'FEMALE',
          deviceStudentId: selectedUser.employeeNo,
        }).catch(() => undefined);
        const message = err instanceof Error ? err.message : 'Edit jarayonida xato';
        addToast(`Edit rollback: ${message}`, 'error');
      }
    });
  };

  return {
    selectedUser,
    selectedStudentDetail,
    deviceFaceMap,
    deviceFaceLoading,
    detailLoading,
    editFirstName,
    editLastName,
    editFatherName,
    editParentPhone,
    editClassId,
    editGender,
    editFacePreview,
    isEditingUser,
    setIsEditingUser,
    setEditFirstName,
    setEditLastName,
    setEditFatherName,
    setEditParentPhone,
    setEditClassId,
    setEditGender,
    handleSelectUser,
    loadDeviceFace,
    closeSelectedUserDetail,
    handleFaceFileChange,
    handleSaveUserEdit,
  };
}
