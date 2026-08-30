import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();

        const { data: partner, error: pErr } = await supabase
            .from('partners')
            .select(`
                id, status, is_founder, trial_started_at, trial_ends_at, subscription_plan_id,
                subscription_plan:subscription_plan_id (
                    id, code, name, price, features, billing_period
                )
            `)
            .eq('user_id', user.id)
            .single();

        if (pErr || !partner) {
            return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
        }

        // Calcul des jours restants côté serveur (jamais dans le client)
        const now = new Date();
        let daysRemaining: number | null = null;
        let trialActive = false;

        if (partner.trial_ends_at) {
            const endsAt = new Date(partner.trial_ends_at);
            const diff = endsAt.getTime() - now.getTime();
            daysRemaining = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
            trialActive = diff > 0;
        }

        const trialDuration = partner.is_founder ? 90 : 60;

        // Tous les plans disponibles pour comparaison
        const { data: allPlans } = await supabase
            .from('subscription_plans')
            .select('id, code, name, price, features, billing_period')
            .order('price', { ascending: true });

        return NextResponse.json({
            success: true,
            subscription: {
                currentPlan: partner.subscription_plan || null,
                status: partner.status,
                isFounder: partner.is_founder,
                trialStartedAt: partner.trial_started_at,
                trialEndsAt: partner.trial_ends_at,
                trialDuration,
                daysRemaining,
                trialActive,
            },
            plans: allPlans || [],
        });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur interne.' },
            { status: 500 }
        );
    }
}
