import { ProductReviewView } from '@/components/orders/admin/ProductReviewView';

/**
 * Lot 12c : page « Produits à vérifier » de l'administration (droit partners.validate ; la route le vérifie). Page à
 * part, hors de app/admin/services/page.tsx (réservée au lot 12d). `?produit=<id>` (lien de l'avis) met la carte du
 * produit en vue.
 */
export const dynamic = 'force-dynamic';

export default async function AdminProductsReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams;
    const focus = typeof sp.produit === 'string' && /^[0-9a-f-]{36}$/i.test(sp.produit) ? sp.produit : null;
    return <ProductReviewView focusId={focus} />;
}
