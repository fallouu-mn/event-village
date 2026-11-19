'use client';

/**
 * Lot 10b (point 3) : détail d'une réservation d'une salle, pour sa propriétaire
 * (GET /api/partner/halls/reservations/[id] : seulement une réservation d'une de ses salles).
 * État côté salle (stateLabel), période, client (nom et téléphone seulement si la route les donne : acompte payé),
 * montants lus tels quels dans la réponse (total, payé, remboursé, reste, échéance du solde), note du client, règle
 * d'annulation figée à la réservation. « Annuler la réservation » seulement si la route le permet (`canCancel`) :
 * motif obligatoire (5 caractères au moins, envoyé au client), le client est remboursé en entier ;
 * POST /api/partner/halls/reservations/[id]/status { action: 'CANCEL', reason }. Le message de la route est affiché.
 */
import React, { useRef, useState } from 'react';
import { CalendarDays, Phone, StickyNote, User, Wallet, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { dakarDate, dakarTime, fcfaText } from '@/lib/halls/views';
import { ReservationSkeleton } from './HallSkeletons';
import { periodOf, toneVariant, type PartnerReservationDetail } from './hall-api';

/** Longueur minimale du motif d'annulation par la salle (route hall_reservation_cancel). */
const CANCEL_REASON_MIN = 5;

function durationText(r: PartnerReservationDetail): string {
    if (r.mode === 'HEURE') return r.units === 1 ? '1 heure' : `${r.units} heures`;
    return r.units === 1 ? '1 jour' : `${r.units} jours`;
}

/** Texte de la règle écrit pour le client (« si vous annulez ») relu du point de vue de la salle. */
function partnerCancellationText(text: string): string {
    return text.replace(/si vous annulez/g, 'si le client annule');
}

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-b-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={strong ? 'text-right text-base font-bold text-foreground-strong tabular-nums' : 'text-right text-base font-semibold text-foreground-strong tabular-nums'}>
                {children}
            </dd>
        </div>
    );
}

function Panel({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section aria-labelledby={id} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 id={id} className="mb-2 flex items-center gap-2 text-lg font-bold text-foreground-strong">
                <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
                {title}
            </h2>
            {children}
        </section>
    );
}

export function ReservationDetailView({ reservationId }: { reservationId: string }) {
    const toast = useToast();
    const url = `/api/partner/halls/reservations/${encodeURIComponent(reservationId)}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ reservation: PartnerReservationDetail }>(url);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | undefined>(undefined);
    const [done, setDone] = useState<string | null>(null);
    const busy = useRef(false);

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <ReservationSkeleton />
                <span className="sr-only">Chargement de la réservation…</span>
            </div>
        );
    }

    const r = data?.reservation;
    if (!r) {
        return (
            <div className="mx-auto w-full max-w-3xl">
                <PageHeader back={{ href: '/partner/halls', label: 'Mes salles' }} title="Réservation" />
                <ErrorState
                    title="Réservation indisponible"
                    description={error ?? 'Cette réservation n’a pas pu être chargée.'}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            </div>
        );
    }

    const back = `/partner/halls/${encodeURIComponent(r.hallId)}#calendrier`;
    const period = periodOf(r);

    const cancel = async (reason: string) => {
        if (busy.current) return;
        busy.current = true;
        setCancelling(true);
        setCancelError(undefined);
        try {
            const body = await sendJson<{ success: boolean; message?: string }>(`${url}/status`, 'POST', { action: 'CANCEL', reason });
            const said = typeof body.message === 'string' && body.message ? body.message : 'Réservation annulée.';
            setDone(said);
            setCancelOpen(false);
            toast.success('Réservation annulée.');
            void reload();
        } catch (err) {
            setCancelError(errorMessage(err, 'Annulation impossible pour le moment. Réessayez.'));
        } finally {
            busy.current = false;
            setCancelling(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-3xl pb-10">
            <PageHeader
                back={{ href: back, label: 'Calendrier de la salle' }}
                eyebrow={<Badge variant={toneVariant(r.stateTone)}>{r.stateLabel}</Badge>}
                title={r.hallName}
                description={period}
            />

            {done && (
                <StatusBanner tone="success" title={done} className="mb-4">
                    Le client est prévenu et le motif lui a été envoyé.
                </StatusBanner>
            )}

            {r.cancelledAt && (
                <StatusBanner tone="neutral" title={`Réservation annulée le ${dakarDate(r.cancelledAt)}`} className="mb-4">
                    {r.cancelReason ? `Motif : ${r.cancelReason}` : undefined}
                </StatusBanner>
            )}

            {r.holdExpiresAt && (
                <StatusBanner tone="warning" title={`Date tenue jusqu’à ${dakarTime(r.holdExpiresAt)} le temps du paiement`} className="mb-4">
                    Si le client ne paie pas l’acompte d’ici là, la date redevient libre. Ses coordonnées s’affichent une fois l’acompte payé.
                </StatusBanner>
            )}

            <div className="flex flex-col gap-4">
                <Panel id="resa-periode" title="Période" icon={<CalendarDays size={20} />}>
                    <dl>
                        <Row label="Dates">{period}</Row>
                        <Row label="Durée">{durationText(r)}</Row>
                        <Row label="Réservée le">{dakarDate(r.createdAt)}</Row>
                    </dl>
                </Panel>

                <Panel id="resa-client" title="Client" icon={<User size={20} />}>
                    <dl>
                        <Row label="Nom">{r.clientName ?? 'Affiché une fois l’acompte payé'}</Row>
                        <Row label="Téléphone">
                            {r.clientPhone ? (
                                <a href={`tel:${r.clientPhone.replace(/\s+/g, '')}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary-text underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <Phone size={16} aria-hidden="true" />
                                    {r.clientPhone}
                                </a>
                            ) : 'Affiché une fois l’acompte payé'}
                        </Row>
                    </dl>
                    {r.notes && (
                        <div className="mt-3 rounded-xl bg-muted px-4 py-3">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground-strong">
                                <StickyNote size={16} aria-hidden="true" />
                                Note du client
                            </p>
                            <p className="mt-1 whitespace-pre-line break-words text-base leading-relaxed text-foreground">{r.notes}</p>
                        </div>
                    )}
                </Panel>

                <Panel id="resa-montants" title="Montants" icon={<Wallet size={20} />}>
                    <dl>
                        <Row label="Prix de la salle">{fcfaText(r.priceAmount)}</Row>
                        <Row label="Frais de service d’Event Village">{fcfaText(r.serviceFeeAmount)}</Row>
                        <Row label="Total de la réservation" strong>{fcfaText(r.totalAmount)}</Row>
                        <Row label="Déjà payé">{fcfaText(r.paidAmount)}</Row>
                        {r.refundedAmount > 0 && <Row label="Remboursé au client">{fcfaText(r.refundedAmount)}</Row>}
                        {r.live && <Row label="Reste à payer">{fcfaText(r.remainingAmount)}</Row>}
                        {r.balanceDueAt && <Row label="Échéance du solde">{dakarDate(r.balanceDueAt)}</Row>}
                        {r.live && r.fullPaymentRequired && <Row label="Paiement">En une fois, à la réservation</Row>}
                    </dl>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Votre recette sur cette réservation est indiquée dans « Recettes », avec sa date de disponibilité.
                    </p>
                </Panel>

                {r.cancellation && (
                    <Panel id="resa-regle" title="Règle d’annulation de cette réservation" icon={<XCircle size={20} />}>
                        <p className="text-base leading-relaxed text-foreground">{partnerCancellationText(r.cancellation)}</p>
                    </Panel>
                )}

                {r.canCancel && (
                    <section aria-labelledby="resa-annuler" className="rounded-xl border border-danger-border bg-danger-soft p-4 sm:p-5">
                        <h2 id="resa-annuler" className="text-lg font-bold text-danger-text">Annuler la réservation</h2>
                        <p className="mt-1 text-sm leading-relaxed text-foreground-strong">
                            Si vous annulez, le client est remboursé en entier de ce qu’il a payé, et la date redevient libre. Le motif lui est envoyé.
                        </p>
                        <Button
                            variant="danger"
                            className="mt-3"
                            onClick={() => { setCancelError(undefined); setCancelOpen(true); }}
                            disabled={cancelling}
                        >
                            Annuler la réservation
                        </Button>
                    </section>
                )}

                <div>
                    <LinkButton href="/partner/halls/recettes" variant="ghost">Voir les recettes des salles</LinkButton>
                </div>
            </div>

            <ReasonDialog
                isOpen={cancelOpen}
                onClose={() => { if (!busy.current) setCancelOpen(false); }}
                onConfirm={(reason) => void cancel(reason)}
                title="Annuler la réservation ?"
                description="Le client est remboursé en entier de ce qu’il a payé. Cette action ne peut pas être défaite."
                label="Motif de l’annulation"
                hint={`Au moins ${CANCEL_REASON_MIN} caractères. Il est envoyé au client.`}
                placeholder="Par exemple : la salle est indisponible pour travaux à cette date."
                confirmLabel="Annuler la réservation"
                cancelLabel="Garder la réservation"
                variant="danger"
                isLoading={cancelling}
                error={cancelError}
                minLength={CANCEL_REASON_MIN}
            />
        </div>
    );
}
