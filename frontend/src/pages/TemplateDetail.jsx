import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical,
  Target, BarChart3, MessageSquare, AlertCircle, CheckCircle2,
} from 'lucide-react';
import client from '../api/client';

const emptyCategory = () => ({
  _key: Math.random().toString(36).slice(2),
  name: '',
  description: '',
  weight: '',
  criteria: [emptyCriterion()],
});

const emptyCriterion = () => ({
  _key: Math.random().toString(36).slice(2),
  name: '',
  description: '',
  type: 'subjective',
  target_value: '',
  unit: '',
  weight: '',
  cap_at_100: true,
  rules: [],
});

export default function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    position_id: '',
    frequency: 'manual',
    categories: [emptyCategory()],
  });

  useEffect(() => {
    client.get('/positions').then(r => setPositions(r.data.positions));
  }, []);

  useEffect(() => {
    if (!isNew) {
      client.get(`/templates/${id}`)
        .then(r => {
          const t = r.data.template;
          setForm({
            name: t.name,
            description: t.description || '',
            position_id: t.position_id,
            frequency: t.frequency || 'manual',
            categories: t.categories.map(cat => ({
              ...cat,
              _key: Math.random().toString(36).slice(2),
              weight: parseFloat(cat.weight),
              criteria: cat.criteria.map(cr => ({
                ...cr,
                _key: Math.random().toString(36).slice(2),
                weight: parseFloat(cr.weight),
                target_value: cr.target_value ? parseFloat(cr.target_value) : '',
                cap_at_100: cr.cap_at_100 !== 0,
                rules: cr.rules ? (typeof cr.rules === 'string' ? JSON.parse(cr.rules) : cr.rules) : [],
              })),
            })),
          });
        })
        .catch(() => navigate('/templates'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  // Weight calculations
  const catWeightSum = form.categories.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);
  const catWeightValid = Math.abs(catWeightSum - 100) < 0.01;

  const getCritWeightSum = (cat) =>
    cat.criteria.reduce((s, cr) => s + (parseFloat(cr.weight) || 0), 0);

  // Category handlers
  const addCategory = () => {
    setForm(f => ({ ...f, categories: [...f.categories, emptyCategory()] }));
  };
  const removeCategory = (idx) => {
    setForm(f => ({
      ...f,
      categories: f.categories.filter((_, i) => i !== idx),
    }));
  };
  const updateCategory = (idx, field, value) => {
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }));
  };

  // Criterion handlers
  const addCriterion = (catIdx) => {
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) =>
        i === catIdx ? { ...c, criteria: [...c.criteria, emptyCriterion()] } : c
      ),
    }));
  };
  const removeCriterion = (catIdx, critIdx) => {
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) =>
        i === catIdx ? { ...c, criteria: c.criteria.filter((_, j) => j !== critIdx) } : c
      ),
    }));
  };
  const updateCriterion = (catIdx, critIdx, field, value) => {
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) =>
        i === catIdx ? {
          ...c,
          criteria: c.criteria.map((cr, j) => j === critIdx ? { ...cr, [field]: value } : cr),
        } : c
      ),
    }));
  };

  const addRule = (catIdx, critIdx) => {
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) =>
        i === catIdx ? {
          ...c,
          criteria: c.criteria.map((cr, j) =>
            j === critIdx ? { ...cr, rules: [...(cr.rules || []), { min: '', max: '', pct: '' }] } : cr
          ),
        } : c
      ),
    }));
  };

  const removeRule = (catIdx, critIdx, ruleIdx) => {
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) =>
        i === catIdx ? {
          ...c,
          criteria: c.criteria.map((cr, j) =>
            j === critIdx ? { ...cr, rules: cr.rules.filter((_, k) => k !== ruleIdx) } : cr
          ),
        } : c
      ),
    }));
  };

  const updateRule = (catIdx, critIdx, ruleIdx, field, value) => {
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) =>
        i === catIdx ? {
          ...c,
          criteria: c.criteria.map((cr, j) =>
            j === critIdx ? {
              ...cr,
              rules: cr.rules.map((r, k) => k === ruleIdx ? { ...r, [field]: value } : r)
            } : cr
          ),
        } : c
      ),
    }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = {
        ...form,
        categories: form.categories.map((cat, ci) => ({
          name: cat.name,
          description: cat.description,
          weight: parseFloat(cat.weight),
          sort_order: ci,
          criteria: cat.criteria.map((cr, cri) => ({
            name: cr.name,
            description: cr.description,
            type: cr.type,
            target_value: cr.type === 'measurable' && cr.target_value ? parseFloat(cr.target_value) : null,
            unit: cr.type === 'measurable' ? cr.unit : null,
            weight: parseFloat(cr.weight),
            cap_at_100: cr.cap_at_100,
            rules: cr.type === 'measurable' && cr.rules?.length > 0 ? cr.rules.map(r => ({ min: parseFloat(r.min), max: parseFloat(r.max), pct: parseFloat(r.pct) })) : null,
            sort_order: cri,
          })),
        })),
      };

      if (isNew) {
        const res = await client.post('/templates', payload);
        setSuccess('Plantilla creada exitosamente');
        setTimeout(() => navigate(`/templates/${res.data.template.id}`), 1000);
      } else {
        await client.put(`/templates/${id}`, payload);
        setSuccess('Plantilla actualizada');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn--ghost btn--icon" onClick={() => navigate('/templates')}>
            <ArrowLeft size={20} />
          </button>
          <div className="page-header__info">
            <h1 className="page-header__title">
              {isNew ? 'Nueva Plantilla' : 'Editar Plantilla'}
            </h1>
            <p className="page-header__subtitle">
              Define categorías con pesos porcentuales y sus criterios de evaluación
            </p>
          </div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" /> : <><Save size={18} /> Guardar</>}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <motion.div
          className="login-card__error"
          style={{ marginBottom: 'var(--space-4)' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle size={16} style={{ marginRight: 8 }} />
          {error}
        </motion.div>
      )}
      {success && (
        <motion.div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--accent-success-dim)',
            border: '1px solid hsl(150, 40%, 25%)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-success)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CheckCircle2 size={16} style={{ marginRight: 8 }} />
          {success}
        </motion.div>
      )}

      {/* Template Info */}
      <div className="card mb-6">
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label form-label--required">Nombre</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Evaluación Desarrollador Senior Q1"
            />
          </div>
          <div className="form-group">
            <label className="form-label form-label--required">Puesto</label>
            <select
              className="form-select"
              value={form.position_id}
              onChange={(e) => setForm({ ...form, position_id: e.target.value })}
            >
              <option value="">Seleccionar puesto...</option>
              {positions.map(p => (
                <option key={p.id} value={p.id}>{p.department_name} → {p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              className="form-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción opcional..."
            />
          </div>
          <div className="form-group">
            <label className="form-label form-label--required">Frecuencia (Automatización)</label>
            <select
              className="form-select"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            >
              <option value="manual">Manual (Creada por Jefe)</option>
              <option value="monthly">Automática Mensual</option>
              <option value="quarterly">Automática Trimestral</option>
            </select>
          </div>
        </div>
      </div>

      {/* Weight Summary */}
      <div className="card mb-6" style={{
        borderColor: catWeightValid ? 'var(--accent-success)' : 'var(--accent-warning)',
        borderWidth: '1px',
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 size={20} style={{ color: catWeightValid ? 'var(--accent-success)' : 'var(--accent-warning)' }} />
            <span className="font-semibold">
              Peso Total de Categorías:
            </span>
            <span className="text-mono font-bold" style={{
              fontSize: 'var(--text-lg)',
              color: catWeightValid ? 'var(--accent-success)' : 'var(--accent-warning)',
            }}>
              {catWeightSum.toFixed(1)}%
            </span>
            <span className="text-sm text-secondary">/ 100%</span>
          </div>
          {catWeightValid ? (
            <span className="badge badge--success"><CheckCircle2 size={12} /> Válido</span>
          ) : (
            <span className="badge badge--warning"><AlertCircle size={12} /> Debe sumar 100%</span>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {form.categories.map((cat, catIdx) => {
            const critWeightSum = getCritWeightSum(cat);
            const critValid = Math.abs(critWeightSum - 100) < 0.01;

            return (
              <motion.div
                key={cat._key}
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, height: 0 }}
                style={{ borderLeft: '3px solid var(--accent-primary)' }}
              >
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-4">
                  <GripVertical size={16} style={{ color: 'var(--text-tertiary)', cursor: 'grab' }} />
                  <div className="flex items-center gap-3" style={{ flex: 1 }}>
                    <input
                      className="form-input"
                      style={{ fontWeight: 600 }}
                      value={cat.name}
                      onChange={(e) => updateCategory(catIdx, 'name', e.target.value)}
                      placeholder="Nombre de la categoría"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 120 }}>
                      <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        style={{ width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                        value={cat.weight}
                        onChange={(e) => updateCategory(catIdx, 'weight', e.target.value)}
                        placeholder="0"
                      />
                      <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>%</span>
                    </div>
                  </div>
                  {form.categories.length > 1 && (
                    <button className="btn btn--danger btn--icon btn--sm" onClick={() => removeCategory(catIdx)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Category Description */}
                <div className="form-group mb-4" style={{ paddingLeft: 28 }}>
                  <input
                    className="form-input"
                    value={cat.description || ''}
                    onChange={(e) => updateCategory(catIdx, 'description', e.target.value)}
                    placeholder="Descripción de la categoría (opcional)"
                    style={{ fontSize: 'var(--text-sm)' }}
                  />
                </div>

                {/* Criteria Weight Summary */}
                <div className="flex items-center gap-3 mb-4" style={{ paddingLeft: 28 }}>
                  <span className="text-xs text-secondary">Criterios:</span>
                  <span className="text-mono text-xs font-bold" style={{
                    color: critValid ? 'var(--accent-success)' : 'var(--accent-warning)',
                  }}>
                    {critWeightSum.toFixed(1)}% / 100%
                  </span>
                  {critValid ? (
                    <CheckCircle2 size={12} style={{ color: 'var(--accent-success)' }} />
                  ) : (
                    <AlertCircle size={12} style={{ color: 'var(--accent-warning)' }} />
                  )}
                </div>

                {/* Criteria Table */}
                <div style={{ paddingLeft: 28 }}>
                  <div className="data-table-wrapper" style={{ marginBottom: 'var(--space-3)' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Criterio</th>
                          <th style={{ width: 130 }}>Tipo</th>
                          <th style={{ width: 90 }}>Meta</th>
                          <th style={{ width: 80 }}>Unidad</th>
                          <th style={{ width: 80 }}>Peso %</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.criteria.map((cr, crIdx) => (
                          <React.Fragment key={cr._key}>
                            <tr>
                              <td>
                                <input
                                  className="form-input"
                                  value={cr.name}
                                  onChange={(e) => updateCriterion(catIdx, crIdx, 'name', e.target.value)}
                                  placeholder="Nombre del criterio"
                                  style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
                                />
                              </td>
                              <td>
                                <select
                                  className="form-select"
                                  value={cr.type}
                                  onChange={(e) => updateCriterion(catIdx, crIdx, 'type', e.target.value)}
                                  style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
                                >
                                  <option value="subjective">Subjetivo</option>
                                  <option value="measurable">Medible</option>
                                </select>
                              </td>
                              <td>
                                {cr.type === 'measurable' ? (
                                  <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={cr.target_value}
                                    onChange={(e) => updateCriterion(catIdx, crIdx, 'target_value', e.target.value)}
                                    placeholder="0"
                                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                                  />
                                ) : (
                                  <span className="text-xs text-secondary">N/A</span>
                                )}
                              </td>
                              <td>
                                {cr.type === 'measurable' ? (
                                  <input
                                    className="form-input"
                                    value={cr.unit}
                                    onChange={(e) => updateCriterion(catIdx, crIdx, 'unit', e.target.value)}
                                    placeholder="unidad"
                                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}
                                  />
                                ) : (
                                  <span className="text-xs text-secondary">—</span>
                                )}
                              </td>
                              <td>
                                <input
                                  className="form-input"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={cr.weight}
                                  onChange={(e) => updateCriterion(catIdx, crIdx, 'weight', e.target.value)}
                                  placeholder="0"
                                  style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}
                                />
                              </td>
                              <td>
                                {cat.criteria.length > 1 && (
                                  <button
                                    className="btn btn--ghost btn--icon btn--sm"
                                    onClick={() => removeCriterion(catIdx, crIdx)}
                                    style={{ color: 'var(--accent-danger)' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                            {/* Advanced Row */}
                            <tr style={{ background: 'var(--bg-card)' }}>
                              <td colSpan={6} style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '2px solid var(--border-color)' }}>
                                <div className="flex flex-col gap-3">
                                  <input
                                    className="form-input"
                                    value={cr.description || ''}
                                    onChange={(e) => updateCriterion(catIdx, crIdx, 'description', e.target.value)}
                                    placeholder="Descripción o instrucciones de este criterio..."
                                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
                                  />
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={cr.cap_at_100}
                                        onChange={(e) => updateCriterion(catIdx, crIdx, 'cap_at_100', e.target.checked)}
                                      />
                                      Límite al 100% (No dar puntos extra si supera la meta)
                                    </label>
                                  </div>

                                  {cr.type === 'measurable' && (
                                    <div className="card mt-2" style={{ padding: 'var(--space-3)', border: '1px solid var(--border-color)' }}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold">Reglas por Rangos (Opcional)</span>
                                        <button className="btn btn--secondary btn--sm" onClick={() => addRule(catIdx, crIdx)}>
                                          <Plus size={12} /> Añadir Regla
                                        </button>
                                      </div>
                                      {cr.rules?.length > 0 ? (
                                        <div className="flex flex-col gap-2">
                                          {cr.rules.map((rule, ruleIdx) => (
                                            <div key={ruleIdx} className="flex items-center gap-2">
                                              <span className="text-xs">Si obtiene entre</span>
                                              <input className="form-input" type="number" value={rule.min} onChange={e => updateRule(catIdx, crIdx, ruleIdx, 'min', e.target.value)} placeholder="0" style={{ width: 70, padding: 4, fontSize: 'var(--text-xs)' }} />
                                              <span className="text-xs">y</span>
                                              <input className="form-input" type="number" value={rule.max} onChange={e => updateRule(catIdx, crIdx, ruleIdx, 'max', e.target.value)} placeholder="5" style={{ width: 70, padding: 4, fontSize: 'var(--text-xs)' }} />
                                              <span className="text-xs">dar el</span>
                                              <input className="form-input" type="number" value={rule.pct} onChange={e => updateRule(catIdx, crIdx, ruleIdx, 'pct', e.target.value)} placeholder="80" style={{ width: 70, padding: 4, fontSize: 'var(--text-xs)' }} />
                                              <span className="text-xs">% de este criterio</span>
                                              <button className="btn btn--ghost btn--icon btn--sm text-danger" onClick={() => removeRule(catIdx, crIdx, ruleIdx)}>
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-secondary">Si no agregas reglas, se aplicará el cálculo proporcional directo.</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => addCriterion(catIdx)}
                  >
                    <Plus size={14} /> Agregar Criterio
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add Category */}
      <motion.button
        className="btn btn--secondary"
        style={{ marginTop: 'var(--space-4)', width: '100%', justifyContent: 'center' }}
        onClick={addCategory}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Plus size={18} /> Agregar Categoría
      </motion.button>
    </div>
  );
}
