/**
 * Correctifs de la contre-vérification de la finition 1 — T2 : la propriétaire n'ouvre une caisse sur son événement
 * qu'avec une fiche VALIDE, comme pour le guichet et le scan.
 *  a. shift_can_handle_cash (service_role) : propriétaire à fiche EN_ATTENTE, REJETE ou SUSPENDU → faux ; VALIDE → vrai.
 *  b. Routes /api/controller/* d'un compte partenaire qui a AUSSI le rôle CONTROLEUR, sur SON événement, fiche non
 *     validée : refus PARTNER_NOT_VALIDATED par la route (ouverture de caisse, guichet, devis, scan, vérification,
 *     recherche d'invités, choix de porte).
 *  c. Même compte, contrôleur affecté chez une autre organisatrice (fiche VALIDE) : il y scanne toujours (la garde ne
 *     vise que ses propres événements).
 *  d. Fiche SUSPENDU sans le rôle CONTROLEUR : l'ouverture de caisse est refusée par la route (PARTNER_NOT_VALIDATED).
 * Rouge avant le correctif : shift_can_handle_cash admet la propriétaire quelle que soit sa fiche ; la garde de la route
 * ne s'applique pas au compte qui a le rôle CONTROLEUR, et laisse passer une fiche SUSPENDU (run 205 : caisses ouvertes).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assignController, openShift } from './acces-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    PAID, addRole, api, freeEvent, freeTicket, scanTicket, setFiche, type Reply,
} from '../audit/cvf1-helpers';

const STATUSES = ['EN_ATTENTE', 'REJETE', 'SUSPENDU'] as const;

let H: Buyer;
let Q: TestPartner;

before(async () => {
    H = await newBuyer('cvf1c-t2-porteur', { firstName: 'Fatou', lastName: 'Porteuse' });
    Q = await newPartner('cvf1c-t2-q');
});

after(async () => {
    await assertFinition1Invariants('cvf1c-t2-caisse');
});

async function canHandleCash(userId: string, eventId: string): Promise<boolean> {
    const { data, error } = await service.rpc('shift_can_handle_cash', { p_user: userId, p_event: eventId });
    assert.equal(error, null, error?.message);
    return data === true;
}

async function openShiftsOf(eventId: string, userId: string): Promise<number> {
    const { data, error } = await service.from('controller_shifts').select('id').eq('event_id', eventId).eq('controller_id', userId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses : ${error?.message}`);
    return (data ?? []).length;
}

function assertFicheRefusal(r: Reply, what: string): void {
    assert.equal(r.status, 403, `${what} : statut (${JSON.stringify(r.body).slice(0, 300)})`);
    assert.equal(r.body.code, 'PARTNER_NOT_VALIDATED', `${what} : code (${JSON.stringify(r.body).slice(0, 300)})`);
}

describe('T2 a. shift_can_handle_cash', () => {
    test('propriétaire : fiche EN_ATTENTE, REJETE, SUSPENDU → non ; VALIDE → oui', async () => {
        const D = await newPartner('cvf1c-t2-a');
        const ev = await freeEvent(D, 'cvf1c-t2-a', { startsInHours: 1 });
        try {
            assert.equal(await canHandleCash(D.userId, ev.eventId), true, 'fiche VALIDE : caisse refusée');
            for (const st of STATUSES) {
                await setFiche(D.partnerId, st);
                assert.equal(await canHandleCash(D.userId, ev.eventId), false, `fiche ${st} : caisse admise`);
            }
        } finally {
            await setFiche(D.partnerId, 'VALIDE');
        }
    });
});

describe('T2 b, c. compte partenaire qui a aussi le rôle CONTROLEUR', () => {
    test('son événement, fiche non validée : chaque action refusée par la route ; chez une autre, il scanne', async () => {
        const D = await newPartner('cvf1c-t2-b');
        await addRole(D.userId, 'CONTROLEUR');
        const own: Record<string, SaleEvent> = {};
        for (const st of STATUSES) own[st] = await freeEvent(D, `cvf1c-t2-b-${st}`, { startsInHours: 1 });
        const evQ = await freeEvent(Q, 'cvf1c-t2-q', { startsInHours: 1 });
        await assignController(Q, D.userId, evQ.eventId, false);
        try {
            for (const st of STATUSES) {
                const ev = own[st];
                await setFiche(D.partnerId, st);
                const t = await freeTicket(ev, H);
                const items = [{ categoryId: ev.categories[PAID].id, quantity: 1 }];
                const before = await openShiftsOf(ev.eventId, D.userId);
                const shift = await openShift(D, ev.eventId);
                assertFicheRefusal(shift, `fiche ${st} : ouverture de caisse`);
                assert.equal(await openShiftsOf(ev.eventId, D.userId), before, `fiche ${st} : caisse ouverte`);
                assertFicheRefusal(await api('GET', 'controller/counter-sale', { token: D.accessToken, path: `/api/controller/counter-sale?event_id=${ev.eventId}` }), `fiche ${st} : guichet`);
                assertFicheRefusal(await api('POST', 'controller/counter-sale/quote', { token: D.accessToken, body: { eventId: ev.eventId, items } }), `fiche ${st} : devis`);
                assertFicheRefusal(await api('POST', 'controller/counter-sale', { token: D.accessToken, body: { eventId: ev.eventId, items }, headers: { 'idempotency-key': randomUUID() } }), `fiche ${st} : vente`);
                assertFicheRefusal(await scanTicket(D, ev.eventId, t.id), `fiche ${st} : scan`);
                assertFicheRefusal(await api('POST', 'controller/scan/lookup', { token: D.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number } }), `fiche ${st} : vérification`);
                assertFicheRefusal(await api('POST', 'controller/scan/guests', { token: D.accessToken, body: { eventId: ev.eventId, query: '1234' } }), `fiche ${st} : invités`);
                // Chez l'autre organisatrice (fiche VALIDE), il reste un contrôleur comme les autres
                const tq = await freeTicket(evQ, H);
                const sq = await scanTicket(D, evQ.eventId, tq.id);
                assert.equal(sq.body.result, 'valid', `fiche ${st} : scan chez l'autre organisatrice refusé (${JSON.stringify(sq.body).slice(0, 300)})`);
            }
        } finally {
            await setFiche(D.partnerId, 'VALIDE');
        }
    });
});

describe('T2 d. fiche SUSPENDU sans le rôle CONTROLEUR', () => {
    test('ouverture de caisse refusée par la route', async () => {
        const E = await newPartner('cvf1c-t2-d');
        const ev = await freeEvent(E, 'cvf1c-t2-d', { startsInHours: 1 });
        try {
            await setFiche(E.partnerId, 'SUSPENDU');
            const shift = await openShift(E, ev.eventId);
            assertFicheRefusal(shift, 'fiche SUSPENDU : ouverture de caisse');
            assert.equal(await openShiftsOf(ev.eventId, E.userId), 0, 'caisse ouverte');
        } finally {
            await setFiche(E.partnerId, 'VALIDE');
        }
    });
});
