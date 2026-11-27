import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { partnerOrdersContext } from '@/lib/orders/partner-route';
import { ProductService } from '@/lib/products/product.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/products/[id]/restore — contre-vérification du lot 12c (point 8) : « Remettre en vente » un produit
 * archivé (order_product_save, restore) : il revient sur la carte, revu par la liste des mots (un mot nouveau le met
 * « à vérifier »). Fiche SUSPENDU : refus (garde de la fiche).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'POST /api/partner/products/[id]/restore');
        if (ctx.response) return ctx.response;
        const { id } = await params;
        const product = await ProductService.restoreProduct(id, ctx.user.id);
        return NextResponse.json({
            success: true,
            product: { id: product.id, name: product.name, underReview: product.review_state === 'A_VERIFIER' },
            message: product.review_state === 'A_VERIFIER'
                ? 'Produit remis sur votre carte : Event Village le vérifie avant la vente en ligne.'
                : 'Produit remis sur votre carte.',
        });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/products/[id]/restore', error, { message: 'Produit non remis en vente. Réessayez.', code: 'PRODUCT_RESTORE_FAILED', status: 500 });
    }
}
