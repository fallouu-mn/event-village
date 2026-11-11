import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { otpFailureMessage, verifyStoredOtp } from '@/lib/auth/otp-store';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { WithdrawalService } from '@/lib/payments/withdrawal.service';
import { normalizePhoneNumber } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

const BodySchema = z.object({
    account: z.enum(['ORGANISATEUR', 'PARRAINAGE']),
    amount: z.number().positive(),
    method: z.enum(['MOBILE_MONEY', 'BANK']).default('MOBILE_MONEY'),
    operator: z.enum(['WAVE', 'ORANGE_MONEY']).optional().nullable(),
    phoneNumber: z.string().trim().optional().nullable(),
    otpCode: z.string().trim().regex(/^\d{6}$/, 'Code de confirmation à 6 chiffres.'),
});

const REFUSAL_STATUS: Record<string, number> = {
    INSUFFICIENT_BALANCE: 409,
    // Lot 9 bis (R4, B14) : net d'un événement suspendu, gelé (fin_withdrawal_check)
    FUNDS_FROZEN: 409,
    NOT_PARTNER: 403,
    ACCOUNT_NOT_ACTIVE: 403,
};

/**
 * POST /api/withdrawals/request — retrait (lot 3.6). Session ACTIF ; en-tête Idempotency-Key ;
 * code OTP de l'objet WITHDRAWAL (envoyé par /api/withdrawals/otp au téléphone du compte).
 * Seuil, frais et solde sont décidés en base (withdrawal_request) ; l'envoi passe par le module de
 * cashout. Wave ou Orange Money vers le numéro déclaré ; virement bancaire refusé tant que le réglage
 * finance.withdrawal_bank_enabled est désactivé. Même clé → même retrait, jamais un second envoi.
 * Lot 5 (C6) : quota par compte (WITHDRAWAL_REQUEST_PER_USER_HOUR) réservé avant la vérification du
 * code : chaque demande compte, même refusée, ce qui borne les essais de code par compte.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const key = req.headers.get('idempotency-key')?.trim() ?? '';
    if (!IDEMPOTENCY_KEY.test(key)) {
        return NextResponse.json({ error: 'En-tête Idempotency-Key obligatoire.', code: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
    }
    const quota = await reserveQuota(
        [{ scope: 'withdrawal_request_user', bucket: session.user.id, windowSecs: 3600, max: getServerEnv().WITHDRAWAL_REQUEST_PER_USER_HOUR }],
        'demande de retrait');
    if (!quota.allowed) {
        return quota.reason === 'EXCEEDED'
            ? NextResponse.json({ error: `Trop de demandes de retrait. Réessayez dans ${Math.max(1, Math.ceil(quota.retryAfterSeconds / 60))} min.`, code: 'RATE_LIMITED' },
                { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } })
            : NextResponse.json({ error: 'Retrait momentanément indisponible.', code: 'GUARD_UNAVAILABLE' }, { status: 503 });
    }
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Demande de retrait invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
    }
    const input = parsed.data;
    if (input.account === 'ORGANISATEUR' && !serverIsPartner(session.user)) {
        return NextResponse.json({ error: 'Compte organisateur réservé aux partenaires.', code: 'NOT_PARTNER' }, { status: 403 });
    }
    let phoneNumber: string | null = null;
    if (input.method === 'MOBILE_MONEY') {
        phoneNumber = normalizePayerPhone(input.phoneNumber ?? '');
        if (!input.operator || !phoneNumber) {
            return NextResponse.json({ error: 'Choisissez Wave ou Orange Money et un numéro mobile sénégalais (9 chiffres).', code: 'INVALID_DESTINATION' }, { status: 400 });
        }
    }
    if (!session.user.phone) {
        return NextResponse.json({ error: 'Aucun numéro de téléphone sur votre compte.', code: 'PHONE_REQUIRED' }, { status: 400 });
    }

    try {
        const otp = await verifyStoredOtp(normalizePhoneNumber(session.user.phone), input.otpCode, 'WITHDRAWAL');
        if (!otp.ok) {
            const { message, status } = otpFailureMessage(otp.reason);
            return NextResponse.json({ error: message, code: `OTP_${otp.reason}` }, { status });
        }
        const result = await WithdrawalService.request({
            userId: session.user.id,
            account: input.account,
            amount: input.amount,
            method: input.method,
            operator: input.operator ?? null,
            phoneNumber,
            clientKey: key,
            otpVerifiedAt: new Date().toISOString(),
        });
        if (!result.ok) {
            return NextResponse.json({ error: result.message, code: result.code, ...result.details }, { status: REFUSAL_STATUS[result.code] ?? 400 });
        }
        return NextResponse.json({
            ok: true,
            duplicate: result.duplicate,
            withdrawal_id: result.withdrawalId,
            status: result.status,
            gross_amount: result.grossAmount,
            fee_amount: result.feeAmount,
            net_amount: result.netAmount,
            cashout_status: result.cashoutStatus,
        });
    } catch (err) {
        console.error(`[API /api/withdrawals/request] retrait de ${session.user.id} impossible :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Retrait momentanément indisponible.' }, { status: 500 });
    }
}
