import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getFeatureFlags } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * Lot 7 (7.3, D55, D56) : garde de l'interrupteur SUPERADMIN features.halls_enabled (recherche et fiche des salles de fête). Service fermé : 404 propre
 * (app/not-found.tsx), sans supprimer ni la page ni les données. Interrupteurs lus en base à chaque requête.
 * Lot 11b (décision du 20/11) : garde déplacée dans le groupe (catalogue) : « Mes réservations » et le détail
 * (app/halls/reservations) restent ouverts service fermé ; le lien d'une notification ne mène jamais à une page introuvable.
 */
export default async function FeatureGuardLayout({ children }: { children: ReactNode }) {
    const flags = await getFeatureFlags();
    if (!flags.halls) notFound();
    return <>{children}</>;
}
