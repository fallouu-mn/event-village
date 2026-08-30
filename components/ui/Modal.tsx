'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'dark';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  variant = 'default',
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  const variantStyle = {
    default: 'bg-white dark:bg-[#18181C] text-slate-900 dark:text-white border border-slate-200/80 dark:border-zinc-800 shadow-2xl',
    glass: 'bg-slate-900/90 backdrop-blur-2xl border border-white/15 text-white shadow-2xl',
    dark: 'bg-[#18181C] border border-[#2E2E38] text-white shadow-2xl',
  }[variant];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Centering Wrapper */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
        {/* Modal Card with scrollable internal body */}
        <div
          className={`relative z-10 w-full ${maxWidthClass} my-auto rounded-3xl max-h-[92vh] flex flex-col overflow-hidden text-left shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 ${variantStyle}`}
        >
          {/* Pinned Header */}
          {(title || icon) && (
            <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0 bg-white/95 dark:bg-[#18181C]/95 backdrop-blur-md">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0 font-bold border border-orange-200/50 dark:border-orange-900/30">
                    {icon}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium leading-tight">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Fermer"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
