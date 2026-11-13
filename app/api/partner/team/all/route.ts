import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsAdmin, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { isEventEligibleForController } from '@/lib/events/event-status';
import { dakarInstant } from '@/lib/validations/event';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';
import { maskPersonName } from '@/lib/security/mask';
import { adminForeignTeamRefusal, adminTeamRefusal } from '../team-access';

export const dynamic = 'force-dynamic';

// GET /api/partner/team/all
// Retourne l'équipe de contrôle du partenaire : contrôleurs affectés à ses événements, regroupés par membre,
// avec les comptages et la liste des événements assignables décidés ici (lot 7, D66, contrat 3.8) :
//  - members_count (contrôleurs distincts), assignments_count (affectations sur les événements du partenaire) ;
//  - members[] : un membre par compte, ses affectations (événement, titre, début, statut, assignable) ;
//  - assignable_events[] : événements VALIDE ou PUBLIE du partenaire (id, title, start_at), triés par date.
// `controllers` et `events` (format du lot 5) restent servis tels quels.
// Architecture : requêtes indépendantes + fusion en mémoire pour éviter toute ambiguïté de FK PostgREST
// (event_controllers a 2 FK vers users : user_id et created_by).
interface EventRow { id: string; title: string; start_date: string | null; start_time: string | null; status: string }

/** Début d'un événement (instant ISO) : date et heure de Dakar, fuseau sans changement d'heure. */
function startAtOf(e: EventRow): string | null {
    if (!e.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(e.start_date)) return null;
    const time = e.start_time && /^\d{2}:\d{2}(:\d{2})?$/.test(e.start_time) ? e.start_time : '00:00';
    const ms = dakarInstant(e.start_date, time);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function byStartThenTitle(a: { start_at: string | null; title: string }, b: { start_at: string | null; title: string }): number {
    const ta = a.start_at ? Date.parse(a.start_at) : 0;
    const tb = b.start_at ? Date.parse(b.start_at) : 0;
    if (ta && tb && ta !== tb) return ta - tb;
    return (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' });
}

const NO_STORE = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
};

const ID_CHUNK = 100;

interface MemberAssignment {
    id: string;
    event_id: string;
    can_accept_cash: boolean;
    created_at: string;
    event: { id: string; title: string; start_at: string | null; status: string; assignable: boolean } | null;
}

interface TeamMember {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    status: string | null;
    /** Compte créé par l'invitation, pas encore activé par le contrôleur (lot 9 bis : état réel, R39). */
    pending_activation: boolean;
    /**
     * Lot 9 bis (R39, R37, contrat 4.3) : ACTIVATED (compte activé ou établi), PENDING_ACTIVATION (compte créé par
     * l'invitation, jamais activé : « Renvoyer le SMS »), INVITATION_PENDING (titulaire invité, pas encore d'accord).
     */
    account_state: AccountState;
    /** Encaissement des espèces autorisé sur au moins une affectation. */
    can_accept_cash: boolean;
    assignments_count: number;
    assignments: MemberAssignment[];
    /** Invitation en attente (INVITATION_PENDING) : identifiant et échéance. */
    invitation?: { id: string; expires_at: string };
}

type AccountState = 'ACTIVATED' | 'PENDING_ACTIVATION' | 'INVITATION_PENDING';
type ServiceClient = ReturnType<typeof getServiceRoleClient>;

/** État réel des comptes (RPC controller_account_states, auth.users) ; une panne lève. */
async function readAccountStates(supabase: ServiceClient, userIds: string[]): Promise<Map<string, AccountState>> {
    const states = new Map<string, AccountState>();
    if (userIds.length === 0) return states;
    const { data, error } = await supabase.rpc('controller_account_states', { p: { user_ids: userIds } });
    if (error) throw new Error(`controller_account_states : ${error.code ?? ''} ${error.message}`);
    const reply = data as { ok?: boolean; items?: Array<{ user_id: string; account_state: AccountState }> } | null;
    if (!reply || reply.ok !== true || !Array.isArray(reply.items)) throw new Error(`controller_account_states : réponse inattendue ${JSON.stringify(data)}`);
    for (const item of reply.items) states.set(String(item.user_id), item.account_state === 'PENDING_ACTIVATION' ? 'PENDING_ACTIVATION' : 'ACTIVATED');
    return states;
}

/** Invitations de contrôleur en attente et non échues de la partenaire (toutes pour un admin) ; une panne lève. */
async function readPendingInvitations(supabase: ServiceClient, partnerId: string | null, assigned: Map<string, TeamMember>): Promise<TeamMember[]> {
    let query = supabase
        .from('controller_invitations')
        .select('id, user_id, expires_at')
        .eq('status', 'PENDING')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
    if (partnerId) query = query.eq('partner_id', partnerId);
    const { data, error } = await query;
    if (error) throw new Error(`invitations de contrôleur en attente : ${error.message}`);
    const rows = (data ?? []).filter((r: { user_id: string }) => !assigned.has(String(r.user_id)));
    if (rows.length === 0) return [];
    const { data: people, error: pErr } = await supabase
        .from('users')
        .select('id, first_name, last_name, status')
        .in('id', Array.from(new Set(rows.map((r: { user_id: string }) => String(r.user_id)))));
    if (pErr) throw new Error(`titulaires des invitations : ${pErr.message}`);
    const byId = new Map((people ?? []).map((u: { id: string; first_name: string | null; last_name: string | null; status: string | null }) => [u.id, u]));
    const seen = new Set<string>();
    const invited: TeamMember[] = [];
    for (const r of rows as Array<{ id: string; user_id: string; expires_at: string }>) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        const u = byId.get(r.user_id);
        invited.push({
            user_id: r.user_id,
            first_name: maskPersonName(u?.first_name, u?.last_name),
            last_name: null,
            phone: null,
            status: u?.status ?? null,
            pending_activation: false,
            account_state: 'INVITATION_PENDING',
            can_accept_cash: false,
            assignments_count: 0,
            assignments: [],
            invitation: { id: r.id, expires_at: r.expires_at },
        });
    }
    return invited;
}

export async function GET(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        // Lot 9 bis (R2, B31) : un admin lit l'équipe avec events.read
        const denied = await adminTeamRefusal(user, 'events.read');
        if (denied) return denied;

        const supabase = getServiceRoleClient();

        // ── 1. Résoudre le partner_id ─────────────────────────────────────────
        let partnerId: string | null = null;
        if (serverHasRole(user, 'PARTENAIRE')) {
            const { data: p, error: pErr } = await supabase
                .from('partners')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (pErr) {
                console.error('[team/all] partners query:', pErr.message);
                return NextResponse.json({ error: 'Erreur lors de la résolution du partenaire.' }, { status: 500 });
            }
            if (!p) {
                return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
            }
            partnerId = p.id;
        }

        // ── 2. Récupérer les événements ───────────────────────────────────────
        let eventsQuery = supabase
            .from('events')
            .select('id, title, start_date, start_time, status');
        if (partnerId) {
            eventsQuery = eventsQuery.eq('partner_id', partnerId);
        }

        const { data: eventRows, error: evErr } = await eventsQuery;

        if (evErr) {
            console.error('[team/all] events query:', evErr.message, evErr.details);
            return NextResponse.json({ error: 'Impossible de charger les événements.' }, { status: 500 });
        }

        const events = ((eventRows ?? []) as EventRow[]).map((e) => ({ ...e, start_at: startAtOf(e) }));
        const eventMap = new Map(events.map((e) => [e.id, e]));
        const assignableEvents = events
            .filter((e) => isEventEligibleForController(e.status))
            .map((e) => ({ id: e.id, title: e.title, start_at: e.start_at, status: e.status }))
            .sort(byStartThenTitle);
        const legacyEvents = assignableEvents.map((e) => ({ id: e.id, title: e.title, date: eventMap.get(e.id)?.start_date ?? null, status: e.status }));

        if (events.length === 0) {
            return NextResponse.json({
                success: true, controllers: [], events: [], members: [], members_count: 0, assignments_count: 0, assignable_events: [],
            }, { headers: NO_STORE });
        }

        // ── 3. Récupérer les assignations (pas de jointure — évite FK ambiguïté), identifiants par lots ──
        const eventIds = events.map((e) => e.id);
        const rawAssignments: Array<{ id: string; event_id: string; user_id: string; can_accept_cash: boolean; created_at: string }> = [];
        for (let i = 0; i < eventIds.length; i += ID_CHUNK) {
            const { data, error: aErr } = await supabase
                .from('event_controllers')
                .select('id, event_id, user_id, can_accept_cash, created_at')
                .in('event_id', eventIds.slice(i, i + ID_CHUNK))
                .order('created_at', { ascending: false });
            if (aErr) {
                console.error('[team/all] event_controllers query:', aErr.message, aErr.details, aErr.hint);
                return NextResponse.json({ error: 'Impossible de charger les assignations.' }, { status: 500 });
            }
            rawAssignments.push(...(data ?? []));
        }
        rawAssignments.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

        // ── 4. Récupérer les profils utilisateurs ─────────────────────────────
        const userIds = Array.from(new Set(rawAssignments.map((a) => a.user_id)));
        const userMap = new Map<string, { id: string; first_name: string | null; last_name: string | null; phone: string | null; status: string | null }>();
        if (userIds.length > 0) {
            const { data: userProfiles, error: usersErr } = await supabase
                .from('users')
                .select('id, first_name, last_name, phone, status')
                .in('id', userIds);
            if (usersErr) {
                console.error('[team/all] users query:', usersErr.message, usersErr.details);
                return NextResponse.json({ error: 'Impossible de charger les profils contrôleurs.' }, { status: 500 });
            }
            for (const u of userProfiles ?? []) userMap.set(u.id, u);
        }

        // ── 5. Fusion en mémoire ──────────────────────────────────────────────
        const controllers = rawAssignments.map((a) => {
            const ev = eventMap.get(a.event_id);
            return {
                id:              a.id,
                event_id:        a.event_id,
                can_accept_cash: a.can_accept_cash,
                created_at:      a.created_at,
                users:  userMap.get(a.user_id) ?? null,
                events: ev ? { id: ev.id, title: ev.title, date: ev.start_date, status: ev.status } : null,
            };
        });

        // Un membre par compte, affectations groupées (plus récente d'abord)
        const membersById = new Map<string, TeamMember>();
        for (const a of rawAssignments) {
            const u = userMap.get(a.user_id);
            let m = membersById.get(a.user_id);
            if (!m) {
                m = {
                    user_id: a.user_id,
                    first_name: u?.first_name ?? null,
                    last_name: u?.last_name ?? null,
                    phone: u?.phone ?? null,
                    status: u?.status ?? null,
                    pending_activation: false,
                    account_state: 'ACTIVATED',
                    can_accept_cash: false,
                    assignments_count: 0,
                    assignments: [],
                };
                membersById.set(a.user_id, m);
            }
            const ev = eventMap.get(a.event_id);
            m.assignments.push({
                id: a.id,
                event_id: a.event_id,
                can_accept_cash: a.can_accept_cash,
                created_at: a.created_at,
                event: ev ? { id: ev.id, title: ev.title, start_at: ev.start_at, status: ev.status, assignable: isEventEligibleForController(ev.status) } : null,
            });
            m.assignments_count += 1;
            if (a.can_accept_cash) m.can_accept_cash = true;
        }
        const members = Array.from(membersById.values());

        // Lot 9 bis (R39, B63) : état réel de chaque compte (auth.users), plus deviné au prénom
        const states = await readAccountStates(supabase, members.map((m) => m.user_id));
        for (const m of members) {
            const state = states.get(m.user_id);
            if (!state) throw new Error(`controller_account_states : compte ${m.user_id} absent de la réponse`);
            m.account_state = state;
            m.pending_activation = state === 'PENDING_ACTIVATION';
        }
        // Lot 9 bis (R37, B62) : invitations en attente du titulaire (nom masqué, aucune affectation) ; hors du compte
        // des membres, qui reste celui des contrôleurs affectés.
        const invited = await readPendingInvitations(supabase, partnerId, membersById);

        return NextResponse.json({
            success:           true,
            controllers,
            events:            legacyEvents,
            members:           [...members, ...invited],
            members_count:     members.length,
            assignments_count: rawAssignments.length,
            assignable_events: assignableEvents,
        }, { headers: NO_STORE });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[API /api/partner/team/all] catch:', msg);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────────────────
// DELETE /api/partner/team/all?controllerId=<uuid>
// Retire un contrôleur de TOUS les événements du partenaire courant.
// Isolation Multi-Tenant garantie : ne touche pas aux événements d'autres partenaires.
// Conserve le compte utilisateur, son historique de scans et les audits.
// ──────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        // Lot 9 bis (R2, B31) : un admin retire un contrôleur avec events.write
        const denied = await adminTeamRefusal(user, 'events.write');
        if (denied) return denied;

        const controllerId = req.nextUrl.searchParams.get('controllerId');
        if (!controllerId) {
            return NextResponse.json({ error: 'controllerId requis.' }, { status: 400 });
        }
        // Lot 9 quater (B8 : N-01, E-09) : un admin agit sur l'équipe d'UN organisateur, nommé par partnerId ; sans lui,
        // 400 et rien n'est supprimé (avant : retrait chez tous les organisateurs, SMS compris).
        const partnerParam = req.nextUrl.searchParams.get('partnerId');
        if (partnerParam !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerParam)) {
            return NextResponse.json({ error: 'Identifiant d’organisateur invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Résoudre le partner_id
        let partnerId: string | null = null;
        if (serverIsAdmin(user) && partnerParam) {
            const foreign = await adminForeignTeamRefusal(user, 'events.write', [partnerParam]);
            if (foreign) return foreign;
            partnerId = partnerParam;
        } else if (serverIsAdmin(user) && !serverHasRole(user, 'PARTENAIRE')) {
            return NextResponse.json({
                error: 'Choisissez l’organisateur dont vous gérez l’équipe.',
                code: 'PARTNER_SCOPE_REQUIRED',
            }, { status: 400 });
        } else if (serverHasRole(user, 'PARTENAIRE')) {
            const { data: p, error: pErr } = await supabase
                .from('partners')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (pErr || !p) {
                return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
            }
            partnerId = p.id;
        }

        // 2-3. Affectations de ce contrôleur, limitées aux événements du partenaire par une jointure (lot 9 bis,
        //      reste S3 : la liste de tous les identifiants d'événements passée en filtre `in` dépassait la longueur
        //      d'URL de PostgREST pour un admin, « URI too long », 500) ; un admin agit sur toutes les équipes.
        // Lot 9 quater (B8) : jamais de retrait sans organisateur résolu
        if (!partnerId) {
            return NextResponse.json({ error: 'Choisissez l’organisateur dont vous gérez l’équipe.', code: 'PARTNER_SCOPE_REQUIRED' }, { status: 400 });
        }
        const assignmentsQuery = supabase
            .from('event_controllers')
            .select('id, event_id, events!inner(partner_id)')
            .eq('user_id', controllerId)
            .eq('events.partner_id', partnerId);
        const { data: assignmentsToDelete, error: aErr } = await assignmentsQuery;

        if (aErr) {
            console.error('[DELETE team/all] event_controllers query error:', aErr.message);
            return NextResponse.json({ error: 'Impossible de vérifier les affectations.' }, { status: 500 });
        }

        if (!assignmentsToDelete || assignmentsToDelete.length === 0) {
            return NextResponse.json({ success: true, message: 'Aucune affectation active trouvée pour ce partenaire.' });
        }

        const assignmentIds = assignmentsToDelete.map(a => a.id);
        const affectedEventIds = assignmentsToDelete.map(a => a.event_id);

        // 4. Supprimer uniquement ces assignations
        const { error: delErr } = await supabase
            .from('event_controllers')
            .delete()
            .in('id', assignmentIds);

        // Lot 4.7 : une caisse ouverte sur l'un des événements → refus du trigger (aucune affectation retirée)
        if (isControllerRemovalBlocked(delErr)) {
            return NextResponse.json(controllerRemovalConflict(), { status: 409 });
        }
        if (delErr) {
            console.error('[DELETE team/all] delete error:', delErr.message);
            return NextResponse.json({ error: 'Impossible de retirer les affectations.' }, { status: 500 });
        }

        // 5. Lot 6 (J2.4) : les avis de retrait (in-app et push par affectation, un SMS regroupé pour
        //    la requête) sont mis en file par le trigger trg_event_controllers_notify, dans la même
        //    transaction que la suppression ci-dessus (une seule instruction : un seul SMS).

        // 6. Audit log
        try {
            await AdminService.logAudit({
                userId: user.id,
                userRole: user.role as any,
                action: 'CONTROLLER_REMOVED_ALL',
                objectType: 'event_controllers',
                objectId: controllerId,
                newValue: { removed_assignments_count: assignmentIds.length, event_ids: affectedEventIds },
                metadata: {
                    partner_id: partnerId,
                    controller_id: controllerId,
                    removed_by: user.id,
                },
            });
        } catch (auditErr) {
            console.warn('[DELETE team/all] Audit non bloquant:', auditErr instanceof Error ? auditErr.message : auditErr);
        }

        return NextResponse.json({
            success: true,
            message: `Contrôleur retiré de ${assignmentIds.length} événement(s) du partenaire.`,
            removed_count: assignmentIds.length,
            notification: 'QUEUED',
        });

    } catch (err: unknown) {
        console.error('[DELETE /api/partner/team/all] catch:', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
