import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { RegisterWithCodeSchema, toSenegaleseE164 } from '@/lib/validations/auth';
import { otpFailureMessage, verifyStoredOtp } from '@/lib/auth/otp-store';
import { findExistingAccount } from '@/lib/auth/existing-account';
import { technicalEmailOf } from '@/lib/auth/account-sync';
import { emailVerificationState, sendEmailVerification, type EmailVerificationState } from '@/lib/email/verification';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';

export const dynamic = 'force-dynamic';

const ACCOUNT_EXISTS_MESSAGE = 'Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.';
const OTP_CODE_FORMAT = /^\d{6}$/;

/** Correspondance des refus d'otp_check (même table que /api/auth/verify-otp, messages d'otpFailureMessage). */
const OTP_REFUSAL_CODE = { INVALID: 'INVALID_CODE', EXPIRED: 'CODE_EXPIRED', TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS' } as const;

/**
 * Parrainage (comportement conservé du lot 1) : relation CLIENT_TO_CLIENT aux taux de referral_config du
 * statut du parrain. Une erreur est journalisée et n'a aucun effet sur l'inscription (le compte est créé).
 */
async function linkReferral(userId: string, referralCode: string): Promise<void> {
    const supabase = getServiceRoleClient();
    const code = referralCode.trim().toUpperCase();
    const { data: sponsor, error: sponsorErr } = await supabase
        .from('users')
        .select('id, referral_status')
        .eq('referral_code', code)
        .neq('id', userId)
        .maybeSingle();
    if (sponsorErr) throw new Error(`recherche du parrain : ${sponsorErr.message}`);
    if (!sponsor) {
        console.warn(`[API /api/auth/register] code de parrainage inconnu pour le compte ${userId} : aucune relation créée`);
        return;
    }
    const { data: config, error: configErr } = await supabase
        .from('referral_config')
        .select('rate_n1, rate_n2, duration_months')
        .eq('sponsor_status', sponsor.referral_status)
        .eq('referral_type', 'CLIENT_TO_CLIENT')
        .eq('is_active', true)
        .maybeSingle();
    if (configErr) throw new Error(`lecture de referral_config : ${configErr.message}`);
    if (!config) {
        console.warn(`[API /api/auth/register] aucun barème CLIENT_TO_CLIENT actif pour le statut ${sponsor.referral_status} : aucune relation créée`);
        return;
    }
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + Number(config.duration_months));
    const { error: insertErr } = await supabase.from('referral_relationships').insert({
        sponsor_id: sponsor.id,
        referred_id: userId,
        referral_type: 'CLIENT_TO_CLIENT',
        sponsor_status_at_creation: sponsor.referral_status,
        rate_n1_at_creation: config.rate_n1,
        rate_n2_at_creation: config.rate_n2,
        duration_months: config.duration_months,
        expires_at: expiresAt.toISOString(),
        is_active: true,
    });
    if (insertErr) throw new Error(`création de la relation de parrainage : ${insertErr.message}`);
}

/**
 * POST /api/auth/register — lot 7 (7.3, D1, contrat 3.6) : inscription « numéro d'abord », étape 2.
 * { phone, code, firstName, lastName, password, email?, referralCode? }. Ordre :
 *  1. validation du profil (400, aucun essai de code consommé) ;
 *  2. code absent → 400 REGISTRATION_CODE_REQUIRED ;
 *  3. compte existant (numéro ou email) → 409 ; lot 9 bis (R86) : code de parrainage inconnu → 400
 *     REFERRAL_CODE_UNKNOWN (champ referralCode), aucun essai de code consommé ;
 *  4. quota de vérification par numéro (otp_verify_phone, comme /api/auth/verify-otp : 429
 *     OTP_VERIFY_RATE_LIMITED), puis code REGISTER vérifié ET consommé en base (otp_check, 5 essais au plus)
 *     AVANT toute création : 400 INVALID_CODE, 400 CODE_EXPIRED, 429 TOO_MANY_ATTEMPTS ;
 *  5. création du compte (auth.users, puis public.users ACTIF avec phone_verified_at : le numéro est prouvé
 *     par le code) ; parrainage comme avant ;
 *  6. lot 9 bis (R87, contrat 4.6) : auth.users et users.email = adresse technique, adresse saisie dans
 *     users.email_pending, lien de vérification envoyé au mieux ; réponse + email_pending, email_verification.
 *     Domaine eventvillage.sn et sous-domaines refusés à l'étape 1 (400 INVALID_FIELD sur email, B100).
 * Le compte n'existe donc jamais avant la vérification du code (faille du lot 6 corrigée : un tiers ne peut
 * plus créer un compte ACTIF au numéro d'autrui). La route n'envoie plus aucun SMS : le code part de
 * POST /api/auth/register/start.
 */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }

    // 1. Profil
    const parsed = RegisterWithCodeSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.errors[0];
        return NextResponse.json(
            { error: issue?.message || 'Données d\'inscription invalides.', code: 'INVALID_FIELD', field: issue?.path?.[0] ?? null },
            { status: 400 },
        );
    }
    const { firstName, lastName, phone: rawPhone, email, password, referralCode } = parsed.data;
    const phone = toSenegaleseE164(rawPhone);
    if (!phone) {
        return NextResponse.json({ error: 'Numéro de téléphone sénégalais invalide.', code: 'INVALID_PHONE' }, { status: 400 });
    }

    // 2. Code
    const code = (parsed.data.code ?? '').trim();
    if (!code) {
        return NextResponse.json(
            { error: 'Saisissez le code reçu par SMS pour créer votre compte.', code: 'REGISTRATION_CODE_REQUIRED' },
            { status: 400 },
        );
    }
    if (!OTP_CODE_FORMAT.test(code)) {
        return NextResponse.json({ error: 'Le code de vérification comporte 6 chiffres.', code: 'INVALID_CODE' }, { status: 400 });
    }

    // Lot 9 bis (R87, B96, contrat 4.6) : GoTrue et users.email reçoivent l'adresse technique du numéro ; l'adresse
    // saisie attend son lien de vérification dans users.email_pending (jamais identifiant de connexion avant).
    const typedEmail = (email ?? '').trim().toLowerCase();
    const technicalEmail = technicalEmailOf(phone);
    const supabase = getServiceRoleClient();

    try {
        // 3. Compte existant (aucun essai de code consommé)
        if (await findExistingAccount(phone, typedEmail || technicalEmail)) {
            return NextResponse.json({ error: ACCOUNT_EXISTS_MESSAGE, code: 'ACCOUNT_ALREADY_EXISTS' }, { status: 409 });
        }

        // Lot 9 bis (R86, B87) : un code de parrainage inconnu est signalé AVANT la consommation du code SMS (le même
        // code sert encore, sans parrainage ou avec le bon code). Lecture en échec : 500 (aucune création).
        if (referralCode) {
            const { data: sponsor, error: sponsorErr } = await supabase
                .from('users')
                .select('id')
                .eq('referral_code', referralCode.trim().toUpperCase())
                .limit(1);
            if (sponsorErr) throw new Error(`recherche du code de parrainage : ${sponsorErr.message}`);
            if (!sponsor || sponsor.length === 0) {
                return NextResponse.json(
                    { error: 'Code de parrainage inconnu. Vérifiez-le ou laissez le champ vide.', code: 'REFERRAL_CODE_UNKNOWN', field: 'referralCode' },
                    { status: 400 },
                );
            }
        }

        // 4. Vérification et consommation du code, avant toute création. Même garde anti-force brute en base
        //    que /api/auth/verify-otp (lot 4.8) : chaque essai compte, la garde indisponible refuse (503).
        const quota = await reserveQuota(
            [{ scope: 'otp_verify_phone', bucket: phone, windowSecs: 900, max: getServerEnv().VERIFY_OTP_PER_PHONE_15MIN }],
            'vérification du code d\'inscription',
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de tentatives de vérification pour ce numéro. Réessayez plus tard.',
                code: 'OTP_VERIFY_RATE_LIMITED',
            });
        }
        const check = await verifyStoredOtp(phone, code, 'REGISTER');
        if (!check.ok) {
            const { message, status } = otpFailureMessage(check.reason);
            return NextResponse.json({ error: message, code: OTP_REFUSAL_CODE[check.reason] }, { status });
        }

        // 5. Création du compte (numéro prouvé par le code)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: technicalEmail,
            phone,
            password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
                first_name: firstName,
                last_name: lastName,
                referral_code: referralCode ?? '',
            },
        });
        if (authError || !authData?.user) {
            const raw = authError?.message ?? 'aucun compte renvoyé';
            console.error('[API /api/auth/register] création du compte impossible (code déjà consommé) :', raw);
            if (/already (been )?registered|already exists/i.test(raw)) {
                return NextResponse.json({ error: ACCOUNT_EXISTS_MESSAGE, code: 'ACCOUNT_ALREADY_EXISTS' }, { status: 409 });
            }
            return NextResponse.json(
                { error: 'Création du compte impossible pour le moment. Demandez un nouveau code et réessayez.', code: 'ACCOUNT_CREATE_FAILED' },
                { status: 500 },
            );
        }
        const userId = authData.user.id;

        const { error: profileError } = await supabase.from('users').upsert({
            id: userId,
            first_name: firstName,
            last_name: lastName,
            phone,
            email: technicalEmail,
            email_pending: typedEmail || null,
            role: 'CLIENT',
            status: 'ACTIF',
            referral_status: 'STANDARD',
            phone_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        if (profileError) {
            // Compte d'authentification sans profil utilisable : retiré pour que le numéro puisse se réinscrire.
            console.error(`[API /api/auth/register] profil du compte ${userId} non enregistré :`, profileError.message);
            const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
            if (deleteErr) console.error(`[API /api/auth/register] retrait du compte incomplet ${userId} impossible :`, deleteErr.message);
            return NextResponse.json(
                { error: 'Création du compte impossible pour le moment. Demandez un nouveau code et réessayez.', code: 'ACCOUNT_CREATE_FAILED' },
                { status: 500 },
            );
        }

        if (referralCode) {
            try {
                await linkReferral(userId, referralCode);
            } catch (refErr) {
                console.error(`[API /api/auth/register] parrainage du compte ${userId} non enregistré :`, refErr instanceof Error ? refErr.message : String(refErr));
            }
        }

        // Lien de vérification de l'adresse saisie, au mieux : un échec n'empêche pas l'inscription (le profil propose
        // « Renvoyer le lien »). L'écran se connecte avec `email` (adresse technique).
        let emailVerification: EmailVerificationState | null = null;
        if (typedEmail) {
            try {
                emailVerification = emailVerificationState(await sendEmailVerification(userId));
            } catch (mailErr) {
                console.error(`[API /api/auth/register] lien de vérification du compte ${userId} non envoyé :`, mailErr instanceof Error ? mailErr.message : String(mailErr));
                emailVerification = 'NOT_SENT';
            }
        }

        return NextResponse.json({
            success: true,
            userId,
            phone,
            email: technicalEmail,
            email_pending: typedEmail || null,
            ...(emailVerification ? { email_verification: emailVerification } : {}),
            message: 'Compte créé : votre numéro est vérifié.',
        });
    } catch (err) {
        console.error('[API /api/auth/register] erreur interne :', err instanceof Error ? err.message : String(err));
        return NextResponse.json(
            { error: 'Inscription momentanément impossible. Réessayez dans un instant.', code: 'REGISTER_FAILED' },
            { status: 500 },
        );
    }
}
