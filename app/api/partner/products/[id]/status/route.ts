import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { ProductService } from '@/lib/products/product.service';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
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
