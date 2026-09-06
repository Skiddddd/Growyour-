-- =========================================================
-- GROWYOUR$ PLATFORM — SUPABASE DATABASE SCHEMA
-- Copy and paste this into Supabase -> SQL Editor -> Click RUN
-- =========================================================

-- 1. Create Profiles table (linked with Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  balance NUMERIC(14, 2) DEFAULT 0.00,
  role TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  is_active BOOLEAN DEFAULT TRUE,
  external_wallets JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'INVESTMENT')),
  amount NUMERIC(14, 2) NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
  method TEXT NOT NULL,
  plan_id TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create System Configuration table
CREATE TABLE IF NOT EXISTS public.system_config (
  id INT PRIMARY KEY DEFAULT 1,
  btc_address TEXT DEFAULT 'bc1q9x37p0089vd7hskf08j2k32ndk9a2j3q98dks7',
  eth_address TEXT DEFAULT '0x71C...84B3f3B7A69A5D',
  usdt_address TEXT DEFAULT 'TN3X9...B8kLk5Vp9P2Q',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system config if not exists
INSERT INTO public.system_config (id, btc_address, eth_address, usdt_address)
VALUES (1, 'bc1q9x37p0089vd7hskf08j2k32ndk9a2j3q98dks7', '0x71C...84B3f3B7A69A5D', 'TN3X9...B8kLk5Vp9P2Q')
ON CONFLICT (id) DO NOTHING;

-- 4. Automatically create profile record when a new user signs up in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER'),
    0.00
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function on new auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Transactions policies
CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all transactions"
  ON public.transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- System config policies (anyone can read wallet deposit addresses)
CREATE POLICY "Public read system config"
  ON public.system_config FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admin update system config"
  ON public.system_config FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
