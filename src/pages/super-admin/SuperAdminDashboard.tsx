import { useEffect, useState } from 'react';
import { Tenant } from '../../lib/supabase';
import { api } from '../../lib/api';
import { StatCard, StatusBadge, Spinner } from '../../components/ui';
import { Building2, Users, DollarSign, TrendingUp, Activity } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ tenants }, overview] = await Promise.all([
        api<{ tenants: Tenant[] }>('/api/institutes'),
        api<{ totalStudents: number }>('/api/admin/overview'),
      ]);
      setTenants(tenants);
      setTotalStudents(overview.totalStudents);
      setLoading(false);
    }
    load();
  }, []);

  const active = tenants.filter(t => t.status === 'active').length;
  const suspended = tenants.filter(t => t.status === 'suspended').length;
  const pending = tenants.filter(t => t.status === 'pending').length;

  const planRevenue: Record<string, number> = { starter: 29, professional: 79, enterprise: 199 };
  const mrr = tenants.filter(t => t.status === 'active').reduce((s, t) => s + (planRevenue[t.subscription_plan] ?? 0), 0);

  if (loading) return <Spinner />;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Platform Overview</h2>
        <p className="text-slate-500 text-sm mt-0.5">Monitor all tuition centers and revenue across the platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Institutes" value={tenants.length} icon={<Building2 className="w-5 h-5" />} color="blue" subtext={`${active} active`} />
        <StatCard label="Total Students" value={totalStudents} icon={<Users className="w-5 h-5" />} color="emerald" />
        <StatCard label="Monthly Revenue" value={`$${mrr.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="violet" subtext="From active plans" />
        <StatCard label="Active Institutes" value={active} icon={<TrendingUp className="w-5 h-5" />} color="amber" subtext={`${suspended} suspended, ${pending} pending`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Plan Distribution</h3>
          {['starter', 'professional', 'enterprise'].map(plan => {
            const count = tenants.filter(t => t.subscription_plan === plan).length;
            const pct = tenants.length ? Math.round((count / tenants.length) * 100) : 0;
            const colors: Record<string, string> = { starter: 'bg-slate-500', professional: 'bg-blue-500', enterprise: 'bg-violet-500' };
            return (
              <div key={plan} className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600 capitalize font-medium">{plan}</span>
                  <span className="text-slate-500">{count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${colors[plan]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Institutes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Recent Institutes</h3>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            {tenants.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{t.subscription_plan}</p>
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
            {tenants.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">No institutes registered yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
