/**
 * Lot 7 (tâche 7.9, contrat 19.9, décision D98 ; commit fix(7.7)) — projet Playwright « emails » : captures des
 * emails de confirmation rendus par le catalogue réel, en clair et en sombre, à 390 et 600 px de large.
 *
 * Aucun serveur d'application ni session : scripts/e2e/render-emails.ts (node --import tsx, données d'exemple fixes
 * et fictives, lien http://localhost:3000) écrit .e2e-captures/emails/<id>.html et <id>.txt ; chaque HTML est affiché
 * par page.setContent dans un contexte où TOUTE requête réseau est refusée (un email n'a besoin d'aucune ressource
 * externe : la moindre requête fait échouer le test). Thème : page.emulateMedia({ colorScheme }) ; le thème sombre
 * dépend du client de messagerie (bloc @media (prefers-color-scheme: dark) du gabarit : Apple Mail et iOS
 * l'appliquent, Gmail web l'ignore, SUPPOSÉ ; à dire au rapport).
 *
 * Captures : .e2e-captures/captures/email-<id>__<390|600>__<clair|sombre>.png (7 emails × 2 largeurs × 2 thèmes = 28),
 * pleine page. Résumé : .e2e-captures/captures/emails.txt.
 * Contrôles bloquants : aucun défilement horizontal ; textes ≥ 14 px ; contraste du texte sur son fond ≥ 4,5:1
 * (calcul WCAG, fond effectif lu sur les ancêtres) ; phrases P1 et P2 présentes (mot pour mot, contrat 19.4) dans les
 * emails de billets ; aucun <img> ; aucune requête réseau.
 *
 * Lot 9 bis (G.51, contrat 7.2, T11) : deux emails de plus, mêmes contrôles de rendu (largeur, taille, contraste,
 * images, réseau) : EMAIL_VERIFICATION (« verification-email » : bouton « Vérifier mon adresse » vers
 * http://localhost:3000/verify-email?t=…, validité de 24 heures dite) et EVENT_CHANGED (« changement-date » : titre de
 * l'événement et nouvelle date). Ce ne sont pas des emails de billets : P1 et P2 n'y sont pas exigées, leur contenu
 * propre l'est à la place.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { contrastRatio, parseRgb } from './support/checks';
import { CAPTURES_DIR, E2E_OUTPUT_DIR } from './support/demo-ids';

const RENDER_SCRIPT = path.join('scripts', 'e2e', 'render-emails.ts');
const EMAILS_DIR = path.join(E2E_OUTPUT_DIR, 'emails');
const WIDTHS = [390, 600] as const;
const THEMES = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }] as const;
const MIN_FONT_PX = 14;
const MIN_CONTRAST = 4.5;

/** Phrases obligatoires (consigne 7.9, contrat 19.4, mot pour mot, apostrophe droite D99). */
const P1 = 'Votre billet s\'affiche dans l\'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d\'écran ne sera pas acceptée à l\'entrée.';
const P2 = 'Ouvrez votre billet avec du réseau avant d\'arriver : il restera disponible même sans connexion.';

interface RenderedEmail { id: string; type: string; subject: string; html: string; text: string }

/** Emails de billets : phrases P1 et P2 exigées (contrat 19.4). */
const TICKET_EMAIL_IDS: readonly string[] = ['achat-1-billet', 'achat-4-billets', 'achat-12-billets', 'gratuits-2-billets', 'transfert-recu'];
/**
 * Lot 9 bis (G.51) : contenu propre exigé à la place de P1 et P2 (textes de lib/notifications/catalog.ts, données de
 * scripts/e2e/render-emails.ts, apostrophes ramenées à l'apostrophe droite comme le texte lu) : titre, bouton et
 * validité du lien ; titre de l'événement et objet du changement.
 */
const OTHER_EMAIL_PHRASES: Readonly<Record<string, readonly string[]>> = {
    'verification-email': ['Vérifiez votre adresse email', 'Vérifier mon adresse', 'Ce lien est valable 24 heures et ne sert qu\'une fois.'],
    'changement-date': ['Nuit du Sabar — édition d\'automne', 'nouvelle date'],
};
const EMAIL_IDS: readonly string[] = [...TICKET_EMAIL_IDS, ...Object.keys(OTHER_EMAIL_PHRASES)];
/** Lien du bouton de l'email de vérification : page publique /verify-email, jeton en paramètre (contrat 4.6). */
const VERIFY_LINK = /^http:\/\/localhost:3000\/verify-email\?t=[A-Za-z0-9_-]{32,256}$/;

/** Rendu par le script (processus séparé : jamais d'import du dépôt dans Playwright, alias @/ en CI). */
function renderEmails(): RenderedEmail[] {
    const r = spawnSync(process.execPath, ['--import', 'tsx', RENDER_SCRIPT, '--out', EMAILS_DIR], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120_000 });
    if (r.error) throw new Error(`[e2e][emails] ${RENDER_SCRIPT} : ${r.error.message}`);
    if (r.status !== 0) throw new Error(`[e2e][emails] ${RENDER_SCRIPT} : code ${r.status}\n${(r.stderr ?? '').slice(-2000)}`);
    const out = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
    const last = out[out.length - 1] ?? '';
    let parsed: { emails?: RenderedEmail[] };
    try {
        parsed = JSON.parse(last) as { emails?: RenderedEmail[] };
    } catch (err) {
        throw new Error(`[e2e][emails] manifeste illisible (${err instanceof Error ? err.message : String(err)}) : ${last.slice(0, 300)}`);
    }
    if (!Array.isArray(parsed.emails) || parsed.emails.length !== EMAIL_IDS.length) {
        throw new Error(`[e2e][emails] ${EMAIL_IDS.length} emails attendus, manifeste : ${last.slice(0, 300)}`);
    }
    return parsed.emails;
}

interface EmailDom {
    scrollWidth: number;
    viewportWidth: number;
    images: number;
    text: string;
    small: Array<{ size: number; sample: string }>;
    lowContrast: Array<{ sample: string; fg: string; bg: string }>;
}

/** Exécuté dans la page (sérialisé, aucune référence extérieure) : textes, tailles et couleurs calculées. */
function inspectEmail(arg: { minFont: number }): EmailDom & { pairs: Array<{ sample: string; fg: string; bg: string }> } {
    const small: Array<{ size: number; sample: string }> = [];
    const pairs: Array<{ sample: string; fg: string; bg: string }> = [];
    const background = (el: Element | null): string => {
        for (let cur = el; cur; cur = cur.parentElement) {
            const bg = getComputedStyle(cur).backgroundColor;
            if (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) return bg;
        }
        return 'rgb(255, 255, 255)';
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        const t = (node.nodeValue ?? '').trim();
        if (!parent || !t || ['STYLE', 'SCRIPT', 'TITLE'].includes(parent.tagName)) continue;
        const r = parent.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const style = getComputedStyle(parent);
        const size = parseFloat(style.fontSize);
        if (size < arg.minFont) small.push({ size, sample: t.slice(0, 60) });
        if (!seen.has(parent)) {
            seen.add(parent);
            pairs.push({ sample: t.slice(0, 60), fg: style.color, bg: background(parent) });
        }
    }
    return {
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        viewportWidth: window.innerWidth,
        images: document.querySelectorAll('img').length,
        text: (document.body.innerText ?? '').replace(/[’]/g, '\''),
        small,
        lowContrast: [],
        pairs,
    };
}

async function checkEmail(page: Page, id: string): Promise<{ blocking: string[]; dom: EmailDom }> {
    await page.evaluate('window.__name = window.__name || function (f) { return f; };');
    const raw = await page.evaluate(inspectEmail, { minFont: MIN_FONT_PX });
    const lowContrast: EmailDom['lowContrast'] = [];
    for (const p of raw.pairs) {
        const fg = parseRgb(p.fg);
        const bg = parseRgb(p.bg);
        if (!fg || !bg) {
            lowContrast.push(p);
            continue;
        }
        if (contrastRatio(fg, bg) < MIN_CONTRAST) lowContrast.push({ ...p, fg: `${p.fg} (${contrastRatio(fg, bg).toFixed(2)}:1)` });
    }
    const dom: EmailDom = { ...raw, lowContrast };
    const text = dom.text.replace(/\s+/g, ' ');
    const blocking: string[] = [];
    if (dom.scrollWidth > dom.viewportWidth + 1) blocking.push(`défilement horizontal : largeur du document ${dom.scrollWidth} px pour ${dom.viewportWidth} px`);
    if (dom.small.length > 0) blocking.push(`${dom.small.length} texte(s) < ${MIN_FONT_PX} px : ${dom.small.slice(0, 5).map((s) => `${s.size} px « ${s.sample} »`).join(' ; ')}`);
    if (dom.lowContrast.length > 0) blocking.push(`${dom.lowContrast.length} texte(s) sous ${MIN_CONTRAST}:1 : ${dom.lowContrast.slice(0, 5).map((c) => `« ${c.sample} » ${c.fg} sur ${c.bg}`).join(' ; ')}`);
    if (TICKET_EMAIL_IDS.includes(id)) {
        if (!text.includes(P1)) blocking.push('phrase obligatoire P1 absente (« Votre billet s\'affiche dans l\'application… »)');
        if (!text.includes(P2)) blocking.push('phrase obligatoire P2 absente (« Ouvrez votre billet avec du réseau avant d\'arriver… »)');
    }
    for (const phrase of OTHER_EMAIL_PHRASES[id] ?? []) if (!text.includes(phrase)) blocking.push(`phrase attendue absente : « ${phrase} »`);
    if (id === 'verification-email') {
        const links = await page.getByRole('link', { name: /^vérifier mon adresse$/i }).evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
        if (links.length !== 1 || !VERIFY_LINK.test(links[0])) blocking.push(`bouton « Vérifier mon adresse » vers /verify-email?t=… attendu une fois, liens lus : ${JSON.stringify(links)}`);
    }
    if (dom.images > 0) blocking.push(`${dom.images} élément(s) <img> (aucune image attendue : contrat 19.5)`);
    return { blocking, dom };
}

const SUMMARY = path.join(CAPTURES_DIR, 'emails.txt');
let emails: RenderedEmail[] = [];

// Pas de mode « serial » : un email en échec n'empêche pas la capture des suivants. Le rendu est refait si le worker
// redémarre après un échec (même résultat : données fixes) ; l'en-tête du résumé n'est écrit qu'une fois par exécution
// (le dossier des captures est vidé au début de `npm run e2e`).
test.beforeAll(() => {
    emails = renderEmails();
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
    if (!fs.existsSync(SUMMARY)) fs.writeFileSync(SUMMARY, `EVENT VILLAGE — EMAILS DE CONFIRMATION (lot 7, tâche 7.9, contrat 19.9)\ngénéré le : ${new Date().toISOString()}\n`
        + 'rendu : scripts/e2e/render-emails.ts (catalogue réel, données d’exemple fictives) ; affichage : page.setContent, réseau refusé\n'
        + 'thème sombre : appliqué par les clients qui lisent @media (prefers-color-scheme: dark) (Apple Mail, iOS) ; Gmail web l’ignore (SUPPOSÉ)\n\n', 'utf8');
});

for (const id of EMAIL_IDS) {
    test(`email ${id} : 390 et 600 px, clair et sombre, sans ressource externe`, async ({ browser }, testInfo) => {
        const email = emails.find((e) => e.id === id);
        expect(email, `email ${id} rendu par ${RENDER_SCRIPT}`).toBeTruthy();
        const html = fs.readFileSync((email as RenderedEmail).html, 'utf8');
        const failures: string[] = [];
        const lines: string[] = [`${id} (${(email as RenderedEmail).type}) — objet « ${(email as RenderedEmail).subject} »`];
        for (const width of WIDTHS) {
            for (const theme of THEMES) {
                const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, locale: 'fr-FR', colorScheme: theme.scheme });
                const requests: string[] = [];
                try {
                    await context.route('**/*', async (route) => {
                        requests.push(`${route.request().resourceType()} ${route.request().url().slice(0, 120)}`);
                        await route.abort('blockedbyclient');
                    });
                    const page = await context.newPage();
                    await page.emulateMedia({ colorScheme: theme.scheme });
                    await page.setContent(html, { waitUntil: 'load' });
                    const { blocking } = await checkEmail(page, id);
                    if (requests.length > 0) blocking.push(`requête(s) réseau émise(s) par l’email : ${requests.slice(0, 5).join(' ; ')}`);
                    const file = `email-${id}__${width}__${theme.key}.png`;
                    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
                    const target = path.join(CAPTURES_DIR, file);
                    await page.screenshot({ path: target, fullPage: true, animations: 'disabled', caret: 'hide' });
                    await testInfo.attach(file, { path: target, contentType: 'image/png' });
                    lines.push(`  ${file} : ${blocking.length === 0 ? 'OK' : `ÉCHEC — ${blocking.join(' | ')}`}`);
                    failures.push(...blocking.map((b) => `${width} px ${theme.key} : ${b}`));
                } finally {
                    await context.close();
                }
            }
        }
        fs.appendFileSync(SUMMARY, `${lines.join('\n')}\n`, 'utf8');
        console.log(lines.map((l) => `[EMAILS] ${l}`).join('\n'));
        expect(failures, `contrôles bloquants de l’email ${id}`).toEqual([]);
    });
}
