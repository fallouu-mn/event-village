import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Liste des routes publiques non restreintes
const PUBLIC_PREFIXES = [
    '/_next',
    '/api/webhooks',
    '/api/auth',
    '/api/partner/register',
    '/api/partner/documents/upload',
    '/api/payments',
    '/branding',
    '/favicon.ico',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/manifest.json',
    '/sw.js',
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
];

export async function middleware(req: NextRequest) {
    const { pathname, searchParams } = req.nextUrl;

    // 1. Laisser passer les assets statiques et les fichiers système
    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    // 2. Vérification des routes publiques exactes ou avec préfixes publics
    const isPublicExact = PUBLIC_EXACT_ROUTES.includes(pathname);
    const isPublicDynamic =
        pathname.startsWith('/events/') ||
        pathname.startsWith('/halls/') ||
        pathname.startsWith('/restaurants/');

    const isAuthPage =
        pathname === '/login' ||
        pathname === '/register' ||
        pathname === '/forgot-password';

    // 3. Extraction du token de session depuis les cookies
    const token = req.cookies.get('sb-access-token')?.value;

    // Si aucune route protégée et aucun token, laisser passer
    if (!token) {
        if (isPublicExact || isPublicDynamic) {
            return NextResponse.next();
        }

        // Pour les routes API non authentifiées, renvoyer impérativement du JSON (pas de redirection HTML)
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Authentification requise pour cette ressource.' },
                { status: 401 }
            );
        }

        // Redirection vers /login pour tout accès non authentifié aux routes protégées
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 4. Vérification du token auprès de Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        // En cas d'environnement de test sans URL Supabase, on continue
        return NextResponse.next();
    }

    try {
        const supabase = createClient(supabaseUrl, anonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        // Si le token est invalide ou expiré
        if (authError || !user) {
            if (pathname.startsWith('/api/')) {
                const jsonRes = NextResponse.json(
                    { error: 'Session expirée ou invalide. Veuillez vous reconnecter.' },
                    { status: 401 }
                );
                jsonRes.cookies.delete('sb-access-token');
                return jsonRes;
            }

            const response = isPublicExact || isPublicDynamic
                ? NextResponse.next()
                : NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(pathname)}`, req.url));

            // Suppression du cookie invalide
            response.cookies.delete('sb-access-token');
            return response;
        }

        // Si l'utilisateur est déjà connecté et tente d'aller sur /login ou /register
        if (isAuthPage) {
            const role = user.user_metadata?.role || 'CLIENT';
            if (role === 'ADMIN' || role === 'SUPERADMIN') {
                return NextResponse.redirect(new URL('/admin/dashboard', req.url));
            }
            if (role === 'PARTENAIRE') {
                return NextResponse.redirect(new URL('/partner/dashboard', req.url));
            }
            if (role === 'CONTROLEUR') {
                return NextResponse.redirect(new URL('/partner/scan', req.url));
            }
            return NextResponse.redirect(new URL('/', req.url));
        }

        // 5. Contrôle d'accès basé sur les rôles (RBAC)
        // Récupération du rôle réel depuis les métadonnées ou la table public.users
        const role = user.user_metadata?.role || 'CLIENT';

        // Protection des routes ADMIN (/admin/* et /api/admin/*)
        if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
            if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json(
                        { error: 'Accès non autorisé : Rôle Administrateur requis.' },
                        { status: 403 }
                    );
                }
                return NextResponse.redirect(new URL('/?error=unauthorized_admin', req.url));
            }
            return NextResponse.next();
        }

        // Protection des routes SCANNER (/scan et /partner/scan)
        if (pathname === '/scan' || pathname.startsWith('/scan/') || pathname === '/partner/scan' || pathname.startsWith('/partner/scan/')) {
            if (role !== 'CONTROLEUR' && role !== 'ADMIN' && role !== 'SUPERADMIN' && role !== 'PARTENAIRE') {
                return NextResponse.redirect(new URL('/?error=unauthorized_scanner', req.url));
            }
            return NextResponse.next();
        }

        // Protection des routes PARTENAIRE (/partner/* sauf /partner/register et /partner/scan)
        if (pathname.startsWith('/partner') && pathname !== '/partner/register') {
            if (role !== 'PARTENAIRE' && role !== 'ADMIN' && role !== 'SUPERADMIN') {
                return NextResponse.redirect(new URL('/?error=unauthorized_partner', req.url));
            }
            return NextResponse.next();
        }

        return NextResponse.next();
    } catch (error) {
        console.error('[Middleware] Erreur vérification RBAC:', error);
        return NextResponse.next();
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
