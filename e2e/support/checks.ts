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
 *
 * Lot 6 (contrat A6, modification signalée, aucun avertissement brut retiré) :
 *  - chaque texte < 14 px est classé « admis » (ancêtre small, time, figcaption, caption, legend, texte
 *    SVG, ou attribut data-ev-caption : mentions et légendes) ou « hors exemption » ; l'avertissement brut
 *    reste tel quel, une ligne donne les nombres brut / admis / hors exemption, et TOUS les textes hors
 *    exemption sont listés (sélecteur court, taille, texte) dans smallTextDetails (index.txt) ;
 *  - la zone cliquable d'un champ masqué (sr-only) est celle de son libellé visible de plus grande surface
 *    (au lieu du premier libellé visible) ;
 *  - RAW_ENUM_VALUES reçoit les codes du lot 6 (statuts et canaux de la boîte d'envoi, politiques SMS,
 *    motif QUIET_HOURS, sujets des préférences), pas « SMS » ni « EMAIL », mots légitimes ;
 *  - metrics donne, par capture, les nombres de chaque règle (tableau « écran × règle » du rapport).
 *
 * Lot 7 (contrat 11.2, D73, T23 ; tâche 7.5 « aucune règle axe en échec ; cibles de 44 px ; textes de contenu
 * ≥ 14 px » ; modification signalée, plus stricte) :
 *  - deviennent BLOQUANTS : toute règle axe en échec (étiquettes inchangées wcag2a/aa/21a/21aa/22aa), toute cible
 *    interactive < 44 px (mêmes exceptions qu'avant : lien dans une phrase, zone d'un libellé), tout texte < 14 px
 *    HORS exemption (CAPTION_SELECTOR) ; les textes < 14 px admis restent un avertissement ;
 *  - écrans du scanner (plein écran [data-scan-state="result"]) : contraste du titre du résultat sur son fond
 *    calculé par getComputedStyle, ≥ 7:1, bloquant (axe color-contrast-enhanced n'exige que 4,5:1 pour un grand
 *    texte : discovery-7-tests.md §3.5) ;
 *  - RAW_ENUM_VALUES reçoit les codes du lot 7 (PAYMENT_PENDING, OFFLINE_WINDOW_CLOSED, TRANSFER_PENDING,
 *    SMS_OPTIONAL_CAP, FREE_TICKETS_ONLY, MONTHLY, DRAFT ; REJETE y était déjà).
 * Les avertissements bruts (nombres, détail axe, textes hors exemption) restent écrits dans index.txt.
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
    // boîte d'envoi (lot 6, C2 et C4), canaux, politiques SMS des rappels (I1), sujets des préférences (C5)
    'SENDING', 'SENT', 'SKIPPED', 'UNCERTAIN', 'IN_APP', 'PUSH', 'ALWAYS', 'IF_NO_PUSH', 'NEVER', 'QUIET_HOURS',
    'REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY',
    // lot 7 (contrat 11.2) : paiement en attente, billet hors ligne, plafond SMS, gratuits, offres partenaire
    'PAYMENT_PENDING', 'OFFLINE_WINDOW_CLOSED', 'TRANSFER_PENDING', 'SMS_OPTIONAL_CAP', 'FREE_TICKETS_ONLY', 'MONTHLY', 'DRAFT',
];

/** Lot 7 (D73) : contraste minimal du titre du résultat plein écran du scanner sur son fond. */
export const SCAN_RESULT_MIN_CONTRAST = 7;

/** Ancêtres qui font d'un texte < 14 px une mention ou une légende admise (contrat A6). */
export const CAPTION_SELECTOR = 'small, time, figcaption, caption, legend, svg text, [data-ev-caption]';

/** Nœuds détaillés par règle axe dans index.txt, et longueurs maximales des extraits. */
export const AXE_NODES_PER_RULE = 5;
const AXE_HTML_MAX = 160;
const AXE_SUMMARY_MAX = 300;

/** Nombres par règle d'une capture (lot 6, tableau « écran × règle » du rapport, contrat A6). */
export interface PageCheckMetrics {
    scrollWidth: number;
    viewportWidth: number;
    smallTargets: number;
    /** Textes < 14 px, nombre brut (inchangé depuis le lot 5). */
    smallTexts: number;
    /** Dont admis (mention ou légende, CAPTION_SELECTOR). */
    smallTextsAdmitted: number;
    /** Dont hors exemption. */
    smallTextsOutside: number;
    axeViolations: number;
    /** Règles axe en échec et nombre de nœuds de chacune. */
    axeRules: Array<{ id: string; impact: string; nodes: number }>;
    /** Lot 7 : contraste du titre du plein écran du scanner (null : aucun plein écran affiché). */
    scanContrast?: number | null;
}

export interface PageCheckResult {
    blocking: string[];
    warnings: string[];
    /** Une ligne par nœud fautif : « <règle> [i/n] <cible> | <html> | <résumé> ». */
    axeDetails: string[];
    /** Lot 6 : une ligne par texte < 14 px hors exemption, TOUS listés : « <taille> px | <sélecteur> | « texte » ». */
    smallTextDetails: string[];
    metrics: PageCheckMetrics;
}

interface DomReport {
    /** Lot 7 : plein écran du scanner (titre, couleurs calculées), null s'il n'est pas affiché. */
    scanResult: { result: string; title: string; fg: string; bg: string } | null;
    scrollWidth: number;
    viewportWidth: number;
    sectionSigns: string[];
    enumHits: Array<{ value: string; sample: string }>;
    smallTargets: Array<{ tag: string; name: string; w: number; h: number }>;
    smallTexts: Array<{ size: number; sample: string; admittedBy: string | null; selector: string }>;
}

/** Exécuté dans la page : aucune référence extérieure, tout passe par l'argument. */
function inspectDom(arg: { enums: string[]; captionSelector: string }): DomReport {
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
    // Sélecteur court d'un élément (3 niveaux au plus, arrêt sur un id) : repère lisible dans index.txt.
    const shortSelector = (el: Element): string => {
        const parts: string[] = [];
        let cur: Element | null = el;
        for (let depth = 0; cur && depth < 3; depth++) {
            let s = cur.tagName.toLowerCase();
            if (cur.id) {
                parts.unshift(`${s}#${cur.id}`);
                break;
            }
            const classes = Array.from(cur.classList).filter((c) => !c.includes(':')).slice(0, 2);
            if (classes.length > 0) s += `.${classes.join('.')}`;
            parts.unshift(s);
            cur = cur.parentElement;
        }
        const out = parts.join(' > ');
        return out.length > 140 ? `${out.slice(0, 139)}…` : out;
    };
    // Mention ou légende admise (contrat A6) : ancêtre small, time, figcaption, caption, legend, texte SVG ou data-ev-caption.
    const admittedBy = (el: Element): string | null => {
        const hit = el.closest(arg.captionSelector);
        if (!hit) return null;
        if (hit.hasAttribute('data-ev-caption')) return 'data-ev-caption';
        return hit.namespaceURI === 'http://www.w3.org/2000/svg' ? 'svg text' : hit.tagName.toLowerCase();
    };
    const sectionSigns: string[] = [];
    const enumHits: Array<{ value: string; sample: string }> = [];
    const smallTexts: Array<{ size: number; sample: string; admittedBy: string | null; selector: string }> = [];
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
        if (size < 14) smallTexts.push({ size, sample: text.trim().slice(0, 50), admittedBy: admittedBy(parent), selector: shortSelector(parent) });
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
            const labels = Array.from((el as HTMLInputElement).labels ?? []);
            const wrapping = labels.find((l) => l.contains(el));
            // Lot 6 (A6) : champ masqué (sr-only) → libellé visible de plus grande surface (au lieu du premier).
            const area = (l: Element) => {
                const b = l.getBoundingClientRect();
                return b.width * b.height;
            };
            const largest = labels.filter((l) => isVisible(l)).sort((a, b) => area(b) - area(a))[0];
            const target = wrapping ?? largest;
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
    // Lot 7 (D73) : plein écran du scanner — titre (premier paragraphe) et fond calculés du conteneur
    let scanResult: DomReport['scanResult'] = null;
    const overlay = document.querySelector('[data-scan-state="result"]');
    if (overlay && isVisible(overlay)) {
        const heading = overlay.querySelector('p');
        scanResult = {
            result: overlay.getAttribute('data-scan-result') ?? '',
            title: (heading?.textContent ?? '').trim().slice(0, 80),
            fg: getComputedStyle(heading ?? overlay).color,
            bg: getComputedStyle(overlay).backgroundColor,
        };
    }
    return {
        scanResult,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0),
        viewportWidth: window.innerWidth,
        sectionSigns,
        enumHits,
        smallTargets,
        smallTexts,
    };
}

/** Couleur CSS calculée « rgb(r, g, b) » ou « rgba(r, g, b, a) » ; null si illisible ou transparente. */
export function parseRgb(css: string): { r: number; g: number; b: number } | null {
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(css.trim());
    if (!m) return null;
    if (m[4] !== undefined) {
        const alpha = m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
        if (!(alpha >= 0.999)) return null;
    }
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

/** Rapport de contraste WCAG 2.x de deux couleurs opaques. */
export function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
    const lum = (c: { r: number; g: number; b: number }) => {
        const ch = [c.r, c.g, c.b].map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
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
    const dom = await page.evaluate(inspectDom, { enums: [...RAW_ENUM_VALUES], captionSelector: CAPTION_SELECTOR });
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
        // Lot 7 (D73) : bloquant (7.5 « cibles de 44 px »)
        blocking.push(`${dom.smallTargets.length} cible(s) < 44 px : ${summarize(dom.smallTargets, (t) => `${t.tag} « ${t.name || 'sans nom'} » ${t.w}×${t.h}`, 8)}`);
    }
    let scanContrast: number | null = null;
    if (dom.scanResult) {
        const fg = parseRgb(dom.scanResult.fg);
        const bg = parseRgb(dom.scanResult.bg);
        if (!fg || !bg) {
            blocking.push(`plein écran du scanner (${dom.scanResult.result}) : couleurs illisibles ou transparentes (texte ${dom.scanResult.fg}, fond ${dom.scanResult.bg}), contraste ≥ ${SCAN_RESULT_MIN_CONTRAST}:1 invérifiable`);
        } else {
            scanContrast = Math.round(contrastRatio(fg, bg) * 100) / 100;
            const line = `plein écran du scanner (${dom.scanResult.result}, « ${dom.scanResult.title} ») : contraste ${scanContrast}:1 (texte ${dom.scanResult.fg}, fond ${dom.scanResult.bg})`;
            if (scanContrast < SCAN_RESULT_MIN_CONTRAST) blocking.push(`${line} < ${SCAN_RESULT_MIN_CONTRAST}:1`);
            else warnings.push(`${line} ≥ ${SCAN_RESULT_MIN_CONTRAST}:1 (contrôle bloquant satisfait)`);
        }
    }
    if (dom.smallTexts.length > 0) {
        const bySize = summarize(dom.smallTexts, (t) => `${t.size} px`, 6);
        warnings.push(`${dom.smallTexts.length} texte(s) < 14 px [${bySize}] : ${dom.smallTexts.slice(0, 5).map((t) => `« ${t.sample} »`).join(', ')}`);
    }
    // Lot 6 (A6) : classement des textes < 14 px, en plus de l'avertissement brut ci-dessus (inchangé).
    const admitted = dom.smallTexts.filter((t) => t.admittedBy !== null);
    const outside = dom.smallTexts.filter((t) => t.admittedBy === null);
    if (dom.smallTexts.length > 0) {
        const admittedWhy = summarize(admitted, (t) => String(t.admittedBy), 7);
        warnings.push(`textes < 14 px classés : ${dom.smallTexts.length} brut(s), ${admitted.length} admis${admitted.length > 0 ? ` [${admittedWhy}]` : ''}, ${outside.length} hors exemption`);
    }
    const smallTextDetails = outside.map((t) => `${t.size} px | ${t.selector} | « ${oneLine(t.sample, 60)} »`);
    if (outside.length > 0) {
        // Lot 7 (D73) : bloquant (7.5 « textes de contenu ≥ 14 px ») ; les mentions et légendes admises restent tolérées
        blocking.push(`${outside.length} texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : ${outside.slice(0, 5).map((t) => `${t.size} px « ${oneLine(t.sample, 40)} » (${t.selector})`).join(' ; ')}`);
    }
    let axeViolations = 0;
    const axeDetails: string[] = [];
    const axeRules: PageCheckMetrics['axeRules'] = [];
    if (opts.axe) {
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        axeViolations = results.violations.length;
        for (const v of results.violations) {
            axeRules.push({ id: v.id, impact: v.impact ?? 'inconnu', nodes: v.nodes.length });
            // Lot 7 (D73) : bloquant (7.5 « aucune règle axe en échec ») ; le détail des nœuds reste dans index.txt
            blocking.push(`axe-core ${v.id} (${v.impact ?? 'impact inconnu'}, ${v.nodes.length} nœud(s)) : ${v.help}`);
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
        smallTextDetails,
        metrics: {
            scrollWidth: dom.scrollWidth,
            viewportWidth: dom.viewportWidth,
            smallTargets: dom.smallTargets.length,
            smallTexts: dom.smallTexts.length,
            smallTextsAdmitted: admitted.length,
            smallTextsOutside: outside.length,
            axeViolations,
            axeRules,
            scanContrast,
        },
    };
}
