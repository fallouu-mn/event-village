import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderNotFound, orderRefusal, orderResponse, orderStateLabel, readJson, sendOrderRefunds } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/orders/[id] — une commande d'un établissement de la partenaire (order_view, fonction en base).
 * Lot 9 (A32) : absence ou uuid invalide : 404 ; panne : journal et 500.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_view', { p: { order_id: id, actor_id: user.id, as: 'PARTNER' } });
        if (error) throw new Error(`order_view : ${error.message}`);
        if (!data) return orderNotFound();
        return NextResponse.json({ success: true, order: orderResponse(data as Record<string, unknown>) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/orders/[id]', error, { message: 'Commande momentanément indisponible.', code: 'ORDER_UNAVAILABLE', status: 500 });
    }
}

const ACTIONS = new Set(['ACCEPTER', 'REFUSER', 'PREPARER', 'PRETE', 'CONFIER', 'EN_ROUTE', 'REMETTRE', 'ANNULER']);

/**
 * PATCH /api/partner/orders/[id] { action, reason?, minutes?, courierId?, code?, balanceReceived? }
 * Lot 12a : chaque étape par order_partner_action (fonction en base, verrou de l'établissement, journal, historique,
 * avis) : ACCEPTER (minutes de préparation : heure estimée), REFUSER (motif, client remboursé), PREPARER, PRETE (retrait :
 * code envoyé au client), CONFIER (livreur ACTIF de son équipe), EN_ROUTE (minutes de trajet ; code envoyé au client),
 * REMETTRE (code donné par le client ; solde reçu sur place), ANNULER (motif, tout rendu). Fiche SUSPENDU : refus (lecture
 * seule). Avant ce lot : n'importe quel statut écrit directement (« livrée » sans paiement ni remise).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/partner/orders/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const body = await readJson(request);
        if (!body) return invalidBody();
        const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
        if (!ACTIONS.has(action)) {
            return NextResponse.json({ success: false, error: 'Action inconnue.', code: 'INVALID_ACTION' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('order_partner_action', {
            p: {
                order_id: id,
                actor_id: user.id,
                action,
                reason: typeof body.reason === 'string' ? body.reason : null,
                minutes: typeof body.minutes === 'number' || typeof body.minutes === 'string' ? body.minutes : null,
                courier_id: typeof body.courierId === 'string' ? body.courierId : null,
                code: typeof body.code === 'string' ? body.code.trim() : null,
                balance_received: body.balanceReceived === true,
            },
        });
        if (error) throw new Error(`order_partner_action : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Action impossible pour le moment.');
        await sendOrderRefunds(r.cashout_ids);
        return NextResponse.json({
            success: true,
            order: { id, state: r.order_state ?? null, stateLabel: r.order_state ? orderStateLabel(r.order_state) : null, estimatedAt: r.estimated_at ?? null },
        });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/orders/[id]', error, { message: 'Commande non enregistrée. Réessayez.', code: 'ORDER_SAVE_FAILED', status: 500 });
    }
}
