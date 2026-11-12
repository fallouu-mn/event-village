import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/controller/gate';

const BodySchema = z.object({ eventId: z.string().uuid(), gateId: z.string().uuid() });

/** Statut HTTP des refus de controller_gate_select (liste blanche, contrat 4.3). */
const REFUSAL_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    ACCOUNT_NOT_ACTIVE: 403,
    GATE_CHANGE_NOT_ALLOWED: 403,
    NOT_ASSIGNED: 404,
    EVENT_NOT_FOUND: 404,
    GATE_INVALID: 409,
};

type Reply = Record<string, unknown> & { ok?: unknown; code?: unknown; message?: unknown };

/**
 * POST /api/controller/gate — lot 9 ter (9t.15, contrat 4.3, F33) : `{ eventId, gateId }`, le contrôleur affecté que
 * la partenaire autorise change lui-même de porte (sans PIN régisseur, journalisé CONTROLLER_GATE_CHANGED). RPC
 * controller_gate_select appelée une fois, sans relance. Réponse `{ ok, gate }`.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        let raw: unknown;
        try {
            raw = await req.json();
        } catch (parseErr) {
            console.warn(`[${CONTEXT}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
            throw new PublicError('Corps de requête illisible.', 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) throw new PublicError('Choix de porte invalide : événement et porte requis.', 'INVALID_BODY', 400);

        const { data, error } = await getServiceRoleClient().rpc('controller_gate_select', {
            p: { actor_id: session.user.id, event_id: parsed.data.eventId, gate_id: parsed.data.gateId },
        });
        if (error) throw new Error(`controller_gate_select : ${error.code ?? ''} ${error.message}`);
        const reply = (data ?? null) as Reply | null;
        if (!reply || typeof reply !== 'object') throw new Error('controller_gate_select : réponse vide');
        if (reply.ok !== true) {
            const code = typeof reply.code === 'string' ? reply.code : '';
            const status = REFUSAL_STATUS[code];
            if (!status || typeof reply.message !== 'string') throw new Error(`controller_gate_select : refus non répertorié ${JSON.stringify(reply)}`);
            throw new PublicError(reply.message, code, status);
        }
        if (!reply.gate || typeof reply.gate !== 'object') throw new Error(`controller_gate_select : réponse sans porte ${JSON.stringify(reply)}`);
        return NextResponse.json({ ok: true, gate: reply.gate }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure(CONTEXT, err, { message: 'Changement de porte momentanément impossible.', code: 'GATE_SELECT_FAILED', status: 500 });
    }
}
