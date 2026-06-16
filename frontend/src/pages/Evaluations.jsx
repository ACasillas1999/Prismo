import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardCheck, Plus, Eye, Users, CalendarRange,
  Building2, Filter, Download, FileSpreadsheet, Trash2
} from 'lucide-react';
import client from '../api/client';
import Modal from '../components/common/Modal';
import { exportBulkExcel } from '../utils/excelExport';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const STATUS_LABELS = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  submitted: 'Enviada',
  reviewed: 'Revisada',
  completed: 'Completada',
};
const STATUS_VARIANTS = {
  pending: 'neutral',
  in_progress: 'warning',
  submitted: 'secondary',
  reviewed: 'primary',
  completed: 'success',
};

export default function Evaluations() {
  const [evaluations, setEvaluations] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ user_id: '', template_id: '', period_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterDept, setFilterDept] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filterPeriod) params.period_id = filterPeriod;
      if (filterStatus) params.status = filterStatus;
      if (isAdmin && filterDept) params.department_id = filterDept;
      if (filterAgent) params.user_id = filterAgent;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;

      const [evalRes, pRes, dRes, tRes, uRes] = await Promise.all([
        client.get('/evaluations', { params }),
        client.get('/periods'),
        client.get('/departments'),
        client.get('/templates'),
        client.get('/users'),
      ]);
      setEvaluations(evalRes.data.evaluations);
      setPeriods(pRes.data.periods);
      setDepartments(dRes.data.departments);
      setTemplates(tRes.data.templates);
      setUsers(uRes.data.users.filter(u => u.role === 'agent'));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterPeriod, filterStatus, filterDept, filterAgent, filterStartDate, filterEndDate, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/evaluations', createForm);
      setCreateOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción no se puede deshacer. Se eliminarán las calificaciones.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await client.delete(`/evaluations/${id}`);
        Swal.fire('Eliminado!', 'La evaluación ha sido eliminada.', 'success');
        fetchData();
      } catch (err) {
        Swal.fire('Error', err.response?.data?.error || 'No se pudo eliminar', 'error');
      }
    }
  };

  const formatScore = (score) => {
    if (score === null || score === undefined) return '—';
    return `${parseFloat(score).toFixed(1)}%`;
  };

  const exportToExcel = async () => {
    if (evaluations.length === 0) return;
    try {
      setSaving(true);
      const params = {};
      if (filterPeriod) params.period_id = filterPeriod;
      
      const res = await client.get('/evaluations/bulk-details', { params });
      const detailedEvaluations = res.data.evaluations;
      
      let filename = 'Evaluaciones_Prismo.xlsx';
      if (filterPeriod) {
        const p = periods.find(p => p.id === parseInt(filterPeriod));
        if (p) filename = `Evaluaciones_${p.name}.xlsx`;
      }
      
      await exportBulkExcel(detailedEvaluations, filename);
    } catch (err) {
      setError('Error al generar Excel masivo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Evaluaciones</h1>
          <p className="page-header__subtitle">Gestiona y califica las evaluaciones de tus agentes</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary" onClick={exportToExcel} disabled={evaluations.length === 0 || saving}>
            <FileSpreadsheet size={18} /> {saving ? 'Generando...' : 'Exportar Excel Múltiple'}
          </button>
          <button className="btn btn--primary" onClick={() => { setCreateOpen(true); setError(''); }}>
            <Plus size={18} /> Nueva Evaluación
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-[150px]">
          <label className="form-label text-xs text-tertiary mb-1">Período</label>
          <select className="form-select w-full" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
            <option value="">Todos</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        
        <div className="flex-1 min-w-[150px]">
          <label className="form-label text-xs text-tertiary mb-1">Estado</label>
          <select className="form-select w-full" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="active">Activas (No completadas)</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En Progreso</option>
            <option value="submitted">Enviada</option>
            <option value="reviewed">Revisada</option>
            <option value="completed">Completada</option>
          </select>
        </div>

        {isAdmin && (
          <div className="flex-1 min-w-[150px]">
            <label className="form-label text-xs text-tertiary mb-1">Departamento</label>
            <select className="form-select w-full" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">Todos</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex-1 min-w-[150px]">
          <label className="form-label text-xs text-tertiary mb-1">Agente</label>
          <select className="form-select w-full" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
            <option value="">Todos</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[130px]">
          <label className="form-label text-xs text-tertiary mb-1">Fecha Inicio</label>
          <input 
            type="date" 
            className="form-input w-full" 
            value={filterStartDate} 
            onChange={e => setFilterStartDate(e.target.value)}
          />
        </div>

        <div className="flex-1 min-w-[130px]">
          <label className="form-label text-xs text-tertiary mb-1">Fecha Fin</label>
          <input 
            type="date" 
            className="form-input w-full" 
            value={filterEndDate} 
            onChange={e => setFilterEndDate(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : evaluations.length === 0 ? (
        <motion.div className="empty-state" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="empty-state__icon"><ClipboardCheck size={28} /></div>
          <p className="empty-state__title">Sin evaluaciones</p>
          <p className="empty-state__description">
            Crea evaluaciones asignando agentes a plantillas y períodos.
          </p>
        </motion.div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Plantilla</th>
                <th>Período</th>
                <th>Departamento</th>
                <th>Estado</th>
                <th>Puntaje</th>
                <th style={{ width: 80 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {evaluations.map(ev => (
                  <motion.tr
                    key={ev.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/evaluations/${ev.id}`)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="topbar__avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>
                          {ev.first_name?.[0]}{ev.last_name?.[0]}
                        </div>
                        <span className="font-semibold text-sm">{ev.first_name} {ev.last_name}</span>
                      </div>
                    </td>
                    <td><span className="text-sm">{ev.template_name}</span></td>
                    <td><span className="text-sm">{ev.period_name}</span></td>
                    <td><span className="text-sm">{ev.department_name}</span></td>
                    <td>
                      <span className={`badge badge--${STATUS_VARIANTS[ev.status]}`}>
                        {STATUS_LABELS[ev.status]}
                      </span>
                    </td>
                    <td>
                      <span className="text-mono font-bold" style={{
                        color: ev.overall_score >= 80 ? 'var(--accent-success)' :
                               ev.overall_score >= 60 ? 'var(--accent-warning)' :
                               ev.overall_score > 0 ? 'var(--accent-danger)' : 'var(--text-tertiary)',
                      }}>
                        {formatScore(ev.overall_score)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle">
                          <Eye size={16} />
                        </button>
                        {(isAdmin || hasRole('department_head')) && (
                          <button 
                            className="btn btn--ghost btn--icon btn--sm" 
                            title="Eliminar"
                            onClick={(e) => handleDelete(e, ev.id)}
                            style={{ color: 'var(--accent-danger)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva Evaluación"
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleCreate} disabled={saving}>
              {saving ? <div className="spinner" /> : 'Crear'}
            </button>
          </>
        }
      >
        {error && <div className="login-card__error">{error}</div>}

        <div className="form-group">
          <label className="form-label form-label--required">Agente</label>
          <select
            className="form-select"
            value={createForm.user_id}
            onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
          >
            <option value="">Seleccionar agente...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name} — {u.position_name || 'Sin puesto'}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label form-label--required">Plantilla</label>
          <select
            className="form-select"
            value={createForm.template_id}
            onChange={(e) => setCreateForm({ ...createForm, template_id: e.target.value })}
          >
            <option value="">Seleccionar plantilla...</option>
            {templates.filter(t => t.is_draft !== 1).map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.position_name})</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label form-label--required">Período</label>
          <select
            className="form-select"
            value={createForm.period_id}
            onChange={(e) => setCreateForm({ ...createForm, period_id: e.target.value })}
          >
            <option value="">Seleccionar período...</option>
            {periods.filter(p => p.status === 'active').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
