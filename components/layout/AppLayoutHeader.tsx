'use client';

import React from 'react';
import Link from 'next/link';
import { Search, LogIn, LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/components/providers/AuthProvider';

export interface AppLayoutHeaderProps {
  isMobileMenuOpen?: boolean;
  onMenuToggle?: () => void;
}

export function AppLayoutHeader({ isMobileMenuOpen = false, onMenuToggle }: AppLayoutHeaderProps) {
  const { user, profile, isAuthenticated, signOut } = useAuth();

  const isUserLoggedIn = isAuthenticated || !!user;
  const userFirst = profile?.first_name || (user?.user_metadata?.first_name as string) || '';
  const userLast = profile?.last_name || (user?.user_metadata?.last_name as string) || '';
  const initials =
    userFirst || userLast
      ? `${userFirst[0] || 'U'}${userLast[0] || 'E'}`.toUpperCase()
      : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : 'EV';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#16161A] px-4 lg:px-8 py-3 flex items-center justify-between gap-4 shadow-subtle">
      {/* Left: Hamburger + Logo (Mobile) */}
      <div className="flex items-center gap-1.5">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
        <div className="lg:hidden">
          <Logo variant="auto" />
        </div>
      </div>

      {/* Centre: Recherche Rapide (Desktop + Tablette) */}
      <div className="hidden sm:flex items-center flex-1 max-w-lg">
        <Link
          href="/explore"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors flex-1 border border-slate-200/60 dark:border-zinc-700/60"
        >
          <Search size={14} />
          <span>Rechercher un événement, concert, restaurant...</span>
        </Link>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBell />

        <div className="lg:hidden">
          <ThemeToggle />
        </div>

        {isUserLoggedIn ? (
          <div className="lg:hidden flex items-center gap-2">
            <Link href="/profile">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50 shadow-xs">
                {initials}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              title="Déconnexion"
              className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-red-500 transition-colors"
              aria-label="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link href="/login" className="lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF5722] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50">
              <LogIn size={16} />
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}

export default AppLayoutHeader;
