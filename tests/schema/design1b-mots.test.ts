/**
 * Design 1b (point 2) — GARDE-FOU DES MOTS : aucun mot technique à l'écran ni dans un message.
 * Échoue sur un mot technique (RPC, token, API, null, undefined, NaN, UUID ou identifiant brut, « erreur 500 »,
 * « HTTP 500 », « Failed to fetch »…), un statut en capitales avec tirets bas (EN_ATTENTE…) ou un code d'erreur brut affiché.
 *
 *  a. Modèles de messages : chaque type du catalogue (lib/notifications/catalog.ts, source unique des textes in-app, push,
 *     SMS et email), rendu pour chaque canal qu'il déclare avec son `sample` ; SMS synchrones (renderSyncSms) ; emails de
 *     compte (vérification, mot de passe oublié, changement d'adresse).
 *  b. Écrans (lecture du code, app/ et components/, hors routes d'API et pages de développement) : texte JSX, attributs
 *     lus ou affichés (aria-label, title, placeholder, alt, label, description, message…), littéraux rendus entre
 *     accolades, premier argument des toasts.
 *  c. Écrans : jamais un message ou un code d'erreur brut rendu (`{err.message}`, `{error.code}`…) dans du JSX.
 *  d. Parcours réel de TOUS les écrans capturés par l'e2e (390 et 1 440 px, clair et sombre) : e2e/support/checks.ts
 *     applique le même motif aux textes visibles et aux attributs aria-label, title, placeholder, alt (bloquant).
 * Exceptions : aucune, sauf mention justifiée dans EXCEPTIONS (fichier et texte exact).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();

/** Même motif que e2e/support/checks.ts (techRe) : mots techniques et codes bruts. */
export const TECH_RE = /(?<![\p{L}\p{N}_])(?:RPC|API|[Tt]oken|null|undefined|NaN|UUID|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[Ee]rreur \d{3}|HTTP \d{3}|Failed to fetch|NetworkError|Load failed|Internal Server Error|TypeError|SyntaxError)(?![\p{L}\p{N}_])/u;
/** Statut ou code en capitales avec tirets bas (même règle que codeRe de e2e/support/checks.ts). */
export const CODE_RE = /(?<![\p{L}\p{N}_])[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+(?![\p{L}\p{N}_])/u;

/** Exceptions justifiées : `fichier|texte exact` → raison. */
const EXCEPTIONS = new Map<string, string>([
]);

/** Champs d'un message rendu que la personne lit (lib/notifications/catalog.ts, RenderedNotification et emails). */
const SHOWN_FIELDS = new Set(['title', 'content', 'body', 'text', 'subject', 'html']);

function faultsOf(text: string): string[] {
    const out: string[] = [];
    const t = TECH_RE.exec(text);
    if (t) out.push(`mot technique « ${t[0]} »`);
    const c = CODE_RE.exec(text);
    if (c) out.push(`code brut « ${c[0]} »`);
    return out;
}

// ── a. Modèles de messages ───────────────────────────────────────────────────────────────────────────────────────────

describe('a. modèles de messages : aucun mot technique', () => {
    test('chaque type × chaque canal déclaré, rendu avec son exemple ; SMS synchrones ; emails de compte', async () => {
        const catalog = await import('../../lib/notifications/catalog');
        const ctx = { appUrl: 'https://app.eventvillage.sn' };
        const faults: string[] = [];
        const visit = (where: string, value: unknown): void => {
            if (typeof value === 'string') {
                // L'HTML des emails : on lit le texte, pas les balises ni les attributs techniques (href, style)
                const text = /<[a-z!][\s\S]*>/i.test(value) ? value.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ') : value;
                // Les liens (chemins internes, URL de l'application) ne sont pas du texte lu
                const readable = text.replace(/https?:\/\/\S+/g, ' ').replace(/(?:^|\s)\/[\w\-/?=&.%]+/g, ' ');
                for (const f of faultsOf(readable)) faults.push(`${where} : ${f} — « ${readable.trim().slice(0, 120)} »`);
            } else if (value && typeof value === 'object') {
                // Seuls les champs lus par la personne : titre, contenu, corps, texte, sujet, HTML (pas type, canal, mesure, en-têtes, liens)
                for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                    if (!SHOWN_FIELDS.has(k)) continue;
                    visit(`${where}.${k}`, v);
                }
            }
        };
        let rendered = 0;
        const syncTypes: string[] = [];
        for (const [type, template] of Object.entries(catalog.NOTIFICATION_CATALOG)) {
            const tpl = template as unknown as { channels: readonly string[]; sample: unknown; syncOnly?: boolean };
            // Types synchrones (code, invitation) : rendus par renderSyncSms ci-dessous, jamais par renderNotification
            if (tpl.syncOnly) { syncTypes.push(type); continue; }
            for (const channel of tpl.channels) {
                const out = catalog.renderNotification(type, channel as never, tpl.sample, ctx);
                rendered += 1;
                visit(`${type}/${channel}`, out);
            }
        }
        for (const sync of syncTypes) {
            const tpl = (catalog.NOTIFICATION_CATALOG as Record<string, { channels: readonly string[] }>)[sync];
            if (!tpl.channels.includes('SMS')) continue; // emails synchrones : rendus plus bas (vérification, mot de passe)
            // Lot 12a (modification signalée au rapport) : le code de remise d'une commande a 4 chiffres, un numéro de commande et une étape
            const syncData = sync === 'ORDER_HANDOVER_CODE' ? { code: '4821', orderNumber: 'CMD-261205-A1B2C3', step: 'LIVRAISON' }
                : { code: '123456', firstName: 'Awa', setupLink: 'https://app.eventvillage.sn/activation?t=Abcdefghijklmnop1234' };
            visit(`sms-synchrone/${sync}`, catalog.renderSyncSms(sync as never, syncData as never));
            rendered += 1;
        }
        visit('email/verification', catalog.renderEmailVerification('AbcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456', ctx));
        visit('email/mot-de-passe-oublie', catalog.renderPasswordResetEmail('AbcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456', ctx));
        visit('email/changement-adresse', catalog.renderEmailChangedOld(ctx));
        console.log(`[DESIGN1B-MOTS] a. ${rendered} rendus de modèles relus ; fautes : ${faults.length}`);
        assert.ok(rendered > 50, `catalogue lu (${rendered} rendus)`);
        assert.deepEqual(faults, []);
    });
});

// ── b et c. Écrans ───────────────────────────────────────────────────────────────────────────────────────────────────

function screenFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) {
                if (rel === 'app/api' || rel === 'app/dev' || e.name === 'node_modules') continue;
                walk(rel);
            } else if (/\.tsx$/.test(e.name)) out.push(rel);
        }
    };
    walk('app');
    walk('components');
    return out.sort();
}

const SHOWN_ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'description', 'message', 'hint', 'error', 'confirmLabel', 'cancelLabel', 'actionLabel', 'emptyLabel', 'subtitle', 'heading', 'ariaLabel']);
const TOAST_METHODS = new Set(['success', 'error', 'info', 'warning', 'undoable']);
const RAW_ERROR_RE = /\b(?:err|error|e|ex|exception|reason)\??\.(?:message|code|stack|name)\b|\berror\.details\b|\berror\.hint\b/;

describe('b-c. écrans : aucun mot technique, aucun message d’erreur brut', () => {
    test('texte JSX, attributs lus, littéraux rendus, toasts ; aucun `{err.message}` rendu', () => {
        const faults: string[] = [];
        let texts = 0;
        for (const rel of screenFiles()) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
            const report = (node: ts.Node, text: string): void => {
                texts += 1;
                const clean = text.replace(/\s+/g, ' ').trim();
                if (!clean) return;
                if (EXCEPTIONS.has(`${rel}|${clean}`)) return;
                for (const f of faultsOf(clean)) {
                    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                    faults.push(`${rel}:${line + 1} : ${f} — « ${clean.slice(0, 100)} »`);
                }
            };
            const visit = (node: ts.Node): void => {
                if (ts.isJsxText(node)) report(node, node.text);
                else if (ts.isJsxAttribute(node) && node.initializer) {
                    const name = node.name.getText(sf);
                    if (SHOWN_ATTRS.has(name)) {
                        const init = node.initializer;
                        if (ts.isStringLiteral(init)) report(init, init.text);
                        else if (ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) report(init.expression, init.expression.text);
                    }
                } else if (ts.isJsxExpression(node) && node.expression && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
                    const ex = node.expression;
                    if (ts.isStringLiteral(ex) || ts.isNoSubstitutionTemplateLiteral(ex)) report(ex, ex.text);
                    else if (ts.isTemplateExpression(ex)) report(ex, [ex.head.text, ...ex.templateSpans.map((s) => s.literal.text)].join(' '));
                    // c. message ou code d'erreur brut rendu entre accolades
                    const shown = ex.getText(sf);
                    if (RAW_ERROR_RE.test(shown) && !/\bhumanToastMessage\(|\bpublicMessage\(|\bmessageOf\(|\berrorMessage\(/.test(shown)) {
                        const { line } = sf.getLineAndCharacterOfPosition(ex.getStart(sf));
                        faults.push(`${rel}:${line + 1} : message d'erreur brut rendu — « {${shown.slice(0, 80)}} »`);
                    }
                } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
                    && TOAST_METHODS.has(node.expression.name.text) && /toast$/i.test(node.expression.expression.getText(sf))) {
                    const first = node.arguments[0];
                    if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) report(first, first.text);
                    else if (first && ts.isTemplateExpression(first)) report(first, [first.head.text, ...first.templateSpans.map((s) => s.literal.text)].join(' '));
                }
                ts.forEachChild(node, visit);
            };
            visit(sf);
        }
        console.log(`[DESIGN1B-MOTS] b-c. ${screenFiles().length} fichiers d'écran, ${texts} textes relus ; fautes : ${faults.length}`);
        assert.deepEqual(faults, []);
    });
});

// ── d. Parcours réel des écrans ──────────────────────────────────────────────────────────────────────────────────────

describe('d. parcours réel : le contrôle des captures applique le même motif', () => {
    test('e2e/support/checks.ts : motif techRe branché sur chaque texte visible et chaque attribut lu', () => {
        const src = fs.readFileSync(path.join(ROOT, 'e2e', 'support', 'checks.ts'), 'utf8');
        assert.match(src, /const techRe = new RegExp\(/, 'motif des mots techniques présent');
        assert.match(src, /for \(const re of \[enumRe, codeRe, techRe\]\)/, 'motif appliqué à chaque texte relu');
        for (const word of ['RPC', 'API', 'Tt]oken', 'null', 'undefined', 'UUID', 'Failed to fetch', 'HTTP ']) {
            assert.ok(src.includes(word), `mot « ${word} » dans le motif des captures`);
        }
    });
});
