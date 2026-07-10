/*
  Profiles are provisioned by the trusted backend. Users must not be able to
  create a super_admin profile or change their own role/tenant assignment.
*/

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;

