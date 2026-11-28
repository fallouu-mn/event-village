'use client';

/**
 * Lot 12d (point 5) — commandes déjà prévues pendant une fermeture exceptionnelle, sous la fermeture.
 * Lecture GET /api/partner/venues/closures/[id]/orders (commandes transmises et ouvertes dont l'heure, préparation
 * comprise, touche la fermeture). Pour chacune, la partenaire choisit : « Annuler et rembourser » (motif prérempli,
 * modifiable, confirmation, PATCH /api/partner/orders/[id] { action: ANNULER }) ou « Garder » (POST …/orders). Rien
 * d'automatique. Service des commandes fermé, fermeture inconnue ou aucune commande : rien n'est affiché.
 * Montants servis par la base (payé), jamais calculés ici ; refus du serveur affichés tels quels.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShoppingBag, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { dayText, fcfaText, instantHm } from '@/lib/tables/views';

interface ClosureOrder {
    id: string;
    order_number: string;
    state: string;
    mode: string;
    scheduled_for: string;
    goods_total: number | string;
    paid: number | string;
    items_count: number | string;
    kept?: boolean;
}

const REASON_MAX = 300;
const MODE_LABEL: Record<string, string> = { LIVRAISON: 'Livraison', RETRAIT: 'À emporter', SUR_PLACE: 'Sur place' };

export function ClosureOrders({ closureId, closureReason, focus = false }: { closureId: string; closureReason: string | null; focus?: boolean }) {
    const toast = useToast();
    const url = `/api/partner/venues/closures/${encodeURIComponent(closureId)}/orders`;
    const [orders, setOrders] = useState<ClosureOrder[] | null>(null);
    const [cancelling, setCancelling] = useState<ClosureOrder | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        try {
            const body = await fetchJson<{ orders?: ClosureOrder[] }>(url);
            setOrders(Array.isArray(body.orders) ? body.orders : []);
        } catch (err) {
            // Service des commandes fermé ou fermeture inconnue : la section n'existe pas
            setOrders([]);
            if (!(err instanceof ApiError && err.status === 404)) console.error('[fermetures] commandes prévues :', errorMessage(err));
        }
    }, [url]);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (focus && orders && orders.length > 0) ref.current?.scrollIntoView({ block: 'center' });
    }, [focus, orders]);

    if (!orders || orders.length === 0) return null;

    const defaultReason = `Fermeture exceptionnelle${closureReason ? ` : ${closureReason}` : ''}`.slice(0, REASON_MAX);
    const open = orders.filter((o) => !o.kept).length;

    const keep = async (o: ClosureOrder) => {
        if (busy) return;
        setBusy(o.id);
        setRowError(null);
        try {
            await sendJson(url, 'POST', { orderId: o.id });
            toast.success(`Commande ${o.order_number} gardée.`);
            await load();
        } catch (err) {
            setRowError({ id: o.id, message: errorMessage(err, 'Choix non enregistré. Réessayez.') });
        } finally {
            setBusy(null);
        }
    };

    const confirmCancel = async () => {
        if (!cancelling || busy) return;
        const r = reason.trim();
        if (r.length < 5) {
            setDialogError('Indiquez le motif (5 caractères au moins) : il est envoyé au client.');
            return;
        }
        setBusy(cancelling.id);
        setDialogError(null);
        try {
            const body = await sendJson<{ order?: { stateLabel?: string } }>(`/api/partner/orders/${encodeURIComponent(cancelling.id)}`, 'PATCH', { action: 'ANNULER', reason: r });
            toast.success(`Commande ${cancelling.order_number} ${body.order?.stateLabel ? body.order.stateLabel.toLowerCase() : 'annulée'} : le client est remboursé.`);
            setCancelling(null);
            await load();
        } catch (err) {
            setDialogError(errorMessage(err, 'Annulation impossible. Réessayez.'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div
            ref={ref}
            id={`fermeture-commandes-${closureId}`}
            tabIndex={-1}
            className="mt-3 w-full basis-full rounded-xl border border-warning-border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ev-fade-in"
        >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground-strong">
                <ShoppingBag size={16} aria-hidden="true" />
                Commandes prévues pendant cette fermeture
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
                {open > 0
                    ? `${open} ${open > 1 ? 'commandes attendent' : 'commande attend'} votre choix. Rien n’est annulé sans vous.`
                    : 'Vous avez fait votre choix pour chaque commande.'}
            </p>
            <ul className="mt-3 flex flex-col gap-2" aria-label="Commandes prévues pendant cette fermeture">
                {orders.map((o) => {
                    const items = Number(o.items_count) || 0;
                    const paid = Number(o.paid) || 0;
                    return (
                        <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-3">
                            <div className="min-w-0 flex-1 basis-44">
                                <p className="text-base font-semibold tabular-nums text-foreground-strong">{o.order_number}</p>
                                <p className="text-sm text-muted-foreground">
                                    {`${dayText(o.scheduled_for.slice(0, 10))} à ${instantHm(o.scheduled_for)} · ${MODE_LABEL[o.mode] ?? 'Commande'} · ${items} article${items > 1 ? 's' : ''}`}
                                </p>
                                <p className="text-sm tabular-nums text-muted-foreground">{paid > 0 ? `Payé : ${fcfaText(paid)}` : 'Payée à la remise'}</p>
                                {rowError?.id === o.id && <p role="alert" className="mt-1 break-words text-sm font-medium text-danger-text">{rowError.message}</p>}
                            </div>
                            {o.kept ? (
                                <Badge variant="success" size="sm"><CheckCircle2 size={14} aria-hidden="true" /> Gardée</Badge>
                            ) : (
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                    <Button type="button" variant="secondary" size="md" onClick={() => void keep(o)} isLoading={busy === o.id && !cancelling} disabled={busy !== null}
                                        aria-label={`Garder la commande ${o.order_number}`}>
                                        Garder
                                    </Button>
                                    <Button type="button" variant="danger" size="md" leftIcon={<XCircle size={16} />} disabled={busy !== null}
                                        onClick={() => { setReason(defaultReason); setDialogError(null); setCancelling(o); }}
                                        aria-label={`Annuler et rembourser la commande ${o.order_number}`}>
                                        Annuler et rembourser
                                    </Button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <ConfirmDialog
                isOpen={cancelling !== null}
                onClose={() => { if (!busy) setCancelling(null); }}
                onConfirm={() => void confirmCancel()}
                title={cancelling ? `Annuler la commande ${cancelling.order_number} ?` : 'Annuler la commande ?'}
                isLoading={busy !== null}
                confirmLabel={cancelling && Number(cancelling.paid) > 0 ? `Annuler et rembourser ${fcfaText(cancelling.paid)}` : 'Annuler la commande'}
                cancelLabel="Retour"
                variant="danger"
            >
                <p className="text-sm leading-relaxed text-foreground">
                    Le client est prévenu avec votre motif{cancelling && Number(cancelling.paid) > 0 ? ` et remboursé de ${fcfaText(cancelling.paid)}` : ''}.
                </p>
                <div className="mt-3">
                    <Textarea
                        id="fermeture-annulation-motif"
                        label="Motif envoyé au client"
                        rows={3}
                        maxLength={REASON_MAX}
                        showCount
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        error={dialogError ?? undefined}
                    />
                </div>
            </ConfirmDialog>
        </div>
    );
}
