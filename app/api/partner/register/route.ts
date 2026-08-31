import { NextRequest, NextResponse } from 'next/server';
import { RegisterPartnerSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { NotificationService } from '@/lib/notifications/notification.service';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/register
 * Inscription complète d'un partenaire avec statut EN_ATTENTE et enregistrement des activités
 */
export async function POST(req: NextRequest) {
    try {
        const clientIp = req.headers.get('x-forwarded-for') || 'local';
        const limitCheck = RateLimiter.isRateLimited(`register_${clientIp}`);
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
            RateLimiter.recordFailedAttempt(`register_${clientIp}`);
            const firstError = parseResult.error.errors[0]?.message || 'Données du formulaire invalides.';
            return NextResponse.json({ error: firstError }, { status: 400 });
        }

        const data = parseResult.data;
        const normalizedPhone = normalizePhoneNumber(data.phone.trim());
        const effectiveEmail = data.email.trim().toLowerCase();
        const supabase = getServiceRoleClient();

        // 1. Création de l'utilisateur dans Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: effectiveEmail,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                first_name: data.firstName.trim(),
                last_name: data.lastName.trim(),
                phone: normalizedPhone,
                email: effectiveEmail,
                role: 'PARTENAIRE',
                company_name: data.companyName.trim(),
            },
        });

        if (authError) {
            RateLimiter.recordFailedAttempt(`register_${clientIp}`);
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
                id_card_url: data.idCardUrl,
                business_doc_url: data.businessDocUrl,
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

        // 6. Notification 1 : Confirmation d'inscription reçue (Email + SMS)
        await NotificationService.sendPartnerRegistrationNotification({
            email: effectiveEmail,
            phone: normalizedPhone,
            companyName: data.companyName.trim(),
            userId: userId,
        });

        RateLimiter.resetAttempts(`register_${clientIp}`);

        return NextResponse.json({
            success: true,
            partnerId,
            userId,
            message: 'Candidature partenaire enregistrée avec succès. En attente de validation administrative.',
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/partner/register] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
