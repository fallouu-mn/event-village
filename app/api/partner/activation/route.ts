import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/notifications/notification.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/activation
 * Démarre de manière IDEMPOTENTE la période d'essai lors de la première connexion du partenaire validé (§7)
 */
export async function POST(req: NextRequest) {
    try {
        let body: { partnerId?: string; userId?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();
        let partnerId = body.partnerId;

        // Si userId est fourni, récupérer le partnerId
        if (!partnerId && body.userId) {
            const { data: p } = await supabase
                .from('partners')
                .select('id')
                .eq('user_id', body.userId)
                .maybeSingle();
            partnerId = p?.id;
        }

        if (!partnerId) {
            return NextResponse.json({ error: 'partnerId ou userId requis.' }, { status: 400 });
        }

        // 1. Récupération du partenaire
        const { data: partner, error: fetchErr } = await supabase
            .from('partners')
            .select('*, users(*)')
            .eq('id', partnerId)
            .maybeSingle();

        if (fetchErr || !partner) {
            return NextResponse.json({ error: 'Fiche partenaire introuvable.' }, { status: 404 });
        }

        // Vérifier que le statut est au moins VALIDE ou ACTIF
        if (partner.status === 'EN_ATTENTE' || partner.status === 'REJETE') {
            return NextResponse.json(
                { error: 'Le compte partenaire doit d\'abord être validé par un administrateur.' },
                { status: 403 }
            );
        }

        // 2. Appel de la fonction SQL PostgreSQL idempotente
        const { data: activationResult, error: rpcErr } = await (supabase.rpc as any)(
            'activate_partner_trial',
            { p_partner_id: partnerId }
        );

        if (rpcErr) {
            // Fallback JS si la fonction RPC n'est pas encore migrée
            const isFounder = partner.is_founder || false;
            const trialDays = isFounder ? 90 : 60;
            const startedAt = partner.trial_started_at || new Date().toISOString();
            const endsAt = partner.trial_ends_at || new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

            if (!partner.trial_started_at) {
                await supabase
                    .from('partners')
                    .update({
                        trial_started_at: startedAt,
                        trial_ends_at: endsAt,
                        status: 'ACTIF',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', partnerId);

                await supabase
                    .from('users')
                    .update({ status: 'ACTIF', updated_at: new Date().toISOString() })
                    .eq('id', partner.user_id);

                // Notification Première Activation
                if (partner.phone) {
                    await NotificationService.sendFirstActivationNotification({
                        email: partner.email || '',
                        phone: partner.phone,
                        companyName: partner.company_name,
                        trialDays,
                        trialEndsAt: endsAt,
                        userId: partner.user_id,
                    });
                }
            }

            return NextResponse.json({
                success: true,
                isNewActivation: !partner.trial_started_at,
                trialDays,
                trialStartedAt: startedAt,
                trialEndsAt: endsAt,
                status: 'ACTIF',
            });
        }

        // Si l'activation vient de se produire, envoyer la notification
        if (activationResult?.is_new_activation && partner.phone) {
            await NotificationService.sendFirstActivationNotification({
                email: partner.email || '',
                phone: partner.phone,
                companyName: partner.company_name,
                trialDays: activationResult.trial_days,
                trialEndsAt: activationResult.trial_ends_at,
                userId: partner.user_id,
            });
        }

        return NextResponse.json(activationResult);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
