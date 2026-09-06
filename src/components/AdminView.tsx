import React, { useState } from 'react';
import { User, Transaction, TransactionStatus, SystemConfig, UserRole, TransactionType } from '../types';

interface AdminViewProps {
  users: User[];
  transactions: Transaction[];
  onUpdateStatus: (txId: string, status: TransactionStatus) => void;
  onSetUserBalance: (userId: string, nextBalance: number) => void;
  systemConfig: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
  view: 'overview' | 'users' | 'tx' | 'settings';
  onNavigateTab?: (tab: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  users,
  transactions,
  onUpdateStatus,
  onSetUserBalance,
  systemConfig,
  onUpdateConfig,
  view,
  onNavigateTab
}) => {
  const pendingTxs = transactions.filter((t) => t.status === TransactionStatus.PENDING);
  const completedVolume = transactions
    .filter((t) => t.status === TransactionStatus.COMPLETED)
    .reduce((sum, t) => sum + t.amount, 0);
  const adminUser = users.find((u) => u.role === UserRole.ADMIN);
  const vaultReserve = adminUser ? adminUser.balance : 0;

  const [localConfig, setLocalConfig] = useState<SystemConfig>(systemConfig);
  const [configSaved, setConfigSaved] = useState(false);

  // Balance edit modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Transactions view state
  const [txFilterStatus, setTxFilterStatus] = useState<'ALL' | TransactionStatus>('ALL');
  const [txFilterType, setTxFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyTxId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(localConfig);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleApplyBalance = () => {
    if (editingUser) {
      onSetUserBalance(editingUser.id, Math.max(0, Number(newBalance) || 0));
      setEditingUser(null);
    }
  };

  // 1. OVERVIEW VIEW
  if (view === 'overview') {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">System Command Overview</h1>
            <p className="text-sm text-slate-400 mt-1">Platform health, capital reserves, and audit command center.</p>
          </div>
          {pendingTxs.length > 0 && onNavigateTab && (
            <button
              onClick={() => onNavigateTab('admin-tx')}
              className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-2"
            >
              <i className="fas fa-bell animate-pulse"></i>
              <span>{pendingTxs.length} Pending Approvals</span>
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Total Users</p>
            <p className="text-3xl font-black text-white">{users.length}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              <span>Platform accounts</span>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('admin-users')}
                  className="text-cyan-400 hover:underline font-semibold"
                >
                  View Directory &rarr;
                </button>
              )}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Live Vault Custody</p>
            <p className="text-3xl font-black text-emerald-400 font-mono">
              ${vaultReserve.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              <span>Platform Reserves</span>
              <span className="text-emerald-400 font-mono">100% Backed</span>
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Settled Volume</p>
            <p className="text-3xl font-black text-white font-mono">${completedVolume.toLocaleString()}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              <span>Completed transfers</span>
              <span className="text-emerald-400 font-mono">Audited</span>
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Pending Approvals</p>
            <p className="text-3xl font-black text-amber-400">{pendingTxs.length}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              <span>Awaiting review</span>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('admin-tx')}
                  className="text-amber-400 hover:underline font-semibold"
                >
                  Process Queue &rarr;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('admin-tx')}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-left transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <i className="fas fa-clipboard-check text-base"></i>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">Audit & Approve Transactions</h3>
            <p className="text-xs text-slate-400 mt-1">Review incoming deposits, client withdrawal requests, and plan allocations.</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('admin-users')}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 text-left transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <i className="fas fa-users-gear text-base"></i>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">User Account Management</h3>
            <p className="text-xs text-slate-400 mt-1">Inspect registered investor records, adjust live capital balances, and review activity.</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('admin-settings')}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 text-left transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <i className="fas fa-sliders text-base"></i>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition">System Custody Configuration</h3>
            <p className="text-xs text-slate-400 mt-1">Update platform official deposit destination addresses for BTC, ETH, and USDT.</p>
          </button>
        </div>

        {/* Pending Approvals Table */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Transactions Awaiting Confirmation</h2>
            <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
              {pendingTxs.length} Requires Action
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">User Email</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Method / Plan</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {pendingTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-semibold text-white">{tx.userEmail}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === TransactionType.DEPOSIT
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : tx.type === TransactionType.WITHDRAWAL
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{tx.method}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">${tx.amount.toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-400">{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString()}</td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => onUpdateStatus(tx.id, TransactionStatus.COMPLETED)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onUpdateStatus(tx.id, TransactionStatus.REJECTED)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white transition"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingTxs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      All transaction queues are clear. No pending items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Card-List View */}
          <div className="block md:hidden space-y-3">
            {pendingTxs.map((tx) => (
              <div key={tx.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    tx.type === TransactionType.DEPOSIT
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : tx.type === TransactionType.WITHDRAWAL
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  }`}>
                    {tx.type}
                  </span>
                  <span className="font-mono text-base font-black text-emerald-400">
                    ${tx.amount.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-white truncate">{tx.userEmail}</div>
                  <div className="text-slate-400 text-[11px] truncate">{tx.method}</div>
                  <div className="text-slate-500 text-[10px]">
                    {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
                  <button
                    onClick={() => onUpdateStatus(tx.id, TransactionStatus.COMPLETED)}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 transition text-center"
                  >
                    <i className="fas fa-check mr-1.5"></i> Approve
                  </button>
                  <button
                    onClick={() => onUpdateStatus(tx.id, TransactionStatus.REJECTED)}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/30 transition text-center"
                  >
                    <i className="fas fa-times mr-1.5"></i> Reject
                  </button>
                </div>
              </div>
            ))}

            {pendingTxs.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-xs">
                All transaction queues are clear. No pending items.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. USERS VIEW
  if (view === 'users') {
    const filteredUsers = users.filter((u) => {
      const q = userSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">User Accounts Directory</h1>
            <p className="text-sm text-slate-400 mt-1">Manage platform accounts, adjust balances, and audit privileges.</p>
          </div>
          <div className="w-full sm:w-72">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search user name or email..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Available Balance</th>
                  <th className="py-3 px-3">Registered</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-semibold text-white">{u.fullName || 'User'}</td>
                    <td className="py-3 px-3 text-slate-300 font-mono">{u.email}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === UserRole.ADMIN
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">${u.balance.toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setNewBalance(u.balance);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 transition"
                      >
                        <i className="fas fa-pen-to-square mr-1.5 text-[10px]"></i>
                        Edit Balance
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No user accounts found matching &quot;{userSearchQuery}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Card-List View */}
          <div className="block md:hidden space-y-3">
            {filteredUsers.map((u) => (
              <div key={u.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white text-sm">{u.fullName || 'Platform User'}</div>
                    <div className="text-xs text-slate-400 font-mono break-all">{u.email}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      u.role === UserRole.ADMIN
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-slate-400">Available Balance</span>
                  <span className="font-mono text-base font-black text-emerald-400">
                    ${u.balance.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-900">
                  <span>Registered</span>
                  <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>

                <button
                  onClick={() => {
                    setEditingUser(u);
                    setNewBalance(u.balance);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition text-center"
                >
                  <i className="fas fa-pen-to-square mr-1.5 text-[10px]"></i>
                  Edit Balance
                </button>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-xs">
                No user accounts found matching &quot;{userSearchQuery}&quot;.
              </div>
            )}
          </div>
        </div>

        {/* Modal for Balance Adjustment */}
        {editingUser && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white">Adjust Balance for User</h2>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <p className="text-slate-400">Target User: <span className="text-white font-semibold">{editingUser.fullName || editingUser.email}</span></p>
                <p className="text-slate-400">Current Balance: <span className="text-emerald-400 font-mono font-bold">${editingUser.balance.toLocaleString()}</span></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Balance (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newBalance}
                  onChange={(e) => setNewBalance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleApplyBalance}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-cyan-400 text-slate-950 hover:brightness-110 transition text-xs shadow-lg shadow-cyan-400/20"
                >
                  Save New Balance
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl font-semibold bg-slate-800 text-slate-400 text-xs hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. TRANSACTIONS APPROVAL & AUDIT VIEW
  if (view === 'tx') {
    const filteredTxs = transactions.filter((t) => {
      // Status filter
      if (txFilterStatus !== 'ALL' && t.status !== txFilterStatus) return false;
      // Type filter
      if (txFilterType !== 'ALL' && t.type !== txFilterType) return false;
      // Search filter
      const q = txSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        (t.userEmail && t.userEmail.toLowerCase().includes(q)) ||
        (t.method && t.method.toLowerCase().includes(q))
      );
    });

    const pendingCount = transactions.filter((t) => t.status === TransactionStatus.PENDING).length;
    const completedCount = transactions.filter((t) => t.status === TransactionStatus.COMPLETED).length;
    const rejectedCount = transactions.filter((t) => t.status === TransactionStatus.REJECTED).length;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Transaction Approvals & Ledger</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review incoming crypto deposits, authorize withdrawals, and manage platform ledger transactions.
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setTxFilterStatus('ALL')}
            className={`p-3.5 rounded-xl border text-left transition ${
              txFilterStatus === 'ALL'
                ? 'bg-slate-800 border-cyan-500/50 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider">All Entries</p>
            <p className="text-xl font-bold font-mono mt-1 text-white">{transactions.length}</p>
          </button>

          <button
            onClick={() => setTxFilterStatus(TransactionStatus.PENDING)}
            className={`p-3.5 rounded-xl border text-left transition ${
              txFilterStatus === TransactionStatus.PENDING
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider flex items-center justify-between">
              <span>Pending Action</span>
              {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>}
            </p>
            <p className="text-xl font-bold font-mono mt-1 text-amber-400">{pendingCount}</p>
          </button>

          <button
            onClick={() => setTxFilterStatus(TransactionStatus.COMPLETED)}
            className={`p-3.5 rounded-xl border text-left transition ${
              txFilterStatus === TransactionStatus.COMPLETED
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider">Completed</p>
            <p className="text-xl font-bold font-mono mt-1 text-emerald-400">{completedCount}</p>
          </button>

          <button
            onClick={() => setTxFilterStatus(TransactionStatus.REJECTED)}
            className={`p-3.5 rounded-xl border text-left transition ${
              txFilterStatus === TransactionStatus.REJECTED
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider">Rejected</p>
            <p className="text-xl font-bold font-mono mt-1 text-rose-400">{rejectedCount}</p>
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium mr-1">Filter Type:</span>
            {(['ALL', TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.INVESTMENT] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTxFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  txFilterType === t
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
              <input
                type="text"
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                placeholder="Search user, TX ID, or method..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">TX ID</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Method / Details</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      <button
                        onClick={() => copyTxId(tx.id)}
                        className="hover:text-cyan-400 transition flex items-center gap-1.5"
                        title="Click to copy full TX ID"
                      >
                        <span>{tx.id.substring(0, 10)}...</span>
                        <i className={`fas ${copiedId === tx.id ? 'fa-check text-emerald-400' : 'fa-copy text-[10px]'}`}></i>
                      </button>
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">{tx.userEmail}</td>
                    <td className="py-3 px-3">
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
                    </td>
                    <td className="py-3 px-3 text-slate-400 max-w-xs truncate">{tx.method}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">${tx.amount.toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3">
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
                    </td>
                    <td className="py-3 px-3 text-right">
                      {tx.status === TransactionStatus.PENDING ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onUpdateStatus(tx.id, TransactionStatus.COMPLETED)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onUpdateStatus(tx.id, TransactionStatus.REJECTED)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-[11px] italic">
                          <span>Resolved</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No transactions match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Card-List View */}
          <div className="block md:hidden space-y-3">
            {filteredTxs.map((tx) => (
              <div key={tx.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
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
                  <span className="font-mono text-base font-black text-emerald-400">
                    ${tx.amount.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-white truncate">{tx.userEmail}</div>
                  <div className="text-slate-400 text-[11px] truncate">{tx.method}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <button
                      onClick={() => copyTxId(tx.id)}
                      className="font-mono text-slate-400 hover:text-cyan-400 transition flex items-center gap-1 text-[10px]"
                      title="Click to copy full TX ID"
                    >
                      <span>TX #{tx.id.slice(0, 10)}</span>
                      <i className={`fas ${copiedId === tx.id ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    </button>
                    <span>{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900">
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

                  {tx.status === TransactionStatus.PENDING ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateStatus(tx.id, TransactionStatus.COMPLETED)}
                        className="py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onUpdateStatus(tx.id, TransactionStatus.REJECTED)}
                        className="py-1.5 px-3 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/30 transition"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[11px] italic">Resolved</span>
                  )}
                </div>
              </div>
            ))}

            {filteredTxs.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs">
                No transactions match the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4. SYSTEM SETTINGS VIEW
  if (view === 'settings') {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Platform System Configuration</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure official deposit destination wallet addresses for BTC, ETH, and USDT.
          </p>
        </div>

        {configSaved && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
            <i className="fas fa-check-circle"></i>
            <span>System deposit addresses updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              <i className="fab fa-bitcoin text-amber-500 mr-2"></i>Bitcoin (BTC) Receiving Address
            </label>
            <input
              type="text"
              value={localConfig.btcAddress}
              onChange={(e) => setLocalConfig({ ...localConfig, btcAddress: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xs focus:border-cyan-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              <i className="fab fa-ethereum text-cyan-400 mr-2"></i>Ethereum (ETH) Receiving Address
            </label>
            <input
              type="text"
              value={localConfig.ethAddress}
              onChange={(e) => setLocalConfig({ ...localConfig, ethAddress: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xs focus:border-cyan-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              <i className="fas fa-dollar-sign text-emerald-400 mr-2"></i>Tether (USDT - ERC20/TRC20) Address
            </label>
            <input
              type="text"
              value={localConfig.usdtAddress}
              onChange={(e) => setLocalConfig({ ...localConfig, usdtAddress: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xs focus:border-cyan-400 outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="py-3 px-6 rounded-xl font-bold bg-cyan-400 text-slate-950 hover:brightness-110 transition shadow-lg shadow-cyan-400/20 text-xs"
          >
            Save Custody Addresses
          </button>
        </form>
      </div>
    );
  }

  return null;
};

export default AdminView;
