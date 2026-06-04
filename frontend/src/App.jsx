import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Positions from './pages/Positions';
import UsersPage from './pages/Users';
import Templates from './pages/Templates';
import TemplateDetail from './pages/TemplateDetail';
import Periods from './pages/Periods';
import Evaluations from './pages/Evaluations';
import EvaluationDetail from './pages/EvaluationDetail';
import MyEvaluations from './pages/MyEvaluations';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <Topbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={
            <ProtectedRoute roles={['admin', 'department_head']}>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* Phase 2: Admin management */}
          <Route path="/departments" element={
            <ProtectedRoute roles={['admin']}>
              <Departments />
            </ProtectedRoute>
          } />
          <Route path="/positions" element={
            <ProtectedRoute roles={['admin']}>
              <Positions />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute roles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
          <Route path="/audit" element={
            <ProtectedRoute roles={['admin']}>
              <AuditLogs />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute roles={['admin', 'department_head']}>
              <Reports />
            </ProtectedRoute>
          } />

          {/* Phase 3: Evaluation engine */}
          <Route path="/templates" element={
            <ProtectedRoute roles={['admin', 'department_head']}>
              <Templates />
            </ProtectedRoute>
          } />
          <Route path="/templates/:id" element={
            <ProtectedRoute roles={['admin', 'department_head']}>
              <TemplateDetail />
            </ProtectedRoute>
          } />
          <Route path="/periods" element={
            <ProtectedRoute roles={['admin', 'department_head']}>
              <Periods />
            </ProtectedRoute>
          } />

          {/* Phase 4: Evaluations */}
          <Route path="/evaluations" element={
            <ProtectedRoute roles={['admin', 'department_head']}>
              <Evaluations />
            </ProtectedRoute>
          } />
          <Route path="/evaluations/:id" element={
            <ProtectedRoute roles={['admin', 'department_head', 'agent']}>
              <EvaluationDetail />
            </ProtectedRoute>
          } />
          <Route path="/my-evaluations" element={
            <ProtectedRoute roles={['agent']}>
              <MyEvaluations />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AppRouter() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center" style={{ justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/*" element={
        isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
