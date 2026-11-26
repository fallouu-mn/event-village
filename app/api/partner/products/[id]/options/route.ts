import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { invalidBody, readJson } from '@/lib/orders/booking';
import { partnerOrdersContext } from '@/lib/orders/partner-route';
import { saveProductOption } from '@/lib/products/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/products/[id]/options { name, price, isActive? } — lot 12c : ajoute un supplément à un produit de la
 * partenaire (product_option_set : fiche VALIDE, prix entier de 0 à 1 000 000 F CFA, 20 au plus). Un nom avec un mot de
 * la liste met le produit « à vérifier ». Fiche SUSPENDU : refus (lecture seule).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await partnerOrdersContext(request, 'POST /api/partner/products/[id]/options');
        if (ctx.response) return ctx.response;
        const { id } = await params;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const r = await saveProductOption(ctx.user.id, id, null, body);
        return NextResponse.json({ success: true, option: r.option, reviewRequested: r.reviewRequested }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/products/[id]/options', error, { message: 'Supplément non enregistré. Réessayez.', code: 'OPTION_SAVE_FAILED', status: 500 });
    }
}
