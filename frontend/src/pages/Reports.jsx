import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { 
  BarChart3, TrendingUp, Users, Award, AlertTriangle, Building2, Calendar, FileSpreadsheet
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip as RadarTooltip, Legend
} from 'recharts';
import { exportDashboardExcel } from '../utils/excelExport';

export default function Reports() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    trendData: [],
    topPerformers: [],
    bottomPerformers: [],
    fullRanking: [],
    categoryAverages: []
  });

  // Fetch departments if admin
  useEffect(() => {
    if (isAdmin) {
      client.get('/departments')
        .then(res => setDepartments(res.data.departments))
        .catch(console.error);
    }
  }, [isAdmin]);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const params = {};
        if (isAdmin && selectedDept) params.department_id = selectedDept;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        
        const res = await client.get('/reports/dashboard', { params });
        setData(res.data);
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [isAdmin, selectedDept, startDate, endDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const deptName = departments.find(d => d.id === parseInt(selectedDept))?.name || 'General';
      const filename = `Reporte_${deptName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await exportDashboardExcel(data, deptName, filename);
    } catch (err) {
      console.error('Error exporting:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div className="page-header__info">
          <h1 className="page-header__title">Análisis y Reportes</h1>
          <p className="page-header__subtitle">Métricas de rendimiento y tendencias del equipo</p>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-tertiary" />
            <input 
              type="date" 
              className="form-input" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              title="Fecha Inicio"
            />
            <span className="text-tertiary">-</span>
            <input 
              type="date" 
              className="form-input" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              title="Fecha Fin"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-secondary" />
              <select 
                className="form-select" 
                value={selectedDept} 
                onChange={e => setSelectedDept(e.target.value)}
                style={{ width: 200 }}
              >
                <option value="">Todos los Departamentos</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <button className="btn btn--primary" onClick={handleExport} disabled={loading || exporting}>
            <FileSpreadsheet size={18} /> {exporting ? 'Exportando...' : 'Exportar a Excel'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', height: 200 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <motion.div 
          className="dashboard-grid"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Trend Chart */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="text-primary" /> Tendencia Histórica
            </h3>
            <div style={{ height: 300 }}>
              {data.trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="var(--text-secondary)" fontSize={12} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Line type="monotone" dataKey="score" name="Promedio" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-primary)' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                  <p>No hay datos históricos suficientes</p>
                </div>
              )}
            </div>
          </div>

          {/* Category Radar */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="text-secondary" /> Desempeño por Área (Último Período)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-8)', alignItems: 'center' }}>
              <div style={{ height: 350 }}>
                {data.categoryAverages.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.categoryAverages}>
                      <PolarGrid stroke="var(--border-subtle)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Promedio" dataKey="A" stroke="var(--accent-secondary)" fill="var(--accent-secondary)" fillOpacity={0.5} />
                      <RadarTooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                    <p>No hay evaluaciones recientes cerradas</p>
                  </div>
                )}
              </div>
              
              <div>
                {data.categoryAverages.length > 0 && (
                  <div className="table-container" style={{ margin: 0 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Categoría Evaluada</th>
                          <th style={{ textAlign: 'center' }}>Promedio del Equipo</th>
                          <th style={{ textAlign: 'center' }}>Meta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.categoryAverages.map((cat, i) => (
                          <tr key={i}>
                            <td className="font-medium">{cat.subject}</td>
                            <td style={{ textAlign: 'center' }} className={cat.A >= 80 ? 'text-success font-bold' : cat.A >= 60 ? 'text-warning font-bold' : 'text-danger font-bold'}>
                              {cat.A}%
                            </td>
                            <td style={{ textAlign: 'center' }} className="text-tertiary">100%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Award className="text-success" /> Top Agentes (Último Período)
            </h3>
            {data.topPerformers.length > 0 ? (
              <div className="table-container mb-6">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Agente</th>
                      <th>Desempeño</th>
                      <th>Calificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPerformers.map((agent, i) => (
                      <tr key={i}>
                        <td className="font-bold text-tertiary">{i + 1}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12, color: 'var(--accent-primary)' }}>
                              {agent.first_name[0]}{agent.last_name[0]}
                            </div>
                            <span className="font-medium">{agent.first_name} {agent.last_name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-tertiary" style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px' }}>Rendimiento Destacado</span>
                        </td>
                        <td className="text-lg font-bold text-success">{parseFloat(agent.overall_score).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>Sin información disponible</p>
              </div>
            )}

            {/* Bottom Performers (Atención) */}
            {data.bottomPerformers.length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-warning">
                  <AlertTriangle size={16} /> Requieren Atención
                </h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Alerta</th>
                        <th>Agente</th>
                        <th>Calificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bottomPerformers.map((agent, i) => (
                        <tr key={i}>
                          <td className="text-warning"><AlertTriangle size={16} /></td>
                          <td className="font-medium">{agent.first_name} {agent.last_name}</td>
                          <td className="font-bold text-danger">{parseFloat(agent.overall_score).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Full Ranking Table */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="text-primary" /> Resultados Detallados del Equipo
            </h3>
            {data.fullRanking && data.fullRanking.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ranking</th>
                      <th>Agente</th>
                      <th>Puesto</th>
                      <th>Evaluador</th>
                      <th>Calificación Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fullRanking.map((agent, i) => (
                      <tr key={i}>
                        <td className="font-bold text-tertiary">#{i + 1}</td>
                        <td>
                          <div className="font-medium text-primary">{agent.first_name} {agent.last_name}</div>
                        </td>
                        <td>{agent.position_name}</td>
                        <td>
                          {agent.evaluator_first ? `${agent.evaluator_first} ${agent.evaluator_last}` : <span className="text-tertiary">Autoasignado</span>}
                        </td>
                        <td className="font-bold">
                          <span className={agent.overall_score >= 80 ? 'text-success' : agent.overall_score >= 60 ? 'text-warning' : 'text-danger'}>
                            {parseFloat(agent.overall_score).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No hay datos disponibles para mostrar el detalle del equipo.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
