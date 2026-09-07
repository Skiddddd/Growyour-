import React, { useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { User, Transaction, TransactionStatus, TransactionType, UserRole } from '../types';

interface DashboardViewProps {
  user: User;
  transactions: Transaction[];
  onNavigateTab: (tab: string) => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
}

const PERFORMANCE_DATA_30D = [
  { day: 'Day 1', value: 1000, profit: 0 },
  { day: 'Day 5', value: 1120, profit: 120 },
  { day: 'Day 10', value: 1280, profit: 280 },
  { day: 'Day 15', value: 1240, profit: 240 },
  { day: 'Day 20', value: 1450, profit: 450 },
  { day: 'Day 25', value: 1680, profit: 680 },
  { day: 'Day 30', value: 1950, profit: 950 }
];

const MARKET_TICKERS = [
  { symbol: 'BTC', name: 'Bitcoin', price: '$87,420.50', change: '+3.42%', positive: true },
  { symbol: 'ETH', name: 'Ethereum', price: '$2,780.15', change: '+2.18%', positive: true },
  { symbol: 'SOL', name: 'Solana', price: '$184.60', change: '+6.85%', positive: true },
  { symbol: 'USDT', name: 'Tether USD', price: '$1.00', change: '+0.01%', positive: true }
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  transactions,
  onNavigateTab,
  onOpenDeposit,
  onOpenWithdraw
}) => {
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D'>('30D');

  const isAdmin = user.role === UserRole.ADMIN;
  const userTxs = isAdmin ? transactions : transactions.filter((t) => t.userId === user.id);
  const recent = userTxs.slice(0, 8);
  const pendingTxs = transactions.filter((t) => t.status === TransactionStatus.PENDING);

  const totalDeposited = userTxs
    .filter((t) => t.type === TransactionType.DEPOSIT && t.status === TransactionStatus.COMPLETED)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalInvested = userTxs
    .filter((t) => t.type === TransactionType.INVESTMENT)
    .reduce((sum, t) => sum + t.amount, 0);

  // Scaled portfolio value calculation
  const portfolioTotal = user.balance + totalInvested;

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            Welcome back, <span className="text-cyan-400">{user.fullName || (isAdmin ? 'Administrator' : 'Investor')}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isAdmin
              ? 'Platform custody reserves, node health, and transaction audit management.'
              : 'Real-time algorithmic trading node & capital management overview.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {!isAdmin ? (
            <>
              <button
                onClick={onOpenDeposit}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
              >
                <i className="fas fa-plus"></i>
                <span>Deposit Capital</span>
              </button>
              <button
                onClick={onOpenWithdraw}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center gap-2"
              >
                <i className="fas fa-arrow-up-right-from-square"></i>
                <span>Withdraw</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('admin-tx')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
              >
                <i className="fas fa-clipboard-check"></i>
                <span>TX Approvals ({pendingTxs.length})</span>
              </button>
              <button
                onClick={() => onNavigateTab('admin-overview')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 transition flex items-center gap-2"
              >
                <i className="fas fa-shield-halved"></i>
                <span>Admin Console</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Pending Approvals Notification Alert */}
      {isAdmin && pendingTxs.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0">
              <i className="fas fa-bell text-base animate-pulse"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-200">
                {pendingTxs.length} Incoming {pendingTxs.length === 1 ? 'Transaction' : 'Transactions'} Awaiting Approval
              </p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                New user deposit(s) or withdrawal request(s) are queued. Review and confirm them to update user balances.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('admin-tx')}
            className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition shrink-0 flex items-center gap-2"
          >
            <span>Open Approvals Queue</span>
            <i className="fas fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Available Balance</span>
            <span className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <i className="fas fa-wallet text-[11px]"></i>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            ${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-2 flex items-center gap-1">
            <i className="fas fa-arrow-trend-up"></i>
            <span>Liquid USD equivalent</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Active Investments</span>
            <span className="w-6 h-6 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <i className="fas fa-cubes text-[11px]"></i>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-cyan-400 font-semibold mt-2 flex items-center gap-1">
            <i className="fas fa-clock"></i>
            <span>Compounding in yield tiers</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Account Value</span>
            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <i className="fas fa-chart-line text-[11px]"></i>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            ${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-2 flex items-center gap-1">
            <i className="fas fa-shield-halved"></i>
            <span>Insured custody reserve</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Confirmed Deposits</span>
            <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <i className="fas fa-building-columns text-[11px]"></i>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            ${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            <span>Lifetime network transfers</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart + Live Market Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Area Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Portfolio Trajectory & Growth</h2>
              <p className="text-xs text-slate-400 mt-0.5">Estimated ROI projection based on automated tier execution</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(['7D', '30D', '90D'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1 rounded font-semibold transition ${
                    timeframe === t ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PERFORMANCE_DATA_30D} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090d16',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                />
                <Area type="monotone" dataKey="value" name="Total Capital" stroke="#06b6d4" strokeWidth={2.5} fill="url(#cyanArea)" />
                <Area type="monotone" dataKey="profit" name="Net Yield" stroke="#10b981" strokeWidth={2} fill="url(#emeraldArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Market Watch (1 col) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Market Radar</h2>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                LIVE 24H
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Benchmark cryptos backing platform liquidity pools</p>

            <div className="space-y-3">
              {MARKET_TICKERS.map((ticker) => (
                <div
                  key={ticker.symbol}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
                      {ticker.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{ticker.name}</div>
                      <div className="text-[10px] text-slate-400">{ticker.symbol}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-slate-100">{ticker.price}</div>
                    <div className="text-[10px] font-semibold text-emerald-400">{ticker.change}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('invest')}
            className="w-full mt-6 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:brightness-110 transition shadow-lg shadow-cyan-500/20 text-center"
          >
            Explore Investment Tiers
          </button>
        </div>
      </div>

      {/* Recent Ledger Transactions */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Most recent deposits, withdrawals, and plan subscriptions</p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            View All Ledger &rarr;
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              <tr>
                <th className="py-3 px-3">Reference</th>
                {isAdmin && <th className="py-3 px-3">User Account</th>}
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Method / Route</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
                {isAdmin && <th className="py-3 px-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {recent.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-3 font-mono text-slate-400">#{tx.id.slice(0, 10)}</td>
                  {isAdmin && (
                    <td className="py-3 px-3 font-medium text-white max-w-[180px] truncate">
                      {tx.userEmail || tx.userId}
                    </td>
                  )}
                  <td className="py-3 px-3 font-semibold text-white">{tx.type}</td>
                  <td className="py-3 px-3 text-slate-400">{tx.method}</td>
                  <td className="py-3 px-3 font-mono font-bold text-white">${tx.amount.toLocaleString()}</td>
                  <td className="py-3 px-3">
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
                  <td className="py-3 px-3 text-slate-400">{new Date(tx.date).toLocaleDateString()}</td>
                  {isAdmin && (
                    <td className="py-3 px-3 text-right">
                      {tx.status === TransactionStatus.PENDING ? (
                        <button
                          onClick={() => onNavigateTab('admin-tx')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition"
                        >
                          Review
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Logged</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="py-8 text-center text-slate-500">
                    No transactions recorded yet. Make a deposit or start an investment plan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Card-List View */}
        <div className="block md:hidden space-y-3">
          {recent.map((tx) => (
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

              {isAdmin && tx.userEmail && (
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

              {isAdmin && tx.status === TransactionStatus.PENDING && (
                <button
                  onClick={() => onNavigateTab('admin-tx')}
                  className="w-full mt-2 py-2 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition text-center"
                >
                  Review in TX Approvals Queue
                </button>
              )}
            </div>
          ))}

          {recent.length === 0 && (
            <div className="py-8 text-center text-slate-500 text-xs">
              No transactions recorded yet. Make a deposit or start an investment plan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
