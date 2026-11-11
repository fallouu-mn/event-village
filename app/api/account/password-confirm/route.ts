import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { noStore } from '@/lib/auth/account-sync';
import { PasswordCheckUnavailable, recordPasswordConfirmation, verifyAccountPassword } from '@/lib/auth/password-confirm';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getAuthenticatedSession } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/account/password-confirm';
const QUARTER_HOUR_SECONDS = 900;

const BodySchema = z.object({
    password: z.string({ required_error: 'Saisissez votre mot de passe.' }).min(1, 'Saisissez votre mot de passe.').max(200, 'Mot de passe trop long.'),
}).strict();

async function handle(req: NextRequest): Promise<NextResponse> {
    const session = await getAuthenticatedSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Saisissez votre mot de passe.', code: 'INVALID_FIELD', field: 'password' }, { status: 400 });
    }

    // Quota par compte, avant la vérification : chaque essai compte, juste ou faux.
    const quota = await reserveQuota(
        [{ scope: 'password_confirm_account', bucket: session.userId, windowSecs: QUARTER_HOUR_SECONDS, max: getServerEnv().PASSWORD_CONFIRM_PER_ACCOUNT_15MIN }],
        'confirmation du mot de passe',
    );
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, {
            error: 'Trop de tentatives. Réessayez dans quelques minutes.',
            code: 'PASSWORD_CONFIRM_RATE_LIMITED',
        });
    }

    try {
        const ok = await verifyAccountPassword(session.userId, parsed.data.password);
        if (!ok) {
            return NextResponse.json({ error: 'Mot de passe incorrect.', code: 'PASSWORD_INCORRECT' }, { status: 403 });
        }
        await recordPasswordConfirmation(session.sessionId, session.userId);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof PasswordCheckUnavailable) {
            console.error(`[${CONTEXT}]`, err.message);
            return NextResponse.json(
                { error: 'Vérification momentanément impossible. Réessayez dans un instant.', code: 'PASSWORD_CHECK_UNAVAILABLE' },
                { status: 503 }
            );
        }
        console.error(`[${CONTEXT}]`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Vérification momentanément impossible. Réessayez dans un instant.', code: 'PASSWORD_CHECK_UNAVAILABLE' }, { status: 500 });
    }
}

/**
 * POST /api/account/password-confirm — lot 9 bis, tâche 13 (R57 ; contrat 4.2, B35) : `{ password }` ; le mot de passe
 * est vérifié auprès de Supabase Auth sans laisser de session de plus, puis la saisie est liée à la session courante
 * pour 10 minutes. 200 `{ ok: true }` ; 403 PASSWORD_INCORRECT ; 429 au-delà du quota par compte
 * (PASSWORD_CONFIRM_PER_ACCOUNT_15MIN) ; 401 sans session.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
