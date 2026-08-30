import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { ProductService } from '@/lib/products/product.service';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const product = await ProductService.getProductById(params.id);
        return NextResponse.json({ success: true, product });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur récupération produit.' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const body = await request.json();
        const product = await ProductService.updateProduct(params.id, user.id, body);

        return NextResponse.json({ success: true, product });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur modification produit.' },
            { status: 400 }
        );
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        await ProductService.deleteProduct(params.id, user.id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur suppression produit.' },
            { status: 400 }
        );
    }
}
