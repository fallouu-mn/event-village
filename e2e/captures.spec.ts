/**
 * Lot 5.1 — captures d'écran des écrans du lot (contrat P).
 *
 * Projets « mobile » (390×844, DPR 2) et « desktop » (1440×900) ; dans chacun, thèmes clair et
 * sombre (localStorage['ev-theme'] posé avant le chargement + colorScheme). Une capture par
 * écran, vue et thème : .e2e-captures/captures/<écran>__<mobile|ordinateur>__<clair|sombre>.png.
 * La capture est faite même si un contrôle échoue ; le test échoue ensuite sur les contrôles
 * bloquants (défilement horizontal à 390 px, « § », enum brut, erreur de console, requête en
 * échec ; lot 7 : règles axe, cibles < 44 px, textes < 14 px hors exemption, contraste du scanner).
 * Lot 6 (contrat P1) : `stubResponse` (réponse d'API valide imposée, ex. liste vide) et `fakePush` (état
 * du push simulé par e2e/support/fake-push.ts ; en mode « granted », l'abonnement vient du faux service
 * push, POST /__test/push/subscribers). Chaque simulation est écrite dans les notes de l'index.
 *
 * Lot 7 (contrat 11.2, D84, D85, T23 ; commit fix(7.7)) — modifications signalées :
 *  - attente des captures (D84) : l'attente « réseau au repos 15 s » (jamais atteinte dans 164 captures sur 172 au
 *    lot 6) est remplacée par : `ready` de l'écran, polices chargées, aucune requête /api/ en cours depuis 500 ms
 *    (compteur du PageGuard), plafonné à 3 s ; une attente non aboutie est notée dans l'index, jamais ignorée ;
 *    images chargées (plafond 5 s, noté sinon) ;
 *  - contrôles axe, 44 px et 14 px bloquants (checks.ts) ; contraste du plein écran du scanner ≥ 7:1 ;
 *  - champs de Screen : views, serviceWorkers, offline, initStorage, stubResponses, holdRequests, slowTimers,
 *    fakeCamera 'barcode-detector', expectStatus (screens.ts) ;
 *  - contrôle ponctuel bloquant : cloche ouverte à 390 px, « Tout marquer comme lu » sur une seule ligne (§4.6) ;
 *  - rôle « partenaire-premiers-pas » (partenaire validé sans événement, première utilisation).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
import { runPageChecks } from './support/checks';
import { writeCaptureRecord, type CaptureRecord } from './support/capture-record';
import { CAPTURES_DIR, readDemoIds, type DemoIds } from './support/demo-ids';
import { e2eConfig } from './support/env';
import { fakeScanMode, installFakeCamera } from './support/fake-camera';
import { installFakePush, type FakePushSubscriptionJson } from './support/fake-push';
import type { PageGuard } from './support/network';
import { SCREENS, type CaptureView, type Screen, type StubResponse } from './support/screens';

/** Abonné neuf du faux service push (clés P-256 réelles), pour l'état « activé » simulé. */
async function fakePushSubscriber(): Promise<FakePushSubscriptionJson> {
    const url = `${e2eConfig().fakeServicesUrl}/__test/push/subscribers`;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const text = await res.text();
    if (res.status !== 201) throw new Error(`[e2e] faux service push : POST /__test/push/subscribers → HTTP ${res.status} ${text.slice(0, 200)}`);
    let body: Partial<FakePushSubscriptionJson>;
    try {
        body = JSON.parse(text) as Partial<FakePushSubscriptionJson>;
    } catch (err) {
        throw new Error(`[e2e] faux service push : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    if (typeof body.endpoint !== 'string' || typeof body.keys?.p256dh !== 'string' || typeof body.keys?.auth !== 'string') {
        throw new Error(`[e2e] faux service push : abonnement incomplet ${text.slice(0, 200)}`);
    }
    return { endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } };
}

const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
    { key: 'clair', colorScheme: 'light' },
    { key: 'sombre', colorScheme: 'dark' },
];
/**
 * Lot 9 bis (7.3, B114) : fumee-superadmin porte admin-remboursements-a-reprendre (existante, passée de admin à ce rôle
 * par test(9b.e2e) 0d9cfb6b), admin-versements-marquer-verse et admin-fiche-partenaire-suspendre. Absent de cette
 * liste au run 118, ses trois écrans n'ont pas tourné et la capture existante a disparu sans échec : tout rôle d'un
 * écran de SCREENS doit désormais figurer ici, sinon la phase échoue au chargement (contrôle ci-dessous).
 */
const ROLE_ORDER: readonly CaptureRole[] = ['anonyme', 'client', 'organisateur', 'partenaire-premiers-pas', 'admin', 'fumee-superadmin', 'controleur'];
const ROLES_WITHOUT_ORDER = Array.from(new Set(SCREENS.map((s) => s.role))).filter((r) => !ROLE_ORDER.includes(r));
if (ROLES_WITHOUT_ORDER.length > 0) {
    throw new Error(`[e2e] rôles d'écrans absents de ROLE_ORDER (leurs captures ne tourneraient pas) : ${ROLES_WITHOUT_ORDER.join(', ')} — écrans : ${
        SCREENS.filter((s) => ROLES_WITHOUT_ORDER.includes(s.role)).map((s) => s.id).join(', ')}`);
}

/** D84 : requêtes /api/ au repos depuis 500 ms, plafond de 3 s. */
const API_QUIET_MS = 500;
const SETTLE_CAP_MS = 3_000;
const IMAGES_CAP_MS = 5_000;

/**
 * Attente « page stable » (D84) : polices chargées, aucune requête /api/ de l'application en cours depuis 500 ms
 * (plafond 3 s), images chargées (plafond 5 s). Une attente non aboutie est notée dans l'index (jamais ignorée).
 */
async function settle(page: Page, guard: PageGuard, notes: string[]): Promise<void> {
    const started = Date.now();
    await page.evaluate(() => document.fonts.ready.then(() => true));
    for (;;) {
        const a = guard.apiActivity();
        if (a.inFlight.length === 0 && a.quietForMs >= API_QUIET_MS) break;
        if (Date.now() - started >= SETTLE_CAP_MS) {
            notes.push(a.inFlight.length > 0
                ? `requêtes /api/ encore en cours après ${SETTLE_CAP_MS / 1000} s (attente plafonnée, D84) : ${a.inFlight.slice(0, 4).join(', ')}`
                : `requêtes /api/ jamais au repos ${API_QUIET_MS} ms en ${SETTLE_CAP_MS / 1000} s (attente plafonnée, D84)`);
            break;
        }
        await page.waitForTimeout(100);
    }
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: IMAGES_CAP_MS }).catch((err: Error) => {
        notes.push(`images encore en chargement après ${IMAGES_CAP_MS / 1000} s (${err.message.split('\n')[0]})`);
    });
}

/** Lot 9 (9.4) : tout QR d'entrée est masqué sur tous les écrans, cloche ouverte comprise ; le QR de paiement n'est pas visé. */
const QR_ENTREE = (page: Page) => page.getByRole('img', { name: /^QR d.entrée/i });

/**
 * Lot 9 (9.4, T27) : le masque est posé sur l'élément lui-même, par un attribut et une feuille de style de capture.
 * L'option `mask` de Playwright dessinait une couche calculée à part, qui ne suivait pas le panneau de la cloche et
 * recouvrait l'en-tête d'une page défilée.
 */
const MASK_STYLE = `[data-e2e-masked]{background:#FF00FF!important;color:transparent!important}
[data-e2e-masked]>*{visibility:hidden!important}`;

function globalMasks(page: Page) {
    return [
        page.locator('[data-e2e-mask]'),
        page.getByText(/^(il y a|dans) \d+\s?(s|sec|min|minutes?|h|heures?|j|jours?)\b/i),
        page.getByText(/^à l[’']instant$/i),
        QR_ENTREE(page),
    ];
}

async function capture(page: Page, screen: Screen, file: string): Promise<string> {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
    const target = path.join(CAPTURES_DIR, file);
    for (const masked of [...globalMasks(page), ...(screen.masks ? screen.masks(page) : [])]) {
        await masked.evaluateAll((els) => els.forEach((e) => e.setAttribute('data-e2e-masked', '')));
    }
    await page.screenshot({
        path: target,
        animations: 'disabled',
        caret: 'hide',
        scale: 'device',
        style: MASK_STYLE,
    });
    return target;
}

/** Script d'initialisation : localStorage posé avant tout script de l'application (sérialisé). */
function setStorageBeforeLoad(entries: Array<[string, string]>): void {
    try {
        for (const [k, v] of entries) window.localStorage.setItem(k, v);
    } catch (err) {
        console.warn(`[e2e] localStorage non posé sur ${window.location.href} : ${err instanceof Error ? err.message : String(err)}`);
    }
}

/**
 * Script d'initialisation : setTimeout de `minDelayMs` ou plus multipliés par `factor` (sérialisé). L'état capturé
 * (plein écran du scanner, page de paiement réussi) ne se referme pas pendant les contrôles ; noté dans l'index.
 */
function stretchTimers(arg: { minDelayMs: number; factor: number }): void {
    const original = window.setTimeout.bind(window);
    const patched = (handler: TimerHandler, timeout?: number, ...rest: unknown[]): number => {
        const delay = typeof timeout === 'number' && timeout >= arg.minDelayMs ? timeout * arg.factor : timeout;
        return original(handler, delay, ...rest);
    };
    window.setTimeout = patched as typeof window.setTimeout;
}

function methodMatches(wanted: string | undefined, actual: string): boolean {
    return !wanted || wanted.toUpperCase() === actual.toUpperCase();
}

/** Bloc « cloche ouverte » (§4.6, D68) : « Tout marquer comme lu » tient sur une ligne à 390 px (bloquant). */
async function markAllOnOneLine(page: Page): Promise<string | null> {
    const button = page.getByRole('button', { name: /^tout marquer comme lu$/i }).first();
    if (await button.count() === 0) return 'bouton « Tout marquer comme lu » absent de la cloche ouverte (notifications non lues attendues)';
    // Lignes du LIBELLÉ seulement : les rectangles des nœuds texte. Un Range sur tout le contenu du bouton rend
    // aussi la boîte de l'icône (svg de 16 px centré, haut à 2 px de celui de la ligne de texte de 20 px), comptée
    // à tort comme une seconde ligne (run 77 : libellé sur une ligne à l'écran, « 2 lignes » relevées).
    const lines = await button.evaluate((el) => {
        const tops = new Set<number>();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const r of Array.from(range.getClientRects())) if (r.width > 0) tops.add(Math.round(r.top));
        }
        return tops.size;
    });
    return lines > 1 ? `« Tout marquer comme lu » sur ${lines} lignes à 390 px (une seule attendue, §4.6)` : null;
}

function defineCapture(screen: Screen, theme: { key: ThemeKey }, role: CaptureRole): void {
    test(`${screen.id} — ${screen.titre}`, async ({ page, context, guard }, testInfo) => {
        const vue = testInfo.project.name === 'mobile' ? 'mobile' : 'ordinateur';
        const view = `${vue}-${theme.key}` as CaptureView;
        test.skip(Boolean(screen.views) && !screen.views?.includes(view), `vue ${view} non capturée pour cet écran (${(screen.views ?? []).join(', ')})`);
        const file = `${screen.id}__${vue}__${theme.key}.png`;
        const started = Date.now();
        const record: CaptureRecord = {
            file, screen: screen.id, titre: screen.titre, vue, theme: theme.key, role,
            url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: [], error: null, durationMs: 0,
        };
        try {
            const demo: DemoIds | null = screen.needsIds ? readDemoIds() : null;
            record.url = screen.path(demo);
            guard.configure({
                allowFailures: [...(screen.allowFailures ?? []), ...(screen.injectError ? [screen.injectError] : [])],
                ignoreConsoleErrors: Boolean(screen.injectError),
            });
            if (screen.serviceWorkers === 'allow') record.notes.push('service worker autorisé dans ce contexte (D7 : bloqué partout ailleurs)');
            if (screen.initStorage) {
                const entries = Object.entries(screen.initStorage);
                record.notes.push(`localStorage posé avant le chargement : ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
                await context.addInitScript(setStorageBeforeLoad, entries);
            }
            if (screen.slowTimers) {
                record.notes.push(`minuteries de ${screen.slowTimers.minDelayMs} ms ou plus étirées ×${screen.slowTimers.factor} (état tenu pendant les contrôles)`);
                await context.addInitScript(stretchTimers, screen.slowTimers);
            }
            if (screen.injectError) {
                record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
                await page.route(screen.injectError, (route) => route.fulfill({
                    status: 500,
                    contentType: 'application/json; charset=utf-8',
                    body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
                }));
            }
            const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
            for (const stub of stubs) {
                record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
                await page.route(stub.url, async (route) => {
                    if (!methodMatches(stub.method, route.request().method())) {
                        await route.fallback();
                        return;
                    }
                    await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
                });
            }
            for (const hold of screen.holdRequests ?? []) {
                record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
                await page.route(hold.url, async (route) => {
                    if (!methodMatches(hold.method, route.request().method())) {
                        await route.fallback();
                        return;
                    }
                    // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
                    await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
                });
            }
            if (screen.fakePush) {
                const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
                record.notes.push(screen.fakePush === 'granted'
                    ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
                    : screen.fakePush === 'denied'
                        ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
                        : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
                await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
            }
            if (screen.fakeCamera) {
                const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
                record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
                await context.addInitScript(installFakeCamera, { mode });
            }
            if (screen.offline === 'before-load') {
                record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
                guard.freeze();
                await context.setOffline(true);
            }
            const response = await page.goto(record.url, { waitUntil: 'load' });
            record.status = response ? response.status() : null;
            if (screen.expectStatus !== undefined) {
                expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
            }
            if (screen.offline === 'after-load') {
                record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
                guard.freeze();
                await context.setOffline(true);
            }
            const sc = { page, context, guard, ids: demo };
            if (screen.ready) await screen.ready(sc);
            await settle(page, guard, record.notes);
            if (screen.actions) {
                await screen.actions(sc);
                await settle(page, guard, record.notes);
            }
            if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
                const problem = await markAllOnOneLine(page);
                if (problem) record.blocking.push(problem);
            }
            const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
            record.blocking.push(...checks.blocking);
            record.warnings.push(...checks.warnings);
            record.axeDetails = checks.axeDetails;
            record.smallTextDetails = checks.smallTextDetails;
            record.metrics = checks.metrics;
            const shot = await capture(page, screen, file);
            record.captured = true;
            await testInfo.attach(file, { path: shot, contentType: 'image/png' });
        } catch (err) {
            record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
            if (!record.captured && !page.isClosed()) {
                await capture(page, screen, file).then(
                    async (shot) => {
                        record.captured = true;
                        record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
                        await testInfo.attach(file, { path: shot, contentType: 'image/png' });
                    },
                    (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
                );
            }
            throw err;
        } finally {
            record.blocking.push(...guard.blockingIssues());
            record.warnings.push(...guard.nonBlockingIssues());
            record.durationMs = Date.now() - started;
            writeCaptureRecord(record);
        }
        expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
    });
}

for (const theme of THEMES) {
    for (const role of ROLE_ORDER) {
        const screens = SCREENS.filter((s) => s.role === role);
        if (screens.length === 0) continue;
        test.describe(`${theme.key} · ${role}`, () => {
            test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });

            for (const screen of screens) {
                if (screen.serviceWorkers === 'allow') {
                    // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
                    test.describe(`${screen.id} (service worker autorisé)`, () => {
                        test.use({ serviceWorkers: 'allow' });
                        defineCapture(screen, theme, role);
                    });
                } else {
                    defineCapture(screen, theme, role);
                }
            }
        });
    }
}
