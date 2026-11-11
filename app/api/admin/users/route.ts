import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminService } from '@/lib/admin/admin.service';
import { pgIlikeContains } from '@/lib/security/postgrest-filter';
import { RoleChangeError, setUserRoles, type UserRoleType } from '@/lib/auth/roles';
import { revokeUserSessions } from '@/lib/auth/sessions';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';
import { technicalEmailOf } from '@/lib/auth/account-sync';
import { TECHNICAL_EMAIL_RE } from '@/lib/notifications/channels';
import { RESERVED_EMAIL_MESSAGE } from '@/lib/validations/auth';
import { emailVerificationState, sendEmailVerification, type EmailVerificationState } from '@/lib/email/verification';

/** Forme minimale d'une adresse saisie (la contrainte users_email_pending_chk de M10 refait le contrôle). */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = 'force-dynamic';

/** Refus de user_roles_set (lot 5, C4) traduits pour l'écran ; un autre refus est une erreur technique. */
const ROLE_CHANGE_REFUSALS: Record<string, [number, string]> = {
    FORBIDDEN: [403, 'Changement de rôles réservé à un administrateur actif.'],
    SUPERADMIN_REQUIRED: [403, 'Seul un superadmin peut attribuer ou retirer le rôle de superadmin.'],
    INVALID_ROLE: [400, 'Rôle inconnu.'],
    USER_NOT_FOUND: [404, 'Utilisateur cible introuvable.'],
    ADMIN_ROLE_SUPERADMIN_ONLY: [403, 'Seul un superadmin peut créer un administrateur ou changer ce rôle.'],
};

/** Lot 9 bis (R71, B33) : créer un admin, ajouter ou retirer le rôle ADMIN, suspendre un admin : SUPERADMIN seul. */
function adminRoleSuperadminOnly(): NextResponse {
    return NextResponse.json(
        { error: ROLE_CHANGE_REFUSALS.ADMIN_ROLE_SUPERADMIN_ONLY[1], code: 'ADMIN_ROLE_SUPERADMIN_ONLY' },
        { status: 403 }
    );
}

const ASSIGNABLE_ROLES: readonly UserRoleType[] = ['CLIENT', 'PARTENAIRE', 'CONTROLEUR', 'ADMIN', 'SUPERADMIN'];

/** Refus de Supabase Auth à la création d'un compte, par code stable : jamais son texte anglais à l'écran. */
const AUTH_CREATE_REFUSALS = new Map<string, string>([
    ['email_exists', 'Cet email est déjà associé à un compte.'],
    ['phone_exists', 'Ce numéro de téléphone est déjà associé à un compte.'],
    ['user_already_exists', 'Ce numéro de téléphone ou cet email est déjà associé à un compte.'],
]);

const USERS_FALLBACK = { message: 'Liste des comptes momentanément indisponible.', code: 'USERS_UNAVAILABLE' };
const USER_SAVE_FALLBACK = { message: 'Compte non enregistré. Réessayez.', code: 'USER_SAVE_FAILED' };
const USER_UPDATE_FALLBACK = { message: 'Modification non enregistrée. Réessayez.', code: 'USER_SAVE_FAILED' };

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

        if (error) return apiFailure('GET /api/admin/users', error, USERS_FALLBACK);

        return NextResponse.json({
            success: true,
            users: users || [],
            total: users?.length || 0,
        });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/users', err, USERS_FALLBACK);
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

        // Protection contre l'élévation de privilèges (lot 9 bis, R71) : rôles lus sur user_roles, jamais users.role ;
        // refus avant toute création de compte GoTrue.
        if ((targetRole === 'ADMIN' || targetRole === 'SUPERADMIN') && !auth.user!.roles.includes('SUPERADMIN')) {
            return adminRoleSuperadminOnly();
        }

        const normalizedPhone = phone.trim().startsWith('+') ? phone.trim() : `+221${phone.trim().replace(/^0+/, '').replace(/\s+/g, '')}`;
        // Lot 9 bis (R87, B96, contrat 4.6, fix(9b.48-SB)) : GoTrue et users.email reçoivent l'adresse technique du
        // numéro ; l'adresse saisie attend son lien de vérification dans users.email_pending. Domaine réservé (B100).
        const typedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (typedEmail && (!EMAIL_SHAPE.test(typedEmail) || typedEmail.length > 254)) {
            return NextResponse.json({ error: 'Adresse email invalide.', code: 'INVALID_FIELD', field: 'email' }, { status: 400 });
        }
        if (typedEmail && TECHNICAL_EMAIL_RE.test(typedEmail)) {
            return NextResponse.json({ error: RESERVED_EMAIL_MESSAGE, code: 'INVALID_FIELD', field: 'email' }, { status: 400 });
        }
        const effectiveEmail = technicalEmailOf(normalizedPhone);
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
            const refusal = AUTH_CREATE_REFUSALS.get(authErr.code ?? '');
            if (refusal) return NextResponse.json({ error: refusal, code: 'USER_ALREADY_EXISTS' }, { status: 400 });
            return apiFailure('POST /api/admin/users, compte de connexion', authErr, { message: 'Compte non créé. Vérifiez les informations saisies et réessayez.', code: 'USER_CREATE_FAILED', status: 400 });
        }

        const userId = authData.user.id;

        // 1 bis. Attribution explicite du rôle (lot 1A : le trigger d'inscription ne crée plus que CLIENT). Lot 9 bis
        //       (B45, R71) : par la RPC user_roles_set, qui refait le contrôle du rôle ADMIN et écrit son journal
        //       ROLES_SET dans la transaction.
        try {
            await setUserRoles(userId, [targetRole], auth.user!.id);
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
            email_pending: typedEmail || null,
            role: targetRole,
            status: 'ACTIF',
            referral_status: 'STANDARD',
            updated_at: new Date().toISOString(),
        });

        if (upsertErr) return apiFailure('POST /api/admin/users, profil', upsertErr, USER_SAVE_FALLBACK);

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

        // 4. Lien de vérification de l'adresse saisie, au mieux : le compte est créé quoi qu'il arrive ; un échec est
        //    journalisé et dit dans la réponse (email_verification NOT_SENT), le lien se renvoie depuis le profil.
        let emailVerification: EmailVerificationState | null = null;
        if (typedEmail) {
            try {
                emailVerification = emailVerificationState(await sendEmailVerification(userId));
            } catch (mailErr) {
                console.error(`[API /api/admin/users POST] lien de vérification du compte ${userId} non envoyé :`, mailErr instanceof Error ? mailErr.message : String(mailErr));
                emailVerification = 'NOT_SENT';
            }
        }

        return NextResponse.json({
            success: true,
            userId,
            email_pending: typedEmail || null,
            ...(emailVerification ? { email_verification: emailVerification } : {}),
            message: `Utilisateur avec le rôle ${targetRole} créé avec succès.`,
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/users', err, USER_SAVE_FALLBACK);
    }
}

/** Refus de admin_user_status_set (lot 9 bis, M04) : statut HTTP ; le texte vient de la RPC. */
const STATUS_SET_REFUSALS: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400,
    REASON_REQUIRED: 400,
    FORBIDDEN: 403,
    ADMIN_ROLE_SUPERADMIN_ONLY: 403,
    USER_NOT_FOUND: 404,
    PARTNER_STATUS_VIA_PARTNER_SHEET: 409,
};

const PARTNER_VIA_SHEET = 'Ce compte est celui d’un partenaire : suspendez-le ou réactivez-le depuis sa fiche partenaire, avec un motif.';

/**
 * PATCH /api/admin/users
 * Mise à jour des rôles, du statut ou du statut Ambassadeur d'un utilisateur.
 * Lot 9 bis : le statut (`status` ACTIF ou SUSPENDU, `reason` obligatoire à la suspension) passe par la RPC
 * admin_user_status_set (journal, sessions révoquées, avis au compte, une transaction) ; un compte partenaire est
 * renvoyé à sa fiche (409 PARTNER_STATUS_VIA_PARTNER_SHEET, aucune écriture, R6) ; un compte ADMIN n'est suspendu que
 * par un SUPERADMIN (R71).
 */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: { userId?: string; role?: string; roles?: unknown; referralStatus?: unknown; status?: string; reason?: unknown };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { userId, role, roles: requestedRoles, referralStatus, status } = body;
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (status !== undefined && status !== 'ACTIF' && status !== 'SUSPENDU') {
            return NextResponse.json({ error: 'Statut invalide : ACTIF ou SUSPENDU.', code: 'INVALID_FIELD', field: 'status' }, { status: 400 });
        }
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

        // Lot 9 (A34) : une panne n'est pas une absence. Un identifiant mal formé (22P02) reste un compte introuvable.
        if (targetErr && targetErr.code !== '22P02') {
            return apiFailure('PATCH /api/admin/users, lecture du compte', targetErr, USER_UPDATE_FALLBACK);
        }
        if (!targetUser) {
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

        // 3 bis. Lot 9 bis (R71, B33) : ajout ou retrait du rôle ADMIN, et statut d'un compte ADMIN, réservés au
        //       SUPERADMIN (la RPC user_roles_set refait le contrôle des rôles en base).
        if (!actorIsSuperadmin) {
            const adminChanged = targetRoles !== null && targetRoles.includes('ADMIN') !== targetCurrentRoles.includes('ADMIN');
            const adminStatus = status !== undefined && targetCurrentRoles.includes('ADMIN');
            if (adminChanged || adminStatus) return adminRoleSuperadminOnly();
        }

        // 3 ter. Lot 9 bis (R6, B38) : le statut d'une partenaire ne se change que depuis sa fiche, avec un motif ; la
        //        suspension d'un autre compte exige un motif (contrôlés avant toute écriture, rôles compris).
        if (status !== undefined) {
            const { data: partnerRow, error: partnerErr } = await supabase.from('partners').select('id').eq('user_id', userId).maybeSingle();
            if (partnerErr) return apiFailure('PATCH /api/admin/users, fiche partenaire', partnerErr, USER_UPDATE_FALLBACK);
            if (partnerRow) {
                return NextResponse.json({ error: PARTNER_VIA_SHEET, code: 'PARTNER_STATUS_VIA_PARTNER_SHEET', partner_id: partnerRow.id }, { status: 409 });
            }
            if (status === 'SUSPENDU' && targetUser.status !== 'SUSPENDU' && reason.length < 3) {
                return NextResponse.json({ error: 'Indiquez le motif de la suspension (3 caractères au moins).', code: 'REASON_REQUIRED', field: 'reason' }, { status: 400 });
            }
        }

        // 4. Rôles : ajout et retrait dans user_roles (le trigger recalcule users.role)
        //    Lot 4.7 : retirer CONTROLEUR à un compte qui a une caisse OUVERT est refusé par le trigger
        //    controller_removal_guard (CONTROLLER_HAS_OPEN_SHIFT) → 409, rien d'autre n'est modifié.
        let roleChange: Awaited<ReturnType<typeof setUserRoles>> | null = null;
        if (targetRoles) {
            try {
                roleChange = await setUserRoles(userId, targetRoles, auth.user!.id);
            } catch (roleErr) {
                if (isControllerRemovalBlocked(roleErr)) {
                    return NextResponse.json(controllerRemovalConflict(), { status: 409 });
                }
                // Lot 5 (C4) : refus de user_roles_set, vérifiés en base (rien n'a été modifié)
                if (roleErr instanceof RoleChangeError) {
                    const refusal = ROLE_CHANGE_REFUSALS[roleErr.code];
                    if (refusal) return NextResponse.json({ error: refusal[1], code: roleErr.code }, { status: refusal[0] });
                }
                throw roleErr;
            }
        }

        // 4 bis. Lot 9 bis (R59, B38, B45) : statut par la RPC (journal, sessions révoquées, avis, une transaction)
        if (status !== undefined) {
            const { data: statusReply, error: statusErr } = await supabase.rpc('admin_user_status_set', {
                p: { actor_id: auth.user!.id, user_id: userId, status, reason: reason || null },
            });
            if (statusErr || !statusReply) {
                return apiFailure('PATCH /api/admin/users, statut', statusErr ?? new Error('admin_user_status_set : réponse vide'), USER_UPDATE_FALLBACK);
            }
            const reply = statusReply as { ok?: boolean; code?: string; message?: string };
            if (reply.ok !== true) {
                const httpStatus = STATUS_SET_REFUSALS[String(reply.code)];
                if (!httpStatus || typeof reply.message !== 'string') {
                    return apiFailure('PATCH /api/admin/users, statut', new Error(`admin_user_status_set : refus non répertorié ${JSON.stringify(reply)}`), USER_UPDATE_FALLBACK);
                }
                return NextResponse.json({ error: reply.message, code: reply.code }, { status: httpStatus });
            }
        }

        // 5. Autres attributs du profil (le rôle legacy et le statut ne sont plus écrits directement)
        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (referralValue) updatePayload.referral_status = referralValue;

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', userId)
            .select()
            .single();

        if (error) return apiFailure('PATCH /api/admin/users', error, USER_UPDATE_FALLBACK);

        // 6. Lot 1C.3 : rôle retiré → sessions révoquées (déconnexion forcée réelle) ; une suspension les a déjà révoquées
        //    dans la RPC de statut (lot 9 bis).
        const rolesRemoved = (roleChange?.removed.length ?? 0) > 0;
        if (rolesRemoved) {
            const revoked = await revokeUserSessions(userId, {
                reason: 'ROLES_REMOVED',
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
                ...(status !== undefined ? { status } : {}),
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
        return apiFailure('PATCH /api/admin/users', err, USER_UPDATE_FALLBACK);
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
        return apiFailure('DELETE /api/admin/users', err, { message: 'Suppression du compte momentanément impossible. Réessayez.', code: 'USER_DELETE_FAILED', status: 400 });
    }
}

