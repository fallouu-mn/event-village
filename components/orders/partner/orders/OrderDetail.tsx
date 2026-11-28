'use client';

/**
 * Lot 12c — fiche d'une commande pour la partenaire (/partner/orders/<id>), pensée aussi pour une tablette au comptoir.
 *  - Seule source : GET /api/partner/orders/[id] (order_view), relu toutes les 5 s tant que la page est visible. Commande
 *    absente, d'une autre partenaire ou jamais transmise : « Cet élément n'est plus disponible » (même page dans tous les
 *    cas, aucun indice sur son existence).
 *  - Étapes servies avec leur heure, lignes servies (suppléments, consignes), montants servis (aucun calcul ici),
 *    heure demandée ou estimée, mode, zone ou table ; coordonnées du client seulement pendant la commande ouverte (la
 *    route les retire ensuite).
 *  - Actions par PATCH /api/partner/orders/[id] selon l'état : accepter (durée de préparation), refuser (motif envoyé
 *    au client), commencer, prête, confier à un livreur actif ou livrer soi-même, partir, remettre (code de 4 chiffres
 *    en grandes cases pour un retrait ou une livraison, 5 essais ; « reste reçu en espèces » quand il reste à payer),
 *    annuler (motif). Le refus du serveur est affiché tel quel.
 */
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Ban, Bike, CalendarClock, Check, CheckCircle2, ChefHat, Clock, KeyRound, MapPin, Phone, ShoppingBag, Utensils, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { TextInput, Select } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Switch } from '@/components/ui/Switch';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { formatDateTime, formatFcfa, formatTime } from '@/lib/format';
import { ORDER_MODE_LABELS, PAYMENT_TYPE_LABELS } from '@/lib/orders/partner-ui';
import { PARTNER_COURIERS_URL } from '@/lib/orders/partner-endpoints';
import { HandoverCodeInput } from './HandoverCodeInput';
import { DeliveryCallActions, OrderAlerts } from './DeliveryFollowUp';
import { STATE_BADGE, scheduledLabel, shortOrderNumber } from './OrderCard';
import { ResponseRing } from './ResponseRing';
import { usePolledJson, useServerClock } from './usePolledJson';
import type { CourierRow, CouriersReply, OrderReply } from './order-types';

const MODE_ICONS: Record<string, typeof Bike> = { LIVRAISON: Bike, RETRAIT: ShoppingBag, SUR_PLACE: Utensils };

type Action = 'ACCEPTER' | 'REFUSER' | 'PREPARER' | 'PRETE' | 'CONFIER' | 'EN_ROUTE' | 'REMETTRE' | 'ANNULER';

const SUCCESS: Record<Action, string> = {
    ACCEPTER: 'Commande acceptée : le client est prévenu.',
    REFUSER: 'Commande refusée : le client est prévenu et remboursé.',
    PREPARER: 'Préparation commencée : le client est prévenu.',
    PRETE: 'Commande prête : le client est prévenu.',
    CONFIER: 'Livraison confiée : le livreur est prévenu.',
    EN_ROUTE: 'Livraison partie : le client a reçu son code.',
    REMETTRE: 'Commande remise.',
    ANNULER: 'Commande annulée : le client est prévenu et remboursé.',
};

const OPEN_STATES = new Set(['RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE']);

function minutesOrNull(raw: string): number | null {
    const t = raw.trim();
    return t === '' ? null : Number(t);
}

export function OrderDetail({ orderId }: { orderId: string }) {
    const toast = useToast();
    const polled = usePolledJson<OrderReply>(`/api/partner/orders/${orderId}`, 5_000);
    const now = useServerClock(polled.skewMs);
    const order = polled.data?.order ?? null;
    const [busy, setBusy] = useState<Action | null>(null);
    const [dialog, setDialog] = useState<'REFUSER' | 'ANNULER' | null>(null);
    const [dialogError, setDialogError] = useState<string | undefined>(undefined);
    const [prepMinutes, setPrepMinutes] = useState('');
    const [tripMinutes, setTripMinutes] = useState('');
    const [courierId, setCourierId] = useState('');
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState<string | null>(null);
    const [codeLocked, setCodeLocked] = useState(false);
    const [balanceReceived, setBalanceReceived] = useState(false);
    const [handedOver, setHandedOver] = useState(false);
    const codeHelpId = useId();

    const needsCouriers = order?.mode === 'LIVRAISON' && ['ACCEPTEE', 'EN_PREPARATION', 'PRETE'].includes(order.state);
    const [couriers, setCouriers] = useState<CourierRow[] | null>(null);
    useEffect(() => {
        if (!needsCouriers || couriers !== null) return;
        fetchJson<CouriersReply>(PARTNER_COURIERS_URL)
            .then((r) => setCouriers(r.couriers.filter((c) => c.status === 'ACTIVE')))
            .catch((err: unknown) => {
                console.error('[commande] livreurs illisibles', err);
                setCouriers([]);
            });
    }, [needsCouriers, couriers]);

    const act = useCallback(async (action: Action, extra: Record<string, unknown> = {}): Promise<boolean> => {
        setBusy(action);
        try {
            await sendJson(`/api/partner/orders/${orderId}`, 'PATCH', { action, ...extra });
            toast.success(SUCCESS[action]);
            if (action === 'REMETTRE') {
                setHandedOver(true);
                setCode('');
                setCodeError(null);
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                    try {
                        navigator.vibrate(120);
                    } catch (err) {
                        console.error('[commande] vibration refusée', err);
                    }
                }
            }
            await polled.reload();
            return true;
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Action impossible pour le moment.';
            if (action === 'REMETTRE') {
                setCodeError(message);
                setCodeLocked(err instanceof ApiError && err.code === 'CODE_LOCKED');
                setCode('');
            } else if (action === 'REFUSER' || action === 'ANNULER') {
                setDialogError(message);
            } else {
                toast.error(message);
            }
            await polled.reload();
            return false;
        } finally {
            setBusy(null);
        }
    }, [orderId, toast, polled]);

    const courierOptions = useMemo(() => (couriers ?? []).map((c) => ({ value: c.userId, label: c.firstName || c.displayName || 'Livreur' })), [couriers]);

    if (polled.error?.status === 404 && !order) {
        return <UnavailableItem actionLabel="Voir mes commandes" actionHref="/partner/orders" />;
    }
    if (!order) {
        return polled.error ? (
            <div className="pb-24 pt-2"><ErrorState title="Commande indisponible" description={errorMessage(polled.error)} onRetry={() => void polled.reload()} /></div>
        ) : (
            <div className="space-y-4 pb-24" role="status" aria-busy="true">
                <span className="sr-only">Chargement de la commande…</span>
                <div className="h-24 rounded-2xl bg-muted motion-safe:animate-pulse" />
                <div className="h-64 rounded-2xl bg-muted motion-safe:animate-pulse" />
            </div>
        );
    }

    const ModeIcon = MODE_ICONS[order.mode] ?? ShoppingBag;
    const later = scheduledLabel(order, now);
    const balance = Number(order.amounts?.balance_due ?? 0);
    const isOpen = OPEN_STATES.has(order.state);
    const handoverReady = (order.mode === 'LIVRAISON' && order.state === 'EN_ROUTE') || (order.mode !== 'LIVRAISON' && order.state === 'PRETE');
    const needsCode = order.mode !== 'SUR_PLACE';

    return (
        <div className="space-y-6 pb-24 lg:pb-12">
            <PageHeader
                back={{ href: '/partner/orders', label: 'Toutes les commandes' }}
                eyebrow={<><Badge variant={STATE_BADGE[order.state] ?? 'neutral'}>{order.stateLabel}</Badge><Badge variant="neutral">{PAYMENT_TYPE_LABELS[order.payment_type] ?? 'Paiement'}</Badge></>}
                title={<span className="tabular-nums">Commande {shortOrderNumber(order.order_number)}</span>}
                description={`${order.venue.name} · reçue le ${formatDateTime(order.created_at)} · n° ${order.order_number}`}
            />

            {polled.error && (
                <StatusBanner tone="warning" title="Mise à jour impossible pour le moment">{errorMessage(polled.error)}</StatusBanner>
            )}

            {/* Lot 12d : absence du client et signalement */}
            <OrderAlerts order={order} />

            {handedOver && order.state === 'REMISE' && (
                <div role="status" className="flex items-center gap-4 rounded-2xl border border-success-border bg-success-soft p-5 text-success-text">
                    <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-success text-on-tone motion-safe:animate-in motion-safe:zoom-in-95" aria-hidden="true">
                        <Check size={32} strokeWidth={3} />
                    </span>
                    <div>
                        <p className="text-lg font-bold">{order.stateLabel} : c’est terminé</p>
                        {order.amounts?.onsite_amount ? (
                            <p className="text-sm">Reste reçu sur place : <span className="tabular-nums">{formatFcfa(order.amounts.onsite_amount)}</span></p>
                        ) : null}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
                <div className="min-w-0 space-y-6">
                    {/* Remise, heure, mode */}
                    <section aria-labelledby="remise-titre" className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                        <h2 id="remise-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                            <ModeIcon size={20} className="text-primary-text" aria-hidden="true" />
                            {ORDER_MODE_LABELS[order.mode] ?? 'Commande'}
                        </h2>
                        {later && (
                            <p className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-lg font-bold text-warning-text">
                                <CalendarClock size={22} aria-hidden="true" />
                                <span className="tabular-nums">{later}</span>
                            </p>
                        )}
                        {order.estimated_at && isOpen && (
                            <p className="flex items-center gap-2 text-base text-foreground">
                                <Clock size={18} className="text-muted-foreground" aria-hidden="true" />
                                Heure prévue : <span className="font-semibold tabular-nums">{formatTime(order.estimated_at)}</span>
                            </p>
                        )}
                        {order.zone_name && <p className="text-base text-foreground">Zone : <span className="font-semibold">{order.zone_name}</span></p>}
                        {order.onsite_label && <p className="text-base text-foreground">Table ou emplacement : <span className="font-semibold">{order.onsite_label}</span></p>}
                        {order.courier?.first_name && <p className="text-base text-foreground">Livreur : <span className="font-semibold">{order.courier.first_name}</span></p>}
                        {order.contact && (order.contact.phone || order.contact.address || order.contact.notes) ? (
                            <div className="space-y-2 rounded-xl bg-muted p-3">
                                {order.contact.address && <p className="flex items-start gap-2 text-base text-foreground-strong"><MapPin size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span className="break-words">{order.contact.address}</span></p>}
                                {order.contact.phone && (
                                    <p className="flex items-center gap-2 text-base">
                                        <Phone size={18} className="flex-shrink-0" aria-hidden="true" />
                                        <a href={`tel:${order.contact.phone}`} className="inline-flex min-h-11 items-center font-semibold tabular-nums text-primary-text underline-offset-2 hover:underline">{order.contact.phone}</a>
                                    </p>
                                )}
                                {order.contact.notes && <p className="break-words text-sm text-muted-foreground">Consignes : {order.contact.notes}</p>}
                            </div>
                        ) : (order.contactHidden || order.contact_masked) ? (
                            <p className="text-sm text-muted-foreground">Coordonnées masquées une fois la commande terminée.</p>
                        ) : null}
                        {order.cancel?.reason && !isOpen && (
                            <p className="text-sm text-muted-foreground">Motif : <span className="text-foreground">{order.cancel.reason}</span></p>
                        )}
                    </section>

                    {/* Articles */}
                    <section aria-labelledby="articles-titre" className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                        <h2 id="articles-titre" className="text-lg font-bold text-foreground-strong">Articles</h2>
                        <ul className="divide-y divide-border">
                            {(order.items ?? []).map((l, i) => (
                                <li key={`${l.product_id}-${i}`} className="flex items-start justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-base text-foreground-strong"><span className="font-bold tabular-nums">{l.quantity} ×</span> {l.name}</p>
                                        {l.options && l.options.length > 0 && (
                                            <p className="text-sm text-muted-foreground">Avec : {l.options.map((o) => o.name).join(', ')}</p>
                                        )}
                                        {l.notes && <p className="break-words text-sm font-semibold text-warning-text">Consigne : {l.notes}</p>}
                                    </div>
                                    <span className="flex-shrink-0 text-base font-semibold tabular-nums text-foreground-strong">{formatFcfa(l.total_price)}</span>
                                </li>
                            ))}
                        </ul>
                        <dl className="space-y-1 border-t border-border pt-3 text-base">
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Articles</dt><dd className="tabular-nums">{formatFcfa(order.amounts.items_amount)}</dd></div>
                            {order.mode === 'LIVRAISON' && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Livraison</dt><dd className="tabular-nums">{formatFcfa(order.amounts.delivery_fee)}</dd></div>}
                            <div className="flex justify-between gap-3 text-lg font-bold text-foreground-strong"><dt>Total</dt><dd className="tabular-nums">{formatFcfa(order.amounts.goods_total)}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payé en ligne</dt><dd className="tabular-nums">{formatFcfa(order.amounts.paid_goods)}</dd></div>
                            {Number(order.amounts.refunded_amount) > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Remboursé au client</dt><dd className="tabular-nums">{formatFcfa(order.amounts.refunded_amount)}</dd></div>}
                            {order.amounts.onsite_amount ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Reçu sur place</dt><dd className="tabular-nums">{formatFcfa(order.amounts.onsite_amount)}</dd></div> : null}
                            {balance > 0 && <div className="flex justify-between gap-3 font-bold text-warning-text"><dt>Reste à encaisser</dt><dd className="tabular-nums">{formatFcfa(balance)}</dd></div>}
                        </dl>
                    </section>

                    {/* Étapes */}
                    <section aria-labelledby="etapes-titre" className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                        <h2 id="etapes-titre" className="text-lg font-bold text-foreground-strong">Étapes</h2>
                        <ol className="space-y-3">
                            {order.timeline.map((s) => (
                                <li key={s.key} className="flex items-center gap-3">
                                    <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full', s.at ? 'bg-success text-on-tone' : 'border-2 border-border text-muted-foreground')} aria-hidden="true">
                                        {s.at ? <Check size={16} strokeWidth={3} /> : null}
                                    </span>
                                    <span className={cn('flex-1 text-base', s.at ? 'font-semibold text-foreground-strong' : 'text-muted-foreground')}>{s.label}</span>
                                    {s.at ? <time dateTime={s.at} className="text-sm tabular-nums text-muted-foreground">{formatTime(s.at)}</time> : <span className="sr-only">pas encore</span>}
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>

                {/* Actions */}
                <aside aria-labelledby="actions-titre" className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
                    <h2 id="actions-titre" className="sr-only">Que faire maintenant</h2>
                    {!isOpen ? (
                        <div className="rounded-2xl border border-border bg-card p-4 text-base text-muted-foreground sm:p-5">
                            Cette commande est terminée : aucune action n’est possible.
                        </div>
                    ) : (
                        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                            {order.state === 'RECUE' && (
                                <>
                                    {order.response_due_at && <ResponseRing dueAt={order.response_due_at} now={now} size="lg" />}
                                    <TextInput
                                        label="Temps de préparation (minutes)"
                                        hint="De 5 à 240. Vide : la durée habituelle de l’établissement. Le client voit l’heure prévue."
                                        type="number"
                                        inputMode="numeric"
                                        min={5}
                                        max={240}
                                        value={prepMinutes}
                                        onChange={(e) => setPrepMinutes(e.target.value)}
                                    />
                                    <Button variant="primary" size="lg" fullWidth leftIcon={<Check size={20} />} isLoading={busy === 'ACCEPTER'}
                                        onClick={() => void act('ACCEPTER', { minutes: minutesOrNull(prepMinutes) })}>
                                        Accepter la commande
                                    </Button>
                                    <Button variant="outline" size="lg" fullWidth leftIcon={<X size={20} />} onClick={() => { setDialogError(undefined); setDialog('REFUSER'); }}>
                                        Refuser
                                    </Button>
                                </>
                            )}

                            {order.state === 'ACCEPTEE' && (
                                <Button variant="primary" size="lg" fullWidth leftIcon={<ChefHat size={20} />} isLoading={busy === 'PREPARER'} onClick={() => void act('PREPARER')}>
                                    Commencer la préparation
                                </Button>
                            )}
                            {(order.state === 'ACCEPTEE' || order.state === 'EN_PREPARATION') && (
                                <Button variant={order.state === 'EN_PREPARATION' ? 'primary' : 'secondary'} size="lg" fullWidth leftIcon={<CheckCircle2 size={20} />} isLoading={busy === 'PRETE'} onClick={() => void act('PRETE')}>
                                    Marquer prête
                                </Button>
                            )}

                            {needsCouriers && (
                                <div className="space-y-3 border-t border-border pt-4">
                                    <h3 className="text-base font-bold text-foreground-strong">Livraison</h3>
                                    {couriers === null ? (
                                        <p className="text-sm text-muted-foreground">Chargement des livreurs…</p>
                                    ) : courierOptions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Aucun livreur dans votre équipe : vous livrez vous-même, ou <LinkButton href="/partner/orders/livreurs" variant="ghost" size="sm">invitez un livreur</LinkButton></p>
                                    ) : (
                                        <div className="space-y-2">
                                            <Select label="Confier à un livreur" placeholder="Choisir un livreur" options={courierOptions} value={courierId} onChange={(e) => setCourierId(e.target.value)} />
                                            <Button variant="secondary" fullWidth disabled={!courierId} isLoading={busy === 'CONFIER'} onClick={() => void act('CONFIER', { courierId })}>
                                                Confier la livraison
                                            </Button>
                                        </div>
                                    )}
                                    {order.state === 'PRETE' && (
                                        <div className="space-y-2">
                                            <TextInput
                                                label="Durée du trajet (minutes, facultatif)"
                                                hint="De 5 à 240 : le client voit l’heure d’arrivée."
                                                type="number"
                                                inputMode="numeric"
                                                min={5}
                                                max={240}
                                                value={tripMinutes}
                                                onChange={(e) => setTripMinutes(e.target.value)}
                                            />
                                            <Button variant="primary" size="lg" fullWidth leftIcon={<Bike size={20} />} isLoading={busy === 'EN_ROUTE'}
                                                onClick={() => void act('EN_ROUTE', { minutes: minutesOrNull(tripMinutes) })}>
                                                {order.courier?.first_name ? 'Le livreur part' : 'Je livre moi-même : partir'}
                                            </Button>
                                            <p className="text-sm text-muted-foreground">Au départ, le client reçoit son code par SMS : demandez-le à la remise.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Lot 12d : l'établissement qui livre lui-même appelle le client (appel compté), puis « Client absent » */}
                            <DeliveryCallActions order={order} onChanged={polled.reload} />

                            {handoverReady && (
                                <div className="space-y-4 border-t border-border pt-4 first:border-t-0 first:pt-0">
                                    <h3 className="flex items-center gap-2 text-base font-bold text-foreground-strong">
                                        <KeyRound size={18} className="text-primary-text" aria-hidden="true" />
                                        {order.mode === 'SUR_PLACE' ? 'Servir la commande' : 'Remettre la commande'}
                                    </h3>
                                    {needsCode && (
                                        <>
                                            <p id={codeHelpId} className="text-sm text-muted-foreground">Demandez au client le code à 4 chiffres reçu par SMS. 5 essais au plus.</p>
                                            <HandoverCodeInput value={code} onChange={(v) => { setCode(v); setCodeError(null); setCodeLocked(false); }} hasError={codeError !== null} describedBy={codeHelpId} disabled={busy === 'REMETTRE' || codeLocked} />
                                            {codeError && (
                                                <p role="alert" className="text-center text-base font-semibold text-danger-text">{codeError}</p>
                                            )}
                                        </>
                                    )}
                                    {balance > 0 && (
                                        <div className="rounded-xl border border-warning-border bg-warning-soft p-3">
                                            <p className="text-base font-bold text-warning-text">Reste à encaisser : <span className="tabular-nums">{formatFcfa(balance)}</span></p>
                                            <p className="mb-2 text-sm text-foreground">En espèces ou par mobile, payé directement à l’établissement (hors Event Village).</p>
                                            <Switch label="J’ai reçu le reste" checked={balanceReceived} onChange={setBalanceReceived} />
                                        </div>
                                    )}
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        fullWidth
                                        leftIcon={<Check size={20} />}
                                        isLoading={busy === 'REMETTRE'}
                                        disabled={(needsCode && code.length !== 4) || (balance > 0 && !balanceReceived) || codeLocked}
                                        onClick={() => void act('REMETTRE', { code: needsCode ? code : undefined, balanceReceived })}
                                    >
                                        {order.mode === 'LIVRAISON' ? 'Valider la livraison' : order.mode === 'RETRAIT' ? 'Valider le retrait' : 'Valider : commande servie'}
                                    </Button>
                                    {codeLocked && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">Le client peut demander un nouveau code depuis sa commande ; il arrivera par SMS.</p>
                                            <Button variant="secondary" fullWidth onClick={() => { setCodeLocked(false); setCodeError(null); }}>
                                                Le client a reçu un nouveau code
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {order.state !== 'RECUE' && (
                                <Button variant="ghost" fullWidth leftIcon={<Ban size={18} />} className="text-danger-text" onClick={() => { setDialogError(undefined); setDialog('ANNULER'); }}>
                                    Annuler la commande
                                </Button>
                            )}
                        </div>
                    )}
                </aside>
            </div>

            <ReasonDialog
                isOpen={dialog === 'REFUSER'}
                onClose={() => setDialog(null)}
                onConfirm={(reason) => void act('REFUSER', { reason }).then((ok) => ok && setDialog(null))}
                title="Refuser la commande"
                description="Le client est prévenu avec votre motif et remboursé en entier."
                label="Motif envoyé au client"
                placeholder="Par exemple : plus de poisson ce soir"
                confirmLabel="Refuser la commande"
                variant="danger"
                minLength={5}
                maxLength={300}
                isLoading={busy === 'REFUSER'}
                error={dialogError}
            />
            <ReasonDialog
                isOpen={dialog === 'ANNULER'}
                onClose={() => setDialog(null)}
                onConfirm={(reason) => void act('ANNULER', { reason }).then((ok) => ok && setDialog(null))}
                title="Annuler la commande"
                description="Le client est prévenu avec votre motif et remboursé en entier. À faire seulement si vous ne pouvez vraiment pas la servir."
                label="Motif envoyé au client"
                confirmLabel="Annuler la commande"
                cancelLabel="Garder la commande"
                variant="danger"
                minLength={5}
                maxLength={300}
                isLoading={busy === 'ANNULER'}
                error={dialogError}
            />
        </div>
    );
}

