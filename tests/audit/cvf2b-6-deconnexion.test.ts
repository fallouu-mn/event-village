/**
 * Contre-vérification du lot « déconnexion sans réseau » (et de la finition 2b), attaque 6 — après « Se déconnecter », avec
 * ou sans réseau, plus aucune donnée personnelle accessible sur l'appareil, dans TOUS les onglets ; au retour du réseau,
 * aucune requête avec l'ancienne session et le jeton refusé côté serveur ; même chose pour le scanner et pour « Déconnecter
 * tous mes appareils ». Vraie bibliothèque (@supabase/ssr, auth-js 2.114) contre le Supabase local, vrais modules de
 * l'application (lib/auth/sign-out-here, lib/tickets/offline-store et offline-lots, OfflineTicketsSync, lib/scan, public/sw.js
 * dans node:vm), navigateur simulé (tests/audit/cvf2b-56-helpers.ts : stockages, faux IndexedDB, onglets sur un même pot
 * de cookies avec le BroadcastChannel de Node).
 *  1. Tous les onglets : SIGNED_OUT reçu par l'onglet 2, qui efface billets hors ligne et mémoire du contrôle.   BLOQUÉE
 *  2. Autres onglets : un écran personnel déjà affiché (administration, contrôleur, portefeuille) reste à l'écran après
 *     SIGNED_OUT (aucun écran « déconnecté » hors de l'onglet du bouton, aucune garde dans ces espaces).          TROU
 *  3. IndexedDB des billets hors ligne : purge réelle, et purge à la désignation d'un autre compte.               BLOQUÉE
 *  4. IndexedDB : un téléchargement de lot EN VOL au moment de « Se déconnecter » est enregistré après la purge, et la page
 *     /billet/hors-ligne (publique, sans session) montre de nouveau le billet de A.                              TROU
 *  5. « Déconnecter tous mes appareils » depuis un autre appareil : au retour sur le téléphone, le middleware efface les
 *     cookies, le navigateur ne reçoit jamais SIGNED_OUT, rien n'efface les billets hors ligne de A, toujours montrés. TROU
 *  6. Ancien jeton d'accès après « Se déconnecter » (révocation faite) : l'API REST (PostgREST) le refuse.         TROU (connu,
 *     lib/auth/sessions.ts:7-8 : « valable jusqu'à son expiration (1 h au plus) », supabase/config.toml jwt_expiry = 3600)
 *  7. « Déconnecter tous mes appareils » : le jeton d'accès de l'AUTRE appareil est refusé par l'API REST.        TROU (même cause)
 *  8. « Déconnecter tous mes appareils » : les abonnements push des autres appareils sont retirés côté serveur.   TROU
 *  9. Fin de session signalée sans le bouton (SIGNED_OUT) : l'abonnement push de ce navigateur est retiré.       TROU
 * 10. Retour du réseau avec deux onglets, rafraîchissement de l'onglet 2 parti avant la déconnexion (réponse en retard,
 *     avant ou après la révocation) : aucune session rouverte, tous les jetons révoqués, aucune autre requête avec l'ancien
 *     jeton.                                                                                                       BLOQUÉE
 * 11. Scanner : mémoire du contrôle (session, scan en attente avec le QR lu) effacée ; aucun code ni liste de billets gardé
 *     sur l'appareil ; aucune requête du scanner ne porte de jeton explicite (cookies seulement).                  BLOQUÉE
 * 12. Caches du service worker : après une session complète (pages et API personnelles), rien de personnel en cache, donc
 *     rien à purger (public/sw.js exécuté dans node:vm, faux Cache API).                                          BLOQUÉE
 * 13. Inventaire : bases IndexedDB et caches nommés par l'application tous purgés ou sans donnée personnelle (BLOQUÉE) ;
 *     clés de stockage web liées au compte toutes effacées à la déconnexion (liens de paiement en sessionStorage). TROU faible
 * Non vérifiable dans Node (dit au rapport) : rendu React (écouteurs et écrans lus dans le code), vrai service worker et vrai
 * cache HTTP du navigateur, onglet gelé ou en cache de retour (bfcache), WebView sans BroadcastChannel.
 * Écrit en base (comptes, abonnements push retirés en fin de test) : after() → assertFinition1Invariants. Sortie `[CVF2B-6]`.
 */
import '../helpers/env';
import { after, afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createBrowserClient } from '@supabase/ssr';
import { createClient, type Session } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { POST as signOutGlobal } from '../../app/api/auth/sign-out-global/route';
import { middleware } from '../../middleware';
import { dropLocalSession, revokeHeld, revokeSoon, type HeldTokens } from '../../lib/auth/sign-out-here';
import { clearOfflineStore } from '../../lib/tickets/offline-store';
import { listCurrentOfflineLots, saveOfflineLot, setCurrentOfflineUser } from '../../lib/tickets/offline-lots';
import type { OfflineAvailability, OfflineLot } from '../../lib/tickets/offline-clock';
import { clearAllScanMemory, readPendingScan, readScanSession, saveScanSession, savePendingScan, SCAN_MEMORY_PREFIXES } from '../../lib/scan/scan-session';
import { gotrueEmail } from '../helpers/gotrue-email';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from '../parcours/helpers';
import {
    authProviderParts, brief, cookieJarOptions, fakeSession, FakeStorage, installIndexedDB, installWindow, lotResponse, openTabs,
    read, ROOT, sessionCookieNames, sourceFiles, storedLot, stripComments, uninstallWindow, waitFor,
} from './cvf2b-56-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const anon = () => createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Réseau : enveloppe du fetch global (verrou de tests/helpers/env.ts gardé dessous) ───────────────────────────────
interface Sent { method: string; url: string; auth: string; body: string }
const sent: Sent[] = [];
const net = { offline: false, holdRefresh: false };
const heldRequests: Array<() => void> = [];
const issuedToHeld: Array<{ access: string; refresh: string }> = [];
/** Routes relatives de l'application servies par le test (réponse contrôlée). */
const appRoutes = new Map<string, () => Promise<Response>>();
const lockedFetch = globalThis.fetch;
const REVOCATION = /\/auth\/v1\/logout\?scope=local$|\/auth\/v1\/token\?grant_type=refresh_token$|^\/api\/auth\/sign-out-global$/;

globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    sent.push({ method: init?.method ?? 'GET', url, auth: headers.get('authorization') ?? '', body: typeof init?.body === 'string' ? init.body : '' });
    if (net.offline) throw new TypeError('fetch failed');
    if (url === '/api/auth/sign-out-global') return signOutGlobal(jsonRequest(url, {}, Object.fromEntries(headers)));
    const route = appRoutes.get(url);
    if (route) return route();
    if (net.holdRefresh && /\/auth\/v1\/token\?grant_type=refresh_token$/.test(url)) {
        await new Promise<void>((resolve) => heldRequests.push(resolve)); // zone sans données : la réponse arrive plus tard
        if (net.offline) throw new TypeError('fetch failed');
        const res = await lockedFetch(input, init);
        // Jetons émis par le serveur pour cette requête retardée (preuve : sont-ils révoqués à la fin ?)
        const issued = (await res.clone().json().catch(() => null)) as { access_token?: string; refresh_token?: string } | null;
        if (issued?.access_token && issued.refresh_token) issuedToHeld.push({ access: issued.access_token, refresh: issued.refresh_token });
        return res;
    }
    return lockedFetch(input, init);
}) as typeof fetch;

const pushRowsToDelete: string[] = [];
after(async () => {
    globalThis.fetch = lockedFetch;
    if (pushRowsToDelete.length > 0) await getServiceRoleClient().from('push_subscriptions').delete().in('id', pushRowsToDelete);
    await assertFinition1Invariants('cvf2b-6-deconnexion');
});
afterEach(() => {
    net.offline = false;
    net.holdRefresh = false;
    appRoutes.clear();
    uninstallWindow();
});

// ── Comptes et « navigateur » (auth-js en mode serveur : aucune globale window/document) ───────────────────────────
async function newAccount(label: string): Promise<string> {
    const service = getServiceRoleClient();
    const email = randomEmail(label);
    const phone = randomSenegalPhone('76');
    const { data, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
    assert.equal(error, null, `création : ${error?.message}`);
    const { error: upErr } = await service.from('users').update({ phone }).eq('id', data.user!.id);
    assert.equal(upErr, null, `profil : ${upErr?.message}`);
    return gotrueEmail(email);
}

function nodeBrowser(jar: Map<string, string>, events: string[]) {
    const client = createBrowserClient(SUPABASE_URL, ANON, { isSingleton: false, cookies: cookieJarOptions(jar) });
    client.auth.onAuthStateChange((event) => { events.push(event); });
    return client;
}

async function signIn(email: string): Promise<Session> {
    const { data, error } = await anon().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion : ${error?.message}`);
    return data.session!;
}

/** Lecture REST (PostgREST) du profil du compte avec un jeton donné. */
async function restProfile(token: string, userId: string): Promise<{ status: number; body: string }> {
    const r = await lockedFetch(`${SUPABASE_URL}/rest/v1/users?select=id,phone&id=eq.${userId}`, { headers: { apikey: ANON, authorization: `Bearer ${token}` } });
    return { status: r.status, body: (await r.text()).slice(0, 300) };
}
const restRefused = (r: { status: number; body: string }) => r.status === 401 || r.status === 403 || r.body.trim() === '[]';

const carriesOld = (s: Sent, olds: string[]) => olds.some((t) => t && (s.auth.includes(t) || s.body.includes(t)));

/** Bus d'événements de la fenêtre pour lib/auth/sign-out-here (addEventListener global, « online »). */
function installBus(): { bus: EventTarget; remove: () => void } {
    const bus = new EventTarget();
    const g = globalThis as unknown as Record<string, unknown>;
    g.addEventListener = bus.addEventListener.bind(bus);
    g.removeEventListener = bus.removeEventListener.bind(bus);
    return { bus, remove: () => { delete g.addEventListener; delete g.removeEventListener; } };
}

const OFFLINE_OK: OfflineAvailability = { secret_version: 1, available: true, available_from: null, available_until: null, reason: null };

// ── 1-2. Tous les onglets ───────────────────────────────────────────────────────────────────────────────────────────
describe('1-2. tous les onglets', () => {
    test('1. l’onglet 2 reçoit SIGNED_OUT et efface billets hors ligne et mémoire du contrôle', async () => {
        const shared = new FakeStorage();
        installWindow(shared);
        installIndexedDB();
        const A = randomUUID();
        const T = randomUUID();
        await setCurrentOfflineUser(A);
        await saveOfflineLot(A, storedLot(T) as unknown as OfflineLot);
        saveScanSession('controleur', A, { eventId: randomUUID(), assignmentId: randomUUID(), mode: 'camera', area: 'controle' });
        const jar = new Map<string, string>();
        const { tabs: [one, two], close } = openTabs(2, jar);
        try {
            const auth1 = one.client.auth as unknown as { _saveSession(s: unknown): Promise<void>; _notifyAllSubscribers(e: string, s: unknown): Promise<void> };
            const s = fakeSession(A);
            await auth1._saveSession(s);
            await auth1._notifyAllSubscribers('SIGNED_IN', s);
            await dropLocalSession(one.client.auth);
            const got = await waitFor(() => two.events.includes('SIGNED_OUT'));
            const { signedOut } = authProviderParts();
            console.log(`[CVF2B-6] 1. onglet 2 : ${two.events.join(', ')} ; branche SIGNED_OUT : ${brief(signedOut.replace(/\s+/g, ' '), 300)}`);
            assert.ok(got, `SIGNED_OUT non reçu par l'onglet 2 : ${two.events.join(', ')}`);
            for (const purge of ['clearOfflineStore()', 'clearAllScanMemory();', 'clearAllDrafts();']) {
                assert.ok(signedOut.includes(purge), `AuthProvider, SIGNED_OUT : ${purge} absent`);
            }
            // Ce que fait l'onglet 2 sur SIGNED_OUT (mêmes fonctions)
            assert.equal(await clearOfflineStore(), true, 'clearOfflineStore a échoué');
            clearAllScanMemory();
            const lots = await listCurrentOfflineLots();
            console.log(`[CVF2B-6] 1. après : lots ${brief(lots)} ; clés ${brief(shared.keys())}`);
            assert.deepEqual(lots, { userId: null, lots: [] }, `billets hors ligne restants : ${brief(lots)}`);
            assert.deepEqual(shared.keys().filter((k) => SCAN_MEMORY_PREFIXES.some((p) => k.startsWith(p))), [], `mémoire du contrôle restante : ${brief(shared.keys())}`);
        } finally {
            close();
        }
    });

    test('2. autres onglets : un écran personnel déjà affiché ne reste pas à l’écran après SIGNED_OUT', () => {
        const { signedOut, full } = authProviderParts();
        // Solution globale : l'écran « Vous êtes déconnecté de ce téléphone. » remplace la page dans TOUS les onglets
        const global = /setSignedOut\(true\)/.test(signedOut);
        const spaces: Array<{ name: string; files: string[] }> = [
            { name: 'Mes billets', files: ['app/tickets/page.tsx'] },
            { name: 'Profil', files: ['app/profile/page.tsx'] },
            { name: 'Notifications', files: ['app/notifications/page.tsx'] },
            { name: 'Commandes', files: ['app/orders/page.tsx'] },
            { name: 'Espace partenaire', files: ['app/partner/layout.tsx'] },
            { name: 'Administration', files: ['app/admin/layout.tsx', 'components/admin/AdminStepUpGate.tsx'] },
            { name: 'Contrôleur (scanner, profil)', files: ['app/controller/layout.tsx'] },
            { name: 'Portefeuille', files: ['app/wallet/page.tsx'] },
        ];
        const guard = /\bisAuthenticated\b|!\s*user\b(?!\?)|\buser\s*===\s*null|!\s*session\b(?!\?)/;
        const rows = spaces.map((sp) => ({ ...sp, guarded: sp.files.some((f) => fs.existsSync(path.join(ROOT, f)) && guard.test(stripComments(read(f)))) }));
        for (const r of rows) console.log(`[CVF2B-6] 2. ${r.name} (${r.files.join(', ')}) : ${r.guarded ? 'garde sur la perte du compte' : 'AUCUNE garde'}`);
        console.log(`[CVF2B-6] 2. AuthProvider masque la page sur SIGNED_OUT dans tous les onglets : ${global} ; écran « déconnecté » posé seulement par signOut : ${/setSignedOut\(true\)/.test(full)}`);
        const naked = rows.filter((r) => !r.guarded).map((r) => r.name);
        assert.ok(global || naked.length === 0,
            `après « Se déconnecter » dans un onglet, les autres onglets gardent à l'écran : ${naked.join(', ')} (SIGNED_OUT n'y pose pas l'écran « déconnecté », setSignedOut(true) n'est appelé que par signOut dans l'onglet du bouton)`);
    });
});

// ── 3-5. Billets hors ligne (IndexedDB) ────────────────────────────────────────────────────────────────────────────
describe('3-5. billets hors ligne (IndexedDB)', () => {
    test('3. purge réelle à la déconnexion et à la désignation d’un autre compte', async () => {
        installWindow();
        const idb = installIndexedDB();
        const A = randomUUID();
        const B = randomUUID();
        await setCurrentOfflineUser(A);
        await saveOfflineLot(A, storedLot(randomUUID()) as unknown as OfflineLot);
        const before = await listCurrentOfflineLots();
        assert.equal(await clearOfflineStore(), true);
        const afterClear = await listCurrentOfflineLots();
        await setCurrentOfflineUser(A);
        await saveOfflineLot(A, storedLot(randomUUID()) as unknown as OfflineLot);
        await setCurrentOfflineUser(B);
        const rowsOfA = idb.rows('event-village-offline', 'lots').filter((r) => r.userId === A);
        console.log(`[CVF2B-6] 3. avant ${before.lots.length} lot(s) de ${before.userId === A ? 'A' : before.userId} ; après purge ${brief(afterClear)} ; lots de A après désignation de B : ${rowsOfA.length}`);
        assert.equal(before.lots.length, 1);
        assert.deepEqual(afterClear, { userId: null, lots: [] }, `purge incomplète : ${brief(afterClear)}`);
        assert.equal(rowsOfA.length, 0, `lots de A gardés après la désignation de B : ${brief(rowsOfA)}`);
        assert.equal(await clearOfflineStore(), true);
    });

    test('4. téléchargement en vol pendant « Se déconnecter » : rien de A n’est réécrit ni montré après la purge', async () => {
        installWindow();
        const idb = installIndexedDB();
        assert.equal(await clearOfflineStore(), true);
        const A = randomUUID();
        const T = randomUUID();
        let release!: () => void;
        const gate = new Promise<void>((r) => { release = r; });
        let called = 0;
        appRoutes.set(`/api/tickets/${T}/offline-codes`, async () => {
            called += 1;
            await gate; // réponse 200 du serveur, partie avec les cookies de A AVANT la déconnexion, reçue après
            return new Response(JSON.stringify(lotResponse(T)), { status: 200, headers: { 'content-type': 'application/json' } });
        });
        const sync = (await import('../../components/tickets/OfflineTicketsSync')) as unknown as {
            ensureOfflineLot(userId: string, ticketId: string, offline: OfflineAvailability): Promise<{ kind: string }>;
        };
        const pending = sync.ensureOfflineLot(A, T, OFFLINE_OK);
        assert.ok(await waitFor(() => called === 1), 'téléchargement du lot non parti');
        // « Se déconnecter » (AuthProvider.signOut : clearOfflineStore, puis cookies effacés)
        assert.equal(await clearOfflineStore(), true);
        const atSignOut = await listCurrentOfflineLots();
        release();
        const outcome = await pending;
        const shown = await listCurrentOfflineLots();
        const rows = idb.rows('event-village-offline', 'lots').map((r) => ({ userId: r.userId, ticketId: r.ticketId, codes: (r.lot as { codes?: string }).codes }));
        console.log(`[CVF2B-6] 4. à la déconnexion : ${brief(atSignOut)} ; issue du téléchargement : ${outcome.kind} ; page hors ligne ensuite : compte ${shown.userId === A ? 'A' : shown.userId}, ${shown.lots.length} billet(s) ; IndexedDB : ${brief(rows)}`);
        assert.deepEqual(atSignOut, { userId: null, lots: [] });
        assert.deepEqual({ userId: shown.userId, lots: shown.lots.length, rows: rows.length }, { userId: null, lots: 0, rows: 0 },
            `après la déconnexion, la réponse en vol a réécrit le compte courant et le lot de A (OfflineTicketsSync.downloadIfNeeded : setCurrentOfflineUser puis saveOfflineLot sans vérifier que la session existe encore) ; /billet/hors-ligne montre ${shown.lots.length} billet(s) de A avec ses codes : ${brief(rows)}`);
    });

    test('5. « Déconnecter tous mes appareils » depuis un autre appareil : le téléphone efface les billets hors ligne de A', async () => {
        installIndexedDB();
        assert.equal(await clearOfflineStore(), true);
        const email = await newAccount('cvf2b6-partout-billets');
        const jar = new Map<string, string>();
        const phone = nodeBrowser(jar, []);
        const { data, error } = await phone.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion du téléphone : ${error?.message}`);
        const uid = data.user!.id;
        const T = randomUUID();
        await setCurrentOfflineUser(uid);
        await saveOfflineLot(uid, storedLot(T) as unknown as OfflineLot);

        // Autre appareil : « Déconnecter tous mes appareils » (route réelle)
        const other = await signIn(email);
        const res = await signOutGlobal(jsonRequest('/api/auth/sign-out-global', {}, { authorization: `Bearer ${other.access_token}` }));
        assert.equal(res.status, 200, `sign-out-global : HTTP ${res.status}`);

        // Le téléphone revient : première page (start_url « / » du manifeste) par le middleware
        const req = new NextRequest('http://127.0.0.1:3000/', { headers: { cookie: Array.from(jar, ([n, v]) => `${n}=${v}`).join('; ') } });
        const mw = await middleware(req);
        const setCookies = mw.cookies.getAll().map((c) => `${c.name}=${c.value ? 'valeur' : '(vide)'}`);
        for (const c of mw.cookies.getAll()) {
            if (c.value) jar.set(c.name, c.value);
            else jar.delete(c.name);
        }
        // Page chargée : client du navigateur neuf sur les cookies restants (AuthProvider monté)
        const events: string[] = [];
        const page = nodeBrowser(jar, events);
        await page.auth.getSession();
        await waitFor(() => events.includes('INITIAL_SESSION'));
        await sleep(200);
        const { listener } = authProviderParts();
        const silentPurge = /event === 'INITIAL_SESSION'[^{]*\{[^}]*clearOfflineStore/.test(listener) || /if \(!nextUserId\)[^{]*\{[^}]*clearOfflineStore/.test(listener);
        const still = await listCurrentOfflineLots();
        const offlinePage = stripComments(read('app/billet/hors-ligne/page.tsx'));
        console.log(`[CVF2B-6] 5. middleware « / » : HTTP ${mw.status}, cookies posés ${brief(setCookies)} ; cookies de session restants ${brief(sessionCookieNames(jar))} ; événements de la page : ${events.join(', ')}`);
        console.log(`[CVF2B-6] 5. purge d'AuthProvider sans SIGNED_OUT : ${silentPurge} ; /billet/hors-ligne lit listCurrentOfflineLots sans session : ${/listCurrentOfflineLots\(\)/.test(offlinePage) && !/useAuth|getSession/.test(offlinePage)} ; billets montrés : compte ${still.userId === uid ? 'A' : still.userId}, ${brief(still.lots.map((l) => ({ ticket: l.ticket.ticket_number, codes: l.codes })))}`);
        assert.ok(events.includes('SIGNED_OUT') || silentPurge,
            `le téléphone ne reçoit pas SIGNED_OUT (événements : ${events.join(', ')} ; cookies effacés par le middleware) et AuthProvider ne purge rien sans lui : les billets hors ligne de A restent et /billet/hors-ligne les montre (${still.lots.length} billet(s), codes ${brief(still.lots.map((l) => l.codes))})`);
        assert.equal(await clearOfflineStore(), true);
    });
});

// ── 6-9. Révocation côté serveur ───────────────────────────────────────────────────────────────────────────────────
describe('6-9. révocation côté serveur', () => {
    test('6. « Se déconnecter » (révocation faite) : l’ancien jeton d’accès est refusé par l’API REST', async () => {
        const email = await newAccount('cvf2b6-rest-local');
        const s = await signIn(email);
        const uid = s.user.id;
        const before = await restProfile(s.access_token, uid);
        const pending: HeldTokens = { access: s.access_token, refresh: s.refresh_token, everywhere: false };
        const revoked = await revokeHeld(pending);
        const gotrue = (await anon().auth.getUser(s.access_token)).data.user?.id ?? null;
        const afterRev = await restProfile(s.access_token, uid);
        console.log(`[CVF2B-6] 6. avant : ${before.status} ${before.body} ; révocation : ${revoked} ; GoTrue /user avec l'ancien jeton : ${gotrue ?? 'refusé'} ; REST avec l'ancien jeton : HTTP ${afterRev.status} ${afterRev.body}`);
        assert.equal(before.status, 200, 'témoin : le jeton ouvre le profil avant la déconnexion');
        assert.equal(revoked, 'fait');
        assert.equal(gotrue, null, 'GoTrue accepte encore l’ancien jeton');
        assert.ok(restRefused(afterRev), `l'ancien jeton d'accès lit encore les données du compte par l'API REST après la révocation : HTTP ${afterRev.status} ${afterRev.body}`);
    });

    test('7. « Déconnecter tous mes appareils » : le jeton d’accès de l’autre appareil est refusé par l’API REST', async () => {
        const email = await newAccount('cvf2b6-rest-partout');
        const here = await signIn(email);
        const there = await signIn(email);
        const uid = here.user.id;
        const revoked = await revokeHeld({ access: here.access_token, refresh: here.refresh_token, everywhere: true });
        const gotrue = (await anon().auth.getUser(there.access_token)).data.user?.id ?? null;
        const refresh = await anon().auth.refreshSession({ refresh_token: there.refresh_token });
        const rest = await restProfile(there.access_token, uid);
        console.log(`[CVF2B-6] 7. révocation partout : ${revoked} ; autre appareil — GoTrue : ${gotrue ?? 'refusé'}, rafraîchissement : ${refresh.error ? 'refusé' : 'ACCEPTÉ'}, REST : HTTP ${rest.status} ${rest.body}`);
        assert.equal(revoked, 'fait');
        assert.equal(gotrue, null);
        assert.ok(refresh.error, 'jeton de rafraîchissement de l’autre appareil accepté');
        assert.ok(restRefused(rest), `le jeton d'accès de l'autre appareil lit encore les données du compte par l'API REST après « Déconnecter tous mes appareils » : HTTP ${rest.status} ${rest.body}`);
    });

    test('8. « Déconnecter tous mes appareils » : les abonnements push des autres appareils sont retirés côté serveur', async () => {
        const service = getServiceRoleClient();
        const email = await newAccount('cvf2b6-push-partout');
        const here = await signIn(email);
        const uid = here.user.id;
        const { data: row, error } = await service.from('push_subscriptions').insert({
            user_id: uid, endpoint: `https://push.invalid/cvf2b6/${randomUUID()}`, p256dh: randomBytes(65).toString('base64url'),
            auth: randomBytes(16).toString('base64url'), vapid_key_id: randomBytes(12).toString('base64url'), user_agent: 'Téléphone partagé (CVF2B-6)',
        }).select('id').single();
        assert.equal(error, null, `abonnement de l'autre appareil : ${error?.message}`);
        pushRowsToDelete.push((row as { id: string }).id);
        const revoked = await revokeHeld({ access: here.access_token, refresh: here.refresh_token, everywhere: true });
        const { data: left, error: readErr } = await service.from('push_subscriptions').select('id, user_agent').eq('user_id', uid);
        assert.equal(readErr, null, readErr?.message);
        console.log(`[CVF2B-6] 8. révocation partout : ${revoked} ; abonnements push du compte restants : ${brief(left)}`);
        assert.equal(revoked, 'fait');
        assert.deepEqual(left, [], `après « Déconnecter tous mes appareils », l'autre appareil reste abonné aux notifications du compte (push_subscriptions) : ${brief(left)} — app/api/auth/sign-out-global/route.ts ne fait que revokeUserSessions`);
    });

    test('9. fin de session signalée sans le bouton (SIGNED_OUT) : l’abonnement push de ce navigateur est retiré', () => {
        const { signedOut, signOut } = authProviderParts();
        console.log(`[CVF2B-6] 9. signOut retire l'abonnement : ${/unsubscribePush\(\)/.test(signOut)} ; branche SIGNED_OUT : ${brief(signedOut.replace(/\s+/g, ' '), 300)}`);
        assert.match(signedOut, /unsubscribePush\(\)/,
            'SIGNED_OUT venu d’ailleurs (« Déconnecter tous mes appareils » depuis un autre appareil, jeton de rafraîchissement refusé, mot de passe réinitialisé) : l’abonnement push de ce navigateur est gardé — seul le bouton signOut appelle unsubscribePush');
    });
});

// ── 10. Retour du réseau avec deux onglets ─────────────────────────────────────────────────────────────────────────
describe('10. retour du réseau, deux onglets, rafraîchissement en vol', () => {
    for (const order of ['réponse de l’onglet 2 avant la révocation', 'réponse de l’onglet 2 après la révocation'] as const) {
        test(`10. ${order} : aucune session rouverte, jetons révoqués`, async () => {
            const email = await newAccount('cvf2b6-onglets');
            const jar = new Map<string, string>();
            const ev1: string[] = [];
            const ev2: string[] = [];
            const tab1 = nodeBrowser(jar, ev1);
            const { data, error } = await tab1.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
            assert.equal(error, null, `connexion : ${error?.message}`);
            const s = data.session!;
            // Deux heures plus tard : jeton échu pour le navigateur, signature refusée par le serveur
            const tampered = s.access_token.slice(0, -4) + (s.access_token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
            await (tab1.auth as unknown as { _saveSession(x: Session): Promise<void> })._saveSession({ ...s, access_token: tampered, expires_at: Math.floor(Date.now() / 1000) - 3600 });
            const tab2 = nodeBrowser(jar, ev2);
            await tab2.auth.initialize();
            // Onglet 2 dans une zone sans données : sa lecture de session (jeton échu) lance un rafraîchissement, la réponse
            // arrivera plus tard (après « Se déconnecter » dans l'onglet 1)
            issuedToHeld.length = 0;
            net.holdRefresh = true;
            const t2 = tab2.auth.getSession();
            assert.ok(await waitFor(() => heldRequests.length >= 1), 'rafraîchissement de l’onglet 2 non parti');
            net.offline = true;
            await dropLocalSession(tab1.auth);
            assert.deepEqual(sessionCookieNames(jar), [], 'cookies effacés tout de suite');
            const { bus, remove } = installBus();
            let finished!: () => void;
            const done = new Promise<void>((r) => { finished = r; });
            try {
                revokeSoon({ access: tampered, refresh: s.refresh_token, everywhere: false }, () => { void dropLocalSession(tab1.auth).then(finished); });
                await sleep(50);
                const mark = sent.length;
                net.offline = false;
                net.holdRefresh = false;
                let r2: Awaited<typeof t2> | null = null;
                let reopened: string[] = [];
                if (order === 'réponse de l’onglet 2 avant la révocation') {
                    heldRequests.splice(0).forEach((go) => go());
                    r2 = await t2;
                    reopened = sessionCookieNames(jar);
                    bus.dispatchEvent(new Event('online'));
                    await Promise.race([done, sleep(20_000)]);
                } else {
                    bus.dispatchEvent(new Event('online'));
                    await Promise.race([done, sleep(20_000)]);
                    heldRequests.splice(0).forEach((go) => go());
                    r2 = await t2;
                    reopened = sessionCookieNames(jar);
                }
                await sleep(300);
                const newer = issuedToHeld[0] ? { access_token: issuedToHeld[0].access, refresh_token: issuedToHeld[0].refresh } : null;
                const finalCookies = sessionCookieNames(jar);
                const s1 = (await tab1.auth.getSession()).data.session;
                const s2 = (await tab2.auth.getSession()).data.session;
                const olds = [s.access_token, tampered, s.refresh_token];
                const leaks = sent.slice(mark).filter((x) => carriesOld(x, olds) && !REVOCATION.test(x.url.replace(SUPABASE_URL, '')));
                const newerAccess = newer ? (await anon().auth.getUser(newer.access_token)).data.user?.id ?? null : null;
                const newerRefresh = newer ? (await anon().auth.refreshSession({ refresh_token: newer.refresh_token })).error : 'aucune nouvelle session';
                const oldRefresh = (await anon().auth.refreshSession({ refresh_token: s.refresh_token })).error;
                console.log(`[CVF2B-6] 10. ${order} : onglet 2 → ${r2?.error ? `erreur ${r2.error.name}` : r2?.data.session ? 'SESSION GARDÉE' : 'aucune session'}, jetons émis par le serveur à sa requête retardée : ${newer ? 'oui' : 'non'} ; cookies juste après : ${brief(reopened)} ; à la fin : ${brief(finalCookies)} ; onglet 1 ${ev1.join(', ')} ; onglet 2 ${ev2.join(', ')}`);
                console.log(`[CVF2B-6] 10. requêtes après le retour du réseau : ${sent.slice(mark).map((x) => x.url.replace(SUPABASE_URL, '')).join(' | ')}`);
                assert.deepEqual(finalCookies, [], `session rouverte dans le navigateur : ${brief(finalCookies)}`);
                assert.equal(s1, null, 'onglet 1 : session lue');
                assert.equal(s2, null, 'onglet 2 : session lue');
                assert.deepEqual(leaks.map((x) => `${x.method} ${x.url}`), [], 'requête avec l’ancien jeton hors révocation');
                assert.equal(newerAccess, null, 'jeton d’accès obtenu par l’onglet 2 encore accepté par GoTrue');
                assert.ok(newerRefresh, 'jeton de rafraîchissement obtenu par l’onglet 2 encore accepté');
                assert.ok(oldRefresh, 'ancien jeton de rafraîchissement accepté');
            } finally {
                heldRequests.splice(0).forEach((go) => go());
                remove();
            }
        });
    }
});

// ── 11. Scanner ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('11. scanner', () => {
    test('mémoire du contrôle effacée ; aucun code ni liste de billets sur l’appareil ; aucun jeton explicite', () => {
        const w = installWindow();
        const A = randomUUID();
        const eventId = randomUUID();
        saveScanSession('controleur', A, { eventId, assignmentId: randomUUID(), mode: 'camera', area: 'controle' });
        savePendingScan('controleur', A, { key: randomUUID(), eventId, request: { eventId, payload: 'EVT1:QR-DU-SPECTATEUR:123456' }, createdAt: Date.now() });
        savePendingScan('partenaire', A, { key: randomUUID(), eventId, request: { eventId, manualTicketNumber: 'EV-0001', identityVerified: true }, createdAt: Date.now() });
        const before = w.localStorage.keys();
        clearAllScanMemory();
        const left = w.localStorage.keys();
        const pending = readPendingScan('controleur', A);
        const session = readScanSession('controleur', A);

        const files = sourceFiles(['app/controller', 'app/partner/scan', 'app/scan', 'lib/scan', 'components/scan']);
        const src = files.map((f) => ({ f, s: stripComments(read(f)) }));
        const forbidden = src.flatMap(({ f, s }) => [/\bindexedDB\b/, /\bcaches\./, /\bsessionStorage\b/, /Authorization['"]?\s*:\s*`Bearer/, /access_token/]
            .filter((re) => re.test(s)).map((re) => `${f} : ${re.source}`));
        const writes = src.flatMap(({ f, s }) => [...s.matchAll(/localStorage\.setItem\(\s*([^,]+),/g)].map((x) => `${f} : ${x[1].trim()}`));
        const keyPrefixes = [...stripComments(read('lib/scan/scan-session.ts')).matchAll(/keyOf\((SCAN_\w+_PREFIX)/g)].map((x) => x[1]);
        console.log(`[CVF2B-6] 11. avant ${brief(before)} ; après ${brief(left)} ; scan en attente relu ${brief(pending)} ; session relue ${brief(session)}`);
        console.log(`[CVF2B-6] 11. ${files.length} fichiers du scanner ; interdits : ${brief(forbidden)} ; écritures directes localStorage : ${brief(writes)} ; préfixes des clés de scan-session : ${brief([...new Set(keyPrefixes)])}`);
        assert.ok(before.length >= 3, `mémoire du contrôle non écrite : ${brief(before)}`);
        assert.deepEqual(left, [], `mémoire du contrôle restante (QR lu compris) : ${brief(left)}`);
        assert.deepEqual(pending, { pending: null, expired: null });
        assert.equal(session, null);
        assert.deepEqual(forbidden, [], 'le scanner garde des données hors de la mémoire purgée ou porte un jeton explicite');
        assert.deepEqual(writes.filter((x) => !/: AUTO_RETURN_KEY$/.test(x)), [], 'écriture locale du scanner hors de la mémoire purgée (seul le délai de retour automatique, réglage sans donnée personnelle, est admis)');
        assert.ok(keyPrefixes.length > 0 && keyPrefixes.every((p) => ['SCAN_SESSION_PREFIX', 'SCAN_PENDING_PREFIX'].includes(p)), `clé du scanner hors des préfixes purgés : ${brief(keyPrefixes)}`);
    });
});

// ── 12. Service worker ─────────────────────────────────────────────────────────────────────────────────────────────
describe('12. caches du service worker', () => {
    test('après une session complète, rien de personnel en cache (donc rien à purger à la déconnexion)', async () => {
        const ORIGIN = 'https://app.eventvillage.sn';
        const MARK = 'DONNEE-PERSONNELLE-CVF2B6 +221770000001';
        const SHELL = '<!doctype html><html><head><link rel="stylesheet" href="/_next/static/css/app.css"></head><body><script src="/_next/static/chunks/app-1.js"></script></body></html>';
        const res = (p: string, text: string, ctype: string): Record<string, unknown> => {
            const make = (): Record<string, unknown> => ({
                url: `${ORIGIN}${p}`, status: 200, ok: true, type: 'basic', redirected: false, headers: new Headers({ 'content-type': ctype }),
                text: async () => text, json: async () => JSON.parse(text), clone: () => make(), body: text,
            });
            return make();
        };
        const fetches: Array<{ url: string; credentials: unknown }> = [];
        const store = new Map<string, Map<string, Record<string, unknown>>>();
        const key = (r: unknown) => new URL(typeof r === 'string' ? r : String((r as { url?: unknown }).url), ORIGIN).href;
        const cacheOf = (name: string) => {
            if (!store.has(name)) store.set(name, new Map());
            const m = store.get(name)!;
            return {
                put: async (r: unknown, v: Record<string, unknown>) => { m.set(key(r), v); },
                match: async (r: unknown, o: { ignoreSearch?: boolean } = {}) => {
                    const k = key(r);
                    for (const [kk, v] of m) if (kk === k || (o.ignoreSearch && kk.split('?')[0] === k.split('?')[0])) return (v.clone as () => unknown)();
                    return undefined;
                },
                keys: async () => [...m.keys()].map((u) => ({ url: u })),
                delete: async (r: unknown) => m.delete(key(r)),
            };
        };
        const caches = {
            open: async (n: string) => cacheOf(n),
            keys: async () => [...store.keys()],
            delete: async (n: string) => store.delete(n),
            match: async (r: unknown, o: { ignoreSearch?: boolean; cacheName?: string } = {}) => {
                for (const n of store.keys()) {
                    if (o.cacheName && o.cacheName !== n) continue;
                    const hit = await cacheOf(n).match(r, o);
                    if (hit) return hit;
                }
                return undefined;
            },
        };
        const listeners = new Map<string, Array<(e: unknown) => void>>();
        const sandbox: Record<string, unknown> = {
            addEventListener: (t: string, fn: (e: unknown) => void) => listeners.set(t, [...(listeners.get(t) ?? []), fn]),
            skipWaiting: async () => undefined,
            clients: { claim: async () => undefined, matchAll: async () => [], get: async (id: string) => (id === 'onglet-hors-ligne' ? { url: `${ORIGIN}/billet/hors-ligne` } : undefined), openWindow: async () => null },
            registration: { navigationPreload: { enable: async () => undefined }, showNotification: async () => undefined, pushManager: { getSubscription: async () => null } },
            location: new URL(`${ORIGIN}/sw.js`),
            caches,
            fetch: async (input: unknown, init: Record<string, unknown> = {}) => {
                const u = new URL(key(input));
                fetches.push({ url: u.pathname + u.search, credentials: init.credentials ?? (input as { credentials?: unknown })?.credentials });
                if (u.pathname === '/billet/hors-ligne') return res(u.pathname, SHELL, 'text/html');
                if (u.pathname.startsWith('/_next/static/')) return res(u.pathname, u.pathname.endsWith('.css') ? 'body{}' : 'void 0', u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript');
                if (u.pathname.startsWith('/api/')) return res(u.pathname, JSON.stringify({ phone: MARK, codes: '123456' }), 'application/json');
                if (/\.(?:json|ico|svg|png)$/.test(u.pathname)) return res(u.pathname, 'ressource publique', 'image/png');
                // Page personnelle SANS en-tête no-store (le service worker ne doit pas compter sur les en-têtes)
                return res(u.pathname, `<html><body>${MARK}</body></html>`, 'text/html');
            },
            console: { log: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
            URL, URLSearchParams, Response, Request, Headers, Blob, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout, queueMicrotask, structuredClone,
        };
        sandbox.self = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8'), sandbox, { filename: 'public/sw.js' });
        const dispatch = async (type: string, ev: Record<string, unknown>) => {
            const waits: Promise<unknown>[] = [];
            const responses: unknown[] = [];
            for (const fn of listeners.get(type) ?? []) fn({ ...ev, respondWith: (p: unknown) => responses.push(p), waitUntil: (p: unknown) => waits.push(Promise.resolve(p)) });
            for (const r of responses) await Promise.resolve(r).catch(() => undefined);
            await Promise.allSettled(waits);
            for (let i = 0; i < 5; i++) await sleep(0);
        };
        const fetchEvent = (p: string, mode: string, headers: Record<string, string> = {}, clientId = '') => ({
            request: { url: `${ORIGIN}${p}`, method: 'GET', mode, headers: new Headers(headers) }, clientId, preloadResponse: Promise.resolve(undefined),
        });
        await dispatch('install', {});
        await dispatch('activate', {});
        for (const p of ['/', '/tickets', '/profile', '/wallet', '/notifications', '/admin/dashboard', '/controller/scanner', '/partner/dashboard', '/billet/hors-ligne?id=x']) {
            await dispatch('fetch', fetchEvent(p, 'navigate'));
        }
        for (const p of ['/api/tickets', '/api/auth/me', `/api/tickets/${randomUUID()}/offline-codes`, '/api/controller/scans', '/api/wallet']) {
            await dispatch('fetch', fetchEvent(p, 'cors'));
        }
        await dispatch('fetch', fetchEvent('/tickets?_rsc=abc', 'cors', { RSC: '1' }));
        await dispatch('fetch', fetchEvent('/_next/static/chunks/page-billets.js', 'no-cors', {}, 'onglet-hors-ligne'));
        await dispatch('message', { data: { type: 'PREPARE_OFFLINE' } });
        const cached: Array<{ cache: string; url: string; body: string }> = [];
        for (const [name, m] of store) for (const [u, v] of m) cached.push({ cache: name, url: u, body: String(v.body ?? '') });
        const allowed = (u: string) => {
            const p = new URL(u).pathname;
            return p === '/billet/hors-ligne' || p.startsWith('/_next/static/') || /^\/(?:manifest\.json|favicon\.ico|branding\/|icon-|icons\/)/.test(p);
        };
        const shellFetch = fetches.filter((f) => f.url.startsWith('/billet/hors-ligne'));
        console.log(`[CVF2B-6] 12. caches : ${brief([...store.keys()])} ; ${cached.length} entrée(s) : ${brief(cached.map((c) => new URL(c.url).pathname), 600)}`);
        console.log(`[CVF2B-6] 12. téléchargements de la coquille : ${brief(shellFetch)}`);
        assert.ok(cached.length > 0, 'témoin : la coquille hors ligne est en cache');
        assert.deepEqual(cached.filter((c) => c.body.includes(MARK)).map((c) => c.url), [], 'donnée personnelle dans un cache du service worker');
        assert.deepEqual(cached.filter((c) => !allowed(c.url)).map((c) => c.url), [], 'chemin hors liste blanche en cache');
        assert.ok(shellFetch.length > 0 && shellFetch.every((f) => f.credentials === 'omit'), `coquille téléchargée avec les cookies : ${brief(shellFetch)}`);
    });
});

// ── 13. Inventaire des stockages ───────────────────────────────────────────────────────────────────────────────────
describe('13. inventaire des stockages du navigateur', () => {
    const files = sourceFiles(['app', 'components', 'lib', 'hooks', 'public']).filter((f) => !f.includes('.test.'));
    const src = new Map(files.map((f) => [f, stripComments(read(f))]));

    test('bases IndexedDB et caches : une seule base (purgée en entier), caches écrits par le seul service worker', () => {
        const idbOpen = [...src].filter(([, s]) => /indexedDB\.open\(/.test(s)).map(([f, s]) => `${f} : ${/indexedDB\.open\(\s*([^,)]+)/.exec(s)?.[1]}`);
        const cacheWriters = [...src].filter(([, s]) => /caches\.open\(|\bcache\.(?:put|add|addAll)\(/.test(s)).map(([f]) => f);
        const store = src.get('lib/tickets/offline-store.ts')!;
        const created = [...store.matchAll(/createObjectStore\('(\w+)'/g)].map((x) => x[1]).sort();
        const clear = store.slice(store.indexOf('export async function clearOfflineStore'));
        const cleared = [...clear.matchAll(/objectStore\((\w+)\)\.clear\(\)/g)].map((x) => x[1]);
        const constants = Object.fromEntries([...store.matchAll(/export const (\w+) = '(\w+)';/g)].map((x) => [x[1], x[2]]));
        const clearedNames = cleared.map((c) => constants[c] ?? c).sort();
        console.log(`[CVF2B-6] 13a. ouvertures IndexedDB : ${brief(idbOpen)} ; magasins créés ${brief(created)}, vidés par clearOfflineStore ${brief(clearedNames)} ; écrivains de caches : ${brief(cacheWriters)}`);
        assert.deepEqual(idbOpen, ["lib/tickets/offline-store.ts : 'event-village-offline'"], `autre base IndexedDB ouverte : ${brief(idbOpen)}`);
        assert.deepEqual(clearedNames, created, `magasins non vidés à la déconnexion : créés ${brief(created)}, vidés ${brief(clearedNames)}`);
        assert.deepEqual(cacheWriters, ['public/sw.js'], `cache écrit hors du service worker : ${brief(cacheWriters)}`);
    });

    test('clés de stockage web liées au compte : toutes effacées à la déconnexion (bouton et SIGNED_OUT)', () => {
        /** Écrivains connus ; `compte` : contenu propre au compte connecté ; `purge` : fonction appelée par AuthProvider. */
        const known: Record<string, { what: string; compte: boolean; purge: string | null }> = {
            'lib/events/local-draft.ts': { what: 'brouillons du formulaire d’événement (localStorage)', compte: true, purge: 'clearAllDrafts' },
            'lib/scan/scan-session.ts': { what: 'mémoire du contrôle, scan en attente avec le QR lu (localStorage)', compte: true, purge: 'clearAllScanMemory' },
            'lib/payments/payment-client.ts': { what: 'liens et QR de paiement de l’opérateur pour un paiement du compte (sessionStorage « event-village:paiement: »)', compte: true, purge: null },
            'app/events/[id]/page.tsx': { what: 'panier (catégories et quantités) gardé pendant la connexion, 30 min (sessionStorage)', compte: false, purge: null },
            'components/auth/LoginForm.tsx': { what: 'compteur d’échecs de connexion (localStorage)', compte: false, purge: null },
            'app/forgot-password/page.tsx': { what: 'compteur d’échecs ; drapeau « code vérifié » horodaté, sans valeur sans la session (sessionStorage)', compte: false, purge: null },
            'app/reset-password/page.tsx': { what: 'compteur d’échecs (localStorage)', compte: false, purge: null },
            'app/register/page.tsx': { what: 'numéro saisi à l’inscription, avant toute session, effacé à sa lecture par la connexion (sessionStorage)', compte: false, purge: null },
            'components/providers/ThemeProvider.tsx': { what: 'thème (localStorage)', compte: false, purge: null },
            'lib/events/city-preference.ts': { what: 'ville préférée de l’appareil, visiteurs compris (localStorage)', compte: false, purge: null },
            'app/controller/scanner/page.tsx': { what: 'délai de retour automatique du scanner (localStorage)', compte: false, purge: null },
        };
        const writers = [...src].filter(([, s]) => /\b(?:localStorage|sessionStorage)\b/.test(s) && /\.setItem\(/.test(s)).map(([f]) => f);
        const unknown = writers.filter((f) => !(f in known));
        const { signOut, signedOut } = authProviderParts();
        const rows = writers.filter((f) => f in known).map((f) => ({ f, ...known[f], effacee: known[f].purge !== null && signOut.includes(`${known[f].purge}(`) && signedOut.includes(`${known[f].purge}(`) }));
        for (const r of rows) console.log(`[CVF2B-6] 13b. ${r.f} : ${r.what} — ${r.compte ? (r.effacee ? 'liée au compte, effacée' : 'liée au compte, JAMAIS effacée à la déconnexion') : 'sans lien avec le compte connecté'}`);
        assert.deepEqual(unknown, [], `écriture dans le stockage web non classée (à relire) : ${brief(unknown)}`);
        const kept = rows.filter((r) => r.compte && !r.effacee).map((r) => `${r.f} (${r.what})`);
        assert.deepEqual(kept, [], `données du compte gardées dans le stockage de l'onglet après « Se déconnecter » : ${kept.join(' ; ')}`);
    });
});
