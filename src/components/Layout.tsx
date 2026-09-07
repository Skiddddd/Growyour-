import React, { useState } from 'react';
import { User, UserRole } from '../types';
import GrowyourLogo from './GrowyourLogo';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  pendingCount?: number;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  onLogout,
  activeTab,
  setActiveTab,
  onOpenDeposit,
  onOpenWithdraw,
  pendingCount = 0
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isAdmin = user.role === UserRole.ADMIN;

  const userMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'invest', label: 'Invest Plans', icon: 'fa-rocket' },
    { id: 'transactions', label: 'Ledger History', icon: 'fa-list-check' },
    { id: 'wallet', label: 'Wallet & Fund', icon: 'fa-wallet' }
  ];

  const adminMenuItems = [
    { id: 'admin-overview', label: 'Admin Overview', icon: 'fa-shield-halved' },
    { id: 'admin-users', label: 'User Directory', icon: 'fa-users' },
    { id: 'admin-tx', label: 'TX Approvals', icon: 'fa-clipboard-check' },
    { id: 'admin-settings', label: 'System Config', icon: 'fa-sliders' }
  ];

  const filteredUserItems = isAdmin ? userMenuItems.filter((item) => item.id !== 'invest') : userMenuItems;
  const items = isAdmin ? [...filteredUserItems, ...adminMenuItems] : userMenuItems;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <GrowyourLogo size="sm" showText />
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/30">
            ${user.balance.toLocaleString()}
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
            aria-label="Toggle menu"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xs`}></i>
          </button>
        </div>
      </header>

      {/* Sidebar for Desktop - Sticky and always accessible */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-950 border-r border-slate-800/80 p-5 shrink-0 sticky top-0 h-screen overflow-y-auto justify-between z-30">
        <div className="space-y-6">
          {/* Logo */}
          <div className="px-2">
            <GrowyourLogo size="md" showText />
          </div>

          {/* User Profile Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 font-medium">{isAdmin ? 'Vault Custody Reserves' : 'Available Capital'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300">
                {user.role}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              ${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-1">
              {user.fullName || user.email}
            </div>

            {/* Quick Actions for investors */}
            {!isAdmin && (
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onOpenDeposit}
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition text-center"
                >
                  + Deposit
                </button>
                <button
                  type="button"
                  onClick={onOpenWithdraw}
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition text-center"
                >
                  - Withdraw
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
              Investor Portal
            </div>
            {filteredUserItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <i className={`fas ${item.icon} w-4 text-center text-xs ${active ? 'text-cyan-400' : 'text-slate-500'}`}></i>
                  <span>{item.label}</span>
                </button>
              );
            })}

            {isAdmin && (
              <>
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-3 pt-4 mb-2 flex items-center justify-between">
                  <span>Administration</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">ADMIN</span>
                </div>
                {adminMenuItems.map((item) => {
                  const active = activeTab === item.id;
                  const isTxItem = item.id === 'admin-tx';
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                        active
                          ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <i className={`fas ${item.icon} w-4 text-center text-xs ${active ? 'text-cyan-400' : 'text-slate-500'}`}></i>
                        <span>{item.label}</span>
                      </div>
                      {isTxItem && pendingCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 px-2">
            <span>Status: <span className="text-emerald-400 font-semibold">Active Node</span></span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition border border-transparent hover:border-rose-500/20"
          >
            <i className="fas fa-arrow-right-from-bracket text-xs"></i>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Menu - Sticky below mobile header */}
      {mobileMenuOpen && (
        <div className="md:hidden sticky top-[57px] z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 p-4 space-y-2 max-h-[75vh] overflow-y-auto shadow-2xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">
            Investor Portal
          </div>
          {filteredUserItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  active ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
              >
                <i className={`fas ${item.icon} w-4 text-center text-xs`}></i>
                <span>{item.label}</span>
              </button>
            );
          })}

          {isAdmin && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-3 pt-3 py-1 flex items-center justify-between border-t border-slate-800/80">
                <span>Administration</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">ADMIN</span>
              </div>
              {adminMenuItems.map((item) => {
                const active = activeTab === item.id;
                const isTxItem = item.id === 'admin-tx';
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      active ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <i className={`fas ${item.icon} w-4 text-center text-xs`}></i>
                      <span>{item.label}</span>
                    </div>
                    {isTxItem && pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-400 font-semibold hover:bg-rose-500/10 transition"
            >
              <i className="fas fa-arrow-right-from-bracket text-xs"></i>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area Container */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Desktop Sticky Header Bar - Always visible when scrolling */}
        <header className="hidden md:flex items-center justify-between px-6 py-3.5 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Current View:</span>
            <span className="text-xs font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20">
              {items.find((i) => i.id === activeTab)?.label || activeTab}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium">{isAdmin ? 'Platform Vault:' : 'Balance:'}</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                ${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {!isAdmin && (
              <>
                <button
                  type="button"
                  onClick={onOpenDeposit}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition border border-emerald-500/30"
                >
                  + Deposit
                </button>
                <button
                  type="button"
                  onClick={onOpenWithdraw}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition border border-cyan-500/30"
                >
                  - Withdraw
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content Body with space for sticky bottom bar on mobile */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar - Stays on screen when scrolling */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.6)]">
        {(isAdmin
          ? [
              { id: 'dashboard', label: 'Overview', icon: 'fa-chart-pie' },
              { id: 'admin-overview', label: 'Admin', icon: 'fa-shield-halved' },
              { id: 'admin-tx', label: 'Approvals', icon: 'fa-clipboard-check' },
              { id: 'admin-users', label: 'Users', icon: 'fa-users' },
              { id: 'wallet', label: 'Wallet', icon: 'fa-wallet' }
            ]
          : [
              { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
              { id: 'invest', label: 'Plans', icon: 'fa-rocket' },
              { id: 'transactions', label: 'Ledger', icon: 'fa-list-check' },
              { id: 'wallet', label: 'Wallet', icon: 'fa-wallet' }
            ]
        ).map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
                active
                  ? 'text-cyan-300 font-bold bg-cyan-500/15 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className={`fas ${item.icon} text-sm mb-0.5 ${active ? 'text-cyan-400' : 'text-slate-500'}`}></i>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
