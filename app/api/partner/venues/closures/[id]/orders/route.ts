import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

const closureNotFound = (): NextResponse =>
    NextResponse.json({ success: false, error: 'Fermeture introuvable.', code: 'CLOSURE_NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

/**
 * Lot 12d — commandes déjà prévues pendant une fermeture exceptionnelle (rien d'automatique).
 * GET /api/partner/venues/closures/[id]/orders — commandes transmises et ouvertes dont l'heure, préparation comprise,
 * touche la fermeture, gardées ou non (order_closure_orders, propriétaire seulement).
 * POST /api/partner/venues/closures/[id]/orders { orderId } — « Garder » la commande (order_closure_keep). « Annuler et
 * rembourser » passe par PATCH /api/partner/orders/[id] { action: ANNULER, reason }.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('orders', 'GET /api/partner/venues/closures/[id]/orders');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        if (!UUID_RE.test(id)) return closureNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_closure_orders', { p: { actor_id: session.user.id, closure_id: id } });
        if (error) throw new Error(`order_closure_orders : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Commandes momentanément indisponibles.');
        return NextResponse.json({ success: true, closure: r.closure, orders: r.orders ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/venues/closures/[id]/orders', error, { message: 'Commandes momentanément indisponibles.', code: 'CLOSURE_ORDERS_UNAVAILABLE', status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('orders', 'POST /api/partner/venues/closures/[id]/orders');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        if (!UUID_RE.test(id)) return closureNotFound();
        const body = await readJson(request);
        if (!body || typeof body.orderId !== 'string' || !UUID_RE.test(body.orderId)) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_closure_keep', { p: { actor_id: session.user.id, closure_id: id, order_id: body.orderId } });
        if (error) throw new Error(`order_closure_keep : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Choix non enregistré.');
        return NextResponse.json({ success: true, orderId: r.order_id, kept: true, message: 'Commande gardée : elle sera préparée malgré la fermeture.' });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/venues/closures/[id]/orders', error, { message: 'Choix non enregistré. Réessayez.', code: 'CLOSURE_KEEP_FAILED', status: 500 });
    }
}
