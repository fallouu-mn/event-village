'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Basculer le thème"
      suppressHydrationWarning
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border bg-slate-100 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] dark:hover:text-[#FF5722] active:scale-95 ${className}`}
    >
      <Sun size={18} className="hidden dark:block text-amber-400" />
      <Moon size={18} className="block dark:hidden text-slate-700" />
    </button>
  );
};

