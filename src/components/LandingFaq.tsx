import React, { useState } from 'react';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  badgeColor: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    id: 'security',
    category: 'Account Security',
    question: 'How are my funds and personal credentials protected?',
    answer:
      'Growyour$ isolates institutional assets in segregated multi-signature cold storage vaults with multi-party computation (MPC) authorization. User credentials are cryptographically protected via secure salting and hashing protocols, protected by encrypted JWT session tokens and continuous anomaly monitoring. No custodial private keys are ever exposed to the web layer.',
    badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
  },
  {
    id: 'deposits',
    category: 'Deposit Timelines',
    question: 'How long do crypto deposits take to arrive in my vault?',
    answer:
      'Deposits via Bitcoin (BTC), Ethereum (ETH), and Solana (SOL) require standard on-chain node confirmations (typically 1 to 3 network blocks, or 5–15 minutes). Once broadcast to the designated custodial address and verified by node operators, your capital balance updates immediately on your dashboard.',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  },
  {
    id: 'plans',
    category: 'Investment Plans',
    question: 'How do the algorithmic yield strategies and daily payouts operate?',
    answer:
      'Our investment tiers—from Starter Node to Institutional Alpha—deploy capital across automated basis arbitrage, automated market-making (AMM) liquidity pools, and low-latency delta-neutral spreads. Predictable daily yields accrue directly into your available balance according to the plan duration selected upon activation.',
    badgeColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20'
  },
  {
    id: 'withdrawals',
    category: 'Withdrawals & Settlement',
    question: 'What is the procedure for withdrawing profits or principal?',
    answer:
      'Withdrawal requests can be submitted 24/7 through your Custody & Funding Wallet to any external destination address. To uphold regulatory compliance and guard against unauthorized drain attacks, requests are reviewed by platform auditors and dispatched to the blockchain network within 30 to 60 minutes.',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  },
  {
    id: 'minimums',
    category: 'Minimums & Fees',
    question: 'What is the minimum deposit requirement, and are there hidden fees?',
    answer:
      'Growyour$ welcomes investors starting at $50 (equivalent in BTC, ETH, or SOL). We maintain a 0% fee structure on inbound deposits. Outbound withdrawals include standard native blockchain network gas costs with zero hidden administrative markups.',
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  }
];

export const LandingFaq: React.FC = () => {
  // Default first FAQ item open
  const [openId, setOpenId] = useState<string | null>('security');

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="mt-20 border-t border-slate-900 pt-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
          <i className="fas fa-circle-question text-[10px]"></i>
          <span>Answers to Common Questions</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Everything you need to know about our institutional custody, deposit verification, and automated yield plans.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {FAQ_DATA.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'bg-slate-900/90 border-slate-700/80 shadow-lg shadow-black/40'
                  : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700/60 hover:bg-slate-900/40'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="w-full text-left p-5 sm:p-6 flex items-start sm:items-center justify-between gap-4 transition"
                aria-expanded={isOpen}
              >
                <div className="space-y-1 sm:space-y-1.5 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${item.badgeColor}`}
                    >
                      {item.category}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {item.question}
                  </h3>
                </div>

                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-transform duration-200 ${
                    isOpen
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 rotate-180'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                  }`}
                >
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </button>

              {isOpen && (
                <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 mt-1">
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LandingFaq;
