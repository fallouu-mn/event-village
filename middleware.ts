import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PREFIXES = [
    '/_next',
    '/api/webhooks',
    '/api/auth',
    '/api/partner/register',
    '/api/partner/documents/upload',
    // Lot 1C.2 : consultation par jeton de dépôt pendant l'inscription (pas encore de compte) ;
    // l'accès par dossier exige une session, contrôlée par la route.
    '/api/partner/documents/signed-url',
    '/api/payments',
    '/api/events',
    // Lot 2 : tâches planifiées (Vercel Cron, pg_cron) sans session ; chaque route exige CRON_SECRET.
    '/api/cron',
    // Lot 9 quater (F4 : AUD-11) : rapports de violation de la CSP (mode rapport seulement), envoyés par le navigateur
    '/api/csp-report',
    '/branding',
    '/favicon.ico',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/manifest.json',
    '/sw.js',
    // Lot 7 (7.0 e, D24) : icônes de l'application installable (maskable, apple-touch), servies sans session
    '/icons/',
    // Lot 7 (7.1, D26) : coquille statique du billet hors ligne, sans donnée personnelle ni session (le
    // service worker la met en cache : elle ne doit jamais être une redirection d'authentification)
    '/billet/hors-ligne',
];

const PUBLIC_API_EXACT = [
    '/api/controller/setup',
    // Lot 7 (7.3, contrat 3.4, D11) : interrupteurs publics, puis liste publique des salles ; chaque route
    // contrôle elle-même son interrupteur (404 s'il est fermé)
    '/api/features',
    '/api/halls',
    // Lot 8 (A41) : devis d'un panier, sans session. Sans cette ligne, un visiteur lisait « Total indisponible » sur
    // la fiche et ne pouvait pas commencer un achat. POST /api/checkout reste protégé.
    '/api/checkout/quote',
    // Lot 9 bis (R87, contrat 4.6, fix(9b.48-SB)) : validation du lien reçu par email, sans session ouverte (le jeton
    // seul prouve la demande ; la route n'ouvre aucune session). /api/account/email/resend reste protégée.
    '/api/account/email/verify',
];

/**
 * Lot 7 (7.3, D11) : lectures publiques des salles, tables et menus (GET seulement côté route, chaque route
 * contrôle son interrupteur). Motifs ancrés : /api/halls/reserve et /api/restaurants/reserve-table restent
 * protégés.
 */
const PUBLIC_API_PATTERNS: readonly RegExp[] = [
    /^\/api\/halls\/[0-9a-f-]{36}$/,
    /^\/api\/restaurants\/[^/]+\/(tables|menu)$/,
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
    // Lot 9 bis (R87, fix(9b.48-SB)) : page du lien de vérification de l'email, ouverte depuis la boîte de réception
    '/verify-email',
];

function hasRole(roles: string[], role: string): boolean {
    return roles.includes(role);
}

function hasAnyRole(roles: string[], required: string[]): boolean {
    return required.some(r => roles.includes(r));
}

/**
 * Lot 8 (8.1, L20) — deuxième verrou de la page de développement. Motif ancré : /developpeurs n'est pas touché.
 * `process.env.NODE_ENV` est figé au build : en production, ces chemins rendent 404 quel que soit l'environnement.
 */
const DEV_ROUTE = /^\/(?:api\/)?dev(?:\/|$)/;

/**
 * Lot 1B.1 — les rôles ne se lisent jamais dans user_metadata (modifiable par l'utilisateur via
 * auth.updateUser). Ils sont lus dans public.user_roles, source unique utilisée aussi par la RLS
 * et les routes serveur, avec la session de l'utilisateur (politique « ses propres rôles »).
 * La lecture n'a lieu que sur les zones protégées et les pages d'authentification.
 * En cas d'échec de lecture : accès refusé et journalisé, jamais de repli sur le jeton.
 */
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (DEV_ROUTE.test(pathname)) {
        if (process.env.NODE_ENV === 'development' && process.env.EV_INTEGRATIONS === 'fake') return NextResponse.next();
        return new NextResponse(null, { status: 404 });
    }

    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }
    if (PUBLIC_API_EXACT.includes(pathname)) {
        return NextResponse.next();
    }
    if (PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname))) {
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
    // Lot 4.3 : voie de scan unique et caisse partagées par le contrôleur, le partenaire propriétaire
    // et l'admin ; chaque route vérifie elle-même le droit sur l'événement (affectation ou propriété).
    // Lot 5 (C8) : y compris la déclaration des incidents de scan (/api/controller/scan/incidents)
    // Lot 7 (A10) : chiffres et derniers scans du scanneur (GET /api/controller/scans), relus au retour dans
    // l'application par /partner/scan aussi ; la route rend 404 sans aucune donnée hors du droit sur l'événement
    // (scan_scanner_authorized : affectation, propriété de l'événement ou admin), comme la voie de scan.
    const isSharedControlApi = pathname === '/api/controller/scan' || pathname.startsWith('/api/controller/scan/')
        || pathname === '/api/controller/scans'
        || pathname.startsWith('/api/controller/shifts');
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
            return deny('Vérification du compte impossible. Réessayez.', '/?error=roles_unavailable', 503);
        }
        const allowedRoles: Parameters<typeof hasAnyRole>[1] = isSharedControlApi
            ? ['CONTROLEUR', 'PARTENAIRE', 'ADMIN', 'SUPERADMIN']
            : ['CONTROLEUR', 'ADMIN', 'SUPERADMIN'];
        if (!dbProfile || dbProfile.status !== 'ACTIF' || !hasAnyRole(roles, allowedRoles)) {
            // Lot 8 (L53) : jamais /login pour un connecté, cette page le renverrait vers son espace (boucle)
            return deny('Accès non autorisé : Rôle Contrôleur actif requis.', '/?error=unauthorized_controller');
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
