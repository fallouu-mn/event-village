import React from 'react';
import { cn } from '@/components/ui/cn';
import { TONE_ICON, type Tone } from '@/components/ui/tones';

/**
 * Finition 3a (E-06, E-38) — un chiffre de la page Finance : titre, montant, phrase simple, sous-lignes, date utilisée et
 * lien vers le détail. Le montant arrive déjà formaté (lib/format.ts) : aucun calcul ici. Sans montant (`value` null),
 * seul le contenu (`children`) parle (solde illisible, compteur indisponible).
 */
export type MoneyTone = Extract<Tone, 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'>;

export interface MoneyFigureProps {
    /** Identifiant du titre (aria-labelledby de la carte). */
    id: string;
    title: string;
    tone: MoneyTone;
    icon: React.ReactNode;
    /** Montant formaté ; null : aucun chiffre montré. */
    value: React.ReactNode | null;
    loading?: boolean;
    /** Phrase simple sous le chiffre. */
    explanation: React.ReactNode;
    /** Date utilisée par le chiffre (« Paiements encaissés du … », « À l'instant »). */
    basis?: React.ReactNode;
    detailHref?: string;
    detailLabel?: string;
    children?: React.ReactNode;
    className?: string;
}

export function MoneyFigure({ id, title, tone, icon, value, loading = false, explanation, basis, detailHref, detailLabel, children, className }: MoneyFigureProps) {
    return (
        <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5', className)}>
            <div className="flex items-start justify-between gap-3">
                <h2 id={id} className="min-w-0 break-words text-base font-semibold leading-snug text-foreground-strong">{title}</h2>
                <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', TONE_ICON[tone])} aria-hidden="true">
                    {icon}
                </span>
            </div>
            {loading ? (
                <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={`Chargement : ${title}`}>
                    <span className="h-9 w-40 rounded bg-background motion-safe:animate-pulse" />
                    <span className="h-4 w-full rounded bg-background motion-safe:animate-pulse" />
                    <span className="h-4 w-2/3 rounded bg-background motion-safe:animate-pulse" />
                </div>
            ) : (
                <>
                    {value !== null && (
                        <p className="break-words text-3xl font-bold leading-tight tracking-tight text-foreground-strong tabular-nums">{value}</p>
                    )}
                    <p className="text-sm leading-relaxed text-muted-foreground">{explanation}</p>
                    {children}
                    {basis && <p className="text-sm leading-relaxed text-muted-foreground">{basis}</p>}
                </>
            )}
            {detailHref && detailLabel && (
                <a
                    href={detailHref}
                    className="mt-auto inline-flex min-h-11 items-center self-start rounded-lg text-sm font-semibold text-primary-text underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {detailLabel}
                </a>
            )}
        </section>
    );
}

export interface MoneyLine {
    label: React.ReactNode;
    /** Montant formaté (avec son signe si la ligne s'ajoute ou se retranche). */
    value: React.ReactNode;
    /** Précision sous le libellé (date utilisée, origine). */
    hint?: React.ReactNode;
    /** Ligne de total (mise en avant, filet au-dessus). */
    total?: boolean;
}

/** Lignes « libellé — montant » d'un chiffre ou de son détail (liste de définitions, montants alignés à droite). */
export function MoneyLines({ lines, className }: { lines: MoneyLine[]; className?: string }) {
    return (
        <dl className={cn('flex flex-col', className)}>
            {lines.map((l, i) => (
                <div
                    key={i}
                    className={cn(
                        'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2',
                        l.total ? 'mt-1 border-t border-border pt-3' : i > 0 ? 'border-t border-border/60' : '',
                    )}
                >
                    <dt className={cn('min-w-0 flex-1 text-sm', l.total ? 'font-semibold text-foreground-strong' : 'text-muted-foreground')}>
                        <span className="block break-words">{l.label}</span>
                        {l.hint && <span className="mt-0.5 block text-sm text-muted-foreground">{l.hint}</span>}
                    </dt>
                    <dd className={cn('text-right text-sm tabular-nums', l.total ? 'text-base font-bold text-foreground-strong' : 'font-semibold text-foreground-strong')}>{l.value}</dd>
                </div>
            ))}
        </dl>
    );
}
