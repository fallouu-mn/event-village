/**
 * Contre-vérification du lot 11c-b — GARDE-FOUS (verts attendus : attaque bloquée). Base LOCALE, faux SamirPay.
 *
 *  G1. Paiement dans la feuille du devis : champs en trop refusés (400, aucun paiement) ; prix changé entre le devis et
 *      l'achat : montant du paiement = nouveau prix lu en base + frais ; numéro non vérifié : 403 PHONE_NOT_VERIFIED par le
 *      serveur ; clé d'idempotence : double clic simultané, deux onglets simultanés (clés différentes), rejeu = un seul
 *      paiement ; paiement déjà en attente (table, ou billets du même événement) : 409 PAYMENT_PENDING avec le suivi.
 *  G2. Achat : table choisie sans plan montré (TABLE_CHOICE_UNAVAILABLE), table prise entre devis et achat (TABLE_TAKEN),
 *      limite par compte (TABLE_LIMIT), service fermé (404) et événement suspendu pendant que la fiche est ouverte.
 *  G3. « Ma table » et suivi d'un autre compte : 404, liste vide, rien de la table ; un invité ne reçoit ni l'identifiant de
 *      la vente, ni les autres places, ni le numéro du titulaire (Mes billets, Reçus, avis) ; REST et temps réel : colonne
 *      tickets.event_table_booking_id illisible, tables du lot illisibles et hors publication.
 *  G4. Remboursement au report : deux demandes simultanées = un seul remboursement, montant affiché = montant remboursé,
 *      billets des invités annulés (plus de code ni de transfert).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { inspect } from '../helpers/db';
import { routeContext } from '../parcours/helpers';
import { checkout, cart, newBuyer, paymentsOf, pollStatus, service, type Buyer } from '../parcours/paiement-helpers';
import { getSetting, jsonRequest, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { advanceEventTo } from '../parcours/cycle-helpers';
import {
    buyTable, createdTableType, myTable, myTables, newTablesEvent, outbox, patchTableType, platformRefunds, postpone, show, showPlan,
    switchEventTablesService, tableCheckout, tableQuote, tableRefund, ticketById, transferSeat, vipType, withEventTablesSetting, type Row,
} from '../parcours/l11c-helpers';
import { GET as listTickets } from '../../app/api/tickets/route';
import { GET as incomingTransfers } from '../../app/api/tickets/transfers/incoming/route';

const PRICE = 150_000;
const n = (v: unknown): number => Number(v);

let restore: () => Promise<void>;
let partner: TestPartner;
let feeRate: number;
const fee = (price: number): number => Math.ceil(price * feeRate / 100);

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('cv11cb-gardes');
    feeRate = n(await getSetting('finance.service_fee_rate'));
    assert.ok(Number.isFinite(feeRate) && feeRate >= 0, `taux de frais : ${feeRate}`);
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('cv11cb-2-gardes');
    await assertNotificationInvariants('cv11cb-2-gardes');
});

async function vipEvent(label: string, opts: { count?: number; plan?: boolean; seats?: number } = {}) {
    const ev = await newTablesEvent(partner, label, { capacity: 100 });
    const t = await createdTableType(partner, ev.eventId, vipType({ price: PRICE, ...(opts.seats ? { seats: opts.seats } : {}) }), opts.count ?? 3);
    if (opts.plan) await showPlan(partner, ev.eventId);
    return { ...ev, typeId: t.typeId, tables: t.tables };
}

async function paymentsFor(user: Buyer, eventId: string) {
    return (await paymentsOf(user.userId)).filter((p) => (p as unknown as Row).event_id === eventId);
}

interface TicketView { id: string; eventId: string; status: string; codeVisible: boolean; transferAllowed: boolean; table: { label: string; bookingId: string | null; invitedBy: string | null } | null }

async function ticketsOf(user: Buyer): Promise<TicketView[]> {
    const res = await listTickets(jsonRequest('/api/tickets', 'GET', user.accessToken));
    const body = (await res.json()) as { tickets?: TicketView[] };
    assert.equal(res.status, 200, `GET /api/tickets : ${JSON.stringify(body).slice(0, 300)}`);
    return body.tickets ?? [];
}

// ── G1. Paiement dans la feuille du devis ────────────────────────────────────────────────────────────────────────────

describe('G1 — paiement dans la feuille du devis', () => {
    test('champs en trop refusés ; prix changé entre devis et achat : montant lu en base ; numéro non vérifié : 403 du serveur', async () => {
        const ev = await vipEvent('cv-g1-prix', { plan: true });
        const buyer = await newBuyer('cv11cb-g1');
        const forged = await tableCheckout(buyer, ev.eventId, ev.typeId, { tableId: ev.tables[0].id, extra: { amount: 1, price: 1, total: 1, seats: 60 } });
        assert.deepEqual([forged.status, forged.body.code], [400, 'INVALID_INPUT'], show(forged));
        assert.equal((await paymentsFor(buyer, ev.eventId)).length, 0, 'aucun paiement pour un corps forgé');

        const quote = await tableQuote(ev.eventId, { typeId: ev.typeId, tableId: ev.tables[0].id, operator: 'WAVE' });
        assert.equal(n(quote.body.total), PRICE + fee(PRICE), show(quote));
        const NEW = 200_000;
        const patched = await patchTableType(partner, ev.eventId, ev.typeId, { price: NEW });
        assert.equal(patched.status, 200, `prix changé avant toute vente : ${show(patched)}`);
        const paid = await tableCheckout(buyer, ev.eventId, ev.typeId, { tableId: ev.tables[0].id });
        assert.equal(paid.status, 200, show(paid));
        assert.equal(n(paid.payment!.amount), NEW + fee(NEW), `montant du paiement = nouveau prix lu en base (devis périmé : ${n(quote.body.total)})`);
        console.log(`[CV11CB] G1. devis ${n(quote.body.total)} F, prix changé, paiement demandé ${n(paid.payment!.amount)} F (= ${NEW} + ${fee(NEW)})`);

        const unverified = await newBuyer('cv11cb-g1-nonverifie', { phoneVerified: false });
        const refused = await tableCheckout(unverified, ev.eventId, ev.typeId, { tableId: ev.tables[1].id });
        assert.deepEqual([refused.status, refused.body.code], [403, 'PHONE_NOT_VERIFIED'], show(refused));
        assert.equal((await paymentsFor(unverified, ev.eventId)).length, 0, 'aucun paiement sans numéro vérifié');
    });

    test('double clic (même clé, simultané), deux onglets (clés différentes, simultanés), rejeu : un seul paiement', async () => {
        const ev = await vipEvent('cv-g1-cle', { plan: true });
        const buyer = await newBuyer('cv11cb-g1-cle');
        const key = randomUUID();
        const twice = await Promise.all([0, 1].map(() => tableCheckout(buyer, ev.eventId, ev.typeId, { tableId: ev.tables[0].id, key })));
        let mine = await paymentsFor(buyer, ev.eventId);
        assert.equal(mine.length, 1, `double clic : un paiement (${twice.map(show).join(' | ')})`);
        for (const r of twice) if (r.status === 200) assert.equal(r.body.payment_id, mine[0].id, 'même paiement rendu');

        const replay = await tableCheckout(buyer, ev.eventId, ev.typeId, { tableId: ev.tables[0].id, key });
        assert.deepEqual([replay.status, replay.body.payment_id], [200, mine[0].id], `rejeu : ${show(replay)}`);
        const tabs = await Promise.all([1, 2].map((i) => tableCheckout(buyer, ev.eventId, ev.typeId, { tableId: ev.tables[i].id })));
        mine = await paymentsFor(buyer, ev.eventId);
        assert.equal(mine.length, 1, `deux onglets pendant l’attente : toujours un paiement (${tabs.map(show).join(' | ')})`);
        for (const r of tabs) {
            assert.deepEqual([r.status, r.body.code], [409, 'PAYMENT_PENDING'], show(r));
            assert.ok(String(r.body.status_page_url ?? r.body.pending_status_path ?? JSON.stringify(r.body)).includes(mine[0].id), `suivi du paiement en attente : ${show(r)}`);
        }

        const other = await vipEvent('cv-g1-onglets', { plan: true });
        const fresh = await newBuyer('cv11cb-g1-onglets');
        const race = await Promise.all([0, 1].map((i) => tableCheckout(fresh, other.eventId, other.typeId, { tableId: other.tables[i].id })));
        const raced = await paymentsFor(fresh, other.eventId);
        console.log(`[CV11CB] G1. onglets simultanés : ${race.map((r) => `${r.status} ${String(r.body.code ?? 'ok')}`).join(' / ')} ; paiements : ${raced.length}`);
        assert.equal(raced.length, 1, `deux onglets simultanés, deux tables : un seul paiement (${race.map(show).join(' | ')})`);
    });

    test('paiement de billets en attente pour le même événement : l’achat d’une table est refusé (409 PAYMENT_PENDING)', async () => {
        const ev = await vipEvent('cv-g1-billets');
        const buyer = await newBuyer('cv11cb-g1-billets');
        const tickets = await checkout(buyer, cart(ev.eventId, [[ev.ticketCategoryId, 1]], buyer));
        assert.equal(tickets.status, 200, JSON.stringify(tickets.body));
        const r = await tableCheckout(buyer, ev.eventId, ev.typeId);
        assert.deepEqual([r.status, r.body.code], [409, 'PAYMENT_PENDING'], show(r));
    });
});

// ── G2. Achat ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G2 — achat refusé par le serveur', () => {
    test('table choisie sans plan, table prise entre devis et achat, limite par compte, service fermé, événement suspendu', async () => {
        const noPlan = await vipEvent('cv-g2-sansplan');
        const a = await newBuyer('cv11cb-g2-a');
        const chosen = await tableCheckout(a, noPlan.eventId, noPlan.typeId, { tableId: noPlan.tables[0].id });
        assert.deepEqual([chosen.status, chosen.body.code], [400, 'TABLE_CHOICE_UNAVAILABLE'], show(chosen));

        const ev = await vipEvent('cv-g2-prise', { plan: true, count: 4 });
        const b = await newBuyer('cv11cb-g2-b');
        const c = await newBuyer('cv11cb-g2-c');
        const quoteB = await tableQuote(ev.eventId, { typeId: ev.typeId, tableId: ev.tables[0].id, operator: 'WAVE' });
        assert.equal((quoteB.body.table as Row).state, 'LIBRE', show(quoteB));
        await buyTable(c, ev.eventId, ev.typeId, ev.tables[0].id);
        const late = await tableCheckout(b, ev.eventId, ev.typeId, { tableId: ev.tables[0].id });
        assert.deepEqual([late.status, late.body.code], [409, 'TABLE_TAKEN'], show(late));

        await withEventTablesSetting('event_tables.max_per_account', 1, async () => {
            const again = await tableCheckout(c, ev.eventId, ev.typeId, { tableId: ev.tables[1].id });
            assert.deepEqual([again.status, again.body.code], [409, 'TABLE_LIMIT'], show(again));
        });

        await withEventTablesSetting('features.event_tables_enabled', false, async () => {
            const closed = await tableCheckout(b, ev.eventId, ev.typeId, { tableId: ev.tables[2].id });
            assert.equal(closed.status, 404, `service fermé, fiche encore ouverte : ${show(closed)}`);
        });
        await advanceEventTo(ev.eventId, 'SUSPENDU', { partnerUserId: partner.userId });
        const suspended = await tableCheckout(b, ev.eventId, ev.typeId, { tableId: ev.tables[2].id });
        assert.ok(suspended.status >= 400 && suspended.payment === null, `événement suspendu, fiche encore ouverte : ${show(suspended)}`);
        assert.equal((await paymentsFor(b, ev.eventId)).length, 0, 'aucun paiement pour B');
    });
});

// ── G3. Accès ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G3 — « Ma table », invités, REST et temps réel', () => {
    test('autre compte : rien ; invité : ni identifiant de vente, ni autres places, ni numéro du titulaire (billets, Reçus, avis)', async () => {
        const ev = await vipEvent('cv-g3', { seats: 3 });
        const holder = await newBuyer('cv11cb-g3-titulaire', { firstName: 'Awa', lastName: 'Diop' });
        const guest = await newBuyer('cv11cb-g3-invite', { firstName: 'Moussa', lastName: 'Fall' });
        const pendingGuest = await newBuyer('cv11cb-g3-attente');
        const bought = await buyTable(holder, ev.eventId, ev.typeId);
        const bookingId = String(bought.booking.id);

        const stolen = await myTable(guest, bookingId);
        assert.equal(stolen.status, 404, show(stolen));
        assert.deepEqual((await myTables(guest)).body.items, [], 'liste vide pour un autre compte');
        assert.equal((await pollStatus(guest.accessToken, bought.payment.id)).status, 404, 'suivi du paiement d’un autre compte');

        const accepted = await transferSeat(String(bought.tickets[0].id), holder, guest.phoneE164);
        const { data: acc, error: accErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: accepted, actor_id: guest.userId } });
        assert.equal(accErr, null, accErr?.message);
        assert.equal((acc as Row | null)?.ok, true, JSON.stringify(acc));
        await transferSeat(String(bought.tickets[1].id), holder, pendingGuest.phoneE164);

        const holderPhones = [holder.phoneE164, holder.phone9, holder.phoneE164.slice(1)];
        const secrets = [bookingId, ...holderPhones, String(bought.payment.id)];
        const leak = (label: string, value: unknown) => {
            const text = JSON.stringify(value);
            const found = secrets.filter((s) => text.includes(s));
            assert.deepEqual(found, [], `${label} : contient ${found.join(', ')} — ${text.slice(0, 400)}`);
        };

        const guestTickets = (await ticketsOf(guest)).filter((t) => t.eventId === ev.eventId);
        assert.equal(guestTickets.length, 1, 'une place à l’invité');
        assert.deepEqual(guestTickets[0].table, { label: guestTickets[0].table!.label, bookingId: null, invitedBy: 'Awa D.' });
        leak('Mes billets de l’invité', guestTickets);

        const inc = await incomingTransfers(jsonRequest('/api/tickets/transfers/incoming', 'GET', pendingGuest.accessToken));
        const incBody = await inc.json();
        assert.equal(inc.status, 200, JSON.stringify(incBody));
        assert.ok(((incBody as Row).items as Row[]).length >= 1, `place en attente visible dans « Reçus » : ${JSON.stringify(incBody)}`);
        leak('Reçus de l’invité en attente', incBody);

        const byUser = await service.from('notification_outbox').select('type, template_data, recipient_user_id, recipient_phone')
            .in('recipient_user_id', [guest.userId, pendingGuest.userId]);
        const byPhone = await service.from('notification_outbox').select('type, template_data, recipient_user_id, recipient_phone')
            .in('recipient_phone', [guest.phoneE164, pendingGuest.phoneE164]);
        assert.equal(byUser.error, null, byUser.error?.message);
        assert.equal(byPhone.error, null, byPhone.error?.message);
        const rows = [...(byUser.data ?? []), ...(byPhone.data ?? [])];
        assert.ok(rows.length >= 1, 'au moins un avis aux invités (sinon le contrôle ne prouve rien)');
        console.log(`[CV11CB] G3. avis aux invités : ${rows.map((r) => r.type).join(', ') || 'aucun'}`);
        leak('avis aux invités', rows);
    });

    test('REST et temps réel : colonne de la vente sur tickets et tables du lot illisibles par anon et un client ; hors publication', async () => {
        const ev = await vipEvent('cv-g3-rest');
        const holder = await newBuyer('cv11cb-g3-rest');
        const bought = await buyTable(holder, ev.eventId, ev.typeId);
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${holder.accessToken}` } } });
        const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

        const col = await client.from('tickets').select('id, event_table_booking_id').eq('id', String(bought.tickets[0].id));
        assert.ok(col.error !== null || (col.data ?? []).every((r) => (r as Row).event_table_booking_id == null), `tickets.event_table_booking_id lisible par le titulaire : ${JSON.stringify(col)}`);
        for (const [who, c] of [['anon', anon], ['client', client]] as const) {
            for (const table of ['event_tables', 'event_table_bookings', 'event_zones', 'event_table_plans', 'stock_reservations']) {
                const r = await c.from(table).select('*').limit(5);
                assert.ok(r.error !== null || (r.data ?? []).length === 0, `${who} lit ${table} : ${JSON.stringify(r.data).slice(0, 200)}`);
            }
        }
        const published = await inspect(async (db) => (await db.query<{ tablename: string }>(
            "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY 1",
            [['event_tables', 'event_table_bookings', 'event_zones', 'event_table_plans', 'stock_reservations']])).rows.map((r) => r.tablename));
        const colPriv = await inspect(async (db) => (await db.query<{ ok: boolean }>(
            "SELECT has_column_privilege('authenticated', 'public.tickets', 'event_table_booking_id', 'SELECT') AS ok")).rows[0].ok);
        console.log(`[CV11CB] G3. publication temps réel : ${JSON.stringify(published)} ; lecture de tickets.event_table_booking_id par authenticated : ${colPriv}`);
        assert.deepEqual(published, [], 'tables du lot publiées en temps réel');
        assert.equal(colPriv, false, 'tickets.event_table_booking_id lisible par authenticated (REST et temps réel)');
    });
});

// ── G4. Remboursement au report ───────────────────────────────────────────────────────────────────────────────────

describe('G4 — remboursement au report', () => {
    test('deux demandes simultanées : un remboursement ; montant affiché = remboursé ; billets de l’invité annulés et sans code', async () => {
        const ev = await vipEvent('cv-g4', { seats: 2 });
        const holder = await newBuyer('cv11cb-g4');
        const guest = await newBuyer('cv11cb-g4-invite');
        const bought = await buyTable(holder, ev.eventId, ev.typeId);
        const bookingId = String(bought.booking.id);
        const tr = await transferSeat(String(bought.tickets[0].id), holder, guest.phoneE164);
        const { data: acc } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: tr, actor_id: guest.userId } });
        assert.equal((acc as Row | null)?.ok, true, JSON.stringify(acc));
        await postpone(partner, ev.eventId, 48);

        const shown = n(((await myTable(holder, bookingId)).body.table as Row as { refund: Row }).refund.amount);
        const both = await Promise.all([0, 1].map(() => tableRefund(holder, bookingId)));
        const statuses = both.map((r) => r.status).sort();
        console.log(`[CV11CB] G4. deux demandes simultanées : ${both.map((r) => `${r.status} ${String(r.body.code ?? 'ok')}`).join(' / ')} ; affiché ${shown} F`);
        assert.deepEqual(statuses, [200, 409], both.map(show).join(' | '));
        const refunds = await platformRefunds(bought.payment.id);
        assert.equal(refunds.length, 1, `un seul remboursement : ${JSON.stringify(refunds)}`);
        assert.equal(n(refunds[0].amount), shown, 'montant affiché avant de confirmer = montant remboursé');
        assert.equal(shown, n(bought.payment.amount), 'table entière, frais compris');

        const seat = await ticketById(String(bought.tickets[0].id));
        assert.notEqual(seat.status, 'VALIDE', `place de l’invité annulée : ${String(seat.status)}`);
        const view = (await ticketsOf(guest)).find((t) => t.id === String(bought.tickets[0].id));
        assert.ok(view, 'billet de l’invité encore listé');
        assert.deepEqual([view!.codeVisible, view!.transferAllowed], [false, false], `billet de l’invité inutilisable : ${JSON.stringify(view)}`);
        const holderView = (await outbox({ type: 'TICKET_REFUNDED_HOLDER', userId: guest.userId })).filter((r) => r.event_id === ev.eventId);
        assert.ok(holderView.length >= 1, 'invité prévenu');
    });
});
