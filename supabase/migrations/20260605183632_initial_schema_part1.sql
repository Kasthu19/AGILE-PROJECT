
/*
# EduFee QR – Core Tables (Part 1)

Creates all tables without cross-referential RLS policies.
RLS policies that reference the profiles table will be added in part 2
once all tables exist.

Tables created: subscription_plans, tenants, profiles, students,
fee_records, payments, receipts
*/

-- ================================================
-- SUBSCRIPTION PLANS
-- ================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  max_students integer NOT NULL,
  monthly_price numeric(10,2) NOT NULL,
  features jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_select_plans" ON subscription_plans;
CREATE POLICY "anyone_select_plans" ON subscription_plans FOR SELECT
TO anon, authenticated USING (true);

INSERT INTO subscription_plans (name, max_students, monthly_price, features) VALUES
  ('starter',      50,   29.00, '["Up to 50 students","QR code generation","Basic reports","Email support"]'),
  ('professional', 200,  79.00, '["Up to 200 students","QR code generation","Advanced reports","PDF receipts","Priority support"]'),
  ('enterprise',   9999, 199.00, '["Unlimited students","QR code generation","Full analytics","PDF receipts","API access","Dedicated support"]')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- TENANTS
-- ================================================
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active','suspended','pending')),
  subscription_plan text NOT NULL DEFAULT 'starter' REFERENCES subscription_plans(name),
  max_students integer NOT NULL DEFAULT 50,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- ================================================
-- PROFILES
-- ================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'tuition_admin' CHECK (role IN ('super_admin','tuition_admin')),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_profile" ON profiles;
CREATE POLICY "users_select_own_profile" ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ================================================
-- STUDENTS
-- ================================================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_code text NOT NULL,
  full_name text NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IN ('male','female','other')),
  parent_name text,
  parent_contact text,
  address text,
  course text,
  monthly_fee numeric(10,2) NOT NULL DEFAULT 0,
  registration_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, student_code)
);

CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(tenant_id, status);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- ================================================
-- FEE RECORDS
-- ================================================
CREATE TABLE IF NOT EXISTS fee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020),
  amount_due numeric(10,2) NOT NULL,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','unpaid','partial')),
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_fee_records_tenant ON fee_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_student ON fee_records(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_status ON fee_records(tenant_id, status);

ALTER TABLE fee_records ENABLE ROW LEVEL SECURITY;

-- ================================================
-- PAYMENTS
-- ================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_record_id uuid NOT NULL REFERENCES fee_records(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank_transfer','card','online')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(tenant_id, payment_date);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RECEIPTS
-- ================================================
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  receipt_number text NOT NULL UNIQUE,
  amount numeric(10,2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RECEIPT NUMBER GENERATOR FUNCTION
-- ================================================
CREATE OR REPLACE FUNCTION generate_receipt_number(p_tenant_id uuid)
RETURNS text AS $$
DECLARE
  v_count integer;
  v_year text;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count
  FROM receipts
  WHERE tenant_id = p_tenant_id
    AND to_char(created_at, 'YYYY') = v_year;
  RETURN 'RCP-' || v_year || '-' || lpad(v_count::text, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
