import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { randomInt } from 'crypto';
import { mTargetService } from '@/lib/sms/mtarget.service';
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

/** Type du journal synchrone (lot 6, contrat E7) selon l'objet du code. */
const SYNC_TYPE = { LOGIN: 'OTP_LOGIN', REGISTER: 'OTP_REGISTER', PASSWORD_RESET: 'OTP_PASSWORD_RESET' } as const;

/**
 * POST /api/auth/send-otp
 * Génère un code OTP sécurisé et l'envoie par SMS (envoi synchrone, journalisé sans le code dans la
 * boîte d'envoi : lot 6, contrat E7). Le code de réinitialisation a son propre texte (catalogue).
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
        // Lot 3 : objet enregistré avec le code (un code ne vaut que pour son objet)
        const otpPurpose: keyof typeof SYNC_TYPE = purpose === 'PASSWORD_RESET' ? 'PASSWORD_RESET'
            : ['REGISTER', 'SIGNUP', 'INSCRIPTION'].includes(purpose) ? 'REGISTER'
            : 'LOGIN';

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
        let resetUserId: string | null = null;
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
            resetUserId = String(userRecord.id);
        }

        // 0. Lot 1C.9 : réservation anti-abus (numéro, IP, plafond global) AVANT d'enregistrer le
        //    code : un refus ne doit pas remplacer le code en attente du titulaire du numéro.
        const reserved = await reserveSms(normalizedPhone, { category: 'OTP', ip: getClientIp(req) });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

        // 1. Génération du code OTP à 6 chiffres
        const otpCode = generateOtpCode();
        const expiresAt = Date.now() + 10 * 60 * 1000; // Valide 10 minutes

        // 2-3. Lot 1B.7 : enregistrement en base, seule source de vérité (aucun cache mémoire).
        let otpId: string;
        try {
            otpId = await storeOtp(normalizedPhone, otpCode, new Date(expiresAt), otpPurpose);
        } catch (storeErr) {
            console.error('[API /api/auth/send-otp]', storeErr instanceof Error ? storeErr.message : storeErr);
            return NextResponse.json({ error: 'Impossible de préparer le code de vérification. Réessayez.' }, { status: 500 });
        }

        // 4. Envoi effectif du SMS (synchrone : l'utilisateur attend), journalisé sans le code (lot 6, E7).
        //    Le code ne part que par SMS (réinitialisation comprise).
        const sendResult = await mTargetService.sendOtp(normalizedPhone, otpCode, {
            reservation: reserved.reservation,
            purpose: otpPurpose,
            log: { type: SYNC_TYPE[otpPurpose], ref: otpId, userId: resetUserId },
        });
        const sendSuccess = sendResult.success;

        if (!sendSuccess) {
            // Le détail vient du fournisseur (statut HTTP, code de refus) : il reste au journal.
            console.error('[API send-otp] Échec envoi SMS:', sendResult.error);
            return NextResponse.json(
                {
                    error: purpose === 'PASSWORD_RESET' ? 'Impossible d\'envoyer le SMS de réinitialisation.' : 'Impossible d\'envoyer le SMS. Réessayez dans un instant.',
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
        return apiFailure('POST /api/auth/send-otp', error, { message: 'Envoi du code momentanément impossible. Réessayez.', code: 'OTP_SEND_FAILED' });
    }
}
