/**
 * Contre-vérification de la finition 1, attaque 2 — ce que voit un contrôleur.
 *
 * Le contrôleur C1 (rôle CONTROLEUR, affecté) essaie :
 *  a. de lire l'équipe (routes GET team, team/all, team/[eventId]), les autres contrôleurs et leurs numéros, par les routes
 *     et par la REST (event_controllers, users, controller_shifts, controller_invitations, partner_controllers,
 *     ticket_scans, tickets), et les fonctions partner_team_view / controller_evenings par la REST ;
 *  b. « Mes soirées » (GET /api/account/evenings) : ne doit rendre que SES chiffres, aucun nom, numéro ni billet de client,
 *     rien de C2 — y compris avec l'identifiant de C2 ajouté à l'adresse, dans un en-tête ou dans un corps ;
 *  c. faire apparaître dans « Mes soirées » l'événement d'une autre organisatrice qu'il n'a jamais contrôlé, en y tentant un
 *     scan (refusé) : la liste dit « affecté, a scanné ou a tenu une caisse », un refus n'est rien de cela. Même essai par
 *     un simple client.
 * Sortie brute `[CVF1-2]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newController } from '../parcours/acces-helpers';
import { shiftEventDates } from '../parcours/cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    anonClient, api, freeEvent, freeTicket, leaks, ok2xx, restRows, restRpc, scanTicket, show, userClient, type Reply, type Row,
} from './cvf1-helpers';

const ALLOWED_KEYS = ['event_id', 'title', 'status', 'start_at', 'organizer', 'gate', 'zone', 'entry_point', 'entries', 'cash'];

let P: TestPartner;
let Q: TestPartner;
let evPast: SaleEvent;
let evQ: SaleEvent;
let c1: Buyer;
let c2: Buyer;
let buyer: Buyer;
let t1: { id: string; number: string };
let t2: { id: string; number: string };
let t3: { id: string; number: string };
let tQ: { id: string; number: string };

before(async () => {
    P = await newPartner('cvf1-ctrl-p');
    Q = await newPartner('cvf1-ctrl-q');
    evPast = await freeEvent(P, 'ctrl-soiree', { startsInHours: 1 });
    c1 = await newController(P, evPast.eventId, { label: 'cvf1-c1' });
    c2 = await newController(P, evPast.eventId, { canAcceptCash: true, label: 'cvf1-c2' });
    buyer = await newBuyer('cvf1-ctrl-acheteur', { firstName: 'Mariama', lastName: 'Diopbinta' });
    t1 = await freeTicket(evPast, buyer);
    t2 = await freeTicket(evPast, buyer);
    t3 = await freeTicket(evPast, buyer);
    const s1 = await scanTicket(c1, evPast.eventId, t1.id);
    assert.equal(s1.body.result, 'valid', `scan de C1 (montage) : ${show(s1)}`);
    const s2 = await scanTicket(c2, evPast.eventId, t2.id);
    assert.equal(s2.body.result, 'valid', `scan de C2 (montage) : ${show(s2)}`);
    // La soirée est passée : elle entre dans « Mes soirées »
    await shiftEventDates(evPast.eventId, { startsInHours: -30, durationHours: 4 });
    evQ = await freeEvent(Q, 'ctrl-autre', { startsInHours: -30, durationHours: 4 });
    tQ = await freeTicket(evQ, buyer);
});

after(async () => {
    await assertFinition1Invariants('cvf1-2-controleur');
});

function clientSecrets(): string[] {
    return [buyer.phoneE164, buyer.phone9, buyer.userId, buyer.email, 'Diopbinta', t1.id, t1.number, t2.id, t2.number, t3.id, t3.number];
}

function otherControllerSecrets(): string[] {
    return [c2.userId, c2.phoneE164, c2.phone9, c2.email];
}

describe('a. le contrôleur ne voit ni l’équipe, ni les autres contrôleurs, ni les numéros', () => {
    test('routes de l’équipe : refusées ou vides', async () => {
        const breaches: string[] = [];
        const t = c1.accessToken;
        const tries: Array<[string, Promise<Reply>]> = [
            ['GET /api/partner/team', api('GET', 'partner/team', { token: t })],
            ['GET /api/partner/team?eventId=<soirée>', api('GET', 'partner/team', { token: t, path: `/api/partner/team?eventId=${evPast.eventId}` })],
            ['GET /api/partner/team?partnerId=<P>', api('GET', 'partner/team', { token: t, path: `/api/partner/team?partnerId=${P.partnerId}` })],
            ['GET /api/partner/team/all', api('GET', 'partner/team/all', { token: t })],
            ['GET /api/partner/team/[eventId]', api('GET', 'partner/team/[eventId]', { token: t, path: `/api/partner/team/${evPast.eventId}`, params: { eventId: evPast.eventId } })],
        ];
        for (const [what, p] of tries) {
            const r = await p;
            const found = leaks(JSON.stringify(r.body), [...otherControllerSecrets(), ...clientSecrets()]);
            console.log(`[CVF1-2] ${what} → ${show(r)}${found.length ? ` ; fuite : ${found.join(', ')}` : ''}`);
            if (ok2xx(r)) breaches.push(`${what} → ${show(r)}`);
        }
        assert.deepEqual(breaches, [], `le contrôleur lit l'équipe :\n${breaches.join('\n')}`);
    });

    test('REST et fonctions : sa ligne seulement, rien de C2 ni des clients', async () => {
        const breaches: string[] = [];
        const client = userClient(c1.accessToken);
        const checks: Array<[string, Record<string, string>, (r: Row) => boolean]> = [
            ['event_controllers', { event_id: evPast.eventId }, (r) => r.user_id !== c1.userId],
            ['users', { id: c2.userId }, () => true],
            ['users', { id: buyer.userId }, () => true],
            ['controller_shifts', { event_id: evPast.eventId }, (r) => r.controller_id !== c1.userId],
            ['controller_invitations', { partner_id: P.partnerId }, () => true],
            ['partner_controllers', { partner_id: P.partnerId }, () => true],
            ['ticket_scans', { event_id: evPast.eventId }, (r) => r.scanner_id !== c1.userId],
            ['tickets', { event_id: evPast.eventId }, () => true],
        ];
        for (const [table, filter, foreign] of checks) {
            const r = await restRows(client, table, filter);
            const bad = r.rows.filter(foreign);
            console.log(`[CVF1-2] REST ${table} ${JSON.stringify(filter)} → ${r.rows.length} ligne(s), dont ${bad.length} d'autrui${r.error ? ` ; refus ${r.error}` : ''}`);
            if (bad.length > 0) breaches.push(`${table} : ${bad.length} ligne(s) d'autrui ${JSON.stringify(bad).slice(0, 300)}`);
        }
        for (const [fn, args] of [
            ['partner_team_view', { p: { partner_id: P.partnerId } }],
            ['controller_evenings', { p: { user_id: c2.userId } }],
            ['controller_evening_figures', { p_user: c2.userId, p_event: evPast.eventId }],
        ] as Array<[string, Row]>) {
            for (const [label, cl] of [['jeton de C1', client], ['anon', anonClient()]] as const) {
                const r = await restRpc(cl, fn, args);
                console.log(`[CVF1-2] RPC ${label} ${fn} → ${r.ok ? `EXÉCUTÉE ${JSON.stringify(r.data).slice(0, 200)}` : `refus ${r.error}`}`);
                if (r.ok) breaches.push(`${label} exécute ${fn}`);
            }
        }
        assert.deepEqual(breaches, [], `le contrôleur lit des données d'autrui :\n${breaches.join('\n')}`);
    });
});

describe('b. « Mes soirées » : ses chiffres seulement', () => {
    async function evenings(token: string | null, path = '/api/account/evenings', headers: Record<string, string> = {}): Promise<Reply> {
        return api('GET', 'account/evenings', { token, path, headers });
    }

    test('sa soirée : ses entrées, aucune donnée de client ni de C2 ; champs de la liste fermée', async () => {
        const r = await evenings(c1.accessToken);
        console.log(`[CVF1-2] GET /api/account/evenings (C1) → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        const items = (r.body.items ?? []) as Row[];
        const mine = items.find((i) => i.event_id === evPast.eventId);
        assert.ok(mine, `soirée de C1 absente : ${show(r)}`);
        assert.equal(Number(mine.entries), 1, `entrées de C1 : ${String(mine.entries)} (C2 en a validé une autre)`);
        assert.equal(mine.cash, null, `caisse servie à C1 qui n'en a pas tenu : ${JSON.stringify(mine.cash)}`);
        for (const it of items) {
            const extra = Object.keys(it).filter((k) => !ALLOWED_KEYS.includes(k));
            assert.deepEqual(extra, [], `champs hors de la liste fermée : ${extra.join(', ')}`);
        }
        const found = leaks(JSON.stringify(r.body), [...clientSecrets(), ...otherControllerSecrets()]);
        assert.deepEqual(found, [], `« Mes soirées » de C1 contient : ${found.join(', ')}`);
    });

    test('identifiant de C2 dans l’adresse, un en-tête ou un corps : toujours les chiffres de C1', async () => {
        const base = await evenings(c1.accessToken);
        const id = c2.userId;
        const variants: Array<[string, Reply]> = [
            ['?user_id', await evenings(c1.accessToken, `/api/account/evenings?user_id=${id}&userId=${id}&controllerId=${id}&controller_id=${id}&id=${id}`)],
            ['en-têtes', await evenings(c1.accessToken, '/api/account/evenings', { 'x-user-id': id, 'x-controller-id': id })],
        ];
        for (const [what, r] of variants) {
            console.log(`[CVF1-2] GET /api/account/evenings (C1, ${what} = C2) → ${show(r)}`);
            assert.equal(r.status, 200, show(r));
            assert.deepEqual(r.body.items, base.body.items, `${what} : la réponse change avec l'identifiant de C2`);
        }
        const mod = (await import('../../app/api/account/evenings/route')) as Record<string, unknown>;
        const writers = ['POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => typeof mod[m] === 'function');
        console.log(`[CVF1-2] méthodes d'écriture exposées par /api/account/evenings : ${writers.join(', ') || 'aucune'}`);
        for (const m of writers) {
            const r = await api(m, 'account/evenings', { token: c1.accessToken, body: { user_id: id, userId: id } });
            console.log(`[CVF1-2] ${m} /api/account/evenings (corps user_id = C2) → ${show(r)}`);
            const found = leaks(JSON.stringify(r.body), otherControllerSecrets());
            assert.ok(!(ok2xx(r) && found.length > 0), `${m} rend des données de C2 : ${show(r)}`);
        }
        const anon = await evenings(null);
        console.log(`[CVF1-2] GET /api/account/evenings sans session → ${show(anon)}`);
        assert.equal(anon.status, 401, `sans session : ${show(anon)}`);
    });
});

describe('c. un scan refusé ne fait pas entrer l’événement d’autrui dans « Mes soirées »', () => {
    test('contrôleur de P qui tente un scan chez Q, puis client sans rôle : l’événement de Q n’apparaît pas', async () => {
        const breaches: string[] = [];
        const refused = await scanTicket(c1, evQ.eventId, tQ.id);
        console.log(`[CVF1-2] scan de C1 sur l'événement de Q → ${show(refused)}`);
        assert.notEqual(refused.body.result, 'valid', `scan accepté chez Q : ${show(refused)}`);
        const r1 = await api('GET', 'account/evenings', { token: c1.accessToken });
        const leaked1 = ((r1.body.items ?? []) as Row[]).find((i) => i.event_id === evQ.eventId);
        console.log(`[CVF1-2] « Mes soirées » de C1 après le refus chez Q → ${leaked1 ? `CONTIENT ${JSON.stringify(leaked1)}` : 'absent'}`);
        if (leaked1) breaches.push(`contrôleur de P : « Mes soirées » montre l'événement de Q après un scan refusé : ${JSON.stringify(leaked1)}`);

        const client = await newBuyer('cvf1-ctrl-curieux', { firstName: 'Curieux', lastName: 'Client' });
        const refused2 = await scanTicket(client, evQ.eventId, tQ.id);
        console.log(`[CVF1-2] scan d'un client sans rôle sur l'événement de Q → ${show(refused2)}`);
        assert.notEqual(refused2.body.result, 'valid', `scan d'un client accepté : ${show(refused2)}`);
        const r2 = await api('GET', 'account/evenings', { token: client.accessToken });
        console.log(`[CVF1-2] « Mes soirées » du client → ${show(r2)}`);
        const leaked2 = ((r2.body.items ?? []) as Row[]).find((i) => i.event_id === evQ.eventId);
        if (leaked2) breaches.push(`client sans rôle : « Mes soirées » montre l'événement de Q après un scan refusé : ${JSON.stringify(leaked2)}`);
        assert.deepEqual(breaches, [], `un refus suffit à ajouter l'événement d'autrui à « Mes soirées » :\n${breaches.join('\n')}`);
    });
});
