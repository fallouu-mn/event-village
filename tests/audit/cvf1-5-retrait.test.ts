/**
 * Contre-vérification de la finition 1, attaque 5 — retrait d'un contrôleur, téléphone resté ouvert.
 *
 * Le contrôleur garde son jeton (session ouverte avant le retrait) et essaie, juste après :
 *  a. « Retirer de cet événement » : scan, lecture renvoyée (clé d'une lecture partie sans réponse, en renvoi puis en
 *     lecture normale), renvoi de la clé d'une entrée déjà acceptée, saisie manuelle, vérification, invités, guichet, devis,
 *     vente, caisse, état du contrôle, portes, liste de ses scans ; l'autre événement de la même organisatrice reste ouvert
 *     (témoin : le retrait ne vise que cet événement) ;
 *  b. « Retirer de l'équipe » d'un contrôleur qui contrôle aussi pour une autre organisatrice (rôle gardé, session gardée) :
 *     plus rien chez la première, tout chez la seconde (témoin) ;
 *  c. « Retirer de l'équipe » d'un contrôleur qui ne contrôle que pour elle (rôle retiré, sessions révoquées) : l'ancien
 *     jeton ne sert plus à rien côté contrôle.
 * Sortie brute `[CVF1-5]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newBuyer, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { assignController, newController, openShift } from '../parcours/acces-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    PAID, acceptedScans, api, assignmentOf, freeEvent, freeTicket, ok2xx, restRows, rolesOf, scanTicket, show, ticketStatus,
    userClient, type Reply, type Row,
} from './cvf1-helpers';

let P: TestPartner;
let Q: TestPartner;
let evP: SaleEvent;
let evP2: SaleEvent;
let evQ: SaleEvent;
let H: Buyer;

before(async () => {
    P = await newPartner('cvf1-retrait-p');
    Q = await newPartner('cvf1-retrait-q');
    evP = await freeEvent(P, 'retrait-p', { startsInHours: 1 });
    evP2 = await freeEvent(P, 'retrait-p2', { startsInHours: 1 });
    evQ = await freeEvent(Q, 'retrait-q', { startsInHours: 1 });
    H = await newBuyer('cvf1-retrait-porteur', { firstName: 'Ndeye', lastName: 'Porteuse' });
});

after(async () => {
    await assertFinition1Invariants('cvf1-5-retrait');
});

/** Tout ce qu'un téléphone de contrôleur peut faire sur `ev` ; chaque réussite est une brèche. */
async function phoneStillWorks(c: Buyer, ev: SaleEvent, tag: string, breaches: string[]): Promise<void> {
    const t = await freeTicket(ev, H);
    const items = [{ categoryId: ev.categories[PAID].id, quantity: 1 }];
    const tries: Array<[string, Reply, (r: Reply) => boolean]> = [
        ['scan', await scanTicket(c, ev.eventId, t.id), (r) => r.body.result === 'valid'],
        ['saisie manuelle', await api('POST', 'controller/scan', {
            token: c.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number, identityVerified: true }, headers: { 'idempotency-key': randomUUID() },
        }), (r) => r.body.result === 'valid'],
        ['vérification manuelle', await api('POST', 'controller/scan/lookup', { token: c.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number } }), (r) => ok2xx(r) && !!r.body.ticket],
        ['recherche d’invités', await api('POST', 'controller/scan/guests', { token: c.accessToken, body: { eventId: ev.eventId, query: '1234' } }), ok2xx],
        ['guichet', await api('GET', 'controller/counter-sale', { token: c.accessToken, path: `/api/controller/counter-sale?event_id=${ev.eventId}` }), ok2xx],
        ['devis', await api('POST', 'controller/counter-sale/quote', { token: c.accessToken, body: { eventId: ev.eventId, items } }), ok2xx],
        ['vente', await api('POST', 'controller/counter-sale', { token: c.accessToken, body: { eventId: ev.eventId, items }, headers: { 'idempotency-key': randomUUID() } }), ok2xx],
        ['ouverture de caisse', await openShift(c, ev.eventId), ok2xx],
        ['état du contrôle', await api('GET', 'controller/scan/state', { token: c.accessToken, path: `/api/controller/scan/state?event_ids=${ev.eventId}` }), ok2xx],
        ['portes', await api('GET', 'controller/gates', { token: c.accessToken, path: `/api/controller/gates?eventId=${ev.eventId}` }), ok2xx],
        ['liste de ses scans', await api('GET', 'controller/scans', { token: c.accessToken, path: `/api/controller/scans?event_id=${ev.eventId}` }), ok2xx],
        ['équipe de l’organisatrice', await api('GET', 'partner/team', { token: c.accessToken, path: `/api/partner/team?eventId=${ev.eventId}` }), ok2xx],
    ];
    for (const [what, r, success] of tries) {
        console.log(`[CVF1-5] ${tag} : ${what} → ${show(r)}`);
        if (success(r)) breaches.push(`${tag} : ${what} → ${show(r)}`);
    }
    const list = await api('GET', 'controller/assignments', { token: c.accessToken });
    const listed = JSON.stringify(list.body).includes(ev.eventId);
    console.log(`[CVF1-5] ${tag} : liste de ses événements → ${show(list)}`);
    if (ok2xx(list) && listed) breaches.push(`${tag} : l'événement reste dans la liste de ses événements`);
    if ((await ticketStatus(t.id)) !== 'VALIDE' || (await acceptedScans(t.id)).length > 0) breaches.push(`${tag} : billet composté`);
}

describe('a. « Retirer de cet événement »', () => {
    test('le téléphone resté ouvert ne scanne plus, ne vend plus ; une lecture renvoyée est refusée ; l’autre événement reste ouvert', async () => {
        const breaches: string[] = [];
        const c = await newController(P, evP.eventId, { canAcceptCash: true, label: 'cvf1-retrait-evt' });
        await assignController(P, c.userId, evP2.eventId, true);
        const t1 = await freeTicket(evP, H);
        const k1 = randomUUID();
        const before1 = await scanTicket(c, evP.eventId, t1.id, {}, k1);
        assert.equal(before1.body.result, 'valid', `témoin avant le retrait : ${show(before1)}`);
        const t2 = await freeTicket(evP, H);
        const k2 = randomUUID(); // lecture partie sans réponse : la clé n'a jamais atteint le serveur
        const assignment = await assignmentOf(evP.eventId, c.userId);
        const del = await api('DELETE', 'partner/team/[eventId]', {
            token: P.accessToken, path: `/api/partner/team/${evP.eventId}?assignmentId=${String(assignment!.id)}`, params: { eventId: evP.eventId },
        });
        console.log(`[CVF1-5] « Retirer de cet événement » → ${show(del)}`);
        assert.equal(del.status, 200, `retrait (montage) : ${show(del)}`);

        const replay2 = await api('POST', 'controller/scan', { token: c.accessToken, body: { eventId: evP.eventId, replayOnly: true }, headers: { 'idempotency-key': k2 } });
        const resend2 = await scanTicket(c, evP.eventId, t2.id, {}, k2);
        const replay1 = await api('POST', 'controller/scan', { token: c.accessToken, body: { eventId: evP.eventId, replayOnly: true }, headers: { 'idempotency-key': k1 } });
        const resend1 = await scanTicket(c, evP.eventId, t1.id, {}, k1);
        for (const [what, r] of [['renvoi de la lecture perdue', replay2], ['lecture perdue envoyée de nouveau', resend2],
            ['renvoi de l’entrée acceptée avant le retrait', replay1], ['entrée acceptée envoyée de nouveau', resend1]] as const) {
            console.log(`[CVF1-5] après le retrait : ${what} → ${show(r)}`);
        }
        if (replay2.body.result === 'valid' || resend2.body.result === 'valid') breaches.push(`lecture perdue validée après le retrait : ${show(replay2)} / ${show(resend2)}`);
        if ((await ticketStatus(t2.id)) !== 'VALIDE') breaches.push('billet de la lecture perdue composté après le retrait');
        const t1Accepted = await acceptedScans(t1.id);
        if (t1Accepted.length !== 1) breaches.push(`entrée d'avant le retrait : ${t1Accepted.length} ligne(s) acceptée(s) au lieu d'une`);
        await phoneStillWorks(c, evP, 'retiré de cet événement', breaches);

        const t3 = await freeTicket(evP2, H);
        const witness = await scanTicket(c, evP2.eventId, t3.id);
        console.log(`[CVF1-5] témoin, autre événement de la même organisatrice → ${show(witness)}`);
        assert.equal(witness.body.result, 'valid', `l'autre événement devait rester ouvert : ${show(witness)}`);
        assert.deepEqual(breaches, [], `le téléphone retiré agit encore :\n${breaches.join('\n')}`);
    });
});

describe('b. « Retirer de l’équipe », contrôleur qui travaille aussi pour une autre organisatrice', () => {
    test('rôle et session gardés : plus rien chez P, tout chez Q', async () => {
        const breaches: string[] = [];
        const c = await newController(P, evP.eventId, { canAcceptCash: true, label: 'cvf1-retrait-deux' });
        await assignController(Q, c.userId, evQ.eventId, true);
        const del = await api('DELETE', 'partner/team/controller/[controllerId]', {
            token: P.accessToken, path: `/api/partner/team/controller/${c.userId}`, params: { controllerId: c.userId },
        });
        console.log(`[CVF1-5] « Retirer de l'équipe » (contrôle aussi chez Q) → ${show(del)}`);
        assert.equal(del.status, 200, `retrait (montage) : ${show(del)}`);
        assert.ok((await rolesOf(c.userId)).includes('CONTROLEUR'), 'rôle gardé : il contrôle chez Q');
        await phoneStillWorks(c, evP, 'retiré de l’équipe de P (contrôle chez Q)', breaches);
        const t = await freeTicket(evQ, H);
        const witness = await scanTicket(c, evQ.eventId, t.id);
        console.log(`[CVF1-5] témoin chez Q → ${show(witness)}`);
        assert.equal(witness.body.result, 'valid', `l'événement de Q devait rester ouvert : ${show(witness)}`);
        assert.deepEqual(breaches, [], `le téléphone retiré agit encore chez P :\n${breaches.join('\n')}`);
    });
});

describe('c. « Retirer de l’équipe », contrôleur qui ne travaille que pour elle', () => {
    test('rôle retiré, sessions révoquées : l’ancien jeton ne sert plus au contrôle', async () => {
        const breaches: string[] = [];
        const c = await newController(P, evP2.eventId, { canAcceptCash: true, label: 'cvf1-retrait-seul' });
        const del = await api('DELETE', 'partner/team/controller/[controllerId]', {
            token: P.accessToken, path: `/api/partner/team/controller/${c.userId}`, params: { controllerId: c.userId },
        });
        console.log(`[CVF1-5] « Retirer de l'équipe » (seule organisatrice) → ${show(del)}`);
        assert.equal(del.status, 200, `retrait (montage) : ${show(del)}`);
        await phoneStillWorks(c, evP2, 'retiré de sa seule équipe', breaches);
        const rest = await restRows(userClient(c.accessToken), 'event_controllers', { user_id: c.userId });
        console.log(`[CVF1-5] REST event_controllers avec l'ancien jeton → ${rest.rows.length} ligne(s)${rest.error ? ` ; refus ${rest.error}` : ''}`);
        if (rest.rows.some((r: Row) => r.event_id === evP2.eventId)) breaches.push('affectation encore lisible par la REST');
        assert.deepEqual(breaches, [], `l'ancien jeton agit encore :\n${breaches.join('\n')}`);
    });
});
