'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X, type LucideIcon } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './cn';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
  createdAt: number;
}

export interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Tons des messages (tokens du système de design, relecture des captures du run 50) : libellé en casse de
 * phrase, jamais en capitales. Succès et information sont annoncés poliment (role="status"), erreur et
 * avertissement immédiatement (role="alert").
 */
const TOAST_CONFIG: Record<ToastType, {
  icon: LucideIcon;
  label: string;
  role: 'status' | 'alert';
  iconClass: string;
  labelClass: string;
  barClass: string;
  borderClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    label: 'Succès',
    role: 'status',
    iconClass: 'bg-success-bg text-success-fg',
    labelClass: 'text-success-fg',
    barClass: 'bg-success',
    borderClass: 'border-success-border',
  },
  error: {
    icon: XCircle,
    label: 'Erreur',
    role: 'alert',
    iconClass: 'bg-danger-bg text-danger-fg',
    labelClass: 'text-danger-fg',
    barClass: 'bg-danger',
    borderClass: 'border-danger-border',
  },
  info: {
    icon: Info,
    label: 'Information',
    role: 'status',
    iconClass: 'bg-info-bg text-info-fg',
    labelClass: 'text-info-fg',
    barClass: 'bg-info',
    borderClass: 'border-info-border',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Attention',
    role: 'alert',
    iconClass: 'bg-warning-bg text-warning-fg',
    labelClass: 'text-warning-fg',
    barClass: 'bg-warning',
    borderClass: 'border-warning-border',
  },
};

/** Durée de la sortie animée ; nulle si l'utilisateur a demandé moins d'animations. */
const EXIT_MS = 220;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const ToastCard: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  // Minuterie suspendue au survol et tant que le focus est dans le message (WCAG 2.2.1)
  const isPausedRef = useRef({ hover: false, focus: false });
  const elapsedRef = useRef(0);
  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;

  const handleDismiss = useCallback(() => {
    if (prefersReducedMotion()) {
      onDismiss(toast.id);
      return;
    }
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, EXIT_MS);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const stepMs = 100;
    const interval = setInterval(() => {
      if (isPausedRef.current.hover || isPausedRef.current.focus) return;
      elapsedRef.current += stepMs;
      const remaining = Math.max(0, 100 - (elapsedRef.current / toast.durationMs) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleDismiss();
      }
    }, stepMs);

    return () => clearInterval(interval);
  }, [toast.durationMs, handleDismiss]);

  return (
    <div
      onMouseEnter={() => { isPausedRef.current.hover = true; }}
      onMouseLeave={() => { isPausedRef.current.hover = false; }}
      onFocus={() => { isPausedRef.current.focus = true; }}
      onBlur={() => { isPausedRef.current.focus = false; }}
      role={config.role}
      aria-atomic="true"
      className={cn(
        'pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border bg-surface-raised p-3 pr-1.5 text-fg shadow-xl',
        config.borderClass,
        isExiting ? 'toast-exit' : 'toast-enter',
      )}
    >
      <span className={cn('mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', config.iconClass)} aria-hidden="true">
        <Icon size={18} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <p className={cn('text-sm font-semibold', config.labelClass)}>{config.label}</p>
        <p className="break-words text-sm leading-relaxed text-fg">{toast.message}</p>
      </div>

      <IconButton aria-label="Fermer le message" onClick={handleDismiss}>
        <X size={18} />
      </IconButton>

      {/* Temps restant : décoratif, masqué si l'utilisateur a demandé moins d'animations */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-sunken motion-reduce:hidden" aria-hidden="true">
        <div
          className={cn('h-full motion-safe:transition-[width] motion-safe:duration-100 motion-safe:ease-linear', config.barClass)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    if (!message || typeof message !== 'string') return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Durée adaptative : 3,5 s au moins, 40 ms par caractère, 8 s au plus
    const durationMs = Math.max(3500, Math.min(8000, 3000 + message.length * 40));

    const newToast: ToastItem = {
      id,
      type,
      message,
      durationMs,
      createdAt: Date.now(),
    };

    setToasts((prev) => [...prev.slice(-3), newToast]); // 4 messages simultanés au plus
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useMemo(
    () => ({
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      info: (msg: string) => addToast('info', msg),
      warning: (msg: string) => addToast('warning', msg),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Sous 1024 px, au-dessus de la barre de navigation du bas ; jamais plus large que l'écran */}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-5 sm:w-full sm:max-w-md lg:bottom-5">
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
