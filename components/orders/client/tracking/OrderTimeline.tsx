'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bike, Check, ChefHat, PackageCheck, Send, ThumbsUp, Utensils } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatTime } from '@/lib/format';
import { clientTimeline, type TimelineKey } from '@/lib/orders/client-view';

/**
 * Lot 12b — frise du suivi d'une commande : une étape par heure franchie (base, order_view.steps), icônes qui
 * s'allument, l'étape en cours mise en avant avec sa phrase courte. À chaque nouvelle étape franchie pendant que la page
 * est ouverte, son icône grandit brièvement (ev-count-pop : échelle seule, 300 ms, coupée par « réduire les
 * animations »). Liste ordonnée, étape en cours annoncée (aria-current="step").
 */

const ICONS: Record<TimelineKey, React.ElementType> = {
    RECUE: Send,
    ACCEPTEE: ThumbsUp,
    EN_PREPARATION: ChefHat,
    PRETE: PackageCheck,
    EN_ROUTE: Bike,
    REMISE: Utensils,
};

export function OrderTimeline({ mode, steps, closed }: { mode: string; steps: Record<string, unknown>; closed: boolean }) {
    const list = clientTimeline(mode, steps);
    const reached = list.filter((s) => s.at !== null).length;
    const current = closed ? -1 : reached; // index de la prochaine étape attendue (commande ouverte)
    const previous = useRef<number | null>(null);
    const [popped, setPopped] = useState<number | null>(null);

    useEffect(() => {
        if (previous.current !== null && reached > previous.current) setPopped(reached - 1);
        previous.current = reached;
    }, [reached]);

    return (
        <ol className="relative space-y-0" aria-label="Étapes de la commande" data-testid="frise-commande">
            {list.map((step, i) => {
                const Icon = ICONS[step.key];
                const done = step.at !== null;
                const isCurrent = i === current;
                const last = i === list.length - 1;
                return (
                    <li key={step.key} className="relative flex gap-4 pb-5 last:pb-0" aria-current={isCurrent ? 'step' : undefined} data-etape={step.key} data-franchie={done ? 'oui' : 'non'}>
                        {!last && (
                            <span
                                aria-hidden="true"
                                className={cn('absolute left-[1.375rem] top-12 h-[calc(100%-3rem)] w-0.5 rounded-full', done && list[i + 1]?.at ? 'bg-primary' : 'bg-border')}
                            />
                        )}
                        <span
                            aria-hidden="true"
                            className={cn(
                                'relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-base',
                                done ? 'border-primary bg-primary text-primary-foreground' : isCurrent ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-card text-muted-foreground',
                                popped === i && 'ev-count-pop',
                            )}
                        >
                            {done && step.key !== 'REMISE' && i < reached - 1 ? <Check size={20} strokeWidth={3} /> : <Icon size={20} />}
                        </span>
                        <div className="min-w-0 flex-1 pt-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <p className={cn('text-base font-semibold', done || isCurrent ? 'text-foreground-strong' : 'text-muted-foreground')}>{step.label}</p>
                                {done && <time dateTime={step.at ?? undefined} className="text-sm tabular-nums text-muted-foreground">{formatTime(step.at)}</time>}
                            </div>
                            {done && i === reached - 1 && (!closed || step.key === 'REMISE') && (
                                <p className="mt-0.5 text-sm text-muted-foreground">{step.hint}</p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
