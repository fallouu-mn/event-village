import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { ShiftService } from '@/lib/shifts/shift.service';
import { removeUserRole } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────
// DELETE /api/partner/team/controller/[controllerId]
// Suppression complète d'un contrôleur de l'équipe (Partie 5 CDC).
// - Supprime toutes ses affectations sur les événements du partenaire courant.
// - Révoque son rôle CONTROLEUR et suspend le profil pour bloquer toute connexion.
// - Invalide globalement toutes les sessions actives dans GoTrue (signOut).
// - Préserve l'intégrité référentielle FK (scans, orders, audit_logs restent intacts).
// - Permet une réinvitation ultérieure comme nouvelle intégration propre.
// ──────────────────────────────────────────────────────────
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ controllerId: string }> | { controllerId: string } }
) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const controllerId = resolvedParams?.controllerId;
        if (!controllerId) {
            return NextResponse.json({ error: 'controllerId requis.' }, { status: 400 });
        }

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

        // 2. Récupérer les événements du partenaire
        let eventsQuery = supabase.from('events').select('id, title');
        if (partnerId) {
            eventsQuery = eventsQuery.eq('partner_id', partnerId);
        }
        const { data: partnerEvents } = await eventsQuery;
        const partnerEventIds = (partnerEvents ?? []).map(e => e.id);

        // 2.bis Blocage si une session de caisse est encore OUVERTE (Pre-Mortem §2.1 & Phase 5)
        const hasOpenShift = await ShiftService.hasActiveShift(controllerId, partnerEventIds);
        if (hasOpenShift) {
            return NextResponse.json({
                error: 'Ce contrôleur a une session de caisse ouverte, clôturez-la avant de le retirer.',
                code: 'OPEN_SHIFT_EXISTS',
            }, { status: 400 });
        }

        // 3. Suppression atomique protégée contre les race conditions multi-partenaires (Faille 3.3)
        let isExclusivelyInThisTeam = false;
        let remainingAssignments = 0;

        // Tentative d'exécution atomique via fonction PostgreSQL (advisory lock + FOR UPDATE)
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('atomic_partner_remove_controller', {
            p_partner_id: partnerId,
            p_controller_id: controllerId,
        });

        if (!rpcErr && rpcResult) {
            isExclusivelyInThisTeam = !!rpcResult.is_exclusive;
            remainingAssignments = rpcResult.remaining_assignments ?? 0;
        } else {
            // Fallback applicatif si l'RPC n'est pas disponible dans l'environnement
            if (partnerEventIds.length > 0) {
                await supabase
                    .from('event_controllers')
                    .delete()
                    .eq('user_id', controllerId)
                    .in('event_id', partnerEventIds);
            }

            const { count: remCount } = await supabase
                .from('event_controllers')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', controllerId);

            remainingAssignments = remCount ?? 0;
            isExclusivelyInThisTeam = remainingAssignments === 0;

            if (isExclusivelyInThisTeam) {
                // MULTI-RÔLE : retirer CONTROLEUR de user_roles, le trigger sync users.role
                try {
                    await removeUserRole(controllerId, 'CONTROLEUR');
                } catch (roleErr) {
                    console.warn('[DELETE team/controller] removeUserRole fallback:', roleErr);
                }

                await supabase.from('users').update({
                    role: 'CLIENT',
                    status: 'ACTIF',
                }).eq('id', controllerId);
            }
        }

        // 4. Récupérer les infos du contrôleur pour la notification
        const { data: ctrlProfile } = await supabase
            .from('users')
            .select('id, phone, first_name, last_name, role, status')
            .eq('id', controllerId)
            .maybeSingle();

        // 5. Si le contrôleur n'a plus d'autres affectations partenaires (Cas A - Exclusif) :
        // Le rôle est rétrogradé vers 'CLIENT' et le statut reste strictement 'ACTIF' pour préserver son compte
        if (isExclusivelyInThisTeam && ctrlProfile) {
            await supabase.from('user_roles').delete().eq('user_id', controllerId).eq('role', 'CONTROLEUR');

            await supabase.from('users').update({
                role: 'CLIENT',
                status: 'ACTIF',
            }).eq('id', controllerId);

            await supabase.auth.admin.updateUserById(controllerId, {
                user_metadata: { role: 'CLIENT', is_temporary_controller_account: false },
            });

            // Invalider les sessions GoTrue actives pour purger l'ancien token JWT CONTROLEUR
            try {
                await supabase.auth.admin.signOut(controllerId, 'global');
            } catch (authSignOutErr) {
                console.warn('[DELETE team/controller] signOut auth non-bloquant:', authSignOutErr);
            }

            // Supprimer tout OTP résiduel
            if (ctrlProfile?.phone) {
                try {
                    await supabase.from('otp_codes').delete().eq('phone', ctrlProfile.phone);
                } catch (otpErr) {
                    console.warn('[DELETE team/controller] otp_codes delete non-bloquant:', otpErr);
                }
            }
        }

        // 7. Notification SMS
        if (ctrlProfile?.phone) {
            try {
                await mTargetService.sendControllerAccountDeletedNotice(ctrlProfile.phone);
            } catch (smsErr) {
                console.warn('[DELETE team/controller] SMS non bloquant:', smsErr);
            }
        }

        // 8. Notification In-App
        try {
            await NotificationService.createNotification({
                userId: controllerId,
                title: 'Compte Contrôleur Retiré',
                message: 'Vous avez été retiré de l\'équipe des contrôleurs par l\'organisateur.',
                type: 'SYSTEM',
                data: { partner_id: partnerId, removed_by: user.id },
            });
        } catch (notifErr) {
            console.warn('[DELETE team/controller] Notif in-app non bloquante:', notifErr);
        }

        // 9. Journalisation d'audit
        try {
            await AdminService.logAudit({
                userId: user.id,
                userRole: user.role as any,
                action: 'CONTROLLER_DELETED',
                objectType: 'users',
                objectId: controllerId,
                oldValue: { role: ctrlProfile?.role, status: ctrlProfile?.status },
                newValue: { status: 'ACTIF', role: isExclusivelyInThisTeam ? 'CLIENT' : ctrlProfile?.role },
                metadata: {
                    partner_id: partnerId,
                    controller_id: controllerId,
                    deleted_by: user.id,
                    is_exclusively_in_this_team: isExclusivelyInThisTeam,
                },
            });
        } catch (auditErr) {
            console.warn('[DELETE team/controller] Audit log non bloquant:', auditErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Contrôleur supprimé de l\'équipe avec succès.',
            deactivated: isExclusivelyInThisTeam,
        });

    } catch (err: unknown) {
        console.error('[DELETE /api/partner/team/controller] catch:', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
