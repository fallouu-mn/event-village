import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';

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
        if (user.role !== 'PARTENAIRE' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
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
        if (user.role === 'PARTENAIRE') {
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

        // 3. Supprimer toutes les affectations de ce contrôleur pour ce partenaire
        if (partnerEventIds.length > 0) {
            await supabase
                .from('event_controllers')
                .delete()
                .eq('user_id', controllerId)
                .in('event_id', partnerEventIds);
        }

        // 4. Vérifier s'il reste des affectations actives avec d'autres partenaires
        const { count: remainingAssignments } = await supabase
            .from('event_controllers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', controllerId);

        const isExclusivelyInThisTeam = (remainingAssignments ?? 0) === 0;

        // 5. Récupérer les infos du contrôleur pour la notification
        const { data: ctrlProfile } = await supabase
            .from('users')
            .select('id, phone, first_name, last_name, role, status')
            .eq('id', controllerId)
            .maybeSingle();

        // 6. Si le contrôleur n'a plus d'autres affectations partenaires :
        // Dégrader le rôle et suspendre pour bloquer immédiatement l'accès au scanner
        if (isExclusivelyInThisTeam && ctrlProfile) {
            await supabase
                .from('users')
                .update({
                    role: 'CLIENT',
                    status: 'SUSPENDU',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', controllerId);

            // Invalider les sessions GoTrue actives
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
                newValue: { status: isExclusivelyInThisTeam ? 'SUSPENDU' : ctrlProfile?.status, role: isExclusivelyInThisTeam ? 'CLIENT' : ctrlProfile?.role },
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
