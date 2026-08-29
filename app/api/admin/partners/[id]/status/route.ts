import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { NotificationService } from '@/lib/notifications/notification.service';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/partners/[id]/status
 * Validation, rejet ou suspension d'un partenaire avec audit log et notification SMS
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'partners.validate' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const partnerId = params.id;
        if (!partnerId) {
            return NextResponse.json({ error: 'ID partenaire requis.' }, { status: 400 });
        }

        let body: { status?: 'VALIDE' | 'REJETE' | 'SUSPENDU' | 'EN_ATTENTE'; rejectionReason?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const newStatus = body.status;
        const rejectionReason = body.rejectionReason?.trim();

        if (!newStatus || !['VALIDE', 'REJETE', 'SUSPENDU', 'EN_ATTENTE'].includes(newStatus)) {
            return NextResponse.json({ error: 'Statut partenaire invalide.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Récupération de l'état actuel du partenaire
        const { data: currentPartner, error: fetchErr } = await supabase
            .from('partners')
            .select('*, users(*)')
            .eq('id', partnerId)
            .maybeSingle();

        if (fetchErr || !currentPartner) {
            return NextResponse.json({ error: 'Partenaire introuvable.' }, { status: 404 });
        }

        const oldStatus = currentPartner.status;
        const userId = currentPartner.user_id;
        const partnerPhone = currentPartner.phone || (currentPartner.users as any)?.phone;
        const companyName = currentPartner.company_name;

        // 2. Mise à jour du statut dans public.partners
        const isVerified = newStatus === 'VALIDE';
        const partnerUpdatePayload: any = {
            status: newStatus,
            is_verified: isVerified,
            updated_at: new Date().toISOString(),
        };

        if (newStatus === 'REJETE' && rejectionReason) {
            partnerUpdatePayload.rejection_reason = rejectionReason;
        }
        if (newStatus === 'SUSPENDU' && rejectionReason) {
            partnerUpdatePayload.suspended_reason = rejectionReason;
        }

        const { error: updatePartnerErr } = await (supabase.from('partners') as any)
            .update(partnerUpdatePayload)
            .eq('id', partnerId);

        if (updatePartnerErr) {
            console.error('[API /api/admin/partners/status] Erreur update partner:', updatePartnerErr);
            return NextResponse.json({ error: 'Échec de la mise à jour du partenaire.' }, { status: 500 });
        }

        // 3. Synchronisation du statut utilisateur dans public.users
        if (userId) {
            const userStatus = newStatus === 'VALIDE' ? 'ACTIF' : newStatus === 'SUSPENDU' ? 'SUSPENDU' : 'ACTIF';
            const userRole = newStatus === 'VALIDE' ? 'PARTENAIRE' : currentPartner.users?.role || 'PARTENAIRE';

            await supabase
                .from('users')
                .update({
                    status: userStatus,
                    role: userRole,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);
        }

        // 4. Enregistrement dans le Journal d'Audit inaltérable (audit_logs)
        await supabase.from('audit_logs').insert({
            user_id: auth.user!.id,
            user_role: auth.user!.role,
            action: 'STATUS_CHANGE',
            object_type: 'partners',
            object_id: partnerId,
            old_value: { status: oldStatus },
            new_value: { status: newStatus, is_verified: isVerified },
            metadata: {
                company_name: companyName,
                rejection_reason: rejectionReason || null,
                updated_by: auth.user!.role,
            },
        });

        // 5. Notifications Multi-Canaux (SMS + Email + In-App via NotificationService)
        if (newStatus === 'VALIDE' || newStatus === 'REJETE') {
            await NotificationService.sendAdminValidationNotification({
                email: currentPartner.email || '',
                phone: partnerPhone,
                companyName: companyName,
                approved: newStatus === 'VALIDE',
                rejectionReason: rejectionReason,
                userId: userId,
            });
        } else if (newStatus === 'SUSPENDU') {
            await NotificationService.sendSuspensionNotification({
                email: currentPartner.email || '',
                phone: partnerPhone,
                companyName: companyName,
                reason: rejectionReason || 'Non-respect des conditions d\'utilisation',
                userId: userId,
            });
        }

        return NextResponse.json({
            success: true,
            message: `Statut du partenaire mis à jour avec succès : ${newStatus}`,
            partner: {
                id: partnerId,
                status: newStatus,
                is_verified: isVerified,
                rejection_reason: rejectionReason,
            },
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/partners/status] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
