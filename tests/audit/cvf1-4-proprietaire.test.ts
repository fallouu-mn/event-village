/**
 * Contre-vérification de la finition 1, attaque 4 — « Toutes les portes » et guichet de la propriétaire.
 *
 *  a. Témoin : la propriétaire (fiche VALIDE) scanne son événement à zones sans porte (« Toutes les portes ») : accepté.
 *  b. Sur l'événement d'une autre partenaire : scan sans porte, guichet, devis, vente, caisse → refusés, rien ne change.
 *  c. Un contrôleur n'obtient jamais « Toutes les portes » : affecté avec ou sans porte, porte absente du corps, compte qui
 *     est aussi partenaire (fiche VALIDE à elle), admin muni de access.operate.
 *  d. Fiche EN_ATTENTE, REJETE puis SUSPENDU, compte ACTIF (remis actif à part) : scan sans porte, guichet, devis, ouverture
 *     de caisse, recherche d'invités, vérification manuelle → refusés ; même chose quand le compte porte aussi le rôle
 *     CONTROLEUR (il contrôle pour une autre organisatrice : la garde de fiche des routes /api/controller ne s'applique
 *     alors plus, seule la base décide).
 * Sortie brute `[CVF1-4]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { assignController, newController, openShift } from '../parcours/acces-helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { createZonedEvent, type ZonedEvent } from '../parcours/zones-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    CATS, FREE, PAID, acceptedScans, addRole, api, freeTicket, ok2xx, scanTicket, setFiche, show, ticketStatus,
} from './cvf1-helpers';

const ZONES = [{ name: 'Pelouse', kind: 'ENTREE' as const, admits: [FREE, PAID], gates: ['Porte Nord', 'Porte Sud'] }];

let A: TestPartner;
let B: TestPartner;
let evA: ZonedEvent;
let evB: ZonedEvent;
let H: Buyer;

before(async () => {
    A = await newPartner('cvf1-prop-a');
    B = await newPartner('cvf1-prop-b');
    evA = await createZonedEvent(A, 'cvf1-prop-a', CATS, ZONES, { startsInHours: 1 });
    evB = await createZonedEvent(B, 'cvf1-prop-b', CATS, ZONES, { startsInHours: 1 });
    H = await newBuyer('cvf1-prop-porteur', { firstName: 'Awa', lastName: 'Porteuse' });
});

after(async () => {
    await assertFinition1Invariants('cvf1-4-proprietaire');
});

async function openShiftsOf(eventId: string, userId: string): Promise<number> {
    const { data, error } = await service.from('controller_shifts').select('id').eq('event_id', eventId).eq('controller_id', userId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses : ${error?.message}`);
    return (data ?? []).length;
}

describe('a. témoin et b. jamais chez une autre partenaire', () => {
    test('témoin : « Toutes les portes » sur son événement à zones, entrée acceptée', async () => {
        const t = await freeTicket(evA, H);
        const r = await scanTicket(A, evA.eventId, t.id, { gateId: null });
        console.log(`[CVF1-4] propriétaire, son événement, sans porte → ${show(r)}`);
        assert.equal(r.body.result, 'valid', `témoin : ${show(r)}`);
    });

    test('événement de B : scan sans porte, guichet, devis, vente, caisse refusés', async () => {
        const breaches: string[] = [];
        const t = await freeTicket(evB, H);
        const items = [{ categoryId: evB.categories[PAID].id, quantity: 1 }];
        const sc = await scanTicket(A, evB.eventId, t.id, { gateId: null });
        const desk = await api('GET', 'controller/counter-sale', { token: A.accessToken, path: `/api/controller/counter-sale?event_id=${evB.eventId}` });
        const quote = await api('POST', 'controller/counter-sale/quote', { token: A.accessToken, body: { eventId: evB.eventId, items } });
        const sale = await api('POST', 'controller/counter-sale', { token: A.accessToken, body: { eventId: evB.eventId, items }, headers: { 'idempotency-key': randomUUID() } });
        const shift = await openShift(A, evB.eventId);
        for (const [what, r] of [['scan sans porte', sc], ['guichet', desk], ['devis', quote], ['vente', sale], ['caisse', shift]] as const) {
            console.log(`[CVF1-4] propriétaire A sur l'événement de B : ${what} → ${show(r)}`);
            if (what === 'scan sans porte' ? r.body.result === 'valid' : ok2xx(r)) breaches.push(`${what} : ${show(r)}`);
        }
        if ((await ticketStatus(t.id)) !== 'VALIDE') breaches.push('billet de B composté');
        if ((await openShiftsOf(evB.eventId, A.userId)) > 0) breaches.push('caisse de A ouverte chez B');
        assert.deepEqual(breaches, [], `la propriétaire A agit chez B :\n${breaches.join('\n')}`);
    });
});

describe('c. un contrôleur n’obtient jamais « Toutes les portes »', () => {
    test('affecté avec porte, sans porte, porte absente, compte aussi partenaire, admin access.operate : aucune entrée', async () => {
        const breaches: string[] = [];
        const north = evA.zones['Pelouse'].gates['Porte Nord'];
        const withGate = await newController(A, evA.eventId, { label: 'cvf1-prop-porte' });
        const { error: gErr } = await service.from('event_controllers').update({ gate_id: north, entry_point: 'Porte Nord' }).eq('event_id', evA.eventId).eq('user_id', withGate.userId);
        assert.equal(gErr, null, `porte du contrôleur (montage) : ${gErr?.message}`);
        const noGate = await newController(A, evA.eventId, { label: 'cvf1-prop-sans' });
        const otherPartner = await newPartner('cvf1-prop-x');
        await addRole(otherPartner.userId, 'CONTROLEUR');
        await assignController(A, otherPartner.userId, evA.eventId, false);
        const operator = await newAdmin('cvf1-prop-op', ['access.operate']);
        const cases: Array<[string, Buyer, Record<string, unknown>]> = [
            ['contrôleur à la Porte Nord, porte vide', withGate, { gateId: null }],
            ['contrôleur à la Porte Nord, porte absente', withGate, {}],
            ['contrôleur sans porte, porte vide', noGate, { gateId: null }],
            ['compte partenaire (autre fiche VALIDE) affecté, porte vide', otherPartner, { gateId: null }],
            ['admin access.operate, porte vide', operator, { gateId: null }],
        ];
        for (const [what, user, extra] of cases) {
            const t = await freeTicket(evA, H);
            const r = await scanTicket(user, evA.eventId, t.id, extra);
            console.log(`[CVF1-4] ${what} → ${show(r)}`);
            if (r.body.result === 'valid' || (await ticketStatus(t.id)) !== 'VALIDE') breaches.push(`${what} : ${show(r)}`);
        }
        assert.deepEqual(breaches, [], `« Toutes les portes » obtenu sans être la propriétaire :\n${breaches.join('\n')}`);
    });
});

describe('d. fiche non VALIDE, compte ACTIF', () => {
    test('EN_ATTENTE, REJETE, SUSPENDU, avec et sans rôle CONTROLEUR : ni scan, ni guichet, ni caisse', async () => {
        const breaches: string[] = [];
        const D = await newPartner('cvf1-prop-d');
        const statuses = ['EN_ATTENTE', 'REJETE', 'SUSPENDU'] as const;
        // Événements créés pendant que la fiche est VALIDE (création et zones l'exigent) : un par cas, pour qu'une caisse
        // ouverte par erreur ne masque pas le cas suivant
        const events: Record<string, ZonedEvent> = {};
        for (const role of ['sans', 'avec'] as const) {
            for (const st of statuses) {
                events[`${st}-${role}`] = await createZonedEvent(D, `cvf1-prop-d-${st}-${role}`, CATS, ZONES, { startsInHours: 1 });
            }
        }
        try {
            for (const role of ['sans', 'avec'] as const) {
                if (role === 'avec') await addRole(D.userId, 'CONTROLEUR');
                for (const st of statuses) {
                    const ev = events[`${st}-${role}`];
                    await setFiche(D.partnerId, st);
                    const tag = `fiche ${st}, ${role} rôle CONTROLEUR`;
                    const t = await freeTicket(ev, H);
                    const items = [{ categoryId: ev.categories[PAID].id, quantity: 1 }];
                    const sc = await scanTicket(D, ev.eventId, t.id, { gateId: null });
                    const desk = await api('GET', 'controller/counter-sale', { token: D.accessToken, path: `/api/controller/counter-sale?event_id=${ev.eventId}` });
                    const quote = await api('POST', 'controller/counter-sale/quote', { token: D.accessToken, body: { eventId: ev.eventId, items } });
                    const shiftsBefore = await openShiftsOf(ev.eventId, D.userId);
                    const shift = await openShift(D, ev.eventId);
                    const shiftsAfter = await openShiftsOf(ev.eventId, D.userId);
                    const sale = await api('POST', 'controller/counter-sale', { token: D.accessToken, body: { eventId: ev.eventId, items }, headers: { 'idempotency-key': randomUUID() } });
                    const guests = await api('POST', 'controller/scan/guests', { token: D.accessToken, body: { eventId: ev.eventId, query: '1234' } });
                    const lookup = await api('POST', 'controller/scan/lookup', { token: D.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number, gateId: null } });
                    for (const [what, r] of [['scan sans porte', sc], ['guichet', desk], ['devis', quote], ['ouverture de caisse', shift], ['vente', sale],
                        ['recherche d’invités', guests], ['vérification manuelle', lookup]] as const) {
                        console.log(`[CVF1-4] ${tag} : ${what} → ${show(r)}`);
                    }
                    if (sc.body.result === 'valid' || (await ticketStatus(t.id)) !== 'VALIDE' || (await acceptedScans(t.id)).length > 0) breaches.push(`${tag} : scan accepté ${show(sc)}`);
                    if (ok2xx(desk)) breaches.push(`${tag} : guichet servi ${show(desk)}`);
                    if (ok2xx(quote)) breaches.push(`${tag} : devis servi ${show(quote)}`);
                    if (ok2xx(shift) || shiftsAfter > shiftsBefore) breaches.push(`${tag} : caisse ouverte sur son événement ${show(shift)}`);
                    if (ok2xx(sale)) breaches.push(`${tag} : vente acceptée ${show(sale)}`);
                    if (ok2xx(guests)) breaches.push(`${tag} : recherche d'invités servie ${show(guests)}`);
                    if (ok2xx(lookup) && lookup.body.ticket) breaches.push(`${tag} : vérification manuelle servie ${show(lookup)}`);
                }
            }
        } finally {
            await setFiche(D.partnerId, 'VALIDE');
        }
        assert.deepEqual(breaches, [], `propriétaire à fiche non validée :\n${breaches.join('\n')}`);
    });
});
