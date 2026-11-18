'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X, type LucideIcon } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './cn';

/**
 * Design 1a (direction.md, section 6) — LE système de retours de toute l'application.
 *
 *  - Réussite : se ferme seule après 4 s ; minuterie en pause au survol et tant que le focus est dans le message (WCAG 2.2.1).
 *  - Action qui se défait : `toast.success(message, { onUndo })` ou `toast.undoable(message, onUndo)` : 6 s, bouton
 *    « Annuler ». Jamais après un paiement, un versement ou un SMS parti (la confirmation avant suffit).
 *  - Erreur générale (réseau, serveur) : `toast.error(message, { onRetry })` RESTE jusqu'à sa fermeture, avec « Réessayer »
 *    quand l'action peut être relancée. Une erreur d'un champ ne passe JAMAIS par un toast : elle va sous le champ (Field).
 *  - Trois toasts au plus ; en bas de l'écran sur téléphone (au-dessus de la barre du bas), en haut à droite sur ordinateur ;
 *    annoncés aux lecteurs d'écran (`status` pour une réussite ou une information, `alert` pour une erreur ou une alerte).
 *  - Jamais de code technique : un message qui en a l'air (CODE_EN_CAPITALES, « HTTP 500 », « Error: », JSON, balise) est
 *    remplacé par une phrase simple (garde-fou ; les textes viennent normalement de lib/api/public-error et de la base).
 * Animations : arrivée 200 ms décélérée, départ 150 ms accéléré, coupées si « réduire les animations » (app/globals.css).
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Erreur générale : bouton « Réessayer » qui relance l'action. */
  onRetry?: () => void;
  /** Action qui se défait : bouton « Annuler » (le toast reste alors 6 s). */
  onUndo?: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  /** null : le toast reste jusqu'à sa fermeture. */
  durationMs: number | null;
  action: { label: 'Annuler' | 'Réessayer'; run: () => void } | null;
  createdAt: number;
}

export interface ToastContextType {
  toast: {
    success: (message: string, options?: ToastOptions) => void;
    undoable: (message: string, onUndo: () => void) => void;
    error: (message: string, options?: ToastOptions) => void;
    info: (message: string) => void;
    warning: (message: string, options?: ToastOptions) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const TOAST_DURATIONS = { success: 4000, undoable: 6000, info: 4000, warning: 6000 } as const;
export const MAX_TOASTS = 3;
const EXIT_MS = 150;
export const GENERIC_ERROR = 'Quelque chose s’est mal passé. Réessayez dans un instant.';

/** Garde-fou « jamais de code technique » : rend le message, ou une phrase simple s'il ressemble à un code. */
export function humanToastMessage(message: string): string {
  const m = message.trim();
  // Coupure réseau : message brut du navigateur (fetch) jamais affiché
  if (/^(?:Failed to fetch|Load failed|NetworkError\b|fetch failed)/i.test(m)) return 'Connexion impossible. Vérifiez votre réseau, puis réessayez.';
  if (/\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b|\bHTTP\s?\d{3}\b|\b(?:Type|Reference|Syntax)?Error:|\bat\s+\S+\s+\(|^[[{]|<\/?[a-z][^>]*>|\bundefined\b|\bnull\b/.test(m)) {
    return GENERIC_ERROR;
  }
  return m;
}

const TOAST_CONFIG: Record<ToastType, { icon: LucideIcon; label: string; role: 'status' | 'alert'; iconClass: string; labelClass: string; borderClass: string }> = {
  success: { icon: CheckCircle2, label: 'C’est fait', role: 'status', iconClass: 'bg-success-soft text-success-text', labelClass: 'text-success-text', borderClass: 'border-success-border' },
  error: { icon: XCircle, label: 'Erreur', role: 'alert', iconClass: 'bg-danger-soft text-danger-text', labelClass: 'text-danger-text', borderClass: 'border-danger-border' },
  info: { icon: Info, label: 'Information', role: 'status', iconClass: 'bg-info-soft text-info-text', labelClass: 'text-info-text', borderClass: 'border-info-border' },
  warning: { icon: AlertTriangle, label: 'Attention', role: 'alert', iconClass: 'bg-warning-soft text-warning-text', labelClass: 'text-warning-text', borderClass: 'border-warning-border' },
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const paused = useRef({ hover: false, focus: false });
  const remaining = useRef(toast.durationMs ?? 0);
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      onDismiss(toast.id);
      return;
    }
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), EXIT_MS);
  }, [onDismiss, toast.id]);

  const run = useCallback(() => {
    if (toast.durationMs === null || remaining.current <= 0) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(dismiss, remaining.current);
  }, [dismiss, toast.durationMs]);

  const pause = (key: 'hover' | 'focus', on: boolean): void => {
    const wasPaused = paused.current.hover || paused.current.focus;
    paused.current[key] = on;
    const isPaused = paused.current.hover || paused.current.focus;
    if (!wasPaused && isPaused && timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      remaining.current -= Date.now() - startedAt.current;
    } else if (wasPaused && !isPaused) {
      run();
    }
  };

  useEffect(() => {
    run();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [run]);

  return (
    <div
      onMouseEnter={() => pause('hover', true)}
      onMouseLeave={() => pause('hover', false)}
      onFocus={() => pause('focus', true)}
      onBlur={() => pause('focus', false)}
      role={config.role}
      aria-atomic="true"
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3 pr-1.5 text-foreground shadow-popover',
        config.borderClass,
        isExiting ? 'toast-exit' : 'toast-enter',
      )}
    >
      <span className={cn('mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', config.iconClass)} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <p className={cn('text-sm font-semibold', config.labelClass)}>{config.label}</p>
        <p className="break-words text-sm leading-relaxed text-foreground">{toast.message}</p>
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => { toast.action?.run(); dismiss(); }}
          className="min-h-11 flex-shrink-0 rounded-lg px-3 text-sm font-bold text-primary-text hover:bg-primary-soft"
        >
          {toast.action.label}
        </button>
      )}
      <IconButton aria-label="Fermer le message" onClick={dismiss}>
        <X size={18} />
      </IconButton>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, raw: string, options: ToastOptions = {}) => {
    if (!raw || typeof raw !== 'string') return;
    const message = humanToastMessage(raw);
    const action = options.onUndo
      ? { label: 'Annuler' as const, run: options.onUndo }
      : options.onRetry ? { label: 'Réessayer' as const, run: options.onRetry } : null;
    const durationMs = type === 'error' || (type === 'warning' && options.onRetry)
      ? null
      : options.onUndo ? TOAST_DURATIONS.undoable : TOAST_DURATIONS[type];
    const item: ToastItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      durationMs,
      action,
      createdAt: Date.now(),
    };
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), item]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useMemo<ToastContextType['toast']>(
    () => ({
      success: (msg, options) => addToast('success', msg, options),
      undoable: (msg, onUndo) => addToast('success', msg, { onUndo }),
      error: (msg, options) => addToast('error', msg, options),
      info: (msg) => addToast('info', msg),
      warning: (msg, options) => addToast('warning', msg, options),
    }),
    [addToast],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Téléphone : en bas, au-dessus de la barre de navigation ; ordinateur : en haut à droite, sous l'en-tête */}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-5 sm:w-full sm:max-w-md lg:bottom-auto lg:top-20">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Repli hors provider : référence stable (évite de relancer les effets qui dépendent de `toast`)
const NOOP_TOAST: ToastContextType['toast'] = {
  success: () => {},
  undoable: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
};

export const useToast = (): ToastContextType['toast'] => {
  const context = useContext(ToastContext);
  if (!context) {
    return NOOP_TOAST;
  }
  return context.toast;
};
