import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  GraduationCap, LayoutDashboard, Users, QrCode, FileText,
  BarChart3, Settings, LogOut, Menu, X, Building2, CreditCard,
  ChevronRight, Bell
} from 'lucide-react';

const SUPER_ADMIN_LINKS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tuition Centers', icon: Building2 },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

const TUITION_ADMIN_LINKS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'scanner', label: 'QR Scanner', icon: QrCode },
  { id: 'payments', label: 'Payments', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isSuperAdmin = profile?.role === 'super_admin';
  const links = isSuperAdmin ? SUPER_ADMIN_LINKS : TUITION_ADMIN_LINKS;

  const navContent = (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-base leading-tight">EduFee QR</div>
          <div className="text-slate-400 text-xs">{isSuperAdmin ? 'Super Admin' : 'Admin Panel'}</div>
        </div>
      </div>

      <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {links.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => { onNavigate(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-70" />}
            </button>
          );
        })}
      </div>

      <div className="px-3 pb-4 border-t border-slate-700/50 pt-4 space-y-0.5">
        <button
          onClick={() => { onNavigate('settings'); setSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentPage === 'settings'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-900 flex-shrink-0">
        {navContent}
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-slate-900 flex flex-col shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-700 p-1"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-slate-800 font-semibold text-base capitalize truncate">
              {links.find(l => l.id === currentPage)?.label ?? currentPage}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative text-slate-400 hover:text-slate-600 p-1">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-slate-800 leading-none">{profile?.full_name ?? 'User'}</div>
                <div className="text-xs text-slate-400 mt-0.5">{isSuperAdmin ? 'Super Admin' : 'Admin'}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
