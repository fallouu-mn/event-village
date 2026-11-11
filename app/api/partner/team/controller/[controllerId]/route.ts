import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverHasRole, serverIsAdmin, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';
import { revokeUserSessions } from '@/lib/auth/sessions';
import { adminTeamRefusal } from '../../team-access';

export const dynamic = 'force-dynamic';

const UUID = z.string().uuid();

type RemovalReply = {
    ok?: boolean;
    code?: string;
    message?: string;
    removed_assignments?: number;
    remaining_assignments?: number;
    is_exclusive?: boolean;
    role_removed?: boolean;
};

// ──────────────────────────────────────────────────────────
// DELETE /api/partner/team/controller/[controllerId][?partnerId=<uuid>]
// Retrait d'un contrôleur de l'équipe d'un organisateur (lot 5, C3) : retrait réel ou refus explicite,
// jamais un faux succès.
//  - Partenaire : son équipe. Admin : ?partnerId= obligatoire (400 PARTNER_SCOPE_REQUIRED sinon).
//  - RPC atomic_partner_remove_controller : affectations de ce partenaire supprimées, rôle CONTROLEUR
//    retiré s'il ne reste aucune affectation ; caisse ouverte → 409 (trigger controller_removal_guard).
//  - Rien retiré (contrôleur hors de cette équipe, inexistant) → 404 CONTROLLER_NOT_IN_TEAM, sans SMS
//    ni notification.
//  - Rôle retiré : sessions révoquées, codes OTP résiduels supprimés. Puis journal ; les avis au
//    contrôleur passent par la boîte d'envoi (trigger sur event_controllers, lot 6).
// ──────────────────────────────────────────────────────────
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ controllerId: string }> | { controllerId: string } }
) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès non autorisé.', code: 'FORBIDDEN' }, { status: 403 });
    }
    // Lot 9 bis (R2, B31) : un admin retire un contrôleur de l'équipe avec events.write
    const denied = await adminTeamRefusal(user, 'events.write');
    if (denied) return denied;

    const resolvedParams = await Promise.resolve(context?.params);
    const controllerId = resolvedParams?.controllerId;
    if (!controllerId || !UUID.safeParse(controllerId).success) {
        return NextResponse.json({ error: 'Identifiant de contrôleur invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
    }
    const partnerParam = req.nextUrl.searchParams.get('partnerId');
    if (partnerParam !== null && !UUID.safeParse(partnerParam).success) {
        return NextResponse.json({ error: 'Identifiant d’organisateur invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
    }

    try {
        const supabase = getServiceRoleClient();

        // 1. Portée : l'organisateur dont l'équipe est modifiée
        let partnerId: string | null = null;
        if (serverIsAdmin(user) && partnerParam) {
            partnerId = partnerParam;
        } else if (serverHasRole(user, 'PARTENAIRE')) {
            const { data: p, error: pErr } = await supabase.from('partners').select('id').eq('user_id', user.id).maybeSingle();
            if (pErr) throw new Error(`lecture du profil partenaire : ${pErr.message}`);
            if (!p) return NextResponse.json({ error: 'Profil partenaire introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
            partnerId = String(p.id);
        } else {
            return NextResponse.json({
                error: 'Précisez l’organisateur dont le contrôleur doit être retiré (paramètre partnerId).',
                code: 'PARTNER_SCOPE_REQUIRED',
            }, { status: 400 });
        }

        // 2. Retrait atomique (verrou consultatif + profil FOR UPDATE)
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('atomic_partner_remove_controller', {
            p_partner_id: partnerId,
            p_controller_id: controllerId,
        });
        if (isControllerRemovalBlocked(rpcErr)) {
            return NextResponse.json(controllerRemovalConflict(), { status: 409 });
        }
        if (rpcErr || !rpcResult) throw new Error(`atomic_partner_remove_controller : ${rpcErr?.message ?? 'réponse vide'}`);
        const removal = rpcResult as RemovalReply;
        if (removal.ok !== true) {
            if (removal.code === 'CONTROLLER_NOT_IN_TEAM') {
                return NextResponse.json({ error: 'Ce contrôleur ne fait pas partie de cette équipe.', code: 'CONTROLLER_NOT_IN_TEAM' }, { status: 404 });
            }
            if (removal.code === 'PARTNER_NOT_FOUND') {
                return NextResponse.json({ error: 'Organisateur introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
            }
            throw new Error(`atomic_partner_remove_controller : refus inattendu ${JSON.stringify(removal)}`);
        }
        const roleRemoved = removal.role_removed === true;

        const { data: ctrlProfile, error: ctrlErr } = await supabase
            .from('users')
            .select('id, phone, role, status')
            .eq('id', controllerId)
            .maybeSingle();
        if (ctrlErr) throw new Error(`lecture du contrôleur : ${ctrlErr.message}`);

        // 3. Rôle CONTROLEUR retiré par la RPC : sessions révoquées, OTP résiduels supprimés. Lot 9 bis (R40, B63) : la
        //    marque d'activation n'est plus réécrite (un compte activé l'a déjà à false ; un compte jamais activé la
        //    garde, et une réinvitation lui envoie un nouveau code).
        if (roleRemoved) {
            if (!(await revokeUserSessions(controllerId, { reason: 'CONTROLLER_REMOVED', actorId: user.id }))) {
                return NextResponse.json({ error: 'Rôle Contrôleur retiré, mais la révocation des sessions a échoué. Réessayez.', code: 'SESSIONS_NOT_REVOKED' }, { status: 500 });
            }
            if (ctrlProfile?.phone) {
                const { error: otpErr } = await supabase.from('otp_codes').delete().eq('phone', ctrlProfile.phone);
                if (otpErr) console.error('[DELETE team/controller] suppression des codes OTP résiduels :', otpErr.message);
            }
        }

        // 4. Lot 6 (J2.4) : l'avis de retrait (in-app et push par affectation, un SMS regroupé) est mis
        //    en file par le trigger trg_event_controllers_notify dans la transaction de la RPC.

        await AdminService.logAudit({
            userId: user.id,
            userRole: String(user.role),
            action: 'CONTROLLER_DELETED',
            objectType: 'users',
            objectId: controllerId,
            oldValue: { role: ctrlProfile?.role, status: ctrlProfile?.status },
            newValue: { role_removed: roleRemoved, removed_assignments: removal.removed_assignments },
            metadata: {
                partner_id: partnerId,
                controller_id: controllerId,
                deleted_by: user.id,
                removed_assignments: removal.removed_assignments,
                remaining_assignments: removal.remaining_assignments,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Contrôleur retiré de l’équipe.',
            removed_assignments: Number(removal.removed_assignments ?? 0),
            deactivated: roleRemoved,
            notification: 'QUEUED',
        });
    } catch (err: unknown) {
        console.error('[DELETE /api/partner/team/controller] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Retrait du contrôleur momentanément impossible.', code: 'REMOVAL_FAILED' }, { status: 500 });
    }
}
