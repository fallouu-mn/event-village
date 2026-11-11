'use client';

import React, { useState } from 'react';
import { BadgeCheck, Banknote, CheckCircle2, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { PilotageSection } from './PilotageBlocks';

/**
 * Lot 9 bis (R20, B22, contrat 4.1 et 5.4) — espèces des ventes au guichet d'un événement annulé. Event Village ne
 * les rembourse jamais (§76 du cahier des charges) : l'organisateur rend l'argent lui-même, puis coche « Remboursé ».
 *  - Liste et totaux lus sur GET /api/partner/events/[id]/cash-refunds (calculés par event_cash_refunds) ; aucun
 *    total n'est recalculé ici.
 *  - La case « Remboursé » n'est proposée que si le serveur le permet (`can_mark` : la propriétaire, compte actif) ;
 *    un admin lit la liste sans case. Chaque marquage passe par une confirmation, il est définitif et journalisé
 *    (POST …/cash-refunds/[paymentId], audit CASH_REFUND_MARKED dans la même transaction). Un second marquage de la
 *    même vente rend la marque existante (ALREADY_MARKED), sans rien écrire.
 */

interface CashRefundItem {
    payment_id: string;
    reference: string;
    ticket_count: number;
    amount: number;
    phone_masked: string | null;
    sold_at: string;
    seller: string | null;
    refunded_at: string | null;
    refunded_by: string | null;
}

interface CashRefundsReply {
    items: CashRefundItem[];
    count: number;
    total: number;
    refunded_count: number;
    refunded_total: number;
    can_mark: boolean;
}

interface MarkReply {
    ok?: boolean;
    code?: string;
}

export interface CashRefundsListProps {
    eventId: string;
    /** Signal temps réel de la page : relit la liste. */
    signal?: number;
}

function salesLabel(n: number): string {
    return n > 1 ? `${formatInteger(n)} ventes` : `${formatInteger(n)} vente`;
}

function ticketsLabel(n: number): string {
    return n > 1 ? `${formatInteger(n)} billets` : `${formatInteger(n)} billet`;
}

/** « Remboursé le … par … » d'une vente déjà marquée. */
function refundedLine(item: CashRefundItem): React.ReactNode {
    if (!item.refunded_at) return null;
    return (
        <span className="inline-flex items-start gap-1.5 text-sm font-medium text-success-fg">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
                Remboursé le <time dateTime={item.refunded_at}>{formatDateTime(item.refunded_at)}</time>
                {item.refunded_by ? ` par ${item.refunded_by}` : ''}
            </span>
        </span>
    );
}

export function CashRefundsList({ eventId, signal = 0 }: CashRefundsListProps) {
    const toast = useToast();
    const { data, error, loading, refreshing, reload } = useServerData<CashRefundsReply>(`/api/partner/events/${eventId}/cash-refunds`, signal);
    const [pending, setPending] = useState<CashRefundItem | null>(null);
    const [marking, setMarking] = useState(false);
    const [markError, setMarkError] = useState<string | null>(null);

    const confirmMark = async (): Promise<void> => {
        if (!pending || marking) return;
        setMarking(true);
        setMarkError(null);
        try {
            const reply = await sendJson<MarkReply>(`/api/partner/events/${eventId}/cash-refunds/${pending.payment_id}`, 'POST', {});
            toast.success(reply.code === 'ALREADY_MARKED'
                ? `La vente ${pending.reference} était déjà marquée remboursée.`
                : `Vente ${pending.reference} marquée remboursée.`);
            setPending(null);
            await reload();
        } catch (err) {
            setMarkError(errorMessage(err, 'Le marquage n’a pas pu être enregistré. Réessayez.'));
        } finally {
            setMarking(false);
        }
    };

    const stateCell = (item: CashRefundItem): React.ReactNode => {
        if (item.refunded_at) return refundedLine(item);
        if (!data?.can_mark) return <span className="text-sm font-medium text-warning-fg">À rembourser par l’organisateur</span>;
        return (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-fg">
                <input
                    type="checkbox"
                    checked={false}
                    onChange={() => {
                        setMarkError(null);
                        setPending(item);
                    }}
                    aria-label={`Remboursé : vente ${item.reference}, ${formatFcfa(item.amount)}`}
                    className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-border-strong accent-brand"
                />
                Remboursé
            </label>
        );
    };

    return (
        <PilotageSection
            title="Espèces à rembourser par l’organisateur"
            description="Ventes au guichet de cet événement annulé. Event Village ne les rembourse jamais : rendez les espèces à chaque acheteur, puis cochez « Remboursé »."
            action={
                <IconButton aria-label="Actualiser la liste des espèces à rembourser" onClick={() => void reload()} isLoading={refreshing} variant="secondary">
                    <RefreshCw size={18} />
                </IconButton>
            }
        >
            {loading && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                </div>
            )}

            {!loading && error && (
                <ErrorState title="Liste des espèces indisponible" description={error} onRetry={() => void reload()} isRetrying={refreshing} className="my-0" />
            )}

            {!loading && !error && data && (
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <KpiCard
                            label="Ventes au guichet"
                            value={formatFcfa(data.total)}
                            hint={`${salesLabel(data.count)} à rendre en espèces`}
                            tone="warning"
                            icon={<Banknote size={18} />}
                        />
                        <KpiCard
                            label="Déjà remboursé"
                            value={formatFcfa(data.refunded_total)}
                            hint={`${salesLabel(data.refunded_count)} cochée${data.refunded_count > 1 ? 's' : ''} « Remboursé » sur ${formatInteger(data.count)}`}
                            tone="success"
                            icon={<BadgeCheck size={18} />}
                        />
                    </div>
                    {!data.can_mark && data.count > 0 && (
                        <StatusBanner tone="info" title="Lecture seule">
                            Seul l’organisateur de l’événement coche « Remboursé », après avoir rendu les espèces.
                        </StatusBanner>
                    )}
                    {data.items.length === 0 ? (
                        <EmptyState
                            title="Aucune vente au guichet"
                            description="Aucun billet n’a été vendu au guichet pour cet événement : il n’y a pas d’espèces à rendre."
                            icon={<Banknote size={28} />}
                            className="my-0"
                        />
                    ) : (
                        // Une seule liste, en cartes à toute largeur (une case par vente, jamais en double dans le DOM)
                        <ul aria-label="Ventes au guichet à rembourser en espèces" className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                            {data.items.map((r) => (
                                <li key={r.payment_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base font-semibold text-fg tabular-nums">
                                            <span>Vente {r.reference}</span>
                                            <span>{formatFcfa(r.amount)}</span>
                                        </p>
                                        <p className="text-sm text-fg-muted tabular-nums">
                                            {ticketsLabel(r.ticket_count)} · {r.phone_masked ?? 'Numéro non saisi'}
                                        </p>
                                        <p className="text-sm text-fg-muted">
                                            Vendue le <time dateTime={r.sold_at}>{formatDateTime(r.sold_at)}</time>
                                            {r.seller ? ` par ${r.seller}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">{stateCell(r)}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={pending !== null}
                onClose={() => {
                    if (!marking) setPending(null);
                }}
                onConfirm={() => void confirmMark()}
                title="Marquer cette vente remboursée ?"
                message={pending
                    ? `Confirmez-vous avoir rendu ${formatFcfa(pending.amount)} en espèces pour la vente ${pending.reference} ? Ce marquage est définitif.`
                    : undefined}
                confirmLabel="Oui, les espèces sont rendues"
                cancelLabel="Pas encore"
                variant="warning"
                isLoading={marking}
            >
                {pending && (
                    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-2xl border border-border bg-surface-sunken p-4 text-sm text-fg tabular-nums">
                        <dt className="font-semibold">Vente</dt>
                        <dd>{pending.reference}</dd>
                        <dt className="font-semibold">Billets</dt>
                        <dd>{ticketsLabel(pending.ticket_count)}</dd>
                        <dt className="font-semibold">Acheteur</dt>
                        <dd>{pending.phone_masked ?? 'Numéro non saisi'}</dd>
                    </dl>
                )}
                {markError && (
                    <StatusBanner tone="danger" title="Marquage non enregistré" announce="alert">
                        {markError}
                    </StatusBanner>
                )}
            </ConfirmDialog>
        </PilotageSection>
    );
}

export default CashRefundsList;
