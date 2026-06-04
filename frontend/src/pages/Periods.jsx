import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarRange, Plus, Pencil, Trash2, Play, Lock, Clock } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/common/Modal';

const STATUS_CONFIG = {
  draft:  { label: 'Borrador', variant: 'neutral',  icon: Pencil },
  active: { label: 'Activo',   variant: 'success',  icon: Play },
  closed: { label: 'Cerrado',  variant: 'secondary', icon: Lock },
};

export default function Periods() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchPeriods = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      
      const res = await client.get('/periods', { params });
      setPeriods(res.data.periods);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', start_date: '', end_date: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      start_date: p.start_date?.split('T')[0] || '',
      end_date: p.end_date?.split('T')[0] || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await client.put(`/periods/${editing.id}`, form);
      } else {
        await client.post('/periods', form);
      }
      setModalOpen(false);
      fetchPeriods();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (period, newStatus) => {
    const labels = { active: 'activar', closed: 'cerrar' };
    if (!confirm(`¿${labels[newStatus]} el período "${period.name}"?`)) return;
    try {
      await client.patch(`/periods/${period.id}/status`, { status: newStatus });
      fetchPeriods();
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const handleDelete = async (p) => {
    if (!confirm(`¿Eliminar el período "${p.name}"?`)) return;
    try {
      await client.delete(`/periods/${p.id}`);
      fetchPeriods();
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Períodos de Evaluación</h1>
          <p className="page-header__subtitle">Define los rangos de fecha para las evaluaciones</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Nuevo Período
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 min-w-[200px]" style={{ maxWidth: 250 }}>
          <label className="form-label text-xs text-tertiary mb-1">Estado</label>
          <select className="form-select w-full" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="closed">Cerrado</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : periods.length === 0 ? (
        <motion.div className="empty-state" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="empty-state__icon"><CalendarRange size={28} /></div>
          <p className="empty-state__title">Sin períodos</p>
          <p className="empty-state__description">
            Crea períodos de evaluación para asignar evaluaciones a tus agentes.
          </p>
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Crear Período
          </button>
        </motion.div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Estado</th>
                <th>Evaluaciones</th>
                <th style={{ width: 180 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {periods.map(p => {
                  const statusCfg = STATUS_CONFIG[p.status];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <CalendarRange size={16} style={{ color: 'var(--accent-primary)' }} />
                          <span className="font-semibold">{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-mono text-sm">{formatDate(p.start_date)}</span>
                      </td>
                      <td>
                        <span className="text-mono text-sm">{formatDate(p.end_date)}</span>
                      </td>
                      <td>
                        <span className={`badge badge--${statusCfg.variant}`}>
                          <StatusIcon size={12} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td>
                        <span className="text-mono">{p.evaluations_count}</span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {p.status === 'draft' && (
                            <>
                              <button className="btn btn--ghost btn--sm" onClick={() => openEdit(p)}>
                                <Pencil size={14} />
                              </button>
                              <button
                                className="btn btn--sm"
                                style={{ background: 'var(--accent-success-dim)', color: 'var(--accent-success)' }}
                                onClick={() => handleStatusChange(p, 'active')}
                              >
                                <Play size={14} /> Activar
                              </button>
                              <button className="btn btn--danger btn--sm btn--icon" onClick={() => handleDelete(p)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {p.status === 'active' && (
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => handleStatusChange(p, 'closed')}
                            >
                              <Lock size={14} /> Cerrar
                            </button>
                          )}
                          {p.status === 'closed' && (
                            <span className="text-xs text-secondary flex items-center gap-1">
                              <Clock size={12} /> Finalizado
                            </span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Período' : 'Nuevo Período'}
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
              {saving ? <div className="spinner" /> : (editing ? 'Guardar' : 'Crear')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {error && <div className="login-card__error">{error}</div>}

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="period-name">Nombre</label>
            <input
              id="period-name"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Q1 2026, Enero 2026, Semana 1..."
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="period-start">Fecha Inicio</label>
              <input
                id="period-start"
                type="date"
                className="form-input"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="period-end">Fecha Fin</label>
              <input
                id="period-end"
                type="date"
                className="form-input"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
