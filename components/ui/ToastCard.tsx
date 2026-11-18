'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X, type LucideIcon } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './cn';
import type { ToastItem, ToastType } from './Toast';

/**
 * Design 1a — affichage des toasts (cartes, icônes, minuterie), chargé à la demande au premier toast (components/ui/Toast.tsx,
 * React.lazy) : rien de tout cela n'est téléchargé avec la page. Règles : components/ui/Toast.tsx et direction.md, section 6.
 */
const EXIT_MS = 150;

const TOAST_CONFIG: Record<ToastType, { icon: LucideIcon; label: string; role: 'status' | 'alert'; iconClass: string; labelClass: string; borderClass: string }> = {
  success: { icon: CheckCircle2, label: 'C’est fait', role: 'status', iconClass: 'bg-success-soft text-success-text', labelClass: 'text-success-text', borderClass: 'border-success-border' },
  error: { icon: XCircle, label: 'Erreur', role: 'alert', iconClass: 'bg-danger-soft text-danger-text', labelClass: 'text-danger-text', borderClass: 'border-danger-border' },
  info: { icon: Info, label: 'Information', role: 'status', iconClass: 'bg-info-soft text-info-text', labelClass: 'text-info-text', borderClass: 'border-info-border' },
  warning: { icon: AlertTriangle, label: 'Attention', role: 'alert', iconClass: 'bg-warning-soft text-warning-text', labelClass: 'text-warning-text', borderClass: 'border-warning-border' },
};

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

export default function ToastList({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <>
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </>
  );
}
