'use client';

/**
 * Lot 10b (point 4) : détail d'une réservation de salle pour le client.
 *  - État en mots (`stateLabel`, ton `stateTone`), période, salle (photo, adresse, lien vers la fiche), montants lus dans
 *    la réponse (prix, frais, total, payé, remboursé, reste), échéance du solde, heure limite pendant l'attente de
 *    paiement, conditions d'annulation, remboursements (en cours ou versés).
 *  - Paiement seulement si la route le permet (`canPay`) : « Payer l'acompte », « Payer la totalité », « Payer le
 *    solde » → PaymentModal (chargée à la demande, `part` ; le serveur relit le montant sur la réservation).
 *  - Annulation seulement si `canCancel` : aperçu d'abord (GET …/cancel : montant rendu calculé en base), puis
 *    confirmation qui montre ce montant AVANT de confirmer, puis POST …/cancel, message de la route et rafraîchissement.
 * Lot Carte B3 : l'adresse exacte n'est donnée par la route qu'une fois la réservation confirmée (acompte payé ou tout
 * payé) ; avant, la ville seule et « L’adresse exacte vous sera donnée… » ; avec l'adresse, « Voir l’itinéraire ».
 */
import React, { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlarmClock, CalendarDays, ExternalLink, Lock, MapPin, Navigation, ShieldCheck, Undo2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { eventImageSrc } from '@/lib/events/event-image';
import { dakarDate, dakarTime, fcfaText, periodText } from '@/lib/halls/views';
import type { ClientReservationDetail } from '@/lib/halls/queries';
import { badgeVariantOf, capitalize, unitsText } from './format';

const PaymentModal = dynamic(
    () => import('@/components/payment/PaymentModal').then((m) => ({ default: m.PaymentModal })),
    { ssr: false },
);

type Part = 'ACOMPTE' | 'SOLDE' | 'INTEGRAL';

const PART_LABEL: Record<Part, string> = {
    ACOMPTE: 'Payer l’acompte',
    SOLDE: 'Payer le solde',
    INTEGRAL: 'Payer la totalité',
};

interface CancelPreview {
    refundAmount: number;
    refundPercent: number;
    paidAmount: number;
    keptAmount: number;
    message: string;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className={strong ? 'text-base font-semibold text-foreground-strong' : 'text-sm text-foreground'}>{label}</dt>
            <dd className={strong ? 'text-lg font-bold tabular-nums text-foreground-strong' : 'text-sm font-semibold tabular-nums text-foreground-strong'}>{value}</dd>
        </div>
    );
}

function Block({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm" aria-label={title}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
                {title}
            </h2>
            {children}
        </section>
    );
}

/** Lien « Voir l’itinéraire » : recherche de l'adresse exacte (adresse et ville) dans Google Maps. */
function directionsSearchUrl(address: string, city: string | null): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, city].filter(Boolean).join(', '))}`;
}

/**
 * Lot Carte B3 : lieu de la salle vu par le client. Adresse exacte (lisible, avec l'itinéraire) seulement quand la route la
 * donne (réservation confirmée) ; sinon la ville seule, et pour une réservation encore en cours une phrase qui dit quand
 * l'adresse sera donnée. Annulée, expirée ou refusée : ni adresse ni phrase.
 */
function PlaceAddress({ address, city, pending }: { address: string | null; city: string | null; pending: boolean }) {
    if (address) {
        return (
            <div className="flex items-start gap-2 border-t border-border pt-3">
                <MapPin size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-2">
                    <p className="break-words text-base font-semibold text-foreground-strong">
                        {address}
                        {city && <span className="block text-sm font-normal text-muted-foreground">{city}</span>}
                    </p>
                    <LinkButton
                        href={directionsSearchUrl(address, city)}
                        external
                        variant="secondary"
                        leftIcon={<Navigation size={18} aria-hidden="true" />}
                        rightIcon={<ExternalLink size={16} aria-hidden="true" />}
                    >
                        Voir l’itinéraire
                        <span className="sr-only"> (nouvel onglet)</span>
                    </LinkButton>
                </div>
            </div>
        );
    }
    if (!city && !pending) return null;
    return (
        <div className="space-y-2 border-t border-border pt-3">
            {city && (
                <p className="flex items-start gap-2 break-words text-base text-foreground">
                    <MapPin size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0">{city}</span>
                </p>
            )}
            {pending && (
                <p className="flex items-start gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-sm leading-relaxed text-foreground-strong">
                    <Lock size={16} className="mt-0.5 flex-shrink-0 text-primary-text" aria-hidden="true" />
                    <span className="min-w-0">L’adresse exacte vous sera donnée dès que votre réservation sera confirmée.</span>
                </p>
            )}
        </div>
    );
}

export function ReservationDetailView({ reservation: r }: { reservation: ClientReservationDetail }) {
    const router = useRouter();
    const toast = useToast();
    const [refreshing, startRefresh] = useTransition();
    const [payPart, setPayPart] = useState<Part | null>(null);
    const [preview, setPreview] = useState<CancelPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const period = capitalize(periodText({ start_date: r.startDate, end_date: r.endDate, start_time: r.startTime, end_time: r.endTime }));
    const parts = (r.canPay?.parts ?? []).filter((p): p is Part => p === 'ACOMPTE' || p === 'SOLDE' || p === 'INTEGRAL');
    const amountOf = (p: Part): number | undefined => r.canPay?.amounts?.[p];
    const waiting = r.state === 'EN_ATTENTE_PAIEMENT';
    // Réservation encore en cours (pas annulée, délai de paiement pas dépassé) : l'adresse viendra à la confirmation
    const addressPending = r.live && !r.cancelledAt && !(waiting && !r.canPay);

    const openCancel = async () => {
        setPreviewLoading(true);
        try {
            const body = await fetchJson<{ preview?: CancelPreview }>(`/api/halls/reservations/${r.id}/cancel`);
            if (body.preview) setPreview(body.preview);
            else toast.error('Le montant du remboursement n’a pas pu être calculé. Réessayez.');
        } catch (err) {
            toast.error(errorMessage(err, 'Le montant du remboursement n’a pas pu être calculé. Réessayez.'));
        } finally {
            setPreviewLoading(false);
        }
    };

    const confirmCancel = async () => {
        setCancelling(true);
        try {
            const body = await sendJson<{ message?: string }>(`/api/halls/reservations/${r.id}/cancel`, 'POST');
            setPreview(null);
            toast.success(typeof body.message === 'string' && body.message ? body.message : 'Réservation annulée.');
            startRefresh(() => router.refresh());
        } catch (err) {
            toast.error(errorMessage(err, 'Annulation impossible pour le moment. Réessayez.'));
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="space-y-6" aria-busy={refreshing}>
            <PageHeader
                back={{ href: '/halls/reservations', label: 'Mes réservations' }}
                eyebrow={<Badge variant={badgeVariantOf(r.stateTone)}>{r.stateLabel}</Badge>}
                title={r.hallName}
                description={period}
            />

            {waiting && r.holdExpiresAt && r.canPay && (
                <StatusBanner tone="warning" title={`Payez avant ${dakarTime(r.holdExpiresAt)} pour garder la date`}>
                    Sans paiement à cette heure-là, la date est libérée pour d’autres clients.
                </StatusBanner>
            )}
            {waiting && !r.canPay && (
                <StatusBanner tone="neutral" title="Le délai pour payer est passé">
                    La date va être libérée. Vous pouvez faire une nouvelle réservation depuis la fiche de la salle.
                </StatusBanner>
            )}
            {r.balanceDueAt && r.remainingAmount > 0 && (
                <StatusBanner tone="info" title={`Solde de ${fcfaText(r.remainingAmount)} à payer avant le ${dakarDate(r.balanceDueAt)} à ${dakarTime(r.balanceDueAt)}`}>
                    Sans paiement du solde à temps, la réservation est annulée selon les conditions d’annulation ci-dessous.
                </StatusBanner>
            )}
            {r.cancelledAt && (
                <StatusBanner tone="neutral" title={`Réservation annulée le ${dakarDate(r.cancelledAt)}`}>
                    {r.cancelReason ? `Motif : ${r.cancelReason}` : 'Les remboursements dus sont indiqués plus bas.'}
                </StatusBanner>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                    <Block title="La salle" icon={<MapPin size={20} />}>
                        <div className="flex gap-4">
                            <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-32">
                                <Image src={eventImageSrc(r.hallPhoto)} alt="" fill sizes="128px" className="object-cover" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <p className="break-words text-base font-semibold text-foreground-strong">{r.hallName}</p>
                                <Link
                                    href={`/halls/${r.hallId}`}
                                    className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    Voir la fiche de la salle
                                </Link>
                            </div>
                        </div>
                        <PlaceAddress address={r.hallAddress} city={r.hallCity} pending={addressPending} />
                        <p className="flex items-start gap-2 border-t border-border pt-3 text-base text-foreground">
                            <CalendarDays size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span>
                                {period}
                                <span className="block text-sm text-muted-foreground">{`Location ${r.mode === 'HEURE' ? 'à l’heure' : 'à la journée'} : ${unitsText(r.mode, r.units)}`}</span>
                            </span>
                        </p>
                    </Block>

                    <Block title="Montants" icon={<Wallet size={20} />}>
                        <dl className="divide-y divide-border">
                            <Row label={`Prix (${unitsText(r.mode, r.units)})`} value={fcfaText(r.priceAmount)} />
                            <Row label="Frais de service" value={fcfaText(r.serviceFeeAmount)} />
                            <Row label="Total" value={fcfaText(r.totalAmount)} strong />
                            <Row label="Déjà payé" value={fcfaText(r.paidAmount)} />
                            {r.refundedAmount > 0 && <Row label="Remboursé" value={fcfaText(r.refundedAmount)} />}
                            {r.live && <Row label="Reste à payer" value={fcfaText(r.remainingAmount)} strong />}
                        </dl>
                        {r.live && !r.fullPaymentRequired && r.paidAmount === 0 && r.depositAmount < r.totalAmount && (
                            <p className="text-sm text-muted-foreground">{`Acompte pour garder la date : ${fcfaText(r.depositAmount)}.`}</p>
                        )}
                    </Block>

                    {r.refunds.length > 0 && (
                        <Block title="Remboursements" icon={<Undo2 size={20} />}>
                            <ul className="divide-y divide-border">
                                {r.refunds.map((x, i) => (
                                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                                        <span className="text-base font-semibold tabular-nums text-foreground-strong">{fcfaText(x.amount)}</span>
                                        <Badge variant={x.paid ? 'success' : 'info'}>{x.label}</Badge>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-sm text-muted-foreground">Les remboursements sont versés sur le compte Wave ou Orange Money qui a payé.</p>
                        </Block>
                    )}

                    <Block title="Conditions d’annulation" icon={<ShieldCheck size={20} />}>
                        <p className="whitespace-pre-line text-base leading-relaxed text-foreground">{r.cancellation}</p>
                    </Block>

                    <p className="text-sm text-muted-foreground">{`Réservation faite le ${dakarDate(r.createdAt)}.`}</p>
                </div>

                {(parts.length > 0 || r.canCancel) && (
                    <aside className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20 lg:self-start" aria-label="Actions">
                        {parts.map((p, i) => {
                            const amount = amountOf(p);
                            const label = amount !== undefined ? `${PART_LABEL[p]} (${fcfaText(amount)})` : PART_LABEL[p];
                            return (
                                <Button key={p} variant={i === 0 ? 'gradient' : 'secondary'} size={i === 0 ? 'lg' : 'md'} fullWidth onClick={() => setPayPart(p)}>
                                    {label}
                                </Button>
                            );
                        })}
                        {parts.length > 0 && <p className="text-sm text-muted-foreground">Paiement par Wave ou Orange Money.</p>}
                        {r.canCancel && (
                            <Button variant="ghost" fullWidth onClick={openCancel} isLoading={previewLoading} className="text-danger-text">
                                Annuler la réservation
                            </Button>
                        )}
                    </aside>
                )}
            </div>

            {payPart && (
                <PaymentModal
                    isOpen={payPart !== null}
                    onClose={() => setPayPart(null)}
                    title={`${PART_LABEL[payPart]} — ${r.hallName}`}
                    targetType="HALL_RESERVATION"
                    targetId={r.id}
                    part={payPart}
                    amountFormatted={fcfaText(amountOf(payPart) ?? 0)}
                />
            )}

            <ConfirmDialog
                isOpen={preview !== null}
                onClose={() => {
                    if (!cancelling) setPreview(null);
                }}
                onConfirm={confirmCancel}
                title="Annuler la réservation ?"
                variant="danger"
                confirmLabel="Confirmer l’annulation"
                cancelLabel="Garder ma réservation"
                isLoading={cancelling}
                maxWidth="md"
            >
                {preview && (
                    <div className="space-y-4">
                        <p className="text-base leading-relaxed text-foreground-strong">{preview.message}</p>
                        {preview.paidAmount > 0 && (
                            <dl className="divide-y divide-border rounded-xl border border-border px-4">
                                <Row label="Déjà payé" value={fcfaText(preview.paidAmount)} />
                                <Row label={`Rendu (${preview.refundPercent} %)`} value={fcfaText(preview.refundAmount)} strong />
                                <Row label="Gardé selon les conditions" value={fcfaText(preview.keptAmount)} />
                            </dl>
                        )}
                        <p className="flex items-start gap-2 text-sm text-muted-foreground">
                            <AlarmClock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span>L’annulation est définitive : la date est libérée pour d’autres clients.</span>
                        </p>
                    </div>
                )}
            </ConfirmDialog>
        </div>
    );
}
