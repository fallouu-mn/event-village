import React from 'react';
import { cn } from './cn';

/**
 * Design 1a (direction.md, sections 3 et 5) — carte de base : fond `card`, filet `border`, arrondi de 12 px, ombre légère ;
 * `interactive` : ombre moyenne au survol (150 ms). En sombre, la séparation vient surtout du fond (`card` sur `background`).
 */
export function Card({
  interactive = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-foreground shadow-sm',
        interactive && 'transition-shadow duration-fast ease-standard hover:shadow-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
