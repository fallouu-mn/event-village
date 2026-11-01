/**
 * Lot 5, tâche 5.13 — temps réel « Mes billets » et notifications (contrat, sections O2, O4 et O5).
 *  - exigence « billet composté → statut mis à jour chez son porteur » : le porteur, abonné à tickets avec
 *    le filtre user_id, reçoit le passage à UTILISE au scan ; un autre client (avec le filtre du porteur,
 *    ou sans filtre) et anon ne reçoivent rien ;
 *  - tickets reste publiée, mais les colonnes totp_secret et qr_code ne sont plus lisibles par
 *    authenticated (REVOKE de colonne) : absentes du catalogue des privilèges et de la charge Realtime
 *    reçue par le porteur et par le partenaire propriétaire ;
 *  - notifications : le destinataire reçoit sa notification (INSERT) et son passage à « lue » (UPDATE),
 *    un autre compte et anon ne reçoivent rien ;
 *  - compteur de la cloche (GET /api/notifications) : notifications de l'application (canal PUSH) non lues
 *    seulement.
 * La suite crée son partenaire, ses acheteurs et son événement (dans la fenêtre de scan).
 * Rouge avant correctif :
 *  - tickets en REPLICA IDENTITY FULL (supabase/migrations/0004_indexes.sql:134,
 *    20260907000003_tickets_realtime_replica.sql:7) avec le privilège SELECT de table pour authenticated :
 *    totp_secret (20261101000010_lot4_scan.sql:19-26) et qr_code (0001_initial_schema.sql:359) sont dans
 *    chaque charge Realtime reçue par le porteur et par le partenaire ;
 *  - unreadCount compte toutes les notifications non lues, tous canaux confondus
 *    (app/api/notifications/route.ts:40-44).
 * Garde-fous (verts aujourd'hui sur le fond) : le porteur reçoit UTILISE et ses notifications, un autre
 * client et anon rien (RLS tickets_read, 20261031000004_lot1b3_controleur_lectures.sql:15-32 ;
 * notifications_read_own, 0003_rls.sql:342-343).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inspect } from '../helpers/db';
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
    type ReceivedChange,
} from '../helpers/realtime';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, scan, ticketPayload } from './acces-helpers';

const SECRET_COLUMNS = ['totp_secret', 'qr_code'];
const SETTLE_MS = 1_500;

let partner: TestPartner;
let holder: Buyer;
let other: Buyer;
let ev: SaleEvent;
/** Billets du porteur : le premier est composté, le second sert de vivacité et de sentinelle. */
let scanned: string;
let spare: string;

before(async () => {
    partner = await newPartner('tr-billets');
    ev = await createTimedEvent(partner.partnerId, 'tr-billets', [{ name: 'Standard', price: 3000, total: 20 }]);
    holder = await newBuyer('tr-porteur');
    other = await newBuyer('tr-autre');
    const { tickets } = await buyConfirmed(holder, ev, [['Standard', 2]]);
    assert.equal(tickets.length, 2, 'deux billets émis pour le porteur');
    scanned = String(tickets[0].id);
    spare = String(tickets[1].id);
});

after(async () => {
    await assertLifecycleInvariants('temps-reel-billets');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

let tick = 0;

/** Touche updated_at du billet avec un instant unique (action reproductible) ; renvoie cet instant. */
async function touchTicket(ticketId: string): Promise<string> {
    tick += 1;
    const at = new Date(Date.now() + tick).toISOString();
    const { error } = await service.from('tickets').update({ updated_at: at }).eq('id', ticketId);
    assert.equal(error, null, `mise à jour du billet ${ticketId} : ${error?.message}`);
    return at;
}

function sameInstant(value: unknown, iso: string): boolean {
    return typeof value === 'string' && Date.parse(value) === Date.parse(iso);
}

function carriesData(e: ReceivedChange): boolean {
    return Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
}

async function insertNotification(userId: string, fields: { title?: string; channel?: string; status?: string } = {}): Promise<string> {
    const title = fields.title ?? `Notification de test ${randomUUID().slice(0, 8)}`;
    const { data, error } = await service.from('notifications').insert({
        user_id: userId,
        type: 'TICKET_TRANSFER_CLAIMED',
        title,
        content: 'Notification dédiée aux tests du temps réel (lot 5).',
        channel: fields.channel ?? 'PUSH',
        status: fields.status ?? 'SENT',
        read_at: fields.status === 'READ' ? new Date().toISOString() : null,
        metadata: { source: 'tests-lot5-temps-reel' },
    }).select('id').single();
    assert.equal(error, null, `notification de test : ${error?.message}`);
    return String(data.id);
}

// ── Compostage ─────────────────────────────────────────────────────────────

describe('Billet composté : statut mis à jour chez son porteur (O4)', () => {
    test('garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien', async () => {
        const holderC = await signedInClient({ email: holder.email });
        const otherC = await signedInClient({ email: other.email });
        const anon = anonClient();
        try {
            const mine = subscribeCollect(holderC, { table: 'tickets', filter: `user_id=eq.${holder.userId}` }, { label: 'porteur tickets (filtre user_id)' });
            const spyFiltered = subscribeCollect(otherC, { table: 'tickets', filter: `user_id=eq.${holder.userId}` }, { label: 'autre client tickets (filtre du porteur)' });
            const spyAll = subscribeCollect(otherC, { table: 'tickets' }, { label: 'autre client tickets (sans filtre)' });
            const anonSpy = subscribeCollect(anon, { table: 'tickets', filter: `user_id=eq.${holder.userId}` }, { label: 'anon tickets (filtre du porteur)' });
            await Promise.all([mine, spyFiltered, spyAll, anonSpy].map((c) => c.ready));
            await produceUntilReceived(mine, () => touchTicket(spare), (e) => e.new.id === spare,
                { what: 'vivacité : mise à jour d’un billet du porteur reçue par le porteur' });

            const res = await scan(partner, { eventId: ev.eventId, payload: await ticketPayload(scanned) });
            assert.equal(res.status, 200, `scan : HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.equal(res.body.result, 'valid', `scan du billet du porteur : ${JSON.stringify(res.body)}`);
            const used = await waitForEvent(mine, (e) => e.new.id === scanned && e.new.status === 'UTILISE', RECEIVE_TIMEOUT_MS,
                'passage à UTILISE reçu par le porteur, sans recharger');
            assert.ok(used.new.checked_in_at, `heure d’entrée diffusée au porteur : ${JSON.stringify(used.new)}`);

            const marker = await touchTicket(spare);
            await waitForEvent(mine, (e) => e.new.id === spare && sameInstant(e.new.updated_at, marker), RECEIVE_TIMEOUT_MS, 'sentinelle reçue par le porteur');
            await expectNothing(spyFiltered, SETTLE_MS, carriesData, 'autre client abonné avec le filtre du porteur : aucun billet');
            await expectNothing(spyAll, 0, carriesData, 'autre client abonné sans filtre : aucun billet');
            await expectNothing(anonSpy, 0, carriesData, 'anon : aucun billet');
        } finally {
            await disposeClients(holderC, otherC, anon);
        }
    });

    test('totp_secret et qr_code : non lisibles par authenticated (REVOKE de colonne), absents de la charge reçue par le porteur et par le partenaire', async () => {
        const privileges = await inspect(async (db) => (await db.query<{ role: string; col: string; allowed: boolean }>(
            `SELECT r.rname AS role, c.col, has_column_privilege(r.rname, 'public.tickets', c.col, 'SELECT') AS allowed
               FROM unnest(ARRAY['anon', 'authenticated']) AS r(rname)
              CROSS JOIN unnest(ARRAY['totp_secret', 'qr_code', 'status', 'id']) AS c(col)`,
        )).rows);
        for (const p of privileges) {
            if (SECRET_COLUMNS.includes(p.col)) {
                assert.equal(p.allowed, false, `${p.role} ne doit pas lire tickets.${p.col} (REVOKE de colonne, contrat O2)`);
            }
        }
        const statusOk = privileges.find((p) => p.role === 'authenticated' && p.col === 'status');
        assert.equal(statusOk?.allowed, true, 'authenticated lit toujours tickets.status (Mes billets en temps réel)');

        const holderC = await signedInClient({ email: holder.email });
        const ownerC = await signedInClient({ email: partner.email });
        try {
            const mine = subscribeCollect(holderC, { table: 'tickets', filter: `user_id=eq.${holder.userId}` }, { label: 'porteur tickets' });
            const owner = subscribeCollect(ownerC, { table: 'tickets', filter: `event_id=eq.${ev.eventId}` }, { label: 'partenaire propriétaire tickets' });
            await Promise.all([mine.ready, owner.ready]);
            await produceUntilReceived(mine, () => touchTicket(spare), (e) => e.new.id === spare,
                { what: 'vivacité : mise à jour d’un billet reçue par le porteur' });
            const marker = await touchTicket(spare);
            const toHolder = await waitForEvent(mine, (e) => e.new.id === spare && sameInstant(e.new.updated_at, marker), RECEIVE_TIMEOUT_MS, 'billet reçu par le porteur');
            const toOwner = await waitForEvent(owner, (e) => e.new.id === spare && sameInstant(e.new.updated_at, marker), RECEIVE_TIMEOUT_MS, 'billet reçu par le partenaire propriétaire');
            for (const [who, e] of [['porteur', toHolder], ['partenaire propriétaire', toOwner]] as Array<[string, ReceivedChange]>) {
                const leaked = Object.keys(e.new).filter((k) => SECRET_COLUMNS.includes(k)).concat(Object.keys(e.old).filter((k) => SECRET_COLUMNS.includes(k)));
                assert.deepEqual(leaked, [], `${who} : colonnes secrètes diffusées par Realtime : ${leaked.join(', ')}`);
                assert.equal(e.new.status, 'VALIDE', `${who} : le statut reste diffusé (${JSON.stringify(e.new)})`);
            }
        } finally {
            await disposeClients(holderC, ownerC);
        }
    });
});

// ── Notifications ──────────────────────────────────────────────────────────

describe('Notifications : le destinataire seul reçoit les siennes (O2, O5)', () => {
    test('garde-fou : INSERT puis passage à « lue » reçus par le destinataire ; un autre compte et anon ne reçoivent rien', async () => {
        const recipient = await signedInClient({ email: holder.email });
        const otherC = await signedInClient({ email: other.email });
        const anon = anonClient();
        try {
            const mine = subscribeCollect(recipient, { table: 'notifications', filter: `user_id=eq.${holder.userId}` }, { label: 'destinataire notifications' });
            const spyFiltered = subscribeCollect(otherC, { table: 'notifications', filter: `user_id=eq.${holder.userId}` }, { label: 'autre compte notifications (filtre du destinataire)' });
            const spyAll = subscribeCollect(otherC, { table: 'notifications' }, { label: 'autre compte notifications (sans filtre)' });
            const anonSpy = subscribeCollect(anon, { table: 'notifications', filter: `user_id=eq.${holder.userId}` }, { label: 'anon notifications' });
            await Promise.all([mine, spyFiltered, spyAll, anonSpy].map((c) => c.ready));
            await produceUntilReceived(mine, () => insertNotification(holder.userId), (e) => e.new.user_id === holder.userId,
                { what: 'vivacité : notification reçue par son destinataire' });

            const title = `Votre billet a été transféré ${randomUUID().slice(0, 8)}`;
            const id = await insertNotification(holder.userId, { title });
            const got = await waitForEvent(mine, (e) => e.eventType === 'INSERT' && e.new.id === id, RECEIVE_TIMEOUT_MS, 'notification reçue par son destinataire');
            assert.equal(got.new.title, title);
            const { error } = await service.from('notifications').update({ status: 'READ', read_at: new Date().toISOString() }).eq('id', id);
            assert.equal(error, null, `notification marquée lue : ${error?.message}`);
            await waitForEvent(mine, (e) => e.eventType === 'UPDATE' && e.new.id === id && e.new.status === 'READ', RECEIVE_TIMEOUT_MS,
                'passage à « lue » reçu par le destinataire (compteur de la cloche)');

            const sentinelId = await insertNotification(holder.userId);
            await waitForEvent(mine, (e) => e.new.id === sentinelId, RECEIVE_TIMEOUT_MS, 'sentinelle reçue par le destinataire');
            await expectNothing(spyFiltered, SETTLE_MS, carriesData, 'autre compte abonné avec le filtre du destinataire : aucune notification');
            await expectNothing(spyAll, 0, carriesData, 'autre compte abonné sans filtre : aucune notification');
            await expectNothing(anonSpy, 0, carriesData, 'anon : aucune notification');
        } finally {
            await disposeClients(recipient, otherC, anon);
        }
    });

    test('compteur de la cloche : GET /api/notifications compte les seules notifications PUSH non lues', async () => {
        const user = await newBuyer('tr-cloche');
        await insertNotification(user.userId, { channel: 'PUSH', status: 'SENT' });
        await insertNotification(user.userId, { channel: 'PUSH', status: 'PENDING' });
        await insertNotification(user.userId, { channel: 'PUSH', status: 'READ' });
        await insertNotification(user.userId, { channel: 'SMS', status: 'SENT' });
        await insertNotification(user.userId, { channel: 'EMAIL', status: 'PENDING' });

        const { data: rows, error } = await service.from('notifications').select('channel, status').eq('user_id', user.userId);
        assert.equal(error, null, `notifications du compte : ${error?.message}`);
        const pushUnread = (rows ?? []).filter((n) => n.channel === 'PUSH' && n.status !== 'READ').length;
        const allUnread = (rows ?? []).filter((n) => n.status !== 'READ').length;
        assert.ok(allUnread > pushUnread, `jeu de test : des notifications non lues hors PUSH existent (${allUnread} contre ${pushUnread})`);

        const { GET } = await importModule('../../app/api/notifications/route');
        const res: Response = await GET(jsonRequest('/api/notifications?limit=20', 'GET', user.accessToken));
        const body = (await res.json()) as { unreadCount?: unknown };
        assert.equal(res.status, 200, `GET /api/notifications : HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
        assert.equal(body.unreadCount, pushUnread, `compteur : notifications PUSH non lues (${pushUnread}), tous canaux : ${allUnread} ; reçu ${JSON.stringify(body.unreadCount)}`);
    });
});
