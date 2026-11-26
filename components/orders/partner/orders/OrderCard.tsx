'use client';

/**
 * Lot 12c — carte d'une commande ouverte, lisible à un mètre (tablette posée au comptoir) : numéro en grand, état servi,
 * mode, heure demandée bien visible pour une commande pour plus tard, lignes servies (« 2 × Yassa »), total servi et
 * reste à encaisser servi, compte à rebours en anneau tant qu'elle attend une réponse, actions rapides (accepter,
 * commencer, prête) et lien vers la fiche. Une nouvelle commande arrive avec une courte animation et un halo (coupés si
 * « réduire les animations »). `viewTransitionName` : la carte glisse d'une colonne à l'autre quand son étape change.
 */
import React from 'react';
import { Bike, CalendarClock, ChevronRight, ShoppingBag, Utensils } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';
import { formatDateTime, formatFcfa, formatTime } from '@/lib/format';
import { ORDER_MODE_LABELS } from '@/lib/orders/partner-ui';
import { ResponseRing } from './ResponseRing';
import { linesSummary, type PartnerOrder } from './order-types';

export type QuickAction = 'ACCEPTER' | 'PREPARER' | 'PRETE';

const MODE_ICONS: Record<string, typeof Bike> = { LIVRAISON: Bike, RETRAIT: ShoppingBag, SUR_PLACE: Utensils };

export const STATE_BADGE: Record<string, BadgeVariant> = {
    RECUE: 'warning', ACCEPTEE: 'info', EN_PREPARATION: 'brand', PRETE: 'success', EN_ROUTE: 'info', REMISE: 'success',
};

const QUICK: Record<string, { action: QuickAction; label: string } | undefined> = {
    RECUE: { action: 'ACCEPTER', label: 'Accepter' },
    ACCEPTEE: { action: 'PREPARER', label: 'Commencer la préparation' },
    EN_PREPARATION: { action: 'PRETE', label: 'Marquer prête' },
};

/** Partie distinctive du numéro (« CMD-261126-A1B2C3 » → « A1B2C3 »), en grand ; le numéro complet est écrit dessous. */
export function shortOrderNumber(n: string): string {
    return n.replace(/^CMD-\d{6}-/, '');
}

/** Jour de Dakar (UTC toute l'année). */
const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function scheduledLabel(order: PartnerOrder, now: number): string | null {
    if (order.asap || !order.scheduled_for) return null;
    const at = Date.parse(order.scheduled_for);
    if (Number.isNaN(at)) return null;
    return dayOf(at) === dayOf(now) ? `Pour ${formatTime(order.scheduled_for)}` : `Pour le ${formatDateTime(order.scheduled_for)}`;
}

export function OrderCard({
    order,
    now,
    fresh,
    busy,
    readOnly,
    onQuick,
}: {
    order: PartnerOrder;
    now: number;
    fresh: boolean;
    busy: boolean;
    readOnly: boolean;
    onQuick: (order: PartnerOrder, action: QuickAction) => void;
}) {
    const ModeIcon = MODE_ICONS[order.mode] ?? ShoppingBag;
    const { shown, more } = linesSummary(order);
    const later = scheduledLabel(order, now);
    const quick = QUICK[order.state];
    const balance = Number(order.amounts?.balance_due ?? 0);
    const where = order.mode === 'LIVRAISON' ? order.zone_name : order.mode === 'SUR_PLACE' ? order.onsite_label : null;
    return (
        <article
            aria-labelledby={`commande-${order.id}`}
            className={cn(
                'relative rounded-2xl border bg-card p-4 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95',
                fresh ? 'border-primary ring-2 ring-primary/40' : 'border-border',
            )}
            style={{ viewTransitionName: `commande-${order.id}` }}
        >
            {fresh && (
                <span className="pointer-events-none absolute inset-0 hidden rounded-2xl bg-primary/15 motion-safe:block motion-safe:animate-ping" aria-hidden="true" />
            )}
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 id={`commande-${order.id}`} className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground-strong">
                        <span className="sr-only">Commande </span>{shortOrderNumber(order.order_number)}
                    </h3>
                    <p className="text-sm tabular-nums text-muted-foreground" aria-hidden="true">{order.order_number}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <ModeIcon size={16} aria-hidden="true" />
                            {ORDER_MODE_LABELS[order.mode] ?? 'Commande'}
                        </span>
                        {where && <span className="break-words">· {where}</span>}
                    </p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <Badge variant={STATE_BADGE[order.state] ?? 'neutral'}>{order.stateLabel}</Badge>
                    {fresh && <Badge variant="brand">Nouvelle</Badge>}
                </div>
            </header>

            {later && (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-base font-bold text-warning-text">
                    <CalendarClock size={20} aria-hidden="true" />
                    <span className="tabular-nums">{later}</span>
                </p>
            )}

            {order.state === 'RECUE' && order.response_due_at && (
                <div className="mt-3">
                    <ResponseRing dueAt={order.response_due_at} now={now} />
                </div>
            )}

            <ul className="mt-3 space-y-1 text-base text-foreground-strong">
                {shown.map((l, i) => (
                    <li key={`${l.product_id}-${i}`} className="break-words">
                        <span className="font-bold tabular-nums">{l.quantity} ×</span> {l.name}
                        {l.options && l.options.length > 0 && (
                            <span className="text-sm text-muted-foreground"> · {l.options.map((o) => o.name).join(', ')}</span>
                        )}
                    </li>
                ))}
                {more && <li className="text-sm text-muted-foreground">et d’autres articles : ouvrez la commande</li>}
            </ul>

            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-bold tabular-nums text-foreground-strong">{formatFcfa(order.amounts?.goods_total)}</p>
                {balance > 0 && (
                    <p className="text-sm font-semibold text-warning-text">
                        À encaisser : <span className="tabular-nums">{formatFcfa(balance)}</span>
                    </p>
                )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
                {quick && !readOnly && (
                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        isLoading={busy}
                        onClick={() => onQuick(order, quick.action)}
                    >
                        {quick.label}
                    </Button>
                )}
                <LinkButton
                    href={`/partner/orders/${order.id}`}
                    variant="secondary"
                    size="lg"
                    fullWidth
                    rightIcon={<ChevronRight size={18} />}
                    aria-label={`Ouvrir la commande ${order.order_number}`}
                >
                    {order.state === 'PRETE' || order.state === 'EN_ROUTE' ? 'Remettre' : order.state === 'RECUE' ? 'Voir ou refuser' : 'Ouvrir'}
                </LinkButton>
            </div>
        </article>
    );
}
