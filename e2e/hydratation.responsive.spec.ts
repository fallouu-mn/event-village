/**
 * Lot stabilité (hydratation) — reproduction de l'erreur React n° 418 (runs 767 et 775 ; déjà vue aux runs 376 à 401) :
 * le texte ou la structure rendus par le serveur diffèrent de ceux du premier rendu du navigateur. Pour l'utilisateur, la
 * page se refait (et, au run 775, Explorer a montré DEUX champs « Rechercher un événement »).
 *
 * Pages : accueil, Explorer, fiche de l'événement « ce soir » (en cours dans le navigateur pour les horloges « début » et
 * « en cours »). Navigateur dans un AUTRE fuseau que le serveur (serveur : UTC, l'heure de Dakar ; navigateur : Tokyo,
 * UTC+9), horloge du navigateur posée par Playwright :
 *  - heure réelle ;
 *  - « minute » : juste après la minute suivante (le serveur a rendu la page à la minute d'avant) ;
 *  - « minuit » : juste après minuit à Dakar (le serveur a rendu la page la veille) ;
 *  - « début » : une seconde après le début de « ce soir » (le serveur l'a rendu avant le début) ;
 *  - « en cours » : deux heures après le début (comme la capture fiche-en-cours) ;
 *  - « morceaux lents » : heure réelle, chaque morceau JavaScript retardé de 0 à 1,5 s (retard fixé par son adresse) :
 *    les parties de la page s'hydratent dans un autre ordre, comme sur un téléphone lent.
 * Clair et sombre, 390 px (téléphone tactile) et 1 440 px ; chaque page chargée puis rechargée. Toute erreur
 * d'hydratation (console ou exception) fait échouer le test, avec la page, l'horloge et le relevé de la sonde
 * (e2e/support/hydration.ts : nœud où l'écart commence, composants parents, écritures hors de React avant l'écart).
 * Explorer : un seul champ « Rechercher un événement » ; fiche : un seul titre.
 */
import { createHash } from 'node:crypto';
import type { BrowserContextOptions, Page } from '@playwright/test';
import { test, expect, openAnonymousContext, type ThemeKey } from './support/fixtures';
import { readDemoIds, type DemoIds } from './support/demo-ids';
import { MOBILE } from './support/devices';
import { formatProbe, installHydrationProbe, readProbe, watchHydration } from './support/hydration';

/** Fuseau du navigateur : celui du serveur (UTC) décalé de 9 h ; la date change pour un événement du soir. */
const BROWSER_TZ = 'Asia/Tokyo';

interface ClockInput { now: number; startsAt: number }
interface Scenario { id: string; at: (c: ClockInput) => number | null; slowChunks?: boolean }

const SCENARIOS: Scenario[] = [
    { id: 'heure-reelle', at: () => null },
    { id: 'minute', at: ({ now }) => Math.floor(now / 60_000) * 60_000 + 60_000 + 500 },
    // Minuit à Dakar (UTC+0 toute l'année) : le jour suivant, 00:00:00,5
    { id: 'minuit', at: ({ now }) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) + 500; } },
    { id: 'debut', at: ({ startsAt }) => startsAt + 1_000 },
    { id: 'en-cours', at: ({ startsAt }) => startsAt + 2 * 3_600_000 },
    { id: 'morceaux-lents', at: () => null, slowChunks: true },
];

interface PageCase { id: string; path: (ids: DemoIds) => string; ready: string }

const PAGES: PageCase[] = [
    { id: 'accueil', path: () => '/', ready: '#accueil-titre' },
    { id: 'explorer', path: () => '/explore', ready: '#resultats-titre' },
    { id: 'fiche-en-cours', path: (ids) => `/events/${ids.events.ceSoir.id}`, ready: '#billetterie' },
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

/** Page hydratée : l'élément repère est rattaché à React, le réseau est calme, deux images et un temps libre ensuite. */
async function waitHydrated(page: Page, selector: string): Promise<void> {
    await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber$'));
    }, selector, { timeout: 45_000 });
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

async function ceSoirStart(page: Page, id: string): Promise<number> {
    const res = await page.request.get(`/api/events/${id}`);
    expect(res.status(), 'fiche publique de « ce soir »').toBe(200);
    const body = (await res.json()) as { event?: { startsAt?: string } };
    const t = Date.parse(String(body.event?.startsAt ?? ''));
    if (!Number.isFinite(t)) throw new Error(`[hydratation] début de « ce soir » illisible : ${JSON.stringify(body).slice(0, 200)}`);
    return t;
}

for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
        test(`hydratation · ${theme} · ${vp.id} px : accueil, Explorer, fiche en cours ; fuseau ${BROWSER_TZ}, minute, minuit, début, en cours, morceaux lents`, async ({ browser, page }, testInfo) => {
            test.setTimeout(600_000);
            const ids = readDemoIds();
            const startsAt = await ceSoirStart(page, ids.events.ceSoir.id);
            const failures: string[] = [];
            let loads = 0;
            for (const scenario of SCENARIOS) {
                for (const pc of PAGES) {
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
                        const at = scenario.at({ now: Date.now(), startsAt });
                        if (at !== null) await p.clock.install({ time: at });
                        const label = `${pc.id} · ${scenario.id}${at !== null ? ` (navigateur à ${new Date(at).toISOString()}, ${BROWSER_TZ})` : ` (${BROWSER_TZ})`}`;
                        for (let passage = 1; passage <= 2; passage += 1) {
                            const mark = watch.mark();
                            if (passage === 1) await p.goto(pc.path(ids), { waitUntil: 'load' });
                            else await p.reload({ waitUntil: 'load' });
                            await waitHydrated(p, pc.ready);
                            loads += 1;
                            const errors = watch.since(mark);
                            const extra: string[] = [];
                            if (pc.id === 'explorer') {
                                const n = await p.getByLabel(/^Rechercher un événement$/).count();
                                if (n !== 1) extra.push(`${n} champs « Rechercher un événement » (1 attendu)`);
                            }
                            if (pc.id === 'fiche-en-cours') {
                                const n = await p.locator('h1').count();
                                if (n !== 1) extra.push(`${n} titres h1 (1 attendu)`);
                            }
                            if (errors.length > 0 || extra.length > 0) {
                                const report = formatProbe(await readProbe(p));
                                failures.push(`${theme} · ${vp.id} px · ${label} · chargement ${passage}/2 :\n  ${[...errors, ...extra].join('\n  ')}${report ? `\n${report}` : ''}`);
                            }
                        }
                    } finally {
                        await context.close();
                    }
                }
            }
            console.log(`[hydratation] ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec`);
            for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
            expect(failures, `erreurs d'hydratation (${theme}, ${vp.id} px)`).toEqual([]);
        });
    }
}
