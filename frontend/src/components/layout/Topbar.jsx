import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bell, Search, Sun, Moon } from 'lucide-react';
import client from '../../api/client';

const ROLE_LABELS = {
  admin: 'Administrador',
  department_head: 'Jefe de Departamento',
  agent: 'Agente',
};

export default function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '??';

  const displayRole = ROLE_LABELS[user?.role] || user?.role || '';

  const [theme, setTheme] = useState(localStorage.getItem('prismo_theme') || 'light');
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('prismo_theme', theme);
  }, [theme]);

  // Fetch notifications with polling
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = () => {
      client.get('/notifications')
        .then(res => setNotifications(res.data.notifications || []))
        .catch(err => console.error('Error fetching notifications:', err));
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Polling every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClose = () => setShowDropdown(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [showDropdown]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowDropdown(prev => !prev);
  };

  const handleNotificationClick = async (n) => {
    setShowDropdown(false);
    try {
      if (!n.is_read) {
        await client.patch(`/notifications/${n.id}/read`);
        // Update local state
        setNotifications(prev => 
          prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item)
        );
      }
      navigate(`/evaluations/${n.evaluation_id}`);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Still navigate even if the API call fails
      navigate(`/evaluations/${n.evaluation_id}`);
    }
  };

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await client.patch('/notifications/read-all');
      setNotifications(prev => prev.map(item => ({ ...item, is_read: 1 })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

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
      <div style={{ position: 'relative' }}>
        <button 
          className="btn btn--ghost btn--icon" 
          title="Notificaciones"
          onClick={toggleDropdown}
          style={{ position: 'relative' }}
        >
          <Bell size={20} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'var(--accent-danger, #ef4444)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              fontSize: '10px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {unreadCount}
            </span>
          )}
        </button>

        {showDropdown && (
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '45px',
              right: 0,
              width: '320px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Notificaciones</span>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Marcar todo como leído
                </button>
              )}
            </div>

            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
            }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                }}>
                  No tienes notificaciones
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: n.is_read ? 'transparent' : 'rgba(37, 99, 235, 0.04)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(37, 99, 235, 0.04)'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '2px',
                    }}>
                      <span className="font-semibold text-xs" style={{ color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {n.title}
                      </span>
                      {!n.is_read && (
                        <span style={{
                          width: '6px',
                          height: '6px',
                          background: 'var(--accent-primary)',
                          borderRadius: '50%',
                        }} />
                      )}
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      textAlign: 'left',
                    }}>
                      {n.message}
                    </p>
                    <span style={{
                      display: 'block',
                      marginTop: '4px',
                      fontSize: '10px',
                      color: 'var(--text-tertiary)',
                      textAlign: 'left',
                    }}>
                      {new Date(n.created_at).toLocaleString('es-MX', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
