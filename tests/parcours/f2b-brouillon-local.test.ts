/**
 * Finition 2b (C) — brouillon du formulaire gardé dans le navigateur, propre au compte et à l'événement, lectures et
 * écritures protégées, rien côté serveur ; au retour « Reprendre votre saisie du {date} à {heure} ? » (Reprendre,
 * Effacer) ; bouton Retour d'Android protégé. Sans base : module lib/events/local-draft.ts avec un stockage simulé, et
 * lecture des fichiers.
 *  a. Un brouillon n'est repris que par son compte et pour son événement ;
 *  b. contenu illisible, d'une autre forme, refusé par le contrôle ou trop gros : ignoré et effacé ;
 *  c. stockage absent ou qui refuse (navigation privée, quota) : aucune exception, rien de gardé ;
 *  d. déconnexion : tous les brouillons de ce navigateur effacés, quel que soit le compte, les autres clés gardées ;
 *     stockage refusé : aucune exception (la déconnexion continue) ;
 *  e. écran : texte de reprise, « Reprendre », « Effacer », brouillon contrôlé champ par champ ; Retour protégé
 *     (entrée sentinelle, popstate) ; brouillons effacés au bouton « Se déconnecter » (avant la fermeture de la session)
 *     et à toute fin de session signalée au navigateur (SIGNED_OUT : autre onglet, autre appareil, autres boutons de
 *     déconnexion), par un module à part, sans dépendance : le module des brouillons reste hors du JavaScript de chaque
 *     page (run complet 275 : budgets dépassés).
 * Rouge avant le correctif : module absent, écran sans reprise, Retour non protégé. Rouge sur f47921b77 (run 275) :
 * lib/events/draft-purge.ts absent, AuthProvider importe lib/events/local-draft ; purge absente sur SIGNED_OUT
 * (relecture du correctif). Suite sans base ni écriture en base.
 */
import '../helpers/env';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importModule } from './paiement-helpers';

const ROOT = process.cwd();
/** Fichier lu en fins de ligne LF (copie de travail Windows en CRLF, CI en LF : les ancres `$` des contrôles valent partout). */
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

/** Source sans commentaires (même règle que tests/parcours/hors-ligne-client.test.ts). */
function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Texte équilibré `(` … `)` ou `{` … `}` qui suit l'indice `open` (délimiteur ouvrant). */
function balanced(src: string, open: number, pair: '()' | '{}'): string {
    const [o, c] = pair.split('');
    assert.equal(src[open], o, 'balanced : délimiteur ouvrant attendu');
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === o) depth++;
        else if (src[i] === c) {
            depth--;
            if (depth === 0) return src.slice(open, i + 1);
        }
    }
    return assert.fail('balanced : délimiteurs non équilibrés');
}
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const E1 = '33333333-3333-4333-8333-333333333333';
const E2 = '44444444-4444-4444-8444-444444444444';

type DraftModule = {
    draftKey: (u: string, e: string | null) => string | null;
    readDraft: <T>(u: string, e: string | null, v: (d: unknown) => T | null) => { savedAt: string; data: T } | null;
    writeDraft: (u: string, e: string | null, data: unknown, now?: Date) => boolean;
    clearDraft: (u: string, e: string | null) => void;
};

type PurgeModule = { clearAllDrafts: () => void };

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

async function purge(): Promise<PurgeModule> {
    const m = (await importModule('../../lib/events/draft-purge')) as unknown as PurgeModule;
    assert.equal(typeof m.clearAllDrafts, 'function', 'clearAllDrafts exportée par lib/events/draft-purge.ts');
    return m;
}

const accept = (d: unknown) => (d && typeof d === 'object' ? (d as { title?: unknown }) : null);

describe('a. propre au compte et à l’événement', () => {
    test('écrit pour (compte 1, événement 1) : repris par lui seul', async () => {
        const m = await mod();
        install();
        // Lot poids : écrit il y a une heure (avant : le 16/11/2026 en dur, devenu « plus de 7 jours » le 23/11 : rouge sur
        // toutes les branches). Même vérification : date et contenu relus à l'identique.
        const ecrit = new Date(Date.now() - 60 * 60 * 1000);
        assert.equal(m.writeDraft(U1, E1, { title: 'Nuit du Mbalax' }, ecrit), true);
        const mine = m.readDraft(U1, E1, accept);
        assert.deepEqual(mine, { savedAt: ecrit.toISOString(), data: { title: 'Nuit du Mbalax' } });
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
        (await purge()).clearAllDrafts();
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

describe('d. déconnexion : tous les brouillons de ce navigateur effacés', () => {
    test('clearAllDrafts efface les brouillons de tous les comptes, garde les autres clés', async () => {
        const m = await mod();
        const p = await purge();
        install();
        assert.equal(m.writeDraft(U1, E1, { title: 'a' }), true);
        assert.equal(m.writeDraft(U1, null, { title: 'b' }), true);
        assert.equal(m.writeDraft(U2, E2, { title: 'c' }), true);
        store.setItem('ev-scan-session:v1:x', 'garde');
        store.setItem('autre-cle', 'garde');
        assert.equal(store.map.size, 5);
        p.clearAllDrafts();
        assert.deepEqual([...store.map.keys()].sort(), ['autre-cle', 'ev-scan-session:v1:x']);
        assert.equal(m.readDraft(U2, E2, accept), null, 'brouillon d’un autre compte effacé aussi');
    });
    test('stockage absent ou refusé (navigation privée) : aucune exception, la déconnexion continue', async () => {
        const p = await purge();
        delete g.window;
        assert.doesNotThrow(() => p.clearAllDrafts(), 'window absent');
        g.window = Object.defineProperty({}, 'localStorage', { get() { throw new Error('SecurityError'); } });
        assert.doesNotThrow(() => p.clearAllDrafts(), 'accès au stockage refusé');
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
    test('déconnexion : brouillons effacés avant la fermeture de la session et à toute fin de session, module à part', () => {
        const auth = stripComments(read('components/providers/AuthProvider.tsx'));
        assert.match(auth, /import \{ clearAllDrafts \} from '@\/lib\/events\/draft-purge';/);
        // Lot sécurité (déconnexion sans réseau) : signOut(scope ?) et fermeture locale de la session par dropLocalSession
        // (lib/auth/sign-out-here.ts) au lieu de supabase.auth.signOut, qui la gardait sans réseau ; même exigence d'ordre
        const signOutAt = auth.search(/const signOut = async \((?:scope\?: 'partout')?\) => \{/);
        assert.ok(signOutAt >= 0, 'fonction signOut lisible dans AuthProvider');
        const signOutBody = balanced(auth, auth.indexOf('{', auth.indexOf('=>', signOutAt)), '{}');
        const purgeAt = signOutBody.search(/^\s*clearAllDrafts\(\);$/m);
        assert.ok(purgeAt >= 0, 'signOut : clearAllDrafts(); sans condition');
        const closeAt = signOutBody.search(/dropLocalSession\(/);
        assert.ok(closeAt >= 0 && purgeAt < closeAt, 'purge avant la fermeture de la session (au cas où SIGNED_OUT n’arrive pas)');
        const listenerAt = auth.search(/onAuthStateChange\(/);
        assert.ok(listenerAt >= 0, 'écouteur onAuthStateChange');
        const listener = balanced(auth, auth.indexOf('(', listenerAt), '()');
        const signedOutAt = listener.search(/if \(event === 'SIGNED_OUT'\) \{/);
        assert.ok(signedOutAt >= 0, 'écouteur : cas SIGNED_OUT');
        const signedOut = balanced(listener, listener.indexOf('{', signedOutAt), '{}');
        assert.match(signedOut, /^\s*clearAllDrafts\(\);$/m, 'SIGNED_OUT : brouillons effacés (autre onglet, autre appareil, autres boutons de déconnexion)');
        // Run complet 275 : AuthProvider est chargé par chaque page ; importer lib/events/local-draft.ts y mettait tout le
        // module (budgets de scripts/js-budget.json dépassés)
        assert.doesNotMatch(auth, /['"](?:@\/|(?:\.\.?\/)+)lib\/events\/local-draft['"]/, 'import (statique ou dynamique) du module des brouillons');
        const purge = stripComments(read('lib/events/draft-purge.ts'));
        assert.doesNotMatch(purge, /^\s*(?:import|export)\b[^;]*\bfrom\s|\bimport\(|\brequire\(/m, 'module de purge sans dépendance');
    });
});
