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
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 rounded-full border-[3px] border-brand border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
          <span className="text-sm font-medium text-fg-muted">
            Chargement de l’espace partenaire…
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
