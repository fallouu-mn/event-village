import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getFeatureFlags } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * Lot 7 (7.3, D55, D56) : garde des interrupteurs SUPERADMIN des services. La page des commandes et
 * réservations répond 404 propre (app/not-found.tsx) quand les trois interrupteurs (features.halls_enabled,
 * features.tables_enabled, features.orders_enabled) sont fermés ; sinon la page n'affiche que les onglets
 * ouverts. Ni la page ni les données ne sont supprimées. Interrupteurs lus en base à chaque requête.
 */
export default async function FeatureGuardLayout({ children }: { children: ReactNode }) {
    const flags = await getFeatureFlags();
    if (!flags.halls && !flags.tables && !flags.orders) notFound();
    return <>{children}</>;
}
