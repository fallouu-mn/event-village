/**
 * Lot 5, tâche 5.0 — dette du lot 4, C7 : vente au guichet = entrée immédiate, billet sans compte.
 * Contrat : section C7 de la conception du lot 5 (décision de l'utilisateur : billet sans compte).
 *  - schéma : tickets.user_id nullable, tickets.sale_channel ∈ ONLINE, FREE, INVITATION, COUNTER
 *    (défaut ONLINE, lignes existantes reprises), CHECK (user_id IS NOT NULL OR sale_channel = 'COUNTER') ;
 *    payments.client_id nullable avec CHECK (client_id IS NOT NULL OR (NOT is_platform_payment AND
 *    metadata->>'source' = 'COUNTER_SALE')) ; numéro dans payments.payer_phone ; CHECK de
 *    ticket_scans.method étendu à COUNTER ;
 *  - counter_sale(p) crée dans la même transaction : billets UTILISE (checked_in_at renseigné), une
 *    ligne ticket_scans par billet (acceptée, result valid, method COUNTER, identity_verified false,
 *    payload_hash NULL, shift_id = caisse, amount_due = prix), le paiement hors plateforme et
 *    l'incrément de la caisse ;
 *  - aucun rattachement au compte du numéro ; le vendeur n'est jamais porteur ;
 *  - Idempotency-Key obligatoire (400 sans) ; une même clé donne la même vente ;
 *  - reçu SMS si buyerPhone est fourni (catégorie COUNTER_RECEIPT), receipt_sent dans la réponse
 *    (lot 6 : reçu mis en file, receipt_queued et receipt_refusal dans la réponse) ;
 *  - le partenaire et l'admin ne vendent pas au guichet (statu quo NOT_ASSIGNED) ; invariant (g) vrai.
 *
 * Rouge avant correctif :
 *  - supabase/migrations/20261101000011_lot4_caisse.sql:195 : propriétaire = compte du numéro, sinon le
 *    vendeur ; :250-265 : billets 'VALIDE' ; aucune ligne ticket_scans ; tickets.user_id et
 *    payments.client_id NOT NULL (0001_initial_schema.sql:355, :517) ; ticket_scans.method limité à
 *    QR et MANUAL (20261101000010_lot4_scan.sql:39) ;
 *  - app/api/controller/counter-sale/route.ts:46-52 : recherche du compte par numéro (le numéro du
 *    vendeur lui rend le billet) ; aucun Idempotency-Key (un double appui donne deux ventes) ; aucun SMS.
 *
 * Interprétations retenues (contrat muet) :
 *  - « même transaction » se lit dans les horodatages par défaut : now() est l'heure de début de la
 *    transaction, donc tickets.created_at, ticket_scans.created_at et payments.created_at sont égaux ;
 *  - buyerPhone au format E.164 (+221…) ; payer_phone = les 9 chiffres nationaux ;
 *  - rejeu de la même clé : réponse avec le même payment_id, aucune écriture nouvelle ;
 *  - un nouveau scan du billet vendu au guichet répond already_used (conséquence du statut UTILISE).
 * La suite crée son partenaire, son événement (dans la fenêtre de scan), son vendeur et sa caisse.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { accessViolations } from '../helpers/access-invariants';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { getFakes } from '../fakes';
import { randomSenegalPhone } from './helpers';
import { categoryState, eventTickets, importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, paymentRow, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, openShift, scan, shiftRow, ticketPayload, type RouteResult } from './acces-helpers';
import { dispatchAt, outboxRows } from './notif-helpers';

const ROUTE = '../../app/api/controller/counter-sale/route';
const STANDARD = 3000;
const EMOJI = new RegExp('\\p{Extended_Pictographic}', 'u');

let partner: TestPartner;
let ev: SaleEvent;
let seller: Buyer;
let shiftId: string;

before(async () => {
    partner = await newPartner('dette-guichet');
    ev = await createTimedEvent(partner.partnerId, 'dette-guichet', [{ name: 'Standard', price: STANDARD, total: 60 }]);
    seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'dette-guichet' });
    const res = await openShift(seller, ev.eventId);
    assert.equal(res.status, 200, `ouverture de la caisse du vendeur : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    const { data, error } = await service.from('controller_shifts').select('id')
        .eq('controller_id', seller.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse du vendeur : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'une caisse OUVERT pour le vendeur');
    shiftId = String(data![0].id);
});

after(async () => {
    await assertLifecycleInvariants('dette-guichet');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest) => Promise<Response>;

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body)}`;
}

/** Vente au guichet ; `key` null : sans en-tête Idempotency-Key. */
async function counterSale(user: Buyer, body: Row, key: string | null = randomUUID()): Promise<RouteResult> {
    const { POST } = await importModule(ROUTE);
    const headers: Record<string, string> = key ? { 'idempotency-key': key } : {};
    const res = await (POST as Handler)(authed('/api/controller/counter-sale', 'POST', user, body, headers));
    const text = await res.text();
    let parsed: Row = {};
    try {
        parsed = text ? JSON.parse(text) : {};
    } catch {
        parsed = { raw: text };
    }
    return { status: res.status, body: parsed };
}

function items(quantity: number): Array<{ categoryId: string; quantity: number }> {
    return [{ categoryId: ev.categories.Standard.id, quantity }];
}

async function shiftPayments(): Promise<string[]> {
    const { data, error } = await service.from('payments').select('id').eq('shift_id', shiftId).order('created_at');
    assert.equal(error, null, `paiements de la caisse : ${error?.message}`);
    return (data ?? []).map((p) => String(p.id));
}

interface Snapshot { tickets: string[]; sold: number; expected: number; payments: string[] }

async function snapshot(): Promise<Snapshot> {
    return {
        tickets: (await eventTickets(ev.eventId)).map((t) => String(t.id)).sort(),
        sold: (await categoryState(ev.categories.Standard.id)).sold,
        expected: Number((await shiftRow(shiftId)).expected_cash_total),
        payments: await shiftPayments(),
    };
}

async function assertNothingSold(before: Snapshot, label: string): Promise<void> {
    const now = await snapshot();
    assert.deepEqual(now.tickets, before.tickets, `${label} : aucun billet émis`);
    assert.equal(now.sold, before.sold, `${label} : stock inchangé`);
    assert.equal(now.expected, before.expected, `${label} : total attendu de la caisse inchangé`);
    assert.deepEqual(now.payments, before.payments, `${label} : aucun paiement rattaché à la caisse`);
}

interface Sale { payment: Row; tickets: Row[] }

/** La vente : le seul nouveau paiement de la caisse et ses billets. */
async function saleOutcome(before: Snapshot): Promise<Sale> {
    const fresh = (await shiftPayments()).filter((id) => !before.payments.includes(id));
    assert.equal(fresh.length, 1, `un paiement hors plateforme créé et rattaché à la caisse (trouvé ${fresh.length})`);
    const payment = await paymentRow(fresh[0]);
    const { data, error } = await service.from('tickets').select('*').eq('payment_id', fresh[0]).order('created_at');
    assert.equal(error, null, `billets de la vente : ${error?.message}`);
    return { payment, tickets: (data ?? []) as Row[] };
}

async function scansOf(ticketId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_scans').select('*').eq('ticket_id', ticketId).order('created_at');
    assert.equal(error, null, `ticket_scans du billet ${ticketId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Billets de guichet : sans porteur, jamais le vendeur ni le compte du numéro. */
function assertNoHolder(tickets: Row[], label: string, forbidden: string[]): void {
    for (const t of tickets) {
        assert.equal(t.user_id ?? null, null, `${label} : billet sans compte (user_id ${String(t.user_id)})`);
        for (const id of forbidden) assert.notEqual(t.user_id, id, `${label} : billet rattaché à ${id}`);
        assert.equal(t.sale_channel, 'COUNTER', `${label} : sale_channel COUNTER`);
    }
}

// ── Schéma ─────────────────────────────────────────────────────────────────

describe('C7 — schéma du billet sans compte', () => {
    test('tickets.user_id et payments.client_id nullables sous CHECK ; tickets.sale_channel ; ticket_scans.method COUNTER', async () => {
        const facts = await inspect(async (db) => {
            const cols = (await db.query<{ table_name: string; column_name: string; is_nullable: string; column_default: string | null }>(
                `SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns
                  WHERE table_schema = 'public' AND ((table_name = 'tickets' AND column_name IN ('user_id', 'sale_channel'))
                     OR (table_name = 'payments' AND column_name = 'client_id'))`)).rows;
            const checks = (await db.query<{ rel: string; def: string }>(
                `SELECT c.conrelid::regclass::text AS rel, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
                  WHERE c.contype = 'c' AND c.conrelid IN ('public.tickets'::regclass, 'public.payments'::regclass, 'public.ticket_scans'::regclass)`)).rows;
            const unset = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.tickets WHERE sale_channel IS NULL`).catch((err: Error) => {
                throw new Error(`tickets.sale_channel illisible : ${err.message}`);
            })).rows[0].n;
            return { cols, checks, unset };
        });
        const col = (t: string, c: string) => facts.cols.find((r) => r.table_name === t && r.column_name === c);
        assert.equal(col('tickets', 'user_id')?.is_nullable, 'YES', 'tickets.user_id nullable');
        assert.equal(col('payments', 'client_id')?.is_nullable, 'YES', 'payments.client_id nullable');
        assert.ok(col('tickets', 'sale_channel'), 'colonne tickets.sale_channel');
        assert.match(String(col('tickets', 'sale_channel')?.column_default), /ONLINE/, 'tickets.sale_channel : défaut ONLINE');
        assert.equal(facts.unset, 0, 'lignes existantes reprises (aucun sale_channel vide)');
        const defs = (rel: string) => facts.checks.filter((c) => c.rel.replace(/^public\./, '') === rel).map((c) => c.def);
        assert.ok(defs('tickets').some((d) => /user_id IS NOT NULL/i.test(d) && /COUNTER/.test(d)), `CHECK tickets (user_id ou COUNTER) : ${JSON.stringify(defs('tickets'))}`);
        assert.ok(defs('tickets').some((d) => /sale_channel/.test(d) && /ONLINE/.test(d) && /FREE/.test(d) && /INVITATION/.test(d) && /COUNTER/.test(d)), `CHECK des canaux de vente : ${JSON.stringify(defs('tickets'))}`);
        assert.ok(defs('payments').some((d) => /client_id IS NOT NULL/i.test(d) && /COUNTER_SALE/.test(d)), `CHECK payments (client_id ou vente au guichet) : ${JSON.stringify(defs('payments'))}`);
        assert.ok(defs('ticket_scans').some((d) => /method/.test(d) && /COUNTER/.test(d)), `CHECK ticket_scans.method avec COUNTER : ${JSON.stringify(defs('ticket_scans'))}`);
    });
});

// ── Vente ──────────────────────────────────────────────────────────────────

describe('C7 — vente au guichet = entrée immédiate', () => {
    test('Idempotency-Key absente → 400, rien vendu', async () => {
        const before = await snapshot();
        const res = await counterSale(seller, { eventId: ev.eventId, items: items(1) }, null);
        assert.equal(res.status, 400, `vente sans Idempotency-Key : ${show(res)}`);
        await assertNothingSold(before, 'vente sans Idempotency-Key');
    });

    test('vente sans numéro : billets UTILISE, une ligne ticket_scans COUNTER acceptée par billet, paiement hors plateforme sans client, caisse créditée, même transaction', async () => {
        const before = await snapshot();
        const res = await counterSale(seller, { eventId: ev.eventId, items: items(2) });
        assert.equal(res.status, 200, `vente au guichet : ${show(res)}`);
        assert.notEqual(res.body.ok, false, `vente acceptée : ${show(res)}`);
        assert.equal(res.body.receipt_queued, false, `aucun reçu sans numéro (lot 6 : receipt_queued) : ${show(res)}`);

        const { payment, tickets } = await saleOutcome(before);
        assert.equal(tickets.length, 2, 'deux billets émis');
        assertNoHolder(tickets, 'vente sans numéro', [seller.userId]);
        for (const t of tickets) {
            assert.equal(t.status, 'UTILISE', 'billet composté dès la vente (UTILISE)');
            assert.ok(t.checked_in_at, 'checked_in_at renseigné');
            assert.equal(Number(t.price), STANDARD, 'prix facial');
            const scans = await scansOf(String(t.id));
            const accepted = scans.filter((s) => s.accepted === true);
            assert.equal(accepted.length, 1, `une ligne ticket_scans acceptée par billet : ${JSON.stringify(scans)}`);
            const s = accepted[0];
            assert.equal(s.result, 'valid', 'scan : result valid');
            assert.equal(s.method, 'COUNTER', 'scan : method COUNTER');
            assert.equal(s.identity_verified, false, 'scan : identity_verified false');
            assert.equal(s.payload_hash ?? null, null, 'scan : payload_hash NULL');
            assert.equal(s.shift_id, shiftId, 'scan : rattaché à la caisse');
            assert.equal(Number(s.amount_due), STANDARD, 'scan : amount_due = prix');
            assert.equal(s.scanner_id, seller.userId, 'scan : fait par le vendeur');
            assert.equal(s.event_id, ev.eventId, 'scan : événement du billet');
            assert.equal(s.scanner_role, 'CONTROLEUR', 'scan : rôle du scanneur recopié (contrôleur affecté)');
            assert.equal(String(s.created_at), String(t.created_at), 'scan et billet écrits dans la même transaction (même now())');
        }
        assert.equal(payment.is_platform_payment, false, 'paiement hors plateforme');
        assert.equal(payment.status, 'SUCCESS', 'paiement SUCCESS');
        assert.equal(Number(payment.amount), 2 * STANDARD, 'montant = 2 × prix facial');
        assert.equal(payment.client_id ?? null, null, 'paiement sans client');
        assert.equal((payment.metadata as Row | null)?.source, 'COUNTER_SALE', 'metadata.source COUNTER_SALE');
        assert.equal(String(payment.created_at), String(tickets[0].created_at), 'paiement et billets écrits dans la même transaction (même now())');
        const now = await snapshot();
        assert.equal(now.expected, before.expected + 2 * STANDARD, 'total attendu de la caisse += 2 × prix');
        assert.equal(now.sold, before.sold + 2, 'stock décrémenté');
    });

    test('numéro d’un compte existant : billet sans compte (aucun rattachement), payer_phone renseigné', async () => {
        const client = await newBuyer('guichet-client');
        const before = await snapshot();
        const res = await counterSale(seller, { eventId: ev.eventId, items: items(1), buyerPhone: client.phoneE164 });
        assert.equal(res.status, 200, `vente avec le numéro d’un compte : ${show(res)}`);
        const { payment, tickets } = await saleOutcome(before);
        assert.equal(tickets.length, 1, 'un billet émis');
        assertNoHolder(tickets, 'numéro d’un compte existant', [client.userId, seller.userId]);
        assert.equal(payment.client_id ?? null, null, 'paiement sans client');
        assert.equal(payment.payer_phone, client.phone9, 'numéro conservé dans payments.payer_phone (9 chiffres)');
    });

    test('numéro du vendeur : jamais porteur', async () => {
        const before = await snapshot();
        const res = await counterSale(seller, { eventId: ev.eventId, items: items(1), buyerPhone: seller.phoneE164 });
        assert.equal(res.status, 200, `vente avec le numéro du vendeur : ${show(res)}`);
        const { tickets } = await saleOutcome(before);
        assert.equal(tickets.length, 1, 'un billet émis');
        assertNoHolder(tickets, 'numéro du vendeur', [seller.userId]);
    });

    test('même Idempotency-Key rejouée : même vente, aucun billet ni paiement en double, caisse créditée une fois', async () => {
        const key = randomUUID();
        const body = { eventId: ev.eventId, items: items(1) };
        const before = await snapshot();
        const first = await counterSale(seller, body, key);
        assert.equal(first.status, 200, `première vente : ${show(first)}`);
        const afterFirst = await snapshot();
        const replay = await counterSale(seller, body, key);
        assert.equal(replay.status, 200, `rejeu de la même clé : ${show(replay)}`);
        assert.equal(replay.body.payment_id, first.body.payment_id, `rejeu : même vente (payment_id) : ${show(first)} | ${show(replay)}`);
        const afterReplay = await snapshot();
        assert.deepEqual(afterReplay.tickets, afterFirst.tickets, 'rejeu : aucun billet en plus');
        assert.deepEqual(afterReplay.payments, afterFirst.payments, 'rejeu : aucun paiement en plus');
        assert.equal(afterReplay.expected, before.expected + STANDARD, 'caisse créditée une seule fois');
        assert.equal(afterReplay.sold, before.sold + 1, 'stock décrémenté une seule fois');
    });

    // Lot 6 (contrat J1.3, T) : le reçu est mis en file dans la transaction de la vente (receipt_queued),
    // puis remis par l'envoyeur ; un échec d'envoi laisse la ligne en relance, la vente est conservée.
    test('reçu SMS : numéro fourni → reçu en file (receipt_queued), SMS remis par l’envoyeur ; échec du SMS → vente conservée, ligne relancée', async () => {
        const sms = getFakes().sms;
        const phone = randomSenegalPhone('76');
        let before = await snapshot();
        const ok = await counterSale(seller, { eventId: ev.eventId, items: items(1), buyerPhone: phone });
        assert.equal(ok.status, 200, `vente avec reçu : ${show(ok)}`);
        assert.equal(ok.body.receipt_queued, true, `receipt_queued: true attendu : ${show(ok)}`);
        assert.equal(ok.body.receipt_refusal, null, `aucun refus du reçu : ${show(ok)}`);
        assert.equal(sms.messagesTo(phone).length, 0, 'aucun SMS envoyé par la route (boîte d’envoi)');
        const okRows = await outboxRows({ type: 'COUNTER_RECEIPT', phone });
        assert.deepEqual(okRows.map((r) => `${r.channel}:${r.status}`), ['SMS:PENDING'], `reçu en file : ${JSON.stringify(okRows.map((r) => [r.channel, r.status, r.reason]))}`);
        assert.equal(okRows[0].shift_id, shiftId, 'reçu rattaché à la caisse (quota par caisse)');
        await dispatchAt(new Date(), { ids: okRows.map((r) => r.id) });
        const received = sms.messagesTo(phone);
        assert.equal(received.length, 1, `un reçu SMS au numéro de l’acheteur (trouvé ${received.length})`);
        assert.equal(received[0].success, true, 'reçu remis');
        assert.doesNotMatch(received[0].message, EMOJI, `reçu sans emoji : ${received[0].message}`);
        assert.equal((await outboxRows({ ids: [okRows[0].id] }))[0].status, 'SENT', 'ligne du reçu SENT');
        await saleOutcome(before);

        const failing = randomSenegalPhone('76');
        before = await snapshot();
        const ko = await counterSale(seller, { eventId: ev.eventId, items: items(1), buyerPhone: failing });
        assert.equal(ko.status, 200, `vente avec reçu : ${show(ko)}`);
        assert.equal(ko.body.receipt_queued, true, `receipt_queued: true attendu : ${show(ko)}`);
        const koRows = await outboxRows({ type: 'COUNTER_RECEIPT', phone: failing });
        assert.equal(koRows.length, 1, 'ligne du reçu en file');
        sms.failNext('panne MTarget simulée (lot 6, relance du reçu)');
        await dispatchAt(new Date(), { ids: koRows.map((r) => r.id) });
        assert.ok(sms.messagesTo(failing).some((m) => !m.success), 'précondition : l’envoi du reçu a échoué (faux MTarget)');
        const [retry] = await outboxRows({ ids: [koRows[0].id] });
        assert.equal(retry.status, 'PENDING', `échec temporaire : reçu remis en attente (${retry.status} ${retry.reason ?? ''})`);
        assert.equal(Number(retry.attempts), 1, 'une tentative comptée');
        const { tickets } = await saleOutcome(before);
        assert.equal(tickets.length, 1, 'vente conservée');
        assert.equal(tickets[0].status, 'UTILISE', 'billet composté');
    });

    test('un nouveau scan d’un billet vendu au guichet → already_used, toujours une seule entrée acceptée', async () => {
        const before = await snapshot();
        const res = await counterSale(seller, { eventId: ev.eventId, items: items(1) });
        assert.equal(res.status, 200, `vente : ${show(res)}`);
        const { tickets } = await saleOutcome(before);
        const ticketId = String(tickets[0].id);
        const again = await scan(seller, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(again.status, 200, `nouveau scan : ${show(again)}`);
        assert.equal(again.body.result, 'already_used', `billet vendu au guichet déjà composté : ${show(again)}`);
        assert.equal((await scansOf(ticketId)).filter((s) => s.accepted === true).length, 1, 'une seule entrée acceptée');
    });

    test('garde-fou : le partenaire propriétaire ne vend pas au guichet (NOT_ASSIGNED), rien vendu', async () => {
        const before = await snapshot();
        const res = await counterSale(partner, { eventId: ev.eventId, items: items(1) });
        assert.ok(res.status >= 400 && res.status < 500, `vente par le partenaire : refus 4xx attendu : ${show(res)}`);
        assert.equal(res.body.code, 'NOT_ASSIGNED', `code NOT_ASSIGNED : ${show(res)}`);
        await assertNothingSold(before, 'vente par le partenaire');
    });

    test('garde-fou : invariants (g)(h)(i) vrais sur les billets, la caisse et les paiements de la suite', async () => {
        const ticketIds = new Set((await eventTickets(ev.eventId)).map((t) => String(t.id)));
        const paymentIds = new Set(await shiftPayments());
        const mine = (await accessViolations()).filter((v) => ticketIds.has(v.objet) || v.objet === shiftId || paymentIds.has(v.objet));
        assert.deepEqual(mine, [], `violations des invariants (g)(h)(i) sur les données de la suite :\n${mine.map((v) => `(${v.regle}) ${v.objet} : ${v.detail}`).join('\n')}`);
    });
});
