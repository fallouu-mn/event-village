import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';
import { revokeUserSessions } from '@/lib/auth/sessions';

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
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
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

        // 2-3. Suppression atomique (verrou consultatif + FOR UPDATE, Faille 3.3). Lot 4.7 : une caisse
        //    OUVERT fait refuser toute la transaction par le trigger controller_removal_guard (affectation
        //    ou rôle CONTROLEUR) → 409 ; plus de pré-contrôle applicatif ni de repli si la RPC échoue.
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('atomic_partner_remove_controller', {
            p_partner_id: partnerId,
            p_controller_id: controllerId,
        });
        if (isControllerRemovalBlocked(rpcErr)) {
            return NextResponse.json(controllerRemovalConflict(), { status: 409 });
        }
        if (rpcErr || !rpcResult) {
            console.error('[DELETE team/controller] atomic_partner_remove_controller :', rpcErr?.message ?? 'réponse vide');
            return NextResponse.json({ error: 'Retrait du contrôleur impossible.' }, { status: 500 });
        }
        const isExclusivelyInThisTeam = !!rpcResult.is_exclusive;

        // 4. Récupérer les infos du contrôleur pour la notification
        const { data: ctrlProfile } = await supabase
            .from('users')
            .select('id, phone, first_name, last_name, role, status')
            .eq('id', controllerId)
            .maybeSingle();

        // 5. Si le contrôleur n'a plus d'autres affectations partenaires (Cas A - Exclusif) :
        // le rôle CONTROLEUR est retiré de user_roles (le trigger recalcule users.role) ;
        // le statut du compte n'est pas modifié (lot 1B.6 : un compte SUSPENDU le reste).
        if (isExclusivelyInThisTeam && ctrlProfile) {
            const { error: roleDelErr } = await supabase.from('user_roles').delete().eq('user_id', controllerId).eq('role', 'CONTROLEUR');
            if (isControllerRemovalBlocked(roleDelErr)) {
                return NextResponse.json(controllerRemovalConflict(), { status: 409 });
            }
            if (roleDelErr) {
                console.error('[DELETE team/controller] retrait du rôle CONTROLEUR :', roleDelErr.message);
                return NextResponse.json({ error: 'Retrait du rôle Contrôleur impossible.' }, { status: 500 });
            }

            const { error: metaErr } = await supabase.auth.admin.updateUserById(controllerId, {
                user_metadata: { is_temporary_controller_account: false },
            });
            if (metaErr) console.warn('[DELETE team/controller] métadonnée is_temporary_controller_account :', metaErr.message);

            // Lot 1C.3 : révocation réelle des sessions (auth.admin.signOut(userId) était sans effet)
            if (!(await revokeUserSessions(controllerId, { reason: 'CONTROLLER_REMOVED', actorId: user.id }))) {
                return NextResponse.json({ error: 'Rôle Contrôleur retiré, mais la révocation des sessions a échoué. Réessayez.' }, { status: 500 });
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
                await mTargetService.sendControllerAccountDeletedNotice(ctrlProfile.phone, { actorId: user.id });
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
