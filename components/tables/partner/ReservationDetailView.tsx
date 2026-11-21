'use client';

/**
 * Lot 11b : détail d'une réservation de table pour l'établissement (GET /api/partner/tables/reservations/[id] :
 * seulement une réservation d'un de ses établissements). C'est la page des liens des avis de l'établissement : pensée
 * d'abord pour le téléphone. En tête, l'essentiel (heure, jour, personnes, table, état) et les actions permises par la
 * route (`actions`) : accepter ou refuser avec le compte à rebours de la réponse, client arrivé, client absent, paiement
 * sur place, annuler (useReservationActions). Puis le client (prénom, téléphone cliquable si la route le donne, demande
 * particulière), les montants figés tels que la route les donne (aucun calcul ici) et les repères (code, dates).
 * Ouverte même service fermé.
 */
import React from 'react';
import {
    Banknote, CalendarDays, Check, CheckCircle2, Clock, Hand, Hash, Phone, ShieldCheck, StickyNote, User, UserCheck, UserX, Users, Wallet, X, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useServerData } from '@/components/partner/useServerData';
import { formatDateTime } from '@/lib/format';
import { dayText, fcfaText, guestsText, hmText, instantHm } from '@/lib/tables/views';
import { ResponseCountdown } from './PendingRequests';
import { TableReservationSkeleton } from './TablesSkeletons';
import { useReservationActions } from './useReservationActions';
import { capitalize, tableFreed, telHref, toneBanner, toneVariant, type PartnerReservationDetail } from './venue-api';

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border py-3 last:border-b-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={strong ? 'ml-auto text-right text-base font-bold text-foreground-strong tabular-nums' : 'ml-auto text-right text-base font-semibold text-foreground-strong tabular-nums'}>
                {children}
            </dd>
        </div>
    );
}

function Panel({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section aria-labelledby={id} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 id={id} className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground-strong">
                <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
                {title}
            </h2>
            {children}
        </section>
    );
}

export function TableReservationDetailView({ reservationId }: { reservationId: string }) {
    const url = `/api/partner/tables/reservations/${encodeURIComponent(reservationId)}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ reservation: PartnerReservationDetail }>(url);
    const actions = useReservationActions({ onDone: () => void reload() });

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <TableReservationSkeleton />
                <span className="sr-only">Chargement de la réservation…</span>
            </div>
        );
    }

    const r = data?.reservation;
    if (!r) {
        return (
            <div className="mx-auto w-full max-w-2xl">
                <PageHeader back={{ href: '/partner/tables', label: 'Mes établissements' }} title="Réservation" />
                <ErrorState
                    title="Réservation indisponible"
                    description={error ?? 'Cette réservation n’a pas pu être chargée.'}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            </div>
        );
    }

    const back = `/partner/tables/${encodeURIComponent(r.venueId)}?date=${r.date}`;
    const can = r.actions;
    const busy = actions.busyId === r.id;
    const anyBusy = actions.busyId !== null;
    const freed = tableFreed(r.state);
    const titleId = 'reservation-titre';
    const hasActions = can.accept || can.refuse || can.arrived || can.absent || can.onsite || can.cancel;

    return (
        <div className="mx-auto w-full max-w-2xl pb-10">
            <PageHeader
                back={{ href: back, label: 'Planning de l’établissement' }}
                eyebrow={<Badge variant={toneVariant(r.tone)}>{r.stateLabel}</Badge>}
                title={<span id={titleId} className="tabular-nums">{`${guestsText(r.guests)} à ${hmText(r.time)}`}</span>}
                description={`${capitalize(dayText(r.date, true))} · ${r.venueName}`}
            />

            <div className="flex flex-col gap-4">
                {/* L'essentiel, lisible d'un coup d'œil pendant le service */}
                <section aria-label="L’essentiel" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted px-3 py-2.5">
                            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock size={16} aria-hidden="true" />Heure</dt>
                            <dd className="text-xl font-bold text-foreground-strong tabular-nums">{hmText(r.time)}</dd>
                            <dd className="text-sm text-muted-foreground tabular-nums">{`jusqu’à ${hmText(r.endTime)}`}</dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted px-3 py-2.5">
                            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users size={16} aria-hidden="true" />Personnes</dt>
                            <dd className="text-xl font-bold text-foreground-strong tabular-nums">{r.guests}</dd>
                        </div>
                        <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted px-3 py-2.5">
                            <dt className="text-sm text-muted-foreground">Table</dt>
                            <dd className="break-words text-lg font-bold text-foreground-strong">
                                {r.tableNumber ? `Table ${r.tableNumber}` : 'Table à attribuer'}
                                {r.zoneName && <span className="font-semibold text-muted-foreground">{` · ${r.zoneName}`}</span>}
                                {freed && r.tableNumber && <span className="ml-2 align-middle"><Badge variant="neutral">Table libérée</Badge></span>}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {r.clientComing && r.state === 'CONFIRMEE' && <Badge variant="info" icon={<Hand size={12} aria-hidden="true" />}>A confirmé sa venue</Badge>}
                        {r.state === 'CONFIRMEE' && <Badge variant="neutral" icon={<ShieldCheck size={12} aria-hidden="true" />}>{`Table gardée jusqu’à ${hmText(r.heldUntil)}`}</Badge>}
                        {r.state === 'ARRIVEE' && r.arrivedAt && <Badge variant="success" icon={<UserCheck size={12} aria-hidden="true" />}>{`Arrivé à ${instantHm(r.arrivedAt)}`}</Badge>}
                    </div>

                    {r.responseDueAt && <ResponseCountdown dueAt={r.responseDueAt} skewMs={0} className="mt-3" />}
                    {r.state === 'EN_ATTENTE_PAIEMENT' && r.holdExpiresAt && (
                        <p className="mt-3 text-sm leading-relaxed text-warning-text">
                            {`Le client paie l’acompte : table tenue jusqu’à ${instantHm(r.holdExpiresAt)}. Sans paiement à temps, elle redevient libre.`}
                        </p>
                    )}
                </section>

                {r.cancelReason && freed && (
                    <StatusBanner tone={toneBanner(r.tone)} title={r.stateLabel}>
                        {`Motif : ${r.cancelReason}`}
                    </StatusBanner>
                )}

                {hasActions && (
                    <section aria-labelledby="reservation-actions" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                        <h2 id="reservation-actions" className="mb-3 text-lg font-bold text-foreground-strong">
                            {can.accept ? 'Votre réponse' : 'Pendant le service'}
                        </h2>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {can.accept && (
                                <Button size="lg" leftIcon={<Check size={20} />} isLoading={busy && actions.busyAction === 'ACCEPTER'} disabled={anyBusy} onClick={() => actions.run('ACCEPTER', r)} aria-describedby={titleId}>
                                    Accepter
                                </Button>
                            )}
                            {can.refuse && (
                                <Button size="lg" variant="secondary" leftIcon={<X size={20} />} className="text-danger-text" disabled={anyBusy} onClick={() => actions.run('REFUSER', r)} aria-describedby={titleId}>
                                    Refuser
                                </Button>
                            )}
                            {can.arrived && (
                                <Button size="lg" leftIcon={<UserCheck size={20} />} isLoading={busy && actions.busyAction === 'ARRIVEE'} disabled={anyBusy} onClick={() => actions.run('ARRIVEE', r)} aria-describedby={titleId}>
                                    Client arrivé
                                </Button>
                            )}
                            {can.absent && (
                                <Button size="lg" variant="secondary" leftIcon={<UserX size={20} />} disabled={anyBusy} onClick={() => actions.run('ABSENT', r)} aria-describedby={titleId}>
                                    Client absent
                                </Button>
                            )}
                            {can.onsite && (
                                <Button variant="secondary" leftIcon={<Banknote size={18} />} disabled={anyBusy} onClick={() => actions.run('PAIEMENT_SUR_PLACE', r)} aria-describedby={titleId}>
                                    Paiement sur place
                                </Button>
                            )}
                            {can.cancel && !can.accept && (
                                <Button variant="ghost" leftIcon={<XCircle size={18} />} className="text-danger-text hover:bg-danger-soft" disabled={anyBusy} onClick={() => actions.run('ANNULER', r)} aria-describedby={titleId}>
                                    Annuler la réservation
                                </Button>
                            )}
                        </div>
                        {can.cancel && !can.accept && (
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                Si vous annulez, le client récupère en entier ce qu’il a payé et reçoit votre motif.
                            </p>
                        )}
                    </section>
                )}

                <Panel id="reservation-client" title="Client" icon={<User size={20} />}>
                    <dl>
                        <Row label="Prénom">{r.client.name}</Row>
                    </dl>
                    {r.client.phone ? (
                        <LinkButton href={telHref(r.client.phone)} variant="secondary" fullWidth leftIcon={<Phone size={18} />} className="mt-2">
                            <span className="tabular-nums">{`Appeler le ${r.client.phone}`}</span>
                        </LinkButton>
                    ) : (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Le téléphone du client s’affiche quand la réservation tient la table (demande, confirmée ou client arrivé).
                        </p>
                    )}
                    {r.notes && (
                        <div className="mt-3 rounded-xl bg-muted px-4 py-3">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground-strong">
                                <StickyNote size={16} aria-hidden="true" />
                                Demande particulière
                            </p>
                            <p className="mt-1 whitespace-pre-line break-words text-base leading-relaxed text-foreground">{r.notes}</p>
                        </div>
                    )}
                </Panel>

                <Panel id="reservation-montants" title="Montants" icon={<Wallet size={20} />}>
                    {r.totalAmount > 0 || r.paidAmount > 0 ? (
                        <dl>
                            <Row label="Acompte">{fcfaText(r.depositAmount)}</Row>
                            <Row label="Frais de service, payés par le client">{fcfaText(r.serviceFee)}</Row>
                            <Row label="Total à payer en ligne" strong>{fcfaText(r.totalAmount)}</Row>
                            <Row label="Déjà payé en ligne">{fcfaText(r.paidAmount)}</Row>
                            {r.refundedAmount > 0 && <Row label="Rendu au client">{fcfaText(r.refundedAmount)}</Row>}
                            {r.onsiteAmount !== null && r.onsiteAmount > 0 && <Row label="Payé sur place">{fcfaText(r.onsiteAmount)}</Row>}
                        </dl>
                    ) : (
                        <dl>
                            <Row label="Acompte">Réservation gratuite</Row>
                            {r.onsiteAmount !== null && r.onsiteAmount > 0 && <Row label="Payé sur place">{fcfaText(r.onsiteAmount)}</Row>}
                        </dl>
                    )}
                    <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        Votre recette sur l’acompte apparaît dans « Recettes ». Le paiement sur place n’y figure pas : il est réglé directement à l’établissement.
                    </p>
                </Panel>

                <Panel id="reservation-reperes" title="Repères" icon={<CalendarDays size={20} />}>
                    <dl>
                        <Row label="Code de la réservation">
                            <span className="inline-flex items-center gap-1"><Hash size={14} aria-hidden="true" className="text-muted-foreground" />{r.shortCode}</span>
                        </Row>
                        <Row label="Jour">{capitalize(dayText(r.date, true))}</Row>
                        <Row label="Réservée le">{formatDateTime(r.createdAt)}</Row>
                        {r.arrivedAt && <Row label="Arrivée notée à">{instantHm(r.arrivedAt)}</Row>}
                    </dl>
                </Panel>

                <div className="flex flex-wrap gap-2">
                    <LinkButton href={back} variant="secondary" leftIcon={<CalendarDays size={18} />}>Planning du jour</LinkButton>
                    <LinkButton href="/partner/tables/recettes" variant="ghost" leftIcon={<Wallet size={18} />}>Recettes</LinkButton>
                </div>
            </div>

            {actions.dialogs}
        </div>
    );
}
