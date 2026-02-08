import { Icons } from '../../components/ui/Icons';
import type { StudentProfileDetail, UserInfoEntry } from '../../api';

type UserDetailModalProps = {
  selectedUser: UserInfoEntry | null;
  selectedStudentDetail: StudentProfileDetail | null;
  detailLoading: boolean;
  isEditingUser: boolean;
  editFirstName: string;
  editLastName: string;
  editFatherName: string;
  editParentPhone: string;
  editClassId: string;
  editGender: 'MALE' | 'FEMALE';
  editFacePreview: string;
  deviceFaceMap: Record<string, string>;
  busyAction: string | null;
  buildPhotoUrl: (value?: string | null) => string;
  onClose: () => void;
  onToggleEdit: () => void;
  onSave: () => Promise<void>;
  onFaceFileChange: (file?: File) => Promise<void>;
  onEditFirstNameChange: (value: string) => void;
  onEditLastNameChange: (value: string) => void;
  onEditFatherNameChange: (value: string) => void;
  onEditParentPhoneChange: (value: string) => void;
  onEditClassIdChange: (value: string) => void;
  onEditGenderChange: (value: 'MALE' | 'FEMALE') => void;
};

export function UserDetailModal({
  selectedUser,
  selectedStudentDetail,
  detailLoading,
  isEditingUser,
  editFirstName,
  editLastName,
  editFatherName,
  editParentPhone,
  editClassId,
  editGender,
  editFacePreview,
  deviceFaceMap,
  busyAction,
  buildPhotoUrl,
  onClose,
  onToggleEdit,
  onSave,
  onFaceFileChange,
  onEditFirstNameChange,
  onEditLastNameChange,
  onEditFatherNameChange,
  onEditParentPhoneChange,
  onEditClassIdChange,
  onEditGenderChange,
}: UserDetailModalProps) {
  if (!selectedUser) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-provisioning user-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>User detail</h3>
            <p className="text-secondary text-xs">{selectedUser.employeeNo}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icons.X />
          </button>
        </div>
        <div className="modal-body user-detail-modal-body">
          <div className="user-detail-grid">
            <div className="user-detail-main">
              <div className="user-detail-kv">
                <p><strong>Ism:</strong> {selectedUser.name}</p>
                <p><strong>EmployeeNo:</strong> {selectedUser.employeeNo}</p>
                <p><strong>Gender:</strong> {selectedUser.gender || '-'}</p>
                <p><strong>Face count:</strong> {selectedUser.numOfFace ?? '-'}</p>
              </div>
              {detailLoading && <p className="notice">DB detail yuklanmoqda...</p>}
              {!detailLoading && !selectedStudentDetail && (
                <p className="notice notice-warning">DB da mos o'quvchi topilmadi (device-only user).</p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={onToggleEdit}
                  disabled={!selectedStudentDetail}
                  title={!selectedStudentDetail ? "Avval user DB bilan bog'langan bo'lishi kerak" : ''}
                >
                  <Icons.Edit /> {isEditingUser ? 'Editni yopish' : 'DB + Device Edit'}
                </button>
              </div>
              {!detailLoading && selectedStudentDetail && (
                <div className="user-detail-db-card">
                  <p><strong>DB Student ID:</strong> {selectedStudentDetail.id}</p>
                  <p><strong>Sinf:</strong> {selectedStudentDetail.class?.name || '-'}</p>
                  <p><strong>Telefon:</strong> {selectedStudentDetail.parentPhone || '-'}</p>
                </div>
              )}
              {isEditingUser && selectedStudentDetail && (
                <div className="user-detail-form">
                  <div className="form-group">
                    <label>Familiya</label>
                    <input className="input" value={editLastName} onChange={(e) => onEditLastNameChange(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ism</label>
                    <input className="input" value={editFirstName} onChange={(e) => onEditFirstNameChange(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Otasining ismi</label>
                    <input className="input" value={editFatherName} onChange={(e) => onEditFatherNameChange(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Telefon</label>
                    <input className="input" value={editParentPhone} onChange={(e) => onEditParentPhoneChange(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Class ID</label>
                    <input className="input" value={editClassId} onChange={(e) => onEditClassIdChange(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Jins</label>
                    <select
                      className="input"
                      value={editGender}
                      onChange={(e) => onEditGenderChange(e.target.value as 'MALE' | 'FEMALE')}
                    >
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                    </select>
                  </div>
                  <div className="form-group user-detail-form-wide">
                    <label>Yangi rasm (ixtiyoriy)</label>
                    <input
                      className="input"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => void onFaceFileChange(e.target.files?.[0])}
                    />
                  </div>
                  <div className="form-actions user-detail-form-wide">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => void onSave()}
                      disabled={busyAction === `save-edit-${selectedUser.employeeNo}`}
                    >
                      <Icons.Save /> Saqlash (DB + Device)
                    </button>
                  </div>
                </div>
              )}
            </div>
            <aside className="user-detail-side">
              {selectedStudentDetail?.photoUrl && !editFacePreview && (
                <img src={buildPhotoUrl(selectedStudentDetail.photoUrl)} alt="student" className="user-detail-image" />
              )}
              {!selectedStudentDetail?.photoUrl && !editFacePreview && deviceFaceMap[selectedUser.employeeNo] && (
                <img src={deviceFaceMap[selectedUser.employeeNo]} alt="device face" className="user-detail-image" />
              )}
              {editFacePreview && (
                <img src={editFacePreview} alt="student preview" className="user-detail-image" />
              )}
              {!selectedStudentDetail?.photoUrl && !deviceFaceMap[selectedUser.employeeNo] && !editFacePreview && (
                <div className="user-detail-image-empty">Rasm mavjud emas</div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
