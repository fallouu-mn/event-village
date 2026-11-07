'use client';

/**
 * Abonnement du partenaire (lot 7, tâche 7.4, D65).
 *  - Tout vient de GET /api/partner/subscription (useServerData) : offre actuelle, essai (début, fin, jours
 *    restants, durée, `trial_percent_used` entier calculé à l'horloge du serveur) et offres publiées, avec leur
 *    période traduite et leurs caractéristiques libellées par le serveur. Aucune caractéristique n'est
 *    inventée ici, aucune durée ni aucun pourcentage n'est recalculé.
 *  - États : chargement (squelettes), erreur (ErrorState avec « Réessayer »), aucune offre publiée.
 */
import React from 'react';
import { CheckCircle2, Clock, Crown, Info, Mail, RefreshCw, ShieldCheck, Star } from 'lucide-react';
import { useServerData } from '@/components/partner/useServerData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { formatDate, formatFcfa, formatInteger } from '@/lib/format';

interface PlanFeature {
    key: string;
    label: string;
}

interface SubscriptionPlan {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: number;
    billing_period: string;
    /** Période traduite par le serveur (« par mois »). */
    billing_period_label: string;
    feature_items: PlanFeature[];
}

interface SubscriptionData {
    currentPlan: SubscriptionPlan | null;
    status: string;
    isFounder: boolean;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    trialDuration: number | null;
    daysRemaining: number | null;
    trialActive: boolean;
    trial_percent_used: number | null;
}

interface SubscriptionResponse {
    subscription: SubscriptionData;
    plans: SubscriptionPlan[];
    trial_percent_used?: number | null;
}

const SUPPORT_MAIL = 'mailto:support@eventvillage.sn?subject=Changer%20d%E2%80%99offre';

function priceLabel(plan: SubscriptionPlan): string {
    return plan.price > 0 ? `${formatFcfa(plan.price)} ${plan.billing_period_label}` : 'Gratuit';
}

export default function PartnerSubscriptionPage() {
    const { data, error, loading, refreshing, reload } = useServerData<SubscriptionResponse>('/api/partner/subscription');
    const sub = data?.subscription ?? null;
    const plans = data?.plans ?? [];
    const percent = sub?.trial_percent_used ?? data?.trial_percent_used ?? null;

    return (
        <div className="mx-auto max-w-4xl space-y-8 py-6 pb-24">
            <PageHeader
                title="Abonnement"
                description="Votre offre actuelle et votre période d’essai."
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<RefreshCw size={16} aria-hidden="true" />}
                        onClick={() => void reload()}
                        isLoading={refreshing}
                        disabled={loading}
                    >
                        Actualiser
                    </Button>
                }
            />

            {error && !sub ? (
                <ErrorState title="Abonnement indisponible" description={error} onRetry={() => void reload()} isRetrying={loading || refreshing} />
            ) : loading || !sub ? (
                <div className="space-y-3" role="status" aria-busy="true">
                    <span className="sr-only">Chargement de l’abonnement…</span>
                    <Skeleton className="h-36 rounded-2xl" />
                    <Skeleton className="h-48 rounded-2xl" />
                </div>
            ) : (
                <>
                    {error && (
                        <StatusBanner tone="danger" announce="alert" title="Actualisation impossible">
                            {error} Les informations affichées sont celles de la dernière lecture réussie.
                        </StatusBanner>
                    )}

                    {/* Essai en cours */}
                    {sub.trialActive && sub.trialEndsAt && (
                        <section aria-labelledby="essai-titre" className="space-y-3 rounded-2xl border border-success-border bg-success-bg p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <ShieldCheck size={20} className="text-success-fg" aria-hidden="true" />
                                    <h2 id="essai-titre" className="text-base font-bold text-success-fg">Période d’essai gratuite en cours</h2>
                                    {sub.isFounder && (
                                        <Badge variant="brand" size="sm" icon={<Crown size={12} aria-hidden="true" />}>Fondateur</Badge>
                                    )}
                                </div>
                                {sub.daysRemaining !== null && (
                                    <Badge variant="success" size="md" className="tabular-nums">
                                        {formatInteger(sub.daysRemaining)} jour{sub.daysRemaining > 1 ? 's' : ''} restant{sub.daysRemaining > 1 ? 's' : ''}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap justify-between gap-2 text-sm text-fg">
                                <span>Début : <time dateTime={sub.trialStartedAt ?? undefined} className="text-sm">{formatDate(sub.trialStartedAt)}</time></span>
                                <span>Fin : <time dateTime={sub.trialEndsAt} className="text-sm">{formatDate(sub.trialEndsAt)}</time></span>
                            </div>
                            {percent !== null && (
                                <>
                                    <div
                                        className="h-2.5 overflow-hidden rounded-full bg-surface"
                                        role="progressbar"
                                        aria-label="Part de la période d’essai écoulée"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={percent}
                                    >
                                        <div className="h-full rounded-full bg-success motion-safe:transition-all" style={{ width: `${percent}%` }} />
                                    </div>
                                    <p className="text-sm font-medium tabular-nums text-success-fg">
                                        {formatInteger(percent)} % de la période écoulée
                                        {sub.trialDuration !== null && <> · durée totale : {formatInteger(sub.trialDuration)} jours</>}
                                        {sub.isFounder && ' (offre fondateur)'}
                                    </p>
                                </>
                            )}
                        </section>
                    )}

                    {/* Essai terminé */}
                    {sub.trialEndsAt && !sub.trialActive && (
                        <StatusBanner tone="warning" title="Période d’essai terminée" icon={<Clock size={20} />}>
                            Terminée le <time dateTime={sub.trialEndsAt}>{formatDate(sub.trialEndsAt)}</time>. Contactez le support pour choisir une offre.
                        </StatusBanner>
                    )}

                    {/* Essai non démarré */}
                    {!sub.trialStartedAt && (
                        <StatusBanner tone="info" title="Période d’essai non démarrée" icon={<Info size={20} />}>
                            Elle démarre automatiquement à votre première visite du tableau de bord, une fois votre compte validé.
                        </StatusBanner>
                    )}

                    {/* Offre actuelle */}
                    <section aria-labelledby="offre-actuelle" className="space-y-3 rounded-2xl border-2 border-brand-fg bg-surface p-5">
                        <h2 id="offre-actuelle" className="text-base font-bold text-fg">Offre actuelle</h2>
                        {sub.currentPlan ? (
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                                    <Star size={20} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-lg font-bold text-fg">{sub.currentPlan.name}</p>
                                    <p className="text-sm tabular-nums text-fg-muted">{priceLabel(sub.currentPlan)}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-fg-muted">Aucune offre attribuée : vous utilisez la plateforme pendant votre période d’essai.</p>
                        )}
                    </section>

                    {/* Offres publiées */}
                    <section aria-labelledby="offres-titre" className="space-y-3">
                        <h2 id="offres-titre" className="text-lg font-bold text-fg">Offres disponibles</h2>
                        {plans.length === 0 ? (
                            <EmptyState
                                title="Aucune offre n’est encore publiée"
                                description="Les offres d’abonnement Event Village apparaîtront ici dès leur publication."
                                icon={<Star size={28} />}
                            />
                        ) : (
                            <>
                                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {plans.map((plan) => {
                                        const isCurrent = sub.currentPlan?.id === plan.id;
                                        return (
                                            <li
                                                key={plan.id}
                                                className={cn('flex flex-col gap-4 rounded-2xl border-2 bg-surface p-5', isCurrent ? 'border-brand-fg' : 'border-border')}
                                                aria-current={isCurrent ? 'true' : undefined}
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <h3 className="text-base font-bold text-fg">{plan.name}</h3>
                                                        {isCurrent && <Badge variant="brand" size="sm">Offre actuelle</Badge>}
                                                    </div>
                                                    <p className="text-xl font-bold tabular-nums text-brand-fg">{priceLabel(plan)}</p>
                                                    {plan.description && <p className="text-sm leading-relaxed text-fg-muted">{plan.description}</p>}
                                                </div>
                                                {plan.feature_items.length > 0 && (
                                                    <ul className="space-y-2">
                                                        {plan.feature_items.map((f) => (
                                                            <li key={f.key} className="flex items-start gap-2 text-sm text-fg">
                                                                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-success-fg" aria-hidden="true" />
                                                                {f.label}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                                <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface-sunken p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-fg-muted">
                                        Le changement d’offre se fait avec l’équipe Event Village : il n’est pas encore possible en ligne.
                                    </p>
                                    <LinkButton href={SUPPORT_MAIL} variant="secondary" size="sm" leftIcon={<Mail size={16} />}>
                                        Contacter le support
                                    </LinkButton>
                                </div>
                            </>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
