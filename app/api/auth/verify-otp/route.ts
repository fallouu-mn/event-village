import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { ACCOUNT_OTP_PURPOSES, otpFailureMessage, verifyStoredOtp, type OtpPurpose } from '@/lib/auth/otp-store';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/verify-otp
 * Vérifie la validité d'un code OTP transmis par un utilisateur et génère un token de session si connexion
 */
export async function POST(req: NextRequest) {
    try {
        let body: { phone?: string; otpCode?: string; isLogin?: boolean; purpose?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const rawPhone = body.phone?.trim();
        const otpCode = body.otpCode?.trim();
        const isLogin = !!body.isLogin;

        if (!rawPhone || !otpCode) {
            return NextResponse.json(
                { error: 'Numéro de téléphone et code OTP requis.' },
                { status: 400 }
            );
        }

        const normalizedPhone = normalizePhoneNumber(rawPhone);

        // Lot 4.8 : anti-force brute en base (VERIFY_OTP_PER_PHONE_15MIN), réservé avant la vérification :
        // chaque tentative compte (bonne ou mauvaise), une rafale parallèle ne passe pas, et la garde
        // indisponible refuse (503).
        const quota = await reserveQuota(
            [{ scope: 'otp_verify_phone', bucket: normalizedPhone, windowSecs: 900, max: getServerEnv().VERIFY_OTP_PER_PHONE_15MIN }],
            'vérification OTP'
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de tentatives de vérification pour ce numéro. Réessayez plus tard.',
                code: 'OTP_VERIFY_RATE_LIMITED',
            });
        }

        // 1-2. Lot 1B.7 : vérification en base uniquement (otp_codes), indépendante de l'instance
        //      qui a émis le code. Une erreur de lecture ou d'écriture est une erreur serveur.
        // Lot 3 : seuls les codes du parcours de compte (connexion, inscription, réinitialisation)
        // sont acceptés ici ; un code de retrait ou d'activation de contrôleur n'ouvre jamais de session.
        const requested = typeof body.purpose === 'string' ? body.purpose.toUpperCase() as OtpPurpose : null;
        const purposes = requested && ACCOUNT_OTP_PURPOSES.includes(requested) ? [requested] : ACCOUNT_OTP_PURPOSES;
        const check = await verifyStoredOtp(normalizedPhone, otpCode, purposes);
        if (!check.ok) {
            const { message, status } = otpFailureMessage(check.reason);
            return NextResponse.json({ error: message }, { status });
        }

        const supabase = getServiceRoleClient();

        // Lot 6 (contrat B1) : un code SMS vérifié prouve la possession du numéro ; la première date est
        // conservée (équivalent de COALESCE). Seule preuve utilisée pour recevoir un billet transféré.
        const { error: verifiedErr } = await supabase
            .from('users')
            .update({ phone_verified_at: new Date().toISOString() })
            .eq('phone', normalizedPhone)
            .is('phone_verified_at', null);
        if (verifiedErr) {
            console.error('[API verify-otp] enregistrement de la vérification du numéro impossible :', verifiedErr.message);
            return NextResponse.json(
                { error: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'PHONE_VERIFY_FAILED' },
                { status: 503 }
            );
        }

        // 3. Récupération du profil utilisateur et génération de session
        const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (isLogin && !userProfile) {
            return NextResponse.json(
                { error: 'Aucun compte n\'est associé à ce numéro de téléphone. Veuillez vous inscrire.' },
                { status: 404 }
            );
        }

        // Confirmer le téléphone dans auth.users si pas encore fait (H3: partenaire OTP)
        if (userProfile?.id) {
            try {
                await supabase.auth.admin.updateUserById(userProfile.id, { phone_confirm: true });
            } catch (confirmErr) {
                console.warn('[API verify-otp] Impossible de confirmer phone_confirm:', confirmErr);
            }
        }

        let tokenHash: string | undefined;
        const targetEmail = userProfile?.email || `${normalizedPhone.replace('+', '')}@eventvillage.sn`;

        if (userProfile) {
            try {
                const { data: linkData } = await supabase.auth.admin.generateLink({
                    type: 'magiclink',
                    email: targetEmail,
                });
                tokenHash = linkData?.properties?.hashed_token;
            } catch (linkErr) {
                console.warn('[API verify-otp] Notice generateLink:', linkErr);
            }
        }

        return NextResponse.json({
            success: true,
            verified: true,
            user: userProfile,
            token_hash: tokenHash,
            email: targetEmail,
            phone: normalizedPhone,
            message: 'Numéro de téléphone vérifié avec succès.',
        });
    } catch (error: unknown) {
        return apiFailure('POST /api/auth/verify-otp', error, { message: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'OTP_VERIFY_FAILED' });
    }
}
