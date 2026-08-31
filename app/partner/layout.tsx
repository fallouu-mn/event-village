'use client';

import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { redirect, usePathname } from 'next/navigation';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, isLoading, isAuthenticated } = useAuth();

  // 1. /partner/register est une page publique d'inscription / candidature
  if (pathname === '/partner/register' || pathname.startsWith('/partner/register/')) {
    return <>{children}</>;
  }

  // 2. État de chargement du profil
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

  // 3. Utilisateur non authentifié -> redirection vers /login
  if (!isAuthenticated || !profile) {
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // 4. Scanner / Composteur QR Code accessible aux Contrôleurs, Partenaires et Admins
  if (pathname === '/partner/scan' || pathname.startsWith('/partner/scan/')) {
    if (
      profile.role !== 'CONTROLEUR' &&
      profile.role !== 'PARTENAIRE' &&
      profile.role !== 'ADMIN' &&
      profile.role !== 'SUPERADMIN'
    ) {
      redirect('/');
    }
    return <>{children}</>;
  }

  // 5. Reste de l'Espace Partenaire réservé aux rôles PARTENAIRE, ADMIN, SUPERADMIN
  if (profile.role !== 'PARTENAIRE' && profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN') {
    redirect('/');
  }

  return <>{children}</>;
}
