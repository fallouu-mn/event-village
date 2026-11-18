'use client';

/**
 * /admin/securite — finition 3d (point 2) : « Sécurité du compte » du SUPERADMIN.
 *  - Codes de secours (BackupCodesPanel) : nombre restant, création ou remplacement avec le mot de passe et le code
 *    administrateur, codes montrés une seule fois. `?creer=1` (depuis la proposition faite après la double vérification) :
 *    la création se lance d'elle-même s'il n'en a aucun.
 *  - Mon numéro de téléphone (PhoneChangeFlow) : changé seulement avec la preuve d'un code reçu au nouveau numéro.
 *    `?numero=1` (après « J'ai perdu mon téléphone » et un code de secours) : un bandeau l'invite à le faire tout de suite.
 * Un ADMIN n'a ni codes de secours ni changement de son numéro : la page lui dit de s'adresser au Superadmin. Le serveur
 * refuse de toute façon (routes /api/admin/security/*).
 */

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import { BackupCodesPanel } from '@/components/admin/BackupCodesPanel';
import { PhoneChangeFlow } from '@/components/admin/PhoneChangeFlow';

function flagOf(name: string): boolean {
  try {
    return new URLSearchParams(window.location.search).get(name) === '1';
  } catch {
    return false;
  }
}

export default function SecurityPage() {
  const { isLoading, hasRole, user, refreshProfile } = useAuth();
  const isSuperadmin = hasRole('SUPERADMIN');
  const [flags, setFlags] = useState<{ creer: boolean; numero: boolean }>({ creer: false, numero: false });

  useEffect(() => {
    setFlags({ creer: flagOf('creer'), numero: flagOf('numero') });
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-16">
      <PageHeader
        title="Sécurité du compte"
        description="Vos codes de secours et votre numéro de téléphone, pour ne jamais perdre l’accès à l’administration."
        back={{ href: '/admin/dashboard', label: 'Accueil' }}
      />

      {isLoading ? (
        <div role="status" aria-busy="true" aria-label="Chargement de la sécurité du compte" className="flex flex-col gap-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : !isSuperadmin ? (
        <StatusBanner tone="info" icon={<ShieldAlert size={20} aria-hidden="true" />} title="Réservé au Superadmin">
          Si vous perdez votre téléphone, demandez au Superadmin de changer votre numéro : il vous dictera la marche à suivre.
        </StatusBanner>
      ) : (
        <>
          {flags.numero && (
            <StatusBanner tone="warning" announce="alert" title="Code de secours accepté">
              Changez maintenant votre numéro de téléphone, plus bas : un code part au nouveau numéro. Pensez aussi à remplacer vos codes de secours.
            </StatusBanner>
          )}
          <BackupCodesPanel autoStart={flags.creer} />
          <section aria-labelledby="numero-titre" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true"><Smartphone size={20} /></span>
              <div className="min-w-0 space-y-1">
                <h2 id="numero-titre" className="text-lg font-bold tracking-tight text-foreground-strong">Mon numéro de téléphone</h2>
                <p className="text-sm text-muted-foreground">
                  Numéro actuel : <span className="font-semibold text-foreground-strong tabular-nums">{user?.phone || 'non renseigné'}</span>. Le code administrateur arrive à ce numéro.
                </p>
              </div>
            </div>
            <PhoneChangeFlow target={{ kind: 'SELF' }} onDone={() => { void refreshProfile(); }} />
          </section>
        </>
      )}
    </div>
  );
}
