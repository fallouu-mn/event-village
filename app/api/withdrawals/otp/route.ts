import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { storeOtp } from '@/lib/auth/otp-store';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/withdrawals/otp';
const QUOTE_FALLBACK = { message: 'Retrait momentanément indisponible. Réessayez dans un instant.', code: 'WITHDRAWAL_QUOTE_FAILED' };

const BodySchema = z.object({
    account: z.enum(['ORGANISATEUR', 'PARRAINAGE'], { errorMap: () => ({ message: 'Compte inconnu (ORGANISATEUR ou PARRAINAGE).' }) }),
    // Lot 9 bis (R62, B27) : le montant est exigé, le devis passe avant le code
    amount: z.number({ required_error: 'Indiquez le montant du retrait.', invalid_type_error: 'Indiquez le montant du retrait.' })
        .int('Montant entier en FCFA attendu.').positive('Indiquez le montant du retrait.'),
});

/** Refus du devis (withdrawal_quote, même règle que withdrawal_request) : statut HTTP du contrat 4.1. */
const QUOTE_REFUSALS: Record<string, number> = {
    BELOW_MINIMUM: 400,
    INVALID_AMOUNT: 400,
    INVALID_ACCOUNT: 400,
    INSUFFICIENT_BALANCE: 409,
    FUNDS_FROZEN: 409,
    WITHDRAWAL_LOCKED_PHONE_CHANGE: 423,
    ACCOUNT_NOT_ACTIVE: 403,
    NOT_PARTNER: 403,
};

type Quote = {
    ok?: boolean; code?: string; message?: string; unlock_at?: string;
    minimum?: number; fee_rate?: number; fee_amount?: number; net_amount?: number;
};

/** Devis accepté, ou réponse de refus prête à rendre (aucun SMS réservé). */
async function quoteOrRefusal(userId: string, account: string, amount: number): Promise<{ quote: Quote } | { response: NextResponse }> {
    try {
        const { data, error } = await getServiceRoleClient().rpc('withdrawal_quote', {
            p: { user_id: userId, account_kind: account, gross_amount: amount },
        });
        if (error) throw new Error(`withdrawal_quote : ${error.code ?? ''} ${error.message}`);
        const quote = data as Quote | null;
        if (!quote) throw new Error('withdrawal_quote : réponse vide');
        if (quote.ok === true) return { quote };
        const status = QUOTE_REFUSALS[String(quote.code)];
        if (!status) throw new Error(`withdrawal_quote : refus inattendu ${JSON.stringify(quote)}`);
        if (quote.code === 'WITHDRAWAL_LOCKED_PHONE_CHANGE') {
            return { response: NextResponse.json({ error: quote.message, code: quote.code, unlock_at: quote.unlock_at ?? null }, { status }) };
        }
        throw new PublicError(String(quote.message ?? 'Retrait refusé.'), String(quote.code), status);
    } catch (err) {
        return { response: apiFailure(CONTEXT, err, QUOTE_FALLBACK) };
    }
}

/**
 * POST /api/withdrawals/otp — code de confirmation d'un retrait (lot 3.6, CDC §153).
 * Le code est envoyé au téléphone DU COMPTE (jamais à un numéro fourni par la requête) et
 * enregistré avec l'objet WITHDRAWAL : il ne vaut que pour un retrait, et aucun code d'un autre
 * objet (connexion, inscription…) n'est accepté par /api/withdrawals/request.
 * Lot 9 bis (R62, B27, B26, R4) : corps `{ account, amount }` ; le devis (withdrawal_quote : minimum, solde, gel,
 * verrou de 24 h après un changement de numéro, frais, net) passe AVANT la réservation du SMS : tout refus rend son
 * code (400 BELOW_MINIMUM, 409 INSUFFICIENT_BALANCE ou FUNDS_FROZEN, 423 WITHDRAWAL_LOCKED_PHONE_CHANGE avec
 * `unlock_at`…) sans code ni SMS. Accepté : 200 `{ sent: true, quote: { minimum, fee_rate, fee_amount, net_amount } }`.
 * withdrawal_request recontrôle tout au moment du retrait.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    let body: unknown;
    try {
        body = await req.json();
    } catch (parseErr) {
        console.error(`[${CONTEXT}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Demande de code invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
    }
    if (parsed.data.account === 'ORGANISATEUR' && !serverIsPartner(session.user)) {
        return NextResponse.json({ error: 'Compte organisateur réservé aux partenaires.', code: 'NOT_PARTNER' }, { status: 403 });
    }
    if (!session.user.phone) {
        return NextResponse.json({ error: 'Aucun numéro de téléphone sur votre compte.', code: 'PHONE_REQUIRED' }, { status: 400 });
    }

    // Devis avant tout SMS (D12) : un refus ne réserve rien et n'envoie rien
    const decided = await quoteOrRefusal(session.user.id, parsed.data.account, parsed.data.amount);
    if ('response' in decided) return decided.response;
    const { quote } = decided;

    const phone = normalizePhoneNumber(session.user.phone);

    const reserved = await reserveSms(phone, { category: 'OTP', ip: getClientIp(req) });
    if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

    const code = randomInt(100000, 1000000).toString();
    let otpId: string;
    try {
        otpId = await storeOtp(phone, code, new Date(Date.now() + 10 * 60 * 1000), 'WITHDRAWAL');
    } catch (err) {
        console.error('[API /api/withdrawals/otp] enregistrement du code impossible :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Impossible de préparer le code de confirmation. Réessayez.' }, { status: 500 });
    }
    // Lot 6 (E7) : envoi synchrone journalisé dans la boîte d'envoi, sans le code.
    const sent = await mTargetService.sendOtp(phone, code, {
        reservation: reserved.reservation,
        purpose: 'WITHDRAWAL',
        log: { type: 'OTP_WITHDRAWAL', ref: otpId, userId: session.user.id, actorId: session.user.id },
    });
    if (!sent.success) {
        console.error('[API /api/withdrawals/otp] envoi du SMS impossible :', sent.error);
        return NextResponse.json({ error: 'Impossible d’envoyer le code par SMS. Réessayez.' }, { status: 502 });
    }
    return NextResponse.json({
        ok: true,
        sent: true,
        message: 'Code de confirmation envoyé par SMS au numéro de votre compte.',
        quote: {
            minimum: Number(quote.minimum),
            fee_rate: Number(quote.fee_rate),
            fee_amount: Number(quote.fee_amount),
            net_amount: Number(quote.net_amount),
        },
    });
}
