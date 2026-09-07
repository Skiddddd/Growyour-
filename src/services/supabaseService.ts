import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole, Transaction, TransactionStatus, TransactionType, SystemConfig } from '../types';
import { INITIAL_CONFIG } from '../constants';

function toValidUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-0000-4000-8000-${hex.padEnd(12, '0').slice(0, 12)}`;
}

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

  async getTransactions(userId?: string, isAdmin = false, userEmail?: string): Promise<Transaction[]> {
    if (!supabase) return [];

    let query = supabase.from('transactions').select('*');
    if (!isAdmin && (userId || userEmail)) {
      const conditions: string[] = [];
      if (userId) {
        conditions.push(`user_id.eq.${userId}`);
        const uuidForm = toValidUuid(userId);
        if (uuidForm !== userId) {
          conditions.push(`user_id.eq.${uuidForm}`);
        }
      }
      if (userEmail) {
        conditions.push(`user_email.eq.${userEmail.toLowerCase().trim()}`);
      }
      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }
    }
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((t: any) => ({
      id: String(t.id),
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

    // Look up or assign a valid profile id if foreign key constraint exists
    let resolvedUserId = tx.userId;
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', tx.userEmail.toLowerCase().trim())
        .maybeSingle();

      if (existingProfile?.id) {
        resolvedUserId = existingProfile.id;
      }
    } catch {
      // Continue with original id
    }

    let payload: any = {
      user_id: resolvedUserId,
      user_email: tx.userEmail,
      type: tx.type,
      amount: tx.amount,
      method: tx.planId ? `${tx.method} [Plan: ${tx.planId}]` : tx.method,
      status: 'PENDING',
    };

    let { data, error } = await supabase.from('transactions').insert([payload]).select().single();

    // If schema cache or column error, retry with minimal safe payload
    if (error && (error.message?.includes('schema cache') || error.message?.includes('column'))) {
      const safePayload = {
        user_id: payload.user_id,
        user_email: payload.user_email,
        type: payload.type,
        amount: payload.amount,
        method: payload.method,
        status: 'PENDING',
      };
      const retry = await supabase.from('transactions').insert([safePayload]).select().single();
      data = retry.data;
      error = retry.error;
    }

    // If Postgres complains about UUID format, retry with deterministic UUID
    if (error && error.message?.includes('invalid input syntax for type uuid')) {
      payload.user_id = toValidUuid(resolvedUserId);
      const retry = await supabase.from('transactions').insert([payload]).select().single();
      data = retry.data;
      error = retry.error;
    }

    // If still foreign key error, try creating profile or linking to admin profile
    if (error && error.message?.includes('violates foreign key constraint')) {
      const { data: anyProfile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
      if (anyProfile?.id) {
        payload.user_id = anyProfile.id;
        const retry = await supabase.from('transactions').insert([payload]).select().single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: String(data.id),
      userId: data.user_id,
      userEmail: data.user_email || tx.userEmail,
      type: data.type as TransactionType,
      amount: Number(data.amount),
      status: data.status as TransactionStatus,
      method: data.method,
      date: data.date || data.created_at || new Date().toISOString(),
      planId: tx.planId || null,
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
