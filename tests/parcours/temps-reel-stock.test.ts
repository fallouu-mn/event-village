/**
 * Lot 5, tâche 5.13 — stock public en tranches (contrat, sections O1, O2 et O4 ; décision de l'utilisateur :
 * tranches plutôt que volumes).
 *  - public_category_stock(category_id, event_id, availability ∈ AVAILABLE | LOW | SOLD_OUT, remaining_hint,
 *    updated_at), tenue par trigger : remaining_hint vaut le restant en LOW seulement, NULL sinon ; la ligne
 *    n'est réécrite que si la tranche, ou le restant en LOW, change ;
 *  - seuil access.low_stock_threshold : défaut 10, entier de 1 à 1000, modifiable par le SUPERADMIN seul
 *    (finance_setting_set, valeur validée et historisée) ;
 *  - une vente qui fait passer le restant sous le seuil diffuse LOW, avec le restant, à anon ; la vente des
 *    dernières places diffuse SOLD_OUT ; une vente qui laisse la catégorie dans sa tranche ne diffuse rien ;
 *  - aucune ligne de vente (tickets, payments, stock_reservations) n'arrive à anon pendant ces ventes ;
 *  - catégorie masquée, catégorie inactive, catégorie d'un événement non public : aucune ligne, rien diffusé.
 * Vivacité et sentinelles : une catégorie nouvelle, visible et active, ajoutée à un événement publié dédié
 * (sa ligne de stock est créée par le trigger : identifiant unique, aucune ambiguïté sur le message attendu).
 * Le restant compte ou non les places en cours de paiement (held) : les quantités du test sont choisies pour
 * que la tranche et le restant attendus soient les mêmes dans les deux lectures, une fois l'achat confirmé.
 * Rouge avant correctif :
 *  - aucune table public_category_stock ni aucun trigger (aucune migration), aucune publication de celle-ci
 *    (supabase/migrations/0004_indexes.sql:142-148, 20261101000013_lot4_pilotage.sql:76-77) ;
 *  - réglage inconnu : finance_setting_set renvoie UNKNOWN_KEY pour access.low_stock_threshold
 *    (supabase/migrations/20261101000009_lot4_reglages_acces.sql:63-69), et la clé est absente de
 *    platform_settings (même fichier, :12-16) ;
 *  - aucune RPC event_transition (contrat D4) : createEventInStatus échoue (tests/parcours/cycle-helpers.ts).
 * Garde-fou (vert aujourd'hui sur le fond) : tickets, payments et stock_reservations n'arrivent pas à anon
 * (RLS de tickets et de payments, stock_reservations hors publication).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inspect } from '../helpers/db';
import { loadFixtures } from '../helpers/fixtures';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import {
    RECEIVE_TIMEOUT_MS,
    anonClient,
    disposeClients,
    expectNothing,
    produceUntilReceived,
    signedInClient,
    subscribeCollect,
    waitForEvent,
    type Collector,
    type ReceivedChange,
} from '../helpers/realtime';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { createEventInStatus, type DraftEvent } from './cycle-helpers';

const THRESHOLD_KEY = 'access.low_stock_threshold';
const DEFAULT_THRESHOLD = 10;
/** Colonnes de public_category_stock (contrat O1), seules autorisées : aucun volume de vente. */
const STOCK_COLUMNS = ['category_id', 'event_id', 'availability', 'remaining_hint', 'updated_at'];
const SETTLE_MS = 1_500;

let partner: TestPartner;
let buyer: Buyer;
/** Événement PUBLIE dédié à la vivacité et aux sentinelles (une catégorie ajoutée par signal). */
let live: DraftEvent;

before(async () => {
    partner = await newPartner('tr-stock');
    buyer = await newBuyer('tr-stock');
    live = await createEventInStatus(partner, 'tr-stock-vivacite', [{ name: 'Vivacité', price: 1000, total: 3 }], 'PUBLIE', { startsInHours: 96, capacity: null });
});

after(async () => {
    await assertLifecycleInvariants('temps-reel-stock');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Ajoute à l'événement de vivacité une catégorie visible et active (sa ligne de stock est créée par trigger). */
async function addLiveCategory(): Promise<string> {
    const { data, error } = await service.from('ticket_categories').insert({
        event_id: live.eventId,
        name: `Signal ${randomUUID().slice(0, 8)}`,
        price: 1000,
        total_quantity: 3,
        sold_quantity: 0,
        is_active: true,
        is_visible: true,
        max_per_order: 1,
    }).select('id').single();
    assert.equal(error, null, `catégorie de vivacité : ${error?.message}`);
    return String(data.id);
}

async function liveness(collector: Collector): Promise<void> {
    await produceUntilReceived(collector, addLiveCategory, (e) => e.new.event_id === live.eventId,
        { what: 'vivacité : ligne de stock d’une catégorie ajoutée à un événement publié, reçue par anon' });
}

/** Sentinelle : la ligne de stock d'une nouvelle catégorie de l'événement de vivacité arrive à l'abonné. */
async function sentinel(collector: Collector): Promise<void> {
    const id = await addLiveCategory();
    await waitForEvent(collector, (e) => e.new.category_id === id, RECEIVE_TIMEOUT_MS, 'sentinelle : ligne de stock d’une nouvelle catégorie');
}

function carriesData(e: ReceivedChange): boolean {
    return Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
}

function forCategory(categoryId: string): (e: ReceivedChange) => boolean {
    return (e) => carriesData(e) && (e.new.category_id === categoryId || e.old.category_id === categoryId);
}

function assertStockPayload(e: ReceivedChange): void {
    const extra = Object.keys(e.new).filter((k) => !STOCK_COLUMNS.includes(k));
    assert.deepEqual(extra, [], `colonnes hors contrat O1 diffusées à anon (volume de vente ?) : ${extra.join(', ')} — ${JSON.stringify(e.new)}`);
}

async function stockRow(categoryId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await service.from('public_category_stock').select('*').eq('category_id', categoryId).maybeSingle();
    assert.equal(error, null, `lecture de public_category_stock (catégorie ${categoryId}) : ${error?.message}`);
    return (data ?? null) as Record<string, unknown> | null;
}

function hint(v: unknown): number | null {
    return v === null || v === undefined ? null : Number(v);
}

async function thresholdValue(): Promise<unknown> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', THRESHOLD_KEY).maybeSingle();
    assert.equal(error, null, `lecture du réglage ${THRESHOLD_KEY} : ${error?.message}`);
    assert.ok(data, `réglage ${THRESHOLD_KEY} absent de platform_settings (contrat O1, défaut ${DEFAULT_THRESHOLD})`);
    return (data.value as { value?: unknown }).value;
}

async function setThreshold(value: unknown, actorId: string, reason: string): Promise<{ ok?: boolean; code?: string; [k: string]: unknown }> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: THRESHOLD_KEY, p_value: { value }, p_actor: actorId, p_reason: reason });
    assert.equal(error, null, `finance_setting_set(${THRESHOLD_KEY}, ${JSON.stringify(value)}) : ${error?.message}`);
    return (data ?? {}) as { ok?: boolean; code?: string };
}

async function withThreshold<T>(value: number, fn: () => Promise<T>): Promise<T> {
    const sa = await superadminId();
    const saved = await thresholdValue();
    const set = await setThreshold(value, sa, 'test du lot 5 (stock public)');
    assert.equal(set.ok, true, `seuil ${value} refusé : ${JSON.stringify(set)}`);
    try {
        return await fn();
    } finally {
        const back = await setThreshold(saved, sa, 'restauration après un test du lot 5 (stock public)');
        assert.equal(back.ok, true, `restauration du seuil ${JSON.stringify(saved)} : ${JSON.stringify(back)}`);
    }
}

// ── Réglage ────────────────────────────────────────────────────────────────

describe('Réglage access.low_stock_threshold (contrat O1)', () => {
    test('défaut 10 ; entier de 1 à 1000 ; SUPERADMIN seul ; valeur historisée', async () => {
        assert.equal(await thresholdValue(), DEFAULT_THRESHOLD, `valeur par défaut de ${THRESHOLD_KEY}`);
        const sa = await superadminId();
        const admin = (await loadFixtures()).users.ADMIN.id;

        for (const bad of [0, 1001, 2.5, -3, '10', true, null]) {
            const r = await setThreshold(bad, sa, 'valeur invalide (test du lot 5)');
            assert.equal(r.ok, false, `valeur ${JSON.stringify(bad)} acceptée : ${JSON.stringify(r)}`);
            assert.equal(r.code, 'INVALID_VALUE', `valeur ${JSON.stringify(bad)} : code ${JSON.stringify(r)}`);
        }
        const denied = await setThreshold(25, admin, 'tentative ADMIN (test du lot 5)');
        assert.equal(denied.ok, false, `un ADMIN modifie le seuil : ${JSON.stringify(denied)}`);
        assert.equal(denied.code, 'FORBIDDEN', `ADMIN : code ${JSON.stringify(denied)}`);
        assert.equal(await thresholdValue(), DEFAULT_THRESHOLD, 'valeur inchangée après les refus');

        await withThreshold(25, async () => {
            assert.equal(await thresholdValue(), 25, 'valeur appliquée par le SUPERADMIN');
            const { data: hist, error } = await service.from('platform_settings_history').select('*').eq('key', THRESHOLD_KEY).order('id', { ascending: false }).limit(1);
            assert.equal(error, null, `historique du réglage : ${error?.message}`);
            assert.equal(hist?.[0]?.changed_by, sa, `auteur historisé : ${JSON.stringify(hist)}`);
            assert.equal(hist?.[0]?.reason, 'test du lot 5 (stock public)', `motif historisé : ${JSON.stringify(hist)}`);
        });
        assert.equal(await thresholdValue(), DEFAULT_THRESHOLD, 'valeur restaurée');
    });
});

// ── Schéma ─────────────────────────────────────────────────────────────────

describe('public_category_stock : colonnes du contrat, lecture publique', () => {
    test('colonnes du contrat O1 et rien d’autre (ni vendus, ni réservés, ni quota) ; lisible par anon et authenticated', async () => {
        const cols = await inspect(async (db) => (await db.query<{ column_name: string }>(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_category_stock' ORDER BY ordinal_position",
        )).rows.map((r) => r.column_name));
        assert.ok(cols.length > 0, 'table public.public_category_stock absente (contrat O1, migration 20261102000006_lot5_temps_reel.sql)');
        const missing = STOCK_COLUMNS.filter((c) => !cols.includes(c));
        const extra = cols.filter((c) => !STOCK_COLUMNS.includes(c));
        assert.deepEqual(missing, [], `colonnes du contrat absentes : ${missing.join(', ')}`);
        assert.deepEqual(extra, [], `colonnes hors contrat (aucun volume de vente public) : ${extra.join(', ')}`);
        for (const role of ['anon', 'authenticated'] as const) {
            const n = await inspect(async (db) => Number((await db.query<{ n: string }>('SELECT count(*)::text AS n FROM public.public_category_stock')).rows[0].n), role);
            assert.ok(Number.isInteger(n) && n >= 0, `${role} : lecture de public_category_stock`);
        }
    });
});

// ── Ventes et tranches ─────────────────────────────────────────────────────

describe('Une vente sous le seuil diffuse LOW à anon, sans aucune ligne de vente', () => {
    test('14 places, seuil 10 : vente de 3 (AVAILABLE, rien diffusé), de 3 (LOW, restant 8), de 8 (SOLD_OUT) ; anon ne reçoit ni billets, ni paiements, ni réservations', async () => {
        assert.equal(await thresholdValue(), DEFAULT_THRESHOLD, 'seuil par défaut pendant le test');
        const ev = await createEventInStatus(partner, 'tr-stock-ventes', [{ name: 'Standard', price: 2000, total: 14, maxPerOrder: 10 }], 'PUBLIE', { startsInHours: 72 });
        const std = ev.categories.Standard.id;
        const initial = await stockRow(std);
        assert.ok(initial, 'ligne de stock créée à la publication');
        assert.equal(initial.availability, 'AVAILABLE', `14 places, seuil 10 : ${JSON.stringify(initial)}`);
        assert.equal(hint(initial.remaining_hint), null, `restant masqué hors LOW : ${JSON.stringify(initial)}`);
        // La ligne créée à la publication (INSERT, commité avant les abonnements) peut encore être livrée par
        // Realtime après leur ouverture : seule cette ligne-là, identifiée par son horodatage, est écartée ;
        // toute écriture due à une vente (UPDATE, DELETE, ou INSERT postérieur) reste comptée.
        const publicationRow = (e: ReceivedChange): boolean => e.eventType === 'INSERT'
            && (String(e.new.updated_at) === String(initial.updated_at)
                || Date.parse(String(e.new.updated_at)) === Date.parse(String(initial.updated_at)));
        const saleChange = (e: ReceivedChange): boolean => forCategory(std)(e) && !publicationRow(e);

        const anon = anonClient();
        const holder = await signedInClient({ email: buyer.email });
        try {
            const stockAll = subscribeCollect(anon, { table: 'public_category_stock' }, { label: 'anon public_category_stock (sans filtre)' });
            const stockEv = subscribeCollect(anon, { table: 'public_category_stock', filter: `event_id=eq.${ev.eventId}` }, { label: 'anon public_category_stock (événement du test)' });
            const anonTickets = subscribeCollect(anon, { table: 'tickets' }, { label: 'anon tickets' });
            const anonPayments = subscribeCollect(anon, { table: 'payments' }, { label: 'anon payments' });
            const anonHolds = subscribeCollect(anon, { table: 'stock_reservations' }, { label: 'anon stock_reservations' });
            const holderTickets = subscribeCollect(holder, { table: 'tickets', filter: `user_id=eq.${buyer.userId}` }, { label: 'acheteur tickets (témoin)' });
            await Promise.all([stockAll, stockEv, anonTickets, anonPayments, anonHolds, holderTickets].map((c) => c.ready));
            await liveness(stockAll);

            // 1. 14 → 11 : reste AVAILABLE, aucune réécriture de la ligne
            const first = await buyConfirmed(buyer, ev, [['Standard', 3]]);
            await waitForEvent(holderTickets, (e) => e.new.payment_id === first.payment.id, RECEIVE_TIMEOUT_MS, 'témoin : l’acheteur reçoit ses billets');
            await sentinel(stockAll);
            await expectNothing(stockEv, SETTLE_MS, saleChange, 'vente qui laisse la catégorie en AVAILABLE : aucune diffusion');
            await expectNothing(stockAll, 0, saleChange, 'vente qui laisse la catégorie en AVAILABLE : aucune diffusion (abonnement sans filtre)');

            // 2. 11 → 8 : passage en LOW, restant 8
            await buyConfirmed(buyer, ev, [['Standard', 3]]);
            await waitForEvent(stockEv, (e) => e.new.category_id === std && e.new.availability === 'LOW', RECEIVE_TIMEOUT_MS, 'passage sous le seuil diffusé à anon (LOW)');
            await sentinel(stockAll);
            const lows = stockEv.events.filter(forCategory(std));
            const lastLow = lows[lows.length - 1];
            assert.equal(lastLow.new.availability, 'LOW', `dernier état diffusé : ${JSON.stringify(lastLow.new)}`);
            assert.equal(hint(lastLow.new.remaining_hint), 8, `restant diffusé en LOW : ${JSON.stringify(lastLow.new)}`);

            // 3. 8 → 0 : SOLD_OUT, plus de restant
            await buyConfirmed(buyer, ev, [['Standard', 8]]);
            await waitForEvent(stockEv, (e) => e.new.category_id === std && e.new.availability === 'SOLD_OUT', RECEIVE_TIMEOUT_MS, 'complet diffusé à anon (SOLD_OUT)');
            await sentinel(stockAll);
            const all = stockEv.events.filter(forCategory(std));
            const last = all[all.length - 1];
            assert.equal(last.new.availability, 'SOLD_OUT', `dernier état diffusé : ${JSON.stringify(last.new)}`);
            assert.equal(hint(last.new.remaining_hint), null, `aucun restant en SOLD_OUT : ${JSON.stringify(last.new)}`);
            for (const e of all) assertStockPayload(e);

            const final = await stockRow(std);
            assert.ok(final, 'ligne de stock présente');
            assert.equal(final.availability, 'SOLD_OUT', `état en base : ${JSON.stringify(final)}`);

            // Aucune ligne de vente n'a atteint anon (témoins : l'acheteur a reçu ses billets, anon a reçu le stock après chaque vente)
            await expectNothing(anonTickets, 0, carriesData, 'anon : aucune ligne de tickets');
            await expectNothing(anonPayments, 0, carriesData, 'anon : aucune ligne de payments');
            await expectNothing(anonHolds, 0, carriesData, 'anon : aucune ligne de stock_reservations');
        } finally {
            await disposeClients(anon, holder);
        }
    });

    test('seuil réglé à 5 par le SUPERADMIN : 8 places restent AVAILABLE, la vente de 4 diffuse LOW avec le restant 4', async () => {
        await withThreshold(5, async () => {
            const ev = await createEventInStatus(partner, 'tr-stock-seuil', [{ name: 'Standard', price: 2000, total: 8, maxPerOrder: 10 }], 'PUBLIE', { startsInHours: 72 });
            const std = ev.categories.Standard.id;
            const initial = await stockRow(std);
            assert.ok(initial, 'ligne de stock créée à la publication');
            assert.equal(initial.availability, 'AVAILABLE', `8 places, seuil 5 : AVAILABLE attendu (LOW avec le seuil par défaut) : ${JSON.stringify(initial)}`);

            const anon = anonClient();
            try {
                const stockAll = subscribeCollect(anon, { table: 'public_category_stock' }, { label: 'anon public_category_stock (sans filtre)' });
                const stockEv = subscribeCollect(anon, { table: 'public_category_stock', filter: `event_id=eq.${ev.eventId}` }, { label: 'anon public_category_stock (événement du test)' });
                await Promise.all([stockAll.ready, stockEv.ready]);
                await liveness(stockAll);
                await buyConfirmed(buyer, ev, [['Standard', 4]]);
                await waitForEvent(stockEv, (e) => e.new.category_id === std && e.new.availability === 'LOW', RECEIVE_TIMEOUT_MS, 'passage sous le seuil 5 diffusé à anon');
                await sentinel(stockAll);
                const msgs = stockEv.events.filter(forCategory(std));
                const last = msgs[msgs.length - 1];
                assert.equal(last.new.availability, 'LOW', JSON.stringify(last.new));
                assert.equal(hint(last.new.remaining_hint), 4, `restant diffusé : ${JSON.stringify(last.new)}`);
                for (const e of msgs) assertStockPayload(e);
            } finally {
                await disposeClients(anon);
            }
        });
    });
});

// ── Rien pour ce qui n'est pas public ──────────────────────────────────────

describe('Catégorie masquée ou inactive, événement non public : aucune ligne, rien diffusé', () => {
    test('quotas réduits sous le seuil : la catégorie visible d’un événement publié passe en LOW chez anon, les autres ne produisent rien', async () => {
        const pub = await createEventInStatus(partner, 'tr-stock-masque', [
            { name: 'Visible', price: 2000, total: 30 },
            { name: 'Masquée', price: 2000, total: 20, isVisible: false },
            { name: 'Inactive', price: 2000, total: 20, isActive: false },
        ], 'PUBLIE', { startsInHours: 72 });
        const validated = await createEventInStatus(partner, 'tr-stock-valide', [{ name: 'Standard', price: 2000, total: 20 }], 'VALIDE', { startsInHours: 72 });
        const visible = pub.categories.Visible.id;
        const hidden = [pub.categories['Masquée'].id, pub.categories.Inactive.id, validated.categories.Standard.id];

        assert.ok(await stockRow(visible), 'ligne de stock de la catégorie visible d’un événement publié');
        for (const id of hidden) assert.equal(await stockRow(id), null, `aucune ligne de stock pour la catégorie ${id} (masquée, inactive ou d’un événement non public)`);

        const anon = anonClient();
        try {
            const stockAll = subscribeCollect(anon, { table: 'public_category_stock' }, { label: 'anon public_category_stock (sans filtre)' });
            await stockAll.ready;
            await liveness(stockAll);
            for (const id of hidden) {
                const { error } = await service.from('ticket_categories').update({ total_quantity: 6 }).eq('id', id);
                assert.equal(error, null, `quota réduit (catégorie ${id}) : ${error?.message}`);
            }
            const { error } = await service.from('ticket_categories').update({ total_quantity: 6 }).eq('id', visible);
            assert.equal(error, null, `quota réduit (catégorie visible) : ${error?.message}`);
            const low = await waitForEvent(stockAll, (e) => e.new.category_id === visible && e.new.availability === 'LOW', RECEIVE_TIMEOUT_MS,
                'témoin : la catégorie visible passe en LOW chez anon');
            assert.equal(hint(low.new.remaining_hint), 6, JSON.stringify(low.new));
            await sentinel(stockAll);
            await expectNothing(stockAll, SETTLE_MS, (e) => hidden.some((id) => forCategory(id)(e)),
                'anon : rien pour une catégorie masquée, inactive ou d’un événement non public');
            for (const id of hidden) assert.equal(await stockRow(id), null, `toujours aucune ligne de stock pour la catégorie ${id}`);
        } finally {
            await disposeClients(anon);
        }
    });
});
