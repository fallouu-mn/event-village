/**
 * Design 1c (point 1) — contrôles de mise en page d'une largeur donnée (e2e/responsive.spec.ts).
 *
 * Bloquants, à chaque largeur :
 *  - défilement horizontal de la page (largeur du document > largeur de la fenêtre) ;
 *  - texte hors de l'écran (à gauche ou à droite de la fenêtre, hors d'une zone qui défile en largeur exprès) ;
 *  - texte coupé : dépassant d'un conteneur qui masque son débordement (overflow hidden ou clip), y compris tronqué par
 *    des points de suspension ou par un nombre de lignes, sauf si le texte entier est donné au même endroit (attribut
 *    title ou aria-label de l'élément ou de son lien, de son bouton) ;
 *  - chevauchement : deux textes différents (aucun des deux dans l'autre) qui se recouvrent, dans la même couche
 *    (page, ou même élément fixe ou collant : une barre fixe passe au-dessus du contenu qui défile, c'est voulu) ;
 *  - tableau affiché sur téléphone (≤ 390 px) : des cartes sont attendues (DataList) ;
 *  - et les contrôles communs de checks.ts (runPageChecks, sans axe) : cibles < 44 px, textes < 14 px hors mentions et
 *    légendes, mots et codes techniques, « § ».
 */
import type { Page } from '@playwright/test';
import { runPageChecks } from './checks';

export interface LayoutReport {
    scrollWidth: number;
    viewportWidth: number;
    offscreen: string[];
    clipped: string[];
    truncated: string[];
    overlaps: string[];
    tables: string[];
}

interface LayoutArg {
    phone: boolean;
}

/** Sérialisée vers la page : aucune référence extérieure. */
function inspectLayout(arg: LayoutArg): LayoutReport {
    const vw = document.documentElement.clientWidth;
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION']);
    const visible = (el: Element): boolean => {
        const withApi = el as Element & { checkVisibility?: (o?: Record<string, boolean>) => boolean };
        if (typeof withApi.checkVisibility === 'function') return withApi.checkVisibility({ visibilityProperty: true, opacityProperty: true });
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    const label = (el: Element, text: string): string => {
        const tag = el.tagName.toLowerCase();
        const cls = Array.from(el.classList).filter((c) => !c.includes(':')).slice(0, 2).join('.');
        return `${tag}${cls ? `.${cls}` : ''} « ${text.replace(/\s+/g, ' ').trim().slice(0, 50)} »`;
    };
    // Élément masqué pour les lecteurs d'écran seulement (sr-only : 1 px, clip) : jamais contrôlé
    const srOnly = (el: Element): boolean => {
        for (let cur: Element | null = el; cur && cur !== document.body; cur = cur.parentElement) {
            const s = getComputedStyle(cur);
            if (s.position === 'absolute' && (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)')) return true;
            const r = cur.getBoundingClientRect();
            if (r.width <= 1 && r.height <= 1 && s.overflow === 'hidden') return true;
        }
        return false;
    };
    // Couche : premier ancêtre fixe ou collant (ou la page)
    const layerOf = (el: Element): Element | null => {
        for (let cur: Element | null = el; cur && cur !== document.body; cur = cur.parentElement) {
            const p = getComputedStyle(cur).position;
            if (p === 'fixed' || p === 'sticky') return cur;
        }
        return null;
    };
    // Zone qui défile en largeur exprès (onglets, puces, carrousels) : ses débordements ne sont pas des défauts
    const inHorizontalScroller = (el: Element): boolean => {
        for (let cur: Element | null = el.parentElement; cur && cur !== document.body; cur = cur.parentElement) {
            const s = getComputedStyle(cur);
            if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && cur.scrollWidth > cur.clientWidth + 1) return true;
        }
        return false;
    };
    const fullTextGiven = (el: Element, text: string): boolean => {
        const want = text.replace(/\s+/g, ' ').trim();
        for (let cur: Element | null = el; cur && cur !== document.body; cur = cur.parentElement) {
            for (const attr of ['title', 'aria-label']) {
                const v = cur.getAttribute(attr);
                if (v && v.replace(/\s+/g, ' ').includes(want)) return true;
            }
            if (cur.tagName === 'A' || cur.tagName === 'BUTTON') break;
        }
        return false;
    };

    const offscreen: string[] = [];
    const clipped: string[] = [];
    const truncated: string[] = [];
    const items: Array<{ el: Element; layer: Element | null; r: DOMRect }> = [];
    const seenClip = new Set<Element>();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        const text = node.nodeValue ?? '';
        if (!el || !text.trim() || skip.has(el.tagName) || !visible(el) || srOnly(el)) continue;
        // Décor doublé pour les lecteurs d'écran (aria-hidden) : son texte visible est contrôlé comme les autres

        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1);
        if (rects.length === 0) continue;
        const scroller = inHorizontalScroller(el);
        for (const r of rects) {
            if (!scroller && (r.right > vw + 1 || r.left < -1)) {
                offscreen.push(`${label(el, text)} de ${Math.round(r.left)} à ${Math.round(r.right)} px (fenêtre ${vw} px)`);
                break;
            }
        }
        // Coupé par un conteneur qui masque son débordement
        if (!seenClip.has(el)) {
            // Lot 12b (modification signalée au rapport du lot) : au-delà d'un conteneur qui défile en hauteur (corps d'une
            // fenêtre, panneau collant), un texte sous la ligne de flottaison s'atteint en faisant défiler : il n'est pas
            // « coupé » par les ancêtres qui masquent leur débordement (la fenêtre elle-même). Le contrôle en largeur ne
            // change pas.
            let scrolledY = false;
            for (let cur: Element | null = el; cur && cur !== document.body; cur = cur.parentElement) {
                const s = getComputedStyle(cur);
                if (cur !== el && (s.overflowY === 'auto' || s.overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight + 1) scrolledY = true;
                const hidesX = s.overflowX === 'hidden' || s.overflowX === 'clip';
                const hidesY = !scrolledY && (s.overflowY === 'hidden' || s.overflowY === 'clip');
                if (!hidesX && !hidesY) continue;
                const box = cur.getBoundingClientRect();
                // Conteneur hors d'usage (fermé à 0 px : accordéon replié, animation) : déjà invisible
                if (box.width < 2 || box.height < 2) break;
                const out = rects.some((r) => (hidesX && (r.right > box.right + 1 || r.left < box.left - 1))
                    || (hidesY && (r.bottom > box.bottom + 1 || r.top < box.top - 1)));
                const ellipsis = s.textOverflow === 'ellipsis' && cur.scrollWidth > cur.clientWidth + 1;
                const clamp = (s.webkitLineClamp && s.webkitLineClamp !== 'none') && cur.scrollHeight > cur.clientHeight + 1;
                if (ellipsis || clamp) {
                    if (!fullTextGiven(cur, text) && !fullTextGiven(el, text)) {
                        truncated.push(`${label(cur, cur.textContent ?? text)} (${ellipsis ? 'points de suspension' : 'lignes limitées'}, texte entier absent)`);
                    }
                    seenClip.add(el);
                    break;
                }
                if (out && !inHorizontalScroller(cur)) {
                    clipped.push(`${label(el, text)} dépasse de ${label(cur, '').replace(/ « » ?$/, '')}`);
                    seenClip.add(el);
                    break;
                }
            }
        }
        const layer = layerOf(el);
        for (const r of rects) items.push({ el, layer, r });
    }

    // Chevauchements : textes d'éléments différents, même couche, recouvrement réel (> 2 px dans les deux sens)
    const overlaps: string[] = [];
    const seenPair = new Set<string>();
    items.sort((a, b) => a.r.top - b.r.top);
    for (let i = 0; i < items.length && overlaps.length < 12; i++) {
        const a = items[i];
        for (let j = i + 1; j < items.length; j++) {
            const b = items[j];
            if (b.r.top >= a.r.bottom - 2) break;
            if (a.el === b.el || a.layer !== b.layer || a.el.contains(b.el) || b.el.contains(a.el)) continue;
            const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
            const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
            if (w <= 2 || h <= 2) continue;
            const key = `${label(a.el, a.el.textContent ?? '')}|${label(b.el, b.el.textContent ?? '')}`;
            if (seenPair.has(key)) continue;
            seenPair.add(key);
            overlaps.push(`${label(a.el, a.el.textContent ?? '')} sur ${label(b.el, b.el.textContent ?? '')} (${Math.round(w)}×${Math.round(h)} px)`);
            if (overlaps.length >= 12) break;
        }
    }

    const tables: string[] = [];
    if (arg.phone) {
        for (const t of Array.from(document.querySelectorAll('table, [role="table"], [role="grid"]'))) {
            if (!visible(t) || srOnly(t)) continue;
            const r = t.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            const cap = t.querySelector('caption')?.textContent ?? t.getAttribute('aria-label') ?? '';
            tables.push(`tableau « ${cap.trim().slice(0, 50) || 'sans légende'} » (${Math.round(r.width)} px)`);
        }
    }

    return {
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0),
        viewportWidth: vw,
        offscreen: offscreen.slice(0, 12),
        clipped: clipped.slice(0, 12),
        truncated: truncated.slice(0, 12),
        overlaps,
        tables,
    };
}

export interface ResponsiveCheckResult {
    blocking: string[];
    warnings: string[];
    layout: LayoutReport;
}

/** Contrôles d'une largeur (page déjà chargée et stable). */
export async function runResponsiveChecks(page: Page, opts: { width: number; phone: boolean }): Promise<ResponsiveCheckResult> {
    await page.evaluate('window.__name = window.__name || function (f) { return f; };');
    // Sections hors écran en content-visibility: auto (accueil, design 1b) : sans mise en page réelle, leurs textes
    // donnaient de faux chevauchements (run 434). Rendu forcé le temps du contrôle, puis deux images d'affichage.
    await page.addStyleTag({ content: '*{content-visibility:visible!important}' });
    await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
    const layout = await page.evaluate(inspectLayout, { phone: opts.phone });
    const blocking: string[] = [];
    const at = `${opts.width} px`;
    if (layout.scrollWidth > layout.viewportWidth + 1) {
        blocking.push(`${at} : défilement horizontal (largeur du document ${layout.scrollWidth} px, fenêtre ${layout.viewportWidth} px)`);
    }
    if (layout.offscreen.length > 0) blocking.push(`${at} : texte hors de l’écran : ${layout.offscreen.join(' ; ')}`);
    if (layout.clipped.length > 0) blocking.push(`${at} : texte coupé : ${layout.clipped.join(' ; ')}`);
    if (layout.truncated.length > 0) blocking.push(`${at} : texte tronqué sans le texte entier : ${layout.truncated.join(' ; ')}`);
    if (layout.overlaps.length > 0) blocking.push(`${at} : textes qui se chevauchent : ${layout.overlaps.join(' ; ')}`);
    if (layout.tables.length > 0) blocking.push(`${at} : tableau sur téléphone (cartes attendues) : ${layout.tables.join(' ; ')}`);
    const common = await runPageChecks(page, { mobile: false, axe: false });
    blocking.push(...common.blocking.map((b) => `${at} : ${b}`));
    return { blocking, warnings: common.warnings.map((w) => `${at} : ${w}`), layout };
}
