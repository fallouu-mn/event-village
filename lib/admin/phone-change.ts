/**
 * Finition 3d (points 2a et 2c) — changement du numéro d'un administrateur, prouvé par un code envoyé au NOUVEAU numéro.
 *
 *  - BY_SUPERADMIN (POST /api/admin/users/[id]/phone/start et /confirm) : le SUPERADMIN change le numéro d'un ADMIN, avec un
 *    motif ; l'ADMIN lui dicte le code reçu ; toutes ses sessions et tous ses appareils sont révoqués.
 *  - SELF (POST /api/admin/security/phone/start et /confirm) : le SUPERADMIN change le sien (après un code de secours, ou avec son code habituel) ; ses
 *    autres sessions et appareils sont révoqués.
 *
 * Début : quotas (3 demandes par jour et par compte visé, 10 par jour et par auteur), demande enregistrée et contrôlée en
 * base (admin_phone_change_start : SUPERADMIN, mot de passe et code, cible, motif, numéro libre), puis seulement le SMS
 * au nouveau numéro (garde des SMS). Fin : 10 vérifications par 15 minutes et par auteur ; code vérifié en base (5 essais,
 * 10 minutes) ; auth.users mis à jour, puis admin_phone_change_finalize (même auteur, même session) ; en cas d'échec,
 * auth.users est remis en l'état (compensateAuthIdentity, comme le changement de numéro d'un client).
 */
import { randomInt, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOtpCode } from '@/lib/auth/otp-store';
import { authUpdateRefusedAsTaken, compensateAuthIdentity, identityTaken } from '@/lib/auth/account-sync';
import { technicalEmailFor } from '@/lib/auth/technical-email';
import { deviceKey } from '@/lib/admin/step-up';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';
import { toSenegaleseE164 } from '@/lib/validations/auth';

export type PhoneChangeKind = 'BY_SUPERADMIN' | 'SELF';

const DAY = 86_400;
const NO_STORE = { 'Cache-Control': 'no-store' };

const START_REFUSALS: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400, REASON_REQUIRED: 400, SUPERADMIN_ONLY: 403, PASSWORD_CONFIRMATION_REQUIRED: 403,
    ADMIN_CODE_CONFIRMATION_REQUIRED: 403, USER_NOT_FOUND: 404, SELF_TARGET: 409, TARGET_IS_SUPERADMIN: 409,
    TARGET_NOT_ADMIN: 409, PHONE_UNCHANGED: 409, PHONE_TAKEN: 409,
};
const VERIFY_REFUSALS: Readonly<Record<string, number>> = {
    REQUEST_NOT_FOUND: 404, REQUEST_CLOSED: 409, CODE_EXPIRED: 410, INVALID_CODE: 400, TOO_MANY_ATTEMPTS: 429,
};
const FINALIZE_REFUSALS: Readonly<Record<string, number>> = {
    REQUEST_NOT_FOUND: 404, NOT_VERIFIED: 409, CODE_EXPIRED: 410, SUPERADMIN_ONLY: 403, TARGET_NOT_ADMIN: 409,
    PHONE_CONFLICT: 409, PHONE_TAKEN: 409,
};

function json(body: Record<string, unknown>, status = 200): NextResponse {
    return NextResponse.json(body, { status, headers: NO_STORE });
}

function failure(context: string, detail: unknown): NextResponse {
    console.error(`[${context}]`, detail instanceof Error ? detail.message : JSON.stringify(detail));
    return json({ error: 'Le numéro n’a pas pu être changé. Réessayez dans un instant.', code: 'PHONE_CHANGE_FAILED' }, 500);
}

function refusal(reply: { code?: string; message?: string } | null, table: Readonly<Record<string, number>>, context: string): NextResponse {
    const status = table[String(reply?.code)];
    if (!status || typeof reply?.message !== 'string') return failure(context, reply);
    return json({ error: reply.message, code: reply.code }, status);
}

const StartSchema = z.object({
    phone: z.string().trim().min(8, 'Saisissez le nouveau numéro.').max(20, 'Numéro trop long.'),
    reason: z.string().trim().max(500, 'Le motif est limité à 500 caractères.').optional(),
}).strict();

const ConfirmSchema = z.object({
    request_id: z.string().uuid('Demande introuvable : recommencez le changement.'),
    code: z.string().regex(/^\d{6}$/, 'Saisissez les 6 chiffres du code reçu par SMS.'),
}).strict();

async function bodyOf(req: NextRequest): Promise<unknown> {
    try {
        return await req.json();
    } catch {
        return undefined;
    }
}

/** Début : `{ phone, reason }` ; l'identité (mot de passe et code) a été contrôlée par l'appelant (requireAdminIdentity). */
export async function startPhoneChange(req: NextRequest, p: {
    actorId: string; targetId: string; kind: PhoneChangeKind; sessionId: string; deviceKey: string; context: string;
}): Promise<NextResponse> {
    const parsed = StartSchema.safeParse(await bodyOf(req));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_FIELD' }, 400);
    const phone = toSenegaleseE164(parsed.data.phone);
    if (!phone) return json({ error: 'Numéro invalide : un numéro mobile du Sénégal.', code: 'INVALID_FIELD', field: 'phone' }, 400);
    try {
        const quota = await reserveQuota([
            { scope: 'admin_phone_change_target', bucket: p.targetId, windowSecs: DAY, max: 3 },
            { scope: 'admin_phone_change_actor', bucket: p.actorId, windowSecs: DAY, max: 10 },
        ], 'changement du numéro d’un administrateur');
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, { error: 'Trop de changements de numéro aujourd’hui pour ce compte. Réessayez demain.', code: 'PHONE_CHANGE_RATE_LIMITED' });
        }
        const requestId = randomUUID();
        const code = randomInt(100000, 1000000).toString();
        const { data, error } = await getServiceRoleClient().rpc('admin_phone_change_start', {
            p: {
                request_id: requestId, actor_id: p.actorId, target_id: p.targetId, kind: p.kind, new_phone: phone,
                reason: parsed.data.reason ?? null, code_hash: hashOtpCode(`admin-phone-change:${requestId}`, code),
                session_id: p.sessionId, device_key: p.deviceKey,
            },
        });
        if (error) return failure(p.context, error);
        const reply = data as { ok?: boolean; code?: string; message?: string; expires_at?: string } | null;
        if (reply?.ok !== true) return refusal(reply, START_REFUSALS, p.context);

        const reserved = await reserveSms(phone, { category: 'OTP', audience: 'NEW_NUMBER', ip: getClientIp(req) });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);
        const sent = await mTargetService.sendOtp(phone, code, {
            reservation: reserved.reservation,
            purpose: p.kind === 'SELF' ? 'PHONE_CHANGE' : 'ADMIN_PHONE_CHANGE',
            log: { type: p.kind === 'SELF' ? 'OTP_PHONE_CHANGE' : 'OTP_ADMIN_PHONE', ref: requestId, userId: p.targetId, actorId: p.actorId },
        });
        if (!sent.success) {
            console.error(`[${p.context}] SMS non parti :`, sent.code ?? sent.error);
            return json({ error: 'Le SMS n’est pas parti. Réessayez dans un instant.', code: 'SMS_SEND_FAILED' }, 502);
        }
        return json({ ok: true, request_id: requestId, expires_at: reply.expires_at ?? null });
    } catch (err) {
        return failure(p.context, err);
    }
}

/** Fin : `{ request_id, code }`. */
export async function confirmPhoneChange(req: NextRequest, p: {
    actorId: string; targetId: string; kind: PhoneChangeKind; context: string;
}): Promise<NextResponse> {
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== p.actorId) return json({ error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_REQUIRED' }, 401);
    const parsed = ConfirmSchema.safeParse(await bodyOf(req));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_FIELD' }, 400);
    const supabase = getServiceRoleClient();
    try {
        const quota = await reserveQuota([{ scope: 'admin_phone_change_verify', bucket: p.actorId, windowSecs: 900, max: 10 }], 'vérification du nouveau numéro');
        if (!quota.allowed) return quotaRefusalResponse(quota, { error: 'Trop de codes saisis. Patientez avant de réessayer.', code: 'PHONE_CHANGE_RATE_LIMITED' });

        const { data: checked, error: checkErr } = await supabase.rpc('admin_phone_change_verify', {
            p: { request_id: parsed.data.request_id, actor_id: p.actorId, code_hash: hashOtpCode(`admin-phone-change:${parsed.data.request_id}`, parsed.data.code) },
        });
        if (checkErr) return failure(p.context, checkErr);
        const check = checked as { ok?: boolean; code?: string; message?: string; target_id?: string; new_phone?: string; kind?: string } | null;
        if (check?.ok !== true) return refusal(check, VERIFY_REFUSALS, p.context);
        if (check.target_id !== p.targetId || check.kind !== p.kind || !check.new_phone) {
            return json({ error: 'Demande introuvable : recommencez le changement.', code: 'REQUEST_NOT_FOUND' }, 404);
        }

        const { data: profile, error: profileErr } = await supabase.from('users').select('email').eq('id', p.targetId).maybeSingle();
        if (profileErr || !profile) return failure(p.context, profileErr ?? new Error('compte visé introuvable'));
        const newEmail = profile.email ? null : technicalEmailFor(p.targetId);
        const taken = await identityTaken(p.targetId, newEmail, check.new_phone);
        if (taken.phoneTaken || taken.emailTaken) return json({ error: 'Ce numéro est déjà celui d’un autre compte.', code: 'PHONE_TAKEN' }, 409);

        const { error: updateErr } = await supabase.auth.admin.updateUserById(p.targetId, {
            phone: check.new_phone, phone_confirm: true, ...(newEmail ? { email: newEmail, email_confirm: true } : {}),
        });
        if (updateErr) {
            if (await authUpdateRefusedAsTaken(updateErr, p.targetId, newEmail, check.new_phone)) {
                return json({ error: 'Ce numéro est déjà celui d’un autre compte.', code: 'PHONE_TAKEN' }, 409);
            }
            return failure(p.context, updateErr);
        }
        const { data: done, error: doneErr } = await supabase.rpc('admin_phone_change_finalize', {
            p: { request_id: parsed.data.request_id, actor_id: p.actorId, session_id: current.sessionId, device_key: deviceKey(req, current.sessionId) },
        });
        const reply = done as { ok?: boolean; code?: string; message?: string; sessions_revoked?: number } | null;
        if (doneErr || reply?.ok !== true) {
            if (!(await compensateAuthIdentity(p.targetId, 'admin_phone_change', 'phone_email'))) return failure(p.context, 'remise en l’état de auth.users impossible');
            if (doneErr) return failure(p.context, doneErr);
            return refusal(reply, FINALIZE_REFUSALS, p.context);
        }
        return json({ ok: true, sessions_revoked: Number(reply.sessions_revoked ?? 0) });
    } catch (err) {
        return failure(p.context, err);
    }
}
