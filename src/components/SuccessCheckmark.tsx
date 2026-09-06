import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

interface SuccessCheckmarkProps {
  title?: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  onDone?: () => void;
}

export const SuccessCheckmark: React.FC<SuccessCheckmarkProps> = ({
  title = 'Deposit Request Recorded',
  subtitle = 'Your transfer has been queued. Platform nodes and auditors will credit your balance once confirmed on chain.',
  amount,
  currency,
  onDone,
}) => {
  useEffect(() => {
    // Confetti cannon blast
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#06b6d4', '#34d399', '#38bdf8', '#fbbf24', '#ffffff'],
        disableForReducedMotion: true,
      });

      // Secondary delayed subtle shower
      const timer = setTimeout(() => {
        confetti({
          particleCount: 40,
          angle: 60,
          spread: 55,
          origin: { x: 0.1, y: 0.65 },
          colors: ['#10b981', '#06b6d4', '#34d399'],
        });
        confetti({
          particleCount: 40,
          angle: 120,
          spread: 55,
          origin: { x: 0.9, y: 0.65 },
          colors: ['#38bdf8', '#fbbf24', '#ffffff'],
        });
      }, 250);

      return () => clearTimeout(timer);
    } catch {
      // Fallback gracefully if canvas is constrained
    }
  }, []);

  return (
    <div className="py-6 px-4 text-center flex flex-col items-center justify-center space-y-4">
      {/* Animated Checkmark Container */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Expanding Ambient Ripple Ring 1 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeOut',
          }}
          className="absolute inset-0 rounded-full bg-emerald-500/30 blur-sm"
        />

        {/* Expanding Ambient Ripple Ring 2 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{
            duration: 1.8,
            delay: 0.3,
            repeat: Infinity,
            ease: 'easeOut',
          }}
          className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md"
        />

        {/* Glowing Badge Background */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 280,
            damping: 18,
          }}
          className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[3px] shadow-2xl shadow-emerald-500/40"
        >
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
            {/* SVG Animated Path Checkmark */}
            <svg
              className="w-10 h-10 text-emerald-400"
              viewBox="0 0 52 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Outer decorative SVG ring */}
              <motion.circle
                cx="26"
                cy="26"
                r="24"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="150"
                initial={{ strokeDashoffset: 150 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="text-emerald-500/30"
              />

              {/* Checkmark stroke draw */}
              <motion.path
                d="M14.5 27.5L22.5 35.5L37.5 17.5"
                stroke="url(#checkGrad)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { duration: 0.45, ease: 'easeOut', delay: 0.25 },
                  opacity: { duration: 0.1, delay: 0.25 },
                }}
              />

              <defs>
                <linearGradient id="checkGrad" x1="14" y1="35" x2="38" y2="17" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#34d399" />
                  <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </motion.div>
      </div>

      {/* Text & Metadata with Spring Transitions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
        className="space-y-1.5 max-w-sm"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Action Confirmed</span>
        </div>

        <h4 className="font-extrabold text-white text-xl tracking-tight">
          {title}
        </h4>

        {amount !== undefined && (
          <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 font-mono py-1">
            +${amount.toLocaleString()} {currency ? <span className="text-sm text-slate-400 font-normal">({currency})</span> : null}
          </div>
        )}

        <p className="text-xs text-slate-400 leading-relaxed pt-1">
          {subtitle}
        </p>
      </motion.div>

      {/* Node Status Confirmation Pill */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="w-full pt-2"
      >
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <i className="fas fa-network-wired text-cyan-400 text-sm"></i>
            <span>Network Status:</span>
          </div>
          <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
            <i className="fas fa-check-double text-[11px]"></i>
            Queued for Verification
          </span>
        </div>
      </motion.div>

      {onDone && (
        <motion.button
          type="button"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
        >
          Continue to Dashboard
        </motion.button>
      )}
    </div>
  );
};

export default SuccessCheckmark;
