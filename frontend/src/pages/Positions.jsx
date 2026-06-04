import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Plus, Pencil, Trash2, Users, Building2 } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/common/Modal';

export default function Positions() {
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ department_id: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [posRes, deptRes] = await Promise.all([
        client.get('/positions', { params: filterDept ? { department_id: filterDept } : {} }),
        client.get('/departments'),
      ]);
      setPositions(posRes.data.positions);
      setDepartments(deptRes.data.departments);
    } catch (err) {
      console.error('Error fetching:', err);
    } finally {
      setLoading(false);
    }
  }, [filterDept]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ department_id: filterDept || '', name: '', description: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (pos) => {
    setEditing(pos);
    setForm({
      department_id: pos.department_id,
      name: pos.name,
      description: pos.description || '',
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
        await client.put(`/positions/${editing.id}`, form);
      } else {
        await client.post('/positions', form);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pos) => {
    if (!confirm(`¿Eliminar el puesto "${pos.name}"?`)) return;
    try {
      await client.delete(`/positions/${pos.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  };

  // Group positions by department
  const grouped = positions.reduce((acc, pos) => {
    const key = pos.department_name || 'Sin departamento';
    if (!acc[key]) acc[key] = [];
    acc[key].push(pos);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Puestos</h1>
          <p className="page-header__subtitle">Gestiona los puestos dentro de cada departamento</p>
        </div>
        <div className="page-header__actions">
          <select
            className="form-select"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">Todos los departamentos</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Nuevo Puesto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : positions.length === 0 ? (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="empty-state__icon">
            <Briefcase size={28} />
          </div>
          <p className="empty-state__title">Sin puestos</p>
          <p className="empty-state__description">
            Crea puestos dentro de tus departamentos para asignarlos a los agentes.
          </p>
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Crear Puesto
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([deptName, items]) => (
            <div key={deptName}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={16} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="font-semibold">{deptName}</h3>
                <span className="badge badge--neutral">{items.length}</span>
              </div>

              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Puesto</th>
                      <th>Descripción</th>
                      <th>Usuarios</th>
                      <th style={{ width: 120 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {items.map(pos => (
                        <motion.tr
                          key={pos.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <td>
                            <div className="flex items-center gap-2">
                              <Briefcase size={16} style={{ color: 'var(--accent-secondary)' }} />
                              <span className="font-semibold">{pos.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="text-sm text-secondary truncate" style={{ maxWidth: 300, display: 'block' }}>
                              {pos.description || '—'}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Users size={14} style={{ color: 'var(--text-tertiary)' }} />
                              <span>{pos.users_count}</span>
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button className="btn btn--ghost btn--icon" onClick={() => openEdit(pos)} title="Editar">
                                <Pencil size={15} />
                              </button>
                              <button className="btn btn--danger btn--icon" onClick={() => handleDelete(pos)} title="Eliminar">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Puesto' : 'Nuevo Puesto'}
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
            <label className="form-label form-label--required" htmlFor="pos-dept">Departamento</label>
            <select
              id="pos-dept"
              className="form-select"
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              required
            >
              <option value="">Seleccionar departamento...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="pos-name">Nombre del Puesto</label>
            <input
              id="pos-name"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Desarrollador Senior, Gerente de Ventas..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pos-desc">Descripción</label>
            <textarea
              id="pos-desc"
              className="form-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción del puesto (opcional)"
              rows={3}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
