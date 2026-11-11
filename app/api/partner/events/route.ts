import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { EventService, EventServiceError } from '@/lib/events/event.service';
import { isEventStatus } from '@/lib/events/event-lifecycle.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events?status=&search=
 * Liste des événements du partenaire connecté (lot 5, contrat H) : `status` vaut TOUS (défaut) ou l'un
 * des 7 statuts, ANNULE compris ; un statut inconnu donne 400 UNKNOWN_STATUS sans jamais atteindre la
 * base. Les indicateurs (sur tous les événements) sont servis par GET /api/partner/events/overview.
 * Chaque événement porte ses actions possibles (`actions`, `can_edit`, `can_cancel`, `last_reason`) lues
 * par la RPC event_actions (contrat D5) : la liste n'en code aucune en dur.
 */
export async function GET(request: NextRequest) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!user || !serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux partenaires.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'TOUS';
    if (status !== 'TOUS' && !isEventStatus(status)) {
        return NextResponse.json({ error: 'Statut demandé inconnu.', code: 'UNKNOWN_STATUS' }, { status: 400 });
    }
    const search = (searchParams.get('search') || '').slice(0, 100);

    try {
        const rows = await EventService.getPartnerEvents(user.id, { status, search });
        // Actions possibles de chaque carte (soumettre, retirer, publier, modifier, annuler) et motif de
        // refus ou de suspension : RPC event_actions (contrat D5, source unique des boutons de la liste).
        const supabase = getServiceRoleClient();
        const events = await Promise.all(rows.map(async (ev: { id: string } & Record<string, unknown>) => {
            const { data, error } = await supabase.rpc('event_actions', { p: { event_id: ev.id, actor_id: user.id } });
            if (error) throw new Error(`event_actions ${ev.id} : ${error.message}`);
            const body = (data ?? {}) as Record<string, unknown>;
            if (body.ok !== true) throw new Error(`event_actions ${ev.id} : refus ${String(body.code)}`);
            return {
                ...ev,
                actions: Array.isArray(body.actions) ? body.actions : [],
                can_edit: body.can_edit === true,
                can_cancel: body.can_cancel === true,
                last_reason: body.last_reason ?? null,
            };
        }));
        return NextResponse.json({ success: true, events });
    } catch (error: unknown) {
        console.error('[API partner/events GET] Error:', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json(
            { error: 'Lecture de vos événements impossible pour le moment.', code: 'EVENTS_READ_FAILED' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/partner/events — lot 5 (contrats F1, F2, F5)
 * Création d'un événement BROUILLON et de ses catégories en une transaction (RPC event_create).
 * Corps validé par le schéma partagé lib/validations/event.ts (.strict() : statut, slug, partenaire,
 * services ou clé inconnue → 400 avec les champs refusés). Le partenaire est dérivé du compte connecté.
 * Réponses : 201 `{ success, event }` ; 400 `{ error, code, field?, fields }` ; 403 ; 409 (doublon, jauge).
 * Lot 9 bis (R7, B39) : un compte EN_ATTENTE est admis puis refusé 403 PARTNER_NOT_VALIDATED tant que sa fiche n'est
 * pas validée (avant : ACCOUNT_NOT_ACTIVE, refus muet sur la vraie raison).
 */
export async function POST(request: NextRequest) {
    const activeSession = await requireActiveSession(request, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverHasRole(user, 'PARTENAIRE')) {
        return NextResponse.json({ error: 'Seul un organisateur peut créer un événement.', code: 'PARTNER_ROLE_REQUIRED' }, { status: 403 });
    }
    const { data: partnerRow, error: partnerErr } = await getServiceRoleClient()
        .from('partners')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();
    if (partnerErr) {
        console.error('[API partner/events POST] fiche partenaire :', partnerErr.message);
        return NextResponse.json({ error: 'Création de l’événement impossible pour le moment.', code: 'EVENT_CREATE_FAILED' }, { status: 500 });
    }
    if (!partnerRow || partnerRow.status !== 'VALIDE') {
        return NextResponse.json({
            error: 'Votre profil d’organisateur doit être validé avant de créer un événement.',
            code: 'PARTNER_NOT_VALIDATED',
        }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const event = await EventService.createEvent(user.id, body);
        return NextResponse.json({ success: true, event }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof EventServiceError) return NextResponse.json(error.toBody(), { status: error.status });
        console.error('[API partner/events POST]', error instanceof Error ? error.message : String(error));
        return NextResponse.json({ error: 'Création de l’événement impossible pour le moment.', code: 'EVENT_CREATE_FAILED' }, { status: 500 });
    }
}
