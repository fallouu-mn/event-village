import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { partnerOrderView } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/orders?filter=open|closed — commandes des établissements de la partenaire de la session, lues par
 * order_partner_list (fonction en base ; aucune lecture REST des commandes par la partenaire). Jamais une commande pas
 * encore payée ; adresse et téléphone du client seulement tant qu'ils ne sont pas masqués (7 jours après la remise).
 * Avant le lot 12a : lecture directe de toutes les commandes, avec le nom complet et le téléphone du client, sans limite
 * de durée, commandes non payées comprises.
 * Fiche SUSPENDU : la lecture reste possible (lecture seule) ; toute action est refusée en base.
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', '/api/partner/orders');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        const filter = new URL(request.url).searchParams.get('filter') === 'closed' ? 'CLOSED' : 'OPEN';
        const { data, error } = await getServiceRoleClient().rpc('order_partner_list', { p: { actor_id: user.id, filter } });
        if (error) throw new Error(`order_partner_list : ${error.message}`);
        const list = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
        // Lot 12c : coordonnées du client seulement pendant la commande ouverte (partnerOrderView)
        return NextResponse.json({ success: true, orders: list.map(partnerOrderView) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/orders', error, { message: 'Commandes momentanément indisponibles.', code: 'ORDERS_UNAVAILABLE', status: 500 });
    }
}
