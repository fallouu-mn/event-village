import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { UUID_RE, orderNotFound, orderResponse } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/[id] — suivi d'une commande par son client (order_view) : état, heure de chaque étape, heure estimée
 * de remise, lignes aux prix figés, montants, code envoyé ou non (jamais le code lui-même). Commande d'un autre client :
 * « Commande introuvable » (404). Sans interrupteur, comme le suivi d'un paiement : le client suit sa commande même si
 * le service vient d'être fermé.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_view', { p: { order_id: id, actor_id: session.user.id, as: 'CLIENT' } });
        if (error) throw new Error(`order_view : ${error.message}`);
        if (!data) return orderNotFound();
        return NextResponse.json({ success: true, order: orderResponse(data as Record<string, unknown>) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure('GET /api/orders/[id]', err, { message: 'Commande momentanément indisponible.', code: 'ORDER_UNAVAILABLE', status: 500 });
    }
}
