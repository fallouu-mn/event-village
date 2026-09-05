import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getServiceRoleClient } from '@/lib/supabase/server';

export interface AdminAuthResult {
    authorized: boolean;
    user?: {
        id: string;
        email: string;
        phone: string;
        role: 'SUPERADMIN' | 'ADMIN' | 'PARTENAIRE' | 'CONTROLEUR' | 'CLIENT';
        first_name?: string;
        last_name?: string;
    };
    permissions?: string[];
    errorResponse?: NextResponse;
}

export const ADMIN_PERMISSIONS = [
    'users.read',
    'users.write',
    'partners.read',
    'partners.validate',
    'partners.suspend',
    'events.read',
    'events.write',
    'payments.read',
    'refunds.manage',
    'referrals.manage',
    'communications.manage',
    'statistics.read',
    'pricing.manage',
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

/**
 * Valide l'authentification et les permissions de l'administrateur appelant
 */
export async function verifyAdminAuth(
    req: NextRequest,
    options?: {
        requireSuperadmin?: boolean;
        requiredPermission?: AdminPermission;
    }
): Promise<AdminAuthResult> {
    try {
        const supabase = getServiceRoleClient();

        // 1. Extraction de l'utilisateur via @supabase/ssr (gere les cookies chunkes)
        let userId: string | undefined;

        const authHeader = req.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const { data: userData, error } = await supabase.auth.getUser(token);
            if (!error && userData?.user) {
                userId = userData.user.id;
            }
        }

        if (!userId) {
            const ssrClient = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        getAll() {
                            return req.cookies.getAll();
                        },
                        setAll() {},
                    },
                }
            );
            const { data: { user } } = await ssrClient.auth.getUser();
            if (user) {
                userId = user.id;
            }
        }

        if (!userId) {
            return {
                authorized: false,
                errorResponse: NextResponse.json(
                    { error: 'Authentification requise pour accéder aux ressources d\'administration.' },
                    { status: 401 }
                ),
            };
        }

        // 2. Récupération du profil et rôle réel depuis public.users
        const { data: userProfile, error: profileErr } = await supabase
            .from('users')
            .select('id, email, phone, role, first_name, last_name, status')
            .eq('id', userId)
            .maybeSingle();

        if (profileErr || !userProfile) {
            return {
                authorized: false,
                errorResponse: NextResponse.json({ error: 'Profil utilisateur introuvable.' }, { status: 403 }),
            };
        }

        const role = userProfile.role as 'SUPERADMIN' | 'ADMIN' | 'PARTENAIRE' | 'CONTROLEUR' | 'CLIENT';

        if (userProfile.status === 'SUSPENDU') {
            return {
                authorized: false,
                errorResponse: NextResponse.json({ error: 'Compte suspendu.' }, { status: 403 }),
            };
        }

        if (role !== 'SUPERADMIN' && role !== 'ADMIN') {
            // Journalisation de la tentative d'accès non autorisé
            await supabase.from('audit_logs').insert({
                user_id: userId,
                user_role: role,
                action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
                object_type: 'admin_api',
                metadata: { path: req.nextUrl.pathname, ip: req.headers.get('x-forwarded-for') || 'local' },
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
        if (options?.requireSuperadmin && role !== 'SUPERADMIN') {
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

        if (role === 'SUPERADMIN') {
            permissions = [...ADMIN_PERMISSIONS]; // Le Superadmin a toutes les permissions
        } else {
            const { data: permsData } = await supabase
                .from('admin_permissions')
                .select('permission')
                .eq('user_id', userId);

            permissions = permsData?.map((p) => p.permission) || [];

            if (options?.requiredPermission && !permissions.includes(options.requiredPermission)) {
                return {
                    authorized: false,
                    errorResponse: NextResponse.json(
                        { error: `Permission manquante : ${options.requiredPermission}` },
                        { status: 403 }
                    ),
                };
            }
        }

        return {
            authorized: true,
            user: {
                id: userProfile.id,
                email: userProfile.email || '',
                phone: userProfile.phone || '',
                role: role,
                first_name: userProfile.first_name,
                last_name: userProfile.last_name,
            },
            permissions,
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur de vérification de session';
        return {
            authorized: false,
            errorResponse: NextResponse.json({ error: msg }, { status: 500 }),
        };
    }
}
