/**
 * Lot 11c-b — lecture des réponses du serveur pour l'onglet « Tables » de la fiche (offre, devis, achat, suivi du
 * paiement). Aucun montant ni nombre de places n'est calculé ici : chaque valeur est lue telle que la base l'a calculée
 * (event_table_offer, event_table_quote, finance_compute). Une réponse hors contrat donne null (l'écran dit que la
 * lecture a échoué, jamais une valeur inventée).
 */
import { isRecord, nonEmptyString, readAmount } from '@/lib/payments/payment-client';

export interface OfferType {
    id: string;
    name: string;
    includedText: string | null;
    onsiteNote: string | null;
    seats: number;
    price: number;
    pricePerPerson: number;
    pricePerPersonExact: boolean;
    remainingTables: number;
    totalTables: number;
    /** Refus de vente du type en mots simples (vente pas encore ouverte, close…), null si le type se réserve. */
    refusal: string | null;
}

export interface OfferTable {
    id: string;
    number: number;
    typeId: string;
    x: number | null;
    y: number | null;
    shape: 'RONDE' | 'CARREE' | 'RECTANGLE';
    rotation: number;
    state: 'LIBRE' | 'PRISE';
}

export interface OfferZone { id: string; name: string; x: number | null; y: number | null; w: number | null; h: number | null }

export interface Offer {
    open: boolean;
    refusal: string | null;
    planEnabled: boolean;
    types: OfferType[];
    tables: OfferTable[];
    zones: OfferZone[];
    holdMinutes: number | null;
}

export interface TableQuote {
    typeId: string;
    name: string;
    seats: number;
    price: number;
    pricePerPerson: number;
    pricePerPersonExact: boolean;
    serviceFee: number;
    serviceFeeRate: number | null;
    total: number;
    includedText: string | null;
    onsiteNote: string | null;
    table: { id: string; number: number; state: 'LIBRE' | 'PRISE' } | null;
}

const num = (v: unknown): number | null => readAmount(v);
const nullableNum = (v: unknown): number | null => (v === null || v === undefined ? null : readAmount(v));
const refusalText = (v: unknown): string | null => (isRecord(v) ? nonEmptyString(v.message) : null);
const SHAPES = new Set(['RONDE', 'CARREE', 'RECTANGLE']);

function readType(raw: unknown): OfferType | null {
    if (!isRecord(raw)) return null;
    const id = nonEmptyString(raw.id);
    const name = nonEmptyString(raw.name);
    const seats = num(raw.seats);
    const price = num(raw.price);
    const perPerson = num(raw.price_per_person);
    const remaining = num(raw.remaining_tables);
    const total = num(raw.total_tables);
    if (!id || !name || seats === null || price === null || perPerson === null || remaining === null || total === null) return null;
    return {
        id, name, seats, price, pricePerPerson: perPerson, pricePerPersonExact: raw.price_per_person_exact === true,
        includedText: nonEmptyString(raw.included_text), onsiteNote: nonEmptyString(raw.onsite_note),
        remainingTables: remaining, totalTables: total, refusal: refusalText(raw.refusal),
    };
}

function readTable(raw: unknown): OfferTable | null {
    if (!isRecord(raw)) return null;
    const id = nonEmptyString(raw.id);
    const typeId = nonEmptyString(raw.type_id);
    const number = num(raw.number);
    if (!id || !typeId || number === null) return null;
    const shape = typeof raw.shape === 'string' && SHAPES.has(raw.shape) ? raw.shape as OfferTable['shape'] : 'RONDE';
    return {
        id, typeId, number, shape, rotation: num(raw.rotation) ?? 0,
        x: nullableNum(raw.x), y: nullableNum(raw.y), state: raw.state === 'LIBRE' ? 'LIBRE' : 'PRISE',
    };
}

function readZone(raw: unknown): OfferZone | null {
    if (!isRecord(raw)) return null;
    const id = nonEmptyString(raw.id);
    const name = nonEmptyString(raw.name);
    if (!id || !name) return null;
    return { id, name, x: nullableNum(raw.x), y: nullableNum(raw.y), w: nullableNum(raw.w), h: nullableNum(raw.h) };
}

function all<T>(list: unknown, read: (raw: unknown) => T | null): T[] | null {
    if (!Array.isArray(list)) return null;
    const out: T[] = [];
    for (const raw of list) {
        const v = read(raw);
        if (!v) return null;
        out.push(v);
    }
    return out;
}

/** Réponse de GET /api/events/[id]/tables. */
export function readOffer(body: unknown): Offer | null {
    if (!isRecord(body) || body.success !== true) return null;
    const types = all(body.types, readType);
    const tables = all(body.tables ?? [], readTable);
    const zones = all(body.zones ?? [], readZone);
    if (!types || !tables || !zones) return null;
    return {
        open: body.open === true, refusal: refusalText(body.refusal), planEnabled: body.plan_enabled === true,
        types, tables, zones, holdMinutes: nullableNum(body.hold_minutes),
    };
}

/** Réponse de POST /api/events/[id]/tables/quote. */
export function readQuote(body: unknown): TableQuote | null {
    if (!isRecord(body) || body.success !== true) return null;
    const typeId = nonEmptyString(body.type_id);
    const name = nonEmptyString(body.name);
    const seats = num(body.seats);
    const price = num(body.price);
    const perPerson = num(body.price_per_person);
    const fee = num(body.service_fee);
    const total = num(body.total);
    if (!typeId || !name || seats === null || price === null || perPerson === null || fee === null || total === null) return null;
    let table: TableQuote['table'] = null;
    if (isRecord(body.table)) {
        const id = nonEmptyString(body.table.id);
        const number = num(body.table.number);
        if (!id || number === null) return null;
        table = { id, number, state: body.table.state === 'LIBRE' ? 'LIBRE' : 'PRISE' };
    }
    return {
        typeId, name, seats, price, pricePerPerson: perPerson, pricePerPersonExact: body.price_per_person_exact === true,
        serviceFee: fee, serviceFeeRate: nullableNum(body.service_fee_rate), total,
        includedText: nonEmptyString(body.included_text), onsiteNote: nonEmptyString(body.onsite_note), table,
    };
}

export interface PaymentPoll {
    status: string;
    amount: number;
    expiresAt: string | null;
    bookingId: string | null;
    successUrl: string | null;
}

/** Réponse de GET /api/payments/[id]/status (champs utiles à l'attente d'une table). */
export function readPaymentPoll(body: unknown): PaymentPoll | null {
    if (!isRecord(body)) return null;
    const status = nonEmptyString(body.status);
    const amount = num(body.amount);
    if (!status || amount === null) return null;
    return {
        status, amount, expiresAt: nonEmptyString(body.expires_at),
        bookingId: nonEmptyString(body.table_booking_id), successUrl: nonEmptyString(body.success_url),
    };
}

/** « soit 25 000 F par personne » ; prix qui ne se partage pas au franc près : « soit environ … ». */
export function perPersonText(amount: string, exact: boolean): string {
    return `soit ${exact ? '' : 'environ '}${amount} par personne`;
}

/** Tables restantes en mots, à partir du nombre servi par la base. */
export function remainingText(remaining: number): { text: string; tone: 'success' | 'warning' | 'danger' } {
    if (remaining <= 0) return { text: 'Complet', tone: 'danger' };
    if (remaining === 1) return { text: 'Plus qu’une table', tone: 'warning' };
    if (remaining <= 3) return { text: `Plus que ${remaining} tables`, tone: 'warning' };
    return { text: `${remaining} tables disponibles`, tone: 'success' };
}

/** Garde de la sélection le temps d'une connexion (30 minutes au plus), comme le panier des billets. */
const CHOICE_KEY = 'ev-table:';
const CHOICE_TTL_MS = 30 * 60 * 1000;

export interface SavedChoice { typeId: string; tableId: string | null }

export function saveChoice(eventId: string, choice: SavedChoice): void {
    try {
        sessionStorage.setItem(`${CHOICE_KEY}${eventId}`, JSON.stringify({ at: Date.now(), ...choice }));
    } catch (err) {
        console.warn('[tables] choix non gardé (stockage du navigateur indisponible) :', err instanceof Error ? err.message : String(err));
    }
}

export function takeChoice(eventId: string): SavedChoice | null {
    let raw: string | null;
    try {
        raw = sessionStorage.getItem(`${CHOICE_KEY}${eventId}`);
        if (raw !== null) sessionStorage.removeItem(`${CHOICE_KEY}${eventId}`);
    } catch (err) {
        console.warn('[tables] choix gardé illisible (stockage du navigateur indisponible) :', err instanceof Error ? err.message : String(err));
        return null;
    }
    if (!raw) return null;
    try {
        const saved: unknown = JSON.parse(raw);
        if (!isRecord(saved) || typeof saved.at !== 'number' || Date.now() - saved.at > CHOICE_TTL_MS) return null;
        const typeId = nonEmptyString(saved.typeId);
        if (!typeId) return null;
        return { typeId, tableId: nonEmptyString(saved.tableId) };
    } catch (err) {
        console.warn('[tables] choix gardé illisible :', err instanceof Error ? err.message : String(err));
        return null;
    }
}
