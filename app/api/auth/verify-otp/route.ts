import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { ACCOUNT_OTP_PURPOSES, otpFailureMessage, verifyStoredOtp, type OtpPurpose } from '@/lib/auth/otp-store';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { grantAuthWritePermit } from '@/lib/auth/auth-permits';
import { activationPendingResponse } from '@/lib/auth/account-activation';
import { suspendedAccountMessage } from '@/lib/support-contact';

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

        // Lot 9 quinquies (A5 : T1) : compte suspendu : refus AVANT toute écriture et tout lien de session, avec le contact
        // du support (le code reste consommé). Lecture en échec : 503, jamais un passage.
        const { data: statusRow, error: statusErr } = await supabase.from('users').select('status').eq('phone', normalizedPhone).maybeSingle();
        if (statusErr) {
            console.error('[API verify-otp] lecture du statut du compte impossible :', statusErr.message);
            return NextResponse.json(
                { error: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'PHONE_VERIFY_FAILED' },
                { status: 503 }
            );
        }
        if (statusRow && String(statusRow.status) === 'SUSPENDU') {
            const refusal = await suspendedAccountMessage();
            return NextResponse.json({ error: refusal.error, code: 'ACCOUNT_SUSPENDED', support: refusal.support }, { status: 403 });
        }

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
        // Lot 9 quinquies (A6 : AUTH-14) : seules les colonnes utiles sont lues ; aucune n'est rendue au navigateur.
        const { data: userProfile, error: userProfileErr } = await supabase
            .from('users')
            .select('id, email')
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
            // Lot 9 quinquies (A2) : compte créé par un admin pas encore activé, même refus
            const pending = activationPendingResponse(authRow.user);
            if (pending) return pending;
            authEmail = authRow.user.email ?? null;

            // Confirmer le téléphone dans auth.users (H3: partenaire OTP), comme avant le lot.
            // Lot 9 (L40) : l'erreur est rendue sans être levée ; journalisée, réponse inchangée.
            const { error: confirmError } = await supabase.auth.admin.updateUserById(userProfile.id, { phone_confirm: true });
            if (confirmError) console.error('[API verify-otp] phone_confirm non enregistré :', confirmError.message);
        }

        // Lot 9 quater (A3 : G-04) : un code « Mot de passe oublié » ouvre une autorisation, seule clé de
        // POST /api/auth/reset-password. Lot 9 quinquies (A8) : 10 minutes, réservée à une session ouverte APRÈS ce code
        // (celle du jeton rendu ici), usage unique (account_recovery_open, migration 20261112000004).
        if (userProfile?.id && requested === 'PASSWORD_RESET') {
            const { data: grantReply, error: grantErr } = await supabase.rpc('account_recovery_open', { p: { user_id: userProfile.id } });
            if (grantErr || (grantReply as { ok?: boolean } | null)?.ok !== true) {
                console.error('[API verify-otp] autorisation de récupération non enregistrée :', grantErr?.message ?? JSON.stringify(grantReply));
                return NextResponse.json(
                    { error: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'PHONE_VERIFY_FAILED' },
                    { status: 503 }
                );
            }
        }

        // Lot 9 quater (A4 : AUD-19) : l'adresse du compte est relue (jamais tirée du numéro) ; la base n'accepte le lien
        // de session vers une adresse technique qu'avec le permis EMAIL_LINK posé juste avant.
        let tokenHash: string | undefined;
        // Contre-vérification du lot 9 quinquies (point 2) : seulement l'identifiant de GoTrue (adresse technique), jamais
        // l'adresse du profil (GoTrue ne la connaît plus : un lien vers elle créerait un autre compte).
        const targetEmail = authEmail;

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

        // Lot 9 quinquies (A6 : AUTH-14, T4) : seulement le jeton de session et l'identifiant du compte ; jamais l'adresse
        // (technique ou non), le numéro ni la ligne du compte.
        return NextResponse.json({
            success: true,
            verified: true,
            token_hash: tokenHash,
            user: userProfile ? { id: String(userProfile.id) } : null,
        });
    } catch (error: unknown) {
        return apiFailure('POST /api/auth/verify-otp', error, { message: 'Vérification momentanément impossible. Demandez un nouveau code.', code: 'OTP_VERIFY_FAILED' });
    }
}
