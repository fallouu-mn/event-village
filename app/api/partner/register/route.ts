import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { randomInt } from 'crypto';
import { RegisterPartnerSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { storeOtp } from '@/lib/auth/otp-store';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';
import { findExistingAccount } from '@/lib/auth/existing-account';
import { resolveRegistrationUploads } from '@/lib/partners/documents';
import { grantUserRoles } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/** Compte de connexion sans dossier : retiré pour que le numéro puisse se réinscrire. Un échec est journalisé. */
async function removeIncompleteAccount(supabase: ReturnType<typeof getServiceRoleClient>, userId: string): Promise<void> {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) console.error(`[API /api/partner/register] retrait du compte incomplet ${userId} impossible :`, error.message);
}

/**
 * POST /api/partner/register
 * Inscription complète d'un partenaire avec statut EN_ATTENTE et enregistrement des activités
 */
export async function POST(req: NextRequest) {
    try {
        // Lot 4.8 : quota par IP en base (PARTNER_REGISTER_PER_IP_HOUR), réservé avant toute lecture du
        // corps : chaque tentative compte (formulaire invalide, pièces introuvables, compte existant),
        // l'IP vient de getClientIp (CLIENT_IP_SOURCE, plus de x-forwarded-for brut) et la garde
        // indisponible refuse (503). Sans IP connue, les appels partagent le compteur « unknown ».
        const clientIp = getClientIp(req);
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

        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const parseResult = RegisterPartnerSchema.safeParse(body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]?.message || 'Données du formulaire invalides.';
            return NextResponse.json({ error: firstError }, { status: 400 });
        }

        const data = parseResult.data;
        const normalizedPhone = normalizePhoneNumber(data.phone.trim());
        const effectiveEmail = data.email.trim().toLowerCase();
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
        const reserved = await reserveSms(normalizedPhone, { category: 'OTP', ip: clientIp });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

        // 1. Générer et envoyer le SMS OTP AVANT toute création de compte
        const otpCode = randomInt(100000, 1000000).toString();
        const otpExpiresAt = Date.now() + 10 * 60 * 1000;

        // Lot 1B.7 : le code est enregistré en base AVANT l'envoi (vérifiable depuis toute instance).
        let otpId: string;
        try {
            otpId = await storeOtp(normalizedPhone, otpCode, new Date(otpExpiresAt), 'REGISTER');
        } catch (storeErr) {
            console.error('[API /api/partner/register]', storeErr instanceof Error ? storeErr.message : storeErr);
            return NextResponse.json({ error: 'Impossible de préparer le code de vérification. Réessayez.' }, { status: 500 });
        }

        // L'adaptateur renvoie success:false sans lever : le résultat est contrôlé (lot 1C.9).
        // Lot 6 (E7) : envoi synchrone journalisé dans la boîte d'envoi, sans le code.
        const smsResult = await mTargetService.sendOtp(normalizedPhone, otpCode, {
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

        // 2. Création de l'utilisateur dans Supabase Auth
        //    phone_confirm: false → sera confirmé UNIQUEMENT après vérification OTP via /api/auth/verify-otp
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: effectiveEmail,
            phone: normalizedPhone,
            password: data.password,
            email_confirm: true,
            phone_confirm: false,
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
                email: effectiveEmail,
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

        return NextResponse.json({
            success: true,
            partnerId,
            userId,
            phone: normalizedPhone,
            otpSent: true,
            message: `Dossier enregistré. Un code SMS de vérification a été envoyé au ${normalizedPhone}.`,
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/partner/register', err, { message: 'Inscription momentanément impossible. Réessayez.', code: 'PARTNER_REGISTER_FAILED' });
    }
}
