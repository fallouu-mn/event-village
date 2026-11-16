/**
 * Finition 2b (C) — brouillon du formulaire gardé dans le navigateur, propre au compte et à l'événement, lectures et
 * écritures protégées, rien côté serveur ; au retour « Reprendre votre saisie du {date} à {heure} ? » (Reprendre,
 * Effacer) ; bouton Retour d'Android protégé. Sans base : module lib/events/local-draft.ts avec un stockage simulé, et
 * lecture des fichiers.
 *  a. Un brouillon n'est repris que par son compte et pour son événement ;
 *  b. contenu illisible, d'une autre forme, refusé par le contrôle ou trop gros : ignoré et effacé ;
 *  c. stockage absent ou qui refuse (navigation privée, quota) : aucune exception, rien de gardé ;
 *  d. déconnexion : tous les brouillons du compte effacés, ceux des autres comptes gardés ;
 *  e. écran : texte de reprise, « Reprendre », « Effacer », brouillon contrôlé champ par champ ; Retour protégé
 *     (entrée sentinelle, popstate) ; brouillons effacés à la déconnexion.
 * Rouge avant le correctif : module absent, écran sans reprise, Retour non protégé. Suite sans base ni écriture en base.
 */
import '../helpers/env';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importModule } from './paiement-helpers';

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const E1 = '33333333-3333-4333-8333-333333333333';
const E2 = '44444444-4444-4444-8444-444444444444';

type DraftModule = {
    draftKey: (u: string, e: string | null) => string | null;
    readDraft: <T>(u: string, e: string | null, v: (d: unknown) => T | null) => { savedAt: string; data: T } | null;
    writeDraft: (u: string, e: string | null, data: unknown, now?: Date) => boolean;
    clearDraft: (u: string, e: string | null) => void;
    clearUserDrafts: (u: string) => void;
};

class FakeStorage {
    map = new Map<string, string>();
    failGet = false;
    failSet = false;
    get length() { return this.map.size; }
    key(i: number) { return [...this.map.keys()][i] ?? null; }
    getItem(k: string) { if (this.failGet) throw new Error('SecurityError'); return this.map.get(k) ?? null; }
    setItem(k: string, v: string) { if (this.failSet) throw new Error('QuotaExceededError'); this.map.set(k, v); }
    removeItem(k: string) { this.map.delete(k); }
}

const g = globalThis as unknown as { window?: { localStorage?: FakeStorage } };
let store: FakeStorage;

function install(): FakeStorage {
    store = new FakeStorage();
    g.window = { localStorage: store };
    return store;
}

afterEach(() => {
    delete g.window;
});

async function mod(): Promise<DraftModule> {
    const m = (await importModule('../../lib/events/local-draft')) as unknown as DraftModule;
    assert.equal(typeof m.readDraft, 'function', 'readDraft exportée par lib/events/local-draft.ts');
    return m;
}

const accept = (d: unknown) => (d && typeof d === 'object' ? (d as { title?: unknown }) : null);

describe('a. propre au compte et à l’événement', () => {
    test('écrit pour (compte 1, événement 1) : repris par lui seul', async () => {
        const m = await mod();
        install();
        assert.equal(m.writeDraft(U1, E1, { title: 'Nuit du Mbalax' }, new Date('2026-11-16T17:42:00Z')), true);
        const mine = m.readDraft(U1, E1, accept);
        assert.deepEqual(mine, { savedAt: '2026-11-16T17:42:00.000Z', data: { title: 'Nuit du Mbalax' } });
        assert.equal(m.readDraft(U2, E1, accept), null, 'autre compte');
        assert.equal(m.readDraft(U1, E2, accept), null, 'autre événement');
        assert.equal(m.readDraft(U1, null, accept), null, 'création');
    });
    test('contenu qui redit un autre compte (clé recopiée) : refusé et effacé', async () => {
        const m = await mod();
        install();
        m.writeDraft(U2, E1, { title: 'x' });
        const k2 = m.draftKey(U2, E1)!;
        const k1 = m.draftKey(U1, E1)!;
        store.setItem(k1, store.getItem(k2)!);
        assert.equal(m.readDraft(U1, E1, accept), null);
        assert.equal(store.getItem(k1), null, 'brouillon étranger effacé');
    });
    test('identifiants illisibles : aucune clé', async () => {
        const m = await mod();
        assert.equal(m.draftKey('../x', E1), null);
        assert.equal(m.draftKey(U1, 'a:b'), null);
    });
});

describe('b. contenu illisible, refusé ou trop gros', () => {
    test('JSON illisible : ignoré et effacé', async () => {
        const m = await mod();
        install();
        store.setItem(m.draftKey(U1, E1)!, '{pas du json');
        assert.equal(m.readDraft(U1, E1, accept), null);
        assert.equal(store.map.size, 0);
    });
    test('contenu refusé par le contrôle de l’écran : ignoré et effacé', async () => {
        const m = await mod();
        install();
        m.writeDraft(U1, E1, { title: 'x' });
        assert.equal(m.readDraft(U1, E1, () => null), null);
        assert.equal(store.map.size, 0);
    });
    test('trop gros (plus de 64 Kio) : rien de gardé', async () => {
        const m = await mod();
        install();
        assert.equal(m.writeDraft(U1, E1, { title: 'x'.repeat(70_000) }), false);
        assert.equal(store.map.size, 0);
    });
});

describe('c. stockage absent ou qui refuse', () => {
    test('sans stockage (window absent) : aucune exception', async () => {
        const m = await mod();
        delete g.window;
        assert.equal(m.writeDraft(U1, E1, { title: 'x' }), false);
        assert.equal(m.readDraft(U1, E1, accept), null);
        m.clearDraft(U1, E1);
        m.clearUserDrafts(U1);
    });
    test('écriture refusée (quota) et lecture refusée : aucune exception, rien de gardé', async () => {
        const m = await mod();
        install();
        store.failSet = true;
        assert.equal(m.writeDraft(U1, E1, { title: 'x' }), false);
        store.failSet = false;
        m.writeDraft(U1, E1, { title: 'x' });
        store.failGet = true;
        assert.equal(m.readDraft(U1, E1, accept), null);
    });
});

describe('d. déconnexion : brouillons du compte effacés', () => {
    test('clearUserDrafts efface les brouillons du compte, garde ceux des autres', async () => {
        const m = await mod();
        install();
        m.writeDraft(U1, E1, { title: 'a' });
        m.writeDraft(U1, null, { title: 'b' });
        m.writeDraft(U2, E1, { title: 'c' });
        store.setItem('autre-cle', 'garde');
        m.clearUserDrafts(U1);
        assert.deepEqual([...store.map.keys()].sort(), [m.draftKey(U2, E1)!, 'autre-cle'].sort());
    });
});

describe('e. écran', () => {
    const form = read('components/events/EventForm.tsx');
    test('reprise : texte, « Reprendre », « Effacer », contenu contrôlé champ par champ', () => {
        assert.match(form, /Reprendre votre saisie du \$\{formatShortDate\(resumable\.savedAt\)\} à \$\{formatTime\(resumable\.savedAt\)\} \?/);
        assert.match(form, />Reprendre</);
        assert.match(form, />Effacer</);
        assert.match(form, /readDraft\(userId, eventId, \(d\) => validFormDraft\(d,/);
        assert.match(form, /writeDraft\(userId, eventId,/);
    });
    test('Retour du navigateur protégé (entrée sentinelle, popstate)', () => {
        const guard = read('hooks/useUnsavedGuard.ts');
        assert.match(guard, /window\.history\.pushState\(/);
        assert.match(guard, /addEventListener\('popstate'/);
        assert.doesNotMatch(guard, /n'est pas intercepté/);
    });
    test('déconnexion : brouillons du compte effacés', () => {
        assert.match(read('components/providers/AuthProvider.tsx'), /clearUserDrafts\(user\.id\)/);
    });
});
