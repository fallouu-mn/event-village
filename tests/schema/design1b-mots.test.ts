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
 * Contre-vérification de la phase 2 (T7) : identifiant en minuscules avec tiret bas (event_id, p_user_id) dans une PHRASE (texte
 * avec une espace). Seul, un tel mot est un nom de colonne (`.lt('created_at', …)`, lu comme un argument zod) ou un code machine.
 */
export const SNAKE_RE = /(?<![\p{L}\p{N}_./-])[a-z][a-z0-9]*_[a-z0-9_]+(?![\p{L}\p{N}_])/u;

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
    // Contre-vérification du lot « Avis », phase 2 (T7) : messages SQL lus depuis par le bloc (RAISE EXCEPTION '…', identifiant
    // en snake_case dans une phrase) ; chacun vérifié : aucun n'arrive à l'écran (route : journal et phrase française à elle,
    // ou signal attrapé dans la fonction). Un message qui pourrait arriver à l'écran reçoit une phrase simple, jamais ici.
    ["20261031000011_lot1c9_quotas.sql|quota_reserve : au moins une règle requise",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261031000011_lot1c9_quotas.sql|quota_reserve : règle incomplète …",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261031000013_lot2_reservations.sql|stock_reservations : changement de catégorie interdit",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000003_lot3_moteur.sql|finance_compute : cible … non prise en charge",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000003_lot3_moteur.sql|finance_compute : aucune ligne",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000003_lot3_moteur.sql|finance_compute : opérateur … inconnu",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000003_lot3_moteur.sql|finance_compute : ligne invalide (prix …, quantité …)",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000004_lot3_grand_livre.sql|fin_payment_sale_credit : partenaire … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000005_lot3_remboursements.sql|refund_request : paiement … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000005_lot3_remboursements.sql|refund_request : nature … inconnue",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261101000011_lot4_caisse.sql|CONTROLLER_HAS_OPEN_SHIFT : le contrôleur … a une caisse ouverte sur l'événement …",
        "refus reconnu par lib/shifts/shift.service.ts (isControllerRemovalBlocked) : l’écran reçoit « Ce contrôleur a une caisse ouverte : clôturez-la avant de le retirer. »"],
    ["20261101000011_lot4_caisse.sql|CONTROLLER_HAS_OPEN_SHIFT : le contrôleur … a une caisse ouverte",
        "refus reconnu par lib/shifts/shift.service.ts (isControllerRemovalBlocked) : l’écran reçoit « Ce contrôleur a une caisse ouverte : clôturez-la avant de le retirer. »"],
    ["20261103000006_lot6_pros_admin.sql|Le type … est un envoi synchrone : il se journalise par notification_sync_log.",
        "garde de programmation (type synchrone mis en file par erreur) : appel du serveur seul, journalisé, jamais affiché"],
    ["20261108000004_lot9_compte.sql|client_payments_list : user_id requis",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261109000005_lot9bis_samirpay.sql|payment_release : statut cible invalide …",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261109000005_lot9bis_samirpay.sql|PRICE_BELOW_MINIMUM",
        "refus reconnu par lib/events/event.service.ts (priceBelowMinimum) : l’écran reçoit le prix minimum en phrase française"],
    ["20261109000011_lot9bis_textes.sql|quota_release : tableau de règles requis",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261109000011_lot9bis_textes.sql|quota_release : règle incomplète …",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261110000007_lot9ter_evenements.sql|finance_account_balance : compte … inconnu",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261111000004_lot9quater_email.sql|Le type … est un envoi synchrone : il se journalise par notification_sync_log.",
        "garde de programmation (type synchrone mis en file par erreur) : appel du serveur seul, journalisé, jamais affiché"],
    ["20261111000005_lot9quater_argent.sql|cashout_finalize : issue … inconnue",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261111000005_lot9quater_argent.sql|cashout_finalize : envoi … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261111000005_lot9quater_argent.sql|cashout_finalize : remboursement de l'envoi … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261111000005_lot9quater_argent.sql|cashout_finalize : retrait de l'envoi … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261111000005_lot9quater_argent.sql|refund_request : paiement … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261111000005_lot9quater_argent.sql|refund_request : nature … inconnue",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261115000002_finition1_equipe.sql|controller_invitation_notify_partner : type inconnu …",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261115000009_cvf1_verdict_hors_plage.sql|ticket_scan : méthode … inconnue",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261115000009_cvf1_verdict_hors_plage.sql|ticket_scan : verdict de zone absent pour le billet … (statut …)",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261117000003_f3a_synthese.sql|finance_admin_owed : compte … inconnu",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261117000004_f3a_solde.sql|finance_balance_record : solde absent",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261118000001_f3b_todo.sql|admin_todo : liste des lignes absente",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261118000001_f3b_todo.sql|admin_todo : ligne inconnue (…)",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261119000005_f2b_zones_creation.sql|EVENT_ZONES_REFUSED",
        "signal interne attrapé dans la même fonction (annulation du bloc), jamais renvoyé : la réponse porte sa phrase française"],
    ["20261119000007_f2b_apercu_avis.sql|EVENT_UPDATE_PREVIEW",
        "signal interne attrapé dans la même fonction (annulation du bloc), jamais renvoyé : la réponse porte sa phrase française"],
    ["20261120000007_f3d_cv_revocation.sql|revoke_user_sessions : p_user_id requis",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261122000005_l10a_annulation.sql|hall_refund_payment : paiement de salle … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261122000005_l10a_annulation.sql|hall_refund_payment : part … hors bornes",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261123000106_l11a_annulation.sql|table_refund_payment : paiement de table … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261123000106_l11a_annulation.sql|table_refund_payment : part … hors bornes",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261129000003_l11b_reservations.sql|table_short_code : aucun code libre après 20 essais",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261129000008_l11b_cv_plan_tout_ou_rien.sql|venue_plan_set : plan refusé",
        "signal interne attrapé dans la même fonction (annulation du bloc), jamais renvoyé : la réponse porte sa phrase française"],
    ["20261130000005_l12a_paiement.sql|calculate_referral_commissions : paiement … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261130000006_l12a_etapes.sql|order_refund_payment : paiement de commande … introuvable",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261130000006_l12a_etapes.sql|order_refund_payment : part … hors bornes",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261130000008_l12a_releves.sql|finance_admin_earned : période vide ou inversée (… → …)",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261130000008_l12a_releves.sql|finance_admin_payments : statut … inconnu",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261130000008_l12a_releves.sql|finance_admin_payments : période vide ou inversée (… → …)",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261201000002_l11c_schema.sql|stock_reservations : la table d'une attente ne change pas.",
        "garde de la base (déclencheur) : les écrans passent par les fonctions des tables d’un événement ; un refus devient la phrase générique de la route, jamais ce texte"],
    ["20261201000002_l11c_schema.sql|stock_reservations : une table s'attend par les fonctions des tables d'un événement, une à la fois.",
        "garde de la base (déclencheur) : les écrans passent par les fonctions des tables d’un événement ; un refus devient la phrase générique de la route, jamais ce texte"],
    ["20261201000002_l11c_schema.sql|ticket_categories : un type de table se crée par les fonctions des tables d'un événement.",
        "garde de la base (déclencheur) : les écrans passent par les fonctions des tables d’un événement ; un refus devient la phrase générique de la route, jamais ce texte"],
    ["20261201000002_l11c_schema.sql|ticket_categories : un type de table se supprime par les fonctions des tables d'un événement.",
        "garde de la base (déclencheur) : les écrans passent par les fonctions des tables d’un événement ; un refus devient la phrase générique de la route, jamais ce texte"],
    ["20261201000002_l11c_schema.sql|ticket_categories : le genre d'une catégorie (billet ou table) ne change pas.",
        "garde de la base (déclencheur) : les écrans passent par les fonctions des tables d’un événement ; un refus devient la phrase générique de la route, jamais ce texte"],
    ["20261201000002_l11c_schema.sql|ticket_categories : prix et places d'un type de table figés dès la première vente.",
        "garde de la base (déclencheur) : les écrans passent par les fonctions des tables d’un événement ; un refus devient la phrase générique de la route, jamais ce texte"],
    ["20261201000002_l11c_schema.sql|ticket_categories : un type de table se modifie par les fonctions des tables d'un événement.",
        "garde de la base (déclencheur) : les écrans passent par les fonctions des tables d’un événement ; un refus devient la phrase générique de la route, jamais ce texte"],
    ["20261201000003_l11c_configuration.sql|event_table_type_save : refus",
        "signal interne attrapé dans la même fonction (annulation du bloc), jamais renvoyé : la réponse porte sa phrase française"],
    ["20261201000003_l11c_configuration.sql|event_tables_save : refus",
        "signal interne attrapé dans la même fonction (annulation du bloc), jamais renvoyé : la réponse porte sa phrase française"],
    ["20261201000004_l11c_vente.sql|event_table_checkout : opérateur obligatoire pour un paiement",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261201000004_l11c_vente.sql|event_table_issue : attente … du paiement … introuvable ou sans titulaire",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261201000004_l11c_vente.sql|checkout_create_payment : opérateur obligatoire pour un paiement",
        "garde interne d’une fonction appelée par le serveur seul : l’erreur est journalisée et la route répond par sa propre phrase, jamais ce texte"],
    ["20261215000002_l11cc_cv_correctifs.sql|event_table_copy : refus",
        "signal interne attrapé dans la même fonction (annulation du bloc), jamais renvoyé : la réponse porte sa phrase française"],
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
    const s = SNAKE_RE.exec(text);
    if (s && /\s/.test(text)) out.push(`identifiant « ${s[0]} »`);
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

/** Constructeurs dont le premier argument est le corps renvoyé tel quel (texte, CSV). */
const RESPONSE_CTORS = new Set(['Response', 'NextResponse']);
const JOIN_OPS = new Set([ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.PlusToken]);

/**
 * Contre-vérification de la phase 2 (T7) : textes qu'une expression peut renvoyer — littéral, branches d'un ternaire,
 * côtés de `??`, `||`, `&&` et `+`, parenthèses, `as`, `!`, et constante du même fichier (suivie une fois).
 */
function shownTexts(node: ts.Node, consts: Map<string, ts.Expression>, seen: Set<string> = new Set()): ts.Node[] {
    if (textOf(node) !== null) return [node];
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
        return shownTexts(node.expression, consts, seen);
    }
    if (ts.isConditionalExpression(node)) return [...shownTexts(node.whenTrue, consts, seen), ...shownTexts(node.whenFalse, consts, seen)];
    if (ts.isBinaryExpression(node) && JOIN_OPS.has(node.operatorToken.kind)) {
        return [...shownTexts(node.left, consts, seen), ...shownTexts(node.right, consts, seen)];
    }
    if (ts.isIdentifier(node) && consts.has(node.text) && !seen.has(node.text)) {
        seen.add(node.text);
        return shownTexts(consts.get(node.text)!, consts, seen);
    }
    return [];
}

/** Constantes du fichier (`const X = …`), pour suivre `{ error: X }`. */
function constantsOf(sf: ts.SourceFile): Map<string, ts.Expression> {
    const out = new Map<string, ts.Expression>();
    const walk = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
            && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0) {
            out.set(node.name.text, node.initializer);
        }
        ts.forEachChild(node, walk);
    };
    walk(sf);
    return out;
}

describe('e. routes d’API, lib, hooks : aucun mot technique dans un message renvoyé ou affiché', () => {
    test('propriétés error, message, details ; PublicError et refus ; messages zod (sans les journaux ni les fichiers d’exploitation)', () => {
        const faults: string[] = [];
        let texts = 0;
        const files = serverFiles();
        for (const rel of files) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
            const consts = constantsOf(sf);
            const reportOne = (node: ts.Node): void => {
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
            // Contre-vérification de la phase 2 (T7) : chaque texte que l'expression peut renvoyer (ternaire, ??, constante…)
            const report = (node: ts.Node): void => {
                for (const t of shownTexts(node, consts)) reportOne(t);
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
                } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && RESPONSE_CTORS.has(node.expression.text) && node.arguments?.[0]) {
                    // Contre-vérification de la phase 2 (T7) : corps texte d'une réponse (new Response('…'), export CSV)
                    report(node.arguments[0]);
                } else if (ts.isPropertyAssignment(node) && !inLog) {
                    const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : '';
                    if (MESSAGE_PROPS.has(key)) report(node.initializer);
                } else if (ts.isShorthandPropertyAssignment(node) && !inLog && MESSAGE_PROPS.has(node.name.text)) {
                    report(node.name);
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
        // Contre-vérification de la phase 2 (T7) : aussi la forme classique RAISE EXCEPTION '…' et la clé « error » d'une
        // réponse ; « % » seul (paramètre de RAISE) lu comme « … »
        const msgRe = /'message'\s*,\s*'((?:[^']|'')*)'|MESSAGE\s*=\s*(?:format\(\s*)?'((?:[^']|'')*)'|RAISE\s+EXCEPTION\s+'((?:[^']|'')*)'|'error'\s*,\s*'((?:[^']|'')*)'/gi;
        for (const [fn, def] of last) {
            for (const m of def.body.matchAll(msgRe)) {
                const msg = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').replace(/''/g, '\'').replace(/%[sIL]?/g, '…').trim();
                texts += 1;
                if (!msg || EXCEPTIONS_E.has(`${def.file}|${msg}`)) continue;
                // Clé « error » : un code seul (capitales) est le code machine que la route traduit ; une phrase est relue
                if (m[4] !== undefined && /^[A-Z][A-Z0-9_]*$/.test(msg)) continue;
                const found = [...faultsOf(msg)];
                const x = EXTRA_RE.exec(msg);
                if (x) found.push(`mot de développeur « ${x[0]} »`);
                const s = SNAKE_RE.exec(msg);
                if (s && /\s/.test(msg)) found.push(`identifiant « ${s[0]} »`);
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
        // Contre-vérification de la phase 2 (T7) : aussi `set…((err as Error).message)`, `set…(err?.message ?? …)`
        const re = /\bset[A-Z]\w*\(\s*(?:err|error|e)\s+instanceof\s+Error\s*(?:&&\s*(?:err|error|e)\.message\s*)?\?\s*(?:err|error|e)\.message\b|\bset[A-Z]\w*\(\s*(?:err|error|e)\.message\s*\)|\bset[A-Z]\w*\(\s*(?:\(\s*(?:err|error|e)\s+as\s+\w+\s*\)|(?:err|error|e))\s*\??\.message\b/;
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
