import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'GET /api/partner/events/[id]/cash-refunds';
const FALLBACK = { message: 'La liste des espèces à rembourser est momentanément indisponible.', code: 'CASH_REFUNDS_READ_FAILED' };
const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Refus de event_cash_refunds (M06) : texte français écrit par la RPC, statut HTTP du contrat 4.1. */
const REFUSALS: Record<string, number> = {
    EVENT_NOT_FOUND: 404,
    PERMISSION_MISSING: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    EVENT_NOT_CANCELLED: 409,
};

type Reply = { ok?: boolean; code?: string; message?: string; [key: string]: unknown } | null;

/**
 * GET /api/partner/events/[id]/cash-refunds — lot 9 bis (R20, B22, contrat 4.1). Ventes au guichet d'un événement
 * annulé, que l'organisateur rembourse lui-même en espèces (jamais Event Village, §76) : liste calculée en direct
 * par event_cash_refunds (référence du reçu, billets, montant, numéro masqué, vendeur, « Remboursé le … par … »),
 * totaux et `can_mark` (propriétaire seule). Lecture : propriétaire, ou admin avec events.read ; un tiers reçoit 404.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const { id } = await Promise.resolve(context.params);
        if (typeof id !== 'string' || !UUID_RE.test(id)) throw new PublicError('Événement introuvable.', 'EVENT_NOT_FOUND', 404);

        const { data, error } = await getServiceRoleClient().rpc('event_cash_refunds', { p: { event_id: id, actor_id: session.user.id } });
        if (error) throw new Error(`event_cash_refunds : ${error.code ?? ''} ${error.message}`);
        const reply = data as Reply;
        if (!reply) throw new Error('event_cash_refunds : réponse vide');
        if (reply.ok !== true) {
            const status = REFUSALS[String(reply.code)];
            if (!status) throw new Error(`event_cash_refunds : refus inattendu ${JSON.stringify(reply)}`);
            throw new PublicError(String(reply.message ?? 'Liste indisponible.'), String(reply.code), status);
        }
        const { ok: _ok, ...body } = reply;
        void _ok;
        return NextResponse.json(body, { headers: NO_STORE });
    } catch (err) {
        return apiFailure(CONTEXT, err, FALLBACK);
    }
}
