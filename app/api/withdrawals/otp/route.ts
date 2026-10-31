import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { storeOtp } from '@/lib/auth/otp-store';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';
import { normalizePhoneNumber } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ account: z.enum(['ORGANISATEUR', 'PARRAINAGE']) });

/**
 * POST /api/withdrawals/otp — code de confirmation d'un retrait (lot 3.6, CDC §153).
 * Le code est envoyé au téléphone DU COMPTE (jamais à un numéro fourni par la requête) et
 * enregistré avec l'objet WITHDRAWAL : il ne vaut que pour un retrait, et aucun code d'un autre
 * objet (connexion, inscription…) n'est accepté par /api/withdrawals/request.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Compte inconnu (ORGANISATEUR ou PARRAINAGE).' }, { status: 400 });
    if (parsed.data.account === 'ORGANISATEUR' && !serverIsPartner(session.user)) {
        return NextResponse.json({ error: 'Compte organisateur réservé aux partenaires.', code: 'NOT_PARTNER' }, { status: 403 });
    }
    if (!session.user.phone) {
        return NextResponse.json({ error: 'Aucun numéro de téléphone sur votre compte.', code: 'PHONE_REQUIRED' }, { status: 400 });
    }
    const phone = normalizePhoneNumber(session.user.phone);

    const reserved = await reserveSms(phone, { category: 'OTP', ip: getClientIp(req) });
    if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

    const code = randomInt(100000, 1000000).toString();
    try {
        await storeOtp(phone, code, new Date(Date.now() + 10 * 60 * 1000), 'WITHDRAWAL');
    } catch (err) {
        console.error('[API /api/withdrawals/otp] enregistrement du code impossible :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Impossible de préparer le code de confirmation. Réessayez.' }, { status: 500 });
    }
    const sent = await mTargetService.sendOtp(phone, code, { reservation: reserved.reservation });
    if (!sent.success) {
        console.error('[API /api/withdrawals/otp] envoi du SMS impossible :', sent.error);
        return NextResponse.json({ error: 'Impossible d’envoyer le code par SMS. Réessayez.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, message: 'Code de confirmation envoyé par SMS au numéro de votre compte.' });
}
