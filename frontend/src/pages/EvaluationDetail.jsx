import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Save, CheckCircle2, Send, Target, BarChart3,
  MessageSquare, AlertCircle, User, Calendar, Printer, FileSpreadsheet, Trash2, Paperclip, UploadCloud, X, ExternalLink, Download
} from 'lucide-react';
import { exportSingleExcel } from '../utils/excelExport';
import client from '../api/client';
import Swal from 'sweetalert2';

const STATUS_LABELS = {
  pending: 'Pendiente', in_progress: 'En Progreso', submitted: 'Enviada',
  reviewed: 'Revisada', completed: 'Completada',
};
const STATUS_VARIANTS = {
  pending: 'neutral', in_progress: 'warning', submitted: 'secondary',
  reviewed: 'primary', completed: 'success',
};

const EvidencePreviewModal = ({ evidence, onClose }) => {
  if (!evidence) return null;
  const url = evidence.file_url;
  const isImage = url.match(/\.(jpeg|jpg|gif|png)$/i);
  const isPdf = url.match(/\.(pdf)$/i);

  return (
    <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '90%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', overflow: 'hidden', padding: 0, margin: 'auto' }}>
        <div className="flex items-center justify-between" style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <h3 className="font-semibold text-sm truncate" style={{ flex: 1, margin: 0 }}>{evidence.file_name}</h3>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--icon btn--sm" title="Abrir en nueva pestaña">
              <ExternalLink size={16} />
            </a>
            <a href={url} download className="btn btn--ghost btn--icon btn--sm" title="Descargar">
              <Download size={16} />
            </a>
            <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} title="Cerrar">
              <X size={16} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          {isImage ? (
            <img src={url} alt={evidence.file_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : isPdf ? (
            <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title={evidence.file_name} />
          ) : (
            <div className="flex flex-col items-center justify-center text-secondary">
              <FileSpreadsheet size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>No hay vista previa disponible para este tipo de archivo.</p>
              <a href={url} download className="btn btn--primary mt-4">
                <Download size={16} /> Descargar Archivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function EvaluationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local edits
  const [agentEdits, setAgentEdits] = useState({});
  const [evalEdits, setEvalEdits] = useState({});
  const [generalComment, setGeneralComment] = useState('');
  const [uploadingCr, setUploadingCr] = useState(null);
  const [previewEvidence, setPreviewEvidence] = useState(null);

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
    setSaving(true);
    try {
      const scores = Object.entries(agentEdits).map(([criterion_id, data]) => ({
        criterion_id: parseInt(criterion_id),
        value: data.value,
        comment: data.comment,
      }));
      const res = await client.patch(`/evaluations/${id}/agent-scores`, { scores });
      setEvaluation(res.data.evaluation);
      setAgentEdits({});
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Avance guardado', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: err.response?.data?.error || 'Error al guardar', showConfirmButton: false, timer: 2000 });
    } finally { setSaving(false); }
  };

  const handleAgentSubmit = async () => {
    const confirmResult = await Swal.fire({
      title: '¿Enviar evaluación?',
      text: 'Ya no podrás hacer más cambios.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmResult.isConfirmed) return;
    try {
      const res = await client.patch(`/evaluations/${id}/submit`);
      setEvaluation(res.data.evaluation);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Evaluación enviada', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: err.response?.data?.error || 'Error al enviar', showConfirmButton: false, timer: 2000 });
    }
  };

  const handleEvaluatorSave = async () => {
    setSaving(true);
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
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Calificaciones guardadas', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: err.response?.data?.error || 'Error al guardar', showConfirmButton: false, timer: 2000 });
    } finally { setSaving(false); }
  };

  const handleComplete = async () => {
    const confirmResult = await Swal.fire({
      title: '¿Completar evaluación?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, completar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmResult.isConfirmed) return;
    try {
      const res = await client.patch(`/evaluations/${id}/complete`);
      setEvaluation(res.data.evaluation);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Evaluación completada', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: err.response?.data?.error || 'Error al completar', showConfirmButton: false, timer: 2000 });
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción no se puede deshacer. Se eliminarán todas las calificaciones asociadas.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setSaving(true);
      try {
        await client.delete(`/evaluations/${id}`);
        Swal.fire('Eliminado!', 'La evaluación ha sido eliminada.', 'success').then(() => {
          navigate('/evaluations');
        });
      } catch (err) {
        Swal.fire('Error', err.response?.data?.error || 'No se pudo eliminar', 'error');
        setSaving(false);
      }
    }
  };

  const handleUploadEvidence = async (criterionId, file) => {
    if (!file) return;
    setUploadingCr(criterionId);
    try {
      const formData = new FormData();
      formData.append('evidence', file);
      
      const res = await client.post(`/evaluations/${id}/scores/${criterionId}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setEvaluation(prev => {
        return {
          ...prev,
          categories: prev.categories.map(cat => ({
            ...cat,
            criteria: cat.criteria.map(cr =>
              cr.id === criterionId
                ? { ...cr, evidences: [...(cr.evidences || []), res.data.evidence] }
                : cr
            )
          }))
        };
      });
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Archivo subido', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.error || 'No se pudo subir', 'error');
    } finally {
      setUploadingCr(null);
      const fileInput = document.getElementById(`file_${criterionId}`);
      if (fileInput) fileInput.value = '';
    }
  };

  const handleDeleteEvidence = async (evidenceId) => {
    const confirmResult = await Swal.fire({
      title: '¿Eliminar esta evidencia?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmResult.isConfirmed) return;
    try {
      await client.delete(`/evaluations/evidence/${evidenceId}`);
      
      setEvaluation(prev => {
        return {
          ...prev,
          categories: prev.categories.map(cat => ({
            ...cat,
            criteria: cat.criteria.map(cr => ({
              ...cr,
              evidences: cr.evidences ? cr.evidences.filter(e => e.id !== evidenceId) : []
            }))
          }))
        };
      });
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Archivo eliminado', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.error || 'No se pudo eliminar', 'error');
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
          } else if (agentVal !== null && agentVal !== undefined && agentVal !== '') {
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
            
            if (!matchedRule && cr.target_value !== null && cr.target_value !== undefined) {
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

      {/* Preview Modal */}
      <EvidencePreviewModal evidence={previewEvidence} onClose={() => setPreviewEvidence(null)} />

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

                            {/* Evidences */}
                            {(cr.requires_evidence || cr.evidences?.length > 0) && (
                              <div className="mt-3" style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                <div className="flex items-center justify-between mb-2">
                                  <strong className="flex items-center gap-2" style={{ color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                                    <Paperclip size={14} /> Evidencias {cr.requires_evidence ? '(Requerida)' : '(Opcional)'}
                                  </strong>
                                  {canAgentEdit && cr.evidences?.length > 0 && (
                                    <div>
                                      <input type="file" id={`file_${cr.id}`} style={{ display: 'none' }} onChange={(e) => handleUploadEvidence(cr.id, e.target.files[0])} accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv" />
                                      <label htmlFor={`file_${cr.id}`} className="btn btn--ghost btn--sm" style={{ cursor: 'pointer', fontSize: '0.7rem', padding: '4px 8px', color: 'var(--accent-primary)' }}>
                                        {uploadingCr === cr.id ? <span className="spinner" style={{ width: 12, height: 12 }}></span> : '+ Añadir otro'}
                                      </label>
                                    </div>
                                  )}
                                </div>
                                
                                {(!cr.evidences || cr.evidences.length === 0) ? (
                                  <div className="flex flex-col items-center justify-center" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                                    {canAgentEdit ? (
                                      <>
                                        <UploadCloud size={24} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                                        <span className="text-xs text-secondary mb-2">Sube la evidencia requerida para este criterio</span>
                                        <input type="file" id={`file_empty_${cr.id}`} style={{ display: 'none' }} onChange={(e) => handleUploadEvidence(cr.id, e.target.files[0])} accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv" />
                                        <label htmlFor={`file_empty_${cr.id}`} className="btn btn--secondary btn--sm" style={{ cursor: 'pointer', fontSize: '0.75rem' }}>
                                          {uploadingCr === cr.id ? <><span className="spinner" style={{ width: 14, height: 14 }}></span> Subiendo...</> : 'Seleccionar Archivo'}
                                        </label>
                                      </>
                                    ) : (
                                      <span className="text-xs text-secondary">No se ha subido evidencia.</span>
                                    )}
                                  </div>
                                ) : (
                                  <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {cr.evidences.map(evd => (
                                      <li key={evd.id} className="flex items-center justify-between" style={{ fontSize: '0.75rem', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                        <button onClick={() => setPreviewEvidence(evd)} className="flex items-center gap-2 hover:opacity-80" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                          <Paperclip size={12} /> <span style={{ textDecoration: 'underline' }}>{evd.file_name}</span>
                                        </button>
                                        {canAgentEdit && (
                                          <button className="btn btn--icon btn--ghost btn--sm text-danger" onClick={() => handleDeleteEvidence(evd.id)} title="Eliminar evidencia">
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
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
        {isEvaluator && (
          <button className="btn btn--secondary" onClick={handleDelete} disabled={saving} style={{ color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)' }}>
            <Trash2 size={18} /> Eliminar
          </button>
        )}
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
