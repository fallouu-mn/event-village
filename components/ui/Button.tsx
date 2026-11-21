import React from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'dark' | 'outline' | 'ghost' | 'danger' | 'gradient';
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
 * Lot 5 (contrat Q) : cible d'au moins 44 px à toutes les tailles (min-h-11, icône 44 × 44).
 * Design 1e (orange de marque #F05A1A, mêmes valeurs en clair et en sombre) : principal plein `primary` en orange ; texte
 * #1A1A1A en petite et moyenne taille (5,12:1), blanc GRAS de 19 px en grande taille (PRIMARY_LARGE, « grand texte » du
 * WCAG : 3,40:1). Secondaire : fond de carte, texte orange foncé (#C2410C en clair 5,18:1, #FA7036 en sombre). Grand
 * bouton (`gradient`) : UN SEUL par écran ; dégradé signature tout orange #F05A1A → #D9480F, pilule de 56 px, texte blanc
 * gras de 19 px (3,40:1 au pire point, jamais plus petit). Focus : anneau orange doublé d'un liseré sombre
 * (app/globals.css). Appui : léger enfoncement à 98 %, 150 ms, coupé si « réduire les animations ».
 */
const baseStyles =
  'inline-flex min-h-11 items-center justify-center gap-2 font-semibold cursor-pointer select-none transition-[background-color,border-color,color,filter,transform] duration-fast ease-standard motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent shadow-sm',
  secondary: 'bg-card text-primary-text hover:bg-muted border border-border',
  glass: 'bg-card/85 text-foreground-strong backdrop-blur-md hover:bg-card border border-border',
  dark: 'bg-foreground-strong text-background hover:bg-foreground-strong/90 border border-transparent',
  outline: 'bg-transparent text-primary-text hover:bg-primary-soft border-2 border-primary-text',
  ghost: 'bg-transparent text-foreground-strong hover:bg-muted border border-transparent',
  danger: 'bg-danger text-on-tone hover:bg-danger/90 border border-transparent shadow-sm',
  gradient:
    'bg-gradient-to-r from-gradient-from to-gradient-to text-gradient-foreground font-bold text-[1.1875rem] leading-tight shadow-gradient hover:brightness-110 border border-transparent',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3.5 text-sm rounded-lg gap-1.5',
  md: 'min-h-11 px-4 text-sm rounded-xl',
  lg: 'min-h-12 px-6 text-base rounded-2xl gap-2.5',
  icon: 'min-h-11 min-w-11 h-11 w-11 p-0 rounded-xl',
};

/** Design 1e : bouton principal en grande taille, blanc gras de 19 px sur l'orange (« grand texte », ≥ 3:1). */
const PRIMARY_LARGE = 'text-primary-foreground-large font-bold text-[1.1875rem] leading-tight';

/** Taille du grand bouton, quelle que soit `size` : pilule de 56 px, texte de 19 px (jamais réduit). */
const GRADIENT_SIZE = 'min-h-14 px-7 gap-2.5 rounded-full';

/** Classes d'un bouton, partagées avec LinkButton (lien stylé en bouton, sans <button> imbriqué). */
export function buttonClasses(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  const { variant = 'primary', size = 'md', fullWidth = false, className } = options;
  return cn(baseStyles, variant === 'gradient' ? GRADIENT_SIZE : sizes[size], variants[variant], variant === 'primary' && size === 'lg' && PRIMARY_LARGE, fullWidth && 'w-full', className);
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
