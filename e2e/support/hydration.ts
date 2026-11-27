/**
 * Lot stabilité (hydratation) — erreurs d'hydratation de React, contrôle durable et sonde de diagnostic.
 *
 * Contrôle (`watchHydration`) : toute erreur d'hydratation lue dans la console ou levée par la page (« Minified React error
 * #418 / #423 / #425 », « Hydration failed », « did not match ») est retenue avec l'adresse de la page ; l'appelant la rend
 * bloquante pour la page concernée, avec son nom (contrôle responsive, captures, spec e2e/hydratation.responsive.spec.ts).
 *
 * Sonde (`installHydrationProbe`, spec de reproduction seulement) : en production, React ne dit pas OÙ le rendu du serveur
 * et celui du navigateur diffèrent. La sonde, posée avant tout script de la page :
 *  - repère, à l'instant où React crée l'erreur (constructeur Error enveloppé, aucun autre effet), les premiers nœuds du
 *    document que React n'a pas encore rattachés à ses composants (pas de clé __reactFiber$), avec leur chemin, leur HTML
 *    et la chaîne des composants parents (noms et noms des propriétés) : c'est l'endroit de l'écart ;
 *  - note les écritures dans le document faites par du JavaScript (appendChild, insertBefore, removeChild, textContent,
 *    innerHTML…) AVANT cette erreur, avec la pile d'appel : une écriture hors de React dans une partie pas encore hydratée
 *    est une cause classique de l'erreur n° 418 « HTML ».
 */
import type { BrowserContext, Page } from '@playwright/test';

/** Messages d'une erreur d'hydratation (React 19 en production : n° 418, 423, 425 ; en développement : textes). */
export const HYDRATION_ERROR_RE = /Minified React error #(418|423|425)\b|Hydration failed|hydrating|did not match/i;

export function isHydrationError(text: string): boolean {
    return HYDRATION_ERROR_RE.test(text);
}

export interface HydrationWatch {
    /** Erreurs d'hydratation vues depuis le début (texte, adresse de la page). */
    readonly errors: string[];
    /** Erreurs vues depuis le repère `mark()` (une page, un chargement). */
    since(mark: number): string[];
    mark(): number;
}

/** Écoute la console et les exceptions de la page ; aucune autre erreur n'est retenue ici. */
export function watchHydration(page: Page): HydrationWatch {
    const errors: string[] = [];
    const where = (): string => {
        try {
            const u = new URL(page.url());
            return `${u.pathname}${u.search}`;
        } catch {
            return page.url();
        }
    };
    page.on('console', (msg) => {
        if (msg.type() !== 'error' && msg.type() !== 'warning') return;
        const text = msg.text();
        if (isHydrationError(text)) errors.push(`console ${msg.type()} sur ${where()} : ${text.slice(0, 400)}`);
    });
    page.on('pageerror', (err) => {
        const text = `${err.name}: ${err.message}`;
        if (isHydrationError(text)) errors.push(`exception sur ${where()} : ${text.slice(0, 400)}`);
    });
    return {
        errors,
        mark: () => errors.length,
        since: (mark) => errors.slice(mark),
    };
}

/** Script de la sonde, exécuté dans la page avant tout autre script (sérialisé tel quel : aucune dépendance). */
function probe(): void {
    const w = window as unknown as Record<string, unknown>;
    if (w.__evHydra) return;
    const OrigError = window.Error;
    const rec = {
        mismatches: [] as Array<Record<string, unknown>>,
        writes: [] as Array<{ t: number; op: string; target: string; stack: string }>,
        stopped: false,
        t0: performance.now(),
    };
    w.__evHydra = rec;
    const RE = /#(418|423|425)\b|Hydration failed|did not match/;

    // Clé posée par React sur chaque nœud qu'il a rattaché (propriété propre du nœud)
    const fiberKey = (n: Node): string | null => Object.keys(n).find((k) => k.indexOf('__reactFiber$') === 0) ?? null;
    const desc = (n: Node | null): string => {
        if (!n) return 'null';
        if (n.nodeType === 3) return `#text « ${String(n.nodeValue).slice(0, 60)} »`;
        if (n.nodeType === 8) return `<!--${String(n.nodeValue).slice(0, 20)}-->`;
        if (n.nodeType !== 1) return `#${n.nodeType}`;
        const el = n as Element;
        let s = el.tagName.toLowerCase();
        if (el.id) s += `#${el.id}`;
        const cls = el.getAttribute('class');
        if (cls) s += `.${cls.trim().split(/\s+/).slice(0, 4).join('.')}`;
        for (const a of ['role', 'aria-label', 'data-ev-countdown', 'data-ev-live', 'hidden', 'type']) {
            if (el.hasAttribute(a)) s += `[${a}="${String(el.getAttribute(a)).slice(0, 30)}"]`;
        }
        return s;
    };
    const pathOf = (n: Node | null): string => {
        const parts: string[] = [];
        let cur: Node | null = n;
        while (cur && cur !== document.documentElement && parts.length < 10) {
            parts.unshift(desc(cur).slice(0, 90));
            cur = cur.parentNode;
        }
        return parts.join(' > ');
    };
    const fiberChain = (n: Node | null): string => {
        if (!n) return '';
        const k = fiberKey(n);
        if (!k) return '(parent sans composant)';
        let f = (n as unknown as Record<string, unknown>)[k] as Record<string, unknown> | null;
        const out: string[] = [];
        for (let i = 0; f && i < 30; i += 1) {
            const t = f.type as unknown;
            let name: string;
            if (typeof t === 'string') name = t;
            else if (typeof t === 'function') name = (t as { displayName?: string; name?: string }).displayName || (t as { name?: string }).name || 'fn';
            else if (t && typeof t === 'object') {
                const o = t as { displayName?: string; render?: { name?: string }; $$typeof?: symbol };
                name = o.displayName || o.render?.name || String(o.$$typeof ?? 'objet');
            } else name = `tag${String(f.tag)}`;
            const props = f.memoizedProps && typeof f.memoizedProps === 'object' && typeof t !== 'string'
                ? Object.keys(f.memoizedProps as object).filter((x) => x !== 'children').slice(0, 8).join(',')
                : '';
            out.push(props ? `${name}{${props}}` : name);
            f = f.return as Record<string, unknown> | null;
        }
        return out.join(' < ');
    };
    const ignored = (n: Node): boolean => {
        for (let a: Node | null = n; a && a !== document.body; a = a.parentNode) {
            if (a.nodeType !== 1) continue;
            const el = a as Element;
            if (/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT|NEXT-ROUTE-ANNOUNCER)$/.test(el.tagName)) return true;
            if (el.hasAttribute('hidden') && /^S:/.test(el.id || '')) return true;
        }
        return false;
    };
    const scan = (): Array<Record<string, string>> => {
        const out: Array<Record<string, string>> = [];
        if (!document.body) return out;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode()) && out.length < 6) {
            if (n.nodeType === 3 && !/\S/.test(String(n.nodeValue))) continue;
            if (ignored(n) || fiberKey(n)) continue;
            const parent = n.parentNode;
            if (!parent || (parent !== document.body && !fiberKey(parent))) continue;
            out.push({
                noeud: desc(n),
                chemin: pathOf(n),
                avant: desc(n.previousSibling),
                html: n.nodeType === 1 ? (n as Element).outerHTML.slice(0, 400) : String(n.nodeValue).slice(0, 200),
                composants: fiberChain(parent),
            });
        }
        return out;
    };
    const shortStack = (): string => {
        const s = String(new OrigError('pile').stack || '').split('\n').slice(3, 9);
        return s.map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, '')).join(' | ');
    };

    function PatchedError(this: unknown, ...args: unknown[]): Error {
        const e = new.target ? (Reflect.construct(OrigError, args, new.target) as Error) : OrigError(...(args as [string?]));
        try {
            const m = String(args[0] ?? '');
            if (RE.test(m) && rec.mismatches.length < 3) {
                rec.stopped = true;
                rec.mismatches.push({ t: Math.round(performance.now() - rec.t0), message: m.slice(0, 160), candidats: scan(), pile: shortStack() });
            }
        } catch (err) {
            rec.mismatches.push({ erreurSonde: String(err) });
        }
        return e;
    }
    PatchedError.prototype = OrigError.prototype;
    Object.setPrototypeOf(PatchedError, OrigError);
    w.Error = PatchedError;

    const inDoc = (n: unknown): boolean => n instanceof Node && n.isConnected && !!document.body && document.body.contains(n);
    const note = (op: string, target: Node): void => {
        if (rec.stopped || rec.writes.length >= 200 || performance.now() - rec.t0 > 20_000 || !inDoc(target) || ignored(target)) return;
        rec.writes.push({ t: Math.round(performance.now() - rec.t0), op, target: pathOf(target).slice(-240), stack: shortStack() });
    };
    const wrap = <T extends object>(proto: T, name: string): void => {
        const orig = (proto as Record<string, unknown>)[name];
        if (typeof orig !== 'function') return;
        (proto as Record<string, unknown>)[name] = function (this: Node, ...a: unknown[]) {
            note(name, this);
            return (orig as (...x: unknown[]) => unknown).apply(this, a);
        };
    };
    for (const m of ['appendChild', 'insertBefore', 'removeChild', 'replaceChild']) wrap(Node.prototype, m);
    for (const m of ['append', 'prepend', 'remove', 'replaceWith', 'before', 'after', 'insertAdjacentHTML', 'insertAdjacentElement', 'replaceChildren']) wrap(Element.prototype, m);
    const wrapSetter = (proto: object, prop: string): void => {
        const d = Object.getOwnPropertyDescriptor(proto, prop);
        if (!d || !d.set) return;
        const set = d.set;
        Object.defineProperty(proto, prop, {
            ...d,
            set(this: Node, v: unknown) {
                note(`${prop}=`, this);
                set.call(this, v);
            },
        });
    };
    wrapSetter(Node.prototype, 'textContent');
    wrapSetter(Element.prototype, 'innerHTML');
    wrapSetter(CharacterData.prototype, 'data');
    wrapSetter(Node.prototype, 'nodeValue');
}

/** Pose la sonde sur tout le contexte (avant tout script de chaque page). */
export async function installHydrationProbe(context: BrowserContext): Promise<void> {
    await context.addInitScript(probe);
}

export interface ProbeReport {
    mismatches: Array<Record<string, unknown>>;
    writes: Array<{ t: number; op: string; target: string; stack: string }>;
}

/** Relevé de la sonde de la page courante (vide si la sonde n'est pas posée). */
export async function readProbe(page: Page): Promise<ProbeReport> {
    return page.evaluate(() => {
        const r = (window as unknown as { __evHydra?: { mismatches: unknown[]; writes: unknown[] } }).__evHydra;
        return { mismatches: (r?.mismatches ?? []) as ProbeReport['mismatches'], writes: (r?.writes ?? []) as ProbeReport['writes'] };
    });
}

/** Relevé lisible pour le journal du test (écart et écritures qui le précèdent). */
export function formatProbe(report: ProbeReport): string {
    const lines: string[] = [];
    for (const m of report.mismatches) {
        lines.push(`  écart à ${String(m.t)} ms : ${String(m.message ?? m.erreurSonde ?? '')}`);
        lines.push(`    pile : ${String(m.pile ?? '')}`);
        for (const c of (m.candidats as Array<Record<string, string>> | undefined) ?? []) {
            lines.push(`    nœud non hydraté : ${c.noeud}`);
            lines.push(`      chemin : ${c.chemin}`);
            lines.push(`      précédé de : ${c.avant}`);
            lines.push(`      html : ${c.html}`);
            lines.push(`      composants parents : ${c.composants}`);
        }
    }
    if (report.writes.length > 0) {
        lines.push(`  écritures dans le document avant l'écart (${report.writes.length}) :`);
        for (const w of report.writes) lines.push(`    ${w.t} ms ${w.op} sur ${w.target}\n      ${w.stack}`);
    }
    return lines.join('\n');
}
