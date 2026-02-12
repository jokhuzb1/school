import { Icons } from '../../components/ui/Icons';
import type { AuthUser, ThemeMode } from '../../types';

interface HeaderProps {
  user: AuthUser;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogout: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Header({
  user,
  theme,
  onToggleTheme,
  onLogout,
  isSidebarCollapsed,
  onToggleSidebar,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <button
          className="sidebar-toggle header-toggle"
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? "Ochish" : "Yopish"}
        >
          {isSidebarCollapsed ? <Icons.Menu /> : <Icons.PanelLeft />}
        </button>
      </div>

      <div className="header-right">
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
        </button>

        <div className="user-info-text">
          <div className="user-info-name">{user.name}</div>
          <div className="user-info-role">{user.role}</div>
        </div>
        <button className="btn-logout" onClick={onLogout} title="Chiqish">
          <Icons.LogOut />
        </button>
      </div>
    </header>
  );
}
