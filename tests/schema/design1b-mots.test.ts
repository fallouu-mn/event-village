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
 *  e. Lot « Avis », phase 2 (2h, § 4.4 de docs/avis-inventaire.md ; extension signalée au rapport) : routes d'API, lib/ et
 *     hooks/ (propriétés error, message, details d'une réponse ou d'un refus, PublicError, messages zod) ; messages SQL de la
 *     DERNIÈRE définition de chaque fonction (« message » des réponses, RAISE … MESSAGE) ; exports (participants rendus,
 *     export comptable sans codes) ; erreurs affichées (jamais `set…(err.message)` sans humanToastMessage, errorMessage()
 *     passe une erreur hors API au garde-fou). Liste de mots élargie (EXTRA_RE : OTP, payload, JSON, webhook, timeout, ID,
 *     Supabase, MTarget, Resend, VAPID, service_role, mots anglais d'interface ; « push » hors administration ; identifiants en
 *     casse chameau). Exceptions : fichiers d'exploitation (OPERATOR_FILES), journaux (console.*), erreurs internes non
 *     renvoyées (throw new Error) ; prestataires (SamirPay, Wave, Orange Money) permis (décision D6).
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

// ── e. Lot « Avis », phase 2 (2h, § 4.4 de docs/avis-inventaire.md) : routes d'API, lib, hooks, messages SQL, exports, erreurs ──

/**
 * Mots de développeur en plus de TECH_RE et CODE_RE (§ 4.4, point 5). « push » n'est interdit qu'hors des pages et routes de
 * l'administration ; un identifiant en casse chameau dans une phrase (eventId, targetId) est un nom de variable.
 */
export const EXTRA_RE = /(?<![\p{L}\p{N}_])(?:OTP|[Pp]ayload|JSON|[Ww]ebhook|[Tt]imeout|ID|Supabase|MTarget|Resend|VAPID|service_role|Loading|Submit|Cancel|Save|Delete|Retry|Success|Failed|Pending|Unknown|Something went wrong|Not found|Invalid|Required)(?![\p{L}\p{N}_])/u;
const PUSH_RE = /(?<![\p{L}\p{N}_])[Pp]ush(?![\p{L}\p{N}_])/u;
const CAMEL_RE = /(?<![\p{L}\p{N}_./-])[a-z]+[A-Z][A-Za-z]*(?![\p{L}\p{N}_(])/u;

/**
 * Exceptions justifiées du bloc e (§ 4.4, point 6) : `fichier|texte exact` → raison. Les noms de prestataires (SamirPay, Wave,
 * Orange Money) ne sont pas dans la liste de mots : ils restent permis partout (décision D6 du 27/11 pour SamirPay).
 */
const EXCEPTIONS_E = new Map<string, string>([
    ['lib/email/email.service.ts|EMAIL_CHANNEL_DISABLED', 'code interne de l’adaptateur, lu par l’envoyeur (motif EMAIL_NOT_CONFIGURED), jamais affiché'],
    ['lib/email/resend-http.adapter.ts|RESEND_API_KEY_MISSING', 'code interne de l’adaptateur, lu par l’envoyeur, jamais affiché'],
    ['lib/sms/mtarget-http.adapter.ts|Configuration MTarget incomplète sur le serveur.', 'message d’exploitation (§ 4.3 de l’inventaire), jamais affiché'],
    ['20261121000001_cvf2b_jeton_session_revoquee.sql|{"code":"SESSION_FERMEE","message":"Votre session est fermée. Reconnectez-vous.","details":null,"hint":null}',
        'format d’erreur imposé par PostgREST (objet JSON) ; le texte lu est « Votre session est fermée. Reconnectez-vous. »'],
    ['20261130000004_l12a_devis_commande.sql|NO_PORTIONS_LEFT', 'code interne (SQLERRM devient « code ») ; la réponse porte « Plus assez de portions du plat du jour. »'],
    ['20261130000004_l12a_devis_commande.sql|OUT_OF_STOCK', 'code interne (SQLERRM devient « code ») ; la réponse porte « Un produit du panier vient d’être épuisé. »'],
    ['20261226000003_l12b_garde_prix.sql|ORDER_PRICE_CHANGED', 'code interne de l’exception attrapée ; la réponse porte le nouveau montant et une phrase française'],
]);

/** Fichiers d'exploitation, jamais lus par une personne (§ 4.3, § 4.4 point 6). */
const OPERATOR_FILES = new Set(['lib/env.ts', 'lib/integrations/real-mode.ts', 'lib/push/config.ts', 'app/api/auth/sms-hook/route.ts',
    // Modèles de messages : relus rendus (bloc a), y compris leurs erreurs de données internes (TemplateDataError, jamais affichée)
    'lib/notifications/catalog.ts', 'lib/notifications/catalog-types.ts']);

function serverFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        if (!fs.existsSync(path.join(ROOT, dir))) return;
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) {
                if (rel === 'app/dev' || rel === 'app/api/dev' || e.name === 'node_modules') continue;
                walk(rel);
            } else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(rel);
        }
    };
    walk('app/api');
    walk('lib');
    walk('hooks');
    return out.filter((f) => !OPERATOR_FILES.has(f)).sort();
}

function isAdminFile(rel: string): boolean {
    return rel.startsWith('app/api/admin/') || rel.startsWith('app/admin/') || rel.startsWith('lib/admin/');
}

function faultsOfE(text: string, rel: string): string[] {
    const out = faultsOf(text);
    const x = EXTRA_RE.exec(text);
    if (x) out.push(`mot de développeur « ${x[0]} »`);
    if (!isAdminFile(rel)) {
        const p = PUSH_RE.exec(text);
        if (p) out.push(`mot « ${p[0]} » hors administration`);
    }
    const c = CAMEL_RE.exec(text);
    if (c) out.push(`identifiant « ${c[0]} »`);
    return out;
}

/** Propriétés d'un objet littéral dont la valeur est lue par une personne (réponse d'API, refus, zod). */
const MESSAGE_PROPS = new Set(['error', 'message', 'details', 'required', 'invalid', 'hint']);
/** Méthodes zod dont un argument texte est un message (`.min(1, '…')`, `.uuid('…')`, `.refine(fn, '…')`). */
const ZOD_METHODS = new Set(['min', 'max', 'length', 'uuid', 'email', 'url', 'regex', 'refine', 'superRefine', 'nonempty', 'int', 'positive', 'nonnegative', 'gte', 'lte', 'gt', 'lt', 'startsWith', 'endsWith', 'datetime', 'date', 'time', 'multipleOf', 'finite', 'trim']);
/** Constructeurs et aides dont le premier argument est affiché. */
const SHOWN_CALLS = new Set(['PublicError', 'badRequest', 'conflict', 'notFound', 'forbidden', 'unprocessable']);
/** Appels de journal : jamais lus par une personne. */
const LOG_RE = /^(?:console|logger|log)\.\w+$/;

function textOf(node: ts.Node): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
    return null;
}

describe('e. routes d’API, lib, hooks : aucun mot technique dans un message renvoyé ou affiché', () => {
    test('propriétés error, message, details ; PublicError et refus ; messages zod (sans les journaux ni les fichiers d’exploitation)', () => {
        const faults: string[] = [];
        let texts = 0;
        const files = serverFiles();
        for (const rel of files) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
            const report = (node: ts.Node): void => {
                const raw = textOf(node);
                if (raw === null) return;
                texts += 1;
                const clean = raw.replace(/\s+/g, ' ').trim();
                if (!clean || EXCEPTIONS_E.has(`${rel}|${clean}`)) return;
                for (const f of faultsOfE(clean, rel)) {
                    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                    faults.push(`${rel}:${line + 1} : ${f} — « ${clean.slice(0, 110)} »`);
                }
            };
            const visit = (node: ts.Node, inLog: boolean): void => {
                if (ts.isCallExpression(node)) {
                    const callee = node.expression.getText(sf);
                    if (LOG_RE.test(callee)) return; // journal : jamais affiché
                    const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : '';
                    if (!inLog && ZOD_METHODS.has(name) && /\b(z|zod)\b|\)\s*\.\s*\w+$/.test(callee)) {
                        for (const a of node.arguments) report(a);
                    }
                    if (!inLog && SHOWN_CALLS.has(name) && node.arguments[0]) report(node.arguments[0]);
                } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'PublicError' && node.arguments?.[0]) {
                    report(node.arguments[0]);
                } else if (ts.isPropertyAssignment(node) && !inLog) {
                    const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : '';
                    if (MESSAGE_PROPS.has(key)) report(node.initializer);
                }
                ts.forEachChild(node, (child) => visit(child, inLog));
            };
            visit(sf, false);
        }
        console.log(`[DESIGN1B-MOTS] e. ${files.length} fichiers serveur, ${texts} messages relus ; fautes : ${faults.length}`);
        assert.deepEqual(faults, []);
    });

    test('messages SQL de la DERNIÈRE définition de chaque fonction : « message » des réponses et RAISE … MESSAGE', () => {
        const dir = path.join(ROOT, 'supabase', 'migrations');
        const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
        const last = new Map<string, { file: string; body: string }>();
        const head = /CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z_0-9]+)\s*\(/gi;
        for (const f of files) {
            const text = fs.readFileSync(path.join(dir, f), 'utf8');
            for (const m of text.matchAll(head)) {
                const as = text.indexOf('AS $', m.index!);
                if (as < 0) continue;
                const tag = text.slice(as + 3, text.indexOf('$', as + 4) + 1);
                const start = as + 3 + tag.length;
                const end = text.indexOf(tag, start);
                if (end < 0) continue;
                last.set(m[1].toLowerCase(), { file: f, body: text.slice(start, end) });
            }
        }
        const faults: string[] = [];
        let texts = 0;
        const msgRe = /'message'\s*,\s*'((?:[^']|'')*)'|MESSAGE\s*=\s*(?:format\(\s*)?'((?:[^']|'')*)'/g;
        for (const [fn, def] of last) {
            for (const m of def.body.matchAll(msgRe)) {
                const msg = (m[1] ?? m[2] ?? '').replace(/''/g, '\'').replace(/%[sIL]/g, '…').trim();
                texts += 1;
                if (!msg || EXCEPTIONS_E.has(`${def.file}|${msg}`)) continue;
                const found = [...faultsOf(msg)];
                const x = EXTRA_RE.exec(msg);
                if (x) found.push(`mot de développeur « ${x[0]} »`);
                for (const f of found) faults.push(`${fn} (${def.file}) : ${f} — « ${msg.slice(0, 110)} »`);
            }
        }
        console.log(`[DESIGN1B-MOTS] e. ${last.size} fonctions SQL (dernière définition), ${texts} messages relus ; fautes : ${faults.length}`);
        assert.ok(last.size > 300, `fonctions lues (${last.size})`);
        assert.deepEqual(faults, []);
    });

    test('exports : participants (rendu) et export comptable des organisatrices (libellés, jamais les codes)', async () => {
        const { participantsCsv } = await import('../../lib/events/pilotage.service');
        const csv = participantsCsv({
            exportId: 'x', title: 'Gala', includeContacts: false, rowCount: 2,
            rows: [
                { name: 'Awa Ndiaye', category: 'Standard', origin: 'En ligne', status: 'Valable', entered_at: null, zone: null, gate: null },
                { name: 'Moussa Diop', category: 'VIP', origin: 'Invitation', status: 'Utilisé', entered_at: '20:15', zone: 'Pelouse', gate: 'Porte 1' },
            ],
        });
        const cells = csv.replace(/^﻿/, '').split(/\r\n/).flatMap((l) => l.split(';'));
        assert.deepEqual(cells.filter((c) => CODE_RE.test(c) || TECH_RE.test(c)), [], 'cellules des participants');
        const acc = fs.readFileSync(path.join(ROOT, 'lib', 'partner', 'partner-dashboard.service.ts'), 'utf8');
        assert.doesNotMatch(acc, /'EN_LIGNE'|'ESPECES'/, 'canal de l’export comptable : libellés « En ligne », « Espèces », « Invitation »');
        assert.match(acc, /ticketStatusLabel\(t\.status\)/, 'statut du billet : libellé (ticketStatusLabel), jamais le code');
        assert.doesNotMatch(acc, /t\.ticket_number \|\| t\.id/, 'jamais l’identifiant technique à la place du numéro');
    });

    test('erreurs affichées : jamais `set…(err.message)` sans le garde-fou ; errorMessage() passe une erreur hors API au garde-fou', () => {
        const faults: string[] = [];
        const roots = ['app', 'components', 'hooks'];
        const re = /\bset[A-Z]\w*\(\s*(?:err|error|e)\s+instanceof\s+Error\s*(?:&&\s*(?:err|error|e)\.message\s*)?\?\s*(?:err|error|e)\.message\b|\bset[A-Z]\w*\(\s*(?:err|error|e)\.message\s*\)/;
        const walk = (dir: string): void => {
            if (!fs.existsSync(path.join(ROOT, dir))) return;
            for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
                const rel = `${dir}/${e.name}`;
                if (e.isDirectory()) { if (e.name !== 'node_modules' && rel !== 'app/dev') walk(rel); continue; }
                if (!/\.tsx?$/.test(e.name)) continue;
                const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
                lines.forEach((line, i) => {
                    // Erreur d'API identifiée par son code (ou ApiError) sur la ligne ou juste avant : phrase française de nos routes
                    const typed = /\.code\s*===|instanceof\s+ApiError/.test(lines.slice(Math.max(0, i - 6), i + 1).join('\n'));
                    if (re.test(line) && !typed && !/humanToastMessage\(/.test(line)) faults.push(`${rel}:${i + 1} : ${line.trim().slice(0, 120)}`);
                });
            }
        };
        for (const r of roots) walk(r);
        const fj = fs.readFileSync(path.join(ROOT, 'components', 'partner', 'fetch-json.ts'), 'utf8');
        const body = fj.slice(fj.indexOf('export function errorMessage'));
        assert.match(body.slice(0, 600), /humanToastMessage\(err\.message\)/, 'errorMessage() : une erreur hors API passe par humanToastMessage');
        console.log(`[DESIGN1B-MOTS] e. erreurs affichées : fautes : ${faults.length}`);
        assert.deepEqual(faults, []);
    });
});
