export type UserRole = 'super_admin' | 'tuition_admin';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: 'active' | 'suspended' | 'pending';
  subscription_plan: string;
  max_students: number;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  tenant_id: string;
  student_code: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  parent_name: string | null;
  parent_contact: string | null;
  address: string | null;
  course: string | null;
  monthly_fee: number;
  registration_date: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  fee_status?: 'paid' | 'unpaid' | 'partial';
  amount_due?: number;
  amount_paid?: number;
  balance?: number;
}

export interface FeeRecord {
  id: string;
  tenant_id: string;
  student_id: string;
  month: number;
  year: number;
  amount_due: number;
  amount_paid: number;
  status: 'paid' | 'unpaid' | 'partial';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  student_id: string;
  fee_record_id: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'card' | 'online';
  payment_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Receipt {
  id: string;
  tenant_id: string;
  payment_id: string;
  student_id: string;
  receipt_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  max_students: number;
  monthly_price: number;
  features: string[];
  created_at: string;
}
