import React from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'dark' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Lot 5 (contrat Q) : cible d'au moins 44 px à toutes les tailles (min-h-11, icône 44 × 44), primaire
 * en fond plein `brand` (#C2410C, texte blanc 5,18:1), focus visible sur l'anneau `ring`.
 */
const baseStyles =
  'inline-flex min-h-11 items-center justify-center gap-2 font-semibold tracking-tight cursor-pointer select-none transition-colors duration-200 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover border border-transparent shadow-sm',
  secondary: 'bg-surface-sunken text-fg hover:bg-border border border-border',
  glass: 'bg-surface/85 text-fg backdrop-blur-md hover:bg-surface border border-border',
  dark: 'bg-fg text-surface hover:bg-fg/90 border border-transparent',
  outline: 'bg-transparent text-brand-fg hover:bg-brand-bg border-2 border-brand-fg',
  ghost: 'bg-transparent text-fg hover:bg-surface-sunken border border-transparent',
  danger: 'bg-danger text-on-tone hover:bg-danger/90 border border-transparent shadow-sm',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3.5 text-sm rounded-lg gap-1.5',
  md: 'min-h-11 px-4 text-sm rounded-xl',
  lg: 'min-h-12 px-6 text-base rounded-2xl gap-2.5',
  icon: 'min-h-11 min-w-11 h-11 w-11 p-0 rounded-xl',
};

/** Classes d'un bouton, partagées avec LinkButton (lien stylé en bouton, sans <button> imbriqué). */
export function buttonClasses(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  const { variant = 'primary', size = 'md', fullWidth = false, className } = options;
  return cn(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block h-4 w-4 flex-shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        leftIcon && <span className="inline-flex flex-shrink-0 items-center" aria-hidden="true">{leftIcon}</span>
      )}
      {children !== undefined && children !== null && children !== false && <span className="min-w-0">{children}</span>}
      {!isLoading && rightIcon && (
        <span className="inline-flex flex-shrink-0 items-center" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
};
