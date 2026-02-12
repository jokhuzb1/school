import { Icons } from '../../components/ui/Icons';
import type { UserInfoEntry } from '../../api';

type UsersTabProps = {
  users: UserInfoEntry[];
  usersOffset: number;
  usersTotal: number;
  usersLoading: boolean;
  hasMoreUsers: boolean;
  deviceFaceMap: Record<string, string>;
  deviceFaceLoading: Record<string, boolean>;
  busyAction: string | null;
  onOpenImportWizard: () => Promise<void>;
  onLoadDeviceFace: (user: UserInfoEntry) => Promise<void>;
  onSelectUser: (user: UserInfoEntry) => Promise<void>;
  onRecreateUser: (user: UserInfoEntry) => Promise<void>;
  onDeleteUser: (employeeNo: string) => Promise<void>;
  onLoadMoreUsers: () => Promise<void>;
};

export function UsersTab({
  users,
  usersOffset,
  usersTotal,
  usersLoading,
  hasMoreUsers,
  deviceFaceMap,
  deviceFaceLoading,
  busyAction,
  onOpenImportWizard,
  onLoadDeviceFace,
  onSelectUser,
  onRecreateUser,
  onDeleteUser,
  onLoadMoreUsers,
}: UsersTabProps) {
  return (
    <div>
      <p className="notice">
        Minimal ro'yxat: {usersOffset}/{usersTotal || users.length} yuklandi. Detail ma'lumot row bosilganda olinadi.
      </p>
      <div className="form-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void onOpenImportWizard()}
          disabled={usersLoading || users.length === 0}
        >
          <Icons.Download /> Device usersni DB ga import qilish
        </button>
      </div>
      {usersLoading && <p className="notice">Userlar yuklanmoqda...</p>}
      {!usersLoading && users.length === 0 && <p className="notice">User topilmadi</p>}
      {!usersLoading && users.length > 0 && (
        <div className="device-list">
          {users.map((user) => (
            <div className="device-item" key={`${user.employeeNo}-${user.name}`}>
              <div className="device-item-header">
                {deviceFaceMap[user.employeeNo] && (
                  <img
                    src={deviceFaceMap[user.employeeNo]}
                    alt={user.name}
                    className="student-avatar"
                  />
                )}
                <strong>{user.name}</strong>
                <div className="device-item-meta">
                  <span className="badge">EmployeeNo: {user.employeeNo}</span>
                  <span className="badge">Gender: {user.gender || '-'}</span>
                  <span className={`badge ${(user.numOfFace || 0) > 0 ? 'badge-success' : 'badge-warning'}`}>
                    {(user.numOfFace || 0) > 0 ? 'Rasm bor' : 'Rasm yo\'q'}
                  </span>
                </div>
              </div>
              <div className="device-item-actions">
                <button
                  className="btn-icon"
                  title="Rasmni olish"
                  aria-label="Rasmni olish"
                  onClick={() => void onLoadDeviceFace(user)}
                  disabled={(user.numOfFace || 0) === 0 || Boolean(deviceFaceLoading[user.employeeNo])}
                >
                  <Icons.Download />
                </button>
                <button
                  className="btn-icon"
                  title="Detail"
                  aria-label="Detail"
                  onClick={() => void onSelectUser(user)}
                >
                  <Icons.Eye />
                </button>
                <button
                  className="btn-icon"
                  title="Recreate"
                  aria-label="Recreate"
                  onClick={() => void onRecreateUser(user)}
                  disabled={busyAction === `recreate-${user.employeeNo}`}
                >
                  <Icons.Refresh />
                </button>
                <button
                  className="btn-icon btn-danger"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => void onDeleteUser(user.employeeNo)}
                  disabled={busyAction === `delete-${user.employeeNo}`}
                >
                  <Icons.Trash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-actions" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void onLoadMoreUsers()}
          disabled={usersLoading || !hasMoreUsers}
        >
          <Icons.ChevronDown /> {hasMoreUsers ? 'Yana yuklash' : 'Hammasi yuklandi'}
        </button>
      </div>
    </div>
  );
}
