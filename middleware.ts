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

// Routes API publiques exactes (pas de startsWith)
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

    // Creer le client Supabase SSR avec gestion automatique des cookies
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

    // Helper: creer une redirection qui preserve les cookies Supabase
    function redirect(url: URL) {
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
    }

    // Pas d'utilisateur authentifie
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

    // Utilisateur connecte sur une page d'auth → rediriger selon le role
    if (isAuthPage) {
        let role = user.user_metadata?.role || 'CLIENT';
        if (role === 'CLIENT') {
            const { data: dbProfile } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            if (dbProfile?.role && dbProfile.role !== 'CLIENT') {
                role = dbProfile.role;
            }
        }
        if (role === 'ADMIN' || role === 'SUPERADMIN') {
            return redirect(new URL('/admin/dashboard', req.url));
        }
        if (role === 'PARTENAIRE') {
            return redirect(new URL('/partner/dashboard', req.url));
        }
        if (role === 'CONTROLEUR') {
            return redirect(new URL('/controller/scanner', req.url));
        }
        return redirect(new URL('/', req.url));
    }

    // RBAC
    let role = user.user_metadata?.role || 'CLIENT';

    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
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

    if (pathname === '/scan' || pathname.startsWith('/scan/') || pathname === '/partner/scan' || pathname.startsWith('/partner/scan/')) {
        if (role !== 'CONTROLEUR' && role !== 'ADMIN' && role !== 'SUPERADMIN' && role !== 'PARTENAIRE') {
            return redirect(new URL('/?error=unauthorized_scanner', req.url));
        }
        return supabaseResponse;
    }

    // Espace Contrôleur — accessible uniquement au rôle CONTROLEUR (+ admins)
    if (pathname.startsWith('/controller') || pathname.startsWith('/api/controller')) {
        if (role !== 'CONTROLEUR' && role !== 'ADMIN' && role !== 'SUPERADMIN') {
            // Fallback DB : si le JWT est encore en CLIENT après une promotion récente
            const { data: dbProfile } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            if (dbProfile?.role === 'CONTROLEUR') {
                role = 'CONTROLEUR';
            }
        }

        if (role !== 'CONTROLEUR' && role !== 'ADMIN' && role !== 'SUPERADMIN') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Accès non autorisé : Rôle Contrôleur requis.' },
                    { status: 403 }
                );
            }
            return redirect(new URL('/?error=unauthorized_controller', req.url));
        }
        return supabaseResponse;
    }

    if (pathname.startsWith('/partner') && pathname !== '/partner/register') {
        if (role !== 'PARTENAIRE' && role !== 'ADMIN' && role !== 'SUPERADMIN') {
            if (role === 'CONTROLEUR') {
                return redirect(new URL('/controller/scanner', req.url));
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
