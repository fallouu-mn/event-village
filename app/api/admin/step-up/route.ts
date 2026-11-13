import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { adminIdleMinutes, adminStepUpRefusal } from '@/lib/admin/step-up';
import { noStore } from '@/lib/auth/account-sync';
import { PasswordCheckUnavailable, recordPasswordConfirmation, verifyAccountPassword } from '@/lib/auth/password-confirm';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getAuthenticatedSession } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PasswordSchema = z.object({ password: z.string().min(1, 'Saisissez votre mot de passe.').max(200, 'Mot de passe trop long.') }).strict();

/** Numéro masqué : « 77 ••• •• 67 ». */
function maskedPhone(phone: string): string | null {
    const m = /^\+221(\d{2})\d{5}(\d{2})$/.exec(phone);
    return m ? `${m[1]} ••• •• ${m[2]}` : null;
}

/**
 * GET /api/admin/step-up — lot 9 quinquies (A3, A4) : état de la session d'administration, pour la fenêtre de
 * l'administration. `{ required: null | 'ADMIN_PASSWORD_REQUIRED' | 'ADMIN_SMS_REQUIRED', reason, idleMinutes, phone }`.
 * Ne compte pas comme une activité.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { skipStepUp: true });
    if (!auth.authorized) return noStore(auth.errorResponse!);
    const refusal = await adminStepUpRefusal(req, auth.user!.id, 'ADMIN', { touch: false });
    let required: string | null = null;
    let reason: string | null = null;
    if (refusal) {
        const body = (await refusal.clone().json()) as { code?: string; reason?: string };
        if (refusal.status !== 403) return noStore(refusal);
        required = body.code ?? null;
        reason = body.reason ?? null;
    }
    return noStore(NextResponse.json({ required, reason, idleMinutes: adminIdleMinutes(), phone: maskedPhone(auth.user!.phone) }));
}

/**
 * POST /api/admin/step-up — `{ password }` : mot de passe redemandé (inactivité, 12 h). Vérifié auprès de GoTrue,
 * enregistré pour la session (password_confirmations), compte comme une activité. 5 essais par 15 minutes et par compte.
 * 200 ; 400 ; 401 ; 403 PASSWORD_INCORRECT ; 429 ; 503.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { skipStepUp: true });
    if (!auth.authorized) return noStore(auth.errorResponse!);
    const userId = auth.user!.id;
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== userId) {
        return noStore(NextResponse.json({ error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_REQUIRED' }, { status: 401 }));
    }
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return noStore(NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 }));
    }
    const parsed = PasswordSchema.safeParse(raw);
    if (!parsed.success) return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Mot de passe requis.', code: 'INVALID_FIELD' }, { status: 400 }));
    const quota = await reserveQuota([{ scope: 'admin_step_up_password', bucket: userId, windowSecs: 900, max: 5 }], 'mot de passe de l’administration');
    if (!quota.allowed) return noStore(quotaRefusalResponse(quota, { error: 'Trop d’essais de mot de passe. Patientez avant de réessayer.', code: 'STEP_UP_RATE_LIMITED' }));
    try {
        if (!(await verifyAccountPassword(userId, parsed.data.password))) {
            return noStore(NextResponse.json({ error: 'Mot de passe incorrect.', code: 'PASSWORD_INCORRECT' }, { status: 403 }));
        }
        await recordPasswordConfirmation(current.sessionId, userId);
    } catch (err) {
        if (err instanceof PasswordCheckUnavailable) {
            console.error('[POST /api/admin/step-up]', err.message);
            return noStore(NextResponse.json({ error: 'Vérification momentanément impossible. Réessayez dans un instant.', code: 'STEP_UP_UNAVAILABLE' }, { status: 503 }));
        }
        throw err;
    }
    // La saisie compte comme une activité ; l'état suivant (code SMS éventuel) est rendu à la fenêtre.
    const next = await adminStepUpRefusal(req, userId, 'ADMIN', { touch: true });
    const body = next && next.status === 403 ? (await next.clone().json()) as { code?: string } : null;
    return noStore(NextResponse.json({ ok: true, required: body?.code ?? null }));
}
