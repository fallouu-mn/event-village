import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'glass' | 'dark';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, variant = 'glass', className, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-white/80 ml-1">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-white/60 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={twMerge(
              clsx(
                'w-full h-11 px-4 text-sm rounded-2xl outline-none transition-all placeholder:text-white/40 text-white',
                variant === 'glass' && 'bg-white/15 backdrop-blur-md border border-white/25 focus:border-white/60 focus:bg-white/20',
                variant === 'dark' && 'bg-[#1e1e24] border border-[#2e2e38] focus:border-[#D4E157] focus:bg-[#25252d]',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                error && 'border-red-400 focus:border-red-500',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-white/60 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-red-300 ml-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
