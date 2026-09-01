import { NextRequest, NextResponse } from 'next/server';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { otpMemoryCache } from '@/lib/sms/otp-cache';

export const dynamic = 'force-dynamic';

function generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/send-otp
 * Génère un code OTP sécurisé et l'envoie par SMS via MTarget / NotificationService
 */
export async function POST(req: NextRequest) {
    try {
        let body: { phone?: string; purpose?: string; type?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const rawPhone = body.phone?.trim();
        const purpose = (body.purpose || body.type || 'AUTH').toUpperCase();

        if (!rawPhone) {
            return NextResponse.json({ error: 'Numéro de téléphone requis.' }, { status: 400 });
        }

        const normalizedPhone = normalizePhoneNumber(rawPhone);
        if (!/^\+221[7][05678]\d{7}$/.test(normalizedPhone)) {
            return NextResponse.json(
                { error: 'Numéro de téléphone sénégalais invalide (ex: 77 123 45 67).' },
                { status: 400 }
            );
        }

        // Protection Anti-Bombardement SMS (Rate Limiting)
        const { RateLimiter } = await import('@/lib/security/rate-limiter');
        const limitCheck = RateLimiter.isRateLimited(`otp_send_${normalizedPhone}`);
        if (limitCheck.limited) {
            return NextResponse.json(
                {
                    error: `Trop de demandes d'envoi SMS. Par sécurité, veuillez patienter ${limitCheck.remainingSeconds || 60} secondes.`,
                    remainingSeconds: limitCheck.remainingSeconds || 60,
                },
                { status: 429 }
            );
        }

        const supabase = getServiceRoleClient();

        // Si demande de réinitialisation de mot de passe, vérifier l'existence du compte
        let userEmail: string | undefined;
        if (purpose === 'PASSWORD_RESET') {
            const { data: userRecord } = await supabase
                .from('users')
                .select('id, email, phone')
                .eq('phone', normalizedPhone)
                .maybeSingle();

            if (!userRecord) {
                return NextResponse.json(
                    { error: 'Aucun compte n\'est associé à ce numéro de téléphone.' },
                    { status: 404 }
                );
            }
            userEmail = userRecord.email || undefined;
        }

        // 1. Génération du code OTP à 6 chiffres
        const otpCode = generateOtpCode();
        const expiresAt = Date.now() + 10 * 60 * 1000; // Valide 10 minutes

        // 2. Sauvegarde en mémoire cache
        otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt, attempts: 0 });

        // 3. Sauvegarde en base de données Supabase (si table otp_codes existante)
        try {
            await (supabase.from('otp_codes') as any).insert({
                phone: normalizedPhone,
                code: otpCode,
                expires_at: new Date(expiresAt).toISOString(),
                verified: false,
            });
        } catch (dbErr) {
            // Fallback silencieux
        }

        // 4. Envoi effectif du SMS
        let sendSuccess = false;
        let errorMessage: string | undefined;

        if (purpose === 'PASSWORD_RESET') {
            const notifRes = await NotificationService.sendPasswordResetNotification({
                phone: normalizedPhone,
                resetCode: otpCode,
                email: userEmail,
            });
            sendSuccess = notifRes.smsSent || notifRes.emailSent;
            if (!sendSuccess) {
                errorMessage = 'Impossible d\'envoyer le SMS de réinitialisation.';
            }
        } else {
            const sendResult = await mTargetService.sendOtp(normalizedPhone, otpCode);
            sendSuccess = sendResult.success;
            errorMessage = sendResult.error;
        }

        if (!sendSuccess) {
            console.error('[API send-otp] Échec envoi SMS:', errorMessage);
            return NextResponse.json(
                {
                    error: errorMessage || 'Impossible d\'envoyer le SMS.',
                    recipient: normalizedPhone,
                },
                { status: 502 }
            );
        }

        RateLimiter.recordFailedAttempt(`otp_send_${normalizedPhone}`);
        return NextResponse.json({
            success: true,
            message: purpose === 'PASSWORD_RESET'
                ? `Code de réinitialisation envoyé par SMS au ${normalizedPhone}.`
                : `Code de confirmation envoyé par SMS au ${normalizedPhone}.`,
            recipient: normalizedPhone,
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur interne du serveur';
        console.error('[API send-otp] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
