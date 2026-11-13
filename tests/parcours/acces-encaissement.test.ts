/**
 * Lot 4, caisses du contrôle d'accès (CDC §11, §55, §76) : ouverture de caisse (contrôleur affecté avec can_accept_cash,
 * partenaire propriétaire ou admin, une seule caisse OUVERT par scanneur et événement, même en concurrence) et schéma
 * (index unique partiel des caisses ouvertes, controller_shifts.event_id, tickets.order_id et payments.shift_id en
 * ON DELETE RESTRICT, vérifiés dans le catalogue de la base locale).
 * Lot 9 (A16) : le parcours « à régler sur place » est retiré (aucun émetteur, décision du client) ; ses cas sont supprimés
 * avec la RPC et le PUT de la route. La vente au guichet (acces-guichet, dette-guichet) garde la caisse.
 * Routes et modules réécrits au lot 4 : importés dynamiquement (acces-helpers).
 * La suite crée son partenaire, ses événements (dans la fenêtre de scan), ses contrôleurs et son admin.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspect } from '../helpers/db';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, openShift, shiftRow, type RouteResult } from './acces-helpers';

const PRICE = 5000;

let partner: TestPartner;
let ev: SaleEvent;
let admin: Buyer;

before(async () => {
    partner = await newPartner('encaissement');
    ev = await createTimedEvent(partner.partnerId, 'encaissement', [
        { name: 'Standard', price: PRICE, total: 80 },
    ]);
    admin = await newAdmin('enc');
});

after(async () => {
    await assertAccessInvariants('acces-encaissement');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function newAdmin(label: string): Promise<Buyer> {
    const user = await newBuyer(`admin-${label}`, { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    // Lot 9 quater (B4 : AUD-15) : un ADMIN tient une caisse avec la permission access.operate (modification signalée)
    const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission: 'access.operate' }, { onConflict: 'user_id,permission' });
    assert.equal(pErr, null, `permission access.operate : ${pErr?.message}`);
    return user;
}

async function openShiftsOf(userId: string, eventId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('controller_shifts').select('*').eq('controller_id', userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses ouvertes : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

/** Caisse OUVERT du scanneur pour l'événement, ouverte par la route (contrat E) si elle n'existe pas. */
async function openCashShift(user: Buyer, eventId: string): Promise<string> {
    const existing = await openShiftsOf(user.userId, eventId);
    if (existing.length === 1) return existing[0].id as string;
    const res = await openShift(user, eventId);
    assert.equal(res.status, 200, `ouverture de caisse : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    const rows = await openShiftsOf(user.userId, eventId);
    assert.equal(rows.length, 1, `une caisse OUVERT pour ce scanneur et cet événement (trouvé : ${rows.length})`);
    return rows[0].id as string;
}

// ── Ouverture de caisse ───────────────────────────────────────────────────

describe('Ouverture de caisse', () => {
    test('ouverture de caisse : partenaire propriétaire et admin ouvrent leur caisse ; contrôleur sans permission espèces refusé', async () => {
        const ev3 = await createTimedEvent(partner.partnerId, 'enc-ouverture', [{ name: 'Standard', price: PRICE, total: 20 }]);
        const noCash = await newController(partner, ev3.eventId, { canAcceptCash: false, label: 'enc-sans-especes' });
        const refused = await openShift(noCash, ev3.eventId);
        assert.ok(refused.status >= 400 && refused.status < 500, `contrôleur sans permission espèces : ouverture refusée (HTTP ${refused.status} ${JSON.stringify(refused.body)})`);
        assert.equal((await openShiftsOf(noCash.userId, ev3.eventId)).length, 0, 'aucune caisse créée sans permission espèces');

        for (const [label, scanner] of [['partenaire propriétaire', partner], ['admin', admin]] as Array<[string, Buyer]>) {
            const shift = await shiftRow(await openCashShift(scanner, ev3.eventId));
            assert.equal(shift.status, 'OUVERT', `${label} : caisse OUVERT`);
            assert.equal(shift.controller_id, scanner.userId, `${label} : caisse à son nom`);
            assert.equal(shift.event_id, ev3.eventId, `${label} : caisse de cet événement`);
            assert.equal(Number(shift.expected_cash_total), 0, `${label} : caisse vide à l’ouverture`);
        }
    });

    test('ouvertures simultanées pour le même contrôleur et le même événement : une seule caisse OUVERT', async () => {
        const racer = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'enc-course' });
        const settled = await Promise.allSettled(Array.from({ length: 4 }, () => openShift(racer, ev.eventId)));
        const rejected = settled.filter((s) => s.status === 'rejected');
        assert.deepEqual(rejected, [], 'aucune exception non gérée');
        const results = settled.map((s) => (s as PromiseFulfilledResult<RouteResult>).value);
        assert.ok(results.every((r) => r.status < 500), `aucune erreur serveur : ${JSON.stringify(results.map((r) => [r.status, r.body]))}`);
        assert.ok(results.some((r) => r.status === 200), `au moins une ouverture acceptée : ${JSON.stringify(results.map((r) => [r.status, r.body]))}`);
        assert.equal((await openShiftsOf(racer.userId, ev.eventId)).length, 1, 'exactement une caisse OUVERT pour (contrôleur, événement)');
    });
});

// ── Contrôles statiques et schéma ──────────────────────────────────────────

const ROOT = process.cwd();

function offendingLines(file: string, patterns: Array<[RegExp, string]>): string[] {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) return [];
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    const out: string[] = [];
    lines.forEach((line, i) => {
        for (const [re, why] of patterns) if (re.test(line)) out.push(`${file}:${i + 1} (${why}) ${line.trim()}`);
    });
    return out;
}

describe('Contrôles statiques et schéma de la caisse', () => {
    test('ShiftService sans repli en mémoire ni erreur avalée', () => {
        const offenders = offendingLines('lib/shifts/shift.service.ts', [
            [/memoryShifts|_clearMemory/, 'registre de caisse en mémoire'],
            [/new Map\s*</, 'Map en mémoire'],
            [/catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/, 'erreur avalée'],
            [/console\.warn\([^)]*fallback/i, 'repli silencieux'],
        ]);
        assert.deepEqual(offenders, [], `replis mémoire ou erreurs avalées :\n${offenders.join('\n')}`);
    });

    test('schéma : index unique partiel des caisses OUVERT, ON DELETE RESTRICT sur controller_shifts.event_id, tickets.order_id et payments.shift_id', async () => {
        const { indexes, fks } = await inspect(async (db) => {
            const idx = await db.query<{ indexdef: string }>(
                `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'controller_shifts'`);
            const fk = await db.query<{ tbl: string; col: string; ref: string; deltype: string }>(
                `SELECT cl.relname AS tbl, a.attname AS col, rc.relname AS ref, c.confdeltype AS deltype
                   FROM pg_constraint c
                   JOIN pg_class cl ON cl.oid = c.conrelid
                   JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
                   JOIN pg_class rc ON rc.oid = c.confrelid
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
                  WHERE c.contype = 'f' AND cl.relname IN ('controller_shifts', 'tickets', 'payments')`);
            return { indexes: idx.rows.map((r) => r.indexdef), fks: fk.rows };
        });
        const uniqueOpen = indexes.filter((d) => {
            if (!/^CREATE UNIQUE INDEX/i.test(d) || !/WHERE/i.test(d) || !/OUVERT/.test(d)) return false;
            const cols = (d.match(/\(([^)]*)\)/)?.[1] ?? '').split(',').map((c) => c.trim()).sort();
            return cols.length === 2 && cols[0] === 'controller_id' && cols[1] === 'event_id';
        });
        assert.equal(uniqueOpen.length, 1, `index unique partiel (controller_id, event_id) WHERE status = 'OUVERT' attendu :\n${indexes.join('\n')}`);

        const fkOf = (tbl: string, col: string) => fks.find((f) => f.tbl === tbl && f.col === col);
        const shiftEvent = fkOf('controller_shifts', 'event_id');
        assert.equal(shiftEvent?.deltype, 'r', `controller_shifts.event_id : ON DELETE RESTRICT attendu (confdeltype ${shiftEvent?.deltype})`);
        const ticketOrder = fkOf('tickets', 'order_id');
        assert.equal(ticketOrder?.deltype, 'r', `tickets.order_id : ON DELETE RESTRICT attendu (confdeltype ${ticketOrder?.deltype})`);
        const paymentShift = fkOf('payments', 'shift_id');
        assert.ok(paymentShift, 'payments.shift_id : clé étrangère vers controller_shifts attendue');
        assert.equal(paymentShift.ref, 'controller_shifts', 'payments.shift_id référence controller_shifts');
        assert.equal(paymentShift.deltype, 'r', `payments.shift_id : ON DELETE RESTRICT attendu (confdeltype ${paymentShift.deltype})`);
    });

    test('RPC shift_open : SECURITY DEFINER, search_path = public, réservée au service_role', async () => {
        const rows = await inspect(async (db) => (await db.query<{ proname: string; secdef: boolean; config: string[] | null; anon: boolean; auth: boolean }>(
            `SELECT p.proname, p.prosecdef AS secdef, p.proconfig AS config,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'shift_open'`)).rows);
        for (const fn of ['shift_open']) {
            const r = rows.filter((x) => x.proname === fn);
            assert.ok(r.length > 0, `fonction ${fn} absente`);
            for (const x of r) {
                assert.equal(x.secdef, true, `${fn} : SECURITY DEFINER`);
                assert.ok((x.config ?? []).some((c) => /^search_path=public$/.test(c)), `${fn} : search_path = public (${JSON.stringify(x.config)})`);
                assert.equal(x.anon, false, `${fn} : non exécutable par anon`);
                assert.equal(x.auth, false, `${fn} : non exécutable par authenticated`);
            }
        }
    });
});
