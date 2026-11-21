import React from 'react';
import Link from './IntentLink';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './Button';

export interface LinkButtonProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Ouvre dans un nouvel onglet (rel="noopener noreferrer" posé d'office). */
  external?: boolean;
  /**
   * Design 1e (vitesse) : préchargement à l'INTENTION par défaut (survol, toucher, focus : IntentLink), plus à l'affichage
   * (avant : défaut de next/link, qui préchargeait par exemple /explore pendant le chargement de chaque page) ; true :
   * préchargement à l'affichage, comme next/link.
   */
  prefetch?: boolean;
}

/**
 * Lien stylé en bouton (contrat Q) : remplace les `<Link><Button>` imbriqués (HTML invalide, double
 * tabulation). Mêmes variantes et tailles que Button, donc au moins 44 px.
 */
export const LinkButton: React.FC<LinkButtonProps> = ({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  external = false,
  prefetch,
  className,
  children,
  ...props
}) => {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={buttonClasses({ variant, size, fullWidth, className: `no-underline ${className ?? ''}` })}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    >
      {leftIcon && <span className="inline-flex flex-shrink-0 items-center" aria-hidden="true">{leftIcon}</span>}
      {children !== undefined && children !== null && children !== false && <span className="min-w-0">{children}</span>}
      {rightIcon && <span className="inline-flex flex-shrink-0 items-center" aria-hidden="true">{rightIcon}</span>}
    </Link>
  );
};
