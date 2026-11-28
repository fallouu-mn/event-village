'use client';

import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, LogIn, MapPin, Navigation, Phone, Store, UserX, Wallet } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { HandoverCodeInput } from '@/components/orders/partner/orders/HandoverCodeInput';
import { usePolledJson, useServerClock } from '@/components/orders/partner/orders/usePolledJson';
import { formatFcfa } from '@/lib/format';
import { DeliverySteps } from './DeliverySteps';
import { COURIER_PATHS, countdownText, courierStateLabel, directionsUrl, hourText, phoneText, readDelivery } from './courier-view';

/**
 * Lot 12d — une livraison vue par son livreur (/courier/orders/<id>), pensée pour la rue : très grands boutons, contraste
 * fort, UNE action principale à la fois selon l'étape :
 *  - en cuisine : itinéraire vers l'établissement, attente de « prête » ;
 *  - prête : « Je pars » (durée de trajet facultative) → code envoyé au client par la base ;
 *  - en route : « Appeler le client » (appel compté par la base avant d'ouvrir le téléphone), itinéraire vers le client,
 *    reste à encaisser (montant servi par la base) à confirmer « reçu en espèces », code en 4 grandes cases, « Remettre » ;
 *    « Client absent » après deux appels (confirmation), puis attente de 30 minutes (compte à rebours, la remise reste
 *    possible) et décision de l'équipe Event Village.
 * GET /api/courier/orders/<id> relu toutes les 10 secondes ; refus du serveur affichés tels quels ; livraison absente,
 * d'un autre livreur ou d'une autre partenaire : « Cet élément n'est plus disponible ».
 */

const POLL_MS = 10_000;
const TRIP_MINUTES = [10, 20, 30, 45] as const;
const BIG = 'min-h-14 w-full rounded-2xl text-lg';

export function CourierDelivery({ orderId }: { orderId: string }) {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [handedOver, setHandedOver] = useState(false);
    const url = authLoading || !isAuthenticated || handedOver ? null : COURIER_PATHS.apiOrder(orderId);
    const polled = usePolledJson<{ order?: unknown }>(url, POLL_MS);
    const now = useServerClock(polled.skewMs);
    const d = polled.data ? readDelivery(polled.data.order) : null;

    const [busy, setBusy] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [minutes, setMinutes] = useState<number | null>(null);
    const [code, setCode] = useState('');
    const [cashReceived, setCashReceived] = useState(false);
    const [confirmAbsent, setConfirmAbsent] = useState(false);
    const [callInfo, setCallInfo] = useState<string | null>(null);

    const act = async (name: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
        setBusy(name);
        setActionError(null);
        try {
            const r = await sendJson<Record<string, unknown>>(COURIER_PATHS.apiOrder(orderId), 'PATCH', payload);
            return r;
        } catch (err) {
            setActionError(errorMessage(err, 'Action impossible pour le moment. Réessayez.'));
            return null;
        } finally {
            setBusy(null);
        }
    };

    if (!authLoading && !isAuthenticated) {
        return (
            <div className="mx-auto max-w-2xl pb-24 pt-6 lg:pb-12">
                <EmptyState
                    icon={<LogIn size={28} />}
                    title="Connectez-vous"
                    description="Cette livraison s’affiche une fois connecté avec votre compte de livreur."
                    actionLabel="Se connecter"
                    actionHref={`/login?redirect=${encodeURIComponent(COURIER_PATHS.order(orderId))}`}
                />
            </div>
        );
    }

    if (handedOver) {
        return (
            <div className="mx-auto max-w-2xl pb-24 pt-6 lg:pb-12">
                <div className="ev-fade-in flex flex-col items-center rounded-3xl border-2 border-success-border bg-success-soft p-8 text-center" role="status">
                    <CheckCircle2 size={56} aria-hidden="true" className="ev-count-pop mb-3 text-success-text" />
                    <h1 className="text-2xl font-extrabold text-foreground-strong">Commande remise</h1>
                    <p className="mt-2 max-w-sm text-base text-foreground-strong">Merci ! Le client et l’établissement sont prévenus.</p>
                    <LinkButton href={COURIER_PATHS.home} variant="gradient" className="mt-6">Mes livraisons</LinkButton>
                </div>
            </div>
        );
    }

    if (polled.error?.status === 404) {
        return <UnavailableItem actionLabel="Mes livraisons" actionHref={COURIER_PATHS.home} />;
    }

    if (!d) {
        if (polled.error) {
            return (
                <div className="mx-auto max-w-2xl pb-24 pt-6 lg:pb-12">
                    <ErrorState title="Livraison indisponible" description={errorMessage(polled.error, 'La livraison ne se charge pas. Réessayez.')} onRetry={() => void polled.reload()} />
                </div>
            );
        }
        return (
            <div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-4 pb-24 pt-2 lg:pb-12">
                <Skeleton className="h-10 w-2/3 rounded-xl" />
                <Skeleton className="h-36 rounded-3xl" />
                <Skeleton className="h-56 rounded-3xl" />
                <span className="sr-only">Chargement de la livraison…</span>
            </div>
        );
    }

    const enRoute = d.state === 'EN_ROUTE';
    const ready = d.state === 'PRETE';
    const target = enRoute ? d.address : d.venueAddress;
    const needCash = d.balanceDue > 0;
    const canHandOver = code.length === 4 && (!needCash || cashReceived) && busy === null;
    const at = d.estimatedAt ?? d.scheduledFor;

    const call = async () => {
        if (!d.phone) return;
        const r = await act('APPEL', { action: 'APPEL' });
        const order = r && typeof r.order === 'object' && r.order ? (r.order as Record<string, unknown>) : null;
        if (order && typeof order.calls === 'number') {
            setCallInfo(order.counted === false ? `Appel déjà compté il y a moins de 30 secondes (${order.calls} au total).` : `Appel ${order.calls} compté.`);
        }
        window.location.href = `tel:${d.phone}`;
        void polled.reload();
    };

    const depart = async () => {
        const r = await act('EN_ROUTE', { action: 'EN_ROUTE', ...(minutes ? { minutes } : {}) });
        if (r) void polled.reload();
    };

    const reportAbsent = async () => {
        const r = await act('ABSENT', { action: 'ABSENT' });
        setConfirmAbsent(false);
        if (r) void polled.reload();
    };

    const handOver = async () => {
        if (!canHandOver) return;
        const r = await act('REMETTRE', { action: 'REMETTRE', code, balanceReceived: needCash ? cashReceived : false });
        if (r) setHandedOver(true);
        else setCode('');
    };

    return (
        <div className="mx-auto max-w-2xl space-y-4 pb-28 pt-2 lg:pb-12">
            <LinkButton href={COURIER_PATHS.home} variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">Mes livraisons</LinkButton>

            <header className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">{courierStateLabel(d)}</p>
                <h1 className="break-words text-3xl font-extrabold leading-tight tabular-nums text-foreground-strong">Livraison {d.orderNumber}</h1>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-foreground-strong">
                    <span className="inline-flex items-center gap-1.5 font-semibold"><Store size={18} aria-hidden="true" className="text-muted-foreground" />{d.venueName}</span>
                    {at && <span className="inline-flex items-center gap-1.5"><Clock size={18} aria-hidden="true" className="text-muted-foreground" />Prévue vers {hourText(at)}</span>}
                </p>
            </header>

            <DeliverySteps steps={d.steps} />

            {!polled.online && <StatusBanner tone="warning" title="Pas de réseau">L’écran se remet à jour dès son retour.</StatusBanner>}

            {d.absence?.phase === 'ATTENTE' && (
                <StatusBanner tone="warning" title={`Client absent : attente ${countdownText(d.absence.waitUntil, now)}`} icon={<UserX size={20} />}>
                    Le client peut encore arriver : saisissez son code s’il se présente. Attente jusqu’à {hourText(d.absence.waitUntil)}.
                </StatusBanner>
            )}
            {d.absence?.phase === 'EQUIPE' && (
                <StatusBanner tone="danger" title="L’équipe Event Village décide" icon={<UserX size={20} />}>
                    Rapportez la commande à l’établissement. Si le client revient avant la décision, vous pouvez encore la remettre avec son code.
                </StatusBanner>
            )}

            {actionError && <StatusBanner tone="danger" title="Action refusée" announce="alert">{actionError}</StatusBanner>}

            {/* Où aller */}
            <section aria-labelledby="destination-titre" className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
                <h2 id="destination-titre" className="text-lg font-bold text-foreground-strong">{enRoute ? 'Chez le client' : 'Retrait à l’établissement'}</h2>
                {enRoute ? (
                    <>
                        {d.address ? (
                            <p className="flex items-start gap-2 text-xl font-bold leading-snug text-foreground-strong">
                                <MapPin size={22} aria-hidden="true" className="mt-1 flex-shrink-0 text-primary-text" />
                                <span className="min-w-0 break-words">{d.address}</span>
                            </p>
                        ) : (
                            <p className="text-base text-muted-foreground">Adresse non disponible.</p>
                        )}
                        {d.notes && <p className="break-words rounded-2xl bg-muted p-3 text-base text-foreground-strong">Consignes : {d.notes}</p>}
                        {d.phone && <p className="text-base text-foreground-strong">Téléphone : <span className="font-bold tabular-nums">{phoneText(d.phone)}</span></p>}
                    </>
                ) : (
                    <>
                        <p className="flex items-start gap-2 text-xl font-bold leading-snug text-foreground-strong">
                            <Store size={22} aria-hidden="true" className="mt-1 flex-shrink-0 text-primary-text" />
                            <span className="min-w-0 break-words">{d.venueName}{d.venueAddress ? ` — ${d.venueAddress}` : ''}</span>
                        </p>
                        {d.address && (
                            <p className="flex items-start gap-2 text-base text-foreground-strong">
                                <MapPin size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                                <span className="min-w-0 break-words">Livraison : {d.address}</span>
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground">Le numéro du client s’affiche quand vous partez.</p>
                    </>
                )}
                <div className={cn('grid gap-3', enRoute && d.phone ? 'sm:grid-cols-2' : '')}>
                    {enRoute && d.phone && (
                        <Button variant="outline" className={BIG} onClick={() => void call()} isLoading={busy === 'APPEL'} leftIcon={<Phone size={22} />}>
                            Appeler le client
                        </Button>
                    )}
                    {target && (
                        <a
                            href={directionsUrl(target)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonClasses({ variant: 'outline', size: 'lg', className: BIG })}
                        >
                            <Navigation size={22} aria-hidden="true" />
                            {enRoute ? 'Itinéraire' : 'Itinéraire vers l’établissement'}
                        </a>
                    )}
                </div>
                {enRoute && (
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        {callInfo ?? (d.calls > 0 ? `Appels au client : ${d.calls}.` : 'Appelez le client en arrivant.')}
                    </p>
                )}
            </section>

            {/* Action principale selon l'étape */}
            {!enRoute && !ready && (
                <section className="rounded-3xl border-2 border-border bg-card p-4 text-base text-foreground-strong sm:p-5">
                    La commande se prépare. Vous pourrez partir quand l’établissement la dira prête : vous serez prévenu.
                </section>
            )}

            {ready && (
                <section aria-labelledby="depart-titre" className="space-y-4 rounded-3xl border-2 border-primary bg-card p-4 sm:p-5">
                    <h2 id="depart-titre" className="text-lg font-bold text-foreground-strong">Prête à partir</h2>
                    <fieldset>
                        <legend className="mb-2 text-sm font-semibold text-foreground-strong">Temps de trajet (facultatif)</legend>
                        <div className="flex flex-wrap gap-2">
                            {TRIP_MINUTES.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    aria-pressed={minutes === m}
                                    onClick={() => setMinutes(minutes === m ? null : m)}
                                    className={cn(
                                        'min-h-12 min-w-[4.5rem] rounded-xl border-2 px-3 text-base font-bold transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        minutes === m ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground-strong',
                                    )}
                                >
                                    {m} min
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <Button variant="gradient" fullWidth onClick={() => void depart()} isLoading={busy === 'EN_ROUTE'} disabled={busy !== null}>
                        Je pars
                    </Button>
                    <p className="text-sm text-muted-foreground">Le client reçoit alors son code de remise par SMS.</p>
                </section>
            )}

            {enRoute && (
                <section aria-labelledby="remise-titre" className="space-y-4 rounded-3xl border-2 border-primary bg-card p-4 sm:p-5">
                    <h2 id="remise-titre" className="text-lg font-bold text-foreground-strong">Remise au client</h2>
                    {needCash && (
                        <div className="space-y-3 rounded-2xl border-2 border-warning-border bg-warning-soft p-4 tabular-nums">
                            <p className="flex items-center gap-2 text-xl font-extrabold text-warning-text">
                                <Wallet size={22} aria-hidden="true" />À encaisser : {formatFcfa(d.balanceDue)}
                            </p>
                            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base font-semibold text-foreground-strong">
                                <input
                                    type="checkbox"
                                    checked={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.checked)}
                                    className="h-7 w-7 flex-shrink-0 accent-primary"
                                />
                                Reste reçu en espèces : {formatFcfa(d.balanceDue)}
                            </label>
                        </div>
                    )}
                    <p id="code-aide" className="text-base text-foreground-strong">Demandez au client le code à 4 chiffres reçu par SMS.</p>
                    <HandoverCodeInput value={code} onChange={setCode} disabled={busy !== null} hasError={actionError !== null} describedBy="code-aide" />
                    <Button variant="gradient" fullWidth onClick={() => void handOver()} isLoading={busy === 'REMETTRE'} disabled={!canHandOver}>
                        Remettre la commande
                    </Button>
                    {needCash && !cashReceived && code.length === 4 && (
                        <p className="text-sm font-semibold text-warning-text">Cochez « Reste reçu en espèces » une fois l’argent encaissé.</p>
                    )}
                    {d.canReportAbsent && (
                        <Button variant="secondary" className={BIG} onClick={() => setConfirmAbsent(true)} disabled={busy !== null} leftIcon={<UserX size={22} />}>
                            Client absent
                        </Button>
                    )}
                    {!d.absence && !d.canReportAbsent && (
                        <p className="text-sm text-muted-foreground">Après deux appels sans réponse, vous pourrez signaler le client absent.</p>
                    )}
                </section>
            )}

            {d.items.length > 0 && (
                <details className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
                    <summary className="min-h-11 cursor-pointer text-lg font-bold text-foreground-strong">Contenu de la commande</summary>
                    <ul className="mt-3 space-y-2">
                        {d.items.map((it, i) => (
                            <li key={i} className="text-base text-foreground-strong">
                                <span className="font-bold tabular-nums">{it.quantity} ×</span> {it.name}
                                {it.options.length > 0 && <span className="text-muted-foreground"> ({it.options.join(', ')})</span>}
                                {it.notes && <span className="block text-sm text-muted-foreground">Note : {it.notes}</span>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            <ConfirmDialog
                isOpen={confirmAbsent}
                onClose={() => setConfirmAbsent(false)}
                onConfirm={() => void reportAbsent()}
                title="Le client est absent ?"
                message="Le client est prévenu. La commande attend 30 minutes : s’il arrive, remettez-la avec son code. Ensuite, l’équipe Event Village décide."
                confirmLabel="Oui, client absent"
                cancelLabel="Retour"
                variant="warning"
                isLoading={busy === 'ABSENT'}
            />
        </div>
    );
}
