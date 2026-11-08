import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { OrderService } from '@/lib/orders/order.service';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/orders/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        // Lot 9 (A32) : absence ou uuid invalide : 404 ; panne : journal et 500.
        const notFound = () => NextResponse.json({ error: 'Commande introuvable.', code: 'ORDER_NOT_FOUND' }, { status: 404 });
        const { id } = await params;
        if (!UUID_RE.test(id)) return notFound();

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
            .maybeSingle();

        if (error) throw error;
        if (!order) return notFound();

        return NextResponse.json({ success: true, order });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/orders/[id]', error, { message: 'Commande momentanément indisponible.', code: 'ORDER_UNAVAILABLE', status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/orders/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
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
        return apiFailure('PATCH /api/partner/orders/[id]', error, { message: 'Commande non enregistrée. Réessayez.', code: 'ORDER_SAVE_FAILED', status: 400 });
    }
}
