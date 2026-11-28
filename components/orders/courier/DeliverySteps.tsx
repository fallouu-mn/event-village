'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bike, Check, ChefHat, PackageCheck, ThumbsUp, Home } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { hourText } from './courier-view';

/**
 * Lot 12d — frise compacte d'une livraison, lisible d'un coup d'œil sur un téléphone : cinq étapes (acceptée, en
 * préparation, prête, en route, livrée) avec l'heure servie par la base. La barre de progression avance par une échelle
 * horizontale (transform, 300 ms) et l'étape qui vient d'être franchie grandit brièvement (ev-count-pop) ; tout est
 * coupé par « réduire les animations » (motion-safe et règle globale de app/globals.css).
 */

const STEPS = [
    { key: 'accepted_at', label: 'Acceptée', icon: ThumbsUp },
    { key: 'preparing_at', label: 'En préparation', icon: ChefHat },
    { key: 'ready_at', label: 'Prête', icon: PackageCheck },
    { key: 'en_route_at', label: 'En route', icon: Bike },
    { key: 'handed_over_at', label: 'Livrée', icon: Home },
] as const;

export function DeliverySteps({ steps }: { steps: Record<string, unknown> }) {
    const at = STEPS.map((s) => (typeof steps[s.key] === 'string' ? (steps[s.key] as string) : null));
    // Dernière étape franchie (une étape peut être sautée : « prête » sans « en préparation »)
    const last = at.reduce((acc, v, i) => (v ? i : acc), -1);
    const previous = useRef<number | null>(null);
    const [popped, setPopped] = useState<number | null>(null);

    useEffect(() => {
        if (previous.current !== null && last > previous.current) setPopped(last);
        previous.current = last;
    }, [last]);

    const progress = last <= 0 ? 0 : last / (STEPS.length - 1);
    const current = last >= 0 ? STEPS[last] : null;

    return (
        <section aria-label="Étapes de la livraison" data-testid="frise-livraison" className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
            <p className="text-sm font-semibold text-muted-foreground">Étape</p>
            <p key={current?.key ?? 'aucune'} className="ev-fade-in text-2xl font-extrabold leading-tight text-foreground-strong" aria-live="polite">
                {current ? current.label : 'En attente'}
                {current && at[last] && <span className="ml-2 text-lg font-semibold tabular-nums text-muted-foreground">{hourText(at[last])}</span>}
            </p>
            <div className="relative mt-4">
                <div aria-hidden="true" className="absolute left-5 right-5 top-5 h-1.5 -translate-y-1/2 rounded-full bg-border">
                    <div
                        className="h-full origin-left rounded-full bg-primary motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-standard"
                        style={{ transform: `scaleX(${progress})` }}
                    />
                </div>
                <ol className="relative flex justify-between">
                    {STEPS.map((s, i) => {
                        const done = i <= last;
                        const Icon = s.icon;
                        return (
                            <li key={s.key} className="flex w-12 flex-col items-center gap-1.5 sm:w-16" aria-current={i === last ? 'step' : undefined} data-franchie={done ? 'oui' : 'non'}>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2',
                                        done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                                        popped === i && 'ev-count-pop',
                                    )}
                                >
                                    {done && i < last ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                                </span>
                                <span className={cn('text-center text-sm font-semibold leading-tight', done ? 'text-foreground-strong' : 'text-muted-foreground')}>
                                    {s.label}
                                    <span className="sr-only">{done ? ' : franchie' : ' : à venir'}</span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}
