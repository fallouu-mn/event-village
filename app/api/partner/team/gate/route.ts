import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { adminForeignTeamRefusal, adminTeamRefusal } from '../team-access';

export const dynamic = 'force-dynamic';

const CONTEXT = 'PATCH /api/partner/team/gate';

const BodySchema = z.object({
    eventId: z.string().uuid(),
    controllerId: z.string().uuid(),
    gateId: z.string().uuid().nullable(),
    gateChangeAllowed: z.boolean().optional(),
});

/** Statut HTTP des refus de event_controller_gate_set (liste blanche, contrat 4.3). */
const REFUSAL_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    ACCOUNT_NOT_ACTIVE: 403,
    EVENT_NOT_FOUND: 404,
    NOT_ASSIGNED: 404,
    GATE_INVALID: 409,
};

type Reply = Record<string, unknown> & { ok?: unknown; code?: unknown; message?: unknown };

/**
 * PATCH /api/partner/team/gate — lot 9 ter (9t.15, contrat 4.3, F32) : `{ eventId, controllerId, gateId | null,
 * gateChangeAllowed? }`, porte d'un contrôleur affecté et autorisation de changer lui-même de porte. Propriétaire de
 * l'événement, ou admin muni de events.write (sinon 403 PERMISSION_MISSING) ; tiers : 404. RPC appelée une fois, sans
 * relance ; journalisée (CONTROLLER_GATE_SET). Réponse `{ ok, controller_id, gate, gate_change_allowed }`.
 */
export async function PATCH(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const denied = await adminTeamRefusal(session.user, 'events.write');
    if (denied) return denied;
    try {
        let raw: unknown;
        try {
            raw = await req.json();
        } catch (parseErr) {
            console.warn(`[${CONTEXT}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
            throw new PublicError('Corps de requête illisible.', 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) throw new PublicError('Affectation invalide : événement, contrôleur et porte requis.', 'INVALID_BODY', 400);

        // Lot 9 quater (B3 : AUD-24) : un ADMIN-PARTENAIRE hors de sa fiche passe par la permission events.write
        const { data: ev, error: evErr } = await getServiceRoleClient().from('events').select('partner_id').eq('id', parsed.data.eventId).maybeSingle();
        if (evErr) throw new Error(`lecture de l'événement : ${evErr.message}`);
        const foreign = await adminForeignTeamRefusal(session.user, 'events.write', [(ev?.partner_id as string | null | undefined) ?? null]);
        if (foreign) return foreign;

        const { data, error } = await getServiceRoleClient().rpc('event_controller_gate_set', {
            p: {
                actor_id: session.user.id,
                event_id: parsed.data.eventId,
                controller_id: parsed.data.controllerId,
                gate_id: parsed.data.gateId,
                gate_change_allowed: parsed.data.gateChangeAllowed ?? false,
            },
        });
        if (error) throw new Error(`event_controller_gate_set : ${error.code ?? ''} ${error.message}`);
        const reply = (data ?? null) as Reply | null;
        if (!reply || typeof reply !== 'object') throw new Error('event_controller_gate_set : réponse vide');
        if (reply.ok !== true) {
            const code = typeof reply.code === 'string' ? reply.code : '';
            const status = REFUSAL_STATUS[code];
            if (!status || typeof reply.message !== 'string') throw new Error(`event_controller_gate_set : refus non répertorié ${JSON.stringify(reply)}`);
            throw new PublicError(reply.message, code, status);
        }
        return NextResponse.json({
            ok: true,
            controller_id: reply.controller_id,
            gate: reply.gate ?? null,
            gate_change_allowed: reply.gate_change_allowed === true,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure(CONTEXT, err, { message: 'Modification momentanément indisponible.', code: 'TEAM_UPDATE_FAILED', status: 500 });
    }
}
