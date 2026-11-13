import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { ACCOUNT_OTP_PURPOSES, otpFailureMessage, verifyStoredOtp, type OtpPurpose } from '@/lib/auth/otp-store';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { grantAuthWritePermit } from '@/lib/auth/auth-permits';
import { controllerNotActivatedResponse, isControllerActivationPending } from '@/lib/auth/controller-activation';

/** Lot 9 quater (A3 : G-04) : durée de l'autorisation de choisir un nouveau mot de passe après le code SMS. */
const RECOVERY_GRANT_MS = 15 * 60 * 1000;

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
        const { data: userProfile, error: userProfileErr } = await supabase
            .from('users')
            .select('*')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        // Lot 9 (A34) : une panne n'est ni un compte absent ni une vérification réussie (le code est déjà consommé).
        if (userProfileErr) {
            console.error('[API verify-otp] lecture du profil impossible :', userProfileErr.message);
            return NextResponse.json(
                { error: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'PHONE_VERIFY_FAILED' },
                { status: 503 }
            );
        }

        if (isLogin && !userProfile) {
            return NextResponse.json(
                { error: 'Aucun compte n\'est associé à ce numéro de téléphone. Veuillez vous inscrire.' },
                { status: 404 }
            );
        }

        // Lot 9 quater (A5 : G-97) : un compte contrôleur invité qui n'a pas encore été activé ne s'ouvre pas par code
        // (connexion ni « Mot de passe oublié ») ; son activation passe par /controller/setup (lien reçu par SMS).
        let authEmail: string | null = null;
        if (userProfile?.id) {
            const { data: authRow, error: authRowErr } = await supabase.auth.admin.getUserById(userProfile.id);
            if (authRowErr || !authRow?.user) {
                console.error('[API verify-otp] compte d’authentification illisible :', authRowErr?.message ?? 'absent');
                return NextResponse.json(
                    { error: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'PHONE_VERIFY_FAILED' },
                    { status: 503 }
                );
            }
            if (isControllerActivationPending(authRow.user)) return controllerNotActivatedResponse();
            authEmail = authRow.user.email ?? null;

            // Confirmer le téléphone dans auth.users si pas encore fait (H3: partenaire OTP)
            if (!authRow.user.phone_confirmed_at) {
                // Lot 9 (L40) : l'erreur est rendue sans être levée ; journalisée, réponse inchangée.
                const { error: confirmError } = await supabase.auth.admin.updateUserById(userProfile.id, { phone_confirm: true });
                if (confirmError) console.error('[API verify-otp] phone_confirm non enregistré :', confirmError.message);
            }
        }

        // Lot 9 quater (A3 : G-04) : un code « Mot de passe oublié » ouvre une autorisation de 15 minutes, seule clé de
        // POST /api/auth/reset-password (avec le lien email de récupération).
        if (userProfile?.id && requested === 'PASSWORD_RESET') {
            const { error: grantErr } = await supabase.from('account_recovery_grants').upsert({
                user_id: userProfile.id,
                expires_at: new Date(Date.now() + RECOVERY_GRANT_MS).toISOString(),
            });
            if (grantErr) {
                console.error('[API verify-otp] autorisation de récupération non enregistrée :', grantErr.message);
                return NextResponse.json(
                    { error: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'PHONE_VERIFY_FAILED' },
                    { status: 503 }
                );
            }
        }

        // Lot 9 quater (A4 : AUD-19) : l'adresse du compte est relue (jamais tirée du numéro) ; la base n'accepte le lien
        // de session vers une adresse technique qu'avec le permis EMAIL_LINK posé juste avant.
        let tokenHash: string | undefined;
        const targetEmail = authEmail ?? (userProfile?.email as string | null | undefined) ?? null;

        if (userProfile && targetEmail) {
            try {
                await grantAuthWritePermit(String(userProfile.id), 'EMAIL_LINK');
                const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                    type: 'magiclink',
                    email: targetEmail,
                });
                if (linkError) console.error('[API verify-otp] lien de session non généré :', linkError.message);
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
