import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users as UsersIcon, Plus, Pencil, Trash2, Search, Mail, Shield } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/common/Modal';

const ROLE_LABELS = {
  admin: 'Administrador',
  department_head: 'Jefe de Depto',
  agent: 'Agente',
};
const ROLE_VARIANTS = {
  admin: 'primary',
  department_head: 'warning',
  agent: 'secondary',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '',
    role: 'agent', department_id: '', position_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterDept) params.department_id = filterDept;

      const [usersRes, deptsRes, posRes] = await Promise.all([
        client.get('/users', { params }),
        client.get('/departments'),
        client.get('/positions'),
      ]);
      setUsers(usersRes.data.users);
      setDepartments(deptsRes.data.departments);
      setPositions(posRes.data.positions);
    } catch (err) {
      console.error('Error fetching:', err);
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterDept]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter positions based on selected department in form
  const filteredPositions = form.department_id
    ? positions.filter(p => p.department_id === parseInt(form.department_id))
    : positions;

  const openCreate = () => {
    setEditing(null);
    setForm({
      email: '', password: '', first_name: '', last_name: '',
      role: 'agent', department_id: '', position_id: '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      department_id: user.department_id || '',
      position_id: user.position_id || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;

      if (editing) {
        await client.put(`/users/${editing.id}`, payload);
      } else {
        await client.post('/users', payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`¿Eliminar al usuario "${user.first_name} ${user.last_name}"?`)) return;
    try {
      await client.delete(`/users/${user.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Usuarios</h1>
          <p className="page-header__subtitle">Gestiona los usuarios, roles y asignaciones</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-tertiary)',
          }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="department_head">Jefe de Depto</option>
          <option value="agent">Agente</option>
        </select>
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
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : users.length === 0 ? (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="empty-state__icon">
            <UsersIcon size={28} />
          </div>
          <p className="empty-state__title">Sin usuarios</p>
          <p className="empty-state__description">
            Agrega usuarios y asígnalos a departamentos y puestos.
          </p>
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} /> Crear Usuario
          </button>
        </motion.div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Departamento</th>
                <th>Puesto</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {users.map(user => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="topbar__avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <span className="font-semibold">
                          {user.first_name} {user.last_name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Mail size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <span className="text-sm">{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge--${ROLE_VARIANTS[user.role]}`}>
                        <Shield size={12} />
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">{user.department_name || '—'}</span>
                    </td>
                    <td>
                      <span className="text-sm">{user.position_name || '—'}</span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn--ghost btn--icon" onClick={() => openEdit(user)} title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button className="btn btn--danger btn--icon" onClick={() => handleDelete(user)} title="Eliminar">
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
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Usuario' : 'Nuevo Usuario'}
        size="lg"
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

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="user-fname">Nombre</label>
              <input
                id="user-fname"
                className="form-input"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Nombre"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="user-lname">Apellido</label>
              <input
                id="user-lname"
                className="form-input"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Apellido"
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="user-email">Email</label>
              <input
                id="user-email"
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="user-password">
                {editing ? 'Nueva Contraseña' : 'Contraseña'}
                {!editing && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
              </label>
              <input
                id="user-password"
                type="password"
                className="form-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                required={!editing}
                minLength={editing ? undefined : 6}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="user-role">Rol</label>
            <select
              id="user-role"
              className="form-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              required
            >
              <option value="agent">Agente</option>
              <option value="department_head">Jefe de Departamento</option>
              <option value="admin">Administrador</option>
            </select>
            <span className="form-hint">
              {form.role === 'admin' && 'Acceso total al sistema.'}
              {form.role === 'department_head' && 'Puede crear plantillas y evaluar agentes de su departamento.'}
              {form.role === 'agent' && 'Puede ver sus evaluaciones y reportar avance.'}
            </span>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="user-dept">Departamento</label>
              <select
                id="user-dept"
                className="form-select"
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value, position_id: '' })}
              >
                <option value="">Sin departamento</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="user-pos">Puesto</label>
              <select
                id="user-pos"
                className="form-select"
                value={form.position_id}
                onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                disabled={!form.department_id}
              >
                <option value="">Sin puesto</option>
                {filteredPositions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {!form.department_id && (
                <span className="form-hint">Selecciona un departamento primero</span>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
