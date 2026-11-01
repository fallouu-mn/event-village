import React from 'react';
import { cn } from './cn';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Nom accessible obligatoire : un bouton icône n'a pas de texte visible (contrat Q). */
  'aria-label': string;
  children: React.ReactNode;
  variant?: IconButtonVariant;
  isLoading?: boolean;
}

const variants: Record<IconButtonVariant, string> = {
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-sunken hover:text-fg',
  secondary: 'bg-surface-sunken text-fg hover:bg-border border border-border',
  primary: 'bg-brand text-on-brand hover:bg-brand-hover',
  danger: 'bg-transparent text-danger-fg hover:bg-danger-bg',
};

/** Bouton icône de 44 × 44 px, l'icône est masquée aux lecteurs d'écran (le nom vient d'aria-label). */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { 'aria-label': label, children, variant = 'ghost', isLoading = false, className, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex h-11 w-11 min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl cursor-pointer transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex items-center justify-center">
        {isLoading ? <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" /> : children}
      </span>
    </button>
  );
});
