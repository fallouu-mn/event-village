import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { adminForeignTeamRefusal, adminTeamRefusal } from '../team-access';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    controllerId: z.string().uuid(),
    eventId: z.string().uuid(),
    entryPoint: z.string().trim().max(80).nullable(),
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
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
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
    const { count: zoneCount, error: zonesErr } = await supabase
        .from('event_zones')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', parsed.data.eventId);
    if (zonesErr) {
        console.error('[entry-point] lecture des zones impossible :', zonesErr.message);
        return NextResponse.json({ error: 'Modification momentanément indisponible.' }, { status: 500 });
    }
    if ((zoneCount ?? 0) > 0) {
        return NextResponse.json({ error: 'Cet événement a des portes : choisissez la porte du contrôleur dans la liste.', code: 'GATES_CONFIGURED' },
            { status: 409 });
    }
    const entryPoint = parsed.data.entryPoint ? parsed.data.entryPoint : null;
    const { data: rows, error } = await supabase
        .from('event_controllers')
        .update({ entry_point: entryPoint })
        .eq('event_id', parsed.data.eventId)
        .eq('user_id', parsed.data.controllerId)
        .select('id');
    if (error) {
        console.error('[entry-point] mise à jour impossible :', error.message);
        return NextResponse.json({ error: 'Modification momentanément indisponible.' }, { status: 500 });
    }
    if (!rows?.length) return NextResponse.json({ error: 'Ce contrôleur n’est pas affecté à cet événement.' }, { status: 404 });
    return NextResponse.json({ ok: true, entry_point: entryPoint });
}
