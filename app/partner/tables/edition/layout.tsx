import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getFeatureFlags } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * Lot 7 (7.3, D55, D56) : garde de l'interrupteur SUPERADMIN features.tables_enabled (création, modification, plan de salle et fermetures d'un établissement). Service fermé : 404 propre
 * (app/not-found.tsx), sans supprimer ni la page ni les données. Interrupteurs lus en base à chaque requête.
 * Lot 11b (décision du 20/11) : la garde ne couvre plus que l'édition ; la liste, la fiche (planning du jour), les
 * réservations et les recettes de l'établissement restent ouvertes service fermé (liens des notifications).
 */
export default async function FeatureGuardLayout({ children }: { children: ReactNode }) {
    const flags = await getFeatureFlags();
    if (!flags.tables) notFound();
    return <>{children}</>;
}
