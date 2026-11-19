'use client';

/**
 * Lot 7 (7.4, D70) — première utilisation d'un partenaire validé : les étapes pour publier son premier
 * événement, telles que le serveur les a cochées (`onboarding` de GET /api/partner/dashboard). Aucun calcul
 * ici : l'état de chaque étape (`done`), son lien (`href`), le nombre d'étapes franchies et la prochaine
 * étape sont servis. Le composant ne fait qu'afficher et mener à l'écran de l'étape.
 */
import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Hourglass, Rocket } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';

export type FirstEventStepKey = 'PROFILE' | 'CREATE' | 'POSTER' | 'CATEGORY' | 'SUBMIT' | 'VALIDATED' | 'PUBLISH' | 'CONTROLLERS';

export interface FirstEventStep {
    key: FirstEventStepKey;
    done: boolean;
    href: string;
}

export interface FirstEventOnboarding {
    visible: boolean;
    steps: FirstEventStep[];
    done_count?: number;
    next?: FirstEventStepKey | null;
    awaiting_validation?: boolean;
}

interface StepCopy {
    title: string;
    description: string;
    action: string;
    optional?: boolean;
}

const STEP_COPY: Record<FirstEventStepKey, StepCopy> = {
    PROFILE: {
        title: 'Compléter votre page publique',
        description: 'Description et logo : ce que vos clients voient de votre organisation.',
        action: 'Compléter mon profil',
        optional: true,
    },
    CREATE: {
        title: 'Créer l’événement',
        description: 'Il reste en brouillon, visible de vous seul, jusqu’à sa soumission.',
        action: 'Créer un événement',
    },
    POSTER: {
        title: 'Ajouter l’affiche',
        description: 'Une image est obligatoire pour soumettre l’événement.',
        action: 'Ajouter l’affiche',
    },
    CATEGORY: {
        title: 'Ajouter une catégorie de billets',
        description: 'Au moins une catégorie active, avec son prix et sa quantité.',
        action: 'Ajouter une catégorie',
    },
    SUBMIT: {
        title: 'Soumettre à la validation',
        description: 'L’équipe Event Village vérifie l’événement avant sa mise en ligne.',
        action: 'Soumettre l’événement',
    },
    VALIDATED: {
        title: 'Validation par Event Village',
        description: 'Vous recevez un SMS et une notification dès que l’événement est validé.',
        action: 'Suivre la validation',
    },
    PUBLISH: {
        title: 'Publier l’événement',
        description: 'La billetterie s’ouvre : vos clients peuvent acheter leurs billets.',
        action: 'Publier l’événement',
    },
    CONTROLLERS: {
        title: 'Inviter vos contrôleurs',
        description: 'Ils scannent les billets à l’entrée le jour de l’événement.',
        action: 'Inviter un contrôleur',
        optional: true,
    },
};

export interface FirstEventStepsProps {
    onboarding: FirstEventOnboarding;
    className?: string;
}

export function FirstEventSteps({ onboarding, className }: FirstEventStepsProps) {
    const headingId = React.useId();
    const nextKey = onboarding.next ?? null;
    const nextStep = nextKey ? onboarding.steps.find((s) => s.key === nextKey) ?? null : null;

    return (
        <section aria-labelledby={headingId} className={cn('rounded-xl border border-border bg-card p-4 sm:p-6', className)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
                        <Rocket size={22} />
                    </span>
                    <div className="min-w-0">
                        <h2 id={headingId} className="text-lg font-bold leading-snug text-foreground-strong">Publiez votre premier événement</h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            Votre compte est validé. Suivez ces étapes : elles se cochent toutes seules à mesure que vous avancez.
                        </p>
                        {typeof onboarding.done_count === 'number' && (
                            <p className="mt-2 text-sm font-semibold text-foreground-strong tabular-nums">
                                {onboarding.done_count} étape{onboarding.done_count > 1 ? 's' : ''} franchie{onboarding.done_count > 1 ? 's' : ''} sur 8
                            </p>
                        )}
                    </div>
                </div>
                {nextStep && (
                    <LinkButton href={nextStep.href} variant="primary" rightIcon={<ArrowRight size={16} />} className="sm:flex-shrink-0">
                        {STEP_COPY[nextStep.key].action}
                    </LinkButton>
                )}
            </div>

            {onboarding.awaiting_validation && (
                <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-info-border bg-info-soft p-3 text-sm leading-relaxed text-info-text">
                    <Hourglass size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    Votre événement est soumis. L’équipe Event Village le vérifie : vous serez prévenu dès sa validation, puis vous pourrez le publier.
                </p>
            )}

            <ol className="mt-5 space-y-2">
                {onboarding.steps.map((step) => {
                    const copy = STEP_COPY[step.key];
                    const isNext = step.key === nextKey;
                    return (
                        <li
                            key={step.key}
                            className={cn(
                                'flex items-start gap-3 rounded-xl border p-3',
                                isNext ? 'border-primary-text bg-primary-soft' : 'border-border bg-card',
                            )}
                            aria-current={isNext ? 'step' : undefined}
                        >
                            <span className={cn('mt-0.5 flex-shrink-0', step.done ? 'text-success-text' : 'text-muted-foreground')} aria-hidden="true">
                                {step.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <Link
                                    href={step.href}
                                    className="inline-flex min-h-11 items-center rounded-lg text-base font-semibold text-foreground-strong underline-offset-4 hover:text-primary-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {copy.title}
                                    <span className="sr-only">{step.done ? ' : étape franchie' : ' : étape à faire'}</span>
                                </Link>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {copy.description}
                                    {copy.optional && <span className="font-medium text-foreground"> Facultatif.</span>}
                                </p>
                            </div>
                            {step.done && <span className="mt-2.5 flex-shrink-0 text-sm font-semibold text-success-text">Fait</span>}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

export default FirstEventSteps;
