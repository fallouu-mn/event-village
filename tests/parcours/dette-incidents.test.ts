/**
 * Lot 5, tâche 5.0 — dette du lot 4, C8 : incidents techniques du scan comptés à part, dans
 * scan_incidents (scanneur, événement, type, horodatage), sans toucher ticket_scans. Contrat : section
 * C8 de la conception du lot 5.
 *  - table scan_incidents(id, scanner_id NOT NULL, event_id NULL, kind ∈ RATE_LIMITED, SERVER_ERROR,
 *    GUARD_UNAVAILABLE, NETWORK, TIMEOUT, source ∈ SERVER, DEVICE, created_at) ;
 *  - écrite par le serveur pour les 429 et 5xx de /api/controller/scan : le corps est lu avant le quota
 *    pour connaître eventId ; event_id NULL si le corps est illisible ;
 *  - déclarée par l'appareil (NETWORK, TIMEOUT) : POST /api/controller/scan/incidents
 *    { eventId, incidents: [{ kind, at }] }, au plus 20 par appel, quota par scanneur ; scanneur non
 *    autorisé sur l'événement → incident ignoré (204) ; middleware étendu à cette route ;
 *  - RLS SELECT : partenaire propriétaire et admins ; ticket_scans n'est pas touché.
 *
 * Rouge avant correctif :
 *  - la table scan_incidents n'existe pas ; app/api/controller/scan/route.ts:58-59 : quota réservé
 *    avant la lecture du corps, le 429 (l.35-42) n'écrit rien ;
 *  - POST /api/controller/scan/incidents n'existe pas ;
 *  - middleware.ts:81 : isSharedControlApi ne couvre que /api/controller/scan exactement (le partenaire
 *    est refusé sur le sous-chemin, middleware.ts:200-207).
 *
 * Interprétations retenues (contrat muet) :
 *  - un appel accepté de la route de déclaration répond en 2xx ; plus de 20 incidents → 4xx sans écriture ;
 *  - un compte non autorisé en lecture reçoit zéro ligne (RLS) ou un refus de permission (42501),
 *    jamais une erreur « relation inexistante » ;
 *  - la suite règle SCAN_PER_SCANNER_10S à 2 dans son processus pour provoquer les 429.
 * La suite crée ses partenaires A et B, leurs événements, ses contrôleurs, un client et un admin.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { resetServerEnvCache } from '../../lib/env';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { anonClient, signedInClient } from '../helpers/realtime';
import { BASE_URL } from './helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, scan, type RouteResult } from './acces-helpers';

const INCIDENTS_ROUTE = '../../app/api/controller/scan/incidents/route';
const SCAN_ROUTE = '../../app/api/controller/scan/route';

let partner: TestPartner;
let partnerB: TestPartner;
let ev: SaleEvent;
let evB: SaleEvent;
let ctrlB: Buyer;
let client: Buyer;
let admin: Buyer;

before(async () => {
    partner = await newPartner('dette-incidents');
    partnerB = await newPartner('dette-incidents-b');
    ev = await createTimedEvent(partner.partnerId, 'dette-incidents', [{ name: 'Standard', price: 2000, total: 20 }], { startsInHours: 1, durationHours: 6 });
    evB = await createTimedEvent(partnerB.partnerId, 'dette-incidents-b', [{ name: 'Standard', price: 2000, total: 20 }], { startsInHours: 1, durationHours: 6 });
    ctrlB = await newController(partnerB, evB.eventId, { label: 'inc-b' });
    client = await newBuyer('inc-client');
    admin = await newBuyer('inc-admin', { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: admin.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
});

after(async () => {
    await assertLifecycleInvariants('dette-incidents');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest) => Promise<Response>;

async function invoke(handler: Handler, req: NextRequest): Promise<RouteResult> {
    const res = await handler(req);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body)}`;
}

async function withEnv<T>(overrides: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>();
    for (const [k, v] of Object.entries(overrides)) {
        saved.set(k, process.env[k]);
        process.env[k] = v;
    }
    resetServerEnvCache();
    try {
        return await fn();
    } finally {
        saved.forEach((v, k) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
        resetServerEnvCache();
    }
}

/** Les quotas sont comptés sur des fenêtres fixes : on évite de chevaucher deux fenêtres. */
async function alignWindow(windowSecs: number, neededMs: number): Promise<void> {
    const w = windowSecs * 1000;
    const left = w - (Date.now() % w);
    if (left < neededMs) await new Promise((resolve) => setTimeout(resolve, left + 300));
}

function unknownPayload(): Row {
    return { eventId: ev.eventId, payload: `EVT1:${randomUUID()}:000000` };
}

/** POST /api/controller/scan avec un corps brut (illisible en JSON). */
async function scanRaw(user: Buyer, raw: string): Promise<RouteResult> {
    const { POST } = await importModule(SCAN_ROUTE);
    return invoke(POST as Handler, new NextRequest(`${BASE_URL}/api/controller/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${user.accessToken}` },
        body: raw,
    }));
}

async function reportIncidents(user: Buyer, body: Row): Promise<RouteResult> {
    let mod: { POST?: Handler };
    try {
        mod = await importModule(INCIDENTS_ROUTE);
    } catch (err) {
        assert.fail(`POST /api/controller/scan/incidents absente (contrat C8) : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod.POST, 'function', 'POST /api/controller/scan/incidents : gestionnaire POST exporté');
    return invoke(mod.POST!, authed('/api/controller/scan/incidents', 'POST', user, body));
}

async function incidentsOf(scannerId: string): Promise<Row[]> {
    const { data, error } = await service.from('scan_incidents').select('*').eq('scanner_id', scannerId).order('created_at');
    assert.equal(error, null, `scan_incidents du scanneur ${scannerId} : ${error?.message} (code ${error?.code})`);
    return (data ?? []) as Row[];
}

async function ticketScanCount(scannerId: string): Promise<number> {
    const { count, error } = await service.from('ticket_scans').select('id', { count: 'exact', head: true }).eq('scanner_id', scannerId);
    assert.equal(error, null, `ticket_scans du scanneur ${scannerId} : ${error?.message}`);
    return count ?? 0;
}

function deviceIncidents(kinds: string[]): Array<{ kind: string; at: string }> {
    return kinds.map((kind, i) => ({ kind, at: new Date(Date.now() - (i + 1) * 1000).toISOString() }));
}

/** Lecture REST de scan_incidents de l'événement par un compte (clé anon + session). */
async function visibleIncidents(c: SupabaseClient, eventId: string): Promise<{ rows: Row[]; error: { code?: string; message: string } | null }> {
    const { data, error } = await c.from('scan_incidents').select('id, scanner_id, event_id, kind, source').eq('event_id', eventId);
    return { rows: (data ?? []) as Row[], error };
}

/** Compte non autorisé : zéro ligne, ou refus de permission (jamais « relation inexistante »). */
function assertNothingVisible(res: { rows: Row[]; error: { code?: string; message: string } | null }, label: string): void {
    if (res.error) {
        assert.ok(res.error.code === '42501' || /permission denied/i.test(res.error.message),
            `${label} : refus de permission ou zéro ligne attendus, reçu ${res.error.code} ${res.error.message}`);
        return;
    }
    assert.deepEqual(res.rows, [], `${label} : incidents d’un événement qui n’est pas le sien lisibles`);
}

// ── Serveur : 429 du scan ──────────────────────────────────────────────────

describe('C8 — incidents écrits par le serveur', () => {
    test('429 du scan : une ligne scan_incidents RATE_LIMITED (source SERVER, event_id) par refus ; corps illisible → event_id NULL ; ticket_scans inchangé', async () => {
        const LIMIT = 2;
        await withEnv({ SCAN_PER_SCANNER_10S: String(LIMIT) }, async () => {
            const scanner = await newController(partner, ev.eventId, { label: 'inc-rafale' });
            await importModule(SCAN_ROUTE);
            await alignWindow(10, 7000);
            for (let i = 0; i < LIMIT; i += 1) {
                const r = await scan(scanner, unknownPayload());
                assert.notEqual(r.status, 429, `scan ${i + 1} sous la limite : ${show(r)}`);
            }
            const scansBefore = await ticketScanCount(scanner.userId);
            const limited = [await scan(scanner, unknownPayload()), await scan(scanner, unknownPayload())];
            for (const r of limited) {
                assert.equal(r.status, 429, `scan au-delà de la limite : ${show(r)}`);
                assert.equal(r.body.result, 'rate_limited', `corps du refus : ${show(r)}`);
            }
            const unreadable = await scanRaw(scanner, 'pas du json');
            assert.equal(unreadable.status, 429, `corps illisible au-delà de la limite : ${show(unreadable)}`);

            assert.equal(await ticketScanCount(scanner.userId), scansBefore, 'ticket_scans non touché par les refus 429');
            const rows = await incidentsOf(scanner.userId);
            assert.equal(rows.length, 3, `trois incidents RATE_LIMITED (trouvé ${rows.length}) : ${JSON.stringify(rows)}`);
            for (const r of rows) {
                assert.equal(r.kind, 'RATE_LIMITED', `type RATE_LIMITED : ${JSON.stringify(r)}`);
                assert.equal(r.source, 'SERVER', `source SERVER : ${JSON.stringify(r)}`);
            }
            assert.equal(rows.filter((r) => r.event_id === ev.eventId).length, 2, `event_id lu dans le corps avant le quota : ${JSON.stringify(rows)}`);
            assert.equal(rows.filter((r) => r.event_id === null).length, 1, `event_id NULL pour le corps illisible : ${JSON.stringify(rows)}`);
        });
    });
});

// ── Appareil : route de déclaration ────────────────────────────────────────

describe('C8 — incidents déclarés par l’appareil', () => {
    test('contrôleur affecté : NETWORK et TIMEOUT enregistrés (source DEVICE, event_id) ; ticket_scans inchangé', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'inc-appareil' });
        const scansBefore = await ticketScanCount(ctrl.userId);
        const res = await reportIncidents(ctrl, { eventId: ev.eventId, incidents: deviceIncidents(['NETWORK', 'TIMEOUT']) });
        assert.ok(res.status >= 200 && res.status < 300, `déclaration d’incidents par le contrôleur affecté : ${show(res)}`);
        const rows = await incidentsOf(ctrl.userId);
        assert.deepEqual(rows.map((r) => r.kind).sort(), ['NETWORK', 'TIMEOUT'], `incidents enregistrés : ${JSON.stringify(rows)}`);
        for (const r of rows) {
            assert.equal(r.source, 'DEVICE', `source DEVICE : ${JSON.stringify(r)}`);
            assert.equal(r.event_id, ev.eventId, `event_id de l’événement déclaré : ${JSON.stringify(r)}`);
        }
        assert.equal(await ticketScanCount(ctrl.userId), scansBefore, 'ticket_scans non touché');
    });

    test('scanneur non autorisé sur l’événement (contrôleur de B) → 204, incident ignoré', async () => {
        const res = await reportIncidents(ctrlB, { eventId: ev.eventId, incidents: deviceIncidents(['NETWORK']) });
        assert.equal(res.status, 204, `scanneur non autorisé : ${show(res)}`);
        assert.deepEqual((await incidentsOf(ctrlB.userId)).filter((r) => r.event_id === ev.eventId), [], 'aucun incident écrit sur l’événement d’autrui');
    });

    test('plus de 20 incidents dans un appel → refus 4xx, aucune ligne écrite', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'inc-lot' });
        const res = await reportIncidents(ctrl, { eventId: ev.eventId, incidents: deviceIncidents(Array.from({ length: 21 }, () => 'NETWORK')) });
        assert.ok(res.status >= 400 && res.status < 500, `21 incidents dans un appel : ${show(res)}`);
        assert.deepEqual(await incidentsOf(ctrl.userId), [], 'aucun incident écrit');
    });

    test('middleware : le partenaire propriétaire passe sur /api/controller/scan/incidents (voie de contrôle partagée)', async () => {
        const cookies = await sessionCookies(await signedInClient({ email: partner.email }));
        const res = await callMiddleware('/api/controller/scan/incidents', cookies);
        assert.equal(res.passedThrough, true, `middleware → HTTP ${res.status} ${res.location ?? ''} (refusé)`);
    });
});

// ── Lecture ────────────────────────────────────────────────────────────────

describe('C8 — lecture de scan_incidents', () => {
    test('partenaire propriétaire et admin lisent les incidents de l’événement ; partenaire B, client et anon ne lisent rien', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'inc-lecture' });
        const res = await reportIncidents(ctrl, { eventId: ev.eventId, incidents: deviceIncidents(['TIMEOUT']) });
        assert.ok(res.status >= 200 && res.status < 300, `déclaration de préparation : ${show(res)}`);
        const own = (await incidentsOf(ctrl.userId)).map((r) => String(r.id));
        assert.equal(own.length, 1, 'précondition : un incident en base');

        const owner = await visibleIncidents(await signedInClient({ email: partner.email }), ev.eventId);
        assert.equal(owner.error, null, `lecture par le partenaire propriétaire : ${owner.error?.code} ${owner.error?.message}`);
        assert.ok(owner.rows.some((r) => r.id === own[0]), 'le partenaire propriétaire lit l’incident de son événement');

        const byAdmin = await visibleIncidents(await signedInClient({ email: admin.email }), ev.eventId);
        assert.equal(byAdmin.error, null, `lecture par l’admin : ${byAdmin.error?.code} ${byAdmin.error?.message}`);
        assert.ok(byAdmin.rows.some((r) => r.id === own[0]), 'l’admin lit l’incident');

        assertNothingVisible(await visibleIncidents(await signedInClient({ email: partnerB.email }), ev.eventId), 'partenaire B');
        assertNothingVisible(await visibleIncidents(await signedInClient({ email: client.email }), ev.eventId), 'client');
        assertNothingVisible(await visibleIncidents(anonClient(), ev.eventId), 'anon');
    });
});
