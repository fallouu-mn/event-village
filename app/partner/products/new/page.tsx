import { ProductEditor } from '@/components/orders/partner/catalog/ProductEditor';

/**
 * Lot 12c : nouveau produit (établissement choisi ici, jamais changé ensuite ; `?etablissement=<id>` le présélectionne).
 * Enregistré par POST /api/partner/products (order_product_save en base), puis la fiche du produit pour ses suppléments
 * et ses portions du jour.
 */
export const dynamic = 'force-dynamic';

export default async function NewProductPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams;
    const venue = typeof sp.etablissement === 'string' && /^[0-9a-f-]{36}$/i.test(sp.etablissement) ? sp.etablissement : null;
    return <ProductEditor productId={null} initialVenue={venue} />;
}
