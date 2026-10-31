/**
 * Lot 4, complément « données pour le pilotage » (utilisées au lot 5, sans écran dans ce lot) :
 *  - ticket_scans enregistre pour chaque tentative : événement, billet, catégorie, scanneur et son
 *    rôle (CONTROLEUR, PARTENAIRE ou ADMIN), résultat, saisie manuelle, point d'entrée, horodatage ;
 *  - point d'entrée : champ optionnel de l'affectation d'un contrôleur (event_controllers.entry_point),
 *    modifiable par le partenaire propriétaire (PATCH /api/partner/team/entry-point), recopié sur
 *    chaque scan au moment du scan ;
 *  - index (event_id, created_at) et (event_id, scanner_id) ;
 *  - lecture (API et Realtime) par le seul partenaire propriétaire de l'événement et les admins :
 *    le partenaire B ne reçoit rien des scans de l'événement de A.
 * Rouge avant correctif : aucune colonne category_id, entry_point ni scanner_role ; table illisible
 * par tout compte connecté et absente de la publication Realtime ; pas de point d'entrée.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { inspect } from '../helpers/db';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { STRONG_PASSWORD } from './helpers';
import { service, importModule, newBuyer, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, buyConfirmed, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, scan, scansOf, ticketPayload } from './acces-helpers';

let partnerA: TestPartner;
let partnerB: TestPartner;
let controller: Buyer;
let ev: SaleEvent;
let evB: SaleEvent;

async function signedClient(user: Buyer): Promise<SupabaseClient> {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: user.email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion de ${user.email} : ${error?.message}`);
    return client;
}

async function waitFor(check: () => boolean, timeoutMs: number, what: string): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (check()) return;
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`délai dépassé (${timeoutMs} ms) : ${what}`);
}

async function setEntryPoint(user: Buyer, body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const { PATCH } = await importModule('../../app/api/partner/team/entry-point/route');
    const res: Response = await PATCH(authed('/api/partner/team/entry-point', 'PATCH', user, body));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('Données de pilotage : ticket_scans', () => {
    before(async () => {
        partnerA = await newPartner('pilotage-a');
        partnerB = await newPartner('pilotage-b');
        ev = await createTimedEvent(partnerA.partnerId, 'pilotage-a', [{ name: 'Standard', price: 2000, total: 20 }, { name: 'VIP', price: 6000, total: 5 }]);
        evB = await createTimedEvent(partnerB.partnerId, 'pilotage-b', [{ name: 'Standard', price: 2000, total: 20 }]);
        controller = await newController(partnerA, ev.eventId, { label: 'pilotage' });
    });

    after(async () => {
        await assertAccessInvariants('acces-pilotage');
    });

    test('point d’entrée : modifiable par le partenaire propriétaire seulement, recopié sur le scan avec la catégorie et le rôle du scanneur', async () => {
        const denied = await setEntryPoint(partnerB, { controllerId: controller.userId, eventId: ev.eventId, entryPoint: 'Porte pirate' });
        assert.ok([403, 404].includes(denied.status), `partenaire étranger : HTTP ${denied.status} ${JSON.stringify(denied.body)}`);
        const tooLong = await setEntryPoint(partnerA, { controllerId: controller.userId, eventId: ev.eventId, entryPoint: 'x'.repeat(81) });
        assert.equal(tooLong.status, 400, 'point d’entrée trop long refusé');
        const set = await setEntryPoint(partnerA, { controllerId: controller.userId, eventId: ev.eventId, entryPoint: 'Entrée VIP' });
        assert.equal(set.status, 200, `réglage du point d’entrée : HTTP ${set.status} ${JSON.stringify(set.body)}`);
        const { data: ec, error } = await service.from('event_controllers').select('entry_point').eq('event_id', ev.eventId).eq('user_id', controller.userId).single();
        assert.equal(error, null, error?.message);
        assert.equal(ec.entry_point, 'Entrée VIP');

        const buyer = await newBuyer('pilotage-acheteur');
        const { tickets } = await buyConfirmed(buyer, ev, [['VIP', 1]]);
        const ticket = tickets[0];
        const res = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(String(ticket.id)) });
        assert.equal(res.body.result, 'valid', `scan : ${JSON.stringify(res.body)}`);
        const [row] = (await scansOf(String(ticket.id))).filter((s) => s.accepted === true);
        assert.ok(row, 'scan accepté journalisé');
        assert.equal(row.event_id, ev.eventId);
        assert.equal(row.category_id, ticket.category_id, 'catégorie du billet recopiée');
        assert.equal(row.scanner_id, controller.userId);
        assert.equal(row.scanner_role, 'CONTROLEUR', 'rôle du scanneur');
        assert.equal(row.entry_point, 'Entrée VIP', 'point d’entrée recopié au moment du scan');
        assert.equal(row.method, 'QR');
        assert.ok(row.created_at, 'horodatage');

        // Un changement ultérieur du point d'entrée ne réécrit pas les scans passés
        const changed = await setEntryPoint(partnerA, { controllerId: controller.userId, eventId: ev.eventId, entryPoint: 'Porte A' });
        assert.equal(changed.status, 200);
        const [again] = (await scansOf(String(ticket.id))).filter((s) => s.accepted === true);
        assert.equal(again.entry_point, 'Entrée VIP', 'le scan garde le point d’entrée du moment');

        // Scan par le partenaire propriétaire : rôle PARTENAIRE, pas de point d'entrée
        const buyer2 = await newBuyer('pilotage-acheteur-2');
        const { tickets: t2 } = await buyConfirmed(buyer2, ev, [['Standard', 1]]);
        const res2 = await scan(partnerA, { eventId: ev.eventId, payload: await ticketPayload(String(t2[0].id)) });
        assert.equal(res2.body.result, 'valid', JSON.stringify(res2.body));
        const [row2] = (await scansOf(String(t2[0].id))).filter((s) => s.accepted === true);
        assert.equal(row2.scanner_role, 'PARTENAIRE');
        assert.equal(row2.entry_point, null);
    });

    test('index par événement et période, et par événement et scanneur', async () => {
        const defs = await inspect(async (db) => (await db.query<{ indexdef: string }>(
            "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ticket_scans'")).rows.map((r) => r.indexdef));
        assert.ok(defs.some((d) => /\(event_id, created_at\)/.test(d)), `index (event_id, created_at) : ${defs.join(' | ')}`);
        assert.ok(defs.some((d) => /\(event_id, scanner_id/.test(d)), `index (event_id, scanner_id) : ${defs.join(' | ')}`);
    });

    test('lecture par l’API : partenaire propriétaire oui, partenaire B et client non', async () => {
        const { error: insErr } = await service.rpc('scan_log', {
            p_ticket: null, p_event: ev.eventId, p_scanner: controller.userId, p_result: 'invalid', p_accepted: false,
            p_method: 'QR', p_identity: false, p_hash: 'a'.repeat(64), p_amount: null,
        });
        assert.equal(insErr, null, `journal d’une tentative : ${insErr?.message}`);
        const owner = await signedClient(partnerA);
        const { data: mine, error: ownErr } = await owner.from('ticket_scans').select('id, event_id').eq('event_id', ev.eventId);
        assert.equal(ownErr, null, `lecture par le propriétaire : ${ownErr?.message}`);
        assert.ok((mine ?? []).length >= 1, 'le partenaire propriétaire lit les scans de son événement');
        const other = await signedClient(partnerB);
        const { data: theirs } = await other.from('ticket_scans').select('id').eq('event_id', ev.eventId);
        assert.deepEqual(theirs ?? [], [], 'le partenaire B ne lit pas les scans de l’événement de A');
        const client = await signedClient(await newBuyer('pilotage-curieux'));
        const { data: cl } = await client.from('ticket_scans').select('id').eq('event_id', ev.eventId);
        assert.deepEqual(cl ?? [], [], 'un client ne lit pas le journal des scans');
    });

    test('Realtime : le partenaire propriétaire reçoit les scans de son événement, le partenaire B rien', async () => {
        const owner = await signedClient(partnerA);
        const intruder = await signedClient(partnerB);
        const toOwner: Array<Record<string, unknown>> = [];
        const toIntruder: Array<Record<string, unknown>> = [];
        const channels: Array<[SupabaseClient, RealtimeChannel]> = [];
        const subscribe = async (client: SupabaseClient, eventId: string, sink: Array<Record<string, unknown>>) => {
            const channel = client.channel(`pilotage-${randomBytes(4).toString('hex')}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_scans', filter: `event_id=eq.${eventId}` },
                    (payload: { new: Record<string, unknown> }) => sink.push(payload.new));
            channels.push([client, channel]);
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('abonnement Realtime non confirmé en 20 s')), 20_000);
                channel.subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(`abonnement : ${status} ${err?.message ?? ''}`)); }
                });
            });
        };
        const logScan = async (eventId: string) => {
            const { error } = await service.rpc('scan_log', {
                p_ticket: null, p_event: eventId, p_scanner: controller.userId, p_result: 'invalid', p_accepted: false,
                p_method: 'QR', p_identity: false, p_hash: randomBytes(32).toString('hex'), p_amount: null,
            });
            assert.equal(error, null, `journal d’une tentative : ${error?.message}`);
        };
        try {
            await subscribe(owner, ev.eventId, toOwner);
            await subscribe(intruder, ev.eventId, toIntruder);
            await subscribe(intruder, evB.eventId, toIntruder);
            const deadline = Date.now() + 30_000;
            while (toOwner.length === 0 && Date.now() < deadline) {
                await logScan(ev.eventId);
                await new Promise((r) => setTimeout(r, 1_500));
            }
            assert.ok(toOwner.length > 0, 'le partenaire propriétaire reçoit en temps réel les scans de son événement');
            await logScan(ev.eventId);
            const seen = toOwner.length;
            await waitFor(() => toOwner.length > seen, 20_000, 'sentinelle reçue par le propriétaire');
            await new Promise((r) => setTimeout(r, 1_000));
            assert.deepEqual(toIntruder.filter((s) => s.event_id === ev.eventId), [], 'le partenaire B ne reçoit rien des scans de l’événement de A');
        } finally {
            for (const [client, channel] of channels) await client.removeChannel(channel);
            owner.realtime.disconnect();
            intruder.realtime.disconnect();
        }
    });
});
