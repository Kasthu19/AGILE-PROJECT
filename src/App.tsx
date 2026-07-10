import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

// Super Admin pages
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import TenantsPage from './pages/super-admin/TenantsPage';
import SubscriptionsPage from './pages/super-admin/SubscriptionsPage';
import SuperAdminReports from './pages/super-admin/SuperAdminReports';

// Tuition Admin pages
import TuitionDashboard from './pages/tuition-admin/TuitionDashboard';
import StudentsPage from './pages/tuition-admin/StudentsPage';
import QRScannerPage from './pages/tuition-admin/QRScannerPage';
import PaymentsPage from './pages/tuition-admin/PaymentsPage';
import TuitionReports from './pages/tuition-admin/TuitionReports';
import StudentProfilePage from './pages/tuition-admin/StudentProfilePage';
import SettingsPage from './pages/SettingsPage';

function AppInner() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<string>('dashboard');
  const [viewStudentId, setViewStudentId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  const isSuperAdmin = profile.role === 'super_admin';

  function navigate(p: string) {
    setPage(p);
    setViewStudentId(null);
  }

  function renderPage() {
    if (page === 'settings') return <SettingsPage />;

    if (isSuperAdmin) {
      switch (page) {
        case 'dashboard': return <SuperAdminDashboard />;
        case 'tenants': return <TenantsPage />;
        case 'subscriptions': return <SubscriptionsPage />;
        case 'reports': return <SuperAdminReports />;
        default: return <SuperAdminDashboard />;
      }
    }

    // Tuition Admin
    if (viewStudentId) {
      return (
        <StudentProfilePage
          studentId={viewStudentId}
          onBack={() => { setViewStudentId(null); setPage('students'); }}
        />
      );
    }

    switch (page) {
      case 'dashboard': return <TuitionDashboard onNavigate={navigate} />;
      case 'students': return (
        <StudentsPage
          onViewStudent={(id) => { setViewStudentId(id); }}
        />
      );
      case 'scanner': return <QRScannerPage />;
      case 'payments': return <PaymentsPage />;
      case 'reports': return <TuitionReports />;
      default: return <TuitionDashboard onNavigate={navigate} />;
    }
  }

  const activePage = viewStudentId ? 'students' : page;

  return (
    <Layout currentPage={activePage} onNavigate={navigate}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
