/**
 * Lot 5.1 — fixtures Playwright communes :
 *  - verrou réseau sur chaque contexte (network.ts) ;
 *  - thème posé avant le chargement : localStorage['ev-theme'] par script d'initialisation (lu par
 *    le script anti-flash de app/layout.tsx et par ThemeProvider), plus colorScheme du contexte ;
 *  - état de connexion du rôle de l'écran (evRole), erreur explicite s'il manque ;
 *  - collecte des erreurs de la page (guard) ;
 *  - lot 10b, généralisé au lot 11b : verrou des pages des services, salles de fête et tables (servicesLock,
 *    e2e/support/services-switch.ts ; ancien hallsLock de halls-switch.ts), pris (enter) par les phases captures et
 *    responsive seulement ; rendu après la fermeture du contexte du test, même après un dépassement du délai.
 * Le paramètre des fixtures s'appelle `provide` (et non `use`) : eslint-plugin-react-hooks
 * confond sinon la fonction de Playwright avec le hook React `use`.
 */
import { test as base, expect, type Browser, type BrowserContext, type BrowserContextOptions, type TestInfo } from '@playwright/test';
import { requireStorageState, type RoleKey } from './accounts';
import { e2eConfig } from './env';
import { installNetworkGuard, PageGuard } from './network';
import { ServicesLock } from './services-switch';

export type ThemeKey = 'clair' | 'sombre';
export type CaptureRole = 'anonyme' | RoleKey;

/** Valeur de localStorage['ev-theme'] (components/providers/ThemeProvider.tsx). */
export const EV_THEME_VALUE: Record<ThemeKey, 'light' | 'dark'> = { clair: 'light', sombre: 'dark' };

function setThemeBeforeLoad(value: string): void {
    try {
        window.localStorage.setItem('ev-theme', value);
    } catch (err) {
        // about:blank et documents opaques n'ont pas de localStorage : rien à poser, on le signale
        console.warn(`[e2e] thème non posé sur ${window.location.href} : ${err instanceof Error ? err.message : String(err)}`);
    }
}

/**
 * Finition 5 (point 1) : le thème demandé est AUSSI posé dans le cookie `ev-theme` (lib/theme.ts), que lit en premier le
 * script anti-flash de <head>. Avant, seul localStorage était posé : le cookie `ev-theme=light` enregistré avec la session
 * des comptes (auth.setup.ts) l'emportait, et toutes les captures « sombre » des pages connectées sortaient en clair
 * depuis le design 1a. Le cookie ajouté ici remplace celui d'un état de connexion (même nom, même hôte, même chemin) ;
 * auth.setup.ts ne l'enregistre d'ailleurs plus. Le choix fait à l'écran pendant un test (bouton du thème) reste libre.
 */
export async function prepareContext(context: BrowserContext, theme: ThemeKey): Promise<void> {
    await installNetworkGuard(context, e2eConfig().allowedHosts);
    // Aide __name (esbuild/tsx) disponible pour toute fonction sérialisée vers la page
    await context.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
    await context.addInitScript(setThemeBeforeLoad, EV_THEME_VALUE[theme]);
    await context.addCookies([{ name: 'ev-theme', value: EV_THEME_VALUE[theme], url: e2eConfig().appUrl, sameSite: 'Lax' }]);
}

interface Fixtures {
    evTheme: ThemeKey;
    evRole: CaptureRole;
    guard: PageGuard;
    servicesLock: ServicesLock;
}

export const test = base.extend<Fixtures>({
    evTheme: ['clair', { option: true }],
    evRole: ['anonyme', { option: true }],
    storageState: async ({ evRole }, provide) => {
        await provide(evRole === 'anonyme' ? { cookies: [], origins: [] } : requireStorageState(evRole));
    },
    // Lot 10b (lot 11b : verrou des services) : le contexte dépend du verrou, pour qu'il ne soit rendu qu'après la fermeture
    // du contexte (aucune requête d'une page encore ouverte pendant que l'autre groupe de tests tourne) ; sans `enter`, rien
    // n'est pris
    context: async ({ context, evTheme, servicesLock }, provide) => {
        void servicesLock;
        await prepareContext(context, evTheme);
        await provide(context);
    },
    guard: async ({ page }, provide) => {
        await provide(new PageGuard(page));
    },
    servicesLock: async ({}, provide, testInfo) => {
        const lock = new ServicesLock(testInfo);
        try {
            await provide(lock);
        } finally {
            await lock.leave();
        }
    },
});

export { expect };

/**
 * Options du projet courant recopiées dans un contexte ouvert à la main (plusieurs rôles par test).
 * Lot 7 : exportée pour perf.spec.ts (contexte neuf par passage, sans verrou réseau, contrat 11.6).
 */
export function projectContextOptions(testInfo: TestInfo): BrowserContextOptions {
    const u = testInfo.project.use;
    return {
        baseURL: u.baseURL,
        viewport: u.viewport,
        deviceScaleFactor: u.deviceScaleFactor,
        isMobile: u.isMobile,
        hasTouch: u.hasTouch,
        userAgent: u.userAgent,
        locale: u.locale,
        timezoneId: u.timezoneId,
        serviceWorkers: u.serviceWorkers,
        reducedMotion: u.reducedMotion,
    };
}

/** Contexte connecté sous un rôle (fumée : partenaire, superadmin et client dans le même test). */
export async function openRoleContext(browser: Browser, testInfo: TestInfo, role: RoleKey, theme: ThemeKey = 'clair', extra: BrowserContextOptions = {}): Promise<BrowserContext> {
    const context = await browser.newContext({
        ...projectContextOptions(testInfo),
        colorScheme: EV_THEME_VALUE[theme],
        storageState: requireStorageState(role),
        ...extra,
    });
    await prepareContext(context, theme);
    return context;
}

/**
 * Lot 8 (contrat 15.5) : contexte sans session, pour un compte créé à l'écran par le test (recette : C1, P1, K1) ; `extra`
 * reçoit l'état de connexion et le réglage du service worker d'un second contexte du même compte.
 */
export async function openAnonymousContext(browser: Browser, testInfo: TestInfo, theme: ThemeKey = 'clair', extra: BrowserContextOptions = {}): Promise<BrowserContext> {
    const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: EV_THEME_VALUE[theme], ...extra });
    await prepareContext(context, theme);
    return context;
}
