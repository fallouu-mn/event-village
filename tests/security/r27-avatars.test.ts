/**
 * R27 — Lot 9, tâche 9.2, complément photo (AR3, L32, L34) : bucket « avatars » vu d'un attaquant sans privilège.
 * La route est le seul écrivain (sharp et le retrait EXIF ne sont pas contournables) : avec la clé anon ou un compte
 * connecté, aucune écriture ni suppression, même dans son propre dossier. La lecture de l'URL publique reste ouverte, la
 * liste des dossiers non. Les objets de la victime sont déposés par la route, avec son propre jeton.
 * (Clé anon + signUp uniquement. Cas de l'avatar_url forgée, qui exige une écriture privilégiée : compte-photo.)
 *
 * Rouge avant correctif : le bucket avatars et la route n'existent pas ; chaque cas contrôle d'abord le bucket, pour qu'un
 * « Bucket not found » ne passe jamais pour un refus, et le dépôt de la victime échoue tant que la route manque. Le REST de
 * first_name, last_name, avatar_url est encore ouvert à authenticated (M4). Après les tests, assertLot9Invariants reste
 * rouge tant que M2 et M4 ne sont pas livrés.
 *
 * Vert dès l'écriture, signalé : « anon ne modifie pas avatar_url par REST » (anon n'a jamais eu ce droit ; garde-fou).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { BASE_URL } from '../parcours/helpers';
import { anonClient, assertDenied, signUpAttacker, type AttackerAccount } from './helpers';

after(async () => {
    await assertLot9Invariants('r27-avatars');
});

const BUCKET = 'avatars';
const AVATAR_PATH = '/api/account/avatar';

// Import dynamique : la route n'existe pas avant le correctif, et le typecheck de la CI passe avant les tests.
const ROUTE_PATH = '../../app/api/account/avatar/route';
type Handler = (req: NextRequest) => Promise<Response>;

async function avatarRoute(): Promise<{ POST: Handler; DELETE: Handler }> {
    const mod = await import(ROUTE_PATH) as { POST?: Handler; DELETE?: Handler };
    assert.equal(typeof mod.POST, 'function', 'app/api/account/avatar/route doit exporter POST (contrat 4.3)');
    assert.equal(typeof mod.DELETE, 'function', 'app/api/account/avatar/route doit exporter DELETE (contrat 4.3)');
    return { POST: mod.POST!, DELETE: mod.DELETE! };
}

async function assertBucketExists(): Promise<void> {
    const found = await inspect(async (db) => (await db.query('SELECT 1 FROM storage.buckets WHERE id = $1', [BUCKET])).rows.length);
    assert.equal(found, 1, 'bucket avatars absent (migration M4, contrat 5.3) : un refus ne prouverait rien');
}

const validWebp = (): Promise<Buffer> => sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 10, g: 120, b: 60 } } }).webp().toBuffer();
const webpBlob = (bytes: Buffer): Blob => new Blob([new Uint8Array(bytes)], { type: 'image/webp' });

async function tokenOf(account: AttackerAccount): Promise<string> {
    const { data, error } = await account.client.auth.getSession();
    assert.equal(error, null, `session : ${error?.message}`);
    assert.ok(data.session, 'session absente');
    return data.session.access_token;
}

async function postAvatar(token: string | null, content: Buffer, fields: Record<string, string> = {}, name = 'portrait.jpg'): Promise<Response> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append('file', new File([new Uint8Array(content)], name, { type: 'image/jpeg' }));
    const encoded = new Response(form);
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const headers: Record<string, string> = { 'content-type': encoded.headers.get('content-type') ?? '', 'content-length': String(bytes.length) };
    if (token) headers.authorization = `Bearer ${token}`;
    return (await avatarRoute()).POST(new NextRequest(`${BASE_URL}${AVATAR_PATH}`, { method: 'POST', headers, body: bytes }));
}

interface Deposit { account: AttackerAccount; url: string; objectPath: string; bytes: Buffer }

/** Photo déposée par la route avec le jeton de son propriétaire, relue par son URL publique. */
async function deposit(label: string): Promise<Deposit> {
    const account = await signUpAttacker(label);
    const res = await postAvatar(await tokenOf(account), await validWebp());
    const text = await res.text();
    assert.equal(res.status, 200, `dépôt de la photo par la route : HTTP ${res.status} ${text.slice(0, 300)}`);
    const url = String((JSON.parse(text) as { avatar_url?: unknown }).avatar_url);
    const marker = `/object/public/${BUCKET}/`;
    assert.ok(url.includes(marker), `URL publique attendue : ${url}`);
    const objectPath = url.slice(url.indexOf(marker) + marker.length);
    return { account, url, objectPath, bytes: await publicBytes(url) };
}

async function publicBytes(url: string): Promise<Buffer> {
    const res = await fetch(url);
    assert.equal(res.status, 200, `lecture publique de ${url} : HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

async function assertIntact(d: Deposit, what: string): Promise<void> {
    assert.deepEqual(await publicBytes(d.url), d.bytes, `${what} : objet modifié`);
}

function assertWriteRefused(error: { message: string } | null, what: string): void {
    assert.ok(error, `${what} : l'écriture a été ACCEPTÉE alors qu'elle doit être refusée`);
    assert.doesNotMatch(error.message, /bucket not found/i, `${what} : le bucket manque, ce refus ne prouve rien`);
    assert.match(error.message, /row-level security|unauthorized|not authorized|permission denied|violates/i, `${what} : refus de droits attendu, obtenu : ${error.message}`);
}

describe('R27 — configuration du bucket', () => {
    test('public, 2 Mo, image/webp seul, aucune politique sur storage.objects (AR3)', async () => {
        const facts = await inspect(async (db) => ({
            bucket: (await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
                'SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = $1', [BUCKET])).rows,
            policies: (await db.query<{ policyname: string }>(
                `SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                    AND (COALESCE(qual, '') ILIKE '%avatars%' OR COALESCE(with_check, '') ILIKE '%avatars%')`)).rows,
        }));
        assert.equal(facts.bucket.length, 1, 'bucket avatars absent (migration M4, contrat 5.3)');
        assert.equal(facts.bucket[0].public, true);
        assert.equal(Number(facts.bucket[0].file_size_limit), 2_097_152);
        assert.deepEqual(facts.bucket[0].allowed_mime_types, ['image/webp']);
        assert.deepEqual(facts.policies, [], 'aucune politique : la route est le seul écrivain');
    });
});

describe('R27 — jeton anon', () => {
    test('écriture refusée, chez un compte existant comme dans un dossier inventé', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-anon-v');
        const anon = anonClient();
        for (const objectPath of [`${victim.account.userId}/${randomUUID()}.webp`, `${randomUUID()}/${randomUUID()}.webp`]) {
            const { error } = await anon.storage.from(BUCKET).upload(objectPath, webpBlob(await validWebp()), { upsert: false });
            assertWriteRefused(error, `anon écrit ${objectPath}`);
        }
    });

    test('remplacement et suppression refusés, objet de la victime intact', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-anon-del');
        const anon = anonClient();
        const { error: upsertErr } = await anon.storage.from(BUCKET).upload(victim.objectPath, webpBlob(await validWebp()), { upsert: true });
        assertWriteRefused(upsertErr, 'anon remplace la photo');
        const { data: removed, error: removeErr } = await anon.storage.from(BUCKET).remove([victim.objectPath]);
        assert.deepEqual(removed ?? [], [], `anon supprime la photo : ${removeErr?.message ?? JSON.stringify(removed)}`);
        await assertIntact(victim, 'après les essais anon');
    });

    test('lecture publique ouverte, en image/webp ; liste des dossiers vide', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-anon-lecture');
        const res = await fetch(victim.url);
        assert.equal(res.status, 200, `lecture publique : HTTP ${res.status}`);
        assert.match(res.headers.get('content-type') ?? '', /image\/webp/);
        const anon = anonClient();
        const { data: folder } = await anon.storage.from(BUCKET).list(victim.account.userId);
        assert.deepEqual(folder ?? [], [], 'liste anonyme du dossier d’un compte non vide');
        const { data: root } = await anon.storage.from(BUCKET).list('');
        assert.deepEqual(root ?? [], [], 'liste anonyme des comptes non vide');
    });

    test('POST et DELETE de la route sans session : 401, rien d’écrit', async () => {
        await assertBucketExists();
        const up = await postAvatar(null, await validWebp());
        assert.equal(up.status, 401, await up.text());
        const del = await (await avatarRoute()).DELETE(new NextRequest(`${BASE_URL}${AVATAR_PATH}`, { method: 'DELETE' }));
        assert.equal(del.status, 401, await del.text());
    });

    test('jeton invalide : 401 sur la route', async () => {
        await assertBucketExists();
        const res = await postAvatar('jeton.invalide.signature', await validWebp());
        assert.equal(res.status, 401, await res.text());
    });

    test('anon ne modifie pas avatar_url par REST (déjà vrai, garde-fou)', async () => {
        const victim = await signUpAttacker('r27-anon-rest');
        const { error } = await anonClient().from('users').update({ avatar_url: 'https://example.invalid/a.webp' }).eq('id', victim.userId).select('avatar_url');
        assertDenied(error, 'anon écrit users.avatar_url');
    });
});

describe('R27 — compte connecté (A) contre la photo de B', () => {
    test('A n’écrit pas dans le dossier de B', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-auth-v');
        const attacker = await signUpAttacker('r27-auth-a');
        const { error } = await attacker.client.storage.from(BUCKET)
            .upload(`${victim.account.userId}/${randomUUID()}.webp`, webpBlob(await validWebp()), { upsert: false });
        assertWriteRefused(error, 'A écrit chez B');
    });

    test('A n’écrit pas dans son propre dossier : un WebP valide contournerait sharp et le retrait EXIF (AR3)', async () => {
        await assertBucketExists();
        const attacker = await signUpAttacker('r27-auth-soi');
        const { error } = await attacker.client.storage.from(BUCKET)
            .upload(`${attacker.userId}/${randomUUID()}.webp`, webpBlob(await validWebp()), { upsert: false });
        assertWriteRefused(error, 'A écrit directement chez lui');
    });

    test('A ne remplace pas l’objet de B : upsert, update, move, copy sans effet', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-rempl-v');
        const attacker = await signUpAttacker('r27-rempl-a');
        const store = attacker.client.storage.from(BUCKET);
        const other = webpBlob(await validWebp());
        assertWriteRefused((await store.upload(victim.objectPath, other, { upsert: true })).error, 'A remplace par upsert');
        assert.ok((await store.update(victim.objectPath, other)).error, 'A remplace par update : accepté');
        assert.ok((await store.move(victim.objectPath, `${attacker.userId}/${randomUUID()}.webp`)).error, 'A déplace l’objet de B : accepté');
        assert.ok((await store.copy(victim.objectPath, `${attacker.userId}/${randomUUID()}.webp`)).error, 'A copie l’objet de B dans son dossier : accepté');
        await assertIntact(victim, 'après les essais de remplacement');
    });

    test('A ne supprime rien chez B ni chez lui par l’API Storage : l’objet reste', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-suppr-v');
        const own = await deposit('r27-suppr-a');
        const store = own.account.client.storage.from(BUCKET);
        for (const [what, target] of [['chez B', victim], ['dans son dossier', own]] as const) {
            const { data, error } = await store.remove([target.objectPath]);
            assert.deepEqual(data ?? [], [], `suppression directe ${what} : ${error?.message ?? JSON.stringify(data)}`);
            await assertIntact(target, `suppression directe ${what}`);
        }
    });

    test('un compte connecté ne liste aucun dossier, pas même le sien', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-liste-v');
        const own = await deposit('r27-liste-a');
        const store = own.account.client.storage.from(BUCKET);
        for (const folder of [victim.account.userId, own.account.userId, '']) {
            const { data } = await store.list(folder);
            assert.deepEqual(data ?? [], [], `liste du dossier « ${folder} » non vide`);
        }
    });
});

describe('R27 — A contre B par la route', () => {
    test('champs et nom hostiles : la photo de A va sous le dossier de A, celle de B ne bouge pas', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-route-v');
        const attacker = await signUpAttacker('r27-route-a');
        const res = await postAvatar(await tokenOf(attacker), await validWebp(), {
            user_id: victim.account.userId, path: victim.objectPath,
        }, `../${victim.account.userId}/piege.webp`);
        const text = await res.text();
        assert.equal(res.status, 200, text.slice(0, 300));
        const url = String((JSON.parse(text) as { avatar_url?: unknown }).avatar_url);
        assert.ok(url.includes(`/object/public/${BUCKET}/${attacker.userId}/`), `objet hors du dossier de A : ${url}`);
        await assertIntact(victim, 'après le POST de A');
    });

    test('DELETE de A : la photo de B reste', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-del-v');
        const own = await deposit('r27-del-a');
        const res = await (await avatarRoute()).DELETE(new NextRequest(`${BASE_URL}${AVATAR_PATH}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${await tokenOf(own.account)}` },
        }));
        assert.equal(res.status, 200, await res.text());
        await assertIntact(victim, 'après le DELETE de A');
    });
});

describe('R27 — colonnes du profil en REST (L32)', () => {
    test('prénom, nom, photo : UPDATE retiré à authenticated (M4), et anon ne l’a pas', async () => {
        const rights = await inspect(async (db) => (await db.query<Record<string, boolean>>(
            `SELECT has_column_privilege('authenticated', 'public.users', 'first_name', 'UPDATE') AS auth_first,
                    has_column_privilege('authenticated', 'public.users', 'last_name', 'UPDATE') AS auth_last,
                    has_column_privilege('authenticated', 'public.users', 'avatar_url', 'UPDATE') AS auth_avatar,
                    has_column_privilege('anon', 'public.users', 'avatar_url', 'UPDATE') AS anon_avatar`)).rows[0]);
        assert.deepEqual(rights, { auth_first: false, auth_last: false, auth_avatar: false, anon_avatar: false });
    });

    test('compte connecté : avatar_url vers l’objet d’un autre refusée par REST (fermeture de D-cpt C6)', async () => {
        await assertBucketExists();
        const victim = await deposit('r27-rest-v');
        const attacker = await signUpAttacker('r27-rest-a');
        const { error } = await attacker.client.from('users').update({ avatar_url: victim.url }).eq('id', attacker.userId).select('avatar_url');
        assertDenied(error, 'authenticated écrit users.avatar_url');
        const { data, error: readErr } = await attacker.client.from('users').select('avatar_url').eq('id', attacker.userId).single();
        assert.equal(readErr, null, `relecture : ${readErr?.message}`);
        assert.equal(data.avatar_url, null, 'avatar_url inchangée');
    });
});
