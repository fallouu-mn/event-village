/**
 * Contre-vérification du lot 11c-b (tables d'un événement : écrans du client) — TROUS. Base LOCALE, faux SamirPay.
 * Rouge = trou présent ; vert = attaque bloquée (correctif en place). Branche lot11c/cv-rouges-b, jamais fusionnée.
 *
 *  T1. « Table prise en direct » (décision 2 de la consigne du lot) : l'onglet « Tables » ne relit l'offre que sur le
 *      signal temps réel de public_category_stock (components/event-tables/client/TablesOffer.tsx:191-196). Or un type de
 *      table est créé avec sale_online = FALSE (20261201000003_l11c_configuration.sql:250) et public_category_stock_sync
 *      supprime la tranche d'une catégorie hors vente en ligne (20261110000011_lot9ter_stock.sql:95-98) : une table tenue
 *      ou vendue ne produit aucun message. Le plan ouvert garde la table « Libre » jusqu'au devis ou à l'achat.
 *  T2. Titulaire qui a envoyé toutes ses places : plus aucun billet de la table à son compte, donc plus d'onglet
 *      « Tables » ni de bouton « Gérer ma table » (app/tickets/TicketsView.tsx : hasTables lit seulement
 *      tickets[].table.bookingId) ; après un report de plus de 24 h, le remboursement de la table (ouvert par le serveur)
 *      n'est plus atteignable depuis Mes billets.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { anonClient, disposeClients, produceUntilReceived, subscribeCollect } from '../helpers/realtime';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from '../parcours/finance-helpers';
import {
    buyTable, createdTableType, myTables, newTablesEvent, postpone, show, showPlan, switchEventTablesService, tableCheckout,
    tableOffer, transferSeat, vipType, type Row,
} from '../parcours/l11c-helpers';
import { GET as listTickets } from '../../app/api/tickets/route';

const ROOT = process.cwd();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('cv11cb-trous');
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('cv11cb-1-trous');
    await assertNotificationInvariants('cv11cb-1-trous');
});

interface TicketView { id: string; eventId: string; status: string; table: { label: string; bookingId: string | null; invitedBy: string | null } | null }

async function ticketsOf(user: Buyer): Promise<TicketView[]> {
    const res = await listTickets(jsonRequest('/api/tickets', 'GET', user.accessToken));
    const body = (await res.json()) as { tickets?: TicketView[] };
    assert.equal(res.status, 200, `GET /api/tickets : ${JSON.stringify(body).slice(0, 300)}`);
    return body.tickets ?? [];
}

describe('T1 — table prise en direct : aucun signal temps réel', () => {
    test('une table tenue puis vendue ne produit aucun message sur public_category_stock (abonnement de l’onglet « Tables »)', async () => {
        const ev = await newTablesEvent(partner, 'cv-direct', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType(), 3);
        await showPlan(partner, ev.eventId);
        const target = t.tables[0];

        const anon = anonClient();
        try {
            // Abonnement identique à celui de TablesOffer : public_category_stock, filtre event_id
            const live = subscribeCollect(anon, { table: 'public_category_stock', filter: `event_id=eq.${ev.eventId}` }, { label: 'cv11cb T1 stock' });
            await live.ready;
            // Vivacité du canal : la catégorie de billets « Entrée » passe sous le seuil (5 puis 6 places : LOW change)
            let quota = 5;
            await produceUntilReceived(live, async () => {
                const { error } = await service.from('ticket_categories').update({ total_quantity: quota }).eq('id', ev.ticketCategoryId);
                assert.equal(error, null, error?.message);
                quota = quota === 5 ? 6 : 5;
            }, (e) => e.new.category_id === ev.ticketCategoryId, { what: 'témoin : tranche de la catégorie de billets' });
            await sleep(1_500);
            live.clear();

            // Un autre visiteur tient la table (attente de paiement) : l'offre la dit PRISE
            const buyer = await newBuyer('cv11cb-direct');
            const held = await tableCheckout(buyer, ev.eventId, t.typeId, { tableId: target.id });
            assert.equal(held.status, 200, show(held));
            const offer = await tableOffer(ev.eventId);
            assert.equal((offer.body.tables as Row[]).find((x) => x.id === target.id)?.state, 'PRISE', `table tenue : PRISE pour l’offre : ${show(offer)}`);

            await sleep(8_000);
            const { data: typeRow, error: rowErr } = await service.from('public_category_stock').select('*').eq('category_id', t.typeId).maybeSingle();
            assert.equal(rowErr, null, rowErr?.message);
            const { data: typeCat } = await service.from('ticket_categories').select('sale_online, kind, held_quantity').eq('id', t.typeId).single();
            console.log(`[CV11CB] T1. messages reçus après la mise en attente de la table ${target.number} : ${live.events.length} ; tranche publique du type : ${JSON.stringify(typeRow)} ; type : ${JSON.stringify(typeCat)}`);
            assert.ok(live.events.length > 0,
                `aucun message temps réel après la mise en attente de la table ${target.number} : l’onglet « Tables » ouvert ne relit jamais l’offre `
                + `(tranche publique du type : ${JSON.stringify(typeRow)}, type ${JSON.stringify(typeCat)})`);
        } finally {
            await disposeClients(anon);
        }
    });
});

describe('T2 — titulaire qui a envoyé toutes ses places : « Ma table » hors d’atteinte', () => {
    test('places toutes envoyées et acceptées, report de 48 h : remboursement ouvert, mais aucun billet ne porte la table (onglet « Tables » caché)', async () => {
        const ev = await newTablesEvent(partner, 'cv-toutes', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType({ seats: 2 }), 2);
        const holder = await newBuyer('cv11cb-titulaire', { firstName: 'Awa', lastName: 'Diop' });
        const bought = await buyTable(holder, ev.eventId, t.typeId);
        const bookingId = String(bought.booking.id);
        assert.equal(bought.tickets.length, 2, 'deux places');

        for (const [i, seat] of bought.tickets.entries()) {
            const guest = await newBuyer(`cv11cb-invite${i}`);
            const transferId = await transferSeat(String(seat.id), holder, guest.phoneE164);
            const { data, error } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
            assert.equal(error, null, error?.message);
            assert.equal((data as Row | null)?.ok, true, `acceptation : ${JSON.stringify(data)}`);
        }
        await postpone(partner, ev.eventId, 48);

        const mine = await myTables(holder);
        const item = ((mine.body.items ?? []) as Row[]).find((x) => x.booking_id === bookingId);
        assert.ok(item, `la table reste au titulaire : ${show(mine)}`);
        assert.equal((item!.refund as Row).open, true, `remboursement ouvert par le serveur : ${JSON.stringify(item!.refund)}`);

        const view = read('app/tickets/TicketsView.tsx');
        const gate = /const hasTables = useMemo\(\(\) => tickets\.some\(\(t\) => Boolean\(t\.table\?\.bookingId\)\), \[tickets\]\);/.test(view);
        const tab = /\.\.\.\(hasTables \|\| tab === 'tables' \? \[\{ id: 'tables', label: 'Tables' \}\] : \[\]\)/.test(view);
        const holderTickets = (await ticketsOf(holder)).filter((x) => x.eventId === ev.eventId);
        console.log(`[CV11CB] T2. billets du titulaire pour l’événement : ${holderTickets.length} ; avec la table : ${holderTickets.filter((x) => x.table?.bookingId).length} ; onglet lié aux billets seulement : ${gate && tab} ; remboursement : ${JSON.stringify(item!.refund)}`);
        // Vert si un billet porte encore la table, ou si l'onglet ne dépend plus des seuls billets (autre correctif)
        assert.ok(holderTickets.some((x) => x.table?.bookingId === bookingId) || !(gate && tab),
            `aucun billet du titulaire ne porte la table ${bookingId} : onglet « Tables » et « Gérer ma table » absents de Mes billets, remboursement de ${n((item!.refund as Row).amount)} F hors d’atteinte`);
    });
});

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function n(v: unknown): number {
    return Number(v);
}
