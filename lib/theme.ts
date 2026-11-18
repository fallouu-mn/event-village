/**
 * Design 1a (direction.md, section 9, décision 5) — thème de l'application.
 *
 * Par défaut, celui du téléphone (`system`) ; le choix « Clair » ou « Sombre » est mémorisé dans le cookie `ev-theme`
 * (un an, tout le site, aucune donnée personnelle). Le thème est posé sur <html> par THEME_BOOT_SCRIPT, script bloquant
 * placé dans <head> (app/layout.tsx) : il s'exécute avant le premier affichage, donc aucun flash du clair au sombre.
 * Le gabarit racine ne lit pas le cookie côté serveur : `cookies()` rendrait toutes les pages dynamiques.
 * Ancien choix rangé dans localStorage (avant le design 1a) : relu une fois, puis recopié dans le cookie.
 * Module sans dépendance : importable par le serveur comme par un composant client.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_COOKIE = 'ev-theme';
const MAX_AGE = 365 * 24 * 3600;

export function isThemeChoice(value: unknown): value is ThemeChoice {
    return value === 'system' || value === 'light' || value === 'dark';
}

/** Choix lu dans une chaîne de cookies (document.cookie), sinon null. */
export function themeFromCookie(cookieHeader: string): ThemeChoice | null {
    const m = /(?:^|;\s*)ev-theme=(system|light|dark)(?:;|$)/.exec(cookieHeader);
    return m ? (m[1] as ThemeChoice) : null;
}

export function themeCookie(choice: ThemeChoice, secure: boolean): string {
    return `${THEME_COOKIE}=${choice}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * Script bloquant de <head> : choix du cookie (ou ancien choix de localStorage), `system` par défaut ; classe `dark`
 * et color-scheme posés sur <html> avant le premier affichage. Toute erreur laisse le thème clair du CSS.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,m=/(?:^|;\\s*)ev-theme=(system|light|dark)(?:;|$)/.exec(document.cookie),t=m?m[1]:null;if(!t){try{t=localStorage.getItem('ev-theme')}catch(e){}if(t!=='light'&&t!=='dark')t='system'}var k=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('dark',k);d.style.colorScheme=k?'dark':'light';d.setAttribute('data-theme-choice',t)}catch(e){}})();`;
