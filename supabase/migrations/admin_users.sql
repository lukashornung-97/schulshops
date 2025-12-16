-- Admin Users Table Migration
-- This table tracks which authenticated users have admin access

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);

-- Partial unique index: only enforce uniqueness on user_id when it's not null
CREATE UNIQUE INDEX admin_users_user_id_unique ON admin_users(user_id) WHERE user_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read admin_users (by user_id or email match)
CREATE POLICY "Admins can read admin_users" ON admin_users
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_users WHERE user_id IS NOT NULL)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy: Only admins can insert new admin users
CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Policy: Only admins can delete admin users (but not themselves)
CREATE POLICY "Admins can delete other admin_users" ON admin_users
  FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
    AND user_id != auth.uid()
  );

-- Policy: Allow users to update their own admin_users record (to link user_id)
CREATE POLICY "Users can link their user_id" ON admin_users
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Create index for faster lookups
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Function to check if a user is an admin (useful for RLS policies in other tables)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

