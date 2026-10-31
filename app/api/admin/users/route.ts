import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminService } from '@/lib/admin/admin.service';
import { pgIlikeContains } from '@/lib/security/postgrest-filter';
import { grantUserRoles, setUserRoles, type UserRoleType } from '@/lib/auth/roles';
import { revokeUserSessions } from '@/lib/auth/sessions';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

const ASSIGNABLE_ROLES: readonly UserRoleType[] = ['CLIENT', 'PARTENAIRE', 'CONTROLEUR', 'ADMIN', 'SUPERADMIN'];

/**
 * GET /api/admin/users
 * Récupère la liste réelle des utilisateurs avec recherche, filtres et métriques de parrainage
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { searchParams } = new URL(req.url);
        const roleFilter = searchParams.get('role');
        const referralFilter = searchParams.get('referralStatus');
        const search = searchParams.get('search')?.trim();

        const supabase = getServiceRoleClient();

        let query = supabase
            .from('users')
            .select(`
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                status,
                referral_status,
                created_at,
                updated_at
            `)
            .order('created_at', { ascending: false });

        if (roleFilter && roleFilter !== 'ALL') {
            query = query.eq('role', roleFilter as any);
        }

        if (referralFilter && referralFilter !== 'ALL') {
            query = query.eq('referral_status', referralFilter as any);
        }

        if (search) {
            // Lot 1C.1 : terme assaini (guillemets PostgREST, jokers échappés) ; une virgule n'ajoute plus de condition
            query = query.or(`first_name.ilike.${pgIlikeContains(search)},last_name.ilike.${pgIlikeContains(search)},email.ilike.${pgIlikeContains(search)},phone.ilike.${pgIlikeContains(search)}`);
        }

        const { data: users, error } = await query;

        if (error) {
            console.error('[API /api/admin/users] Erreur:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            users: users || [],
            total: users?.length || 0,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/users] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

/**
 * POST /api/admin/users
 * Création directe et atomique d'un utilisateur métier (Contrôleur, Admin, Client, Superadmin)
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { firstName, lastName, phone, email, password, role } = body;

        if (!firstName || !lastName || !phone || !password) {
            return NextResponse.json({ error: 'Nom, prénom, téléphone et mot de passe requis.' }, { status: 400 });
        }

        const targetRole = (role || 'CLIENT') as UserRoleType;
        if (!ASSIGNABLE_ROLES.includes(targetRole)) {
            return NextResponse.json({ error: `Rôle inconnu : ${String(role)}.` }, { status: 400 });
        }

        // Protection contre l'élévation de privilèges
        if (targetRole === 'SUPERADMIN' && auth.user!.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Seul un Superadmin peut créer un compte SUPERADMIN.' },
                { status: 403 }
            );
        }

        const normalizedPhone = phone.trim().startsWith('+') ? phone.trim() : `+221${phone.trim().replace(/^0+/, '').replace(/\s+/g, '')}`;
        const effectiveEmail = email?.trim() 
            ? email.trim().toLowerCase() 
            : `${normalizedPhone.replace('+', '')}@eventvillage.internal`;
        const supabase = getServiceRoleClient();

        // 1. Création dans Supabase Auth
        //    phone au niveau racine → auth.users.phone renseigné pour récupération SMS
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: effectiveEmail,
            phone: normalizedPhone,
            password: password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
            },
        });

        if (authErr) {
            console.error('[API /api/admin/users POST] Erreur auth admin:', authErr);
            return NextResponse.json({ error: authErr.message }, { status: 400 });
        }

        const userId = authData.user.id;

        // 1 bis. Attribution explicite du rôle (lot 1A : le trigger d'inscription ne crée plus que CLIENT).
        try {
            await grantUserRoles(userId, [targetRole]);
        } catch (roleErr) {
            console.error('[API /api/admin/users POST] Attribution du rôle impossible:', roleErr);
            return NextResponse.json({ error: 'Compte créé mais attribution du rôle impossible. Réessayez.' }, { status: 500 });
        }

        // 2. Synchronisation dans public.users
        const { error: upsertErr } = await supabase.from('users').upsert({
            id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: normalizedPhone,
            email: effectiveEmail,
            role: targetRole,
            status: 'ACTIF',
            referral_status: 'STANDARD',
            updated_at: new Date().toISOString(),
        });

        if (upsertErr) {
            console.error('[API /api/admin/users POST] Erreur upsert public.users:', upsertErr);
            return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }

        // 3. Journal d'audit inaltérable
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'CREATE_USER',
            objectType: 'users',
            objectId: userId,
            newValue: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone: normalizedPhone,
                role: targetRole,
            },
            metadata: { created_by: auth.user!.role },
        });

        return NextResponse.json({
            success: true,
            userId,
            message: `Utilisateur avec le rôle ${targetRole} créé avec succès.`,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/users
 * Mise à jour du rôle ou du statut Ambassadeur d'un utilisateur
 */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: { userId?: string; role?: string; roles?: unknown; referralStatus?: unknown; status?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { userId, role, roles: requestedRoles, referralStatus, status } = body;
        if (!userId) {
            return NextResponse.json({ error: 'userId requis.' }, { status: 400 });
        }

        // Lot 4.0 : le statut ambassadeur fixe les taux de commission. SUPERADMIN seul (users.write
        // ne suffit pas, sur un tiers comme sur soi-même), valeur STANDARD ou AMBASSADEUR ; contrôlé
        // avant toute écriture (rôles compris).
        let referralValue: 'STANDARD' | 'AMBASSADEUR' | undefined;
        if (referralStatus !== undefined) {
            if (!auth.user!.roles.includes('SUPERADMIN')) {
                return NextResponse.json(
                    { error: 'Seul un SUPERADMIN peut modifier le statut ambassadeur.', code: 'REFERRAL_STATUS_SUPERADMIN_ONLY' },
                    { status: 403 }
                );
            }
            if (referralStatus !== 'STANDARD' && referralStatus !== 'AMBASSADEUR') {
                return NextResponse.json(
                    { error: `Statut de parrainage invalide : ${JSON.stringify(referralStatus)} (STANDARD ou AMBASSADEUR).`, code: 'INVALID_REFERRAL_STATUS' },
                    { status: 400 }
                );
            }
            referralValue = referralStatus;
        }

        // Lot 1B.8 : `roles` fixe l'ensemble exact des rôles ; `role` (contrat historique) vaut
        // `roles: [role]`. CLIENT est toujours conservé. Écriture dans user_roles, source de la RLS.
        let targetRoles: UserRoleType[] | null = null;
        if (requestedRoles !== undefined || role !== undefined) {
            const list: unknown = requestedRoles !== undefined ? requestedRoles : [role];
            if (!Array.isArray(list) || list.length === 0 || list.some((r) => !ASSIGNABLE_ROLES.includes(r as UserRoleType))) {
                return NextResponse.json({ error: `Rôles invalides : ${JSON.stringify(list)}.` }, { status: 400 });
            }
            targetRoles = list as UserRoleType[];
        }

        const supabase = getServiceRoleClient();

        // 1. Récupération du profil cible et de ses rôles effectifs
        const { data: targetUser, error: targetErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (targetErr || !targetUser) {
            return NextResponse.json({ error: 'Utilisateur cible introuvable.' }, { status: 404 });
        }

        const { data: targetRoleRows, error: targetRolesErr } = await supabase.from('user_roles').select('role').eq('user_id', userId);
        if (targetRolesErr) {
            console.error('[API /api/admin/users PATCH] lecture des rôles cibles :', targetRolesErr.message);
            return NextResponse.json({ error: 'Lecture des rôles du compte impossible.' }, { status: 500 });
        }
        const targetCurrentRoles = (targetRoleRows || []).map((r) => r.role as string);
        const actorIsSuperadmin = auth.user!.roles.includes('SUPERADMIN');

        // 2. Protection contre l'élévation de privilèges Superadmin
        if (targetRoles?.includes('SUPERADMIN') && !actorIsSuperadmin) {
            return NextResponse.json(
                { error: 'Seul un Superadmin peut élever un utilisateur au rang de SUPERADMIN.' },
                { status: 403 }
            );
        }

        // 3. Protection contre la modification d'un Superadmin par un Admin ordinaire
        if ((targetCurrentRoles.includes('SUPERADMIN') || targetUser.role === 'SUPERADMIN') && !actorIsSuperadmin) {
            return NextResponse.json(
                { error: 'Impossible de modifier un compte SUPERADMIN sans être soi-même SUPERADMIN.' },
                { status: 403 }
            );
        }

        // 4. Rôles : ajout et retrait dans user_roles (le trigger recalcule users.role)
        //    Lot 4.7 : retirer CONTROLEUR à un compte qui a une caisse OUVERT est refusé par le trigger
        //    controller_removal_guard (CONTROLLER_HAS_OPEN_SHIFT) → 409, rien d'autre n'est modifié.
        let roleChange: Awaited<ReturnType<typeof setUserRoles>> | null = null;
        if (targetRoles) {
            try {
                roleChange = await setUserRoles(userId, targetRoles);
            } catch (roleErr) {
                if (isControllerRemovalBlocked(roleErr)) {
                    return NextResponse.json(controllerRemovalConflict(), { status: 409 });
                }
                throw roleErr;
            }
        }

        // 5. Autres attributs du profil (le rôle legacy n'est plus écrit directement)
        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (referralValue) updatePayload.referral_status = referralValue;
        if (status) updatePayload.status = status;

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('[API /api/admin/users PATCH] Erreur:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 6. Lot 1C.3 : rôle retiré ou compte non actif → sessions révoquées (déconnexion forcée réelle)
        const rolesRemoved = (roleChange?.removed.length ?? 0) > 0;
        const deactivated = status !== undefined && status !== 'ACTIF';
        if (rolesRemoved || deactivated) {
            const revoked = await revokeUserSessions(userId, {
                reason: deactivated ? `STATUS_${status}` : 'ROLES_REMOVED',
                actorId: auth.user!.id,
            });
            if (!revoked) {
                return NextResponse.json({ error: 'Compte mis à jour, mais la révocation des sessions a échoué. Réessayez.' }, { status: 500 });
            }
        }

        // 7. Journal d'audit inaltérable
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'UPDATE_USER',
            objectType: 'users',
            objectId: userId,
            oldValue: { roles: targetCurrentRoles, role: targetUser.role, referral_status: targetUser.referral_status, status: targetUser.status },
            newValue: {
                ...updatePayload,
                ...(roleChange ? { roles: roleChange.after, roles_added: roleChange.added, roles_removed: roleChange.removed } : {}),
            },
            metadata: { target_email: targetUser.email },
        });

        return NextResponse.json({
            success: true,
            user: updatedUser,
            roles: roleChange ? roleChange.after : targetCurrentRoles,
            message: 'Utilisateur mis à jour avec succès.',
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/users
 * Suppression définitive d'un compte utilisateur (Auth + Base de données en cascade)
 */
export async function DELETE(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const url = new URL(req.url);
        let userId = url.searchParams.get('userId');

        if (!userId) {
            try {
                const body = await req.json();
                userId = body.userId;
            } catch {
                // Ignore
            }
        }

        if (!userId) {
            return NextResponse.json({ error: 'userId requis.' }, { status: 400 });
        }

        const result = await AdminService.deleteUser(userId, {
            id: auth.user!.id,
            role: auth.user!.role,
        });

        return NextResponse.json({
            success: true,
            message: result.message,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/users DELETE] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
}

