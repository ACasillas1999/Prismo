import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, Search, Sun, Moon } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Administrador',
  department_head: 'Jefe de Departamento',
  agent: 'Agente',
};

export default function Topbar() {
  const { user } = useAuth();

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '??';

  const displayRole = ROLE_LABELS[user?.role] || user?.role || '';

  const [theme, setTheme] = useState(localStorage.getItem('prismo_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('prismo_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="topbar">
      {/* Search (placeholder for future) */}
      <div className="flex items-center gap-3" style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-sm)',
          width: '280px',
        }}>
          <Search size={16} />
          <span>Buscar...</span>
        </div>
      </div>

      <div className="topbar__spacer" />

      {/* Theme Toggle */}
      <button className="btn btn--ghost btn--icon" title="Cambiar tema" onClick={toggleTheme}>
        {theme === 'light' ? <Moon size={20} strokeWidth={1.75} /> : <Sun size={20} strokeWidth={1.75} />}
      </button>

      {/* Notifications */}
      <button className="btn btn--ghost btn--icon" title="Notificaciones">
        <Bell size={20} strokeWidth={1.75} />
      </button>

      {/* User info */}
      <div className="topbar__user">
        <div className="topbar__avatar">{initials}</div>
        <div className="topbar__user-info">
          <span className="topbar__user-name">
            {user?.first_name} {user?.last_name}
          </span>
          <span className="topbar__user-role">{displayRole}</span>
        </div>
      </div>
    </header>
  );
}
