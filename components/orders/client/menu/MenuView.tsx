'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { PhoneVerifyDialog } from '@/components/tickets/PhoneVerifyDialog';
import { formatFcfa } from '@/lib/format';
import { dropSavedCart, loadSavedCart, storeSavedCart } from '@/lib/orders/device-store';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { formatLocalPhone, isUncertainOutcome, useIdempotencyKey } from '@/lib/payments/payment-client';
import type { MenuProduct, VenueMenu } from '@/lib/orders/menu-types';
import {
    addLine, itemCount, makeLine, orderBody, reconcileLines, refusalText, setLineQuantity, timeChoices, useOrderQuote,
    type CartLine, type Checkout,
} from '@/lib/orders/cart-client';
import { CartPanel, type CartStep } from './CartPanel';
import { CategoryTabs, type MenuSection } from './CategoryTabs';
import { DailyBanner } from './DailyBanner';
import { MenuHeader } from './MenuHeader';
import { ProductCard } from './ProductCard';
import { ProductSheet } from './ProductSheet';
import type { TimeChip } from './TimePicker';

/**
 * Lot 12b — carte des plats d'un établissement et panier (la vitrine du restaurant).
 *
 *  - Carte servie par la base (order_venue_menu), rendue par la page serveur : grandes photos, onglets collants,
 *    plat du jour en bandeau, plats épuisés ou non commandables visibles avec une pastille douce.
 *  - Panier : colonne collante sur ordinateur, feuille du bas sur téléphone ; montants = devis de la base, relu à chaque
 *    changement (aucun montant calculé ici) ; refus affichés tels quels.
 *  - Panier gardé sur l'appareil (préférences de l'appareil, sans prix, effacées à la déconnexion) ; « Commander à
 *    nouveau » (?reprendre=<commande>) : plats et suppléments encore disponibles repris, les autres signalés.
 *  - « Commander » : commande créée au prix affiché (clé d'idempotence, total et montant à payer comparés en base), puis
 *    le suivi /orders/<id>, où se fait le paiement.
 */

const NETWORK = 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez : votre commande ne sera pas envoyée deux fois.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function droppedText(names: string[]): string {
    return names.length === 1 ? `« ${names[0]} » n’est plus disponible : il n’a pas été remis dans le panier.`
        : `Ces plats ne sont plus disponibles et n’ont pas été remis dans le panier : ${names.map((n) => `« ${n} »`).join(', ')}.`;
}

export function MenuView({ menu, reorderId }: { menu: VenueMenu; reorderId: string | null }) {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, profile } = useAuth();
    const venueId = menu.venue.id;
    const pagePath = `/restaurants/${venueId}/menu`;
    const loginHref = `/login?redirect=${encodeURIComponent(pagePath)}`;

    const products = useMemo(() => new Map(menu.products.map((p) => [p.id, p])), [menu.products]);
    const daily = useMemo(() => menu.products.filter((p) => p.daily), [menu.products]);
    const sections = useMemo(() => {
        const list: Array<MenuSection & { items: MenuProduct[] }> = [];
        for (const c of menu.categories) {
            const items = menu.products.filter((p) => !p.daily && p.categoryId === c.id);
            if (items.length > 0) list.push({ id: `categorie-${c.id}`, name: c.name, items });
        }
        const others = menu.products.filter((p) => !p.daily && (!p.categoryId || !menu.categories.some((c) => c.id === p.categoryId)));
        if (others.length > 0) list.push({ id: 'categorie-autres', name: list.length > 0 ? 'Autres plats' : 'La carte', items: others });
        return list;
    }, [menu.categories, menu.products]);
    const choices = useMemo(() => timeChoices(menu), [menu]);

    const [lines, setLines] = useState<CartLine[]>([]);
    const [restored, setRestored] = useState(false);
    const [dropped, setDropped] = useState<string[]>([]);
    const [reorderNote, setReorderNote] = useState<string | null>(null);
    const [open, setOpen] = useState<MenuProduct | null>(null);
    const [sheet, setSheet] = useState(false);
    const [step, setStep] = useState<CartStep>('cart');
    const [timeChip, setTimeChip] = useState<TimeChip | null>(choices.asap ? 'asap' : null);
    const [checkout, setCheckout] = useState<Checkout>({
        // À emporter par défaut quand l'établissement le propose (aucune zone ni adresse à saisir : total tout de suite)
        mode: menu.ordering.modes.includes('RETRAIT') ? 'RETRAIT' : (menu.ordering.modes[0] ?? null), payment: 'INTEGRAL', zoneId: null, address: '', phone: '', spotId: null, spotLabel: '',
        scheduledFor: choices.asap ? null : choices.slots[0] ?? null, comment: '',
    });
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [verifyRetry, setVerifyRetry] = useState<(() => void) | null>(null);
    const [flash, setFlash] = useState<{ id: number; text: string; moved: boolean } | null>(null);
    const [bump, setBump] = useState(0);
    const attempt = useIdempotencyKey();
    const phoneFilled = useRef(false);

    // Téléphone prérempli une fois depuis le profil (jamais par-dessus une saisie)
    useEffect(() => {
        if (phoneFilled.current) return;
        const p = normalizePayerPhone(profile?.phone);
        if (p) {
            phoneFilled.current = true;
            setCheckout((c) => (c.phone ? c : { ...c, phone: formatLocalPhone(p) }));
        }
    }, [profile?.phone]);

    // Reprise : « Commander à nouveau » (compte connecté), sinon le panier gardé sur l'appareil
    useEffect(() => {
        if (restored || authLoading) return;
        let cancelled = false;
        const fromDevice = async () => {
            const saved = await loadSavedCart(venueId);
            if (cancelled) return;
            if (saved) {
                const r = reconcileLines(menu, saved.lines);
                setLines(r.lines);
                setDropped(r.dropped);
                if (saved.mode && menu.ordering.modes.includes(saved.mode)) setCheckout((c) => ({ ...c, mode: saved.mode }));
            }
            setRestored(true);
        };
        if (!reorderId || !UUID_RE.test(reorderId)) {
            void fromDevice();
            return () => { cancelled = true; };
        }
        if (!isAuthenticated) {
            setReorderNote('Connectez-vous pour reprendre votre commande précédente.');
            void fromDevice();
            return () => { cancelled = true; };
        }
        (async () => {
            try {
                const res = await fetch(`/api/orders/${encodeURIComponent(reorderId)}`, { cache: 'no-store' });
                const body = (await res.json().catch(() => null)) as { order?: Record<string, unknown> } | null;
                if (cancelled) return;
                const order = res.ok ? body?.order : null;
                const venue = order?.venue as { id?: unknown } | undefined;
                if (!order || venue?.id !== venueId) {
                    setReorderNote('Cette commande ne peut pas être reprise ici.');
                    await fromDevice();
                    return;
                }
                const items = (Array.isArray(order.items) ? order.items : []) as Array<Record<string, unknown>>;
                const r = reconcileLines(menu, items.map((i) => ({
                    productId: String(i.product_id ?? ''),
                    quantity: Number(i.quantity ?? 1),
                    optionIds: (Array.isArray(i.options) ? i.options : []).map((o) => String((o as { id?: unknown }).id ?? '')),
                    notes: typeof i.notes === 'string' ? i.notes : '',
                    name: typeof i.name === 'string' ? i.name : undefined,
                })));
                setLines(r.lines);
                setDropped(r.dropped);
                const mode = menu.ordering.modes.find((m) => m === order.mode);
                if (mode) setCheckout((c) => ({ ...c, mode }));
                setReorderNote(r.lines.length > 0 ? 'Votre commande précédente est dans le panier : vérifiez-la avant de commander.' : null);
                setRestored(true);
                router.replace(pagePath, { scroll: false });
            } catch (err) {
                if (cancelled) return;
                console.error('[commande] reprise impossible :', err instanceof Error ? err.message : String(err));
                setReorderNote('Votre commande précédente n’a pas pu être reprise. Réessayez plus tard.');
                await fromDevice();
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [restored, authLoading, isAuthenticated, reorderId, venueId, menu, router, pagePath]);

    // Panier gardé sur l'appareil à chaque changement (sans prix)
    useEffect(() => {
        if (!restored) return;
        void storeSavedCart(venueId, { lines: lines.map(({ productId, quantity, optionIds, notes }) => ({ productId, quantity, optionIds, notes })), mode: checkout.mode });
    }, [restored, lines, checkout.mode, venueId]);

    const body = useMemo(() => (lines.length > 0 ? orderBody(venueId, lines, checkout) : null), [venueId, lines, checkout]);
    const { state: quote, reload } = useOrderQuote(body, lines.length > 0 && !authLoading, isAuthenticated);
    const highlight = quote.status === 'refused' ? quote.productId : null;

    const onAdd = useCallback((p: MenuProduct, quantity: number, optionIds: string[], notes: string) => {
        setLines((cur) => addLine(cur, makeLine(p.id, quantity, optionIds, notes)));
        setOpen(null);
        setSubmitError(null);
        setBump((b) => b + 1);
        const id = Date.now();
        setFlash({ id, text: `${quantity} × ${p.name}`, moved: false });
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => setFlash((f) => (f && f.id === id ? { ...f, moved: true } : f))));
        window.setTimeout(() => setFlash((f) => (f && f.id === id ? null : f)), 700);
    }, []);

    const onTime = useCallback((chip: TimeChip, value: string | null) => {
        setTimeChip(chip);
        setCheckout((c) => ({ ...c, scheduledFor: chip === 'asap' ? null : value }));
    }, []);

    const submit = useCallback(async () => {
        if (busy || quote.status !== 'ready' || !body) return;
        if (!isAuthenticated) {
            router.push(loginHref);
            return;
        }
        // Total et montant à payer AFFICHÉS, renvoyés tels quels : la base refuse s'ils ne correspondent plus
        const payload = { ...body, expectedTotal: quote.quote.total, expectedToPay: quote.quote.toPayNow };
        const key = attempt.keyFor(JSON.stringify(payload));
        setBusy(true);
        setSubmitError(null);
        let res: Response;
        try {
            res = await fetch('/api/orders/create', {
                method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload), cache: 'no-store',
            });
        } catch (err) {
            console.error('[commande] envoi impossible :', err instanceof Error ? err.message : String(err));
            setSubmitError(NETWORK);
            setBusy(false);
            return;
        }
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const order = data?.order as { id?: unknown } | undefined;
        if (res.ok && typeof order?.id === 'string') {
            await dropSavedCart(venueId);
            attempt.reset();
            router.push(`/orders/${order.id}`);
            return;
        }
        setBusy(false);
        if (!isUncertainOutcome(res.status)) attempt.reset();
        if (res.status === 401) {
            router.push(loginHref);
            return;
        }
        if (res.status === 403 && data?.code === 'PHONE_NOT_VERIFIED') {
            setVerifyRetry(() => () => { void submitRef.current(); });
            return;
        }
        if (data?.code === 'ORDER_PRICE_CHANGED') reload();
        setSubmitError(refusalText(data?.code, data?.error));
    }, [busy, quote, body, isAuthenticated, router, loginHref, attempt, venueId, reload]);
    const submitRef = useRef(submit);
    useEffect(() => {
        submitRef.current = submit;
    }, [submit]);

    const count = itemCount(lines);
    const inCart = (id: string) => lines.filter((l) => l.productId === id).reduce((n, l) => n + l.quantity, 0);
    const panel = (
        <CartPanel
            menu={menu}
            products={products}
            lines={lines}
            step={step}
            checkout={checkout}
            timeChip={timeChip}
            choices={choices}
            quote={quote}
            signedIn={isAuthenticated}
            loginHref={loginHref}
            busy={busy}
            submitError={submitError}
            highlightProductId={highlight}
            onQuantity={(key, q) => setLines((cur) => setLineQuantity(cur, key, q))}
            onStep={setStep}
            onCheckout={(patch) => setCheckout((c) => ({ ...c, ...patch }))}
            onTime={onTime}
            onRetryQuote={reload}
            onSubmit={() => { void submit(); }}
            onBrowse={() => setSheet(false)}
        />
    );
    const shownTotal = quote.status === 'ready' ? quote.quote.total : null;

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className={cn('min-w-0 space-y-6', count > 0 && 'pb-24 lg:pb-0')}>
                <MenuHeader menu={menu} />
                {reorderNote && <StatusBanner tone="info" title="Commander à nouveau">{reorderNote}</StatusBanner>}
                {dropped.length > 0 && (
                    <StatusBanner tone="warning" title="Certains plats ne sont plus disponibles">{droppedText(dropped)}</StatusBanner>
                )}
                <DailyBanner products={daily} onOpen={setOpen} />
                <CategoryTabs sections={sections} />
                {menu.products.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-card px-4 py-10 text-center">
                        <ShoppingBag size={32} aria-hidden="true" className="text-primary-text" />
                        <p className="text-lg font-bold text-foreground-strong">Aucun plat pour l’instant</p>
                        <p className="max-w-sm text-sm text-muted-foreground">L’établissement prépare sa carte. Revenez un peu plus tard.</p>
                    </div>
                ) : (
                    sections.map((s) => (
                        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titre`} className="scroll-mt-36 space-y-3">
                            <h2 id={`${s.id}-titre`} className="text-xl font-bold text-foreground-strong">{s.name}</h2>
                            <div className="ev-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {s.items.map((p) => <ProductCard key={p.id} product={p} inCart={inCart(p.id)} onOpen={setOpen} />)}
                            </div>
                        </section>
                    ))
                )}
            </div>

            {/* Ordinateur : colonne collante */}
            <aside aria-label="Votre panier" className="hidden lg:block">
                <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-sm">
                    <h2 className="flex items-center justify-between gap-2 text-xl font-bold text-foreground-strong">
                        <span>Votre panier</span>
                        {count > 0 && <span key={bump} className="ev-count-pop inline-flex min-h-8 min-w-8 items-center justify-center rounded-full bg-brand-vif px-2 text-sm font-bold tabular-nums text-brand-vif-foreground">{count}</span>}
                    </h2>
                    {panel}
                </div>
            </aside>

            {/* Téléphone : barre fixe au-dessus de la barre du bas, puis feuille */}
            {count > 0 && (
                <div className="fixed inset-x-0 bottom-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))] z-30 px-4 lg:hidden">
                    <button
                        type="button"
                        onClick={() => setSheet(true)}
                        className="ev-press mx-auto flex min-h-14 w-full max-w-md items-center justify-between gap-3 rounded-full bg-primary px-5 text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={`Voir le panier, ${count} article${count > 1 ? 's' : ''}`}
                    >
                        <span className="flex items-center gap-2 font-bold">
                            <span key={bump} className="ev-count-pop inline-flex min-h-8 min-w-8 items-center justify-center rounded-full bg-card px-2 text-sm tabular-nums text-foreground-strong">{count}</span>
                            Voir le panier
                        </span>
                        {shownTotal !== null && <span className="font-bold tabular-nums">{formatFcfa(shownTotal)}</span>}
                    </button>
                </div>
            )}
            {sheet && (
                <Modal isOpen onClose={() => setSheet(false)} title="Votre panier" sheetOnMobile maxWidth="lg" busy={busy}>
                    {panel}
                </Modal>
            )}

            {/* Ajout : le plat glisse vers le panier (transformation et opacité, coupées si « réduire les animations ») */}
            {flash && (
                <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-auto lg:left-auto lg:right-10 lg:top-28 lg:justify-end">
                    <span
                        className={cn('rounded-full bg-foreground-strong px-4 py-2 text-sm font-semibold text-background shadow-lg transition-[transform,opacity] duration-slow ease-out')}
                        style={{ transform: flash.moved ? 'translateY(24px) scale(0.9)' : 'translateY(0) scale(1)', opacity: flash.moved ? 0 : 1 }}
                    >
                        {`Ajouté : ${flash.text}`}
                    </span>
                </div>
            )}

            <ProductSheet product={open} onClose={() => setOpen(null)} onAdd={onAdd} />
            {verifyRetry && (
                <PhoneVerifyDialog
                    isOpen
                    phone={profile?.phone ?? null}
                    onClose={() => setVerifyRetry(null)}
                    onVerified={() => { const retry = verifyRetry; setVerifyRetry(null); retry(); }}
                />
            )}
        </div>
    );
}
