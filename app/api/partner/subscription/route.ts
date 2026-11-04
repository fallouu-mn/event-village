import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { partnerTrial, trialPercentUsed } from '@/lib/partner/partner-dashboard.service';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 3600_000;

/** Période de facturation traduite (jamais l'enum affiché). */
const BILLING_PERIOD_LABELS: Record<string, string> = {
    MONTHLY: 'par mois',
    QUARTERLY: 'par trimestre',
    YEARLY: 'par an',
    ANNUAL: 'par an',
};

const SUPPORT_LABELS: Record<string, string> = {
    STANDARD: 'Assistance standard',
    PRIORITY: 'Assistance prioritaire',
    DEDICATED: 'Interlocuteur dédié',
};

interface PlanRow {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    price: number | string;
    features: unknown;
    billing_period: string | null;
}

/**
 * Caractéristiques d'une offre avec leur libellé (D65). Seules les clés connues sont servies ; une clé
 * inconnue n'est jamais affichée brute. `commission_rate` n'est pas servi : Event Village ne prélève rien
 * sur l'organisateur (moteur financier unique, frais payés par l'acheteur), l'afficher serait faux.
 */
function planFeatures(raw: unknown): Array<{ key: string; label: string }> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const f = raw as Record<string, unknown>;
    const out: Array<{ key: string; label: string }> = [];
    const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
    const events = count(f.max_events);
    if (events !== null) out.push({ key: 'max_events', label: `Jusqu’à ${events} événement${events > 1 ? 's' : ''}` });
    const products = count(f.max_products);
    if (products !== null) out.push({ key: 'max_products', label: `Jusqu’à ${products} produit${products > 1 ? 's' : ''} au menu` });
    if (typeof f.support === 'string' && SUPPORT_LABELS[f.support]) out.push({ key: 'support', label: SUPPORT_LABELS[f.support] });
    if (f.analytics === true) out.push({ key: 'analytics', label: 'Statistiques avancées' });
    return out;
}

function toPlan(p: PlanRow) {
    const period = p.billing_period ?? 'MONTHLY';
    return {
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description ?? null,
        price: Number(p.price),
        billing_period: period,
        billing_period_label: BILLING_PERIOD_LABELS[period] ?? 'par période',
        feature_items: planFeatures(p.features),
    };
}

/**
 * GET /api/partner/subscription — offre et essai du partenaire connecté. Tout est calculé ici, à l'horloge
 * du serveur : jours restants, durée de l'essai (fin − début telle que posée par activate_partner_trial),
 * `trial_percent_used` (entier de 0 à 100, lot 7, contrat 3.8). Offres publiées avec libellés (D65).
 */
export async function GET(request: NextRequest) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!user || !serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux partenaires.', code: 'NOT_PARTNER' }, { status: 403 });
    }

    try {
        const supabase = getServiceRoleClient();
        const { data: partner, error: pErr } = await supabase
            .from('partners')
            .select(`
                id, status, is_founder, trial_started_at, trial_ends_at, subscription_plan_id,
                subscription_plan:subscription_plan_id (
                    id, code, name, description, price, features, billing_period
                )
            `)
            .eq('user_id', user.id)
            .maybeSingle();
        if (pErr) {
            console.error(`[GET /api/partner/subscription] fiche partenaire de ${user.id} :`, pErr.message);
            return NextResponse.json({ error: 'Abonnement momentanément indisponible.', code: 'SUBSCRIPTION_UNAVAILABLE' }, { status: 500 });
        }
        if (!partner) {
            return NextResponse.json({ error: 'Profil partenaire introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
        }

        const { data: allPlans, error: plansErr } = await supabase
            .from('subscription_plans')
            .select('id, code, name, description, price, features, billing_period')
            .eq('is_active', true)
            .order('price', { ascending: true });
        if (plansErr) {
            console.error('[GET /api/partner/subscription] offres :', plansErr.message);
            return NextResponse.json({ error: 'Offres momentanément indisponibles.', code: 'SUBSCRIPTION_UNAVAILABLE' }, { status: 500 });
        }

        const now = Date.now();
        const trial = partnerTrial(partner.trial_started_at ?? null, partner.trial_ends_at ?? null, now);
        const endsAt = partner.trial_ends_at ? Date.parse(partner.trial_ends_at) : NaN;
        const daysRemaining = Number.isNaN(endsAt) ? null : endsAt > now ? Math.ceil((endsAt - now) / DAY_MS) : 0;
        const percent = trialPercentUsed(partner.trial_started_at ?? null, partner.trial_ends_at ?? null, now);
        const currentRaw = (Array.isArray(partner.subscription_plan) ? partner.subscription_plan[0] : partner.subscription_plan) as PlanRow | null | undefined;

        return NextResponse.json({
            success: true,
            subscription: {
                currentPlan: currentRaw ? toPlan(currentRaw) : null,
                status: partner.status,
                isFounder: partner.is_founder === true,
                trialStartedAt: partner.trial_started_at,
                trialEndsAt: partner.trial_ends_at,
                trialDuration: trial.days,
                daysRemaining,
                trialActive: trial.active,
                trial_percent_used: percent,
            },
            trial_percent_used: percent,
            plans: ((allPlans ?? []) as PlanRow[]).map(toPlan),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        console.error(`[GET /api/partner/subscription] compte ${user.id} :`, error instanceof Error ? error.message : String(error));
        return NextResponse.json({ error: 'Abonnement momentanément indisponible.', code: 'SUBSCRIPTION_UNAVAILABLE' }, { status: 500 });
    }
}
