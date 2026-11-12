'use client';

/**
 * Vente au guichet en espèces = entrée immédiate (lot 5, C7 ; écran du lot 7, D53). Tout chiffre vient du
 * serveur :
 *  - GET /api/controller/counter-sale : guichet ouvert ou non, permission espèces, caisse ouverte,
 *    catégories actives vendues au guichet, avec prix et disponibilité (on_site_only : non vendue en ligne) ;
 *  - POST /api/controller/counter-sale/quote : total et lignes du devis (aucun total calculé ici) ;
 *  - POST /api/controller/counter-sale : vente, avec une clé d'idempotence par vente (une relance après une
 *    coupure rend la même vente, jamais une seconde).
 * Chargé à la demande (next/dynamic) depuis l'écran du scanner.
 * Lot 9 ter (9t.15, contrat C.1.4, arbitrage 18) : sur un événement à zones, une catégorie que le serveur dit non admise à
 * la porte du vendeur (`admitted_at_gate` faux) est inactive avec « N’entre pas par votre porte » ; les refus GATE_REQUIRED
 * et CATEGORY_NOT_ADMITTED_AT_GATE de la vente sont affichés avec le texte du serveur.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Banknote, Minus, Plus, Receipt, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { formatFcfa, formatInteger } from '@/lib/format';
import { newIdempotencyKey } from './scan-client';

interface SaleCategory { id: string; name: string; price: number; available: number; on_site_only?: boolean; admitted_at_gate?: boolean }
interface CounterState {
    enabled: boolean;
    can_accept_cash: boolean;
    open_shift: { id: string } | null;
    categories: SaleCategory[];
}
interface Quote { total: number; lines: Array<{ category_id: string; name: string; unit_price: number; quantity: number; amount: number }> }

export interface CounterSalePanelProps {
    eventId: string;
    /** Ouvre la caisse (modale du scanner). */
    onOpenShift: () => void;
    /** Vente enregistrée : la page relit la caisse et les compteurs. */
    onSold: () => void;
    /** Session expirée. */
    onSessionExpired: () => void;
}

const MAX_PER_CATEGORY = 50;

async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
    try {
        return (await res.json()) as Record<string, unknown>;
    } catch (err) {
        console.warn(`[guichet] ${what} : réponse HTTP ${res.status} illisible`, err instanceof Error ? err.message : String(err));
        return {};
    }
}

export function CounterSalePanel({ eventId, onOpenShift, onSold, onSessionExpired }: CounterSalePanelProps) {
    const phoneId = useId();
    const [state, setState] = useState<CounterState | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [quote, setQuote] = useState<Quote | null>(null);
    const [quoting, setQuoting] = useState(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [phone, setPhone] = useState('');
    const [selling, setSelling] = useState(false);
    const [saleError, setSaleError] = useState<string | null>(null);
    const [sold, setSold] = useState<string | null>(null);
    /** Clé de la vente en cours : gardée jusqu'au succès (relance sans doublon), renouvelée ensuite. */
    const saleKeyRef = useRef<string | null>(null);
    const quoteSeqRef = useRef(0);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const res = await fetch(`/api/controller/counter-sale?event_id=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
            if (res.status === 401) { onSessionExpired(); return; }
            const body = await readJson(res, 'guichet');
            if (!res.ok) {
                setLoadError(typeof body.error === 'string' ? body.error : 'Le guichet n’a pas pu être chargé.');
                return;
            }
            setState({
                enabled: body.enabled === true,
                can_accept_cash: body.can_accept_cash === true,
                open_shift: body.open_shift && typeof body.open_shift === 'object' ? { id: String((body.open_shift as { id?: unknown }).id) } : null,
                categories: Array.isArray(body.categories) ? (body.categories as SaleCategory[]) : [],
            });
        } catch (err) {
            console.warn('[guichet] lecture : réseau indisponible', err instanceof Error ? err.message : String(err));
            setLoadError('Réseau indisponible : le guichet n’a pas pu être chargé.');
        }
    }, [eventId, onSessionExpired]);

    useEffect(() => { void load(); }, [load]);

    const items = Object.entries(quantities).filter(([, q]) => q > 0).map(([categoryId, quantity]) => ({ categoryId, quantity }));
    const itemsKey = JSON.stringify(items);

    // Devis relu par le serveur à chaque changement (anti-rebond 300 ms ; seule la dernière réponse compte)
    useEffect(() => {
        const parsed = JSON.parse(itemsKey) as Array<{ categoryId: string; quantity: number }>;
        setQuote(null);
        setQuoteError(null);
        if (parsed.length === 0) return;
        const seq = ++quoteSeqRef.current;
        const timer = setTimeout(async () => {
            setQuoting(true);
            try {
                const res = await fetch('/api/controller/counter-sale/quote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId, items: parsed }),
                    cache: 'no-store',
                });
                const body = await readJson(res, 'devis');
                if (seq !== quoteSeqRef.current) return;
                if (res.status === 401) { onSessionExpired(); return; }
                if (!res.ok) {
                    setQuoteError(typeof body.error === 'string' ? body.error : 'Devis refusé.');
                    return;
                }
                setQuote({ total: Number(body.total), lines: Array.isArray(body.lines) ? (body.lines as Quote['lines']) : [] });
            } catch (err) {
                if (seq !== quoteSeqRef.current) return;
                console.warn('[guichet] devis : réseau indisponible', err instanceof Error ? err.message : String(err));
                setQuoteError('Réseau indisponible : le total n’a pas pu être calculé.');
            } finally {
                if (seq === quoteSeqRef.current) setQuoting(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [itemsKey, eventId, onSessionExpired]);

    const setQuantity = (id: string, next: number) => {
        saleKeyRef.current = null;
        setSold(null);
        setSaleError(null);
        setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(MAX_PER_CATEGORY, next)) }));
    };

    const sell = async () => {
        if (!quote || selling || items.length === 0) return;
        setSelling(true);
        setSaleError(null);
        saleKeyRef.current = saleKeyRef.current ?? newIdempotencyKey();
        try {
            const res = await fetch('/api/controller/counter-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': saleKeyRef.current },
                body: JSON.stringify({ eventId, items, buyerPhone: phone.trim() || null }),
                cache: 'no-store',
            });
            const body = await readJson(res, 'vente');
            if (res.status === 401) { onSessionExpired(); return; }
            if (!res.ok) {
                if (res.status < 500) saleKeyRef.current = null;
                setSaleError(typeof body.error === 'string' ? body.error : 'Vente refusée.');
                return;
            }
            const count = Array.isArray(body.ticket_ids) ? body.ticket_ids.length : 0;
            const amount = Number(body.amount);
            const receipt = body.receipt_requested === true
                ? (body.receipt_queued === true ? ' Reçu SMS envoyé à l’acheteur.' : ' Le reçu SMS n’a pas pu être envoyé.')
                : '';
            setSold(`Vente enregistrée : ${formatInteger(count)} entrée${count > 1 ? 's' : ''}, ${formatFcfa(Number.isFinite(amount) ? amount : null)} encaissés.${receipt}`);
            saleKeyRef.current = null;
            setQuantities({});
            setPhone('');
            onSold();
            void load();
        } catch (err) {
            console.warn('[guichet] vente : réseau indisponible (la même clé sera reprise)', err instanceof Error ? err.message : String(err));
            setSaleError('Réseau indisponible : la vente n’est pas confirmée. Réessayez, elle ne sera pas comptée deux fois.');
        } finally {
            setSelling(false);
        }
    };

    if (loadError) {
        return (
            <StatusBanner tone="danger" title="Guichet indisponible" announce="alert"
                action={<Button variant="secondary" onClick={() => void load()} leftIcon={<RefreshCw size={16} />}>Réessayer</Button>}>
                {loadError}
            </StatusBanner>
        );
    }
    if (!state) return <p role="status" className="text-sm text-fg-muted">Chargement du guichet…</p>;
    if (!state.enabled || !state.can_accept_cash) {
        return (
            <StatusBanner tone="neutral" title="Vente au guichet fermée">
                {state.enabled ? 'Votre affectation n’autorise pas l’encaissement d’espèces.' : 'La vente au guichet est désactivée pour la plateforme.'}
            </StatusBanner>
        );
    }
    if (!state.open_shift) {
        return (
            <StatusBanner tone="warning" title="Caisse fermée"
                action={<Button variant="primary" onClick={onOpenShift} leftIcon={<Banknote size={18} />}>Ouvrir ma caisse</Button>}>
                Ouvrez votre caisse avec le régisseur avant de vendre un billet au guichet.
            </StatusBanner>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {state.categories.length === 0 ? (
                <p className="text-sm text-fg-muted">Aucune catégorie de billet n’est en vente pour cet événement.</p>
            ) : (
                <ul className="flex flex-col gap-2" aria-label="Catégories en vente">
                    {state.categories.map((c) => {
                        const q = quantities[c.id] ?? 0;
                        const notHere = c.admitted_at_gate === false;
                        return (
                            <li key={c.id} className={cn('flex items-center gap-3 rounded-2xl border border-border p-3', notHere ? 'bg-surface-sunken' : 'bg-surface')}>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="break-words text-base font-semibold text-fg">{c.name}</span>
                                    {notHere && <span className="text-sm font-semibold text-warning-fg">N’entre pas par votre porte</span>}
                                    {c.on_site_only && <span className="text-sm font-medium text-brand-fg">Sur place uniquement</span>}
                                    <span className="text-sm text-fg-muted tabular-nums">
                                        <span className="block whitespace-nowrap sm:inline">{formatFcfa(c.price)}</span>
                                        <span className="hidden sm:inline"> · </span>
                                        <span className="block whitespace-nowrap sm:inline">{formatInteger(c.available)} disponible{c.available > 1 ? 's' : ''}</span>
                                    </span>
                                </span>
                                <IconButton aria-label={`Retirer un billet ${c.name}`} variant="secondary" disabled={q === 0 || selling} onClick={() => setQuantity(c.id, q - 1)}>
                                    <Minus size={18} />
                                </IconButton>
                                <span aria-live="polite" className="min-w-8 text-center text-lg font-bold tabular-nums text-fg">{formatInteger(q)}</span>
                                <IconButton aria-label={`Ajouter un billet ${c.name}`} variant="secondary" disabled={notHere || q >= c.available || q >= MAX_PER_CATEGORY || selling} onClick={() => setQuantity(c.id, q + 1)}>
                                    <Plus size={18} />
                                </IconButton>
                            </li>
                        );
                    })}
                </ul>
            )}

            <TextInput
                id={phoneId}
                label="Numéro de l’acheteur (facultatif)"
                hint="Pour être prévenu en cas de changement ou d’annulation. Le billet n’est rattaché à aucun compte."
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={selling}
            />

            {quoteError && <StatusBanner tone="danger" title="Total indisponible" announce="alert">{quoteError}</StatusBanner>}
            {saleError && <StatusBanner tone="danger" title="Vente non enregistrée" announce="alert">{saleError}</StatusBanner>}
            {sold && <StatusBanner tone="success" title="Vente enregistrée">{sold}</StatusBanner>}

            {quote && (
                <section aria-label="Total à encaisser" className="flex flex-col gap-1 rounded-2xl border border-border-strong bg-surface-sunken p-4">
                    {quote.lines.map((l) => (
                        <p key={l.category_id} className="flex justify-between gap-3 text-sm text-fg tabular-nums">
                            <span>{formatInteger(l.quantity)} × {l.name}</span>
                            <span>{formatFcfa(l.amount)}</span>
                        </p>
                    ))}
                    <p className="flex justify-between gap-3 border-t border-border pt-2 text-lg font-bold text-fg tabular-nums">
                        <span>À encaisser</span>
                        <span>{formatFcfa(quote.total)}</span>
                    </p>
                </section>
            )}

            <Button variant="primary" size="lg" fullWidth isLoading={selling || quoting} disabled={!quote || items.length === 0}
                className="tabular-nums" onClick={() => void sell()} leftIcon={<Receipt size={18} />}>
                {quote ? `J’ai reçu ${formatFcfa(quote.total)} : valider la vente` : 'Choisissez au moins un billet'}
            </Button>
        </div>
    );
}
