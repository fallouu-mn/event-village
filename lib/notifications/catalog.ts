/**
 * Lot 6 (contrat G1 à G4) — catalogue UNIQUE des modèles de notification.
 *
 * Seul endroit du code où vivent les textes envoyés : titre et contenu in-app, SMS, push, email et lien
 * interne de chaque type. Le registre SQL `public.notification_types` (migration 20261103000002) porte
 * les mêmes attributs de routage (famille, sujet, canaux, audience, politique « compte suspendu »,
 * journal synchrone, permission admin) : un test impose l'égalité des deux listes (notif-modeles).
 *
 * Règles :
 *  - in-app, push, email : variables NON tronquées, dates et montants de lib/format.ts (heure de Dakar,
 *    insécable U+00A0) ; push = titre in-app et contenu in-app tronqué à 160 caractères ; email = sujet
 *    « {titre} — Event Village », contenu in-app échappé, bouton « Ouvrir Event Village », pied de
 *    désabonnement pour les seules familles optionnelles ; lot 7 (7.9, D93) : PURCHASE_CONFIRMED,
 *    FREE_TICKETS_CONFIRMED et TRANSFER_RECEIVED ajoutent leurs blocs (faits, numéros figés à l'émission,
 *    phrases obligatoires) et le bouton « Voir mes billets » ;
 *  - SMS : préfixe « Event Village : », texte fixe en GSM-7 de base, variables saisies par smsVar
 *    (translittérées, tronquées), dates et montants de sms-format.ts : un SMS GSM-7 (≤ 160) avec les
 *    valeurs maximales réalistes et une URL de 27 caractères (contrat G3) ; lien = NEXT_PUBLIC_APP_URL +
 *    chemin interne, jamais de raccourcisseur, de jeton, de QR ni de code ;
 *  - aucun emoji, aucun code technique affiché (opérateurs, statuts et motifs ont un libellé humain) ;
 *  - une variable obligatoire absente ou illisible lève TemplateDataError (→ FAILED TEMPLATE_ERROR).
 *
 * OTP et invitation d'un contrôleur (types `syncOnly`) : textes rendus par renderSyncSms au moment de
 * l'envoi synchrone ; le code n'est jamais stocké ni passé par le catalogue des données.
 */
import { formatDate, formatDateTime, formatFcfa, formatInteger, formatTime } from '@/lib/format';
import { internalActionUrl } from './action-url';
import type {
    AdminPermission, Audience, Channel, Family, NotificationType, SuspendedPolicy, SyncType, TemplateData, Topic,
} from './catalog-types';
import { emailHeaders, emailLayout, type EmailFact, type EmailList } from './email-layout';
import { smsAmount, smsDateTime, smsSegments, smsShortDateTime, smsTime, smsVar, type SmsMeasure } from './sms-format';

export type { Channel, NotificationType, SyncType, TemplateData } from './catalog-types';

// ── Erreur de données ──────────────────────────────────────────────────────

/** Variable obligatoire absente ou illisible : la ligne de la boîte d'envoi passe FAILED TEMPLATE_ERROR. */
export class TemplateDataError extends Error {
    constructor(public readonly variable: string, detail?: string) {
        super(`Donnée du modèle « ${variable} » ${detail ?? 'absente ou illisible'}`);
        this.name = 'TemplateDataError';
    }
}

// ── Lecture des données ────────────────────────────────────────────────────

type Data = Record<string, unknown>;

function field(d: object, key: string): unknown {
    return (d as Data)[key];
}

/** Texte obligatoire, non vide. */
function text(d: object, key: string): string {
    const v = field(d, key);
    if (typeof v !== 'string' || v.trim() === '') throw new TemplateDataError(key);
    return v.trim();
}

/** Texte facultatif : null si absent ou vide ; une valeur non textuelle est une erreur. */
function optText(d: object, key: string): string | null {
    const v = field(d, key);
    if (v === undefined || v === null) return null;
    if (typeof v !== 'string') throw new TemplateDataError(key, 'n’est pas un texte');
    const t = v.trim();
    return t === '' ? null : t;
}

/** Nombre obligatoire (un nombre JSON, ou un texte numérique venu d'une colonne numeric). */
function num(d: object, key: string): number {
    const v = field(d, key);
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
    if (!Number.isFinite(n)) throw new TemplateDataError(key);
    return n;
}

function optNum(d: object, key: string): number | null {
    const v = field(d, key);
    if (v === undefined || v === null) return null;
    return num(d, key);
}

/** Entier positif obligatoire (nombre de billets, de jours). */
function count(d: object, key: string): number {
    const n = num(d, key);
    if (!Number.isInteger(n) || n < 0) throw new TemplateDataError(key, 'n’est pas un entier positif');
    return n;
}

/** Horodatage ISO 8601 (ou date « AAAA-MM-JJ ») obligatoire et lisible. */
function iso(d: object, key: string): string {
    const v = text(d, key);
    if (Number.isNaN(new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v).getTime())) throw new TemplateDataError(key, 'n’est pas une date lisible');
    return v;
}

function optIso(d: object, key: string): string | null {
    const v = field(d, key);
    if (v === undefined || v === null || v === '') return null;
    return iso(d, key);
}

function bool(d: object, key: string): boolean {
    const v = field(d, key);
    if (typeof v !== 'boolean') throw new TemplateDataError(key, 'n’est pas un booléen');
    return v;
}

/** Identifiant d'objet utilisé dans un lien (uuid ou identifiant court) : jamais de caractère de chemin. */
function ident(d: object, key: string): string {
    const v = text(d, key);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw new TemplateDataError(key, 'n’est pas un identifiant');
    return v;
}

function list(d: object, key: string): unknown[] {
    const v = field(d, key);
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) throw new TemplateDataError(key, 'n’est pas une liste');
    return v;
}

function strings(d: object, key: string): string[] {
    const v = field(d, key);
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new TemplateDataError(key, 'n’est pas une liste de noms');
    return v as string[];
}

// ── Formats partagés ───────────────────────────────────────────────────────

const NBSP = ' ';
const q = (value: string): string => `«${NBSP}${value}${NBSP}»`;
const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

/** Phrase terminée par un point (sauf ponctuation finale déjà présente). */
function sentence(value: string): string {
    const t = value.trim();
    return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/** Valeur saisie pour un SMS, sans ponctuation finale (le modèle ajoute la sienne). */
function smsClause(value: string, max: number): string {
    return smsVar(value.trim().replace(/[\s.!?…]+$/, ''), max);
}

/** « ... » final déjà présent après troncature : pas de point en plus. */
function endWithPeriod(value: string): string {
    return value.endsWith('...') ? value : `${value}.`;
}

const OPERATOR_LABELS: Readonly<Record<string, string>> = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', WAVE_SN: 'Wave', OM: 'Orange Money' };

/** Libellé de l'opérateur Mobile Money (jamais le code). */
export function operatorLabel(value: unknown): string {
    if (typeof value !== 'string') return 'Mobile Money';
    const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    return OPERATOR_LABELS[key] ?? 'Mobile Money';
}

const SMS_PREFIX = 'Event Village : ';
const appLink = (ctx: RenderContext, path: string): string => `${ctx.appUrl.replace(/\/+$/, '')}${path}`;

function money(d: object, key: string): string {
    return formatFcfa(num(d, key));
}

function signedFcfa(n: number): string {
    return `${n > 0 ? '+' : n < 0 ? '-' : ''}${formatFcfa(Math.abs(n))}`;
}

function signedSmsAmount(n: number): string {
    return `${n > 0 ? '+' : n < 0 ? '-' : ''}${smsAmount(Math.abs(n))}`;
}

const START_FIELDS = new Set(['start_date', 'start_time', 'start_at']);
const END_FIELDS = new Set(['end_date', 'end_time', 'end_at']);
const PLACE_FIELDS = new Set(['location', 'address', 'city']);

const BLOCKED_REASON_LABELS: Readonly<Record<string, string>> = {
    OPERATOR_UNKNOWN: 'opérateur du paiement inconnu',
    PHONE_UNKNOWN: 'numéro du payeur inconnu',
    NAME_UNKNOWN: 'nom du bénéficiaire incomplet',
    SOLDE_INSUFFISANT: 'solde du compte partenaire SamirPay insuffisant',
    SIMULATED: 'opération créée en mode simulé : aucun versement',
};

/** Motif de blocage d'un versement : libellé humain pour un code, texte libre gardé tel quel. */
function blockedReasonLabel(value: string): string {
    if (BLOCKED_REASON_LABELS[value]) return BLOCKED_REASON_LABELS[value];
    return /^[A-Z][A-Z0-9_]*$/.test(value) ? 'informations du bénéficiaire incomplètes' : value;
}

// ── Modèle ─────────────────────────────────────────────────────────────────

export interface RenderContext {
    /** NEXT_PUBLIC_APP_URL, sans « / » final. */
    appUrl: string;
}

export interface NotificationTemplate<D> {
    type: NotificationType;
    /** Nom humain du type (supervision admin, alerte d'envoi en échec). */
    label: string;
    family: Family;
    topic: Topic | null;
    channels: readonly Channel[];
    audience: Audience;
    suspendedPolicy: SuspendedPolicy;
    syncOnly: boolean;
    adminPermission: AdminPermission | null;
    /** Valeur de notifications.type (libellé dans notification-types.ts) ; null sans canal IN_APP. */
    inAppType: string | null;
    /** Chemin interne (« / », jamais « // » ni schéma) ; null pour un type sans lien. */
    link: ((d: D) => string) | null;
    inApp?: (d: D) => { title: string; content: string };
    sms?: (d: D, ctx: RenderContext) => string;
    push?: (d: D) => { title: string; body: string };
    email?: (d: D, ctx: RenderContext) => { subject: string; html: string; text: string };
    /** Valeurs maximales réalistes (contrat G3), utilisées par les tests. */
    sample: D;
}

interface Spec<D> {
    label: string;
    family?: Family;
    topic?: Topic | null;
    channels: readonly Channel[];
    audience: Audience;
    suspendedPolicy: SuspendedPolicy;
    adminPermission?: AdminPermission | null;
    inAppType: string | null;
    link: ((d: D) => string) | null;
    inApp?: (d: D) => { title: string; content: string };
    sms?: (d: D, ctx: RenderContext) => string;
    /** Push propre au type (PUSH_TEST) ; sinon titre et contenu in-app. */
    push?: (d: D) => { title: string; body: string };
    /**
     * Lot 7 (7.9, D93) : blocs propres de l'email (faits, liste, encadré, bouton, note), ajoutés après le contenu
     * in-app ; sans eux, l'email générique (contenu in-app, bouton « Ouvrir Event Village »).
     */
    emailBlocks?: (d: D) => EmailBlocks;
    sample: D;
}

/** Lot 7 (7.9) : blocs propres d'un email ; le bouton mène toujours au lien du type. */
interface EmailBlocks {
    facts?: readonly EmailFact[];
    list?: EmailList;
    notice?: readonly string[];
    ctaLabel: string;
    footnote?: string;
}

const PUSH_BODY_MAX = 160;

/** Corps du push : contenu in-app, tronqué à 160 caractères avec « … ». */
export function pushBody(content: string): string {
    if (content.length <= PUSH_BODY_MAX) return content;
    return `${content.slice(0, PUSH_BODY_MAX - 1).trimEnd()}…`;
}

function define<T extends NotificationType>(type: T, spec: Spec<TemplateData[T]>): NotificationTemplate<TemplateData[T]> {
    const family: Family = spec.family ?? 'ESSENTIAL';
    const topic: Topic | null = spec.topic ?? null;
    if ((family === 'OPTIONAL') !== (topic !== null)) throw new Error(`Catalogue : ${type} — sujet incohérent avec la famille`);
    const has = (c: Channel): boolean => spec.channels.includes(c);
    if (has('IN_APP') && (!spec.inApp || !spec.inAppType || !spec.link)) throw new Error(`Catalogue : ${type} — rendu in-app incomplet`);
    if (has('SMS') && !spec.sms) throw new Error(`Catalogue : ${type} — rendu SMS absent`);
    if (has('PUSH') && !spec.push && !spec.inApp) throw new Error(`Catalogue : ${type} — rendu push sans contenu`);
    if (has('EMAIL') && !spec.inApp) throw new Error(`Catalogue : ${type} — rendu email sans contenu in-app`);
    if ((has('PUSH') || has('EMAIL')) && !spec.link) throw new Error(`Catalogue : ${type} — lien absent`);

    const tpl: NotificationTemplate<TemplateData[T]> = {
        type,
        label: spec.label,
        family,
        topic,
        channels: spec.channels,
        audience: spec.audience,
        suspendedPolicy: spec.suspendedPolicy,
        syncOnly: false,
        adminPermission: spec.adminPermission ?? null,
        inAppType: spec.inAppType,
        link: spec.link,
        sample: spec.sample,
    };
    if (has('IN_APP')) tpl.inApp = spec.inApp;
    if (has('SMS')) tpl.sms = spec.sms;
    if (has('PUSH')) {
        tpl.push = spec.push ?? ((d) => {
            const r = spec.inApp!(d);
            return { title: r.title, body: pushBody(r.content) };
        });
    }
    if (has('EMAIL')) {
        tpl.email = (d, ctx) => {
            const r = spec.inApp!(d);
            const blocks = spec.emailBlocks ? spec.emailBlocks(d) : null;
            const { html, text: plain } = emailLayout({
                appUrl: ctx.appUrl,
                heading: r.title,
                paragraphs: [r.content],
                facts: blocks?.facts,
                list: blocks?.list,
                notice: blocks?.notice,
                cta: { label: blocks?.ctaLabel ?? 'Ouvrir Event Village', path: spec.link!(d) },
                footnote: blocks?.footnote,
                unsubscribeTopic: family === 'OPTIONAL' ? topic : null,
            });
            return { subject: `${r.title} — Event Village`, html, text: plain };
        };
    }
    return tpl;
}

function defineSync<T extends SyncType>(type: T, label: string): NotificationTemplate<TemplateData[T]> {
    return {
        type, label, family: 'ESSENTIAL', topic: null, channels: ['SMS'], audience: 'ANY', suspendedPolicy: 'ALLOW', syncOnly: true,
        adminPermission: null, inAppType: null, link: null, sample: { purpose: 'LOGIN' } as TemplateData[T],
    };
}

// ── Données d'exemple (valeurs réalistes, ids fixes) ───────────────────────

const SAMPLE_EVENT = {
    event_id: '7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01',
    title: 'Gala de la Teranga',
    start_at: '2026-11-14T20:00:00.000Z',
    location: 'CICAD',
    city: 'Diamniadio',
};
const SAMPLE_ID = {
    payment: '1f6e2b9c-7d3a-4c8e-9b21-0a5d3e7f8c42',
    keptPayment: '7c4e1a9d-3b6f-4d2e-a8c5-6f1b3d9e2a84',
    ticket: '5c2a8e41-9b3d-4f7a-8e16-2d4b6a9c1e73',
    transfer: '9e4b1c7a-2f5d-4a8e-b3c6-7d1e9f2a4b58',
    cashout: '3a7d9e2b-6c1f-4b8a-9d5e-1f3b7c9a2e64',
    partner: '6d2f8a4c-1e9b-4c7d-a5f3-8b2e4d6a9c15',
    shift: '8b5e3a1d-7c9f-4e2b-a6d4-3c1f5e7b9a26',
    category: '2e9c7a5b-3d1f-4b6e-8a2c-9f4d6b8e1a37',
    assignment: '4f1a9c7e-5b3d-4e8a-b2f6-6d9c1a3e5b48',
    reservation: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59',
    promotion: 'c7e9b1d3-5f2a-4c8e-a6b4-9d1f3e5a7c60',
    outbox: 'e1b3d5f7-9a2c-4e6b-8d4f-1a3c5e7b9d71',
    debt: 'f5d7b9e1-3c4a-4f8d-a2e6-7b9d1f3a5c82',
    otherEvent: '0d8b6f4a-2c1e-4a9d-b7f5-3e1c9a7d5b93',
};
const SAMPLE_MONEY = { cashout_id: SAMPLE_ID.cashout, amount: 25_000, operator: 'WAVE', account_kind: 'ORGANISATEUR' };

const eventPath = (d: object): string => `/events/${ident(d, 'event_id')}`;
const partnerEventPath = (d: object, tab?: string): string => `/partner/events/${ident(d, 'event_id')}${tab ? `?tab=${tab}` : ''}`;
const withdrawalPath = (d: object): string => (optText(d, 'account_kind') === 'PARRAINAGE' ? '/wallet' : '/partner/finance');

// ── Changement d'un événement (lot 5, regroupé) ────────────────────────────

interface ChangeSet { start: boolean; end: boolean; place: boolean; location: boolean; address: boolean; city: boolean; title: boolean }

function changeSet(d: object): ChangeSet {
    const fields = strings(d, 'changed_fields');
    return {
        start: fields.some((f) => START_FIELDS.has(f)),
        end: fields.some((f) => END_FIELDS.has(f)),
        place: fields.some((f) => PLACE_FIELDS.has(f)),
        location: fields.includes('location'),
        address: fields.includes('address'),
        city: fields.includes('city'),
        title: fields.includes('title'),
    };
}

/**
 * Nouveau lieu affiché dans le SMS : nouveau lieu, sinon nouvelle adresse, sinon (ville seule changée)
 * « lieu, ville », sinon le lieu courant. Les données de l'événement sont celles d'après la modification.
 */
function newPlace(d: object): string {
    const c = changeSet(d);
    const explicit = optText(d, 'new_location') ?? optText(d, 'new_address');
    if (explicit) return explicit;
    if (c.city && !c.location && !c.address) return `${text(d, 'location')}, ${optText(d, 'new_city') ?? text(d, 'city')}`;
    return text(d, 'location');
}

function eventChangedSms(d: object, ctx: RenderContext): string {
    const c = changeSet(d);
    const tickets = appLink(ctx, '/tickets');
    const startAt = optIso(d, 'new_start_at') ?? iso(d, 'start_at');
    if (c.start && c.place) {
        return `${SMS_PREFIX}${smsVar(text(d, 'title'), 25)} change : ${smsDateTime(startAt)}, ${smsVar(newPlace(d), 20)}. Billets toujours valables. ${tickets}`;
    }
    if (c.start) return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} change de date : ${smsDateTime(startAt)}. Vos billets restent valables. ${tickets}`;
    if (c.place) return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} change de lieu : ${smsVar(newPlace(d), 25)}. Vos billets restent valables. ${tickets}`;
    if (c.end) {
        return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} : nouvelle fin le ${smsDateTime(iso(d, 'new_end_at'))}. Vos billets restent valables. ${tickets}`;
    }
    // Titre seul (ou aucun champ visible) : aucun SMS (ligne SKIPPED TITLE_ONLY dès l'insertion).
    throw new TemplateDataError('changed_fields', 'ne contient aucun changement de date ou de lieu (aucun SMS)');
}

function eventChangedInApp(d: object): { title: string; content: string } {
    const c = changeSet(d);
    const parts: string[] = [];
    if (c.start) parts.push(`nouvelle date : ${formatDateTime(optIso(d, 'new_start_at') ?? iso(d, 'start_at'))}`);
    if (c.end) {
        const end = optIso(d, 'new_end_at');
        parts.push(end ? `nouvelle fin : ${formatDateTime(end)}` : 'nouvelle heure de fin');
    }
    if (c.place) {
        const loc = optText(d, 'new_location');
        const addr = optText(d, 'new_address');
        const city = optText(d, 'new_city');
        if (loc || c.location) parts.push(`nouveau lieu : ${loc ?? text(d, 'location')}`);
        if (addr) parts.push(`nouvelle adresse : ${addr}`);
        else if (c.address) parts.push('nouvelle adresse');
        if (city || c.city) parts.push(`nouvelle ville : ${city ?? text(d, 'city')}`);
    }
    if (c.title) {
        const old = optText(d, 'old_title');
        parts.push(old ? `nouveau titre (ancien titre : ${q(old)})` : 'nouveau titre');
    }
    const title = text(d, 'title');
    const content = parts.length > 0
        ? `${q(title)} : ${parts.join(', ')}. Vos billets restent valables.`
        : `${q(title)} a été modifié. Vos billets restent valables.`;
    return { title: 'Événement modifié', content };
}

// ── Affectations de contrôleurs (SMS regroupé) ─────────────────────────────

interface MainAssignment { title: string; start_at: string; others: number }

/** Affectation principale du SMS regroupé : données de premier niveau, sinon la première de `events`. */
function mainAssignment(d: object): MainAssignment {
    const events = list(d, 'events');
    const others = Math.max(0, events.length - 1);
    const first = events[0];
    const titleTop = optText(d, 'title');
    if (titleTop) return { title: titleTop, start_at: optIso(d, 'start_at') ?? '', others };
    if (first && typeof first === 'object') return { title: text(first, 'title'), start_at: optIso(first, 'start_at') ?? '', others };
    throw new TemplateDataError('title');
}

// ── Confirmations d'achat, de billets gratuits et de billet reçu (lot 7, tâche 7.9) ──

/**
 * Phrases de la consigne 7.9, mot pour mot (apostrophe droite, D99) : P1 et P2 dans l'encadré, P3 sous le
 * bouton. Seule P1 parle du QR code : aucun QR, code, secret ni lien de réclamation dans ces emails.
 */
const TICKET_IN_APP_NOTICE = [
    'Votre billet s\'affiche dans l\'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d\'écran ne sera pas acceptée à l\'entrée.',
    'Ouvrez votre billet avec du réseau avant d\'arriver : il restera disponible même sans connexion.',
] as const;
const MANUAL_ENTRY_FOOTNOTE = 'En cas de problème à l\'entrée, présentez le numéro de votre billet et une pièce d\'identité : le contrôleur peut l\'enregistrer à la main.';
const TICKETS_BUTTON = 'Voir mes billets';
/** Numéros listés au plus (D89) ; la migration 20261105000007 n'en stocke pas davantage. */
const TICKET_NUMBERS_SHOWN = 10;

/** Catégories et quantités figées à l'émission ; null pour une ligne d'avant la migration 07 (D90). */
function categoryLines(d: object): Array<{ name: string; quantity: number }> | null {
    const v = field(d, 'categories');
    if (v === undefined || v === null) return null;
    if (!Array.isArray(v)) throw new TemplateDataError('categories', 'n’est pas une liste');
    const lines = v.map((c, i) => {
        if (!c || typeof c !== 'object' || Array.isArray(c)) throw new TemplateDataError(`categories[${i}]`, 'n’est pas une catégorie');
        return { name: text(c, 'name'), quantity: count(c, 'quantity') };
    });
    return lines.length > 0 ? lines : null;
}

/** Numéros figés à l'émission (10 au plus) ; liste vide pour une ligne d'avant la migration 07 (D90). */
function ticketNumbers(d: object): string[] {
    const v = field(d, 'ticket_numbers');
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.trim() === '')) throw new TemplateDataError('ticket_numbers', 'n’est pas une liste de numéros');
    return (v as string[]).map((x) => x.trim());
}

/** Événement, date et heure de Dakar, lieu et ville (chacun seulement s'il est connu). */
function eventFacts(d: object): EmailFact[] {
    const facts: EmailFact[] = [
        { label: 'Événement', value: text(d, 'title') },
        { label: 'Date', value: formatDateTime(iso(d, 'start_at')) },
    ];
    const place = [optText(d, 'location'), optText(d, 'city')].filter((v): v is string => v !== null).join(', ');
    if (place) facts.push({ label: 'Lieu', value: place });
    return facts;
}

/** « 2 × VIP » par catégorie ; sans le détail (ligne d'avant la migration 07), le nombre de billets. */
function ticketsFact(d: object, label: string, one: string, many: string): EmailFact {
    const lines = categoryLines(d);
    return { label, value: lines ? lines.map((c) => `${c.quantity} × ${c.name}`) : plural(count(d, 'ticket_count'), one, many) };
}

/** Les 10 premiers numéros, puis « et N autres » (singulier « et 1 autre ») ; rien sans numéro. */
function ticketNumbersList(d: object): EmailList | undefined {
    const numbers = ticketNumbers(d);
    if (numbers.length === 0) return undefined;
    const shown = numbers.slice(0, TICKET_NUMBERS_SHOWN);
    const rest = Math.max(count(d, 'ticket_count'), numbers.length) - shown.length;
    return {
        title: shown.length > 1 || rest > 0 ? 'Numéros de billets' : 'Numéro du billet',
        items: shown,
        more: rest > 0 ? `et ${rest} ${rest > 1 ? 'autres' : 'autre'}` : undefined,
    };
}

function confirmationBlocks(facts: EmailFact[], list?: EmailList): EmailBlocks {
    return { facts, list, notice: TICKET_IN_APP_NOTICE, ctaLabel: TICKETS_BUTTON, footnote: MANUAL_ENTRY_FOOTNOTE };
}

// ── Le catalogue ───────────────────────────────────────────────────────────

const CATALOG = {
    PURCHASE_CONFIRMED: define('PURCHASE_CONFIRMED', {
        label: 'Confirmation d’achat', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TICKET',
        link: () => '/tickets',
        inApp: (d) => ({
            title: 'Achat confirmé',
            content: `${plural(count(d, 'ticket_count'), 'billet', 'billets')} pour ${q(text(d, 'title'))} le ${formatDateTime(iso(d, 'start_at'))}. Total payé : ${money(d, 'total')}. Vos billets sont dans Mes billets.`,
        }),
        // Lot 7 (7.9, D95) : titre ramené de 20 à 19 septets, pour un segment au pire cas (999 billets, frais
        // 999 999 F, total 9 999 999 F, URL de 27 caractères : 160 septets) ; aucun numéro ni mention ajoutée.
        sms: (d, ctx) => `${SMS_PREFIX}achat confirmé, ${plural(count(d, 'ticket_count'), 'billet', 'billets')} ${smsVar(text(d, 'title'), 19)}. Frais de service ${smsAmount(num(d, 'service_fee'))}, total payé ${smsAmount(num(d, 'total'))}. ${appLink(ctx, '/tickets')}`,
        // Lot 7 (7.9, contrat 19.4) : événement, date, lieu, billets par catégorie, montant payé, numéros, P1 à P3.
        emailBlocks: (d) => confirmationBlocks([
            ...eventFacts(d),
            ticketsFact(d, 'Billets', 'billet', 'billets'),
            { label: 'Montant payé', value: `${money(d, 'total')}, dont frais de service ${money(d, 'service_fee')}` },
        ], ticketNumbersList(d)),
        sample: {
            ...SAMPLE_EVENT, payment_id: SAMPLE_ID.payment, ticket_count: 2, service_fee: 100, total: 10_100,
            categories: [{ name: 'Standard', quantity: 1 }, { name: 'VIP', quantity: 1 }],
            ticket_numbers: ['TCK-20261104-3F9A1C7E2B', 'TCK-20261104-8D2E6B4A1F'],
        },
    }),
    FREE_TICKETS_CONFIRMED: define('FREE_TICKETS_CONFIRMED', {
        label: 'Billets gratuits confirmés', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET',
        link: () => '/tickets',
        inApp: (d) => ({
            title: 'Billets confirmés',
            // Lot 7 (7.9, D94) : lien vers Mes billets ajouté au texte.
            content: `${plural(count(d, 'ticket_count'), 'billet gratuit', 'billets gratuits')} pour ${q(text(d, 'title'))} le ${formatDateTime(iso(d, 'start_at'))}. Vos billets sont dans Mes billets.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}${plural(count(d, 'ticket_count'), 'billet gratuit', 'billets gratuits')} pour ${smsVar(text(d, 'title'), 30)} le ${smsDateTime(iso(d, 'start_at'))}. Vos billets : ${appLink(ctx, '/tickets')}`,
        // Lot 7 (7.9, contrat 19.4) : mêmes blocs que l'achat, sans montant.
        emailBlocks: (d) => confirmationBlocks([
            ...eventFacts(d),
            ticketsFact(d, 'Billets gratuits', 'billet gratuit', 'billets gratuits'),
        ], ticketNumbersList(d)),
        sample: {
            ...SAMPLE_EVENT, ticket_count: 2, ticket_id: SAMPLE_ID.ticket,
            categories: [{ name: 'Entree libre', quantity: 1 }, { name: 'Invitation', quantity: 1 }],
            ticket_numbers: ['TCK-20261104-5B7D9F1A3C', 'TCK-20261104-6C8E0A2B4D'],
        },
    }),
    COUNTER_RECEIPT: define('COUNTER_RECEIPT', {
        label: 'Reçu de vente au guichet', channels: ['SMS'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: null, link: null,
        sms: (d) => `${SMS_PREFIX}achat au guichet pour ${smsVar(text(d, 'title'), 30)}, ${plural(count(d, 'ticket_count'), 'billet', 'billets')}, ${smsAmount(num(d, 'amount'))}. Entrée validée. Réf. ${smsVar(text(d, 'reference'), 12)}.`,
        sample: { ...SAMPLE_EVENT, payment_id: SAMPLE_ID.payment, ticket_count: 2, amount: 10_000, reference: '1F6E2B9C' },
    }),
    TRANSFER_OFFERED: define('TRANSFER_OFFERED', {
        label: 'Billet transféré (offre)', channels: ['SMS', 'IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: () => '/tickets?tab=recus',
        inApp: (d) => ({
            title: 'Un billet vous est transféré',
            content: `Un billet pour ${q(text(d, 'title'))} vous attend. Acceptez-le avant le ${formatDateTime(iso(d, 'expires_at'))}.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}un billet ${smsVar(text(d, 'title'), 20)} vous est transféré. Connectez-vous avec ce numéro avant le ${smsShortDateTime(iso(d, 'expires_at'))} : ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket, expires_at: '2026-11-12T18:30:00.000Z', recipient_kind: 'PHONE' },
    }),
    TRANSFER_CANCELLED: define('TRANSFER_CANCELLED', {
        label: 'Transfert annulé', channels: ['SMS', 'IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: () => '/tickets',
        inApp: (d) => ({ title: 'Transfert annulé', content: `Le transfert du billet pour ${q(text(d, 'title'))} a été annulé par son propriétaire.` }),
        sms: (d) => `${SMS_PREFIX}le transfert du billet ${smsVar(text(d, 'title'), 30)} a été annulé par son propriétaire.`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    TRANSFER_EXPIRED: define('TRANSFER_EXPIRED', {
        label: 'Transfert expiré', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: () => '/tickets',
        inApp: (d) => ({ title: 'Transfert expiré', content: `Votre billet pour ${q(text(d, 'title'))} n'a pas été accepté à temps : il reste dans vos billets.` }),
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    TRANSFER_CLAIMED_SENDER: define('TRANSFER_CLAIMED_SENDER', {
        label: 'Transfert accepté (expéditeur)', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: () => '/tickets?tab=historique',
        inApp: (d) => ({ title: 'Billet accepté', content: `Votre billet pour ${q(text(d, 'title'))} a été accepté par son destinataire.` }),
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    // Lot 7 (7.9, D88, D91, D94) : canal EMAIL ajouté (registre : migration 20261105000007) ; NOUVEAU numéro du
    // billet (le transfert le renouvelle) et date dans l'in-app ; sans numéro (ligne d'avant la migration), texte du
    // lot 6. Aucun montant ni prix.
    TRANSFER_RECEIVED: define('TRANSFER_RECEIVED', {
        label: 'Billet reçu', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: () => '/tickets',
        inApp: (d) => {
            const number = optText(d, 'ticket_number');
            return {
                title: 'Billet reçu',
                content: number
                    ? `Le billet ${number} pour ${q(text(d, 'title'))} du ${formatDateTime(iso(d, 'start_at'))} est ajouté à Mes billets.`
                    : `Le billet pour ${q(text(d, 'title'))} est ajouté à vos billets.`,
            };
        },
        emailBlocks: (d) => {
            const facts = eventFacts(d);
            const category = optText(d, 'category');
            const number = optText(d, 'ticket_number');
            if (category) facts.push({ label: 'Catégorie', value: category });
            if (number) facts.push({ label: 'Numéro du billet', value: number });
            return confirmationBlocks(facts);
        },
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket, ticket_number: 'TCK-20261104-9E4B1C7A2F', category: 'VIP' },
    }),
    TICKET_SCANNED: define('TICKET_SCANNED', {
        label: 'Entrée validée', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_SCANNED',
        link: () => '/tickets?tab=historique',
        inApp: (d) => ({ title: 'Entrée validée', content: `Votre billet pour ${q(text(d, 'title'))} a été contrôlé à l'entrée.` }),
        sample: { ...SAMPLE_EVENT, ticket_id: SAMPLE_ID.ticket },
    }),
    EVENT_CANCELLED: define('EVENT_CANCELLED', {
        label: 'Annulation d’un événement', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        link: () => '/tickets',
        inApp: (d) => {
            const mode = text(d, 'refund_mode');
            const notice = optText(d, 'public_notice');
            const refund = mode === 'AUTO' ? ' Votre remboursement est en cours.'
                : mode === 'ORGANIZER' ? ' Le remboursement se fait auprès de l\'organisateur.'
                    : mode === 'NONE' ? '' : null;
            if (refund === null) throw new TemplateDataError('refund_mode', 'inconnu');
            return {
                title: 'Événement annulé',
                content: `${q(text(d, 'title'))} du ${formatDateTime(iso(d, 'start_at'))} est annulé.${notice ? ` ${sentence(notice)}` : ''}${refund}`,
            };
        },
        sms: (d, ctx) => {
            const head = `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} du ${smsDateTime(iso(d, 'start_at'))} est annulé.`;
            const tickets = appLink(ctx, '/tickets');
            const mode = text(d, 'refund_mode');
            if (mode === 'AUTO') return `${head} Remboursement automatique en cours. ${tickets}`;
            if (mode === 'ORGANIZER') return `${head} Remboursement par l'organisateur. ${tickets}`;
            if (mode === 'NONE') return `${head} Détails : ${tickets}`;
            throw new TemplateDataError('refund_mode', 'inconnu');
        },
        sample: { ...SAMPLE_EVENT, public_notice: 'Intempéries annoncées sur Dakar.', refund_mode: 'AUTO' },
    }),
    EVENT_SUSPENDED_HOLDER: define('EVENT_SUSPENDED_HOLDER', {
        label: 'Suspension d’un événement (porteurs)', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'EVENT_STATUS', link: eventPath,
        inApp: (d) => ({ title: 'Événement suspendu', content: `${q(text(d, 'title'))} est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.` }),
        sample: { ...SAMPLE_EVENT },
    }),
    EVENT_REACTIVATED_HOLDER: define('EVENT_REACTIVATED_HOLDER', {
        label: 'Reprise d’un événement (porteurs)', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'EVENT_STATUS', link: eventPath,
        inApp: (d) => ({ title: 'Événement de nouveau en ligne', content: `${q(text(d, 'title'))} reprend comme prévu. Vos billets restent valables.` }),
        sample: { ...SAMPLE_EVENT },
    }),
    EVENT_CHANGED: define('EVENT_CHANGED', {
        label: 'Changement d’un événement', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channels: ['IN_APP', 'PUSH', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'EVENT_CHANGE', link: eventPath,
        inApp: eventChangedInApp,
        sms: eventChangedSms,
        sample: { ...SAMPLE_EVENT, changed_fields: ['start_date', 'start_time'], new_start_at: '2026-11-21T21:00:00.000Z' },
    }),
    REMINDER_J1: define('REMINDER_J1', {
        label: 'Rappel la veille', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'REMINDER', link: () => '/tickets',
        inApp: (d) => ({
            title: 'Rappel : c\'est demain',
            content: `${q(text(d, 'title'))} demain à ${formatTime(iso(d, 'start_at'))}, ${text(d, 'location')}, ${text(d, 'city')}. Vos billets sont dans Mes billets.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}rappel, ${smsVar(text(d, 'title'), 30)} demain à ${smsTime(iso(d, 'start_at'))}, ${smsVar(text(d, 'location'), 30)}. Vos billets : ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, sms_policy: 'ALWAYS' },
    }),
    REMINDER_H3: define('REMINDER_H3', {
        label: 'Rappel avant le début', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'REMINDER', link: () => '/tickets',
        inApp: (d) => ({
            title: 'C\'est bientôt',
            // Lot 7 (D33) : le billet reste présentable sans réseau (7.1) ; lien et SMS inchangés.
            content: `${q(text(d, 'title'))} commence à ${formatTime(iso(d, 'start_at'))} (${text(d, 'location')}). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 25)} à ${smsTime(iso(d, 'start_at'))}. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, sms_policy: 'IF_NO_PUSH' },
    }),
    REFUND_REQUESTED: define('REFUND_REQUESTED', {
        label: 'Remboursement demandé', channels: ['IN_APP'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_REQUESTED',
        link: () => '/tickets?tab=historique',
        inApp: (d) => ({ title: 'Remboursement demandé', content: `Le remboursement de votre billet pour ${q(text(d, 'title'))} (${money(d, 'amount')}) est en cours.` }),
        sample: { ...SAMPLE_EVENT, cashout_id: SAMPLE_ID.cashout, amount: 5_000 },
    }),
    REFUND_PAID: define('REFUND_PAID', {
        label: 'Remboursement versé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROCESSED',
        link: () => '/tickets?tab=historique',
        inApp: (d) => {
            const title = optText(d, 'title');
            return {
                title: 'Remboursement versé',
                content: `${money(d, 'amount')} vous ont été remboursés sur votre compte ${operatorLabel(field(d, 'operator'))}${title ? ` pour ${q(title)}` : ''}.`,
            };
        },
        sms: (d) => {
            const title = optText(d, 'title');
            return `${SMS_PREFIX}remboursement de ${smsAmount(num(d, 'amount'))} versé sur votre compte ${operatorLabel(field(d, 'operator'))}${title ? ` (${smsVar(title, 30)})` : ''}.`;
        },
        sample: { ...SAMPLE_EVENT, cashout_id: SAMPLE_ID.cashout, amount: 5_000, operator: 'WAVE', account_kind: 'PARRAINAGE' },
    }),
    PASSWORD_CHANGED: define('PASSWORD_CHANGED', {
        label: 'Mot de passe modifié', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: 'SECURITY',
        link: () => '/profile',
        inApp: () => ({
            title: 'Mot de passe modifié',
            content: 'Le mot de passe de votre compte a été défini ou modifié. Si ce n\'est pas vous, contactez le support.',
        }),
        sms: () => `${SMS_PREFIX}le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.`,
        sample: {},
    }),
    PUSH_TEST: define('PUSH_TEST', {
        label: 'Notification d’essai', channels: ['PUSH'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: 'SYSTEM',
        link: () => '/profile/notifications',
        push: () => ({ title: 'Notification d\'essai', body: 'Les notifications fonctionnent sur cet appareil.' }),
        sample: {},
    }),
    EVENT_VALIDATED: define('EVENT_VALIDATED', {
        label: 'Événement validé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement validé', content: `${q(text(d, 'title'))} est validé. Vous pouvez le publier depuis votre espace.` }),
        sms: (d, ctx) => `${SMS_PREFIX}votre événement ${smsVar(text(d, 'title'), 30)} est validé. Publiez-le depuis votre espace : ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    EVENT_REJECTED: define('EVENT_REJECTED', {
        label: 'Événement non validé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement non validé', content: `${q(text(d, 'title'))} n'est pas validé. Motif : ${sentence(text(d, 'reason'))}` }),
        sms: (d, ctx) => `${SMS_PREFIX}événement ${smsVar(text(d, 'title'), 25)} non validé. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 40))} ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT, reason: 'Affiche illisible, merci d’en déposer une nouvelle.' },
    }),
    EVENT_SUSPENDED: define('EVENT_SUSPENDED', {
        label: 'Événement suspendu', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement suspendu', content: `${q(text(d, 'title'))} est suspendu par l'administration. Motif : ${sentence(text(d, 'reason'))}` }),
        sms: (d, ctx) => `${SMS_PREFIX}événement ${smsVar(text(d, 'title'), 25)} suspendu. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 40))} ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT, reason: 'Signalement en cours d’examen.' },
    }),
    EVENT_REACTIVATED: define('EVENT_REACTIVATED', {
        label: 'Événement réactivé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement réactivé', content: `${q(text(d, 'title'))} est de nouveau en ligne.` }),
        sms: (d, ctx) => `${SMS_PREFIX}votre événement ${smsVar(text(d, 'title'), 30)} est de nouveau en ligne. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    EVENT_PUBLISHED_BY_ADMIN: define('EVENT_PUBLISHED_BY_ADMIN', {
        label: 'Événement publié par l’administration', channels: ['IN_APP', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement publié', content: `${q(text(d, 'title'))} a été publié par l'administration.` }),
        sample: { ...SAMPLE_EVENT },
    }),
    FIRST_TICKET_SOLD: define('FIRST_TICKET_SOLD', {
        label: 'Premier billet vendu', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: 'SALES', link: (d) => partnerEventPath(d, 'ventes'),
        inApp: (d) => ({ title: 'Premier billet vendu', content: `Le premier billet de ${q(text(d, 'title'))} est vendu.` }),
        sms: (d, ctx) => `${SMS_PREFIX}premier billet vendu pour ${smsVar(text(d, 'title'), 30)}. Suivez vos ventes : ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    NEW_ORDER: define('NEW_ORDER', {
        label: 'Nouvelle commande', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channels: ['IN_APP'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: 'SALES', link: (d) => partnerEventPath(d, 'ventes'),
        inApp: (d) => ({
            title: 'Nouvelle commande',
            content: `${plural(count(d, 'ticket_count'), 'billet vendu', 'billets vendus')} pour ${q(text(d, 'title'))} (${money(d, 'total')}).`,
        }),
        sample: { ...SAMPLE_EVENT, payment_id: SAMPLE_ID.payment, ticket_count: 2, total: 10_000 },
    }),
    CATEGORY_SOLD_OUT: define('CATEGORY_SOLD_OUT', {
        label: 'Catégorie complète', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: 'CATEGORY_SOLD_OUT', link: (d) => partnerEventPath(d, 'ventes'),
        inApp: (d) => ({ title: 'Catégorie complète', content: `La catégorie ${q(text(d, 'category'))} de ${q(text(d, 'title'))} est complète.` }),
        sms: (d, ctx) => `${SMS_PREFIX}la catégorie ${smsVar(text(d, 'category'), 25)} de ${smsVar(text(d, 'title'), 30)} est complète. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT, category_id: SAMPLE_ID.category, category: 'Carré VIP' },
    }),
    EVENT_SOLD_OUT: define('EVENT_SOLD_OUT', {
        label: 'Événement complet', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: 'EVENT_FULLY_SOLD_OUT', link: (d) => partnerEventPath(d, 'ventes'),
        inApp: (d) => ({ title: 'Événement complet', content: `Toutes les catégories de ${q(text(d, 'title'))} sont vendues.` }),
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} est complet, toutes les catégories sont vendues. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    SHIFT_DISCREPANCY: define('SHIFT_DISCREPANCY', {
        label: 'Écart de caisse', channels: ['IN_APP', 'SMS', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'ALERT',
        link: (d) => partnerEventPath(d, 'caisse'),
        inApp: (d) => {
            const justification = optText(d, 'justification');
            return {
                title: 'Écart de caisse',
                content: `La caisse de ${text(d, 'controller_name')} pour ${q(text(d, 'title'))} est fermée avec un écart de ${signedFcfa(num(d, 'difference'))}.${justification ? ` Justification : ${sentence(justification)}` : ''}`,
            };
        },
        sms: (d, ctx) => `${SMS_PREFIX}caisse de ${smsVar(text(d, 'controller_name'), 20)} fermée (${smsVar(text(d, 'title'), 25)}) avec un écart de ${signedSmsAmount(num(d, 'difference'))}. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT, shift_id: SAMPLE_ID.shift, controller_name: 'Fatou Sow', difference: -2_500, declared: 47_500, justification: 'Erreur de monnaie rendue.' },
    }),
    WITHDRAWAL_PAID: define('WITHDRAWAL_PAID', {
        label: 'Retrait versé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'WITHDRAWAL_PAID',
        link: withdrawalPath,
        inApp: (d) => ({ title: 'Retrait versé', content: `Votre retrait de ${money(d, 'amount')} a été versé sur votre compte ${operatorLabel(field(d, 'operator'))}.` }),
        sms: (d) => `${SMS_PREFIX}votre retrait de ${smsAmount(num(d, 'amount'))} a été versé sur votre compte ${operatorLabel(field(d, 'operator'))}.`,
        sample: { ...SAMPLE_MONEY },
    }),
    WITHDRAWAL_REJECTED: define('WITHDRAWAL_REJECTED', {
        label: 'Retrait refusé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'WITHDRAWAL_REJECTED',
        link: withdrawalPath,
        inApp: (d) => ({ title: 'Retrait refusé', content: `Votre retrait de ${money(d, 'amount')} a été refusé par l'opérateur. Le montant est revenu sur votre solde.` }),
        sms: (d) => `${SMS_PREFIX}votre retrait de ${smsAmount(num(d, 'amount'))} a été refusé par l'opérateur. Le montant est revenu sur votre solde.`,
        sample: { ...SAMPLE_MONEY },
    }),
    WITHDRAWAL_UNCERTAIN: define('WITHDRAWAL_UNCERTAIN', {
        label: 'Retrait en vérification', channels: ['IN_APP', 'SMS', 'PUSH'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'WITHDRAWAL_PENDING_CHECK',
        link: withdrawalPath,
        inApp: (d) => ({ title: 'Retrait en vérification', content: `Votre retrait de ${money(d, 'amount')} est en vérification auprès de l'opérateur. Aucune action n'est nécessaire.` }),
        sms: (d) => `${SMS_PREFIX}votre retrait de ${smsAmount(num(d, 'amount'))} est en vérification auprès de l'opérateur. Aucune action de votre part.`,
        sample: { ...SAMPLE_MONEY },
    }),
    CANCEL_REFUNDS_DONE: define('CANCEL_REFUNDS_DONE', {
        label: 'Remboursements d’une annulation terminés', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROGRESS',
        link: (d) => partnerEventPath(d, 'cloture'),
        inApp: (d) => ({ title: 'Remboursements terminés', content: `Tous les remboursements en ligne de ${q(text(d, 'title'))} sont versés.` }),
        sample: { ...SAMPLE_EVENT },
    }),
    CANCEL_REFUNDS_BLOCKED: define('CANCEL_REFUNDS_BLOCKED', {
        label: 'Remboursements d’une annulation bloqués', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROGRESS',
        link: (d) => partnerEventPath(d, 'cloture'),
        inApp: (d) => ({ title: 'Remboursements en attente', content: `Des remboursements de ${q(text(d, 'title'))} sont bloqués : l'administration les reprend.` }),
        sample: { ...SAMPLE_EVENT },
    }),
    PARTNER_REGISTERED_ACK: define('PARTNER_REGISTERED_ACK', {
        label: 'Inscription partenaire reçue', channels: ['IN_APP', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Inscription reçue', content: `Votre demande de compte partenaire ${q(text(d, 'company'))} est en cours d'examen.` }),
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    PARTNER_VALIDATED: define('PARTNER_VALIDATED', {
        label: 'Compte partenaire validé', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Compte partenaire validé', content: `Votre compte partenaire ${q(text(d, 'company'))} est validé. Vous pouvez créer et publier vos événements.` }),
        sms: (d, ctx) => `${SMS_PREFIX}votre compte partenaire ${smsVar(text(d, 'company'), 30)} est validé. Connectez-vous : ${appLink(ctx, '/login')}`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    PARTNER_REJECTED: define('PARTNER_REJECTED', {
        label: 'Demande de compte partenaire refusée', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Demande refusée', content: `Votre demande de compte partenaire n'est pas acceptée. Motif : ${sentence(text(d, 'reason'))}` }),
        sms: (d) => `${SMS_PREFIX}votre demande de compte partenaire n'est pas acceptée. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 60))}`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events', reason: 'Pièce d’identité illisible.' },
    }),
    PARTNER_SUSPENDED: define('PARTNER_SUSPENDED', {
        label: 'Compte partenaire suspendu', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'KYC',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Compte suspendu', content: `Votre compte partenaire est suspendu. Motif : ${sentence(text(d, 'reason'))} Contactez le support.` }),
        sms: (d) => `${SMS_PREFIX}votre compte partenaire est suspendu. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 60))} Contactez le support.`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events', reason: 'Signalements de fraude en cours d’examen.' },
    }),
    PARTNER_REACTIVATED: define('PARTNER_REACTIVATED', {
        label: 'Compte partenaire réactivé', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        link: () => '/partner/dashboard',
        inApp: () => ({ title: 'Compte réactivé', content: 'Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements.' }),
        sms: (_d, ctx) => `${SMS_PREFIX}votre compte partenaire est réactivé. Connectez-vous : ${appLink(ctx, '/login')}`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    TRIAL_STARTED: define('TRIAL_STARTED', {
        label: 'Période d’essai activée', channels: ['IN_APP', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'TRIAL',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Période d\'essai activée', content: `Votre période d'essai de ${count(d, 'days')} jours commence aujourd'hui.` }),
        sms: (d) => `${SMS_PREFIX}votre période d'essai de ${count(d, 'days')} jours commence aujourd'hui. Bienvenue !`,
        sample: { partner_id: SAMPLE_ID.partner, days: 60 },
    }),
    SUBSCRIPTION_ACTIVATED: define('SUBSCRIPTION_ACTIVATED', {
        label: 'Abonnement activé', channels: ['IN_APP'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'SUBSCRIPTION_ACTIVATED',
        link: () => '/partner/subscription',
        inApp: (d) => ({ title: 'Abonnement activé', content: `Votre pack ${q(text(d, 'plan'))} est activé pour ${count(d, 'days')} jours.` }),
        sample: { partner_id: SAMPLE_ID.partner, plan_id: 'pro', plan: 'Pro', days: 30 },
    }),
    PAYMENT_SUCCESS: define('PAYMENT_SUCCESS', {
        label: 'Paiement confirmé', channels: ['IN_APP'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'PAYMENT_SUCCESS',
        link: (d) => (field(d, 'payment_target') === 'SUBSCRIPTION' ? '/partner/subscription' : '/orders'),
        inApp: (d) => ({ title: 'Paiement confirmé', content: `Votre paiement de ${money(d, 'amount')} a été validé.` }),
        sample: { payment_id: SAMPLE_ID.payment, amount: 15_000 },
    }),
    HALL_RESERVATION_REQUESTED: define('HALL_RESERVATION_REQUESTED', {
        label: 'Demande de réservation de salle', channels: ['IN_APP'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'HALL_RESERVATION',
        link: () => '/partner/halls',
        inApp: (d) => ({
            title: 'Nouvelle demande de réservation',
            content: `Demande de réservation de ${hallName(d)} du ${formatDate(iso(d, 'start_date'))} au ${formatDate(iso(d, 'end_date'))}.`,
        }),
        sample: { reservation_id: SAMPLE_ID.reservation, hall_name: 'Salle des fêtes de Ngor', start_date: '2026-12-05', end_date: '2026-12-06' },
    }),
    HALL_RESERVATION_CONFIRMED: define('HALL_RESERVATION_CONFIRMED', {
        label: 'Réservation de salle confirmée', channels: ['IN_APP'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'HALL_RESERVATION',
        link: () => '/orders',
        inApp: (d) => ({
            title: 'Réservation confirmée',
            content: `Votre réservation de ${hallName(d)} du ${formatDate(iso(d, 'start_date'))} au ${formatDate(iso(d, 'end_date'))} est confirmée.`,
        }),
        sample: { reservation_id: SAMPLE_ID.reservation, hall_name: 'Salle des fêtes de Ngor', start_date: '2026-12-05', end_date: '2026-12-06' },
    }),
    HALL_RESERVATION_CANCELLED: define('HALL_RESERVATION_CANCELLED', {
        label: 'Réservation de salle annulée', channels: ['IN_APP'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: 'HALL_RESERVATION',
        link: (d) => (text(d, 'recipient_role') === 'PARTNER' ? '/partner/halls' : '/orders'),
        inApp: (d) => {
            const reason = optText(d, 'reason');
            return {
                title: 'Réservation annulée',
                content: `La réservation de ${hallName(d)} du ${formatDate(iso(d, 'start_date'))} au ${formatDate(iso(d, 'end_date'))} est annulée.${reason ? ` Motif : ${sentence(reason)}` : ''}`,
            };
        },
        sample: { reservation_id: SAMPLE_ID.reservation, hall_name: 'Salle des fêtes de Ngor', start_date: '2026-12-05', end_date: '2026-12-06', recipient_role: 'CLIENT', reason: 'Travaux imprévus.' },
    }),
    PROMOTION_DECIDED: define('PROMOTION_DECIDED', {
        label: 'Décision sur une mise en avant', channels: ['IN_APP'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'PROMOTION',
        link: (d) => partnerEventPath(d),
        inApp: (d) => {
            const status = text(d, 'status');
            if (status === 'APPROUVEE') return { title: 'Mise en avant acceptée', content: `La mise en avant de ${q(text(d, 'title'))} est acceptée.` };
            if (status === 'REFUSEE') {
                const reason = optText(d, 'reason');
                return { title: 'Mise en avant refusée', content: `La demande de mise en avant de ${q(text(d, 'title'))} est refusée.${reason ? ` Motif : ${sentence(reason)}` : ''}` };
            }
            throw new TemplateDataError('status', 'n’est pas une décision (acceptée ou refusée)');
        },
        sample: { ...SAMPLE_EVENT, promotion_id: SAMPLE_ID.promotion, status: 'APPROUVEE' },
    }),
    CONTROLLER_ASSIGNED: define('CONTROLLER_ASSIGNED', {
        label: 'Affectation d’un contrôleur', channels: ['IN_APP', 'PUSH', 'SMS'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: () => '/controller/scanner',
        inApp: (d) => {
            const entry = optText(d, 'entry_point');
            return {
                title: 'Nouvelle affectation',
                content: `Vous contrôlez l'entrée de ${q(text(d, 'title'))} le ${formatDateTime(iso(d, 'start_at'))}${entry ? `, point d'entrée ${entry}` : ''}${bool(d, 'can_accept_cash') ? '. Encaissement des espèces autorisé' : ''}.`,
            };
        },
        sms: (d, ctx) => {
            const main = mainAssignment(d);
            if (!main.start_at) throw new TemplateDataError('start_at');
            const entry = optText(d, 'entry_point');
            return `${SMS_PREFIX}affectation à l'entrée de ${smsVar(main.title, 25)}, ${smsDateTime(main.start_at)}${entry ? `, point ${smsVar(entry, 12)}` : ''}${main.others > 0 ? `, et ${main.others} autres` : ''}. ${appLink(ctx, '/login')}`;
        },
        sample: {
            ...SAMPLE_EVENT, assignment_id: SAMPLE_ID.assignment, entry_point: 'Porte Nord', can_accept_cash: true,
            events: [
                { event_id: SAMPLE_EVENT.event_id, title: SAMPLE_EVENT.title, start_at: SAMPLE_EVENT.start_at },
                { event_id: SAMPLE_ID.otherEvent, title: 'Nuit du Mbalax', start_at: '2026-11-21T21:00:00.000Z' },
            ],
        },
    }),
    CONTROLLER_UNASSIGNED: define('CONTROLLER_UNASSIGNED', {
        label: 'Retrait d’affectation', channels: ['IN_APP', 'PUSH', 'SMS'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: () => '/controller/scanner',
        inApp: (d) => ({ title: 'Affectation retirée', content: `Vous ne contrôlez plus l'entrée de ${q(text(d, 'title'))}.` }),
        sms: (d) => {
            const main = mainAssignment(d);
            return `${SMS_PREFIX}votre affectation à l'entrée de ${smsVar(main.title, 30)} est retirée${main.others > 0 ? `, et ${main.others} autres` : ''}.`;
        },
        sample: {
            ...SAMPLE_EVENT, assignment_id: SAMPLE_ID.assignment,
            events: [
                { event_id: SAMPLE_EVENT.event_id, title: SAMPLE_EVENT.title, start_at: SAMPLE_EVENT.start_at },
                { event_id: SAMPLE_ID.otherEvent, title: 'Nuit du Mbalax', start_at: '2026-11-21T21:00:00.000Z' },
            ],
        },
    }),
    CONTROLLER_REMINDER: define('CONTROLLER_REMINDER', {
        label: 'Rappel de contrôle la veille', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'SMS'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK',
        inAppType: 'CONTROLLER', link: () => '/controller/scanner',
        inApp: (d) => ({
            title: 'Contrôle demain',
            content: `Demain ${q(text(d, 'title'))} à ${formatTime(iso(d, 'start_at'))}, point d'entrée ${optText(d, 'entry_point') ?? 'à préciser'}, espèces ${bool(d, 'can_accept_cash') ? 'autorisées' : 'non autorisées'}.`,
        }),
        sms: (d, ctx) => {
            const entry = optText(d, 'entry_point');
            return `${SMS_PREFIX}demain ${smsVar(text(d, 'title'), 30)} à ${smsTime(iso(d, 'start_at'))}, point ${entry ? smsVar(entry, 20) : 'à préciser'}, espèces ${bool(d, 'can_accept_cash') ? 'autorisées' : 'non autorisées'}. Connexion : ${appLink(ctx, '/login')}`;
        },
        sample: { ...SAMPLE_EVENT, assignment_id: SAMPLE_ID.assignment, entry_point: 'Porte Nord', can_accept_cash: true },
    }),
    SHIFT_CLOSED_BY_OTHER: define('SHIFT_CLOSED_BY_OTHER', {
        label: 'Caisse fermée par un tiers', channels: ['IN_APP', 'PUSH'], audience: 'CONTROLLER', suspendedPolicy: 'ALLOW', inAppType: 'ALERT',
        link: () => '/controller/scanner',
        inApp: (d) => {
            const by = text(d, 'closed_by');
            const who = by === 'ADMIN' ? 'l\'administration' : by === 'PARTNER' ? 'l\'organisateur' : null;
            if (!who) throw new TemplateDataError('closed_by', 'inconnu (PARTNER ou ADMIN attendu)');
            const declared = optNum(d, 'declared');
            return {
                title: 'Caisse fermée',
                content: `Votre caisse pour ${q(text(d, 'title'))} a été fermée par ${who}.${declared !== null ? ` Montant déclaré : ${formatFcfa(declared)}.` : ''}`,
            };
        },
        sample: { ...SAMPLE_EVENT, shift_id: SAMPLE_ID.shift, closed_by: 'PARTNER', declared: 47_500 },
    }),
    CONTROLLER_ACTIVATED: define('CONTROLLER_ACTIVATED', {
        label: 'Compte de contrôleur activé', channels: ['IN_APP', 'SMS'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: () => '/controller/scanner',
        inApp: () => ({ title: 'Compte activé', content: 'Votre compte est activé : vous pouvez scanner les billets.' }),
        sms: () => `${SMS_PREFIX}votre compte est activé. Vous pouvez vous connecter et scanner les billets.`,
        sample: {},
    }),
    ADMIN_EVENT_SUBMITTED: define('ADMIN_EVENT_SUBMITTED', {
        label: 'Événement à valider', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'events.read', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/events/${ident(d, 'event_id')}`,
        inApp: (d) => {
            const company = optText(d, 'company');
            return { title: 'Événement à valider', content: `${q(text(d, 'title'))}${company ? ` de ${company}` : ''} attend votre validation.` };
        },
        sample: { ...SAMPLE_EVENT, company: 'Sabar Events' },
    }),
    ADMIN_PARTNER_REGISTERED: define('ADMIN_PARTNER_REGISTERED', {
        label: 'Nouvelle candidature partenaire', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'partners.read', inAppType: 'KYC',
        link: () => '/admin/dashboard',
        inApp: (d) => ({ title: 'Nouvelle candidature', content: `${text(d, 'company')} demande un compte partenaire.` }),
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    ADMIN_REFUND_TO_RETRY: define('ADMIN_REFUND_TO_RETRY', {
        label: 'Remboursement à reprendre', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance',
        inApp: (d) => {
            const status = text(d, 'cashout_status');
            const reason = optText(d, 'blocked_reason');
            let state: string;
            if (status === 'BLOQUE') state = reason ? `bloqué : ${sentence(blockedReasonLabel(reason))}` : 'bloqué.';
            else if (status === 'ECHOUE') state = 'refusé par l\'opérateur.';
            else throw new TemplateDataError('cashout_status', 'inconnu (BLOQUE ou ECHOUE attendu)');
            return { title: 'Remboursement à reprendre', content: `Un remboursement de ${money(d, 'amount')} est ${state}` };
        },
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 5_000, cashout_status: 'BLOQUE', blocked_reason: 'OPERATOR_UNKNOWN' },
    }),
    /** Lot 8 (8.2 a, L32) : second paiement réussi d'un même panier, remboursement lancé par payment_confirm. */
    ADMIN_DUPLICATE_PAYMENT: define('ADMIN_DUPLICATE_PAYMENT', {
        label: 'Paiement en double remboursé', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance',
        inApp: (d) => ({ title: 'Paiement en double remboursé', content: `Un second paiement de ${money(d, 'amount')} a été encaissé pour le même panier : son remboursement au client est lancé.` }),
        sample: { payment_id: SAMPLE_ID.payment, duplicate_of: SAMPLE_ID.keptPayment, amount: 21_000 },
    }),
    ADMIN_CASHOUT_UNCERTAIN: define('ADMIN_CASHOUT_UNCERTAIN', {
        label: 'Versement incertain', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance',
        inApp: (d) => ({ title: 'Versement incertain', content: `L'issue d'un versement de ${money(d, 'amount')} est incertaine : vérifiez-le avant toute action.` }),
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 25_000 },
    }),
    ADMIN_WITHDRAWAL_REJECTED: define('ADMIN_WITHDRAWAL_REJECTED', {
        label: 'Retrait refusé par l’opérateur', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance',
        inApp: (d) => ({ title: 'Retrait refusé par l\'opérateur', content: `Le retrait de ${money(d, 'amount')} a été refusé ; le montant est revenu sur le solde du bénéficiaire.` }),
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 25_000 },
    }),
    ADMIN_FINANCE_DEBT: define('ADMIN_FINANCE_DEBT', {
        label: 'Créance sur un compte', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'payments.read', inAppType: 'FINANCE_ALERT',
        link: () => '/admin/finance',
        inApp: (d) => {
            const kind = optText(d, 'account_kind');
            const account = kind === 'ORGANISATEUR' ? 'le compte organisateur' : kind === 'PARRAINAGE' ? 'le compte de parrainage' : 'un compte';
            return {
                title: 'Créance sur un compte',
                content: `Un débit de ${money(d, 'amount')} sur ${account} dépasse le solde disponible : une créance de ${money(d, 'debt')} sera compensée sur les gains futurs.`,
            };
        },
        sample: { debt_id: SAMPLE_ID.debt, amount: 5_000, debt: 3_000, account_kind: 'ORGANISATEUR', entry_type: 'REFUND_DEBIT' },
    }),
    ADMIN_NOTIFICATION_FAILED: define('ADMIN_NOTIFICATION_FAILED', {
        label: 'Envoi en échec', channels: ['IN_APP'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'NOTIFICATION_ALERT',
        link: (d) => `/admin/notifications/${ident(d, 'outbox_id')}`,
        inApp: (d) => {
            const attempts = optNum(d, 'attempts');
            return {
                title: 'Envoi en échec',
                content: `Une notification ${q(catalogTypeLabel(field(d, 'failed_type')))} ${channelPhrase(field(d, 'channel'))} a échoué${attempts !== null && attempts > 0 ? ` après ${plural(attempts, 'tentative', 'tentatives')}` : ''}.`,
            };
        },
        sample: { outbox_id: SAMPLE_ID.outbox, failed_type: 'PURCHASE_CONFIRMED', channel: 'SMS', reason: 'SMS_REJECTED', attempts: 5 },
    }),
    ADMIN_SMS_DAILY_THRESHOLD: define('ADMIN_SMS_DAILY_THRESHOLD', {
        label: 'Volume de SMS élevé', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_DAILY_THRESHOLD',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Volume de SMS élevé',
            content: `${formatInteger(count(d, 'count'))} SMS envoyés aujourd'hui (seuil : ${formatInteger(count(d, 'threshold'))}).`,
        }),
        sample: { day: '2026-11-02', count: 2_150, threshold: 2_000 },
    }),
    ADMIN_SMS_CAP_GLOBAL: define('ADMIN_SMS_CAP_GLOBAL', {
        label: 'Plafond de SMS atteint', channels: ['IN_APP'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_DAILY_CAP_REACHED',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Plafond de SMS atteint',
            content: `Le plafond de ${formatInteger(count(d, 'cap'))} SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar).`,
        }),
        sample: { day: '2026-11-02', cap: 1_000 },
    }),
    ADMIN_SMS_CAP_NON_OTP: define('ADMIN_SMS_CAP_NON_OTP', {
        label: 'Quota de SMS hors code atteint', channels: ['IN_APP'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_NON_OTP_SHARE_REACHED',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Quota de SMS hors code atteint',
            content: `La part des SMS hors codes de connexion (${formatInteger(count(d, 'limit'))} sur ${formatInteger(count(d, 'cap'))} par jour) est atteinte : seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar).`,
        }),
        sample: { day: '2026-11-02', cap: 1_000, limit: 700 },
    }),
    // Lot 7 (7.0 a, D15) : alerte à 80 % du budget des SMS optionnels (notif.sms_optional_daily_cap), une fois par
    // jour de Dakar, mise en file par notification_daily_checks.
    ADMIN_SMS_OPTIONAL_80: define('ADMIN_SMS_OPTIONAL_80', {
        label: 'SMS optionnels à 80 % du plafond', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_DAILY_THRESHOLD',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'SMS optionnels : 80 % du plafond',
            content: `${formatInteger(count(d, 'used'))} SMS optionnels envoyés aujourd'hui sur un plafond de ${formatInteger(count(d, 'cap'))}. Au-delà, rappels et annonces partent sans SMS.`,
        }),
        sample: { day: '2026-11-05', used: 560, cap: 700, threshold: 560, percent: 80 },
    }),
    // Lot 7 (7.0 a, D16) : prévision de la veille, mise en file par notification_reminders_schedule quand les rappels
    // SMS prévus pour le lendemain dépassent le budget optionnel restant de ce jour.
    ADMIN_SMS_FORECAST: define('ADMIN_SMS_FORECAST', {
        label: 'Rappels de demain au-delà du budget SMS', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_DAILY_THRESHOLD',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Budget SMS de demain insuffisant',
            content: `${formatInteger(count(d, 'planned'))} SMS de rappel prévus le ${formatDate(iso(d, 'day'))} pour ${formatInteger(count(d, 'remaining'))} disponibles (plafond ${formatInteger(count(d, 'cap'))}). Les rappels au-delà partiront sans SMS.`,
        }),
        sample: { day: '2026-11-06', planned: 812, cap: 700, remaining: 700 },
    }),
    OTP_LOGIN: defineSync('OTP_LOGIN', 'Code de connexion'),
    OTP_REGISTER: defineSync('OTP_REGISTER', 'Code d’inscription'),
    OTP_PASSWORD_RESET: defineSync('OTP_PASSWORD_RESET', 'Code de réinitialisation du mot de passe'),
    OTP_WITHDRAWAL: defineSync('OTP_WITHDRAWAL', 'Code de confirmation d’un retrait'),
    OTP_AUTH_HOOK: defineSync('OTP_AUTH_HOOK', 'Code de connexion (Supabase)'),
    CONTROLLER_INVITE: defineSync('CONTROLLER_INVITE', 'Invitation d’un contrôleur'),
} satisfies { readonly [T in NotificationType]: NotificationTemplate<TemplateData[T]> };

function hallName(d: object): string {
    const name = optText(d, 'hall_name');
    return name ? q(name) : 'votre salle';
}

/** Catalogue de tous les types : un modèle par type de `public.notification_types`. */
export const NOTIFICATION_CATALOG: { readonly [T in NotificationType]: NotificationTemplate<TemplateData[T]> } = CATALOG;

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_CATALOG) as NotificationType[];

export function isNotificationType(value: unknown): value is NotificationType {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(NOTIFICATION_CATALOG, value);
}

/** Nom humain d'un type (supervision, alertes) ; un type inconnu donne « Notification ». */
export function catalogTypeLabel(type: unknown): string {
    return isNotificationType(type) ? NOTIFICATION_CATALOG[type].label : 'Notification';
}

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
    IN_APP: 'Application', SMS: 'SMS', EMAIL: 'Email', PUSH: 'Notifications push',
};

/** Libellé d'un canal ; un canal inconnu donne « Canal inconnu », jamais la valeur brute. */
export function channelLabel(channel: unknown): string {
    return typeof channel === 'string' && Object.prototype.hasOwnProperty.call(CHANNEL_LABELS, channel) ? CHANNEL_LABELS[channel as Channel] : 'Canal inconnu';
}

function channelPhrase(channel: unknown): string {
    switch (channel) {
        case 'IN_APP': return 'dans l\'application';
        case 'SMS': return 'par SMS';
        case 'EMAIL': return 'par email';
        case 'PUSH': return 'par notification push';
        default: return 'sur un canal inconnu';
    }
}

// ── Rendu ──────────────────────────────────────────────────────────────────

export type RenderedNotification =
    | { channel: 'IN_APP'; type: NotificationType; inAppType: string; title: string; content: string; actionUrl: string }
    | { channel: 'SMS'; type: NotificationType; text: string; measure: SmsMeasure }
    | { channel: 'PUSH'; type: NotificationType; title: string; body: string; url: string }
    | { channel: 'EMAIL'; type: NotificationType; subject: string; html: string; text: string; headers: Record<string, string>; url: string };

type AnyTemplate = NotificationTemplate<Data>;

function linkOf(tpl: AnyTemplate, data: Data): string {
    if (!tpl.link) throw new TemplateDataError('link', 'absent pour ce type');
    const raw = tpl.link(data);
    const safe = internalActionUrl(raw);
    if (!safe) throw new TemplateDataError('link', `n’est pas un chemin interne (${JSON.stringify(raw)})`);
    return safe;
}

/**
 * Rendu d'un type pour un canal, à partir de `template_data`. Lève TemplateDataError si une variable
 * obligatoire manque, si le type est inconnu ou journal seulement, ou si le canal n'est pas celui du type.
 */
export function renderNotification(type: NotificationType | string, channel: Channel, data: unknown, ctx: RenderContext): RenderedNotification {
    if (!isNotificationType(type)) throw new TemplateDataError('type', `inconnu (${JSON.stringify(type)})`);
    const tpl = NOTIFICATION_CATALOG[type] as unknown as AnyTemplate;
    if (tpl.syncOnly) throw new TemplateDataError('type', 'réservé aux envois synchrones (renderSyncSms)');
    if (!tpl.channels.includes(channel)) throw new TemplateDataError('channel', `${channel} n’est pas un canal de ${type}`);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TemplateDataError('template_data', 'n’est pas un objet');
    const d = data as Data;
    switch (channel) {
        case 'IN_APP': {
            const r = tpl.inApp!(d);
            return { channel, type, inAppType: tpl.inAppType!, title: r.title, content: r.content, actionUrl: linkOf(tpl, d) };
        }
        case 'SMS': {
            const smsText = tpl.sms!(d, ctx);
            return { channel, type, text: smsText, measure: smsSegments(smsText) };
        }
        case 'PUSH': {
            const r = tpl.push!(d);
            return { channel, type, title: r.title, body: r.body, url: linkOf(tpl, d) };
        }
        case 'EMAIL': {
            const r = tpl.email!(d, ctx);
            return {
                channel, type, subject: r.subject, html: r.html, text: r.text,
                headers: emailHeaders(ctx.appUrl, tpl.family === 'OPTIONAL' ? tpl.topic : null), url: linkOf(tpl, d),
            };
        }
        default:
            throw new TemplateDataError('channel', `inconnu (${JSON.stringify(channel)})`);
    }
}

/**
 * Textes des envois synchrones (OTP, invitation d'un contrôleur), inchangés depuis les lots précédents.
 * Le code n'est passé qu'ici, au moment de l'envoi : il n'est jamais stocké.
 */
export function renderSyncSms(type: SyncType, data: { code: string; firstName?: string; setupLink?: string }): string {
    const code = typeof data?.code === 'string' ? data.code.trim() : '';
    if (!/^\d{4,8}$/.test(code)) throw new TemplateDataError('code', 'absent ou illisible');
    switch (type) {
        case 'OTP_LOGIN':
        case 'OTP_REGISTER':
        case 'OTP_WITHDRAWAL':
        case 'OTP_AUTH_HOOK':
            return `Votre code de verification Event Village est : ${code}. Valable 10 minutes.`;
        case 'OTP_PASSWORD_RESET':
            return `Event Village: Votre code de réinitialisation est : ${code}. Valable 10 minutes.`;
        case 'CONTROLLER_INVITE': {
            const link = typeof data.setupLink === 'string' ? data.setupLink.trim() : '';
            if (!/^https?:\/\//.test(link)) throw new TemplateDataError('setupLink', 'absent ou illisible');
            const name = typeof data.firstName === 'string' ? data.firstName.trim() : '';
            const greeting = name ? `Bonjour ${name}, vous etes invite` : 'Vous etes invite';
            return `Event Village : ${greeting} comme controleur. Code : ${code} (valable 24h). Activez votre compte : ${link}`;
        }
        default:
            throw new TemplateDataError('type', `${JSON.stringify(type)} n’est pas un envoi synchrone`);
    }
}
