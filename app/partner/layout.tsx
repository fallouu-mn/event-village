'use client';

import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { redirect } from 'next/navigation';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
            Chargement de l&apos;espace partenaire...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    redirect('/login');
  }

  if (profile.role !== 'PARTENAIRE' && profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN') {
    redirect('/');
  }

  return <>{children}</>;
}
