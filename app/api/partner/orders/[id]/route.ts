import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { OrderService } from '@/lib/orders/order.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const { id } = await params;
        const partnerId = await OrderService.resolvePartnerId(user.id);
        const supabase = getServiceRoleClient();

        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                client:client_id (first_name, last_name, phone),
                order_items (id, product_id, product_name, quantity, unit_price, total_price, notes)
            `)
            .eq('id', id)
            .eq('partner_id', partnerId)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, order });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur récupération commande.' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { order_status } = body;

        if (!order_status) {
            return NextResponse.json({ error: 'Le champ order_status est requis.' }, { status: 400 });
        }

        const order = await OrderService.updateOrderStatus(id, user.id, order_status);
        return NextResponse.json({ success: true, order });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur modification commande.' },
            { status: 400 }
        );
    }
}
