import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'dark' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
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
  const baseStyles =
    'inline-flex items-center justify-center font-bold tracking-tight transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] focus-visible:ring-offset-2';

  const variants = {
    primary:
      'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] hover:from-[#FF5722] hover:to-[#F02D58] text-white shadow-md hover:shadow-lg shadow-[#FF5722]/25 hover:shadow-[#FF5722]/40 border-0',
    secondary:
      'bg-slate-100 dark:bg-zinc-800/90 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700/90 border border-slate-200/80 dark:border-zinc-700/80 shadow-sm',
    glass:
      'bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md text-slate-900 dark:text-white border border-slate-200/60 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 shadow-sm',
    dark:
      'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 shadow-sm',
    outline:
      'border-2 border-[#FF5722] text-[#FF5722] bg-transparent hover:bg-[#FF5722]/10 dark:hover:bg-[#FF5722]/20',
    ghost:
      'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white',
    danger:
      'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/20 font-bold',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 h-8 gap-1.5 rounded-lg',
    md: 'text-sm px-4 py-2.5 h-10 sm:h-11 gap-2 rounded-xl',
    lg: 'text-base px-6 py-3.5 h-12 sm:h-13 gap-2.5 font-bold rounded-2xl',
    icon: 'h-10 w-10 p-0 rounded-xl',
  };

  return (
    <button
      className={twMerge(
        clsx(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : (
        leftIcon && <span className="inline-flex items-center flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="inline-flex items-center ml-1 flex-shrink-0">{rightIcon}</span>
      )}
    </button>
  );
};
