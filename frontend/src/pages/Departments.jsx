import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Plus, Pencil, Trash2, Users, Briefcase } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/common/Modal';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await client.get('/departments');
      setDepartments(res.data.departments);
    } catch (err) {
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({ name: dept.name, description: dept.description || '' });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editing) {
        await client.put(`/departments/${editing.id}`, form);
      } else {
        await client.post('/departments', form);
      }
      setModalOpen(false);
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept) => {
    if (!confirm(`¿Eliminar el departamento "${dept.name}"?`)) return;
    try {
      await client.delete(`/departments/${dept.id}`);
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Departamentos</h1>
          <p className="page-header__subtitle">Gestiona los departamentos de tu organización</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Nuevo Departamento
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : departments.length === 0 ? (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="empty-state__icon">
            <Building2 size={28} />
          </div>
          <p className="empty-state__title">Sin departamentos</p>
          <p className="empty-state__description">
            Crea tu primer departamento para comenzar a organizar tu empresa.
          </p>
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Crear Departamento
          </button>
        </motion.div>
      ) : (
        <div className="grid-3">
          <AnimatePresence>
            {departments.map((dept, i) => (
              <motion.div
                key={dept.id}
                className="card card--interactive"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="card__header">
                  <div className="flex items-center gap-3">
                    <div className="kpi-card__icon kpi-card__icon--primary" style={{ width: 36, height: 36 }}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h3 className="card__title">{dept.name}</h3>
                      {dept.description && (
                        <p className="card__subtitle truncate" style={{ maxWidth: 200 }}>{dept.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4" style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-sm text-secondary">
                      {dept.positions_count} puesto{dept.positions_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-sm text-secondary">
                      {dept.users_count} usuario{dept.users_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => openEdit(dept)}>
                    <Pencil size={14} /> Editar
                  </button>
                  <button className="btn btn--danger btn--sm" onClick={() => handleDelete(dept)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Departamento' : 'Nuevo Departamento'}
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
              {saving ? <div className="spinner" /> : (editing ? 'Guardar' : 'Crear')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {error && <div className="login-card__error">{error}</div>}

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="dept-name">Nombre</label>
            <input
              id="dept-name"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Tecnología, Ventas, Marketing..."
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="dept-desc">Descripción</label>
            <textarea
              id="dept-desc"
              className="form-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción del departamento (opcional)"
              rows={3}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
