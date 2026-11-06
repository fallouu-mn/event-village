/**
 * Lot 8, tâche 8.2 l — PATCH /api/partner/profile : une seule RPC transactionnelle, partner_profile_update(p jsonb)
 * (contrat 3.9, 8.4, L55). Ferme le point ouvert 12 du lot 7.
 *
 * Toute écriture passe par la route, avec un compteur sur les requêtes REST : un cas n'est vert que si la route a
 * fait exactement un appel à /rest/v1/rpc/partner_profile_update et aucune écriture directe sur partners ni sur
 * partner_activities. Ainsi « champ vidé », « activités seules » et chaque colonne, dont l'état final est déjà juste
 * aujourd'hui, sont rouges pour la bonne raison : la route écrit en plusieurs fois, hors transaction.
 *
 * Panne d'atomicité : déclencheur temporaire sur partner_activities, posé et retiré par une connexion locale, retiré
 * dans un finally. Il lève au DELETE pour un seul partenaire ; les suites tournent en série (run-tests.mjs).
 *
 * Rouge aujourd'hui : M6 n'existe pas (PGRST202 sur les appels directs), la route écrit trois fois (le nom est écrit
 * quand le retrait des activités échoue), et le after échoue tant que le schéma du lot n'est pas livré.
 * Vert après fix(8.2l) et les migrations du lot. Critère de sortie : dette-interface-lot7.test.ts:609-655 inchangé et vert.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { PATCH as patchRoute } from '../../app/api/partner/profile/route';
import { openConcurrentClient } from '../helpers/db';
import { bearer } from '../helpers/fixtures';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { newPartner, type TestPartner } from './finance-helpers';
import { jsonRequest, randomEmail, randomSenegalPhone } from './helpers';
import { service } from './paiement-helpers';

after(async () => {
    await assertRecetteInvariants('partenaire-profil-rpc');
});

const RPC = 'partner_profile_update';
const ROUTE_FILE = 'app/api/partner/profile/route.ts';
const TRIGGER = 'ev_test_panne_activites_lot8';
const COLUMNS = 'company_name, commercial_name, description, address, city, latitude, longitude, phone, email, logo_url, cover_url';

type Row = Record<string, unknown>;

interface Reply { status: number; body: Row; text: string; rpcCalls: number; directWrites: string[] }

/** PATCH par la route, avec le compte des appels à la RPC et des écritures REST directes. */
async function patchProfile(p: TestPartner, body: Row): Promise<Reply> {
    const previous = globalThis.fetch;
    let rpcCalls = 0;
    const directWrites: string[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const { pathname } = new URL(href);
        if (pathname === `/rest/v1/rpc/${RPC}`) rpcCalls++;
        if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && (pathname === '/rest/v1/partners' || pathname === '/rest/v1/partner_activities')) {
            directWrites.push(`${method} ${pathname}`);
        }
        return previous(input, init);
    }) as typeof fetch;
    try {
        const res = await patchRoute(jsonRequest('/api/partner/profile', body, bearer(p.accessToken), 'PATCH'));
        const text = await res.text();
        return { status: res.status, body: text ? (JSON.parse(text) as Row) : {}, text, rpcCalls, directWrites };
    } finally {
        globalThis.fetch = previous;
    }
}

function assertSingleRpc(r: Reply, what: string): void {
    assert.deepEqual(r.directWrites, [], `${what} : écritures directes de la route, hors transaction`);
    assert.equal(r.rpcCalls, 1, `${what} : ${r.rpcCalls} appel(s) à ${RPC}, un seul attendu`);
}

function assertSaved(r: Reply, what: string): void {
    assert.equal(r.status, 200, `${what} : ${r.status} ${r.text.slice(0, 300)}`);
    assertSingleRpc(r, what);
}

async function row(partnerId: string): Promise<Row> {
    const { data, error } = await service.from('partners').select(`${COLUMNS}, updated_at`).eq('id', partnerId).single();
    assert.equal(error, null, `lecture du partenaire : ${error?.message}`);
    return data as Row;
}

async function fieldsOf(partnerId: string): Promise<Row> {
    const { updated_at: _ignored, ...fields } = await row(partnerId);
    return fields;
}

async function activities(partnerId: string): Promise<string[]> {
    const { data, error } = await service.from('partner_activities').select('activity_type').eq('partner_id', partnerId).order('activity_type');
    assert.equal(error, null, `lecture des activités : ${error?.message}`);
    return (data ?? []).map((r) => String((r as { activity_type: string }).activity_type));
}

function imageUrl(partnerId: string, folder: string): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '');
    return `${base}/storage/v1/object/public/public-images/${folder}/${partnerId}/${randomUUID()}.png`;
}

/** Le déclencheur lève au DELETE d'une activité de ce partenaire, le temps de `fn`. */
async function withActivityDeleteFailure<T>(partnerId: string, fn: () => Promise<T>): Promise<T> {
    assert.match(partnerId, /^[0-9a-f-]{36}$/, 'identifiant de partenaire attendu');
    const run = async (sql: string): Promise<void> => {
        const db = await openConcurrentClient({ applicationName: 'ev-test-profil-rpc' });
        try {
            await db.query(sql);
            await db.commit();
        } finally {
            await db.close();
        }
    };
    await run(`
        CREATE OR REPLACE FUNCTION public.${TRIGGER}() RETURNS trigger LANGUAGE plpgsql AS $fn$
        BEGIN
            IF OLD.partner_id = '${partnerId}'::uuid THEN
                RAISE EXCEPTION 'panne simulée du retrait des activités SENTINELLE_SECRETE';
            END IF;
            RETURN OLD;
        END
        $fn$;
        DROP TRIGGER IF EXISTS ${TRIGGER} ON public.partner_activities;
        CREATE TRIGGER ${TRIGGER} BEFORE DELETE ON public.partner_activities
            FOR EACH ROW EXECUTE FUNCTION public.${TRIGGER}();`);
    try {
        return await fn();
    } finally {
        await run(`
            DROP TRIGGER IF EXISTS ${TRIGGER} ON public.partner_activities;
            DROP FUNCTION IF EXISTS public.${TRIGGER}();`);
    }
}

describe('8.2 l — atomicité', () => {
    test('retrait des activités en échec : 500 PROFILE_SAVE_FAILED, nom et activités inchangés', async () => {
        const p = await newPartner('rpc-atome');
        const before_ = await fieldsOf(p.partnerId);
        assert.deepEqual(await activities(p.partnerId), ['ORGANISATEUR'], 'précondition : activité du partenaire neuf');
        const r = await withActivityDeleteFailure(p.partnerId, () => patchProfile(p, {
            commercial_name: `Nom jamais écrit ${Date.now()}`,
            activities: ['RESTAURANT'],
        }));
        assert.equal(r.status, 500, `${r.status} ${r.text.slice(0, 300)}`);
        assert.equal(r.body.code, 'PROFILE_SAVE_FAILED');
        assert.ok(!r.text.includes('SENTINELLE_SECRETE'), `texte de la base renvoyé : ${r.text.slice(0, 300)}`);
        assert.deepEqual(await fieldsOf(p.partnerId), before_, 'la fiche a été écrite alors que l\'enregistrement a échoué');
        assert.deepEqual(await activities(p.partnerId), ['ORGANISATEUR'], 'activités modifiées alors que l\'enregistrement a échoué');
    });
});

describe('8.2 l — chaque colonne de la liste fermée', () => {
    let p: TestPartner;

    before(async () => {
        p = await newPartner('rpc-colonnes');
    });

    const VALUES: ReadonlyArray<[string, (partner: TestPartner) => unknown]> = [
        ['company_name', () => `Raison sociale ${Date.now()}`],
        ['commercial_name', () => `Nom commercial ${Date.now()}`],
        ['description', () => `Description ${Date.now()}`],
        ['address', () => `Adresse ${Date.now()}`],
        ['city', () => 'Thiès'],
        ['latitude', () => 14.6928],
        ['longitude', () => -17.4467],
        ['phone', () => randomSenegalPhone('77')],
        ['email', () => randomEmail('profil-rpc')],
        ['logo_url', (partner) => imageUrl(partner.partnerId, 'logos')],
        ['cover_url', (partner) => imageUrl(partner.partnerId, 'covers')],
    ];

    test('la liste couvre toutes les colonnes de la validation', () => {
        assert.deepEqual(VALUES.map(([c]) => c).sort(), COLUMNS.split(', ').sort(), 'colonne oubliée par cette suite');
    });

    for (const [column, value] of VALUES) {
        test(`${column} : écrite seule, les autres inchangées, updated_at avancé`, async () => {
            const start = await row(p.partnerId);
            const wanted = value(p);
            assertSaved(await patchProfile(p, { [column]: wanted }), column);
            const end = await row(p.partnerId);
            assert.equal(end[column], wanted, `${column} non enregistrée`);
            assert.ok(Date.parse(String(end.updated_at)) > Date.parse(String(start.updated_at)), `${column} : updated_at inchangé`);
            const { [column]: _a, updated_at: _b, ...others } = start;
            const { [column]: _c, updated_at: _d, ...othersAfter } = end;
            assert.deepEqual(othersAfter, others, `${column} : une autre colonne a changé`);
        });
    }

    for (const [column] of VALUES.filter(([c]) => c !== 'company_name')) {
        test(`${column} : vidée, NULL ; les autres inchangées`, async () => {
            const start = await fieldsOf(p.partnerId);
            assertSaved(await patchProfile(p, { [column]: null }), `${column} vidée`);
            assert.deepEqual(await fieldsOf(p.partnerId), { ...start, [column]: null }, `${column} : seul ce champ doit devenir NULL`);
            const value = VALUES.find(([c]) => c === column)![1](p);
            assertSaved(await patchProfile(p, { [column]: value }), `${column} reposée`);
        });
    }

    test('champ absent : inchangé, chaîne vide : NULL', async () => {
        const start = await fieldsOf(p.partnerId);
        assertSaved(await patchProfile(p, { description: '' }), 'description vide');
        assert.deepEqual(await fieldsOf(p.partnerId), { ...start, description: null });
    });
});

describe('8.2 l — activités', () => {
    test('activités seules : la fiche ne change pas', async () => {
        const p = await newPartner('rpc-act');
        const start = await fieldsOf(p.partnerId);
        assertSaved(await patchProfile(p, { activities: ['RESTAURANT', 'SALLE'] }), 'activités seules');
        assert.deepEqual(await activities(p.partnerId), ['RESTAURANT', 'SALLE']);
        assert.deepEqual(await fieldsOf(p.partnerId), start);
    });

    test('champs seuls : les activités ne changent pas', async () => {
        const p = await newPartner('rpc-champs');
        assertSaved(await patchProfile(p, { city: 'Saint-Louis' }), 'champs seuls');
        assert.deepEqual(await activities(p.partnerId), ['ORGANISATEUR']);
    });

    test('champs et activités ensemble', async () => {
        const p = await newPartner('rpc-ensemble');
        assertSaved(await patchProfile(p, { city: 'Mbour', activities: ['TRAITEUR'] }), 'ensemble');
        assert.equal((await row(p.partnerId)).city, 'Mbour');
        assert.deepEqual(await activities(p.partnerId), ['TRAITEUR']);
    });

    test('deux activités → une', async () => {
        const p = await newPartner('rpc-deux');
        assertSaved(await patchProfile(p, { activities: ['ORGANISATEUR', 'SALLE'] }), 'ajout');
        assert.deepEqual(await activities(p.partnerId), ['ORGANISATEUR', 'SALLE']);
        assertSaved(await patchProfile(p, { activities: ['SALLE'] }), 'retrait');
        assert.deepEqual(await activities(p.partnerId), ['SALLE']);
    });

    test('activité demandée deux fois : une seule ligne, pas d\'échec ON CONFLICT', async () => {
        const p = await newPartner('rpc-doublon');
        assertSaved(await patchProfile(p, { activities: ['SALLE', 'SALLE'] }), 'doublon');
        assert.deepEqual(await activities(p.partnerId), ['SALLE']);
    });

    test('activité désactivée puis redemandée : is_active redevient vrai', async () => {
        const p = await newPartner('rpc-reactive');
        const { error } = await service.from('partner_activities').update({ is_active: false }).eq('partner_id', p.partnerId);
        assert.equal(error, null, `préparation : ${error?.message}`);
        assertSaved(await patchProfile(p, { activities: ['ORGANISATEUR'] }), 'réactivation');
        const { data, error: readErr } = await service.from('partner_activities').select('is_active').eq('partner_id', p.partnerId);
        assert.equal(readErr, null, `relecture : ${readErr?.message}`);
        assert.deepEqual(data, [{ is_active: true }]);
    });
});

describe('8.2 l — RPC appelée directement (rôle de service, contrat 8.4)', () => {
    async function call(p: Row): Promise<{ data: Row | null; code: string | null; message: string | null }> {
        const { data, error } = await service.rpc(RPC, { p });
        return { data: data as Row | null, code: error?.code ?? null, message: error?.message ?? null };
    }

    test('succès : { ok: true }', async () => {
        const p = await newPartner('rpc-ok');
        const out = await call({ partner_id: p.partnerId, user_id: p.userId, fields: { city: 'Kaolack' }, activities: null });
        assert.equal(out.code, null, `${out.code} ${out.message}`);
        assert.equal(out.data?.ok, true);
        assert.equal((await row(p.partnerId)).city, 'Kaolack');
    });

    test('compte d\'un autre : { ok: false, code: PARTNER_NOT_FOUND }, rien d\'écrit', async () => {
        const owner = await newPartner('rpc-a');
        const other = await newPartner('rpc-b');
        const start = await fieldsOf(owner.partnerId);
        const out = await call({ partner_id: owner.partnerId, user_id: other.userId, fields: { city: 'Volé' }, activities: ['AUTRE'] });
        assert.equal(out.code, null, `${out.code} ${out.message}`);
        assert.deepEqual(out.data, { ok: false, code: 'PARTNER_NOT_FOUND' });
        assert.deepEqual(await fieldsOf(owner.partnerId), start);
        assert.deepEqual(await activities(owner.partnerId), ['ORGANISATEUR']);
    });

    test('activities: null : activités inchangées ; clé absente de fields : colonne inchangée', async () => {
        const p = await newPartner('rpc-null');
        const start = await fieldsOf(p.partnerId);
        const out = await call({ partner_id: p.partnerId, user_id: p.userId, fields: { description: null }, activities: null });
        assert.equal(out.code, null, `${out.code} ${out.message}`);
        assert.deepEqual(await fieldsOf(p.partnerId), { ...start, description: null });
        assert.deepEqual(await activities(p.partnerId), ['ORGANISATEUR']);
    });

    test('liste fermée : status, is_verified, user_id et subscription_plan_id ne s\'écrivent pas', async () => {
        const p = await newPartner('rpc-ferme');
        const other = await newPartner('rpc-ferme-b');
        const columns = 'status, is_verified, user_id, subscription_plan_id, id_card_url, business_doc_url';
        const read = async (): Promise<Row> => {
            const { data, error } = await service.from('partners').select(columns).eq('id', p.partnerId).single();
            assert.equal(error, null, `lecture : ${error?.message}`);
            return data as unknown as Row;
        };
        const start = await read();
        const out = await call({
            partner_id: p.partnerId,
            user_id: p.userId,
            fields: { status: 'SUSPENDU', is_verified: false, user_id: other.userId, id_card_url: 'x', business_doc_url: 'x', city: 'Ziguinchor' },
            activities: null,
        });
        assert.equal(out.code, null, `${out.code} ${out.message}`);
        assert.deepEqual(await read(), start, 'colonne hors liste écrite');
        assert.equal((await row(p.partnerId)).city, 'Ziguinchor', 'la colonne de la liste doit s\'écrire');
    });

    test('activité hors énumération : erreur, et la fiche n\'est pas écrite (transaction)', async () => {
        const p = await newPartner('rpc-enum');
        const start = await fieldsOf(p.partnerId);
        const out = await call({ partner_id: p.partnerId, user_id: p.userId, fields: { city: 'Jamais écrite' }, activities: ['ACTIVITE_INCONNUE'] });
        assert.ok(out.code !== null, 'activité hors énumération acceptée');
        assert.notEqual(out.code, 'PGRST202', `fonction absente (fix(8.2l)) : ${out.message}`);
        assert.deepEqual(await fieldsOf(p.partnerId), start);
        assert.deepEqual(await activities(p.partnerId), ['ORGANISATEUR']);
    });
});

describe('8.2 l — statique : la route n\'écrit plus directement', () => {
    const sf = ts.createSourceFile(ROUTE_FILE, fs.readFileSync(path.join(process.cwd(), ROUTE_FILE), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const code = ts.createPrinter({ removeComments: true }).printFile(sf);

    test('aucune écriture sur partners ni partner_activities', () => {
        assert.doesNotMatch(code, /from\(["']partner_activities["']\)/, 'la route touche encore partner_activities');
        assert.doesNotMatch(code, /from\(["']partners["']\)\s*\.(update|upsert|insert|delete)\(/, 'la route écrit encore partners');
        assert.doesNotMatch(code, /\.(update|upsert)\(/, 'écriture directe restante');
    });

    test('une seule RPC, par rpcWithRetry', () => {
        const calls = code.match(/rpcWithRetry\(["']partner_profile_update["']/g) ?? [];
        assert.equal(calls.length, 1, `${ROUTE_FILE} : un appel rpcWithRetry('${RPC}', …) attendu`);
    });

    test('le commentaire d\'en-tête ne dit plus qu\'aucune RPC ne couvre la fiche', () => {
        assert.doesNotMatch(sf.text, /Aucune RPC ne couvre/, `${ROUTE_FILE} : commentaire périmé (contrat 8.4)`);
    });
});
