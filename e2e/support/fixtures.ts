/**
 * Lot 5.1 — fixtures Playwright communes :
 *  - verrou réseau sur chaque contexte (network.ts) ;
 *  - thème posé avant le chargement : localStorage['ev-theme'] par script d'initialisation (lu par
 *    le script anti-flash de app/layout.tsx et par ThemeProvider), plus colorScheme du contexte ;
 *  - état de connexion du rôle de l'écran (evRole), erreur explicite s'il manque ;
 *  - collecte des erreurs de la page (guard).
 * Le paramètre des fixtures s'appelle `provide` (et non `use`) : eslint-plugin-react-hooks
 * confond sinon la fonction de Playwright avec le hook React `use`.
 */
import { test as base, expect, type Browser, type BrowserContext, type BrowserContextOptions, type TestInfo } from '@playwright/test';
import { requireStorageState, type RoleKey } from './accounts';
import { e2eConfig } from './env';
import { installNetworkGuard, PageGuard } from './network';

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

export async function prepareContext(context: BrowserContext, theme: ThemeKey): Promise<void> {
    await installNetworkGuard(context, e2eConfig().allowedHosts);
    // Aide __name (esbuild/tsx) disponible pour toute fonction sérialisée vers la page
    await context.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
    await context.addInitScript(setThemeBeforeLoad, EV_THEME_VALUE[theme]);
}

interface Fixtures {
    evTheme: ThemeKey;
    evRole: CaptureRole;
    guard: PageGuard;
}

export const test = base.extend<Fixtures>({
    evTheme: ['clair', { option: true }],
    evRole: ['anonyme', { option: true }],
    storageState: async ({ evRole }, provide) => {
        await provide(evRole === 'anonyme' ? { cookies: [], origins: [] } : requireStorageState(evRole));
    },
    context: async ({ context, evTheme }, provide) => {
        await prepareContext(context, evTheme);
        await provide(context);
    },
    guard: async ({ page }, provide) => {
        await provide(new PageGuard(page));
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
