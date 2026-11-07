import React, { useEffect, useRef, useState } from 'react';
import { verificationService } from '../services/verificationService';

interface VerifyEmailCardProps {
  email: string;
  initialError?: string;
  onVerified: () => void;
  onBack: () => void;
}

export const VerifyEmailCard: React.FC<VerifyEmailCardProps> = ({ email, initialError = '', onVerified, onBack }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(initialError);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(initialError ? 0 : 60);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await verificationService.verifyCode(email, code);
      onVerified();
    } catch (err: any) {
      setError(err?.message || 'Could not verify the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await verificationService.sendCode(email);
      setInfo('A new code has been sent. Check your inbox and spam folder.');
      setCooldown(60);
      setCode('');
    } catch (err: any) {
      setError(err?.message || 'Could not send a new code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 border-b border-slate-900 pb-5">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 mb-4">
          <i className="fas fa-envelope-circle-check text-lg"></i>
        </div>
        <h2 className="text-2xl font-black text-white">Verify Your Email</h2>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          We sent a 6-digit code to <span className="text-white font-semibold break-all">{email}</span>. Enter it below.
          After that, your account stays under review until our team approves it.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <i className="fas fa-circle-exclamation mt-0.5"></i>
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
          <i className="fas fa-circle-check mt-0.5"></i>
          <span>{info}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] text-white placeholder:text-slate-700 outline-none"
        />

        <button
          type="submit"
          disabled={code.length !== 6 || busy}
          className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 transition disabled:opacity-40"
        >
          {busy ? 'Please wait…' : 'Verify Email'}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-white">
          <i className="fas fa-arrow-left mr-1.5"></i>Back to sign in
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || busy}
          className="text-cyan-400 hover:text-cyan-300 font-semibold disabled:text-slate-600"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
};

export default VerifyEmailCard;
