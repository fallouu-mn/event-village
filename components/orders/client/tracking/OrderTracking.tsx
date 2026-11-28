'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bike, LogIn, MapPin, ShoppingBag, Store, Utensils, Wallet, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDate, formatFcfa } from '@/lib/format';
import { OPEN_ORDER_STATES, clientStateLabel, codeExpected, stateTone } from '@/lib/orders/client-view';
import { ORDER_MODE_LABELS, type OrderMode } from '@/lib/orders/menu-types';
import { isRecord, nonEmptyString, readJsonBody, serverErrorMessage } from '@/lib/payments/payment-client';
import { HandoverCode } from './HandoverCode';
import { AbsenceNotice, IssueReport } from './IssueReport';
import { HoldCountdown, OrderPayPanel } from './OrderPayPanel';
import { OrderTimeline } from './OrderTimeline';
import { hourText, isToday, readOrderView, type OrderView } from './order-view';

/**
 * Lot 12b — suivi d'une commande par son client (/orders/<id>) : GET /api/orders/<id>, relu toutes les 10 secondes tant
 * que la page est visible et la commande ouverte (relu aussitôt au retour sur l'onglet) ; commande absente ou d'un autre
 * compte : « Cet élément n'est plus disponible ». Paiement de la première part (compte à rebours) et du solde, code de
 * remise, « Annuler » tant que la préparation n'a pas commencé. Tous les montants sont ceux de la base, tels quels.
 */

const POLL_MS = 10_000;

const MODE_ICON: Record<string, React.ElementType> = { LIVRAISON: Bike, RETRAIT: Store, SUR_PLACE: Utensils };

function Amount({ label, value, strong = false, tone }: { label: string; value: number; strong?: boolean; tone?: 'success' }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className={strong ? 'text-base font-semibold text-foreground-strong' : 'text-sm text-muted-foreground'}>{label}</dt>
            <dd className={strong ? 'text-lg font-bold tabular-nums text-foreground-strong' : tone === 'success' ? 'text-base font-semibold tabular-nums text-success-text' : 'text-base tabular-nums text-foreground-strong'}>
                {formatFcfa(value)}
            </dd>
        </div>
    );
}

function whenText(o: OrderView): string {
    const at = o.estimatedAt ?? o.scheduledFor;
    if (!at) return '';
    return isToday(at) ? `Prévue vers ${hourText(at)}` : `Prévue le ${formatDate(at)} vers ${hourText(at)}`;
}

/** Arrivée par un avis (correctifs après contre-vérification) : « commande prête » → mode comptoir ; « acceptée » → solde. */
export type TrackingIntent = 'comptoir' | 'solde' | null;

export function OrderTracking({ orderId, intent = null }: { orderId: string; intent?: TrackingIntent }) {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [order, setOrder] = useState<OrderView | null>(null);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [payBalance, setPayBalance] = useState(false);
    const intentDone = useRef(false);
    const balanceRef = useRef<HTMLElement>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const inflight = useRef(false);

    const load = useCallback(async () => {
        if (inflight.current) return;
        inflight.current = true;
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
            const body = await readJsonBody(res, 'commande');
            if (res.status === 404) {
                setMissing(true);
                setOrder(null);
                return;
            }
            if (!res.ok) {
                setError(serverErrorMessage(body) ?? 'Votre commande n’a pas pu être chargée.');
                return;
            }
            const view = readOrderView(body);
            if (!view) {
                console.error('[commande] réponse inattendue :', isRecord(body) ? Object.keys(body) : typeof body);
                setError('Réponse inattendue du serveur : votre commande n’a pas pu être affichée.');
                return;
            }
            setOrder(view);
            setError(null);
        } catch (err) {
            console.error('[commande] chargement impossible :', err instanceof Error ? err.message : String(err));
            setError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
        } finally {
            inflight.current = false;
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            setOrder(null);
            setLoading(false);
            return;
        }
        void load();
    }, [authLoading, isAuthenticated, load]);

    const open = order !== null && OPEN_ORDER_STATES.includes(order.state);

    // Relecture tant que la page est visible et la commande ouverte ; aussitôt au retour sur l'onglet
    useEffect(() => {
        if (!open || !isAuthenticated) return;
        let timer: number | undefined;
        const start = () => {
            window.clearInterval(timer);
            timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') { void load(); start(); } else window.clearInterval(timer);
        };
        start();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [open, isAuthenticated, load]);

    const cancel = async () => {
        if (cancelling) return;
        setCancelling(true);
        setCancelError(null);
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
            const body = await readJsonBody(res, 'commande/annulation');
            if (!res.ok) {
                setCancelError(serverErrorMessage(body) ?? 'Annulation impossible pour le moment.');
                return;
            }
            setConfirmCancel(false);
            setNotice(isRecord(body) ? nonEmptyString(body.message) : null);
            await load();
        } catch (err) {
            console.error('[commande] annulation injoignable :', err instanceof Error ? err.message : String(err));
            setCancelError('Connexion impossible : réessayez dans un instant.');
        } finally {
            setCancelling(false);
        }
    };

    // Arrivée par l'avis « commande acceptée » avec un reste à payer : le panneau du solde s'ouvre et vient à l'écran (une
    // fois) ; le montant est celui de la commande relue en base, jamais celui du lien
    useEffect(() => {
        if (intent !== 'solde' || intentDone.current || !order) return;
        const online = ['ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE'].includes(order.state) && order.amounts.balanceDue > 0 && order.amounts.onsiteAmount === null;
        intentDone.current = true;
        if (!online) return;
        setPayBalance(true);
        window.requestAnimationFrame(() => balanceRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }, [intent, order]);

    if (!authLoading && !isAuthenticated) {
        return (
            <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
                <EmptyState
                    icon={<LogIn size={28} />}
                    title="Connectez-vous pour suivre votre commande"
                    description="Le suivi et le code de remise sont visibles seulement par le compte qui a passé la commande."
                    actionLabel="Se connecter"
                    actionHref={`/login?redirect=${encodeURIComponent(`/orders/${orderId}`)}`}
                />
            </div>
        );
    }

    if (missing) return <UnavailableItem actionLabel="Mes commandes" actionHref="/orders" />;

    if (loading || authLoading || (!order && !error)) {
        return (
            <div className="mx-auto max-w-5xl space-y-4 pb-24 pt-2 lg:pb-12" role="status" aria-busy="true">
                <span className="sr-only">Chargement de votre commande…</span>
                <Skeleton className="h-10 w-48 rounded-xl" />
                <Skeleton className="h-40 rounded-3xl" />
                <Skeleton className="h-72 rounded-3xl" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
                <ErrorState title="Commande indisponible" description={error ?? undefined} onRetry={() => { setLoading(true); void load(); }} />
            </div>
        );
    }

    const o = order;
    const a = o.amounts;
    const ModeIcon = MODE_ICON[o.mode] ?? ShoppingBag;
    const modeLabel = ORDER_MODE_LABELS[o.mode as OrderMode] ?? 'Commande';
    const awaitingPayment = o.state === 'EN_ATTENTE_PAIEMENT';
    const balanceOnline = ['ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE'].includes(o.state) && a.balanceDue > 0 && a.onsiteAmount === null;
    const finalBad = !open && o.state !== 'REMISE';
    const showCode = open && o.code?.sent === true && codeExpected(o.state, o.mode);
    const when = whenText(o);
    // Lot 12d : libellé servi pour une livraison close « non retirée » (« Client absent ») ; sinon le libellé du client
    const stateText = o.state === 'NON_RETIREE' && o.stateLabel ? o.stateLabel : clientStateLabel(o.state, o.mode);

    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-24 lg:pb-12">
            <LinkButton href="/orders" variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">Mes commandes</LinkButton>

            <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={stateTone(o.state)} size="sm">{stateText}</Badge>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <ModeIcon size={16} aria-hidden="true" />
                        {modeLabel}
                    </span>
                    {o.orderNumber && <span className="text-sm tabular-nums text-muted-foreground">{`Commande ${o.orderNumber}`}</span>}
                </div>
                <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-3xl">{o.venueName}</h1>
                <p className="sr-only" aria-live="polite">{`État de la commande : ${stateText}`}</p>
            </header>

            {notice && <StatusBanner tone="success" title="C’est fait">{notice}</StatusBanner>}

            {/* Lot 12d : le livreur ne joint pas le client (attente de 30 minutes), puis décision de l'équipe */}
            <AbsenceNotice order={o} hourOf={hourText} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                <div className="space-y-6">
                    {awaitingPayment && (
                        <section aria-labelledby="payer-titre" className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
                            <h2 id="payer-titre" className="text-xl font-bold text-foreground-strong">Payez pour envoyer la commande</h2>
                            <HoldCountdown deadline={o.holdExpiresAt} onExpired={() => void load()} />
                            {a.toPayNow !== null && a.toPayNow > 0 && (
                                <OrderPayPanel orderId={o.id} part="PREMIER" amount={a.toPayNow} onPriceChanged={() => void load()} />
                            )}
                        </section>
                    )}

                    {finalBad && (
                        <StatusBanner tone="danger" title={stateText} icon={<XCircle size={20} />}>
                            {o.cancel?.reason && <p>{o.cancel.reason}</p>}
                            {a.refundedAmount > 0 ? (
                                <p className="mt-1">
                                    Remboursé : <span className="font-semibold tabular-nums">{formatFcfa(a.refundedAmount)}</span>, sur le compte qui a payé.
                                </p>
                            ) : o.state === 'EXPIREE' ? (
                                <p className="mt-1">Rien n’a été payé : vous pouvez refaire la commande.</p>
                            ) : null}
                        </StatusBanner>
                    )}

                    {/* Code de remise en premier quand la remise est attendue : c'est ce que le client montre au comptoir ou au
                        livreur (au-dessus de la ligne de flottaison du téléphone) */}
                    {showCode && (
                        <HandoverCode
                            orderId={o.id}
                            active={showCode}
                            resendsLeft={o.code?.resendsLeft ?? 0}
                            version={`${o.state}:${o.code?.resendsLeft ?? 0}`}
                            onResent={() => void load()}
                            venueName={o.venueName}
                            counterOnLoad={intent === 'comptoir'}
                            forCourier={o.mode === 'LIVRAISON'}
                        />
                    )}

                    {!awaitingPayment && o.state !== 'EXPIREE' && (
                        <section aria-labelledby="suivi-titre" className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
                            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                                <h2 id="suivi-titre" className="text-xl font-bold text-foreground-strong">Suivi</h2>
                                {open && when && <p className="text-2xl font-extrabold tabular-nums text-primary-text sm:text-3xl" data-testid="heure-estimee">{when}</p>}
                            </div>
                            {o.state === 'RECUE' && (
                                <p className="mb-4 text-sm text-muted-foreground">Le restaurant doit accepter votre commande sous peu. Sinon, elle est annulée et tout vous est rendu.</p>
                            )}
                            <OrderTimeline mode={o.mode} steps={o.steps} closed={!open} />
                        </section>
                    )}

                    {/* Lot 12d : « Signaler un problème » après le début de la préparation, puis suivi du signalement */}
                    <IssueReport order={o} onSent={() => { setNotice('Signalement envoyé. L’équipe Event Village s’en occupe et vous répond dans la commande.'); void load(); }} />

                    {balanceOnline && (
                        <section ref={balanceRef} aria-labelledby="solde-titre" className="scroll-mt-24 space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid="solde">
                            <h2 id="solde-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                                <Wallet size={20} className="text-primary-text" aria-hidden="true" />
                                Reste à payer
                            </h2>
                            {payBalance ? (
                                <OrderPayPanel orderId={o.id} part="SOLDE" amount={a.balanceDue} onPriceChanged={() => void load()} onClose={() => setPayBalance(false)} />
                            ) : (
                                <>
                                    <p className="text-base text-foreground">
                                        <span className="font-bold tabular-nums text-foreground-strong">{formatFcfa(a.balanceDue)}</span>
                                        {o.mode === 'LIVRAISON' ? ' à payer au livreur, ou en ligne dès maintenant.' : o.mode === 'RETRAIT' ? ' à payer au comptoir, ou en ligne dès maintenant.' : ' à payer sur place, ou en ligne dès maintenant.'}
                                    </p>
                                    <Button variant="secondary" onClick={() => setPayBalance(true)}>Payer le reste en ligne</Button>
                                </>
                            )}
                        </section>
                    )}
                </div>

                <aside className="space-y-6">
                    <section aria-labelledby="remise-titre" className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                        <h2 id="remise-titre" className="text-lg font-bold text-foreground-strong">{modeLabel}</h2>
                        <div className="mt-2 space-y-1.5 text-base text-foreground">
                            {o.mode === 'LIVRAISON' && (
                                <>
                                    {o.address && (
                                        <p className="flex items-start gap-2"><MapPin size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" /><span className="break-words">{o.address}</span></p>
                                    )}
                                    {o.zoneName && <p className="text-sm text-muted-foreground">{`Zone : ${o.zoneName}`}</p>}
                                    {o.courierFirstName && <p className="text-sm text-muted-foreground">{`Livreur : ${o.courierFirstName}`}</p>}
                                </>
                            )}
                            {o.mode === 'RETRAIT' && <p>{`À retirer chez ${o.venueName}`}</p>}
                            {o.mode === 'SUR_PLACE' && <p>{o.onsiteLabel ? `Servie à : ${o.onsiteLabel}` : `Servie sur place chez ${o.venueName}`}</p>}
                            {o.contactNotes && <p className="break-words text-sm text-muted-foreground">{`Votre commentaire : ${o.contactNotes}`}</p>}
                        </div>
                    </section>

                    <section aria-labelledby="contenu-titre" className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                        <h2 id="contenu-titre" className="text-lg font-bold text-foreground-strong">Votre commande</h2>
                        <ul className="mt-3 divide-y divide-border">
                            {o.items.map((it, i) => (
                                <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="break-words text-base text-foreground-strong"><span className="font-semibold tabular-nums">{`${it.quantity} ×`}</span> {it.name}</p>
                                        {it.options.length > 0 && <p className="break-words text-sm text-muted-foreground">{`Avec ${it.options.join(', ')}`}</p>}
                                        {it.notes && <p className="break-words text-sm italic text-muted-foreground">{it.notes}</p>}
                                    </div>
                                    <span className="flex-shrink-0 text-base tabular-nums text-foreground-strong">{formatFcfa(it.totalPrice)}</span>
                                </li>
                            ))}
                        </ul>
                        <dl className="mt-3 border-t border-border pt-2">
                            <Amount label="Sous-total" value={a.itemsAmount} />
                            {a.deliveryFee > 0 && <Amount label="Livraison" value={a.deliveryFee} />}
                            <Amount label="Total de la commande" value={a.goodsTotal} strong />
                            {a.paidGoods > 0 && <Amount label="Payé en ligne" value={a.paidGoods} tone="success" />}
                            {a.paidFees > 0 && <Amount label="Frais de service payés" value={a.paidFees} />}
                            {a.onsiteAmount !== null && a.onsiteAmount > 0 && <Amount label="Payé sur place" value={a.onsiteAmount} />}
                            {a.refundedAmount > 0 && <Amount label="Remboursé" value={a.refundedAmount} tone="success" />}
                            {open && !awaitingPayment && a.balanceDue > 0 && <Amount label="Reste à payer" value={a.balanceDue} strong />}
                        </dl>
                    </section>

                    {o.canCancel && (
                        <div className="space-y-2">
                            <Button variant="ghost" fullWidth onClick={() => { setCancelError(null); setConfirmCancel(true); }} className="text-danger-text">
                                Annuler la commande
                            </Button>
                            <p className="text-center text-sm text-muted-foreground">Possible tant que la préparation n’a pas commencé.</p>
                        </div>
                    )}
                </aside>
            </div>

            <ConfirmDialog
                isOpen={confirmCancel}
                onClose={() => { if (!cancelling) setConfirmCancel(false); }}
                onConfirm={() => void cancel()}
                title="Annuler la commande ?"
                confirmLabel="Oui, annuler"
                cancelLabel="Garder la commande"
                variant="danger"
                isLoading={cancelling}
            >
                <div className="space-y-2 text-base text-foreground">
                    {a.paidGoods > 0 || a.paidFees > 0 ? (
                        <>
                            <p>Tout ce que vous avez payé vous est rendu, sur le compte qui a payé :</p>
                            <dl className="rounded-2xl bg-muted px-4 py-2">
                                {a.paidGoods > 0 && <Amount label="Commande" value={a.paidGoods} />}
                                {a.paidFees > 0 && <Amount label="Frais de service" value={a.paidFees} />}
                            </dl>
                        </>
                    ) : (
                        <p>Vous n’avez encore rien payé : la commande est simplement annulée.</p>
                    )}
                    {cancelError && <p className="text-sm font-medium text-danger-text" role="alert">{cancelError}</p>}
                </div>
            </ConfirmDialog>
        </div>
    );
}
