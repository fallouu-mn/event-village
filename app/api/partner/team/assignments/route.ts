import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { isEventEligibleForController, INELIGIBLE_EVENT_ASSIGNMENT_ERROR } from '@/lib/events/event-status';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';
import { grantUserRoles } from '@/lib/auth/roles';
import { refuseInactiveAccount } from '@/lib/auth/account-status';
import { maskPersonName } from '@/lib/security/mask';
import { revokeUserSessions } from '@/lib/auth/sessions';
import { createControllerInvitation } from '../controller-invitation';
import { adminTeamRefusal } from '../team-access';

export const dynamic = 'force-dynamic';

/** Lot 9 bis (R41, B64) : une affectation et son droit d'encaisser ; absent, le droit actuel est gardé. */
const AssignmentSchema = z.object({
    event_id:        z.string().uuid('event_id invalide.'),
    can_accept_cash: z.boolean().optional(),
}).strict();

const UpdateAssignmentsSchema = z.object({
    controller_id:   z.string().uuid('controller_id invalide.').optional(),
    controllerId:    z.string().uuid('controllerId invalide.').optional(),
    assignments:     z.array(AssignmentSchema).max(200, '200 affectations au plus.').optional(),
    event_ids:       z.array(z.string().uuid('event_id invalide.')).optional(),
    eventIds:        z.array(z.string().uuid('eventIds invalide.')).optional(),
    eventId:         z.string().uuid('eventId invalide.').optional(),
    can_accept_cash:   z.boolean().optional(),
    canAcceptCash:     z.boolean().optional(),
    confirm_promotion: z.boolean().optional(),
    confirmPromotion:  z.boolean().optional(),
}).transform(data => ({
    controller_id:     data.controller_id || data.controllerId || '',
    // Lot 9 bis (R41) : `assignments` fait foi ; une simple liste d'événements garde le droit d'encaisser actuel
    assignments:       data.assignments
        ?? (data.event_ids || data.eventIds || (data.eventId ? [data.eventId] : [])).map((event_id) => ({ event_id, can_accept_cash: undefined as boolean | undefined })),
    global_cash:       data.can_accept_cash !== undefined || data.canAcceptCash !== undefined,
    confirm_promotion: data.confirm_promotion ?? data.confirmPromotion ?? false,
})).refine(data => !!data.controller_id, {
    message: 'controller_id ou controllerId requis.',
});

type SyncReply = { ok?: boolean; code?: string; message?: string; added?: string[]; removed?: string[]; updated?: number };

const SYNC_REFUSALS: Record<string, number> = {
    INVALID_INPUT: 400,
    CONTROLLER_NOT_FOUND: 404,
    EVENT_NOT_OWNED: 403,
    EVENT_NOT_ELIGIBLE: 400,
};

// ──────────────────────────────────────────────────────────
// PATCH /api/partner/team/assignments
// Modifie l'ensemble des événements assignés à un contrôleur (Partie 2.C), pour le partenaire courant.
// Lot 9 bis : corps `{ controller_id, assignments: [{ event_id, can_accept_cash }], confirm_promotion? }` (R41 :
// droit d'encaisser par événement ; un booléen global est refusé, 400 INVALID_FIELD) ; retraits, ajouts, droits et
// journal en une transaction (RPC controller_assignments_sync, R102 et tâche 19) ; un compte établi qui n'est pas
// contrôleur reçoit une invitation qu'il accepte lui-même (R37).
// ──────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
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
        // Lot 9 bis (R2, B31) : un admin gère les affectations avec events.write
        const denied = await adminTeamRefusal(user, 'events.write');
        if (denied) return denied;

        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = UpdateAssignmentsSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message || 'Données invalides.', code: 'INVALID_FIELD' }, { status: 400 });
        }

        const { controller_id: controllerId, assignments, global_cash, confirm_promotion } = parse.data;
        // Lot 9 bis (R41, B64) : un seul interrupteur pour toutes les affectations n'est plus accepté
        if (global_cash) {
            return NextResponse.json({
                error: 'Le droit d’encaisser se règle événement par événement : envoyez assignments avec can_accept_cash pour chacun.',
                code: 'INVALID_FIELD',
                field: 'can_accept_cash',
            }, { status: 400 });
        }
        const requestedEventIds = Array.from(new Set(assignments.map((a) => a.event_id)));
        const supabase = getServiceRoleClient();

        // 1. Résoudre le partner_id
        let partnerId: string | null = null;
        if (serverHasRole(user, 'PARTENAIRE')) {
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

        // 2. Vérifier que tous les événements demandés appartiennent bien à ce partenaire
        let partnerEventsQuery = supabase.from('events').select('id, title, status');
        if (partnerId) {
            partnerEventsQuery = partnerEventsQuery.eq('partner_id', partnerId);
        }
        const { data: partnerEvents, error: peErr } = await partnerEventsQuery;
        if (peErr) {
            return NextResponse.json({ error: 'Impossible de vérifier les événements.' }, { status: 500 });
        }

        const partnerEventMap = new Map((partnerEvents ?? []).map(e => [e.id, e]));
        for (const evId of requestedEventIds) {
            if (!partnerEventMap.has(evId)) {
                return NextResponse.json({ error: `Vous n'êtes pas propriétaire de l'événement ${evId}.` }, { status: 403 });
            }
        }

        // 2.5. Vérifier le profil contrôleur et exiger la confirmation si le rôle n'est pas CONTROLEUR (Faille 2.3)
        const { data: ctrlUser, error: ctrlErr } = await supabase
            .from('users')
            .select('id, phone, first_name, last_name, role, status')
            .eq('id', controllerId)
            .maybeSingle();

        if (ctrlErr || !ctrlUser) {
            return NextResponse.json({ error: 'Contrôleur introuvable.' }, { status: 404 });
        }

        // Lot 1B.6 : un compte non ACTIF n'est jamais affecté ni réactivé par une route partenaire.
        if (ctrlUser.status !== 'ACTIF') {
            return refuseInactiveAccount({
                actor: user,
                targetId: ctrlUser.id,
                targetStatus: ctrlUser.status,
                action: 'CONTROLLER_ASSIGNMENT_REFUSED_INACTIVE',
                context: { event_ids: requestedEventIds },
            });
        }

        // Rôles effectifs : user_roles (source des politiques RLS), pas le rôle legacy users.role.
        const { data: ctrlRoleRows, error: ctrlRolesErr } = await supabase.from('user_roles').select('role').eq('user_id', controllerId);
        if (ctrlRolesErr) {
            console.error('[PATCH team/assignments] lecture des rôles du contrôleur :', ctrlRolesErr.message);
            return NextResponse.json({ error: 'Impossible de lire les rôles du contrôleur.' }, { status: 500 });
        }
        const ctrlRoles = (ctrlRoleRows || []).map((r) => r.role as string);
        const alreadyController = ctrlRoles.some((r) => r === 'CONTROLEUR' || r === 'ADMIN' || r === 'SUPERADMIN');

        if (!alreadyController) {
            // Lot 1C.1 : nom masqué seulement (ni téléphone, ni rôles) pour un identifiant quelconque.
            const displayName = maskPersonName(ctrlUser.first_name, ctrlUser.last_name);
            if (!confirm_promotion) {
                return NextResponse.json({
                    requires_confirmation: true,
                    code: 'EXISTING_ACCOUNT',
                    existing_user: { display_name: displayName },
                    message: `Ce compte (${displayName}) n'est pas encore contrôleur. Confirmez-vous son affectation à vos événements ?`,
                }, { status: 200 });
            }

            const { data: authRow, error: authErr } = await supabase.auth.admin.getUserById(controllerId);
            if (authErr || !authRow?.user) {
                console.error('[PATCH team/assignments] lecture du compte d’authentification :', authErr?.message ?? 'compte absent');
                return NextResponse.json({ error: 'Impossible de lire le compte du contrôleur.' }, { status: 500 });
            }
            const pendingActivation = authRow.user.user_metadata?.is_temporary_controller_account === true;

            if (!pendingActivation) {
                // Lot 9 bis (R37, B62) : le titulaire d'un compte établi accepte lui-même ; rien n'est posé ici.
                if (requestedEventIds.length === 0) {
                    return NextResponse.json({ error: 'Choisissez au moins un événement.', code: 'INVALID_FIELD' }, { status: 400 });
                }
                const invited = await createControllerInvitation(supabase, {
                    actorId: user.id,
                    actorRole: partnerId ? 'PARTENAIRE' : 'ADMIN',
                    partnerId,
                    userId: controllerId,
                    assignments: assignments.map((a) => ({ event_id: a.event_id, can_accept_cash: a.can_accept_cash ?? false })),
                });
                if (invited.response) return invited.response;
                return NextResponse.json({
                    success: true,
                    invitation_id: invited.invitationId,
                    invitation_expires_at: invited.expiresAt,
                    added: [],
                    removed: [],
                    notification: 'QUEUED',
                    message: `Invitation envoyée : ${displayName} doit l’accepter dans l’application avant d’être affecté.`,
                });
            }

            // Compte encore temporaire (créé par une invitation, jamais activé) : il consent par l'activation.
            // Rôle CONTROLEUR dans user_roles (le trigger recalcule users.role), sans toucher au statut, puis
            // déconnexion des sessions existantes. Lot 9 bis (R40) : la marque d'activation n'est plus réécrite.
            try {
                await grantUserRoles(controllerId, ['CONTROLEUR']);
            } catch (roleErr) {
                console.error('[PATCH team/assignments]', roleErr instanceof Error ? roleErr.message : roleErr);
                return NextResponse.json({ error: 'Impossible d\'attribuer le rôle Contrôleur.' }, { status: 500 });
            }
            // Lot 1C.3 : révocation réelle des sessions (auth.admin.signOut(userId) était sans effet)
            if (!(await revokeUserSessions(controllerId, { reason: 'CONTROLLER_REMOVED', actorId: user.id }))) {
                return NextResponse.json({ error: 'Rôle Contrôleur attribué, mais la révocation des sessions a échoué. Réessayez.' }, { status: 500 });
            }
        }

        // 3. Seuls les événements confirmés (VALIDE ou PUBLIE) peuvent être nouvellement affectés (message de l'écran)
        const current = new Set<string>();
        if (requestedEventIds.length > 0) {
            const { data: currentRows, error: caErr } = await supabase
                .from('event_controllers')
                .select('event_id')
                .eq('user_id', controllerId)
                .in('event_id', requestedEventIds);
            if (caErr) {
                return NextResponse.json({ error: 'Impossible de lire les affectations actuelles.' }, { status: 500 });
            }
            for (const a of currentRows ?? []) current.add(String(a.event_id));
        }
        for (const evId of requestedEventIds.filter((id) => !current.has(id))) {
            const ev = partnerEventMap.get(evId);
            if (!ev || !isEventEligibleForController(ev.status)) {
                return NextResponse.json({
                    error: INELIGIBLE_EVENT_ASSIGNMENT_ERROR,
                    details: `L'événement "${ev?.title ?? evId}" est en statut ${ev?.status ?? 'inconnu'}. Seuls les événements confirmés (VALIDÉ ou PUBLIÉ) peuvent être affectés.`,
                }, { status: 400 });
            }
        }

        // 4. Lot 9 bis (R41, R102, tâche 19) : retraits, ajouts, droit d'encaisser et journal en une transaction.
        //    Une caisse OUVERT sur un retrait fait refuser le tout (trigger controller_removal_guard,
        //    CONTROLLER_HAS_OPEN_SHIFT). Avis : trigger trg_event_controllers_notify (un SMS par instruction).
        const { data, error: syncErr } = await supabase.rpc('controller_assignments_sync', {
            p: {
                actor_id: user.id,
                actor_role: partnerId ? 'PARTENAIRE' : 'ADMIN',
                controller_id: controllerId,
                partner_id: partnerId,
                assignments: assignments.map((a) => ({ event_id: a.event_id, can_accept_cash: a.can_accept_cash ?? null })),
            },
        });
        if (isControllerRemovalBlocked(syncErr)) {
            return NextResponse.json(controllerRemovalConflict(), { status: 409 });
        }
        if (syncErr) throw new Error(`controller_assignments_sync : ${syncErr.code ?? ''} ${syncErr.message}`);
        const sync = data as SyncReply | null;
        if (!sync) throw new Error('controller_assignments_sync : réponse vide');
        if (sync.ok !== true) {
            const status = SYNC_REFUSALS[String(sync.code)];
            if (!status) throw new Error(`controller_assignments_sync : refus inattendu ${JSON.stringify(sync)}`);
            return NextResponse.json({ error: sync.message ?? 'Affectations refusées.', code: sync.code }, { status });
        }

        return NextResponse.json({
            success: true,
            message: 'Affectations synchronisées avec succès.',
            added: sync.added ?? [],
            removed: sync.removed ?? [],
            total_active: requestedEventIds.length,
            notification: 'QUEUED',
        });

    } catch (err: unknown) {
        console.error('[PATCH /api/partner/team/assignments] catch:', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
