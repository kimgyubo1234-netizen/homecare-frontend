import { Component, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import PatientDetail from '@/pages/PatientDetail';
import Alerts from '@/pages/Alerts';
import RegisterPatient from '@/pages/RegisterPatient';
import Profile from '@/pages/Profile';
import AuthGuard from '@/components/AuthGuard';
import RoleGuard from '@/components/RoleGuard';
import HomeLayout from '@/components/HomeLayout';
import AdminDashboard from '@/pages/AdminDashboard';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
          <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-base font-bold text-red-600 mb-2">렌더링 오류 발생</h1>
            <p className="text-sm font-mono text-slate-700 bg-slate-50 rounded p-3 break-all">
              {err.message}
            </p>
            <p className="text-xs text-slate-400 mt-3 font-mono whitespace-pre-wrap break-all">
              {err.stack?.split('\n').slice(0, 6).join('\n')}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              처음으로 돌아가기
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* 상단 헤더 레이아웃 — 사이드바 없음 */}
        <Route element={<AuthGuard><HomeLayout /></AuthGuard>}>
          <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/dashboard/:patientId" element={<ErrorBoundary><PatientDetail /></ErrorBoundary>} />
          <Route path="/alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
          <Route path="/register-patient" element={<ErrorBoundary><RoleGuard role="admin"><RegisterPatient /></RoleGuard></ErrorBoundary>} />
          <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
        </Route>

        {/* 관리자 전용 */}
        <Route
          path="/admin"
          element={
            <ErrorBoundary>
              <AuthGuard><RoleGuard role="admin"><AdminDashboard /></RoleGuard></AuthGuard>
            </ErrorBoundary>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
