'use client';

import React from 'react';
import Link from 'next/link';

export interface LogoProps {
  variant?: 'full' | 'mark' | 'auto';
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  linkToHome?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  theme = 'auto',
  className = '',
  linkToHome = true,
}) => {
  const content = (
    <div className={`flex items-center gap-2.5 select-none transition-transform active:scale-[0.98] ${className}`}>
      {/* Icon Mark */}
      <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0">
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-md">
          <defs>
            <linearGradient id="logo-mark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6A3D" />
              <stop offset="100%" stopColor="#FF3D68" />
            </linearGradient>
          </defs>
          <rect x="8" y="8" width="84" height="84" rx="26" fill="url(#logo-mark-grad)" />
          <path d="M50 24 L72 46 H60 V70 H40 V46 H28 Z" fill="#FFFFFF" fillOpacity="0.98" />
          <circle cx="8" cy="50" r="7" className="fill-[#F8F9FA] dark:fill-[#0F0F11]" />
          <circle cx="92" cy="50" r="7" className="fill-[#F8F9FA] dark:fill-[#0F0F11]" />
          <circle cx="50" cy="52" r="5" fill="#FF5722" />
        </svg>
      </div>

      {/* Typography (Hidden if variant is 'mark', responsive if 'auto') */}
      {(variant === 'full' || variant === 'auto') && (
        <div className={`flex flex-col leading-none ${variant === 'auto' ? 'hidden sm:flex' : 'flex'}`}>
          <div className="flex items-center tracking-tight font-black text-lg sm:text-xl">
            <span className="text-slate-900 dark:text-white">EVENT</span>
            <span className="text-[#FF5722] ml-1">VILLAGE</span>
          </div>
          <span className="text-[9px] font-bold tracking-[0.18em] text-slate-400 dark:text-slate-500 uppercase mt-0.5">
            Plateforme Événementielle
          </span>
        </div>
      )}
    </div>
  );

  if (linkToHome) {
    return (
      <Link href="/" className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
};
