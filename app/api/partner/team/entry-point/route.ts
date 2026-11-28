import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { partnerSuspendedResponse } from '@/lib/auth/partner-fiche-guard';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { actsAsTeamAdmin, adminForeignTeamRefusal, adminReasonRefusal, adminTeamRefusal, cleanReason } from '../team-access';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    controllerId: z.string().uuid(),
    eventId: z.string().uuid(),
    entryPoint: z.string().trim().max(80).nullable(),
    // Finition 1 (E-17) : motif d'un admin hors de sa fiche, journalisé
    reason: z.string().optional(),
});

/**
 * PATCH /api/partner/team/entry-point — point d'entrée d'un contrôleur sur un événement (« Porte A »,
 * « Entrée VIP »), recopié sur chaque scan au moment du scan (données du pilotage, lot 4). Réservé au
 * partenaire propriétaire de l'événement (ou à un admin) ; `entryPoint` vide ou null efface le champ.
 * Lot 9 ter (9t.15, contrat 4.3) : sur un événement à zones, le point d'entrée suit la porte du contrôleur (PATCH
 * /api/partner/team/gate) : un texte libre est refusé, 409 GATES_CONFIGURED, rien n'est écrit.
 */
export async function PATCH(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    // Lot 9 bis (R2, B31) : un admin règle le point d'entrée avec events.write
    const denied = await adminTeamRefusal(user, 'events.write');
    if (denied) return denied;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible. Rechargez la page, puis réessayez.' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Point d’entrée invalide (80 caractères au plus).', details: parsed.error.flatten() }, { status: 400 });
    }
    const supabase = getServiceRoleClient();
    const { data: event, error: evErr } = await supabase
        .from('events')
        .select('id, partner_id, partners!inner(user_id)')
        .eq('id', parsed.data.eventId)
        .maybeSingle();
    if (evErr) {
        console.error('[entry-point] lecture de l’événement impossible :', evErr.message);
        return NextResponse.json({ error: 'Modification momentanément indisponible.' }, { status: 500 });
    }
    const ownerId = (event?.partners as unknown as { user_id: string } | undefined)?.user_id;
    if (!event || (!serverIsAdmin(user) && ownerId !== user.id)) {
        return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
    }
    // Lot 9 quater (B3 : AUD-24) : un ADMIN-PARTENAIRE hors de sa fiche passe par la permission events.write
    const foreign = await adminForeignTeamRefusal(user, 'events.write', [event.partner_id as string | null]);
    if (foreign) return foreign;
    const asAdmin = await actsAsTeamAdmin(user, event.partner_id as string | null);
    const reasonRefused = adminReasonRefusal(asAdmin, parsed.data.reason);
    if (reasonRefused) return reasonRefused;
    const entryPoint = parsed.data.entryPoint ? parsed.data.entryPoint : null;
    // Correctifs de la contre-vérification de la finition 2a (T1) : écriture par event_controller_entry_point_set (fiche
    // SUSPENDU refusée en tête, droits et portes vérifiés de nouveau en base), plus d'écriture directe dans event_controllers
    const { data: reply, error } = await supabase.rpc('event_controller_entry_point_set', {
        p: { actor_id: user.id, event_id: parsed.data.eventId, controller_id: parsed.data.controllerId, entry_point: entryPoint },
    });
    const r = (reply ?? null) as { ok?: boolean; code?: string; assignment_id?: string } | null;
    if (error || !r) {
        console.error('[entry-point] mise à jour impossible :', error?.message ?? 'réponse vide');
        return NextResponse.json({ error: 'Modification momentanément indisponible.' }, { status: 500 });
    }
    if (r.ok !== true) {
        if (r.code === 'PARTNER_SUSPENDED') return partnerSuspendedResponse();
        if (r.code === 'GATES_CONFIGURED') {
            return NextResponse.json({ error: 'Cet événement a des portes : choisissez la porte du contrôleur dans la liste.', code: 'GATES_CONFIGURED' },
                { status: 409 });
        }
        if (r.code === 'NOT_ASSIGNED') return NextResponse.json({ error: 'Ce contrôleur n’est pas affecté à cet événement.' }, { status: 404 });
        if (r.code === 'EVENT_NOT_FOUND') return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
        if (r.code === 'INVALID_INPUT') return NextResponse.json({ error: 'Point d’entrée invalide (80 caractères au plus).' }, { status: 400 });
        console.error('[entry-point] refus inattendu :', JSON.stringify(r));
        return NextResponse.json({ error: 'Modification momentanément indisponible.' }, { status: 500 });
    }
    if (asAdmin) {
        await AdminService.logAudit({
            userId: user.id, userRole: 'ADMIN', action: 'TEAM_ADMIN_ACTION', objectType: 'event_controllers', objectId: String(r.assignment_id),
            newValue: { entry_point: entryPoint },
            metadata: { route: 'PATCH /api/partner/team/entry-point', event_id: parsed.data.eventId, controller_id: parsed.data.controllerId, reason: cleanReason(parsed.data.reason) },
        });
    }
    return NextResponse.json({ ok: true, entry_point: entryPoint });
}
