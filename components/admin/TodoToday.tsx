'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import { AlertOctagon, ArrowRight, Building2, CalendarClock, CalendarX2, CheckCircle2, MessageSquareWarning, RotateCcw, Scale, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';
import { getJson } from '@/lib/finance/admin-client';
import { formatFcfaPrecise, formatInteger } from '@/lib/format';
import type { TodoLine, TodoLineKey, TodoReply } from '@/lib/admin/todo';

/** « 3 événements », « 1 événement ». */
function plural(n: number, one: string, many: string): string {
    return `${formatInteger(n)} ${n > 1 ? many : one}`;
}

/** Ancienneté en mots simples : « moins d'une heure », « 5 heures », « 2 jours ». */
export function waitingFor(iso: string | null | undefined, now: Date = new Date()): string | null {
    if (!iso) return null;
    const ms = now.getTime() - new Date(iso).getTime();
    if (!Number.isFinite(ms)) return null;
    const hours = Math.floor(ms / 3_600_000);
    if (hours < 1) return 'moins d’une heure';
    if (hours < 48) return plural(hours, 'heure', 'heures');
    return plural(Math.floor(hours / 24), 'jour', 'jours');
}

interface Spec {
    icon: React.ReactNode;
    title: (l: TodoLine) => string;
    explain: (l: TodoLine) => React.ReactNode;
    upToDate: string;
    action: string;
    href: (l: TodoLine) => string;
}

const amount = (x: number | undefined) => <span className="font-semibold text-fg tabular-nums">{formatFcfaPrecise(Number(x ?? 0))}</span>;

/** Textes et liens de chaque ligne, dans l'ordre de l'écran (lib/admin/todo.ts). */
export const TODO_SPECS: Record<TodoLineKey, Spec> = {
    to_resume: {
        icon: <RotateCcw size={20} />,
        title: (l) => plural(Number(l.count), 'versement à reprendre', 'versements à reprendre'),
        explain: (l) => <>{amount(l.amount)} que des clients ou des partenaires attendent depuis plus de 30 minutes.</>,
        upToDate: 'Versements à reprendre : aucun',
        action: 'Voir l’argent qui attend',
        href: () => '#argent-qui-attend',
    },
    events_to_validate: {
        icon: <CalendarClock size={20} />,
        title: (l) => plural(Number(l.count), 'événement à valider', 'événements à valider'),
        explain: (l) => {
            const since = waitingFor(l.oldest_at);
            return since ? <>Le plus ancien attend depuis {since}.</> : <>Soumis par les partenaires, en attente de votre examen.</>;
        },
        upToDate: 'Événements à valider : aucun',
        action: 'Examiner les événements',
        href: () => '/admin/events?status=EN_ATTENTE',
    },
    partners_to_validate: {
        icon: <Building2 size={20} />,
        title: (l) => plural(Number(l.count), 'candidature de partenaire', 'candidatures de partenaires'),
        explain: (l) => (Number(l.resubmitted) > 0
            ? <>Dont {plural(Number(l.resubmitted), 'dossier complété', 'dossiers complétés')} après un refus.</>
            : <>Inscriptions avec leurs pièces justificatives.</>),
        upToDate: 'Candidatures de partenaires : aucune',
        action: 'Examiner les candidatures',
        href: () => '/admin/dashboard?partenaires=EN_ATTENTE#partenaires',
    },
    events_suspended: {
        icon: <CalendarX2 size={20} />,
        title: (l) => plural(Number(l.count), 'événement suspendu à décider', 'événements suspendus à décider'),
        explain: (l) => {
            const past = Number(l.past ?? 0);
            const upcoming = Number(l.upcoming ?? 0);
            return (
                <>
                    {past > 0 && (past > 1
                        ? <><span className="tabular-nums">{formatInteger(past)}</span> dont la date est passée : clôturez-les ou annulez-les. </>
                        : <>1 dont la date est passée : clôturez-le ou annulez-le. </>)}
                    {upcoming > 0 && (upcoming > 1
                        ? <><span className="tabular-nums">{formatInteger(upcoming)}</span> à venir : réactivez-les ou annulez-les.</>
                        : <>1 à venir : réactivez-le ou annulez-le.</>)}
                </>
            );
        },
        upToDate: 'Événements suspendus : aucun',
        action: 'Voir les événements suspendus',
        href: () => '/admin/events?status=SUSPENDU',
    },
    cash_discrepancies: {
        icon: <Wallet size={20} />,
        title: (l) => plural(Number(l.count), 'écart de caisse à valider', 'écarts de caisse à valider'),
        explain: (l) => {
            const first = l.events?.[0];
            const k = Number(l.events_count ?? 0);
            return (
                <>
                    {k > 1 ? <>Sur <span className="tabular-nums">{formatInteger(k)}</span> événements. </> : null}
                    {first ? <>{k > 1 ? 'Le plus ancien' : 'Événement'} : « {first.title} ». </> : null}
                    Recomptez l’argent avec le contrôleur avant de valider.
                </>
            );
        },
        upToDate: 'Écarts de caisse à valider : aucun',
        action: 'Voir la caisse',
        href: (l) => (l.events?.[0] ? `/partner/events/${l.events[0].event_id}?tab=caisse` : '/admin/events'),
    },
    failed_sends: {
        icon: <AlertOctagon size={20} />,
        title: (l) => plural(Number(l.count), 'envoi en échec aujourd’hui', 'envois en échec aujourd’hui'),
        explain: () => <>SMS, emails ou notifications qui ne sont pas partis.</>,
        upToDate: 'Envois en échec aujourd’hui : aucun',
        action: 'Voir les envois en échec',
        href: () => '/admin/notifications?status=FAILED',
    },
    sms_cap: {
        icon: <MessageSquareWarning size={20} />,
        title: (l) => `SMS optionnels : ${formatInteger(Number(l.count))} sur ${formatInteger(Number(l.cap ?? 0))} aujourd’hui`,
        explain: (l) => <>Au-delà de <span className="tabular-nums">{formatInteger(Number(l.cap ?? 0))}</span>, les rappels et les annonces partent sans SMS.</>,
        upToDate: 'SMS optionnels : sous le seuil d’alerte',
        action: 'Voir les envois',
        href: () => '/admin/notifications',
    },
    debts: {
        icon: <Scale size={20} />,
        title: (l) => plural(Number(l.count), 'créance', 'créances'),
        explain: (l) => <>{amount(l.amount)} que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains.</>,
        upToDate: 'Créances : aucune',
        action: 'Voir les créances',
        href: () => '/admin/finance#creances',
    },
};

export const NOTHING_URGENT = 'Rien d’urgent aujourd’hui.';
export const NO_RIGHTS_YET = 'Vous n’avez encore aucun droit : demandez-les au super-administrateur.';

/**
 * Finition 3b (E-29) — « À faire aujourd'hui », en tête de l'accueil de l'administration : une carte par ligne à traiter
 * (nombre, phrase simple, un bouton vers la bonne liste), les lignes à jour regroupées, « Rien d'urgent aujourd'hui. »
 * quand tout est à jour. Le serveur ne rend que les lignes que l'administrateur peut traiter ; un compteur illisible dit
 * « Compteur indisponible », jamais 0.
 */
export function TodoToday({ hasAnyRight, isSuperadmin, signal = 0 }: { hasAnyRight: boolean; isSuperadmin: boolean; signal?: number }) {
    const id = useId();
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [reply, setReply] = useState<TodoReply | null>(null);
    const [retrying, setRetrying] = useState(false);

    const load = useCallback(async () => {
        const r = await getJson<TodoReply>('/api/admin/todo', 'à faire aujourd’hui');
        setRetrying(false);
        if (!r.ok || !Array.isArray(r.data.lines)) {
            setPhase('error');
            return;
        }
        setReply(r.data);
        setPhase('ready');
    }, []);

    useEffect(() => {
        void load();
    }, [load, signal]);

    useEffect(() => {
        const timer = window.setInterval(() => { void load(); }, 60_000);
        return () => window.clearInterval(timer);
    }, [load]);

    const allowed = reply?.allowed ?? [];
    const lines = reply?.lines ?? [];
    const upToDate = reply?.upToDate ?? [];

    return (
        <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3">
            <h2 id={`${id}-titre`} className="text-lg font-bold tracking-tight text-fg">À faire aujourd’hui</h2>
            {phase === 'loading' && (
                <div role="status" aria-busy="true" aria-label="Chargement de ce qui est à faire aujourd’hui" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map((i) => <span key={i} className="h-36 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" />)}
                </div>
            )}
            {phase === 'error' && (
                <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-danger-border bg-danger-bg p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-danger-fg">Liste indisponible pour le moment. Les files restent ouvertes depuis le menu.</p>
                    <Button variant="secondary" size="sm" isLoading={retrying} onClick={() => { setRetrying(true); void load(); }}>Réessayer</Button>
                </div>
            )}
            {phase === 'ready' && allowed.length === 0 && (
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-fg">{hasAnyRight ? 'Aucune des files à traiter ne vous est ouverte.' : NO_RIGHTS_YET}</p>
                    <LinkButton href="/admin/mes-droits" variant="secondary" size="sm" rightIcon={<ArrowRight size={16} />}>Voir mes droits</LinkButton>
                </div>
            )}
            {phase === 'ready' && allowed.length > 0 && (
                <>
                    {lines.length === 0 && (
                        <p className="flex items-center gap-2 rounded-2xl border border-success-border bg-success-bg p-4 text-base font-semibold text-success-fg">
                            <CheckCircle2 size={20} className="flex-shrink-0" aria-hidden="true" />
                            {NOTHING_URGENT}
                        </p>
                    )}
                    {lines.length > 0 && (
                        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {lines.map((l) => {
                                const s = TODO_SPECS[l.key];
                                const unavailable = l.unavailable === true;
                                return (
                                    <li key={l.key} className={cn('flex flex-col gap-3 rounded-2xl border bg-surface p-4 sm:p-5', unavailable ? 'border-border' : 'border-warning-border')}>
                                        <div className="flex items-start gap-3">
                                            <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', unavailable ? 'bg-surface-sunken text-fg-muted' : 'bg-warning-bg text-warning-fg')} aria-hidden="true">{s.icon}</span>
                                            <p className="min-w-0 break-words text-base font-semibold leading-snug text-fg tabular-nums">
                                                {unavailable ? s.upToDate.split(' :')[0] : s.title(l)}
                                            </p>
                                        </div>
                                        <p className="text-sm leading-relaxed text-fg-muted">{unavailable ? 'Compteur indisponible pour le moment.' : s.explain(l)}</p>
                                        <LinkButton href={s.href(l)} variant={unavailable ? 'secondary' : 'primary'} rightIcon={<ArrowRight size={16} />} className="mt-auto w-full sm:w-auto">
                                            {s.action}
                                        </LinkButton>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {upToDate.length > 0 && (
                        <ul className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4" aria-label="À jour">
                            {upToDate.map((k) => (
                                <li key={k} className="flex items-center gap-2 text-sm text-fg">
                                    <CheckCircle2 size={18} className="flex-shrink-0 text-success-fg" aria-hidden="true" />
                                    {TODO_SPECS[k].upToDate}
                                </li>
                            ))}
                        </ul>
                    )}
                    {reply?.partial && !isSuperadmin && (
                        <p className="text-sm text-fg-muted">
                            Vous ne voyez que ce que vos droits vous permettent de traiter.{' '}
                            <Link href="/admin/mes-droits" className="inline-flex min-h-11 items-center font-semibold text-brand-fg underline-offset-2 hover:underline">Voir mes droits</Link>
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
