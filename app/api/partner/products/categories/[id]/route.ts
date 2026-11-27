import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { invalidBody, readJson } from '@/lib/orders/booking';
import { partnerOrdersContext } from '@/lib/orders/partner-route';
import { saveCategory } from '@/lib/products/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/partner/products/categories/[id] { name } — contre-vérification du lot 12c (T5) : renommer une catégorie
 * (order_category_save) ; un nom avec un mot de la liste met tous ses produits « à vérifier ». Fiche SUSPENDU : refus.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'PATCH /api/partner/products/categories/[id]');
        if (ctx.response) return ctx.response;
        const { id } = await params;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const r = await saveCategory(ctx.user.id, id, body.name);
        return NextResponse.json({ success: true, category: r.category, flagged: r.flagged });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/products/categories/[id]', error, { message: 'Catégorie non enregistrée. Réessayez.', code: 'CATEGORY_SAVE_FAILED', status: 500 });
    }
}
