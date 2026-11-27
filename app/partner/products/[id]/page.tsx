import { ProductEditor } from '@/components/orders/partner/catalog/ProductEditor';

/**
 * Lot 12c : fiche d'un produit de la partenaire (modification, suppléments, portions du jour, aperçu « vue client »).
 * Produit absent, archivé ou d'une autre partenaire : « Cet élément n'est plus disponible » (GET /api/partner/products/[id]
 * répond 404). Lien des avis PRODUCT_REVIEW_DECIDED.
 */
export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ProductEditor key={id} productId={id} initialVenue={null} />;
}
