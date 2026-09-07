'use client';

import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { redirect, usePathname } from 'next/navigation';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, isLoading, isAuthenticated, hasRole, hasAnyRole } = useAuth();

  if (pathname === '/partner/register' || pathname.startsWith('/partner/register/')) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#FF5722] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
            Chargement de l&apos;espace partenaire...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  if (pathname === '/partner/scan' || pathname.startsWith('/partner/scan/')) {
    if (!hasAnyRole(['CONTROLEUR', 'PARTENAIRE', 'ADMIN', 'SUPERADMIN'])) {
      redirect('/');
    }
    return <>{children}</>;
  }

  if (!hasAnyRole(['PARTENAIRE', 'ADMIN', 'SUPERADMIN'])) {
    redirect('/');
  }

  return <>{children}</>;
}
