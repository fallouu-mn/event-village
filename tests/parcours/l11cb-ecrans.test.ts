/**
 * Lot 11c-b — tables d'un événement : ce que les écrans du client lisent sur le serveur.
 *
 *  A. Fiche : la bascule « Billets | Tables » n'apparaît que si le service est ouvert et qu'un type est en vente
 *     (readTablesSummary : nombre de types, plus petit prix d'une table) ; service fermé, aucun type : rien.
 *  B. Parcours avec plan : offre (plan, tables LIBRE), devis d'une table, achat (expires_at du compte à rebours), suivi du
 *     paiement (retry_url vers l'onglet « Tables », success_url et table_booking_id vers « Ma table » une fois payé),
 *     table vue PRISE par les autres visiteurs, « Ma table » (places à inviter servies par le serveur), billets du
 *     titulaire (« Table 12 · Carré VIP », bookingId), envoi d'une place, billet de l'invité (« Invité par Awa D. », sans
 *     bookingId), compteurs.
 *  C. Parcours sans plan : choix d'un type, numéro donné par le serveur.
 *  D. Remboursement au report de plus de 24 h : montant affiché par « Ma table », puis table entière remboursée.
 *  E. Accès : « Ma table » d'un autre compte (404, rien), liste d'un autre compte vide, suivi du paiement d'un autre
 *     compte (404), sans session (401).
 *  F. Avis : EVENT_TABLE_CONFIRMED et EVENT_TABLE_SEATS_REMINDER mènent à « Ma table ».
 * Montants attendus calculés à la main (taux de frais relu dans les réglages). Faux SamirPay seulement. Base LOCALE.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { newBuyer, pollStatus, service, type Buyer } from './paiement-helpers';
import { getSetting, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import {
    bookingOfPayment, buyTable, confirmByWebhook, createdTableType, myTable, myTables, newTablesEvent, outbox, postpone, show, showPlan,
    switchEventTablesService, tableCheckout, tableOffer, tableQuote, tableRefund, ticketsOfBooking, transferSeat, vipType,
    withEventTablesSetting, type Row,
} from './l11c-helpers';
import { GET as listTickets } from '../../app/api/tickets/route';
import { readTablesSummary } from '../../lib/event-tables/offer-summary.server';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

const PRICE = 150_000;
const SEATS = 6;
const n = (v: unknown): number => Number(v);

let restore: () => Promise<void>;
let partner: TestPartner;
let feeRate: number;
const fee = (price: number): number => Math.ceil(price * feeRate / 100);

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('l11cb-ecrans');
    feeRate = n(await getSetting('finance.service_fee_rate'));
    assert.ok(Number.isFinite(feeRate) && feeRate >= 0, `taux de frais de service lisible : ${feeRate}`);
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('l11cb-ecrans');
    await assertNotificationInvariants('l11cb-ecrans');
});

interface TicketView { id: string; seat: string; table: { label: string; bookingId: string | null; invitedBy: string | null } | null; eventId: string }

async function ticketsOf(user: Buyer): Promise<TicketView[]> {
    const res = await listTickets(jsonRequest('/api/tickets', 'GET', user.accessToken));
    const body = (await res.json()) as { tickets?: TicketView[] };
    assert.equal(res.status, 200, `GET /api/tickets : ${JSON.stringify(body).slice(0, 300)}`);
    return body.tickets ?? [];
}

async function acceptTransfer(transferId: string, guest: Buyer): Promise<void> {
    const { data, error } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
    assert.equal(error, null, `ticket_transfer_accept : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `acceptation refusée : ${JSON.stringify(data)}`);
}

/** Événement publié avec un type « Carré VIP » (6 places, 150 000 F) de `count` tables ; plan montré si demandé. */
async function vipEvent(label: string, opts: { count?: number; plan?: boolean } = {}) {
    const ev = await newTablesEvent(partner, label, { capacity: 100 });
    const name = `Carré VIP ${label}`.slice(0, 40);
    const t = await createdTableType(partner, ev.eventId, vipType({ name, onsite_note: '50 000 F de consommations sur place' }), opts.count ?? 3);
    if (opts.plan) await showPlan(partner, ev.eventId);
    return { ...ev, typeId: t.typeId, tables: t.tables, typeName: name };
}

// ── A. Fiche ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('A. Fiche : bascule « Billets | Tables »', () => {
    test('résumé de l’offre : rien sans type ni service fermé ; un type en vente → 1 type, dès 150 000 F', async () => {
        const bare = await newTablesEvent(partner, 'sans-type');
        assert.equal(await readTablesSummary(bare.eventId), null, 'aucun type de table : pas de bascule');
        const ev = await vipEvent('resume');
        assert.deepEqual(await readTablesSummary(ev.eventId), { types: 1, fromPrice: PRICE }, 'un type en vente');
        await withEventTablesSetting('features.event_tables_enabled', false, async () => {
            assert.equal(await readTablesSummary(ev.eventId), null, 'service fermé : pas de bascule');
        });
    });
});

// ── B. Parcours avec plan ──────────────────────────────────────────────────────────────────────────────────────────

describe('B. Parcours avec plan : choix, devis, paiement, Ma table, invité', () => {
    test('de l’offre au billet de l’invité', async () => {
        const ev = await vipEvent('plan', { plan: true });
        const target = ev.tables[1];

        const offer = await tableOffer(ev.eventId);
        assert.equal(offer.status, 200, show(offer));
        assert.equal(offer.body.plan_enabled, true, 'plan montré');
        const offered = (offer.body.tables as Row[]).find((t) => t.id === target.id);
        assert.equal(offered?.state, 'LIBRE', 'table libre avant l’achat');
        const type = (offer.body.types as Row[]).find((t) => t.id === ev.typeId)!;
        assert.equal(n(type.price), PRICE);
        assert.equal(n(type.price_per_person), PRICE / SEATS, 'prix par personne servi par la base');
        assert.equal(type.onsite_note, '50 000 F de consommations sur place', 'minimum sur place : texte seulement');

        const quote = await tableQuote(ev.eventId, { typeId: ev.typeId, tableId: target.id, operator: 'WAVE' });
        assert.equal(quote.status, 200, show(quote));
        assert.equal(n(quote.body.total), PRICE + fee(PRICE), 'total du devis = prix + frais');
        assert.equal((quote.body.table as Row).number, target.number, 'devis de la table choisie');

        const holder = await newBuyer('l11cb-titulaire', { firstName: 'Awa', lastName: 'Diop' });
        const started = await tableCheckout(holder, ev.eventId, ev.typeId, { tableId: target.id });
        assert.equal(started.status, 200, show(started));
        const expiresAt = Date.parse(String(started.body.expires_at));
        assert.ok(Number.isFinite(expiresAt) && expiresAt > Date.now(), `expires_at du compte à rebours dans le futur : ${String(started.body.expires_at)}`);
        assert.equal((started.body.table as Row).number, target.number, 'table tenue = table choisie');

        // Suivi pendant l'attente : « Réessayer » rouvre l'onglet Tables, pas encore de vente
        const pending = await pollStatus(holder.accessToken, started.payment!.id);
        assert.equal(pending.status, 200, JSON.stringify(pending.body));
        assert.equal(pending.body.retry_url, `/events/${ev.eventId}?tables=1`, 'réessayer : onglet Tables de la fiche');
        assert.equal(pending.body.table_booking_id, null, 'aucune vente avant la confirmation');

        // Un autre visiteur voit la table tenue comme prise
        const during = await tableOffer(ev.eventId);
        assert.equal((during.body.tables as Row[]).find((t) => t.id === target.id)?.state, 'PRISE', 'table tenue : PRISE pour les autres');

        const paid = await confirmByWebhook(started.payment!);
        assert.equal(paid.status, 'SUCCESS');
        const booking = await bookingOfPayment(paid.id);
        assert.ok(booking, 'vente créée');
        const bookingId = String(booking!.id);

        const done = await pollStatus(holder.accessToken, paid.id);
        assert.equal(done.body.table_booking_id, bookingId, 'suivi : vente de la table');
        assert.equal(done.body.success_url, `/tickets?tab=tables#table-${bookingId}`, 'après le paiement : « Ma table »');

        const mine = await myTable(holder, bookingId);
        assert.equal(mine.status, 200, show(mine));
        const table = mine.body.table as Row;
        assert.equal(n(table.seats), SEATS);
        assert.equal(n((table.counts as Row).to_send), SEATS, 'toutes les places à envoyer');
        assert.equal(n(table.invite_left), SEATS - 1, 'places à inviter = à envoyer − la sienne (« Envoyez vos 5 places »)');
        assert.ok(String(table.whatsapp_url).startsWith('https://wa.me/?text='), 'partage WhatsApp');
        assert.ok(!/token|jeton|claim/i.test(decodeURIComponent(String(table.whatsapp_url))), 'lien WhatsApp sans jeton');

        // Billets du titulaire : libellé de la table et accès à « Ma table »
        const holderTickets = (await ticketsOf(holder)).filter((t) => t.eventId === ev.eventId);
        assert.equal(holderTickets.length, SEATS, 'N billets au titulaire');
        for (const t of holderTickets) {
            assert.equal(t.seat, `Table ${target.number} · ${ev.typeName}`, 'libellé de la place (zone, sinon type)');
            assert.deepEqual(t.table, { label: `Table ${target.number} · ${ev.typeName}`, bookingId, invitedBy: null }, 'titulaire : bookingId, aucun « invité par »');
        }

        // Envoi d'une place et acceptation par l'invité
        const guest = await newBuyer('l11cb-invite', { firstName: 'Moussa', lastName: 'Fall' });
        const seats = await ticketsOfBooking(bookingId);
        const transferId = await transferSeat(String(seats[0].id), holder, guest.phoneE164);
        const waiting = await myTable(holder, bookingId);
        assert.equal(n(((waiting.body.table as Row).counts as Row).pending), 1, 'une place en attente');
        assert.equal(n((waiting.body.table as Row).invite_left), SEATS - 2, 'places à inviter après un envoi en attente');
        await acceptTransfer(transferId, guest);

        const guestTickets = (await ticketsOf(guest)).filter((t) => t.eventId === ev.eventId);
        assert.equal(guestTickets.length, 1, 'un billet à l’invité');
        assert.equal(guestTickets[0].seat, `Table ${target.number} · ${ev.typeName}`, 'billet de l’invité : « Table 12 · Carré VIP »');
        assert.deepEqual(guestTickets[0].table, { label: `Table ${target.number} · ${ev.typeName}`, bookingId: null, invitedBy: 'Awa D.' }, 'invité : « Invité par Awa D. », jamais l’identifiant de la vente');

        const after = await myTable(holder, bookingId);
        const counts = (after.body.table as Row).counts as Row;
        assert.equal(n(counts.sent), 1, '« 1/6 places envoyées »');
        assert.equal(n((after.body.table as Row).invite_left), SEATS - 2);
        const detail = ((after.body.table as Row).seats_detail as Row[]).find((s) => s.state === 'ENVOYEE');
        assert.equal(detail?.guest, 'Moussa F.', 'prénom et initiale de l’invité pour son avatar');

        // Avis de confirmation : lien vers « Ma table »
        const confirmed = (await outbox({ type: 'EVENT_TABLE_CONFIRMED', userId: holder.userId })).filter((r) => r.event_id === ev.eventId);
        assert.ok(confirmed.length >= 1, 'avis EVENT_TABLE_CONFIRMED');
        const data = confirmed[0].template_data as Row;
        assert.equal(data.booking_id, bookingId, 'données de l’avis : la vente');
        assert.equal(NOTIFICATION_CATALOG.EVENT_TABLE_CONFIRMED.link!(data as never), `/tickets?tab=tables#table-${bookingId}`, 'lien de l’avis : « Ma table »');
    });
});

// ── C. Sans plan ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('C. Parcours sans plan : un type, numéro donné après le paiement', () => {
    test('devis sans table, achat d’un type, numéro attribué par le serveur', async () => {
        const ev = await vipEvent('sans-plan');
        const offer = await tableOffer(ev.eventId);
        assert.equal(offer.body.plan_enabled, false);
        assert.deepEqual(offer.body.tables, [], 'aucune table du plan servie sans plan');
        const quote = await tableQuote(ev.eventId, { typeId: ev.typeId });
        assert.equal(quote.status, 200, show(quote));
        assert.equal(quote.body.table, null, 'devis d’un type, sans table');
        const buyer = await newBuyer('l11cb-sansplan');
        const bought = await buyTable(buyer, ev.eventId, ev.typeId);
        assert.ok(ev.tables.some((t) => t.number === n(bought.booking.table_number)), 'numéro d’une table du type');
        const tickets = (await ticketsOf(buyer)).filter((t) => t.eventId === ev.eventId);
        assert.equal(tickets[0]?.seat, `Table ${n(bought.booking.table_number)} · ${ev.typeName}`);
    });
});

// ── D. Report ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('D. Remboursement au report de plus de 24 h', () => {
    test('« Ma table » montre le montant, puis la table entière est remboursée', async () => {
        const ev = await vipEvent('report');
        const buyer = await newBuyer('l11cb-report');
        const bought = await buyTable(buyer, ev.eventId, ev.typeId);
        const bookingId = String(bought.booking.id);
        const before = await myTable(buyer, bookingId);
        assert.equal(((before.body.table as Row).refund as Row).open, false, 'aucun remboursement sans report');

        await postpone(partner, ev.eventId, 48);
        const offered = await myTable(buyer, bookingId);
        const refund = (offered.body.table as Row).refund as Row;
        assert.equal(refund.open, true, `remboursement ouvert : ${show(offered)}`);
        assert.equal(n(refund.amount), n(bought.payment.amount), 'montant affiché avant de confirmer = total payé');

        const refused = await tableRefund(buyer, bookingId, {});
        assert.equal(refused.status, 400, `confirmation exigée : ${show(refused)}`);
        const ok = await tableRefund(buyer, bookingId);
        assert.equal(ok.status, 200, show(ok));
        const afterRefund = await myTable(buyer, bookingId);
        assert.equal((afterRefund.body.table as Row).status, 'REFUNDED', 'table remboursée');
    });
});

// ── E. Accès ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('E. Accès : « Ma table » d’un autre compte', () => {
    test('autre compte : 404 sans indice, liste vide, suivi du paiement 404 ; sans session : 401', async () => {
        const ev = await vipEvent('acces');
        const owner = await newBuyer('l11cb-proprietaire');
        const other = await newBuyer('l11cb-autre');
        const bought = await buyTable(owner, ev.eventId, ev.typeId);
        const bookingId = String(bought.booking.id);

        const stolen = await myTable(other, bookingId);
        assert.equal(stolen.status, 404, show(stolen));
        assert.equal(JSON.stringify(stolen.body).includes(String(bought.booking.table_number)) && JSON.stringify(stolen.body).includes('seats'), false, 'rien de la table dans le refus');
        const list = await myTables(other);
        assert.equal(list.status, 200, show(list));
        assert.deepEqual(list.body.items, [], 'aucune table d’un autre compte');
        const status = await pollStatus(other.accessToken, bought.payment.id);
        assert.equal(status.status, 404, 'suivi du paiement d’un autre compte');
        const otherTickets = await ticketsOf(other);
        assert.equal(otherTickets.some((t) => t.table !== null), false, 'aucune place de table chez un autre compte');

        const anonymous = await myTables({ ...other, accessToken: '' } as Buyer);
        assert.equal(anonymous.status, 401, `sans session : ${show(anonymous)}`);
    });
});

// ── F. Avis ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('F. Avis vers « Ma table »', () => {
    test('EVENT_TABLE_SEATS_REMINDER et EVENT_TABLE_CONFIRMED : /tickets?tab=tables#table-<vente>', () => {
        for (const type of ['EVENT_TABLE_CONFIRMED', 'EVENT_TABLE_SEATS_REMINDER'] as const) {
            const e = NOTIFICATION_CATALOG[type];
            const sample = e.sample as unknown as Row;
            assert.equal(e.link!(sample as never), `/tickets?tab=tables#table-${String(sample.booking_id)}`, `${type} : lien vers « Ma table »`);
        }
    });
});
