import React from 'react';

interface GrowyourLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export const GrowyourLogo: React.FC<GrowyourLogoProps> = ({
  size = 'md',
  className = '',
  showText = false,
}) => {
  // Dimension mapping
  const sizeMap = {
    sm: { box: 'w-8 h-8', iconSize: 22, text: 'text-sm', subText: 'text-[9px]' },
    md: { box: 'w-10 h-10', iconSize: 26, text: 'text-base', subText: 'text-[10px]' },
    lg: { box: 'w-12 h-12', iconSize: 32, text: 'text-lg', subText: 'text-xs' },
    xl: { box: 'w-16 h-16', iconSize: 42, text: 'text-2xl', subText: 'text-sm' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* High-Luminance Radiant Emblem - Guaranteed 100% Visibility on Dark Backgrounds */}
      <div
        className={`relative ${currentSize.box} rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-tr from-cyan-400 via-teal-300 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-400/30 group transition-transform duration-200 hover:scale-105`}
      >
        {/* Luminous Glow Halo */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-cyan-400 to-emerald-400 blur-[6px] opacity-60 group-hover:opacity-100 transition-opacity" />

        {/* Inner Dark-Contrast Core */}
        <div className="relative w-full h-full rounded-[10px] bg-[#021024] flex items-center justify-center overflow-hidden">
          {/* Subtle Background Node Rays */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/25 via-emerald-500/10 to-transparent" />

          {/* Bold Vector Growth-Chevron & Currency Glyph */}
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10 w-[78%] h-[78%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          >
            <defs>
              <linearGradient id="glyphGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>

            {/* Ascending Trend Line */}
            <path
              d="M 5 21 L 12 14 L 17 18 L 26 8"
              stroke="url(#glyphGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Arrowhead */}
            <path
              d="M 20 8 H 26 V 14"
              stroke="url(#glyphGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Prominent High-Contrast Dollar Sign */}
            <circle cx="14" cy="18" r="6" fill="#021024" stroke="url(#glyphGrad)" strokeWidth="1.5" />
            
            {/* Dollar Stem */}
            <line x1="14" y1="14" x2="14" y2="22" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            
            {/* Dollar Body */}
            <path
              d="M 16 15.5 C 16 14.5 15.2 14.2 14 14.2 C 12.6 14.2 12 14.8 12 15.7 C 12 17.2 16 17 16 18.6 C 16 19.5 15.2 20.2 14 20.2 C 12.5 20.2 11.9 19.5 11.9 18.7"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {showText && (
        <div className="leading-tight">
          <div className={`font-black ${currentSize.text} tracking-tight text-white flex items-center`}>
            <span>Growyour</span>
            <span className="text-emerald-400 ml-0.5">$</span>
          </div>
          <div className={`${currentSize.subText} text-cyan-400 font-bold tracking-wider uppercase`}>
            Online Stock & Crypto
          </div>
        </div>
      )}
    </div>
  );
};

export default GrowyourLogo;
