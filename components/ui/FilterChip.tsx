import React from 'react';
import { cn } from './cn';

/**
 * Design 1a (direction.md, section 5) — puce de filtre : pilule de 44 px de haut (cible tactile), état annoncé par
 * aria-pressed ; choisie : fond `primary-soft`, texte et bord `primary-text` (4,68:1 en clair) ; la couleur n'est pas seule à
 * porter l'état (coche devant le libellé).
 */
export function FilterChip({
  pressed,
  className,
  children,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-fast ease-standard',
        pressed
          ? 'border-primary-text bg-primary-soft text-primary-text'
          : 'border-border bg-card text-foreground-strong hover:bg-muted',
        className,
      )}
      {...props}
    >
      {pressed && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}
