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
import { activationPendingResponse } from '@/lib/auth/account-activation';
import { suspendedAccountMessage } from '@/lib/support-contact';

export const dynamic = 'force-dynamic';

function generateOtpCode(): string {
    return randomInt(100000, 1000000).toString();
}

/** Type du journal synchrone (lot 6, contrat E7) selon l'objet du code. */
const SYNC_TYPE = { LOGIN: 'OTP_LOGIN', REGISTER: 'OTP_REGISTER', PASSWORD_RESET: 'OTP_PASSWORD_RESET' } as const;

/** Lot 9 bis (R84) : réponse d'une demande de récupération acceptée, que le numéro ait un compte ou non. */
const NEUTRAL_RESET_REPLY = { success: true } as const;

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

        // Compte du numéro, lu pour tout objet (lot 9 quater : part du plafond, contrôleur non activé).
        const { data: userRecord, error: userRecordErr } = await supabase
            .from('users')
            .select('id, email, phone, status')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        // Lot 9 (A34) : une panne n'est pas un compte absent, et aucun SMS ne part.
        if (userRecordErr) {
            return apiFailure('POST /api/auth/send-otp, lecture du compte', userRecordErr, { message: 'Envoi du code momentanément impossible. Réessayez.', code: 'OTP_SEND_FAILED' });
        }

        // Lot 9 quinquies (A5 : T1) : compte suspendu (connexion ou « Mot de passe oublié ») : refus AVANT toute réservation
        // et tout SMS, avec le contact du support ; le numéro d'un compte est déjà dit par /api/auth/resolve-phone (AUD-07).
        if (userRecord && otpPurpose !== 'REGISTER' && String(userRecord.status) === 'SUSPENDU') {
            const refusal = await suspendedAccountMessage();
            return NextResponse.json({ error: refusal.error, code: 'ACCOUNT_SUSPENDED', support: refusal.support }, { status: 403 });
        }

        // Si demande de réinitialisation de mot de passe, vérifier l'existence du compte
        let resetUserId: string | null = null;
        if (purpose === 'PASSWORD_RESET') {
            // Lot 9 bis (R84, B86, D2) : même réponse neutre que la récupération par email ; un numéro sans compte ne
            // reçoit ni code ni SMS, et la réponse ne dit pas si un compte existe.
            if (!userRecord) {
                return NextResponse.json(NEUTRAL_RESET_REPLY);
            }
            resetUserId = String(userRecord.id);
        }

        // Lot 9 quater (A5 : G-97) : un compte contrôleur invité, pas encore activé, ne reçoit ni code de connexion ni
        // code « Mot de passe oublié » : son activation passe par le lien reçu par SMS (/controller/setup).
        if (userRecord && otpPurpose !== 'REGISTER') {
            try {
                // Lot 9 quinquies (A2) : compte créé par un admin pas encore activé, même refus
                const { data: authRow, error: authErr } = await supabase.auth.admin.getUserById(String(userRecord.id));
                if (authErr || !authRow?.user) throw new Error(`compte d’authentification ${userRecord.id} illisible : ${authErr?.message ?? 'absent'}`);
                const pending = activationPendingResponse(authRow.user);
                if (pending) return pending;
            } catch (pendingErr) {
                return apiFailure('POST /api/auth/send-otp, compte d’authentification', pendingErr, { message: 'Envoi du code momentanément impossible. Réessayez.', code: 'OTP_SEND_FAILED' });
            }
        }

        // 0. Lot 1C.9 : réservation anti-abus (numéro, IP, plafond global) AVANT d'enregistrer le
        //    code : un refus ne doit pas remplacer le code en attente du titulaire du numéro.
        //    Lot 9 quater (A8 : AUD-05) : un numéro sans compte tire sur la part des inscriptions, jamais sur le plafond
        //    global des codes des comptes existants.
        const reserved = await reserveSms(normalizedPhone, {
            category: 'OTP',
            audience: userRecord ? 'ACCOUNT' : 'NEW_NUMBER',
            ip: getClientIp(req),
        });
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

        if (purpose === 'PASSWORD_RESET') return NextResponse.json(NEUTRAL_RESET_REPLY);

        return NextResponse.json({
            success: true,
            message: `Code de confirmation envoyé par SMS au ${normalizedPhone}.`,
            recipient: normalizedPhone,
        });
    } catch (error: unknown) {
        return apiFailure('POST /api/auth/send-otp', error, { message: 'Envoi du code momentanément impossible. Réessayez.', code: 'OTP_SEND_FAILED' });
    }
}
