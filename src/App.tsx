import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  TransactionStatus,
  TransactionType,
  UserRole,
  SystemConfig,
  User,
  Transaction
} from './types';
import { storageService } from './services/storageService';
import { apiService } from './services/apiService';
import { supabaseService } from './services/supabaseService';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './lib/supabase';
import { REMEMBERED_EMAIL_KEY } from './constants';
import Layout from './components/Layout';
import DashboardView from './components/DashboardView';
import InvestView from './components/InvestView';
import AdminView from './components/AdminView';
import LandingFaq from './components/LandingFaq';
import GrowyourLogo from './components/GrowyourLogo';
import SuccessCheckmark from './components/SuccessCheckmark';

export default function App() {
  const [state, setState] = useState<AppState>(storageService.getState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Modals
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawError, setWithdrawError] = useState('');

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(1000);
  const [depositMethod, setDepositMethod] = useState<'BTC' | 'ETH' | 'USDT'>('USDT');
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Set when a transaction could not be written to the shared Supabase
  // database and fell back to on-device storage only. When this happens the
  // transaction is invisible to the admin, so we surface it instead of
  // failing silently.
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const authCardRef = useRef<HTMLDivElement | null>(null);

  const scrollToAuthCard = useCallback(() => {
    requestAnimationFrame(() => {
      authCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Sync state from Supabase, server API, or fallback to local storage
  const refreshState = useCallback(async () => {
    try {
      // 1. Prioritize Supabase if configured
      if (supabaseService.isAvailable()) {
        const supaUser = await supabaseService.getCurrentUser().catch(() => null);
        const localState = storageService.getState();
        const currentUser = supaUser || localState.currentUser;

        if (currentUser) {
          const isAdmin =
            currentUser.role === UserRole.ADMIN ||
            (currentUser.role as any) === 'ADMIN' ||
            currentUser.email?.toLowerCase() === 'admin@growyour.io';

          const [supaTxs, supaConfig, supaUsers] = await Promise.all([
            supabaseService.getTransactions(currentUser.id, isAdmin, currentUser.email).catch(() => []),
            supabaseService.getSystemConfig().catch(() => null),
            isAdmin ? supabaseService.getUsers().catch(() => []) : Promise.resolve([])
          ]);

          // Merge Supabase transactions with local ones seamlessly
          const localTxs = localState.transactions || [];
          const mergedTxsMap = new Map<string, Transaction>();

          localTxs.forEach((t) => {
            if (isAdmin || t.userId === currentUser.id || (t.userEmail && t.userEmail.toLowerCase() === currentUser.email?.toLowerCase())) {
              mergedTxsMap.set(t.id, t);
            }
          });

          supaTxs.forEach((t) => {
            mergedTxsMap.set(t.id, t);
          });

          const sortedMerged = Array.from(mergedTxsMap.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          // Deduplicate rapid identical submissions (within a 10-minute window)
          const seenKeySet = new Set<string>();
          const deduplicatedTxs: Transaction[] = [];

          sortedMerged.forEach((tx) => {
            const timeWindow = Math.floor(new Date(tx.date).getTime() / 600000);
            const key = `${(tx.userEmail || '').toLowerCase()}_${tx.amount}_${tx.type}_${tx.method || ''}_${timeWindow}`;
            if (!seenKeySet.has(key)) {
              seenKeySet.add(key);
              deduplicatedTxs.push(tx);
            }
          });

          setState((prev) => ({
            ...prev,
            currentUser: {
              ...currentUser,
              role: isAdmin ? UserRole.ADMIN : UserRole.USER
            },
            users: isAdmin && supaUsers.length > 0 ? supaUsers : prev.users,
            transactions: deduplicatedTxs,
            systemConfig: supaConfig || prev.systemConfig
          }));
          return;
        }
      }

      // 2. Server API fallback
      const token = apiService.getToken();
      if (token) {
        const [me, txs, plans, config] = await Promise.all([
          apiService.getMe().catch(() => null),
          apiService.getTransactions().catch(() => []),
          apiService.getPlans().catch(() => null),
          apiService.getSystemConfig().catch(() => null)
        ]);

        if (me) {
          let adminUsers: User[] = [];
          let adminTxs: Transaction[] = [];
          if (me.role === UserRole.ADMIN || me.role === 'ADMIN') {
            [adminUsers, adminTxs] = await Promise.all([
              apiService.adminGetUsers().catch(() => []),
              apiService.adminGetTransactions().catch(() => [])
            ]);
          }

          setState((prev) => ({
            ...prev,
            currentUser: me,
            users: (me.role === UserRole.ADMIN || me.role === 'ADMIN') && adminUsers.length > 0 ? adminUsers : prev.users,
            transactions: (me.role === UserRole.ADMIN || me.role === 'ADMIN') && adminTxs.length > 0 ? adminTxs : txs,
            plans: plans && plans.length > 0 ? plans : prev.plans,
            systemConfig: config || prev.systemConfig
          }));
          return;
        }
      }
    } catch {
      // Fall through to storage service
    }
    setState(storageService.getState());
  }, []);

  // Load remembered email and initial state, with periodic auto-sync
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
    }
    refreshState();

    // Auto-poll every 8 seconds so deposits appear on the admin console in real time
    const interval = setInterval(() => {
      refreshState();
    }, 8000);

    return () => clearInterval(interval);
  }, [refreshState]);

  // Handle Authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      if (isRegistering) {
        if (supabaseService.isAvailable()) {
          try {
            const user = await supabaseService.signUp(name, email, password);
            if (user) {
              localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
              await refreshState();
              setLoading(false);
              return;
            }
          } catch (supaErr: any) {
            console.error('Supabase sign-up failed:', supaErr);
            if (supaErr.message?.includes('already registered')) {
              setAuthError('An account with this email already exists. Try signing in.');
              setLoading(false);
              return;
            }
            // Any other Supabase error means the account was NOT created on the
            // server. Show the real reason instead of silently creating a
            // local-only account that would never sync or appear for admin.
            setAuthError(
              `Registration failed: ${supaErr.message || 'Unknown error'}. Your account was NOT created â€” please try again or contact support with this message.`
            );
            setLoading(false);
            return;
          }
        }
        try {
          const res = await apiService.register(name, email, password);
          if (res.user) {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
            await refreshState();
            setLoading(false);
            return;
          }
        } catch {
          // Fallback to local
          storageService.register(name, email, password);
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
          refreshState();
        }
      } else {
        if (supabaseService.isAvailable()) {
          try {
            const user = await supabaseService.signIn(email, password);
            if (user) {
              localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
              await refreshState();
              setLoading(false);
              return;
            }
          } catch (supaErr: any) {
            console.warn('Supabase sign-in note:', supaErr);
            if (supaErr.message?.includes('Email not confirmed')) {
              setAuthError('Email not confirmed. Please check your inbox or disable "Confirm email" in Supabase Auth settings.');
              setLoading(false);
              return;
            }
            if (supaErr.message?.includes('Invalid login credentials')) {
              if (storageService.verifyPassword(email, password)) {
                const localUser = storageService.login(email);
                if (localUser) {
                  localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
                  refreshState();
                  setLoading(false);
                  return;
                }
              }
              setAuthError('Invalid login credentials. If you forgot your password, click "Forgot password?" below to reset it locally.');
              setLoading(false);
              return;
            }
            setAuthError(supaErr.message || 'Authentication failed. Please try again.');
            setLoading(false);
            return;
          }
        }
        try {
          const res = await apiService.login(email, password);
          if (res.user) {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
            await refreshState();
            setLoading(false);
            return;
          }
        } catch (err: any) {
          // Fallback to local login if offline
          if (storageService.verifyPassword(email, password)) {
            const localUser = storageService.login(email);
            if (localUser) {
              localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
              refreshState();
              setLoading(false);
              return;
            }
          }
          setAuthError(err.message || 'Unable to sign in. Please verify credentials or click "Forgot password?" to reset.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLocalResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setResetError('Please enter your account email address.');
      return;
    }
    if (!resetPassword || resetPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setResetError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      let syncedToServer = false;

      if (supabaseService.isAvailable()) {
        try {
          const res = await fetch(
            `${DEFAULT_SUPABASE_URL}/functions/v1/quick-task`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
                apikey: DEFAULT_SUPABASE_ANON_KEY
              },
              body: JSON.stringify({ email: cleanEmail, newPassword: resetPassword })
            }
          );
          const data = await res.json();
          if (res.ok && !data.error) {
            syncedToServer = true;
          } else {
            console.error('Server-side password reset failed:', data.error);
          }
        } catch (fnErr) {
          console.error('Could not reach reset-password function:', fnErr);
        }
      }

      // Keep local copies in sync too, so the same-device fallback
      // login path (used if the network/function is unavailable)
      // still works.
      storageService.resetPassword(cleanEmail, resetPassword);
      try {
        await apiService.resetPassword(cleanEmail, resetPassword);
      } catch {
        // Offline / client-only mode handles it smoothly
      }

      localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
      setPassword(resetPassword);
      setResetSuccess(
        syncedToServer
          ? 'Your password has been updated! You can now sign in from any device.'
          : 'Your password was updated on this device, but could not be synced to the server. You may need to reset again once your connection is restored.'
      );
      setResetPassword('');
      setResetConfirmPassword('');

      setTimeout(() => {
        setIsResettingPassword(false);
        setAuthError('');
      }, 1500);
    } catch (err: any) {
      setResetError(err?.message || 'Unable to reset password locally.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, role: 'ADMIN' | 'USER') => {
    setEmail(demoEmail);
    setPassword('Admin@123');
    setLoading(true);
    try {
      if (supabaseService.isAvailable()) {
        try {
          await supabaseService.signIn(demoEmail, 'Admin@123');
          await refreshState();
          return;
        } catch {
          // fallback
        }
      }
      await apiService.login(demoEmail, 'Admin@123').catch(() => {
        storageService.login(demoEmail);
      });
      await refreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabaseService.isAvailable()) {
      await supabaseService.signOut().catch(() => {});
    }
    apiService.clearToken();
    storageService.logout();
    setState((prev) => ({ ...prev, currentUser: null }));
    setActiveTab('dashboard');
  };

  // Deposit Submit
  const handleCloseDepositSuccess = () => {
    setDepositSuccess(false);
    setShowDepositModal(false);
    refreshState();
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.currentUser || depositAmount <= 0 || depositSubmitting) return;

    setDepositSubmitting(true);
    setSyncWarning(null);

    try {
      if (supabaseService.isAvailable()) {
        try {
          await supabaseService.createTransaction({
            userId: state.currentUser.id,
            userEmail: state.currentUser.email,
            type: TransactionType.DEPOSIT,
            amount: depositAmount,
            method: `${depositMethod} Network Transfer`
          });
          storageService.createTransaction(
            state.currentUser.id,
            TransactionType.DEPOSIT,
            depositAmount,
            `${depositMethod} Transfer`
          );
        } catch (err) {
          console.error('Supabase deposit insert failed, saving locally only:', err);
          storageService.createTransaction(
            state.currentUser.id,
            TransactionType.DEPOSIT,
            depositAmount,
            `${depositMethod} Transfer`
          );
          setSyncWarning(
            `This deposit was only saved on this device and was NOT sent to the server database, so it will not appear in the admin panel. Error: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      } else {
        try {
          await apiService.createTransaction({
            type: TransactionType.DEPOSIT,
            amount: depositAmount,
            method: `${depositMethod} Network Transfer`
          });
        } catch (err) {
          console.error('API deposit insert failed, saving locally only:', err);
          storageService.createTransaction(
            state.currentUser.id,
            TransactionType.DEPOSIT,
            depositAmount,
            `${depositMethod} Transfer`
          );
          setSyncWarning(
            `This deposit was only saved on this device and was NOT sent to the server database, so it will not appear in the admin panel. Error: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      setDepositSuccess(true);
      setTimeout(() => {
        setDepositSuccess((prev) => {
          if (prev) {
            setShowDepositModal(false);
            refreshState();
            return false;
          }
          return false;
        });
      }, 3800);
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Withdraw Submit
  const handleWithdraw = async () => {
    if (!state.currentUser) return;
    if (withdrawAmount <= 0) {
      setWithdrawError('Please enter a valid amount.');
      return;
    }
    if (withdrawAmount > state.currentUser.balance) {
      setWithdrawError('Insufficient balance.');
      return;
    }
    if (!withdrawAddress.trim()) {
      setWithdrawError('Please enter a destination address.');
      return;
    }

    setSyncWarning(null);

    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.createTransaction({
          userId: state.currentUser.id,
          userEmail: state.currentUser.email,
          type: TransactionType.WITHDRAWAL,
          amount: withdrawAmount,
          method: `External: ${withdrawAddress.slice(0, 10)}...`
        });
      } catch (err) {
        console.error('Supabase withdrawal insert failed, saving locally only:', err);
        storageService.createTransaction(
          state.currentUser.id,
          TransactionType.WITHDRAWAL,
          withdrawAmount,
          `External: ${withdrawAddress.slice(0, 10)}...`
        );
        setSyncWarning(
          `This withdrawal request was only saved on this device and was NOT sent to the server database, so it will not appear in the admin panel. Error: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    } else {
      try {
        await apiService.createTransaction({
          type: TransactionType.WITHDRAWAL,
          amount: withdrawAmount,
          method: `External: ${withdrawAddress.slice(0, 10)}...`
        });
      } catch (err) {
        console.error('API withdrawal insert failed, saving locally only:', err);
        storageService.createTransaction(
          state.currentUser.id,
          TransactionType.WITHDRAWAL,
          withdrawAmount,
          `External: ${withdrawAddress.slice(0, 10)}...`
        );
        setSyncWarning(
          `This withdrawal request was only saved on this device and was NOT sent to the server database, so it will not appear in the admin panel. Error: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    setShowWithdrawModal(false);
    setWithdrawAmount(0);
    setWithdrawAddress('');
    setWithdrawError('');
    refreshState();
  };

  // Investment Submit
  const handleInvest = async (planId: string, amount: number) => {
    if (!state.currentUser) return;

    setSyncWarning(null);

    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.createTransaction({
          userId: state.currentUser.id,
          userEmail: state.currentUser.email,
          type: TransactionType.INVESTMENT,
          amount,
          method: 'Compounding Investment Vault',
          planId
        });
      } catch (err) {
        console.error('Supabase investment insert failed, saving locally only:', err);
        storageService.createTransaction(
          state.currentUser.id,
          TransactionType.INVESTMENT,
          amount,
          'Compounding Investment Vault',
          planId
        );
        setSyncWarning(
          `This investment was only saved on this device and was NOT sent to the server database, so it will not appear in the admin panel. Error: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    } else {
      try {
        await apiService.createTransaction({
          type: TransactionType.INVESTMENT,
          amount,
          method: 'Compounding Investment Vault',
          planId
        });
      } catch (err) {
        console.error('API investment insert failed, saving locally only:', err);
        storageService.createTransaction(
          state.currentUser.id,
          TransactionType.INVESTMENT,
          amount,
          'Compounding Investment Vault',
          planId
        );
        setSyncWarning(
          `This investment was only saved on this device and was NOT sent to the server database, so it will not appear in the admin panel. Error: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
    refreshState();
  };

  // Admin Actions
  const handleUpdateStatus = async (txId: string, status: TransactionStatus) => {
    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.updateTransactionStatus(txId, status);
      } catch (err) {
        console.warn('Supabase tx update error:', err);
        storageService.updateTransactionStatus(txId, status);
      }
    } else {
      try {
        await apiService.adminUpdateTransaction(txId, status);
      } catch {
        storageService.updateTransactionStatus(txId, status);
      }
    }
    await refreshState();
  };

  const handleSetUserBalance = async (userId: string, nextBalance: number) => {
    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.updateUser(userId, { balance: nextBalance });
      } catch {
        storageService.setUserBalance(userId, nextBalance);
      }
    } else {
      try {
        await apiService.adminUpdateUser(userId, { balance: nextBalance, balanceAdjustment: nextBalance });
      } catch {
        storageService.setUserBalance(userId, nextBalance);
      }
    }
    await refreshState();
  };

  const handleUpdateConfig = async (config: SystemConfig) => {
    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.updateSystemConfig(config);
      } catch {
        storageService.updateSystemConfig(config);
      }
    } else {
      try {
        await apiService.adminUpdateSystemConfig(config);
      } catch {
        storageService.updateSystemConfig(config);
      }
    }
    await refreshState();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedAddress(label);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Unauthenticated Landing & Sign In Screen
  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-[#020b23] text-white relative overflow-hidden flex flex-col justify-between">
        {/* Background glow meshes */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(45,212,191,0.18),transparent_45%),radial-gradient(circle_at_85%_25%,rgba(59,130,246,0.2),transparent_45%),linear-gradient(120deg,#020617_0%,#071945_50%,#020b23_100%)]"></div>
        <div className="absolute -top-24 -left-20 w-80 h-80 bg-cyan-400/20 blur-[130px] rounded-full"></div>
        <div className="absolute bottom-0 -right-24 w-96 h-96 bg-emerald-500/15 blur-[150px] rounded-full"></div>

        {/* Sticky Header Bar for Landing Page */}
        <header className="sticky top-0 z-50 bg-[#020b23]/90 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
          <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
            <GrowyourLogo size="md" showText />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  scrollToAuthCard();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-cyan-300/30 text-cyan-200 hover:bg-cyan-400/10 transition"
              >
                Sign In
              </button>
            </div>
          </div>
        </header>

        {/* Container */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 w-full">
          {/* Hero Section */}
          <main className="mt-12 lg:mt-16 grid lg:grid-cols-12 gap-12 items-center">
            <section className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Next-Gen Algorithmic Stock & Crypto Portfolio
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white">
                Invest Smarter with <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">Growyour$</span>
              </h1>

              <p className="text-slate-300 text-base sm:text-lg max-w-xl leading-relaxed">
                Empowering modern investors with high-yield automated crypto strategies, multi-asset security, and institutional-grade portfolio execution.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    scrollToAuthCard();
                  }}
                  className="px-8 py-3.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-xl shadow-cyan-400/25 hover:brightness-110 transition"
                >
                  Start Investing Today
                </button>
              </div>

              {/* Ticker Badges */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-800/80 max-w-md">
                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">BTC Price</span>
                  <span className="text-xs font-mono font-bold text-white">$87,420</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Daily Yield</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">Up to 4.0%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Custody</span>
                  <span className="text-xs font-mono font-bold text-cyan-400">100% Insured</span>
                </div>
              </div>
            </section>

            {/* Auth Form Card */}
            <section className="lg:col-span-5">
              <div
                ref={authCardRef}
                className="rounded-3xl p-6 sm:p-8 bg-slate-950/70 border border-cyan-500/25 backdrop-blur-xl shadow-2xl shadow-cyan-950/50"
              >
                {isResettingPassword ? (
                  <div>
                    <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-900 pb-5">
                      <div>
                        <h2 className="text-2xl font-black text-white">Reset Password</h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Set a new account password. This updates your account everywhere.
                        </p>
                      </div>
                      <GrowyourLogo size="lg" />
                    </div>

                    {resetError && (
                      <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <i className="fas fa-circle-exclamation"></i>
                        <span>{resetError}</span>
                      </div>
                    )}

                    {resetSuccess && (
                      <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <i className="fas fa-circle-check"></i>
                        <span>{resetSuccess}</span>
                      </div>
                    )}

                    <form onSubmit={handleLocalResetPassword} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Account Email
                        </label>
                        <input
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="investor@gmail.com"
                          className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            required
                            type={showResetPassword ? 'text' : 'password'}
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-400 rounded-xl pl-4 pr-11 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(!showResetPassword)}
                            aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 transition p-1"
                          >
                            <i className={`fas ${showResetPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            required
                            type={showResetConfirmPassword ? 'text' : 'password'}
                            value={resetConfirmPassword}
                            onChange={(e) => setResetConfirmPassword(e.target.value)}
                            placeholder="Re-enter your new password"
                            className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-400 rounded-xl pl-4 pr-11 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                            aria-label={showResetConfirmPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 transition p-1"
                          >
                            <i className={`fas ${showResetConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-400/20 hover:brightness-110 transition flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <span className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
                        ) : (
                          <span>Reset Password</span>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsResettingPassword(false);
                          setResetError('');
                          setResetSuccess('');
                        }}
                        className="text-xs text-cyan-300 hover:text-cyan-200 transition inline-flex items-center gap-1.5"
                      >
                        <i className="fas fa-arrow-left text-[10px]"></i>
                        <span>Back to Sign In</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-900 pb-5">
                      <div>
                        <h2 className="text-2xl font-black text-white">
                          {isRegistering ? 'Create Your Account' : 'Welcome Back'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          {isRegistering
                            ? 'Sign up to start compounding your crypto portfolio.'
                            : 'Sign in to access your portfolio node and ledger.'}
                        </p>
                      </div>
                      <GrowyourLogo size="lg" />
                    </div>

                    {authError && (
                      <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <i className="fas fa-circle-exclamation"></i>
                        <span>{authError}</span>
                      </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                      {isRegistering && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Full Legal Name
                          </label>
                          <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Email Address
                        </label>
                        <input
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="investor@gmail.com"
                          className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-slate-300">
                            Account Password
                          </label>
                          {!isRegistering && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsResettingPassword(true);
                                setAuthError('');
                                setResetSuccess('');
                                setResetError('');
                              }}
                              className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            required
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-400 rounded-xl pl-4 pr-11 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 transition p-1"
                          >
                            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-400/20 hover:brightness-110 transition flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <span className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
                        ) : (
                          <span>{isRegistering ? 'Create Free Account' : 'Sign in'}</span>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                      <button
                        onClick={() => {
                          setIsRegistering(!isRegistering);
                          setAuthError('');
                        }}
                        className="text-xs text-cyan-300 hover:text-cyan-200 transition"
                      >
                        {isRegistering
                          ? 'Already have an account? Sign In'
                          : "Don't have an account yet? Create Account"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>

          {/* Three Feature Pillars */}
          <section className="mt-16 grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                <i className="fas fa-shield-halved text-base"></i>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Cold-Storage Custody</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Assets are segregated in multi-signature institutional cold reserves with audited cryptographic validation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <i className="fas fa-microchip text-base"></i>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Algorithmic Tiers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Continuous basis spread and arbitrage algorithms providing automated, predictable daily yield schedules.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4">
                <i className="fas fa-file-invoice-dollar text-base"></i>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Real-Time Ledger</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Immutable cryptographic ledger history, transparent fee structures, and immediate multi-chain balance reconciliation.
              </p>
            </div>
          </section>

          {/* Frequently Asked Questions */}
          <LandingFaq />
        </div>

        {/* Footer */}
        <footer className="relative z-10 py-6 border-t border-slate-900 text-center text-xs text-slate-500">
          Growyour$ &bull; Online Stock & Digital Asset Platform &bull; ISO-Compliant Node
        </footer>
      </div>
    );
  }

  // Authenticated Portal
  const isCurrentAdmin = state.currentUser?.role === UserRole.ADMIN;
  const pendingTxCount = state.transactions.filter((t) => t.status === TransactionStatus.PENDING).length;

  return (
    <Layout
      user={state.currentUser}
      onLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onOpenDeposit={() => { setSyncWarning(null); setShowDepositModal(true); }}
      onOpenWithdraw={() => { setSyncWarning(null); setShowWithdrawModal(true); }}
      pendingCount={pendingTxCount}
    >
      {/* 1. Dashboard View */}
      {activeTab === 'dashboard' && (
        <DashboardView
          user={state.currentUser}
          transactions={state.transactions}
          onNavigateTab={setActiveTab}
          onOpenDeposit={() => { setSyncWarning(null); setShowDepositModal(true); }}
          onOpenWithdraw={() => { setSyncWarning(null); setShowWithdrawModal(true); }}
        />
      )}

      {/* 2. Invest View */}
      {activeTab === 'invest' && (
        <InvestView
          user={state.currentUser}
          plans={state.plans}
          onInvest={handleInvest}
          onOpenDeposit={() => { setSyncWarning(null); setShowDepositModal(true); }}
        />
      )}

      {/* 3. Transactions / Ledger View */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Full Financial Ledger</h1>
              <p className="text-sm text-slate-400 mt-1">
                {isCurrentAdmin
                  ? 'Comprehensive platform ledger of all client deposits, withdrawals, and vault activities.'
                  : 'Audit trail for all your deposits, withdrawals, and strategy purchases.'}
              </p>
            </div>
            {!isCurrentAdmin ? (
              <button
                onClick={() => { setSyncWarning(null); setShowDepositModal(true); }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950"
              >
                + Deposit
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('admin-tx')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition flex items-center gap-2"
              >
                <i className="fas fa-clipboard-check"></i>
                <span>Review TX Approvals ({pendingTxCount})</span>
              </button>
            )}
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Transaction ID</th>
                    {isCurrentAdmin && <th className="py-3 px-3">User Account</th>}
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Method / Destination</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {state.transactions
                    .filter((t) => (isCurrentAdmin ? true : t.userId === state.currentUser?.id))
                    .map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/30">
                        <td className="py-3.5 px-3 font-mono text-slate-400">#{tx.id.slice(0, 10)}</td>
                        {isCurrentAdmin && (
                          <td className="py-3.5 px-3 font-medium text-white max-w-[180px] truncate">
                            {tx.userEmail || tx.userId}
                          </td>
                        )}
                        <td className="py-3.5 px-3 font-semibold text-white">{tx.type}</td>
                        <td className="py-3.5 px-3 text-slate-400">{tx.method}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-white">
                          ${tx.amount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.status === TransactionStatus.COMPLETED
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : tx.status === TransactionStatus.PENDING
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-400">{new Date(tx.date).toLocaleString()}</td>
                      </tr>
                    ))}
                  {state.transactions.filter((t) => (isCurrentAdmin ? true : t.userId === state.currentUser?.id)).length === 0 && (
                    <tr>
                      <td colSpan={isCurrentAdmin ? 7 : 6} className="py-10 text-center text-slate-500">
                        No transactions found in the ledger.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Card-List View */}
            <div className="block md:hidden space-y-3">
              {state.transactions
                .filter((t) => (isCurrentAdmin ? true : t.userId === state.currentUser?.id))
                .map((tx) => (
                  <div key={tx.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === TransactionType.DEPOSIT
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : tx.type === TransactionType.WITHDRAWAL
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {tx.type}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">#{tx.id.slice(0, 8)}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === TransactionStatus.COMPLETED
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : tx.status === TransactionStatus.PENDING
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>

                    {isCurrentAdmin && tx.userEmail && (
                      <div className="text-xs text-slate-300 font-medium truncate">
                        User: <span className="text-white font-semibold">{tx.userEmail}</span>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-xs text-slate-400 truncate max-w-[200px]">{tx.method}</span>
                      <span className="font-mono text-base font-black text-white">
                        ${tx.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-900">
                      <span>Timestamp</span>
                      <span>{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}

              {state.transactions.filter((t) => (isCurrentAdmin ? true : t.userId === state.currentUser?.id)).length === 0 && (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No transactions found in the ledger.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Wallet & Funding View */}
      {activeTab === 'wallet' && (
        <div className="space-y-8 max-w-4xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">Custody & Funding Wallet</h1>
            <p className="text-sm text-slate-400 mt-1">
              Deposit crypto capital into institutional reserve vaults or request profit settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit Box */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">Direct Crypto Inflow</h2>
                <p className="text-xs text-slate-400 mt-1">Send funds to the multi-sig destination addresses below.</p>
              </div>

              <div className="space-y-3">
                {/* BTC */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-500 flex items-center gap-1.5">
                      <i className="fab fa-bitcoin"></i> Bitcoin (BTC)
                    </span>
                    <button
                      onClick={() => copyToClipboard(state.systemConfig.btcAddress, 'btc')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      {copiedAddress === 'btc' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 break-all select-all">
                    {state.systemConfig.btcAddress}
                  </div>
                </div>

                {/* ETH */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                      <i className="fab fa-ethereum"></i> Ethereum (ETH)
                    </span>
                    <button
                      onClick={() => copyToClipboard(state.systemConfig.ethAddress, 'eth')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      {copiedAddress === 'eth' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 break-all select-all">
                    {state.systemConfig.ethAddress}
                  </div>
                </div>

                {/* USDT */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <i className="fas fa-dollar-sign"></i> Tether (USDT)
                    </span>
                    <button
                      onClick={() => copyToClipboard(state.systemConfig.usdtAddress, 'usdt')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      {copiedAddress === 'usdt' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 break-all select-all">
                    {state.systemConfig.usdtAddress}
                  </div>
                </div>
              </div>

              {state.currentUser.role !== UserRole.ADMIN ? (
                <button
                  onClick={() => { setSyncWarning(null); setShowDepositModal(true); }}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20"
                >
                  Submit Deposit Confirmation
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('admin-settings')}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <i className="fas fa-sliders"></i>
                  <span>Manage Platform Custody Addresses</span>
                </button>
              )}
            </div>

            {/* Withdrawal Box or Admin Vault Panel */}
            {state.currentUser.role !== UserRole.ADMIN ? (
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Profit & Capital Withdrawal</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Transfer returns and principal back to your verified external wallet.
                  </p>

                  <div className="my-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-xs text-slate-400 block mb-1">Withdrawable Balance</span>
                    <span className="text-3xl font-black font-mono text-emerald-400">
                      ${state.currentUser.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-check text-emerald-400 text-[10px]"></i>
                      <span>Zero withdrawal fees for crypto transfers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="fas fa-check text-emerald-400 text-[10px]"></i>
                      <span>Audited within 1 to 12 hours</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setSyncWarning(null); setShowWithdrawModal(true); }}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
                >
                  Request Withdrawal
                </button>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Admin Vault Management</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300">
                      System Admin
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Institutional custody reserves and client withdrawal approvals are managed through the admin control suite.
                  </p>

                  <div className="my-6 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Live Vault Custody Balance</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ${state.currentUser.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Total User Inflows Received</span>
                      <span className="font-mono font-bold text-cyan-400">
                        ${state.transactions.filter(t => t.type === TransactionType.DEPOSIT && t.status !== TransactionStatus.REJECTED).reduce((s, t) => s + t.amount, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Pending User Withdrawals</span>
                      <span className="font-mono font-bold text-amber-400">
                        {state.transactions.filter((t) => t.status === TransactionStatus.PENDING && t.type === TransactionType.WITHDRAWAL).length} Awaiting
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Multi-Sig Cold Storage</span>
                      <span className="font-mono font-bold text-emerald-400">Active / Secured</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-shield-halved text-cyan-400 text-[10px]"></i>
                      <span>Client withdrawals must be approved via the TX Approvals queue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="fas fa-sliders text-cyan-400 text-[10px]"></i>
                      <span>Receiving addresses can be modified in System Config</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => setActiveTab('admin-tx')}
                    className="py-3 rounded-xl font-bold text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition text-center"
                  >
                    TX Approvals Queue
                  </button>
                  <button
                    onClick={() => setActiveTab('admin-settings')}
                    className="py-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition text-center"
                  >
                    System Config
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Admin Panel Tabs (Protected) */}
      {state.currentUser.role === UserRole.ADMIN && (
        <>
          {activeTab === 'admin-overview' && (
            <AdminView
              users={state.users}
              transactions={state.transactions}
              onUpdateStatus={handleUpdateStatus}
              onSetUserBalance={handleSetUserBalance}
              systemConfig={state.systemConfig}
              onUpdateConfig={handleUpdateConfig}
              view="overview"
              onNavigateTab={setActiveTab}
            />
          )}
          {activeTab === 'admin-users' && (
            <AdminView
              users={state.users}
              transactions={state.transactions}
              onUpdateStatus={handleUpdateStatus}
              onSetUserBalance={handleSetUserBalance}
              systemConfig={state.systemConfig}
              onUpdateConfig={handleUpdateConfig}
              view="users"
              onNavigateTab={setActiveTab}
            />
          )}
          {activeTab === 'admin-tx' && (
            <AdminView
              users={state.users}
              transactions={state.transactions}
              onUpdateStatus={handleUpdateStatus}
              onSetUserBalance={handleSetUserBalance}
              systemConfig={state.systemConfig}
              onUpdateConfig={handleUpdateConfig}
              view="tx"
              onNavigateTab={setActiveTab}
            />
          )}
          {activeTab === 'admin-settings' && (
            <AdminView
              users={state.users}
              transactions={state.transactions}
              onUpdateStatus={handleUpdateStatus}
              onSetUserBalance={handleSetUserBalance}
              systemConfig={state.systemConfig}
              onUpdateConfig={handleUpdateConfig}
              view="settings"
              onNavigateTab={setActiveTab}
            />
          )}
        </>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            {depositSuccess ? (
              <>
                <SuccessCheckmark
                  title="Deposit Queued Successfully"
                  subtitle="Your crypto transfer has been recorded on the ledger. Platform auditors and node validators will credit your account once network confirmations complete."
                  amount={depositAmount}
                  currency={depositMethod}
                  onDone={handleCloseDepositSuccess}
                />
                {syncWarning && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
                    <p className="font-bold mb-1 flex items-center gap-1.5">
                      <i className="fas fa-triangle-exclamation text-amber-400"></i>
                      <span>Sync issue detected</span>
                    </p>
                    <p>{syncWarning}</p>
                    <p className="mt-1 text-rose-200/80">
                      Please contact support and share this message so we can manually record your transaction.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Deposit Crypto Capital</h3>
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <form onSubmit={handleDepositSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Asset Network</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['USDT', 'BTC', 'ETH'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDepositMethod(m)}
                          className={`py-2 rounded-xl text-xs font-bold transition border ${
                            depositMethod === m
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Destination Address</label>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs break-all text-slate-300 flex items-center justify-between gap-2">
                      <span>
                        {depositMethod === 'BTC'
                          ? state.systemConfig.btcAddress
                          : depositMethod === 'ETH'
                          ? state.systemConfig.ethAddress
                          : state.systemConfig.usdtAddress}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            depositMethod === 'BTC'
                              ? state.systemConfig.btcAddress
                              : depositMethod === 'ETH'
                              ? state.systemConfig.ethAddress
                              : state.systemConfig.usdtAddress,
                            'modal'
                          )
                        }
                        className="text-cyan-400 text-xs shrink-0 font-bold"
                      >
                        {copiedAddress === 'modal' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Deposit Amount (USD Equivalent)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-slate-500 font-bold">$</span>
                      <input
                        type="number"
                        min={10}
                        value={depositAmount || ''}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white font-mono outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20"
                    >
                      I Have Sent Funds
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDepositModal(false)}
                      className="px-4 py-3 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Withdraw Capital</h3>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawError('');
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Available balance:{' '}
              <span className="text-emerald-400 font-bold font-mono">
                ${state.currentUser.balance.toLocaleString()}
              </span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Withdrawal Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min={1}
                    max={state.currentUser.balance}
                    value={withdrawAmount || ''}
                    onChange={(e) => {
                      setWithdrawAmount(Number(e.target.value));
                      setWithdrawError('');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white font-mono outline-none"
                    placeholder="500.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Destination Wallet Address</label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => {
                    setWithdrawAddress(e.target.value);
                    setWithdrawError('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none"
                  placeholder="0x... or bc1q..."
                />
              </div>

              {withdrawError && (
                <p className="text-rose-400 text-xs">{withdrawError}</p>
              )}

              {syncWarning && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <i className="fas fa-triangle-exclamation text-amber-400"></i>
                    <span>Sync issue detected</span>
                  </p>
                  <p>{syncWarning}</p>
                  <p className="mt-1 text-rose-200/80">
                    Please contact support and share this message so we can manually record your transaction.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={handleWithdraw}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-cyan-400 text-slate-950 hover:brightness-110 transition"
              >
                Confirm Withdrawal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawError('');
                }}
                className="px-4 py-3 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
