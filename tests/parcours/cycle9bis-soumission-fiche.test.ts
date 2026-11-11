/**
 * Lot 9 bis, tâche 25 (R34, R94, R36, R35 ; contrat 5.25, 4.3, B59 à B61) — soumission, dates, fiche publique :
 *  1. R34 : la soumission refusée dit ce qui manque, dans le message lui-même (« L’événement est incomplet : » suivi
 *     des manques), par la RPC comme par la route partenaire.
 *  2. R94 : un début passé est un manque à la soumission (`start_date`) ; une période de vente qui dépasse la fin aussi.
 *  3. R94 : `ticket_category_update` refuse un début de vente postérieur ou égal à la fin (SALE_START_AFTER_EVENT), par
 *     la RPC et par la route PATCH de la catégorie.
 *  4. R36 : la fiche publique sert `endFormatted` quand une fin est saisie, rien sinon.
 *  5. R35 : catalogue : catégorie au guichet seule → « Vente sur place uniquement » ; « À partir de » sur les seules
 *     catégories achetables (une catégorie épuisée à 3 000 F ne compte pas : 5 000 F).
 * Rouge avant correctif : message générique (M/20261103000005:1033), aucune date contrôlée à la soumission
 * (`:1024-1035`), début de vente jamais borné en modification (M/20261106000001:1018-1024,
 * lib/validations/event.ts:510), fiche sans fin (`app/api/events/[id]/route.ts:183-222`), achetable = actif et en
 * ligne seulement (lib/events/catalog.server.ts:75, `:95-98`).
 * Verts dès l'écriture (témoins, signalés) : un brouillon complet se soumet ; un début de vente avant la fin est accepté.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, rpcTransition, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const HOUR = 3600_000;
const CATS: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 20 }];
const TRANSITION_ROUTE = '../../app/api/partner/events/[id]/transition/route';
const CATEGORY_ROUTE = '../../app/api/partner/events/[id]/categories/[categoryId]/route';
const SHEET_ROUTE = '../../app/api/events/[id]/route';
const CATALOG_ROUTE = '../../app/api/events/route';
const SALE_START_TEXT = 'Le début de vente doit précéder la fin de l’événement.';

let partner: TestPartner;
/** Jeton unique des titres de la suite : filtre du catalogue (`?q=`), base partagée par toutes les suites. */
const TOKEN = `fiche9bis${randomUUID().slice(0, 8)}`;

before(async () => {
    partner = await newPartner('soumission-fiche');
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-soumission-fiche');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

function title(label: string): string {
    return `TEST ${TOKEN} ${label}`;
}

async function refusedSubmission(ev: DraftEvent, label: string): Promise<Row> {
    const call = await rpcTransition(ev.eventId, partner.userId, 'EN_ATTENTE');
    assert.equal(call.error, null, `${label} : ${call.error?.message}`);
    assert.ok(call.data, `${label} : réponse vide`);
    assert.equal(call.data.ok, false, `${label} : soumission refusée attendue, reçu ${JSON.stringify(call.data)}`);
    assert.equal(call.data.code, 'SUBMIT_INCOMPLETE', `${label} : ${JSON.stringify(call.data)}`);
    return call.data as Row;
}

function missingFields(body: Row): string[] {
    return ((Array.isArray(body.missing) ? body.missing : []) as Row[]).map((m) => String(m.field));
}

async function catalogEntry(eventId: string): Promise<Row> {
    const handler = await routeHandler(CATALOG_ROUTE, 'GET', 'GET /api/events');
    const res = await invoke(handler, jsonRequest(`/api/events?q=${TOKEN}`, 'GET', null));
    assert.equal(res.status, 200, `catalogue : ${show(res)}`);
    const entry = ((res.body.events ?? []) as Row[]).find((e) => e.id === eventId);
    assert.ok(entry, `événement ${eventId} au catalogue (q=${TOKEN}) : ${show(res)}`);
    return entry;
}

async function publicSheet(eventId: string): Promise<Row> {
    const handler = await routeHandler(SHEET_ROUTE, 'GET', 'GET /api/events/[id]');
    const res = await invoke(handler, jsonRequest(`/api/events/${eventId}`, 'GET', null), ctx({ id: eventId }));
    assert.equal(res.status, 200, `fiche publique : ${show(res)}`);
    return res.body.event as Row;
}

async function published(label: string, categories: CategorySpec[], durationHours: number | null = 4): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, label, categories, { title: title(label), startsInHours: 72, durationHours });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

// ── 1 et 2. Soumission ─────────────────────────────────────────────────────

describe('R34, R94 — la soumission refusée dit ce qui manque, dates comprises', () => {
    test('brouillon sans affiche : le message lui-même contient « Ajoutez une affiche » (RPC et route partenaire)', async () => {
        const ev = await createDraftEvent(partner, 'sans-affiche', CATS, { title: title('sans affiche'), startsInHours: 72, imageUrl: null });
        const body = await refusedSubmission(ev, 'sans affiche');
        assert.match(String(body.message), /^L[’']événement est incomplet : /, `message : ${JSON.stringify(body)}`);
        assert.match(String(body.message), /Ajoutez une affiche/, `les manques sont dans le message (aujourd’hui « complétez-le avant de le soumettre ») : ${JSON.stringify(body)}`);
        const handler = await routeHandler(TRANSITION_ROUTE, 'POST', 'POST /api/partner/events/[id]/transition');
        const res = await invoke(handler, jsonRequest(`/api/partner/events/${ev.eventId}/transition`, 'POST', partner.accessToken, { to: 'EN_ATTENTE' }), ctx({ id: ev.eventId }));
        assert.ok(res.status >= 400 && res.status < 500, show(res));
        assert.match(String(res.body.error), /Ajoutez une affiche/, `l’écran affiche error tel quel : ${show(res)}`);
    });

    test('brouillon au début passé → SUBMIT_INCOMPLETE, manque start_date « La date de début est passée : changez-la avant de soumettre. »', async () => {
        const ev = await createDraftEvent(partner, 'debut-passe', CATS, { title: title('debut passe'), startsInHours: -2 });
        const body = await refusedSubmission(ev, 'début passé (aujourd’hui accepté)');
        assert.ok(missingFields(body).includes('start_date'), `manque start_date : ${JSON.stringify(body.missing)}`);
        const m = ((body.missing as Row[]).find((x) => x.field === 'start_date') ?? {}) as Row;
        assert.equal(m.message, 'La date de début est passée : changez-la avant de soumettre.', JSON.stringify(m));
    });

    test('catégorie dont la fin de vente dépasse la fin de l’événement : manque à la soumission ; témoin : brouillon complet soumis', async () => {
        const end = new Date(Date.now() + 76 * HOUR);
        const late = new Date(end.getTime() + HOUR).toISOString();
        const ev = await createDraftEvent(partner, 'vente-apres', [{ name: 'Tardive', price: 5_000, total: 10, saleEnd: late }], { title: title('vente apres'), startsInHours: 72, durationHours: 4 });
        const body = await refusedSubmission(ev, 'période de vente au-delà de la fin');
        assert.match(JSON.stringify(body.missing), /Tardive/, `le manque nomme la catégorie : ${JSON.stringify(body.missing)}`);
        const ok = await createDraftEvent(partner, 'complet', CATS, { title: title('complet'), startsInHours: 72 });
        assertRpcOk(await rpcTransition(ok.eventId, partner.userId, 'EN_ATTENTE'), 'brouillon complet');
    });
});

// ── 3. Début de vente en modification ──────────────────────────────────────

describe('R94 — début de vente après la fin de l’événement refusé en modification', () => {
    test('ticket_category_update { sale_start } ≥ fin → SALE_START_AFTER_EVENT (RPC et route PATCH) ; avant la fin → accepté (témoin)', async () => {
        const ev = await createDraftEvent(partner, 'debut-vente', CATS, { title: title('debut vente'), startsInHours: 72, durationHours: 4 });
        const categoryId = ev.categories.Standard.id;
        const { data: e, error: eErr } = await service.from('events').select('end_date, end_time').eq('id', ev.eventId).single();
        assert.equal(eErr, null, eErr?.message);
        const end = new Date(`${e.end_date}T${e.end_time}Z`);
        const after = new Date(end.getTime() + HOUR);

        const { data, error } = await service.rpc('ticket_category_update', {
            p: { event_id: ev.eventId, category_id: categoryId, actor_id: partner.userId, patch: { sale_start: after.toISOString() } },
        });
        assert.equal(error, null, `ticket_category_update : ${error?.message}`);
        const body = (data ?? {}) as Row;
        assert.equal(body.ok, false, `début de vente après la fin : refus attendu (aujourd’hui accepté) : ${JSON.stringify(body)}`);
        assert.equal(body.code, 'SALE_START_AFTER_EVENT', JSON.stringify(body));
        assert.equal(body.message, SALE_START_TEXT, JSON.stringify(body));
        const { data: cat, error: cErr } = await service.from('ticket_categories').select('sale_start').eq('id', categoryId).single();
        assert.equal(cErr, null, cErr?.message);
        assert.equal(cat.sale_start, null, 'catégorie inchangée');

        const handler = await routeHandler(CATEGORY_ROUTE, 'PATCH', 'PATCH /api/partner/events/[id]/categories/[categoryId]');
        const local = after.toISOString().slice(0, 16);
        const res = await invoke(handler, jsonRequest(`/api/partner/events/${ev.eventId}/categories/${categoryId}`, 'PATCH', partner.accessToken, { sale_start: local }),
            ctx({ id: ev.eventId, categoryId }));
        assert.equal(res.status, 400, `route : début de vente après la fin refusé (lib/validations/event.ts:510) : ${show(res)}`);
        assert.match(JSON.stringify(res.body), /SALE_START_AFTER_EVENT/, show(res));

        const before = new Date(end.getTime() - 2 * HOUR).toISOString();
        const { data: ok, error: okErr } = await service.rpc('ticket_category_update', {
            p: { event_id: ev.eventId, category_id: categoryId, actor_id: partner.userId, patch: { sale_start: before } },
        });
        assert.equal(okErr, null, okErr?.message);
        assert.equal((ok as Row | null)?.ok, true, `témoin : début de vente avant la fin accepté : ${JSON.stringify(ok)}`);
    });
});

// ── 4. Fin sur la fiche ────────────────────────────────────────────────────

describe('R36 — la fiche publique affiche la fin quand elle est saisie', () => {
    test('événement de deux jours : endFormatted « jusqu’au … » ; sans fin saisie : rien', async () => {
        const twoDays = await published('deux-jours', CATS, 30);
        const sheet = await publicSheet(twoDays.eventId);
        assert.ok('endFormatted' in sheet, `endFormatted servi (aujourd’hui absent) : ${JSON.stringify(sheet).slice(0, 400)}`);
        assert.match(String(sheet.endFormatted), /^jusqu[’']au /, `fin lisible : ${JSON.stringify(sheet.endFormatted)}`);
        const { data: e, error } = await service.from('events').select('end_time').eq('id', twoDays.eventId).single();
        assert.equal(error, null, error?.message);
        assert.ok(String(sheet.endFormatted).includes(String(e.end_time).slice(0, 5)), `heure de fin citée : ${JSON.stringify(sheet.endFormatted)}`);

        const noEnd = await published('sans-fin', CATS, null);
        const plain = await publicSheet(noEnd.eventId);
        assert.ok(plain.endFormatted === undefined || plain.endFormatted === null, `sans fin saisie : aucune fin montrée (D6), reçu ${JSON.stringify(plain.endFormatted)}`);
    });
});

// ── 5. Catalogue ───────────────────────────────────────────────────────────

describe('R35 — catalogue : « Vente sur place uniquement » et « À partir de » sur les catégories achetables', () => {
    test('catégorie vendue au guichet seulement → saleLabel « Vente sur place uniquement » (aujourd’hui « Bientôt en vente »)', async () => {
        const ev = await createDraftEvent(partner, 'guichet-seul', [{ name: 'Guichet', price: 2_000, total: 20 }], { title: title('guichet seul'), startsInHours: 72 });
        const { error } = await service.from('ticket_categories').update({ sale_online: false, sale_counter: true }).eq('id', ev.categories.Guichet.id);
        assert.equal(error, null, `canaux de la catégorie : ${error?.message}`);
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const entry = await catalogEntry(ev.eventId);
        assert.equal(entry.saleLabel, 'Vente sur place uniquement', `saleLabel servi : ${JSON.stringify(entry)}`);
    });

    test('catégorie en ligne épuisée à 3 000 F et catégorie à 5 000 F → prix « À partir de » 5 000 F', async () => {
        const ev = await published('epuisee', [{ name: 'Petite', price: 3_000, total: 1 }, { name: 'Grande', price: 5_000, total: 10 }]);
        const buyer = await newBuyer('fiche-epuisee');
        await buyConfirmed(buyer, ev, [['Petite', 1]]);
        const entry = await catalogEntry(ev.eventId);
        assert.equal(Number(entry.price), 5000, `prix minimal des catégories achetables (aujourd’hui 3 000, catégorie épuisée) : ${JSON.stringify(entry)}`);
        assert.match(String(entry.saleLabel), /^À partir de /, `saleLabel « À partir de … » : ${JSON.stringify(entry)}`);
        assert.match(String(entry.saleLabel), /5\D?000/, `saleLabel cite 5 000 F : ${JSON.stringify(entry.saleLabel)}`);
    });
});
