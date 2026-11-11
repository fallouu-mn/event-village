/**
 * Lot 7, tâche 7.9 — confirmation d'achat claire (consigne « AJOUT AU LOT 7 — 7.9 », contrat section 19,
 * décisions D87 à D99, migration 20261105000007_lot7_confirmation.sql).
 *
 * Le billet (QR dynamique) reste dans l'application : les confirmations PURCHASE_CONFIRMED,
 * FREE_TICKETS_CONFIRMED et TRANSFER_RECEIVED le disent et donnent tout ce dont le client a besoin.
 *  1. achat réel de 1 billet : la ligne EMAIL porte, figés à l'émission (D87), `categories` et
 *     `ticket_numbers` ; l'email remis (faux fournisseur) donne titre, date et heure de Dakar, lieu, ville,
 *     « 1 × <catégorie> », montant payé et frais, le numéro, P1, P2, P3 et le bouton « Voir mes billets »
 *     vers /tickets ; il est rendu depuis le seul instantané ; SMS en un segment sans numéro ;
 *  2. achat réel de 4 billets de deux catégories (2 + 2) : lignes de catégorie dans l'ordre du nom, les
 *     4 numéros = tickets.ticket_number = ticketNumber de GET /api/tickets (D88), dans l'ordre (catégorie,
 *     numéro) (D89) ;
 *  3. achat réel de 12 billets : exactement les 10 premiers numéros, « et 2 autres », les 2 derniers
 *     absents, ticket_count = 12 ;
 *  4. billets gratuits réels de deux catégories (FREE_TICKETS_CONFIRMED) : mêmes blocs, aucun montant ;
 *     in-app « Vos billets sont dans Mes billets. » (D94) ;
 *  5. transfert accepté (TRANSFER_RECEIVED) : canal EMAIL créé (D91), template_data.ticket_number = NOUVEAU
 *     numéro, catégorie ; email avec catégorie, numéro, P1, P2, P3, sans montant ; in-app avec le numéro ;
 *  6. rendus du catalogue (1, 4, 11 et 12 billets, gratuits, transfert) : aucun motif interdit (§19.4 : EVT1:,
 *     <img, data:image, totp, secret, qr_code, /tickets/claim, claim, token, 64 hexadécimaux, 6 chiffres
 *     isolés), aucune image, ressource ni police distante, seul lien hors de l'application : le support ;
 *     « QR » seulement dans P1 ; troncature à 10 et singulier « et 1 autre » ;
 *  7. phrases exactes P1, P2, P3 dans la version texte et dans le HTML après décodage des entités ;
 *  8. SMS en un segment GSM-7 au pire cas (calcul GSM 03.38 fait ICI, table de base et d'extension, sans
 *     importer smsSegments) ; aucun numéro ; mention « Billets dans l'appli » absente (D95), sa longueur
 *     éventuelle imprimée ;
 *  9. thème sombre : meta color-scheme, bloc prefers-color-scheme: dark, chaque paire de couleurs du clair
 *     et du sombre ≥ 4,5:1 (calcul WCAG ICI) ;
 * 10. ligne d'avant la migration (sans categories ni ticket_numbers, D90) : rendu sans erreur (V, garde-fou)
 *     puis phrases et bouton présents (R) ;
 * 11. migration 07 : notif_ticket_lines (SECURITY DEFINER, STABLE, search_path, service_role seul), appelée
 *     par payment_confirm et free_tickets_claim ; ticket_transfer_accept écrit la catégorie et garde le
 *     verrou FOR SHARE de M3 ; registre TRANSFER_RECEIVED avec EMAIL.
 *
 * Rouge avant fix(7.9) : le gabarit est générique (« Ouvrir Event Village », un seul paragraphe in-app), les
 * données n'ont ni catégories ni numéros, TRANSFER_RECEIVED n'a pas d'email, le SMS d'achat fait 161 septets
 * au pire cas, aucun thème sombre, la migration 07 n'existe pas.
 *
 * Interprétations : phrases comparées à l'identique, apostrophe droite comprise (D99), seules les espaces
 * insécables (U+00A0, U+202F) étant ramenées à l'espace et les blancs repliés ; ordre des numéros calculé
 * par comparaison binaire (catégorie, numéro), identique à l'ordre SQL pour ces valeurs (lettres, chiffres,
 * tirets aux mêmes positions) ; montants et dates attendus formatés par lib/format (formatFcfa,
 * formatDateTime à l'heure de Dakar), formats partagés de l'application et non module testé ; contrastes
 * lus par les classes du contrat 19.5 (ev-bg, ev-card, ev-text, ev-muted, ev-link, ev-notice) : couleurs en
 * ligne pour le clair, bloc sombre pour le sombre ; ev-text, ev-muted et ev-link sont du texte posé sur la
 * carte, le texte de l'encadré prend la couleur de ev-notice ou, à défaut, celle de ev-text.
 *
 * Lot 8 (8.2 v) : cas T13 de tests/legacy/client-ticket-lifecycle.test.ts porté, vert dès l'écriture : isUpcoming et
 * usedAt de GET /api/tickets après un vrai compostage.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { formatDateTime, formatFcfa } from '../../lib/format';
import { inspect } from '../helpers/db';
import { confirmPassword, routeContext, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, scan, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import { dispatchAt, emailsTo, loadLotModule, markPhoneVerified, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('confirmation-achat');
});

type Row = Record<string, unknown>;
type Ch = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
interface Ctx { appUrl: string }
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

// ── Phrases de la consigne (mot pour mot) et de D99 ────────────────────────

const P1 = 'Votre billet s\'affiche dans l\'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d\'écran ne sera pas acceptée à l\'entrée.';
const P2 = 'Ouvrez votre billet avec du réseau avant d\'arriver : il restera disponible même sans connexion.';
const P3 = 'En cas de problème à l\'entrée, présentez le numéro de votre billet et une pièce d\'identité : le contrôleur peut l\'enregistrer à la main.';
const PHRASES = [P1, P2, P3] as const;
const BUTTON = 'Voir mes billets';
const GENERIC_BUTTON = 'Ouvrir Event Village';
const SUPPORT_MAILTO = `mailto:${process.env.SUPPORT_EMAIL ?? 'support@eventvillage.sn'}`; // lot 9 bis (R70, B88) : adresse lue dans SUPPORT_EMAIL, comme lib/support.ts
/** Mention écartée par D95 (elle ne tient pas au pire cas). */
const SMS_MENTION = 'Billets dans l\'appli, rubrique Mes billets.';

/** URL de 27 caractères (contrat F2.3 du lot 6, comme notif-modeles). */
const RENDER_URL = 'https://app.eventvillage.sn';
const CTX: Ctx = { appUrl: RENDER_URL };
/** URL de l'application vue par l'envoyeur (NEXT_PUBLIC_APP_URL de .env.test). */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

// ── GSM 03.38 : calcul indépendant du module testé ─────────────────────────

/** Alphabet GSM-7 de base (127 caractères imprimables, l'échappement 0x1B exclu). */
const GSM7_BASIC = new Set(Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
));
/** Table d'extension (chaque caractère coûte 2 septets : échappement + caractère). */
const GSM7_EXTENSION = new Set(Array.from('\f^{}\\[~]|€'));

interface SmsMeasure { gsm7: boolean; septets: number; segments: number; outside: string[] }

function measureSms(text: string): SmsMeasure {
    let septets = 0;
    const outside: string[] = [];
    for (const ch of Array.from(text)) {
        if (GSM7_BASIC.has(ch)) septets += 1;
        else if (GSM7_EXTENSION.has(ch)) septets += 2;
        else outside.push(`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
    }
    if (outside.length > 0) {
        const units = text.length;
        return { gsm7: false, septets: units, segments: units <= 70 ? 1 : Math.ceil(units / 67), outside };
    }
    return { gsm7: true, septets, segments: septets <= 160 ? 1 : Math.ceil(septets / 153), outside };
}

// ── Contraste WCAG 2.x : calcul indépendant ────────────────────────────────

function rgbOf(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    assert.match(full, /^[0-9a-fA-F]{6}$/, `couleur non hexadécimale : ${hex}`);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
    const [r, g, b] = rgbOf(hex).map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// ── Catalogue (import dynamique, types décrits localement) ─────────────────

type Rendered =
    | { channel: 'IN_APP'; title: string; content: string; actionUrl: string }
    | { channel: 'SMS'; text: string }
    | { channel: 'PUSH'; title: string; body: string; url: string }
    | { channel: 'EMAIL'; subject: string; html: string; text: string; url: string };

type RenderFn = (type: string, channel: Ch, data: unknown, ctx: Ctx) => Rendered;

let renderCache: RenderFn | null = null;

async function renderer(): Promise<RenderFn> {
    if (renderCache) return renderCache;
    const mod = await loadLotModule('../../lib/notifications/catalog', 'catalogue des modèles (contrat G1 du lot 6)');
    assert.equal(typeof mod.renderNotification, 'function', 'lib/notifications/catalog.ts : renderNotification non exporté');
    renderCache = mod.renderNotification as RenderFn;
    return renderCache;
}

async function renderEmail(type: string, data: Row, ctx: Ctx = CTX): Promise<{ subject: string; html: string; text: string }> {
    const render = await renderer();
    const r = render(type, 'EMAIL', data, ctx);
    assert.equal(r.channel, 'EMAIL', `${type} : rendu EMAIL`);
    const mail = r as Extract<Rendered, { channel: 'EMAIL' }>;
    return { subject: mail.subject, html: mail.html, text: mail.text };
}

async function renderInApp(type: string, data: Row): Promise<{ title: string; content: string; actionUrl: string }> {
    const r = (await renderer())(type, 'IN_APP', data, CTX);
    assert.equal(r.channel, 'IN_APP', `${type} : rendu IN_APP`);
    return r as Extract<Rendered, { channel: 'IN_APP' }>;
}

async function renderSms(type: string, data: Row): Promise<string> {
    const r = (await renderer())(type, 'SMS', data, CTX);
    assert.equal(r.channel, 'SMS', `${type} : rendu SMS`);
    return (r as Extract<Rendered, { channel: 'SMS' }>).text;
}

// ── Texte visible d'un email ───────────────────────────────────────────────

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', times: '×', laquo: '«', raquo: '»',
    rsquo: '’', lsquo: '‘', hellip: '…', mdash: '—', ndash: '–', eacute: 'é', egrave: 'è', agrave: 'à', ecirc: 'ê', ccedil: 'ç',
};

function decodeEntities(s: string): string {
    return s
        .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&([a-z]+);/gi, (m: string, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

/** Espaces insécables ramenées à l'espace, blancs repliés (les apostrophes restent telles quelles). */
function flat(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Texte visible du HTML : sans <head> ni <style>, balises de bloc → saut de ligne, entités décodées. */
function visibleText(html: string): string {
    const body = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const blocks = body.replace(/<(?:br|\/?(?:p|div|td|th|tr|li|ul|ol|table|tbody|thead|h[1-6]|section|header|footer))\b[^>]*>/gi, '\n');
    return decodeEntities(blocks.replace(/<[^>]+>/g, ''));
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Motifs interdits (contrat 19.4) ────────────────────────────────────────

const FORBIDDEN_WORDS: Array<[RegExp, string]> = [
    [/EVT1:/, 'charge utile du code dynamique « EVT1: »'],
    [/<img/i, 'balise <img'],
    [/data:image/i, 'image « data:image »'],
    [/totp/i, '« totp »'],
    [/secret/i, '« secret »'],
    [/qr_code/i, '« qr_code »'],
    [/\/tickets\/claim/i, 'lien « /tickets/claim »'],
    [/claim/i, '« claim »'],
    [/token/i, '« token »'],
    [/[0-9a-fA-F]{64}/, 'suite de 64 hexadécimaux'],
];
/** Code à 6 chiffres isolé : cherché dans le texte visible seulement (les couleurs #475569 du HTML brut en ont). */
const SIX_DIGITS = /(?<![0-9A-Za-z])[0-9]{6}(?![0-9A-Za-z])/;

/** Défauts d'un texte rendu (in-app, push, SMS, version texte, texte visible du HTML). */
function textDefects(label: string, value: string, opts: { phrasesAllowed: boolean }): string[] {
    const issues: string[] = [];
    for (const [re, what] of FORBIDDEN_WORDS) if (re.test(value)) issues.push(`${label} : ${what} — ${re.exec(value)?.[0]}`);
    const six = SIX_DIGITS.exec(value);
    if (six) issues.push(`${label} : code de 6 chiffres isolé « ${six[0]} »`);
    const withoutP1 = opts.phrasesAllowed ? flat(value).split(P1).join(' ') : flat(value);
    if (/qr/i.test(withoutP1)) issues.push(`${label} : « QR » hors de la phrase P1 — ${withoutP1.slice(0, 300)}`);
    return issues;
}

/** Défauts propres au HTML : motifs interdits du brut, ressources, liens. */
function htmlDefects(label: string, html: string, appUrl: string): string[] {
    const issues: string[] = [];
    for (const [re, what] of FORBIDDEN_WORDS) if (re.test(html)) issues.push(`${label} HTML : ${what} — ${re.exec(html)?.[0]}`);
    if (/\ssrc\s*=/i.test(html)) issues.push(`${label} HTML : attribut src= (ressource chargée)`);
    if (/url\s*\(/i.test(html)) issues.push(`${label} HTML : url( (ressource chargée par une feuille de style)`);
    if (/@import|@font-face|fonts\.googleapis|<link\b/i.test(html)) issues.push(`${label} HTML : police ou feuille de style distante`);
    const hrefRe = /href\s*=\s*"([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
        const href = decodeEntities(m[1]);
        if (href === SUPPORT_MAILTO) continue;
        if (!href.startsWith(`${appUrl}/`) || href.slice(appUrl.length).startsWith('//')) issues.push(`${label} HTML : lien hors de l'application ${href}`);
    }
    return issues;
}

// ── Contenu attendu d'une confirmation ─────────────────────────────────────

interface ConfirmationExpect {
    label: string;
    title: string;
    startAt: string;
    location: string;
    city: string;
    /** Lignes « N × catégorie », dans l'ordre attendu. */
    categoryLines?: Array<[number, string]>;
    /** Catégorie unique (TRANSFER_RECEIVED). */
    category?: string;
    /** Numéros présents, dans l'ordre attendu. */
    numbers: string[];
    /** Numéros qui ne doivent pas apparaître (au-delà des 10 premiers, ancien numéro d'un transfert). */
    absentNumbers?: string[];
    /** « et N autres » attendu ; null : aucune mention de ce genre. */
    more: string | null;
    /** Montant payé et frais ; null : aucun montant (gratuits, transfert). */
    amount: { total: number; serviceFee: number } | null;
    /** Valeurs qui ne doivent jamais apparaître (qr_code, totp_secret des billets réels). */
    secrets?: string[];
    appUrl: string;
}

function inOrder(haystack: string, needles: string[]): boolean {
    let from = -1;
    for (const n of needles) {
        const i = haystack.indexOf(n, from + 1);
        if (i < 0 || i <= from) return false;
        from = i;
    }
    return true;
}

/** Tous les défauts d'un email de confirmation (version texte et HTML). */
function confirmationIssues(mail: { html: string; text: string }, exp: ConfirmationExpect): string[] {
    const issues: string[] = [];
    const views: Array<[string, string]> = [['texte', flat(mail.text)], ['HTML', flat(visibleText(mail.html))]];
    const date = flat(formatDateTime(exp.startAt));
    for (const [where, v] of views) {
        const at = `${exp.label} (${where})`;
        for (const [what, value] of [['titre', exp.title], ['date et heure de Dakar', date], ['lieu', exp.location], ['ville', exp.city]] as Array<[string, string]>) {
            if (!v.includes(flat(value))) issues.push(`${at} : information manquante, ${what} (« ${value} »)`);
        }
        if (exp.categoryLines) {
            const idx = exp.categoryLines.map(([n, name]) => {
                const m = new RegExp(`(?<![0-9])${n} ?× ?${escapeRe(name)}`).exec(v);
                if (!m) issues.push(`${at} : ligne « ${n} × ${name} » absente`);
                return m ? m.index : -1;
            });
            if (idx.every((i) => i >= 0) && idx.some((i, k) => k > 0 && i <= idx[k - 1])) {
                issues.push(`${at} : lignes de catégorie hors de l'ordre du nom (${exp.categoryLines.map(([, n]) => n).join(', ')})`);
            }
        }
        if (exp.category && !v.includes(exp.category)) issues.push(`${at} : catégorie « ${exp.category} » absente`);
        for (const n of exp.numbers) if (!v.includes(n)) issues.push(`${at} : numéro ${n} absent`);
        if (exp.numbers.every((n) => v.includes(n)) && !inOrder(v, exp.numbers)) issues.push(`${at} : numéros hors de l'ordre (catégorie, numéro) attendu`);
        for (const n of exp.absentNumbers ?? []) if (v.includes(n)) issues.push(`${at} : numéro ${n} présent alors qu'il ne doit pas l'être`);
        if (exp.more !== null) {
            if (!v.includes(exp.more)) issues.push(`${at} : « ${exp.more} » absent`);
        } else if (/\bet \d+ autres?\b/.test(v)) issues.push(`${at} : mention « et N autres » inattendue`);
        if (exp.amount) {
            if (!v.includes(flat(formatFcfa(exp.amount.total)))) issues.push(`${at} : montant payé ${formatFcfa(exp.amount.total)} absent`);
            if (!v.includes(flat(formatFcfa(exp.amount.serviceFee)))) issues.push(`${at} : frais de service ${formatFcfa(exp.amount.serviceFee)} absents`);
        } else if (/F ?CFA/.test(v)) issues.push(`${at} : un montant apparaît (« F CFA ») alors qu'aucun n'est attendu`);
        for (const p of PHRASES) if (!v.includes(p)) issues.push(`${at} : phrase obligatoire absente ou modifiée : « ${p} »`);
        if (!v.includes(BUTTON)) issues.push(`${at} : « ${BUTTON} » absent`);
        if (v.includes(GENERIC_BUTTON)) issues.push(`${at} : bouton générique « ${GENERIC_BUTTON} » au lieu de « ${BUTTON} »`);
        for (const s of exp.secrets ?? []) if (s && v.includes(s)) issues.push(`${at} : valeur secrète d'un billet présente`);
        issues.push(...textDefects(at, where === 'texte' ? mail.text : visibleText(mail.html), { phrasesAllowed: true }));
    }
    if (!mail.html.includes(`href="${exp.appUrl}/tickets"`)) issues.push(`${exp.label} (HTML) : bouton sans lien ${exp.appUrl}/tickets`);
    if (!mail.text.includes(`${exp.appUrl}/tickets`)) issues.push(`${exp.label} (texte) : lien ${exp.appUrl}/tickets absent`);
    for (const s of exp.secrets ?? []) if (s && mail.html.includes(s)) issues.push(`${exp.label} (HTML brut) : valeur secrète d'un billet présente`);
    issues.push(...htmlDefects(exp.label, mail.html, exp.appUrl));
    return issues;
}

// ── Données d'exemple (rendus du catalogue) ────────────────────────────────

const EVENT: Row = {
    event_id: '7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01', title: 'Gala de la Teranga', start_at: '2026-11-14T20:00:00.000Z',
    location: 'Esplanade du Grand Theatre', city: 'Saly',
};
const SAMPLE_PAYMENT = '1f6e2b9c-7d3a-4c8e-9b21-0a5d3e7f8c42';
/** Numéros au format réel (TCK-AAAAMMJJ-XXXXXXXXXX), déjà dans l'ordre binaire. */
const NUMBERS = [
    'TCK-20261104-0A1B2C3D4E', 'TCK-20261104-1B2C3D4E5F', 'TCK-20261104-2C3D4E5F6A', 'TCK-20261104-3D4E5F6A7B',
    'TCK-20261104-4E5F6A7B8C', 'TCK-20261104-5F6A7B8C9D', 'TCK-20261104-6A7B8C9D0E', 'TCK-20261104-7B8C9D0E1F',
    'TCK-20261104-8C9D0E1F2A', 'TCK-20261104-9D0E1F2A3B', 'TCK-20261104-AE1F2A3B4C', 'TCK-20261104-BF2A3B4C5D',
];

function purchaseData(over: Row): Row {
    return { ...EVENT, payment_id: SAMPLE_PAYMENT, service_fee: 250, total: 5_250, ticket_count: 1, ...over };
}

const RENDER_CASES: Array<{ type: string; data: Row; exp: Omit<ConfirmationExpect, 'appUrl' | 'title' | 'startAt' | 'location' | 'city'> }> = [
    {
        type: 'PURCHASE_CONFIRMED',
        data: purchaseData({ ticket_count: 1, categories: [{ name: 'Standard', quantity: 1 }], ticket_numbers: [NUMBERS[0]] }),
        exp: { label: 'achat de 1 billet', categoryLines: [[1, 'Standard']], numbers: [NUMBERS[0]], more: null, amount: { total: 5_250, serviceFee: 250 } },
    },
    {
        type: 'PURCHASE_CONFIRMED',
        data: purchaseData({
            ticket_count: 4, service_fee: 1_000, total: 35_000,
            categories: [{ name: 'Standard', quantity: 2 }, { name: 'VIP', quantity: 2 }], ticket_numbers: NUMBERS.slice(0, 4),
        }),
        exp: { label: 'achat de 4 billets (2 + 2)', categoryLines: [[2, 'Standard'], [2, 'VIP']], numbers: NUMBERS.slice(0, 4), more: null, amount: { total: 35_000, serviceFee: 1_000 } },
    },
    {
        type: 'PURCHASE_CONFIRMED',
        data: purchaseData({ ticket_count: 11, service_fee: 2_750, total: 57_750, categories: [{ name: 'Standard', quantity: 11 }], ticket_numbers: NUMBERS.slice(0, 10) }),
        exp: { label: 'achat de 11 billets', categoryLines: [[11, 'Standard']], numbers: NUMBERS.slice(0, 10), more: 'et 1 autre', amount: { total: 57_750, serviceFee: 2_750 } },
    },
    {
        type: 'PURCHASE_CONFIRMED',
        data: purchaseData({ ticket_count: 12, service_fee: 3_000, total: 63_000, categories: [{ name: 'Standard', quantity: 12 }], ticket_numbers: NUMBERS.slice(0, 10) }),
        exp: { label: 'achat de 12 billets', categoryLines: [[12, 'Standard']], numbers: NUMBERS.slice(0, 10), absentNumbers: NUMBERS.slice(10), more: 'et 2 autres', amount: { total: 63_000, serviceFee: 3_000 } },
    },
    {
        type: 'FREE_TICKETS_CONFIRMED',
        data: { ...EVENT, ticket_count: 3, ticket_id: '5c2a8e41-9b3d-4f7a-8e16-2d4b6a9c1e73', categories: [{ name: 'Entree libre', quantity: 2 }, { name: 'Invitation', quantity: 1 }], ticket_numbers: NUMBERS.slice(0, 3) },
        exp: { label: 'billets gratuits (2 + 1)', categoryLines: [[2, 'Entree libre'], [1, 'Invitation']], numbers: NUMBERS.slice(0, 3), more: null, amount: null },
    },
    {
        type: 'TRANSFER_RECEIVED',
        data: { ...EVENT, transfer_id: '9e4b1c7a-2f5d-4a8e-b3c6-7d1e9f2a4b58', ticket_id: '5c2a8e41-9b3d-4f7a-8e16-2d4b6a9c1e73', ticket_number: NUMBERS[5], category: 'VIP' },
        exp: { label: 'billet reçu par transfert', category: 'VIP', numbers: [NUMBERS[5]], more: null, amount: null },
    },
];

function fullExpect(exp: Omit<ConfirmationExpect, 'appUrl' | 'title' | 'startAt' | 'location' | 'city'>): ConfirmationExpect {
    return { ...exp, title: String(EVENT.title), startAt: String(EVENT.start_at), location: String(EVENT.location), city: String(EVENT.city), appUrl: RENDER_URL };
}

// ── Base locale : événements, achats, transferts ───────────────────────────

const STANDARD = 'Standard';
const VIP = 'VIP';
const FREE_A = 'Entree libre';
const FREE_B = 'Invitation';
const LOCATION = 'Esplanade du Monument de la Renaissance';
const CITY = 'Ouakam';

let partner: TestPartner;
let ev: DraftEvent;
let freeEv: DraftEvent;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('confirmation-achat');
    const tag = randomBytes(2).toString('hex').toUpperCase();
    ev = await createDraftEvent(partner, 'confirmation-achat', [
        { name: STANDARD, price: 5_000, total: 60, maxPerOrder: 20 },
        { name: VIP, price: 12_000, total: 20, maxPerOrder: 10 },
    ], { title: `Confirmation ${tag}`, startsInHours: 96, location: LOCATION, city: CITY });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    freeEv = await createDraftEvent(partner, 'confirmation-gratuits', [
        { name: STANDARD, price: 5_000, total: 10 },
        { name: FREE_A, price: 0, total: 30, maxPerOrder: 5 },
        { name: FREE_B, price: 0, total: 30, maxPerOrder: 5 },
    ], { title: `Gratuits ${tag}`, startsInHours: 120, location: LOCATION, city: CITY });
    await advanceEventTo(freeEv.eventId, 'PUBLIE', { partnerUserId: partner.userId });
});

interface TicketInfo { id: string; ticket_number: string; category: string; qr_code: string | null; totp_secret: string | null }

function categoryName(event: DraftEvent, categoryId: unknown): string {
    const found = Object.entries(event.categories).find(([, c]) => c.id === categoryId);
    assert.ok(found, `catégorie ${String(categoryId)} inconnue de l'événement`);
    return found[0];
}

async function ticketsWhere(column: 'payment_id' | 'id', values: string[], event: DraftEvent): Promise<TicketInfo[]> {
    const { data, error } = await service.from('tickets').select('id, ticket_number, category_id, qr_code, totp_secret').in(column, values);
    assert.equal(error, null, `billets : ${error?.message}`);
    return (data ?? []).map((t: Row) => ({
        id: String(t.id), ticket_number: String(t.ticket_number), category: categoryName(event, t.category_id),
        qr_code: (t.qr_code as string | null) ?? null, totp_secret: (t.totp_secret as string | null) ?? null,
    }));
}

/** Ordre de D89 : catégorie, puis numéro (comparaison binaire). */
function sortTickets(tickets: TicketInfo[]): TicketInfo[] {
    const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
    return [...tickets].sort((a, b) => cmp(a.category, b.category) || cmp(a.ticket_number, b.ticket_number));
}

function categoriesOf(tickets: TicketInfo[]): Array<{ name: string; quantity: number }> {
    const counts = new Map<string, number>();
    for (const t of tickets) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    return Array.from(counts.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, quantity]) => ({ name, quantity }));
}

function secretsOf(tickets: TicketInfo[]): string[] {
    return tickets.flatMap((t) => [t.qr_code, t.totp_secret]).filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function byChannel(rows: OutboxRow[], what: string): Partial<Record<Ch, OutboxRow>> {
    const out: Partial<Record<Ch, OutboxRow>> = {};
    for (const r of rows) {
        assert.ok(!out[r.channel], `${what} : deux lignes ${r.channel}`);
        out[r.channel] = r;
    }
    return out;
}

function brief(r: OutboxRow | undefined): string {
    return r ? JSON.stringify({ channel: r.channel, status: r.status, reason: r.reason, detail: r.reason_detail }) : 'ligne absente';
}

interface Delivered { row: OutboxRow; email: { subject: string; html: string; text: string }; inApp: { title: string; content: string } | null; sms: string[] }

/** Envoie les lignes données par l'envoyeur (horloge réelle) et relève l'email, la cloche et les SMS. */
async function deliver(rows: OutboxRow[], to: Buyer, label: string, smsPhone: string | null): Promise<Delivered> {
    const ch = byChannel(rows, label);
    assert.ok(ch.EMAIL, `${label} : ligne EMAIL absente (${JSON.stringify(rows.map((r) => r.channel))})`);
    const mailMark = getMailMark(to.email);
    const smsBefore = smsPhone ? smsMark(smsPhone) : 0;
    await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
    const [email] = await outboxRows({ ids: [ch.EMAIL.id] });
    assert.equal(email.status, 'SENT', `${label} : email envoyé (${brief(email)})`);
    const got = emailsTo(to.email, mailMark);
    assert.equal(got.length, 1, `${label} : un email remis à ${to.email} (reçu ${got.length})`);
    const mail = got[0];
    let inApp: Delivered['inApp'] = null;
    if (ch.IN_APP) {
        const [done] = await outboxRows({ ids: [ch.IN_APP.id] });
        assert.equal(done.status, 'SENT', `${label} : in-app écrite (${brief(done)})`);
        assert.ok(done.notification_id, `${label} : notification_id posé`);
        const { data, error } = await service.from('notifications').select('title, content').eq('id', done.notification_id).single();
        assert.equal(error, null, `${label} : notification ${done.notification_id} : ${error?.message}`);
        inApp = { title: String(data.title), content: String(data.content) };
    }
    const sms = smsPhone ? smsTo(smsPhone, smsBefore).map((m) => m.message) : [];
    return { row: ch.EMAIL, email: { subject: mail.subject, html: mail.html, text: mail.text ?? '' }, inApp, sms };
}

function getMailMark(address: string): number {
    return emailsTo(address).length;
}

async function purchaseRows(paymentId: string): Promise<OutboxRow[]> {
    return outboxRows({ type: 'PURCHASE_CONFIRMED', keyPrefix: `PURCHASE_CONFIRMED:${paymentId}:` });
}

/** Contrôles communs d'un achat réel : instantané figé, email remis, cloche, SMS. */
async function checkRealPurchase(label: string, buyer: Buyer, items: Array<[string, number]>, expectMore: string | null): Promise<{ tickets: TicketInfo[]; delivered: Delivered }> {
    await markEmailVerified(buyer); const purchase = await buyConfirmed(buyer, ev, items); // lot 9 bis (G.49, T59) : adresse vérifiée avant l'achat
    const paymentId = String(purchase.payment.id);
    const tickets = sortTickets(await ticketsWhere('payment_id', [paymentId], ev));
    const count = items.reduce((s, [, q]) => s + q, 0);
    assert.equal(tickets.length, count, `${label} : ${count} billets émis`);
    const rows = await purchaseRows(paymentId);
    const ch = byChannel(rows, label);
    assert.ok(ch.EMAIL, `${label} : ligne EMAIL de PURCHASE_CONFIRMED (${JSON.stringify(rows.map((r) => r.channel))})`);
    const data = ch.EMAIL.template_data;
    const expectedNumbers = tickets.slice(0, 10).map((t) => t.ticket_number);
    assert.deepEqual(data.categories, categoriesOf(tickets),
        `${label} : template_data.categories figé à l'émission (D87, contrat 19.3) : ${JSON.stringify(data)}`);
    assert.deepEqual(data.ticket_numbers, expectedNumbers,
        `${label} : template_data.ticket_numbers = les 10 premiers numéros en base, ordre (catégorie, numéro) (D88, D89) : ${JSON.stringify(data)}`);
    assert.equal(Number(data.ticket_count), count, `${label} : ticket_count`);
    for (const r of rows) {
        assert.ok(!/qr_code|totp|secret|EVT1:/i.test(JSON.stringify(r.template_data)), `${label} : aucun secret dans template_data (${r.channel})`);
    }

    const delivered = await deliver(rows, buyer, label, buyer.phoneE164);
    const issues = confirmationIssues(delivered.email, {
        label, title: ev.title, startAt: String(data.start_at), location: LOCATION, city: CITY,
        categoryLines: categoriesOf(tickets).map((c) => [c.quantity, c.name] as [number, string]),
        numbers: expectedNumbers, absentNumbers: tickets.slice(10).map((t) => t.ticket_number), more: expectMore,
        amount: { total: Number(purchase.payment.amount), serviceFee: Number(data.service_fee) }, secrets: secretsOf(tickets), appUrl: APP_URL,
    });
    assert.deepEqual(issues, [], `${label} : email de confirmation :\n${issues.join('\n')}`);
    assert.equal(Number(data.total), Number(purchase.payment.amount), `${label} : template_data.total = montant du paiement`);

    // D87 : l'email remis est celui que rend le catalogue depuis le seul instantané (aucune lecture au rendu).
    const fromSnapshot = await renderEmail('PURCHASE_CONFIRMED', data, { appUrl: APP_URL });
    assert.equal(delivered.email.html, fromSnapshot.html, `${label} : email remis = rendu de template_data (D87)`);
    assert.equal(delivered.email.subject, fromSnapshot.subject, `${label} : sujet`);
    assert.equal(flat(delivered.email.subject), 'Achat confirmé — Event Village', `${label} : sujet inchangé (D94)`);

    assert.ok(delivered.inApp, `${label} : notification dans l'application`);
    const inApp = flat(delivered.inApp.content);
    for (const v of [ev.title, flat(formatDateTime(String(data.start_at))), 'Mes billets', `${count} billet`]) {
        assert.ok(inApp.includes(flat(v)), `${label} : in-app sans « ${v} » : ${delivered.inApp.content}`);
    }
    assert.deepEqual(textDefects(`${label} in-app`, delivered.inApp.content, { phrasesAllowed: false }), [], `${label} : in-app sans motif interdit`);
    assert.equal(delivered.sms.length, 1, `${label} : un SMS de confirmation`);
    const m = measureSms(delivered.sms[0]);
    assert.ok(m.gsm7 && m.segments === 1, `${label} : SMS en un segment GSM-7 (${m.septets} septets, hors alphabet ${m.outside.join(', ')}) : ${delivered.sms[0]}`);
    assert.ok(!/TCK-/.test(delivered.sms[0]), `${label} : aucun numéro de billet dans le SMS : ${delivered.sms[0]}`);
    return { tickets, delivered };
}

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch (err) {
        body = { raw: text, parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`;
}

// ── 1 à 3 : achats réels ───────────────────────────────────────────────────

describe('7.9 — confirmation d\'achat réelle : données figées à l\'émission, email remis (D87 à D89)', () => {
    test('achat de 1 billet : categories et ticket_numbers figés, email complet (titre, date de Dakar, lieu, ville, « 1 × Standard », montant, numéro, P1, P2, P3, « Voir mes billets »)', async () => {
        const buyer = await newBuyer('conf-1');
        await checkRealPurchase('achat de 1 billet', buyer, [[STANDARD, 1]], null);
    });

    test('achat de 4 billets de deux catégories (2 + 2) : lignes dans l\'ordre du nom, 4 numéros = tickets.ticket_number = ticketNumber de GET /api/tickets (D88)', async () => {
        const buyer = await newBuyer('conf-4');
        const { tickets, delivered } = await checkRealPurchase('achat de 4 billets', buyer, [[VIP, 2], [STANDARD, 2]], null);
        assert.deepEqual(categoriesOf(tickets), [{ name: STANDARD, quantity: 2 }, { name: VIP, quantity: 2 }], 'deux catégories, deux billets chacune');
        const { GET } = await importModule('../../app/api/tickets/route') as { GET: Handler };
        const res = await invoke(GET, authed('/api/tickets', 'GET', buyer));
        assert.equal(res.status, 200, `GET /api/tickets : ${show(res)}`);
        const listed = ((res.body.tickets ?? []) as Row[]).map((t) => String(t.ticketNumber)).sort();
        assert.deepEqual(listed, tickets.map((t) => t.ticket_number).sort(), 'numéros de Mes billets = numéros de l\'email (même valeur, D88)');
        const text = flat(delivered.email.text);
        for (const n of listed) assert.ok(text.includes(n), `numéro de Mes billets ${n} présent dans l'email`);
    });

    test('achat de 12 billets : exactement les 10 premiers numéros dans l\'ordre, « et 2 autres », les 2 derniers absents, ticket_count = 12', async () => {
        const buyer = await newBuyer('conf-12');
        const { tickets, delivered } = await checkRealPurchase('achat de 12 billets', buyer, [[STANDARD, 12]], 'et 2 autres');
        assert.equal(Number(delivered.row.template_data.ticket_count), 12, 'ticket_count = 12');
        assert.equal((delivered.row.template_data.ticket_numbers as unknown[]).length, 10, 'dix numéros stockés seulement (D89)');
        const text = flat(delivered.email.text);
        const shown = tickets.filter((t) => text.includes(t.ticket_number)).map((t) => t.ticket_number);
        assert.deepEqual(shown, tickets.slice(0, 10).map((t) => t.ticket_number), 'version texte : exactement les 10 premiers numéros');
    });
});

// ── 4 : billets gratuits réels ─────────────────────────────────────────────

describe('7.9 — billets gratuits (FREE_TICKETS_CONFIRMED) : mêmes blocs, aucun montant', () => {
    test('2 « Entree libre » + 1 « Invitation » : catégories et numéros figés, email complet sans montant (texte et HTML), in-app « Vos billets sont dans Mes billets. »', async () => {
        const guest = await newBuyer('conf-gratuit');
        await markEmailVerified(guest); // lot 9 bis (G.49, T59) : seule une adresse vérifiée reçoit un email
        const { data: claimed, error } = await service.rpc('free_tickets_claim', {
            p_user_id: guest.userId, p_event_id: freeEv.eventId,
            p_items: [{ category_id: freeEv.categories[FREE_B].id, quantity: 1 }, { category_id: freeEv.categories[FREE_A].id, quantity: 2 }],
        });
        assert.equal(error, null, `free_tickets_claim : ${error?.message}`);
        assert.ok(claimed && (claimed as Row).ok === true, `billets gratuits : ${JSON.stringify(claimed)}`);
        const ids = ((claimed as Row).ticket_ids as string[]).map(String);
        assert.equal(ids.length, 3, 'trois billets gratuits');
        const tickets = sortTickets(await ticketsWhere('id', ids, freeEv));
        const first = [...ids].sort()[0];
        const rows = await outboxRows({ type: 'FREE_TICKETS_CONFIRMED', keyPrefix: `FREE_TICKETS_CONFIRMED:${first}:` });
        const ch = byChannel(rows, 'billets gratuits');
        assert.ok(ch.EMAIL, `ligne EMAIL de FREE_TICKETS_CONFIRMED (${JSON.stringify(rows.map((r) => r.channel))})`);
        const data = ch.EMAIL.template_data;
        assert.deepEqual(data.categories, [{ name: FREE_A, quantity: 2 }, { name: FREE_B, quantity: 1 }], `categories figées, ordre du nom : ${JSON.stringify(data)}`);
        assert.deepEqual(data.ticket_numbers, tickets.map((t) => t.ticket_number), `ticket_numbers, ordre (catégorie, numéro) : ${JSON.stringify(data)}`);
        assert.equal(Number(data.ticket_count), 3, 'ticket_count');

        const delivered = await deliver(rows, guest, 'billets gratuits', null);
        const issues = confirmationIssues(delivered.email, {
            label: 'billets gratuits', title: freeEv.title, startAt: String(data.start_at), location: LOCATION, city: CITY,
            categoryLines: [[2, FREE_A], [1, FREE_B]], numbers: tickets.map((t) => t.ticket_number), more: null, amount: null,
            secrets: secretsOf(tickets), appUrl: APP_URL,
        });
        assert.deepEqual(issues, [], `email des billets gratuits :\n${issues.join('\n')}`);
        assert.ok(delivered.inApp, 'notification dans l\'application');
        const content = flat(delivered.inApp.content);
        assert.ok(content.includes(freeEv.title) && content.includes(flat(formatDateTime(String(data.start_at)))) && content.includes('3 billets gratuits'),
            `in-app : événement, date, nombre de billets : ${delivered.inApp.content}`);
        assert.ok(content.endsWith('Vos billets sont dans Mes billets.'), `in-app complété par « Vos billets sont dans Mes billets. » (D94) : ${delivered.inApp.content}`);
    });
});

// ── 5 : billet reçu par transfert ──────────────────────────────────────────

describe('7.9 — billet reçu par transfert (TRANSFER_RECEIVED, D88, D91)', () => {
    test('acceptation : ligne EMAIL créée, template_data.ticket_number = NOUVEAU numéro et catégorie ; email avec catégorie, numéro, P1, P2, P3, sans montant ; in-app avec le numéro', async () => {
        const owner = await newBuyer('conf-transf-exp');
        const to = await newBuyer('conf-transf-dest', { firstName: 'Fatou', lastName: 'Ndiaye' });
        await markEmailVerified(to); // lot 9 bis (G.49, T59) : seule une adresse vérifiée reçoit un email
        await markPhoneVerified(to.userId);
        const { tickets } = await buyConfirmed(owner, ev, [[VIP, 1]]);
        const ticketId = String(tickets[0].id);
        const before0 = await ticketRow(ticketId);

        const transferRoute = await importModule('../../app/api/tickets/[id]/transfer/route') as { POST: Handler };
        await confirmPassword(owner, STRONG_PASSWORD); const init = await invoke(transferRoute.POST, authed(`/api/tickets/${ticketId}/transfer`, 'POST', owner, { recipient: to.phoneE164 }), routeContext({ id: ticketId }));
        assert.equal(init.status, 200, `initiation du transfert : ${show(init)}`);
        const transferId = String((init.body.transfer as Row | undefined)?.transfer_id ?? '');
        assert.ok(transferId, `identifiant du transfert : ${show(init)}`);
        const claimRoute = await importModule('../../app/api/tickets/transfers/[id]/claim/route') as { POST: Handler };
        const claim = await invoke(claimRoute.POST, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', to), routeContext({ id: transferId }));
        assert.equal(claim.status, 200, `acceptation : ${show(claim)}`);
        const afterT = await ticketRow(ticketId);
        const newNumber = String(afterT.ticket_number);
        assert.notEqual(newNumber, String(before0.ticket_number), 'numéro renouvelé par le transfert');

        const rows = await outboxRows({ type: 'TRANSFER_RECEIVED', keyPrefix: `TRANSFER_RECEIVED:${transferId}:` });
        assert.deepEqual(rows.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH'], `canaux du destinataire (EMAIL ajouté, D91) : ${JSON.stringify(rows.map((r) => r.channel))}`);
        const ch = byChannel(rows, 'billet reçu');
        const data = ch.EMAIL!.template_data;
        assert.equal(data.ticket_number, newNumber, `template_data.ticket_number = nouveau numéro (D88) : ${JSON.stringify(data)}`);
        assert.equal(data.category, VIP, `template_data.category : ${JSON.stringify(data)}`);
        assert.ok(ch.EMAIL!.recipient_user_id === to.userId, 'email adressé au compte destinataire');

        const delivered = await deliver(rows, to, 'billet reçu', null);
        const issues = confirmationIssues(delivered.email, {
            label: 'billet reçu', title: ev.title, startAt: String(data.start_at), location: LOCATION, city: CITY, category: VIP,
            numbers: [newNumber], absentNumbers: [String(before0.ticket_number)], more: null, amount: null,
            secrets: [afterT.qr_code, afterT.totp_secret, before0.qr_code, before0.totp_secret].filter((v): v is string => typeof v === 'string'),
            appUrl: APP_URL,
        });
        assert.deepEqual(issues, [], `email du billet reçu :\n${issues.join('\n')}`);
        assert.ok(!/prix|montant/i.test(flat(delivered.email.text)), `aucun montant ni prix (D91) : ${delivered.email.text}`);
        assert.ok(delivered.inApp, 'notification dans l\'application');
        const content = flat(delivered.inApp.content);
        assert.ok(content.includes(newNumber) && content.includes(ev.title) && content.includes(flat(formatDateTime(String(data.start_at)))),
            `in-app : numéro, événement et date (D94) : ${delivered.inApp.content}`);
        assert.ok(content.includes('Mes billets'), `in-app : lien vers Mes billets : ${delivered.inApp.content}`);
    });
});

// ── 6 et 7 : rendus du catalogue ───────────────────────────────────────────

describe('7.9 — rendus du catalogue : contenu, motifs interdits, phrases exactes (contrat 19.4)', () => {
    for (const c of RENDER_CASES) {
        test(`${c.type} — ${c.exp.label} : blocs attendus, aucun QR, code, secret ni lien de réclamation`, async () => {
            const mail = await renderEmail(c.type, c.data);
            const issues = confirmationIssues(mail, fullExpect(c.exp));
            assert.deepEqual(issues, [], `${c.exp.label} :\n${issues.join('\n')}`);
        });
    }

    test('phrases P1, P2, P3 à l\'identique dans la version texte et dans le HTML décodé, pour les trois types', async () => {
        const issues: string[] = [];
        for (const c of [RENDER_CASES[0], RENDER_CASES[4], RENDER_CASES[5]]) {
            const mail = await renderEmail(c.type, c.data);
            const text = flat(mail.text);
            const html = flat(decodeEntities(mail.html.replace(/<[^>]+>/g, '')));
            for (const p of PHRASES) {
                if (!text.includes(p)) issues.push(`${c.type} : version texte sans « ${p} »`);
                if (!html.includes(p)) issues.push(`${c.type} : HTML (entités décodées) sans « ${p} »`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('in-app, push et SMS des trois types : aucun motif interdit, aucun « QR », aucun numéro dans le SMS', async () => {
        const render = await renderer();
        const issues: string[] = [];
        const channels: Record<string, Ch[]> = { PURCHASE_CONFIRMED: ['IN_APP', 'SMS'], FREE_TICKETS_CONFIRMED: ['IN_APP', 'SMS'], TRANSFER_RECEIVED: ['IN_APP', 'PUSH'] };
        for (const c of RENDER_CASES) {
            for (const channel of channels[c.type]) {
                const r = render(c.type, channel, c.data, CTX);
                const values = r.channel === 'IN_APP' ? [r.title, r.content] : r.channel === 'PUSH' ? [r.title, r.body] : r.channel === 'SMS' ? [r.text] : [];
                for (const v of values) issues.push(...textDefects(`${c.type} ${channel} (${c.exp.label})`, v, { phrasesAllowed: false }));
                if (r.channel === 'SMS' && /TCK-/.test(r.text)) issues.push(`${c.type} SMS : numéro de billet présent — ${r.text}`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });
});

// ── 8 : SMS en un segment GSM-7 ────────────────────────────────────────────

describe('7.9 — SMS des confirmations : un segment GSM-7 au pire cas (calcul GSM 03.38 du test, D95)', () => {
    const longTitle = 'Festival des musiques urbaines de Dakar edition speciale 2026';
    const accented = 'Grande soirée « Ndëkk » – l’été à Saly : édition très spéciale…';

    test('PURCHASE_CONFIRMED (titre de 60 caractères, 999 billets, frais 999 999, total 9 999 999) et FREE_TICKETS_CONFIRMED (999 billets) : ≤ 160 septets, sans numéro ni mention', async () => {
        const title60 = longTitle.slice(0, 60);
        assert.equal(title60.length, 60, 'titre de 60 caractères');
        const issues: string[] = [];
        const cases: Array<[string, Row]> = [];
        for (const title of [title60, accented]) {
            cases.push(['PURCHASE_CONFIRMED', purchaseData({
                title, start_at: '2026-09-30T20:00:00.000Z', ticket_count: 999, service_fee: 999_999, total: 9_999_999,
                categories: [{ name: 'Standard', quantity: 999 }], ticket_numbers: NUMBERS.slice(0, 10),
            })]);
            cases.push(['FREE_TICKETS_CONFIRMED', {
                ...EVENT, title, start_at: '2026-09-30T20:00:00.000Z', ticket_count: 999, ticket_id: '5c2a8e41-9b3d-4f7a-8e16-2d4b6a9c1e73',
                categories: [{ name: 'Entree libre', quantity: 999 }], ticket_numbers: NUMBERS.slice(0, 10),
            }]);
        }
        for (const [type, data] of cases) {
            const sms = await renderSms(type, data);
            const m = measureSms(sms);
            const withMention = measureSms(`${sms} ${SMS_MENTION}`);
            console.log(`[7.9 SMS] ${type} (${String(data.title).slice(0, 20)}…) : ${m.septets} septets, ${m.segments} segment(s) ; avec « ${SMS_MENTION} » : ${withMention.septets} septets, ${withMention.segments} segment(s)`);
            if (!m.gsm7) issues.push(`${type} : caractères hors GSM-7 ${m.outside.join(', ')} — ${sms}`);
            else if (m.septets > 160) issues.push(`${type} : ${m.septets} septets > 160 (2 segments) — ${sms}`);
            if (/TCK-/.test(sms)) issues.push(`${type} : numéro de billet dans le SMS — ${sms}`);
            if (/Billets dans l'appli/i.test(sms)) issues.push(`${type} : mention « Billets dans l'appli » ajoutée malgré D95 — ${sms}`);
            if (!sms.includes(`${RENDER_URL}/tickets`)) issues.push(`${type} : lien vers Mes billets absent — ${sms}`);
        }
        assert.deepEqual(issues, [], `SMS des confirmations :\n${issues.join('\n')}`);
    });
});

// ── 9 : thème sombre et contrastes ─────────────────────────────────────────

/** Contenu du bloc `@media (prefers-color-scheme: dark) { … }` (accolades équilibrées), null s'il manque. */
function darkBlock(html: string): string | null {
    const at = html.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i);
    if (at < 0) return null;
    const open = html.indexOf('{', at);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < html.length; i++) {
        if (html[i] === '{') depth += 1;
        else if (html[i] === '}') {
            depth -= 1;
            if (depth === 0) return html.slice(open + 1, i);
        }
    }
    return null;
}

interface ClassColors { color: Set<string>; bg: Set<string> }

function addDecl(map: Map<string, ClassColors>, cls: string, decls: string): void {
    const entry = map.get(cls) ?? { color: new Set<string>(), bg: new Set<string>() };
    for (const d of decls.split(';')) {
        const [prop, ...rest] = d.split(':');
        const value = rest.join(':');
        const hex = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.exec(value)?.[0];
        if (!hex || !prop) continue;
        const p = prop.trim().toLowerCase();
        if (p === 'color') entry.color.add(hex.toUpperCase());
        else if (p === 'background' || p === 'background-color') entry.bg.add(hex.toUpperCase());
    }
    map.set(cls, entry);
}

/** Couleurs du bloc sombre par classe ev-* (dernière classe de chaque sélecteur). */
function darkColors(css: string): Map<string, ClassColors> {
    const map = new Map<string, ClassColors>();
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(css)) !== null) {
        for (const sel of m[1].split(',')) {
            const classes = sel.match(/\.ev-[a-z-]+/g);
            if (classes) addDecl(map, classes[classes.length - 1].slice(1), m[2]);
        }
    }
    return map;
}

/** Couleurs en ligne (thème clair) des éléments portant une classe ev-*. */
function lightColors(html: string): { byClass: Map<string, ClassColors>; sameElement: Array<[string, string, string]> } {
    const byClass = new Map<string, ClassColors>();
    const sameElement: Array<[string, string, string]> = [];
    const tagRe = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(html)) !== null) {
        const attrs = m[2];
        const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';
        const classes = (/\sclass\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '').split(/\s+/).filter((c) => c.startsWith('ev-'));
        for (const c of classes) addDecl(byClass, c, style);
        const one = new Map<string, ClassColors>();
        addDecl(one, 'x', style);
        const x = one.get('x')!;
        for (const fg of Array.from(x.color)) for (const bg of Array.from(x.bg)) sameElement.push([m[1], fg, bg]);
    }
    return { byClass, sameElement };
}

/** Paires texte / fond du contrat 19.5 (texte, secondaire, lien sur la carte ; texte de l'encadré sur son fond). */
function pairIssues(theme: string, map: Map<string, ClassColors>): string[] {
    const issues: string[] = [];
    const need = (cls: string, kind: 'color' | 'bg'): string[] => {
        const v = Array.from(map.get(cls)?.[kind] ?? []);
        if (v.length === 0) issues.push(`${theme} : classe ${cls} sans ${kind === 'color' ? 'couleur de texte' : 'fond'} déclaré`);
        return v;
    };
    const card = need('ev-card', 'bg');
    need('ev-bg', 'bg');
    const text = need('ev-text', 'color');
    const pairs: Array<[string, string[], string[]]> = [
        ['texte sur la carte', text, card],
        ['secondaire sur la carte', need('ev-muted', 'color'), card],
        ['lien sur la carte', need('ev-link', 'color'), card],
    ];
    const noticeBg = need('ev-notice', 'bg');
    const noticeText = Array.from(map.get('ev-notice')?.color ?? []);
    pairs.push(['texte de l\'encadré sur son fond', noticeText.length > 0 ? noticeText : text, noticeBg]);
    for (const [what, fgs, bgs] of pairs) {
        for (const fg of fgs) for (const bg of bgs) {
            const r = contrast(fg, bg);
            if (r < 4.5) issues.push(`${theme} : ${what} ${fg} / ${bg} = ${r.toFixed(2)}:1 < 4,5:1`);
        }
    }
    return issues;
}

describe('7.9 — thème sombre de l\'email et contrastes (D92, contrat 19.5)', () => {
    for (const c of [RENDER_CASES[1], RENDER_CASES[4], RENDER_CASES[5]]) {
        test(`${c.type} : meta color-scheme, bloc prefers-color-scheme: dark, chaque paire du clair et du sombre ≥ 4,5:1`, async () => {
            const { html } = await renderEmail(c.type, c.data);
            assert.match(html, /<meta[^>]+name="color-scheme"[^>]+content="[^"]*dark[^"]*"/i, 'meta color-scheme « light dark »');
            assert.match(html, /prefers-color-scheme\s*:\s*dark/i, 'bloc @media (prefers-color-scheme: dark)');
            const css = darkBlock(html);
            assert.ok(css, 'bloc sombre lisible (accolades équilibrées)');
            const issues = [...pairIssues('sombre', darkColors(css)), ...pairIssues('clair', lightColors(html).byClass)];
            for (const [tag, fg, bg] of lightColors(html).sameElement) {
                const r = contrast(fg, bg);
                if (r < 4.5) issues.push(`clair : <${tag}> texte ${fg} sur ${bg} = ${r.toFixed(2)}:1 < 4,5:1`);
            }
            assert.deepEqual(issues, [], `contrastes :\n${issues.join('\n')}`);
        });
    }
});

// ── 10 : ligne d'avant la migration (D90) ──────────────────────────────────

describe('7.9 — ligne mise en file avant la migration 07 (sans categories ni ticket_numbers, D90)', () => {
    const oldPurchase = purchaseData({ ticket_count: 2, service_fee: 100, total: 10_100 });
    const oldFree: Row = { ...EVENT, ticket_count: 2, ticket_id: '5c2a8e41-9b3d-4f7a-8e16-2d4b6a9c1e73' };

    test('(garde-fou, vert dès l\'écriture) PURCHASE_CONFIRMED et FREE_TICKETS_CONFIRMED se rendent sur tous leurs canaux sans erreur ni valeur JS affichée', async () => {
        const render = await renderer();
        const issues: string[] = [];
        for (const [type, data] of [['PURCHASE_CONFIRMED', oldPurchase], ['FREE_TICKETS_CONFIRMED', oldFree]] as Array<[string, Row]>) {
            for (const channel of ['IN_APP', 'SMS', 'EMAIL'] as Ch[]) {
                let out: Rendered;
                try {
                    out = render(type, channel, data, CTX);
                } catch (err) {
                    issues.push(`${type} ${channel} : ${(err as Error).message}`);
                    continue;
                }
                const all = JSON.stringify(out);
                if (/\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/.test(all)) issues.push(`${type} ${channel} : valeur JS affichée — ${all.slice(0, 300)}`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('mêmes lignes, et TRANSFER_RECEIVED sans ticket_number : phrases P1, P2, P3 et « Voir mes billets » présents, aucune liste vide', async () => {
        const issues: string[] = [];
        const oldTransfer: Row = { ...EVENT, transfer_id: '9e4b1c7a-2f5d-4a8e-b3c6-7d1e9f2a4b58', ticket_id: '5c2a8e41-9b3d-4f7a-8e16-2d4b6a9c1e73' };
        for (const [type, data] of [['PURCHASE_CONFIRMED', oldPurchase], ['FREE_TICKETS_CONFIRMED', oldFree], ['TRANSFER_RECEIVED', oldTransfer]] as Array<[string, Row]>) {
            let mail: { html: string; text: string };
            try {
                mail = await renderEmail(type, data);
            } catch (err) {
                issues.push(`${type} : rendu EMAIL impossible — ${(err as Error).message}`);
                continue;
            }
            const text = flat(mail.text);
            const html = flat(visibleText(mail.html));
            for (const p of PHRASES) {
                if (!text.includes(p)) issues.push(`${type} : version texte sans « ${p} »`);
                if (!html.includes(p)) issues.push(`${type} : HTML sans « ${p} »`);
            }
            if (!html.includes(BUTTON)) issues.push(`${type} : bouton « ${BUTTON} » absent`);
            if (/TCK-|et \d+ autres?/.test(text)) issues.push(`${type} : liste de numéros sans données — ${text.slice(0, 300)}`);
        }
        const inApp = await renderInApp('TRANSFER_RECEIVED', oldTransfer);
        assert.equal(flat(inApp.content), 'Le billet pour « Gala de la Teranga » est ajouté à vos billets.', 'in-app de TRANSFER_RECEIVED sans numéro : texte du lot 6 (contrat 19.4)');
        assert.deepEqual(issues, [], issues.join('\n'));
    });
});

// ── 11 : migration 07 ──────────────────────────────────────────────────────

describe('7.9 — migration 20261105000007 : notif_ticket_lines et fonctions émettrices (contrat 19.3)', () => {
    test('notif_ticket_lines(uuid[]) : SECURITY DEFINER, STABLE, search_path = public, exécutable par le seul service_role', async () => {
        const rows = await inspect(async (db) => (await db.query<Row>(
            `SELECT p.prosecdef, p.provolatile, pg_get_function_identity_arguments(p.oid) AS args, p.proconfig,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
                    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'notif_ticket_lines'`)).rows);
        assert.equal(rows.length, 1, `public.notif_ticket_lines absente ou surchargée (${rows.length} définition(s)) — migration 20261105000007`);
        const f = rows[0];
        assert.equal(f.args, 'p_ticket_ids uuid[]', 'signature (p_ticket_ids uuid[])');
        assert.equal(f.prosecdef, true, 'SECURITY DEFINER');
        assert.equal(f.provolatile, 's', 'STABLE');
        assert.ok(((f.proconfig as string[] | null) ?? []).some((c) => /^search_path=public$/.test(c)), `SET search_path = public : ${JSON.stringify(f.proconfig)}`);
        assert.deepEqual({ anon: f.anon, authenticated: f.authenticated, service_role: f.service_role }, { anon: false, authenticated: false, service_role: true }, 'privilèges : service_role seul');
    });

    test('payment_confirm et free_tickets_claim appellent notif_ticket_lines ; ticket_transfer_accept écrit la catégorie et garde le verrou FOR SHARE (M3) ; registre TRANSFER_RECEIVED avec EMAIL', async () => {
        const { defs, channels } = await inspect(async (db) => {
            const d = (await db.query<{ proname: string; def: string }>(
                `SELECT p.proname, pg_get_functiondef(p.oid) AS def
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname IN ('payment_confirm', 'free_tickets_claim', 'ticket_transfer_accept')`)).rows;
            const c = (await db.query<{ channels: string[] }>(`SELECT channels FROM public.notification_types WHERE type = 'TRANSFER_RECEIVED'`)).rows;
            return { defs: d, channels: c };
        });
        const defOf = (name: string): string => {
            const found = defs.filter((d) => d.proname === name);
            assert.equal(found.length, 1, `public.${name} : une seule définition attendue (${found.length})`);
            return found[0].def;
        };
        assert.match(defOf('payment_confirm'), /notif_ticket_lines\s*\(/, 'payment_confirm : data de PURCHASE_CONFIRMED par notif_ticket_lines (19.3.2)');
        assert.match(defOf('free_tickets_claim'), /notif_ticket_lines\s*\(/, 'free_tickets_claim : data de FREE_TICKETS_CONFIRMED par notif_ticket_lines (19.3.3)');
        const accept = defOf('ticket_transfer_accept');
        assert.match(accept, /'category'\s*,/, 'ticket_transfer_accept : catégorie dans les données de TRANSFER_RECEIVED (19.3.4)');
        assert.match(accept, /FOR\s+SHARE/i, 'ticket_transfer_accept : verrou FOR SHARE de M3 conservé (D97)');
        assert.equal(channels.length, 1, 'type TRANSFER_RECEIVED au registre');
        assert.deepEqual([...channels[0].channels].sort(), ['EMAIL', 'IN_APP', 'PUSH'], 'registre : TRANSFER_RECEIVED avec EMAIL (19.3.5)');
    });
});

// ── 8.2 v : GET /api/tickets après compostage (cas T13 porté) ──────────────

describe('8.2 v — GET /api/tickets : billet composté (cas T13 porté)', () => {
    test('billet scanné : UTILISE, isUpcoming = false, usedAt = date du compostage ; billet voisin : VALIDE, isUpcoming = true, usedAt null', async () => {
        const organizer = await newPartner('conf-compostage');
        const ev = await createTimedEvent(organizer.partnerId, 'conf-compostage', [{ name: 'Standard', price: 3000, total: 10 }]);
        const buyer = await newBuyer('conf-compostage');
        const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 2]]);
        assert.equal(tickets.length, 2, 'deux billets émis');
        const [usedId, freshId] = tickets.map((t) => String(t.id));
        const entry = await scan(organizer, { eventId: ev.eventId, payload: await ticketPayload(usedId) });
        assert.equal(entry.body.result, 'valid', `compostage : ${show(entry)}`);
        const checkedIn = (await ticketRow(usedId)).checked_in_at;
        assert.ok(checkedIn, 'précondition : checked_in_at renseigné');

        const { GET } = await importModule('../../app/api/tickets/route') as { GET: Handler };
        const res = await invoke(GET, authed('/api/tickets', 'GET', buyer));
        assert.equal(res.status, 200, `GET /api/tickets : ${show(res)}`);
        const listed = (res.body.tickets ?? []) as Row[];
        const used = listed.find((t) => t.id === usedId);
        assert.ok(used, 'billet composté présent dans la liste');
        assert.deepEqual({ status: used.status, isUpcoming: used.isUpcoming }, { status: 'UTILISE', isUpcoming: false }, `billet composté : ${JSON.stringify(used).slice(0, 300)}`);
        assert.equal(Date.parse(String(used.usedAt)), Date.parse(String(checkedIn)), 'usedAt = date du compostage');
        const fresh = listed.find((t) => t.id === freshId);
        assert.ok(fresh, 'billet voisin présent dans la liste');
        assert.deepEqual({ status: fresh.status, isUpcoming: fresh.isUpcoming, usedAt: fresh.usedAt }, { status: 'VALIDE', isUpcoming: true, usedAt: null }, `billet voisin : ${JSON.stringify(fresh).slice(0, 300)}`);
    });
});

// Garde-fou : les données d'exemple sont cohérentes (sinon les cas de rendu seraient trompeurs).
assert.equal(new Set(NUMBERS).size, NUMBERS.length, 'numéros d\'exemple distincts');
assert.deepEqual([...NUMBERS].sort(), NUMBERS, 'numéros d\'exemple dans l\'ordre binaire');
assert.ok(NUMBERS.every((n) => /^TCK-\d{8}-[0-9A-F]{10}$/.test(n)), 'numéros d\'exemple au format réel');

/**
 * Lot 9 bis (G.49, B96, T59) : un message n'est envoyé par email qu'à une adresse vérifiée (users.email_verified_at, M10).
 * L'acheteur de test a une adresse réelle saisie à la création du compte : elle est marquée vérifiée avant l'action.
 */
async function markEmailVerified(user: Buyer): Promise<void> {
    const { data, error } = await service.from('users').update({ email_verified_at: new Date().toISOString() }).eq('id', user.userId).select('id');
    assert.equal(error, null, `adresse vérifiée de ${user.email} : ${error?.message} (colonne users.email_verified_at, migration M10 du lot 9 bis)`);
    assert.equal((data ?? []).length, 1, `compte ${user.userId} introuvable`);
}
