'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Ticket, Calendar, User, ShoppingBag } from 'lucide-react';
import { clsx } from 'clsx';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  // Ne pas afficher la bottom nav sur les parcours d'admin ou scanner plein écran
  if (pathname.startsWith('/admin') || pathname.startsWith('/partner/scan')) {
    return null;
  }

  const navItems = [
    { label: 'Découvrir', href: '/', icon: Compass },
    { label: 'Explorer', href: '/explore', icon: Calendar },
    { label: 'Tickets', href: '/tickets', icon: Ticket },
    { label: 'Commandes', href: '/orders', icon: ShoppingBag },
    { label: 'Profil', href: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none safe-bottom">
      <nav className="pointer-events-auto flex items-center justify-between gap-1 px-3 py-2 rounded-full bg-slate-950/70 backdrop-blur-2xl border border-white/20 shadow-2xl max-w-md w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all duration-200 text-xs gap-1',
                isActive
                  ? 'bg-white text-slate-950 font-bold shadow-md scale-105'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
