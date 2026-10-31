import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { RegisterPartnerSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { NotificationService } from '@/lib/notifications/notification.service';
import { AdminService } from '@/lib/admin/admin.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { storeOtp } from '@/lib/auth/otp-store';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';
import { findExistingAccount } from '@/lib/auth/existing-account';
import { claimRegistrationUploads, resolveRegistrationUploads } from '@/lib/partners/documents';
import { grantUserRoles } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/register
 * Inscription complète d'un partenaire avec statut EN_ATTENTE et enregistrement des activités
 */
export async function POST(req: NextRequest) {
    try {
        const clientIp = req.headers.get('x-forwarded-for') || 'local';
        const limitCheck = await RateLimiter.isRateLimited(`register_${clientIp}`);
        if (limitCheck.limited) {
            return NextResponse.json(
                { error: `Trop de tentatives d'inscription. Veuillez patienter ${limitCheck.remainingSeconds} secondes.` },
                { status: 429 }
            );
        }

        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const parseResult = RegisterPartnerSchema.safeParse(body);
        if (!parseResult.success) {
            await RateLimiter.recordFailedAttempt(`register_${clientIp}`);
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
        const reserved = await reserveSms(normalizedPhone, { category: 'OTP', ip: getClientIp(req) });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

        // 1. Générer et envoyer le SMS OTP AVANT toute création de compte
        const otpCode = randomInt(100000, 1000000).toString();
        const otpExpiresAt = Date.now() + 10 * 60 * 1000;

        // Lot 1B.7 : le code est enregistré en base AVANT l'envoi (vérifiable depuis toute instance).
        try {
            await storeOtp(normalizedPhone, otpCode, new Date(otpExpiresAt), 'REGISTER');
        } catch (storeErr) {
            console.error('[API /api/partner/register]', storeErr instanceof Error ? storeErr.message : storeErr);
            return NextResponse.json({ error: 'Impossible de préparer le code de vérification. Réessayez.' }, { status: 500 });
        }

        // L'adaptateur renvoie success:false sans lever : le résultat est contrôlé (lot 1C.9).
        const smsResult = await mTargetService.sendOtp(normalizedPhone, otpCode, { reservation: reserved.reservation });
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
            await RateLimiter.recordFailedAttempt(`register_${clientIp}`);
            console.error('[API /api/partner/register] Erreur auth admin:', authError);
            if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
                return NextResponse.json(
                    { error: 'Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.' },
                    { status: 409 }
                );
            }
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        const userId = authData.user.id;

        // 1 bis. Attribution explicite du rôle PARTENAIRE (lot 1A : le trigger d'inscription ne crée
        //        plus que CLIENT ; les métadonnées ne sont plus une source de rôle).
        try {
            await grantUserRoles(userId, ['PARTENAIRE']);
        } catch (roleErr) {
            console.error('[API /api/partner/register] Attribution du rôle PARTENAIRE impossible:', roleErr);
            return NextResponse.json({ error: 'Erreur lors de la configuration du compte partenaire.' }, { status: 500 });
        }

        // 2. Synchronisation dans public.users avec rôle PARTENAIRE et statut EN_ATTENTE
        await supabase.from('users').upsert({
            id: userId,
            first_name: data.firstName.trim(),
            last_name: data.lastName.trim(),
            phone: normalizedPhone,
            email: effectiveEmail,
            role: 'PARTENAIRE',
            status: 'EN_ATTENTE',
            referral_status: 'STANDARD',
            updated_at: new Date().toISOString(),
        });

        // 3. Création du profil Entreprise dans public.partners
        const { data: partnerRow, error: partnerError } = await supabase
            .from('partners')
            .insert({
                user_id: userId,
                company_name: data.companyName.trim(),
                commercial_name: data.commercialName?.trim() || data.companyName.trim(),
                description: data.description?.trim() || null,
                address: data.address?.trim() || null,
                city: data.city?.trim() || 'Dakar',
                phone: normalizedPhone,
                email: effectiveEmail,
                id_card_url: documents.uploads.id_card.object_path,
                business_doc_url: documents.uploads.business_doc.object_path,
                status: 'EN_ATTENTE',
                is_verified: false,
                phone_verified: false,
            })
            .select()
            .single();

        if (partnerError) {
            console.error('[API /api/partner/register] Erreur création partner:', partnerError);
            return NextResponse.json({ error: 'Erreur lors de la création de la fiche partenaire.' }, { status: 500 });
        }

        const partnerId = partnerRow.id;

        // Lot 1C.2 : rattachement des pièces au dossier (usage unique des jetons)
        try {
            await claimRegistrationUploads(partnerId, documents.uploads);
        } catch (claimErr) {
            console.error('[API /api/partner/register] rattachement des pièces :', claimErr instanceof Error ? claimErr.message : claimErr);
            return NextResponse.json({ error: 'Pièces justificatives déjà utilisées ou expirées : déposez-les à nouveau.', code: 'INVALID_DOCUMENT_UPLOAD' }, { status: 409 });
        }

        // 4. Enregistrement des activités dans public.partner_activities
        if (data.activities && data.activities.length > 0) {
            const activitiesPayload = data.activities.map((act) => ({
                partner_id: partnerId,
                activity_type: act,
                is_active: true,
            }));
            await (supabase.from('partner_activities') as any).insert(activitiesPayload);
        }

        // 5. Journalisation d'audit inaltérable
        await AdminService.logAudit({
            userId: userId,
            userRole: 'PARTENAIRE',
            action: 'PARTNER_REGISTRATION',
            objectType: 'partners',
            objectId: partnerId,
            newValue: {
                company_name: data.companyName.trim(),
                status: 'EN_ATTENTE',
                activities: data.activities,
            },
            metadata: { ip: clientIp },
        });

        // 6. (Lot 1B.7) Le code OTP a été enregistré en base avant l'envoi du SMS.

        // 7. Triple Notification CDC : SMS + Email + In-App (partenaire + superadmins)
        await NotificationService.sendPartnerRegistrationNotification({
            email: effectiveEmail,
            phone: normalizedPhone,
            companyName: data.companyName.trim(),
            partnerName: `${data.firstName.trim()} ${data.lastName.trim()}`,
            userId: userId,
        });

        await RateLimiter.resetAttempts(`register_${clientIp}`);

        return NextResponse.json({
            success: true,
            partnerId,
            userId,
            phone: normalizedPhone,
            otpSent: true,
            message: `Dossier enregistré. Un code SMS de vérification a été envoyé au ${normalizedPhone}.`,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/partner/register] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
