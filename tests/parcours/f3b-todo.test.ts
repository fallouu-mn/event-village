/**
 * Finition 3b, point 1 (E-29) — « À faire aujourd'hui », lu par une seule route serveur (GET /api/admin/todo).
 *
 *  - Une ligne n'apparaît que si l'administrateur a le droit d'AGIR dessus (lib/admin/todo.ts : TODO_LINES) :
 *    versements à reprendre (refunds.manage), événements à valider, suspendus et écarts de caisse (events.write),
 *    candidatures (partners.validate), envois en échec (notifications.write), plafond des SMS (notifications.read),
 *    créances (payments.read). Le SUPERADMIN voit tout. Sans aucun de ces droits : aucune ligne, aucune lecture.
 *  - Chaque compteur est égal au recalcul indépendant de l'invariant (h1), dans le même instantané.
 *  - Cas construit : une fiche EN_ATTENTE au dossier complété après un refus compte dans « candidatures » et dans
 *    « dont complétés » ; repassée VALIDE, elle n'y compte plus.
 *  - Le compteur des candidatures de l'accueil ne dépend plus de statistics.read : GET /api/admin/partners (partners.read)
 *    rend le nombre par statut.
 * Rouge avant la finition (route, module et fonction absents). Fin de suite : assertFinition3bInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { ALL_TODO_LINES, FINITION3B_TODO_ORACLE_SQL, assertFinition3bInvariants } from '../helpers/finition3b-invariants';
import { jsonRequest, newPartner } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { importModule, service } from './paiement-helpers';

type Handler = (req: NextRequest) => Promise<Response>;
type Line = { key: string; count?: number; unavailable?: boolean; [k: string]: unknown };
type TodoReply = { lines: Line[]; upToDate: string[]; allowed: string[]; partial: boolean; computedAt?: string };

const ROUTE = '../../app/api/admin/todo/route';

let nobody: TestAdmin;
let reader: TestAdmin;
let moderator: TestAdmin;
let validator: TestAdmin;
let superadmin: TestAdmin;
let partnersOnly: TestAdmin;

before(async () => {
    nobody = await newAdmin('f3b-todo-aucun', []);
    reader = await newAdmin('f3b-todo-lecteur', ['events.read', 'partners.read', 'statistics.read', 'notifications.read']);
    moderator = await newAdmin('f3b-todo-moderation', ['events.read', 'events.write']);
    validator = await newAdmin('f3b-todo-candidatures', ['partners.read', 'partners.validate']);
    superadmin = await newAdmin('f3b-todo-super', [], { role: 'SUPERADMIN' });
    partnersOnly = await newAdmin('f3b-todo-fiches', ['partners.read']);
});

after(async () => {
    await assertFinition3bInvariants('f3b-todo');
});

async function todo(admin: TestAdmin): Promise<TodoReply> {
    const { GET } = (await importModule(ROUTE)) as { GET: Handler };
    const res = await GET(jsonRequest('/api/admin/todo', 'GET', admin.accessToken));
    const body = (await res.json()) as TodoReply;
    assert.equal(res.status, 200, `GET /api/admin/todo : HTTP ${res.status} ${JSON.stringify(body)}`);
    return body;
}

describe('GET /api/admin/todo — une ligne seulement pour qui peut agir', () => {
    test('le module décrit les huit lignes et le droit d’agir de chacune', async () => {
        const mod = (await importModule('../../lib/admin/todo')) as { TODO_LINES: Array<{ key: string; permission: string }> };
        assert.deepEqual(mod.TODO_LINES.map((l) => [l.key, l.permission]), [
            ['to_resume', 'refunds.manage'],
            ['events_to_validate', 'events.write'],
            ['partners_to_validate', 'partners.validate'],
            ['events_suspended', 'events.write'],
            ['cash_discrepancies', 'events.write'],
            ['failed_sends', 'notifications.write'],
            ['sms_cap', 'notifications.read'],
            ['debts', 'payments.read'],
        ]);
        assert.deepEqual(mod.TODO_LINES.map((l) => l.key), [...ALL_TODO_LINES]);
    });

    test('sans aucun droit d’agir : aucune ligne, aucune ligne « à jour »', async () => {
        const r = await todo(nobody);
        assert.deepEqual([r.lines, r.upToDate, r.allowed, r.partial], [[], [], [], true]);
    });

    test('lecture seule (events.read, partners.read…) : aucune ligne d’action, sauf le plafond des SMS (notifications.read)', async () => {
        const r = await todo(reader);
        assert.deepEqual(r.allowed, ['sms_cap']);
        for (const l of r.lines) assert.equal(l.key, 'sms_cap', `ligne montrée sans le droit d’agir : ${JSON.stringify(l)}`);
    });

    test('events.write : événements à valider, suspendus et écarts de caisse, rien d’autre', async () => {
        const r = await todo(moderator);
        assert.deepEqual(r.allowed, ['events_to_validate', 'events_suspended', 'cash_discrepancies']);
        assert.equal(r.partial, true);
        for (const k of [...r.lines.map((l) => l.key), ...r.upToDate]) assert.ok(r.allowed.includes(k), `ligne hors droits : ${k}`);
    });

    test('SUPERADMIN : les huit lignes, chaque compteur égal au recalcul indépendant', async () => {
        const r = await todo(superadmin);
        assert.deepEqual(r.allowed, [...ALL_TODO_LINES]);
        assert.equal(r.partial, false);
        const shown = new Set([...r.lines.map((l) => l.key), ...r.upToDate]);
        assert.deepEqual([...shown].sort(), [...ALL_TODO_LINES].sort(), 'chaque ligne est montrée ou « à jour »');
        for (const l of r.lines) {
            assert.notEqual(l.unavailable, true, `ligne indisponible : ${JSON.stringify(l)}`);
            if (l.key !== 'sms_cap') assert.ok(Number(l.count) > 0, `ligne à 0 montrée hors « à jour » : ${JSON.stringify(l)}`);
        }
        const violations = await inspect(async (c) => (await c.query(FINITION3B_TODO_ORACLE_SQL, [ALL_TODO_LINES])).rows);
        assert.deepEqual(violations, [], `compteurs ≠ recalcul : ${JSON.stringify(violations)}`);
    });
});

describe('cas construit : une candidature complétée après un refus', () => {
    test('comptée dans « candidatures » et « dont complétées » ; validée, elle sort de la ligne', async () => {
        const before = await todo(validator);
        const count0 = Number(before.lines.find((l) => l.key === 'partners_to_validate')?.count ?? 0);
        const resub0 = Number(before.lines.find((l) => l.key === 'partners_to_validate')?.resubmitted ?? 0);
        const p = await newPartner('f3b-todo-dossier');
        const { error } = await service.from('partners').update({ status: 'EN_ATTENTE', is_verified: false, resubmitted_at: new Date().toISOString() }).eq('id', p.partnerId);
        assert.equal(error, null, error?.message);
        try {
            const mid = await todo(validator);
            const line = mid.lines.find((l) => l.key === 'partners_to_validate');
            assert.ok(line, `ligne absente : ${JSON.stringify(mid)}`);
            assert.equal(Number(line.count), count0 + 1, 'une candidature de plus');
            assert.equal(Number(line.resubmitted), resub0 + 1, 'un dossier complété de plus');
        } finally {
            const { error: back } = await service.from('partners').update({ status: 'VALIDE', is_verified: true }).eq('id', p.partnerId);
            assert.equal(back, null, back?.message);
        }
        const after = await todo(validator);
        assert.equal(Number(after.lines.find((l) => l.key === 'partners_to_validate')?.count ?? 0), count0);
    });
});

describe('compteur des candidatures sans statistics.read', () => {
    test('GET /api/admin/partners (partners.read seul) rend le nombre par statut', async () => {
        const { GET } = (await importModule('../../app/api/admin/partners/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/admin/partners?status=EN_ATTENTE', 'GET', partnersOnly.accessToken));
        const body = (await res.json()) as { counts?: Record<string, number> };
        assert.equal(res.status, 200, JSON.stringify(body));
        const counts = body.counts ?? {};
        const expected = await inspect(async (c) => (await c.query<Record<string, string>>(`
            SELECT count(*) FILTER (WHERE status::text = 'EN_ATTENTE') AS "EN_ATTENTE",
                   count(*) FILTER (WHERE status::text = 'VALIDE') AS "VALIDE",
                   count(*) FILTER (WHERE status::text = 'REJETE') AS "REJETE",
                   count(*) FILTER (WHERE status::text = 'SUSPENDU') AS "SUSPENDU",
                   count(*) AS "ALL" FROM public.partners`)).rows[0]);
        for (const k of ['EN_ATTENTE', 'VALIDE', 'REJETE', 'SUSPENDU', 'ALL']) {
            assert.equal(counts[k], Number(expected[k]), `nombre ${k} : ${JSON.stringify(counts)}`);
        }
    });
});
