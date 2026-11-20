/**
 * Lot 7 (contrat, section 11.3 ; tâche 7.0 e, décision D25) — projet Playwright « pwa » : application
 * installable, sans état de connexion (page d'accueil anonyme).
 *
 * Preuve Chromium : seul un contexte PERSISTANT du binaire Chromium complet (`channel: 'chromium'`) évalue
 * vraiment l'installabilité ; le « headless shell » par défaut de Playwright répond `[]` à tout, même pour un
 * manifest sans icône (faux positif PROUVÉ, discovery-7-pwa.md §2.3). Le témoin négatif (manifest servi sans
 * icône → erreur d'icône attendue) rend donc la preuve rouge si elle tournait un jour sur le headless shell.
 * Preuves bloquantes : `beforeinstallprompt` reçu, `Page.getInstallabilityErrors` vide, manifest et icône
 * demandés par Chromium et servis en 200 ; témoin négatif ; manifest servi (champs et icônes du contrat 4.5) ;
 * balises iPhone du <head> (WebKit absent de la configuration : aucune preuve iOS au-delà du DOM).
 *
 * Écart tranché (rapport) : Chromium ne télécharge que l'icône qu'il choisit, pas chaque icône déclarée. « Une
 * requête par icône, toutes 200 » est prouvé ainsi : au moins une icône demandée par Chromium lui-même en 200,
 * et chaque icône déclarée demandée par la page en 200, type image/png, dimensions PNG égales à `sizes`.
 */
import fs from 'node:fs';
import { chromium, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { MOBILE } from './support/devices';
import { APP_URL, e2eConfig } from './support/env';
import { installNetworkGuard } from './support/network';

interface ObservedResponse { url: string; path: string; type: string; status: number }
interface FetchedBytes { status: number; contentType: string; head: number[]; text: string | null }
interface ManifestIcon { src: string; sizes?: string; type?: string; purpose?: string }

/** Contexte persistant du Chromium complet ; échec explicite si le binaire manque. */
async function persistentContext(testInfo: TestInfo, profil: string): Promise<BrowserContext> {
    const dir = testInfo.outputPath(profil);
    fs.rmSync(dir, { recursive: true, force: true });
    let context: BrowserContext;
    try {
        context = await chromium.launchPersistentContext(dir, {
            channel: 'chromium',
            headless: true,
            args: ['--host-resolver-rules=MAP localhost 127.0.0.1'],
            baseURL: APP_URL,
            viewport: MOBILE.viewport,
            deviceScaleFactor: MOBILE.deviceScaleFactor,
            isMobile: MOBILE.isMobile,
            hasTouch: MOBILE.hasTouch,
            userAgent: MOBILE.userAgent,
            locale: 'fr-FR',
            timezoneId: 'Africa/Dakar',
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/executable doesn'?t exist|not found|is not installed|no such file/i.test(message)) {
            throw new Error(`binaire Chromium complet absent : npx playwright install chromium (${message.split('\n')[0]})`);
        }
        throw err;
    }
    await installNetworkGuard(context, e2eConfig().allowedHosts);
    await context.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
    await context.addInitScript(() => {
        const w = window as unknown as { __evInstallPrompts: number };
        w.__evInstallPrompts = 0;
        window.addEventListener('beforeinstallprompt', () => { w.__evInstallPrompts += 1; });
    });
    return context;
}

function observe(context: BrowserContext): ObservedResponse[] {
    const seen: ObservedResponse[] = [];
    context.on('response', (r) => {
        let p = '';
        try {
            p = new URL(r.url()).pathname;
        } catch (err) {
            p = `(URL illisible : ${err instanceof Error ? err.message : String(err)})`;
        }
        seen.push({ url: r.url(), path: p, type: r.request().resourceType(), status: r.status() });
    });
    return seen;
}

/** Ressource demandée par la page (même origine, résolution forcée en IPv4 par le navigateur). */
async function fetchFromPage(page: Page, url: string, asText: boolean): Promise<FetchedBytes> {
    return page.evaluate(async ({ u, t }) => {
        const res = await fetch(u, { cache: 'no-store', credentials: 'omit' });
        const buf = new Uint8Array(await res.arrayBuffer());
        return {
            status: res.status,
            contentType: res.headers.get('content-type') ?? '',
            head: Array.from(buf.slice(0, 32)),
            text: t ? new TextDecoder().decode(buf) : null,
        };
    }, { u: url, t: asText });
}

/** Largeur et hauteur d'un PNG lues dans l'en-tête IHDR (octets 16 à 23), null si ce n'est pas un PNG. */
function pngSize(head: number[]): { width: number; height: number; colorType: number } | null {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (head.length < 26 || sig.some((b, i) => head[i] !== b)) return null;
    const u32 = (o: number) => ((head[o] << 24) | (head[o + 1] << 16) | (head[o + 2] << 8) | head[o + 3]) >>> 0;
    return { width: u32(16), height: u32(20), colorType: head[25] };
}

async function installabilityErrors(context: BrowserContext, page: Page): Promise<string[]> {
    const cdp = await context.newCDPSession(page);
    const out = await cdp.send('Page.getInstallabilityErrors') as { installabilityErrors?: Array<{ errorId: string; errorArguments?: Array<{ name: string; value: string }> }> };
    await cdp.detach();
    return (out.installabilityErrors ?? []).map((e) => `${e.errorId}${e.errorArguments?.length ? ` (${e.errorArguments.map((a) => `${a.name}=${a.value}`).join(', ')})` : ''}`);
}

test.describe.configure({ mode: 'default' });

test('Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité)', async ({}, testInfo) => {
    const context = await persistentContext(testInfo, 'profil');
    try {
        const seen = observe(context);
        const page = context.pages()[0] ?? await context.newPage();
        await page.goto('/');
        await page.waitForFunction(() => ((window as unknown as { __evInstallPrompts?: number }).__evInstallPrompts ?? 0) > 0, null, { timeout: 15_000 })
            .catch((err: unknown) => {
                throw new Error(`beforeinstallprompt jamais reçu en 15 s (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
            });
        const errors = await installabilityErrors(context, page);
        console.log(`[e2e][pwa] Page.getInstallabilityErrors : ${errors.length === 0 ? 'aucune' : errors.join(' ; ')}`);
        expect(errors, 'Page.getInstallabilityErrors : liste vide attendue').toEqual([]);

        await expect.poll(() => seen.filter((r) => r.type === 'manifest' && r.path === '/manifest.json').map((r) => r.status), {
            message: 'manifest demandé par Chromium (type « manifest ») vers /manifest.json', timeout: 15_000,
        }).toContain(200);
        const manifest = await fetchFromPage(page, '/manifest.json', true);
        expect(manifest.status, 'manifest servi').toBe(200);
        const icons = (JSON.parse(manifest.text ?? '{}') as { icons?: ManifestIcon[] }).icons ?? [];
        expect(icons.length, 'icônes déclarées dans le manifest').toBeGreaterThan(0);
        const iconPaths = new Set(icons.map((i) => new URL(i.src, APP_URL).pathname));
        await expect.poll(() => seen.filter((r) => iconPaths.has(r.path) && r.status === 200).map((r) => r.path), {
            message: `au moins une icône déclarée demandée par Chromium et servie en 200 (${Array.from(iconPaths).join(', ')})`, timeout: 15_000,
        }).not.toEqual([]);
        for (const icon of icons) {
            const got = await fetchFromPage(page, icon.src, false);
            const size = pngSize(got.head);
            expect.soft({ src: icon.src, status: got.status, type: got.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
                `icône ${icon.src} servie sans session`).toEqual({ src: icon.src, status: 200, type: 'image/png', size: icon.sizes ?? null });
        }
        const failed = seen.filter((r) => r.status >= 400);
        expect(failed.map((r) => `${r.status} ${r.url}`), 'aucune réponse en erreur pendant le chargement de l’accueil').toEqual([]);
    } finally {
        await context.close();
    }
});

test('témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante', async ({}, testInfo) => {
    const context = await persistentContext(testInfo, 'profil-temoin');
    try {
        await context.route('**/manifest.json', async (route) => {
            const original = await route.fetch();
            const body = (await original.json()) as Record<string, unknown>;
            delete body.icons;
            await route.fulfill({ status: 200, contentType: 'application/manifest+json', body: JSON.stringify(body) });
        });
        const page = context.pages()[0] ?? await context.newPage();
        await page.goto('/');
        await expect.poll(() => installabilityErrors(context, page), {
            message: 'manifest sans icône : manifest-missing-suitable-icon ou no-acceptable-icon attendu (sinon : headless shell, faux positif)', timeout: 15_000,
        }).toEqual(expect.arrayContaining([expect.stringMatching(/^(manifest-missing-suitable-icon|no-acceptable-icon)/)]));
    } finally {
        await context.close();
    }
});

test('manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5)', async ({ page, guard }) => {
    await page.goto('/manifest.json');
    const got = await fetchFromPage(page, '/manifest.json', true);
    expect(got.status, 'manifest servi sans session').toBe(200);
    const m = JSON.parse(got.text ?? '{}') as Record<string, unknown> & { icons?: ManifestIcon[] };
    const scope = String(m.scope ?? '');
    expect.soft(m.id, 'id').toBe('/');
    expect.soft(scope, 'scope').toBe('/');
    expect.soft(String(m.start_url ?? '').startsWith(scope || '\u0000'), `start_url « ${String(m.start_url)} » dans le scope « ${scope} »`).toBe(true);
    expect.soft(m.display, 'display').toBe('standalone');
    expect.soft(String(m.theme_color ?? ''), 'theme_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect.soft(String(m.background_color ?? ''), 'background_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
    const icons = m.icons ?? [];
    const purposeOf = (i: ManifestIcon) => (i.purpose ?? 'any').split(/\s+/);
    expect.soft(icons.some((i) => i.sizes === '192x192' && purposeOf(i).includes('any')), 'icône 192×192 « any »').toBe(true);
    expect.soft(icons.some((i) => i.sizes === '512x512' && purposeOf(i).includes('any')), 'icône 512×512 « any »').toBe(true);
    const maskable = icons.filter((i) => purposeOf(i).includes('maskable'));
    expect.soft(maskable.length, 'au moins une icône « maskable »').toBeGreaterThan(0);
    for (const icon of maskable) {
        const bytes = await fetchFromPage(page, icon.src, false);
        const size = pngSize(bytes.head);
        expect.soft({ status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null, colorType: size?.colorType ?? null },
            `icône maskable ${icon.src} : 200, PNG opaque (type de couleur 2), ${icon.sizes ?? '?'}`).toEqual({ status: 200, type: 'image/png', size: icon.sizes ?? null, colorType: 2 });
    }
    expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
});

test('iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil', async ({ page, guard }) => {
    await page.goto('/');
    const head = await page.evaluate(() => ({
        appleIcons: Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map((l) => l.getAttribute('href') ?? ''),
        capable: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]')).map((m) => m.getAttribute('content') ?? ''),
        title: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-title"]')).map((m) => m.getAttribute('content') ?? ''),
        manifests: Array.from(document.querySelectorAll('link[rel="manifest"]')).map((l) => l.getAttribute('href') ?? ''),
    }));
    console.log(`[e2e][pwa] <head> : ${JSON.stringify(head)}`);
    expect.soft(head.appleIcons.length, `exactement un link[rel=apple-touch-icon] (trouvés : ${JSON.stringify(head.appleIcons)})`).toBe(1);
    expect.soft(head.capable, 'meta apple-mobile-web-app-capable = yes').toEqual(['yes']);
    expect.soft(head.title.length === 1 && head.title[0].trim().length > 0, `meta apple-mobile-web-app-title renseignée (${JSON.stringify(head.title)})`).toBe(true);
    expect.soft(head.manifests, 'link[rel=manifest] vers /manifest.json').toEqual(['/manifest.json']);
    for (const href of head.appleIcons) {
        const bytes = await fetchFromPage(page, href, false);
        const size = pngSize(bytes.head);
        expect.soft({ href, status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
            `icône apple-touch ${href}`).toEqual({ href, status: 200, type: 'image/png', size: '180x180' });
    }
    expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
});
