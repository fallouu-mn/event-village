'use client';

import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { redirect, usePathname } from 'next/navigation';

/**
 * Espace partenaire : session exigée, rôle PARTENAIRE (ou ADMIN, SUPERADMIN ; contrôleur pour le scan).
 * Lot 9 bis (R7, B39, contrat 5.16) : une partenaire dont le dossier est EN_ATTENTE voit son tableau de bord (bandeau
 * « Compte en cours de vérification ») et son profil ; toute autre page de l'espace la ramène au tableau de bord. Le
 * serveur reste juge : création et publication refusées (PARTNER_NOT_VALIDATED).
 */
const PENDING_PARTNER_PATHS = ['/partner', '/partner/dashboard', '/partner/profile'];

function allowedWhilePending(pathname: string): boolean {
  return PENDING_PARTNER_PATHS.some((p) => pathname === p || (p !== '/partner' && pathname.startsWith(`${p}/`)));
}

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, partner, isLoading, isAuthenticated, hasAnyRole } = useAuth();

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

  if (partner?.status === 'EN_ATTENTE' && !hasAnyRole(['ADMIN', 'SUPERADMIN']) && !allowedWhilePending(pathname)) {
    redirect('/partner/dashboard');
  }

  return <>{children}</>;
}
