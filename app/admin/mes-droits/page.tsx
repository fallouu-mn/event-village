'use client';

/**
 * /admin/mes-droits — finition 3b (E-34) : « Mes droits ». Ce que le compte peut faire et ne pas faire, en phrases simples,
 * d'après les droits servis par /api/auth/me. Le menu et cette page ne sont qu'un confort : chaque page et chaque route
 * refusent toujours côté serveur sans le droit.
 */

import React from 'react';
import { CheckCircle2, KeyRound, MinusCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import { ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { permissionDescription, permissionLabel } from '@/lib/admin/permission-labels';

/** Droits montrés : tous les droits attribuables (lib/admin/permissions.ts). */
const SHOWN: readonly string[] = ADMIN_PERMISSIONS;

function RightsList({ title, items, granted }: { title: string; items: readonly string[]; granted: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`droits-${granted ? 'oui' : 'non'}`} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <h2 id={`droits-${granted ? 'oui' : 'non'}`} className="text-lg font-bold tracking-tight text-fg">{title}</h2>
      <ul className="flex flex-col divide-y divide-border">
        {items.map((p) => (
          <li key={p} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {granted
              ? <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-success-fg" aria-hidden="true" />
              : <MinusCircle size={20} className="mt-0.5 flex-shrink-0 text-fg-muted" aria-hidden="true" />}
            <div className="min-w-0">
              <p className={granted ? 'text-base font-semibold text-fg' : 'text-base font-semibold text-fg-muted'}>{permissionLabel(p)}</p>
              <p className="text-sm leading-relaxed text-fg-muted">{permissionDescription(p)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function MyRightsPage() {
  const { isLoading, hasPermission, hasRole } = useAuth();
  const isSuperadmin = hasRole('SUPERADMIN');
  const granted = SHOWN.filter((p) => hasPermission(p));
  const missing = SHOWN.filter((p) => !hasPermission(p));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-16">
      <PageHeader
        title="Mes droits"
        description="Voici ce que votre compte peut faire. Pour un droit de plus, demandez-le au Superadmin."
        back={{ href: '/admin/dashboard', label: 'Accueil' }}
      />

      {isLoading ? (
        <div role="status" aria-busy="true" aria-label="Chargement de vos droits" className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : isSuperadmin ? (
        <StatusBanner tone="info" icon={<KeyRound size={20} aria-hidden="true" />} title="Superadmin">
          Vous avez tous les droits, dont les réglages de la plateforme, le journal d’audit et la création des administrateurs.
        </StatusBanner>
      ) : (
        <>
          {granted.length === 0 && (
            <StatusBanner tone="warning" icon={<KeyRound size={20} aria-hidden="true" />} title="Aucun droit pour le moment">
              Vous n’avez encore aucun droit : demandez-les au super-administrateur.
            </StatusBanner>
          )}
          <RightsList title="Vous pouvez" items={granted} granted />
          <RightsList title="Vous ne pouvez pas" items={missing} granted={false} />
        </>
      )}
    </div>
  );
}
