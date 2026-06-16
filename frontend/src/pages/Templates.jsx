import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, Plus, Eye, Trash2, Building2, Briefcase, ChevronRight,
} from 'lucide-react';
import client from '../api/client';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

export default function Templates() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [templates, setTemplates] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [filterPos, setFilterPos] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (isAdmin && filterDept) params.department_id = filterDept;
      if (filterPos) params.position_id = filterPos;

      const [tRes, pRes, dRes] = await Promise.all([
        client.get('/templates', { params }),
        client.get('/positions'),
        client.get('/departments'),
      ]);
      setTemplates(tRes.data.templates);
      setPositions(pRes.data.positions);
      setDepartments(dRes.data.departments);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterPos, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (t) => {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    try {
      await client.delete(`/templates/${t.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Plantillas de Evaluación</h1>
          <p className="page-header__subtitle">
            Define las categorías y criterios para evaluar cada puesto
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => navigate('/templates/new')}>
            <Plus size={18} /> Nueva Plantilla
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        {isAdmin && (
          <div className="flex-1 min-w-[200px]">
            <label className="form-label text-xs text-tertiary mb-1">Departamento</label>
            <select className="form-select w-full" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">Todos los departamentos</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex-1 min-w-[200px]">
          <label className="form-label text-xs text-tertiary mb-1">Puesto</label>
          <select className="form-select w-full" value={filterPos} onChange={(e) => setFilterPos(e.target.value)}>
            <option value="">Todos los puestos</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : templates.length === 0 ? (
        <motion.div className="empty-state" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="empty-state__icon"><FileSpreadsheet size={28} /></div>
          <p className="empty-state__title">Sin plantillas</p>
          <p className="empty-state__description">
            Crea plantillas de evaluación con categorías ponderadas y criterios medibles.
          </p>
          <button className="btn btn--primary" onClick={() => navigate('/templates/new')}>
            <Plus size={18} /> Crear Plantilla
          </button>
        </motion.div>
      ) : (
        <div className="grid-3">
          <AnimatePresence>
            {templates.map((t, i) => (
              <motion.div
                key={t.id}
                className="card card--interactive"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/templates/${t.id}`)}
              >
                <div className="card__header">
                  <div style={{ flex: 1 }}>
                    <h3 className="card__title">{t.name}</h3>
                    {t.description && (
                      <p className="card__subtitle truncate" style={{ maxWidth: 250 }}>{t.description}</p>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                </div>

                <div className="flex flex-col gap-2" style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span className="text-sm text-secondary">{t.department_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} style={{ color: 'var(--accent-secondary)' }} />
                    <span className="text-sm text-secondary">{t.position_name}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="badge badge--primary">
                      {t.categories_count} categoría{t.categories_count !== 1 ? 's' : ''}
                    </span>
                    {t.is_draft === 1 && (
                      <span className="badge badge--warning">Borrador</span>
                    )}
                  </div>
                  <span className={`badge badge--${t.frequency === 'monthly' ? 'warning' : t.frequency === 'quarterly' ? 'secondary' : 'neutral'}`}>
                    {t.frequency === 'monthly' ? 'Auto (Mensual)' : t.frequency === 'quarterly' ? 'Auto (Trimestral)' : 'Manual'}
                  </span>
                  <button
                    className="btn btn--danger btn--icon btn--sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
