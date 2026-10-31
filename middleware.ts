import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PREFIXES = [
    '/_next',
    '/api/webhooks',
    '/api/auth',
    '/api/partner/register',
    '/api/partner/documents/upload',
    '/api/payments',
    '/api/events',
    '/branding',
    '/favicon.ico',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/manifest.json',
    '/sw.js',
];

const PUBLIC_API_EXACT = [
    '/api/controller/setup',
];

const PUBLIC_EXACT_ROUTES = [
    '/',
    '/explore',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/halls',
    '/partner/register',
    '/controller/setup',
];

function hasRole(roles: string[], role: string): boolean {
    return roles.includes(role);
}

function hasAnyRole(roles: string[], required: string[]): boolean {
    return required.some(r => roles.includes(r));
}

/**
 * Lot 1B.1 — les rôles ne se lisent jamais dans user_metadata (modifiable par l'utilisateur via
 * auth.updateUser). Ils sont lus dans public.user_roles, source unique utilisée aussi par la RLS
 * et les routes serveur, avec la session de l'utilisateur (politique « ses propres rôles »).
 * La lecture n'a lieu que sur les zones protégées et les pages d'authentification.
 * En cas d'échec de lecture : accès refusé et journalisé, jamais de repli sur le jeton.
 */
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }
    if (PUBLIC_API_EXACT.includes(pathname)) {
        return NextResponse.next();
    }

    const isPublicExact = PUBLIC_EXACT_ROUTES.includes(pathname);
    const isPublicDynamic =
        pathname.startsWith('/events/') ||
        pathname.startsWith('/halls/') ||
        pathname.startsWith('/restaurants/');
    const isAuthPage =
        pathname === '/login' ||
        pathname === '/register' ||
        pathname === '/forgot-password';

    const isAdminArea = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
    const isScanArea = pathname === '/scan' || pathname.startsWith('/scan/') || pathname === '/partner/scan' || pathname.startsWith('/partner/scan/');
    const isControllerArea = pathname.startsWith('/controller') || pathname.startsWith('/api/controller');
    const isPartnerArea = pathname.startsWith('/partner') && pathname !== '/partner/register';

    let supabaseResponse = NextResponse.next({ request: req });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        req.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request: req });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    function redirect(url: URL) {
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
    }

    function deny(apiMessage: string, pageUrl: string, status = 403) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: apiMessage }, { status });
        }
        return redirect(new URL(pageUrl, req.url));
    }

    if (!user) {
        if (isPublicExact || isPublicDynamic) {
            return supabaseResponse;
        }

        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Authentification requise pour cette ressource.' },
                { status: 401 }
            );
        }

        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('redirect', pathname);
        return redirect(loginUrl);
    }

    if (!(isAuthPage || isAdminArea || isScanArea || isControllerArea || isPartnerArea)) {
        return supabaseResponse;
    }

    // Rôles en base (public.user_roles), avec la session de l'utilisateur.
    const { data: roleRows, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

    if (rolesError) {
        console.error(`[middleware] lecture des rôles impossible pour ${user.id} sur ${pathname} :`, rolesError.code, rolesError.message);
        if (isAuthPage) {
            return redirect(new URL('/', req.url));
        }
        return deny('Vérification des droits impossible. Réessayez.', '/?error=roles_unavailable', 503);
    }
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);

    // Utilisateur connecté sur une page d'auth → rediriger selon les rôles
    if (isAuthPage) {
        if (hasAnyRole(roles, ['ADMIN', 'SUPERADMIN'])) {
            return redirect(new URL('/admin/dashboard', req.url));
        }
        if (hasRole(roles, 'PARTENAIRE')) {
            return redirect(new URL('/partner/dashboard', req.url));
        }
        if (hasRole(roles, 'CONTROLEUR')) {
            return redirect(new URL('/controller/scanner', req.url));
        }
        return redirect(new URL('/', req.url));
    }

    // ── RBAC MULTI-RÔLE ──────────────────────────────────────────────────

    // /admin/* → nécessite ADMIN ou SUPERADMIN
    if (isAdminArea) {
        if (!hasAnyRole(roles, ['ADMIN', 'SUPERADMIN'])) {
            return deny('Accès non autorisé : Rôle Administrateur requis.', '/?error=unauthorized_admin');
        }
        return supabaseResponse;
    }

    // /scan → CONTROLEUR, ADMIN, SUPERADMIN, PARTENAIRE
    if (isScanArea) {
        if (!hasAnyRole(roles, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN', 'PARTENAIRE'])) {
            return redirect(new URL('/?error=unauthorized_scanner', req.url));
        }
        return supabaseResponse;
    }

    // /controller/* → nécessite CONTROLEUR (+ ADMIN/SUPERADMIN) et un compte ACTIF
    if (isControllerArea) {
        const { data: dbProfile, error: profileError } = await supabase
            .from('users')
            .select('status')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
            console.error(`[middleware] lecture du statut impossible pour ${user.id} :`, profileError.code, profileError.message);
            return deny('Vérification du compte impossible. Réessayez.', '/login?error=unauthorized_controller', 503);
        }
        if (!dbProfile || dbProfile.status !== 'ACTIF' || !hasAnyRole(roles, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN'])) {
            return deny('Accès non autorisé : Rôle Contrôleur actif requis.', '/login?error=unauthorized_controller');
        }
        return supabaseResponse;
    }

    // /partner/* → nécessite PARTENAIRE (+ ADMIN/SUPERADMIN)
    if (isPartnerArea) {
        if (!hasAnyRole(roles, ['PARTENAIRE', 'ADMIN', 'SUPERADMIN'])) {
            return deny('Accès non autorisé : Rôle Partenaire requis.', '/?error=unauthorized_partner');
        }
        return supabaseResponse;
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
