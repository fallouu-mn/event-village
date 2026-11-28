/**
 * Lot stabilité (hydratation) — reproduction de l'erreur React n° 418 (runs 767 et 775 ; déjà vue aux runs 376 à 401) :
 * le texte ou la structure rendus par le serveur diffèrent de ceux du premier rendu du navigateur. Pour l'utilisateur, la
 * page se refait (et, au run 775, Explorer a montré DEUX champs « Rechercher un événement »).
 *
 * Pages : accueil, Explorer, fiche de « ce soir » (début : seed + 45 min) et fiche d'un événement EN COURS POUR LE SERVEUR
 * (créé par le test, début avancé de 20 min par le compte de service, comme le seed le fait pour ses dates) : dans les
 * échecs réels, l'événement avait commencé côté serveur (captures à mi-parcours, recette en fin de job), ce que l'horloge du
 * navigateur seule ne reproduit pas (run 784 : 144 chargements, aucune erreur).
 * Navigateur dans un AUTRE fuseau que le serveur (serveur : UTC, l'heure de Dakar ; navigateur : Tokyo, UTC+9).
 * Scénarios (horloge du navigateur posée par Playwright, conditions de la machine) :
 *  - heure réelle ;
 *  - « minute » : juste après la minute suivante (le serveur a rendu la page à la minute d'avant) ;
 *  - « minuit » : juste après minuit à Dakar (le serveur a rendu la page la veille) ;
 *  - « début » : une seconde après le début de « ce soir » ;
 *  - « en cours » : deux heures après le début de « ce soir » ;
 *  - « heure figée » : copie exacte de la capture fiche-en-cours (page.clock.setFixedTime à +2 h, trois rechargements) ;
 *  - « morceaux lents » : chaque morceau JavaScript retardé de 0 à 1,5 s (retard fixé par son adresse) ;
 *  - « réseau 4G » : réseau bridé (DevTools « Slow 4G ») et processeur ralenti ×4 : le document arrive par morceaux ;
 *  - « processeur lent » : processeur ralenti ×6 (machine de CI chargée, comme pendant les captures à deux workers).
 * Clair et sombre, 390 px (téléphone tactile) et 1 440 px ; chaque page chargée puis rechargée. Toute erreur
 * d'hydratation (console ou exception) fait échouer le test, avec la page, le scénario et le relevé de la sonde
 * (e2e/support/hydration.ts : nœud où l'écart commence, composants parents, écritures hors de React avant l'écart).
 * Explorer : un seul champ « Rechercher un événement » ; fiches : un seul titre.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { Browser, BrowserContextOptions, Page, TestInfo } from '@playwright/test';
import { test, expect, openAnonymousContext, openRoleContext, type ThemeKey } from './support/fixtures';
import { readDemoIds } from './support/demo-ids';
import { cdpNetworkConditions, MOBILE, NET_4G } from './support/devices';
import { formatProbe, installHydrationProbe, readProbe, watchHydration } from './support/hydration';
import { createPublishedEvent, partnerPosterOf, serviceClient, userIdByEmail } from './support/service';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

/** Fuseau du navigateur : celui du serveur (UTC) décalé de 9 h ; la date change pour un événement du soir. */
const BROWSER_TZ = 'Asia/Tokyo';
const STAMP = randomUUID().slice(0, 8);

interface ClockInput { now: number; startsAt: number }
interface Scenario {
    id: string;
    /** Heure du navigateur (horloge qui avance), null : heure réelle. */
    at?: (c: ClockInput) => number;
    /** Heure du navigateur figée (page.clock.setFixedTime), comme la capture fiche-en-cours. */
    fixed?: (c: ClockInput) => number;
    passages?: number;
    slowChunks?: boolean;
    network?: boolean;
    cpu?: number;
}

const SCENARIOS: Scenario[] = [
    { id: 'heure-reelle' },
    { id: 'minute', at: ({ now }) => Math.floor(now / 60_000) * 60_000 + 60_000 + 500 },
    // Minuit à Dakar (UTC+0 toute l'année) : le jour suivant, 00:00:00,5
    { id: 'minuit', at: ({ now }) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) + 500; } },
    { id: 'debut', at: ({ startsAt }) => startsAt + 1_000 },
    { id: 'en-cours', at: ({ startsAt }) => startsAt + 2 * 3_600_000 },
    { id: 'heure-figee', fixed: ({ now }) => now + 2 * 3_600_000, passages: 3 },
    { id: 'morceaux-lents', slowChunks: true },
    { id: 'reseau-4g', network: true, cpu: 4 },
    { id: 'processeur-lent', cpu: 6 },
];

interface PageCase { id: string; path: (live: string) => string; ready: string }

const PAGES: PageCase[] = [
    { id: 'accueil', path: () => '/', ready: '#accueil-titre' },
    { id: 'explorer', path: () => '/explore', ready: '#resultats-titre' },
    { id: 'fiche-ce-soir', path: () => `/events/${readDemoIds().events.ceSoir.id}`, ready: '#billetterie' },
    { id: 'fiche-en-cours-serveur', path: (live) => `/events/${live}`, ready: '#billetterie' },
];

const VIEWPORTS: ReadonlyArray<{ id: string; options: BrowserContextOptions }> = [
    { id: '390', options: { viewport: MOBILE.viewport, deviceScaleFactor: MOBILE.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: MOBILE.userAgent } },
    { id: '1440', options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false } },
];

const THEMES: ThemeKey[] = ['clair', 'sombre'];

/** Retard fixé par l'adresse du morceau (0 à 1 500 ms) : même ordre d'arrivée d'un passage à l'autre. */
function chunkDelay(url: string): number {
    return createHash('sha1').update(new URL(url).pathname).digest().readUInt16BE(0) % 1_500;
}

function dakarParts(t: number): { date: string; time: string } {
    const iso = new Date(t).toISOString(); // heure de Dakar = UTC
    return { date: iso.slice(0, 10), time: `${iso.slice(11, 16)}:00` };
}

/**
 * Événement en cours pour le serveur, un par worker (créé au premier besoin) : publié avec un début futur (event_create
 * refuse un début passé), puis début avancé de 20 min et fin dans 4 h par le compte de service (même geste que le seed).
 */
let liveEvent: Promise<string> | null = null;
function liveEventId(): Promise<string> {
    liveEvent ??= (async () => {
        const ids = readDemoIds();
        const later = dakarParts(Date.now() + 3 * 3_600_000);
        const end = dakarParts(Date.now() + 5 * 3_600_000);
        const id = await createPublishedEvent({
            partnerUserId: ids.accounts.organisateur.userId,
            superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
            title: `Soirée en cours ${STAMP}`,
            description: 'Événement du lot stabilité (hydratation), en cours pour le serveur. Données fictives.',
            startDate: later.date, startTime: later.time, endDate: end.date, endTime: end.time,
            location: 'Esplanade de test', city: 'Dakar', capacity: 100,
            imageUrl: await partnerPosterOf(ids.accounts.organisateur.userId),
            category: { name: 'Standard', price: 5000, total: 50 },
        });
        const s = dakarParts(Date.now() - 20 * 60_000);
        const e = dakarParts(Date.now() + 4 * 3_600_000);
        const { error } = await serviceClient().from('events').update({ start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time }).eq('id', id);
        if (error) throw new Error(`[hydratation] début avancé de ${id} : ${error.message}`);
        console.log(`[hydratation] événement en cours pour le serveur : ${id} (début ${s.date} ${s.time}, fin ${e.date} ${e.time})`);
        return id;
    })();
    return liveEvent;
}

/** Page hydratée : l'élément repère est rattaché à React, le réseau est calme, deux images et un temps libre ensuite. */
async function waitHydrated(page: Page, selector: string): Promise<void> {
    await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber$'));
    }, selector, { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch((err: unknown) => {
        console.log(`[hydratation] réseau jamais calme sur ${page.url()} (${err instanceof Error ? err.message.split('\n')[0] : String(err)}) : relevé fait quand même`);
    });
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 2_000 });
            else resolve();
        }));
    }));
}

async function ceSoirStart(page: Page): Promise<number> {
    const res = await page.request.get(`/api/events/${readDemoIds().events.ceSoir.id}`);
    expect(res.status(), 'fiche publique de « ce soir »').toBe(200);
    const body = (await res.json()) as { event?: { startsAt?: string } };
    const t = Date.parse(String(body.event?.startsAt ?? ''));
    if (!Number.isFinite(t)) throw new Error(`[hydratation] début de « ce soir » illisible : ${JSON.stringify(body).slice(0, 200)}`);
    return t;
}

/** Un scénario sur une page : contexte neuf (horloge, réseau), chargement puis rechargement(s) ; rend les échecs. */
async function runScenario(browser: Browser, testInfo: TestInfo, theme: ThemeKey, vp: typeof VIEWPORTS[number], pc: PageCase, scenario: Scenario, input: ClockInput, live: string): Promise<string[]> {
    const failures: string[] = [];
    const context = await openAnonymousContext(browser, testInfo, theme, { ...vp.options, timezoneId: BROWSER_TZ });
    try {
        await installHydrationProbe(context);
        if (scenario.slowChunks) {
            await context.route(/\/_next\/static\/chunks\/.+\.js(\?|$)/, async (route) => {
                await new Promise((r) => setTimeout(r, chunkDelay(route.request().url())));
                await route.fallback();
            });
        }
        const p = await context.newPage();
        const watch = watchHydration(p);
        if (scenario.network || scenario.cpu) {
            const cdp = await context.newCDPSession(p);
            if (scenario.network) await cdp.send('Network.emulateNetworkConditions', cdpNetworkConditions(NET_4G));
            if (scenario.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpu });
        }
        let clockNote = BROWSER_TZ;
        if (scenario.at) {
            const at = scenario.at(input);
            await p.clock.install({ time: at });
            clockNote = `navigateur à ${new Date(at).toISOString()}, ${BROWSER_TZ}`;
        }
        if (scenario.fixed) {
            const at = scenario.fixed(input);
            clockNote = `navigateur figé à ${new Date(at).toISOString()}, ${BROWSER_TZ}`;
        }
        const label = `${pc.id} · ${scenario.id} (${clockNote})`;
        const passages = scenario.passages ?? 2;
        for (let passage = 1; passage <= passages; passage += 1) {
            const mark = watch.mark();
            if (passage === 1) await p.goto(pc.path(live), { waitUntil: 'load' });
            else await p.reload({ waitUntil: 'load' });
            await waitHydrated(p, pc.ready);
            // Capture fiche-en-cours : premier chargement à l'heure réelle, puis heure figée et rechargements
            if (passage === 1 && scenario.fixed) await p.clock.setFixedTime(new Date(scenario.fixed(input)));
            const errors = watch.since(mark);
            const extra: string[] = [];
            if (pc.id === 'explorer') {
                const n = await p.getByLabel(/^Rechercher un événement$/).count();
                if (n !== 1) extra.push(`${n} champs « Rechercher un événement » (1 attendu)`);
            }
            if (pc.id.startsWith('fiche')) {
                const n = await p.locator('h1').count();
                if (n !== 1) extra.push(`${n} titres h1 (1 attendu)`);
            }
            if (errors.length > 0 || extra.length > 0) {
                const report = formatProbe(await readProbe(p));
                failures.push(`${theme} · ${vp.id} px · ${label} · chargement ${passage}/${passages} :\n  ${[...errors, ...extra].join('\n  ')}${report ? `\n${report}` : ''}`);
            }
        }
    } finally {
        await context.close();
    }
    return failures;
}

/**
 * Page tardive, services ouverts (run 787 : n° 418 sur /partner/calendar à 768 px, page dont le contenu n'est PAS rendu par
 * le serveur : l'écart est dans le gabarit, ou dans une partie hydratée après la racine). Seuls les morceaux des pages et
 * des gabarits de segment (/_next/static/chunks/app/…, sauf le gabarit racine) sont retardés : la racine s'hydrate, ses
 * effets tournent (session lue, `mounted`, interrupteurs lus par GET /api/features), PUIS la page s'hydrate. Interrupteurs
 * salles et tables ouverts (verrou des services) : une entrée de service n'est rendue que si l'interrupteur est lu.
 */
const LATE_PAGE_CHUNK = /\/_next\/static\/chunks\/app\/(?!layout-)[^?]+\.js(\?|$)/;

interface LateCase { id: string; role: 'anonyme' | 'organisateur' | 'client'; path: () => string; ready: string }
const LATE_PAGES: LateCase[] = [
    { id: 'accueil', role: 'anonyme', path: () => '/', ready: '#accueil-titre' },
    { id: 'explorer', role: 'anonyme', path: () => '/explore', ready: '#resultats-titre' },
    { id: 'fiche-ce-soir', role: 'anonyme', path: () => `/events/${readDemoIds().events.ceSoir.id}`, ready: '#billetterie' },
    { id: 'org-tableau-de-bord', role: 'organisateur', path: () => '/partner/dashboard', ready: 'h1' },
    { id: 'org-calendrier', role: 'organisateur', path: () => '/partner/calendar', ready: 'h1' },
    { id: 'client-commandes', role: 'client', path: () => '/orders', ready: 'h1' },
];
const LATE_DELAYS = [600, 2_500] as const;

for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
        test(`hydratation · ${theme} · ${vp.id} px · page tardive, services ouverts : accueil, Explorer, fiche, tableau de bord et calendrier de l'organisatrice, commandes du client`, async ({ browser, servicesLock }, testInfo) => {
            test.setTimeout(900_000);
            await servicesLock.enter('services');
            const failures: string[] = [];
            let loads = 0;
            for (const lc of LATE_PAGES) {
                for (const delay of LATE_DELAYS) {
                    const extra = { ...vp.options, timezoneId: BROWSER_TZ };
                    const context = lc.role === 'anonyme'
                        ? await openAnonymousContext(browser, testInfo, theme, extra)
                        : await openRoleContext(browser, testInfo, lc.role, theme, extra);
                    try {
                        await installHydrationProbe(context);
                        await context.route(LATE_PAGE_CHUNK, async (route) => {
                            await new Promise((r) => setTimeout(r, delay));
                            await route.fallback();
                        });
                        const p = await context.newPage();
                        const watch = watchHydration(p);
                        for (let passage = 1; passage <= 3; passage += 1) {
                            const mark = watch.mark();
                            if (passage === 1) await p.goto(lc.path(), { waitUntil: 'load' });
                            else await p.reload({ waitUntil: 'load' });
                            await waitHydrated(p, lc.ready);
                            loads += 1;
                            const errors = watch.since(mark);
                            if (errors.length > 0) {
                                const report = formatProbe(await readProbe(p));
                                failures.push(`${theme} · ${vp.id} px · ${lc.id} (${lc.role}) · morceaux de page retardés de ${delay} ms · chargement ${passage}/3 :\n  ${errors.join('\n  ')}${report ? `\n${report}` : ''}`);
                            }
                        }
                    } finally {
                        await context.close();
                    }
                }
            }
            console.log(`[hydratation] page tardive · ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec`);
            for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
            expect(failures, `erreurs d'hydratation, page tardive (${theme}, ${vp.id} px)`).toEqual([]);
        });
    }
}

for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
        for (const pc of PAGES) {
            test(`hydratation · ${theme} · ${vp.id} px · ${pc.id} : fuseau ${BROWSER_TZ}, minute, minuit, début, en cours, heure figée, morceaux lents, réseau 4G, processeur lent`, async ({ browser, page }, testInfo) => {
                test.setTimeout(900_000);
                const live = await liveEventId();
                const startsAt = await ceSoirStart(page);
                const failures: string[] = [];
                let loads = 0;
                for (const scenario of SCENARIOS) {
                    failures.push(...await runScenario(browser, testInfo, theme, vp, pc, scenario, { now: Date.now(), startsAt }, live));
                    loads += scenario.passages ?? 2;
                }
                console.log(`[hydratation] ${theme} · ${vp.id} px · ${pc.id} : ${loads} chargements, ${failures.length} en échec`);
                for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
                expect(failures, `erreurs d'hydratation (${theme}, ${vp.id} px, ${pc.id})`).toEqual([]);
            });
        }
    }
}
