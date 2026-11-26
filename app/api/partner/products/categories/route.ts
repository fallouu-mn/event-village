import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { invalidBody, readJson } from '@/lib/orders/booking';
import { NO_STORE, partnerOrdersContext } from '@/lib/orders/partner-route';
import { ProductService } from '@/lib/products/product.service';

export const dynamic = 'force-dynamic';

/** GET /api/partner/products/categories — lot 12c : catégories de la carte de la partenaire de la session. */
export async function GET(request: NextRequest) {
    try {
        const ctx = await partnerOrdersContext(request, '/api/partner/products/categories');
        if (ctx.response) return ctx.response;
        const categories = await ProductService.getPartnerCategories(ctx.user.id);
        return NextResponse.json({ success: true, categories: categories.map((c) => ({ id: c.id, name: c.name })) }, { headers: NO_STORE });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/products/categories', error, { message: 'Catégories momentanément indisponibles.', code: 'CATEGORIES_UNAVAILABLE', status: 500 });
    }
}

/**
 * POST /api/partner/products/categories { name } — lot 12c : nouvelle catégorie de la carte (« Plats », « Boissons »…),
 * de 2 à 60 caractères, 50 au plus. La partenaire est celle de la session ; fiche SUSPENDU : refus (garde de la fiche).
 */
export async function POST(request: NextRequest) {
    try {
        const ctx = await partnerOrdersContext(request, 'POST /api/partner/products/categories');
        if (ctx.response) return ctx.response;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const name = typeof body.name === 'string' ? body.name.replace(/[\u0000-\u001f]/g, ' ').trim().replace(/\s+/g, ' ') : '';
        if (name.length < 2 || name.length > 60) {
            return NextResponse.json({ success: false, error: 'Le nom de la catégorie compte de 2 à 60 caractères.', code: 'INVALID_CATEGORY' }, { status: 400 });
        }
        const existing = await ProductService.getPartnerCategories(ctx.user.id);
        if (existing.length >= 50) {
            return NextResponse.json({ success: false, error: '50 catégories au plus.', code: 'TOO_MANY_CATEGORIES' }, { status: 429 });
        }
        const same = existing.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
        if (same) return NextResponse.json({ success: true, category: { id: same.id, name: same.name } });
        const created = await ProductService.createCategory(ctx.user.id, { name, sort_order: existing.length });
        return NextResponse.json({ success: true, category: { id: created.id, name: created.name } }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/products/categories', error, { message: 'Catégorie non enregistrée. Réessayez.', code: 'CATEGORY_SAVE_FAILED', status: 500 });
    }
}
