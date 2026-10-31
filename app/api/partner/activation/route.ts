import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/notifications/notification.service';
import { requireActiveSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/activation
 * Démarre de manière IDEMPOTENTE la période d'essai lors de la première connexion du partenaire validé (§7).
 * Lot 1B.6 : uniquement pour la fiche partenaire du compte connecté, lui-même ACTIF. Les champs
 * historiques `partnerId` / `userId` du corps doivent désigner cette même fiche.
 */
export async function POST(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;

        let body: { partnerId?: string; userId?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        const { data: ownPartner, error: ownErr } = await supabase
            .from('partners')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (ownErr) {
            console.error('[API /api/partner/activation] lecture de la fiche partenaire :', ownErr.message);
            return NextResponse.json({ error: 'Lecture de la fiche partenaire impossible.' }, { status: 500 });
        }
        if (!ownPartner) {
            return NextResponse.json({ error: 'Aucune fiche partenaire associée à ce compte.' }, { status: 403 });
        }
        if ((body.userId && body.userId !== user.id) || (body.partnerId && body.partnerId !== ownPartner.id)) {
            console.warn(`[API /api/partner/activation] compte ${user.id} : activation d'une autre fiche refusée`);
            return NextResponse.json({ error: 'Vous ne pouvez activer que votre propre fiche partenaire.', code: 'FORBIDDEN_OTHER_PARTNER' }, { status: 403 });
        }
        const partnerId = ownPartner.id;

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

                // Lot 1B.6 : plus d'écriture de users.status ici ; le compte appelant est ACTIF par construction.

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
