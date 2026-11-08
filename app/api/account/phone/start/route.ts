import { randomInt } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { noStore } from '@/lib/auth/account-sync';
import { findExistingAccount } from '@/lib/auth/existing-account';
import { storeOtp } from '@/lib/auth/otp-store';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { PhoneChangeStartSchema } from '@/lib/validations/account';
import { phoneStorageForms } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/account/phone/start';
const FALLBACK = { message: 'Impossible de préparer le code de confirmation. Réessayez dans un instant.', code: 'PHONE_CHANGE_FAILED' };
const DAY_SECONDS = 86_400;
const OTP_TTL_MS = 10 * 60 * 1000;

const refuse = (err: unknown): NextResponse => apiFailure(CONTEXT, err, FALLBACK);

async function handle(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { user } = session;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = PhoneChangeStartSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json({ error: issue?.message ?? 'Numéro invalide.', code: 'INVALID_FIELD', field: issue?.path[0] ?? null }, { status: 400 });
    }
    const { phone } = parsed.data;

    try {
        if (user.phone && phoneStorageForms(phone).includes(user.phone)) {
            return refuse(new PublicError('Ce numéro est déjà celui de votre compte.', 'PHONE_UNCHANGED', 400));
        }
        // Avant tout SMS facturé. public.users seul : un numéro présent uniquement dans auth.users relève de confirm (AM1, réparation).
        if (await findExistingAccount(phone, null)) {
            return refuse(new PublicError('Ce numéro est déjà associé à un compte.', 'PHONE_TAKEN', 409));
        }

        const quota = await reserveQuota(
            [{ scope: 'phone_change_account', bucket: user.id, windowSecs: DAY_SECONDS, max: getServerEnv().PHONE_CHANGE_PER_ACCOUNT_DAY }],
            'changement de numéro',
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de demandes de changement de numéro aujourd’hui. Réessayez demain.',
                code: 'PHONE_CHANGE_RATE_LIMITED',
            });
        }

        const reserved = await reserveSms(phone, { category: 'OTP', ip: getClientIp(req) });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

        const code = randomInt(100000, 1000000).toString();
        const otpId = await storeOtp(phone, code, new Date(Date.now() + OTP_TTL_MS), 'PHONE_CHANGE');
        const sent = await mTargetService.sendOtp(phone, code, {
            reservation: reserved.reservation,
            purpose: 'PHONE_CHANGE',
            log: { type: 'OTP_PHONE_CHANGE', ref: otpId, userId: user.id, actorId: user.id },
        });
        if (!sent.success) {
            console.error(`[${CONTEXT}] envoi du SMS impossible :`, sent.error);
            return NextResponse.json({ error: 'Impossible d’envoyer le code par SMS. Réessayez.', code: 'SMS_SEND_FAILED' }, { status: 502 });
        }
        return NextResponse.json({ ok: true, message: 'Code de confirmation envoyé par SMS au nouveau numéro.' });
    } catch (err) {
        return refuse(err);
    }
}

/**
 * POST /api/account/phone/start — code au NOUVEAU numéro, objet PHONE_CHANGE (lot 9, 9.2, contrat 4.3, L26).
 * Le compte vient de la session ; aucun SMS à l'ancien numéro à ce stade.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
