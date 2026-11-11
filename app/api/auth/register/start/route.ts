import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { INVALID_SN_PHONE_MESSAGE, RegisterStartSchema, toSenegaleseE164 } from '@/lib/validations/auth';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { storeOtp } from '@/lib/auth/otp-store';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';
import { findExistingAccount } from '@/lib/auth/existing-account';

export const dynamic = 'force-dynamic';

/** Durée de validité du code d'inscription (secondes). */
const REGISTER_CODE_TTL_SECONDS = 600;
/** Délai affiché avant de proposer un nouveau code (secondes) ; la garde anti-abus reste seule juge. */
const REGISTER_RESEND_AFTER_SECONDS = 60;

/**
 * POST /api/auth/register/start — lot 7 (7.3, D1, contrat 3.6) : inscription « numéro d'abord », étape 1.
 * { phone } → un code REGISTER est enregistré haché (storeOtp) puis envoyé par SMS (journal OTP_REGISTER,
 * sans le code). AUCUN compte n'est créé : il ne l'est qu'après la vérification du code par
 * POST /api/auth/register. Un tiers qui démarre l'inscription d'un numéro ne le bloque donc plus : le
 * titulaire redemande un code, seul le plus récent est valable.
 * Refus : 400 INVALID_PHONE ; 409 PHONE_ALREADY_REGISTERED (aucun SMS : chaque SMS est facturé) ; garde
 * anti-abus (numéro, IP, plafond) par smsRefusalResponse ; 503 si l'envoi échoue.
 */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }

    const parsed = RegisterStartSchema.safeParse(body);
    const phone = parsed.success ? toSenegaleseE164(parsed.data.phone) : null;
    if (!phone) {
        return NextResponse.json(
            { error: INVALID_SN_PHONE_MESSAGE, code: 'INVALID_PHONE' },
            { status: 400 },
        );
    }

    try {
        // Un numéro déjà inscrit ne déclenche aucun SMS (lot 1C.9).
        const existing = await findExistingAccount(phone, null);
        if (existing) {
            return NextResponse.json(
                { error: 'Ce numéro de téléphone est déjà associé à un compte. Veuillez vous connecter.', code: 'PHONE_ALREADY_REGISTERED' },
                { status: 409 },
            );
        }

        // Réservation anti-abus (numéro, IP, plafond global) avant d'enregistrer le code : un refus ne remplace
        // pas le code en attente du titulaire.
        const reserved = await reserveSms(phone, { category: 'OTP', ip: getClientIp(req) });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

        const code = randomInt(100000, 1000000).toString();
        const otpId = await storeOtp(phone, code, new Date(Date.now() + REGISTER_CODE_TTL_SECONDS * 1000), 'REGISTER');

        // L'adaptateur renvoie success:false sans lever : le résultat est contrôlé (lot 1C.9). Envoi synchrone
        // journalisé dans la boîte d'envoi, sans le code (lot 6, contrat E7).
        const sent = await mTargetService.sendOtp(phone, code, {
            reservation: reserved.reservation,
            purpose: 'REGISTER',
            log: { type: 'OTP_REGISTER', ref: otpId },
        });
        if (!sent.success) {
            console.error('[API /api/auth/register/start] envoi du code d\'inscription en échec :', sent.error);
            return NextResponse.json(
                { error: 'Impossible d\'envoyer le code de vérification par SMS. Vérifiez votre numéro et réessayez.', code: 'SMS_SEND_FAILED' },
                { status: 503 },
            );
        }

        return NextResponse.json({
            ok: true,
            phone,
            expires_in: REGISTER_CODE_TTL_SECONDS,
            resend_after: REGISTER_RESEND_AFTER_SECONDS,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API /api/auth/register/start] erreur interne :', err instanceof Error ? err.message : String(err));
        return NextResponse.json(
            { error: 'Inscription momentanément impossible. Réessayez dans un instant.', code: 'REGISTER_START_FAILED' },
            { status: 500 },
        );
    }
}
