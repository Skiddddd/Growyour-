import { AppState, User, UserRole, Transaction, InvestmentPlan, TransactionType, TransactionStatus, SystemConfig } from '../types';
import { INITIAL_PLANS, STORAGE_KEY, INITIAL_CONFIG } from '../constants';

const PASSWORDS_STORAGE_KEY = 'growyour_user_passwords_v1';

function getStoredPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { 'admin@growyour.io': 'Admin@123' };
  } catch {
    return { 'admin@growyour.io': 'Admin@123' };
  }
}

function storeLocalPassword(email: string, pass: string) {
  const map = getStoredPasswords();
  map[email.toLowerCase().trim()] = pass;
  localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(map));
}

const defaultState: AppState = {
  currentUser: null,
  users: [
    {
      id: 'admin-1',
      email: 'admin@growyour.io',
      fullName: 'Growyour$ Administrator',
      balance: 0,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  transactions: [],
  plans: INITIAL_PLANS,
  systemConfig: INITIAL_CONFIG
};

function calculateVaultBalance(transactions: Transaction[]): number {
  if (!Array.isArray(transactions)) return 0;
  // All deposits that arrived in platform custody (excluding rejected)
  const totalInflows = transactions
    .filter(t => t.type === TransactionType.DEPOSIT && t.status !== TransactionStatus.REJECTED)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalOutflows = transactions
    .filter(t => t.type === TransactionType.WITHDRAWAL && t.status === TransactionStatus.COMPLETED)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return Math.max(0, totalInflows - totalOutflows);
}

function reconcileAdminState(state: AppState) {
  // Clear any legacy mock seed
  state.transactions = state.transactions.filter(t => t.id !== 'tx_seed_1');
  const accurateVault = calculateVaultBalance(state.transactions);

  state.users.forEach(u => {
    if (u.role === UserRole.ADMIN) {
      u.balance = accurateVault;
      if (u.email === 'admin@nexus.io') {
        u.email = 'admin@growyour.io';
        u.fullName = 'Growyour$ Administrator';
      }
    }
  });
  if (state.currentUser && state.currentUser.role === UserRole.ADMIN) {
    state.currentUser.balance = accurateVault;
  }
}

function readLocalStorage(): AppState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
    return defaultState;
  }
  try {
    const state: AppState = JSON.parse(saved);
    state.systemConfig = { ...INITIAL_CONFIG, ...(state.systemConfig || {}) };
    state.plans = Array.isArray(state.plans) && state.plans.length > 0 ? state.plans : INITIAL_PLANS;
    state.users = Array.isArray(state.users) ? state.users : defaultState.users;
    state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
    reconcileAdminState(state);
    return state;
  } catch {
    return defaultState;
  }
}

function saveLocalStorage(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const storageService = {
  getState: (): AppState => {
    return readLocalStorage();
  },

  register: (fullName: string, email: string, password?: string): User => {
    const state = readLocalStorage();
    const cleanEmail = email.toLowerCase().trim();
    if (password) {
      storeLocalPassword(cleanEmail, password);
    }
    const existing = state.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      state.currentUser = existing;
      saveLocalStorage(state);
      return existing;
    }

    const isAdmin = cleanEmail.includes('admin') || cleanEmail === 'admin@growyour.io';
    const newUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      fullName: fullName.trim(),
      balance: isAdmin ? calculateVaultBalance(state.transactions) : 0,
      role: isAdmin ? UserRole.ADMIN : UserRole.USER,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    state.users.push(newUser);
    state.currentUser = newUser;
    saveLocalStorage(state);
    return newUser;
  },

  login: (email: string): User | null => {
    const state = readLocalStorage();
    const normalizedEmail = email.toLowerCase().trim();
    let user = state.users.find(u => u.email.toLowerCase() === normalizedEmail);

    if (!user && (normalizedEmail === 'admin@growyour.io' || normalizedEmail === 'admin@nexus.io')) {
      user = {
        id: 'admin-1',
        email: normalizedEmail,
        fullName: 'Growyour$ Administrator',
        balance: calculateVaultBalance(state.transactions),
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      state.users.push(user);
    }

    if (user) {
      state.currentUser = user;
      saveLocalStorage(state);
      return user;
    }
    return null;
  },

  logout: () => {
    const state = readLocalStorage();
    state.currentUser = null;
    saveLocalStorage(state);
  },

  setCurrentUser: (user: User | null) => {
    const state = readLocalStorage();
    state.currentUser = user;
    saveLocalStorage(state);
  },

  createTransaction: (
    userId: string,
    type: TransactionType,
    amount: number,
    method: string,
    planId?: string
  ): Transaction => {
    const state = readLocalStorage();
    const user = state.users.find(u => u.id === userId);

    const newTx: Transaction = {
      id: 'tx_' + Math.random().toString(36).substring(2, 9),
      userId,
      userEmail: user ? user.email : '',
      type,
      amount,
      status: TransactionStatus.PENDING,
      date: new Date().toISOString(),
      method,
      planId
    };

    state.transactions.unshift(newTx);

    // If an investment or withdrawal, reserve the balance right away or upon approval
    if (user && (type === TransactionType.WITHDRAWAL || type === TransactionType.INVESTMENT)) {
      user.balance = Math.max(0, user.balance - amount);
      if (state.currentUser && state.currentUser.id === userId) {
        state.currentUser.balance = user.balance;
      }
    }

    // If user deposited funds into platform custody, credit admin vault balance
    if (type === TransactionType.DEPOSIT) {
      state.users.forEach(u => {
        if (u.role === UserRole.ADMIN) {
          u.balance = (Number(u.balance) || 0) + amount;
        }
      });
      if (state.currentUser && state.currentUser.role === UserRole.ADMIN) {
        state.currentUser.balance = (Number(state.currentUser.balance) || 0) + amount;
      }
    }

    saveLocalStorage(state);
    return newTx;
  },

  updateTransactionStatus: (txId: string, status: TransactionStatus) => {
    const state = readLocalStorage();
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;

    const previousStatus = tx.status;
    tx.status = status;

    if (status === TransactionStatus.COMPLETED && previousStatus !== TransactionStatus.COMPLETED) {
      const user = state.users.find(u => u.id === tx.userId);
      if (user && tx.type === TransactionType.DEPOSIT) {
        user.balance += tx.amount;
        if (state.currentUser && state.currentUser.id === user.id) {
          state.currentUser.balance = user.balance;
        }
      }
      if (tx.type === TransactionType.WITHDRAWAL) {
        // Confirmed withdrawal paid out from platform custody vault
        state.users.forEach(u => {
          if (u.role === UserRole.ADMIN) {
            u.balance = Math.max(0, (Number(u.balance) || 0) - tx.amount);
          }
        });
        if (state.currentUser && state.currentUser.role === UserRole.ADMIN) {
          state.currentUser.balance = Math.max(0, (Number(state.currentUser.balance) || 0) - tx.amount);
        }
      }
    } else if (status === TransactionStatus.REJECTED && previousStatus !== TransactionStatus.REJECTED) {
      if (tx.type === TransactionType.DEPOSIT) {
        // Revert custody balance if deposit rejected
        state.users.forEach(u => {
          if (u.role === UserRole.ADMIN) {
            u.balance = Math.max(0, (Number(u.balance) || 0) - tx.amount);
          }
        });
        if (state.currentUser && state.currentUser.role === UserRole.ADMIN) {
          state.currentUser.balance = Math.max(0, (Number(state.currentUser.balance) || 0) - tx.amount);
        }
      } else if (tx.type === TransactionType.WITHDRAWAL || tx.type === TransactionType.INVESTMENT) {
        // Refund reserved funds if withdrawal or investment is rejected
        const user = state.users.find(u => u.id === tx.userId);
        if (user) {
          user.balance += tx.amount;
          if (state.currentUser && state.currentUser.id === user.id) {
            state.currentUser.balance = user.balance;
          }
        }
      }
    }

    saveLocalStorage(state);
  },

  setUserBalance: (userId: string, nextBalance: number) => {
    const state = readLocalStorage();
    const user = state.users.find(u => u.id === userId);
    if (user) {
      user.balance = Math.max(0, nextBalance);
      if (state.currentUser && state.currentUser.id === userId) {
        state.currentUser.balance = user.balance;
      }
      saveLocalStorage(state);
    }
  },

  updateSystemConfig: (config: SystemConfig) => {
    const state = readLocalStorage();
    state.systemConfig = { ...state.systemConfig, ...config };
    saveLocalStorage(state);
  },

  resetPassword: (email: string, newPassword: string): boolean => {
    const cleanEmail = email.toLowerCase().trim();
    storeLocalPassword(cleanEmail, newPassword);

    const state = readLocalStorage();
    let user = state.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      const isAdmin = cleanEmail.includes('admin') || cleanEmail === 'admin@growyour.io';
      user = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email: cleanEmail,
        fullName: cleanEmail.split('@')[0],
        balance: isAdmin ? calculateVaultBalance(state.transactions) : 0,
        role: isAdmin ? UserRole.ADMIN : UserRole.USER,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      state.users.push(user);
    }

    saveLocalStorage(state);
    return true;
  },

  verifyPassword: (email: string, pass: string): boolean => {
    const cleanEmail = email.toLowerCase().trim();
    const stored = getStoredPasswords()[cleanEmail];
    if (!stored) {
      // Default initial seeds
      if (cleanEmail === 'admin@growyour.io' && (pass === 'Admin@123' || pass === 'Default@123')) return true;
      return true; // Allow initial pass if not set
    }
    return stored === pass;
  }
};
