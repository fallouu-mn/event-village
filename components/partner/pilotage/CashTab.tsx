'use client';

import React, { useState } from 'react';
import { Banknote, Check, Copy, KeyRound, Scale, Store, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { DefinitionRow, PilotageSection } from './PilotageBlocks';
import { shiftStatusLabel, type CashShift, type PilotageCash } from './types';

function differenceText(value: number | null): string {
    if (value === null) return 'Caisse ouverte';
    if (value === 0) return 'Aucun écart';
    return value > 0 ? `+${formatFcfa(value)}` : formatFcfa(value);
}

function differenceTone(value: number | null): string {
    if (value === null || value === 0) return 'text-fg';
    return 'text-danger-fg';
}

const SHIFT_COLUMNS: DataColumn<CashShift>[] = [
    { key: 'controller', header: 'Contrôleur', hideOnCard: true, render: (s) => <span className="font-semibold">{s.controller_name || 'Compte sans nom'}</span> },
    { key: 'state', header: 'État', render: (s) => shiftStatusLabel(s.status) },
    { key: 'opened', header: 'Ouverte le', render: (s) => (s.opened_at ? <time dateTime={s.opened_at}>{formatDateTime(s.opened_at)}</time> : 'Date inconnue') },
    { key: 'float', header: 'Fonds de caisse', align: 'right', render: (s) => formatFcfa(s.opening_float) },
    { key: 'collected', header: 'Encaissé', align: 'right', render: (s) => formatFcfa(s.cash_collected) },
    { key: 'declared', header: 'Déclaré', align: 'right', render: (s) => (s.declared === null ? 'Pas encore' : formatFcfa(s.declared)) },
    {
        key: 'difference',
        header: 'Écart',
        align: 'right',
        render: (s) => (
            <span className={`font-semibold ${differenceTone(s.difference)}`}>
                {differenceText(s.difference)}
                {s.justification && <span className="mt-0.5 block font-normal text-fg-muted">{s.justification}</span>}
            </span>
        ),
    },
];

/**
 * Onglet Caisse (contrat I) : caisses ouvertes et clôturées, espèces par contrôleur, écarts (pilotage_cash),
 * et PIN régisseur (présence et date seulement ; régénération par la route du lot 4, toujours confirmée,
 * seconde confirmation si des caisses sont ouvertes).
 */
export function CashTab({ eventId, signal }: { eventId: string; signal: number }) {
    const toast = useToast();
    const { data, error, loading, refreshing, reload } = useServerData<PilotageCash>(`/api/partner/events/${eventId}/pilotage/cash`, signal);
    const [pinStep, setPinStep] = useState<{ step: 'confirm' } | { step: 'open_shifts'; count: number } | null>(null);
    const [generating, setGenerating] = useState(false);
    const [pin, setPin] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const requestPin = async (confirmOpenShifts: boolean): Promise<void> => {
        setGenerating(true);
        try {
            const res = await sendJson<{ pin?: string }>(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', { confirm: true, confirmOpenShifts });
            setPinStep(null);
            if (!res.pin) {
                toast.error('Le code n’a pas été renvoyé par le serveur. Réessayez.');
                return;
            }
            setPin(res.pin);
            setCopied(false);
            toast.success('Nouveau code PIN régisseur généré.');
            await reload();
        } catch (err) {
            if (err instanceof ApiError && err.status === 409 && err.code === 'OPEN_SHIFTS') {
                setPinStep({ step: 'open_shifts', count: Number(err.body?.open_shifts) || 0 });
                return;
            }
            setPinStep(null);
            toast.error(errorMessage(err, 'Génération du code PIN impossible.'));
        } finally {
            setGenerating(false);
        }
    };

    const copyPin = async (): Promise<void> => {
        if (!pin) return;
        try {
            await navigator.clipboard.writeText(pin);
            setCopied(true);
            toast.success('Code PIN copié.');
        } catch (err) {
            console.error('[caisse] copie du PIN impossible', err);
            toast.error('Copie impossible : notez le code affiché.');
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4" role="status" aria-busy="true" aria-label="Chargement de la caisse">
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
            </div>
        );
    }
    if (error || !data) {
        return <ErrorState title="Caisse indisponible" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />;
    }

    const { totals } = data;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Espèces encaissées" value={formatFcfa(totals.cash_collected)} hint="Au scan et au guichet, toutes caisses" tone="warning" icon={<Banknote size={18} />} />
                <KpiCard label="Caisses ouvertes" value={formatInteger(totals.open)} hint="Contrôleurs en service" tone="info" icon={<Unlock size={18} />} />
                <KpiCard label="Caisses clôturées" value={formatInteger(totals.closed)} hint="Clôtures co-signées ou en litige" tone="neutral" icon={<Store size={18} />} />
                <KpiCard
                    label="Écart cumulé"
                    value={differenceText(totals.closed > 0 ? totals.difference : 0)}
                    hint="Déclaré moins attendu, caisses clôturées"
                    tone={totals.difference === 0 ? 'success' : 'danger'}
                    icon={<Scale size={18} />}
                />
            </div>

            <PilotageSection
                title="Code PIN régisseur"
                description="Le PIN co-signe la clôture des caisses de vos contrôleurs. Il n’est affiché qu’une fois, à sa génération."
            >
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <p className="flex items-start gap-3 text-sm text-fg">
                        <KeyRound size={20} className="mt-0.5 flex-shrink-0 text-brand-fg" aria-hidden="true" />
                        {data.pin.hasPin ? (
                            <span>
                                Un code est en place
                                {data.pin.updatedAt && (
                                    <>
                                        {' depuis le '}
                                        <time dateTime={data.pin.updatedAt}>{formatDateTime(data.pin.updatedAt)}</time>
                                    </>
                                )}
                                .
                            </span>
                        ) : (
                            <span>Aucun code PIN : vos contrôleurs ne peuvent pas encore clôturer leur caisse.</span>
                        )}
                    </p>
                    <Button variant={data.pin.hasPin ? 'secondary' : 'primary'} leftIcon={<KeyRound size={18} />} onClick={() => setPinStep({ step: 'confirm' })}>
                        {data.pin.hasPin ? 'Régénérer le code PIN' : 'Générer le code PIN'}
                    </Button>
                </div>
            </PilotageSection>

            <PilotageSection title="Espèces par contrôleur">
                {data.by_controller.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">Aucune caisse ouverte pour cet événement.</p>
                ) : (
                    <dl className="rounded-2xl border border-border bg-surface px-4 py-1">
                        {data.by_controller.map((c) => (
                            <DefinitionRow
                                key={c.controller_id}
                                label={`${c.name || 'Compte sans nom'} · ${formatInteger(c.shifts)} caisse(s)${c.open_shifts > 0 ? ', dont une ouverte' : ''}`}
                                value={formatFcfa(c.cash_collected)}
                            />
                        ))}
                    </dl>
                )}
            </PilotageSection>

            <PilotageSection title="Sessions de caisse" description="Le Z détaillé de chaque caisse figure dans l’onglet Clôture.">
                <DataList
                    items={data.shifts}
                    columns={SHIFT_COLUMNS}
                    getKey={(s) => s.id}
                    caption="Sessions de caisse de l’événement"
                    cardTitle={(s) => SHIFT_COLUMNS[0].render(s)}
                    empty={<EmptyState title="Aucune caisse" description="Les caisses ouvertes par vos contrôleurs s’affichent ici en direct." className="my-0" />}
                />
            </PilotageSection>

            <ConfirmDialog
                isOpen={pinStep !== null}
                onClose={() => {
                    if (!generating) setPinStep(null);
                }}
                onConfirm={() => void requestPin(pinStep?.step === 'open_shifts')}
                title={pinStep?.step === 'open_shifts' ? 'Des caisses sont ouvertes' : 'Générer un nouveau code PIN ?'}
                message={
                    pinStep?.step === 'open_shifts'
                        ? `${formatInteger(pinStep.count)} caisse(s) sont ouvertes : leurs contrôleurs devront utiliser le nouveau code pour clôturer.`
                        : 'L’ancien code cesse aussitôt d’être valable. Le nouveau code ne sera affiché qu’une seule fois.'
                }
                confirmLabel={pinStep?.step === 'open_shifts' ? 'Générer quand même' : 'Générer le code'}
                variant="warning"
                isLoading={generating}
            />

            <Modal
                isOpen={pin !== null}
                onClose={() => setPin(null)}
                title="Nouveau code PIN régisseur"
                subtitle="Notez-le maintenant : il ne sera plus affiché."
                maxWidth="sm"
                footer={
                    <Button variant="primary" onClick={() => setPin(null)} className="flex-1 sm:flex-none">
                        J’ai noté le code
                    </Button>
                }
            >
                <div className="flex flex-col items-center gap-4 py-2">
                    <p className="rounded-2xl border border-border bg-surface-sunken px-6 py-4 font-mono text-3xl font-bold tracking-widest text-fg tabular-nums" aria-label={pin ? `Code PIN : ${pin.split('').join(' ')}` : undefined}>
                        {pin}
                    </p>
                    <Button variant="secondary" leftIcon={copied ? <Check size={18} /> : <Copy size={18} />} onClick={() => void copyPin()}>
                        {copied ? 'Code copié' : 'Copier le code'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
