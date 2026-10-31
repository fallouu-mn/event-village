import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { storeOtp } from '@/lib/auth/otp-store';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';

export const dynamic = 'force-dynamic';

function generateOtpCode(): string {
    return randomInt(100000, 1000000).toString();
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

        // 0. Lot 1C.9 : réservation anti-abus (numéro, IP, plafond global) AVANT d'enregistrer le
        //    code : un refus ne doit pas remplacer le code en attente du titulaire du numéro.
        const reserved = await reserveSms(normalizedPhone, { category: 'OTP', ip: getClientIp(req) });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

        // 1. Génération du code OTP à 6 chiffres
        const otpCode = generateOtpCode();
        const expiresAt = Date.now() + 10 * 60 * 1000; // Valide 10 minutes

        // 2-3. Lot 1B.7 : enregistrement en base, seule source de vérité (aucun cache mémoire).
        try {
            await storeOtp(normalizedPhone, otpCode, new Date(expiresAt));
        } catch (storeErr) {
            console.error('[API /api/auth/send-otp]', storeErr instanceof Error ? storeErr.message : storeErr);
            return NextResponse.json({ error: 'Impossible de préparer le code de vérification. Réessayez.' }, { status: 500 });
        }

        // 4. Envoi effectif du SMS
        let sendSuccess = false;
        let errorMessage: string | undefined;

        if (purpose === 'PASSWORD_RESET') {
            const notifRes = await NotificationService.sendPasswordResetNotification({
                phone: normalizedPhone,
                resetCode: otpCode,
                email: userEmail,
                sms: { reservation: reserved.reservation },
            });
            // Le code ne part que par SMS : emailSent ne signifie pas qu'un email est parti.
            sendSuccess = notifRes.smsSent;
            if (!sendSuccess) {
                errorMessage = 'Impossible d\'envoyer le SMS de réinitialisation.';
            }
        } else {
            const sendResult = await mTargetService.sendOtp(normalizedPhone, otpCode, { reservation: reserved.reservation });
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
