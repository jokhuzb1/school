import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import type { AuthUser, ThemeMode } from '../../types';

interface LayoutProps {
  user: AuthUser;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({ user, theme, onToggleTheme, onLogout, children }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
      />
      <div className="main-container">
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
