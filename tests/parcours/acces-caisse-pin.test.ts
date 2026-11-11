/**
 * Lot 4, tâche 4.7 — résumé de caisse, PIN régisseur, retrait d'un contrôleur (constats scan-security-13,
 * -16, -17, -18, partner-ux-15 ; CDC §152, §153, §156). Contrat : section F de la conception du lot 4.
 *  - GET /api/controller/shifts/[id]/summary : son contrôleur, le partenaire propriétaire ou un admin ;
 *    404 pour tout autre compte (autre contrôleur, même du même événement ; autre partenaire) ;
 *  - PIN : HMAC-SHA256(REGISSEUR_PIN_KEY, `regisseur-pin:v2:<eventId>:<salt>:<pin>`), sel aléatoire par
 *    événement ; régénération : { confirm: true } obligatoire, 409 OPEN_SHIFTS si une caisse est ouverte
 *    sauf { confirmOpenShifts: true }, audit_logs ; le haché n'est ni copié dans controller_shifts ni
 *    renvoyé par une route ;
 *  - retrait d'un contrôleur qui a une caisse OUVERT : refusé sur tous les chemins (routes équipe,
 *    RPC atomic_partner_remove_controller, DELETE direct event_controllers ou user_roles CONTROLEUR,
 *    changement de rôle par l'admin) → CONTROLLER_HAS_OPEN_SHIFT, 409 sur les routes ; accepté une
 *    fois la caisse fermée.
 * Interprétations (contrat muet) : refus de régénération sans confirm = HTTP 4xx sans PIN ; journal
 * = ligne audit_logs dont l'action contient « PIN », rattachée à l'événement (object_id ou
 * metadata.event_id) ; colonne du sel = première colonne de event_regisseur_pins dont le nom contient
 * « salt » ; le partenaire propriétaire et l'admin passent le middleware sur la route du résumé (la page
 * caisse partenaire l'appelle). Le sujet de ces tests n'étant pas l'ouverture, une caisse que la route
 * d'ouverture du contrat ne sait pas encore ouvrir (code d'avant le correctif) est ouverte par l'ancienne
 * route ou posée en base ; après le correctif, la route du contrat suffit.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { signInAs } from '../helpers/fixtures';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { routeContext, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { assignController, authed, createTimedEvent, newController, openShift, shiftRow, type RouteResult } from './acces-helpers';

const PIN_RE = /^\d{6}$/;

let partner: TestPartner;
let otherPartner: TestPartner;
let admin: Buyer;

before(async () => {
    partner = await newPartner('caisse-pin');
    otherPartner = await newPartner('caisse-pin-b');
    admin = await newAdmin('caisse-pin');
});

after(async () => {
    await assertAccessInvariants('acces-caisse-pin');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

async function handlerOf(modulePath: string, method: string): Promise<Handler> {
    const mod = await importModule(modulePath);
    assert.equal(typeof mod[method], 'function', `${modulePath} : gestionnaire ${method} exporté`);
    return mod[method] as Handler;
}

async function newAdmin(label: string): Promise<Buyer> {
    const user = await newBuyer(`admin-${label}`, { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    return user;
}

async function newEvent(owner: TestPartner, label: string): Promise<SaleEvent> {
    return createTimedEvent(owner.partnerId, label, [{ name: 'Standard', price: 5000, total: 10 }]);
}

async function openShiftsOf(userId: string, eventId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('controller_shifts').select('*').eq('controller_id', userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses ouvertes : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

/**
 * Caisse OUVERT du contrôleur pour l'événement : route d'ouverture du contrat ; avant le correctif
 * seulement, ancienne route (PIN régisseur obligatoire) puis caisse posée en base.
 * Lot 9 bis (R42, A11, T47) : openShift passe le PIN régisseur (posé par l'aide le temps de l'ouverture, PIN de la
 * suite remis ensuite) ; l'ouverture sans PIN est le refus PIN_REQUIRED, prouvé à la fin du fichier.
 */
async function openShiftForTest(user: Buyer, eventId: string, partnerId: string, legacyPin?: string): Promise<{ shiftId: string; responses: RouteResult[] }> {
    const responses: RouteResult[] = [];
    const res = await openShift(user, eventId);
    responses.push(res);
    if (res.status !== 200 && legacyPin) {
        const open = await handlerOf('../../app/api/controller/shifts/open/route', 'POST');
        responses.push(await invoke(open, authed('/api/controller/shifts/open', 'POST', user, { event_id: eventId, opening_float_amount: 0, regisseur_pin: legacyPin })));
    }
    let rows = await openShiftsOf(user.userId, eventId);
    if (rows.length === 0) {
        const { error } = await service.from('controller_shifts').insert({
            controller_id: user.userId, event_id: eventId, partner_id: partnerId, status: 'OUVERT', opening_float_amount: 0, expected_cash_total: 0,
        });
        assert.equal(error, null, `caisse posée en base : ${error?.message}`);
        rows = await openShiftsOf(user.userId, eventId);
    }
    assert.equal(rows.length, 1, `une caisse OUVERT (trouvé : ${rows.length})`);
    return { shiftId: rows[0].id as string, responses };
}

async function closeShiftInDb(shiftId: string): Promise<void> {
    const s = await shiftRow(shiftId);
    const { error } = await service.from('controller_shifts')
        .update({ status: 'CLOTURE', declared_cash_total: Number(s.expected_cash_total), discrepancy_amount: 0, closed_at: new Date().toISOString() })
        .eq('id', shiftId);
    assert.equal(error, null, `clôture de la caisse : ${error?.message}`);
}

async function summary(user: Buyer, shiftId: string): Promise<RouteResult> {
    const get = await handlerOf('../../app/api/controller/shifts/[id]/summary/route', 'GET');
    return invoke(get, authed(`/api/controller/shifts/${shiftId}/summary`, 'GET', user), routeContext({ id: shiftId }));
}

async function regenPin(user: Buyer, eventId: string, body?: Record<string, unknown>): Promise<RouteResult> {
    const post = await handlerOf('../../app/api/partner/events/[id]/regisseur-pin/route', 'POST');
    return invoke(post, authed(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', user, body), routeContext({ id: eventId }));
}

async function generatePin(owner: TestPartner, eventId: string): Promise<{ pin: string; res: RouteResult }> {
    const res = await regenPin(owner, eventId, { confirm: true });
    assert.equal(res.status, 200, `génération confirmée du PIN : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    assert.match(String(res.body.pin), PIN_RE, `PIN renvoyé une fois en clair : ${JSON.stringify(res.body)}`);
    return { pin: String(res.body.pin), res };
}

async function pinRow(eventId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await service.from('event_regisseur_pins').select('*').eq('event_id', eventId).maybeSingle();
    assert.equal(error, null, `event_regisseur_pins : ${error?.message}`);
    return (data ?? null) as Record<string, unknown> | null;
}

async function pinAudit(eventId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('audit_logs').select('*').ilike('action', '%PIN%')
        .or(`object_id.eq.${eventId},metadata->>event_id.eq.${eventId}`);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

function hmacHex(key: string, message: string): string {
    return createHmac('sha256', key).update(message).digest('hex');
}

function hmacBoth(key: string, message: string): string[] {
    const mac = createHmac('sha256', key).update(message).digest();
    return [mac.toString('hex'), mac.toString('base64')];
}

async function signedClient(email: string) {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion de ${email} : ${error?.message}`);
    return client;
}

// ── Résumé de caisse ───────────────────────────────────────────────────────

describe('Résumé de caisse (Z) : son contrôleur, le partenaire propriétaire, un admin ; 404 sinon', () => {
    let ev: SaleEvent;
    let owner: Buyer;
    let sameEventCtrl: Buyer;
    let otherCtrl: Buyer;
    let shiftId: string;

    before(async () => {
        ev = await newEvent(partner, 'caisse-resume');
        owner = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'resume' });
        sameEventCtrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'resume-voisin' });
        const otherEv = await newEvent(otherPartner, 'caisse-resume-b');
        otherCtrl = await newController(otherPartner, otherEv.eventId, { canAcceptCash: true, label: 'resume-autre' });
        shiftId = (await openShiftForTest(owner, ev.eventId, partner.partnerId)).shiftId;
    });

    test('lisible par son contrôleur, le partenaire propriétaire et un admin', async () => {
        for (const [label, user] of [['contrôleur de la caisse', owner], ['partenaire propriétaire', partner], ['admin', admin]] as Array<[string, Buyer]>) {
            const res = await summary(user, shiftId);
            assert.equal(res.status, 200, `${label} : HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.ok(JSON.stringify(res.body).includes(shiftId), `${label} : résumé de la caisse demandée : ${JSON.stringify(res.body)}`);
        }
    });

    test('404 pour un autre contrôleur (même du même événement), un autre partenaire, une caisse inexistante', async () => {
        for (const [label, user] of [['autre contrôleur du même événement', sameEventCtrl], ['contrôleur d’un autre partenaire', otherCtrl], ['autre partenaire', otherPartner]] as Array<[string, Buyer]>) {
            const res = await summary(user, shiftId);
            assert.equal(res.status, 404, `${label} : 404 attendu, reçu HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.ok(!JSON.stringify(res.body).includes('expected_cash_total'), `${label} : aucune donnée de caisse`);
        }
        const missing = await summary(owner, '00000000-0000-4000-8000-000000000000');
        assert.equal(missing.status, 404, `caisse inexistante : HTTP ${missing.status}`);
    });

    test('le middleware laisse passer le partenaire propriétaire et l’admin vers la route du résumé', async () => {
        for (const [label, user] of [['partenaire propriétaire', partner], ['admin', admin]] as Array<[string, Buyer]>) {
            const cookies = await sessionCookies(await signedClient(user.email));
            const res = await callMiddleware(`/api/controller/shifts/${shiftId}/summary`, cookies);
            assert.equal(res.passedThrough, true, `${label} : middleware → HTTP ${res.status} ${res.location ?? ''} (refusé)`);
        }
    });
});

// ── PIN régisseur ──────────────────────────────────────────────────────────

describe('PIN régisseur', () => {
    test('régénération sans { confirm: true } : refusée, PIN inchangé ; partenaire non propriétaire refusé', async () => {
        const ev = await newEvent(partner, 'pin-confirm');
        await generatePin(partner, ev.eventId);
        const before = await pinRow(ev.eventId);
        assert.ok(before, 'PIN enregistré');
        for (const [label, body] of [['corps vide', undefined], ['confirm absent', {}], ['confirm: false', { confirm: false }]] as Array<[string, Record<string, unknown> | undefined]>) {
            const res = await regenPin(partner, ev.eventId, body);
            assert.ok(res.status >= 400 && res.status < 500, `${label} : régénération refusée attendue, reçu HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.equal(res.body.pin, undefined, `${label} : aucun PIN renvoyé`);
            assert.deepEqual(await pinRow(ev.eventId), before, `${label} : PIN inchangé`);
        }
        const foreign = await regenPin(otherPartner, ev.eventId, { confirm: true });
        assert.ok(foreign.status >= 400 && foreign.status < 500, `partenaire non propriétaire : refusé (HTTP ${foreign.status})`);
        assert.deepEqual(await pinRow(ev.eventId), before, 'partenaire non propriétaire : PIN inchangé');
    });

    test('caisse ouverte : 409 OPEN_SHIFTS, puis acceptée avec confirmOpenShifts ; chaque génération journalisée sans PIN ni haché', async () => {
        const ev = await newEvent(partner, 'pin-caisse');
        const first = await generatePin(partner, ev.eventId);
        const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'pin-caisse' });
        await openShiftForTest(ctrl, ev.eventId, partner.partnerId, first.pin);
        const before = await pinRow(ev.eventId);

        const blocked = await regenPin(partner, ev.eventId, { confirm: true });
        assert.equal(blocked.status, 409, `caisse ouverte : 409 attendu, reçu HTTP ${blocked.status} ${JSON.stringify(blocked.body)}`);
        assert.equal(blocked.body.code, 'OPEN_SHIFTS', `code OPEN_SHIFTS attendu : ${JSON.stringify(blocked.body)}`);
        assert.equal(blocked.body.pin, undefined, 'caisse ouverte : aucun PIN renvoyé');
        assert.deepEqual(await pinRow(ev.eventId), before, 'caisse ouverte : PIN inchangé');

        const forced = await regenPin(partner, ev.eventId, { confirm: true, confirmOpenShifts: true });
        assert.equal(forced.status, 200, `confirmOpenShifts : HTTP ${forced.status} ${JSON.stringify(forced.body)}`);
        assert.match(String(forced.body.pin), PIN_RE, 'nouveau PIN renvoyé');
        const after = await pinRow(ev.eventId);
        assert.notEqual(after?.pin_hash, before?.pin_hash, 'confirmOpenShifts : nouveau PIN enregistré');

        const audit = await pinAudit(ev.eventId);
        assert.ok(audit.length >= 2, `deux générations journalisées dans audit_logs (trouvé : ${audit.length})`);
        const secrets = [first.pin, String(forced.body.pin), String(before?.pin_hash), String(after?.pin_hash)];
        for (const row of audit) {
            const json = JSON.stringify(row);
            for (const s of secrets) assert.ok(!json.includes(s), `journal sans PIN ni haché : ${json}`);
        }
    });

    test('haché = HMAC(REGISSEUR_PIN_KEY, regisseur-pin:v2:<événement>:<sel>:<pin>), sel propre à chaque événement', async () => {
        const evA = await newEvent(partner, 'pin-hache-a');
        const evB = await newEvent(partner, 'pin-hache-b');
        const { pin } = await generatePin(partner, evA.eventId);
        await generatePin(partner, evB.eventId);
        const rowA = (await pinRow(evA.eventId))!;
        const rowB = (await pinRow(evB.eventId))!;
        const hashA = String(rowA.pin_hash);

        const legacyKey = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (legacyKey) assert.notEqual(hashA, hmacHex(legacyKey, pin), 'le haché ne doit plus être HMAC(secret du hook SMS, PIN) : même PIN = même haché sur tous les événements');

        const key = process.env.REGISSEUR_PIN_KEY;
        assert.ok(key && key.length >= 32, 'REGISSEUR_PIN_KEY présente (≥ 32 caractères) dans l’environnement de test');
        for (const other of ['SUPABASE_AUTH_HOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'TICKET_TOTP_MASTER_KEY']) {
            assert.notEqual(key, process.env[other], `REGISSEUR_PIN_KEY distincte de ${other}`);
        }

        const saltCol = Object.keys(rowA).find((k) => /salt/i.test(k));
        assert.ok(saltCol, `colonne de sel attendue dans event_regisseur_pins : ${Object.keys(rowA).join(', ')}`);
        const saltA = String(rowA[saltCol]);
        const saltB = String(rowB[saltCol]);
        assert.ok(saltA.length >= 16 && saltB.length >= 16, 'sel non vide');
        assert.notEqual(saltA, saltB, 'sel propre à chaque événement');
        assert.ok(hmacBoth(key!, `regisseur-pin:v2:${evA.eventId}:${saltA}:${pin}`).includes(hashA), 'haché conforme à la formule du contrat');
        const samePinOnB = hmacBoth(key!, `regisseur-pin:v2:${evB.eventId}:${saltB}:${pin}`);
        assert.ok(!samePinOnB.includes(hashA), 'même PIN sur deux événements : hachés différents');

        const cols = await inspect(async (db) => (await db.query<{ column_name: string; is_nullable: string }>(
            `SELECT column_name, is_nullable FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'event_regisseur_pins'`)).rows);
        const salt = cols.find((c) => /salt/i.test(c.column_name));
        assert.equal(salt?.is_nullable, 'NO', 'sel obligatoire : aucun ancien PIN (sans sel) ne subsiste');

        const shiftsDir = path.resolve(process.cwd(), 'lib/shifts');
        const files = fs.existsSync(shiftsDir) ? fs.readdirSync(shiftsDir).filter((f) => /\.ts$/.test(f)) : [];
        const offenders = files.filter((f) => /SUPABASE_AUTH_HOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/.test(fs.readFileSync(path.join(shiftsDir, f), 'utf8')));
        assert.deepEqual(offenders, [], `lib/shifts : plus de secret du hook SMS ni de clé service_role comme clé du PIN (${offenders.join(', ')})`);
    });

    test('le haché du PIN n’est ni copié dans controller_shifts ni renvoyé par les routes', async () => {
        const ev = await newEvent(partner, 'pin-fuite');
        const gen = await generatePin(partner, ev.eventId);
        const hash = String((await pinRow(ev.eventId))?.pin_hash);
        const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'pin-fuite' });
        const { shiftId, responses } = await openShiftForTest(ctrl, ev.eventId, partner.partnerId, gen.pin);

        const row = await shiftRow(shiftId);
        assert.equal(row.regisseur_pin_used ?? null, null, 'controller_shifts.regisseur_pin_used : plus de copie du haché');
        assert.ok(!JSON.stringify(row).includes(hash), 'controller_shifts ne contient pas le haché du PIN');

        const active = await invoke(await handlerOf('../../app/api/controller/shifts/active/route', 'GET'),
            authed(`/api/controller/shifts/active?event_id=${ev.eventId}&eventId=${ev.eventId}`, 'GET', ctrl));
        const list = await invoke(await handlerOf('../../app/api/partner/events/[id]/shifts/route', 'GET'),
            authed(`/api/partner/events/${ev.eventId}/shifts`, 'GET', partner), routeContext({ id: ev.eventId }));
        const z = await summary(ctrl, shiftId);
        for (const [label, res] of [
            ['génération du PIN', gen.res], ...responses.map((r, i) => [`ouverture ${i + 1}`, r] as [string, RouteResult]),
            ['caisse active', active], ['caisses de l’événement', list], ['résumé', z],
        ] as Array<[string, RouteResult]>) {
            assert.ok(!JSON.stringify(res.body).includes(hash), `${label} : la réponse ne contient pas le haché du PIN`);
        }
    });
});

// ── Retrait d'un contrôleur ────────────────────────────────────────────────

type Outcome = { route: RouteResult } | { db: { message: string } | null };

interface RemovalPath {
    label: string;
    kind: 'route' | 'db';
    removes: 'assignment' | 'role';
    run: () => Promise<Outcome>;
}

describe('Retrait d’un contrôleur qui a une caisse OUVERT', () => {
    let ev: SaleEvent;
    let ctrl: Buyer;
    let shiftId: string;
    let superToken: string;

    before(async () => {
        ev = await newEvent(partner, 'caisse-retrait');
        ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'retrait' });
        shiftId = (await openShiftForTest(ctrl, ev.eventId, partner.partnerId)).shiftId;
        superToken = (await signInAs('SUPERADMIN')).accessToken;
    });

    async function ensureAssigned(): Promise<void> {
        const { error } = await service.from('user_roles').upsert([{ user_id: ctrl.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
        assert.equal(error, null, `rôle CONTROLEUR : ${error?.message}`);
        await assignController(partner, ctrl.userId, ev.eventId, true);
    }

    async function assignmentId(): Promise<string | null> {
        const { data, error } = await service.from('event_controllers').select('id').eq('event_id', ev.eventId).eq('user_id', ctrl.userId).maybeSingle();
        assert.equal(error, null, `affectation : ${error?.message}`);
        return (data?.id as string | undefined) ?? null;
    }

    async function hasControllerRole(): Promise<boolean> {
        const { data, error } = await service.from('user_roles').select('role').eq('user_id', ctrl.userId).eq('role', 'CONTROLEUR');
        assert.equal(error, null, `rôles : ${error?.message}`);
        return (data ?? []).length > 0;
    }

    const paths: RemovalPath[] = [
        {
            label: 'service_role : DELETE event_controllers',
            kind: 'db',
            removes: 'assignment',
            run: async () => ({ db: (await service.from('event_controllers').delete().eq('event_id', ev.eventId).eq('user_id', ctrl.userId)).error }),
        },
        {
            label: 'RPC atomic_partner_remove_controller',
            kind: 'db',
            removes: 'assignment',
            run: async () => ({ db: (await service.rpc('atomic_partner_remove_controller', { p_partner_id: partner.partnerId, p_controller_id: ctrl.userId })).error }),
        },
        {
            label: 'DELETE /api/partner/team/[eventId]',
            kind: 'route',
            removes: 'assignment',
            run: async () => {
                const id = await assignmentId();
                const del = await handlerOf('../../app/api/partner/team/[eventId]/route', 'DELETE');
                return { route: await invoke(del, authed(`/api/partner/team/${ev.eventId}?assignmentId=${id}`, 'DELETE', partner), routeContext({ eventId: ev.eventId })) };
            },
        },
        {
            label: 'DELETE /api/partner/team/all',
            kind: 'route',
            removes: 'assignment',
            run: async () => {
                const del = await handlerOf('../../app/api/partner/team/all/route', 'DELETE');
                return { route: await invoke(del, authed(`/api/partner/team/all?controllerId=${ctrl.userId}`, 'DELETE', partner)) };
            },
        },
        {
            label: 'PATCH /api/partner/team/assignments (aucun événement)',
            kind: 'route',
            removes: 'assignment',
            run: async () => {
                const patch = await handlerOf('../../app/api/partner/team/assignments/route', 'PATCH');
                return { route: await invoke(patch, authed('/api/partner/team/assignments', 'PATCH', partner, { controller_id: ctrl.userId, event_ids: [], can_accept_cash: true })) };
            },
        },
        {
            label: 'service_role : DELETE user_roles CONTROLEUR',
            kind: 'db',
            removes: 'role',
            run: async () => ({ db: (await service.from('user_roles').delete().eq('user_id', ctrl.userId).eq('role', 'CONTROLEUR')).error }),
        },
        {
            label: 'PATCH /api/admin/users (rôle CLIENT)',
            kind: 'route',
            removes: 'role',
            run: async () => {
                const patch = await handlerOf('../../app/api/admin/users/route', 'PATCH');
                return { route: await invoke(patch, jsonRequest('/api/admin/users', 'PATCH', superToken, { userId: ctrl.userId, role: 'CLIENT' })) };
            },
        },
        {
            label: 'DELETE /api/partner/team/controller/[controllerId]',
            kind: 'route',
            removes: 'assignment',
            run: async () => {
                const del = await handlerOf('../../app/api/partner/team/controller/[controllerId]/route', 'DELETE');
                return { route: await invoke(del, authed(`/api/partner/team/controller/${ctrl.userId}`, 'DELETE', partner), routeContext({ controllerId: ctrl.userId })) };
            },
        },
    ];

    for (const p of paths) {
        test(`${p.label} : refusé (${p.kind === 'route' ? '409 ' : ''}CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés`, async () => {
            await ensureAssigned();
            assert.equal((await shiftRow(shiftId)).status, 'OUVERT', 'précondition : caisse OUVERT');
            const out = await p.run();
            if ('route' in out) {
                assert.equal(out.route.status, 409, `${p.label} : 409 attendu, reçu HTTP ${out.route.status} ${JSON.stringify(out.route.body)}`);
                assert.equal(out.route.body.code, 'CONTROLLER_HAS_OPEN_SHIFT', `${p.label} : code CONTROLLER_HAS_OPEN_SHIFT : ${JSON.stringify(out.route.body)}`);
            } else {
                assert.ok(out.db, `${p.label} : la base doit refuser le retrait`);
                assert.match(out.db.message, /CONTROLLER_HAS_OPEN_SHIFT/, `${p.label} : erreur CONTROLLER_HAS_OPEN_SHIFT : ${out.db.message}`);
            }
            assert.ok(await assignmentId(), `${p.label} : affectation conservée`);
            assert.equal(await hasControllerRole(), true, `${p.label} : rôle CONTROLEUR conservé`);
        });
    }

    test('caisse fermée : chaque chemin de retrait est accepté', async () => {
        await closeShiftInDb(shiftId);
        for (const p of paths) {
            await ensureAssigned();
            const out = await p.run();
            if ('route' in out) {
                assert.ok(out.route.status >= 200 && out.route.status < 300, `${p.label} : accepté, reçu HTTP ${out.route.status} ${JSON.stringify(out.route.body)}`);
            } else {
                assert.equal(out.db, null, `${p.label} : accepté, erreur ${out.db?.message}`);
            }
            if (p.removes === 'assignment') assert.equal(await assignmentId(), null, `${p.label} : affectation retirée`);
            else assert.equal(await hasControllerRole(), false, `${p.label} : rôle CONTROLEUR retiré`);
        }
    });
});

// ── Lot 9 bis (R42, A11, T47) : PIN obligatoire à l'ouverture ──────────────

describe('Ouverture de caisse : PIN régisseur obligatoire (lot 9 bis, R42)', () => {
    test('sans PIN : 400 PIN_REQUIRED « Saisissez le code PIN du régisseur. », aucune caisse ; avec le PIN généré : ouverte', async () => {
        const ev = await newEvent(partner, 'pin-obligatoire');
        const { pin } = await generatePin(partner, ev.eventId);
        const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'pin-obligatoire' });
        const refused = await openShift(ctrl, ev.eventId, 0, null);
        assert.equal(refused.status, 400, `ouverture sans PIN : 400 attendu (aujourd’hui le PIN est facultatif), reçu HTTP ${refused.status} ${JSON.stringify(refused.body)}`);
        assert.equal(refused.body.code, 'PIN_REQUIRED', `code PIN_REQUIRED : ${JSON.stringify(refused.body)}`);
        assert.equal(refused.body.error, 'Saisissez le code PIN du régisseur.', `texte du contrat 4.3 : ${JSON.stringify(refused.body)}`);
        assert.deepEqual(await openShiftsOf(ctrl.userId, ev.eventId), [], 'sans PIN : aucune caisse ouverte');
        const opened = await openShift(ctrl, ev.eventId, 0, pin);
        assert.equal(opened.status, 200, `ouverture avec le PIN généré : HTTP ${opened.status} ${JSON.stringify(opened.body)}`);
        assert.equal((await openShiftsOf(ctrl.userId, ev.eventId)).length, 1, 'avec le PIN : une caisse OUVERT');
    });
});
