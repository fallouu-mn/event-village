/**
 * Finition 3b (administration claire) — sécurité d'abord : « le menu n'est qu'un confort ».
 *
 * Inventaire de TOUTES les routes de `app/api/admin` (fichiers route.ts lus sur le disque, chaque méthode exportée) :
 * un ADMIN au compte actif, sans aucune permission, est refusé (401 ou 403) partout, avant toute lecture ou écriture.
 * Seules exceptions, ouvertes à tout administrateur par construction, et vérifiées sans fuite :
 *  - la double vérification de l'administrateur (`step-up`, `step-up/sms`) ;
 *  - GET `permissions` (ses propres droits, ou la liste des droits attribuables) ; un autre admin : 403 ;
 *  - GET `finance/waiting` et GET `todo` : 200, mais aucune ligne visible sans le droit de la ligne.
 * Une route ajoutée plus tard entre d'office dans l'inventaire. Le nombre de routes lues est affiché.
 *
 * Garde-fou vert dès l'écriture si aucune faille n'existe (signalé au rapport) ; une route qui répond 2xx, 400 ou 500 à
 * un ADMIN sans droit est une faille (ou un contrôle fait après la lecture du corps) : elle est nommée.
 * Fin de suite : assertFinition3aInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertFinition3aInvariants } from '../helpers/finition3a-invariants';
import { jsonRequest } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { importModule } from './paiement-helpers';

type Handler = (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const ADMIN_API = path.join(process.cwd(), 'app', 'api', 'admin');

/** Routes ouvertes à tout administrateur (chemin relatif à app/api/admin, méthode). */
const OPEN = new Set(['step-up GET', 'step-up POST', 'step-up/sms POST', 'permissions GET', 'finance/waiting GET', 'todo GET']);

let nobody: TestAdmin;
let other: TestAdmin;

before(async () => {
    nobody = await newAdmin('f3b-sans-droit', []);
    other = await newAdmin('f3b-autre', ['events.read']);
});

after(async () => {
    await assertFinition3aInvariants('f3b-securite');
});

function routeFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...routeFiles(full));
        else if (entry.name === 'route.ts') out.push(full);
    }
    return out.sort();
}

/** « finance/waiting », « cashouts/[id]/resend »… */
function routeKey(file: string): string {
    return path.relative(ADMIN_API, path.dirname(file)).split(path.sep).join('/');
}

/** Adresse d'appel : chaque segment dynamique reçoit un identifiant neuf. */
function urlOf(key: string): { url: string; params: Record<string, string> } {
    const params: Record<string, string> = {};
    const url = key.split('/').map((seg) => {
        const m = /^\[(.+)\]$/.exec(seg);
        if (!m) return seg;
        params[m[1]] = randomUUID();
        return params[m[1]];
    }).join('/');
    return { url: `/api/admin/${url}`, params };
}

describe('inventaire : chaque route de /api/admin refuse un ADMIN sans aucun droit', () => {
    test('toutes les routes et méthodes : 401 ou 403, sauf les routes ouvertes à tout administrateur', async () => {
        const files = routeFiles(ADMIN_API);
        assert.ok(files.length >= 30, `inventaire trop court : ${files.length} routes lues sous ${ADMIN_API}`);
        const breaches: string[] = [];
        let calls = 0;
        for (const file of files) {
            const key = routeKey(file);
            const mod = (await importModule(`../../app/api/admin/${key}/route`)) as Partial<Record<typeof METHODS[number], Handler>>;
            for (const method of METHODS) {
                const handler = mod[method];
                if (typeof handler !== 'function' || OPEN.has(`${key} ${method}`)) continue;
                const { url, params } = urlOf(key);
                const body = method === 'GET' || method === 'DELETE' ? undefined : {};
                const res = await handler(jsonRequest(url, method, nobody.accessToken, body), { params: Promise.resolve(params) });
                calls++;
                if (res.status !== 401 && res.status !== 403) {
                    const text = (await res.text()).slice(0, 200);
                    breaches.push(`${method} /api/admin/${key} → HTTP ${res.status} ${text}`);
                }
            }
        }
        console.log(`[F3B-SECURITE] ${files.length} routes, ${calls} appels refusés attendus, ${breaches.length} écart(s)`);
        assert.deepEqual(breaches, [], `route ouverte à un ADMIN sans droit :\n${breaches.join('\n')}`);
    });

    test('routes ouvertes à tout administrateur : rien de visible sans le droit', async () => {
        const { GET: perms } = (await importModule('../../app/api/admin/permissions/route')) as { GET: Handler };
        const mine = await perms(jsonRequest(`/api/admin/permissions?adminId=${nobody.userId}`, 'GET', nobody.accessToken));
        assert.equal(mine.status, 200, `ses propres droits : HTTP ${mine.status}`);
        const theirs = await perms(jsonRequest(`/api/admin/permissions?adminId=${other.userId}`, 'GET', nobody.accessToken));
        assert.equal(theirs.status, 403, `droits d'un autre administrateur : HTTP ${theirs.status}`);

        const { GET: waiting } = (await importModule('../../app/api/admin/finance/waiting/route')) as { GET: Handler };
        const w = await waiting(jsonRequest('/api/admin/finance/waiting', 'GET', nobody.accessToken));
        const wb = (await w.json()) as { lines?: Record<string, { visible?: boolean }> };
        assert.equal(w.status, 200);
        assert.deepEqual(Object.entries(wb.lines ?? {}).filter(([, l]) => l.visible).map(([k]) => k), [], `argent qui attend visible sans droit : ${JSON.stringify(wb)}`);

        const todoFile = path.join(ADMIN_API, 'todo', 'route.ts');
        if (fs.existsSync(todoFile)) {
            const { GET: todo } = (await importModule('../../app/api/admin/todo/route')) as { GET: Handler };
            const t = await todo(jsonRequest('/api/admin/todo', 'GET', nobody.accessToken));
            const tb = (await t.json()) as { lines?: Array<{ key: string }> };
            assert.equal(t.status, 200);
            assert.deepEqual((tb.lines ?? []).map((l) => l.key), [], `« À faire aujourd'hui » visible sans droit : ${JSON.stringify(tb)}`);
        }
    });

    test('sans session : chaque route ouverte à tout administrateur refuse (401)', async () => {
        for (const key of ['permissions', 'finance/waiting']) {
            const { GET } = (await importModule(`../../app/api/admin/${key}/route`)) as { GET: Handler };
            const res = await GET(jsonRequest(`/api/admin/${key}`, 'GET', null));
            assert.equal(res.status, 401, `${key} sans session : HTTP ${res.status}`);
        }
    });
});
