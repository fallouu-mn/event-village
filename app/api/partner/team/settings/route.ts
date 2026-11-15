import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { adminForeignTeamRefusal, adminTeamRefusal } from '../team-access';

export const dynamic = 'force-dynamic';

const CONTEXT = 'PATCH /api/partner/team/settings';

const BodySchema = z.object({
    eventId: z.string().uuid(),
    controllerId: z.string().uuid(),
    gateId: z.string().uuid().nullable().optional(),
    gateChangeAllowed: z.boolean().optional(),
    entryPoint: z.string().trim().max(80, 'Point d’entrée : 80 caractères au plus.').nullable().optional(),
    canAcceptCash: z.boolean(),
    reason: z.string().max(500).optional(),
}).strict();

/** Refus de event_controller_settings_set : statut HTTP (texte de la RPC, rédigé pour l'écran). */
const REFUSAL_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    EVENT_NOT_FOUND: 404,
    PERMISSION_MISSING: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    REASON_REQUIRED: 400,
    GATE_INVALID: 409,
    GATE_GONE: 409, // cvf1 R1 : porte supprimée pendant l'enregistrement
    GATES_CONFIGURED: 409,
    NOT_ASSIGNED: 404,
};

/**
 * PATCH /api/partner/team/settings — finition 1 (E-14) : réglages d'un contrôleur sur un événement en un seul
 * enregistrement : porte (événement à zones) ou point d'entrée (sans zone), « Peut changer de porte », droit d'encaisser
 * les espèces. Propriétaire de l'événement, ou admin muni de events.write avec un motif (journalisé) ; tiers : 404.
 * RPC event_controller_settings_set (une transaction, audit CONTROLLER_SETTINGS_SET). Réponse : réglages enregistrés et
 * `open_shift` (caisse encore ouverte : l'écran le dit quand les espèces sont retirées).
 */
export async function PATCH(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const denied = await adminTeamRefusal(user, 'events.write');
    if (denied) return denied;
    try {
        let raw: unknown;
        try {
            raw = await req.json();
        } catch {
            throw new PublicError('Demande illisible.', 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(parsed.error.issues[0]?.message ?? 'Réglages invalides.', 'INVALID_BODY', 400);
        const b = parsed.data;

        const { data: ev, error: evErr } = await getServiceRoleClient().from('events').select('partner_id').eq('id', b.eventId).maybeSingle();
        if (evErr) throw new Error(`lecture de l'événement : ${evErr.message}`);
        // Lot 9 quater (B3 : AUD-24) : un ADMIN-PARTENAIRE hors de sa fiche passe par la permission events.write
        const foreign = await adminForeignTeamRefusal(user, 'events.write', [(ev?.partner_id as string | null | undefined) ?? null]);
        if (foreign) return foreign;

        const { data, error } = await getServiceRoleClient().rpc('event_controller_settings_set', {
            p: {
                actor_id: user.id,
                event_id: b.eventId,
                controller_id: b.controllerId,
                gate_id: b.gateId ?? null,
                gate_change_allowed: b.gateChangeAllowed ?? false,
                entry_point: b.entryPoint ?? null,
                can_accept_cash: b.canAcceptCash,
                reason: b.reason ?? null,
            },
        });
        if (error) throw new Error(`event_controller_settings_set : ${error.code ?? ''} ${error.message}`);
        const reply = data as (Record<string, unknown> & { ok?: boolean; code?: string; message?: string }) | null;
        if (!reply) throw new Error('event_controller_settings_set : réponse vide');
        if (reply.ok !== true) {
            const status = REFUSAL_STATUS[String(reply.code)];
            if (!status || typeof reply.message !== 'string') throw new Error(`event_controller_settings_set : refus non répertorié ${JSON.stringify(reply)}`);
            throw new PublicError(reply.message, String(reply.code), status);
        }
        return NextResponse.json(reply, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure(CONTEXT, err, { message: 'Enregistrement momentanément impossible. Réessayez.', code: 'TEAM_UPDATE_FAILED' });
    }
}
