-- =========================================================
-- FIX FOR INFINITE RECURSION IN PROFILES TABLE RLS
-- Copy and paste this into Supabase -> SQL Editor -> Click RUN
-- =========================================================

-- 1. Helper function to check if current user is an admin
-- SECURITY DEFINER bypasses RLS on profiles so it never recurses!
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing recursive policies on profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Re-create clean non-recursive policies on profiles
CREATE POLICY "Users can read own profile or admin reads all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile or admin updates all"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. Re-create clean policies on transactions
DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;

CREATE POLICY "Users can read own transactions or admin reads all"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all transactions"
  ON public.transactions FOR ALL
  USING (public.is_admin());

-- 5. Re-create clean policies on system_config
DROP POLICY IF EXISTS "Public read system config" ON public.system_config;
DROP POLICY IF EXISTS "Anyone can read system config" ON public.system_config;
DROP POLICY IF EXISTS "Admin update system config" ON public.system_config;
DROP POLICY IF EXISTS "Admins can update system config" ON public.system_config;

CREATE POLICY "Public read system config"
  ON public.system_config FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admin update system config"
  ON public.system_config FOR ALL
  USING (public.is_admin());
