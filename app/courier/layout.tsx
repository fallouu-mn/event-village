import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getFeatureFlags } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * Lot 12d : garde de l'interrupteur SUPERADMIN features.orders_enabled pour l'espace du livreur (livraisons, invitations),
 * comme app/partner/orders/layout.tsx. Service fermé : 404 propre (app/not-found.tsx), sans supprimer ni la page ni les
 * données. Interrupteurs lus en base à chaque requête.
 */
export default async function CourierFeatureGuardLayout({ children }: { children: ReactNode }) {
    const flags = await getFeatureFlags();
    if (!flags.orders) notFound();
    return <>{children}</>;
}
