import { CatalogView } from '@/components/orders/partner/catalog/CatalogView';

/**
 * Lot 12c : catalogue de la partenaire (« Ma carte »), un établissement à la fois (`?etablissement=<id>`). Lecture et
 * écritures par les routes serveur (GET /api/partner/catalog, produits, disponibilité) ; service fermé : 404 par le layout.
 */
export const dynamic = 'force-dynamic';

export default async function PartnerProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams;
    const venue = typeof sp.etablissement === 'string' && /^[0-9a-f-]{36}$/i.test(sp.etablissement) ? sp.etablissement : null;
    return <CatalogView initialVenue={venue} />;
}
