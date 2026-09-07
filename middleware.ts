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

function parseRoles(userMetadata: Record<string, unknown> | undefined | null): string[] {
    if (!userMetadata) return ['CLIENT'];
    const rolesField = userMetadata.roles;
    if (Array.isArray(rolesField) && rolesField.length > 0) {
        return rolesField as string[];
    }
    const legacyRole = userMetadata.role as string | undefined;
    if (legacyRole) return [legacyRole];
    return ['CLIENT'];
}

function hasRole(roles: string[], role: string): boolean {
    return roles.includes(role);
}

function hasAnyRole(roles: string[], required: string[]): boolean {
    return required.some(r => roles.includes(r));
}

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

    // Extraire les rôles depuis le JWT (synchronisé par le trigger PostgreSQL)
    let roles = parseRoles(user.user_metadata);

    // Utilisateur connecté sur une page d'auth → rediriger selon les rôles
    if (isAuthPage) {
        // Vérification DB si le JWT porte uniquement CLIENT (fallback si JWT pas encore rafraîchi)
        if (roles.length === 1 && roles[0] === 'CLIENT') {
            const { data: dbProfile } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            if (dbProfile?.role && dbProfile.role !== 'CLIENT') {
                roles = [dbProfile.role];
            }
        }

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
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        if (!hasAnyRole(roles, ['ADMIN', 'SUPERADMIN'])) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Accès non autorisé : Rôle Administrateur requis.' },
                    { status: 403 }
                );
            }
            return redirect(new URL('/?error=unauthorized_admin', req.url));
        }
        return supabaseResponse;
    }

    // /scan → CONTROLEUR, ADMIN, SUPERADMIN, PARTENAIRE
    if (pathname === '/scan' || pathname.startsWith('/scan/') || pathname === '/partner/scan' || pathname.startsWith('/partner/scan/')) {
        if (!hasAnyRole(roles, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN', 'PARTENAIRE'])) {
            return redirect(new URL('/?error=unauthorized_scanner', req.url));
        }
        return supabaseResponse;
    }

    // /controller/* → nécessite CONTROLEUR (+ ADMIN/SUPERADMIN)
    if (pathname.startsWith('/controller') || pathname.startsWith('/api/controller')) {
        // Vérification DB pour fraîcheur (invalider sessions après rétrogradation)
        const { data: dbRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

        const freshRoles = (dbRoles && dbRoles.length > 0)
            ? dbRoles.map((r: { role: string }) => r.role)
            : roles;

        // Vérifier aussi le statut du compte
        const { data: dbProfile } = await supabase
            .from('users')
            .select('status')
            .eq('id', user.id)
            .maybeSingle();

        if (!dbProfile || dbProfile.status !== 'ACTIF' || !hasAnyRole(freshRoles, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN'])) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Accès non autorisé : Rôle Contrôleur actif requis.' },
                    { status: 403 }
                );
            }
            return redirect(new URL('/login?error=unauthorized_controller', req.url));
        }
        return supabaseResponse;
    }

    // /partner/* → nécessite PARTENAIRE (+ ADMIN/SUPERADMIN)
    if (pathname.startsWith('/partner') && pathname !== '/partner/register') {
        if (!hasAnyRole(roles, ['PARTENAIRE', 'ADMIN', 'SUPERADMIN'])) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Accès non autorisé : Rôle Partenaire requis.' },
                    { status: 403 }
                );
            }
            return redirect(new URL('/?error=unauthorized_partner', req.url));
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
