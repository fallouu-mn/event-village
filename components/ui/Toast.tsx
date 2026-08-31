'use client';

import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

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

const TOAST_CONFIG = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    badgeText: 'SUCCÈS',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    barColor: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    cardBorder: 'border-emerald-500/30 dark:border-emerald-500/20',
  },
  error: {
    icon: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
    badgeText: 'ERREUR',
    badgeBg: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
    barColor: 'bg-gradient-to-r from-red-500 to-rose-400',
    cardBorder: 'border-red-500/30 dark:border-red-500/20',
  },
  info: {
    icon: <Info className="w-5 h-5 text-cyan-500 flex-shrink-0" />,
    badgeText: 'INFO',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
    barColor: 'bg-gradient-to-r from-cyan-500 to-blue-400',
    cardBorder: 'border-cyan-500/30 dark:border-cyan-500/20',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    badgeText: 'ATTENTION',
    badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    barColor: 'bg-gradient-to-r from-amber-500 to-orange-400',
    cardBorder: 'border-amber-500/30 dark:border-amber-500/20',
  },
};

const ToastCard: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  const isHoveredRef = useRef(false);
  const elapsedRef = useRef(0);
  const config = TOAST_CONFIG[toast.type];

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 220);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const stepMs = 25;
    const interval = setInterval(() => {
      if (!isHoveredRef.current) {
        elapsedRef.current += stepMs;
        const remaining = Math.max(0, 100 - (elapsedRef.current / toast.durationMs) * 100);
        setProgress(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          handleDismiss();
        }
      }
    }, stepMs);

    return () => clearInterval(interval);
  }, [toast.durationMs, handleDismiss]);

  return (
    <div
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
      }}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-xl border ${config.cardBorder} shadow-2xl p-4 flex items-start gap-3.5 transition-all duration-300 ${
        isExiting ? 'toast-exit' : 'toast-enter'
      }`}
      role="alert"
    >
      {/* Icône contextuelle */}
      <span className="mt-0.5">{config.icon}</span>

      {/* Contenu principal */}
      <div className="flex-1 space-y-1 pr-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.badgeBg}`}>
            {config.badgeText}
          </span>
        </div>
        <p className="text-xs font-semibold leading-relaxed tracking-normal text-slate-800 dark:text-zinc-100">
          {toast.message}
        </p>
      </div>

      {/* Bouton Fermer */}
      <button
        onClick={handleDismiss}
        className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors -mr-1 -mt-1"
        aria-label="Fermer"
      >
        <X size={14} />
      </button>

      {/* Barre de progression fluide en bas */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-zinc-800/60 overflow-hidden">
        <div
          className={`h-full ${config.barColor} transition-all duration-75 ease-linear`}
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
    // Durée adaptative : min 3.5s, 40ms par caractère additionnel, max 8s
    const durationMs = Math.max(3500, Math.min(8000, 3000 + message.length * 40));

    const newToast: ToastItem = {
      id,
      type,
      message,
      durationMs,
      createdAt: Date.now(),
    };

    setToasts((prev) => [...prev.slice(-3), newToast]); // Garde au maximum 4 toasts simultanés
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
    warning: (msg: string) => addToast('warning', msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-3 pointer-events-none max-w-sm w-full sm:max-w-md">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType['toast'] => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    };
  }
  return context.toast;
};
