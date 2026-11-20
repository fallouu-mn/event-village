/**
 * Contre-vérification du lot 10b — points 1, 2 et 3 : droits des routes nouvelles, identifiants d'autrui, droit
 * « Valider les salles et les établissements », photos. Base LOCALE, faux SamirPay, service ouvert le temps de la suite.
 *
 * Garde-fous (verts attendus, preuve que l'attaque est BLOQUÉE) :
 *  G1. une partenaire ne lit, ne modifie, ne supprime, ne renvoie ni n'annule rien d'une autre (identifiants d'autrui) ;
 *  G2. un client ne lit, ne prévisualise ni n'annule la réservation d'un autre ;
 *  G3. un administrateur sans halls.validate est refusé (file, fiche, décision) ; avec, accepté ; motif exigé et journal ;
 *  G4. une photo du dossier d'une autre partenaire, ou hors du dossier des salles, est refusée.
 * Trous (rouges attendus tant qu'ils ne sont pas corrigés) :
 *  T1. fiche partenaire SUSPENDU (compte ACTIF) : les écritures des salles restent ouvertes (modifier une salle validée,
 *      la supprimer, annuler la réservation payée d'un client) ;
 *  T2. un administrateur qui n'a que halls.validate lit le téléphone et l'adresse email de la partenaire (fiche de
 *      décision), contacts réservés au droit partners.read.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import {
    api, newAdmin, newBuyer, newHall, newPartner, openHallsService, payConfirmed, photoOf, reservation, reserveRpc,
    routeId, service, setFiche, show, trace, type Buyer, type Row, type TestAdmin, type TestPartner,
} from './cv10b-helpers';

let restore: () => Promise<void>;
let owner: TestPartner;
let intruder: TestPartner;
let alice: Buyer;
let mallory: Buyer;
let validator: TestAdmin;
let weakAdmin: TestAdmin;
let hallId = '';
let paidRes = '';

before(async () => {
    restore = await openHallsService();
    owner = await newPartner('cv10b-proprio');
    intruder = await newPartner('cv10b-intrus');
    alice = await newBuyer('cv10b-alice', { firstName: 'Awa', lastName: 'Ndiaye' });
    mallory = await newBuyer('cv10b-mallory');
    validator = await newAdmin('cv10b-valide', ['halls.validate']);
    weakAdmin = await newAdmin('cv10b-faible', ['events.read', 'events.write', 'partners.validate']);
    hallId = await newHall(owner);
    paidRes = String((await reserveRpc(alice, hallId, { days: 1, startInDays: 40 })).reservation_id);
    await payConfirmed(alice, paidRes, 'ACOMPTE');
});

after(async () => {
    await restore();
    await assertLot10aInvariants('cv10b-1-droits');
    await assertFinanceInvariants('cv10b-1-droits');
});

describe('G1. Identifiants d’une autre partenaire (attaques BLOQUÉES attendues)', () => {
    test('salle d’autrui : lecture, modification, suppression, renvoi → 404, rien d’écrit', async () => {
        const { data: before0 } = await service.from('halls').select('name, price_per_day, images').eq('id', hallId).single();
        const replies = {
            get: await routeId('GET', 'partner/halls/[id]', hallId, intruder.accessToken),
            put: await routeId('PUT', 'partner/halls/[id]', hallId, intruder.accessToken, { name: 'Volée', price_per_day: 1 }),
            del: await routeId('DELETE', 'partner/halls/[id]', hallId, intruder.accessToken),
            submit: await routeId('POST', 'partner/halls/[id]/submit', hallId, intruder.accessToken),
        };
        trace('G1 salle d’autrui', Object.fromEntries(Object.entries(replies).map(([k, r]) => [k, show(r)])));
        for (const [k, r] of Object.entries(replies)) assert.equal(r.status, 404, `${k} : ${show(r)}`);
        const { data: after0 } = await service.from('halls').select('name, price_per_day, images').eq('id', hallId).single();
        assert.deepEqual(after0, before0, 'salle inchangée');
    });

    test('réservation d’autrui : détail, calendrier filtré sur sa salle, annulation, recettes → rien', async () => {
        const detail = await routeId('GET', 'partner/halls/reservations/[id]', paidRes, intruder.accessToken);
        const list = await api('GET', 'partner/halls/reservations', { token: intruder.accessToken, path: `/api/partner/halls/reservations?hall=${hallId}` });
        const cancel = await routeId('POST', 'partner/halls/reservations/[id]/status', paidRes, intruder.accessToken, { action: 'CANCEL', reason: 'Attaque de la contre-vérification' });
        const confirm = await routeId('POST', 'partner/halls/reservations/[id]/status', paidRes, intruder.accessToken, { action: 'CONFIRM' });
        const earnings = await api('GET', 'partner/halls/earnings', { token: intruder.accessToken });
        trace('G1 réservation d’autrui', { detail: show(detail), list: show(list), cancel: show(cancel), confirm: show(confirm), earnings: show(earnings) });
        assert.equal(detail.status, 404, show(detail));
        assert.equal(list.status, 200, show(list));
        assert.deepEqual(list.body.reservations, [], 'aucune réservation de la salle d’autrui');
        assert.equal(cancel.status, 404, show(cancel));
        assert.equal(confirm.status, 404, show(confirm));
        assert.equal(earnings.status, 200, show(earnings));
        assert.ok(!JSON.stringify(earnings.body).includes(paidRes), 'recettes d’autrui absentes');
        assert.equal((await reservation(paidRes)).booking_state, 'ACOMPTE_PAYE');
    });
});

describe('G2. Réservation d’un autre client (attaques BLOQUÉES attendues)', () => {
    test('détail, aperçu d’annulation, annulation → 404, réservation intacte', async () => {
        const detail = await routeId('GET', 'halls/reservations/[id]', paidRes, mallory.accessToken);
        const preview = await routeId('GET', 'halls/reservations/[id]/cancel', paidRes, mallory.accessToken);
        const cancel = await routeId('POST', 'halls/reservations/[id]/cancel', paidRes, mallory.accessToken, {});
        trace('G2 client d’autrui', { detail: show(detail), preview: show(preview), cancel: show(cancel) });
        assert.equal(detail.status, 404, show(detail));
        assert.equal(preview.status, 404, show(preview));
        assert.equal(cancel.status, 404, show(cancel));
        const mine = await api('GET', 'halls/reservations', { token: mallory.accessToken });
        assert.ok(!JSON.stringify(mine.body).includes(paidRes), 'liste de Mallory sans la réservation d’Alice');
        assert.equal((await reservation(paidRes)).booking_state, 'ACOMPTE_PAYE');
    });
});

describe('G3. Droit « Valider les salles et les établissements » (attaques BLOQUÉES attendues)', () => {
    test('personne ne l’a d’office : aucune ligne halls.validate hors des comptes de test qui la reçoivent', async () => {
        const { data, error } = await service.from('admin_permissions').select('user_id').eq('permission', 'halls.validate');
        assert.equal(error, null, error?.message);
        const holders = (data ?? []).map((r) => String(r.user_id));
        const { data: tests } = await service.from('users').select('id').in('id', holders).like('email', '%adm-%');
        trace('G3 titulaires de halls.validate', { total: holders.length, comptes_de_test: (tests ?? []).length });
        assert.equal(holders.length, (tests ?? []).length, 'un compte hors des tests a reçu halls.validate');
    });

    test('sans le droit : file, fiche et décision refusées ; avec : accepté, motif exigé, journal écrit', async () => {
        const hall = await newHall(owner, { validate: false });
        const weak = {
            list: await api('GET', 'admin/halls', { token: weakAdmin.accessToken }),
            sheet: await routeId('GET', 'admin/halls/[id]', hall, weakAdmin.accessToken),
            decide: await routeId('POST', 'admin/halls/[id]/validation', hall, weakAdmin.accessToken, { decision: 'REFUSER', reason: 'Essai sans le droit' }),
        };
        trace('G3 sans halls.validate', Object.fromEntries(Object.entries(weak).map(([k, r]) => [k, show(r)])));
        for (const [k, r] of Object.entries(weak)) assert.equal(r.status, 403, `${k} : ${show(r)}`);
        const noReason = await routeId('POST', 'admin/halls/[id]/validation', hall, validator.accessToken, { decision: 'REFUSER', reason: 'non' });
        assert.ok(noReason.status >= 400, `motif de 3 caractères accepté : ${show(noReason)}`);
        const refused = await routeId('POST', 'admin/halls/[id]/validation', hall, validator.accessToken, { decision: 'REFUSER', reason: 'Photos floues, adresse absente.' });
        assert.equal(refused.status, 200, show(refused));
        const { data: log } = await service.from('audit_logs').select('user_id, action, metadata').eq('object_id', hall).eq('action', 'HALL_VALIDATION_DECIDED');
        trace('G3 journal', log);
        assert.equal((log ?? []).length, 1, 'une ligne de journal');
        assert.equal((log![0] as Row).user_id, validator.userId);
        assert.equal(((log![0] as Row).metadata as Row).reason, 'Photos floues, adresse absente.');
    });
});

describe('G4. Photos (attaques BLOQUÉES attendues)', () => {
    test('photo du dossier d’une autre partenaire, d’un autre dossier ou à un autre nom → 400, salle inchangée', async () => {
        const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
        const attempts = [
            photoOf(intruder.partnerId),
            photoOf(owner.partnerId).replace('/halls/', '/misc/'),
            `${base}/storage/v1/object/public/public-images/halls/${owner.partnerId}/photo.jpg`,
            `${base}/storage/v1/object/public/public-images/halls/${owner.partnerId}/../${intruder.partnerId}/1700000000000_abcdef12.webp`,
            'https://exemple.test/salle.webp',
        ];
        for (const url of attempts) {
            const r = await routeId('PUT', 'partner/halls/[id]', hallId, owner.accessToken, { images: [url] });
            trace('G4 photo', { url: url.replace(base, '<supabase>'), reply: show(r) });
            assert.equal(r.status, 400, `${url} : ${show(r)}`);
        }
        const tooMany = Array.from({ length: 13 }, () => photoOf(owner.partnerId));
        const r13 = await routeId('PUT', 'partner/halls/[id]', hallId, owner.accessToken, { images: tooMany });
        assert.equal(r13.status, 400, `13 photos : ${show(r13)}`);
    });
});

describe('T1. Fiche partenaire SUSPENDU, compte ACTIF : les écritures des salles restent ouvertes', () => {
    test('modifier une salle validée, la supprimer, annuler une réservation payée → 403 PARTNER_SUSPENDED attendu', async () => {
        const host = await newPartner('cv10b-suspendue');
        const validated = await newHall(host, { price_per_day: 300_000 });
        const spare = await newHall(host);
        const client = await newBuyer('cv10b-client-suspendue');
        const res = String((await reserveRpc(client, validated, { days: 1, startInDays: 45 })).reservation_id);
        await payConfirmed(client, res, 'ACOMPTE');
        await setFiche(host.partnerId, 'SUSPENDU');
        try {
            const put = await routeId('PUT', 'partner/halls/[id]', validated, host.accessToken, { price_per_day: 1_000_000, name: 'Salle renommée pendant la suspension' });
            const cancel = await routeId('POST', 'partner/halls/reservations/[id]/status', res, host.accessToken, { action: 'CANCEL', reason: 'Annulation par une fiche suspendue' });
            const del = await routeId('DELETE', 'partner/halls/[id]', spare, host.accessToken);
            const { data: h } = await service.from('halls').select('name, price_per_day, validation_status').eq('id', validated).single();
            const { data: sp } = await service.from('halls').select('id').eq('id', spare).maybeSingle();
            const state = (await reservation(res)).booking_state;
            trace('T1 fiche suspendue', { put: show(put), cancel: show(cancel), del: show(del), salle: h, salle_supprimee: sp === null, reservation: state });
            assert.equal(put.status, 403, `modification d'une salle validée par une fiche SUSPENDU : ${show(put)} ; salle en base ${JSON.stringify(h)}`);
            assert.equal(cancel.status, 403, `annulation d'une réservation payée par une fiche SUSPENDU : ${show(cancel)} ; état ${state}`);
            assert.equal(del.status, 403, `suppression d'une salle par une fiche SUSPENDU : ${show(del)}`);
        } finally {
            await setFiche(host.partnerId, 'VALIDE');
        }
    });
});

describe('T2. Contacts de la partenaire donnés à un administrateur sans partners.read', () => {
    test('fiche de décision lue avec halls.validate seul : ni téléphone ni email de la partenaire attendus', async () => {
        const r = await routeId('GET', 'admin/halls/[id]', hallId, validator.accessToken);
        assert.equal(r.status, 200, show(r));
        const partner = ((r.body.hall as Row).partner ?? {}) as Row;
        trace('T2 fiche de décision (halls.validate seul)', { partner });
        const leaked = ['phone', 'email'].filter((k) => partner[k] !== null && partner[k] !== undefined);
        assert.deepEqual(leaked, [], `contacts de la partenaire lus sans partners.read : ${JSON.stringify(partner)}`);
    });
});
