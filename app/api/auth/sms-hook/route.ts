import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mTargetService, reserveSms } from '@/lib/sms/mtarget.service';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { toSenegaleseE164 } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

/** Écart maximal accepté entre l'horodatage signé et l'horloge du serveur (Standard Webhooks). */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Lot 1C.9 — authentification du hook « Send SMS » de Supabase Auth.
 * Accepte uniquement :
 *  - une signature Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature) calculée
 *    avec le secret, horodatage à ± 5 minutes ;
 *  - ou le secret complet en Bearer (comparaison à temps constant).
 * L'ancienne version acceptait toute sous-chaîne du secret (`secret.includes(token)`) et
 * relayait sans contrôle quand le secret n'était pas configuré.
 */
function isAuthorizedHookCall(req: NextRequest, rawBody: string, secret: string): boolean {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (token && safeEqual(token, secret)) return true;

    const webhookId = req.headers.get('webhook-id');
    const webhookTimestamp = req.headers.get('webhook-timestamp');
    const webhookSignature = req.headers.get('webhook-signature');
    if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

    const timestamp = Number(webhookTimestamp);
    if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

    // Secret Supabase : « v1,whsec_<base64> »
    const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', key).update(`${webhookId}.${webhookTimestamp}.${rawBody}`).digest('base64');
    // L'en-tête peut porter plusieurs signatures : « v1,sig1 v1,sig2 »
    return webhookSignature
        .split(' ')
        .filter((sig) => sig.startsWith('v1,'))
        .some((sig) => safeEqual(sig.slice(3), expected));
}

/**
 * Route API /api/auth/sms-hook
 * Hook appelé par Supabase Auth lors de l'émission d'un code OTP par SMS.
 * L'envoi passe par la garde anti-abus (limites par numéro et plafond global, catégorie OTP).
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();

        // 1. Secret obligatoire : sans lui, le hook serait un relais SMS ouvert
        const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        if (!hookSecret) {
            console.error('[SMS Hook] SUPABASE_AUTH_HOOK_SECRET absent : appel refusé.');
            return NextResponse.json({ error: 'Hook SMS non configuré.', code: 'SMS_HOOK_NOT_CONFIGURED' }, { status: 503 });
        }
        if (!isAuthorizedHookCall(req, rawBody, hookSecret)) {
            console.warn('[SMS Hook] Appel refusé : signature ou secret invalide.');
            return NextResponse.json({ error: 'Signature ou secret de webhook invalide.' }, { status: 401 });
        }

        // 2. Payload JSON
        let body: { user?: { phone?: unknown }; sms?: { otp?: unknown } };
        try {
            body = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        // 3. Destinataire et code (format du hook Send SMS de Supabase Auth)
        const phone = typeof body.user?.phone === 'string' ? toSenegaleseE164(body.user.phone) : null;
        const otpCode = typeof body.sms?.otp === 'string' || typeof body.sms?.otp === 'number' ? String(body.sms.otp) : '';
        if (!phone) {
            return NextResponse.json({ error: 'Numéro de téléphone absent ou non sénégalais.', code: 'INVALID_PHONE' }, { status: 400 });
        }
        if (!/^\d{4,10}$/.test(otpCode)) {
            return NextResponse.json({ error: 'Code OTP absent ou invalide.' }, { status: 400 });
        }

        // 4. Garde anti-abus puis envoi
        const reserved = await reserveSms(phone, { category: 'OTP' });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);
        // Lot 6 (E7) : envoi synchrone journalisé sans le code ; référence = en-tête webhook-id (signature
        // Standard Webhooks), sinon un identifiant propre à cet appel (appel authentifié par Bearer).
        const hookRef = req.headers.get('webhook-id')?.trim() || crypto.randomUUID();
        const sendResult = await mTargetService.sendOtp(phone, otpCode, {
            reservation: reserved.reservation,
            purpose: 'AUTH_HOOK',
            log: { type: 'OTP_AUTH_HOOK', ref: hookRef.slice(0, 200) },
        });
        if (!sendResult.success) {
            console.error('[SMS Hook] Échec de transmission MTarget:', sendResult.error);
            return NextResponse.json({ error: 'Envoi du SMS impossible.' }, { status: 502 });
        }

        return NextResponse.json({ status: 'success', messageId: sendResult.messageId }, { status: 200 });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur interne du serveur';
        console.error('[SMS Hook] Exception inattendue:', errorMsg);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
