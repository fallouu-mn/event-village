import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { ProductService } from '@/lib/products/product.service';
import { guardFeature } from '@/lib/features/flags';

export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/products');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || undefined;
        const category_id = searchParams.get('category_id') || undefined;
        const is_daily_special_param = searchParams.get('is_daily_special');
        const is_daily_special = is_daily_special_param ? is_daily_special_param === 'true' : undefined;

        const products = await ProductService.getPartnerProducts(user.id, { status, category_id, is_daily_special });
        return NextResponse.json({ success: true, products });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/products', error, { message: 'Produits momentanément indisponibles.', code: 'PRODUCTS_UNAVAILABLE', status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/products');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Seul un partenaire peut créer un produit.' }, { status: 403 });
        }

        const body = await request.json();
        const product = await ProductService.createProduct(user.id, body);

        return NextResponse.json({ success: true, product }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/products', error, { message: 'Produit non enregistré. Réessayez.', code: 'PRODUCT_SAVE_FAILED', status: 400 });
    }
}
