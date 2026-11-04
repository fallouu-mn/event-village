import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getFeatureFlags } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * Lot 7 (7.3, D55, D56) : garde de l'interrupteur SUPERADMIN features.tables_enabled (réservation de tables). Service fermé : 404 propre
 * (app/not-found.tsx), sans supprimer ni la page ni les données. Interrupteurs lus en base à chaque requête.
 */
export default async function FeatureGuardLayout({ children }: { children: ReactNode }) {
    const flags = await getFeatureFlags();
    if (!flags.tables) notFound();
    return <>{children}</>;
}
