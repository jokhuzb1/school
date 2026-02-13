import { NavLink } from 'react-router-dom';
import { Icons } from '../../components/ui/Icons';
import type { AuthUser, ThemeMode } from '../../types';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  user: AuthUser;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  user,
  theme,
  onToggleTheme,
  onLogout,
}: SidebarProps) {
  const navItems = [
    { to: '/add-students', icon: <Icons.Plus />, label: "O'quvchi qo'shish" },
    { to: '/students', icon: <Icons.Users />, label: "O'quvchilar" },
    { to: '/classes', icon: <Icons.School />, label: "Sinflar" },
    { to: '/devices', icon: <Icons.Monitor />, label: "Qurilmalar" },
    { to: '/audit-logs', icon: <Icons.FileSpreadsheet />, label: "Audit loglar" },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Icons.School />
          {!isCollapsed && <span>Student Registrator</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {!isCollapsed && <span className="sidebar-link-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar" title={user.name}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          )}
          {!isCollapsed && (
            <button className="btn-logout-mini" onClick={onLogout} title="Chiqish">
              <Icons.LogOut />
            </button>
          )}
        </div>

        <div className="sidebar-controls">
          <button
            className="control-btn"
            onClick={onToggleTheme}
            title={theme === "light" ? "Tungi rejim" : "Kunduzgi rejim"}
          >
            {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
          </button>

          {isCollapsed && (
            <button className="control-btn logout-collapsed" onClick={onLogout} title="Chiqish">
              <Icons.LogOut />
            </button>
          )}

          <button
            className="control-btn"
            onClick={onToggle}
            title={isCollapsed ? "Ochish" : "Yopish"}
          >
            {isCollapsed ? <Icons.Menu /> : <Icons.PanelLeft />}
          </button>
        </div>
      </div>
    </aside>
  );
}
