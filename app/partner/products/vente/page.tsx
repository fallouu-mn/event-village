import { SalesSettingsView } from '@/components/orders/partner/catalog/SalesSettingsView';

/**
 * Lot 12c : réglages de vente de chaque établissement (ouvert à la commande, modes, acompte, paiement à la remise,
 * préparation) et zones de livraison (liste de quartiers, ordre par glisser). Écritures par les routes serveur
 * (PATCH /api/partner/venues/[id]/orders, /api/partner/venues/[id]/zones).
 */
export const dynamic = 'force-dynamic';

export default async function SalesSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams;
    const venue = typeof sp.etablissement === 'string' && /^[0-9a-f-]{36}$/i.test(sp.etablissement) ? sp.etablissement : null;
    return <SalesSettingsView initialVenue={venue} />;
}
