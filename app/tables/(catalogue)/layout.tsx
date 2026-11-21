import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getFeatureFlags } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * Lot 7 (7.3, D55, D56) : garde de l'interrupteur SUPERADMIN features.tables_enabled (recherche et fiche des établissements). Service fermé : 404 propre
 * (app/not-found.tsx), sans supprimer ni la page ni les données. Interrupteurs lus en base à chaque requête.
 * Lot 11b : « Mes réservations » de tables et le détail (app/tables/reservations) sont hors de ce groupe : ouverts
 * service fermé (décision du 20/11 : le lien d'une notification ne mène jamais à une page introuvable).
 */
export default async function FeatureGuardLayout({ children }: { children: ReactNode }) {
    const flags = await getFeatureFlags();
    if (!flags.tables) notFound();
    return <>{children}</>;
}
