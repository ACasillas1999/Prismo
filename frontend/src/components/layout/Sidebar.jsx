import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  Briefcase,
  Users,
  FileSpreadsheet,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Target,
  LogOut,
  Settings,
  History,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'department_head'] },
      { to: '/reports', icon: BarChart3, label: 'Reportes', roles: ['admin', 'department_head'] },
    ],
  },
  {
    label: 'Administración',
    roles: ['admin'],
    items: [
      { to: '/departments',  icon: Building2,      label: 'Departamentos', roles: ['admin'] },
      { to: '/positions',    icon: Briefcase,       label: 'Puestos',       roles: ['admin'] },
      { to: '/users',        icon: Users,           label: 'Usuarios',      roles: ['admin'] },
      { to: '/audit',        icon: History,         label: 'Historial',     roles: ['admin'] },
    ],
  },
  {
    label: 'Evaluaciones',
    items: [
      { to: '/templates',    icon: FileSpreadsheet, label: 'Plantillas',    roles: ['admin', 'department_head'] },
      { to: '/periods',      icon: CalendarRange,   label: 'Períodos',      roles: ['admin', 'department_head'] },
      { to: '/evaluations',  icon: ClipboardCheck,  label: 'Evaluaciones',  roles: ['admin', 'department_head'] },
    ],
  },
  {
    label: 'Mi Espacio',
    items: [
      { to: '/my-evaluations', icon: ClipboardList, label: 'Mis Evaluaciones', roles: ['agent'] },
      { to: '/my-progress',    icon: Target,         label: 'Mi Progreso',      roles: ['agent'] },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const filteredSections = NAV_SECTIONS
    .filter(section => !section.roles || section.roles.includes(user?.role))
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(user?.role)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <Target size={22} color="white" strokeWidth={2.5} />
        </div>
        <span className="sidebar__logo-text">Prismo</span>
      </div>

      {/* Navigation */}
      {filteredSections.map((section, idx) => (
        <div key={idx} className="sidebar__section">
          <div className="sidebar__label">{section.label}</div>
          {section.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' active' : ''}`
              }
            >
              <item.icon size={18} strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}

      {/* Bottom section */}
      <div className="sidebar__bottom">
        <button className="sidebar__link" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <LogOut size={18} strokeWidth={1.75} />
          Cerrar Sesión
        </button>
      </div>
    </nav>
  );
}
