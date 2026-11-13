import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { noStore } from '@/lib/auth/account-sync';
import { grantAuthWritePermit } from '@/lib/auth/auth-permits';
import { requireActiveSession } from '@/lib/auth/session';
import { revokeUserSessions } from '@/lib/auth/sessions';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';
import { StrongPasswordSchema } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/auth/reset-password';

/** Âge maximal d'un lien email de récupération (méthode « recovery » du jeton), comme l'autorisation par SMS. */
const RECOVERY_MAX_AGE_SECONDS = 15 * 60;

const BodySchema = z.object({
    password: z.string({ required_error: 'Saisissez le nouveau mot de passe.' })
        .max(200, 'Mot de passe trop long.')
        .pipe(StrongPasswordSchema),
}).strict();

/** Réponse neuve à chaque appel (un corps de réponse ne se lit qu'une fois). */
function notRecovery(): NextResponse {
    return NextResponse.json(
        {
            error: 'Cette page sert seulement après « Mot de passe oublié ». Demandez un nouveau code, ou changez votre mot de passe depuis votre profil.',
            code: 'RECOVERY_SESSION_REQUIRED',
        },
        { status: 403 },
    );
}

function failure(): NextResponse {
    return NextResponse.json(
        { error: 'Mot de passe non modifié pour le moment. Demandez un nouveau code et réessayez.', code: 'PASSWORD_RESET_FAILED' },
        { status: 500 },
    );
}

/** Méthodes d'authentification (amr) d'un jeton déjà validé par GoTrue ; [] si la charge est illisible. */
function amrOf(accessToken: string): Array<{ method?: unknown; timestamp?: unknown }> {
    try {
        const claims = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { amr?: unknown };
        return Array.isArray(claims.amr) ? claims.amr as Array<{ method?: unknown; timestamp?: unknown }> : [];
    } catch (err) {
        console.error(`[${CONTEXT}] charge du jeton illisible :`, err instanceof Error ? err.message : String(err));
        return [];
    }
}

/** Le jeton vient-il d'un lien email de récupération de moins de 15 minutes ? */
function isRecentEmailRecovery(accessToken: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    return amrOf(accessToken).some((m) => m.method === 'recovery'
        && typeof m.timestamp === 'number' && now - m.timestamp <= RECOVERY_MAX_AGE_SECONDS);
}

async function handle(req: NextRequest): Promise<NextResponse> {
    const active = await requireActiveSession(req);
    if (active.response) return active.response;
    const { user } = active;
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== user.id) {
        return NextResponse.json({ error: 'Session expirée. Demandez un nouveau code.', code: 'SESSION_REQUIRED' }, { status: 401 });
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
            { error: issue?.message ?? 'Mot de passe invalide.', code: 'WEAK_PASSWORD', field: 'password' },
            { status: 400 },
        );
    }

    const supabase = getServiceRoleClient();
    // Session de récupération : autorisation ouverte par le code SMS « Mot de passe oublié » (verify-otp), ou lien email
    // de récupération de GoTrue (méthode « recovery » du jeton). Lot 9 quinquies (A8) : l'autorisation du code ne sert
    // qu'à une session ouverte APRÈS la vérification du code (une session volée, plus ancienne, est refusée), 10 minutes,
    // une seule fois (account_recovery_consume). Toute autre session passe par « Changer mon mot de passe » (ancien exigé).
    if (!isRecentEmailRecovery(current.accessToken)) {
        const { data: consumed, error: grantErr } = await supabase.rpc('account_recovery_consume', {
            p: { user_id: user.id, session_id: current.sessionId },
        });
        if (grantErr) {
            console.error(`[${CONTEXT}] autorisation de récupération illisible pour ${user.id} :`, grantErr.message);
            return failure();
        }
        const reply = consumed as { ok?: boolean; code?: string } | null;
        if (reply?.ok !== true) {
            if (reply?.code === 'NO_GRANT' || reply?.code === 'OTHER_SESSION') return notRecovery();
            console.error(`[${CONTEXT}] autorisation de récupération refusée pour ${user.id} :`, JSON.stringify(consumed));
            return failure();
        }
    }

    try {
        await grantAuthWritePermit(user.id, 'PASSWORD');
    } catch (err) {
        console.error(`[${CONTEXT}]`, err instanceof Error ? err.message : String(err));
        return failure();
    }
    // L'API d'administration ferme TOUTES les sessions du compte (celle-ci comprise) : l'écran renvoie à la connexion.
    // L'avis PASSWORD_CHANGED (SMS, cloche, email) part du trigger d'authentification.
    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password: parsed.data.password });
    if (updErr) {
        console.error(`[${CONTEXT}] mise à jour du mot de passe de ${user.id} :`, updErr.code ?? '', updErr.message);
        if (updErr.code === 'weak_password') {
            return NextResponse.json(
                { error: 'Ce mot de passe est trop faible. Choisissez-en un autre.', code: 'WEAK_PASSWORD', field: 'password' },
                { status: 400 },
            );
        }
        return failure();
    }
    // Révocation explicite et journalisée (jetons de rafraîchissement compris), en plus de celle de GoTrue
    if (!(await revokeUserSessions(user.id, { reason: 'PASSWORD_RESET', actorId: user.id }))) {
        return NextResponse.json(
            { error: 'Mot de passe modifié, mais les autres appareils n’ont pas pu être déconnectés. Contactez le support.', code: 'PASSWORD_SESSIONS_NOT_REVOKED' },
            { status: 500 },
        );
    }
    return NextResponse.json({ ok: true, message: 'Mot de passe modifié. Connectez-vous avec le nouveau.' });
}

/**
 * POST /api/auth/reset-password — lot 9 quater (A3 : G-04, AUD-02). `{ password }`.
 * Seule une session de récupération est admise (code SMS « Mot de passe oublié » vérifié depuis moins de 15 minutes,
 * ou lien email de récupération de moins de 15 minutes) ; robustesse vérifiée côté serveur (règle commune,
 * StrongPasswordSchema) ; mot de passe posé par l'API d'administration avec un permis (la base refuse tout autre
 * changement), toutes les sessions révoquées ; l'avis « mot de passe modifié » part du trigger.
 * 200 ; 400 WEAK_PASSWORD ; 401 ; 403 RECOVERY_SESSION_REQUIRED ou ACCOUNT_NOT_ACTIVE ; 500.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
