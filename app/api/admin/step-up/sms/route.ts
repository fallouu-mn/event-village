import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { adminStepUpRefusal, deviceKey, deviceKeyOfValue, newDeviceCookieValue, setDeviceCookie } from '@/lib/admin/step-up';
import { noStore } from '@/lib/auth/account-sync';
import { hashOtpCode, otpFailureMessage, type OtpFailureReason } from '@/lib/auth/otp-store';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Empreinte HMAC du code administrateur (même secret que les codes SMS), liée au compte : jamais le code en clair. */
function adminCodeHash(userId: string, code: string): string {
    return hashOtpCode(`admin-step-up:${userId}`, code);
}

const VerifySchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Saisissez les 6 chiffres du code reçu par SMS.') }).strict();

/**
 * POST /api/admin/step-up/sms — lot 9 quinquies (A3 : AUTH-05).
 *  - corps vide `{}` : envoie le code administrateur (6 chiffres, 10 minutes) par SMS au numéro du compte, texte du chef
 *    de projet « Event Village : code administrateur {code}. Ne le donnez à personne. Valable 10 minutes. » ; SMS
 *    indispensable (garde des codes : limites par numéro et par IP) ; le code n'est rangé qu'en empreinte.
 *  - `{ code }` : vérifie le code (5 essais par code, 10 vérifications par 15 minutes et par compte) ; l'appareil est
 *    alors reconnu 12 heures (cookie httpOnly d'appareil posé s'il manque, Secure en production).
 * Le mot de passe de la session doit être récent (sinon ADMIN_PASSWORD_REQUIRED d'abord).
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { skipStepUp: true });
    if (!auth.authorized) return noStore(auth.errorResponse!);
    const userId = auth.user!.id;
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== userId) {
        return noStore(NextResponse.json({ error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_REQUIRED' }, { status: 401 }));
    }
    // Le mot de passe passe d'abord (12 h, inactivité) : le code ne remplace jamais le mot de passe.
    const before = await adminStepUpRefusal(req, userId, 'ADMIN', { touch: false });
    if (before && before.status !== 403) return noStore(before);
    if (before) {
        const body = (await before.clone().json()) as { code?: string };
        if (body.code === 'ADMIN_PASSWORD_REQUIRED') return noStore(before);
    }

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return noStore(NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 }));
    }
    const phone = auth.user!.phone;
    if (!/^\+221\d{9}$/.test(phone)) {
        return noStore(NextResponse.json({ error: 'Aucun numéro valable sur ce compte : contactez le SUPERADMIN.', code: 'NO_PHONE' }, { status: 409 }));
    }

    const isVerify = !!raw && typeof raw === 'object' && 'code' in (raw as Record<string, unknown>);
    if (!isVerify) {
        const reserved = await reserveSms(phone, { category: 'OTP', audience: 'ACCOUNT', ip: getClientIp(req) });
        if (!reserved.ok) return noStore(smsRefusalResponse(reserved.refusal));
        const code = randomInt(100000, 1000000).toString();
        const { data: stored, error: storeErr } = await getServiceRoleClient().rpc('admin_step_up_code_store', {
            p: { user_id: userId, code_hash: adminCodeHash(userId, code) },
        });
        if (storeErr || (stored as { ok?: boolean } | null)?.ok !== true) {
            console.error('[POST /api/admin/step-up/sms] code non enregistré :', storeErr?.message ?? JSON.stringify(stored));
            return noStore(NextResponse.json({ error: 'Code non préparé. Réessayez.', code: 'STEP_UP_SMS_FAILED' }, { status: 500 }));
        }
        const sent = await mTargetService.sendOtp(phone, code, {
            reservation: reserved.reservation,
            log: { type: 'OTP_ADMIN', ref: `${userId}:${Date.now()}`, userId, actorId: userId },
        });
        if (!sent.success) {
            console.error('[POST /api/admin/step-up/sms] SMS non parti :', sent.code ?? sent.error);
            return noStore(NextResponse.json({ error: 'Le SMS n’est pas parti. Réessayez dans un instant.', code: 'STEP_UP_SMS_FAILED' }, { status: 502 }));
        }
        return noStore(NextResponse.json({ ok: true, sent: true }));
    }

    const parsed = VerifySchema.safeParse(raw);
    if (!parsed.success) return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Code invalide.', code: 'INVALID_FIELD' }, { status: 400 }));
    const quota = await reserveQuota([{ scope: 'admin_step_up_sms', bucket: userId, windowSecs: 900, max: 10 }], 'code administrateur');
    if (!quota.allowed) return noStore(quotaRefusalResponse(quota, { error: 'Trop d’essais de code. Patientez avant de réessayer.', code: 'STEP_UP_RATE_LIMITED' }));
    const { data: checked, error: checkErr } = await getServiceRoleClient().rpc('admin_step_up_code_check', {
        p: { user_id: userId, code_hash: adminCodeHash(userId, parsed.data.code) },
    });
    if (checkErr) {
        console.error('[POST /api/admin/step-up/sms] vérification impossible :', checkErr.message);
        return noStore(NextResponse.json({ error: 'Vérification momentanément impossible. Réessayez.', code: 'STEP_UP_UNAVAILABLE' }, { status: 503 }));
    }
    const check = checked as { ok?: boolean; reason?: OtpFailureReason } | null;
    if (check?.ok !== true) {
        const { message, status } = otpFailureMessage(check?.reason ?? 'INVALID');
        return noStore(NextResponse.json({ error: message, code: 'STEP_UP_CODE_INVALID' }, { status }));
    }
    // Navigateur (session en cookies) : cookie d'appareil posé s'il manque. Client par jeton (en-tête Bearer, sans
    // cookie) : l'appareil est sa session, aucun cookie.
    const bearerClient = (req.headers.get('authorization') ?? '').startsWith('Bearer ');
    const fresh = bearerClient ? null : newDeviceCookieValue(req);
    const key = fresh ? deviceKeyOfValue(fresh) : deviceKey(req, current.sessionId);
    const { data, error } = await getServiceRoleClient().rpc('admin_device_verified', { p: { user_id: userId, device_key: key, session_id: current.sessionId } });
    if (error || (data as { ok?: boolean } | null)?.ok !== true) {
        console.error('[POST /api/admin/step-up/sms] appareil non enregistré :', error?.message ?? JSON.stringify(data));
        return noStore(NextResponse.json({ error: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'STEP_UP_UNAVAILABLE' }, { status: 503 }));
    }
    const res = NextResponse.json({ ok: true });
    if (fresh) setDeviceCookie(res, fresh);
    return noStore(res);
}
