/**
 * Design 1e (points 2 et 3) — navigation fluide de la coquille commune (contrôles statiques ; rendu réel : captures et
 * contrôle responsive de la CI).
 *  - animations de 150 à 300 ms, transform et opacity seulement (visibility pour masquer), jamais en boucle, coupées par
 *    « réduire les animations » ;
 *  - barre du bas flottante en pilule, pastille orange qui glisse, point des notifications, cibles ≥ 44 px, zone sûre ;
 *  - menu : la page recule, menu orange derrière, fermeture par toucher, glissement et Échap, focus piégé, 280 ms ;
 *  - ordinateur : trait orange de l'en-tête, menu du compte qui glisse, barre latérale repliable gardée sur l'appareil
 *    (try/catch), info-bulles ;
 *  - panneau des notifications : glisse, avis groupés par jour, plein écran sur téléphone, fermé en glissant vers le bas.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

/** Bloc CSS « DESIGN 1e — NAVIGATION FLUIDE » d'app/globals.css (jusqu'au bloc suivant). */
function navCss(): string {
    const css = read('app/globals.css');
    const start = css.indexOf('DESIGN 1e — NAVIGATION FLUIDE');
    assert.ok(start > 0, 'bloc CSS de la navigation du design 1e absent');
    const end = css.indexOf('ANIMATIONS FLUIDES SYSTÈME TOASTS', start);
    return css.slice(start, end > start ? end : undefined);
}

describe('design 1e — animations de la coquille', () => {
    test('transitions : transform et opacity seulement (visibility pour masquer), de 150 à 300 ms', () => {
        const css = navCss();
        const faults: string[] = [];
        for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
            for (const part of m[1].split(/,(?![^(]*\))/)) {
                const [prop, ...rest] = part.trim().split(/\s+/);
                const dur = rest.find((t) => /^\d+m?s$/.test(t));
                const ms = dur ? (dur.endsWith('ms') ? Number(dur.slice(0, -2)) : Number(dur.slice(0, -1)) * 1000) : NaN;
                if (!['transform', 'opacity', 'visibility'].includes(prop)) faults.push(`propriété animée : ${prop}`);
                if (prop !== 'visibility' && !(ms >= 150 && ms <= 300)) faults.push(`${prop} : ${dur ?? 'durée absente'} hors de 150-300 ms`);
            }
        }
        for (const m of css.matchAll(/animation:\s*([^;]+);/g)) {
            if (/infinite/.test(m[1])) faults.push(`animation en boucle : ${m[1]}`);
            const d = m[1].match(/(\d+)ms/);
            if (!d || Number(d[1]) < 150 || Number(d[1]) > 300) faults.push(`animation hors de 150-300 ms : ${m[1]}`);
        }
        assert.deepEqual(faults, []);
    });

    test('« réduire les animations » coupe tout (règle globale), le menu se referme sans attendre', () => {
        const css = read('app/globals.css');
        assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*animation-duration: 0\.01ms !important;/);
        assert.match(read('components/layout/PushMenu.tsx'), /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches;\n\s*if \(reduce\) \{ done\(\); return undefined; \}/);
    });

    test('aucune classe d’animation en boucle dans les nouveaux composants', () => {
        for (const f of ['BottomNav', 'PushMenu', 'DesktopNav', 'AccountMenu', 'ProSidebar']) {
            assert.doesNotMatch(read(`components/layout/${f}.tsx`), /animate-(pulse|ping|spin|bounce)|infinite/, f);
        }
    });
});

describe('design 1e — barre du bas (< 1024 px)', () => {
    const src = read('components/layout/BottomNav.tsx');
    test('pilule flottante blanche / noire, pastille orange qui glisse par transform, ressort de 250 ms', () => {
        assert.match(src, /rounded-full bg-nav-bar p-1 shadow-lg/);
        assert.match(src, /ev-nav-pill absolute bottom-1 left-1 top-1 rounded-full bg-brand-vif/);
        assert.match(src, /transform: `translateX\(\$\{Math\.max\(index, 0\) \* 100\}%\)`/);
        assert.match(navCss(), /\.ev-nav-pill \{\s*transition: transform 250ms cubic-bezier\(0\.34, 1\.32, 0\.64, 1\)/);
        const css = read('app/globals.css');
        assert.match(css, /--nav-bar: 255 255 255;/);
        assert.match(css, /--nav-bar: 0 0 0;/);
    });
    test('onglet actif en #1A1A1A sur l’orange ; cibles de 44 px ; zone sûre ; libellés entiers', () => {
        assert.match(src, /active \? 'text-brand-vif-foreground'/);
        assert.match(src, /flex h-12 min-w-0 flex-1/, 'onglets de 48 px, hauteur fixe');
        assert.match(navCss(), /\.ev-bottom-nav \{\s*padding-bottom: max\(0\.5rem, env\(safe-area-inset-bottom, 0px\)\);/);
        assert.match(src, /\[overflow-wrap:anywhere\]/);
        assert.doesNotMatch(src, /truncate/);
    });
    test('point « du nouveau » sur Notifications, lu dans le compteur de la cloche (aucun appel de plus), annoncé', () => {
        const layout = read('components/layout/AppLayout.tsx');
        assert.match(layout, /\{ name: 'Notifications', short: 'Avis', href: '\/notifications', icon: Bell, dot: isUserLoggedIn && unreadCount > 0 \}/);
        assert.match(layout, /const unreadCount = useUnreadCount\(\);/);
        assert.match(src, /<span className="sr-only"> \(nouvelles notifications\)<\/span>/);
        assert.match(read('components/notifications/NotificationBell.tsx'), /publishUnread\(isUserLoggedIn \? unreadCount : 0\)/);
        assert.doesNotMatch(read('components/notifications/unread-store.ts'), /fetch\(/);
    });
    test('la barre d’achat de la fiche reste juste au-dessus de la barre flottante', () => {
        assert.match(read('components/event-page/EventTicketing.tsx'), /bottom-\[calc\(3\.5rem\+max\(0\.5rem,env\(safe-area-inset-bottom\)\)\)\]/);
    });
});

describe('design 1e — menu du téléphone (< 1024 px)', () => {
    const src = read('components/layout/PushMenu.tsx');
    test('la page recule (réduction, coins arrondis, ombre) et glisse ; menu derrière sur l’orange, 280 ms', () => {
        const css = navCss();
        assert.match(css, /\.ev-push-page\[data-menu='ouvert'\] \{\s*transform: translateX\(min\(68vw, 320px\)\) scale\(0\.86\);\s*border-radius: 28px;/);
        assert.match(css, /\.ev-push-page \{\s*transform-origin: left center;\s*transition: transform 280ms/);
        assert.match(src, /ev-push-menu fixed inset-0 z-0 flex flex-col bg-brand-vif lg:hidden/);
        assert.match(src, /const DURATION_MS = 280;/);
        assert.match(read('components/layout/AppLayout.tsx'), /<div ref=\{pageRef\} className="ev-push-page relative z-10 /);
    });
    test('entrées en blanc gras de 19 px, petits libellés en #1A1A1A', () => {
        const layout = read('components/layout/AppLayout.tsx');
        assert.match(layout, /text-\[1\.1875rem\] font-bold leading-tight text-primary-foreground-large/);
        assert.match(layout, /variant === 'menu' \? 'text-brand-vif-foreground'/);
    });
    test('fermeture : toucher la page, glisser vers la gauche, Échap, bouton ; focus piégé (page inerte, Tab qui tourne)', () => {
        assert.match(src, /page\.setAttribute\('inert', ''\);/);
        assert.match(src, /if \(e\.key === 'Escape'\)/);
        assert.match(src, /if \(dx < -50 && Math\.abs\(dx\) > Math\.abs\(t\.clientY - start\.y\)\) onCloseRef\.current\(\);/);
        assert.match(src, /if \(e\.shiftKey && document\.activeElement === first\) \{ e\.preventDefault\(\); last\.focus\(\); \}/);
        assert.match(src, /returnFocusRef\.current\?\.focus\(\);/);
        assert.match(src, /aria-label="Fermer le menu"/);
        assert.match(src, /role="dialog"\n\s*aria-modal="true"\n\s*aria-label="Menu"/);
    });
    test('rien au premier affichage : module chargé et contenu rendu à la première ouverture', () => {
        assert.match(src, /if \(!rendered\) return null;/);
        const layout = read('components/layout/AppLayout.tsx');
        assert.match(layout, /const PushMenu = lazyPart\(\(\) => import\('\.\/PushMenu'\)/);
        assert.match(layout, /\{menuWanted && <Suspense fallback=\{null\}><PushMenu/);
    });
});

describe('design 1e — ordinateur (≥ 1024 px)', () => {
    test('en-tête : trait orange qui glisse sous la rubrique active et suit le survol', () => {
        const src = read('components/layout/DesktopNav.tsx');
        assert.match(src, /onMouseEnter=\{\(\) => setTarget\(i\)\}/);
        assert.match(src, /onMouseLeave=\{\(\) => setTarget\(null\)\}/);
        assert.match(src, /transform: `translateX\(\$\{box\?\.x \?\? 0\}px\) scaleX\(\$\{\(box\?\.w \?\? 0\) \/ 100\}\)`/);
        assert.match(src, /bg-brand-vif/);
        assert.match(src, /if \(!window\.matchMedia\(LARGE\)\.matches\) return;/, 'aucune mesure sur téléphone');
    });
    test('menu du compte : bouton à état, glisse (translation et fondu), Échap et clic ailleurs', () => {
        const src = read('components/layout/AccountMenu.tsx');
        assert.match(src, /aria-expanded=\{open\}/);
        assert.match(src, /open \? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'/);
        assert.match(src, /e\.key === 'Escape'/);
        assert.match(navCss(), /\.ev-account-menu \{\s*transition: transform 200ms/);
    });
    test('barre latérale : espaces organisatrice et administration seulement, surlignage qui glisse, repliable par transform', () => {
        const layout = read('components/layout/AppLayout.tsx');
        assert.match(layout, /const isProShell = isPartnerRoute \|\| isAdminRoute;/);
        assert.match(layout, /\{isProShell && <Suspense fallback=\{<div className="ev-side-spacer hidden flex-shrink-0 lg:block" aria-hidden="true" \/>\}>\n\s*<ProSidebar/);
        assert.match(layout, /const ProSidebar = lazyPart\(\(\) => import\('\.\/ProSidebar'\)/, 'chargée seulement dans les espaces pro');
        const css = navCss();
        assert.match(css, /html\[data-sidebar='replie'\] \.ev-side \{\s*transform: translateX\(calc\(var\(--side-mini\) - var\(--side-w\)\)\);/);
        assert.match(css, /html\[data-sidebar='replie'\] \.ev-side-icon \{\s*transform: translateX\(calc\(var\(--side-w\) - var\(--side-mini\)\)\);/);
        const side = read('components/layout/ProSidebar.tsx');
        assert.match(side, /transform: `translateY\(\$\{hl\?\.y \?\? 0\}px\)`/);
        assert.match(side, /role="tooltip"/);
    });
    test('choix gardé sur l’appareil, toujours dans try/catch, posé avant le premier affichage', () => {
        const side = read('components/layout/ProSidebar.tsx');
        assert.match(side, /try \{\n\s*if \(next\) window\.localStorage\.setItem\(SIDEBAR_KEY, SIDEBAR_COLLAPSED\);/);
        assert.match(side, /\} catch \(err\) \{\n\s*console\.warn\(/);
        const state = read('components/layout/sidebar-state.ts');
        assert.match(state, /export const SIDEBAR_BOOT_SCRIPT = `try\{if\(localStorage\.getItem/);
        assert.match(read('app/layout.tsx'), /<script dangerouslySetInnerHTML=\{\{ __html: SIDEBAR_BOOT_SCRIPT \}\} \/>/);
    });
});

describe('design 1e — panneau des notifications', () => {
    test('glisse (droite sur ordinateur, du bas et plein écran sur téléphone), fermé en glissant vers le bas', async () => {
        const src = read('components/layout/NotificationPanel.tsx');
        assert.match(src, /p\.shown \? 'translate-x-0 translate-y-0' : 'translate-y-full sm:translate-x-full sm:translate-y-0'/);
        assert.match(src, /'ev-notif-panel fixed inset-0 z-\[61\] flex flex-col bg-popover/);
        assert.match(src, /if \(dragY > 110\) p\.onClose\(\);/);
        assert.match(src, /createPortal\(/);
        const bell = read('components/notifications/NotificationBell.tsx');
        assert.match(bell, /key=\{countText\} className="ev-count-pop /, 'compteur animé une fois par nouveau nombre');
        assert.match(bell, /import\('@\/components\/layout\/NotificationPanel'\)/, 'panneau chargé à la demande (rien dans chaque page)');
        assert.match(navCss(), /\.ev-count-pop \{\s*animation: ev-count-pop 300ms var\(--ease-out\) 1;/);
    });
    test('avis groupés par jour : « Aujourd’hui », « Hier », puis la date (heure de Dakar)', async () => {
        const { groupByDay } = await import('../../components/layout/NotificationPanel');
        const now = new Date('2026-11-21T10:00:00Z');
        const n = (id: string, createdAt: string) => ({ id, userId: 'u', type: 'SYSTEM', title: id, content: '', status: '', isRead: false, readAt: null, actionUrl: null, createdAt });
        const groups = groupByDay([
            n('a', '2026-11-21T09:00:00Z'), n('b', '2026-11-21T00:10:00Z'), n('c', '2026-11-20T23:59:00Z'), n('d', '2026-11-18T12:00:00Z'), n('e', 'illisible'),
        ], now);
        assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.id).join('')]), [
            ['Aujourd’hui', 'ab'], ['Hier', 'c'], ['Mercredi 18 novembre', 'd'], ['Plus ancien', 'e'],
        ]);
    });
});
