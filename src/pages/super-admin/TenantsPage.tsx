import { useEffect, useState, useCallback } from 'react';
import { Tenant } from '../../lib/supabase';
import { api, createInstitute, CreateInstituteInput } from '../../lib/api';
import { StatusBadge, Spinner, Modal, ConfirmDialog, EmptyState } from '../../components/ui';
import { Building2, Search, Plus, Edit2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const PLAN_LIMITS: Record<string, number> = { starter: 50, professional: 200, enterprise: 9999 };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ tenant: Tenant; action: 'activate' | 'suspend' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { tenants } = await api<{ tenants: Tenant[] }>('/api/institutes');
    setTenants(tenants);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(form: Partial<Tenant>) {
    if (!editTenant) return;
    setSaving(true);
    setError('');
    const max = PLAN_LIMITS[form.subscription_plan ?? editTenant.subscription_plan] ?? 50;
    try {
      await api(`/api/institutes/${editTenant.id}`, { method: 'PATCH', body: JSON.stringify({
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      subscription_plan: form.subscription_plan,
      max_students: max,
      }) });
      setEditTenant(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update institute');
    }
    setSaving(false);
  }

  async function handleCreate(form: CreateInstituteInput) {
    setSaving(true);
    setError('');
    try {
      await createInstitute(form);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create institute');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange() {
    if (!confirmAction) return;
    const newStatus = confirmAction.action === 'activate' ? 'active' : 'suspended';
    await api(`/api/institutes/${confirmAction.tenant.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    setConfirmAction(null);
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tuition Centers</h2>
          <p className="text-slate-500 text-sm mt-0.5">{tenants.length} registered institutes</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search institutes..."
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <button
            onClick={() => { setError(''); setShowCreate(true); }}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Institute
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="w-7 h-7" />} title="No institutes found" description="Institutes will appear here once they register." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Institute</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Contact</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Plan</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Joined</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{t.name}</p>
                          <p className="text-slate-400 text-xs">Limit: {t.max_students === 9999 ? 'Unlimited' : t.max_students} students</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{t.email}</td>
                    <td className="px-5 py-4">
                      <span className="capitalize text-slate-700 font-medium">{t.subscription_plan}</span>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-4 text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditTenant(t)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {t.status !== 'active' ? (
                          <button
                            onClick={() => setConfirmAction({ tenant: t, action: 'activate' })}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Activate"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmAction({ tenant: t, action: 'suspend' })}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Suspend"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editTenant && (
        <EditTenantModal
          tenant={editTenant}
          onClose={() => setEditTenant(null)}
          onSave={handleSave}
          saving={saving}
          error={error}
        />
      )}

      {showCreate && (
        <CreateInstituteModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          saving={saving}
          error={error}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.action === 'activate' ? 'Activate Institute' : 'Suspend Institute'}
          message={`Are you sure you want to ${confirmAction.action} "${confirmAction.tenant.name}"?`}
          onConfirm={handleStatusChange}
          onCancel={() => setConfirmAction(null)}
          confirmLabel={confirmAction.action === 'activate' ? 'Activate' : 'Suspend'}
          variant={confirmAction.action === 'suspend' ? 'danger' : 'default'}
        />
      )}
    </div>
  );
}

interface CreateInstituteModalProps {
  onClose: () => void;
  onSave: (form: CreateInstituteInput) => void;
  saving: boolean;
  error: string;
}

function CreateInstituteModal({ onClose, onSave, saving, error }: CreateInstituteModalProps) {
  const [form, setForm] = useState<CreateInstituteInput>({
    name: '',
    email: '',
    phone: '',
    address: '',
    subscriptionPlan: 'starter',
    adminName: '',
    adminPassword: '',
  });

  function set(field: keyof CreateInstituteInput, value: string) {
    setForm(current => ({ ...current, [field]: value }));
  }

  return (
    <Modal title="Add Tuition Institute" onClose={onClose}>
      {error && <ErrorMessage message={error} />}
      <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
        <FormField label="Institute Name" value={form.name} onChange={value => set('name', value)} required />
        <FormField label="Admin Full Name" value={form.adminName} onChange={value => set('adminName', value)} required />
        <FormField label="Admin Email" type="email" value={form.email} onChange={value => set('email', value)} required />
        <FormField label="Temporary Password" type="password" value={form.adminPassword} onChange={value => set('adminPassword', value)} required minLength={8} />
        <FormField label="Phone" value={form.phone} onChange={value => set('phone', value)} />
        <FormField label="Address" value={form.address} onChange={value => set('address', value)} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Subscription Plan</label>
          <select value={form.subscriptionPlan} onChange={e => set('subscriptionPlan', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="starter">Starter - 50 students</option>
            <option value="professional">Professional - 200 students</option>
            <option value="enterprise">Enterprise - Unlimited</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60">
            {saving ? 'Creating...' : 'Create Institute'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
}

function FormField({ label, value, onChange, type = 'text', required, minLength }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} minLength={minLength} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}

interface EditTenantModalProps {
  tenant: Tenant;
  onClose: () => void;
  onSave: (form: Partial<Tenant>) => void;
  saving: boolean;
  error: string;
}

function EditTenantModal({ tenant, onClose, onSave, saving, error }: EditTenantModalProps) {
  const [form, setForm] = useState({
    name: tenant.name,
    email: tenant.email,
    phone: tenant.phone ?? '',
    address: tenant.address ?? '',
    subscription_plan: tenant.subscription_plan,
  });

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  return (
    <Modal title="Edit Institute" onClose={onClose}>
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Institute Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
          <input value={form.email} onChange={e => set('email', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Subscription Plan</label>
          <select value={form.subscription_plan} onChange={e => set('subscription_plan', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="starter">Starter – $29/mo (50 students)</option>
            <option value="professional">Professional – $79/mo (200 students)</option>
            <option value="enterprise">Enterprise – $199/mo (Unlimited)</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
