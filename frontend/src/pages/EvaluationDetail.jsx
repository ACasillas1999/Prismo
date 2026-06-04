import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Save, CheckCircle2, Send, Target, BarChart3,
  MessageSquare, AlertCircle, User, Calendar, Printer, FileSpreadsheet
} from 'lucide-react';
import { exportSingleExcel } from '../utils/excelExport';
import client from '../api/client';

const STATUS_LABELS = {
  pending: 'Pendiente', in_progress: 'En Progreso', submitted: 'Enviada',
  reviewed: 'Revisada', completed: 'Completada',
};
const STATUS_VARIANTS = {
  pending: 'neutral', in_progress: 'warning', submitted: 'secondary',
  reviewed: 'primary', completed: 'success',
};

export default function EvaluationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Local edits
  const [agentEdits, setAgentEdits] = useState({});
  const [evalEdits, setEvalEdits] = useState({});
  const [generalComment, setGeneralComment] = useState('');

  const isAgent = hasRole('agent');
  const isEvaluator = hasRole('admin', 'department_head');
  const isOwner = evaluation?.user_id === user?.id;

  useEffect(() => {
    client.get(`/evaluations/${id}`)
      .then(res => {
        setEvaluation(res.data.evaluation);
        setGeneralComment(res.data.evaluation.evaluator_comments || '');
      })
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleAgentSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const scores = Object.entries(agentEdits).map(([criterion_id, data]) => ({
        criterion_id: parseInt(criterion_id),
        value: data.value,
        comment: data.comment,
      }));
      const res = await client.patch(`/evaluations/${id}/agent-scores`, { scores });
      setEvaluation(res.data.evaluation);
      setAgentEdits({});
      setSuccess('Avance guardado');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleAgentSubmit = async () => {
    if (!confirm('¿Enviar tu evaluación para revisión? Ya no podrás hacer más cambios.')) return;
    try {
      const res = await client.patch(`/evaluations/${id}/submit`);
      setEvaluation(res.data.evaluation);
      setSuccess('Evaluación enviada para revisión');
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const handleEvaluatorSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const scores = Object.entries(evalEdits).map(([criterion_id, data]) => ({
        criterion_id: parseInt(criterion_id),
        score: data.score,
        comment: data.comment,
      }));
      const res = await client.patch(`/evaluations/${id}/evaluator-scores`, {
        scores,
        comments: generalComment,
      });
      setEvaluation(res.data.evaluation);
      setEvalEdits({});
      setSuccess('Calificaciones guardadas');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    } finally { setSaving(false); }
  };

  const handleComplete = async () => {
    if (!confirm('¿Marcar esta evaluación como completada?')) return;
    try {
      const res = await client.patch(`/evaluations/${id}/complete`);
      setEvaluation(res.data.evaluation);
      setSuccess('Evaluación completada');
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--accent-success)';
    if (score >= 60) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const previewData = useMemo(() => {
    if (!evaluation) return null;
    let overall = 0;
    const cats = evaluation.categories.map(cat => {
      let catScore = 0;
      const crits = cat.criteria.map(cr => {
        // Fallback to original values if no edit exists
        const agentVal = agentEdits[cr.id]?.value !== undefined ? agentEdits[cr.id].value : cr.agent_value;
        const evalVal = evalEdits[cr.id]?.score !== undefined ? evalEdits[cr.id].score : cr.evaluator_score;
        
        const cap = cr.cap_at_100 !== 0 && cr.cap_at_100 !== false;
        let rules = cr.rules;
        if (typeof rules === 'string') {
          try { rules = JSON.parse(rules); } catch (e) { rules = []; }
        }

        let critScore = 0;
        if (cr.type === 'measurable') {
          if (evalVal !== null && evalVal !== undefined && evalVal !== '') {
            const eScore = parseFloat(evalVal);
            critScore = cap ? Math.min(eScore, 100) : eScore;
          } else if (agentVal !== null && agentVal !== undefined && agentVal !== '' && cr.target_value !== null && cr.target_value !== undefined) {
            const val = parseFloat(agentVal);
            let matchedRule = false;
            
            if (rules && Array.isArray(rules) && rules.length > 0) {
              for (const rule of rules) {
                const min = parseFloat(rule.min);
                const max = parseFloat(rule.max);
                if (val >= min && val <= max) {
                  critScore = parseFloat(rule.pct);
                  matchedRule = true;
                  break;
                }
              }
            }
            
            if (!matchedRule) {
              const target = parseFloat(cr.target_value);
              if (target === 0) {
                critScore = val === 0 ? 100 : 0;
              } else {
                const pct = (val / target) * 100;
                critScore = cap ? Math.min(pct, 100) : pct;
              }
            }
          }
        } else {
          if (evalVal !== null && evalVal !== undefined && evalVal !== '') {
            const eScore = parseFloat(evalVal);
            critScore = cap ? Math.min(eScore, 100) : eScore;
          }
        }
        
        const weighted = critScore * (parseFloat(cr.weight) / 100);
        catScore += weighted;

        return { ...cr, rules, calculated_score: critScore };
      });

      const catContribution = catScore * (parseFloat(cat.weight) / 100);
      overall += catContribution;

      return {
        ...cat,
        criteria: crits,
        score: catScore,
        weighted_contribution: catContribution,
      };
    });

    return {
      ...evaluation,
      categories: cats,
      overall_score: overall,
    };
  }, [evaluation, agentEdits, evalEdits]);

  const exportToExcelWithFormulas = async () => {
    if (!previewData) return;
    await exportSingleExcel(previewData, agentEdits, evalEdits);
  };

  if (loading) {
    return (
      <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!previewData) return null;

  const ev = previewData;
  const canAgentEdit = (isAgent && isOwner && !['submitted', 'reviewed', 'completed'].includes(ev.status)) ||
                       (isEvaluator && ev.status !== 'completed');
  const canEvaluatorEdit = isEvaluator && ev.status !== 'completed';
  const canComplete = isEvaluator && ['submitted', 'in_progress'].includes(ev.status);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn--ghost btn--icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div className="page-header__info">
            <h1 className="page-header__title">
              Evaluación: {ev.first_name} {ev.last_name}
            </h1>
            <p className="page-header__subtitle">
              {ev.template_name} · {ev.period_name}
            </p>
          </div>
        </div>
        <div className="page-header__actions">
          <span className={`badge badge--${STATUS_VARIANTS[ev.status]}`} style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-4)' }}>
            {STATUS_LABELS[ev.status]}
          </span>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <motion.div className="login-card__error" style={{ marginBottom: 'var(--space-4)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AlertCircle size={16} style={{ marginRight: 8 }} />{error}
        </motion.div>
      )}
      {success && (
        <motion.div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--accent-success-dim)', border: '1px solid hsl(150,40%,25%)', borderRadius: 'var(--radius-md)', color: 'var(--accent-success)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <CheckCircle2 size={16} style={{ marginRight: 8 }} />{success}
        </motion.div>
      )}

      {/* Summary cards */}
      <div className="grid-4 mb-6">
        <div className="kpi-card">
          <div className="kpi-card__icon kpi-card__icon--primary"><User size={20} /></div>
          <span className="kpi-card__label">Agente</span>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{ev.first_name} {ev.last_name}</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__icon kpi-card__icon--secondary"><Target size={20} /></div>
          <span className="kpi-card__label">Puesto</span>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{ev.position_name}</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__icon kpi-card__icon--warning"><Calendar size={20} /></div>
          <span className="kpi-card__label">Período</span>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{ev.period_name}</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__icon kpi-card__icon--success"><BarChart3 size={20} /></div>
          <span className="kpi-card__label">Puntaje Final</span>
          <span className="kpi-card__value" style={{ color: getScoreColor(ev.overall_score || 0) }}>
            {ev.overall_score !== null ? `${parseFloat(ev.overall_score).toFixed(1)}%` : '—'}
          </span>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-4">
        {ev.categories?.map((cat, catIdx) => (
          <motion.div
            key={cat.id}
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIdx * 0.08 }}
            style={{ borderLeft: '3px solid var(--accent-primary)' }}
          >
            {/* Category header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="font-semibold">{cat.name}</h3>
                <span className="badge badge--primary">{parseFloat(cat.weight)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Resultado:</span>
                <span className="text-mono font-bold" style={{ color: getScoreColor(cat.score || 0), fontSize: 'var(--text-lg)' }}>
                  {(cat.score || 0).toFixed(1)}%
                </span>
                <span className="text-xs text-secondary">
                  → {(cat.weighted_contribution || 0).toFixed(1)} pts
                </span>
              </div>
            </div>

            {/* Progress bar for category */}
            <div className="progress mb-4" style={{ height: 6 }}>
              <div className="progress__fill" style={{ width: `${Math.min(cat.score || 0, 100)}%` }} />
            </div>

            {/* Criteria table */}
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Criterio</th>
                    <th style={{ width: 85 }}>Tipo</th>
                    <th style={{ width: 80 }}>Peso</th>
                    {/* Agent columns */}
                    <th style={{ width: 100 }}>Avance</th>
                    <th style={{ width: 80 }}>Meta</th>
                    {/* Evaluator column */}
                    <th style={{ width: 100 }}>Calificación</th>
                    <th style={{ width: 80 }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.criteria.map(cr => {
                    const agentEdit = agentEdits[cr.id];
                    const evalEdit = evalEdits[cr.id];

                    return (
                      <tr key={cr.id}>
                        <td>
                          <div>
                            <span className="font-semibold text-sm">{cr.name}</span>
                            {cr.description && (
                              <p className="text-xs text-secondary mt-1">{cr.description}</p>
                            )}
                            {cr.rules && cr.rules.length > 0 && (
                              <div className="mt-2 text-xs" style={{ background: 'var(--bg-app)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Reglas de Puntuación:</strong>
                                <ul style={{ paddingLeft: 16, marginTop: 4, marginBottom: 0, color: 'var(--text-secondary)' }}>
                                  {cr.rules.map((r, i) => (
                                    <li key={i}>Entre <strong>{r.min}</strong> y <strong>{r.max}</strong> {cr.unit || 'pts'} → <strong>{r.pct}%</strong></li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(cr.cap_at_100 === 0 || cr.cap_at_100 === false) && (
                              <div className="mt-1">
                                <span className="badge badge--success" style={{ fontSize: '0.65rem' }}>🔥 Sin Límite (Puede superar 100%)</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge--${cr.type === 'measurable' ? 'secondary' : 'neutral'}`} style={{ fontSize: '0.65rem' }}>
                            {cr.type === 'measurable' ? 'Medible' : 'Subjetivo'}
                          </span>
                        </td>
                        <td><span className="text-mono text-sm">{parseFloat(cr.weight)}%</span></td>

                        {/* Agent value */}
                        <td>
                          {cr.type === 'measurable' && canAgentEdit ? (
                            <input
                              className="form-input"
                              type="number"
                              step="0.01"
                              value={agentEdit?.value ?? cr.agent_value ?? ''}
                              onChange={(e) => setAgentEdits({
                                ...agentEdits,
                                [cr.id]: { ...agentEdits[cr.id], value: e.target.value },
                              })}
                              style={{ width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)', padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-sm)' }}
                            />
                          ) : cr.type === 'measurable' ? (
                            <span className="text-mono text-sm">
                              {cr.agent_value !== null ? cr.agent_value : '—'}
                            </span>
                          ) : (
                            <span className="text-xs text-secondary">N/A</span>
                          )}
                        </td>
                        <td>
                          {cr.type === 'measurable' ? (
                            <span className="text-mono text-sm text-secondary">
                              {cr.target_value !== null ? `${cr.target_value} ${cr.unit || ''}` : '—'}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Evaluator score */}
                        <td>
                          {canEvaluatorEdit ? (
                            <input
                              className="form-input"
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={evalEdit?.score ?? cr.evaluator_score ?? ''}
                              onChange={(e) => setEvalEdits({
                                ...evalEdits,
                                [cr.id]: { ...evalEdits[cr.id], score: e.target.value },
                              })}
                              placeholder="0-100"
                              style={{ width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)', padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-sm)' }}
                            />
                          ) : (
                            <span className="text-mono text-sm">
                              {cr.evaluator_score !== null ? `${cr.evaluator_score}` : '—'}
                            </span>
                          )}
                        </td>

                        {/* Calculated score */}
                        <td>
                          <span className="text-mono font-bold" style={{ color: getScoreColor(cr.calculated_score || 0) }}>
                            {(cr.calculated_score || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ))}
      </div>

      {/* General comments (evaluator) */}
      {isEvaluator && (
        <div className="card mt-4">
          <div className="form-group">
            <label className="form-label flex items-center gap-2">
              <MessageSquare size={16} /> Comentarios Generales del Evaluador
            </label>
            <textarea
              className="form-textarea"
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
              placeholder="Comentarios generales sobre el desempeño del agente..."
              rows={3}
              disabled={ev.status === 'completed'}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-6" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn--secondary" onClick={exportToExcelWithFormulas}>
          <FileSpreadsheet size={18} /> Exportar Excel
        </button>
        {canAgentEdit && Object.keys(agentEdits).length > 0 && (
          <button className="btn btn--primary" onClick={handleAgentSave} disabled={saving}>
            {saving ? <div className="spinner" /> : <><Save size={18} /> Guardar Avance</>}
          </button>
        )}
        {canAgentEdit && isAgent && isOwner && (
          <button className="btn btn--secondary" onClick={handleAgentSubmit}>
            <Send size={18} /> Enviar para Revisión
          </button>
        )}
        {canEvaluatorEdit && Object.keys(evalEdits).length > 0 && (
          <button className="btn btn--primary" onClick={handleEvaluatorSave} disabled={saving}>
            {saving ? <div className="spinner" /> : <><Save size={18} /> Guardar Calificaciones</>}
          </button>
        )}
        {canComplete && (
          <button className="btn btn--primary" onClick={handleComplete}
            style={{ background: 'var(--gradient-success)' }}>
            <CheckCircle2 size={18} /> Completar Evaluación
          </button>
        )}
      </div>
    </div>
  );
}
