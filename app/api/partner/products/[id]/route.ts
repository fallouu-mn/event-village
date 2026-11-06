import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { ProductService } from '@/lib/products/product.service';
import { guardFeature } from '@/lib/features/flags';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/products/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const product = await ProductService.getProductById(params.id);
        return NextResponse.json({ success: true, product });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/products/[id]', error, { message: 'Produit momentanément indisponible.', code: 'PRODUCT_UNAVAILABLE', status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/products/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const body = await request.json();
        const product = await ProductService.updateProduct(params.id, user.id, body);

        return NextResponse.json({ success: true, product });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/products/[id]', error, { message: 'Produit non enregistré. Réessayez.', code: 'PRODUCT_SAVE_FAILED', status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/products/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        await ProductService.deleteProduct(params.id, user.id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return apiFailure('DELETE /api/partner/products/[id]', error, { message: 'Produit non supprimé. Réessayez.', code: 'PRODUCT_DELETE_FAILED', status: 400 });
    }
}
