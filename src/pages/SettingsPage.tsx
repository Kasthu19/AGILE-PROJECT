import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/ui';
import { Settings, Building2, User, Save, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [tenantForm, setTenantForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [profileForm, setProfileForm] = useState({ full_name: '' });
  const [loading, setLoading] = useState(true);
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedTenant, setSavedTenant] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      setProfileForm({ full_name: profile.full_name ?? '' });
      if (profile.tenant_id) {
        const { tenant } = await api<{ tenant: typeof tenantForm }>('/api/tuition/settings');
        if (tenant) setTenantForm({ name: tenant.name, email: tenant.email, phone: tenant.phone ?? '', address: tenant.address ?? '' });
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  async function handleSaveTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.tenant_id) return;
    setSavingTenant(true);
    await api('/api/tuition/settings', { method: 'PATCH', body: JSON.stringify(tenantForm) });
    setSavingTenant(false);
    setSavedTenant(true);
    setTimeout(() => setSavedTenant(false), 2000);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ full_name: profileForm.full_name }) });
    await refreshProfile();
    setSavingProfile(false);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 2000);
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Settings</h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and institute details.</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-slate-800">Account Details</h3>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <input
              value={profileForm.full_name}
              onChange={e => setProfileForm({ full_name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <input value={profile?.role === 'super_admin' ? 'Super Admin' : 'Tuition Admin'} disabled className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
          </div>
          <button type="submit" disabled={savingProfile} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {savedProfile ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedProfile ? 'Saved!' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Institute */}
      {profile?.tenant_id && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Institute Details</h3>
          </div>
          <form onSubmit={handleSaveTenant} className="space-y-4">
            {[
              { field: 'name', label: 'Institute Name', type: 'text' },
              { field: 'email', label: 'Contact Email', type: 'email' },
              { field: 'phone', label: 'Phone Number', type: 'text' },
            ].map(({ field, label, type }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={(tenantForm as Record<string, string>)[field]}
                  onChange={e => setTenantForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
              <textarea
                value={tenantForm.address}
                onChange={e => setTenantForm(f => ({ ...f, address: e.target.value }))}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button type="submit" disabled={savingTenant} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {savedTenant ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savedTenant ? 'Saved!' : 'Save Institute'}
            </button>
          </form>
        </div>
      )}

      {/* Subscription Info */}
      {profile?.tenant_id && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Settings className="w-4 h-4 text-violet-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Subscription</h3>
          </div>
          <TenantPlanInfo tenantId={profile.tenant_id} />
        </div>
      )}
    </div>
  );
}

function TenantPlanInfo({ tenantId }: { tenantId: string }) {
  const [info, setInfo] = useState<{ plan: string; max: number; status: string } | null>(null);
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { tenant, studentCount } = await api<{ tenant: { subscription_plan: string; max_students: number; status: string }; studentCount: number }>('/api/tuition/settings');
      if (tenant) setInfo({ plan: tenant.subscription_plan, max: tenant.max_students, status: tenant.status });
      setStudentCount(studentCount);
    }
    load();
  }, [tenantId]);

  if (!info) return null;

  const pct = info.max === 9999 ? 0 : Math.round((studentCount / info.max) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">Current Plan</span>
        <span className="capitalize font-semibold text-slate-800">{info.plan}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">Account Status</span>
        <span className={`capitalize text-sm font-medium ${info.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>{info.status}</span>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-slate-500">Student Usage</span>
          <span className="text-slate-700 font-medium">{studentCount} / {info.max === 9999 ? '∞' : info.max}</span>
        </div>
        {info.max !== 9999 && (
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
