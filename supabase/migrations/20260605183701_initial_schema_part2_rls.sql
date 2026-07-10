
/*
# EduFee QR – RLS Policies (Part 2)

Adds all cross-table RLS policies now that profiles and all other tables exist.
Uses helper profiles table to determine tenant membership and super_admin role.
*/

-- ================================================
-- TENANTS POLICIES
-- ================================================
DROP POLICY IF EXISTS "super_admin_select_tenants" ON tenants;
CREATE POLICY "super_admin_select_tenants" ON tenants FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

DROP POLICY IF EXISTS "super_admin_insert_tenants" ON tenants;
CREATE POLICY "super_admin_insert_tenants" ON tenants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

DROP POLICY IF EXISTS "super_admin_update_tenants" ON tenants;
CREATE POLICY "super_admin_update_tenants" ON tenants FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

DROP POLICY IF EXISTS "tuition_admin_select_own_tenant" ON tenants;
CREATE POLICY "tuition_admin_select_own_tenant" ON tenants FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = tenants.id)
);

-- ================================================
-- PROFILES EXTRA POLICIES (super admin can read all)
-- ================================================
DROP POLICY IF EXISTS "super_admin_select_all_profiles" ON profiles;
CREATE POLICY "super_admin_select_all_profiles" ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin')
);

DROP POLICY IF EXISTS "super_admin_update_any_profile" ON profiles;
CREATE POLICY "super_admin_update_any_profile" ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin')
);

-- ================================================
-- STUDENTS POLICIES
-- ================================================
DROP POLICY IF EXISTS "tenant_users_select_students" ON students;
CREATE POLICY "tenant_users_select_students" ON students FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND (profiles.tenant_id = students.tenant_id OR profiles.role = 'super_admin'))
);

DROP POLICY IF EXISTS "tenant_users_insert_students" ON students;
CREATE POLICY "tenant_users_insert_students" ON students FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = students.tenant_id)
);

DROP POLICY IF EXISTS "tenant_users_update_students" ON students;
CREATE POLICY "tenant_users_update_students" ON students FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = students.tenant_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = students.tenant_id)
);

DROP POLICY IF EXISTS "tenant_users_delete_students" ON students;
CREATE POLICY "tenant_users_delete_students" ON students FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = students.tenant_id)
);

-- ================================================
-- FEE RECORDS POLICIES
-- ================================================
DROP POLICY IF EXISTS "tenant_users_select_fees" ON fee_records;
CREATE POLICY "tenant_users_select_fees" ON fee_records FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND (profiles.tenant_id = fee_records.tenant_id OR profiles.role = 'super_admin'))
);

DROP POLICY IF EXISTS "tenant_users_insert_fees" ON fee_records;
CREATE POLICY "tenant_users_insert_fees" ON fee_records FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = fee_records.tenant_id)
);

DROP POLICY IF EXISTS "tenant_users_update_fees" ON fee_records;
CREATE POLICY "tenant_users_update_fees" ON fee_records FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = fee_records.tenant_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = fee_records.tenant_id)
);

-- ================================================
-- PAYMENTS POLICIES
-- ================================================
DROP POLICY IF EXISTS "tenant_users_select_payments" ON payments;
CREATE POLICY "tenant_users_select_payments" ON payments FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND (profiles.tenant_id = payments.tenant_id OR profiles.role = 'super_admin'))
);

DROP POLICY IF EXISTS "tenant_users_insert_payments" ON payments;
CREATE POLICY "tenant_users_insert_payments" ON payments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = payments.tenant_id)
);

-- ================================================
-- RECEIPTS POLICIES
-- ================================================
DROP POLICY IF EXISTS "tenant_users_select_receipts" ON receipts;
CREATE POLICY "tenant_users_select_receipts" ON receipts FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND (profiles.tenant_id = receipts.tenant_id OR profiles.role = 'super_admin'))
);

DROP POLICY IF EXISTS "tenant_users_insert_receipts" ON receipts;
CREATE POLICY "tenant_users_insert_receipts" ON receipts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = receipts.tenant_id)
);
