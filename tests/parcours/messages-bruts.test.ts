/**
 * Lot 8, tâches 8.2 i et 8.2 k — pannes simulées : une erreur de la base n'atteint jamais le navigateur, et une
 * panne de lecture n'est jamais présentée comme une liste vide (contrat 3.8, 3.9, 8.2, 8.3, L56).
 *
 * Panne : `globalThis.fetch` répond 500 pour la table visée, avec le corps de PostgREST
 * { message: 'relation "x" SENTINELLE_SECRETE', code: '42P01' }. Le client serveur passe par noStoreFetch, qui lit
 * le fetch global à chaque requête. Chaque panne compte ses passages : une panne jamais atteinte fait échouer le test.
 *
 * POSTGRES_TEXT_RE (T15) est lue dans la source de dette-interface-lot7.test.ts au lieu d'être importée : importer un
 * fichier .test enregistrerait toutes ses suites ici (node:test), et les tests du lot 7 tourneraient deux fois.
 *
 * Rouge aujourd'hui :
 *  - admin/communications, admin/promotions, partner/halls renvoient le texte de la base ;
 *  - partner/events/[id] (A26, lot 9) : une panne répond 500 EVENT_UNAVAILABLE, plus jamais 404 « introuvable » ;
 *  - GET controller/profile répond 200 et assignments: [] sur panne des affectations, 404 sur panne du profil ;
 *  - PATCH controller/profile répond 404 sur panne de lecture, et n'a aucun journal sur panne d'auth.admin ;
 *  - after : le schéma du lot n'est pas livré (assertRecetteInvariants).
 * Vert après fix(8.2i-2), fix(8.2i-4), fix(8.2i-5), fix(8.2k) et les migrations du lot.
 *
 * Témoins verts dès l'écriture (ils tiennent les correctifs, annoncés) : routes sans panne, contrôleur avec
 * affectation, messages français voulus de HallService (sans PublicError, ils tomberaient au repli).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { GET as adminCommunications } from '../../app/api/admin/communications/route';
import { GET as adminPromotions } from '../../app/api/admin/promotions/route';
import { GET as controllerProfile, PATCH as controllerPassword } from '../../app/api/controller/profile/route';
import { GET as partnerEvent } from '../../app/api/partner/events/[id]/route';
import { GET as partnerHalls, POST as createHall } from '../../app/api/partner/halls/route';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { authed, createTimedEvent, newController, type RouteResult } from './acces-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { routeContext } from './helpers';
import type { Buyer, SaleEvent } from './paiement-helpers';
import { newAdminWith, withFeatureFlags } from './terrain-helpers';

after(async () => {
    await assertRecetteInvariants('messages-bruts');
});

const SENTINEL = 'SENTINELLE_SECRETE';
const CODE_RE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

function postgresTextRe(): RegExp {
    const rel = 'tests/parcours/dette-interface-lot7.test.ts';
    const m = /^export const POSTGRES_TEXT_RE = \/(.+)\/([a-z]*);$/m.exec(fs.readFileSync(path.join(process.cwd(), rel), 'utf8'));
    assert.ok(m, `${rel} : export de POSTGRES_TEXT_RE introuvable (T15)`);
    return new RegExp(m[1], m[2]);
}

const POSTGRES_TEXT_RE = postgresTextRe();

interface Reply extends RouteResult { text: string }

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Record<string, unknown> = {};
    if (text) {
        try {
            body = JSON.parse(text) as Record<string, unknown>;
        } catch (err) {
            assert.fail(`réponse non JSON (${res.status}) : ${text.slice(0, 200)} (${err instanceof Error ? err.message : String(err)})`);
        }
    }
    return { status: res.status, body, text };
}

type Target = (url: URL, method: string) => boolean;

const table = (name: string, select?: (value: string) => boolean): Target => (url, method) =>
    method === 'GET' && url.pathname === `/rest/v1/${name}` && (!select || select(url.searchParams.get('select') ?? ''));

interface Outage<T> { result: T; hits: number; logged: string[] }

/** Exécute `fn` pendant la panne de `target` ; journal d'erreurs capturé, panne atteinte exigée. */
async function during<T>(target: Target, fn: () => Promise<T>): Promise<Outage<T>> {
    const previousFetch = globalThis.fetch;
    const previousError = console.error;
    const logged: string[] = [];
    let hits = 0;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (!target(new URL(href), method)) return previousFetch(input, init);
        hits++;
        return new Response(JSON.stringify({ message: `relation "x" ${SENTINEL}`, code: '42P01', details: SENTINEL, hint: SENTINEL }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;
    console.error = (...args: unknown[]): void => {
        logged.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    };
    try {
        const result = await fn();
        assert.ok(hits >= 1, 'la panne simulée n\'a pas été atteinte : le test ne prouverait rien');
        return { result, hits, logged };
    } finally {
        globalThis.fetch = previousFetch;
        console.error = previousError;
    }
}

function assertClean(r: Reply, what: string): void {
    assert.ok(!r.text.includes(SENTINEL), `${what} : texte de la base renvoyé au navigateur : ${r.text.slice(0, 300)}`);
    assert.doesNotMatch(r.text, POSTGRES_TEXT_RE, `${what} : texte de Postgres ou de PostgREST dans la réponse : ${r.text.slice(0, 300)}`);
    assert.equal(typeof r.body.error, 'string', `${what} : message d'erreur absent : ${r.text.slice(0, 300)}`);
    assert.equal(typeof r.body.code, 'string', `${what} : code stable absent : ${r.text.slice(0, 300)}`);
    assert.match(String(r.body.code), CODE_RE, `${what} : code « ${String(r.body.code)} » : code applicatif attendu, jamais un SQLSTATE`);
    assert.notEqual(r.body.success, true, `${what} : success: true sur une panne`);
}

let partner: TestPartner;
let ev: SaleEvent;
let controller: Buyer;

before(async () => {
    partner = await newPartner('msg-bruts');
    ev = await createTimedEvent(partner.partnerId, 'messages bruts', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 24 });
    controller = await newController(partner, ev.eventId, { label: 'msg' });
});

const getCommunications = (admin: Buyer): Promise<Response> => adminCommunications(authed('/api/admin/communications', 'GET', admin));
const getPromotions = (admin: Buyer): Promise<Response> => adminPromotions(authed('/api/admin/promotions', 'GET', admin));
const getPartnerEvent = (user: Buyer, id: string): Promise<Response> =>
    partnerEvent(authed(`/api/partner/events/${id}`, 'GET', user), routeContext({ id }));
const getHalls = (user: Buyer): Promise<Response> => partnerHalls(authed('/api/partner/halls', 'GET', user));
const getProfile = (user: Buyer): Promise<Response> => controllerProfile(authed('/api/controller/profile', 'GET', user));

function passwordChange(user: Buyer): NextRequest {
    return authed('/api/controller/profile', 'PATCH', user, {
        current_password: `Aa1${randomBytes(8).toString('hex')}`,
        new_password: `Bb2${randomBytes(8).toString('hex')}`,
    });
}

describe('8.2 i — routes témoins sous panne de la base', () => {
    test('admin/communications : 500, CAMPAIGNS_UNAVAILABLE, message français', async () => {
        const admin = await newAdminWith(['communications.manage'], { label: 'msg-comm' });
        const { result } = await during(table('campaigns'), async () => reply(await getCommunications(admin)));
        assertClean(result, 'admin/communications');
        assert.equal(result.status, 500);
        assert.equal(result.body.code, 'CAMPAIGNS_UNAVAILABLE');
        assert.equal(result.body.error, 'Campagnes momentanément indisponibles.');
    });

    test('admin/promotions : 500, PROMOTIONS_UNAVAILABLE, message français', async () => {
        const admin = await newAdminWith(['events.read'], { label: 'msg-promo' });
        const { result } = await during(table('sponsored_promotions'), async () => reply(await getPromotions(admin)));
        assertClean(result, 'admin/promotions');
        assert.equal(result.status, 500);
        assert.equal(result.body.code, 'PROMOTIONS_UNAVAILABLE');
        assert.equal(result.body.error, 'Mises en avant momentanément indisponibles.');
    });

    test('partner/events/[id] : 500 EVENT_UNAVAILABLE (A26, lot 9), une panne n\'est pas une absence, message français', async () => {
        const { result } = await during(table('events'), async () => reply(await getPartnerEvent(partner, ev.eventId)));
        assertClean(result, 'partner/events/[id]');
        assert.deepEqual([result.status, result.body.code], [500, 'EVENT_UNAVAILABLE'], result.text.slice(0, 300));
        assert.match(String(result.body.error), /momentanément indisponible/i);
    });

    test('partner/halls : 500, code *_UNAVAILABLE, message français', async () => {
        const { result } = await withFeatureFlags({ halls: true }, () => during(table('halls'), async () => reply(await getHalls(partner))));
        assertClean(result, 'partner/halls');
        assert.equal(result.status, 500);
        assert.match(String(result.body.code), /_UNAVAILABLE$/);
        assert.match(String(result.body.error), /momentanément indisponibles?\b/);
    });
});

describe('8.2 i — témoins sans panne : rien de perdu (verts dès l\'écriture)', () => {
    test('admin/communications et admin/promotions : 200 et liste', async () => {
        const admin = await newAdminWith(['communications.manage', 'events.read'], { label: 'msg-ok' });
        const comm = await reply(await getCommunications(admin));
        assert.equal(comm.status, 200, comm.text.slice(0, 300));
        assert.ok(Array.isArray(comm.body.campaigns), 'liste des campagnes absente');
        const promo = await reply(await getPromotions(admin));
        assert.equal(promo.status, 200, promo.text.slice(0, 300));
        assert.ok(Array.isArray(promo.body.promotions), 'liste des mises en avant absente');
    });

    test('partner/events/[id] : 200 et la fiche', async () => {
        const r = await reply(await getPartnerEvent(partner, ev.eventId));
        assert.equal(r.status, 200, r.text.slice(0, 300));
        assert.equal((r.body.event as { id: string }).id, ev.eventId);
    });

    for (const [name, body, text] of [
        ['nom manquant', { capacity: 10 }, 'Le nom de la salle est obligatoire.'],
        ['capacité nulle', { name: 'Salle témoin', capacity: 0 }, 'La capacité de la salle doit être supérieure à 0.'],
    ] as ReadonlyArray<[string, Record<string, unknown>, string]>) {
        test(`POST partner/halls, ${name} : le message français voulu reste affiché (400)`, async () => {
            const r = await withFeatureFlags({ halls: true }, async () => reply(await createHall(authed('/api/partner/halls', 'POST', partner, body))));
            assert.equal(r.status, 400, r.text.slice(0, 300));
            assert.equal(r.body.error, text, 'message voulu perdu : ce throw doit devenir PublicError (section 9, I1)');
        });
    }
});

describe('8.2 k — GET /api/controller/profile : une panne de lecture n\'est pas une liste vide', () => {
    test('panne de event_controllers : 500 ASSIGNMENTS_UNAVAILABLE, pas de assignments: [], journal', async () => {
        const { result, logged } = await during(table('event_controllers'), async () => reply(await getProfile(controller)));
        assert.equal(result.status, 500, `panne présentée comme un succès : ${result.text.slice(0, 300)}`);
        assertClean(result, 'controller/profile');
        assert.equal(result.body.code, 'ASSIGNMENTS_UNAVAILABLE');
        assert.equal(result.body.error, 'Vos affectations sont momentanément indisponibles. Réessayez.');
        assert.ok(!('assignments' in result.body), 'la réponse d\'échec ne doit pas porter de liste');
        assert.ok(logged.length >= 1, 'panne non journalisée');
    });

    test('panne de lecture du profil : 500 PROFILE_UNAVAILABLE, pas 404', async () => {
        // getServerSessionUser lit aussi users, sans created_at : la panne ne vise que la lecture de la route.
        const { result } = await during(table('users', (s) => s.includes('created_at')), async () => reply(await getProfile(controller)));
        assert.equal(result.status, 500, `panne présentée comme un profil absent : ${result.text.slice(0, 300)}`);
        assertClean(result, 'controller/profile');
        assert.equal(result.body.code, 'PROFILE_UNAVAILABLE');
    });

    test('témoin : contrôleur avec affectation, 200 et son événement (vert dès l\'écriture)', async () => {
        const r = await reply(await getProfile(controller));
        assert.equal(r.status, 200, r.text.slice(0, 300));
        const rows = r.body.assignments as Array<{ events: { id: string; date: string; start_date: string } | null }>;
        assert.equal(rows.length, 1, 'affectation attendue');
        assert.equal(rows[0].events?.id, ev.eventId);
        assert.equal(rows[0].events?.date, rows[0].events?.start_date);
    });

    test('témoin : compte sans affectation, 200 et liste vide, seul cas d\'une liste vide (vert dès l\'écriture)', async () => {
        const fresh = await newController(partner, null, { label: 'msg-vide' });
        const r = await reply(await getProfile(fresh));
        assert.equal(r.status, 200, r.text.slice(0, 300));
        assert.deepEqual(r.body.assignments, []);
    });
});

describe('L56 — PATCH /api/controller/profile : lectures ignorées traitées (signalé, non demandé par la consigne)', () => {
    test('panne de lecture du numéro : 500, pas « Profil introuvable. »', async () => {
        const { result, logged } = await during(table('users', (s) => s === 'phone'), async () => reply(await controllerPassword(passwordChange(controller))));
        assert.equal(result.status, 500, `panne présentée comme un profil absent : ${result.text.slice(0, 300)}`);
        assert.ok(!result.text.includes(SENTINEL), `texte de la base renvoyé : ${result.text.slice(0, 300)}`);
        assert.ok(logged.length >= 1, 'panne non journalisée');
    });

    test('panne de auth.admin.getUserById : 500 sans texte brut, et journalisée', async () => {
        const target: Target = (url, method) => method === 'GET' && url.pathname === `/auth/v1/admin/users/${controller.userId}`;
        const { result, logged } = await during(target, async () => reply(await controllerPassword(passwordChange(controller))));
        assert.equal(result.status, 500, result.text.slice(0, 300));
        assert.ok(!result.text.includes(SENTINEL), `texte d'Auth renvoyé : ${result.text.slice(0, 300)}`);
        assert.ok(logged.length >= 1, 'erreur de lecture ignorée : aucun journal');
    });
});
