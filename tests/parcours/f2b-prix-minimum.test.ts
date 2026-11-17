/**
 * Finition 2b (A, E-26) — prix minimum d'un billet payant. Mon état des lieux du 15/11 (point 2) : vérifié seulement en
 * base par un déclencheur ; à la création, tout l'enregistrement était refusé avec le seul champ « price », sans dire de
 * quelle catégorie il s'agissait ; l'écran affichait « Formulaire : … » sans ouvrir l'étape Billets ; la partenaire ne
 * pouvait pas lire le minimum.
 *  a. GET /api/partner/ticketing-rules : le minimum (réglage finance.min_paid_price) lu par le serveur pour la partenaire ;
 *     sans session : 401.
 *  b. Création : refus PRICE_BELOW_MINIMUM rangé sous la bonne catégorie (ticket_categories.1.price), texte du minimum,
 *     rien n'est créé ; la base dit le même chemin (event_create).
 *  c. Catégorie seule en modification : refus sous « price » (garde-fou, déjà ainsi).
 *  d. Écran : aide « Billet payant : {min} F CFA au moins. 0 pour une entrée gratuite. », minimum lu par la route,
 *     contrôle dès « Suivant ».
 * Rouge avant le correctif : route absente ; refus sous « price » sans catégorie (déclencheur) ; aide ancienne. Sortie
 * brute `[F2B-A3]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { routeContext } from './helpers';
import { importModule, service, type Buyer } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent, storedPosterUrl } from './cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Reply { status: number; body: Row }

const ROOT = process.cwd();
const DAY_MS = 86_400_000;
const RULES_ROUTE = '../../app/api/partner/ticketing-rules/route';

let P: TestPartner;
let poster: string;
let minimum: number;

before(async () => {
    P = await newPartner('f2b-prix-min');
    poster = await storedPosterUrl(P.partnerId);
    const { data, error } = await service.from('platform_settings').select('value').eq('key', 'finance.min_paid_price').single();
    assert.equal(error, null, error?.message);
    minimum = Number((data.value as Row).value);
    assert.ok(Number.isInteger(minimum) && minimum >= 1, `réglage finance.min_paid_price lisible : ${JSON.stringify(data.value)}`);
});

after(async () => {
    await assertFinition1Invariants('f2b-prix-minimum');
});

async function call(modPath: string, method: string, req: NextRequest, ctx?: unknown): Promise<Reply> {
    let mod: Record<string, unknown>;
    try {
        mod = await importModule(modPath);
    } catch (err) {
        assert.fail(`${modPath} : route absente (finition 2b, A3) : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod[method], 'function', `${modPath} : ${method} exporté`);
    const res = await (mod[method] as Handler)(req, ctx);
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

function fieldPaths(r: Reply): string[] {
    const fields = Array.isArray(r.body.fields) ? (r.body.fields as Row[]) : [];
    return [...fields.map((f) => String(f.path)), ...(typeof r.body.field === 'string' ? [r.body.field] : [])];
}

const day = (offset: number) => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
const shown = () => minimum.toLocaleString('fr-FR');
const MESSAGE = () => `Le prix d’un billet payant est d’au moins ${shown()} F CFA. Pour un billet gratuit, indiquez 0.`;

describe('a. minimum lu par le serveur', () => {
    test('GET /api/partner/ticketing-rules : { min_paid_price }', async () => {
        const r = await call(RULES_ROUTE, 'GET', jsonRequest('/api/partner/ticketing-rules', 'GET', P.accessToken));
        console.log(`[F2B-A3] règles de la billetterie : ${show(r)} (réglage : ${minimum})`);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.min_paid_price, minimum, show(r));
    });
    test('sans session : 401', async () => {
        const r = await call(RULES_ROUTE, 'GET', new NextRequest('http://localhost/api/partner/ticketing-rules'));
        assert.equal(r.status, 401, show(r));
    });
});

describe('b. création : refus sous la bonne catégorie', () => {
    test('route : PRICE_BELOW_MINIMUM, champ ticket_categories.1.price, rien n’est créé', async () => {
        const title = `TEST Prix minimum ${Date.now().toString(36)}`;
        const d = day(12);
        const r = await call('../../app/api/partner/events/route', 'POST', jsonRequest('/api/partner/events', 'POST', P.accessToken, {
            title, category: 'CONCERT', start_date: d, start_time: '20:00', location: 'Salle de test', city: 'Dakar',
            latitude: 14.6937, longitude: -17.4441, image_url: poster,
            ticket_categories: [{ name: 'Standard', price: 5000, total_quantity: 100 }, { name: 'Étudiant', price: minimum - 1, total_quantity: 20 }],
        }));
        console.log(`[F2B-A3] création avec un prix sous le minimum : ${show(r)}`);
        assert.equal(r.status, 400, show(r));
        assert.equal(r.body.code, 'PRICE_BELOW_MINIMUM', show(r));
        assert.ok(fieldPaths(r).includes('ticket_categories.1.price'), `chemin du refus : ${JSON.stringify(fieldPaths(r))}`);
        assert.equal(r.body.error, MESSAGE(), show(r));
        const { data } = await service.from('events').select('id').eq('title', title);
        assert.deepEqual(data ?? [], [], 'événement créé malgré le refus');
    });

    test('base : event_create rend le même chemin', async () => {
        const { data, error } = await service.rpc('event_create', { p: { actor_id: P.userId,
            event: { title: `TEST Prix base ${Date.now().toString(36)}`, category: 'CONCERT', start_date: day(12), start_time: '20:00',
                     location: 'Salle de test', city: 'Dakar', latitude: 14.6937, longitude: -17.4441 },
            ticket_categories: [{ name: 'Gratuit', price: 0, total_quantity: 10 }, { name: 'Payant', price: minimum - 1, total_quantity: 10 }] } });
        console.log(`[F2B-A3] RPC event_create : ${JSON.stringify(data)} ${error?.message ?? ''}`);
        assert.equal(error, null, `refus rendu par la fonction, pas par le déclencheur : ${error?.message}`);
        assert.equal((data as Row).ok, false, JSON.stringify(data));
        assert.equal((data as Row).code, 'PRICE_BELOW_MINIMUM', JSON.stringify(data));
        assert.equal((data as Row).field, 'ticket_categories.1.price', JSON.stringify(data));
    });
});

describe('c. catégorie seule en modification', () => {
    test('POST …/categories : refus sous « price »', async () => {
        const ev = await createDraftEvent(P, 'f2b-a3-modif', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 96 });
        const r = await call('../../app/api/partner/events/[id]/categories/route', 'POST',
            jsonRequest(`/api/partner/events/${ev.eventId}/categories`, 'POST', (P as Buyer).accessToken,
                { name: 'Payant', price: minimum - 1, total_quantity: 5 }), routeContext({ id: ev.eventId }));
        assert.equal(r.status, 400, show(r));
        assert.equal(r.body.code, 'PRICE_BELOW_MINIMUM', show(r));
        assert.ok(fieldPaths(r).includes('price'), `chemin du refus : ${JSON.stringify(fieldPaths(r))}`);
    });
});

describe('d. écran : minimum connu, dit, contrôlé dès « Suivant »', () => {
    const ticketing = fs.readFileSync(path.join(ROOT, 'components/events/EventTicketing.tsx'), 'utf8');
    const form = fs.readFileSync(path.join(ROOT, 'components/events/EventForm.tsx'), 'utf8');
    test('aide du prix : « Billet payant : {min} F CFA au moins. 0 pour une entrée gratuite. »', () => {
        assert.match(ticketing, /Billet payant : \$\{[^}]+\} F CFA au moins\. 0 pour une entrée gratuite\./);
    });
    test('minimum lu par la route ; prix contrôlés au passage à l’étape suivante', () => {
        assert.match(form, /\/api\/partner\/ticketing-rules/);
        assert.match(form, /belowMinimum|minPaidPrice/);
    });
});
