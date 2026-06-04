import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Search, ShieldAlert, FileSpreadsheet, User as UserIcon, ClipboardCheck } from 'lucide-react';
import client from '../api/client';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await client.get('/audit');
        setLogs(res.data.logs);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionDetails = (log) => {
    switch (log.action) {
      case 'CREATE_USER': return 'Creó un usuario nuevo';
      case 'UPDATE_USER': return 'Actualizó un usuario';
      case 'DELETE_USER': return 'Dio de baja a un usuario';
      case 'CREATE_TEMPLATE': return 'Creó una plantilla';
      case 'UPDATE_TEMPLATE': return 'Actualizó una plantilla';
      case 'DELETE_TEMPLATE': return 'Eliminó una plantilla';
      case 'CREATE_EVALUATION': return 'Generó una evaluación';
      case 'COMPLETE_EVALUATION': return 'Completó una evaluación';
      case 'AUTO_GENERATED_EVALUATIONS': return 'Generación automática masiva';
      default: return log.action;
    }
  };

  const getEntityIcon = (entity) => {
    switch (entity) {
      case 'user': return <UserIcon size={16} className="text-secondary" />;
      case 'template': return <FileSpreadsheet size={16} className="text-primary" />;
      case 'evaluation': return <ClipboardCheck size={16} className="text-warning" />;
      case 'system': return <ShieldAlert size={16} className="text-danger" />;
      default: return <History size={16} />;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Historial de Auditoría</h1>
          <p className="page-header__subtitle">
            Bitácora de movimientos y cambios críticos en la plataforma
          </p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center" style={{ justifyContent: 'center', padding: 'var(--space-16)' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><History size={28} /></div>
            <p className="empty-state__title">Sin registros</p>
            <p className="empty-state__description">No hay eventos recientes en la plataforma.</p>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Usuario Autor</th>
                  <th>Acción Realizada</th>
                  <th>Módulo</th>
                  <th>Detalles Adicionales</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {logs.map(log => {
                    const parsedDetails = log.details ? JSON.parse(log.details) : {};
                    return (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <td>
                          <div className="text-sm font-medium">
                            {new Date(log.created_at).toLocaleDateString('es-MX', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-tertiary">
                            {new Date(log.created_at).toLocaleTimeString('es-MX')}
                          </div>
                        </td>
                        <td>
                          {log.user_id ? (
                            <span className="font-medium text-sm">
                              {log.first_name} {log.last_name}
                            </span>
                          ) : (
                            <span className="badge badge--danger" style={{ fontSize: '10px' }}>Sistema</span>
                          )}
                        </td>
                        <td>
                          <span className="text-sm font-medium">{getActionDetails(log)}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {getEntityIcon(log.entity_type)}
                            <span className="text-sm uppercase" style={{ fontSize: '11px', fontWeight: 600 }}>
                              {log.entity_type} #{log.entity_id}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="text-xs text-secondary" style={{ fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.details || '-'}
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
      </div>
    </div>
  );
}
