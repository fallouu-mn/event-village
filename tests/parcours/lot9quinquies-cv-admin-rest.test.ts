/**
 * Lot 9 quinquies, correctifs de la contre-vérification — point 1 : un jeton ADMIN ou SUPERADMIN qui n'a pas passé le code
 * administrateur ne lit RIEN, ni par REST ni par le temps réel, au-delà de ses propres données ; le code vaut aussi pour
 * GET /api/controller/profile.
 *
 * Rouge avant correctif (contre-vérification, run 177, cv9qq-1 b) : avec le jeton seul, la REST rendait 5 comptes et
 * 2 paiements d'autres personnes (is_admin() ne regardait que le rôle et le statut du compte) ; controller/profile
 * répondait 200 sans le code.
 *
 *  a. toutes les relations lisibles par `authenticated` : le compte ADMIN sans code ne voit aucune ligne qu'un simple
 *     client ne voit pas, hors ses propres lignes (qui portent son identifiant) ;
 *  b. témoin : le même compte, après le code (aide stepUpTestSession), lit les comptes des autres ;
 *  c. code passé il y a plus de 12 heures : plus rien ;
 *  d. temps réel : un signal d'administration (admin_signals) arrive à l'admin qui a passé le code, pas à celui qui ne
 *     l'a pas passé ;
 *  e. GET /api/controller/profile : refusé sans le code (ADMIN_PASSWORD_REQUIRED ou ADMIN_SMS_REQUIRED), 200 avec.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect, writeLocal } from '../helpers/db';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import {
    RECEIVE_TIMEOUT_MS,
    disposeClients,
    expectNothing,
    produceUntilReceived,
    signedInClient,
    subscribeCollect,
    waitForEvent,
} from '../helpers/realtime';
import { ADMIN_PERMISSIONS } from '../../lib/admin/permissions';
import { callRoute, newSession, rawAccount, STEP_UP_CODES, userClient, type Account } from '../audit-auth/cv9qq-helpers';
import { newBuyer, type Buyer } from './paiement-helpers';
import { newPartner } from './finance-helpers';

let admin: Account;
let client: Buyer;

before(async () => {
    admin = await rawAccount('cv-rest', 'ADMIN', ADMIN_PERMISSIONS);
    client = await newBuyer('cv-rest-client');
});

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-cv-admin-rest');
});

interface Relation { name: string; cols: string[] }

async function exposedRelations(): Promise<Relation[]> {
    return inspect(async (c) => (await c.query<{ name: string; cols: string[] }>(
        `SELECT c.relname AS name, array_agg(a.attname::text ORDER BY a.attnum) AS cols
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'p')
            AND has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT')
          GROUP BY c.relname
          ORDER BY c.relname`,
    )).rows);
}

async function rowsOf(token: string, rel: Relation): Promise<string[]> {
    const { data, error } = await userClient(token).from(rel.name).select(rel.cols.map((x) => `"${x}"`).join(',')).limit(5000);
    if (error) return [];
    return (data ?? []).map((r) => JSON.stringify(r));
}

async function otherUsersSeen(token: string, ownId: string): Promise<number> {
    const { data, error } = await userClient(token).from('users').select('id').neq('id', ownId).limit(50);
    assert.equal(error, null, error?.message);
    return (data ?? []).length;
}

describe('Point 1 — ADMIN sans le code : rien par REST ni par le temps réel au-delà de ses données', () => {
    test('a. toutes les relations lisibles par authenticated : aucune ligne de plus qu\'un client, hors les siennes', async () => {
        const leaks: string[] = [];
        let checked = 0;
        for (const rel of await exposedRelations()) {
            const before = await rowsOf(client.accessToken, rel);
            const seen = await rowsOf(admin.token, rel);
            const afterRead = await rowsOf(client.accessToken, rel);
            const clientSet = new Set([...before, ...afterRead]);
            const extra = seen.filter((r) => !clientSet.has(r) && !r.includes(admin.userId));
            checked += 1;
            if (extra.length > 0) leaks.push(`${rel.name} : ${extra.length} ligne(s), ex. ${extra[0].slice(0, 160)}`);
        }
        console.log(`[CV-1a] ${checked} relation(s) lues par un ADMIN sans code ; fuites : ${leaks.length === 0 ? 'aucune' : leaks.map((l) => l.split(' : ')[0]).join(', ')}`);
        assert.ok(checked > 30, `trop peu de relations lues : ${checked}`);
        assert.deepEqual(leaks, [], `lignes lues par un ADMIN qui n'a pas passé le code :\n${leaks.join('\n')}`);
    });

    test('b. témoin : après le code, le même compte lit les comptes des autres', async () => {
        const s = await newSession(admin.email);
        await stepUpTestSession(s.token);
        const n = await otherUsersSeen(s.token, admin.userId);
        console.log(`[CV-1b] comptes d'autres personnes lus après le code : ${n}`);
        assert.ok(n > 0, 'après le code, l\'admin lit les comptes (témoin)');
    });

    test('c. code passé il y a plus de 12 heures : plus aucun compte d\'autrui', async () => {
        const s = await newSession(admin.email);
        await stepUpTestSession(s.token);
        await writeLocal((c) => c.query(`UPDATE public.admin_session_codes SET code_at = now() - interval '13 hours' WHERE session_id = $1`, [s.sessionId]));
        const n = await otherUsersSeen(s.token, admin.userId);
        console.log(`[CV-1c] comptes d'autres personnes lus avec un code de plus de 12 h : ${n}`);
        assert.equal(n, 0, 'code de plus de 12 heures : rien');
    });

    test('d. temps réel : admin_signals arrive à l\'admin qui a passé le code, pas à celui qui ne l\'a pas passé', async () => {
        const witness = await signedInClient('ADMIN');
        const intruder = await signedInClient({ email: admin.email }, { stepUp: false });
        const registered: string[] = [];
        try {
            const feed = subscribeCollect(witness, { table: 'admin_signals' }, { label: 'admin avec code' });
            const spy = subscribeCollect(intruder, { table: 'admin_signals' }, { label: 'admin sans code' });
            await Promise.all([feed.ready, spy.ready]);
            const register = async (): Promise<string> => {
                const p = await newPartner('cv-signal');
                registered.push(p.partnerId);
                return p.partnerId;
            };
            await produceUntilReceived(feed, register, (e) => e.new.kind === 'PARTNER_REGISTERED' && registered.includes(String(e.new.ref_id)),
                { what: 'vivacité : inscription d\'un partenaire reçue par l\'admin avec code' });
            const sentinel = await register();
            await waitForEvent(feed, (e) => e.new.ref_id === sentinel, RECEIVE_TIMEOUT_MS, 'sentinelle reçue par l\'admin avec code');
            await expectNothing(spy, 1_500, (e) => Object.keys(e.new).length > 0, 'admin sans code : aucun signal d\'administration');
        } finally {
            await disposeClients(witness, intruder);
        }
    });

    test('e. GET /api/controller/profile : refusé sans le code, 200 avec', async () => {
        const without = await callRoute('controller/profile', 'GET', { token: admin.token });
        const s = await newSession(admin.email);
        await stepUpTestSession(s.token);
        const withCode = await callRoute('controller/profile', 'GET', { token: s.token });
        console.log(`[CV-1e] controller/profile d'un ADMIN : sans code ${without?.status} ${String(without?.body.code ?? '')} ; avec code ${withCode?.status}`);
        assert.ok(without && without.status === 403 && STEP_UP_CODES.has(String(without.body.code)), JSON.stringify(without?.body));
        assert.equal(withCode?.status, 200, JSON.stringify(withCode?.body));
    });
});
