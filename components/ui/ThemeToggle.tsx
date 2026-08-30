'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Basculer le thème"
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border bg-slate-100 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] dark:hover:text-[#FF5722] active:scale-95 ${className}`}
    >
      {!mounted ? (
        <span className="w-4 h-4 rounded-full bg-slate-300 dark:bg-zinc-600 opacity-60" />
      ) : resolvedTheme === 'dark' ? (
        <Sun size={18} className="text-amber-400 animate-in spin-in-90 duration-200" />
      ) : (
        <Moon size={18} className="text-slate-700 animate-in spin-in-90 duration-200" />
      )}
    </button>
  );
};
