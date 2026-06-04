import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Eye
} from 'lucide-react';
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isSameDay, 
  parseISO, addMonths, subMonths 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const STATUS_LABELS = {
  pending: 'Pendiente', in_progress: 'En Progreso', submitted: 'Enviada',
  reviewed: 'Revisada', completed: 'Completada',
};

const STATUS_VARIANTS = {
  pending: 'neutral', in_progress: 'warning', submitted: 'secondary',
  reviewed: 'primary', completed: 'success',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => { setCurrentDate(addMonths(currentDate, 1)); setSelectedDate(null); };
  const prevMonth = () => { setCurrentDate(subMonths(currentDate, 1)); setSelectedDate(null); };

  useEffect(() => {
    client.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error('Error fetching stats:', err))
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: user?.role === 'admin' ? 'Departamentos' : 'Mi Departamento', value: stats?.departmentsCount || 0, icon: LayoutDashboard, variant: 'primary' },
    { label: 'Agentes Activos', value: stats?.activeAgentsCount || 0, icon: Users, variant: 'secondary' },
    { label: 'Evaluaciones Activas', value: stats?.activeEvaluationsCount || 0, icon: ClipboardCheck, variant: 'warning' },
    { label: 'Promedio General', value: `${stats?.generalAverage || 0}%`, icon: TrendingUp, variant: 'success' },
  ];

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--accent-success)';
    if (score >= 60) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pendiente', in_progress: 'En Progreso', submitted: 'Enviada',
      reviewed: 'Revisada', completed: 'Completada',
    };
    return labels[status] || status;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">
            Bienvenido, {user?.first_name} 👋
          </h1>
          <p className="page-header__subtitle">
            Aquí tienes un resumen general del sistema de evaluación.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid-4 mb-6">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                className="kpi-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                <div className={`kpi-card__icon kpi-card__icon--${kpi.variant}`}>
                  <kpi.icon size={22} />
                </div>
                <span className="kpi-card__label">{kpi.label}</span>
                <span className="kpi-card__value">{kpi.value}</span>
              </motion.div>
            ))}
          </div>

          <div className="grid-2">
            {/* Calendar */}
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <div className="calendar-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <div className="calendar-header">
                  <button className="btn btn--icon btn--ghost" onClick={prevMonth}><ChevronLeft size={20} /></button>
                  <h3 className="font-semibold capitalize text-lg">
                    {format(currentDate, 'MMMM yyyy', { locale: es })}
                  </h3>
                  <button className="btn btn--icon btn--ghost" onClick={nextMonth}><ChevronRight size={20} /></button>
                </div>
                <div className="calendar-grid">
                  {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
                    <div key={d} className="calendar-day-header">{d}</div>
                  ))}
                  {days.map(day => {
                    const dayEvals = (stats?.pendingEvaluations || []).filter(ev => ev.deadline && isSameDay(parseISO(ev.deadline), day));
                    const isMuted = !isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    
                    return (
                      <div 
                        key={day.toString()}
                        className={`calendar-day ${isMuted ? 'calendar-day--muted' : ''} ${isToday ? 'calendar-day--today' : ''} ${isSelected ? 'calendar-day--selected' : ''}`}
                        onClick={() => setSelectedDate(isSelected ? null : day)}
                      >
                        <span className="calendar-day__num">{format(day, 'd')}</span>
                        {dayEvals.slice(0,2).map(ev => (
                          <div key={ev.id} className={`calendar-marker calendar-marker--${STATUS_VARIANTS[ev.status] || 'primary'}`} title={`${ev.first_name} - ${ev.template_name}`}>
                            {ev.first_name}
                          </div>
                        ))}
                        {dayEvals.length > 2 && (
                          <div className="calendar-marker" style={{background: 'transparent', border: 'none', color: 'var(--text-secondary)'}}>
                            +{dayEvals.length - 2} más
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Pending Evals Summary */}
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="card__header" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3 className="card__title capitalize">
                    Pendientes {selectedDate ? format(selectedDate, "d 'de' MMMM", {locale: es}) : `en ${format(currentDate, "MMMM", {locale: es})}`}
                  </h3>
                  <p className="card__subtitle mt-1">Evaluaciones por vencer</p>
                </div>
                {selectedDate && (
                  <button className="btn btn--sm btn--ghost" onClick={() => setSelectedDate(null)}>
                    Ver todo el mes
                  </button>
                )}
              </div>

              {(() => {
                const pendingEvals = stats?.pendingEvaluations || [];
                const displayedPending = pendingEvals.filter(ev => {
                  if (!ev.deadline) return false;
                  const evDate = parseISO(ev.deadline);
                  return selectedDate ? isSameDay(evDate, selectedDate) : isSameMonth(evDate, currentDate);
                });

                if (displayedPending.length === 0) {
                  return (
                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                      <div className="empty-state__icon"><CalendarIcon size={28} /></div>
                      <p className="empty-state__title">Libre de pendientes</p>
                      <p className="empty-state__description">
                        No hay evaluaciones por vencer en esta fecha.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="data-table-wrapper" style={{ margin: 'calc(var(--space-4) * -1)' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Agente</th>
                          <th>Plantilla / Vencimiento</th>
                          <th style={{ width: 50 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedPending.map(ev => (
                          <tr key={ev.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/evaluations/${ev.id}`)}>
                            <td>
                              <div className="font-semibold text-sm">{ev.first_name} {ev.last_name}</div>
                              <span className={`badge badge--${STATUS_VARIANTS[ev.status]} mt-1`}>
                                {getStatusLabel(ev.status)}
                              </span>
                            </td>
                            <td>
                              <div className="text-sm">{ev.template_name}</div>
                              <div className="text-xs font-semibold text-danger mt-1">
                                {format(parseISO(ev.deadline), "d MMM, yyyy", { locale: es })}
                              </div>
                            </td>
                            <td>
                              <button className="btn btn--icon btn--ghost" title="Calificar">
                                <Eye size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
