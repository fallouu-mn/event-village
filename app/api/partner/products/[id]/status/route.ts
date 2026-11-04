import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { ProductService } from '@/lib/products/product.service';
import { guardFeature } from '@/lib/features/flags';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/products/[id]/status');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const body = await request.json();
        const { status } = body;

        if (!status) {
            return NextResponse.json({ error: 'Le champ status est requis.' }, { status: 400 });
        }

        const product = await ProductService.setProductStatus(params.id, user.id, status);

        return NextResponse.json({ success: true, product });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur modification statut produit.' },
            { status: 400 }
        );
    }
}
