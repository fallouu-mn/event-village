'use client';

/**
 * Lot 11b (écrans du client) : détail d'une réservation de table pour le client.
 *  - État en mots et ton de la route (jamais un code), jour, heure, personnes, table, zone, demande particulière,
 *    échéance avec compte à rebours (acompte à payer, réponse attendue, table gardée jusqu'à…), montants figés
 *    (acompte, frais, total, payé, remboursé), remboursements (en cours ou versés), établissement (photo, adresse,
 *    lien vers la fiche).
 *  - Rappel : si l'adresse porte `?rappel=1` ou si `canSayComing`, carte mise en avant « Votre table vous attend à
 *    20 h · gardée jusqu'à 20 h 30 » avec « J'arrive » (POST …/coming, l'établissement est prévenu) et « Annuler ».
 *  - « Payer l'acompte » seulement si `canPay` (fenêtre de paiement existante, cible TABLE_RESERVATION).
 *  - « Annuler » seulement si `canCancel` : aperçu de la base d'abord, puis confirmation (useTableCancel).
 */
import React, { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellRing, CalendarDays, Check, Clock, MapPin, MessageSquareText, Undo2, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { eventImageSrc } from '@/lib/events/event-image';
import { dayText, fcfaText, guestsText, hmText } from '@/lib/tables/views';
import type { ClientTableReservationDetail } from '@/lib/tables/queries';
import { ReservationDeadline } from './ReservationDeadline';
import { TablePayButton } from './TablePayButton';
import { badgeVariantOf, capitalize, instantDay, instantText, reservationLine } from './format';
import { useTableCancel } from './useTableCancel';
import { useNow } from './useNow';

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
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-label={title}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
                {title}
            </h2>
            {children}
        </section>
    );
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-3 text-base text-foreground">
            <span className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
            <span className="min-w-0 break-words">{children}</span>
        </li>
    );
}

const CANCELLED = new Set(['ANNULEE_CLIENT', 'ANNULEE_ETABLISSEMENT', 'ANNULEE_EV', 'REFUSEE', 'SANS_REPONSE', 'EXPIREE']);

export function ReservationDetail({ reservation: r, reminder }: { reservation: ClientTableReservationDetail; reminder: boolean }) {
    const router = useRouter();
    const toast = useToast();
    const [refreshing, startRefresh] = useTransition();
    const [coming, setComing] = useState(false);
    const cancel = useTableCancel(r.id);
    const now = useNow(r.state === 'EN_ATTENTE_PAIEMENT' ? 1000 : 30_000);
    const reminderRef = useRef<HTMLElement | null>(null);

    const place = [r.venueAddress, r.venueCity].filter(Boolean).join(', ');
    // Jusqu'à la fin de la garde de la table (canSayComing), ou avant l'heure si l'on vient du rappel
    const showReminder = r.state === 'CONFIRMEE' && (r.canSayComing || ((reminder || r.clientComing) && r.upcoming));
    const ended = CANCELLED.has(r.state);

    // Lien du rappel : la carte « Votre table vous attend » est mise en vue et annoncée
    useEffect(() => {
        if (reminder && showReminder) reminderRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sayComing = async () => {
        setComing(true);
        try {
            const body = await sendJson<{ message?: string }>(`/api/tables/reservations/${r.id}/coming`, 'POST');
            toast.success(typeof body.message === 'string' && body.message ? body.message : 'C’est noté : l’établissement sait que vous arrivez.');
            startRefresh(() => router.refresh());
        } catch (err) {
            toast.error(errorMessage(err, 'Confirmation impossible pour le moment. Réessayez.'));
        } finally {
            setComing(false);
        }
    };

    return (
        <div className="space-y-6" aria-busy={refreshing}>
            <PageHeader
                back={{ href: '/tables/reservations', label: 'Mes réservations' }}
                eyebrow={<Badge variant={badgeVariantOf(r.tone)}>{r.stateLabel}</Badge>}
                title={r.venueName}
                description={reservationLine(r.date, r.time, r.guests)}
            />

            {showReminder && (
                <section
                    ref={reminderRef}
                    tabIndex={-1}
                    aria-labelledby="rappel-titre"
                    className="space-y-4 rounded-2xl border-2 border-primary bg-primary-soft p-5 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                            {r.clientComing ? <Check size={22} strokeWidth={3} /> : <BellRing size={22} />}
                        </span>
                        <div className="min-w-0 space-y-1">
                            <h2 id="rappel-titre" className="text-xl font-extrabold leading-tight text-primary-text">
                                {`Votre table vous attend à ${hmText(r.time)}`}
                            </h2>
                            <p className="text-base text-foreground-strong">
                                <span className="tabular-nums">{`Gardée jusqu’à ${hmText(r.heldUntil)}`}</span>
                                {r.tableNumber && <span>{` · table ${r.tableNumber}`}</span>}
                                {` · ${guestsText(r.guests)}`}
                            </p>
                            {r.clientComing && <p className="text-base font-semibold text-success-text">Vous avez confirmé votre venue. À tout à l’heure !</p>}
                        </div>
                    </div>
                    {!r.clientComing && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {r.canSayComing && (
                                <Button variant="gradient" size="lg" fullWidth isLoading={coming} leftIcon={<Check size={20} aria-hidden="true" />} onClick={sayComing}>
                                    J’arrive
                                </Button>
                            )}
                            {r.canCancel && (
                                <Button variant="secondary" size="lg" fullWidth isLoading={cancel.starting} onClick={cancel.start}>
                                    Annuler
                                </Button>
                            )}
                        </div>
                    )}
                    {!r.clientComing && r.canSayComing && (
                        <p className="text-sm text-foreground">Un toucher sur « J’arrive » prévient l’établissement : il vous garde la table.</p>
                    )}
                </section>
            )}

            {r.live && r.upcoming && !showReminder && <ReservationDeadline r={r} now={now} size="md" />}

            {r.state === 'EN_ATTENTE_PAIEMENT' && !r.canPay && (now === null || !r.holdExpiresAt || Date.parse(r.holdExpiresAt) > now) && (
                <StatusBanner tone="neutral" title="Paiement momentanément indisponible">
                    Le paiement des tables est fermé pour le moment. Réessayez plus tard ou annulez la réservation.
                </StatusBanner>
            )}
            {r.state === 'EN_ATTENTE_ACCEPTATION' && (
                <StatusBanner tone="info" title="En attente de la réponse de l’établissement">
                    Vous recevez un avis dès qu’il accepte ou refuse. S’il refuse ou ne répond pas à temps, rien ne vous est demandé et l’acompte payé vous est rendu.
                </StatusBanner>
            )}
            {ended && (
                <StatusBanner tone={r.tone === 'danger' ? 'danger' : 'neutral'} title={r.stateLabel}>
                    {r.cancelReason ? `Motif : ${r.cancelReason}` : r.refunds.length > 0 ? 'Les remboursements dus sont indiqués plus bas.' : 'Cette réservation ne tient plus de table.'}
                </StatusBanner>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                    <Block title="Votre table" icon={<CalendarDays size={20} />}>
                        <ul className="space-y-3">
                            <Fact icon={<CalendarDays size={18} />}>{capitalize(dayText(r.date))}</Fact>
                            <Fact icon={<Clock size={18} />}>
                                <span className="tabular-nums">{`${hmText(r.time)} à ${hmText(r.endTime)}`}</span>
                                {r.live && r.upcoming && <span className="block text-sm text-muted-foreground">{`Table gardée jusqu’à ${hmText(r.heldUntil)} en cas de retard`}</span>}
                            </Fact>
                            <Fact icon={<Users size={18} />}>
                                {guestsText(r.guests)}
                                {(r.tableNumber || r.zoneName) && (
                                    <span className="block text-sm text-muted-foreground">
                                        {[r.tableNumber ? `Table ${r.tableNumber}` : null, r.zoneName].filter(Boolean).join(' · ')}
                                    </span>
                                )}
                            </Fact>
                            {r.notes && (
                                <Fact icon={<MessageSquareText size={18} />}>
                                    <span className="block text-sm font-semibold text-foreground-strong">Votre demande</span>
                                    <span className="whitespace-pre-line">{r.notes}</span>
                                </Fact>
                            )}
                        </ul>
                    </Block>

                    <Block title="L’établissement" icon={<MapPin size={20} />}>
                        <div className="flex gap-4">
                            <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-32">
                                <Image src={eventImageSrc(r.venuePhoto)} alt="" fill sizes="128px" className="object-cover" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <p className="break-words text-base font-semibold text-foreground-strong">{r.venueName}</p>
                                {place && <p className="break-words text-sm text-muted-foreground">{place}</p>}
                                <Link
                                    href={`/tables/${r.venueId}`}
                                    className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    Voir la fiche de l’établissement
                                </Link>
                            </div>
                        </div>
                    </Block>

                    {(r.depositAmount > 0 || r.paidAmount > 0) && (
                        <Block title="Montants" icon={<Wallet size={20} />}>
                            <dl className="divide-y divide-border">
                                <Row label={`Acompte (${guestsText(r.guests)})`} value={fcfaText(r.depositAmount)} />
                                <Row label="Frais de service" value={fcfaText(r.serviceFee)} />
                                <Row label="Total" value={fcfaText(r.totalAmount)} strong />
                                <Row label="Déjà payé" value={fcfaText(r.paidAmount)} />
                                {r.refundedAmount > 0 && <Row label="Remboursé" value={fcfaText(r.refundedAmount)} />}
                            </dl>
                        </Block>
                    )}

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

                    <p className="text-sm text-muted-foreground">
                        {`Réservation faite le ${instantDay(r.createdAt) || '—'}${r.holdExpiresAt && r.state === 'EN_ATTENTE_PAIEMENT' ? ` · acompte à payer avant le ${instantText(r.holdExpiresAt)}` : ''}.`}
                    </p>
                </div>

                {(r.canPay || r.canCancel) && (
                    <aside className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20 lg:self-start" aria-label="Actions">
                        {r.canPay && (
                            <>
                                <TablePayButton reservationId={r.id} venueName={r.venueName} depositAmount={r.depositAmount} />
                                <p className="text-sm text-muted-foreground">{`Total à payer, frais compris : ${fcfaText(r.totalAmount)}. Paiement par Wave ou Orange Money.`}</p>
                            </>
                        )}
                        {r.canCancel && (
                            <Button variant="ghost" fullWidth onClick={cancel.start} isLoading={cancel.starting} className="text-danger-text">
                                Annuler la réservation
                            </Button>
                        )}
                        {!r.canPay && r.canCancel && (
                            <LinkButton href={`/tables/${r.venueId}`} variant="secondary" fullWidth>Réserver une autre heure</LinkButton>
                        )}
                    </aside>
                )}
            </div>

            {cancel.dialog}
        </div>
    );
}
