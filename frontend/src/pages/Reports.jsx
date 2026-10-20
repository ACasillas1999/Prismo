import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { 
  BarChart3, TrendingUp, Users, Award, AlertTriangle, Building2, Calendar, FileSpreadsheet,
  UserCheck, Eye
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip as RadarTooltip
} from 'recharts';
import { exportDashboardExcel, exportAgentReportExcel } from '../utils/excelExport';

export default function Reports() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'agent'
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  // General Report State
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    trendData: [],
    topPerformers: [],
    bottomPerformers: [],
    fullRanking: [],
    categoryAverages: []
  });

  // Agent Report State
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentData, setAgentData] = useState({
    agent: null,
    stats: { avgScore: 0, totalEvals: 0, maxScore: 0, latestScore: 0 },
    trendData: [],
    categoryAverages: [],
    evaluations: []
  });

  // Fetch departments if admin
  useEffect(() => {
    if (isAdmin) {
      client.get('/departments')
        .then(res => setDepartments(res.data.departments))
        .catch(console.error);
    }
  }, [isAdmin]);

  // Fetch agents list for Agent tab
  useEffect(() => {
    client.get('/reports/agents-list')
      .then(res => {
        const list = res.data.agents || [];
        setAgents(list);
        if (list.length > 0) {
          setSelectedAgentId(prev => (prev && list.some(a => a.id === parseInt(prev)) ? prev : list[0].id));
        }
      })
      .catch(console.error);
  }, [activeTab]);

  // Fetch General Report
  useEffect(() => {
    if (activeTab !== 'general') return;
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
        console.error('Error fetching general reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [activeTab, isAdmin, selectedDept, startDate, endDate]);

  // Fetch Agent Report
  useEffect(() => {
    if (activeTab !== 'agent' || !selectedAgentId) return;
    const fetchAgentReport = async () => {
      setAgentLoading(true);
      try {
        const params = { user_id: selectedAgentId };
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        const res = await client.get('/reports/agent-history', { params });
        setAgentData(res.data);
      } catch (err) {
        console.error('Error fetching agent report:', err);
      } finally {
        setAgentLoading(false);
      }
    };
    fetchAgentReport();
  }, [activeTab, selectedAgentId, startDate, endDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (activeTab === 'general') {
        const deptName = departments.find(d => d.id === parseInt(selectedDept))?.name || 'General';
        const filename = `Reporte_General_${deptName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        await exportDashboardExcel(data, deptName, filename);
      } else {
        const agentName = agentData.agent ? `${agentData.agent.first_name}_${agentData.agent.last_name}` : 'Agente';
        const filename = `Reporte_Historico_${agentName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        await exportAgentReportExcel(agentData, filename);
      }
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
          <p className="page-header__subtitle">Métricas de rendimiento del equipo y seguimiento individual por agente</p>
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

          {activeTab === 'general' && isAdmin && (
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

          {activeTab === 'agent' && (
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-secondary" />
              <select 
                className="form-select" 
                value={selectedAgentId} 
                onChange={e => setSelectedAgentId(e.target.value)}
                style={{ width: 260, fontWeight: 600 }}
              >
                {agents.length === 0 ? (
                  <option value="">Sin agentes disponibles</option>
                ) : (
                  agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name} {a.position_name ? `(${a.position_name})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <button className="btn btn--primary" onClick={handleExport} disabled={(activeTab === 'general' ? loading : agentLoading) || exporting}>
            <FileSpreadsheet size={18} /> {exporting ? 'Exportando...' : 'Exportar a Excel'}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
        <button
          className={`btn ${activeTab === 'general' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('general')}
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <BarChart3 size={16} /> Rendimiento General del Equipo
        </button>
        <button
          className={`btn ${activeTab === 'agent' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('agent')}
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <UserCheck size={16} /> Histórico por Agente
        </button>
      </div>

      {/* TAB 1: GENERAL DEL EQUIPO */}
      {activeTab === 'general' && (
        loading ? (
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
                <TrendingUp className="text-primary" /> Tendencia Histórica del Equipo
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 'var(--space-8)', alignItems: 'center' }}>
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
        )
      )}

      {/* TAB 2: RENDIMIENTO POR AGENTE */}
      {activeTab === 'agent' && (
        agentLoading ? (
          <div className="flex items-center" style={{ justifyContent: 'center', height: 200 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : agents.length === 0 ? (
          <div className="empty-state card">
            <p>No tienes agentes a tu cargo o evaluados en tu lista.</p>
          </div>
        ) : !agentData.agent ? (
          <div className="empty-state card">
            <p>Selecciona un agente para consultar su historial de rendimiento.</p>
          </div>
        ) : (
          <motion.div 
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Agent Header / Profile Card */}
            <div className="card flex items-center justify-between flex-wrap gap-4" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-primary)' }}>
              <div className="flex items-center gap-4">
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', fontWeight: 'bold'
                }}>
                  {agentData.agent.first_name?.[0]}{agentData.agent.last_name?.[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary">
                    {agentData.agent.first_name} {agentData.agent.last_name}
                  </h2>
                  <p className="text-sm text-secondary">
                    {agentData.agent.position_name || 'Sin puesto'} &bull; {agentData.agent.department_name || 'Sin departamento'}
                  </p>
                  <p className="text-xs text-tertiary mt-1">{agentData.agent.email}</p>
                </div>
              </div>

              {/* KPI Summary Badges */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-center" style={{ background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 'var(--radius-md)', minWidth: 110 }}>
                  <span className="text-xs text-tertiary block mb-1">Promedio Histórico</span>
                  <span className={`text-lg font-bold ${agentData.stats.avgScore >= 80 ? 'text-success' : agentData.stats.avgScore >= 60 ? 'text-warning' : 'text-danger'}`}>
                    {agentData.stats.avgScore}%
                  </span>
                </div>
                <div className="text-center" style={{ background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 'var(--radius-md)', minWidth: 110 }}>
                  <span className="text-xs text-tertiary block mb-1">Evaluaciones</span>
                  <span className="text-lg font-bold text-primary">
                    {agentData.stats.totalEvals}
                  </span>
                </div>
                <div className="text-center" style={{ background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 'var(--radius-md)', minWidth: 110 }}>
                  <span className="text-xs text-tertiary block mb-1">Mejor Puntaje</span>
                  <span className="text-lg font-bold text-success">
                    {agentData.stats.maxScore}%
                  </span>
                </div>
                <div className="text-center" style={{ background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 'var(--radius-md)', minWidth: 110 }}>
                  <span className="text-xs text-tertiary block mb-1">Último Puntaje</span>
                  <span className={`text-lg font-bold ${agentData.stats.latestScore >= 80 ? 'text-success' : agentData.stats.latestScore >= 60 ? 'text-warning' : 'text-danger'}`}>
                    {agentData.stats.latestScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* Line Chart: Evolución en el tiempo */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="text-primary" /> Evolución de Resultados a través del Tiempo
              </h3>
              <div style={{ height: 320 }}>
                {agentData.trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={agentData.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="var(--text-secondary)" fontSize={12} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                        formatter={(val) => [`${val}%`, 'Calificación Obtenida']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        name="Calificación" 
                        stroke="var(--accent-primary)" 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: 'var(--accent-primary)' }} 
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                    <p>No se registraron evaluaciones cerradas para este agente en el período seleccionado.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Category Performance Breakdown */}
            {agentData.categoryAverages.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="text-secondary" /> Promedio de Rendimiento por Categoría
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 'var(--space-6)', alignItems: 'center' }}>
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={agentData.categoryAverages}>
                        <PolarGrid stroke="var(--border-subtle)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar name="Promedio Agente" dataKey="A" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.4} />
                        <RadarTooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <div className="table-container" style={{ margin: 0 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Categoría</th>
                            <th style={{ textAlign: 'center' }}>Promedio del Agente</th>
                            <th style={{ textAlign: 'center' }}>Meta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentData.categoryAverages.map((cat, i) => (
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
                  </div>
                </div>
              </div>
            )}

            {/* Evaluations History Table */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Users className="text-primary" /> Historial de Evaluaciones Cerradas
              </h3>
              {agentData.evaluations.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Plantilla</th>
                        <th>Evaluador</th>
                        <th>Fecha de Cierre</th>
                        <th>Calificación</th>
                        <th style={{ textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentData.evaluations.map((ev) => (
                        <tr key={ev.id}>
                          <td className="font-bold text-primary">{ev.period_name}</td>
                          <td>{ev.template_title}</td>
                          <td>
                            {ev.evaluator_first ? `${ev.evaluator_first} ${ev.evaluator_last}` : <span className="text-tertiary">Autoasignado</span>}
                          </td>
                          <td className="text-secondary text-sm">
                            {ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                          </td>
                          <td className="font-bold">
                            <span className={`badge ${ev.overall_score >= 80 ? 'badge--success' : ev.overall_score >= 60 ? 'badge--warning' : 'badge--danger'}`} style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                              {parseFloat(ev.overall_score).toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn--secondary btn--sm flex items-center gap-1"
                              style={{ marginLeft: 'auto' }}
                              onClick={() => navigate(`/evaluations/${ev.id}`)}
                            >
                              <Eye size={14} /> Ver Detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>Este agente aún no cuenta con evaluaciones en el rango seleccionado.</p>
                </div>
              )}
            </div>
          </motion.div>
        )
      )}
    </div>
  );
}
