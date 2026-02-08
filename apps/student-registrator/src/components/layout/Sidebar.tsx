import { NavLink } from 'react-router-dom';
import { Icons } from '../ui/Icons';
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
        <div className="sidebar-footer-row">
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
          </button>
          {!isCollapsed && (
            <div className="user-info-text">
              <div className="user-info-name">{user.name}</div>
              <div className="user-info-role">{user.role}</div>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={onToggle}
            title={isCollapsed ? "Ochish" : "Yopish"}
          >
            {isCollapsed ? <Icons.Menu /> : <Icons.PanelLeft />}
          </button>
        </div>
        <div className="sidebar-footer-row">
          <button className={`btn-logout ${isCollapsed ? '' : 'btn-logout-full'}`} onClick={onLogout} title="Chiqish">
            <Icons.LogOut /> {!isCollapsed && <span>Chiqish</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
