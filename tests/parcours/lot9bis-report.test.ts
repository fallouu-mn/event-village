/**
 * Lot 9 bis, tâche 5 (R32 ; contrat 5.5, B23, B24, 4.1, 11.2 M1) — report de plus de 24 h : chaque détenteur d'un billet
 * payé en ligne peut demander le remboursement total, frais de service compris, depuis Mes billets, jusqu'au nouveau
 * début. Droit ouvert si le début actuel dépasse de plus de 24 h le début en vigueur à l'achat (reports cumulés, table
 * event_start_changes) ; billet transféré : le détenteur demande, l'argent va à l'acheteur d'origine ; billet en cours de
 * transfert : le transfert est annulé et le destinataire averti (TRANSFER_REVOKED). Route POST /api/tickets/[id]/refund
 * `{ confirm: true }` → 200 `{ ok, amount, to_original_buyer }` ; refus 409 POSTPONEMENT_REFUND_CLOSED. GET /api/tickets
 * sert `postponementRefund: { amount, until, toOriginalBuyer } | null`. Le SMS EVENT_CHANGED du report le dit (texte
 * exact de la section 11.2, M1).
 *
 * Rouge avant correctif : la route POST /api/tickets/[id]/refund n'existe pas (l'import dynamique la nomme) ;
 * ticket_refund_request n'accepte pas le détenteur ; GET /api/tickets ne sert pas `postponementRefund` ; le SMS dit
 * « change de date … Vos billets restent valables » (lib/notifications/catalog.ts:391) ; event_start_changes n'existe pas.
 * Envoi du SMS : EVENT_CHANGED est mis en file à +10 min (B71) ; l'envoyeur est appelé avec `now` = maintenant + 11 min
 * (horloge du contrat, jamais dans le passé), sur la seule ligne du porteur. Comptage par numéro neuf.
 * Fin de suite : assertLot9bisInvariants (w9, w10 : aucun transfert en attente sur un billet remboursé).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { randomSenegalPhone } from './helpers';
import { fakePay, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent } from './cycle-helpers';
import { addMinutes, dispatchAt, markPhoneVerified, outboxRows, smsMark, smsTo } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket } from './terrain-helpers';
import type { RouteResult } from './acces-helpers';

type Row = Record<string, unknown>;

const PRICE = 5_000;
const HOUR = 3600_000;
const CATEGORIES = [{ name: 'Standard', price: PRICE, total: 30 }, { name: 'Gratuit', price: 0, total: 10 }];
const REFUND_ROUTE = '../../app/api/tickets/[id]/refund/route';
const TICKETS_ROUTE = '../../app/api/tickets/route';
const CLOSED = 'POSTPONEMENT_REFUND_CLOSED';

/** Formats de date des SMS (Dakar = UTC+0), recopiés du contrat (« mer. 30 sept. à 20:00 ») : oracle indépendant. */
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'aout', 'sept.', 'oct.', 'nov.', 'déc.'];

function smsDate(d: Date): string {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} à ${hh}:${mm}`;
}

// ── Événements et reports ──────────────────────────────────────────────────

let seq = 0;

/** Titre court (≤ 20 caractères, GSM-7) : le SMS du report le cite sans troncature. */
function shortTitle(): string {
    seq += 1;
    return `Gala report ${String(Date.now() % 10_000).padStart(4, '0')}${seq}`.slice(0, 20);
}

interface ReportEvent extends SaleEvent { title: string }

async function publishedEvent(owner: TestPartner, label: string, startsInHours = 240): Promise<ReportEvent> {
    const title = shortTitle();
    const ev = await createDraftEvent(owner, label, CATEGORIES, { title, startsInHours, durationHours: 4 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: owner.userId });
    return { ...ev, title };
}

interface EventDates { start_date: string; start_time: string; end_date: string | null; end_time: string | null; updated_at: string }

async function eventDates(eventId: string): Promise<EventDates> {
    const { data, error } = await service.from('events').select('start_date, start_time, end_date, end_time, updated_at').eq('id', eventId).single();
    assert.equal(error, null, `dates de l'événement ${eventId} : ${error?.message}`);
    return data as EventDates;
}

function startOf(d: Pick<EventDates, 'start_date' | 'start_time'>): Date {
    return new Date(`${d.start_date}T${d.start_time}Z`);
}

function columns(at: Date): { date: string; time: string } {
    const iso = at.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

/** Report de `hours` heures par event_update (propriétaire, version attendue), début et fin décalés ensemble ; rend le nouveau début. */
async function postpone(owner: TestPartner, eventId: string, hours: number): Promise<Date> {
    const d = await eventDates(eventId);
    const start = new Date(startOf(d).getTime() + hours * HOUR);
    const s = columns(start);
    const patch: Row = { start_date: s.date, start_time: s.time };
    if (d.end_date && d.end_time) {
        const e = columns(new Date(new Date(`${d.end_date}T${d.end_time}Z`).getTime() + hours * HOUR));
        patch.end_date = e.date;
        patch.end_time = e.time;
    }
    const { data, error } = await service.rpc('event_update', { p: { event_id: eventId, actor_id: owner.userId, expected_updated_at: d.updated_at, patch } });
    assert.equal(error, null, `event_update (report de ${hours} h) : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `report de ${hours} h refusé : ${JSON.stringify(data)}`);
    const after = await eventDates(eventId);
    assert.equal(startOf(after).getTime(), start.getTime(), 'nouveau début écrit');
    return start;
}

// ── Billets et routes ──────────────────────────────────────────────────────

async function boughtTicket(buyer: Buyer, ev: SaleEvent): Promise<Row> {
    const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
    assert.equal(tickets.length, 1, 'un billet acheté');
    return tickets[0];
}

async function ticketRow(id: unknown): Promise<Row> {
    const { data, error } = await service.from('tickets').select('*').eq('id', String(id)).single();
    assert.equal(error, null, `billet ${String(id)} : ${error?.message}`);
    return data as Row;
}

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function clientRefund(user: Buyer, ticketId: unknown): Promise<RouteResult> {
    const handler = await routeHandler(REFUND_ROUTE, 'POST', 'POST /api/tickets/[id]/refund (contrat 4.1, fix(9b.5))');
    const id = String(ticketId);
    return invoke(handler, jsonRequest(`/api/tickets/${id}/refund`, 'POST', user.accessToken, { confirm: true }), ctx({ id }));
}

async function myTickets(user: Buyer): Promise<Row[]> {
    const handler = await routeHandler(TICKETS_ROUTE, 'GET', 'GET /api/tickets');
    const res = await invoke(handler, jsonRequest('/api/tickets', 'GET', user.accessToken));
    assert.equal(res.status, 200, `Mes billets : ${show(res)}`);
    return (res.body.tickets ?? []) as Row[];
}

async function refundCashouts(ticketId: unknown): Promise<Row[]> {
    return cashoutsByKey(`REFUND-TKT-${String(ticketId)}`);
}

/** Refus du droit de report : 409 POSTPONEMENT_REFUND_CLOSED, aucun versement, billet VALIDE. */
async function assertClosed(user: Buyer, ticketId: unknown, label: string): Promise<void> {
    const res = await clientRefund(user, ticketId);
    if (res.status === 200) await settle(res);
    assert.equal(res.status, 409, `${label} : ${show(res)}`);
    assert.equal(res.body.code, CLOSED, `${label} : ${show(res)}`);
    assert.deepEqual((await refundCashouts(ticketId)).map((c) => c.id), [], `${label} : aucun versement`);
    assert.equal((await ticketRow(ticketId)).status, 'VALIDE', `${label} : billet toujours VALIDE`);
}

/** Versement de la demande envoyé puis confirmé (rien laissé en attente). */
async function settle(res: RouteResult): Promise<void> {
    const { data, error } = await service.from('cashouts').select('id').eq('kind', 'TICKET_REFUND').in('status', ['A_ENVOYER', 'ENVOYE'])
        .like('idempotency_key', 'REFUND-TKT-%').order('created_at', { ascending: false }).limit(5);
    assert.equal(error, null, error?.message);
    void res;
    for (const c of data ?? []) await CashoutService.send(String(c.id));
    await confirmCashouts();
}

async function transferInitiate(ticketId: unknown, from: Buyer, toPhone: string): Promise<string> {
    const { data, error } = await service.rpc('ticket_transfer_initiate', {
        p: { ticket_id: String(ticketId), actor_id: from.userId, recipient: toPhone, expires_at: new Date(Date.now() + 48 * HOUR).toISOString() },
    });
    assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
    const body = (data ?? {}) as Row;
    assert.equal(body.ok, true, `transfert refusé : ${JSON.stringify(body)}`);
    return String(body.transfer_id);
}

async function transferStatus(id: string): Promise<string> {
    const { data, error } = await service.from('ticket_transfers').select('status').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return String(data.status);
}

// ── Données : un événement reporté de 48 h et ses porteurs ────────────────

let partner: TestPartner;
let main: ReportEvent;
let newStart: Date;
/** Acheteuse : remboursement par Mes billets. */
let ana: Buyer;
let anaTicket: Row;
/** Porteuse témoin : SMS du report, Mes billets ; jamais remboursée. */
let sokhna: Buyer;
let sokhnaTicket: Row;
/** Billet gratuit. */
let freeHolder: Buyer;
let freeTicketId: string;
/** Acheteur d'origine d'un billet transféré, et son détenteur. */
let origin: Buyer;
let holder: Buyer;
let heldTicketId: string;
/** Billet en cours de transfert vers un numéro sans compte. */
let sender: Buyer;
let pendingTicket: Row;
let pendingTransferId: string;
let pendingTo: string;
/** Billet acheté après le report. */
let late: Buyer;
let lateTicket: Row;

before(async () => {
    partner = await newPartner('report');
    main = await publishedEvent(partner, 'report-48');
    ana = await newBuyer('report-ana');
    anaTicket = await boughtTicket(ana, main);
    sokhna = await newBuyer('report-sokhna');
    sokhnaTicket = await boughtTicket(sokhna, main);
    freeHolder = await newBuyer('report-gratuit');
    freeTicketId = await issueFreeTicket(main.eventId, main.categories.Gratuit.id, freeHolder);

    origin = await newBuyer('report-origine');
    const originTicket = await boughtTicket(origin, main);
    holder = await newBuyer('report-detenteur');
    await markPhoneVerified(holder.userId);
    const transferId = await transferInitiate(originTicket.id, origin, holder.phoneE164);
    const { data: accepted, error: accErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: holder.userId } });
    assert.equal(accErr, null, `ticket_transfer_accept : ${accErr?.message}`);
    assert.equal((accepted as Row | null)?.ok, true, `acceptation du transfert : ${JSON.stringify(accepted)}`);
    const { data: held, error: heldErr } = await service.from('tickets').select('id').eq('event_id', main.eventId).eq('user_id', holder.userId).eq('status', 'VALIDE');
    assert.equal(heldErr, null, heldErr?.message);
    assert.equal((held ?? []).length, 1, 'un billet reçu par transfert');
    heldTicketId = String(held![0].id);

    sender = await newBuyer('report-expediteur');
    pendingTicket = await boughtTicket(sender, main);
    pendingTo = randomSenegalPhone('76');
    pendingTransferId = await transferInitiate(pendingTicket.id, sender, pendingTo);

    newStart = await postpone(partner, main.eventId, 48);

    late = await newBuyer('report-tardif');
    lateTicket = await boughtTicket(late, main);
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertLot9bisInvariants('lot9bis-report');
});

// ── Cas ────────────────────────────────────────────────────────────────────

describe('R32 — report de plus de 24 h : remboursement total depuis Mes billets', () => {
    test('GET /api/tickets : postponementRefund { amount = prix + frais, until = nouveau début, toOriginalBuyer } sur un billet ouvert ; null pour un billet acheté après le report', async () => {
        const mine = (await myTickets(sokhna)).find((t) => t.id === sokhnaTicket.id);
        assert.ok(mine, 'billet de la porteuse dans Mes billets');
        assert.ok('postponementRefund' in mine, `champ postponementRefund servi (contrat 4.1) : ${JSON.stringify(mine)}`);
        const offer = mine.postponementRefund as Row | null;
        assert.ok(offer && typeof offer === 'object', `droit ouvert après un report de 48 h : ${JSON.stringify(mine)}`);
        assert.equal(Number(offer.amount), PRICE + Number(sokhnaTicket.service_fee), 'remboursement total, frais de service compris');
        assert.equal(Date.parse(String(offer.until)), newStart.getTime(), `jusqu'au nouveau début : ${JSON.stringify(offer)}`);
        assert.equal(offer.toOriginalBuyer, false, JSON.stringify(offer));

        const lateRow = (await myTickets(late)).find((t) => t.id === lateTicket.id);
        assert.ok(lateRow && 'postponementRefund' in lateRow, `champ servi : ${JSON.stringify(lateRow)}`);
        assert.equal(lateRow.postponementRefund, null, 'billet acheté après le report : aucun droit');
    });

    test('R32 reproduit : report de 48 h, POST /api/tickets/[id]/refund → 200, versement TICKET_REFUND = prix + frais de service vers le payeur, billet REMBOURSEMENT_EN_COURS', async () => {
        const fee = Number(anaTicket.service_fee);
        setFakeMode('cashoutMode', 'pending');
        let res: RouteResult;
        try {
            res = await clientRefund(ana, anaTicket.id);
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(res.status, 200, `R32 : demande de remboursement après un report de 48 h : ${show(res)}`);
        assert.equal(res.body.ok, true, show(res));
        assert.equal(Number(res.body.amount), PRICE + fee, show(res));
        assert.equal(res.body.to_original_buyer, false, show(res));
        const cashouts = await refundCashouts(anaTicket.id);
        assert.equal(cashouts.length, 1, 'un versement, clé REFUND-TKT-<billet>');
        const c = cashouts[0];
        assert.equal(c.kind, 'TICKET_REFUND');
        assert.equal(Number(c.amount), PRICE + fee, 'prix + frais de service');
        assert.equal(c.beneficiary_user_id, ana.userId, 'versé à l’acheteuse');
        assert.equal(c.phone_number, ana.phone9, 'au numéro qui a payé');
        assert.equal((await ticketRow(anaTicket.id)).status, 'REMBOURSEMENT_EN_COURS');
        if (c.samirpay_transaction_id) fakePay().setTransactionStatus(String(c.samirpay_transaction_id), 'SUCCESS');
        await confirmCashouts();
    });

    test('SMS EVENT_CHANGED du porteur : texte exact de la variante « report » (contrat 11.2, M1), un seul SMS', async () => {
        const rows = await outboxRows({ type: 'EVENT_CHANGED', eventId: main.eventId, userId: sokhna.userId, channel: 'SMS' });
        assert.equal(rows.length, 1, `une ligne SMS EVENT_CHANGED pour la porteuse : ${JSON.stringify(rows.map((r) => [r.status, r.reason]))}`);
        const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
        assert.ok(appUrl, 'NEXT_PUBLIC_APP_URL définie (.env.test)');
        const mark = smsMark(sokhna.phoneE164);
        await dispatchAt(addMinutes(new Date(), 11), { ids: [rows[0].id] });
        const sent = smsTo(sokhna.phoneE164, mark).map((m) => m.message);
        const expected = `Event Village : ${main.title} reporté au ${smsDate(newStart)}. Remboursement total possible avant cette date : ${appUrl}/tickets`;
        assert.deepEqual(sent, [expected], `SMS du report (variante « report » de EVENT_CHANGED) : ${JSON.stringify(sent)}`);
    });

    test('refus : billet acheté après le report ; billet gratuit ; billet d’un autre compte (403 ou 404) — aucun versement', async () => {
        await assertClosed(late, lateTicket.id, 'billet acheté après le report');
        await assertClosed(freeHolder, freeTicketId, 'billet gratuit');
        const other = await clientRefund(ana, sokhnaTicket.id);
        if (other.status === 200) await settle(other);
        assert.ok([403, 404].includes(other.status), `billet d'un autre compte : ${show(other)}`);
        assert.deepEqual((await refundCashouts(sokhnaTicket.id)).map((c) => c.id), [], 'aucun versement pour le billet d’un autre compte');
        assert.equal((await ticketRow(sokhnaTicket.id)).status, 'VALIDE');
    });

    test('billet reçu par transfert : le détenteur demande, l’argent va à l’acheteur d’origine (to_original_buyer, bénéficiaire et numéro du payeur)', async () => {
        const res = await clientRefund(holder, heldTicketId);
        assert.equal(res.status, 200, `demande du détenteur : ${show(res)}`);
        assert.equal(res.body.to_original_buyer, true, show(res));
        const [c] = await refundCashouts(heldTicketId);
        assert.ok(c, 'un versement');
        assert.equal(c.beneficiary_user_id, origin.userId, 'versé à l’acheteur d’origine');
        assert.equal(c.phone_number, origin.phone9, 'au numéro qui a payé');
        await settle(res);
    });

    test('B24 : billet en cours de transfert → demande acceptée, transfert CANCELLED, destinataire averti (TRANSFER_REVOKED par SMS à son numéro)', async () => {
        const res = await clientRefund(sender, pendingTicket.id);
        assert.equal(res.status, 200, `demande sur un billet en cours de transfert : ${show(res)}`);
        assert.equal(await transferStatus(pendingTransferId), 'CANCELLED', 'transfert annulé dans la même fonction (R61)');
        const notices = await outboxRows({ type: 'TRANSFER_REVOKED', phone: pendingTo });
        assert.deepEqual(notices.map((r) => r.channel), ['SMS'], `avis au destinataire sans compte : ${JSON.stringify(notices.map((r) => [r.channel, r.status]))}`);
        await settle(res);
    });

    test('report de 23 h : 409 POSTPONEMENT_REFUND_CLOSED ; deux reports de 13 h (cumul 26 h) : droit ouvert, 200', async () => {
        const short = await publishedEvent(partner, 'report-23');
        const a = await newBuyer('report-23-ach');
        const t = await boughtTicket(a, short);
        await postpone(partner, short.eventId, 23);
        await assertClosed(a, t.id, 'report de 23 h');

        const twice = await publishedEvent(partner, 'report-13x2');
        const b = await newBuyer('report-13-ach');
        const u = await boughtTicket(b, twice);
        await postpone(partner, twice.eventId, 13);
        await postpone(partner, twice.eventId, 13);
        const res = await clientRefund(b, u.id);
        assert.equal(res.status, 200, `deux reports de 13 h se cumulent : ${show(res)}`);
        assert.equal((await refundCashouts(u.id)).length, 1, 'un versement');
        await settle(res);
    });

    test('après le nouveau début : 409 POSTPONEMENT_REFUND_CLOSED (droit de 48 h, mais l’événement a commencé)', async () => {
        const ev = await publishedEvent(partner, 'report-commence');
        const a = await newBuyer('report-commence-ach');
        const t = await boughtTicket(a, ev);
        await postpone(partner, ev.eventId, 48);
        // L'événement a commencé il y a une heure ; l'historique garde un report de 48 h (début d'origine 49 h avant).
        const started = new Date(Date.now() - HOUR);
        const s = columns(started);
        const e = columns(new Date(started.getTime() + 4 * HOUR));
        const { error: upErr } = await service.from('events').update({ start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time }).eq('id', ev.eventId);
        assert.equal(upErr, null, `début déplacé dans le passé : ${upErr?.message}`);
        const { data: moved, error: chErr } = await service.from('event_start_changes')
            .update({ old_start_at: new Date(started.getTime() - 48 * HOUR).toISOString(), new_start_at: started.toISOString() })
            .eq('event_id', ev.eventId).select('id');
        assert.equal(chErr, null, `event_start_changes (migration 20261109000006_lot9bis_argent, contrat 5.5) : ${chErr?.message} (code ${chErr?.code})`);
        assert.equal((moved ?? []).length, 1, 'un report enregistré pour l’événement');
        await assertClosed(a, t.id, 'après le nouveau début');
    });
});
