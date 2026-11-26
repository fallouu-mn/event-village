'use client';

/**
 * Lot 12b — panier d'une commande, côté écran : lignes choisies (produit, quantité, suppléments, note), heures
 * proposées, devis de la base et reprise d'un panier (gardé sur l'appareil, ou « Commander à nouveau »).
 *
 * Aucun montant n'est calculé ici : le devis vient de POST /api/orders/quote (relu à chaque changement, requêtes
 * dépassées annulées) ; les prix de la carte sont affichés tels que servis. Les heures proposées sont tirées des
 * fenêtres servies par la base (horaires moins fermetures, après la préparation), au quart d'heure : la base refait
 * tous les contrôles au devis et à la commande.
 */
import { useEffect, useRef, useState } from 'react';
import type { MenuProduct, OrderMode, OrderPaymentChoice, VenueMenu } from './menu-types';

// ── Lignes du panier ─────────────────────────────────────────────────────────────────────────────────────────────

export interface CartLine {
    /** Identité de la ligne : produit, suppléments triés et note (deux lignes identiques sont réunies). */
    key: string;
    productId: string;
    quantity: number;
    optionIds: string[];
    notes: string;
}

export const MAX_QUANTITY = 99;
export const MAX_LINES = 30;
export const NOTE_MAX = 200;
export const COMMENT_MAX = 300;

export function lineKey(productId: string, optionIds: string[], notes: string): string {
    return `${productId}|${[...optionIds].sort().join(',')}|${notes.trim()}`;
}

export function makeLine(productId: string, quantity: number, optionIds: string[], notes: string): CartLine {
    const clean = notes.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, NOTE_MAX);
    const q = Math.min(Math.max(Math.trunc(quantity), 1), MAX_QUANTITY);
    return { key: lineKey(productId, optionIds, clean), productId, quantity: q, optionIds: [...optionIds].sort(), notes: clean };
}

/** Ajoute une ligne (réunie avec une ligne identique ; 99 au plus par ligne, 30 lignes au plus). */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
    const found = lines.find((l) => l.key === line.key);
    if (found) return lines.map((l) => (l.key === line.key ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QUANTITY) } : l));
    if (lines.length >= MAX_LINES) return lines;
    return [...lines, line];
}

export function setLineQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
    if (quantity < 1) return lines.filter((l) => l.key !== key);
    return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, MAX_QUANTITY) } : l));
}

/** Nombre d'articles (somme des quantités : un compte, pas un montant). */
export function itemCount(lines: CartLine[]): number {
    return lines.reduce((n, l) => n + l.quantity, 0);
}

/**
 * Reprise de lignes (panier gardé, « Commander à nouveau ») : seules les lignes dont le produit est encore commandable
 * et dont chaque supplément existe encore sont gardées ; les autres sont rendues par leur nom, pour être signalées
 * (jamais retirées en silence).
 */
export function reconcileLines(
    menu: VenueMenu,
    wanted: Array<{ productId: string; quantity: number; optionIds: string[]; notes: string; name?: string }>,
): { lines: CartLine[]; dropped: string[] } {
    const byId = new Map<string, MenuProduct>(menu.products.map((p) => [p.id, p]));
    let lines: CartLine[] = [];
    const dropped: string[] = [];
    for (const w of wanted) {
        const p = byId.get(w.productId);
        const optionsOk = !!p && w.optionIds.every((id) => p.options.some((o) => o.id === id));
        if (!p || !p.orderable || !optionsOk) {
            const name = p?.name ?? w.name ?? 'Un plat';
            if (!dropped.includes(name)) dropped.push(name);
            continue;
        }
        lines = addLine(lines, makeLine(p.id, w.quantity, w.optionIds, w.notes));
    }
    return { lines, dropped };
}

// ── Heures proposées ─────────────────────────────────────────────────────────────────────────────────────────────

const QUARTER_MS = 15 * 60_000;
/** Heure de Dakar = UTC toute l'année : les chaînes « AAAA-MM-JJTHH:MM » sont lues et écrites en UTC. */
const toMs = (s: string): number => Date.parse(`${s}:00Z`);
const toSlot = (ms: number): string => new Date(ms).toISOString().slice(0, 16);

/** Créneaux au quart d'heure dans les fenêtres servies (début inclus, fin exclue), dans l'ordre. */
export function quarterSlots(windows: VenueMenu['ordering']['windows']): string[] {
    const out: string[] = [];
    for (const [start, end] of windows) {
        const a = toMs(start);
        const b = toMs(end);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        for (let t = Math.ceil(a / QUARTER_MS) * QUARTER_MS; t < b && out.length < 800; t += QUARTER_MS) out.push(toSlot(t));
    }
    return out;
}

export interface TimeChoices {
    asap: boolean;
    noon: string | null;
    evening: string | null;
    slots: string[];
}

/** Puces de l'heure : « Tout de suite », « Midi » (premier créneau dès 12:00 aujourd'hui), « Ce soir » (dès 19:00). */
export function timeChoices(menu: VenueMenu): TimeChoices {
    const slots = quarterSlots(menu.ordering.windows);
    const today = menu.ordering.now.slice(0, 10);
    const first = (fromHour: number, toHour: number) => slots.find((s) => {
        if (s.slice(0, 10) !== today) return false;
        const h = Number(s.slice(11, 13));
        return h >= fromHour && h < toHour;
    }) ?? null;
    return { asap: menu.ordering.asapAvailable, noon: first(12, 15), evening: first(19, 23), slots };
}

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Libellé d'un jour : « Aujourd'hui », « Demain », sinon « samedi 28 novembre ». */
export function dayLabel(day: string, today: string): string {
    if (day === today) return 'Aujourd’hui';
    if (toMs(`${day}T00:00`) - toMs(`${today}T00:00`) === 86_400_000) return 'Demain';
    const label = DAY_FMT.format(new Date(toMs(`${day}T12:00`)));
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** « 12:30 » → « 12 h 30 » ; « 19:00 » → « 19 h ». */
export function clockLabel(slot: string): string {
    const h = Number(slot.slice(11, 13));
    const m = slot.slice(14, 16);
    return m === '00' ? `${h} h` : `${h} h ${m}`;
}

/** Heure choisie en mots : « Aujourd'hui à 12 h 30 ». */
export function slotLabel(slot: string, today: string): string {
    return `${dayLabel(slot.slice(0, 10), today)} à ${clockLabel(slot)}`;
}

// ── Commande en cours de saisie ──────────────────────────────────────────────────────────────────────────────────

export interface Checkout {
    mode: OrderMode | null;
    payment: OrderPaymentChoice;
    zoneId: string | null;
    address: string;
    phone: string;
    spotId: string | null;
    spotLabel: string;
    /** null : « Tout de suite ». */
    scheduledFor: string | null;
    comment: string;
}

/** Corps commun du devis et de la commande : des choix seulement, jamais un montant. */
export function orderBody(venueId: string, lines: CartLine[], c: Checkout): Record<string, unknown> {
    return {
        venueId,
        mode: c.mode,
        payment: c.payment,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, optionIds: l.optionIds, notes: l.notes.trim() || undefined })),
        zoneId: c.mode === 'LIVRAISON' ? c.zoneId : undefined,
        address: c.mode === 'LIVRAISON' ? c.address.trim() || undefined : undefined,
        phone: c.phone.trim() || undefined,
        onsiteTableId: c.mode === 'SUR_PLACE' ? c.spotId ?? undefined : undefined,
        onsiteLabel: c.mode === 'SUR_PLACE' && !c.spotId ? c.spotLabel.trim() || undefined : undefined,
        scheduledFor: c.scheduledFor ?? undefined,
        notes: c.comment.trim() || undefined,
    };
}

// ── Devis de la base ─────────────────────────────────────────────────────────────────────────────────────────────

export interface OrderQuote {
    lines: Array<{ productId: string; name: string; quantity: number; unitPrice: number; totalPrice: number; options: Array<{ id: string; name: string; price: number }> }>;
    zoneName: string | null;
    itemsAmount: number;
    deliveryFee: number;
    goodsTotal: number;
    depositPercent: number | null;
    serviceFee: number;
    total: number;
    toPayNow: number;
    balanceDue: number;
    scheduledFor: string | null;
    asap: boolean;
}

export type QuoteState =
    | { status: 'idle' }
    | { status: 'loading'; previous: OrderQuote | null }
    | { status: 'ready'; quote: OrderQuote }
    | { status: 'refused'; message: string; code: string | null; productId: string | null }
    | { status: 'signin' }
    | { status: 'error'; message: string };

/** Refus qui veulent seulement dire « il manque un choix » (zone, adresse, table, téléphone) : ton doux. */
export const INCOMPLETE_CODES: ReadonlySet<string> = new Set(['ZONE_NOT_FOUND', 'ADDRESS_REQUIRED', 'PHONE_REQUIRED', 'SPOT_REQUIRED']);

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function readQuote(body: unknown): OrderQuote | null {
    if (!body || typeof body !== 'object') return null;
    const q = (body as Record<string, unknown>).quote;
    if (!q || typeof q !== 'object') return null;
    const r = q as Record<string, unknown>;
    if (!Number.isFinite(Number(r.total)) || !Number.isFinite(Number(r.toPayNow))) return null;
    const lines = Array.isArray(r.lines) ? r.lines : [];
    return {
        lines: lines.filter((l): l is Record<string, unknown> => !!l && typeof l === 'object').map((l) => ({
            productId: String(l.productId ?? ''),
            name: String(l.name ?? ''),
            quantity: num(l.quantity),
            unitPrice: num(l.unitPrice),
            totalPrice: num(l.totalPrice),
            options: (Array.isArray(l.options) ? l.options : []).filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
                .map((o) => ({ id: String(o.id ?? ''), name: String(o.name ?? ''), price: num(o.price) })),
        })),
        zoneName: typeof r.zoneName === 'string' ? r.zoneName : null,
        itemsAmount: num(r.itemsAmount),
        deliveryFee: num(r.deliveryFee),
        goodsTotal: num(r.goodsTotal),
        depositPercent: r.depositPercent === null || r.depositPercent === undefined ? null : num(r.depositPercent),
        serviceFee: num(r.serviceFee),
        total: num(r.total),
        toPayNow: num(r.toPayNow),
        balanceDue: num(r.balanceDue),
        scheduledFor: typeof r.scheduledFor === 'string' ? r.scheduledFor : null,
        asap: r.asap === true,
    };
}

const NETWORK = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

/**
 * Devis relu à chaque changement du corps (anti-rebond de 350 ms ; requête précédente annulée). `enabled` faux (panier
 * vide, visiteur) : aucun appel. `reload()` force une nouvelle lecture (prix changé).
 */
export function useOrderQuote(body: Record<string, unknown> | null, enabled: boolean, signedIn: boolean): { state: QuoteState; reload: () => void } {
    const [state, setState] = useState<QuoteState>({ status: 'idle' });
    const [nonce, setNonce] = useState(0);
    const last = useRef<OrderQuote | null>(null);
    const json = body ? JSON.stringify(body) : null;

    useEffect(() => {
        if (!enabled || !json) {
            setState({ status: 'idle' });
            return;
        }
        if (!signedIn) {
            setState({ status: 'signin' });
            return;
        }
        const ctrl = new AbortController();
        setState({ status: 'loading', previous: last.current });
        const timer = window.setTimeout(async () => {
            let res: Response;
            try {
                res = await fetch('/api/orders/quote', {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: json, signal: ctrl.signal, cache: 'no-store',
                });
            } catch (err) {
                if (ctrl.signal.aborted) return;
                console.error('[commande] devis injoignable :', err instanceof Error ? err.message : String(err));
                setState({ status: 'error', message: NETWORK });
                return;
            }
            let data: unknown = null;
            try {
                data = await res.json();
            } catch (err) {
                console.error('[commande] devis illisible :', err instanceof Error ? err.message : String(err));
            }
            if (ctrl.signal.aborted) return;
            if (res.status === 401) {
                setState({ status: 'signin' });
                return;
            }
            const quote = res.ok ? readQuote(data) : null;
            if (quote) {
                last.current = quote;
                setState({ status: 'ready', quote });
                return;
            }
            const d = (data ?? {}) as Record<string, unknown>;
            if (!res.ok && typeof d.error === 'string') {
                setState({ status: 'refused', message: d.error, code: typeof d.code === 'string' ? d.code : null, productId: typeof d.product_id === 'string' ? d.product_id : null });
                return;
            }
            setState({ status: 'error', message: 'Le total ne peut pas être calculé pour le moment. Réessayez.' });
        }, 350);
        return () => {
            ctrl.abort();
            window.clearTimeout(timer);
        };
    }, [json, enabled, signedIn, nonce]);

    return { state, reload: () => setNonce((n) => n + 1) };
}

// ── Petites aides d'affichage ────────────────────────────────────────────────────────────────────────────────────

/** Plage d'aujourd'hui (« 12 h – 23 h »), et « ouvert maintenant » d'après les horaires servis et l'heure de la base. */
export function todayHours(menu: VenueMenu): { text: string | null; open: boolean } {
    const now = menu.ordering.now;
    const ms = toMs(now);
    if (!Number.isFinite(ms)) return { text: null, open: false };
    const iso = ((new Date(ms).getUTCDay() + 6) % 7) + 1;
    const ranges = menu.hours.filter((h) => h[0] === iso);
    const label = (t: string) => {
        const [h, m] = t.split(':');
        return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
    };
    const text = ranges.length > 0 ? ranges.map((r) => `${label(r[1])} – ${label(r[2])}`).join(', ') : null;
    const minutes = Number(now.slice(11, 13)) * 60 + Number(now.slice(14, 16));
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const yesterday = ((iso + 5) % 7) + 1;
    const open = ranges.some((r) => {
        const a = toMin(r[1]);
        const b = toMin(r[2]);
        return b > a ? minutes >= a && minutes < b : minutes >= a;
    }) || menu.hours.some((r) => r[0] === yesterday && toMin(r[2]) < toMin(r[1]) && minutes < toMin(r[2]));
    return { text, open };
}
