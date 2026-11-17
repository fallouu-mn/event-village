/**
 * Finition 3b, point 4 (E-36) — création d'un administrateur et ses droits.
 *
 *  - Profils prêts « Validation », « Support client », « Finance », « Lecture seule » (lib/admin/permission-profiles.ts) ;
 *    chacun contient la lecture de chacun de ses droits d'écriture (dépendances incluses).
 *  - POST /api/admin/permissions ajoute d'office la lecture d'un droit d'écriture (users.write → users.read,
 *    partners.validate et partners.suspend → partners.read, events.write → events.read, notifications.write →
 *    notifications.read) : la base ne garde jamais une écriture sans sa lecture.
 *  - Créer un ADMIN : la réponse dit que le titulaire reçoit par SMS un lien d'activation valable 24 heures et qu'il n'a
 *    aucun droit tant qu'on ne lui en donne pas ; elle rend son identifiant (l'écran enchaîne sur ses droits) ; aucun droit
 *    n'est créé avec le compte.
 *  - Retraits vérifiés avant de retirer (rapport) : « Tarification » (/admin/pricing, /api/admin/pricing : les trois clés
 *    écrites n'étaient relues par rien) et pricing.manage ; shifts.read (seule route : /api/admin/shifts/audit, appelée
 *    par aucun écran). Plus de route, plus de page, plus de droit attribuable, plus aucune ligne en base.
 * Rouge avant la finition. Fin de suite : assertFinition3bInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertFinition3bInvariants } from '../helpers/finition3b-invariants';
import { jsonRequest } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { confirmIdentity } from './f3d-helpers';
import { importModule } from './paiement-helpers';
import { randomSenegalPhone } from './helpers';

type Handler = (req: NextRequest) => Promise<Response>;
type Profiles = Array<{ key: string; label: string; permissions: string[] }>;

let superadmin: TestAdmin;
let target: TestAdmin;

before(async () => {
    superadmin = await newAdmin('f3b-droits-super', [], { role: 'SUPERADMIN' });
    // Contre-vérification de la finition 3d (T4 ; modification signalée au rapport) : créer un ADMIN et enregistrer ses droits
    // exigent le mot de passe et le code administrateur de moins de 10 minutes.
    await confirmIdentity(superadmin);
    target = await newAdmin('f3b-droits-cible', []);
});

after(async () => {
    await assertFinition3bInvariants('f3b-droits');
});

const DEPENDENCIES: Record<string, string> = {
    'users.write': 'users.read',
    'partners.validate': 'partners.read',
    'partners.suspend': 'partners.read',
    'events.write': 'events.read',
    'notifications.write': 'notifications.read',
};

describe('profils prêts et dépendances', () => {
    test('quatre profils, chacun avec la lecture de chacun de ses droits d’écriture', async () => {
        const mod = (await importModule('../../lib/admin/permission-profiles')) as {
            PERMISSION_PROFILES: Profiles; withDependencies: (p: string[]) => string[];
        };
        assert.deepEqual(mod.PERMISSION_PROFILES.map((p) => p.label), ['Validation', 'Support client', 'Finance', 'Lecture seule']);
        for (const p of mod.PERMISSION_PROFILES) {
            for (const perm of p.permissions) {
                const read = DEPENDENCIES[perm];
                if (read) assert.ok(p.permissions.includes(read), `profil ${p.label} : ${perm} sans ${read}`);
            }
            assert.ok(!p.permissions.includes('pricing.manage') && !p.permissions.includes('shifts.read'), `profil ${p.label} : droit retiré`);
        }
        assert.deepEqual(mod.withDependencies(['events.write']).sort(), ['events.read', 'events.write']);
        assert.deepEqual(mod.withDependencies(['partners.suspend', 'notifications.write']).sort(),
            ['notifications.read', 'notifications.write', 'partners.read', 'partners.suspend']);
    });

    test('POST /api/admin/permissions : la lecture d’un droit d’écriture est ajoutée d’office, un droit retiré est ignoré', async () => {
        const { POST } = (await importModule('../../app/api/admin/permissions/route')) as { POST: Handler };
        const res = await POST(jsonRequest('/api/admin/permissions', 'POST', superadmin.accessToken, {
            adminId: target.userId,
            permissions: ['users.write', 'partners.validate', 'events.write', 'notifications.write', 'pricing.manage', 'shifts.read'],
        }));
        const body = (await res.json()) as Record<string, unknown>;
        assert.equal(res.status, 200, JSON.stringify(body));
        const stored = await inspect(async (c) => (await c.query<{ permission: string }>(
            'SELECT permission FROM public.admin_permissions WHERE user_id = $1 ORDER BY permission', [target.userId])).rows.map((r) => r.permission));
        assert.deepEqual(stored, ['events.read', 'events.write', 'notifications.read', 'notifications.write', 'partners.read',
            'partners.validate', 'users.read', 'users.write']);
    });
});

describe('créer un administrateur', () => {
    test('la réponse dit le lien d’activation de 24 heures et l’absence de droits ; aucun droit créé avec le compte', async () => {
        const { POST } = (await importModule('../../app/api/admin/users/route')) as { POST: Handler };
        const res = await POST(jsonRequest('/api/admin/users', 'POST', superadmin.accessToken, {
            firstName: 'Awa', lastName: 'Nouvelle', phone: randomSenegalPhone('77'), role: 'ADMIN',
        }));
        const body = (await res.json()) as { userId?: string; message?: string; activation?: string };
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.ok(body.userId, 'identifiant du compte absent : l’écran ne peut pas enchaîner sur ses droits');
        assert.match(String(body.message), /valable 24 heures/, String(body.message));
        assert.match(String(body.message), /aucun droit/, String(body.message));
        const perms = await inspect(async (c) => (await c.query<{ n: string }>(
            'SELECT count(*) AS n FROM public.admin_permissions WHERE user_id = $1', [body.userId])).rows[0].n);
        assert.equal(Number(perms), 0);
    });
});

describe('« Tarification », pricing.manage et shifts.read retirés', () => {
    test('plus de page, plus de route, plus de droit attribuable', async () => {
        for (const rel of ['app/admin/pricing/page.tsx', 'app/api/admin/pricing/route.ts', 'app/api/admin/shifts/audit/route.ts']) {
            assert.ok(!fs.existsSync(path.join(process.cwd(), rel)), `${rel} existe encore`);
        }
        const { ADMIN_PERMISSIONS } = (await importModule('../../lib/admin/permissions')) as { ADMIN_PERMISSIONS: readonly string[] };
        assert.ok(!ADMIN_PERMISSIONS.includes('pricing.manage'), 'pricing.manage encore attribuable');
        assert.ok(!ADMIN_PERMISSIONS.includes('shifts.read'), 'shifts.read encore attribuable');
    });

    test('plus aucune ligne pricing.manage ni shifts.read en base (migration 20261118000003)', async () => {
        const left = await inspect(async (c) => (await c.query<{ n: string }>(
            `SELECT count(*) AS n FROM public.admin_permissions WHERE permission IN ('pricing.manage', 'shifts.read')`)).rows[0].n);
        assert.equal(Number(left), 0);
    });
});
