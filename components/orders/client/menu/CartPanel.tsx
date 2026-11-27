'use client';

import React from 'react';
import { ArrowLeft, Clock, Loader2, LogIn, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Select, Textarea, TextInput } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { formatFcfa } from '@/lib/format';
import { ORDER_MODE_LABELS, type MenuProduct, type OrderMode, type OrderPaymentChoice, type VenueMenu } from '@/lib/orders/menu-types';
import { COMMENT_MAX, INCOMPLETE_CODES, type CartLine, type Checkout, type PriceChange, type QuoteState, type TimeChoices } from '@/lib/orders/cart-client';
import { etaLabel } from '@/lib/orders/client-view';
import { EmptyCart } from './EmptyCart';
import { TimePicker, chipClass, type TimeChip } from './TimePicker';

export type CartStep = 'cart' | 'checkout';

const MODE_HINTS: Readonly<Record<OrderMode, string>> = {
    LIVRAISON: 'Livré à votre adresse',
    RETRAIT: 'Vous passez la chercher',
    SUR_PLACE: 'Servi à votre table',
};

function Row({ label, value, strong = false, muted = false }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-3', strong ? 'text-lg font-extrabold text-foreground-strong' : muted ? 'text-sm text-muted-foreground' : 'text-base text-foreground')}>
            <dt>{label}</dt>
            <dd className="tabular-nums">{formatFcfa(value)}</dd>
        </div>
    );
}

/**
 * Montants du devis de la base (rien n'est calculé ici) ; total qui s'anime quand il change ; heure estimée servie par le
 * devis (« Prête vers 13 h 05 », correctifs après contre-vérification, idée 10).
 */
function Amounts({ state, loginHref, onRetry, mode, today }: { state: QuoteState; loginHref: string; onRetry: () => void; mode: OrderMode | null; today: string }) {
    if (state.status === 'signin') {
        return (
            <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted p-4">
                <p className="text-base text-foreground">Connectez-vous pour voir le total exact de votre commande.</p>
                <LinkButton href={loginHref} variant="secondary" leftIcon={<LogIn size={18} />} fullWidth>Se connecter</LinkButton>
            </div>
        );
    }
    if (state.status === 'error') {
        return (
            <StatusBanner tone="danger" title="Total indisponible" action={<Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>}>
                {state.message}
            </StatusBanner>
        );
    }
    if (state.status === 'refused') {
        const soft = state.code !== null && INCOMPLETE_CODES.has(state.code);
        return <StatusBanner tone={soft ? 'info' : 'warning'} announce={soft ? 'status' : 'alert'} title={soft ? 'Encore un choix' : 'Commande impossible ainsi'}>{state.message}</StatusBanner>;
    }
    const quote = state.status === 'ready' ? state.quote : state.status === 'loading' ? state.previous : null;
    if (!quote) {
        return (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Calcul du total…
            </p>
        );
    }
    const loading = state.status === 'loading';
    const eta = etaLabel(mode, quote.scheduledFor, today);
    return (
        <dl className={cn('space-y-1.5 transition-opacity duration-fast', loading && 'opacity-60')} aria-busy={loading}>
            {eta && (
                <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-base font-semibold text-foreground-strong" data-testid="heure-estimee-panier">
                    <Clock size={18} className="flex-shrink-0 text-primary-text" aria-hidden="true" />
                    <dt className="sr-only">Heure estimée</dt>
                    <dd>{eta}</dd>
                </div>
            )}
            <Row label="Sous-total" value={quote.itemsAmount} />
            {quote.deliveryFee > 0 && <Row label={quote.zoneName ? `Livraison · ${quote.zoneName}` : 'Livraison'} value={quote.deliveryFee} />}
            {quote.serviceFee > 0 && <Row label="Frais de service" value={quote.serviceFee} muted />}
            <div className="border-t border-border pt-2">
                <div className="flex items-baseline justify-between gap-3 text-xl font-extrabold text-foreground-strong">
                    <dt>Total</dt>
                    <dd key={quote.total} className="ev-count-pop inline-block tabular-nums" aria-live="polite">{formatFcfa(quote.total)}</dd>
                </div>
            </div>
            {quote.toPayNow !== quote.total && (
                <div className="space-y-1 rounded-xl bg-primary-soft p-3">
                    <Row label="À payer maintenant" value={quote.toPayNow} strong />
                    {quote.balanceDue > 0 && <Row label="Reste à payer à la remise" value={quote.balanceDue} muted />}
                </div>
            )}
        </dl>
    );
}

export interface CartPanelProps {
    menu: VenueMenu;
    products: Map<string, MenuProduct>;
    lines: CartLine[];
    step: CartStep;
    checkout: Checkout;
    timeChip: TimeChip | null;
    choices: TimeChoices;
    quote: QuoteState;
    signedIn: boolean;
    loginHref: string;
    busy: boolean;
    submitError: string | null;
    /** Prix changé entre l'affichage et la commande : ancien et nouveau prix servis par les deux devis (idée 8). */
    priceChange?: PriceChange | null;
    /** La base a dit « le prix a changé » et le nouveau devis est en cours de lecture. */
    priceChangePending?: boolean;
    highlightProductId: string | null;
    onQuantity: (key: string, quantity: number) => void;
    onStep: (step: CartStep) => void;
    onCheckout: (patch: Partial<Checkout>) => void;
    onTime: (chip: TimeChip, value: string | null) => void;
    onRetryQuote: () => void;
    onSubmit: () => void;
    onBrowse?: () => void;
}

/**
 * Lot 12b — panier (colonne collante sur ordinateur, feuille du bas sur téléphone) : lignes, mode de remise, puis
 * « Finaliser » : heure, zone et adresse, table, téléphone, paiement, commentaire. Montants : devis de la base, relu à
 * chaque changement ; « Commander » n'est possible que sur un devis accepté par la base.
 */
export function CartPanel(props: CartPanelProps) {
    const { menu, products, lines, step, checkout, quote, signedIn } = props;
    if (lines.length === 0) return <EmptyCart onBrowse={props.onBrowse} />;

    const hasDaily = lines.some((l) => products.get(l.productId)?.daily);
    const payments: Array<{ value: OrderPaymentChoice; label: string }> = [{ value: 'INTEGRAL', label: 'Tout payer' }];
    if (!hasDaily && menu.ordering.depositPercent !== null) payments.push({ value: 'ACOMPTE', label: `Acompte de ${menu.ordering.depositPercent} %` });
    if (!hasDaily && menu.ordering.payOnHandover) payments.push({ value: 'DIFFERE', label: 'À la remise' });
    const canOrder = signedIn && quote.status === 'ready' && !props.busy;

    return (
        <div className="space-y-5">
            {step === 'checkout' && (
                <Button variant="ghost" size="sm" className="-ml-3" leftIcon={<ArrowLeft size={18} />} onClick={() => props.onStep('cart')}>
                    Modifier le panier
                </Button>
            )}

            {step === 'cart' && (
                <ul className="divide-y divide-border" aria-label="Plats du panier">
                    {lines.map((l) => {
                        const p = products.get(l.productId);
                        const opts = p ? p.options.filter((o) => l.optionIds.includes(o.id)).map((o) => o.name) : [];
                        const flagged = props.highlightProductId === l.productId;
                        return (
                            <li key={l.key} className={cn('flex items-start gap-3 py-3', flagged && 'rounded-xl bg-warning-soft px-2')}>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground-strong">{p?.name ?? 'Plat'}</p>
                                    {opts.length > 0 && <p className="text-sm text-muted-foreground">{opts.join(', ')}</p>}
                                    {l.notes && <p className="text-sm italic text-muted-foreground">{`« ${l.notes} »`}</p>}
                                    {p && <p className="text-sm tabular-nums text-muted-foreground">{`${formatFcfa(p.price)} l’unité`}</p>}
                                    {flagged && <p className="text-sm font-semibold text-warning-text">Ce plat empêche la commande.</p>}
                                </div>
                                <div className="flex items-center rounded-full border border-border" role="group" aria-label={`Quantité de ${p?.name ?? 'ce plat'}`}>
                                    <IconButton aria-label={l.quantity <= 1 ? `Retirer ${p?.name ?? 'ce plat'}` : `Un ${p?.name ?? 'plat'} de moins`} onClick={() => props.onQuantity(l.key, l.quantity - 1)}>
                                        {l.quantity <= 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                                    </IconButton>
                                    <span className="min-w-6 text-center font-bold tabular-nums text-foreground-strong">{l.quantity}</span>
                                    <IconButton aria-label={`Un ${p?.name ?? 'plat'} de plus`} onClick={() => props.onQuantity(l.key, l.quantity + 1)} disabled={l.quantity >= 99}>
                                        <Plus size={16} />
                                    </IconButton>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {menu.ordering.modes.length > 0 && (
                <fieldset className="space-y-2">
                    <legend className="mb-2 text-base font-semibold text-foreground-strong">Comment ?</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3" role="radiogroup" aria-label="Mode de remise">
                        {menu.ordering.modes.map((m) => (
                            <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={checkout.mode === m}
                                onClick={() => props.onCheckout({ mode: m })}
                                className={cn(
                                    'min-h-14 rounded-xl border px-3 py-2 text-left transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    checkout.mode === m ? 'border-brand-vif bg-primary-soft' : 'border-border bg-card hover:bg-muted',
                                )}
                            >
                                <span className="block font-semibold text-foreground-strong">{ORDER_MODE_LABELS[m]}</span>
                                <span className="block text-sm text-muted-foreground">{MODE_HINTS[m]}</span>
                            </button>
                        ))}
                    </div>
                </fieldset>
            )}

            {step === 'checkout' && (
                <>
                    {checkout.mode === 'LIVRAISON' && (
                        <div className="space-y-3">
                            <Select
                                label="Zone de livraison"
                                required
                                value={checkout.zoneId ?? ''}
                                placeholder="Choisir votre quartier"
                                onChange={(e) => props.onCheckout({ zoneId: e.target.value || null })}
                                options={menu.zones.map((z) => ({
                                    value: z.id,
                                    label: `${z.name} · livraison ${formatFcfa(z.fee)}${z.minOrder > 0 ? ` · dès ${formatFcfa(z.minOrder)}` : ''}`,
                                }))}
                            />
                            <TextInput
                                label="Adresse de livraison"
                                required
                                autoComplete="street-address"
                                hint="Quartier, rue, un repère proche."
                                value={checkout.address}
                                maxLength={300}
                                onChange={(e) => props.onCheckout({ address: e.target.value })}
                            />
                        </div>
                    )}
                    {checkout.mode === 'SUR_PLACE' && (
                        menu.spots.length > 0 ? (
                            <Select
                                label="Votre table"
                                required
                                value={checkout.spotId ?? ''}
                                placeholder="Choisir votre table"
                                onChange={(e) => props.onCheckout({ spotId: e.target.value || null })}
                                options={menu.spots.map((s) => ({ value: s.id, label: s.zone ? `Table ${s.label} · ${s.zone}` : `Table ${s.label}` }))}
                            />
                        ) : (
                            <TextInput
                                label="Où êtes-vous ?"
                                required
                                hint="Par exemple : terrasse, près de l’entrée."
                                value={checkout.spotLabel}
                                maxLength={40}
                                onChange={(e) => props.onCheckout({ spotLabel: e.target.value })}
                            />
                        )
                    )}
                    <fieldset className="space-y-2">
                        <legend className="mb-2 text-base font-semibold text-foreground-strong">Pour quand ?</legend>
                        <TimePicker choices={props.choices} today={menu.ordering.now.slice(0, 10)} chip={props.timeChip} value={checkout.scheduledFor} onChange={props.onTime} />
                    </fieldset>
                    <TextInput
                        label={checkout.mode === 'LIVRAISON' ? 'Numéro à appeler pour la livraison' : 'Votre numéro'}
                        required={checkout.mode === 'LIVRAISON'}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={checkout.phone}
                        maxLength={20}
                        onChange={(e) => props.onCheckout({ phone: e.target.value })}
                    />
                    <fieldset className="space-y-2">
                        <legend className="mb-2 text-base font-semibold text-foreground-strong">Paiement</legend>
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Part à payer">
                            {payments.map((p) => (
                                <button key={p.value} type="button" role="radio" aria-checked={checkout.payment === p.value}
                                    className={chipClass(checkout.payment === p.value)} onClick={() => props.onCheckout({ payment: p.value })}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {hasDaily && <p className="text-sm text-muted-foreground">Le plat du jour se paie en entier, en ligne.</p>}
                        {checkout.payment === 'DIFFERE' && <p className="text-sm text-muted-foreground">Vous payez à la remise, directement à l’établissement.</p>}
                    </fieldset>
                    <Textarea
                        label="Un mot pour l’établissement ?"
                        value={checkout.comment}
                        maxLength={COMMENT_MAX}
                        showCount
                        rows={2}
                        onChange={(e) => props.onCheckout({ comment: e.target.value })}
                    />
                </>
            )}

            <section aria-label="Montant de la commande" className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <Amounts state={quote} loginHref={props.loginHref} onRetry={props.onRetryQuote} mode={checkout.mode} today={menu.ordering.now.slice(0, 10)} />
            </section>

            {props.submitError && (
                <StatusBanner tone="danger" announce="alert" title="Commande non envoyée">{props.submitError}</StatusBanner>
            )}
            {props.priceChangePending && (
                <StatusBanner tone="warning" announce="alert" title="Le prix a changé">Le nouveau prix s’affiche dans un instant : rien n’a été commandé.</StatusBanner>
            )}
            {props.priceChange && (
                <StatusBanner tone="warning" announce="alert" title="Le prix a changé" className="ev-fade-in">
                    <div data-testid="prix-change">
                        <p>Rien n’a été commandé. Voici les nouveaux prix :</p>
                        <ul className="mt-2 space-y-1">
                            {props.priceChange.lines.map((l, i) => (
                                <li key={`${l.name}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3">
                                    <span className="font-semibold">{l.quantity > 1 ? `${l.name} × ${l.quantity}` : l.name}</span>
                                    <span className="tabular-nums">
                                        <span className="line-through opacity-70">{formatFcfa(l.before)}</span>
                                        <span aria-hidden="true">{' → '}</span>
                                        <span className="sr-only">{' devient '}</span>
                                        <span className="font-bold">{formatFcfa(l.after)}</span>
                                    </span>
                                </li>
                            ))}
                            <li className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-current/20 pt-1">
                                <span className="font-semibold">Total</span>
                                <span className="tabular-nums">
                                    <span className="line-through opacity-70">{formatFcfa(props.priceChange.totalBefore)}</span>
                                    <span aria-hidden="true">{' → '}</span>
                                    <span className="sr-only">{' devient '}</span>
                                    <span className="font-bold">{formatFcfa(props.priceChange.totalAfter)}</span>
                                </span>
                            </li>
                        </ul>
                    </div>
                </StatusBanner>
            )}

            {step === 'cart' ? (
                <Button variant="primary" size="lg" fullWidth onClick={() => props.onStep('checkout')} disabled={!checkout.mode}>
                    Finaliser
                </Button>
            ) : (
                <Button variant="gradient" fullWidth onClick={props.onSubmit} disabled={!canOrder} isLoading={props.busy}>
                    {props.busy ? 'Envoi de la commande…' : props.priceChange && quote.status === 'ready' ? <span className="tabular-nums">{`Commander à ${formatFcfa(quote.quote.total)}`}</span> : 'Commander'}
                </Button>
            )}
            {step === 'checkout' && (
                <p className="text-sm text-muted-foreground">
                    {checkout.payment === 'DIFFERE'
                        ? 'La commande part tout de suite à l’établissement.'
                        : 'Vous payez à l’écran suivant, avec Wave ou Orange Money. Rien n’est débité avant.'}
                </p>
            )}
        </div>
    );
}
