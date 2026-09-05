import React, { useState, useEffect } from 'react';
import { Copy, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import client from '../../api/client';

export default function DuplicateTemplateModal({ isOpen, onClose, template, positions = [], onSuccess }) {
  const [positionId, setPositionId] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (template) {
      setPositionId(template.position_id || '');
      setName(`${template.name || ''} (Copia)`);
      setError('');
    }
  }, [template, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la plantilla es requerido');
      return;
    }
    if (!positionId) {
      setError('Debes seleccionar el puesto destino');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await client.post(`/templates/${template.id}/duplicate`, {
        target_position_id: positionId,
        name: name.trim(),
      });
      onClose();
      if (onSuccess) {
        onSuccess(res.data.template);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al duplicar la plantilla');
    } finally {
      setSubmitting(false);
    }
  };

  if (!template) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicar Plantilla de Evaluación"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn btn--secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button className="btn btn--primary" type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <div className="spinner" />
            ) : (
              <>
                <Copy size={16} /> Duplicar Plantilla
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="login-card__error" style={{ marginBottom: 0 }}>
            <AlertCircle size={16} style={{ marginRight: 8 }} />
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label form-label--required">Nombre para la nueva plantilla</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Evaluación Desarrollador (Copia)"
          />
        </div>

        <div className="form-group">
          <label className="form-label form-label--required">Puesto Destino</label>
          <select
            className="form-select"
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
          >
            <option value="">Seleccionar puesto...</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.department_name ? `${p.department_name} → ` : ''}{p.name}
              </option>
            ))}
          </select>
          <p className="form-help text-xs text-secondary mt-1">
            Puedes clonar esta plantilla para el mismo puesto u otro puesto diferente.
          </p>
        </div>
      </form>
    </Modal>
  );
}
