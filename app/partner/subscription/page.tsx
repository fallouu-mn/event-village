'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    CreditCard,
    ShieldCheck,
    Clock,
    Star,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/EmptyState';

interface SubscriptionPlan {
    id: string;
    code: string;
    name: string;
    price: number;
    features: Record<string, unknown>;
    billing_period: string;
}

interface SubscriptionData {
    currentPlan: SubscriptionPlan | null;
    status: string;
    isFounder: boolean;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    trialDuration: number;
    daysRemaining: number | null;
    trialActive: boolean;
}

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
    STARTER: [
        "Gestion des événements (jusqu’à 3)",
        'Billetterie en ligne',
        'Commandes & menu digital',
        'Scanner de billets QR',
        'Support email',
    ],
    BUSINESS: [
        "Événements illimités",
        'Billetterie + gestion salles',
        'Commandes & tables',
        "Statistiques avancées",
        'Support prioritaire',
        "Retrait accéléré",
    ],
    PREMIUM: [
        'Tout Business +',
        'Compte gestionnaire multi-sites',
        'API partenaire',
        "Manager dédié",
        'Tableau de bord analytique',
        'Retrait immédiat',
    ],
};

const PLAN_COLORS: Record<string, { border: string; bg: string; badge: string; text: string }> = {
    STARTER: {
        border: 'border-slate-200 dark:border-zinc-700',
        bg: 'bg-white dark:bg-zinc-900',
        badge: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300',
        text: 'text-slate-700 dark:text-zinc-300',
    },
    BUSINESS: {
        border: 'border-[#FF5722]/50',
        bg: 'bg-orange-50/30 dark:bg-orange-950/10',
        badge: 'bg-[#FF5722]/15 text-[#FF5722] border border-[#FF5722]/30',
        text: 'text-[#FF5722]',
    },
    PREMIUM: {
        border: 'border-violet-400/60',
        bg: 'bg-violet-50/30 dark:bg-violet-950/10',
        badge: 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-300/50',
        text: 'text-violet-700 dark:text-violet-300',
    },
};

export default function PartnerSubscriptionPage() {
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubscription = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/partner/subscription');
            const data = await res.json();
            if (data.success) {
                setSubscriptionData(data.subscription);
                setPlans(data.plans || []);
            } else {
                setError(data.error || 'Erreur de chargement.');
            }
        } catch {
            setError('Impossible de charger les informations d\'abonnement.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

    const trialPercentUsed = subscriptionData?.trialStartedAt && subscriptionData?.trialDuration && subscriptionData?.daysRemaining !== null
        ? Math.round(((subscriptionData.trialDuration - (subscriptionData.daysRemaining || 0)) / subscriptionData.trialDuration) * 100)
        : 0;

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-[#FF5722]" />
                        Abonnement
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Votre plan actuel et p&eacute;riode d&apos;essai
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={fetchSubscription}
                    disabled={loading}
                >
                    Actualiser
                </Button>
            </div>

            {error && <ErrorState description={error} onRetry={fetchSubscription} />}

            {loading && !subscriptionData && (
                <div className="space-y-3">
                    <div className="h-36 rounded-2xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                    <div className="h-48 rounded-2xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                </div>
            )}

            {subscriptionData && (
                <>
                    {/* Trial banner */}
                    {subscriptionData.trialActive && subscriptionData.trialEndsAt && (
                        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                    <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                                        P&eacute;riode d&apos;essai gratuite active
                                    </span>
                                    {subscriptionData.isFounder && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300/50">
                                            <Crown className="w-3 h-3" />
                                            Fondateur
                                        </span>
                                    )}
                                </div>
                                <Badge variant="success" size="sm">
                                    {subscriptionData.daysRemaining} jours restants
                                </Badge>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                    <span>Début : {new Date(subscriptionData.trialStartedAt!).toLocaleDateString('fr-FR')}</span>
                                    <span>Fin : {new Date(subscriptionData.trialEndsAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                </div>
                                <div className="h-2 rounded-full bg-emerald-200 dark:bg-emerald-900/50 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${Math.min(100, trialPercentUsed)}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {trialPercentUsed}% de la période utilisée · Durée totale : {subscriptionData.trialDuration} jours
                                    {subscriptionData.isFounder && ' (Fondateur)'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trial expired */}
                    {subscriptionData.trialEndsAt && !subscriptionData.trialActive && (
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-3 text-xs">
                            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <div>
                                <div className="font-black text-amber-900 dark:text-amber-200">P&eacute;riode d&apos;essai termin&eacute;e</div>
                                <div className="text-amber-700 dark:text-amber-400">
                                    Expirée le {new Date(subscriptionData.trialEndsAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No trial started */}
                    {!subscriptionData.trialStartedAt && (
                        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center gap-3 text-xs">
                            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div>
                                <div className="font-black text-blue-900 dark:text-blue-200">P&eacute;riode d&apos;essai non d&eacute;marr&eacute;e</div>
                                <div className="text-blue-700 dark:text-blue-400">
                                    Votre p&eacute;riode d&apos;essai d&eacute;marrera automatiquement lors de la validation de votre compte.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Current plan */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-[#FF5722]/40 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black text-slate-900 dark:text-white">Plan actuel</h2>
                        </div>
                        {subscriptionData.currentPlan ? (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF5722] flex items-center justify-center">
                                    <Star className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-black text-lg text-slate-900 dark:text-white">
                                        {subscriptionData.currentPlan.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                                        {subscriptionData.currentPlan.price > 0
                                            ? `${subscriptionData.currentPlan.price.toLocaleString('fr-FR')} FCFA/${subscriptionData.currentPlan.billing_period || 'mois'}`
                                            : 'Gratuit'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 dark:text-zinc-400">
                                Aucun plan assign&eacute; &mdash; plan de base en cours d&apos;essai
                            </div>
                        )}
                    </div>

                    {/* Plans comparison */}
                    {plans.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-black text-slate-900 dark:text-white">
                                Nos plans disponibles
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {plans.map((plan) => {
                                    const colors = PLAN_COLORS[plan.code] || PLAN_COLORS.STARTER;
                                    const highlights = PLAN_HIGHLIGHTS[plan.code] || [];
                                    const isCurrent = subscriptionData.currentPlan?.id === plan.id;

                                    return (
                                        <div
                                            key={plan.id}
                                            className={`p-5 rounded-2xl border-2 ${colors.border} ${colors.bg} space-y-4 relative`}
                                        >
                                            {isCurrent && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-[#FF5722] text-white shadow-sm">
                                                        Plan actuel
                                                    </span>
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                <div className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black ${colors.badge}`}>
                                                    {plan.code}
                                                </div>
                                                <div className="text-base font-black text-slate-900 dark:text-white">
                                                    {plan.name}
                                                </div>
                                                <div className={`text-lg font-black ${colors.text}`}>
                                                    {plan.price > 0
                                                        ? `${plan.price.toLocaleString('fr-FR')} FCFA`
                                                        : 'Gratuit'}
                                                    {plan.price > 0 && (
                                                        <span className="text-[11px] font-normal text-slate-400 dark:text-zinc-500 ml-1">
                                                            /{plan.billing_period || 'mois'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <ul className="space-y-1.5">
                                                {highlights.map((feature, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                        {feature}
                                                    </li>
                                                ))}
                                                {/* Dynamic features from JSONB if any */}
                                                {plan.features && typeof plan.features === 'object' &&
                                                    Object.entries(plan.features).slice(0, 3).map(([key, val]) => (
                                                        <li key={key} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                            {String(val)}
                                                        </li>
                                                    ))
                                                }
                                            </ul>

                                            {!isCurrent && (
                                                <Button
                                                    variant={plan.code === 'BUSINESS' ? 'primary' : 'secondary'}
                                                    size="sm"
                                                    fullWidth
                                                    disabled
                                                >
                                                    Passer à ce plan
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-center">
                                Contactez le support Event Village pour changer de plan ou en savoir plus.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
