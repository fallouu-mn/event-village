/**
 * Contre-vérification de la finition 2b, attaque 5 — brouillon d'événement gardé dans le navigateur (lib/events/local-draft.ts,
 * lib/events/draft-purge.ts, components/providers/AuthProvider.tsx, components/events/EventForm.tsx). Téléphone ou poste
 * partagé : le compte B ne voit jamais le brouillon du compte A, ni après la déconnexion de A, ni après un changement de
 * compte sans déconnexion explicite, ni dans un autre onglet.
 *  a. Clé et contenu propres au compte : B (même équipe, même événement) ne reprend jamais le brouillon de A ; contenu
 *     recopié sous la clé de B : refusé et effacé.                                                    attendu : BLOQUÉE
 *  b. La purge de la déconnexion couvre toutes les clés que le module écrit (préfixe croisé, toutes versions).
 *                                                                                                     attendu : BLOQUÉE
 *  c. Connexion d'un autre compte sans SIGNED_OUT, onglet resté ouvert (SIGNED_IN de B après A) : les brouillons de A sont
 *     effacés du navigateur.                                                                           attendu : TROU
 *  d. Session de A close à l'insu du navigateur (cookies effacés par le serveur, page rechargée), puis connexion de B : la
 *     purge ne dépend pas de la mémoire de l'onglet (lastUserIdRef, remise à zéro au rechargement).   attendu : TROU (connu,
 *     docs/apres-lancement.md et lib/events/draft-purge.ts:7-8)
 *  e. Autre onglet : « Se déconnecter » dans l'onglet 1 → l'onglet 2 reçoit SIGNED_OUT (vraie bibliothèque, BroadcastChannel)
 *     et efface les brouillons ; le formulaire de l'onglet 2 est démonté (espace partenaire) et sa sauvegarde différée
 *     s'arrête avec le compte.                                                                        attendu : BLOQUÉE
 * Ce qui n'est PAS vérifiable dans Node (dit au rapport) : rendu React (les écouteurs d'AuthProvider et du formulaire sont
 * lus dans le code), course entre le minuteur de 0,8 s du formulaire de l'onglet 2 et la purge (clearAllDrafts appelée AVANT
 * que React démonte le formulaire), onglet gelé ou en cache de retour (bfcache) qui recevrait SIGNED_OUT en retard.
 * Suite SANS base ni écriture en base : pas d'assertFinition1Invariants. Sortie brute `[CVF2B-5]`.
 */
import '../helpers/env';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
    authProviderParts, brief, fakeSession, FakeStorage, installWindow, openTabs, read, stripComments, uninstallWindow, waitFor,
} from './cvf2b-56-helpers';

type DraftModule = {
    draftKey: (u: string, e: string | null) => string | null;
    readDraft: <T>(u: string, e: string | null, v: (d: unknown) => T | null) => { savedAt: string; data: T } | null;
    writeDraft: (u: string, e: string | null, data: unknown, now?: Date) => boolean;
};
type PurgeModule = { clearAllDrafts: () => void };
type SignOutModule = { dropLocalSession(auth: unknown): Promise<void> };

const drafts = async () => (await import('../../lib/events/local-draft')) as unknown as DraftModule;
const purge = async () => (await import('../../lib/events/draft-purge')) as unknown as PurgeModule;
const signOutHere = async () => (await import('../../lib/auth/sign-out-here')) as unknown as SignOutModule;
const accept = (d: unknown) => (d && typeof d === 'object' ? (d as Record<string, unknown>) : null);

const A = randomUUID();
const B = randomUUID();
const EVENT = randomUUID();
const SECRET = { title: 'Gala privé de A', phone: '+221 77 000 00 01', note: 'tarif négocié 15 000' };

afterEach(() => uninstallWindow());

describe('a. clé et contenu propres au compte', () => {
    test('B (même équipe, même événement, création comme modification) ne reprend jamais le brouillon de A', async () => {
        const m = await drafts();
        const w = installWindow();
        assert.equal(m.writeDraft(A, EVENT, SECRET), true, 'écriture du brouillon de A (modification)');
        assert.equal(m.writeDraft(A, null, SECRET), true, 'écriture du brouillon de A (création)');
        const seenEdit = m.readDraft(B, EVENT, accept);
        const seenNew = m.readDraft(B, null, accept);
        // Contenu de A recopié sous la clé de B (autre onglet, extension, script de la page) : le contenu redit le compte
        w.localStorage.setItem(m.draftKey(B, EVENT)!, w.localStorage.getItem(m.draftKey(A, EVENT)!)!);
        const forged = m.readDraft(B, EVENT, accept);
        console.log(`[CVF2B-5] a. clés : ${brief(w.localStorage.keys())} ; B lit modification=${brief(seenEdit)} création=${brief(seenNew)} recopié=${brief(forged)} ; clé recopiée restante=${w.localStorage.getItem(m.draftKey(B, EVENT)!) !== null}`);
        assert.equal(seenEdit, null, `B a repris le brouillon de A (modification) : ${brief(seenEdit)}`);
        assert.equal(seenNew, null, `B a repris le brouillon de A (création) : ${brief(seenNew)}`);
        assert.equal(forged, null, `contenu de A recopié sous la clé de B repris par B : ${brief(forged)}`);
        assert.equal(w.localStorage.getItem(m.draftKey(B, EVENT)!), null, 'contenu étranger sous la clé de B non effacé');
        assert.equal(m.draftKey(`${A}:nouveau`, null), null, 'identifiant de compte avec « : » accepté dans une clé');
    });
});

describe('b. la purge couvre toutes les clés du module', () => {
    test('préfixe de draft-purge ⊇ préfixe de local-draft ; brouillons de tous les comptes effacés, autres clés gardées', async () => {
        const m = await drafts();
        const p = await purge();
        const prefix = /const PREFIX = '([^']+)'/.exec(read('lib/events/local-draft.ts'))?.[1];
        const purged = /startsWith\('([^']+)'\)/.exec(stripComments(read('lib/events/draft-purge.ts')))?.[1];
        assert.ok(prefix && purged, `préfixes lisibles (local-draft « ${prefix} », draft-purge « ${purged} »)`);
        const w = installWindow();
        m.writeDraft(A, EVENT, SECRET);
        m.writeDraft(A, null, SECRET);
        m.writeDraft(B, null, { title: 'brouillon de B' });
        w.localStorage.setItem('ev-brouillon:v2:ancien-format', '{}');
        w.localStorage.setItem('ev-theme', 'dark');
        const before = w.localStorage.keys();
        p.clearAllDrafts();
        const left = w.localStorage.keys();
        console.log(`[CVF2B-5] b. préfixe écrit « ${prefix} », préfixe purgé « ${purged} » ; avant ${brief(before)} ; après ${brief(left)}`);
        assert.ok(prefix.startsWith(purged), `la purge (« ${purged} ») ne couvre pas les clés écrites (« ${prefix} »)`);
        assert.deepEqual(left.filter((k) => k.startsWith('ev-brouillon')), [], `brouillons restants après la purge : ${brief(left)}`);
        assert.deepEqual(left, ['ev-theme'], `clé étrangère effacée ou brouillon restant : ${brief(left)}`);
    });
});

describe('c-d. changement de compte sans déconnexion explicite', () => {
    test('c. SIGNED_IN d’un autre compte (onglet ouvert) : les brouillons de l’ancien compte sont effacés', async () => {
        const m = await drafts();
        const w = installWindow();
        m.writeDraft(A, EVENT, SECRET);
        const { signedInOther } = authProviderParts();
        console.log(`[CVF2B-5] c. branche « SIGNED_IN d'un autre compte » d'AuthProvider : ${brief(signedInOther?.replace(/\s+/g, ' ') ?? 'absente', 400)}`);
        // Ce qui reste dans le navigateur quand cette branche s'exécute sans effacer les brouillons (preuve brute)
        console.log(`[CVF2B-5] c. brouillon de A lisible en clair dans localStorage pendant la session de B : ${brief(w.localStorage.getItem(m.draftKey(A, EVENT)!))}`);
        assert.ok(signedInOther, 'AuthProvider : aucune branche SIGNED_IN d’un autre compte (rien n’est purgé au changement de compte)');
        assert.match(signedInOther, /clear\w*Drafts?\w*\(/,
            `SIGNED_IN d'un autre compte : les brouillons du compte précédent ne sont pas effacés (seuls les billets hors ligne le sont) — ${brief(signedInOther.replace(/\s+/g, ' '), 300)}`);
    });

    test('d. session close à l’insu du navigateur puis connexion de B (page rechargée) : purge indépendante de la mémoire de l’onglet', () => {
        const { listener, signedOut, signedInOther } = authProviderParts();
        const offsetOut = listener.indexOf(signedOut);
        const offsetIn = signedInOther ? listener.indexOf(signedInOther) : -1;
        const calls = [...listener.matchAll(/clear\w*Drafts?\w*\(/g)].map((x) => x.index!);
        // Une purge atteignable sans SIGNED_OUT et sans le compte précédent en mémoire (lastUserIdRef vaut null après un rechargement)
        const reachable = calls.filter((i) => {
            const inOut = i >= offsetOut && i < offsetOut + signedOut.length;
            const inIn = offsetIn >= 0 && i >= offsetIn && i < offsetIn + signedInOther!.length && /previousUserId/.test(signedInOther!.slice(0, signedInOther!.indexOf('{')));
            return !inOut && !inIn;
        });
        const ref = /const lastUserIdRef = useRef<string \| null>\(null\)/.test(read('components/providers/AuthProvider.tsx'));
        console.log(`[CVF2B-5] d. purges des brouillons dans l'écouteur : ${calls.length} ; hors SIGNED_OUT et hors condition sur previousUserId : ${reachable.length} ; lastUserIdRef remis à null à chaque chargement : ${ref}`);
        console.log(`[CVF2B-5] d. condition de la branche SIGNED_IN : ${brief(signedInOther?.slice(0, signedInOther.indexOf('{')).replace(/\s+/g, ' ') ?? 'absente')}`);
        assert.ok(reachable.length > 0,
            'aucune purge des brouillons quand la session de A s’est close sans SIGNED_OUT (cookies effacés par le serveur) puis que B se connecte après un rechargement : '
            + 'la seule purge au changement de compte exige previousUserId (lastUserIdRef, perdu au rechargement), la seule autre exige SIGNED_OUT');
    });
});

describe('e. autre onglet', () => {
    test('« Se déconnecter » dans l’onglet 1 : l’onglet 2 reçoit SIGNED_OUT et efface les brouillons ; son formulaire s’arrête', async () => {
        const m = await drafts();
        const p = await purge();
        const so = await signOutHere();
        const shared = new FakeStorage(); // localStorage partagé par les onglets d'une même origine
        installWindow(shared);
        const jar = new Map<string, string>();
        const { tabs: [one, two], close } = openTabs(2, jar);
        try {
            m.writeDraft(A, EVENT, SECRET);
            const auth1 = one.client.auth as unknown as { _saveSession(s: unknown): Promise<void>; _notifyAllSubscribers(e: string, s: unknown): Promise<void> };
            const session = fakeSession(A);
            await auth1._saveSession(session);
            await auth1._notifyAllSubscribers('SIGNED_IN', session);
            const gotIn = await waitFor(() => two.events.includes('SIGNED_IN'));
            await so.dropLocalSession(one.client.auth);
            const gotOut = await waitFor(() => two.events.includes('SIGNED_OUT'));
            const twoSession = (await two.client.auth.getSession()).data.session;
            console.log(`[CVF2B-5] e. onglet 1 : ${one.events.join(', ')} ; onglet 2 : ${two.events.join(', ')} ; session lue par l'onglet 2 après : ${twoSession ? 'PRÉSENTE' : 'aucune'}`);
            assert.ok(gotIn, `connexion non diffusée à l'onglet 2 (BroadcastChannel d'auth-js) : ${two.events.join(', ')}`);
            assert.ok(gotOut, `SIGNED_OUT non reçu par l'onglet 2 : ${two.events.join(', ')}`);
            assert.equal(twoSession, null, 'l’onglet 2 lit encore une session');

            // L'écouteur de l'onglet 2 (même AuthProvider) efface les brouillons sur SIGNED_OUT ; même fonction exécutée ici
            const { signedOut } = authProviderParts();
            assert.match(signedOut, /^\s*clearAllDrafts\(\);$/m, 'AuthProvider : SIGNED_OUT n’efface pas les brouillons');
            p.clearAllDrafts();
            assert.deepEqual(shared.keys().filter((k) => k.startsWith('ev-brouillon')), [], `brouillons restants : ${brief(shared.keys())}`);

            // Formulaire de l'onglet 2 : l'espace partenaire renvoie vers la connexion sans compte (formulaire démonté, saisie
            // perdue), et la sauvegarde différée dépend du compte (minuteur annulé quand le compte disparaît)
            const layout = stripComments(read('app/partner/layout.tsx'));
            const form = stripComments(read('components/events/EventForm.tsx'));
            const save = form.slice(form.search(/const timer = window\.setTimeout\(\(\) => \{\s*writeDraft\(userId/) - 400, form.search(/const timer = window\.setTimeout\(\(\) => \{\s*writeDraft\(userId/) + 400);
            console.log(`[CVF2B-5] e. sauvegarde différée : ${brief(save.replace(/\s+/g, ' '), 500)}`);
            assert.match(layout, /if \(!isAuthenticated \|\| !profile\) \{\s*redirect\(/, 'espace partenaire : pas de renvoi vers la connexion quand le compte disparaît');
            assert.match(save, /if \(!userId \|\|/, 'sauvegarde différée : pas d’arrêt sans compte');
            assert.match(save, /return \(\) => window\.clearTimeout\(timer\);/, 'sauvegarde différée : minuteur non annulé');
            assert.match(save, /\[userId, /, 'sauvegarde différée : ne dépend pas du compte');
        } finally {
            close();
        }
    });
});
