import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { noStore } from '@/lib/auth/account-sync';
import { PasswordCheckUnavailable, verifyAccountPassword } from '@/lib/auth/password-confirm';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';
import { StrongPasswordSchema } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/account/password';
const QUARTER_HOUR_SECONDS = 900;

const SUCCESS_TEXT = 'Mot de passe modifié. Vos autres appareils sont déconnectés.';
const FALLBACK = { message: 'Votre mot de passe n’a pas pu être changé. Réessayez dans un instant.', code: 'PASSWORD_CHANGE_FAILED' };
/** Le mot de passe est déjà changé dans GoTrue : seul le reste (sessions, journal) a manqué ; la RPC se rejoue. */
const SESSIONS_NOT_REVOKED = new PublicError(
    'Mot de passe changé, mais les autres appareils n’ont pas pu être déconnectés. Réessayez.',
    'PASSWORD_SESSIONS_NOT_REVOKED',
    500,
);

const BodySchema = z.object({
    current_password: z.string({ required_error: 'Saisissez votre mot de passe actuel.' })
        .min(1, 'Saisissez votre mot de passe actuel.')
        .max(200, 'Mot de passe trop long.'),
    new_password: z.string({ required_error: 'Saisissez le nouveau mot de passe.' })
        .max(200, 'Mot de passe trop long.')
        .pipe(StrongPasswordSchema),
}).strict();

/**
 * Reste S3 (R85, D5) : le mot de passe est changé par la session courante (`PUT /auth/v1/user` avec son jeton), qui
 * ferme les autres sessions et garde celle-ci. L'API d'administration (`updateUserById`) ferme TOUTES les sessions du
 * compte, la courante comprise (compte-mot-de-passe : « seule la session courante reste »). Rend `null` si le mot de
 * passe est posé, sinon le code et le message de GoTrue (jamais montrés tels quels).
 */
async function updateOwnPassword(accessToken: string, password: string): Promise<{ code?: string; message: string } | null> {
    const env = getServerEnv();
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
        method: 'PUT',
        headers: {
            apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    });
    if (res.ok) return null;
    const text = await res.text();
    let body: { code?: unknown; error_code?: unknown; msg?: unknown; message?: unknown } = {};
    try {
        body = text ? (JSON.parse(text) as typeof body) : {};
    } catch {
        return { message: `HTTP ${res.status} ${text.slice(0, 200)}` };
    }
    const code = typeof body.error_code === 'string' ? body.error_code : typeof body.code === 'string' ? body.code : undefined;
    const message = typeof body.msg === 'string' ? body.msg : typeof body.message === 'string' ? body.message : `HTTP ${res.status}`;
    return { code, message: `HTTP ${res.status} ${message}` };
}

async function handle(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { user } = session;

    // Session courante identifiée avant tout effet : sans elle, aucune révocation « sauf celle-ci » n'est possible.
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== user.id) {
        return NextResponse.json(
            { error: 'Votre session ne permet pas ce changement. Reconnectez-vous puis recommencez.', code: 'SESSION_REQUIRED' },
            { status: 401 }
        );
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
        return NextResponse.json(
            { error: issue?.message ?? 'Données invalides.', code: 'INVALID_FIELD', field: issue?.path[0] ?? null },
            { status: 400 }
        );
    }
    const { current_password: currentPassword, new_password: newPassword } = parsed.data;
    if (newPassword === currentPassword) {
        return NextResponse.json(
            { error: 'Le nouveau mot de passe doit être différent de l’actuel.', code: 'PASSWORD_UNCHANGED', field: 'new_password' },
            { status: 400 }
        );
    }

    try {
        // Même portée que la confirmation du mot de passe (R57) : chaque essai compte, juste ou faux, sur le compte.
        const quota = await reserveQuota(
            [{ scope: 'password_confirm_account', bucket: user.id, windowSecs: QUARTER_HOUR_SECONDS, max: getServerEnv().PASSWORD_CONFIRM_PER_ACCOUNT_15MIN }],
            'changement du mot de passe',
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de tentatives. Réessayez dans quelques minutes.',
                code: 'PASSWORD_CONFIRM_RATE_LIMITED',
            });
        }

        const ok = await verifyAccountPassword(user.id, currentPassword);
        if (!ok) {
            return NextResponse.json({ error: 'Mot de passe actuel incorrect.', code: 'PASSWORD_INCORRECT' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();
        const updateErr = await updateOwnPassword(current.accessToken, newPassword);
        if (updateErr) {
            if (updateErr.code === 'weak_password') {
                return NextResponse.json(
                    { error: 'Ce mot de passe est trop faible. Choisissez-en un autre.', code: 'WEAK_PASSWORD', field: 'new_password' },
                    { status: 400 }
                );
            }
            return apiFailure(CONTEXT, new Error(`mise à jour du mot de passe de ${user.id} : ${updateErr.code ?? ''} ${updateErr.message}`), FALLBACK);
        }

        const { data, error } = await supabase.rpc('account_password_finalize', {
            p: { user_id: user.id, keep_session_id: current.sessionId },
        });
        const reply = data as { ok?: boolean; code?: string } | null;
        if (error || reply?.ok !== true) {
            console.error(`[${CONTEXT}] mot de passe changé pour ${user.id}, finalisation en échec :`,
                error ? `${error.code ?? ''} ${error.message}` : JSON.stringify(reply));
            return apiFailure(CONTEXT, SESSIONS_NOT_REVOKED, FALLBACK);
        }

        return NextResponse.json({ ok: true, message: SUCCESS_TEXT });
    } catch (err: unknown) {
        if (err instanceof PasswordCheckUnavailable) {
            console.error(`[${CONTEXT}]`, err.message);
            return NextResponse.json(
                { error: 'Vérification momentanément impossible. Réessayez dans un instant.', code: 'PASSWORD_CHECK_UNAVAILABLE' },
                { status: 503 }
            );
        }
        return apiFailure(CONTEXT, err, FALLBACK);
    }
}

/**
 * POST /api/account/password — lot 9 bis, tâche 42 (R85 ; contrat 4.4, B89, décision D5) : « Changer mon mot de
 * passe » une fois connecté. `{ current_password, new_password }`.
 * Ordre : session ACTIVE (401, 403) et session courante identifiée ; corps (400 : nouveau mot de passe faible ou
 * identique) ; quota par compte partagé avec la confirmation du mot de passe (429) ; vérification de l'actuel sans
 * session laissée (403 PASSWORD_INCORRECT « Mot de passe actuel incorrect. ») ; mise à jour par GoTrue ; RPC
 * account_password_finalize (autres sessions révoquées, session courante gardée et confirmée, journal). L'avis
 * PASSWORD_CHANGED part du trigger d'authentification. 200 « Mot de passe modifié. Vos autres appareils sont
 * déconnectés. » ; RPC en échec après la mise à jour : 500 PASSWORD_SESSIONS_NOT_REVOKED.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
