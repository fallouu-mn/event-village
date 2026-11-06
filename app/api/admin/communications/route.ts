import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

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
        return apiFailure('GET /api/admin/communications', error, { message: 'Campagnes momentanément indisponibles.', code: 'CAMPAIGNS_UNAVAILABLE' });
    }

    return NextResponse.json({
        success: true,
        campaigns: campaigns || [],
    });
}

/**
 * POST /api/admin/communications
 * Crée une campagne en brouillon, avec modération de contenu obligatoire (§121-§126). Lot 6 : l'envoi
 * immédiat est désactivé (décision 43) ; la réponse le dit (`sendingDisabled: true`).
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

        // 3. Enregistrement de la campagne, toujours en brouillon. Lot 6 (décision 43, confirmée par
        //    l'utilisateur) : l'envoi immédiat est désactivé (marketing hors périmètre : ni préférences,
        //    ni désabonnement, ni plafond dédié) ; aucun SMS ne part d'ici. `sendNow` est ignoré.
        const { data: campaignRow, error: campErr } = await supabase
            .from('campaigns')
            .insert({
                title: title.trim(),
                message: message.trim(),
                sender_profile: senderProfile || 'Event Village Info',
                target_audience: targetAudience || 'ALL_CLIENTS',
                channels: channels || ['SMS'],
                status: 'DRAFT',
                recipient_count: targetPhones.length,
                delivered_count: 0,
                created_by: auth.user!.id,
                sent_at: null,
            })
            .select()
            .single();

        if (campErr || !campaignRow) {
            console.error('[API admin/communications POST] enregistrement de la campagne :', campErr?.message ?? 'réponse vide');
            return NextResponse.json({ error: 'Enregistrement de la campagne impossible.', code: 'CAMPAIGN_SAVE_FAILED' }, { status: 500 });
        }

        // 4. Journal d'Audit
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'SAVE_COMMUNICATION_DRAFT',
            objectType: 'campaigns',
            objectId: campaignRow.id,
            newValue: { title, targetAudience, channels, recipient_count: targetPhones.length, send_now_requested: sendNow === true },
        });

        return NextResponse.json({
            success: true,
            campaign: campaignRow,
            campaignId: campaignRow.id,
            deliveredCount: 0,
            recipientCount: targetPhones.length,
            sendingDisabled: true,
            message: "L'envoi immédiat des campagnes est désactivé : il sera repris avec le lot des communications.",
        });
    } catch (err: unknown) {
        console.error('[API admin/communications POST]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Enregistrement de la campagne momentanément impossible.', code: 'CAMPAIGN_SAVE_FAILED' }, { status: 500 });
    }
}
