import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionUser, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { isEventEligibleForController, INELIGIBLE_EVENT_ASSIGNMENT_ERROR } from '@/lib/events/event-status';
import { ShiftService } from '@/lib/shifts/shift.service';

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
        const user = await getServerSessionUser(req);
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

        if (ctrlUser.role !== 'CONTROLEUR' && ctrlUser.role !== 'ADMIN' && ctrlUser.role !== 'SUPERADMIN') {
            if (!confirm_promotion) {
                const clientFullName = [ctrlUser.first_name, ctrlUser.last_name].filter(Boolean).join(' ') || 'Utilisateur';
                return NextResponse.json({
                    requires_confirmation: true,
                    existing_user: {
                        id: ctrlUser.id,
                        first_name: ctrlUser.first_name,
                        last_name: ctrlUser.last_name,
                        phone: ctrlUser.phone,
                        role: ctrlUser.role,
                    },
                    message: `Compte existant détecté — ${clientFullName} (${ctrlUser.phone}) possède le rôle ${ctrlUser.role}. Voulez-vous lui attribuer le rôle Contrôleur pour vos événements ?`,
                }, { status: 200 });
            }

            // Confirmation fournie -> promouvoir de façon cohérente (DB + Auth metadata + déconnexion session)
            await Promise.all([
                supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF', updated_at: new Date().toISOString() }).eq('id', controllerId),
                supabase.auth.admin.updateUserById(controllerId, {
                    user_metadata: { role: 'CONTROLEUR', is_temporary_controller_account: false },
                }),
            ]);
            try {
                await supabase.auth.admin.signOut(controllerId, 'global');
            } catch { /* notice */ }
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

        // 4. Supprimer les événements décochés
        if (toRemove.length > 0) {
            // Blocage si une session de caisse est encore OUVERTE sur l'un des événements à retirer
            const hasOpenShift = await ShiftService.hasActiveShift(controllerId, toRemove);
            if (hasOpenShift) {
                return NextResponse.json({
                    error: 'Ce contrôleur a une session de caisse ouverte, clôturez-la avant de le retirer.',
                    code: 'OPEN_SHIFT_EXISTS',
                }, { status: 400 });
            }

            const idsToDelete = (currentAssignments ?? [])
                .filter(a => toRemove.includes(a.event_id))
                .map(a => a.id);

            await supabase
                .from('event_controllers')
                .delete()
                .in('id', idsToDelete);
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

        // 7. S'assurer que le profil est ACTIF
        if (ctrlUser && ctrlUser.status !== 'ACTIF') {
            await supabase
                .from('users')
                .update({ status: 'ACTIF' })
                .eq('id', controllerId);
        }

        // 8. Notifications
        if (ctrlUser?.phone) {
            try {
                await mTargetService.sendControllerAssignmentsUpdatedNotice(ctrlUser.phone, requestedEventIds.length);
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
