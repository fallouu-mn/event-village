import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { mTargetService } from '@/lib/sms/mtarget.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/communications
 * Récupère l'historique des campagnes de communication (§121-§126)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'communications.manage' });
    if (!auth.authorized) return auth.errorResponse!;

    const supabase = getServiceRoleClient();
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        campaigns: campaigns || [],
    });
}

/**
 * POST /api/admin/communications
 * Crée et diffuse une nouvelle campagne avec modération de contenu obligatoire (§121-§126)
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'communications.manage' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: {
            title: string;
            message: string;
            senderProfile: string;
            targetAudience: string;
            channels: string[];
            sendNow?: boolean;
        };

        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { title, message, senderProfile, targetAudience, channels, sendNow } = body;

        if (!title || !message) {
            return NextResponse.json({ error: 'Titre et message requis.' }, { status: 400 });
        }

        // 1. Modération stricte du contenu (§121)
        const moderation = AdminService.moderateContent(message + ' ' + title);
        if (!moderation.isClean) {
            return NextResponse.json(
                {
                    error: `Le message contient des termes interdits ou offensants : ${moderation.flaggedWords.join(', ')}`,
                    flaggedWords: moderation.flaggedWords,
                },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();

        // 2. Ciblage des destinataires réels
        let targetPhones: string[] = [];

        if (targetAudience === 'ALL_PARTNERS') {
            const { data: partners } = await supabase.from('partners').select('phone').not('phone', 'is', null);
            targetPhones = partners?.map((p) => p.phone!).filter(Boolean) || [];
        } else if (targetAudience === 'AMBASSADORS') {
            const { data: ambassadors } = await supabase.from('users').select('phone').eq('referral_status', 'AMBASSADEUR');
            targetPhones = ambassadors?.map((a) => a.phone!).filter(Boolean) || [];
        } else {
            // Tous les clients
            const { data: users } = await supabase.from('users').select('phone').not('phone', 'is', null);
            targetPhones = users?.map((u) => u.phone!).filter(Boolean) || [];
        }

        // Dédoublonnage
        targetPhones = Array.from(new Set(targetPhones));

        // 3. Enregistrement de la campagne
        const { data: campaignRow, error: campErr } = await supabase
            .from('campaigns')
            .insert({
                title: title.trim(),
                message: message.trim(),
                sender_profile: senderProfile || 'Event Village Info',
                target_audience: targetAudience || 'ALL_CLIENTS',
                channels: channels || ['SMS'],
                status: sendNow ? 'SENDING' : 'DRAFT',
                recipient_count: targetPhones.length,
                delivered_count: 0,
                created_by: auth.user!.id,
                sent_at: sendNow ? new Date().toISOString() : null,
            })
            .select()
            .single();

        if (campErr) {
            return NextResponse.json({ error: campErr.message }, { status: 500 });
        }

        // 4. Envoi réel si demandé
        let deliveredCount = 0;
        if (sendNow && channels?.includes('SMS')) {
            for (const phone of targetPhones.slice(0, 50)) { // Limite de sécurité batch
                try {
                    const formattedMsg = `[${senderProfile || 'Event Village Info'}] ${message.trim()}`;
                    const res = await mTargetService.sendSms(phone, formattedMsg);
                    if (res.success) deliveredCount++;
                } catch {
                    // Continue batch
                }
            }

            await supabase
                .from('campaigns')
                .update({
                    status: 'SENT',
                    delivered_count: deliveredCount,
                    sent_at: new Date().toISOString(),
                })
                .eq('id', campaignRow.id);
        }

        // 5. Journal d'Audit
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'SEND_COMMUNICATION',
            objectType: 'campaigns',
            objectId: campaignRow.id,
            newValue: { title, targetAudience, channels, recipient_count: targetPhones.length },
        });

        return NextResponse.json({
            success: true,
            campaignId: campaignRow.id,
            deliveredCount,
            recipientCount: targetPhones.length,
            message: `Campagne "${title}" créée et diffusée auprès de ${targetPhones.length} destinataire(s).`,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
