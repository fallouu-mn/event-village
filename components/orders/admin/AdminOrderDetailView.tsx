'use client';

/**
 * Lot 12d — fiche d'une commande pour l'administration (GET /api/admin/orders/[id]) : état, frise des étapes (heure,
 * auteur en mots, note), contenu, montants servis par la base (aucun calcul ici), paiements, remboursements, signalements
 * (réponse au client), absence du client (décision : AbsenceDecisionPanel), « Annuler et rembourser » (CancelOrderAction).
 * Nom, numéro et adresse du client seulement s'ils sont servis (droit « Consulter les comptes ») ; commande absente ou
 * inaccessible : « Cet élément n'est plus disponible ». Refus du serveur affichés tels quels.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CircleDot, Clock3, CreditCard, Lock, MapPin, MessageSquareWarning, Phone, Receipt, RotateCcw, Store, User, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/Field';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { cn } from '@/components/ui/cn';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { paymentOperatorLabel, paymentStatusLabel } from '@/lib/payments/payment-labels';
import {
    ABSENCE_DECISION_LABELS, ABSENCE_PHASE_LABELS, ACTOR_LABELS, ADMIN_MODE_LABELS, CASHOUT_STATUS_LABELS, ISSUE_REASON_LABELS,
    PAYMENT_PART_LABELS, REFUND_STATUS_LABELS, adminStateTone, label, stepLabel, type AdminOrderDetail,
} from './order-admin-labels';
import { AbsenceDecisionPanel, CancelOrderAction } from './AdminOrderMoneyActions';

function Section({ id, title, icon, children, className }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <Card className={cn('p-4 sm:p-5', className)}>
            <section aria-labelledby={id} className="space-y-3">
                <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-foreground-strong">
                    <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
                    {title}
                </h2>
                {children}
            </section>
        </Card>
    );
}

function Row({ term, children, strong = false }: { term: string; children: React.ReactNode; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-sm text-muted-foreground">{term}</dt>
            <dd className={cn('text-right text-sm tabular-nums', strong ? 'font-bold text-foreground-strong' : 'text-foreground')}>{children}</dd>
        </div>
    );
}

/** Réponse de l'équipe à un signalement ouvert (5 à 300 caractères, montrée au client). */
function IssueReply({ issueId, onDone }: { issueId: string; onDone: (message: string) => Promise<void> }) {
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const send = async () => {
        setBusy(true);
        setError(null);
        try {
            const r = await sendJson<{ message?: string }>(`/api/admin/orders/issues/${issueId}`, 'POST', { note: note.trim() });
            await onDone(r.message ?? 'Signalement traité.');
        } catch (err) {
            setError(errorMessage(err, 'Signalement non traité. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="space-y-2">
            <Textarea
                label="Réponse au client"
                hint="Le client la lit dans sa commande (5 caractères au moins). Un remboursement reste une action à part."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                showCount
                rows={3}
                disabled={busy}
            />
            {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
            <Button variant="primary" onClick={() => void send()} disabled={note.trim().length < 5 || busy} isLoading={busy}>
                Envoyer la réponse et clore
            </Button>
        </div>
    );
}

export function AdminOrderDetailView({ orderId }: { orderId: string }) {
    const [order, setOrder] = useState<AdminOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [missing, setMissing] = useState(false);
    const [done, setDone] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const body = await fetchJson<{ order: AdminOrderDetail }>(`/api/admin/orders/${orderId}`);
            setOrder(body.order);
            setError(null);
            setMissing(false);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setMissing(true);
            } else {
                setError(errorMessage(err, 'Impossible de charger la commande. Réessayez.'));
            }
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        void load();
    }, [load]);

    const after = async (message: string) => {
        setDone(message);
        await load();
        window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };

    if (missing) return <UnavailableItem actionLabel="Retour aux commandes" actionHref="/admin/orders" />;
    if (loading && !order) {
        return (
            <div className="space-y-4" aria-busy="true" aria-label="Chargement de la commande">
                <Skeleton className="h-16 w-2/3 rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
            </div>
        );
    }
    if (error && !order) return <ErrorState description={error} onRetry={() => void load()} isRetrying={loading} />;
    if (!order) return null;

    const a = order.amounts;
    const openIssues = (order.issues ?? []).filter((i) => i.status === 'OUVERT');
    const timeline = order.timeline ?? [];

    return (
        <div className="space-y-6">
            <PageHeader
                back={{ href: '/admin/orders', label: 'Retour aux commandes' }}
                eyebrow={<Badge variant={adminStateTone(order.state)}>{order.stateLabel}</Badge>}
                title={<span className="break-all">Commande {order.order_number}</span>}
                description={(
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1"><Store size={14} aria-hidden="true" />{order.venue.name}</span>
                        {order.partner_name && order.partner_name !== order.venue.name && <span>{order.partner_name}</span>}
                        <span>{label(ADMIN_MODE_LABELS, order.mode)}{order.zone_name ? ` · zone ${order.zone_name}` : ''}{order.onsite_label ? ` · ${order.onsite_label}` : ''}</span>
                        <span>Créée le <time dateTime={order.created_at} className="tabular-nums">{formatDateTime(order.created_at)}</time></span>
                    </span>
                )}
                actions={order.can_cancel ? <CancelOrderAction orderId={order.id} orderNumber={order.order_number} refundable={order.refundable} onDone={after} /> : undefined}
            />

            {done && <StatusBanner tone="success" title="C’est fait">{done}</StatusBanner>}
            {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}

            {order.absence && (
                <StatusBanner tone={order.absence.phase === 'DECIDEE' ? 'neutral' : 'warning'} title={label(ABSENCE_PHASE_LABELS, order.absence.phase, 'Client absent')} icon={<UserX size={20} aria-hidden="true" />}>
                    Client signalé absent le <time dateTime={order.absence.reported_at} className="tabular-nums">{formatDateTime(order.absence.reported_at)}</time>
                    {order.absence.phase === 'ATTENTE' && order.absence.wait_until ? <> ; le livreur attend jusqu’au <time dateTime={order.absence.wait_until} className="tabular-nums">{formatDateTime(order.absence.wait_until)}</time>.</> : '.'}
                    {order.absence.decision ? ` Décision : ${label(ABSENCE_DECISION_LABELS, order.absence.decision)}.` : ''}
                </StatusBanner>
            )}

            {order.can_decide_absence && <AbsenceDecisionPanel orderId={order.id} waitUntil={order.absence?.wait_until} onDone={after} />}

            {openIssues.length > 0 && (
                <Section id="signalements-ouverts" title="Signalement à traiter" icon={<MessageSquareWarning size={18} />} className="border-danger-text">
                    <ul className="space-y-4">
                        {openIssues.map((i) => (
                            <li key={i.id} className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="danger">{label(ISSUE_REASON_LABELS, i.reason, 'Problème')}</Badge>
                                    <span className="text-sm text-muted-foreground">le <time dateTime={i.created_at} className="tabular-nums">{formatDateTime(i.created_at)}</time></span>
                                </div>
                                {i.details && <p className="whitespace-pre-line break-words rounded-lg bg-muted px-3 py-2 text-sm text-foreground">« {i.details} »</p>}
                                {order.can_close_issue
                                    ? <IssueReply issueId={i.id} onDone={after} />
                                    : <p className="text-sm text-muted-foreground">Seul un administrateur avec le droit des remboursements peut répondre.</p>}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="space-y-6">
                    <Section id="frise" title="Étapes" icon={<Clock3 size={18} />}>
                        {timeline.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucune étape pour le moment.</p>
                        ) : (
                            <ol className="relative ms-2 border-s-2 border-border">
                                {timeline.map((h, idx) => {
                                    const sameState = h.from !== undefined && h.from === h.to;
                                    const last = idx === timeline.length - 1;
                                    return (
                                        <li key={`${h.at}-${idx}`} className="relative ms-5 pb-5 last:pb-0">
                                            <span className={cn('absolute start-[calc(-1.75rem-1px)] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-card',
                                                last ? 'border-primary-text' : 'border-border')} aria-hidden="true">
                                                {last && <CircleDot size={10} className="text-primary-text" />}
                                            </span>
                                            <p className={cn('break-words font-semibold', last ? 'text-foreground-strong' : 'text-foreground')}>
                                                {sameState && h.note ? h.note : stepLabel(h.to, order.mode)}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                <time dateTime={h.at} className="tabular-nums">{formatDateTime(h.at)}</time> · {label(ACTOR_LABELS, h.by, 'Automatique')}
                                            </p>
                                            {!sameState && h.note && <p className="mt-1 break-words text-sm text-foreground">{h.note}</p>}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                        {order.cancel?.reason && (
                            <p className="break-words rounded-lg bg-muted px-3 py-2 text-sm text-foreground">Motif de fin : {order.cancel.reason}</p>
                        )}
                    </Section>

                    <Section id="contenu" title="Contenu" icon={<Receipt size={18} />}>
                        <ul className="divide-y divide-border">
                            {(order.items ?? []).map((it, i) => (
                                <li key={`${it.product_id}-${i}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                                    <span className="min-w-0 break-words">
                                        <span className="font-semibold tabular-nums">{formatInteger(it.quantity)} ×</span> {it.name}
                                        {(it.options ?? []).length > 0 && <span className="block text-muted-foreground">{(it.options ?? []).map((o) => o.name).join(', ')}</span>}
                                        {it.notes && <span className="block text-muted-foreground">« {it.notes} »</span>}
                                    </span>
                                    <span className="flex-shrink-0 tabular-nums">{formatFcfa(it.total_price)}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section id="paiements" title="Paiements" icon={<CreditCard size={18} />}>
                        {(order.payments ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucun paiement en ligne.</p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {(order.payments ?? []).map((p) => (
                                    <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                                        <span className="min-w-0">
                                            <span className="block font-semibold">{label(PAYMENT_PART_LABELS, p.part, 'Paiement')}</span>
                                            <span className="block text-muted-foreground">
                                                {paymentOperatorLabel(p.operator ?? null, true)} · <time dateTime={p.paid_at ?? p.created_at} className="tabular-nums">{formatDateTime(p.paid_at ?? p.created_at)}</time>
                                                {p.payer_phone ? ` · ${p.payer_phone}` : ''}
                                            </span>
                                        </span>
                                        <span className="text-right">
                                            <span className="block font-semibold tabular-nums">{formatFcfa(p.amount)}</span>
                                            <span className="block text-muted-foreground">{paymentStatusLabel(p.status)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>

                    <Section id="remboursements" title="Remboursements" icon={<RotateCcw size={18} />}>
                        {(order.refunds ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucun remboursement.</p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {(order.refunds ?? []).map((f) => (
                                    <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                                        <span className="min-w-0 break-words">
                                            <span className="block">{f.reason ?? 'Remboursement'}</span>
                                            <span className="block text-muted-foreground"><time dateTime={f.created_at} className="tabular-nums">{formatDateTime(f.created_at)}</time></span>
                                        </span>
                                        <span className="text-right">
                                            <span className="block font-semibold tabular-nums">{formatFcfa(f.amount)}</span>
                                            <span className="block text-muted-foreground">{f.cashout_status ? label(CASHOUT_STATUS_LABELS, f.cashout_status) : label(REFUND_STATUS_LABELS, f.status)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                </div>

                <div className="space-y-6">
                    <Section id="montants" title="Montants" icon={<Receipt size={18} />}>
                        <dl className="divide-y divide-border">
                            <Row term="Articles">{formatFcfa(a.items_amount)}</Row>
                            {a.delivery_fee > 0 && <Row term="Livraison">{formatFcfa(a.delivery_fee)}</Row>}
                            <Row term="Total de la commande" strong>{formatFcfa(a.goods_total)}</Row>
                            <Row term="Payé en ligne">{formatFcfa(a.paid_goods)}</Row>
                            {a.paid_fees > 0 && <Row term="Frais de service payés">{formatFcfa(a.paid_fees)}</Row>}
                            {a.onsite_amount ? <Row term="Reçu sur place">{formatFcfa(a.onsite_amount)}</Row> : null}
                            {a.refunded_amount > 0 && <Row term="Remboursé">{formatFcfa(a.refunded_amount)}</Row>}
                            {a.balance_due > 0 && <Row term="Reste à payer">{formatFcfa(a.balance_due)}</Row>}
                            {order.can_cancel && <Row term="Remboursable en cas d’annulation" strong>{formatFcfa(order.refundable)}</Row>}
                        </dl>
                    </Section>

                    <Section id="client" title="Client" icon={<User size={18} />}>
                        {order.people_visible ? (
                            <dl className="space-y-2 text-sm">
                                <div><dt className="text-muted-foreground">Nom</dt><dd className="break-words text-foreground">{order.client?.name ?? '—'}</dd></div>
                                {order.client?.phone && (
                                    <div><dt className="text-muted-foreground">Numéro du compte</dt><dd className="tabular-nums text-foreground">{order.client.phone}</dd></div>
                                )}
                                {order.admin_contact?.phone && (
                                    <div><dt className="inline-flex items-center gap-1 text-muted-foreground"><Phone size={14} aria-hidden="true" />Numéro pour cette commande</dt><dd className="tabular-nums text-foreground">{order.admin_contact.phone}</dd></div>
                                )}
                                {order.admin_contact?.address && (
                                    <div><dt className="inline-flex items-center gap-1 text-muted-foreground"><MapPin size={14} aria-hidden="true" />Adresse de livraison</dt><dd className="break-words text-foreground">{order.admin_contact.address}</dd></div>
                                )}
                                {order.admin_contact?.notes && (
                                    <div><dt className="text-muted-foreground">Consignes</dt><dd className="break-words text-foreground">{order.admin_contact.notes}</dd></div>
                                )}
                                {order.contact_masked && <p className="text-muted-foreground">Adresse et numéro de livraison effacés après la commande.</p>}
                            </dl>
                        ) : (
                            <div className="space-y-2 text-sm">
                                {order.client?.name && <p className="text-foreground">{order.client.name}</p>}
                                <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                                    <Lock size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
                                    Données personnelles masquées : droit « Consulter les comptes » nécessaire.
                                </p>
                            </div>
                        )}
                        {order.courier_name && <p className="text-sm text-muted-foreground">Livreur : <span className="text-foreground">{order.courier_name}</span></p>}
                    </Section>

                    {(order.issues ?? []).some((i) => i.status !== 'OUVERT') && (
                        <Section id="signalements-traites" title="Signalements traités" icon={<MessageSquareWarning size={18} />}>
                            <ul className="space-y-3">
                                {(order.issues ?? []).filter((i) => i.status !== 'OUVERT').map((i) => (
                                    <li key={i.id} className="space-y-1 text-sm">
                                        <p className="font-semibold">{label(ISSUE_REASON_LABELS, i.reason, 'Problème')} · <time dateTime={i.created_at} className="font-normal tabular-nums text-muted-foreground">{formatDateTime(i.created_at)}</time></p>
                                        {i.details && <p className="break-words text-muted-foreground">« {i.details} »</p>}
                                        {i.close_note && <p className="break-words text-foreground">Réponse : {i.close_note}</p>}
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}
                </div>
            </div>
        </div>
    );
}
