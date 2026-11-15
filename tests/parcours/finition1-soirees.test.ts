/**
 * Finition 1, complément 4 — points 13 et 14.
 *
 *  13. « Mes soirées » (GET /api/account/evenings, page /profile/soirees) : pour chaque événement passé où le compte a
 *      contrôlé (affecté, a scanné ou a tenu une caisse) : date, événement, organisatrice, sa porte, entrées qu'il a
 *      validées et, s'il a tenu la caisse, total encaissé et état de la clôture. Lecture seule, accessible même quand
 *      aucun contrôle n'est ouvert. Il ne voit QUE ses chiffres : aucun nom, numéro ni billet de client, rien d'un autre
 *      contrôleur. L'organisatrice lit les mêmes chiffres par contrôleur (`evening` des événements passés,
 *      GET /api/partner/team). Une seule fonction de calcul (controller_evening_figures) pour les deux.
 *  14. Le profil (/api/auth/me) d'un contrôleur seul porte `scanner_next_change_at` : prochain instant où le menu
 *      « Scanner » peut changer (24 h avant une ouverture du contrôle, ou une fermeture). Le navigateur programme la
 *      relecture à cette heure, relit au retour au premier plan, et relit dès qu'un scan est refusé pour « contrôle
 *      fermé » (événement `ev:scanner-refresh`). Aucune bibliothèque ajoutée.
 * Fin de suite : assertFinition1Invariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, openShift, scan, shiftRow, ticketPayload } from './acces-helpers';
import { shiftEventDates } from './cycle-helpers';
import { invoke, routeHandler, show, type Row } from './pilotage-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const CATS: CategorySpec[] = [{ name: 'Standard', price: 2_000, total: 30 }];

async function evenings(user: Pick<Buyer, 'accessToken'>, query = ''): Promise<{ status: number; body: Row }> {
    const GET = await routeHandler('../../app/api/account/evenings/route', 'GET', 'GET /api/account/evenings');
    return invoke(GET, jsonRequest(`/api/account/evenings${query}`, 'GET', user.accessToken));
}

async function meProfile(user: Pick<Buyer, 'accessToken'>): Promise<Row> {
    const GET = await routeHandler('../../app/api/auth/me/route', 'GET', 'GET /api/auth/me');
    const res = await invoke(GET, jsonRequest('/api/auth/me', 'GET', user.accessToken));
    assert.equal(res.status, 200, `profil : ${show(res)}`);
    return res.body.profile as Row;
}

function src(rel: string): string {
    return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
}

let partner: TestPartner;
let buyer: Buyer;
let a: Buyer;
let b: Buyer;
let eventId: string;
let ticketIds: string[] = [];
let ticketNumbers: string[] = [];

before(async () => {
    partner = await newPartner('f1-soirees');
    buyer = await newBuyer('f1-soirees-client', { firstName: 'Ndeye', lastName: 'Spectatricesoiree' });
    const ev = await createTimedEvent(partner.partnerId, 'f1-soirees', CATS, { startsInHours: 1 });
    eventId = ev.eventId;
    a = await newController(partner, eventId, { label: 'f1-soirees-a', canAcceptCash: true });
    b = await newController(partner, eventId, { label: 'f1-soirees-b' });
    const tickets = (await buyConfirmed(buyer, ev, [['Standard', 3]])).tickets;
    ticketIds = tickets.map((t) => String(t.id));
    const { data } = await service.from('tickets').select('ticket_number').in('id', ticketIds);
    ticketNumbers = (data ?? []).map((r: { ticket_number: string }) => r.ticket_number);
    // A valide deux entrées, B une
    for (const [who, id] of [[a, ticketIds[0]], [a, ticketIds[1]], [b, ticketIds[2]]] as const) {
        const r = await scan(who, { eventId, payload: await ticketPayload(id) });
        assert.equal(r.body.result, 'valid', `montage, scan : ${show(r)}`);
    }
    // A tient une caisse : une vente au guichet (2 000 F), clôturée par l'organisatrice au montant attendu
    const opened = await openShift(a, eventId, 0);
    assert.equal(opened.status, 200, `montage, caisse : ${show(opened)}`);
    const POST = await routeHandler('../../app/api/controller/counter-sale/route', 'POST', 'POST /api/controller/counter-sale');
    const sale = await invoke(POST, jsonRequest('/api/controller/counter-sale', 'POST', a.accessToken,
        { eventId, items: [{ categoryId: ev.categories.Standard.id, quantity: 1 }] }, { 'idempotency-key': randomUUID() }));
    assert.equal(sale.status, 200, `montage, vente au guichet : ${show(sale)}`);
    const { data: shift } = await service.from('controller_shifts').select('id').eq('event_id', eventId).eq('controller_id', a.userId).single();
    const s = await shiftRow(String(shift!.id));
    const CLOSE = await routeHandler('../../app/api/controller/shifts/close/route', 'POST', 'POST /api/controller/shifts/close');
    const closed = await invoke(CLOSE, jsonRequest('/api/controller/shifts/close', 'POST', partner.accessToken,
        { shiftId: s.id, declaredCashTotal: Number(s.expected_cash_total ?? 0) }));
    assert.equal(closed.status, 200, `montage, clôture : ${show(closed)}`);
    // La soirée passe : début il y a 30 h, fin il y a 26 h
    await shiftEventDates(eventId, { startsInHours: -30, durationHours: 4 });
});

after(async () => {
    await assertFinition1Invariants('finition1-soirees');
});

describe('Complément 13 — « Mes soirées » du contrôleur', () => {
    test('ses chiffres : date, événement, organisatrice, entrées validées, caisse (total et clôture)', async () => {
        const res = await evenings(a);
        assert.equal(res.status, 200, show(res));
        const items = res.body.items as Row[];
        const it = items.find((i) => i.event_id === eventId);
        assert.ok(it, `soirée servie : ${show(res)}`);
        assert.equal(it.entries, 2, `entrées validées par A : ${JSON.stringify(it)}`);
        assert.ok(typeof it.title === 'string' && String(it.title).includes('f1-soirees'), 'titre de l’événement');
        assert.ok(typeof it.organizer === 'string' && String(it.organizer).length > 0, 'organisatrice');
        assert.ok(it.start_at, 'date');
        const cash = it.cash as Row | null;
        assert.ok(cash, `caisse tenue : ${JSON.stringify(it)}`);
        assert.equal(Number(cash.collected), 2_000, `total encaissé : ${JSON.stringify(cash)}`);
        assert.equal(cash.state, 'CLOSED', `clôture : ${JSON.stringify(cash)}`);
        const resB = await evenings(b);
        const itB = (resB.body.items as Row[]).find((i) => i.event_id === eventId);
        assert.equal(itB?.entries, 1, `entrées validées par B : ${JSON.stringify(itB)}`);
        assert.equal(itB?.cash, null, 'B n’a pas tenu de caisse');
    });

    test('il ne voit que ses chiffres : aucun nom, numéro ni billet de client, rien de l’autre contrôleur', async () => {
        const res = await evenings(a, `?user_id=${b.userId}`);
        assert.equal(res.status, 200, show(res));
        const it = (res.body.items as Row[]).find((i) => i.event_id === eventId);
        assert.equal(it?.entries, 2, 'un identifiant passé dans l’adresse est ignoré : toujours les chiffres de A');
        const text = JSON.stringify(res.body);
        for (const secret of ['Spectatricesoiree', buyer.phoneE164, buyer.phone9, buyer.email, buyer.userId, b.userId, b.phoneE164, b.phone9, b.email, ...ticketIds, ...ticketNumbers]) {
            assert.ok(secret && !text.includes(String(secret)), `donnée d’autrui servie à A : ${String(secret)}`);
        }
        const allowed = new Set(['event_id', 'title', 'status', 'start_at', 'organizer', 'gate', 'zone', 'entry_point', 'entries', 'cash']);
        assert.deepEqual(Object.keys(it!).filter((k) => !allowed.has(k)), [], `champs inattendus : ${Object.keys(it!).join(', ')}`);
        const client = await newBuyer('f1-soirees-sans');
        const none = await evenings(client);
        assert.equal(none.status, 200, show(none));
        assert.deepEqual(none.body.items, [], 'un client sans soirée ne voit rien');
        const anon = await evenings({ accessToken: '' });
        assert.ok([401, 403].includes(anon.status), `sans session : ${show(anon)}`);
    });

    test('l’organisatrice voit les mêmes chiffres par contrôleur dans « Événements passés »', async () => {
        const GET = await routeHandler('../../app/api/partner/team/route', 'GET', 'GET /api/partner/team');
        const res = await invoke(GET, jsonRequest(`/api/partner/team?eventId=${eventId}`, 'GET', partner.accessToken));
        assert.equal(res.status, 200, show(res));
        const members = res.body.members as Row[];
        const slot = (u: Buyer) => ((members.find((m) => m.user_id === u.userId)?.assignments ?? []) as Row[]).find((x) => x.event_id === eventId);
        const sa = slot(a);
        const sb = slot(b);
        assert.equal(sa?.past, true, 'événement passé');
        const mine = ((await evenings(a)).body.items as Row[]).find((i) => i.event_id === eventId)!;
        assert.deepEqual(sa?.evening, { entries: mine.entries, cash: mine.cash }, `mêmes chiffres pour A : ${JSON.stringify(sa?.evening)}`);
        assert.deepEqual((sb?.evening as Row | undefined)?.entries, 1, `mêmes chiffres pour B : ${JSON.stringify(sb?.evening)}`);
    });

    test('page « Mes soirées » : lien depuis le profil, lecture seule, sans dépendre du scanner', () => {
        const page = src('app/profile/soirees/page.tsx');
        assert.match(page, /\/api\/account\/evenings/, 'la page lit GET /api/account/evenings');
        assert.doesNotMatch(page, /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/, 'aucune écriture');
        assert.match(src('app/profile/page.tsx'), /\/profile\/soirees/, 'lien depuis le profil');
        assert.ok(!src('app/profile/soirees/page.tsx').includes('/controller/'), 'hors de l’espace /controller (accessible sans contrôle ouvert)');
    });
});

describe('Complément 14 — menu « Scanner » à jour sans recharger', () => {
    test('le profil porte l’heure du prochain changement : 24 h avant l’ouverture, ou la fermeture', async () => {
        const far = await createTimedEvent(partner.partnerId, 'f1-change-loin', CATS, { startsInHours: 40 });
        const c1 = await newController(partner, far.eventId, { label: 'f1-change-1' });
        const p1 = await meProfile(c1);
        assert.equal(p1.scanner_open, false, 'ouverture dans 34 h : menu masqué');
        const expected1 = Date.now() + 10 * 3600_000; // ouverture à +34 h, menu visible 24 h avant
        assert.ok(Math.abs(new Date(String(p1.scanner_next_change_at)).getTime() - expected1) < 5 * 60_000,
            `prochain changement ≈ +10 h : ${String(p1.scanner_next_change_at)}`);

        const open = await createTimedEvent(partner.partnerId, 'f1-change-ouvert', CATS, { startsInHours: 1, durationHours: 4 });
        const c2 = await newController(partner, open.eventId, { label: 'f1-change-2' });
        const p2 = await meProfile(c2);
        assert.equal(p2.scanner_open, true, 'contrôle ouvert : menu affiché');
        const expected2 = Date.now() + 11 * 3600_000; // fin à +5 h, fermeture 6 h après
        assert.ok(Math.abs(new Date(String(p2.scanner_next_change_at)).getTime() - expected2) < 5 * 60_000,
            `prochain changement ≈ +11 h (fermeture) : ${String(p2.scanner_next_change_at)}`);
    });

    test('le navigateur relit à l’heure dite, au premier plan, et après un scan refusé « contrôle fermé »', () => {
        const auth = src('components/providers/AuthProvider.tsx');
        assert.match(auth, /scanner_next_change_at/, 'relecture programmée à l’heure du prochain changement');
        assert.match(auth, /visibilitychange/, 'relecture au retour au premier plan');
        assert.match(auth, /ev:scanner-refresh/, 'relecture sur l’événement du scanner');
        const scanner = src('app/controller/scanner/page.tsx');
        assert.match(scanner, /ev:scanner-refresh/, 'le scanner signale un refus « contrôle fermé »');
        const pkg = JSON.parse(src('package.json')) as { dependencies?: Record<string, string> };
        assert.ok(!Object.keys(pkg.dependencies ?? {}).some((d) => /timer|visibility|idle/i.test(d)), 'aucune bibliothèque ajoutée');
    });
});
