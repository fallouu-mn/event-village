import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { invalidBody, readJson } from '@/lib/orders/booking';
import { NO_STORE, partnerOrdersContext } from '@/lib/orders/partner-route';
import { ProductService } from '@/lib/products/product.service';
import { saveCategory } from '@/lib/products/catalog.service';

export const dynamic = 'force-dynamic';

/** GET /api/partner/products/categories — lot 12c : catégories de la carte de la partenaire de la session. */
export async function GET(request: NextRequest) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), '/api/partner/products/categories');
        if (ctx.response) return ctx.response;
        const categories = await ProductService.getPartnerCategories(ctx.user.id);
        return NextResponse.json({ success: true, categories: categories.map((c) => ({ id: c.id, name: c.name })) }, { headers: NO_STORE });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/products/categories', error, { message: 'Catégories momentanément indisponibles.', code: 'CATEGORIES_UNAVAILABLE', status: 500 });
    }
}

/**
 * POST /api/partner/products/categories { name } — lot 12c : nouvelle catégorie de la carte (« Plats », « Boissons »…),
 * par order_category_save (contre-vérification T5 : création en base, 2 à 60 caractères, 50 au plus, nom déjà pris : la
 * catégorie existante). La partenaire est celle de la session ; fiche SUSPENDU : refus (garde de la fiche et base).
 */
export async function POST(request: NextRequest) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'POST /api/partner/products/categories');
        if (ctx.response) return ctx.response;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const r = await saveCategory(ctx.user.id, null, body.name);
        return NextResponse.json({ success: true, category: r.category }, { status: r.existing ? 200 : 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/products/categories', error, { message: 'Catégorie non enregistrée. Réessayez.', code: 'CATEGORY_SAVE_FAILED', status: 500 });
    }
}
