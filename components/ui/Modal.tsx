'use client';

import React, { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';

export interface ModalProps {
  /**
   * Nom de la zone défilante. À donner quand le corps ne contient aucun élément focalisable : elle reçoit alors le
   * focus, sinon le clavier ne peut pas la faire défiler.
   */
  scrollRegionLabel?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Conservé pour la compatibilité : toutes les variantes sont rendues sur les tokens du thème. */
  variant?: 'default' | 'glass' | 'dark';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  /** Action en cours : Escape, le voile et le bouton Fermer sont désactivés. */
  busy?: boolean;
  /** Nom accessible quand la modale n'a pas de titre visible. */
  ariaLabel?: string;
  /** `alertdialog` pour une confirmation qui interrompt (ConfirmDialog). */
  role?: 'dialog' | 'alertdialog';
  /** Élément à focaliser à l'ouverture (sinon le premier champ, puis le premier contrôle). */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Le clic sur le voile ferme la modale (oui par défaut, jamais pendant `busy`). */
  closeOnOverlayClick?: boolean;
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const MAX_WIDTH: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
};

// Pile des modales ouvertes : Escape et le piège de focus ne concernent que la plus haute ; le verrou
// de défilement n'est levé qu'à la fermeture de la dernière (modales imbriquées).
const openStack: string[] = [];
let savedBodyOverflow: string | null = null;

function lockScroll(): void {
  if (openStack.length === 1) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

function unlockScroll(): void {
  if (openStack.length === 0 && savedBodyOverflow !== null) {
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = null;
  }
}

// Rendu côté client seulement : faux au rendu serveur et à l'hydratation, vrai ensuite (et aussitôt pour
// une modale montée après l'hydratation), sans rendu supplémentaire.
const noopSubscribe = (): (() => void) => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null,
  );
}

/**
 * Modale accessible (contrat Q) : role dialog, aria-modal, aria-labelledby/-describedby, focus initial
 * dans la modale, piège de focus (Tab et Maj+Tab), focus restitué à l'élément d'origine, Escape (sauf
 * pendant une action), bouton Fermer de 44 px toujours présent, verrou de défilement compté.
 * Rendue dans un portail sur document.body : un ancêtre transformé (`.ev-page-enter` de app/template.tsx,
 * dans <main>) enfermait le voile `fixed inset-0` dans la colonne de contenu, sous l'en-tête collant et
 * la barre du bas (captures aide-transfert et pilotage-annulation du run 77).
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  variant = 'default',
  maxWidth = 'lg',
  busy = false,
  ariaLabel,
  role = 'dialog',
  initialFocusRef,
  closeOnOverlayClick = true,
  scrollRegionLabel,
}) => {
  const uid = useId();
  const titleId = `${uid}-titre`;
  const subtitleId = `${uid}-description`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  const isClient = useIsClient();
  busyRef.current = busy;
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    if (!busyRef.current) onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!isOpen || !isClient) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openStack.push(uid);
    lockScroll();

    const dialog = dialogRef.current;
    if (dialog) {
      const target = initialFocusRef?.current
        ?? dialog.querySelector<HTMLElement>('[data-autofocus], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])')
        ?? focusableIn(dialog).find((el) => el.getAttribute('data-modal-close') !== 'true')
        ?? dialog;
      target.focus();
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (openStack[openStack.length - 1] !== uid) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const items = focusableIn(dialogRef.current);
        if (items.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (active instanceof Node && !dialogRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const i = openStack.lastIndexOf(uid);
      if (i >= 0) openStack.splice(i, 1);
      unlockScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
    // initialFocusRef : lu à l'ouverture seulement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isClient, uid, requestClose]);

  if (!isOpen || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 md:p-6">
      <div
        className="absolute inset-0 bg-scrim/60 backdrop-blur-sm animate-in fade-in"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? requestClose : undefined}
      />

      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={subtitle ? subtitleId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface-raised text-left text-fg shadow-2xl focus:outline-none sm:max-h-[85dvh] sm:rounded-3xl',
          'animate-in fade-in zoom-in-95',
          variant === 'glass' && 'bg-surface-raised/95 backdrop-blur-xl',
          MAX_WIDTH[maxWidth],
        )}
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                {icon}
              </div>
            )}
            {(title || subtitle) && (
              <div className="min-w-0">
                {title && (
                  <h2 id={titleId} className="text-base font-bold leading-snug tracking-tight text-fg sm:text-lg">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p id={subtitleId} className="mt-0.5 text-sm leading-snug text-fg-muted">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
          <IconButton aria-label="Fermer" data-modal-close="true" onClick={requestClose} disabled={busy} className="-mr-2 -mt-1">
            <X size={20} />
          </IconButton>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6"
          {...(scrollRegionLabel ? { tabIndex: 0, role: 'group', 'aria-label': scrollRegionLabel } : {})}
        >
          {children}
        </div>

        {footer && (
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface-sunken/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
