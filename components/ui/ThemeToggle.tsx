'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from './cn';

/**
 * Bascule clair / sombre de l'en-tête (relecture des captures du run 50) : cible de 44 × 44 px, tokens du
 * système de design, focus visible. Le nom accessible reste stable (« Basculer le thème ») ; l'état est
 * exposé par aria-pressed (enfoncé = thème sombre), lu seulement après le montage pour éviter un écart
 * d'hydratation.
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Basculer le thème"
      aria-pressed={mounted ? isDark : undefined}
      title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      suppressHydrationWarning
      className={cn(
        'inline-flex h-11 w-11 min-h-11 min-w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-sunken text-fg',
        'transition-colors duration-200 hover:text-brand-fg motion-safe:active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex" suppressHydrationWarning>
        {isDark ? <Sun size={18} className="text-warning-fg" /> : <Moon size={18} />}
      </span>
    </button>
  );
};
