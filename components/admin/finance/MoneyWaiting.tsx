'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import { ArrowRight, CheckCircle2, HandCoins, RotateCcw, Scale } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';
import { getJson } from '@/lib/finance/admin-client';
import { formatFcfaPrecise, formatInteger } from '@/lib/format';

type Line = { visible: false } | { visible: true; unavailable: true } | { visible: true; unavailable: false; count: number; amount: number };
interface WaitingBody { lines: { toResume: Line; refundsToPay: Line; debts: Line } }

interface RowSpec {
    key: 'toResume' | 'refundsToPay' | 'debts';
    icon: React.ReactNode;
    title: (n: number) => string;
    explain: (amount: string) => React.ReactNode;
    upToDate: string;
    action: string;
    href: string;
}

const ROWS: RowSpec[] = [
    {
        key: 'toResume',
        icon: <RotateCcw size={20} />,
        title: (n) => `${formatInteger(n)} ${n > 1 ? 'versements à reprendre' : 'versement à reprendre'}`,
        explain: (a) => <><span className="font-semibold text-fg tabular-nums">{a}</span> que des clients ou des partenaires attendent depuis plus de 30 minutes.</>,
        upToDate: 'Versements à reprendre : aucun',
        action: 'Traiter les versements',
        href: '/admin/finance#versements-a-reprendre',
    },
    {
        key: 'refundsToPay',
        icon: <HandCoins size={20} />,
        title: (n) => `${formatInteger(n)} ${n > 1 ? 'remboursements à verser' : 'remboursement à verser'}`,
        explain: (a) => <><span className="font-semibold text-fg tabular-nums">{a}</span> demandés et pas encore reçus par les clients.</>,
        upToDate: 'Remboursements à verser : aucun',
        action: 'Voir les remboursements',
        href: '/admin/finance#remboursements-a-verser',
    },
    {
        key: 'debts',
        icon: <Scale size={20} />,
        title: (n) => `${formatInteger(n)} ${n > 1 ? 'créances' : 'créance'}`,
        explain: (a) => <><span className="font-semibold text-fg tabular-nums">{a}</span> que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains.</>,
        upToDate: 'Créances : aucune',
        action: 'Voir les créances',
        href: '/admin/finance#creances',
    },
];

/**
 * Finition 3a (E-07) — « Argent qui attend », en tête de l'accueil de l'administration : versements à reprendre,
 * remboursements à verser, créances, chacun avec un lien direct vers sa liste de la page Finance. Une ligne n'apparaît
 * qu'avec sa permission (le serveur décide) ; un compteur illisible dit « Compteur indisponible », jamais 0. Sans aucune
 * ligne permise, le bloc n'est pas affiché.
 */
export function MoneyWaiting() {
    const id = useId();
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [lines, setLines] = useState<WaitingBody['lines'] | null>(null);
    const [retrying, setRetrying] = useState(false);

    const load = useCallback(async () => {
        const r = await getJson<WaitingBody>('/api/admin/finance/waiting', 'argent qui attend');
        setRetrying(false);
        if (!r.ok || !r.data.lines) {
            setPhase('error');
            return;
        }
        setLines(r.data.lines);
        setPhase('ready');
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    if (phase === 'ready' && lines && ROWS.every((r) => !lines[r.key].visible)) return null;

    const waiting = phase === 'ready' && lines ? ROWS.filter((r) => { const l = lines[r.key]; return l.visible && (l.unavailable || l.count > 0); }) : [];
    const upToDate = phase === 'ready' && lines ? ROWS.filter((r) => { const l = lines[r.key]; return l.visible && !l.unavailable && l.count === 0; }) : [];

    return (
        <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3">
            <h2 id={`${id}-titre`} className="text-lg font-bold tracking-tight text-fg">Argent qui attend</h2>
            {phase === 'loading' && (
                <div role="status" aria-busy="true" aria-label="Chargement de l’argent qui attend" className="grid gap-3 md:grid-cols-3">
                    {[0, 1, 2].map((i) => <span key={i} className="h-36 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" />)}
                </div>
            )}
            {phase === 'error' && (
                <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-danger-border bg-danger-bg p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-danger-fg">Compteurs indisponibles pour le moment : ouvrez la page Finance pour voir les listes.</p>
                    <Button variant="secondary" size="sm" isLoading={retrying} onClick={() => { setRetrying(true); void load(); }}>Réessayer</Button>
                </div>
            )}
            {phase === 'ready' && lines && (
                <>
                    {waiting.length > 0 && (
                        <ul className="grid gap-3 md:grid-cols-3">
                            {waiting.map((r) => {
                                const l = lines[r.key];
                                const unavailable = l.visible && l.unavailable;
                                return (
                                    <li key={r.key} className={cn('flex flex-col gap-3 rounded-2xl border bg-surface p-4 sm:p-5', unavailable ? 'border-border' : 'border-warning-border')}>
                                        <div className="flex items-start gap-3">
                                            <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', unavailable ? 'bg-surface-sunken text-fg-muted' : 'bg-warning-bg text-warning-fg')} aria-hidden="true">{r.icon}</span>
                                            <p className="min-w-0 break-words text-base font-semibold leading-snug text-fg tabular-nums">
                                                {l.visible && !l.unavailable ? r.title(l.count) : r.upToDate.split(' :')[0]}
                                            </p>
                                        </div>
                                        <p className="text-sm leading-relaxed text-fg-muted">
                                            {l.visible && !l.unavailable ? r.explain(formatFcfaPrecise(l.amount)) : 'Compteur indisponible pour le moment.'}
                                        </p>
                                        <LinkButton href={r.href} variant={unavailable ? 'secondary' : 'primary'} rightIcon={<ArrowRight size={16} />} className="mt-auto w-full sm:w-auto">
                                            {r.action}
                                        </LinkButton>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {upToDate.length > 0 && (
                        <ul className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4" aria-label="À jour">
                            {upToDate.map((r) => (
                                <li key={r.key} className="flex items-center gap-2 text-sm text-fg">
                                    <CheckCircle2 size={18} className="flex-shrink-0 text-success-fg" aria-hidden="true" />
                                    {r.upToDate}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}
