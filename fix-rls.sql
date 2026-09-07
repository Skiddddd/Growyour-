-- ====================================================================
-- GROWYOUR$ PLATFORM: SUPABASE FULL SYNC & RLS FIX
-- Run this in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/bttvoorzlzmxzppcigid/sql/new
-- 2. Paste this entire script
-- 3. Click "Run" (or Ctrl+Enter / Cmd+Enter)
-- ====================================================================

-- 1. Remove strict foreign key constraint so deposits from any user session succeed
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

-- 2. Ensure user_id in transactions can hold text identifiers as well as UUIDs
DO $$
BEGIN
  ALTER TABLE public.transactions ALTER COLUMN user_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Ensure profiles id can store string IDs if needed
DO $$
BEGIN
  ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 5. Drop any existing conflicting policies on transactions
DROP POLICY IF EXISTS "Users can read own transactions or admin reads all" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all transactions select" ON public.transactions;
DROP POLICY IF EXISTS "Allow all transactions insert" ON public.transactions;
DROP POLICY IF EXISTS "Allow all transactions update" ON public.transactions;

-- 6. Create universal sync policies for transactions (allows instant deposits & admin approvals)
CREATE POLICY "Allow all transactions select"
  ON public.transactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all transactions insert"
  ON public.transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all transactions update"
  ON public.transactions FOR UPDATE
  TO anon, authenticated
  USING (true);

-- 7. Universal sync policies for profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile or admin reads all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admin updates all" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow all profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Allow all profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "Allow all profiles update" ON public.profiles;

CREATE POLICY "Allow all profiles select"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all profiles insert"
  ON public.profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all profiles update"
  ON public.profiles FOR UPDATE
  TO anon, authenticated
  USING (true);

-- 8. Universal sync policies for system configuration (crypto addresses)
DROP POLICY IF EXISTS "Public read system config" ON public.system_config;
DROP POLICY IF EXISTS "Anyone can read system config" ON public.system_config;
DROP POLICY IF EXISTS "Admin update system config" ON public.system_config;
DROP POLICY IF EXISTS "Admins can update system config" ON public.system_config;
DROP POLICY IF EXISTS "Allow all config select" ON public.system_config;
DROP POLICY IF EXISTS "Allow all config update" ON public.system_config;

CREATE POLICY "Allow all config select"
  ON public.system_config FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all config update"
  ON public.system_config FOR ALL
  TO anon, authenticated
  USING (true);

-- 9. Insert default system config if table is empty
INSERT INTO public.system_config (id, btc_address, eth_address, usdt_address)
VALUES (1, 'bc1q9d8p0243m9yqj5d28tvy4l3e83n6g46qkuwrsm', '0x71C...4e89', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
ON CONFLICT (id) DO NOTHING;
