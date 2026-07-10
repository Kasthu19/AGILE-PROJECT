import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { StatCard, Spinner } from '../../components/ui';
import { Users, DollarSign, AlertCircle, TrendingUp, QrCode } from 'lucide-react';

interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  unpaidCount: number;
  todayCollection: number;
  monthCollection: number;
  recentPayments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    students: { full_name: string; student_code: string } | null;
  }>;
}

export default function TuitionDashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setData(await api<DashboardData>('/api/tuition/dashboard'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          onClick={() => onNavigate('scanner')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <QrCode className="w-4 h-4" />
          Scan QR
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={data.totalStudents} icon={<Users className="w-5 h-5" />} color="blue" subtext={`${data.activeStudents} active`} />
        <StatCard label="Today's Collection" value={`$${data.todayCollection.toFixed(2)}`} icon={<DollarSign className="w-5 h-5" />} color="emerald" />
        <StatCard label="Unpaid This Month" value={data.unpaidCount} icon={<AlertCircle className="w-5 h-5" />} color="red" />
        <StatCard label="Month Collection" value={`$${data.monthCollection.toFixed(2)}`} icon={<TrendingUp className="w-5 h-5" />} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Scan QR Code', page: 'scanner', icon: <QrCode className="w-5 h-5" />, color: 'bg-blue-600 text-white' },
              { label: 'Add Student', page: 'students', icon: <Users className="w-5 h-5" />, color: 'bg-emerald-600 text-white' },
              { label: 'View Reports', page: 'reports', icon: <TrendingUp className="w-5 h-5" />, color: 'bg-violet-600 text-white' },
              { label: 'View Payments', page: 'payments', icon: <DollarSign className="w-5 h-5" />, color: 'bg-amber-600 text-white' },
            ].map(a => (
              <button
                key={a.page}
                onClick={() => onNavigate(a.page)}
                className={`${a.color} rounded-xl p-4 text-left hover:opacity-90 transition-opacity`}
              >
                <div className="mb-2 opacity-80">{a.icon}</div>
                <div className="text-sm font-semibold">{a.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {data.recentPayments.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No payments yet</p>
            ) : data.recentPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.students?.full_name ?? 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{new Date(p.payment_date).toLocaleDateString()} · {p.payment_method.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">${p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
