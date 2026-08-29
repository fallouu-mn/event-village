import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mTargetService } from '@/lib/sms/mtarget.service';

export const dynamic = 'force-dynamic';

/**
 * Valide la signature d'un Webhook Supabase Auth (Support Standard Webhooks / Svix et Bearer Token)
 */
function verifySupabaseHookSignature(req: NextRequest, rawBody: string, secret: string): boolean {
    if (!secret) return true;

    // 1. Vérification par header direct (Bearer Token ou Header personnalisé)
    const authHeader = req.headers.get('authorization') || req.headers.get('x-supabase-auth-hook-secret');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (token && (token === secret || secret.includes(token))) {
        return true;
    }

    // 2. Vérification par Signature HMAC-SHA256 (Format Svix / Standard Webhooks de Supabase)
    const webhookId = req.headers.get('webhook-id') || req.headers.get('svix-id') || req.headers.get('msg-id');
    const webhookTimestamp = req.headers.get('webhook-timestamp') || req.headers.get('svix-timestamp');
    const webhookSignature = req.headers.get('webhook-signature') || req.headers.get('svix-signature');

    if (webhookSignature && webhookTimestamp && webhookId) {
        try {
            // Extraction de la clé base64 (suppression des préfixes v1, et whsec_)
            let secretKey = secret;
            if (secretKey.startsWith('v1,')) {
                secretKey = secretKey.substring(3);
            }
            if (secretKey.startsWith('whsec_')) {
                secretKey = secretKey.substring(6);
            }

            const keyBuffer = Buffer.from(secretKey, 'base64');
            const toSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;
            const computedBase64 = crypto
                .createHmac('sha256', keyBuffer)
                .update(toSign)
                .digest('base64');

            // Le header contient une ou plusieurs signatures séparées par des espaces (ex: "v1,signature1 v1,signature2")
            const passedSignatures = webhookSignature
                .split(' ')
                .map((sig) => sig.replace(/^v1,/, ''));

            if (passedSignatures.some((sig) => sig === computedBase64)) {
                return true;
            }
        } catch (err) {
            console.warn('[SMS Hook] Erreur lors du calcul de la signature HMAC Svix:', err);
        }
    }

    return false;
}

/**
 * Route API /api/auth/sms-hook
 * Hook Webhook appelé par Supabase Auth lors de l'émission d'un code OTP par SMS.
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();

        // 1. Sécurisation du Hook : Vérification de la signature ou du token partagé
        const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        if (hookSecret) {
            const isValid = verifySupabaseHookSignature(req, rawBody, hookSecret);
            if (!isValid) {
                console.warn('[SMS Hook] Tentative d\'accès non autorisée : signature ou secret invalide.');
                return NextResponse.json(
                    { error: 'Unauthorized : signature ou secret de webhook invalide.' },
                    { status: 401 }
                );
            }
        }

        // 2. Parsing du payload JSON
        let body: Record<string, any>;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return NextResponse.json(
                { error: 'Payload JSON invalide.' },
                { status: 400 }
            );
        }

        // 3. Extraction du numéro de téléphone et du code OTP (Compatibilité formats Supabase Auth)
        const phone = body.user?.phone || body.recipient || body.phone || body.to;
        const otpCode = body.sms?.otp || body.otp || body.code || body.token;

        if (!phone || !otpCode) {
            console.error('[SMS Hook] Données manquantes dans le payload Supabase:', { phone: !!phone, otp: !!otpCode });
            return NextResponse.json(
                { error: 'Numéro de téléphone ou code OTP manquant.' },
                { status: 400 }
            );
        }

        // 4. Envoi du SMS OTP via MTarget Service
        const sendResult = await mTargetService.sendOtp(phone, otpCode.toString());

        if (!sendResult.success) {
            console.error('[SMS Hook] Échec de transmission MTarget:', sendResult.error);
            return NextResponse.json(
                {
                    error: sendResult.error || 'Erreur lors de l\'envoi du SMS via MTarget',
                    recipient: sendResult.recipient,
                },
                { status: 502 }
            );
        }

        // 5. Réponse 200 OK à Supabase Auth
        return NextResponse.json(
            {
                status: 'success',
                messageId: sendResult.messageId,
                recipient: sendResult.recipient,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur interne du serveur';
        console.error('[SMS Hook] Exception inattendue:', errorMsg);
        return NextResponse.json(
            { error: errorMsg },
            { status: 500 }
        );
    }
}
