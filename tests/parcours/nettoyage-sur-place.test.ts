/**
 * Lot 9, tâche 9.4 — A16 : retrait du code « à régler sur place ». Aucun émetteur en production (tickets.order_id n'est
 * posé que par les fixtures), décision du client : pas de billets à régler sur place. Contrat, section 5.5, L44, L45.
 *  1. billet payant, commande impayée, sans paiement : le scan caméra répond payment_required (filet existant), billet VALIDE,
 *     aucune ligne cash_required, caisse ouverte non créditée ;
 *  2. même billet en saisie manuelle (POST /api/controller/scan/lookup) : preview payment_required, sans ligne de scan ;
 *  3. app/api/controller/scan/route n'exporte plus PUT (POST reste) ;
 *  4. la fonction ticket_cash_checkin n'existe plus (pg_proc) ;
 *  5. lib/scan/scan-result sans cash_required ni catégorie a_encaisser, vibrationPattern('a_encaisser') = null ;
 *  6. plus aucune mention du parcours dans app/, components/, lib/, hooks/, ni de CASH_COLLECT_PER_SCANNER_MIN et des
 *     jetons scan-cash dans leurs fichiers ;
 *  7. garde-fou : une vente au guichet crédite toujours la caisse (ce qui reste, L45).
 * Rouge avant correctif : le scan répond cash_required (M/20261106000005_lot8_scan.sql:196-199), ticket_manual_lookup
 * prévoit cash_required (M/20261105000005_lot7_scan.sql:515-516), PUT exporté, RPC présente, types et mentions présents.
 * Le cas 7 est vert dès l'écriture (rien ne change sur le guichet) : son garde-fou est le montant exact lu en base.
 * Fin de suite : assertLot9Invariants (rouge tant que M2 et M4 ne sont pas livrés).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { vibrationPattern } from '../../lib/hardware/feedback';
import { SCAN_RESULTS, SCAN_RESULT_CATEGORY, SCAN_RESULT_LABELS, isScanResult } from '../../lib/scan/scan-result';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import {
    authed, createCashOrderTickets, createTimedEvent, newController, openShift, scan, scansOf, shiftRow, ticketPayload, ticketRow,
    withAccessSettings, type RouteResult,
} from './acces-helpers';

const ROOT = process.cwd();
const PRICE = 5000;
const STANDARD = 'Standard';

type Handler = (req: NextRequest) => Promise<Response>;

let partner: TestPartner;
let ev: SaleEvent;
let buyer: Buyer;

before(async () => {
    partner = await newPartner('nettoyage-sur-place');
    ev = await createTimedEvent(partner.partnerId, 'nettoyage-sur-place', [{ name: STANDARD, price: PRICE, total: 40 }], { startsInHours: 1, durationHours: 6 });
    buyer = await newBuyer('nettoyage-acheteur');
});

after(async () => {
    await assertLot9Invariants('nettoyage-sur-place');
});

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

/** Caisse OUVERT d'un contrôleur autorisé aux espèces, ouverte par la route ; renvoie son identifiant. */
async function openedShift(seller: Buyer): Promise<string> {
    const opened = await openShift(seller, ev.eventId);
    assert.equal(opened.status, 200, `ouverture de caisse : ${show(opened)}`);
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', seller.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'une caisse OUVERT');
    return String(data![0].id);
}

async function postRoute(modulePath: string, user: Buyer, url: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<RouteResult> {
    const mod = await importModule(modulePath);
    const res = await (mod.POST as Handler)(authed(url, 'POST', user, body, headers));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

function walk(dir: string, out: string[] = []): string[] {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return out;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel, out);
        else if (/\.(?:ts|tsx|css)$/.test(entry.name)) out.push(rel);
    }
    return out;
}

function mentions(files: string[], pattern: RegExp): string[] {
    const found: string[] = [];
    for (const file of files) {
        fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).forEach((line, i) => {
            if (pattern.test(line)) found.push(`${file}:${i + 1} ${line.trim()}`);
        });
    }
    return found;
}

describe('A16 — billet payant impayé : le filet payment_required', () => {
    test('scan caméra : payment_required, billet VALIDE sans paiement, aucune ligne cash_required, caisse ouverte non créditée', async () => {
        const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'net-camera' });
        const shiftId = await openedShift(ctrl);
        const order = await createCashOrderTickets(buyer, partner, ev, STANDARD, 1);
        const ticketId = order.ticketIds[0];

        const r = await scan(ctrl, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'payment_required', `billet payant sans paiement : payment_required attendu, ${show(r)}`);
        assert.equal(r.body.amount_due, undefined, `aucun montant à encaisser annoncé : ${show(r)}`);

        const rows = await scansOf(ticketId);
        assert.deepEqual(rows.map((s) => s.result), ['payment_required'], `une seule ligne, payment_required : ${JSON.stringify(rows.map((s) => s.result))}`);
        assert.equal(rows[0].accepted, false, 'ligne non acceptée');
        const t = await ticketRow(ticketId);
        assert.equal(t.status, 'VALIDE', 'billet non composté');
        assert.equal(t.payment_id ?? null, null, 'aucun paiement rattaché');
        assert.equal(Number((await shiftRow(shiftId)).expected_cash_total), 0, 'caisse non créditée');
    });

    test('saisie manuelle : preview payment_required, aucune ligne de scan, billet VALIDE', async () => {
        await withAccessSettings({ 'access.manual_entry_scope': 'ASSIGNED_CONTROLLER' }, async () => {
            const ctrl = await newController(partner, ev.eventId, { label: 'net-manuel' });
            const order = await createCashOrderTickets(buyer, partner, ev, STANDARD, 1);
            const ticketId = order.ticketIds[0];
            const number = String((await ticketRow(ticketId)).ticket_number);
            const r = await postRoute('../../app/api/controller/scan/lookup/route', ctrl, '/api/controller/scan/lookup', { eventId: ev.eventId, manualTicketNumber: number });
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.found, true, show(r));
            const ticket = r.body.ticket as Record<string, unknown> | undefined;
            assert.equal(ticket?.preview, 'payment_required', `résultat prévu : ${show(r)}`);
            assert.deepEqual(await scansOf(ticketId), [], 'vérification : aucune ligne ticket_scans');
            assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'vérification : billet non composté');
        });
    });
});

describe('A16 — voie d’encaissement retirée', () => {
    test('app/api/controller/scan/route : PUT n’est plus exporté, POST reste', async () => {
        const mod = await importModule('../../app/api/controller/scan/route');
        assert.equal(mod.PUT, undefined, 'PUT /api/controller/scan encore exporté (encaissement au scan)');
        assert.equal(typeof mod.POST, 'function', 'POST /api/controller/scan reste exporté');
    });

    test('la fonction public.ticket_cash_checkin n’existe plus', async () => {
        const rows = await inspect(async (db) => (await db.query<{ signature: string }>(
            `SELECT p.oid::regprocedure::text AS signature
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'ticket_cash_checkin'`)).rows);
        assert.deepEqual(rows, [], `fonction encore présente : ${JSON.stringify(rows)}`);
    });

    test('lib/scan/scan-result : ni cash_required ni a_encaisser ; vibration a_encaisser sans motif', () => {
        const results: readonly string[] = SCAN_RESULTS;
        const labels: Record<string, string> = SCAN_RESULT_LABELS;
        const categories: Record<string, string> = SCAN_RESULT_CATEGORY;
        assert.equal(results.includes('cash_required'), false, 'SCAN_RESULTS contient encore cash_required');
        assert.equal(isScanResult('cash_required'), false, 'isScanResult accepte encore cash_required');
        assert.equal(labels.cash_required, undefined, 'SCAN_RESULT_LABELS.cash_required encore présent');
        assert.equal(categories.cash_required, undefined, 'SCAN_RESULT_CATEGORY.cash_required encore présent');
        assert.deepEqual(Object.values(categories).filter((c) => c === 'a_encaisser'), [], 'catégorie a_encaisser encore utilisée');
        assert.equal(vibrationPattern('a_encaisser'), null, 'vibrationPattern(a_encaisser) : motif encore défini');
    });
});

describe('A16 — plus aucune mention du parcours', () => {
    test('app, components, lib, hooks : ni cash_required, ni a_encaisser, ni confirmCashCheckin, ni ticket_cash_checkin', () => {
        const files = ['app', 'components', 'lib', 'hooks'].flatMap((d) => walk(d));
        assert.ok(files.length > 100, `parcours des sources (${files.length} fichiers) : racine incorrecte`);
        const found = mentions(files, /\bcash_required\b|\ba_encaisser\b|\bconfirmCashCheckin\b|\bticket_cash_checkin\b/);
        assert.deepEqual(found, [], `mentions restantes :\n${found.join('\n')}`);
    });

    test('variable CASH_COLLECT_PER_SCANNER_MIN retirée de lib/env.ts, .env.example et .env.test.example', () => {
        const found = mentions(['lib/env.ts', '.env.example', '.env.test.example'], /CASH_COLLECT_PER_SCANNER_MIN/);
        assert.deepEqual(found, [], `variable encore présente :\n${found.join('\n')}`);
    });

    test('jetons scan-cash retirés de app/globals.css, tailwind.config.ts et MASTER.md', () => {
        const found = mentions(['app/globals.css', 'tailwind.config.ts', 'design-system/event-village/MASTER.md'], /scan-cash/);
        assert.deepEqual(found, [], `jetons encore présents :\n${found.join('\n')}`);
    });
});

describe('A16 — ce qui reste : la vente au guichet', () => {
    test('garde-fou : une vente au guichet crédite la caisse du prix du billet, billet UTILISE, paiement espèces hors plateforme', async () => {
        const seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'net-guichet' });
        const shiftId = await openedShift(seller);
        const before_ = Number((await shiftRow(shiftId)).expected_cash_total);
        await withAccessSettings({ 'access.counter_sale_enabled': true }, async () => {
            const r = await postRoute('../../app/api/controller/counter-sale/route', seller, '/api/controller/counter-sale',
                { eventId: ev.eventId, items: [{ categoryId: ev.categories[STANDARD].id, quantity: 1 }] }, { 'idempotency-key': randomUUID() });
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.ok, true, show(r));
            const ticketIds = (r.body.ticket_ids as unknown[]).map(String);
            assert.equal(ticketIds.length, 1, `un billet vendu : ${show(r)}`);
            const t = await ticketRow(ticketIds[0]);
            assert.equal(t.status, 'UTILISE', 'billet vendu au guichet composté');
            assert.equal(t.sale_channel, 'COUNTER', 'canal COUNTER');
            const { data, error } = await service.from('payments').select('amount, is_platform_payment, offline_payment_method, status, shift_id').eq('id', String(r.body.payment_id)).single();
            assert.equal(error, null, `paiement : ${error?.message}`);
            assert.equal(data.is_platform_payment, false, 'paiement hors plateforme');
            assert.equal(data.offline_payment_method, 'ESPECES', 'espèces');
            assert.equal(data.status, 'SUCCESS', 'paiement SUCCESS');
            assert.equal(data.shift_id, shiftId, 'paiement rattaché à la caisse');
            assert.equal(Number(data.amount), PRICE, 'montant au prix du billet');
        });
        assert.equal(Number((await shiftRow(shiftId)).expected_cash_total), before_ + PRICE, 'caisse créditée du prix du billet');
    });
});
