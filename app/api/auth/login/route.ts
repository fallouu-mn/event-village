import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { noStore } from '@/lib/auth/account-sync';
import { applySessionCookies, PasswordCheckUnavailable, serverPasswordSignIn } from '@/lib/auth/password-confirm';
import { getServerEnv } from '@/lib/env';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { normalizePhoneNumber, phoneStorageForms } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/auth/login';
const HOUR_SECONDS = 3600;

const BodySchema = z.object({
    identifier: z.string({ required_error: 'Saisissez votre numéro de téléphone ou votre email.' }).trim()
        .min(3, 'Saisissez votre numéro de téléphone ou votre email.').max(254, 'Identifiant trop long.'),
    password: z.string({ required_error: 'Saisissez votre mot de passe.' }).min(1, 'Saisissez votre mot de passe.').max(200, 'Mot de passe trop long.'),
});

/** Numéro inconnu et mauvais mot de passe : une seule et même réponse (aucune énumération des comptes). */
function invalidCredentials(): NextResponse {
    return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect.', code: 'INVALID_CREDENTIALS' }, { status: 401 });
}

function unavailable(): NextResponse {
    return NextResponse.json({ error: 'Connexion impossible pour le moment. Réessayez dans un instant.', code: 'LOGIN_UNAVAILABLE' }, { status: 503 });
}

/** Refus de Supabase Auth autres que les identifiants : décidés sur le code, jamais sur le texte anglais. */
function refusalResponse(code: string): NextResponse {
    switch (code) {
        case 'email_not_confirmed':
            return NextResponse.json({ error: 'Votre adresse email n’est pas encore confirmée.', code: 'EMAIL_NOT_CONFIRMED' }, { status: 403 });
        case 'user_banned':
            return NextResponse.json({ error: 'Ce compte n’est plus actif. Veuillez contacter le support.', code: 'ACCOUNT_NOT_ACTIVE' }, { status: 403 });
        case 'over_request_rate_limit':
            return NextResponse.json({ error: 'Trop de tentatives. Patientez quelques instants avant de réessayer.', code: 'LOGIN_RATE_LIMITED' }, { status: 429 });
        default:
            console.error(`[${CONTEXT}] refus de Supabase Auth non répertorié : ${code}`);
            return unavailable();
    }
}

/**
 * Identifiant de connexion de Supabase Auth pour un numéro saisi : lu côté serveur, jamais rendu. `null` si aucun
 * compte ne porte ce numéro.
 */
async function loginIdentityOfPhone(raw: string): Promise<{ email: string } | { phone: string } | null> {
    const phone = normalizePhoneNumber(raw);
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('users').select('id').in('phone', phoneStorageForms(phone)).limit(1).maybeSingle();
    if (error) throw new PasswordCheckUnavailable(`compte du numéro illisible : ${error.message}`);
    if (!data) return null;
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(String(data.id));
    if (authErr || !authData?.user) throw new PasswordCheckUnavailable(`compte de connexion illisible : ${authErr?.message ?? 'aucun compte'}`);
    if (authData.user.email) return { email: authData.user.email };
    if (authData.user.phone) return { phone: authData.user.phone };
    return null;
}

async function handle(req: NextRequest): Promise<NextResponse> {
    // Quota par IP avant toute lecture : chaque tentative compte, compte connu ou non ; garde indisponible → 503.
    const quota = await reserveQuota(
        [{ scope: 'password_login_ip', bucket: getClientIp(req) ?? 'unknown', windowSecs: HOUR_SECONDS, max: getServerEnv().PASSWORD_LOGIN_PER_IP_HOUR }],
        'connexion par mot de passe',
    );
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, {
            error: 'Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.',
            code: 'LOGIN_RATE_LIMITED',
        });
    }

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json({ error: issue?.message ?? 'Identifiant ou mot de passe manquant.', code: 'INVALID_FIELD', field: issue?.path[0] ?? null }, { status: 400 });
    }
    const { identifier, password } = parsed.data;

    try {
        const identity = identifier.includes('@')
            ? { email: identifier.toLowerCase() }
            : await loginIdentityOfPhone(identifier);
        if (!identity) return invalidCredentials();

        const signIn = await serverPasswordSignIn(req, identity, password);
        if (!signIn.ok) return signIn.reason === 'INVALID_CREDENTIALS' ? invalidCredentials() : refusalResponse(signIn.code);
        return applySessionCookies(NextResponse.json({ ok: true }), signIn.cookies);
    } catch (err) {
        console.error(`[${CONTEXT}]`, err instanceof Error ? err.message : String(err));
        return unavailable();
    }
}

/**
 * POST /api/auth/login — lot 9 bis, tâche 14 (R58 ; contrat 4.2, B36). Publique (préfixe /api/auth du middleware).
 * `{ identifier, password }` : numéro ou email et mot de passe. La correspondance numéro → compte reste côté serveur ;
 * la session est posée en cookies @supabase/ssr et vaut saisie récente du mot de passe (R57). 200 `{ ok: true }` ;
 * 401 INVALID_CREDENTIALS, même corps pour un numéro inconnu et un mauvais mot de passe ; 429 au-delà du quota par IP
 * (PASSWORD_LOGIN_PER_IP_HOUR) ; 503 si la garde ou Supabase Auth est indisponible.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
