import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { ProductService } from '@/lib/products/product.service';

export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
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
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur récupération produits.' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Seul un partenaire peut créer un produit.' }, { status: 403 });
        }

        const body = await request.json();
        const product = await ProductService.createProduct(user.id, body);

        return NextResponse.json({ success: true, product }, { status: 201 });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur création produit.' },
            { status: 400 }
        );
    }
}
