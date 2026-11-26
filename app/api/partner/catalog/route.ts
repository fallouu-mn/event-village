import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { NO_STORE, partnerOrdersContext } from '@/lib/orders/partner-route';
import { readPartnerCatalog } from '@/lib/products/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/catalog — lot 12c : catalogue de la partenaire de la session, en une lecture serveur : établissements
 * (réglages de vente, zones de livraison actives ou non, tables pour la commande sur place), catégories, produits non
 * archivés (suppléments, portions du jour, case « réglementé », décision de l'administration, état « à vérifier » et mots
 * trouvés). Fiche SUSPENDU : lecture permise (lecture seule) ; l'état de la fiche est rendu pour l'écran.
 */
export async function GET(request: NextRequest) {
    try {
        const ctx = await partnerOrdersContext(request, '/api/partner/catalog');
        if (ctx.response) return ctx.response;
        const catalog = await readPartnerCatalog(ctx.user.id);
        return NextResponse.json({ success: true, ...catalog }, { headers: NO_STORE });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/catalog', error, { message: 'Catalogue momentanément indisponible.', code: 'CATALOG_UNAVAILABLE', status: 500 });
    }
}
