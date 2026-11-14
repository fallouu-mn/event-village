import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getServiceRoleClient } from '@/lib/supabase/server';
import { type UserRoleType } from '@/lib/auth/roles';
import { permissionMissingMessage } from '@/lib/admin/permission-labels';
import { getClientIp } from '@/lib/security/client-ip';
import { adminStepUpRefusal } from '@/lib/admin/step-up';
import { ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { contactSupport } from '@/lib/support-contact';

export interface AdminAuthResult {
    authorized: boolean;
    user?: {
        id: string;
        email: string;
        phone: string;
        role: UserRoleType;
        roles: string[];
        first_name?: string;
        last_name?: string;
    };
    permissions?: string[];
    errorResponse?: NextResponse;
}

// Lot 9 quinquies : liste déplacée dans lib/admin/permissions.ts (importable par un composant client, sans module serveur)
export { ADMIN_PERMISSIONS };

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

/** Lecture des permissions impossible (panne) : jamais un refus ni un accès par défaut, la route répond 503. */
export class AdminPermissionsUnavailable extends Error {
    constructor(userId: string, detail: string) {
        super(`permissions de ${userId} illisibles : ${detail}`);
        this.name = 'AdminPermissionsUnavailable';
    }
}

/**
 * Lot 9 bis, tâche 11 (R2, B30) — permissions effectives d'un compte, lues sur `user_roles` (jamais `users.role`) :
 * SUPERADMIN → toutes ; ADMIN → ses lignes `admin_permissions` ; tout autre compte → aucune. Lève
 * AdminPermissionsUnavailable si la lecture échoue.
 */
export async function loadAdminPermissions(userId: string, roles: readonly string[]): Promise<string[]> {
    if (roles.includes('SUPERADMIN')) return [...ADMIN_PERMISSIONS];
    if (!roles.includes('ADMIN')) return [];
    const { data, error } = await getServiceRoleClient()
        .from('admin_permissions')
        .select('permission')
        .eq('user_id', userId);
    if (error) throw new AdminPermissionsUnavailable(userId, error.message);
    return (data ?? []).map((p) => String(p.permission));
}

/** Refus 403 PERMISSION_MISSING (contrat 4.2) : texte français, code stable, permission nommée dans le corps. */
export function permissionMissingResponse(permission: string): NextResponse {
    return NextResponse.json(
        { error: permissionMissingMessage(permission), code: 'PERMISSION_MISSING', permission },
        { status: 403 }
    );
}

/** Panne de lecture des droits : 503, jamais de repli. */
export function adminAuthUnavailableResponse(): NextResponse {
    return NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'ADMIN_AUTH_UNAVAILABLE' }, { status: 503 });
}

/**
 * Valide l'authentification et les permissions de l'administrateur appelant
 */
export async function verifyAdminAuth(
    req: NextRequest,
    options?: {
        requireSuperadmin?: boolean;
        requiredPermission?: AdminPermission;
        /** Lot 9 quinquies (A3, A4) : routes de l'étape de sécurité elles-mêmes (mot de passe, code SMS) seulement. */
        skipStepUp?: boolean;
    }
): Promise<AdminAuthResult> {
    try {
        const supabase = getServiceRoleClient();

        // 1. Compte de la requête (Bearer, sinon cookies de @supabase/ssr), validé par GoTrue. Lot 9 quater (A6) : un
        //    compte bloqué chez GoTrue (SUSPENDU, SUPPRIME) est rendu pour recevoir le 403 ACCOUNT_NOT_ACTIVE de l'étape 2.
        const userId = (await getAuthenticatedUserId(req)) ?? undefined;

        if (!userId) {
            return {
                authorized: false,
                errorResponse: NextResponse.json(
                    { error: 'Authentification requise pour accéder aux ressources d\'administration.' },
                    { status: 401 }
                ),
            };
        }

        // 2. Récupération du profil et des rôles depuis public.users + user_roles
        const [{ data: userProfile, error: profileErr }, { data: userRolesData, error: rolesErr }] = await Promise.all([
            supabase
                .from('users')
                .select('id, email, phone, role, first_name, last_name, status')
                .eq('id', userId)
                .maybeSingle(),
            supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId),
        ]);

        if (profileErr) {
            console.error(`[verifyAdminAuth] lecture du profil ${userId} impossible :`, profileErr.message);
            return {
                authorized: false,
                errorResponse: NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'ADMIN_AUTH_UNAVAILABLE' }, { status: 503 }),
            };
        }
        if (!userProfile) {
            return {
                authorized: false,
                errorResponse: NextResponse.json({ error: 'Profil utilisateur introuvable.' }, { status: 403 }),
            };
        }
        if (rolesErr) {
            console.error(`[verifyAdminAuth] lecture des rôles de ${userId} impossible :`, rolesErr.message);
            return {
                authorized: false,
                errorResponse: NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'ADMIN_AUTH_UNAVAILABLE' }, { status: 503 }),
            };
        }

        // Lot 7 (D18, règle du lot 1B.8) : user_roles est la seule source des rôles, comme la RLS
        // (is_admin()). Plus de repli sur le rôle legacy users.role quand user_roles est vide.
        const roles = (userRolesData ?? []).map(r => r.role as string);
        const role = userProfile.role as UserRoleType;

        // Lot 7 (D18) : seul un compte ACTIF accède à l'administration (SUPPRIME, EN_ATTENTE et SUSPENDU
        // refusés), même code que requireActiveSession (lib/auth/session.ts).
        if (userProfile.status !== 'ACTIF') {
            console.warn(`[verifyAdminAuth] accès refusé à ${req.nextUrl.pathname} : compte ${userId} au statut ${userProfile.status}`);
            return {
                authorized: false,
                errorResponse: NextResponse.json(
                    { error: `Votre compte n'est pas actif. ${contactSupport()}`, code: 'ACCOUNT_NOT_ACTIVE' },
                    { status: 403 }
                ),
            };
        }

        if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN')) {
            // Journalisation de la tentative d'accès non autorisé
            await supabase.from('audit_logs').insert({
                user_id: userId,
                user_role: role,
                action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
                object_type: 'admin_api',
                // Lot 9 quater (A9 : AUD-33) : IP lue par getClientIp (règle unique de l'application), jamais l'en-tête brut
                metadata: { path: req.nextUrl.pathname, ip: getClientIp(req) ?? 'inconnue' },
            });

            return {
                authorized: false,
                errorResponse: NextResponse.json(
                    { error: 'Accès restreint aux administrateurs autorisés.' },
                    { status: 403 }
                ),
            };
        }

        // 3. Exigence stricte de Superadmin si demandée
        if (options?.requireSuperadmin && !roles.includes('SUPERADMIN')) {
            return {
                authorized: false,
                errorResponse: NextResponse.json(
                    { error: 'Opération réservée exclusivement au SUPERADMIN.' },
                    { status: 403 }
                ),
            };
        }

        // 4. Récupération des permissions granulaires pour les Admins ordinaires
        let permissions: string[] = [];

        if (roles.includes('SUPERADMIN')) {
            permissions = [...ADMIN_PERMISSIONS]; // Le Superadmin a toutes les permissions
        } else {
            const { data: permsData, error: permsErr } = await supabase
                .from('admin_permissions')
                .select('permission')
                .eq('user_id', userId);
            if (permsErr) {
                console.error(`[verifyAdminAuth] lecture des permissions de ${userId} impossible :`, permsErr.message);
                return {
                    authorized: false,
                    errorResponse: NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'ADMIN_AUTH_UNAVAILABLE' }, { status: 503 }),
                };
            }

            permissions = permsData?.map((p) => p.permission) || [];

            // Lot 9 bis (R51, B34) : refus en français, code stable, permission nommée ; jamais le code brut dans le texte.
            if (options?.requiredPermission && !permissions.includes(options.requiredPermission)) {
                return {
                    authorized: false,
                    errorResponse: permissionMissingResponse(options.requiredPermission),
                };
            }
        }

        // Lot 9 quinquies (A3 : AUTH-05, A4 : AUTH-04) : code SMS sur un nouvel appareil et après 12 h, mot de passe de la
        // session de moins de 12 h, mot de passe redemandé après 30 min sans activité ; après les refus de rôle et de
        // permission (leurs codes ne changent pas).
        if (!options?.skipStepUp) {
            const stepUp = await adminStepUpRefusal(req, userId, 'ADMIN');
            if (stepUp) return { authorized: false, errorResponse: stepUp };
        }

        return {
            authorized: true,
            user: {
                id: userProfile.id,
                email: userProfile.email || '',
                phone: userProfile.phone || '',
                role: role,
                roles,
                first_name: userProfile.first_name,
                last_name: userProfile.last_name,
            },
            permissions,
        };
    } catch (err: unknown) {
        console.error('[verifyAdminAuth] vérification impossible :', err instanceof Error ? err.message : err);
        return {
            authorized: false,
            errorResponse: NextResponse.json({ error: 'Erreur de vérification de session.' }, { status: 500 }),
        };
    }
}
