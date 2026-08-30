import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { OrderService } from '@/lib/orders/order.service';

export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || undefined;

        const partnerId = await OrderService.resolvePartnerId(user.id);
        const supabase = getServiceRoleClient();

        let query = supabase
            .from('orders')
            .select(`
                *,
                client:client_id (first_name, last_name, phone),
                order_items (id, product_id, product_name, quantity, unit_price, total_price, notes)
            `)
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('order_status', status);
        }

        const { data: orders, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true, orders: orders || [] });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur récupération commandes.' },
            { status: 500 }
        );
    }
}
