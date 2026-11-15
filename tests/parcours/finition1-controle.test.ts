/**
 * Finition 1, compléments 10, 11 et 12 — plage du contrôle, droit de scanner par événement, la partenaire scanne ses
 * propres événements.
 *
 *  10. Règle existante, gardée (identique à la cible) : le contrôle ouvre access.scan_window_before_hours (6 h) avant le
 *      début et ferme access.scan_window_after_hours (6 h) après la fin retenue (event_end_at : fin saisie, sinon début
 *      + 6 h), scan_window / scan_event_problem ; ANNULE et SUSPENDU ferment tout de suite. Écart trouvé : la recherche
 *      dans la liste des invités (ticket_guest_list_search) ne regardait pas la plage (noms d'invités rendus après la
 *      fin). Messages : « Cet événement est terminé : le contrôle est fermé. », « Le contrôle ouvre le … à … ».
 *      Le rôle du contrôleur reste après la fin ; l'affectation passe dans « Événements passés » (past) de l'équipe.
 *  11. GET /api/controller/status : `scanner` vrai si la personne a au moins un événement dont le contrôle est ouvert
 *      ou ouvre dans les 24 h ; sinon faux (application d'un client normal, menu « Scanner » masqué).
 *  12. La partenaire scanne ses propres événements sans s'inviter : « Toutes les portes » (porte non choisie, envoyée
 *      vide) sur un événement à zones ; vente au guichet sur ses événements ; jamais sur l'événement d'une autre.
 * Fin de suite : assertFinition1Invariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, scan, ticketPayload } from './acces-helpers';
import { invoke, routeHandler, show, type Row } from './pilotage-helpers';
import { createZonedEvent } from './zones-helpers';
import { formatDate, formatTime } from '../../lib/format';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const CATS: CategorySpec[] = [{ name: 'Standard', price: 2_000, total: 30 }, { name: 'VIP', price: 6_000, total: 10 }];
const ENDED = 'Cet événement est terminé : le contrôle est fermé.';

async function stateOf(user: Pick<Buyer, 'accessToken'>, eventId: string): Promise<Row> {
    const GET = await routeHandler('../../app/api/controller/scan/state/route', 'GET', 'GET /api/controller/scan/state');
    const res = await invoke(GET, jsonRequest(`/api/controller/scan/state?event_ids=${eventId}`, 'GET', user.accessToken));
    assert.equal(res.status, 200, `état du contrôle : ${show(res)}`);
    const item = ((res.body.items ?? []) as Row[]).find((i) => i.event_id === eventId);
    assert.ok(item, `état servi pour ${eventId} : ${show(res)}`);
    return item;
}

async function scannerStatus(user: Pick<Buyer, 'accessToken'>): Promise<Row> {
    const GET = await routeHandler('../../app/api/controller/status/route', 'GET', 'GET /api/controller/status');
    const res = await invoke(GET, jsonRequest('/api/controller/status', 'GET', user.accessToken));
    assert.equal(res.status, 200, `statut du scanner : ${show(res)}`);
    return res.body;
}

/** Le menu suit le profil servi par /api/auth/me (`profile.scanner_open`), lu par AppLayout sans requête de plus. */
async function meScanner(user: Pick<Buyer, 'accessToken'>): Promise<unknown> {
    const GET = await routeHandler('../../app/api/auth/me/route', 'GET', 'GET /api/auth/me');
    const res = await invoke(GET, jsonRequest('/api/auth/me', 'GET', user.accessToken));
    assert.equal(res.status, 200, `profil : ${show(res)}`);
    return (res.body.profile as Row | null)?.scanner_open;
}

let partner: TestPartner;
let other: TestPartner;
let buyer: Buyer;

before(async () => {
    partner = await newPartner('f1-ctrl');
    other = await newPartner('f1-ctrl-b');
    buyer = await newBuyer('f1-ctrl-acheteur');
});

after(async () => {
    await assertFinition1Invariants('finition1-controle');
});

describe('Complément 10 — plage du contrôle', () => {
    test('règle existante gardée : fermé 7 h avant le début, ouvert 5 h avant ; annulé : fermé tout de suite', async () => {
        const early = await createTimedEvent(partner.partnerId, 'f1-plage-7', CATS, { startsInHours: 7 });
        const soon = await createTimedEvent(partner.partnerId, 'f1-plage-5', CATS, { startsInHours: 5 });
        const c = await newController(partner, early.eventId, { label: 'f1-plage' });
        await service.from('event_controllers').insert({ event_id: soon.eventId, user_id: c.userId, created_by: partner.userId });
        const s7 = await stateOf(c, early.eventId);
        assert.equal(s7.open, false, JSON.stringify(s7));
        assert.equal(s7.problem, 'event_not_open');
        const opens = new Date(String(s7.opens_at));
        assert.equal(s7.message, `Le contrôle ouvre le ${formatDate(opens)} à ${formatTime(opens)}.`, 'message de l’ouverture');
        assert.equal((await stateOf(c, soon.eventId)).open, true, 'ouvert 6 h avant le début');
        // Annulation par la vraie transition (event_cancel) : le statut ne change jamais par une écriture directe
        const { advanceEventTo } = await import('./cycle-helpers');
        await advanceEventTo(soon.eventId, 'ANNULE');
        const cancelled = await stateOf(c, soon.eventId);
        assert.equal(cancelled.open, false);
        assert.equal(cancelled.problem, 'event_cancelled');
    });

    test('après la fermeture : message clair, recherche d’invités refusée ; rôle gardé, événement passé dans l’équipe', async () => {
        const ended = await createTimedEvent(partner.partnerId, 'f1-fini', CATS, { startsInHours: -20, durationHours: 4 });
        const c = await newController(partner, ended.eventId, { label: 'f1-fini' });
        const s = await stateOf(c, ended.eventId);
        assert.equal(s.open, false);
        assert.equal(s.problem, 'event_ended');
        assert.equal(s.message, ENDED);
        const POST = await routeHandler('../../app/api/controller/scan/guests/route', 'POST', 'POST /api/controller/scan/guests');
        const search = await invoke(POST, jsonRequest('/api/controller/scan/guests', 'POST', c.accessToken, { eventId: ended.eventId, query: '1234' }));
        assert.equal(search.status, 409, `recherche d'invités après la fin : ${show(search)}`);
        assert.equal(search.body.error, ENDED);
        const { data: roles } = await service.from('user_roles').select('role').eq('user_id', c.userId);
        assert.ok((roles ?? []).some((r) => r.role === 'CONTROLEUR'), 'le rôle de contrôleur reste après la fin');
        const GET = await routeHandler('../../app/api/partner/team/route', 'GET', 'GET /api/partner/team');
        const view = await invoke(GET, jsonRequest('/api/partner/team', 'GET', partner.accessToken));
        const m = ((view.body.members ?? []) as Row[]).find((x) => x.user_id === c.userId);
        const a = ((m?.assignments ?? []) as Row[]).find((x) => x.event_id === ended.eventId);
        assert.equal(a?.past, true, `événement terminé dans « Événements passés » : ${JSON.stringify(a)}`);
    });
});

describe('Complément 11 — le menu « Scanner » suit les événements, pas le rôle', () => {
    test('scanner vrai si un contrôle est ouvert ou ouvre dans les 24 h ; faux sinon ; le rôle n’est jamais retiré', async () => {
        const far = await createTimedEvent(partner.partnerId, 'f1-loin', CATS, { startsInHours: 40 });
        const c = await newController(partner, far.eventId, { label: 'f1-statut' });
        assert.equal((await scannerStatus(c)).scanner, false, 'ouverture dans 34 h : application d’un client normal');
        assert.equal(await meScanner(c), false, 'profil : menu « Scanner » masqué (ouverture dans 34 h)');
        const near = await createTimedEvent(other.partnerId, 'f1-proche', CATS, { startsInHours: 20 });
        await service.from('event_controllers').insert({ event_id: near.eventId, user_id: c.userId, created_by: other.userId });
        const st = await scannerStatus(c);
        assert.equal(st.scanner, true, `ouverture dans 14 h (autre partenaire) : ${JSON.stringify(st)}`);
        assert.equal(await meScanner(c), true, 'profil : menu « Scanner » affiché (ouverture dans 14 h)');
        const { data: roles } = await service.from('user_roles').select('role').eq('user_id', c.userId);
        assert.ok((roles ?? []).some((r: { role: string }) => r.role === 'CONTROLEUR'), 'rôle CONTROLEUR gardé');
        const client = await newBuyer('f1-statut-client');
        assert.equal((await scannerStatus(client)).scanner, false, 'client sans affectation');
        assert.equal(await meScanner(client), undefined, 'profil d’un client : aucun champ scanner_open');
    });

    test('le menu lit le profil (scanner_open), sans requête de plus dans la mise en page commune (budget JS)', () => {
        const src = fs.readFileSync(path.resolve(process.cwd(), 'components/layout/AppLayout.tsx'), 'utf8');
        assert.match(src, /profile\?\.scanner_open/, 'AppLayout lit profile?.scanner_open');
        assert.doesNotMatch(src, /\/api\/controller\/status/, 'aucun appel à /api/controller/status depuis AppLayout');
    });
});

describe('Complément 12 — la partenaire scanne ses propres événements', () => {
    test('« Toutes les portes » sur un événement à zones : entrée validée ; jamais l’événement d’une autre partenaire', async () => {
        const ev = await createZonedEvent(partner, 'f1-proprio', CATS, [
            { name: 'Pelouse', kind: 'ENTREE', admits: ['Standard', 'VIP'], gates: ['Porte A'] },
        ], { startsInHours: 1 });
        const [t] = (await buyConfirmed(buyer, ev, [['Standard', 1]])).tickets;
        const ok = await scan(partner, { eventId: ev.eventId, payload: await ticketPayload(String(t.id)), gateId: null });
        assert.equal(ok.status, 200, show(ok));
        assert.equal(ok.body.result, 'valid', `scan de la propriétaire, toutes les portes : ${show(ok)}`);

        const foreign = await createTimedEvent(other.partnerId, 'f1-autrui', CATS, { startsInHours: 1 });
        const [t2] = (await buyConfirmed(buyer, foreign, [['Standard', 1]])).tickets;
        const refused = await scan(partner, { eventId: foreign.eventId, payload: await ticketPayload(String(t2.id)) });
        assert.notEqual(refused.body.result, 'valid', `scan sur l'événement d'une autre partenaire : ${show(refused)}`);
        const { data: row } = await service.from('tickets').select('status').eq('id', t2.id).single();
        assert.equal(row!.status, 'VALIDE', 'billet d’autrui jamais validé à l’entrée');
    });

    test('guichet : la propriétaire vend sur son événement, jamais sur celui d’une autre', async () => {
        const ev = await createTimedEvent(partner.partnerId, 'f1-guichet', CATS, { startsInHours: 1 });
        const foreign = await createTimedEvent(other.partnerId, 'f1-guichet-b', CATS, { startsInHours: 1 });
        const GET = await routeHandler('../../app/api/controller/counter-sale/route', 'GET', 'GET /api/controller/counter-sale');
        const own = await invoke(GET, jsonRequest(`/api/controller/counter-sale?event_id=${ev.eventId}`, 'GET', partner.accessToken));
        assert.equal(own.status, 200, `guichet de la propriétaire : ${show(own)}`);
        assert.equal(own.body.can_accept_cash, true, show(own));
        const theirs = await invoke(GET, jsonRequest(`/api/controller/counter-sale?event_id=${foreign.eventId}`, 'GET', partner.accessToken));
        assert.equal(theirs.status, 403, `guichet sur l'événement d'une autre partenaire : ${show(theirs)}`);
    });

    test('fiche VALIDE exigée : fiche suspendue, la propriétaire ne scanne ni ne vend ; son contrôleur scanne toujours', async () => {
        const susp = await newPartner('f1-fiche-susp');
        const ev = await createTimedEvent(susp.partnerId, 'f1-fiche-susp', CATS, { startsInHours: 1 });
        const c = await newController(susp, ev.eventId, { label: 'f1-fiche-susp' });
        const [t] = (await buyConfirmed(buyer, ev, [['Standard', 1]])).tickets;
        const fiche = async (status: 'VALIDE' | 'SUSPENDU') => {
            const { error } = await service.from('partners').update({ status }).eq('id', susp.partnerId);
            assert.equal(error, null, `fiche ${status} : ${error?.message}`);
        };
        await fiche('SUSPENDU');
        try {
            const own = await scan(susp, { eventId: ev.eventId, payload: await ticketPayload(String(t.id)) });
            assert.equal(own.status, 403, `fiche suspendue, scan de la propriétaire : ${show(own)}`);
            // cvf1 T2 : la route refuse elle-même la propriétaire à fiche non validée, avant la base (même refus 403)
            assert.equal(own.body.code, 'PARTNER_NOT_VALIDATED', show(own));
            const { data: row } = await service.from('tickets').select('status').eq('id', t.id).single();
            assert.equal(row!.status, 'VALIDE', 'billet non consommé par un scan refusé');
            const GET = await routeHandler('../../app/api/controller/counter-sale/route', 'GET', 'GET /api/controller/counter-sale');
            const sale = await invoke(GET, jsonRequest(`/api/controller/counter-sale?event_id=${ev.eventId}`, 'GET', susp.accessToken));
            assert.equal(sale.status, 403, `fiche suspendue, guichet de la propriétaire : ${show(sale)}`);
            // Règle A9 du lot 9 quinquies gardée : les affectations d'une fiche suspendue restent actives (les détenteurs entrent)
            const ctrl = await scan(c, { eventId: ev.eventId, payload: await ticketPayload(String(t.id)) });
            assert.equal(ctrl.body.result, 'valid', `fiche suspendue, scan du contrôleur : ${show(ctrl)}`);
        } finally {
            await fiche('VALIDE');
        }
    });

    test('équipe : la partenaire apparaît en tête, « Vous (organisatrice) — toutes les portes »', () => {
        const src = fs.readFileSync(path.join(process.cwd(), 'components/partner/team/TeamPanel.tsx'), 'utf8');
        assert.ok(src.includes('Vous (organisatrice) — toutes les portes'), 'ligne de la partenaire en tête de l’équipe');
    });
});
