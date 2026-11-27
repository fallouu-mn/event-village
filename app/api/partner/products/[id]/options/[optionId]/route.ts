import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { invalidBody, readJson } from '@/lib/orders/booking';
import { partnerOrdersContext } from '@/lib/orders/partner-route';
import { removeProductOption, saveProductOption } from '@/lib/products/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/partner/products/[id]/options/[optionId] { name?, price?, isActive?, sortOrder? } — lot 12c : modifie un
 * supplément (product_option_set) ; le prix déjà figé sur une ligne de commande ne change jamais.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; optionId: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'PATCH /api/partner/products/[id]/options/[optionId]');
        if (ctx.response) return ctx.response;
        const { id, optionId } = await params;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const r = await saveProductOption(ctx.user.id, id, optionId, body);
        return NextResponse.json({ success: true, option: r.option, reviewRequested: r.reviewRequested });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/products/[id]/options/[optionId]', error, { message: 'Supplément non enregistré. Réessayez.', code: 'OPTION_SAVE_FAILED', status: 500 });
    }
}

/** DELETE — retire un supplément (product_option_remove) ; les commandes passées gardent leur copie (nom et prix figés). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; optionId: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'DELETE /api/partner/products/[id]/options/[optionId]');
        if (ctx.response) return ctx.response;
        const { optionId } = await params;
        await removeProductOption(ctx.user.id, optionId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return apiFailure('DELETE /api/partner/products/[id]/options/[optionId]', error, { message: 'Supplément non retiré. Réessayez.', code: 'OPTION_DELETE_FAILED', status: 500 });
    }
}
