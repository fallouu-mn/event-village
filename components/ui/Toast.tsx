'use client';

import React, { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Cartes, icônes et minuterie : chargées au premier toast (et préchargées quand le navigateur est libre), jamais avec la page
// Hors ligne, le morceau peut manquer (absent du cache du service worker) : repli minimal en texte, jamais d'erreur.
const loadToastList = () => import('./ToastCard').catch(() => ({ default: ToastListFallback }));
const ToastList = lazy(loadToastList);

function ToastListFallback({ toasts }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <>
      {toasts.map((t) => (
        <p key={t.id} role={t.type === 'error' || t.type === 'warning' ? 'alert' : 'status'} className="pointer-events-auto rounded-xl border border-border bg-popover p-3 text-sm text-foreground shadow-popover">
          {t.message}
        </p>
      ))}
    </>
  );
}

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
 * Affichage (ToastCard.tsx) chargé à la demande : la zone annoncée aux lecteurs d'écran est, elle, présente dès la page.
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

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    // Sans réseau : pas de préchargement (le morceau viendra au premier toast, ou le repli en texte)
    const warm = () => { if (navigator.onLine !== false) void loadToastList(); };
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 3000);
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
        {toasts.length > 0 && (
          <Suspense fallback={null}>
            <ToastList toasts={toasts} onDismiss={removeToast} />
          </Suspense>
        )}
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
