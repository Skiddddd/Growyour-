import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole, Transaction, TransactionStatus, TransactionType, SystemConfig } from '../types';
import { INITIAL_CONFIG } from '../constants';

export const supabaseService = {
  isAvailable: () => isSupabaseConfigured && Boolean(supabase),

  async signUp(fullName: string, email: string, password?: string): Promise<User> {
    if (!supabase) throw new Error('Supabase is not configured.');

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim() || cleanEmail.split('@')[0];
    const pass = password || 'Default@123';

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: {
          full_name: cleanName,
          role: 'USER',
        },
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const authUser = authData.user;
    if (!authUser) {
      throw new Error('Account registration failed. Please try again.');
    }

    // Ensure profile row exists in public.profiles
    const defaultUser: User = {
      id: authUser.id,
      email: cleanEmail,
      fullName: cleanName,
      balance: 0,
      role: UserRole.USER,
      isActive: true,
      createdAt: authUser.created_at || new Date().toISOString(),
    };

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('profiles').insert([
          {
            id: authUser.id,
            email: cleanEmail,
            full_name: cleanName,
            role: 'USER',
            balance: 0.0,
          },
        ]);
      } else {
        defaultUser.balance = Number(profile.balance) || 0;
        defaultUser.role = profile.role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;
        defaultUser.fullName = profile.full_name || cleanName;
      }
    } catch (err) {
      console.warn('Could not sync profile immediately:', err);
    }

    return defaultUser;
  },

  async signIn(email: string, password?: string): Promise<User> {
    if (!supabase) throw new Error('Supabase is not configured.');

    const cleanEmail = email.toLowerCase().trim();
    const pass = password || 'Default@123';

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const authUser = authData.user;
    if (!authUser) {
      throw new Error('User authentication failed.');
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    const role =
      profile?.role === 'ADMIN' || authUser.user_metadata?.role === 'ADMIN'
        ? UserRole.ADMIN
        : UserRole.USER;

    const user: User = {
      id: authUser.id,
      email: authUser.email || cleanEmail,
      fullName: profile?.full_name || authUser.user_metadata?.full_name || cleanEmail.split('@')[0],
      balance: Number(profile?.balance) || 0,
      role,
      isActive: profile?.is_active ?? true,
      createdAt: authUser.created_at || new Date().toISOString(),
    };

    return user;
  },

  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const authUser = session.user;
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    const role = profile?.role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;

    return {
      id: authUser.id,
      email: authUser.email || '',
      fullName: profile?.full_name || authUser.user_metadata?.full_name || (authUser.email ? authUser.email.split('@')[0] : 'User'),
      balance: Number(profile?.balance) || 0,
      role,
      isActive: profile?.is_active ?? true,
      createdAt: authUser.created_at || new Date().toISOString(),
    };
  },

  async getTransactions(userId?: string, isAdmin = false): Promise<Transaction[]> {
    if (!supabase) return [];

    let query = supabase.from('transactions').select('*');
    if (!isAdmin && userId) {
      query = query.eq('user_id', userId);
    }
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      userEmail: t.user_email || '',
      type: t.type as TransactionType,
      amount: Number(t.amount) || 0,
      status: t.status as TransactionStatus,
      method: t.method || 'USDT',
      date: t.date || t.created_at || new Date().toISOString(),
      planId: t.plan_id || null,
    }));
  },

  async createTransaction(tx: {
    userId: string;
    userEmail: string;
    type: TransactionType;
    amount: number;
    method: string;
    planId?: string | null;
  }): Promise<Transaction> {
    if (!supabase) throw new Error('Supabase is not configured.');

    const newTx = {
      user_id: tx.userId,
      user_email: tx.userEmail,
      type: tx.type,
      amount: tx.amount,
      method: tx.method,
      status: 'PENDING',
      plan_id: tx.planId || null,
    };

    const { data, error } = await supabase.from('transactions').insert([newTx]).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      userId: data.user_id,
      userEmail: data.user_email,
      type: data.type as TransactionType,
      amount: Number(data.amount),
      status: data.status as TransactionStatus,
      method: data.method,
      date: data.date || new Date().toISOString(),
      planId: data.plan_id,
    };
  },

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<void> {
    if (!supabase) return;

    // Fetch transaction first to update balance if approved
    const { data: tx } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle();
    await supabase.from('transactions').update({ status }).eq('id', id);

    if (tx && status === TransactionStatus.COMPLETED) {
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', tx.user_id).maybeSingle();
      const currentBalance = Number(profile?.balance) || 0;
      let newBalance = currentBalance;

      if (tx.type === TransactionType.DEPOSIT) {
        newBalance += Number(tx.amount);
      } else if (tx.type === TransactionType.WITHDRAWAL) {
        newBalance = Math.max(0, currentBalance - Number(tx.amount));
      }

      await supabase.from('profiles').update({ balance: newBalance }).eq('id', tx.user_id);
    }
  },

  async getSystemConfig(): Promise<SystemConfig> {
    if (!supabase) return INITIAL_CONFIG;

    try {
      const { data } = await supabase.from('system_config').select('*').eq('id', 1).maybeSingle();
      if (data) {
        return {
          btcAddress: data.btc_address || INITIAL_CONFIG.btcAddress,
          ethAddress: data.eth_address || INITIAL_CONFIG.ethAddress,
          usdtAddress: data.usdt_address || INITIAL_CONFIG.usdtAddress,
        };
      }
    } catch {
      // return default
    }
    return INITIAL_CONFIG;
  },

  async updateSystemConfig(config: SystemConfig): Promise<void> {
    if (!supabase) return;

    await supabase.from('system_config').upsert({
      id: 1,
      btc_address: config.btcAddress,
      eth_address: config.ethAddress,
      usdt_address: config.usdtAddress,
    });
  },

  async getUsers(): Promise<User[]> {
    if (!supabase) return [];

    const { data, error } = await supabase.from('profiles').select('*');
    if (error || !data) return [];

    return data.map((p: any) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name || p.email.split('@')[0],
      balance: Number(p.balance) || 0,
      role: p.role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER,
      isActive: p.is_active ?? true,
      createdAt: p.created_at || new Date().toISOString(),
    }));
  },

  async updateUser(userId: string, data: { role?: string; isActive?: boolean; balance?: number }): Promise<void> {
    if (!supabase) return;

    const payload: any = {};
    if (data.role) payload.role = data.role;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.balance !== undefined) payload.balance = data.balance;

    await supabase.from('profiles').update(payload).eq('id', userId);
  },
};
