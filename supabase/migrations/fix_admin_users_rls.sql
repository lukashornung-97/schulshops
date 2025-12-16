-- Fix RLS policy to allow users to read their own admin_users record by email
-- This ensures that pre-added admins (with only email, no user_id) can be found
-- IMPORTANT: Uses security definer function to access auth.users safely

-- Create a security definer function to get user email (bypasses RLS)
-- This function runs with the privileges of the function creator, allowing access to auth.users
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop the existing policies
DROP POLICY IF EXISTS "Admins can read admin_users" ON admin_users;
DROP POLICY IF EXISTS "Users can read their own admin record" ON admin_users;

-- Create a policy that allows users to read their own record only
-- Uses the security definer function to safely access auth.users
CREATE POLICY "Users can read their own admin record" ON admin_users
  FOR SELECT USING (
    -- Allow if user_id matches
    user_id = auth.uid()
    -- OR allow if email matches (for pre-added admins)
    -- Uses security definer function to safely get email from auth.users
    OR (get_user_email() IS NOT NULL AND LOWER(email) = LOWER(get_user_email()))
  );

-- Also ensure email comparison is case-insensitive in the update policy
DROP POLICY IF EXISTS "Users can link their user_id" ON admin_users;

CREATE POLICY "Users can link their user_id" ON admin_users
  FOR UPDATE USING (
    get_user_email() IS NOT NULL AND LOWER(email) = LOWER(get_user_email())
  )
  WITH CHECK (
    get_user_email() IS NOT NULL AND LOWER(email) = LOWER(get_user_email())
  );

