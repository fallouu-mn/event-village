/**
 * Lot 5.1 — contrôles automatiques de chaque capture (définition de « terminé », points 3, 5 et 7).
 *
 * Bloquants : défilement horizontal à 390 px, « § », valeur d'enum brute (liste ci-dessous) ou code
 * technique en MAJUSCULES_SOULIGNÉES dans le texte visible ou les attributs lus par les lecteurs
 * d'écran (aria-label, title, placeholder, alt). Le texte est lu nœud par nœud, avant toute
 * transformation CSS (un badge « Brouillon » en capitales CSS n'est pas un enum brut).
 * Avertissements (index.txt) : cibles interactives < 44 px, textes < 14 px, violations axe-core.
 * Détail axe (index.txt, relecture du run 50) : pour chaque règle, les AXE_NODES_PER_RULE premiers nœuds
 * (sélecteur, HTML tronqué, résumé de l'échec : couleurs et ratio pour color-contrast).
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** Valeurs techniques qui ne doivent jamais être affichées telles quelles. */
export const RAW_ENUM_VALUES: readonly string[] = [
    // statuts d'événement (event_status)
    'BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE', 'ANNULE',
    // catégories d'événement (event_category)
    'CONCERT', 'FESTIVAL', 'FOOD', 'SALLE',
    // billets (ticket_status) et canaux de vente (lot 5, C7)
    'UTILISE', 'REMBOURSE', 'REMBOURSEMENT_EN_COURS', 'ONLINE', 'FREE', 'INVITATION', 'COUNTER',
    // paiements (payment_status_enum), opérateurs, espèces
    'PENDING', 'PARTIAL', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING',
    'WAVE', 'ORANGE_MONEY', 'ESPECES',
    // envois d'argent (cashouts) et remboursements
    'A_ENVOYER', 'ENVOYE', 'CONFIRME', 'ECHOUE', 'INCERTAIN', 'PROCESSED', 'PLATEFORME', 'ORGANISATEUR',
    // caisses, saisie, incidents de scan (lot 5, C8)
    'OUVERT', 'CLOTURE', 'LITIGE', 'MANUAL', 'RATE_LIMITED', 'SERVER_ERROR', 'GUARD_UNAVAILABLE', 'NETWORK', 'TIMEOUT',
    // rôles, statuts de compte et de partenaire
    'PARTENAIRE', 'CONTROLEUR', 'SUPERADMIN', 'ACTIF', 'REJETE', 'SUPPRIME',
    // cycle de vie (lot 5, D) et stock public (O1)
    'SYSTEM', 'CREATION', 'TRANSITION', 'CANCELLATION', 'CRON', 'AVAILABLE', 'LOW', 'SOLD_OUT',
    // résultats de scan (lib/scan/scan-result.ts)
    'valid', 'invalid', 'already_used', 'wrong_event', 'event_cancelled', 'event_ended', 'event_suspended',
    'event_not_open', 'payment_required', 'cash_required', 'qr_expired', 'dynamic_qr_required',
    'manual_entry_refused', 'forbidden', 'refunded', 'cancelled', 'rate_limited', 'server_error',
];

/** Nœuds détaillés par règle axe dans index.txt, et longueurs maximales des extraits. */
export const AXE_NODES_PER_RULE = 5;
const AXE_HTML_MAX = 160;
const AXE_SUMMARY_MAX = 300;

export interface PageCheckResult {
    blocking: string[];
    warnings: string[];
    /** Une ligne par nœud fautif : « <règle> [i/n] <cible> | <html> | <résumé> ». */
    axeDetails: string[];
    metrics: { scrollWidth: number; viewportWidth: number; smallTargets: number; smallTexts: number; axeViolations: number };
}

interface DomReport {
    scrollWidth: number;
    viewportWidth: number;
    sectionSigns: string[];
    enumHits: Array<{ value: string; sample: string }>;
    smallTargets: Array<{ tag: string; name: string; w: number; h: number }>;
    smallTexts: Array<{ size: number; sample: string }>;
}

/** Exécuté dans la page : aucune référence extérieure, tout passe par l'argument. */
function inspectDom(arg: { enums: string[] }): DomReport {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const enumRe = new RegExp(`(?<![\\p{L}\\p{N}_])(${arg.enums.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
    // Constructeur plutôt que littéral : le tsconfig du projet ne cible pas ES6 (drapeau « u »)
    const codeRe = new RegExp('(?<![\\p{L}\\p{N}_])[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+(?![\\p{L}\\p{N}_])', 'gu');
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
    const isVisible = (el: Element): boolean => {
        const withApi = el as Element & { checkVisibility?: (o?: Record<string, boolean>) => boolean };
        if (typeof withApi.checkVisibility === 'function') return withApi.checkVisibility({ visibilityProperty: true });
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    const sectionSigns: string[] = [];
    const enumHits: Array<{ value: string; sample: string }> = [];
    const smallTexts: Array<{ size: number; sample: string }> = [];
    const seenCodes = new Set<string>();
    const scan = (text: string, where: string) => {
        if (text.includes('§')) sectionSigns.push(`${where} : « ${text.trim().slice(0, 80)} »`);
        for (const re of [enumRe, codeRe]) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null = re.exec(text);
            while (m !== null) {
                const key = `${m.index}:${m[0]}:${text}`;
                if (!seenCodes.has(key)) {
                    seenCodes.add(key);
                    enumHits.push({ value: m[0], sample: `${where} : « ${text.trim().slice(0, 80)} »` });
                }
                m = re.exec(text);
            }
        }
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        const text = node.nodeValue ?? '';
        if (!parent || !text.trim() || skipTags.has(parent.tagName) || !isVisible(parent)) continue;
        scan(text, 'texte');
        const size = parseFloat(getComputedStyle(parent).fontSize);
        if (size < 14) smallTexts.push({ size, sample: text.trim().slice(0, 50) });
    }
    for (const el of Array.from(document.querySelectorAll('[aria-label], [title], [placeholder], img[alt]'))) {
        if (!isVisible(el)) continue;
        for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
            const v = el.getAttribute(attr);
            if (v) scan(v, `attribut ${attr}`);
        }
    }
    const smallTargets: Array<{ tag: string; name: string; w: number; h: number }> = [];
    const interactive = [
        'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary', '[role="button"]', '[role="link"]',
        '[role="tab"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="menuitem"]', '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    for (const el of Array.from(document.querySelectorAll(interactive))) {
        if (!isVisible(el)) continue;
        const style = getComputedStyle(el);
        // Lien dans une phrase : exception admise par WCAG 2.5.8
        const parentText = (el.parentElement?.textContent ?? '').trim().length;
        if (el.tagName === 'A' && style.display === 'inline' && parentText > (el.textContent ?? '').trim().length + 20) continue;
        // Zone réellement cliquable : un lien étiré (::after en position absolue) couvre son premier ancêtre
        // positionné ; un champ enveloppé par son <label> se clique sur tout le label (lot 5, run 52).
        let hit: Element = el;
        if (el.tagName === 'A' && getComputedStyle(el, '::after').position === 'absolute') {
            let p = el.parentElement;
            while (p && getComputedStyle(p).position === 'static') p = p.parentElement;
            if (p) hit = p;
        } else if ('labels' in el) {
            const wrapping = Array.from((el as HTMLInputElement).labels ?? []).find((l) => l.contains(el));
            const target = wrapping ?? Array.from((el as HTMLInputElement).labels ?? []).find((l) => isVisible(l));
            if (target && (wrapping || el.getBoundingClientRect().width <= 1)) hit = target;
        }
        const r = hit.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) {
            // Nom accessible approché : aria-label, aria-labelledby, <label> lié (champs), alt, texte, title, name
            const labelledBy = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
                .map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
            const fieldLabels = 'labels' in el ? Array.from((el as HTMLInputElement).labels ?? []).map((l) => l.textContent ?? '').join(' ') : '';
            const label = el.getAttribute('aria-label') || labelledBy || fieldLabels || el.getAttribute('alt') || (el as HTMLElement).innerText
                || el.getAttribute('title') || el.getAttribute('name') || '';
            smallTargets.push({ tag: el.tagName.toLowerCase(), name: label.trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
        }
    }
    return {
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0),
        viewportWidth: window.innerWidth,
        sectionSigns,
        enumHits,
        smallTargets,
        smallTexts,
    };
}

/** Extrait sur une ligne, tronqué à `max` caractères. */
function oneLine(text: string, max: number): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function summarize<T>(items: T[], key: (t: T) => string, max = 6): string {
    const counts = new Map<string, number>();
    for (const it of items) counts.set(key(it), (counts.get(key(it)) ?? 0) + 1);
    return Array.from(counts.entries()).slice(0, max).map(([k, n]) => (n > 1 ? `${k} (×${n})` : k)).join(' ; ');
}

export async function runPageChecks(page: Page, opts: { mobile: boolean; axe: boolean }): Promise<PageCheckResult> {
    // Les transpileurs qui conservent les noms de fonctions (esbuild/tsx) insèrent un appel à
    // __name dans le code sérialisé : l'aide est définie dans la page avant l'évaluation.
    await page.evaluate('window.__name = window.__name || function (f) { return f; };');
    const dom = await page.evaluate(inspectDom, { enums: [...RAW_ENUM_VALUES] });
    const blocking: string[] = [];
    const warnings: string[] = [];
    if (opts.mobile && dom.scrollWidth > 391) {
        blocking.push(`défilement horizontal à 390 px : largeur du document ${dom.scrollWidth} px (fenêtre ${dom.viewportWidth} px)`);
    }
    if (dom.sectionSigns.length > 0) {
        blocking.push(`« § » affiché ${dom.sectionSigns.length} fois : ${dom.sectionSigns.slice(0, 4).join(' ; ')}`);
    }
    if (dom.enumHits.length > 0) {
        blocking.push(`valeur technique affichée : ${summarize(dom.enumHits, (h) => h.value, 10)} — ex. ${dom.enumHits.slice(0, 3).map((h) => h.sample).join(' ; ')}`);
    }
    if (dom.smallTargets.length > 0) {
        warnings.push(`${dom.smallTargets.length} cible(s) < 44 px : ${summarize(dom.smallTargets, (t) => `${t.tag} « ${t.name || 'sans nom'} » ${t.w}×${t.h}`, 8)}`);
    }
    if (dom.smallTexts.length > 0) {
        const bySize = summarize(dom.smallTexts, (t) => `${t.size} px`, 6);
        warnings.push(`${dom.smallTexts.length} texte(s) < 14 px [${bySize}] : ${dom.smallTexts.slice(0, 5).map((t) => `« ${t.sample} »`).join(', ')}`);
    }
    let axeViolations = 0;
    const axeDetails: string[] = [];
    if (opts.axe) {
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        axeViolations = results.violations.length;
        for (const v of results.violations) {
            warnings.push(`axe-core ${v.id} (${v.impact ?? 'impact inconnu'}, ${v.nodes.length} nœud(s)) : ${v.help}`);
            v.nodes.slice(0, AXE_NODES_PER_RULE).forEach((node, i) => {
                const target = node.target.map((t) => (Array.isArray(t) ? t.join(' >>> ') : String(t))).join(' ; ');
                const summary = node.failureSummary ? oneLine(node.failureSummary, AXE_SUMMARY_MAX) : '(sans résumé)';
                axeDetails.push(`${v.id} [${i + 1}/${v.nodes.length}] ${target} | ${oneLine(node.html, AXE_HTML_MAX)} | ${summary}`);
            });
        }
    }
    return {
        blocking,
        warnings,
        axeDetails,
        metrics: { scrollWidth: dom.scrollWidth, viewportWidth: dom.viewportWidth, smallTargets: dom.smallTargets.length, smallTexts: dom.smallTexts.length, axeViolations },
    };
}
