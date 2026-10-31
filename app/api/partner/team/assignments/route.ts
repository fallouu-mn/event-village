import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { isEventEligibleForController, INELIGIBLE_EVENT_ASSIGNMENT_ERROR } from '@/lib/events/event-status';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';
import { grantUserRoles } from '@/lib/auth/roles';
import { refuseInactiveAccount } from '@/lib/auth/account-status';
import { maskPersonName } from '@/lib/security/mask';
import { revokeUserSessions } from '@/lib/auth/sessions';

export const dynamic = 'force-dynamic';

const UpdateAssignmentsSchema = z.object({
    controller_id:   z.string().uuid('controller_id invalide.').optional(),
    controllerId:    z.string().uuid('controllerId invalide.').optional(),
    event_ids:       z.array(z.string().uuid('event_id invalide.')).optional(),
    eventIds:        z.array(z.string().uuid('eventIds invalide.')).optional(),
    eventId:         z.string().uuid('eventId invalide.').optional(),
    can_accept_cash:   z.boolean().optional(),
    canAcceptCash:     z.boolean().optional(),
    confirm_promotion: z.boolean().optional(),
    confirmPromotion:  z.boolean().optional(),
}).transform(data => ({
    controller_id:     data.controller_id || data.controllerId || '',
    event_ids:         data.event_ids || data.eventIds || (data.eventId ? [data.eventId] : []),
    can_accept_cash:   data.can_accept_cash ?? data.canAcceptCash ?? false,
    confirm_promotion: data.confirm_promotion ?? data.confirmPromotion ?? false,
})).refine(data => !!data.controller_id, {
    message: 'controller_id ou controllerId requis.',
});

// ──────────────────────────────────────────────────────────
// PATCH /api/partner/team/assignments
// Modifie l'ensemble des événements assignés à un contrôleur (Partie 2.C).
// Synchronisation atomique pour le partenaire courant uniquement.
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

        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = UpdateAssignmentsSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message || 'Données invalides.' }, { status: 400 });
        }

        const { controller_id: controllerId, event_ids: requestedEventIds, can_accept_cash, confirm_promotion } = parse.data;
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
        const partnerEventIds = Array.from(partnerEventMap.keys());

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
            if (!confirm_promotion) {
                // Lot 1C.1 : nom masqué seulement (ni téléphone, ni rôles) pour un identifiant quelconque.
                const displayName = maskPersonName(ctrlUser.first_name, ctrlUser.last_name);
                return NextResponse.json({
                    requires_confirmation: true,
                    code: 'EXISTING_ACCOUNT',
                    existing_user: { display_name: displayName },
                    message: `Ce compte (${displayName}) n'est pas encore contrôleur. Confirmez-vous son affectation à vos événements ?`,
                }, { status: 200 });
            }

            // Confirmation fournie -> rôle CONTROLEUR dans user_roles (le trigger recalcule users.role),
            // sans toucher au statut, puis déconnexion des sessions existantes.
            try {
                await grantUserRoles(controllerId, ['CONTROLEUR']);
            } catch (roleErr) {
                console.error('[PATCH team/assignments]', roleErr instanceof Error ? roleErr.message : roleErr);
                return NextResponse.json({ error: 'Impossible d\'attribuer le rôle Contrôleur.' }, { status: 500 });
            }
            const { error: metaErr } = await supabase.auth.admin.updateUserById(controllerId, {
                user_metadata: { is_temporary_controller_account: false },
            });
            if (metaErr) console.warn('[PATCH team/assignments] métadonnée is_temporary_controller_account :', metaErr.message);
            // Lot 1C.3 : révocation réelle des sessions (auth.admin.signOut(userId) était sans effet)
            if (!(await revokeUserSessions(controllerId, { reason: 'CONTROLLER_REMOVED', actorId: user.id }))) {
                return NextResponse.json({ error: 'Rôle Contrôleur retiré, mais la révocation des sessions a échoué. Réessayez.' }, { status: 500 });
            }
        }

        // 3. Récupérer les affectations actuelles de ce contrôleur chez ce partenaire
        const { data: currentAssignments, error: caErr } = await supabase
            .from('event_controllers')
            .select('id, event_id, can_accept_cash')
            .eq('user_id', controllerId)
            .in('event_id', partnerEventIds);

        if (caErr) {
            return NextResponse.json({ error: 'Impossible de lire les affectations actuelles.' }, { status: 500 });
        }

        const currentEventIds = (currentAssignments ?? []).map(a => a.event_id);
        const toAdd = requestedEventIds.filter(id => !currentEventIds.includes(id));
        const toRemove = currentEventIds.filter(id => !requestedEventIds.includes(id));

        // Vérification stricte : seuls les événements confirmés (VALIDE ou PUBLIE) peuvent être nouvellement affectés
        for (const evId of toAdd) {
            const ev = partnerEventMap.get(evId);
            if (!ev || !isEventEligibleForController(ev.status)) {
                return NextResponse.json({
                    error: INELIGIBLE_EVENT_ASSIGNMENT_ERROR,
                    details: `L'événement "${ev?.title ?? evId}" est en statut ${ev?.status ?? 'inconnu'}. Seuls les événements confirmés (VALIDÉ ou PUBLIÉ) peuvent être affectés.`,
                }, { status: 400 });
            }
        }

        // 4. Supprimer les événements décochés. Lot 4.7 : une caisse OUVERT sur l'un d'eux fait refuser
        //    la suppression entière par le trigger controller_removal_guard (CONTROLLER_HAS_OPEN_SHIFT).
        if (toRemove.length > 0) {
            const idsToDelete = (currentAssignments ?? [])
                .filter(a => toRemove.includes(a.event_id))
                .map(a => a.id);

            const { error: delErr } = await supabase
                .from('event_controllers')
                .delete()
                .in('id', idsToDelete);
            if (isControllerRemovalBlocked(delErr)) {
                return NextResponse.json(controllerRemovalConflict(), { status: 409 });
            }
            if (delErr) {
                console.error('[PATCH team/assignments] retrait des affectations :', delErr.message);
                return NextResponse.json({ error: 'Impossible de retirer les affectations décochées.' }, { status: 500 });
            }
        }

        // 5. Insérer les nouveaux événements cochés
        if (toAdd.length > 0) {
            const rowsToInsert = toAdd.map(eventId => ({
                event_id: eventId,
                user_id: controllerId,
                can_accept_cash: can_accept_cash ?? false,
                created_by: user.id,
            }));

            const { error: insErr } = await supabase
                .from('event_controllers')
                .insert(rowsToInsert);

            if (insErr) {
                console.error('[PATCH team/assignments] insert error:', insErr.message);
                return NextResponse.json({ error: 'Impossible d\'ajouter les nouvelles affectations.' }, { status: 500 });
            }
        }

        // 6. Si can_accept_cash a changé sur les assignations existantes
        if (can_accept_cash !== undefined) {
            const remainingToUpdate = requestedEventIds.filter(id => !toAdd.includes(id));
            if (remainingToUpdate.length > 0) {
                await supabase
                    .from('event_controllers')
                    .update({ can_accept_cash })
                    .eq('user_id', controllerId)
                    .in('event_id', remainingToUpdate);
            }
        }

        // 7. (Lot 1B.6) Plus de réactivation : un compte non ACTIF a été refusé en 2.5.

        // 8. Notifications
        if (ctrlUser?.phone) {
            try {
                await mTargetService.sendControllerAssignmentsUpdatedNotice(ctrlUser.phone, requestedEventIds.length, { actorId: user.id });
            } catch (smsErr) {
                console.warn('[PATCH team/assignments] SMS non-bloquant:', smsErr);
            }
        }

        try {
            await NotificationService.createNotification({
                userId: controllerId,
                title: 'Affectations mises à jour',
                message: `Vos événements assignés ont été mis à jour (${requestedEventIds.length} actif(s)).`,
                type: 'SYSTEM',
                data: {
                    partner_id: partnerId,
                    added: toAdd,
                    removed: toRemove,
                    total_active: requestedEventIds.length,
                },
            });
        } catch (notifErr) {
            console.warn('[PATCH team/assignments] In-app non-bloquante:', notifErr);
        }

        // 9. Audit
        try {
            await AdminService.logAudit({
                userId: user.id,
                userRole: user.role as any,
                action: 'CONTROLLER_ASSIGNMENTS_UPDATED',
                objectType: 'event_controllers',
                objectId: controllerId,
                oldValue: { event_ids: currentEventIds },
                newValue: { event_ids: requestedEventIds, added: toAdd, removed: toRemove },
                metadata: { partner_id: partnerId, controller_id: controllerId },
            });
        } catch (auditErr) {
            console.warn('[PATCH team/assignments] Audit non-bloquant:', auditErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Affectations synchronisées avec succès.',
            added: toAdd,
            removed: toRemove,
            total_active: requestedEventIds.length,
        });

    } catch (err: unknown) {
        console.error('[PATCH /api/partner/team/assignments] catch:', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
