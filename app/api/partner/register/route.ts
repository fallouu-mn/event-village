import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { randomInt } from 'crypto';
import { RegisterPartnerSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { serverPasswordRuleMessage } from '@/lib/auth/password-policy.server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { otpFailureMessage, storeOtp, verifyStoredOtp } from '@/lib/auth/otp-store';
import { applySessionCookies, serverPasswordSignIn, type SessionCookie } from '@/lib/auth/password-confirm';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';
import { findExistingAccount } from '@/lib/auth/existing-account';
import { resolveRegistrationUploads } from '@/lib/partners/documents';
import { grantUserRoles } from '@/lib/auth/roles';
import { newTechnicalEmail } from '@/lib/auth/technical-email';
import { TECHNICAL_EMAIL_RE } from '@/lib/notifications/channels';
import { RESERVED_EMAIL_MESSAGE } from '@/lib/validations/auth';
import { emailVerificationState, sendEmailVerification, type EmailVerificationState } from '@/lib/email/verification';

export const dynamic = 'force-dynamic';

/** Compte de connexion sans dossier : retiré pour que le numéro puisse se réinscrire. Un échec est journalisé. */
async function removeIncompleteAccount(supabase: ReturnType<typeof getServiceRoleClient>, userId: string): Promise<void> {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) console.error(`[API /api/partner/register] retrait du compte incomplet ${userId} impossible :`, error.message);
}

/** NINEA et RCCM (R90) : facultatifs, 40 caractères au plus. */
const REGISTRY_ID_MAX = 40;

/**
 * POST /api/partner/register — inscription d'un partenaire, en deux appels de la même route (lot 9 bis, R53, B40).
 *  - Appel 1, sans `otpCode` : quota par IP, formulaire, pièces, compte existant (409 avant tout SMS), code SMS au
 *    numéro. 200 `{ otpSent: true, phone }`. RIEN n'est créé ni annoncé.
 *  - Appel 2, même corps avec `otpCode` : code vérifié (400 OTP_INVALID sans aucune écriture), puis compte de
 *    connexion (numéro confirmé), rôle PARTENAIRE, profil, fiche (numéro vérifié, NINEA, RCCM), activités, pièces et
 *    audit en une transaction (partner_register_finalize), et connexion côté serveur (cookies de session). 201.
 * Le quota d'inscription ne compte que l'appel qui envoie le SMS (décision D8).
 * Lot 9 bis (R87, B96, contrat 4.6, fix(9b.48-SB)) : GoTrue et users.email reçoivent l'adresse technique du numéro ;
 * l'adresse saisie attend son lien de vérification dans users.email_pending (jamais identifiant de connexion avant).
 * La fiche garde l'adresse saisie comme contact. Le domaine eventvillage.sn est réservé (B100).
 */
export async function POST(req: NextRequest) {
    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }
        const clientIp = getClientIp(req);
        const otpCode: string | null = typeof body?.otpCode === 'string' ? body.otpCode.trim() : null;

        if (otpCode === null) {
            // Lot 4.8 : quota par IP en base (PARTNER_REGISTER_PER_IP_HOUR) sur l'appel qui peut envoyer le SMS : chaque
            // tentative compte (formulaire invalide, pièces introuvables, compte existant) ; garde indisponible → 503.
            // Sans IP connue, les appels partagent le compteur « unknown ».
            const quota = await reserveQuota(
                [{ scope: 'partner_register_ip', bucket: clientIp ?? 'unknown', windowSecs: 3600, max: getServerEnv().PARTNER_REGISTER_PER_IP_HOUR }],
                'inscription partenaire'
            );
            if (!quota.allowed) {
                return quotaRefusalResponse(quota, {
                    error: 'Trop de tentatives d’inscription depuis cette connexion. Réessayez plus tard.',
                    code: 'PARTNER_REGISTER_RATE_LIMITED',
                });
            }
        }

        const parseResult = RegisterPartnerSchema.safeParse(body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]?.message || 'Données du formulaire invalides.';
            return NextResponse.json({ error: firstError }, { status: 400 });
        }

        const data = parseResult.data;
        // Lot 9 quinquies (A7 : AUTH-11) : liste des mots de passe courants, au serveur seulement (avant tout effet)
        const passwordRefusal = serverPasswordRuleMessage(data.password);
        if (passwordRefusal) {
            return NextResponse.json({ error: passwordRefusal, code: 'INVALID_FIELD', field: 'password' }, { status: 400 });
        }
        const normalizedPhone = normalizePhoneNumber(data.phone.trim());
        const effectiveEmail = data.email.trim().toLowerCase();
        if (TECHNICAL_EMAIL_RE.test(effectiveEmail)) {
            return NextResponse.json({ error: RESERVED_EMAIL_MESSAGE, code: 'INVALID_FIELD', field: 'email' }, { status: 400 });
        }
        const technicalEmail = newTechnicalEmail();
        const ninea = data.ninea?.trim() || null;
        const rccm = data.rccm?.trim() || null;
        if ((ninea && ninea.length > REGISTRY_ID_MAX) || (rccm && rccm.length > REGISTRY_ID_MAX)) {
            return NextResponse.json({
                error: 'Le NINEA et le RCCM font 40 caractères au plus.',
                code: 'INVALID_FIELD',
                field: ninea && ninea.length > REGISTRY_ID_MAX ? 'ninea' : 'rccm',
            }, { status: 400 });
        }
        if (otpCode !== null && !/^\d{6}$/.test(otpCode)) {
            return NextResponse.json({ error: 'Code de vérification incorrect ou expiré.', code: 'OTP_INVALID', field: 'otpCode' }, { status: 400 });
        }
        const supabase = getServiceRoleClient();

        // 0 bis. Lot 1C.2 : pièces rattachées par leurs jetons de dépôt (jamais par un chemin libre).
        const documents = await resolveRegistrationUploads({
            id_card: data.idCardUploadToken,
            business_doc: data.businessDocUploadToken,
        });
        if (!documents.ok) {
            return NextResponse.json({ error: documents.error, code: 'INVALID_DOCUMENT_UPLOAD' }, { status: 400 });
        }

        // 0 ter. Lot 1C.9 : numéro ou email déjà inscrit → aucun SMS (facturé) ; puis réservation
        //        anti-abus avant d'enregistrer le code.
        if (await findExistingAccount(normalizedPhone, effectiveEmail)) {
            return NextResponse.json(
                { error: 'Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.' },
                { status: 409 }
            );
        }
        if (otpCode === null) {
            // Appel 1 (R53) : code SMS au numéro ; rien n'est créé ni annoncé.
            const reserved = await reserveSms(normalizedPhone, { category: 'OTP', audience: 'NEW_NUMBER', ip: clientIp });
            if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

            const sentCode = randomInt(100000, 1000000).toString();
            const otpExpiresAt = Date.now() + 10 * 60 * 1000;

            // Lot 1B.7 : le code est enregistré en base AVANT l'envoi (vérifiable depuis toute instance).
            let otpId: string;
            try {
                otpId = await storeOtp(normalizedPhone, sentCode, new Date(otpExpiresAt), 'REGISTER');
            } catch (storeErr) {
                console.error('[API /api/partner/register]', storeErr instanceof Error ? storeErr.message : storeErr);
                return NextResponse.json({ error: 'Impossible de préparer le code de vérification. Réessayez.' }, { status: 500 });
            }

            // L'adaptateur renvoie success:false sans lever : le résultat est contrôlé (lot 1C.9).
            // Lot 6 (E7) : envoi synchrone journalisé dans la boîte d'envoi, sans le code.
            const smsResult = await mTargetService.sendOtp(normalizedPhone, sentCode, {
                reservation: reserved.reservation,
                purpose: 'REGISTER',
                log: { type: 'OTP_REGISTER', ref: otpId },
            });
            if (!smsResult.success) {
                console.error('[API /api/partner/register] Échec envoi SMS OTP:', smsResult.error);
                return NextResponse.json(
                    { error: 'Impossible d\'envoyer le code de vérification SMS. Vérifiez votre numéro et réessayez.' },
                    { status: 503 }
                );
            }
            return NextResponse.json({
                otpSent: true,
                phone: normalizedPhone,
                message: `Code envoyé au ${normalizedPhone}. Saisissez-le pour envoyer votre dossier.`,
            });
        }

        // Appel 2 (R53) : code vérifié avant toute écriture (essais limités par code, otp_check, et par numéro). Un refus
        // ne crée rien.
        const verifyQuota = await reserveQuota(
            [{ scope: 'otp_verify_phone', bucket: normalizedPhone, windowSecs: 900, max: getServerEnv().VERIFY_OTP_PER_PHONE_15MIN }],
            'vérification du code d’inscription partenaire',
        );
        if (!verifyQuota.allowed) {
            return quotaRefusalResponse(verifyQuota, {
                error: 'Trop de tentatives de vérification pour ce numéro. Réessayez plus tard.',
                code: 'OTP_VERIFY_RATE_LIMITED',
            });
        }
        const check = await verifyStoredOtp(normalizedPhone, otpCode, 'REGISTER');
        if (!check.ok) {
            const { message, status } = otpFailureMessage(check.reason);
            return NextResponse.json({ error: message, code: 'OTP_INVALID', field: 'otpCode' }, { status });
        }

        // 2. Création de l'utilisateur dans Supabase Auth, numéro confirmé : le code vient d'être vérifié.
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: technicalEmail,
            phone: normalizedPhone,
            password: data.password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
                first_name: data.firstName.trim(),
                last_name: data.lastName.trim(),
                company_name: data.companyName.trim(),
            },
        });

        if (authError) {
            // Même lecture que /api/auth/register : Supabase Auth écrit « has already been registered ».
            if (/already (been )?registered|already exists/i.test(authError.message)) {
                return NextResponse.json(
                    { error: 'Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.' },
                    { status: 409 }
                );
            }
            return apiFailure('POST /api/partner/register, compte de connexion', authError, { message: 'Compte non créé. Vérifiez les informations saisies et réessayez.', code: 'ACCOUNT_CREATE_FAILED', status: 400 });
        }

        const userId = authData.user.id;

        // 1 bis. Attribution explicite du rôle PARTENAIRE (lot 1A : le trigger d'inscription ne crée
        //        plus que CLIENT ; les métadonnées ne sont plus une source de rôle).
        try {
            await grantUserRoles(userId, ['PARTENAIRE']);
        } catch (roleErr) {
            console.error('[API /api/partner/register] Attribution du rôle PARTENAIRE impossible:', roleErr);
            await removeIncompleteAccount(supabase, userId);
            return NextResponse.json({ error: 'Erreur lors de la configuration du compte partenaire.' }, { status: 500 });
        }

        // 3. Lot 9 (A33) : profil, fiche, activités, rattachement des pièces (usage unique des jetons) et audit dans
        //    une transaction. L'accusé de réception (in-app et email, plus de SMS : doublon du code d'inscription) et
        //    l'alerte aux administrateurs partent par le trigger trg_partners_notify, dans la même transaction.
        //    Le code OTP a été enregistré en base avant l'envoi du SMS (lot 1B.7).
        const { data: finalized, error: finalizeError } = await supabase.rpc('partner_register_finalize', {
            p: {
                user_id: userId,
                first_name: data.firstName.trim(),
                last_name: data.lastName.trim(),
                phone: normalizedPhone,
                email: technicalEmail,
                email_pending: effectiveEmail,
                partner: {
                    company_name: data.companyName.trim(),
                    commercial_name: data.commercialName?.trim() || data.companyName.trim(),
                    description: data.description?.trim() || null,
                    address: data.address?.trim() || null,
                    city: data.city?.trim() || 'Dakar',
                    phone: normalizedPhone,
                    email: effectiveEmail,
                    id_card_url: documents.uploads.id_card.object_path,
                    business_doc_url: documents.uploads.business_doc.object_path,
                    ninea,
                    rccm,
                },
                activities: data.activities,
                upload_ids: [documents.uploads.id_card.id, documents.uploads.business_doc.id],
                ip: clientIp ?? 'inconnue',
            },
        });

        // Sans fiche, le compte de connexion est retiré : sinon le numéro resterait pris au nouvel essai (409).
        if (finalizeError) {
            await removeIncompleteAccount(supabase, userId);
            return apiFailure('POST /api/partner/register, enregistrement du dossier', finalizeError, { message: 'Inscription momentanément impossible. Réessayez.', code: 'PARTNER_REGISTER_FAILED' });
        }

        const outcome = finalized as { ok: boolean; code?: string; partner_id?: string };
        if (!outcome.ok || !outcome.partner_id) {
            await removeIncompleteAccount(supabase, userId);
            if (outcome.code === 'INVALID_DOCUMENT_UPLOAD') {
                return NextResponse.json({ error: 'Pièces justificatives déjà utilisées ou expirées : déposez-les à nouveau.', code: outcome.code }, { status: 409 });
            }
            return apiFailure('POST /api/partner/register, enregistrement du dossier', new Error(`refus inattendu : ${outcome.code}`), { message: 'Inscription momentanément impossible. Réessayez.', code: 'PARTNER_REGISTER_FAILED' });
        }

        const partnerId = outcome.partner_id;

        // 3 bis. Lot 9 bis (R87) : l'adresse saisie attend son lien dans users.email_pending, écrite par
        //        partner_register_finalize avec le reste du dossier (A33 : aucune écriture REST hors de la RPC). Le lien
        //        part ensuite ; un échec d'envoi est journalisé et dit dans la réponse (email_verification NOT_SENT).
        const emailPending: string = effectiveEmail;
        let emailVerification: EmailVerificationState = 'NOT_SENT';
        try {
            emailVerification = emailVerificationState(await sendEmailVerification(userId));
        } catch (mailErr) {
            console.error(`[API /api/partner/register] lien de vérification du compte ${userId} non envoyé :`, mailErr instanceof Error ? mailErr.message : String(mailErr));
        }

        // 4. Connexion côté serveur (cookies de session, comme POST /api/auth/login) : le dossier est enregistré quoi
        //    qu'il arrive ; un échec de connexion est journalisé et dit dans la réponse (`signed_in: false`), jamais tu.
        let signedIn = false;
        let cookies: SessionCookie[] = [];
        try {
            const signIn = await serverPasswordSignIn(req, { email: technicalEmail }, data.password);
            if (signIn.ok) {
                signedIn = true;
                cookies = signIn.cookies;
            } else {
                console.error(`[API /api/partner/register] connexion après l'inscription refusée : ${signIn.reason === 'REFUSED' ? signIn.code : signIn.reason}`);
            }
        } catch (signErr) {
            console.error('[API /api/partner/register] connexion après l’inscription impossible :', signErr instanceof Error ? signErr.message : String(signErr));
        }

        return applySessionCookies(NextResponse.json({
            success: true,
            partnerId,
            userId,
            phone: normalizedPhone,
            phone_verified: true,
            email_pending: emailPending,
            email_verification: emailVerification,
            signed_in: signedIn,
            message: 'Dossier envoyé : il est en cours de vérification.',
        }, { status: 201 }), cookies);
    } catch (err: unknown) {
        return apiFailure('POST /api/partner/register', err, { message: 'Inscription momentanément impossible. Réessayez.', code: 'PARTNER_REGISTER_FAILED' });
    }
}
