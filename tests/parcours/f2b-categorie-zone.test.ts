/**
 * Finition 2b (A, E-22) — supprimer une catégorie sans vente ne laisse jamais une zone sans catégorie admise.
 * Mon état des lieux du 15/11 (point 2, sécurité faible) : la suppression effaçait aussi ses admissions dans les zones
 * (clé étrangère ON DELETE CASCADE de zone_categories) sans revérifier les règles des zones ; une zone pouvait rester
 * sans aucune catégorie admise, et chaque billet présenté à ses portes y était alors refusé.
 *  a. Une zone n'admet que la catégorie : refus clair CATEGORY_ONLY_IN_ZONE (route 409 et base), qui nomme la zone et dit
 *     où la régler (étape « Contrôle à l'entrée ») ; la catégorie et ses admissions restent.
 *  b. Deux zones dans ce cas : les deux sont nommées.
 *  c. La catégorie est admise par des zones qui en admettent d'autres : suppression permise, les zones gardent leurs
 *     autres catégories.
 *  d. Événement sans zone : suppression inchangée.
 * Rouge avant le correctif : la suppression réussit et laisse la zone vide. Sortie brute `[F2B-A4]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { routeContext } from './helpers';
import { importModule, service, type Buyer } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createZonedEvent } from './zones-helpers';
import { createDraftEvent } from './cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Reply { status: number; body: Row }

const CATEGORY_ROUTE = '../../app/api/partner/events/[id]/categories/[categoryId]/route';

let P: TestPartner;

before(async () => {
    P = await newPartner('f2b-cat-zone');
});

after(async () => {
    await assertFinition1Invariants('f2b-categorie-zone');
});

async function deleteCategory(user: Buyer, eventId: string, categoryId: string): Promise<Reply> {
    const mod = await importModule(CATEGORY_ROUTE);
    assert.equal(typeof mod.DELETE, 'function', 'DELETE /api/partner/events/[id]/categories/[categoryId] exporté');
    const res = await (mod.DELETE as Handler)(
        jsonRequest(`/api/partner/events/${eventId}/categories/${categoryId}`, 'DELETE', user.accessToken),
        routeContext({ id: eventId, categoryId }));
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch {
        body = { raw: text.slice(0, 2000) };
    }
    return { status: res.status, body };
}

function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

async function categoryExists(id: string): Promise<boolean> {
    const { data, error } = await service.from('ticket_categories').select('id').eq('id', id).maybeSingle();
    assert.equal(error, null, error?.message);
    return data !== null;
}

/** Noms des catégories admises par chaque zone de l'événement (par nom de zone). */
async function admissions(eventId: string): Promise<Record<string, string[]>> {
    const { data: zones, error } = await service.from('event_zones').select('id, name').eq('event_id', eventId);
    assert.equal(error, null, error?.message);
    const { data: cats } = await service.from('ticket_categories').select('id, name').eq('event_id', eventId);
    const nameOf = new Map((cats ?? []).map((c) => [String(c.id), String(c.name)]));
    const out: Record<string, string[]> = {};
    for (const z of zones ?? []) {
        const { data: zc, error: zcErr } = await service.from('zone_categories').select('category_id').eq('zone_id', z.id);
        assert.equal(zcErr, null, zcErr?.message);
        out[String(z.name)] = (zc ?? []).map((r) => nameOf.get(String(r.category_id)) ?? String(r.category_id)).sort();
    }
    return out;
}

const CATS = [{ name: 'Standard', price: 0, total: 10 }, { name: 'VIP', price: 0, total: 5 }];

describe('a. zone qui n’admet que la catégorie : refus clair, rien n’est effacé', () => {
    test('route : 409 CATEGORY_ONLY_IN_ZONE, zone nommée, étape indiquée ; catégorie et admissions gardées', async () => {
        const ev = await createZonedEvent(P, 'f2b-a4-route', CATS, [
            { name: 'Entrée générale', kind: 'ENTREE', admits: ['Standard', 'VIP'], gates: ['Porte principale'] },
            { name: 'Carré VIP', kind: 'CONTROLE', admits: ['VIP'], gates: ['Porte VIP'] },
        ], { status: 'BROUILLON', startsInHours: 72 });
        const before = await admissions(ev.eventId);
        const r = await deleteCategory(P, ev.eventId, ev.categories.VIP.id);
        console.log(`[F2B-A4] suppression de VIP (seule catégorie du Carré VIP) : ${show(r)} ; admissions avant ${JSON.stringify(before)}`);
        assert.equal(r.status, 409, show(r));
        assert.equal(r.body.code, 'CATEGORY_ONLY_IN_ZONE', show(r));
        const message = String(r.body.error ?? '');
        assert.match(message, /Carré VIP/, `le refus nomme la zone : ${message}`);
        assert.match(message, /Contrôle à l’entrée/, `le refus dit où régler les zones : ${message}`);
        assert.equal(await categoryExists(ev.categories.VIP.id), true, 'la catégorie VIP a été effacée malgré le refus');
        assert.deepEqual(await admissions(ev.eventId), before, 'admissions modifiées malgré le refus');
    });

    test('base : ticket_category_delete refuse aussi (même code), sans passer par la route', async () => {
        const ev = await createZonedEvent(P, 'f2b-a4-base', CATS, [
            { name: 'Entrée générale', kind: 'ENTREE', admits: ['Standard', 'VIP'], gates: ['Porte principale'] },
            { name: 'Carré VIP', kind: 'CONTROLE', admits: ['VIP'], gates: ['Porte VIP'] },
        ], { status: 'BROUILLON', startsInHours: 72 });
        const { data, error } = await service.rpc('ticket_category_delete', { p: { event_id: ev.eventId, category_id: ev.categories.VIP.id, actor_id: P.userId } });
        console.log(`[F2B-A4] RPC ticket_category_delete (VIP) : ${JSON.stringify(data)} ${error?.message ?? ''}`);
        assert.equal(error, null, error?.message);
        assert.equal((data as Row).ok, false, JSON.stringify(data));
        assert.equal((data as Row).code, 'CATEGORY_ONLY_IN_ZONE', JSON.stringify(data));
        assert.equal(await categoryExists(ev.categories.VIP.id), true, 'catégorie effacée par la base');
    });
});

describe('b. deux zones dans ce cas : les deux sont nommées', () => {
    test('Entrée VIP (ENTREE) et Carré VIP (CONTROLE) n’admettent que VIP', async () => {
        const ev = await createZonedEvent(P, 'f2b-a4-deux', CATS, [
            { name: 'Entrée générale', kind: 'ENTREE', admits: ['Standard'], gates: ['Porte principale'] },
            { name: 'Entrée VIP', kind: 'ENTREE', admits: ['VIP'], gates: ['Porte côté jardin'] },
            { name: 'Carré VIP', kind: 'CONTROLE', admits: ['VIP'], gates: ['Porte VIP'] },
        ], { status: 'BROUILLON', startsInHours: 72 });
        const r = await deleteCategory(P, ev.eventId, ev.categories.VIP.id);
        console.log(`[F2B-A4] suppression de VIP (deux zones) : ${show(r)}`);
        assert.equal(r.status, 409, show(r));
        assert.match(String(r.body.error ?? ''), /Entrée VIP/, show(r));
        assert.match(String(r.body.error ?? ''), /Carré VIP/, show(r));
    });
});

describe('c. zones qui admettent aussi d’autres catégories : suppression permise', () => {
    test('Standard supprimée : chaque zone garde au moins une catégorie', async () => {
        const ev = await createZonedEvent(P, 'f2b-a4-permise', CATS, [
            { name: 'Entrée générale', kind: 'ENTREE', admits: ['Standard', 'VIP'], gates: ['Porte principale'] },
            { name: 'Carré VIP', kind: 'CONTROLE', admits: ['VIP'], gates: ['Porte VIP'] },
        ], { status: 'BROUILLON', startsInHours: 72 });
        const r = await deleteCategory(P, ev.eventId, ev.categories.Standard.id);
        const after = await admissions(ev.eventId);
        console.log(`[F2B-A4] suppression de Standard : ${show(r)} ; admissions après ${JSON.stringify(after)}`);
        assert.equal(r.status, 200, show(r));
        assert.deepEqual(after, { 'Entrée générale': ['VIP'], 'Carré VIP': ['VIP'] });
    });
});

describe('d. événement sans zone : suppression inchangée', () => {
    test('catégorie sans vente supprimée', async () => {
        const ev = await createDraftEvent(P, 'f2b-a4-sans-zone', CATS, { startsInHours: 72 });
        const r = await deleteCategory(P, ev.eventId, ev.categories.VIP.id);
        console.log(`[F2B-A4] suppression sans zone : ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        assert.equal(await categoryExists(ev.categories.VIP.id), false);
    });
});
