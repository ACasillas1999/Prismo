import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Eye, BarChart3, Calendar, Download } from 'lucide-react';
import client from '../api/client';

const STATUS_LABELS = {
  pending: 'Pendiente', in_progress: 'En Progreso', submitted: 'Enviada',
  reviewed: 'Revisada', completed: 'Completada',
};
const STATUS_VARIANTS = {
  pending: 'neutral', in_progress: 'warning', submitted: 'secondary',
  reviewed: 'primary', completed: 'success',
};

export default function MyEvaluations() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/evaluations/my')
      .then(res => setEvaluations(res.data.evaluations))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--accent-success)';
    if (score >= 60) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const exportToCSV = () => {
    if (evaluations.length === 0) return;
    
    const headers = ['Plantilla', 'Periodo', 'Estado', 'Puntaje Final'];
    const rows = evaluations.map(ev => [
      `"${ev.template_name}"`,
      `"${ev.period_name}"`,
      `"${STATUS_LABELS[ev.status] || ev.status}"`,
      `"${ev.overall_score !== null ? `${parseFloat(ev.overall_score).toFixed(1)}%` : '—'}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'mis_evaluaciones_prismo.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Mis Evaluaciones</h1>
          <p className="page-header__subtitle">Revisa tus evaluaciones y reporta tu avance</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary" onClick={exportToCSV} disabled={evaluations.length === 0}>
            <Download size={18} /> Exportar CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : evaluations.length === 0 ? (
        <motion.div className="empty-state" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="empty-state__icon"><ClipboardList size={28} /></div>
          <p className="empty-state__title">Sin evaluaciones asignadas</p>
          <p className="empty-state__description">
            Aún no se te han asignado evaluaciones. Contacta a tu jefe de departamento.
          </p>
        </motion.div>
      ) : (
        <div className="grid-2">
          <AnimatePresence>
            {evaluations.map((ev, i) => (
              <motion.div
                key={ev.id}
                className="card card--interactive"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => navigate(`/evaluations/${ev.id}`)}
              >
                <div className="card__header">
                  <div>
                    <h3 className="card__title">{ev.template_name}</h3>
                    <p className="card__subtitle">{ev.period_name}</p>
                  </div>
                  <span className={`badge badge--${STATUS_VARIANTS[ev.status]}`}>
                    {STATUS_LABELS[ev.status]}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-xs text-secondary">
                      {formatDate(ev.start_date)} — {formatDate(ev.end_date)}
                    </span>
                  </div>
                </div>

                {/* Score display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-sm text-secondary">Puntaje:</span>
                  </div>
                  <span className="text-mono font-bold" style={{
                    fontSize: 'var(--text-xl)',
                    color: ev.overall_score ? getScoreColor(ev.overall_score) : 'var(--text-tertiary)',
                  }}>
                    {ev.overall_score !== null ? `${parseFloat(ev.overall_score).toFixed(1)}%` : '—'}
                  </span>
                </div>

                {ev.overall_score !== null && (
                  <div className="progress mt-2">
                    <div
                      className={`progress__fill`}
                      style={{
                        width: `${Math.min(ev.overall_score, 100)}%`,
                        background: ev.overall_score >= 80 ? 'var(--gradient-success)' :
                                    ev.overall_score >= 60 ? 'var(--gradient-warning)' :
                                    'var(--gradient-danger)',
                      }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
