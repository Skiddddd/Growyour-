import React, { useState } from 'react';
import { User, InvestmentPlan } from '../types';

interface InvestViewProps {
  user: User;
  plans: InvestmentPlan[];
  onInvest: (planId: string, amount: number) => void;
  onOpenDeposit: () => void;
}

export const InvestView: React.FC<InvestViewProps> = ({ user, plans, onInvest, onOpenDeposit }) => {
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleSelectPlan = (plan: InvestmentPlan) => {
    setSelectedPlan(plan);
    setAmount(plan.minAmount);
    setError('');
    setSuccessMessage('');
  };

  const handleInvest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    if (amount < selectedPlan.minAmount) {
      setError(`Minimum investment for ${selectedPlan.name} is $${selectedPlan.minAmount.toLocaleString()}`);
      return;
    }
    if (amount > selectedPlan.maxAmount) {
      setError(`Maximum investment for ${selectedPlan.name} is $${selectedPlan.maxAmount.toLocaleString()}`);
      return;
    }
    if (amount > user.balance) {
      setError(`Insufficient available balance ($${user.balance.toLocaleString()}). Please deposit funds first.`);
      return;
    }

    onInvest(selectedPlan.id, amount);
    setSuccessMessage(`Successfully subscribed to ${selectedPlan.name} for $${amount.toLocaleString()}!`);
    setSelectedPlan(null);
    setAmount(0);
    setError('');
  };

  const estimatedDaily = selectedPlan ? (amount * selectedPlan.dailyRoi) / 100 : 0;
  const estimatedTotal = selectedPlan ? amount + estimatedDaily * selectedPlan.durationDays : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Automated Investment Tiers</h1>
          <p className="text-sm text-slate-400 mt-1">
            Algorithmic portfolio allocation packages with fixed daily compound yields and capital protection.
          </p>
        </div>
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3">
          <span className="text-xs text-slate-400">Available:</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            ${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button
            onClick={onOpenDeposit}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 ml-1"
          >
            + Add Funds
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <i className="fas fa-circle-check text-emerald-400"></i>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isSelected = selectedPlan?.id === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 border bg-slate-900/60 ${
                isSelected
                  ? 'border-cyan-400 ring-2 ring-cyan-400/20 shadow-xl shadow-cyan-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {plan.risk || 'Algorithmic'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {plan.durationDays} Days Term
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono">
                    {plan.dailyRoi}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Daily ROI</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  {plan.strategy || 'Automated arbitrage with strict drawdown controls.'}
                </p>

                <div className="space-y-2.5 py-4 border-y border-slate-800/80 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Minimum Entry</span>
                    <span className="text-white font-mono font-bold">${plan.minAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Maximum Cap</span>
                    <span className="text-white font-mono font-bold">${plan.maxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capital Return</span>
                    <span className="text-emerald-400 font-semibold">100% at Term End</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estimated Total Yield</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      +{(plan.dailyRoi * plan.durationDays).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan(plan)}
                className={`w-full mt-6 py-3 rounded-xl text-xs font-bold transition text-center ${
                  isSelected
                    ? 'bg-cyan-400 text-slate-950 font-extrabold shadow-lg shadow-cyan-400/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {isSelected ? 'Configuring Plan...' : 'Select Tier'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Interactive Subscription Modal / Panel */}
      {selectedPlan && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Configure Allocation</span>
              <h2 className="text-xl font-bold text-white mt-1">Subscribing to {selectedPlan.name}</h2>
            </div>
            <button
              onClick={() => setSelectedPlan(null)}
              className="text-slate-400 hover:text-white text-sm p-2"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <form onSubmit={handleInvest} className="space-y-6">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <label className="text-slate-300 font-medium">Investment Principal (USD)</label>
                <span className="text-slate-400">
                  Range: ${selectedPlan.minAmount.toLocaleString()} - ${selectedPlan.maxAmount.toLocaleString()}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min={selectedPlan.minAmount}
                  max={selectedPlan.maxAmount}
                  value={amount || ''}
                  onChange={(e) => {
                    setAmount(Number(e.target.value));
                    setError('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-white font-mono text-base focus:border-cyan-400 outline-none"
                  placeholder={String(selectedPlan.minAmount)}
                  required
                />
              </div>
              {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}
            </div>

            {/* Live Calculations Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Daily Yield</span>
                <span className="text-emerald-400 font-mono font-bold text-base">
                  +${estimatedDaily.toFixed(2)} / day
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Total Term Returns</span>
                <span className="text-emerald-400 font-mono font-bold text-base">
                  ${estimatedTotal.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Net Expected Profit</span>
                <span className="text-cyan-400 font-mono font-bold text-base">
                  +${(estimatedTotal - amount).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="flex-1 py-3.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:brightness-110 transition shadow-lg shadow-cyan-400/20 text-sm"
              >
                Confirm & Start Investment (${amount.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="px-6 py-3.5 rounded-xl font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default InvestView;
