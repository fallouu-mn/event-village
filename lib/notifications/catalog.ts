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
 *
 * Lot 9 bis (contrat 11, registre : migration 20261109000003) : 26 types nouveaux (dont EMAIL_VERIFICATION, email
 * synchrone rendu par renderEmailVerification) ; EMAIL pour tout indispensable non synchrone adressé à un compte
 * (G.49, sauf PUSH_TEST et COUNTER_RECEIPT) et pour les optionnels qui ont le push (G.50) ; EVENT_CHANGED
 * indispensable (R14) ; préfixe unique « Event Village : » des envois synchrones (R73), code de retrait dédié (R107) ;
 * aucune valeur tronquée suivie de « .... » (R74) ; textes du contrat 11.1 et 11.2 mot pour mot.
 *
 * Lot 9 ter (contrat 11.1, 11.2 N1 à N4 et M1 ; registre : migration 20261110000004) : 4 types nouveaux de tout le lot
 * (TICKET_REFUNDED_HOLDER, seul SMS nouveau, texte de la consigne 0.2 ; ADMIN_EVENT_PUBLISHED, ADMIN_EVENT_WITHDRAWN ;
 * SCAN_REFUSALS_ALERT, sans SMS) et parties PRICE et CHANNELS d'ADMIN_EVENT_CHANGED (registre inchangé).
 */
import { formatDate, formatDateTime, formatFcfa, formatInteger, formatTime } from '@/lib/format';
import { internalActionUrl } from './action-url';
import { PERMISSION_LABELS } from '@/lib/admin/permission-labels';
import type {
    AdminPermission, Audience, Channel, EmailSyncType, Family, NightPolicy, NotificationType, SuspendedPolicy, SyncType, TemplateData, Topic,
} from './catalog-types';
import { emailHeaders, emailLayout, type EmailFact, type EmailList } from './email-layout';
import { smsAmount, smsDateTime, smsDay, smsSegments, smsShortDateTime, smsTime, smsVar, type SmsMeasure } from './sms-format';

export type { Channel, EmailSyncType, NotificationType, SyncType, TemplateData } from './catalog-types';

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

/** Design 1c : écart de caisse en mots : « Il manque 2 500 F CFA. », « 2 500 F CFA de trop. », « Aucun écart. ». */
function cashGapText(n: number, fmt: (amount: number) => string): string {
    if (n < 0) return `Il manque ${fmt(Math.abs(n))}.`;
    if (n > 0) return `${fmt(n)} de trop.`;
    return 'Aucun écart.';
}


const START_FIELDS = new Set(['start_date', 'start_time', 'start_at']);
const END_FIELDS = new Set(['end_date', 'end_time', 'end_at']);
// Finition 2a (3) : « position » = repère déplacé de plus de 200 m après validation, avis de changement de lieu
const PLACE_FIELDS = new Set(['location', 'address', 'city', 'position']);

const BLOCKED_REASON_LABELS: Readonly<Record<string, string>> = {
    OPERATOR_UNKNOWN: 'opérateur du paiement inconnu',
    PHONE_UNKNOWN: 'numéro du payeur inconnu',
    NAME_UNKNOWN: 'nom du bénéficiaire incomplet',
    SOLDE_INSUFFISANT: 'solde du compte partenaire SamirPay insuffisant',
    SIMULATED: 'opération créée en mode simulé : aucun versement',
    // Lot 9 bis (B5, B19) : limite du compte Mobile Money ; compte du bénéficiaire suspendu.
    LIMITE_COMPTE: 'limite du compte Mobile Money du bénéficiaire atteinte',
    ACCOUNT_SUSPENDED: 'compte du bénéficiaire suspendu',
};

/** Lot 9 bis (11.1 N3) : nature d'un versement, jamais le code. */
const CASHOUT_KIND_LABELS: Readonly<Record<string, string>> = {
    REFUND: 'remboursement d’un paiement',
    EVENT_CANCELLATION_REFUND: 'remboursement d’une annulation',
    TICKET_REFUND: 'remboursement d’un billet',
    WITHDRAWAL: 'retrait',
};

function cashoutKindLabel(value: unknown): string {
    return typeof value === 'string' && CASHOUT_KIND_LABELS[value] ? CASHOUT_KIND_LABELS[value] : 'versement';
}

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
    /**
     * Finition 4 : DEFER = non urgent (SMS et push préparés pendant la plage de nuit reportés à sa fin), SEND = urgent.
     * Registre : notification_types.night_policy (égalité imposée par tests/parcours/f4-registre.test.ts).
     */
    nightPolicy: NightPolicy;
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
    /** Finition 4 : défaut DEFER pour la famille OPTIONAL, SEND pour l'indispensable. */
    night?: NightPolicy;
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
        nightPolicy: spec.night ?? (family === 'OPTIONAL' ? 'DEFER' : 'SEND'),
        inAppType: spec.inAppType,
        link: spec.link,
        sample: spec.sample,
    };
    // Lot 9 bis (11.2 M22) : un type sans IN_APP mais avec EMAIL (PHONE_CHANGED) expose aussi son contenu, fond de l'email.
    if (has('IN_APP') || has('EMAIL')) tpl.inApp = spec.inApp;
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
        adminPermission: null, nightPolicy: 'SEND', inAppType: null, link: null, sample: { purpose: 'LOGIN' } as TemplateData[T],
    };
}

/** Lot 9 bis (11.1 N26) : email synchrone (journal seulement), rendu par renderEmailVerification au moment de l'envoi. */
function defineSyncEmail<T extends EmailSyncType>(type: T, label: string): NotificationTemplate<TemplateData[T]> {
    return {
        type, label, family: 'ESSENTIAL', topic: null, channels: ['EMAIL'], audience: 'ANY', suspendedPolicy: 'ALLOW', syncOnly: true,
        adminPermission: null, nightPolicy: 'SEND', inAppType: null, link: null, sample: { purpose: 'EMAIL_VERIFY' } as TemplateData[T],
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
    invitation: 'b2d4f6a8-0c1e-4b3d-9f5a-7c9e1b3d5f04',
};

/** Lot 10a : données d'exemple d'une réservation de salle (rendu des modèles et tests). */
const HALL_SAMPLE_DATA = { reservation_id: SAMPLE_ID.reservation, hall_id: SAMPLE_ID.reservation, hall_name: 'Salle des fêtes de Ngor', start_date: '2026-12-05', end_date: '2026-12-06', mode: 'JOUR', total_amount: 420000, paid_amount: 126000 } as const;

/** Lot 11a : données d'exemple d'une réservation de table (rendu des modèles et tests). */
const TABLE_SAMPLE_DATA = {
    reservation_id: SAMPLE_ID.reservation, venue_id: SAMPLE_ID.reservation, venue_name: 'Le Grand Bleu', date: '2026-12-05', time: '20:00',
    end_time: '22:00', guests: 4, table_number: '12', deposit_amount: 20000, total_amount: 21000, paid_amount: 21000,
    // Lot 11b : lien court des SMS (code de 7 caractères), heure de garde de la table
    short_code: 'k7m2p9x', held_until: '20:30',
} as const;

/** Lot 12a : données d'exemple d'une commande (rendu des modèles et tests ; valeurs longues réalistes). */
const ORDER_SAMPLE_DATA = {
    order_id: SAMPLE_ID.reservation, order_number: 'CMD-261205-A1B2C3', venue_id: SAMPLE_ID.reservation,
    venue_name: 'Chez Fatou, cuisine du Sénégal et grillades', mode: 'LIVRAISON', state: 'RECUE', items_count: 12,
    goods_total: 1_250_000, paid_amount: 1_312_500, balance_due: 0, payment_type: 'INTEGRAL',
    scheduled_for: '2026-12-05T12:45:00Z', estimated_at: '2026-12-05T12:45:00Z', response_due_at: '2026-12-05T12:15:00Z',
    zone_name: 'Almadies et Ngor', recipient_role: 'CLIENT',
} as const;

/** Finition 1 (E-20) : données d'exemple des avis d'invitation de contrôleur à la partenaire. */
const SAMPLE_TEAM_NOTICE = {
    invitation_id: 'b2d4f6a8-0c1e-4b3d-9f5a-7c9e1b3d5f04',
    events: [{ event_id: '7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01', title: 'Gala de la Teranga', start_at: '2026-11-14T20:00:00.000Z' }],
};
const SAMPLE_MONEY = { cashout_id: SAMPLE_ID.cashout, amount: 25_000, operator: 'WAVE', account_kind: 'ORGANISATEUR' };

const eventPath = (d: object): string => `/events/${ident(d, 'event_id')}`;
const partnerEventPath = (d: object, tab?: string): string => `/partner/events/${ident(d, 'event_id')}${tab ? `?tab=${tab}` : ''}`;
/**
 * Finition 5 (point 2) : chaque avis mène à l'objet exact. Retrait : la page du retrait (identifiant de l'envoi,
 * cashout_id), au portefeuille (parrainage) ou aux finances pro ; session et propriété exigées par la page.
 */
const withdrawalPath = (d: object): string => {
    const space = optText(d, 'account_kind') === 'PARRAINAGE' ? '/wallet' : '/partner/finance';
    return optText(d, 'cashout_id') ? `${space}/retraits/${ident(d, 'cashout_id')}` : space;
};
/** Finition 5 : les billets du compte pour un événement (achat, invitation, rappel, annulation, remboursement) ; sans
 * événement dans les données (ligne ancienne), l'historique : un lien ne fait jamais échouer l'envoi d'un avis. */
const eventTicketsPath = (d: object): string => (optText(d, 'event_id') ? `/tickets/${ident(d, 'event_id')}` : '/tickets?tab=historique');
const eventTicketsOrHistory = eventTicketsPath;
/** Finition 5 : un billet du compte (/tickets/<billet>, page app/tickets/[id], qui ouvre aussi les billets d'un événement) ;
 * sans billet dans les données, ceux de l'événement. */
/** Lot 11c-b : « Ma table » du titulaire dans Mes billets (onglet « Tables », table mise en avant) ; sans vente connue,
 *  les billets de l'événement comme avant. */
const myTablePath = (d: object): string => (optText(d, 'booking_id') ? `/tickets?tab=tables#table-${ident(d, 'booking_id')}` : eventTicketsPath(d));
const ticketPath = (d: object): string => (optText(d, 'ticket_id') ? `/tickets/${ident(d, 'ticket_id')}` : eventTicketsPath(d));
/** Finition 5 : billet reçu à accepter, dans « Reçus » à l'endroit du transfert (ancre recu-<transfert>, IncomingTransfers). */
const incomingTransferPath = (d: object): string => `/tickets?tab=recus#recu-${ident(d, 'transfer_id')}`;
/** Finition 5 : un billet contrôlé (le billet) ; plusieurs billets de la commande contrôlés : les billets de l'événement. */
const scannedPath = (d: object): string => {
    const count = field(d, 'ticket_count');
    return optText(d, 'ticket_id') && (typeof count !== 'number' || count <= 1) ? ticketPath(d) : eventTicketsPath(d);
};
/** Finition 5 : fiche du dossier d'une partenaire, ouverte dans la file de validation (lien profond du tableau de bord). */
const partnerDossierPath = (d: object): string => `/admin/dashboard?partenaires=ALL&dossier=${ident(d, 'partner_id')}`;
/** Finition 4 : lien d'un avis de ventes, l'événement s'il n'y en a qu'un, sinon la liste. */
const salesPath = (d: object): string => (optText(d, 'event_id') ? partnerEventPath(d, 'ventes') : '/partner/events');
/** Finition 4 : entier pour un SMS, milliers séparés par une espace simple (GSM-7, jamais d'espace insécable). */
const smsCount = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Finition 4 : qui a lancé un remboursement de billet (REFUND_REQUESTED). */
function refundBy(d: object): 'CLIENT' | 'ORGANIZER' | 'ADMIN' | 'CANCELLATION' {
    const by = optText(d, 'by');
    return by === 'ORGANIZER' || by === 'ADMIN' || by === 'CANCELLATION' ? by : 'CLIENT';
}

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

/** Lot 9 bis (R32) : report de plus de 24 h qui ouvre le remboursement, posé par event_update. */
function refundOpen(d: object): boolean {
    return field(d, 'refund_open') === true;
}

/** Lot 9 bis (R80) : adresse retirée sans autre changement de lieu ni de date. */
function addressClearedOnly(d: object, c: ChangeSet): boolean {
    return field(d, 'address_cleared') === true && c.address && !c.location && !c.city && !c.start && !c.end;
}

function eventChangedSms(d: object, ctx: RenderContext): string {
    const c = changeSet(d);
    const tickets = appLink(ctx, '/tickets');
    const startAt = optIso(d, 'new_start_at') ?? iso(d, 'start_at');
    // Lot 9 bis (11.2 M1, R32) : variantes « report » (titre borné à 20).
    if (c.start && refundOpen(d)) {
        return c.place
            ? `${SMS_PREFIX}${smsVar(text(d, 'title'), 20)} reporté au ${smsDateTime(startAt)}, nouveau lieu. Remboursement total avant cette date : ${tickets}`
            : `${SMS_PREFIX}${smsVar(text(d, 'title'), 20)} reporté au ${smsDateTime(startAt)}. Remboursement total possible avant cette date : ${tickets}`;
    }
    // Lot 9 bis (11.2 M1, R80) : adresse retirée, le lieu reste.
    if (addressClearedOnly(d, c)) {
        return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} : adresse retirée, lieu ${endWithPeriod(smsVar(text(d, 'location'), 20))} Billets toujours valables. ${tickets}`;
    }
    // Lot 9 bis (R74) : une valeur tronquée finit par « ... », jamais « .... ».
    if (c.start && c.place) {
        return `${SMS_PREFIX}${smsVar(text(d, 'title'), 25)} change : ${smsDateTime(startAt)}, ${endWithPeriod(smsVar(newPlace(d), 20))} Billets toujours valables. ${tickets}`;
    }
    if (c.start) return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} change de date : ${smsDateTime(startAt)}. Vos billets restent valables. ${tickets}`;
    if (c.place) return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} change de lieu : ${endWithPeriod(smsVar(newPlace(d), 25))} Vos billets restent valables. ${tickets}`;
    if (c.end) {
        return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} : nouvelle fin le ${smsDateTime(iso(d, 'new_end_at'))}. Vos billets restent valables. ${tickets}`;
    }
    // Titre seul (ou aucun champ visible) : aucun SMS (ligne SKIPPED TITLE_ONLY dès l'insertion).
    throw new TemplateDataError('changed_fields', 'ne contient aucun changement de date ou de lieu (aucun SMS)');
}

function eventChangedInApp(d: object): { title: string; content: string } {
    const c = changeSet(d);
    // Lot 9 bis (R32, découverte argent) : report qui ouvre le remboursement.
    if (c.start && refundOpen(d)) {
        const loc = c.place ? optText(d, 'new_location') ?? text(d, 'location') : null;
        return {
            title: 'Événement modifié',
            content: `${q(text(d, 'title'))} est reporté au ${formatDateTime(optIso(d, 'new_start_at') ?? iso(d, 'start_at'))}${loc ? `, nouveau lieu : ${loc}` : ''}. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement.`,
        };
    }
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
        else if (c.address) parts.push(field(d, 'address_cleared') === true ? 'adresse retirée' : 'nouvelle adresse'); // lot 9 bis (R80)
        if (city || c.city) parts.push(`nouvelle ville : ${city ?? text(d, 'city')}`);
        // Finition 2a (3) : seul le repère a bougé (plus de 200 m), le nom du lieu reste
        if (!loc && !c.location && !addr && !c.address && !city && !c.city) parts.push(`nouvel emplacement sur la carte : ${text(d, 'location')}`);
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

/**
 * Finition 1 (E-20) : événements d'une invitation de contrôleur, pour les avis à la partenaire : « « Titre » », « « Titre »
 * et 2 autres événements », ou « vos événements » si aucun n'est plus lisible (événement supprimé).
 */
function invitedEventsClause(d: object): string {
    const events = list(d, 'events').filter((e): e is object => !!e && typeof e === 'object' && !!optText(e, 'title'));
    if (events.length === 0) return 'vos événements';
    const others = events.length - 1;
    const more = others > 0 ? ` et ${others} ${others > 1 ? 'autres événements' : 'autre événement'}` : '';
    return `${q(text(events[0], 'title'))}${more}`;
}

// ── Lot 9 bis (11.1 N16, N21) : changements vus par un contrôleur et par l'administration ──

/** N16 : SMS d'un contrôleur affecté, date, lieu, les deux ou fin (mêmes données qu'EVENT_CHANGED). */
function controllerChangedSms(d: object, ctx: RenderContext): string {
    const c = changeSet(d);
    const head = `${SMS_PREFIX}affectation à l'entrée de ${smsVar(text(d, 'title'), 25)} :`;
    const login = appLink(ctx, '/login');
    const startAt = optIso(d, 'new_start_at') ?? iso(d, 'start_at');
    if (c.start && c.place) return `${head} ${smsDateTime(startAt)}, ${endWithPeriod(smsVar(newPlace(d), 20))} ${login}`;
    if (c.start) return `${head} nouvelle date ${smsDateTime(startAt)}. ${login}`;
    if (c.place) return `${head} nouveau lieu ${endWithPeriod(smsVar(newPlace(d), 25))} ${login}`;
    if (c.end) return `${head} nouvelle fin le ${smsDateTime(iso(d, 'new_end_at'))}. ${login}`;
    throw new TemplateDataError('changed_fields', 'ne contient aucun changement de date ou de lieu');
}

/** N16 : in-app et email d'un contrôleur affecté. */
function controllerChangedInApp(d: object): { title: string; content: string } {
    const c = changeSet(d);
    const parts: string[] = [];
    if (c.start) parts.push(`nouvelle date : ${formatDateTime(optIso(d, 'new_start_at') ?? iso(d, 'start_at'))}`);
    if (c.end) {
        const end = optIso(d, 'new_end_at');
        parts.push(end ? `nouvelle fin : ${formatDateTime(end)}` : 'nouvelle heure de fin');
    }
    if (c.place) parts.push(`nouveau lieu : ${newPlace(d)}`);
    if (parts.length === 0) throw new TemplateDataError('changed_fields', 'ne contient aucun changement de date ou de lieu');
    return { title: 'Contrôle modifié', content: `${q(text(d, 'title'))} : ${parts.join(', ')}. Votre affectation est maintenue.` };
}

/** Lot 9 ter (11.2 M1, 9t.10) : canaux de vente d'une catégorie, d'après la modification. */
function saleChannelsLabel(d: object): string {
    const online = bool(d, 'sale_online');
    const counter = bool(d, 'sale_counter');
    if (online && counter) return 'en ligne et au guichet';
    if (online) return 'en ligne seulement';
    if (counter) return 'au guichet seulement';
    return 'aucun canal';
}

/** N21 : liste des changements après validation, jamais un code ; lot 9 ter (M1) : parties PRICE et CHANNELS. */
function adminChangeList(d: object): string {
    const changes = strings(d, 'changes');
    const parts: string[] = [];
    for (const change of changes) {
        if (change === 'TITLE') {
            const old = optText(d, 'old_title');
            parts.push(old ? `nouveau titre (ancien : ${q(old)})` : 'nouveau titre');
        } else if (change === 'POSTER') parts.push('nouvelle affiche');
        else if (change === 'PLACE') parts.push('nouveau lieu');
        else if (change === 'DATE') parts.push('nouvelle date');
        else if (change === 'CATEGORY') {
            const category = optText(d, 'category');
            parts.push(category ? `catégorie ${q(category)} ajoutée` : 'catégorie ajoutée');
        } else if (change === 'PRICE') {
            parts.push(`nouveau prix pour ${q(text(d, 'category'))} (${money(d, 'new_price')} au lieu de ${money(d, 'old_price')})`);
        } else if (change === 'CHANNELS') {
            parts.push(`canaux de vente de ${q(text(d, 'category'))} changés (${saleChannelsLabel(d)})`);
        } else throw new TemplateDataError('changes', `contient un changement inconnu (${JSON.stringify(change)})`);
    }
    if (parts.length === 0) throw new TemplateDataError('changes', 'vide');
    return parts.join(', ');
}

/** Lot 9 bis (R73) : « , et 1 autre » au singulier, « , et N autres » au pluriel, rien sans autre affectation. */
function othersClause(others: number): string {
    if (others <= 0) return '';
    return `, et ${others} ${others > 1 ? 'autres' : 'autre'}`;
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

// Design 1b (point 8) : chaque lien vers Mes billets (in-app, push, bouton de l'email) ouvre l'onglet qui montre le billet
// concerné : « À venir » (billet valable d'un événement pas fini : achat, billet reçu ou revenu, rappels), « Historique »
// (utilisé, annulé, remboursé ou en remboursement), « Reçus » (transfert ou invitation qui attend, ou qui attendait :
// transfert annulé ou révoqué), « Tous » (événement clos après suspension : le billet reste valable, l'onglet dépend de
// l'heure de fin). Billet accepté par son destinataire (TRANSFER_CLAIMED_SENDER) : il a quitté le compte, aucun onglet ne le
// montre plus ; « À venir » montre les billets qui restent. Les SMS gardent l'adresse courte /tickets (longueur comptée).
const CATALOG = {
    PURCHASE_CONFIRMED: define('PURCHASE_CONFIRMED', {
        label: 'Confirmation d’achat', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TICKET',
        link: eventTicketsPath,
        inApp: (d) => ({
            title: 'Achat confirmé',
            content: `${plural(count(d, 'ticket_count'), 'billet', 'billets')} pour ${q(text(d, 'title'))} le ${formatDateTime(iso(d, 'start_at'))}. Total payé : ${money(d, 'total')}. Vos billets sont dans Mes billets.`,
        }),
        // Lot 7 (7.9, D95) : titre ramené de 20 à 19 septets, pour un segment au pire cas (999 billets, frais
        // 999 999 F, total 9 999 999 F, URL de 27 caractères : 160 septets) ; aucun numéro ni mention ajoutée.
        sms: (d, ctx) => `${SMS_PREFIX}achat confirmé, ${plural(count(d, 'ticket_count'), 'billet', 'billets')} ${endWithPeriod(smsVar(text(d, 'title'), 19))} Frais de service ${smsAmount(num(d, 'service_fee'))}, total payé ${smsAmount(num(d, 'total'))}. ${appLink(ctx, '/tickets')}`,
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
        label: 'Billets gratuits confirmés', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET',
        link: eventTicketsPath,
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
        sms: (d) => `${SMS_PREFIX}achat au guichet pour ${smsVar(text(d, 'title'), 30)}, ${plural(count(d, 'ticket_count'), 'billet', 'billets')}, ${smsAmount(num(d, 'amount'))}. Entrée validée. Réf. ${endWithPeriod(smsVar(text(d, 'reference'), 12))}`,
        sample: { ...SAMPLE_EVENT, payment_id: SAMPLE_ID.payment, ticket_count: 2, amount: 10_000, reference: '1F6E2B9C' },
    }),
    // Lot 9 (9.0, L10) : SMS au numéro invité, lien vers Mes billets dans le texte. Pire cas (10 invitations,
    // titre tronqué à 28, date la plus longue, URL de 27 caractères) : 158 septets, un segment GSM-7.
    // Lot 9 bis (11.2 M3, R79, G.49) : in-app, push et email au compte connu ; la ligne SMS reste sans compte (AR15).
    INVITATION_RECEIVED: define('INVITATION_RECEIVED', {
        label: 'Invitation reçue', channels: ['SMS', 'IN_APP', 'PUSH', 'EMAIL'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'TICKET',
        // Finition 4 (point 5, E-42) : les billets d'une invitation sont dans « À venir » (« Reçus » ne montre que les transferts)
        link: eventTicketsPath,
        inApp: (d) => ({
            title: 'Invitation reçue',
            content: `${plural(count(d, 'ticket_count'), 'invitation', 'invitations')} pour ${q(text(d, 'title'))} le ${formatDateTime(iso(d, 'start_at'))} : vos billets sont dans Mes billets.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}${plural(count(d, 'ticket_count'), 'invitation', 'invitations')} pour ${smsVar(text(d, 'title'), 28)} le ${smsDateTime(iso(d, 'start_at'))}. Connectez-vous avec ce numéro : ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, ticket_count: 2, ticket_id: SAMPLE_ID.ticket },
    }),
    TRANSFER_OFFERED: define('TRANSFER_OFFERED', {
        label: 'Billet transféré (offre)', channels: ['SMS', 'IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: incomingTransferPath,
        inApp: (d) => ({
            title: 'Un billet vous est transféré',
            content: `Un billet pour ${q(text(d, 'title'))} vous attend. Acceptez-le avant le ${formatDateTime(iso(d, 'expires_at'))}.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}un billet ${smsVar(text(d, 'title'), 20)} vous est transféré. Connectez-vous avec ce numéro avant le ${smsShortDateTime(iso(d, 'expires_at'))} : ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket, expires_at: '2026-11-12T18:30:00.000Z', recipient_kind: 'PHONE' },
    }),
    TRANSFER_CANCELLED: define('TRANSFER_CANCELLED', {
        label: 'Transfert annulé', channels: ['SMS', 'IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: () => '/tickets?tab=recus',
        inApp: (d) => ({ title: 'Transfert annulé', content: `Le transfert du billet pour ${q(text(d, 'title'))} a été annulé par son propriétaire.` }),
        sms: (d) => `${SMS_PREFIX}le transfert du billet ${smsVar(text(d, 'title'), 30)} a été annulé par son propriétaire.`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    TRANSFER_EXPIRED: define('TRANSFER_EXPIRED', {
        label: 'Transfert expiré', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        night: 'DEFER',
        link: ticketPath,
        inApp: (d) => ({ title: 'Transfert expiré', content: `Votre billet pour ${q(text(d, 'title'))} n'a pas été accepté à temps : il reste dans vos billets.` }),
        // Finition 4 (point 4) : billet revenu à l'expéditeur
        sms: (d, ctx) => `${SMS_PREFIX}votre billet ${smsVar(text(d, 'title'), 30)} n'a pas été accepté à temps : il vous revient. ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    TRANSFER_CLAIMED_SENDER: define('TRANSFER_CLAIMED_SENDER', {
        label: 'Transfert accepté (expéditeur)', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        night: 'DEFER',
        link: () => '/tickets?tab=a-venir',
        inApp: (d) => ({ title: 'Billet accepté', content: `Votre billet pour ${q(text(d, 'title'))} a été accepté par son destinataire.` }),
        sms: (d, ctx) => `${SMS_PREFIX}votre billet ${smsVar(text(d, 'title'), 30)} a été accepté par son destinataire. ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    // Lot 7 (7.9, D88, D91, D94) : canal EMAIL ajouté (registre : migration 20261105000007) ; NOUVEAU numéro du
    // billet (le transfert le renouvelle) et date dans l'in-app ; sans numéro (ligne d'avant la migration), texte du
    // lot 6. Aucun montant ni prix.
    TRANSFER_RECEIVED: define('TRANSFER_RECEIVED', {
        label: 'Billet reçu', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: ticketPath,
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
    // Lot 9 bis (11.2 M4, R78) : avis regroupé par commande (ticket_count), + EMAIL (G.49).
    TICKET_SCANNED: define('TICKET_SCANNED', {
        label: 'Entrée validée', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_SCANNED',
        link: scannedPath,
        inApp: (d) => {
            const n = optNum(d, 'ticket_count') === null ? 1 : count(d, 'ticket_count');
            return {
                title: 'Entrée validée',
                content: n > 1
                    ? `${n} billets de votre commande pour ${q(text(d, 'title'))} ont été contrôlés à l'entrée.`
                    : `Votre billet pour ${q(text(d, 'title'))} a été contrôlé à l'entrée.`,
            };
        },
        sample: { ...SAMPLE_EVENT, ticket_id: SAMPLE_ID.ticket },
    }),
    EVENT_CANCELLED: define('EVENT_CANCELLED', {
        label: 'Annulation d’un événement', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        link: (d) => (text(d, 'refund_mode') === 'TRANSFERRED' ? '/tickets?tab=historique' : eventTicketsPath(d)),
        inApp: (d) => {
            const mode = text(d, 'refund_mode');
            const notice = optText(d, 'public_notice');
            const refund = mode === 'AUTO' ? ' Votre remboursement est en cours.'
                : mode === 'ORGANIZER' ? ' Le remboursement se fait auprès de l\'organisateur.'
                    : mode === 'TRANSFERRED' ? ' Le remboursement va à l\'acheteur d\'origine du billet.' // lot 9 bis (R13)
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
            // Lot 9 bis (11.2 M2, R12, R23) : numéro seul (aucun compte), SMS sans lien.
            if (optText(d, 'recipient_kind') === 'PHONE') {
                if (mode === 'ORGANIZER') return `${head} Remboursement par l'organisateur.`;
                if (mode === 'NONE') return `${head} Le billet qui vous était destiné n'est plus valable.`;
                throw new TemplateDataError('refund_mode', 'inconnu pour un numéro seul (ORGANIZER ou NONE attendu)');
            }
            if (mode === 'AUTO') return `${head} Remboursement automatique en cours. ${tickets}`;
            if (mode === 'TRANSFERRED') return `${head} Remboursement à l'acheteur d'origine. ${tickets}`; // lot 9 bis (R13)
            if (mode === 'ORGANIZER') return `${head} Remboursement par l'organisateur. ${tickets}`;
            if (mode === 'NONE') return `${head} Détails : ${tickets}`;
            throw new TemplateDataError('refund_mode', 'inconnu');
        },
        sample: { ...SAMPLE_EVENT, public_notice: 'Intempéries annoncées sur Dakar.', refund_mode: 'AUTO' },
    }),
    EVENT_SUSPENDED_HOLDER: define('EVENT_SUSPENDED_HOLDER', {
        label: 'Suspension d’un événement (porteurs)', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'EVENT_STATUS', link: eventTicketsPath, // carte B3 (25/11) : « Mes billets », la fiche suspendue est neutre
        inApp: (d) => ({ title: 'Événement suspendu', content: `${q(text(d, 'title'))} est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.` }),
        sms: (d) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.`,
        sample: { ...SAMPLE_EVENT },
    }),
    EVENT_REACTIVATED_HOLDER: define('EVENT_REACTIVATED_HOLDER', {
        label: 'Reprise d’un événement (porteurs)', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'EVENT_STATUS', link: eventPath,
        inApp: (d) => ({ title: 'Événement de nouveau en ligne', content: `${q(text(d, 'title'))} reprend comme prévu. Vos billets restent valables.` }),
        sms: (d) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} reprend comme prévu. Vos billets restent valables.`,
        sample: { ...SAMPLE_EVENT },
    }),
    // Lot 9 bis (11.2 M1, R14) : indispensable, sans sujet, + EMAIL ; variantes report (R32) et adresse retirée (R80).
    EVENT_CHANGED: define('EVENT_CHANGED', {
        label: 'Changement d’un événement', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        // Contre-vérification du lot 11c-b (T2) : report qui ouvre le remboursement → les billets du compte pour cet
        // événement (/tickets/<événement>, où sont « Me faire rembourser » et, pour le titulaire d'une table, « Ma table »)
        inAppType: 'EVENT_CHANGE', link: (d) => (refundOpen(d) ? eventTicketsPath(d) : eventPath(d)),
        inApp: eventChangedInApp,
        sms: eventChangedSms,
        sample: { ...SAMPLE_EVENT, changed_fields: ['start_date', 'start_time'], new_start_at: '2026-11-21T21:00:00.000Z' },
    }),
    REMINDER_J1: define('REMINDER_J1', {
        label: 'Rappel la veille', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'REMINDER', link: eventTicketsPath,
        inApp: (d) => ({
            title: 'Rappel : c\'est demain',
            content: `${q(text(d, 'title'))} demain à ${formatTime(iso(d, 'start_at'))}, ${text(d, 'location')}, ${text(d, 'city')}. Vos billets sont dans Mes billets.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}rappel, ${smsVar(text(d, 'title'), 30)} demain à ${smsTime(iso(d, 'start_at'))}, ${endWithPeriod(smsVar(text(d, 'location'), 30))} Vos billets : ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, sms_policy: 'ALWAYS' },
    }),
    REMINDER_H3: define('REMINDER_H3', {
        label: 'Rappel avant le début', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'REMINDER', link: eventTicketsPath,
        inApp: (d) => ({
            title: 'C\'est bientôt',
            // Lot 7 (D33) : le billet reste présentable sans réseau (7.1) ; lien et SMS inchangés.
            content: `${q(text(d, 'title'))} commence à ${formatTime(iso(d, 'start_at'))} (${text(d, 'location')}). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 25)} à ${smsTime(iso(d, 'start_at'))}. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, sms_policy: 'IF_NO_PUSH' },
    }),
    REFUND_REQUESTED: define('REFUND_REQUESTED', {
        label: 'Remboursement demandé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_REQUESTED',
        link: eventTicketsPath,
        // Finition 4 (point 4, E-45) : qui a lancé le remboursement (by) ; SMS et push seulement quand ce n'est pas le client
        // (la mise en file restreint les canaux : le client et l'annulation n'ont ni SMS ni, pour l'annulation, de push)
        inApp: (d) => {
            const by = refundBy(d);
            if (by === 'ORGANIZER' || by === 'ADMIN') {
                const who = by === 'ADMIN' ? 'l\'équipe Event Village' : 'l\'organisateur';
                return {
                    title: by === 'ADMIN' ? 'Billet annulé par Event Village' : 'Billet annulé par l\'organisateur',
                    content: `Votre billet pour ${q(text(d, 'title'))} est annulé par ${who}. Le remboursement de ${money(d, 'amount')} est lancé sur votre compte ${operatorLabel(field(d, 'operator'))}. Vous serez prévenu dès qu'il est versé.`,
                };
            }
            return { title: 'Remboursement en cours', content: `Le remboursement de votre billet pour ${q(text(d, 'title'))} (${money(d, 'amount')}) est en cours. Vous serez prévenu dès qu'il est versé.` };
        },
        sms: (d) => {
            const by = refundBy(d);
            if (by === 'ORGANIZER' || by === 'ADMIN') {
                const who = by === 'ADMIN' ? 'l\'équipe Event Village' : 'l\'organisateur';
                return `${SMS_PREFIX}billet ${smsVar(text(d, 'title'), 25)} annulé par ${who} : remboursement de ${smsAmount(num(d, 'amount'))} en cours sur votre compte ${operatorLabel(field(d, 'operator'))}.`;
            }
            return `${SMS_PREFIX}le remboursement de votre billet ${smsVar(text(d, 'title'), 30)} (${smsAmount(num(d, 'amount'))}) est en cours.`;
        },
        sample: { ...SAMPLE_EVENT, cashout_id: SAMPLE_ID.cashout, amount: 5_000, operator: 'ORANGE_MONEY', by: 'ORGANIZER' },
    }),
    REFUND_PAID: define('REFUND_PAID', {
        label: 'Remboursement versé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROCESSED',
        link: eventTicketsOrHistory,
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
        label: 'Mot de passe modifié', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: 'SECURITY',
        link: () => '/profile',
        inApp: () => ({
            title: 'Mot de passe modifié',
            // Lot 9 quinquies (B1 : AUTH-06) : action immédiate (« Mot de passe oublié ») et page d'aide pour le support
            content: 'Le mot de passe de votre compte a été modifié. Si ce n\'est pas vous : utilisez « Mot de passe oublié » sur la page de connexion, puis ouvrez la page Aide pour joindre le support.',
        }),
        // Lot 9 quinquies (B1) : texte du chef de projet ; « défini ou » retiré (163 septets sinon), l'activation d'un compte
        // ne produit plus cet avis (A2)
        sms: (_d, ctx) => `${SMS_PREFIX}le mot de passe de votre compte a été modifié. Si ce n'est pas vous : Mot de passe oublié sur ${appLink(ctx, '/forgot-password')}`,
        sample: {},
    }),
    // Lot 9 (9.2, L30) : SMS à l'ancien numéro, sans lien ni compte. Lot 9 bis (11.2 M22, G.49) : + EMAIL au compte
    // (seconde mise en file par account_phone_finalize), fond « Numéro de téléphone modifié », bouton vers le profil.
    PHONE_CHANGED: define('PHONE_CHANGED', {
        label: 'Numéro de téléphone modifié', channels: ['SMS', 'EMAIL'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: null,
        link: () => '/profile',
        inApp: () => ({
            title: 'Numéro de téléphone modifié',
            content: 'Le numéro de téléphone de votre compte a été modifié. Si ce n\'est pas vous, ouvrez la page Aide pour joindre le support.',
        }),
        sms: (_d, ctx) => `${SMS_PREFIX}le numéro de votre compte a été modifié. Si ce n'est pas vous : ${appLink(ctx, '/aide')}`,
        sample: {},
    }),
    // Lot 9 quater (A9 : AUD-34) : l'adresse en attente sur ce compte vient d'être validée par un autre compte ; elle
    // reste en attente ici jusqu'à la confirmation par le titulaire (son lien répond alors « adresse déjà utilisée »).
    EMAIL_CLAIMED_ELSEWHERE: define('EMAIL_CLAIMED_ELSEWHERE', {
        label: 'Adresse email validée par un autre compte', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: 'SECURITY',
        link: () => '/profile',
        inApp: () => ({
            title: 'Adresse email validée par un autre compte',
            content: 'L’adresse email en attente sur votre compte vient d’être validée par un autre compte Event Village. Si c’est votre adresse, ne cliquez sur aucun lien que vous n’avez pas demandé et ouvrez la page Aide pour joindre le support.',
        }),
        sms: (_d, ctx) => `${SMS_PREFIX}l'adresse email en attente sur votre compte a été validée par un autre compte. Si c'est votre adresse : ${appLink(ctx, '/aide')}`,
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
        // Finition 4 (point 1) : décision de l'administration sans urgence, reportée à 07:00 si prise la nuit
        night: 'DEFER',
        link: (d) => partnerEventPath(d),
        // Finition 2b (D, E-25) : les prochaines étapes dans la cloche, le push (sans coupure) et l'email ; SMS inchangé
        inApp: (d) => ({
            title: 'Événement validé',
            content: `${q(text(d, 'title'))} est validé. Prochaines étapes : réglez les portes, invitez vos contrôleurs, générez le code PIN de caisse, puis publiez-le.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}votre événement ${smsVar(text(d, 'title'), 30)} est validé. Publiez-le depuis votre espace : ${appLink(ctx, '/partner/events')}`,
        emailBlocks: () => ({
            list: {
                title: 'Prochaines étapes',
                items: [
                    'Régler les portes et les zones : étape « Contrôle à l’entrée » de l’événement.',
                    'Inviter vos contrôleurs : onglet Équipe de l’événement.',
                    'Générer le code PIN de caisse : onglet Caisse de l’événement.',
                    'Publier l’événement : il est alors en vente.',
                ],
            },
            // Bouton générique (contrat G4, notif-modeles) : il mène au lien du type, la fiche de l'événement
            ctaLabel: 'Ouvrir Event Village',
        }),
        sample: { ...SAMPLE_EVENT },
    }),
    EVENT_REJECTED: define('EVENT_REJECTED', {
        label: 'Événement non validé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        // Finition 4 (point 1) : décision de l'administration sans urgence, reportée à 07:00 si prise la nuit
        night: 'DEFER',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement non validé', content: `${q(text(d, 'title'))} n'est pas validé. Motif : ${sentence(text(d, 'reason'))}` }),
        sms: (d, ctx) => `${SMS_PREFIX}événement ${smsVar(text(d, 'title'), 25)} non validé. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 40))} ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT, reason: 'Affiche illisible, merci d’en déposer une nouvelle.' },
    }),
    EVENT_SUSPENDED: define('EVENT_SUSPENDED', {
        label: 'Événement suspendu', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement suspendu', content: `${q(text(d, 'title'))} est suspendu par l'administration. Motif : ${sentence(text(d, 'reason'))} Pour en parler, ouvrez la page Aide et joignez le support.` }), // finition 5 (point 4) : quoi faire ensuite
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
        label: 'Événement publié par l’administration', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        night: 'DEFER',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({ title: 'Événement publié', content: `${q(text(d, 'title'))} a été publié par l'administration.` }),
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} a été publié par l'administration. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    FIRST_TICKET_SOLD: define('FIRST_TICKET_SOLD', {
        label: 'Premier billet vendu', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: 'SALES', link: (d) => partnerEventPath(d, 'ventes'),
        inApp: (d) => ({ title: 'Premier billet vendu', content: `Le premier billet de ${q(text(d, 'title'))} est vendu.` }),
        sms: (d, ctx) => `${SMS_PREFIX}premier billet vendu pour ${endWithPeriod(smsVar(text(d, 'title'), 30))} Suivez vos ventes : ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    NEW_ORDER: define('NEW_ORDER', {
        label: 'Nouvelle commande', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channels: ['IN_APP'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: 'SALES', link: (d) => partnerEventPath(d, 'ventes'),
        // Finition 4 (point 2) : cloche groupée toutes les 15 minutes (order_count commandes depuis since) ; pas de push : un type
        // facultatif qui a le push doit avoir l'email (G.50), un email toutes les 15 minutes serait de trop
        inApp: (d) => {
            const orders = optNum(d, 'order_count') === null ? 1 : count(d, 'order_count');
            const tickets = plural(count(d, 'ticket_count'), 'billet vendu', 'billets vendus');
            if (orders > 1) {
                return {
                    title: 'Nouvelles ventes',
                    content: `${tickets} pour ${q(text(d, 'title'))} en ${orders} commandes depuis ${formatTime(iso(d, 'since'))} (+${money(d, 'total')}).`,
                };
            }
            return { title: 'Nouvelle commande', content: `${tickets} pour ${q(text(d, 'title'))} (+${money(d, 'total')}).` };
        },
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
        // Finition 4 (point 2) : avis unique quand la dernière catégorie part (category : son nom)
        inApp: (d) => {
            const last = optText(d, 'category');
            return {
                title: 'Événement complet',
                content: `Toutes les catégories de ${q(text(d, 'title'))} sont vendues${last ? `, la dernière : ${q(last)}` : ''}.`,
            };
        },
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} est complet, toutes les catégories sont vendues. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    SHIFT_DISCREPANCY: define('SHIFT_DISCREPANCY', {
        label: 'Écart de caisse', channels: ['IN_APP', 'SMS', 'PUSH', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'ALERT',
        link: (d) => partnerEventPath(d, 'caisse'),
        inApp: (d) => {
            const justification = optText(d, 'justification');
            return {
                title: 'Écart de caisse',
                // Design 1c : l'écart en mots, « Il manque … » ou « … de trop »
                content: `La caisse de ${text(d, 'controller_name')} pour ${q(text(d, 'title'))} est fermée. ${cashGapText(num(d, 'difference'), formatFcfa)}${justification ? ` Justification : ${sentence(justification)}` : ''}`,
            };
        },
        sms: (d, ctx) => `${SMS_PREFIX}caisse de ${smsVar(text(d, 'controller_name'), 20)} fermée (${smsVar(text(d, 'title'), 25)}). ${cashGapText(num(d, 'difference'), smsAmount)} ${appLink(ctx, '/partner/events')}`,
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
        // Finition 4 (point 5, E-33) : « constaté non versé » (not_paid) : rien n'est parti, l'opérateur n'a rien refusé
        inApp: (d) => (field(d, 'not_paid') === true
            ? { title: 'Retrait non versé', content: `Votre retrait de ${money(d, 'amount')} n'a pas été versé. Le montant est revenu sur votre solde : vous pouvez demander un nouveau retrait.` }
            : { title: 'Retrait refusé', content: `Votre retrait de ${money(d, 'amount')} a été refusé par l'opérateur. Le montant est revenu sur votre solde.` }),
        sms: (d) => (field(d, 'not_paid') === true
            ? `${SMS_PREFIX}votre retrait de ${smsAmount(num(d, 'amount'))} n'a pas été versé. Le montant est revenu sur votre solde.`
            : `${SMS_PREFIX}votre retrait de ${smsAmount(num(d, 'amount'))} a été refusé par l'opérateur. Le montant est revenu sur votre solde.`),
        sample: { ...SAMPLE_MONEY },
    }),
    WITHDRAWAL_UNCERTAIN: define('WITHDRAWAL_UNCERTAIN', {
        label: 'Retrait en vérification', channels: ['IN_APP', 'SMS', 'PUSH', 'EMAIL'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'WITHDRAWAL_PENDING_CHECK',
        link: withdrawalPath,
        inApp: (d) => ({ title: 'Retrait en vérification', content: `Votre retrait de ${money(d, 'amount')} est en vérification auprès de l'opérateur. Aucune action n'est nécessaire.` }),
        sms: (d) => `${SMS_PREFIX}votre retrait de ${smsAmount(num(d, 'amount'))} est en vérification auprès de l'opérateur. Aucune action de votre part.`,
        sample: { ...SAMPLE_MONEY },
    }),
    CANCEL_REFUNDS_DONE: define('CANCEL_REFUNDS_DONE', {
        label: 'Remboursements d’une annulation terminés', channels: ['IN_APP', 'EMAIL', 'PUSH', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROGRESS',
        night: 'DEFER',
        link: (d) => partnerEventPath(d, 'cloture'),
        inApp: (d) => ({ title: 'Remboursements terminés', content: `Tous les remboursements en ligne de ${q(text(d, 'title'))} sont versés.` }),
        sms: (d, ctx) => `${SMS_PREFIX}tous les remboursements en ligne de ${smsVar(text(d, 'title'), 30)} sont versés. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    CANCEL_REFUNDS_BLOCKED: define('CANCEL_REFUNDS_BLOCKED', {
        label: 'Remboursements d’une annulation bloqués', channels: ['IN_APP', 'EMAIL', 'PUSH', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROGRESS',
        link: (d) => partnerEventPath(d, 'cloture'),
        inApp: (d) => ({ title: 'Remboursements en attente', content: `Des remboursements de ${q(text(d, 'title'))} sont bloqués : l'administration les reprend.` }),
        sms: (d, ctx) => `${SMS_PREFIX}des remboursements de ${smsVar(text(d, 'title'), 30)} sont bloqués : l'administration les reprend. ${appLink(ctx, '/partner/events')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    // Lot 9 quinquies (C3 : AUTH-12) : + SMS (l'email de la partenaire n'est pas encore vérifié à l'inscription). Texte du
    // chef de projet, « reçue » remplacé par « enregistrée » (ç hors GSM-7).
    PARTNER_REGISTERED_ACK: define('PARTNER_REGISTERED_ACK', {
        label: 'Inscription partenaire reçue', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Inscription reçue', content: `Votre demande de compte partenaire ${q(text(d, 'company'))} est en cours d'examen. Vous serez prévenu de la décision ici et par email.` }), // finition 5 (point 4)
        sms: (d) => `${SMS_PREFIX}votre demande de compte partenaire ${smsVar(text(d, 'company'), 40)} est enregistrée. Réponse sous 48 h.`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    PARTNER_VALIDATED: define('PARTNER_VALIDATED', {
        label: 'Compte partenaire validé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        night: 'DEFER',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Compte partenaire validé', content: `Votre compte partenaire ${q(text(d, 'company'))} est validé. Vous pouvez créer et publier vos événements.` }),
        sms: (d, ctx) => `${SMS_PREFIX}votre compte partenaire ${smsVar(text(d, 'company'), 30)} est validé. Connectez-vous : ${appLink(ctx, '/login')}`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    PARTNER_REJECTED: define('PARTNER_REJECTED', {
        // Lot 9 bis (11.2 M8, R54) : le dossier refusé peut être complété une fois.
        label: 'Demande de compte partenaire refusée', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        night: 'DEFER',
        link: () => '/partner/dashboard',
        // Finition 4 (point 5, E-43) : second refus (dossier déjà complété une fois) : la suite est le support ; le SMS dit la suite
        inApp: (d) => ({
            title: 'Demande refusée',
            content: field(d, 'resubmitted') === true
                ? `Votre demande de compte partenaire n'est pas acceptée. Motif : ${sentence(text(d, 'reason'))} Votre dossier a déjà été complété une fois : ouvrez la page Aide pour joindre le support.`
                : `Votre demande de compte partenaire n'est pas acceptée. Motif : ${sentence(text(d, 'reason'))} Vous pouvez compléter votre dossier une fois depuis votre tableau de bord.`,
        }),
        sms: (d, ctx) => (field(d, 'resubmitted') === true
            ? `${SMS_PREFIX}demande partenaire refusée. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 34))} Dossier déjà complété une fois. Aide : ${appLink(ctx, '/aide')}`
            : `${SMS_PREFIX}demande partenaire refusée. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 34))} Complétez votre dossier : ${appLink(ctx, '/partner/dashboard')}`),
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events', reason: 'Pièce d’identité illisible.' },
    }),
    PARTNER_SUSPENDED: define('PARTNER_SUSPENDED', {
        label: 'Compte partenaire suspendu', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'KYC',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Compte suspendu', content: `Votre compte partenaire est suspendu. Motif : ${sentence(text(d, 'reason'))} Ouvrez la page Aide pour joindre le support.` }),
        // Lot 9 quinquies (B1) : lien de la page d'aide au lieu de « Contactez le support. » ; motif ramené à 40 septets
        sms: (d, ctx) => `${SMS_PREFIX}votre compte partenaire est suspendu. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 40))} Aide : ${appLink(ctx, '/aide')}`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events', reason: 'Signalements de fraude en cours d’examen.' },
    }),
    PARTNER_REACTIVATED: define('PARTNER_REACTIVATED', {
        label: 'Compte partenaire réactivé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'KYC',
        night: 'DEFER',
        link: () => '/partner/dashboard',
        inApp: () => ({ title: 'Compte réactivé', content: 'Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements.' }),
        sms: (_d, ctx) => `${SMS_PREFIX}votre compte partenaire est réactivé. Connectez-vous : ${appLink(ctx, '/login')}`,
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    // Lot 9 bis (11.2 M5, R31) : SMS retiré (décision), + EMAIL (G.49).
    TRIAL_STARTED: define('TRIAL_STARTED', {
        label: 'Période d’essai activée', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'TRIAL',
        link: () => '/partner/dashboard',
        inApp: (d) => ({ title: 'Période d\'essai activée', content: `Votre période d'essai de ${count(d, 'days')} jours commence aujourd'hui. Créez votre premier événement depuis votre tableau de bord.` }), // finition 5 (point 4)
        sample: { partner_id: SAMPLE_ID.partner, days: 60 },
    }),
    SUBSCRIPTION_ACTIVATED: define('SUBSCRIPTION_ACTIVATED', {
        label: 'Abonnement activé', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'SUBSCRIPTION_ACTIVATED',
        link: () => '/partner/subscription',
        inApp: (d) => ({ title: 'Abonnement activé', content: `Votre pack ${q(text(d, 'plan'))} est activé pour ${count(d, 'days')} jours.` }),
        sample: { partner_id: SAMPLE_ID.partner, plan_id: 'pro', plan: 'Pro', days: 30 },
    }),
    PAYMENT_SUCCESS: define('PAYMENT_SUCCESS', {
        label: 'Paiement confirmé', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'PAYMENT_SUCCESS',
        link: (d) => (field(d, 'payment_target') === 'SUBSCRIPTION' ? '/partner/subscription' : '/orders'),
        inApp: (d) => ({ title: 'Paiement confirmé', content: `Votre paiement de ${money(d, 'amount')} a été validé.` }),
        sample: { payment_id: SAMPLE_ID.payment, amount: 15_000 },
    }),
    // Lot 10a : parcours de réservation d'une salle (avis mis en file par hall_reserve, hall_payment_confirm,
    // hall_cancel_apply, hall_reservations_tick, hall_validation_decide et notif_cashouts_notify). Lot 10b, décision du
    // client : chaque étape sur les 4 canaux (cloche, push, email, SMS d'un segment GSM-7). Liens vers « Mes
    // réservations » (client) ou la réservation dans l'espace de la salle (partenaire). Aucun mot technique.
    HALL_RESERVATION_PENDING: define('HALL_RESERVATION_PENDING', {
        label: 'Réservation de salle demandée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'HALL_RESERVATION',
        link: (d) => hallClientLink(d),
        inApp: (d) => ({
            title: 'Réservation demandée',
            content: `Votre demande pour ${hallName(d)} ${hallPeriod(d)} est enregistrée. Payez ${money(d, 'amount_due')} avant ${formatTime(iso(d, 'hold_expires_at'))} pour garder la date : sans paiement, elle sera libérée.`,
        }),
        sms: (d) => `${SMS_PREFIX}réservation demandée : ${smsVar(text(d, 'hall_name'), 25)}, ${dot(smsHallPeriod(d))} Payez ${smsAmount(num(d, 'amount_due'))} avant ${smsTime(iso(d, 'hold_expires_at'))} pour garder la date.`,
        sample: { ...HALL_SAMPLE_DATA, paid_amount: 0, amount_due: 126000, hold_expires_at: '2026-11-20T14:32:00Z', full_payment_required: false },
    }),
    HALL_RESERVATION_REQUESTED: define('HALL_RESERVATION_REQUESTED', {
        label: 'Nouvelle réservation de salle', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'HALL_RESERVATION',
        link: (d) => hallPartnerLink(d),
        inApp: (d) => ({
            title: 'Nouvelle réservation',
            content: `${hallName(d, true)} est réservée ${hallPeriod(d)}. ${hallPaidSentence(d)}`,
        }),
        sms: (d) => `${SMS_PREFIX}nouvelle réservation de ${smsVar(text(d, 'hall_name'), 25)}, ${dot(smsHallPeriod(d))} ${num(d, 'paid_amount') >= num(d, 'total_amount') ? `Payée : ${smsAmount(num(d, 'total_amount'))}.` : `Acompte payé : ${smsAmount(num(d, 'paid_amount'))}.`}`,
        sample: HALL_SAMPLE_DATA,
    }),
    HALL_RESERVATION_CONFIRMED: define('HALL_RESERVATION_CONFIRMED', {
        label: 'Réservation de salle confirmée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'HALL_RESERVATION',
        link: (d) => hallClientLink(d),
        inApp: (d) => ({
            title: 'Réservation confirmée',
            content: optNum(d, 'balance_amount') !== null
                ? `Votre réservation de ${hallName(d)} ${hallPeriod(d)} est confirmée. Il reste ${money(d, 'balance_amount')} à payer au plus tard le ${formatDate(iso(d, 'balance_due_at'))}, sinon elle sera annulée.`
                : `Votre réservation de ${hallName(d)} ${hallPeriod(d)} est confirmée et entièrement payée.`,
        }),
        sms: (d) => optNum(d, 'balance_amount') !== null
            ? `${SMS_PREFIX}réservation confirmée : ${smsVar(text(d, 'hall_name'), 25)}, ${dot(smsHallPeriod(d))} Reste ${smsAmount(num(d, 'balance_amount'))} à payer avant le ${dot(smsDay(iso(d, 'balance_due_at')))}`
            : `${SMS_PREFIX}réservation confirmée et payée : ${smsVar(text(d, 'hall_name'), 25)}, ${dot(smsHallPeriod(d))} Merci !`,
        sample: { ...HALL_SAMPLE_DATA, balance_amount: 294000, balance_due_at: '2026-11-28T00:00:00Z' },
    }),
    HALL_BALANCE_PAID: define('HALL_BALANCE_PAID', {
        label: 'Solde d’une réservation de salle payé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: 'HALL_RESERVATION',
        link: (d) => (text(d, 'recipient_role') === 'PARTNER' ? hallPartnerLink(d) : hallClientLink(d)),
        inApp: (d) => ({
            title: 'Réservation payée',
            content: text(d, 'recipient_role') === 'PARTNER'
                ? `Le client a payé le solde de la réservation de ${hallName(d)} ${hallPeriod(d)} : ${money(d, 'total_amount')} au total.`
                : `Vous avez payé le solde : votre réservation de ${hallName(d)} ${hallPeriod(d)} est entièrement payée.`,
        }),
        sms: (d) => (text(d, 'recipient_role') === 'PARTNER'
            ? `${SMS_PREFIX}le client a payé le solde de ${smsVar(text(d, 'hall_name'), 25)}, ${dot(smsHallPeriod(d))} Total payé : ${smsAmount(num(d, 'total_amount'))}.`
            : `${SMS_PREFIX}solde payé, merci ! Votre réservation de ${smsVar(text(d, 'hall_name'), 25)}, ${smsHallPeriod(d)}, est entièrement payée.`),
        sample: { ...HALL_SAMPLE_DATA, paid_amount: 420000, recipient_role: 'CLIENT' },
    }),
    HALL_BALANCE_REMINDER: define('HALL_BALANCE_REMINDER', {
        // Contre-vérification du lot 10b (T8) : non urgent, SMS et push préparés la nuit reportés à sa fin (finition 4)
        label: 'Rappel du solde d’une réservation de salle', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'HALL_RESERVATION',
        link: (d) => hallClientLink(d),
        inApp: (d) => ({
            title: 'Solde à payer',
            content: `Il reste ${money(d, 'balance_amount')} à payer pour votre réservation de ${hallName(d)} ${hallPeriod(d)}, au plus tard le ${formatDate(iso(d, 'balance_due_at'))}. Sans paiement, la réservation sera annulée.`,
        }),
        sms: (d) => `${SMS_PREFIX}il reste ${smsAmount(num(d, 'balance_amount'))} à payer pour ${smsVar(text(d, 'hall_name'), 25)} avant le ${dot(smsDay(iso(d, 'balance_due_at')))} Sans paiement, la réservation sera annulée.`,
        sample: { ...HALL_SAMPLE_DATA, balance_amount: 294000, balance_due_at: '2026-11-28T00:00:00Z', step: 'J10' },
    }),
    HALL_PAYMENT_DEADLINE_PASSED: define('HALL_PAYMENT_DEADLINE_PASSED', {
        label: 'Délai de paiement d’une réservation de salle dépassé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'HALL_RESERVATION',
        link: (d) => hallClientLink(d),
        inApp: (d) => ({
            title: 'Délai de paiement dépassé',
            content: `Le solde n’a pas été payé à temps : votre réservation de ${hallName(d)} ${hallPeriod(d)} est annulée. ${hallRefundSentence(d)}`,
        }),
        sms: (d) => `${SMS_PREFIX}délai de paiement dépassé, réservation annulée : ${dot(smsVar(text(d, 'hall_name'), 25))} ${smsHallRefund(d)}`,
        sample: { ...HALL_SAMPLE_DATA, origin: 'DELAI', refund_amount: 63000, refund_percent: 50 },
    }),
    HALL_RESERVATION_CANCELLED: define('HALL_RESERVATION_CANCELLED', {
        label: 'Réservation de salle annulée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'HALL_RESERVATION',
        link: (d) => hallClientLink(d),
        inApp: (d) => {
            const origin = text(d, 'origin');
            const reason = optText(d, 'reason');
            const who = origin === 'SALLE' ? 'par la salle' : origin === 'EVENT_VILLAGE' ? 'par Event Village' : '';
            return {
                title: 'Réservation annulée',
                content: `Votre réservation de ${hallName(d)} ${hallPeriod(d)} est annulée${who ? ` ${who}` : ''}.${reason ? ` Motif : ${sentence(reason)}` : ''} ${hallRefundSentence(d)}`,
            };
        },
        sms: (d) => {
            const origin = text(d, 'origin');
            const name = smsVar(text(d, 'hall_name'), 25);
            if (origin === 'SALLE' || origin === 'EVENT_VILLAGE') {
                return `${SMS_PREFIX}${origin === 'SALLE' ? 'la salle' : 'notre équipe'} a annulé votre réservation : ${dot(name)} Remboursement total de ${smsAmount(num(d, 'refund_amount'))} en cours.`;
            }
            return `${SMS_PREFIX}réservation annulée : ${dot(name)} ${smsHallRefund(d)}`;
        },
        sample: { ...HALL_SAMPLE_DATA, origin: 'SALLE', refund_amount: 126000, refund_percent: 100, reason: 'Travaux imprévus dans la salle.' },
    }),
    HALL_RESERVATION_CANCELLED_PRO: define('HALL_RESERVATION_CANCELLED_PRO', {
        label: 'Réservation de salle annulée (salle)', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'HALL_RESERVATION',
        link: (d) => hallPartnerLink(d),
        inApp: (d) => {
            const origin = text(d, 'origin');
            const how = origin === 'CLIENT' ? 'par le client' : origin === 'SALLE' ? 'par vous' : origin === 'EVENT_VILLAGE' ? 'par Event Village' : 'faute de paiement du solde à temps';
            return {
                title: 'Réservation annulée',
                content: `La réservation de ${hallName(d)} ${hallPeriod(d)} est annulée ${how}. Le client récupère ${money(d, 'refund_amount')} ; la date est de nouveau libre.`,
            };
        },
        sms: (d) => {
            const origin = text(d, 'origin');
            const how = origin === 'CLIENT' ? 'par le client' : origin === 'SALLE' ? 'par vous' : origin === 'EVENT_VILLAGE' ? 'par notre équipe' : 'faute de paiement';
            return `${SMS_PREFIX}réservation annulée ${how} : ${smsVar(text(d, 'hall_name'), 25)}, ${dot(smsHallPeriod(d))} Le client récupère ${smsAmount(num(d, 'refund_amount'))}. La date est libre.`;
        },
        sample: { ...HALL_SAMPLE_DATA, origin: 'CLIENT', refund_amount: 63000, refund_percent: 50 },
    }),
    HALL_PAYMENT_REFUNDED: define('HALL_PAYMENT_REFUNDED', {
        label: 'Paiement de salle remboursé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'HALL_RESERVATION',
        link: (d) => hallClientLink(d),
        inApp: (d) => ({
            title: 'Paiement remboursé',
            content: `Votre paiement de ${money(d, 'amount')} pour ${hallName(d)} est arrivé alors que la réservation n’était plus possible (date reprise, réservation annulée ou déjà payée). Il vous est remboursé sur votre compte ${operatorLabel(field(d, 'operator'))}.`,
        }),
        sms: (d) => `${SMS_PREFIX}votre paiement de ${smsAmount(num(d, 'amount'))} pour ${smsVar(text(d, 'hall_name'), 25)} n'a pas pu servir. Il vous est remboursé sur ${operatorLabel(field(d, 'operator'))}.`,
        sample: { ...HALL_SAMPLE_DATA, paid_amount: 0, payment_id: SAMPLE_ID.payment, amount: 126000, operator: 'ORANGE_MONEY' },
    }),
    HALL_REFUND_PAID: define('HALL_REFUND_PAID', {
        label: 'Remboursement d’une réservation de salle versé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'HALL_RESERVATION',
        link: (d) => hallClientLink(d),
        inApp: (d) => ({
            title: 'Remboursement versé',
            content: `${money(d, 'amount')} vous ont été versés sur votre compte ${operatorLabel(field(d, 'operator'))} pour la réservation de ${hallName(d)} ${hallPeriod(d)}.`,
        }),
        sms: (d) => `${SMS_PREFIX}${smsAmount(num(d, 'amount'))} vous ont été versés sur ${operatorLabel(field(d, 'operator'))} pour la réservation de ${dot(smsVar(text(d, 'hall_name'), 25))}`,
        sample: { ...HALL_SAMPLE_DATA, cashout_id: SAMPLE_ID.payment, amount: 63000, operator: 'WAVE' },
    }),
    HALL_EVE_REMINDER: define('HALL_EVE_REMINDER', {
        label: 'Rappel la veille d’une réservation de salle', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'ANY', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'HALL_RESERVATION',
        link: (d) => (text(d, 'recipient_role') === 'PARTNER' ? hallPartnerLink(d) : hallClientLink(d)),
        inApp: (d) => ({
            title: 'C’est demain',
            content: text(d, 'recipient_role') === 'PARTNER'
                ? `${hallName(d, true)} est réservée demain${hallStartTime(d)}. Le client a tout payé.`
                : `Votre réservation de ${hallName(d)} commence demain${hallStartTime(d)}. Bonne fête !`,
        }),
        sms: (d) => (text(d, 'recipient_role') === 'PARTNER'
            ? `${SMS_PREFIX}rappel, ${smsVar(text(d, 'hall_name'), 25)} est réservée demain${hallStartTime(d)}. Le client a tout payé.`
            : `${SMS_PREFIX}rappel, votre réservation de ${smsVar(text(d, 'hall_name'), 25)} commence demain${hallStartTime(d)}. Profitez-en bien !`),
        sample: { ...HALL_SAMPLE_DATA, paid_amount: 420000, recipient_role: 'CLIENT' },
    }),
    HALL_EARNINGS_AVAILABLE: define('HALL_EARNINGS_AVAILABLE', {
        label: 'Recettes d’une réservation de salle disponibles', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: 'HALL_RESERVATION',
        link: (d) => hallPartnerLink(d),
        inApp: (d) => ({
            title: 'Recettes disponibles',
            content: `${money(d, 'earned')} de la réservation de ${hallName(d)} ${hallPeriod(d)} sont disponibles : vous pouvez les retirer depuis votre espace.`,
        }),
        sms: (d) => `${SMS_PREFIX}${smsAmount(num(d, 'earned'))} disponibles pour ${smsVar(text(d, 'hall_name'), 25)}, ${dot(smsHallPeriod(d))} Retrait depuis votre espace.`,
        sample: { ...HALL_SAMPLE_DATA, paid_amount: 420000, earned: 400000 },
    }),
    HALL_VALIDATION_DECIDED: define('HALL_VALIDATION_DECIDED', {
        label: 'Décision sur une salle', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'HALL_RESERVATION',
        link: (d) => `/partner/halls/${encodeURIComponent(text(d, 'hall_id'))}`,
        inApp: (d) => {
            const decision = text(d, 'decision');
            const reason = optText(d, 'reason');
            const name = hallName(d, true);
            if (decision === 'VALIDER') return { title: 'Salle validée', content: `${name} est validée : elle est visible et peut être réservée dès l’ouverture du service.` };
            if (decision === 'REACTIVER') return { title: 'Salle réactivée', content: `${name} est de nouveau visible et peut être réservée.` };
            if (decision === 'SUSPENDRE') return { title: 'Salle suspendue', content: `${name} est suspendue : elle n’est plus visible ni réservable.${reason ? ` Motif : ${sentence(reason)}` : ''} Les réservations déjà payées sont maintenues.` };
            return { title: 'Salle refusée', content: `${name} n’est pas acceptée.${reason ? ` Motif : ${sentence(reason)}` : ''} Modifiez-la puis renvoyez-la en validation.` };
        },
        sms: (d) => {
            const decision = text(d, 'decision');
            const name = smsVar(text(d, 'hall_name'), 30);
            const reason = optText(d, 'reason');
            if (decision === 'VALIDER') return `${SMS_PREFIX}votre salle ${name} est validée : elle sera visible et réservable.`;
            if (decision === 'REACTIVER') return `${SMS_PREFIX}votre salle ${name} est de nouveau visible et réservable.`;
            const what = decision === 'SUSPENDRE' ? 'est suspendue' : "n'est pas acceptée";
            return `${SMS_PREFIX}votre salle ${name} ${what}.${reason ? ` Motif : ${smsVar(reason, 60)}` : ''}`;
        },
        sample: { hall_id: SAMPLE_ID.reservation, hall_name: 'Salle des fêtes de Ngor', decision: 'REFUSER', reason: 'Photos manquantes.' },
    }),
    // Lot 11a : parcours de réservation d'une table (avis mis en file par table_reserve, table_payment_confirm,
    // table_close_apply, table_reservation_respond, table_reservations_tick et venue_validation_decide). Décision du
    // client : chaque étape sur les 4 canaux (cloche, push, email, SMS d'un segment GSM-7) ; le rappel est optionnel
    // (sujet « Rappels »). Aucun mot technique.
    // Lot 11b : chaque avis mène à la réservation (cloche, push, email : sa page ; SMS : lien court « /t/<code> ») et dit
    // quoi faire ensuite (« Répondez avant 21 h 30 », « Votre table est gardée jusqu'à 20 h 30 ») ; nuit : les avis non
    // urgents attendent 7 h sauf pour une réservation à moins de 12 h (night DEFER, finition 4).
    TABLE_RESERVATION_CONFIRMED: define('TABLE_RESERVATION_CONFIRMED', {
        label: 'Réservation de table confirmée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => ({
            title: 'Table réservée',
            content: `Votre table chez ${venueName(d)} est réservée ${tablePeriod(d)} pour ${guestsText(d)}. Elle vous est gardée jusqu’à ${hm(text(d, 'held_until'))}.${num(d, 'paid_amount') > 0 ? ` Acompte payé : ${money(d, 'paid_amount')}.${cancelFreeSentence(d)}` : ''} Un empêchement ? Annulez depuis votre réservation pour libérer la table.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}table chez ${smsVar(text(d, 'venue_name'), 22)} ${smsTablePeriod(d)}, ${count(d, 'guests')} pers. Gardée jusqu'à ${hm(text(d, 'held_until'))}. ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, cancel_free_until: '2026-12-05T18:00' },
    }),
    TABLE_REQUEST_SENT: define('TABLE_REQUEST_SENT', {
        label: 'Demande de table envoyée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => ({
            title: 'Demande envoyée',
            content: `Votre demande de table chez ${venueName(d)} ${tablePeriod(d)} pour ${guestsText(d)} est envoyée. L’établissement répond avant ${dueText(iso(d, 'response_due_at'))} : vous recevrez sa réponse ici. Sans réponse, la demande est annulée${num(d, 'paid_amount') > 0 ? ' et l’acompte vous est rendu' : ''}, vous n’avez rien à faire.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}demande envoyée à ${smsVar(text(d, 'venue_name'), 18)} pour ${smsTablePeriod(d)}, ${count(d, 'guests')} pers. Réponse avant ${dueText(iso(d, 'response_due_at'), new Date(), true)}. ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, response_due_at: '2030-12-05T18:00:00Z' },
    }),
    TABLE_REQUEST_TO_ANSWER: define('TABLE_REQUEST_TO_ANSWER', {
        label: 'Demande de table à accepter', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'TABLE_RESERVATION',
        link: (d) => tablePartnerLink(d),
        inApp: (d) => ({
            title: 'Demande à accepter',
            content: `Nouvelle demande chez ${venueName(d)} : ${guestsText(d)} ${tablePeriod(d)}${optText(d, 'table_number') ? `, table ${text(d, 'table_number')}` : ''}. Répondez avant ${dueText(iso(d, 'response_due_at'))} ; sans réponse, elle est annulée${num(d, 'paid_amount') > 0 ? ' et le client remboursé' : ''}.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}demande chez ${smsVar(text(d, 'venue_name'), 18)} : ${count(d, 'guests')} pers. ${smsTablePeriod(d)}. Répondez avant ${dueText(iso(d, 'response_due_at'), new Date(), true)}. ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, response_due_at: '2030-12-05T18:00:00Z' },
    }),
    TABLE_NEW_RESERVATION: define('TABLE_NEW_RESERVATION', {
        label: 'Nouvelle réservation de table', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'TABLE_RESERVATION',
        link: (d) => tablePartnerLink(d),
        inApp: (d) => ({
            title: 'Nouvelle réservation',
            content: `${venueName(d, true)} : ${guestsText(d)} ${tablePeriod(d)}${optText(d, 'table_number') ? `, table ${text(d, 'table_number')}` : ''}.${num(d, 'paid_amount') > 0 ? ` Acompte payé : ${money(d, 'paid_amount')}.` : ''} Elle est sur votre planning ; la table est gardée jusqu’à ${hm(text(d, 'held_until'))}.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}nouvelle réservation chez ${smsVar(text(d, 'venue_name'), 18)} : ${count(d, 'guests')} pers. ${dot(`${smsTablePeriod(d)}${optText(d, 'table_number') ? `, table ${smsVar(text(d, 'table_number'), 6)}` : ''}`)} ${tableSmsLink(d, ctx)}`,
        sample: TABLE_SAMPLE_DATA,
    }),
    TABLE_REQUEST_REFUSED: define('TABLE_REQUEST_REFUSED', {
        label: 'Demande de table refusée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => {
            const reason = optText(d, 'reason');
            return {
                title: 'Demande refusée',
                content: `${venueName(d, true)} ne peut pas vous recevoir ${tablePeriod(d)}.${reason ? ` Motif : ${sentence(reason)}` : ''} ${tableRefundSentence(d)} Choisissez une autre heure depuis la fiche de l’établissement.`.replace(/\s+/g, ' '),
            };
        },
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'venue_name'), 18)} ne peut pas vous recevoir ${smsTablePeriod(d)}. ${num(d, 'refund_amount') > 0 ? `${smsAmount(num(d, 'refund_amount'))} remboursés.` : 'Essayez une autre heure.'} ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, origin: 'REFUSEE', refund_amount: 21_000, refund_percent: 100, reason: 'Complet ce soir-là.' },
    }),
    TABLE_REQUEST_EXPIRED: define('TABLE_REQUEST_EXPIRED', {
        label: 'Demande de table sans réponse', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => ({
            title: 'Demande sans réponse',
            content: `${venueName(d, true)} n’a pas répondu à temps : votre demande ${tablePeriod(d)} est annulée. ${tableRefundSentence(d)} Vous pouvez réserver ailleurs ou à une autre heure.`.replace(/\s+/g, ' '),
        }),
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'venue_name'), 18)} n'a pas répondu à temps : demande du ${smsDay(iso(d, 'date'))} annulée.${num(d, 'refund_amount') > 0 ? ` ${smsAmount(num(d, 'refund_amount'))} remboursés.` : ''} ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, origin: 'SANS_REPONSE', refund_amount: 21_000, refund_percent: 100 },
    }),
    TABLE_HOLD_EXPIRED: define('TABLE_HOLD_EXPIRED', {
        label: 'Acompte de table non payé à temps', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => ({
            title: 'Acompte non payé à temps',
            content: `L’acompte n’a pas été payé à temps : la table chez ${venueName(d)} ${tablePeriod(d)} est libérée. Pour la garder, refaites une demande depuis la fiche de l’établissement.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}acompte non payé à temps : la table chez ${smsVar(text(d, 'venue_name'), 18)} ${smsTablePeriod(d)} est libérée. ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, paid_amount: 0 },
    }),
    TABLE_RESERVATION_CANCELLED: define('TABLE_RESERVATION_CANCELLED', {
        label: 'Réservation de table annulée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => {
            const origin = text(d, 'origin');
            const reason = optText(d, 'reason');
            const who = origin === 'ETABLISSEMENT' ? ' par l’établissement' : origin === 'EVENT_VILLAGE' ? ' par Event Village' : '';
            return {
                title: 'Réservation annulée',
                content: `Votre réservation chez ${venueName(d)} ${tablePeriod(d)} est annulée${who}.${reason ? ` Motif : ${sentence(reason)}` : ''} ${tableRefundSentence(d)}`.trim(),
            };
        },
        sms: (d, ctx) => {
            const origin = text(d, 'origin');
            const name = smsVar(text(d, 'venue_name'), 18);
            const refund = num(d, 'refund_amount') > 0 ? `${smsAmount(num(d, 'refund_amount'))} remboursés.`
                : num(d, 'paid_amount') > 0 ? 'Acompte non remboursé.' : '';
            const link = tableSmsLink(d, ctx);
            if (origin === 'ETABLISSEMENT') return `${SMS_PREFIX}${name} a annulé votre table ${smsTablePeriod(d)}. ${refund ? `${refund} ` : ''}${link}`;
            // Contre-vérification du lot 11b : 160 caractères pile au pire cas avec « notre équipe a annulé » ; 154 ici (au moins 5 de marge)
            if (origin === 'EVENT_VILLAGE') return `${SMS_PREFIX}nous avons annulé la table chez ${name} ${smsTablePeriod(d)}. ${refund ? `${refund} ` : ''}${link}`;
            return `${SMS_PREFIX}table chez ${name} ${smsTablePeriod(d)} annulée. ${refund ? `${refund} ` : ''}${link}`;
        },
        sample: { ...TABLE_SAMPLE_DATA, origin: 'ETABLISSEMENT', refund_amount: 21_000, refund_percent: 100, reason: 'Fermeture exceptionnelle : travaux dans la salle.' },
    }),
    TABLE_RESERVATION_CANCELLED_PRO: define('TABLE_RESERVATION_CANCELLED_PRO', {
        label: 'Réservation de table annulée (établissement)', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'TABLE_RESERVATION',
        link: (d) => tablePartnerLink(d),
        inApp: (d) => {
            const origin = text(d, 'origin');
            const how = origin === 'CLIENT' ? 'annulée par le client' : origin === 'EVENT_VILLAGE' ? 'annulée par Event Village'
                : origin === 'SANS_REPONSE' ? 'annulée faute de réponse dans le délai' : 'annulée';
            return {
                title: 'Réservation annulée',
                content: `La réservation chez ${venueName(d)} ${tablePeriod(d)} (${guestsText(d)}) est ${how}. ${num(d, 'refund_amount') > 0 ? `Le client récupère ${money(d, 'refund_amount')}. ` : ''}La table est de nouveau libre sur votre planning.`,
            };
        },
        sms: (d, ctx) => {
            const origin = text(d, 'origin');
            const name = smsVar(text(d, 'venue_name'), 18);
            if (origin === 'SANS_REPONSE') return `${SMS_PREFIX}demande chez ${name} ${smsTablePeriod(d)} (${count(d, 'guests')} pers.) annulée faute de réponse. ${tableSmsLink(d, ctx)}`;
            const by = origin === 'EVENT_VILLAGE' ? 'par Event Village' : 'par le client';
            return `${SMS_PREFIX}table chez ${name} ${smsTablePeriod(d)} (${count(d, 'guests')} pers.) annulée ${by}. Table libre. ${tableSmsLink(d, ctx)}`;
        },
        sample: { ...TABLE_SAMPLE_DATA, origin: 'CLIENT', refund_amount: 21_000, refund_percent: 100 },
    }),
    TABLE_NO_SHOW: define('TABLE_NO_SHOW', {
        label: 'Absence à une réservation de table', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => ({
            title: 'Absence constatée',
            content: `Vous n’êtes pas venu chez ${venueName(d)} ${tablePeriod(d)} : la table est libérée.${num(d, 'paid_amount') > 0 ? ' Selon les conditions de réservation, l’acompte n’est pas remboursé.' : ''} Une prochaine fois, annulez depuis votre réservation si vous avez un empêchement.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}absence constatée chez ${smsVar(text(d, 'venue_name'), 18)} ${smsTablePeriod(d)} : table libérée${num(d, 'paid_amount') > 0 ? ', acompte non remboursé.' : '.'} ${tableSmsLink(d, ctx)}`,
        sample: TABLE_SAMPLE_DATA,
    }),
    TABLE_PAYMENT_REFUNDED: define('TABLE_PAYMENT_REFUNDED', {
        label: 'Paiement de table remboursé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => ({
            title: 'Paiement remboursé',
            content: `Votre paiement de ${money(d, 'amount')} pour ${venueName(d)} est arrivé alors que la réservation n’était plus possible (table reprise, réservation annulée ou déjà payée). Il vous est remboursé sur votre compte ${operatorLabel(field(d, 'operator'))} : vous n’avez rien à faire.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}paiement de ${smsAmount(num(d, 'amount'))} pour ${smsVar(text(d, 'venue_name'), 18)} non utilisé, remboursé sur ${operatorLabel(field(d, 'operator'))}. ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, paid_amount: 0, payment_id: SAMPLE_ID.payment, amount: 21_000, operator: 'ORANGE_MONEY' },
    }),
    TABLE_REMINDER: define('TABLE_REMINDER', {
        label: 'Rappel de réservation de table', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'REMINDER',
        link: (d) => `${tableClientLink(d)}?rappel=1`,
        inApp: (d) => ({
            title: 'Votre table vous attend',
            content: `Votre table chez ${venueName(d)} vous attend ${tablePeriod(d)} pour ${guestsText(d)}, gardée jusqu’à ${hm(text(d, 'held_until'))}. Dites-le à l’établissement : « J’arrive » ou « Annuler » depuis votre réservation.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}votre table chez ${smsVar(text(d, 'venue_name'), 18)} à ${text(d, 'time')}, ${count(d, 'guests')} pers., gardée jusqu'à ${hm(text(d, 'held_until'))}. J'arrive ou annuler : ${tableSmsLink(d, ctx)}`,
        sample: TABLE_SAMPLE_DATA,
    }),
    TABLE_CLIENT_COMING: define('TABLE_CLIENT_COMING', {
        label: 'Client qui confirme sa venue', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'TABLE_RESERVATION',
        link: (d) => tablePartnerLink(d),
        inApp: (d) => ({
            title: 'Le client arrive',
            content: `Le client de ${guestsText(d)} ${tablePeriod(d)}${optText(d, 'table_number') ? ` (table ${text(d, 'table_number')})` : ''} chez ${venueName(d)} confirme sa venue. Table gardée jusqu’à ${hm(text(d, 'held_until'))} ; marquez-le « Client arrivé » à son arrivée.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}le client de ${count(d, 'guests')} pers. à ${text(d, 'time')}${optText(d, 'table_number') ? `, table ${smsVar(text(d, 'table_number'), 6)}` : ''}, confirme sa venue chez ${dot(smsVar(text(d, 'venue_name'), 18))} ${tableSmsLink(d, ctx)}`,
        sample: TABLE_SAMPLE_DATA,
    }),
    TABLE_REFUND_PAID: define('TABLE_REFUND_PAID', {
        label: 'Remboursement d’une table versé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TABLE_RESERVATION',
        link: (d) => tableClientLink(d),
        inApp: (d) => ({
            title: 'Remboursement versé',
            content: `Le remboursement de ${money(d, 'amount')} pour votre réservation chez ${venueName(d)} ${tablePeriod(d)} est versé sur votre compte ${operatorLabel(field(d, 'operator'))}. Vous n’avez rien à faire.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}remboursement de ${smsAmount(num(d, 'amount'))} versé sur ${operatorLabel(field(d, 'operator'))} pour la table chez ${dot(smsVar(text(d, 'venue_name'), 18))} ${tableSmsLink(d, ctx)}`,
        sample: { ...TABLE_SAMPLE_DATA, cashout_id: SAMPLE_ID.cashout, amount: 21_000, operator: 'ORANGE_MONEY' },
    }),
    // Lot 11c-a : tables d'un événement (une table = un lot de N billets, migration 20261201000006)
    EVENT_TABLE_CONFIRMED: define('EVENT_TABLE_CONFIRMED', {
        label: 'Table d’un événement réservée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET',
        link: myTablePath,
        inApp: (d) => ({
            title: 'Table réservée',
            content: `Votre table ${count(d, 'table_number')} (${text(d, 'table_type')}, ${plural(count(d, 'seats'), 'place', 'places')}) pour ${q(text(d, 'title'))} est réservée. Total payé : ${money(d, 'total')}. Envoyez les places à vos invités depuis Mes billets : chacun aura son billet.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}table ${count(d, 'table_number')} réservée pour ${smsVar(text(d, 'title'), 30)}, ${count(d, 'seats')} places. Envoyez-les à vos invités : ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, booking_id: '6d2f8a14-3c7e-4b9a-8e51-2a4c6e8b1d37', table_number: 12, seats: 6, table_type: 'Table VIP', zone: 'Carré VIP', payment_id: SAMPLE_ID.payment, total: 157_500, service_fee: 7_500 },
    }),
    EVENT_TABLE_SOLD: define('EVENT_TABLE_SOLD', {
        label: 'Table d’un événement vendue', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'SALES',
        link: (d) => partnerEventPath(d, 'ventes'),
        // Groupé (notif_enqueue_grouped, série de 30 minutes) : table_count tables et seat_count places depuis since
        inApp: (d) => {
            const tables = optNum(d, 'table_count') === null ? 1 : count(d, 'table_count');
            if (tables > 1) {
                return {
                    title: 'Tables vendues',
                    content: `${tables} tables vendues pour ${q(text(d, 'title'))}${optText(d, 'since') ? ` depuis ${formatTime(iso(d, 'since'))}` : ''} : ${plural(count(d, 'seat_count'), 'place', 'places')}, +${money(d, 'total')}.`,
                };
            }
            return { title: 'Table vendue', content: `Une table vendue pour ${q(text(d, 'title'))} : ${plural(count(d, 'seat_count'), 'place', 'places')}, +${money(d, 'total')}.` };
        },
        sms: (d, ctx) => {
            const tables = optNum(d, 'table_count') === null ? 1 : count(d, 'table_count');
            return `${SMS_PREFIX}${tables > 1 ? `${tables} tables vendues` : 'une table vendue'} pour ${smsVar(text(d, 'title'), 30)} (${count(d, 'seat_count')} places). ${appLink(ctx, '/partner/events')}`;
        },
        sample: { ...SAMPLE_EVENT, table_count: 1, seat_count: 6, total: 150_000 },
    }),
    EVENT_TABLE_SEATS_REMINDER: define('EVENT_TABLE_SEATS_REMINDER', {
        label: 'Places de table à envoyer', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'REMINDER', link: myTablePath,
        inApp: (d) => ({
            title: 'Vos invités attendent leurs places',
            content: `Il vous reste ${plural(count(d, 'seats_left'), 'place', 'places')} à envoyer pour votre table ${count(d, 'table_number')} à ${q(text(d, 'title'))}, demain à ${formatTime(iso(d, 'start_at'))}. Envoyez-les depuis Mes billets : chaque invité aura son billet.`,
        }),
        // Contre-vérification du lot 11c-b (T4) : l'onglet « Tables » tient dans un segment GSM-7 (154 caractères au pire cas)
        sms: (d, ctx) => `${SMS_PREFIX}il vous reste ${plural(count(d, 'seats_left'), 'place', 'places')} à envoyer pour la table ${count(d, 'table_number')}, ${smsVar(text(d, 'title'), 30)} demain. ${appLink(ctx, '/tickets?tab=tables')}`,
        sample: { ...SAMPLE_EVENT, booking_id: '6d2f8a14-3c7e-4b9a-8e51-2a4c6e8b1d37', table_number: 12, seats_left: 4 },
    }),
    ADMIN_EVENT_TABLES_CHANGED: define('ADMIN_EVENT_TABLES_CHANGED', {
        label: 'Tables modifiées après validation', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', night: 'DEFER', adminPermission: 'events.read', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/events/${ident(d, 'event_id')}`,
        inApp: (d) => {
            const company = optText(d, 'company');
            return {
                title: 'Tables modifiées après validation',
                content: `${q(text(d, 'title'))}${company ? ` de ${company}` : ''} : tables ou types de tables ajoutés, modifiés ou retirés après validation. Vérifiez la fiche.`,
            };
        },
        sms: (d, ctx) => `${SMS_PREFIX}tables modifiées après validation pour ${dot(smsVar(text(d, 'title'), 30))} Vérifiez la fiche : ${appLink(ctx, '/admin/events')}`,
        sample: { ...SAMPLE_EVENT, company: 'Sabar Events' },
    }),
    VENUE_VALIDATION_DECIDED: define('VENUE_VALIDATION_DECIDED', {
        label: 'Décision sur un établissement', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: 'TABLE_RESERVATION',
        link: (d) => `/partner/tables/${ident(d, 'venue_id')}`,
        inApp: (d) => {
            const decision = text(d, 'decision');
            const reason = optText(d, 'reason');
            const name = venueName(d, true);
            if (decision === 'VALIDER') return { title: 'Établissement validé', content: `${name} est validé : il est visible et réservable dès l’ouverture du service.` };
            if (decision === 'REACTIVER') return { title: 'Établissement réactivé', content: `${name} est de nouveau visible et réservable.` };
            if (decision === 'SUSPENDRE') return { title: 'Établissement suspendu', content: `${name} est suspendu : il n’est plus visible ni réservable.${reason ? ` Motif : ${sentence(reason)}` : ''} Les réservations déjà prises sont maintenues.` };
            return { title: 'Établissement refusé', content: `${name} n’est pas accepté.${reason ? ` Motif : ${sentence(reason)}` : ''} Corrigez-le puis renvoyez-le en validation depuis sa fiche.` };
        },
        sms: (d) => {
            const decision = text(d, 'decision');
            const reason = optText(d, 'reason');
            const name = smsVar(text(d, 'venue_name'), 25);
            if (decision === 'VALIDER') return `${SMS_PREFIX}votre établissement ${name} est validé : il est visible et réservable.`;
            if (decision === 'REACTIVER') return `${SMS_PREFIX}votre établissement ${name} est de nouveau visible et réservable.`;
            const what = decision === 'SUSPENDRE' ? 'est suspendu' : "n'est pas accepté";
            return `${SMS_PREFIX}votre établissement ${name} ${what}.${reason ? ` Motif : ${dot(smsVar(reason, 50))}` : ''}`;
        },
        sample: { venue_id: SAMPLE_ID.reservation, venue_name: 'Le Grand Bleu', decision: 'REFUSER', reason: 'Photos manquantes.' },
    }),
    PROMOTION_DECIDED: define('PROMOTION_DECIDED', {
        label: 'Décision sur une mise en avant', channels: ['IN_APP', 'EMAIL', 'PUSH', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'PROMOTION',
        night: 'DEFER',
        link: (d) => partnerEventPath(d),
        sms: (d, ctx) => {
            const status = text(d, 'status');
            if (status === 'APPROUVEE') return `${SMS_PREFIX}la mise en avant de ${smsVar(text(d, 'title'), 30)} est acceptée. ${appLink(ctx, '/partner/events')}`;
            if (status === 'REFUSEE') {
                const reason = optText(d, 'reason');
                return reason
                    ? `${SMS_PREFIX}la mise en avant de ${smsVar(text(d, 'title'), 30)} est refusée. Motif : ${endWithPeriod(smsClause(reason, 40))}`
                    : `${SMS_PREFIX}la mise en avant de ${smsVar(text(d, 'title'), 30)} est refusée. ${appLink(ctx, '/partner/events')}`;
            }
            throw new TemplateDataError('status', 'n’est pas une décision (acceptée ou refusée)');
        },
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
        label: 'Affectation d’un contrôleur', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
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
            const body = `affectation à l'entrée de ${smsVar(main.title, 25)}, ${smsDateTime(main.start_at)}${entry ? `, point ${smsVar(entry, 12)}` : ''}${othersClause(main.others)}`;
            return `${SMS_PREFIX}${endWithPeriod(body)} ${appLink(ctx, '/login')}`;
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
        label: 'Retrait d’affectation', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: () => '/controller/scanner',
        inApp: (d) => ({ title: 'Affectation retirée', content: `Vous ne contrôlez plus l'entrée de ${q(text(d, 'title'))}.` }),
        sms: (d) => {
            const main = mainAssignment(d);
            return `${SMS_PREFIX}votre affectation à l'entrée de ${smsVar(main.title, 30)} est retirée${othersClause(main.others)}.`;
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
        label: 'Rappel de contrôle la veille', family: 'OPTIONAL', topic: 'REMINDERS', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK',
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
        label: 'Caisse fermée par un tiers', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CONTROLLER', suspendedPolicy: 'ALLOW', inAppType: 'ALERT',
        link: () => '/controller/scanner',
        sms: (d) => {
            const by = text(d, 'closed_by');
            const who = by === 'ADMIN' ? 'l\'administration' : by === 'PARTNER' ? 'l\'organisateur' : null;
            if (!who) throw new TemplateDataError('closed_by', 'inconnu (PARTNER ou ADMIN attendu)');
            const declared = optNum(d, 'declared');
            return `${SMS_PREFIX}votre caisse pour ${smsVar(text(d, 'title'), 30)} a été fermée par ${who}.${declared !== null ? ` Montant déclaré : ${smsAmount(declared)}.` : ''}`;
        },
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
        label: 'Compte de contrôleur activé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
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
    // Lot 11a : établissement soumis à la validation (créé, ou refusé puis modifié) ; le SMS passe par ADMIN_REVIEW_SMS
    // Lot 12a : étapes d'une commande (avis mis en file par order_create, order_payment_confirm, order_partner_action,
    // order_set_en_route, order_handover_apply, order_close_apply, order_expire_hold, order_code_resend, order_tick et
    // notif_cashouts_notify). Décision du client : chaque étape sur les 4 canaux (cloche, push, email, SMS d'un segment
    // GSM-7 au pire cas). Complément du 21/11 : chaque avis mène à la commande et dit quoi faire ensuite. Le code de
    // remise n'est jamais dans la boîte d'envoi (contrainte notification_outbox_no_secret_chk) : il part par un SMS
    // immédiat (ORDER_HANDOVER_CODE, renderSyncSms), comme les codes à usage unique.
    ORDER_RECEIVED: define('ORDER_RECEIVED', {
        label: 'Commande reçue', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Commande reçue',
            content: `Votre commande ${orderRef(d)} est transmise à ${venueName(d)}. L’établissement l’accepte au plus tard à ${formatTime(iso(d, 'response_due_at'))} ; sans réponse, elle est annulée${num(d, 'paid_amount') > 0 ? ' et vous êtes remboursé' : ''}. Suivez chaque étape depuis la commande.`,
        }),
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)} transmise à ${endWithPeriod(smsVar(text(d, 'venue_name'), 28))} Réponse avant ${smsTime(iso(d, 'response_due_at'))}, sinon ${num(d, 'paid_amount') > 0 ? 'remboursée' : 'annulée'}.`,
        sample: ORDER_SAMPLE_DATA,
    }),
    ORDER_ACCEPTED: define('ORDER_ACCEPTED', {
        label: 'Commande acceptée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        // Lot 12b (correctifs après contre-vérification, idée 12) : un reste à payer → le panneau du solde s'ouvre (montant relu en base)
        link: (d) => (num(d, 'balance_due') > 0 ? `${orderLink(d)}?payer=solde` : orderLink(d)),
        inApp: (d) => {
            const eta = orderEta(d);
            const mode = text(d, 'mode');
            const next = mode === 'LIVRAISON' ? 'Au départ du livreur, vous recevrez le code à lui donner.'
                : mode === 'SUR_PLACE' ? 'Elle vous sera servie sur place.' : 'Quand elle sera prête, vous recevrez le code à donner au comptoir.';
            const balance = num(d, 'balance_due') > 0 ? ` Reste à payer à la remise : ${money(d, 'balance_due')}.` : '';
            return {
                title: 'Commande acceptée',
                content: `${venueName(d, true)} a accepté votre commande ${orderRef(d)}${eta ? `, prévue vers ${eta}` : ''}. ${next}${balance}`,
            };
        },
        sms: (d) => {
            const eta = orderEta(d);
            return `${SMS_PREFIX}${smsVar(text(d, 'venue_name'), 28)} a accepté la commande ${orderRef(d)}.${eta ? ` Prévue vers ${eta}.` : ''}`;
        },
        sample: { ...ORDER_SAMPLE_DATA, state: 'ACCEPTEE', balance_due: 875_000 },
    }),
    ORDER_PREPARING: define('ORDER_PREPARING', {
        label: 'Commande en préparation', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => {
            const eta = orderEta(d);
            return { title: 'Commande en préparation', content: `Votre commande ${orderRef(d)} est en préparation chez ${venueName(d)}${eta ? `, prévue vers ${eta}` : ''}. Elle ne peut plus être annulée.` };
        },
        sms: (d) => {
            const eta = orderEta(d);
            return `${SMS_PREFIX}commande ${orderRef(d)} en préparation chez ${endWithPeriod(smsVar(text(d, 'venue_name'), 28))}${eta ? ` Prévue vers ${eta}.` : ''}`;
        },
        sample: { ...ORDER_SAMPLE_DATA, state: 'EN_PREPARATION' },
    }),
    ORDER_READY: define('ORDER_READY', {
        label: 'Commande prête', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        // Lot 12b (correctifs après contre-vérification, idée 11) : à retirer → le code s'ouvre en mode comptoir (jamais dans le lien)
        link: (d) => (text(d, 'mode') === 'RETRAIT' ? `${orderLink(d)}?comptoir=1` : orderLink(d)),
        inApp: (d) => {
            const mode = text(d, 'mode');
            if (mode === 'RETRAIT') {
                const balance = num(d, 'balance_due') > 0 ? ` Reste à payer sur place : ${money(d, 'balance_due')}.` : '';
                return {
                    title: 'Commande prête',
                    content: `Votre commande ${orderRef(d)} vous attend chez ${venueName(d)}. Donnez au comptoir le code reçu par SMS, visible aussi dans votre commande.${balance}`,
                };
            }
            if (mode === 'SUR_PLACE') {
                return { title: 'Commande prête', content: `Votre commande ${orderRef(d)} est prête : elle vous est servie dans un instant.` };
            }
            return { title: 'Commande prête', content: `Votre commande ${orderRef(d)} est prête chez ${venueName(d)} : le livreur part bientôt. Vous recevrez alors le code à lui donner.` };
        },
        sms: (d) => {
            const mode = text(d, 'mode');
            if (mode === 'RETRAIT') return `${SMS_PREFIX}votre commande ${orderRef(d)} vous attend chez ${endWithPeriod(smsVar(text(d, 'venue_name'), 28))} Le code de retrait arrive par SMS.`;
            if (mode === 'SUR_PLACE') return `${SMS_PREFIX}votre commande ${orderRef(d)} est terminée : elle vous est servie dans un instant.`;
            return `${SMS_PREFIX}votre commande ${orderRef(d)} est terminée chez ${smsVar(text(d, 'venue_name'), 28)}, le livreur part dans un instant.`;
        },
        sample: { ...ORDER_SAMPLE_DATA, mode: 'RETRAIT', state: 'PRETE', balance_due: 875_000 },
    }),
    // SMS de cette étape : le code de remise, envoyé tout de suite par la route (ORDER_HANDOVER_CODE, jamais stocké)
    ORDER_ON_THE_WAY: define('ORDER_ON_THE_WAY', {
        label: 'Commande en route', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => {
            const eta = orderEta(d);
            const balance = num(d, 'balance_due') > 0 ? ` Reste à payer au livreur : ${money(d, 'balance_due')}.` : '';
            return {
                title: 'Commande en route',
                content: `Votre commande ${orderRef(d)} est en route${eta ? `, arrivée prévue vers ${eta}` : ''}. À son arrivée, donnez au livreur le code reçu par SMS, visible aussi dans votre commande.${balance}`,
            };
        },
        sample: { ...ORDER_SAMPLE_DATA, state: 'EN_ROUTE', balance_due: 875_000 },
    }),
    ORDER_HANDED_OVER: define('ORDER_HANDED_OVER', {
        label: 'Commande remise', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => {
            const word = orderDoneWord(d);
            return { title: `Commande ${word}`, content: `Votre commande ${orderRef(d)} de ${venueName(d)} est ${word}. Merci et à bientôt !` };
        },
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)} de ${smsVar(text(d, 'venue_name'), 30)} ${orderDoneWord(d)}. Merci et à la prochaine !`,
        sample: { ...ORDER_SAMPLE_DATA, state: 'REMISE' },
    }),
    ORDER_CANCELLED: define('ORDER_CANCELLED', {
        label: 'Commande annulée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => {
            const origin = text(d, 'origin');
            const reason = optText(d, 'reason');
            const ref = orderRef(d);
            const why = reason ? ` Motif : ${sentence(reason)}` : '';
            const refund = orderRefundSentence(d);
            if (origin === 'EXPIREE') return { title: 'Commande annulée', content: `Le paiement de la commande ${ref} n’est pas arrivé à temps : elle est annulée et rien ne vous est pris. Vous pouvez la refaire.` };
            if (origin === 'REGLEMENTE') return { title: 'Commande annulée', content: `Votre commande ${ref} chez ${venueName(d)} est annulée par Event Village : un de ses produits est réglementé (alcool, tabac) et ne se vend pas en ligne. ${refund}`.trim() };
            if (origin === 'REFUSEE') return { title: 'Commande refusée', content: `${venueName(d, true)} ne peut pas préparer votre commande ${ref}.${why} ${refund}`.trim() };
            if (origin === 'SANS_REPONSE') return { title: 'Commande annulée', content: `${venueName(d, true)} n’a pas répondu à temps : votre commande ${ref} est annulée. ${refund}`.trim() };
            const who = origin === 'PARTENAIRE' ? ' par l’établissement' : origin === 'EVENT_VILLAGE' ? ' par Event Village' : '';
            return { title: 'Commande annulée', content: `Votre commande ${ref} chez ${venueName(d)} est annulée${who}.${why} ${refund}`.trim() };
        },
        sms: (d) => {
            const origin = text(d, 'origin');
            const ref = orderRef(d);
            const name = smsVar(text(d, 'venue_name'), 25);
            const refund = num(d, 'refund_amount') > 0 ? ` ${smsAmount(num(d, 'refund_amount'))} remboursés.` : '';
            if (origin === 'EXPIREE') return `${SMS_PREFIX}paiement non arrivé à temps : commande ${ref} annulée, rien ne vous est pris.`;
            if (origin === 'REGLEMENTE') return `${SMS_PREFIX}commande ${ref} annulée : produit réglementé, non vendu en ligne.${refund}`;
            if (origin === 'REFUSEE') return `${SMS_PREFIX}${name} ne peut pas préparer la commande ${ref}.${refund}`;
            if (origin === 'SANS_REPONSE') return `${SMS_PREFIX}${name} n'a pas répondu : commande ${ref} annulée.${refund}`;
            const by = origin === 'PARTENAIRE' ? ` par ${name}` : origin === 'EVENT_VILLAGE' ? ' par notre équipe' : '';
            return `${SMS_PREFIX}${endWithPeriod(`commande ${ref} annulée${by}`)}${refund}`;
        },
        sample: { ...ORDER_SAMPLE_DATA, state: 'ANNULEE_PARTENAIRE', origin: 'PARTENAIRE', refund_amount: 1_312_500, reason: 'Rupture de poisson frais ce midi.' },
    }),
    ORDER_PAYMENT_REFUNDED: define('ORDER_PAYMENT_REFUNDED', {
        label: 'Paiement de commande remboursé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Paiement remboursé',
            content: `Votre paiement de ${money(d, 'amount')} pour la commande ${orderRef(d)} est arrivé alors qu’elle n’était plus possible (annulée, déjà payée ou établissement fermé). Il vous est remboursé sur votre compte ${operatorLabel(field(d, 'operator'))}.`,
        }),
        sms: (d) => `${SMS_PREFIX}votre paiement de ${smsAmount(num(d, 'amount'))} pour la commande ${orderRef(d)} n'a pas pu servir. Il vous est remboursé sur ${operatorLabel(field(d, 'operator'))}.`,
        sample: { ...ORDER_SAMPLE_DATA, payment_id: SAMPLE_ID.payment, amount: 1_312_500, operator: 'ORANGE_MONEY' },
    }),
    ORDER_REFUND_PAID: define('ORDER_REFUND_PAID', {
        label: 'Remboursement de commande versé', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Remboursement versé',
            content: `${money(d, 'amount')} pour la commande ${orderRef(d)} vous ont été versés sur votre compte ${operatorLabel(field(d, 'operator'))}.`,
        }),
        sms: (d) => `${SMS_PREFIX}${smsAmount(num(d, 'amount'))} versés sur votre compte ${operatorLabel(field(d, 'operator'))} : remboursement de la commande ${orderRef(d)}.`,
        sample: { ...ORDER_SAMPLE_DATA, cashout_id: SAMPLE_ID.cashout, amount: 1_312_500, operator: 'ORANGE_MONEY' },
    }),
    ORDER_PICKUP_REMINDER: define('ORDER_PICKUP_REMINDER', {
        label: 'Commande à retirer', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Commande à retirer',
            content: `Votre commande ${orderRef(d)} vous attend chez ${venueName(d)}. Retirez-la avant le ${formatDateTime(iso(d, 'closes_at'))} : ensuite, elle est close sans remboursement.`,
        }),
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)} à retirer chez ${smsVar(text(d, 'venue_name'), 22)} avant le ${smsShortDateTime(iso(d, 'closes_at'))}, sinon close sans remboursement.`,
        sample: { ...ORDER_SAMPLE_DATA, mode: 'RETRAIT', state: 'PRETE', closes_at: '2026-12-06T12:45:00Z' },
    }),
    ORDER_NOT_COLLECTED: define('ORDER_NOT_COLLECTED', {
        label: 'Commande non retirée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Commande non retirée',
            content: `Votre commande ${orderRef(d)} n’a pas été retirée à temps chez ${venueName(d)} : elle est close, sans remboursement.`,
        }),
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)} non retirée à temps chez ${smsVar(text(d, 'venue_name'), 30)} : close, sans remboursement.`,
        sample: { ...ORDER_SAMPLE_DATA, mode: 'RETRAIT', state: 'NON_RETIREE', origin: 'NON_RETIREE', refund_amount: 0 },
    }),
    ORDER_NEW: define('ORDER_NEW', {
        label: 'Nouvelle commande à accepter', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => {
            const n = count(d, 'items_count');
            const balance = num(d, 'balance_due') > 0 ? ` À encaisser à la remise : ${money(d, 'balance_due')}.` : '';
            return {
                title: 'Nouvelle commande',
                content: `Commande ${orderRef(d)} chez ${venueName(d)} : ${plural(n, 'article', 'articles')}, ${money(d, 'goods_total')}. ${orderModeText(d)}.${balance} Acceptez-la ou refusez-la avant ${formatTime(iso(d, 'response_due_at'))} ; sans réponse, elle est annulée et le client remboursé.`,
            };
        },
        sms: (d) => `${SMS_PREFIX}nouvelle commande ${orderRef(d)} : ${plural(count(d, 'items_count'), 'article', 'articles')}, ${smsAmount(num(d, 'goods_total'))}. Répondez avant ${smsTime(iso(d, 'response_due_at'))}, sinon elle sera annulée.`,
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER', balance_due: 875_000 },
    }),
    ORDER_CANCELLED_PRO: define('ORDER_CANCELLED_PRO', {
        label: 'Commande annulée (établissement)', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => {
            const origin = text(d, 'origin');
            const ref = orderRef(d);
            if (origin === 'NON_RETIREE') return { title: 'Commande non retirée', content: `La commande ${ref} n’a pas été retirée à temps : elle est close. Ce que le client a payé vous reste.` };
            if (origin === 'SANS_REPONSE') return { title: 'Commande annulée', content: `La commande ${ref} est annulée faute de réponse dans le délai : le client est remboursé. Pensez à répondre plus vite aux prochaines.` };
            if (origin === 'REGLEMENTE') return { title: 'Commande annulée', content: `La commande ${ref} est annulée par Event Village : un de ses produits est réglementé (alcool, tabac) et ne se vend pas en ligne. Le client est remboursé. Ne la préparez pas et ne la remettez pas ; retirez ce produit de la vente en ligne.` };
            const reason = optText(d, 'reason');
            const by = origin === 'EVENT_VILLAGE' ? 'par Event Village' : 'par le client';
            return { title: 'Commande annulée', content: `La commande ${ref} est annulée ${by}.${reason && origin === 'EVENT_VILLAGE' ? ` Motif : ${sentence(reason)}` : ''} Ne la préparez pas.` };
        },
        sms: (d) => {
            const origin = text(d, 'origin');
            const ref = orderRef(d);
            if (origin === 'NON_RETIREE') return `${SMS_PREFIX}commande ${ref} non retirée à temps : elle est close.`;
            if (origin === 'SANS_REPONSE') return `${SMS_PREFIX}commande ${ref} annulée faute de réponse. Le client est remboursé.`;
            if (origin === 'REGLEMENTE') return `${SMS_PREFIX}commande ${ref} annulée : produit réglementé, non vendu en ligne. Client remboursé. Ne la remettez pas.`;
            return `${SMS_PREFIX}commande ${ref} annulée ${origin === 'EVENT_VILLAGE' ? 'par Event Village' : 'par le client'}. Ne la préparez pas.`;
        },
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER', origin: 'EVENT_VILLAGE', refund_amount: 1_312_500, reason: 'Le client signale une erreur de commande.' },
    }),
    ORDER_HANDED_OVER_PRO: define('ORDER_HANDED_OVER_PRO', {
        label: 'Commande remise par le livreur', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => ({ title: 'Commande livrée', content: `Votre livreur a remis la commande ${orderRef(d)} au client.` }),
        sms: (d) => `${SMS_PREFIX}votre livreur a remis la commande ${orderRef(d)} au client.`,
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER', state: 'REMISE' },
    }),
    ORDER_COURIER_ASSIGNED: define('ORDER_COURIER_ASSIGNED', {
        label: 'Livraison confiée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: courierOrderLink,
        inApp: (d) => {
            const zone = optText(d, 'zone_name');
            return {
                title: 'Livraison à faire',
                content: `Commande ${orderRef(d)} à livrer pour ${venueName(d)}${zone ? `, zone ${zone}` : ''}. Ouvrez-la pour l’adresse et le téléphone du client ; à la remise, demandez-lui son code.`,
            };
        },
        sms: (d) => {
            const zone = optText(d, 'zone_name');
            return `${SMS_PREFIX}${endWithPeriod(`commande ${orderRef(d)} à livrer pour ${smsVar(text(d, 'venue_name'), 22)}${zone ? `, zone ${smsVar(zone, 20)}` : ''}`)} Adresse dans l'application.`;
        },
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'COURIER' },
    }),
    ORDER_COURIER_CANCELLED: define('ORDER_COURIER_CANCELLED', {
        label: 'Livraison annulée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: () => '/courier/orders',
        inApp: (d) => (optText(d, 'origin') === 'REGLEMENTE'
            ? { title: 'Livraison annulée', content: `La commande ${orderRef(d)} est annulée par Event Village : un de ses produits est réglementé et ne se vend pas en ligne. Ne la livrez pas ; rapportez-la à l’établissement.` }
            : { title: 'Livraison annulée', content: `La livraison de la commande ${orderRef(d)} est annulée ou confiée à quelqu’un d’autre : ne la livrez pas.` }),
        sms: (d) => (optText(d, 'origin') === 'REGLEMENTE'
            ? `${SMS_PREFIX}commande ${orderRef(d)} annulée (produit réglementé) : ne la livrez pas, rapportez-la à l'établissement.`
            : `${SMS_PREFIX}livraison de la commande ${orderRef(d)} annulée ou confiée à un autre livreur : ne la livrez pas.`),
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'COURIER' },
    }),
    ORDER_COURIER_INVITED: define('ORDER_COURIER_INVITED', {
        label: 'Invitation à livrer', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'ORDER',
        link: (d) => `/courier/invitations/${ident(d, 'invitation_id')}`,
        inApp: (d) => {
            const name = optText(d, 'partner_name');
            return {
                title: 'Invitation à livrer',
                content: `${name ? q(name) : 'Un établissement'} vous invite à livrer ses commandes avec Event Village. Acceptez ou refusez l’invitation ; vous verrez seulement les livraisons qui vous sont confiées.`,
            };
        },
        sample: { invitation_id: SAMPLE_ID.invitation, partner_name: 'Chez Fatou, cuisine du Sénégal et grillades' },
    }),
    // Contre-vérification du lot 12c (point 7, P1 à P4 et P7 de l'audit) : avis de commande ajoutés, 4 canaux, SMS d'un
    // segment au pire cas ; chaque avis mène à la commande concernée et dit quoi faire.
    ORDER_CODE_LOCKED: define('ORDER_CODE_LOCKED', {
        label: 'Code de remise bloqué', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Code de remise bloqué',
            content: `Le code de remise de la commande ${orderRef(d)} a été mal saisi trop de fois : il ne fonctionne plus. Ouvrez la commande, demandez un nouveau code et donnez-le à la remise.`,
        }),
        sms: (d) => `${SMS_PREFIX}code de remise de la commande ${orderRef(d)} bloqué après trop d'essais. Demandez un nouveau code dans l'application.`,
        sample: { ...ORDER_SAMPLE_DATA, state: 'EN_ROUTE' },
    }),
    ORDER_RESPONSE_REMINDER: define('ORDER_RESPONSE_REMINDER', {
        label: 'Commande sans réponse', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => ({
            title: 'Commande sans réponse',
            content: `La commande ${orderRef(d)} chez ${venueName(d)} attend votre réponse. Acceptez-la ou refusez-la avant ${formatTime(iso(d, 'response_due_at'))} : sans réponse, elle est annulée et le client remboursé.`,
        }),
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)} toujours sans réponse. Acceptez-la ou refusez-la avant ${smsTime(iso(d, 'response_due_at'))}, sinon elle sera annulée.`,
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER' },
    }),
    ORDER_PREP_REMINDER: define('ORDER_PREP_REMINDER', {
        label: 'Commande programmée à préparer', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => ({
            title: 'Commande à préparer',
            content: `La commande ${orderRef(d)} chez ${venueName(d)} est prévue à ${formatTime(iso(d, 'scheduled_for'))} : lancez sa préparation maintenant. ${orderModeText(d)}.`,
        }),
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)} prévue à ${smsTime(iso(d, 'scheduled_for'))} : lancez sa préparation maintenant.`,
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER', state: 'ACCEPTEE' },
    }),
    ORDER_READY_COURIER: define('ORDER_READY_COURIER', {
        label: 'Commande prête à livrer', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: courierOrderLink,
        inApp: (d) => {
            const zone = optText(d, 'zone_name');
            return {
                title: 'Commande prête à livrer',
                content: `La commande ${orderRef(d)} est prête chez ${venueName(d)}${zone ? ` (zone ${zone})` : ''} : passez la prendre. À la remise, demandez son code au client.`,
            };
        },
        // GSM-7 : pas de « ê » (prête) dans le SMS
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)} à récupérer chez ${smsVar(text(d, 'venue_name'), 30)} pour la livrer. Adresse dans l'application.`,
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'COURIER', state: 'PRETE' },
    }),
    ORDER_SCHEDULED_REMINDER: define('ORDER_SCHEDULED_REMINDER', {
        label: 'Commande programmée bientôt', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => {
            const mode = text(d, 'mode');
            const hint = mode === 'LIVRAISON' ? 'Gardez votre téléphone près de vous et votre code de remise prêt.'
                : mode === 'RETRAIT' ? 'Pensez à votre code de remise pour la retirer.'
                    : 'Présentez-vous à l’heure : elle vous sera servie sur place.';
            return {
                title: 'Votre commande approche',
                content: `Votre commande ${orderRef(d)} chez ${venueName(d)} est prévue à ${formatTime(iso(d, 'scheduled_for'))}. ${hint}`,
            };
        },
        sms: (d) => {
            const mode = text(d, 'mode');
            const hint = mode === 'LIVRAISON' ? 'Gardez votre téléphone près de vous.' : mode === 'RETRAIT' ? 'Pensez à votre code de remise.' : 'Elle vous sera servie sur place.';
            // endWithPeriod : un nom coupé (« ... ») ne prend pas de point de plus
            return `${SMS_PREFIX}${endWithPeriod(`rappel, commande ${orderRef(d)} prévue à ${smsTime(iso(d, 'scheduled_for'))} chez ${smsVar(text(d, 'venue_name'), 30)}`)} ${hint}`;
        },
        sample: { ...ORDER_SAMPLE_DATA, state: 'ACCEPTEE' },
    }),
    // Lot 12d : livreur, client absent, signalements, fermetures et pause. Décision du client : étapes importantes sur les
    // 4 canaux (SMS d'un segment au pire cas), petites étapes en cloche et notification du téléphone ; prénom et initiale
    // seulement pour nommer une personne ; chaque avis mène à l'objet exact et dit quoi faire.
    ORDER_COURIER_ANSWERED: define('ORDER_COURIER_ANSWERED', {
        label: 'Réponse d’un livreur', channels: ['IN_APP', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', night: 'DEFER', inAppType: 'ORDER',
        link: (d) => `/partner/orders/livreurs?invitation=${ident(d, 'invitation_id')}`,
        inApp: (d) => {
            const who = optText(d, 'courier_name') ?? 'La personne invitée';
            return field(d, 'accepted') === true
                ? { title: 'Livreur ajouté', content: `${who} a accepté de livrer vos commandes. Vous pouvez maintenant lui confier une livraison.` }
                : { title: 'Invitation refusée', content: `${who} a refusé de livrer vos commandes. Invitez une autre personne depuis vos livreurs.` };
        },
        sample: { invitation_id: SAMPLE_ID.invitation, accepted: true, courier_name: 'Moussa D.' },
    }),
    ORDER_COURIER_REMOVED: define('ORDER_COURIER_REMOVED', {
        label: 'Retiré d’une équipe de livraison', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: 'ORDER',
        link: (d) => `/courier/orders?equipe=${ident(d, 'invitation_id')}`,
        inApp: (d) => {
            const name = optText(d, 'partner_name');
            return { title: 'Vous ne livrez plus', content: `${name ? q(name) : 'Un établissement'} vous a retiré de ses livreurs : ses commandes ne vous sont plus confiées. Une livraison déjà partie reste à terminer avec l’établissement.` };
        },
        sample: { invitation_id: SAMPLE_ID.invitation, partner_name: 'Chez Fatou, cuisine du Sénégal et grillades' },
    }),
    ORDER_COURIER_RETURN: define('ORDER_COURIER_RETURN', {
        label: 'Client toujours absent', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: courierOrderLink,
        inApp: (d) => ({
            title: 'Rapportez la commande',
            content: `Le client de la commande ${orderRef(d)} reste absent après 30 minutes. Rapportez la commande à ${venueName(d)} : l’équipe Event Village décide de la suite. S’il revient avant, vous pouvez encore la remettre avec son code.`,
        }),
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'COURIER', state: 'EN_ROUTE' },
    }),
    ORDER_CLIENT_ABSENT: define('ORDER_CLIENT_ABSENT', {
        label: 'Livreur sans réponse', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Le livreur n’arrive pas à vous joindre',
            content: `Le livreur de votre commande ${orderRef(d)} vous a appelé deux fois sans réponse. Il attend jusqu’à ${formatTime(iso(d, 'wait_until'))} : rappelez le numéro qui vous a appelé et donnez-lui votre code. Ensuite, l’équipe Event Village décide de la suite.`,
        }),
        sms: (d) => `${SMS_PREFIX}commande ${orderRef(d)}, le livreur n'a pas pu vous joindre. Il attend jusqu'à ${smsTime(iso(d, 'wait_until'))} : rappelez le numéro qui vous a appelé.`,
        sample: { ...ORDER_SAMPLE_DATA, state: 'EN_ROUTE', wait_until: '2026-12-05T13:15:00Z' },
    }),
    ORDER_CLIENT_ABSENT_PRO: define('ORDER_CLIENT_ABSENT_PRO', {
        label: 'Client absent à la livraison', channels: ['IN_APP', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => ({
            title: 'Client absent',
            content: `Votre livreur ne joint pas le client de la commande ${orderRef(d)}. Il attend jusqu’à ${formatTime(iso(d, 'wait_until'))} ; ensuite, l’équipe Event Village décide de la suite et vous prévient.`,
        }),
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER', state: 'EN_ROUTE', wait_until: '2026-12-05T13:15:00Z' },
    }),
    ORDER_ABSENCE_DECIDED: define('ORDER_ABSENCE_DECIDED', {
        label: 'Décision après une absence', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => {
            const reason = optText(d, 'reason');
            const refund = num(d, 'refund_amount') > 0
                ? `Vous êtes remboursé de ${money(d, 'refund_amount')} sur votre compte de paiement.`
                : 'Aucun remboursement n’est fait.';
            return {
                title: 'Commande non livrée',
                content: `Votre commande ${orderRef(d)} n’a pas pu vous être remise : vous étiez absent. ${refund}${reason ? ` Motif : ${sentence(reason)}` : ''}`,
            };
        },
        sms: (d) => (num(d, 'refund_amount') > 0
            ? `${SMS_PREFIX}commande ${orderRef(d)} non livrée, client absent. Remboursement de ${smsAmount(num(d, 'refund_amount'))} en cours.`
            : `${SMS_PREFIX}commande ${orderRef(d)} non livrée, client absent. Aucun remboursement : motif dans l'application.`),
        sample: { ...ORDER_SAMPLE_DATA, state: 'NON_RETIREE', origin: 'EVENT_VILLAGE', refund_amount: 656_250, decision: 'PART', reason: 'Le client a rappelé après le départ du livreur.' },
    }),
    ORDER_ABSENCE_DECIDED_PRO: define('ORDER_ABSENCE_DECIDED_PRO', {
        label: 'Décision après une absence (établissement)', channels: ['IN_APP', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => {
            const reason = optText(d, 'reason');
            return {
                title: 'Absence du client : décision',
                content: `Commande ${orderRef(d)} close après l’absence du client. ${num(d, 'refund_amount') > 0 ? `Le client est remboursé de ${money(d, 'refund_amount')}.` : 'Le client n’est pas remboursé.'}${reason ? ` Motif : ${sentence(reason)}` : ''}`,
            };
        },
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER', state: 'NON_RETIREE', origin: 'EVENT_VILLAGE', refund_amount: 0, decision: 'RIEN', reason: 'Deux appels et une attente de 30 minutes sans réponse.' },
    }),
    ORDER_ISSUE_PRO: define('ORDER_ISSUE_PRO', {
        label: 'Problème signalé par un client', channels: ['IN_APP', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'ORDER',
        link: partnerOrderLink,
        inApp: (d) => ({
            title: 'Problème signalé',
            content: `Le client de la commande ${orderRef(d)} signale ${orderIssueReason(d)}. L’équipe Event Village s’en occupe et peut vous contacter.`,
        }),
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'OWNER', state: 'EN_ROUTE', reason: 'RETARD' },
    }),
    ORDER_ISSUE_CLOSED: define('ORDER_ISSUE_CLOSED', {
        label: 'Signalement traité', channels: ['IN_APP', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: 'ORDER',
        link: orderLink,
        inApp: (d) => ({
            title: 'Signalement traité',
            content: `L’équipe Event Village a traité votre signalement sur la commande ${orderRef(d)}. Sa réponse est dans la commande.`,
        }),
        sample: { ...ORDER_SAMPLE_DATA, state: 'REMISE', reason: 'INCOMPLETE' },
    }),
    ORDER_CLOSURE_ORDERS: define('ORDER_CLOSURE_ORDERS', {
        label: 'Commandes prévues pendant une fermeture', channels: ['IN_APP', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: (d) => `/partner/tables/edition/${ident(d, 'venue_id')}/fermetures?fermeture=${ident(d, 'closure_id')}`,
        inApp: (d) => {
            const n = count(d, 'count');
            return {
                title: 'Commandes pendant la fermeture',
                content: `${n > 1 ? `${formatInteger(n)} commandes sont prévues` : 'Une commande est prévue'} pendant la fermeture de ${venueName(d)}. Pour chacune, choisissez : annuler et rembourser, ou garder.`,
            };
        },
        sample: { venue_id: SAMPLE_ID.reservation, venue_name: 'Chez Fatou, cuisine du Sénégal et grillades', closure_id: SAMPLE_ID.reservation, count: 3, starts_at: '2026-12-05T12:00', ends_at: '2026-12-05T15:00' },
    }),
    ORDER_PAUSE_ENDED: define('ORDER_PAUSE_ENDED', {
        label: 'Fin de la pause des commandes', channels: ['IN_APP', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'ORDER',
        link: (d) => `/partner/orders?etablissement=${ident(d, 'venue_id')}`,
        inApp: (d) => ({ title: 'Commandes reprises', content: `La pause est finie : ${venueName(d)} reçoit de nouveau des commandes.` }),
        sample: { venue_id: SAMPLE_ID.reservation, venue_name: 'Chez Fatou, cuisine du Sénégal et grillades', paused_until: '2026-12-05T13:30:00Z' },
    }),
    ADMIN_ORDER_ABSENT: define('ADMIN_ORDER_ABSENT', {
        label: 'Absence d’un client à décider', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', night: 'DEFER', adminPermission: 'refunds.manage', inAppType: 'ORDER',
        link: (d) => `/admin/orders/${ident(d, 'order_id')}`,
        inApp: (d) => ({
            title: 'Absence à décider',
            content: `Le client de la commande ${orderRef(d)} chez ${venueName(d)} est resté absent à la livraison. Décidez : rembourser tout, une part, ou rien.`,
        }),
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'ADMIN', state: 'EN_ROUTE' },
    }),
    ADMIN_ORDER_ISSUE: define('ADMIN_ORDER_ISSUE', {
        label: 'Problème signalé sur une commande', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', night: 'DEFER', adminPermission: 'refunds.manage', inAppType: 'ORDER',
        link: (d) => `/admin/orders/${ident(d, 'order_id')}`,
        inApp: (d) => ({
            title: 'Signalements à traiter',
            content: `Un client signale ${orderIssueReason(d)} sur la commande ${orderRef(d)}. Les autres signalements de l’heure sont dans la liste « À décider » des commandes.`,
        }),
        sample: { ...ORDER_SAMPLE_DATA, recipient_role: 'ADMIN', state: 'EN_PREPARATION', reason: 'INCOMPLETE' },
    }),
    // Lot 12c : produit « à vérifier » (un mot de la liste dans son nom, sa description ou un supplément) : administrateurs
    // qui ont partners.validate, cloche et email ; décision envoyée à la partenaire (cloche, notification du téléphone, email)
    ADMIN_PRODUCT_REVIEW: define('ADMIN_PRODUCT_REVIEW', {
        label: 'Produit à vérifier', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', night: 'DEFER', adminPermission: 'partners.validate', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/products?produit=${ident(d, 'product_id')}`,
        inApp: (d) => {
            const words = Array.isArray(field(d, 'words')) ? (field(d, 'words') as unknown[]).filter((w): w is string => typeof w === 'string') : [];
            const venue = optText(d, 'venue_name');
            const company = optText(d, 'company');
            return {
                title: 'Produit à vérifier',
                content: `${q(text(d, 'product_name'))}${venue ? ` chez ${venue}` : company ? ` de ${company}` : ''} contient ${words.length > 1 ? 'les mots' : 'le mot'} ${words.map(q).join(', ') || 'de la liste'}. Il ne se vend pas en ligne tant que vous ne l’avez pas autorisé ou refusé.`,
            };
        },
        sample: { product_id: SAMPLE_ID.reservation, product_name: 'Bissap maison et bière locale en bouteille de 65 cl', venue_name: 'Le Grand Bleu', company: 'Sabar Events', words: ['bière'] },
    }),
    PRODUCT_REVIEW_DECIDED: define('PRODUCT_REVIEW_DECIDED', {
        label: 'Produit vérifié', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: 'ORDER',
        link: (d) => `/partner/products/${ident(d, 'product_id')}`,
        inApp: (d) => {
            const name = q(text(d, 'product_name'));
            const reason = optText(d, 'reason');
            // Contre-vérification du lot 12c (T3) : produit mis « à vérifier » par l'administration (motif)
            if (text(d, 'decision') === 'A_VERIFIER') {
                return { title: 'Produit en vérification', content: `${name} est en vérification par Event Village : il ne se commande plus en ligne jusqu’à la décision.${reason ? ` Motif : ${sentence(reason)}` : ''} Il reste affiché avec son prix sur votre carte.` };
            }
            if (text(d, 'decision') === 'AUTORISE') {
                return field(d, 'partner_box') === true
                    ? { title: 'Produit vérifié', content: `${name} est vérifié par Event Village. Vous l’avez marqué « réglementé » : il reste affiché avec son prix, sans vente en ligne, tant que la case est cochée.` }
                    : { title: 'Produit autorisé à la vente', content: `${name} est vérifié par Event Village : il peut être commandé en ligne.` };
            }
            return { title: 'Produit non vendu en ligne', content: `${name} n’est pas autorisé à la vente en ligne.${reason ? ` Motif : ${sentence(reason)}` : ''} Il reste affiché avec son prix sur votre carte : vos clients l’achètent sur place.` };
        },
        sample: { product_id: SAMPLE_ID.reservation, product_name: 'Bissap maison et bière locale en bouteille de 65 cl', decision: 'REFUSE', reason: 'Boisson alcoolisée : vente en ligne interdite.', partner_box: false },
    }),
    // Contre-vérification du lot 12c (point 7, P5) : la décision aussi par SMS (type à part : PRODUCT_REVIEW_DECIDED n'a
    // pas de SMS) ; reportée la nuit
    PRODUCT_DECISION_SMS: define('PRODUCT_DECISION_SMS', {
        label: 'SMS : produit vérifié', channels: ['SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', night: 'DEFER', inAppType: null,
        link: (d) => `/partner/products/${ident(d, 'product_id')}`,
        sms: (d) => {
            const name = smsVar(text(d, 'product_name'), 40);
            const decision = text(d, 'decision');
            if (decision === 'AUTORISE') {
                return field(d, 'partner_box') === true
                    ? `${SMS_PREFIX}produit "${name}" vérifié. Marqué réglementé par vous, il reste sans vente en ligne.`
                    : `${SMS_PREFIX}produit "${name}" vérifié : il se commande en ligne.`;
            }
            if (decision === 'REFUSE') return `${SMS_PREFIX}produit "${name}" non autorisé à la vente en ligne. Motif dans l'application.`;
            throw new TemplateDataError('decision', 'inconnue (AUTORISE ou REFUSE attendu)');
        },
        sample: { product_id: SAMPLE_ID.reservation, product_name: 'Bissap maison et bière locale en bouteille de 65 cl', decision: 'REFUSE', partner_box: false },
    }),
    // Contre-vérification du lot 12c (point 7, P6) : remboursement d'une commande bloqué, refusé ou incertain, SMS aux
    // administrateurs refunds.manage (la cloche, le téléphone et l'email partent déjà) ; reporté la nuit
    ADMIN_ORDER_REFUND_BLOCKED: define('ADMIN_ORDER_REFUND_BLOCKED', {
        label: 'SMS : remboursement de commande à reprendre', channels: ['SMS'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', night: 'DEFER', adminPermission: 'refunds.manage', inAppType: null,
        link: () => '/admin/finance#versements-a-reprendre',
        sms: (d) => {
            const status = text(d, 'cashout_status');
            const head = `${SMS_PREFIX}remboursement de ${smsAmount(num(d, 'amount'))} de la commande ${orderRef(d)}`;
            if (status === 'BLOQUE') return `${head} bloqué. Reprenez-le depuis les finances.`;
            if (status === 'ECHOUE') return `${head} refusé par l'opérateur. Reprenez-le depuis les finances.`;
            if (status === 'INCERTAIN') return `${head} sans réponse de l'opérateur. Vérifiez-le avant toute reprise.`;
            throw new TemplateDataError('cashout_status', 'inconnu (BLOQUE, ECHOUE ou INCERTAIN attendu)');
        },
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 1_312_500, order_number: 'CMD-261205-A1B2C3', cashout_status: 'BLOQUE' },
    }),
    // Contre-vérification du lot 12c (T3) : revue groupée des produits déjà enregistrés (liste des mots changée, catégorie
    // renommée, mise à jour) : un seul avis aux administrateurs partners.validate
    ADMIN_PRODUCTS_REVIEW_BATCH: define('ADMIN_PRODUCTS_REVIEW_BATCH', {
        label: 'Produits déjà en vente à vérifier', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', night: 'DEFER', adminPermission: 'partners.validate', inAppType: 'ADMIN_REVIEW',
        link: () => '/admin/products',
        inApp: (d) => {
            const n = count(d, 'count');
            const origin = text(d, 'origin');
            const why = origin === 'LISTE' ? 'la liste des mots a changé'
                : origin === 'CATEGORIE' ? 'une catégorie a été renommée avec un mot de la liste'
                    : 'les produits enregistrés avant la mise à jour ont été relus';
            return {
                title: 'Produits à vérifier',
                content: `${plural(n, 'produit déjà en vente est', 'produits déjà en vente sont')} à vérifier : ${why}. Ils ne se commandent plus en ligne tant que vous ne les avez pas autorisés ou refusés.`,
            };
        },
        sample: { count: 12, origin: 'LISTE' },
    }),
    ADMIN_VENUE_SUBMITTED: define('ADMIN_VENUE_SUBMITTED', {
        label: 'Établissement à valider', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'halls.validate', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/venues/${ident(d, 'venue_id')}`,
        inApp: (d) => ({
            title: 'Établissement à valider',
            content: `${q(text(d, 'venue_name'))}${optText(d, 'city') ? ` (${text(d, 'city')})` : ''} ${field(d, 'resubmitted') === true ? 'a été modifié et ' : ''}attend votre validation.`,
        }),
        sample: { venue_id: SAMPLE_ID.reservation, venue_name: 'Le Grand Bleu', kind: 'RESTAURANT', city: 'Dakar' },
    }),
    // Lot 10b : salle envoyée en validation, salle validée modifiée (prix, adresse, nom ou photos) ; administrateurs
    // qui ont halls.validate. Le SMS de la salle à valider passe par le SMS groupé (ADMIN_REVIEW_SMS, hall_count).
    ADMIN_HALL_SUBMITTED: define('ADMIN_HALL_SUBMITTED', {
        label: 'Salle à valider', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'halls.validate', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/halls/${encodeURIComponent(text(d, 'hall_id'))}`,
        inApp: (d) => ({
            title: 'Salle à valider',
            content: `${q(text(d, 'hall_name'))}${optText(d, 'city') ? ` (${text(d, 'city')})` : ''} ${field(d, 'resubmitted') === true ? 'a été corrigée et ' : ''}attend votre validation.`,
        }),
        sample: { hall_id: SAMPLE_ID.reservation, hall_name: 'Salle des fêtes de Ngor', city: 'Dakar' },
    }),
    ADMIN_HALL_CHANGED: define('ADMIN_HALL_CHANGED', {
        label: 'Salle validée modifiée', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'halls.validate', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/halls/${encodeURIComponent(text(d, 'hall_id'))}`,
        inApp: (d) => ({
            title: 'Salle modifiée',
            content: `${q(text(d, 'hall_name'))}${optText(d, 'previous_name') ? ` (avant : ${q(text(d, 'previous_name'))})` : ''} a changé : ${hallChangesText(d)}. Elle reste validée : vérifiez sa fiche.`,
        }),
        sample: { hall_id: SAMPLE_ID.reservation, hall_name: 'Salle des fêtes de Ngor', city: 'Dakar', changes: ['PRIX', 'PHOTOS'] },
    }),
    // Contre-vérification du lot 10b (demande du 19/11) : droits d'un administrateur donnés ou retirés par un
    // super-administrateur (admin_permissions_set) : l'administrateur est prévenu, les autres super-administrateurs
    // reçoivent une alerte (4 canaux).
    ADMIN_PERMISSIONS_CHANGED: define('ADMIN_PERMISSIONS_CHANGED', {
        label: 'Droits d’administration modifiés', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', inAppType: 'ADMIN_REVIEW',
        link: () => '/admin/mes-droits',
        inApp: (d) => ({ title: 'Vos droits ont changé', content: rightsSentences(d) }),
        sms: (d, ctx) => {
            const added = codes(d, 'added');
            const removed = codes(d, 'removed');
            if (added.length + removed.length === 1) {
                const one = added[0] ?? removed[0];
                return `${SMS_PREFIX}vous ${added.length ? 'pouvez maintenant' : 'ne pouvez plus'} ${smsVar(rightPhrase(one), 95)}.`;
            }
            return `${SMS_PREFIX}vos droits d'administration ont changé : ${added.length} ajouté(s), ${removed.length} retiré(s). Détail : ${appLink(ctx, '/admin/mes-droits')}`;
        },
        sample: { admin_id: SAMPLE_ID.partner, added: ['halls.validate'], removed: [], target_name: 'Ndeye Administratrice', actor_name: 'Moussa Diop' },
    }),
    ADMIN_PERMISSIONS_ALERT: define('ADMIN_PERMISSIONS_ALERT', {
        label: 'Droits d’un administrateur modifiés (super-administrateurs)', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', inAppType: 'ADMIN_REVIEW',
        link: () => '/admin/users',
        inApp: (d) => ({
            title: 'Droits d’un administrateur modifiés',
            content: `${optText(d, 'actor_name') ?? 'Un super-administrateur'} a modifié les droits de ${optText(d, 'target_name') ?? 'un administrateur'}. ${rightsSentences(d, true)}`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(optText(d, 'actor_name') ?? 'Un super-admin', 20)} a modifié les droits de ${smsVar(optText(d, 'target_name') ?? 'un admin', 20)} (${codes(d, 'added').length} ajouté(s), ${codes(d, 'removed').length} retiré(s)). Vérifiez : ${appLink(ctx, '/admin/users')}`,
        sample: { admin_id: SAMPLE_ID.partner, added: ['halls.validate'], removed: ['events.write'], target_name: 'Ndeye Administratrice', actor_name: 'Moussa Diop' },
    }),
    ADMIN_PARTNER_REGISTERED: define('ADMIN_PARTNER_REGISTERED', {
        label: 'Nouvelle candidature partenaire', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'partners.read', inAppType: 'KYC',
        link: partnerDossierPath,
        inApp: (d) => ({ title: 'Nouvelle candidature', content: `${text(d, 'company')} demande un compte partenaire. Examinez son dossier puis validez-le ou refusez-le.` }), // finition 5 (point 4)
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    ADMIN_REFUND_TO_RETRY: define('ADMIN_REFUND_TO_RETRY', {
        label: 'Remboursement à reprendre', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance#versements-a-reprendre',
        inApp: (d) => {
            const status = text(d, 'cashout_status');
            const reason = optText(d, 'blocked_reason');
            let state: string;
            if (status === 'BLOQUE') state = reason ? `bloqué : ${sentence(blockedReasonLabel(reason))}` : 'bloqué.';
            else if (status === 'ECHOUE') state = 'refusé par l\'opérateur.';
            else throw new TemplateDataError('cashout_status', 'inconnu (BLOQUE ou ECHOUE attendu)');
            return { title: 'Remboursement à reprendre', content: `Un remboursement de ${money(d, 'amount')} est ${state} Reprenez-le depuis les finances.` }; // finition 5 (point 4)
        },
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 5_000, cashout_status: 'BLOQUE', blocked_reason: 'OPERATOR_UNKNOWN' },
    }),
    /** Lot 8 (8.2 a, L32) : second paiement réussi d'un même panier, remboursement lancé par payment_confirm. */
    ADMIN_DUPLICATE_PAYMENT: define('ADMIN_DUPLICATE_PAYMENT', {
        label: 'Paiement en double remboursé', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance#remboursements-a-verser',
        // Lot 9 quater (C1 : AUD-20) : à partir du 3e doublon du compte en 30 jours, remboursé moins les frais SamirPay
        inApp: (d) => (Number(d.withheld ?? 0) > 0
            ? { title: 'Paiements en double répétés', content: `Un ${formatInteger(num(d, 'duplicate_rank'))}e paiement en double de ${money(d, 'amount')} en 30 jours pour le même client : il est remboursé moins les frais de l’opérateur de paiement, soit ${money(d, 'withheld')} retenus. Vérifiez s'il s'agit d'un abus.` }
            : { title: 'Paiement en double remboursé', content: `Un second paiement de ${money(d, 'amount')} a été encaissé pour le même panier : son remboursement au client est lancé.` }),
        sample: { payment_id: SAMPLE_ID.payment, duplicate_of: SAMPLE_ID.keptPayment, amount: 21_000 },
    }),
    ADMIN_CASHOUT_UNCERTAIN: define('ADMIN_CASHOUT_UNCERTAIN', {
        label: 'Versement incertain', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance#versements-a-reprendre',
        inApp: (d) => ({ title: 'Versement incertain', content: `L'issue d'un versement de ${money(d, 'amount')} est incertaine : vérifiez-le avant toute action.` }),
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 25_000 },
    }),
    ADMIN_WITHDRAWAL_REJECTED: define('ADMIN_WITHDRAWAL_REJECTED', {
        label: 'Retrait refusé par l’opérateur', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance#du-aux-partenaires',
        // Finition 4 (point 5, E-33) : variante « constaté non versé » (not_paid), jamais « refusé par l'opérateur »
        inApp: (d) => (field(d, 'not_paid') === true
            ? { title: 'Retrait constaté non versé', content: `Le retrait de ${money(d, 'amount')} a été constaté non versé ; le montant est revenu sur le solde du bénéficiaire.` }
            : { title: 'Retrait refusé par l\'opérateur', content: `Le retrait de ${money(d, 'amount')} a été refusé ; le montant est revenu sur le solde du bénéficiaire.` }),
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 25_000 },
    }),
    ADMIN_FINANCE_DEBT: define('ADMIN_FINANCE_DEBT', {
        label: 'Créance sur un compte', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'payments.read', inAppType: 'FINANCE_ALERT',
        link: () => '/admin/finance#creances',
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
        label: 'Envoi en échec', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'NOTIFICATION_ALERT',
        link: (d) => `/admin/notifications/${ident(d, 'outbox_id')}`,
        inApp: (d) => {
            const attempts = optNum(d, 'attempts');
            return {
                title: 'Envoi en échec',
                content: `Une notification ${q(catalogTypeLabel(field(d, 'failed_type')))} ${channelPhrase(field(d, 'channel'))} a échoué${attempts !== null && attempts > 0 ? ` après ${plural(attempts, 'tentative', 'tentatives')}` : ''}. Ouvrez l'envoi pour en voir la cause.`, // finition 5 (point 4)
            };
        },
        sample: { outbox_id: SAMPLE_ID.outbox, failed_type: 'PURCHASE_CONFIRMED', channel: 'SMS', reason: 'SMS_REJECTED', attempts: 5 },
    }),
    // Lot 9 bis (11.2 M6, R31) : réémis par notification_daily_checks, compte les SMS indispensables du jour.
    ADMIN_SMS_DAILY_THRESHOLD: define('ADMIN_SMS_DAILY_THRESHOLD', {
        label: 'Volume de SMS indispensables élevé', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_DAILY_THRESHOLD',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Volume de SMS indispensables élevé',
            // Finition 4 (point 5, E-40) : pas de plafond global, mais une limite par numéro et, pour les numéros saisis à la main
            // (invitations, transferts), par compte qui les déclenche
            content: `${formatInteger(count(d, 'count'))} SMS indispensables envoyés aujourd'hui (seuil d'alerte : ${formatInteger(count(d, 'threshold'))}). Ils n'ont pas de plafond global ; chaque numéro en reçoit un nombre limité par jour, et les numéros saisis à la main (invitations, transferts) sont aussi limités par compte qui les déclenche. Vérifiez leur origine dans la supervision.`,
        }),
        sample: { day: '2026-11-02', count: 2_150, threshold: 2_000 },
    }),
    ADMIN_SMS_CAP_GLOBAL: define('ADMIN_SMS_CAP_GLOBAL', {
        label: 'Plafond de SMS atteint', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_DAILY_CAP_REACHED',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Plafond de SMS atteint : codes bloqués',
            // Finition 4 (point 5, E-05) : ce qui s'arrête vraiment (lib/sms/sms-guard.ts) ; les indispensables partent toujours
            content: `Le plafond de ${formatInteger(count(d, 'cap'))} SMS par jour est atteint : jusqu'à minuit, heure de Dakar, plus aucun code par SMS ne part vers les comptes existants (connexion, mot de passe, retrait), ni aucun SMS facultatif. Les SMS indispensables (achat, billet, annulation, remboursement, sécurité du compte) partent toujours.`,
        }),
        sample: { day: '2026-11-02', cap: 1_000 },
    }),
    ADMIN_SMS_CAP_NON_OTP: define('ADMIN_SMS_CAP_NON_OTP', {
        label: 'Quota de SMS hors codes atteint', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_NON_OTP_SHARE_REACHED',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Quota de SMS hors codes atteint',
            content: `La part des SMS hors codes (${formatInteger(count(d, 'limit'))} sur ${formatInteger(count(d, 'cap'))} par jour) est atteinte : jusqu'à minuit, heure de Dakar, les SMS facultatifs (rappels, ventes, résumés, remerciements) et les invitations de contrôleurs ne partent plus par SMS. Les codes et les SMS indispensables (achat, billet, annulation, remboursement, sécurité du compte) partent toujours.`,
        }),
        sample: { day: '2026-11-02', cap: 1_000, limit: 700 },
    }),
    // Lot 9 quater (A8 : AUD-05) : part quotidienne des codes vers un numéro sans compte (inscriptions) atteinte.
    ADMIN_SMS_CAP_NEW_NUMBERS: define('ADMIN_SMS_CAP_NEW_NUMBERS', {
        label: 'Codes d’inscription : part du jour atteinte', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'notifications.read', inAppType: 'SMS_DAILY_CAP_REACHED',
        link: () => '/admin/notifications',
        inApp: (d) => ({
            title: 'Codes d’inscription : part du jour atteinte',
            content: `Les ${formatInteger(count(d, 'limit'))} codes du jour vers des numéros sans compte sont partis : plus aucune inscription ne reçoit de code jusqu'à minuit, heure de Dakar. Les codes des comptes existants partent toujours. Vérifiez s'il s'agit d'inscriptions en masse.`,
        }),
        sample: { day: '2026-11-13', cap: 1_000, limit: 90 },
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
    // ── Lot 9 bis (contrat 11.1, N1 à N25) : types nouveaux, textes du contrat mot pour mot ──
    // N1 (R30, H1, B11) : remboursement bloqué, refusé, incertain ou en retard de 30 min ; un avis par versement.
    REFUND_DELAYED: define('REFUND_DELAYED', {
        label: 'Remboursement retardé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROGRESS',
        link: eventTicketsOrHistory,
        inApp: (d) => {
            const title = optText(d, 'title');
            return {
                title: 'Remboursement retardé',
                content: `Le remboursement de ${money(d, 'amount')}${title ? ` pour ${q(title)}` : ''} est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement.`,
            };
        },
        sms: (d) => {
            const title = optText(d, 'title');
            return `${SMS_PREFIX}remboursement de ${smsAmount(num(d, 'amount'))} retardé${title ? ` ("${smsVar(title, 30)}")` : ''}. L'équipe Event Village s'en occupe, aucune action de votre part.`;
        },
        sample: { ...SAMPLE_EVENT, cashout_id: SAMPLE_ID.cashout, amount: 10_200 },
    }),
    // N2 (R1, R10) : retrait bloqué ou en retard ; le montant reste réservé.
    WITHDRAWAL_DELAYED: define('WITHDRAWAL_DELAYED', {
        label: 'Retrait retardé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'WITHDRAWAL_PENDING_CHECK',
        link: withdrawalPath,
        inApp: (d) => ({
            title: 'Retrait retardé',
            content: `Votre retrait de ${money(d, 'amount')} est retardé. L'équipe Event Village s'en occupe : le montant reste réservé et vous serez prévenu du versement.`,
        }),
        sms: (d) => `${SMS_PREFIX}votre retrait de ${smsAmount(num(d, 'amount'))} est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`,
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 25_000, account_kind: 'ORGANISATEUR' },
    }),
    // N3 (R1, R9, R10) : versement à reprendre (retard de 30 min, tous types) ou retrait bloqué ; refunds.manage.
    ADMIN_CASHOUT_TO_RESUME: define('ADMIN_CASHOUT_TO_RESUME', {
        label: 'Versement à reprendre', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'refunds.manage', inAppType: 'CASHOUT_ALERT',
        link: () => '/admin/finance#versements-a-reprendre',
        inApp: (d) => {
            const cause = text(d, 'cause');
            const amount = money(d, 'amount');
            const kind = field(d, 'kind');
            if (cause === 'DELAYED') return { title: 'Versement à reprendre', content: `Un versement de ${amount} (${cashoutKindLabel(kind)}) attend depuis plus de 30 minutes.` };
            if (cause === 'BLOCKED') {
                const reason = optText(d, 'blocked_reason');
                const motif = reason ? blockedReasonLabel(reason).replace(/[\s.]+$/, '') : 'informations du bénéficiaire incomplètes';
                return {
                    title: 'Versement à reprendre',
                    content: kind === 'WITHDRAWAL'
                        ? `Un retrait de ${amount} est bloqué : ${motif}.`
                        : `Un versement de ${amount} (${cashoutKindLabel(kind)}) est bloqué : ${motif}.`,
                };
            }
            throw new TemplateDataError('cause', 'inconnue (DELAYED ou BLOCKED attendu)');
        },
        sample: { cashout_id: SAMPLE_ID.cashout, amount: 10_200, kind: 'REFUND', cause: 'DELAYED', blocked_reason: null },
    }),
    // N4 (R30, H1) : paiement encaissé sans billet possible, ou paiement en double (duplicate_of), remboursé.
    PAYMENT_REFUND_STARTED: define('PAYMENT_REFUND_STARTED', {
        label: 'Remboursement d’un paiement', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'REFUND_PROGRESS',
        link: eventTicketsOrHistory,
        inApp: (d) => {
            const title = optText(d, 'title');
            const what = title ? ` pour ${q(title)}` : '';
            const op = operatorLabel(field(d, 'operator'));
            return {
                title: 'Remboursement de votre paiement',
                // Lot 9 quater (C1 : AUD-20) : au-delà de 2 doublons en 30 jours, frais de l'opérateur retenus
                content: optText(d, 'duplicate_of') && Number(d.withheld ?? 0) > 0
                    ? `Un nouveau paiement de ${money(d, 'amount')}${what} a été encaissé en double pour le même panier. C'est le troisième en 30 jours : il vous est remboursé moins les frais de l'opérateur (${money(d, 'withheld')}), soit ${money(d, 'refund_amount')}, sur votre compte ${op} ; vos billets restent valables.`
                    : optText(d, 'duplicate_of')
                    ? `Un second paiement de ${money(d, 'amount')}${what} a été encaissé pour le même panier. Il vous est remboursé sur votre compte ${op} ; vos billets restent valables.`
                    : `Votre paiement de ${money(d, 'amount')}${what} a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte ${op} : vous serez prévenu du versement.`,
            };
        },
        sms: (d) => {
            const title = optText(d, 'title');
            const amount = smsAmount(num(d, 'amount'));
            const op = operatorLabel(field(d, 'operator'));
            if (optText(d, 'duplicate_of') && Number(d.withheld ?? 0) > 0) {
                return `${SMS_PREFIX}paiement en double de ${amount}, remboursé moins ${smsAmount(num(d, 'withheld'))} de frais sur votre compte ${op}. Vos billets restent valables.`;
            }
            if (optText(d, 'duplicate_of')) {
                return `${SMS_PREFIX}paiement en double de ${amount}${title ? ` ("${smsVar(title, 28)}")` : ''}, remboursé sur votre compte ${op}. Vos billets restent valables.`;
            }
            return `${SMS_PREFIX}paiement de ${amount}${title ? ` ("${smsVar(title, 30)}")` : ''} sans billet possible : il vous est remboursé sur votre compte ${op}.`;
        },
        sample: { ...SAMPLE_EVENT, payment_id: SAMPLE_ID.payment, amount: 10_200, operator: 'WAVE', duplicate_of: null },
    }),
    // N5 (R54) : dossier refusé complété une fois, partners.read.
    ADMIN_PARTNER_RESUBMITTED: define('ADMIN_PARTNER_RESUBMITTED', {
        label: 'Dossier partenaire complété', channels: ['IN_APP', 'PUSH', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'partners.read', inAppType: 'ADMIN_REVIEW',
        link: partnerDossierPath,
        inApp: (d) => ({ title: 'Dossier complété', content: `${text(d, 'company')} a complété son dossier refusé : il attend un nouvel examen.` }),
        sample: { partner_id: SAMPLE_ID.partner, company: 'Sabar Events' },
    }),
    // N6 (R3, X10) : porteurs d'un événement suspendu puis clos par l'administration, sans motif.
    EVENT_CLOSED_HOLDER: define('EVENT_CLOSED_HOLDER', {
        label: 'Clôture d’un événement suspendu (porteurs)', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        link: eventTicketsPath,
        inApp: (d) => ({
            title: 'Événement clos',
            content: `${q(text(d, 'title'))} est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} est clos après sa suspension, sans annulation ni remboursement automatique. ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    // N7 (R3) : propriétaire d'un événement suspendu puis clos, avec le motif de l'admin.
    EVENT_CLOSED_BY_ADMIN: define('EVENT_CLOSED_BY_ADMIN', {
        label: 'Clôture d’un événement par l’administration', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({
            title: 'Événement clos par l\'administration',
            content: `${q(text(d, 'title'))} du ${formatDateTime(iso(d, 'start_at'))} est clos par l'administration, sans annulation. Motif : ${sentence(text(d, 'reason'))}`,
        }),
        sms: (d) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} est clos par l'équipe Event Village après sa suspension. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 40))}`,
        sample: { ...SAMPLE_EVENT, reason: 'Organisateur injoignable.' },
    }),
    // N8 (R43, X11) : passage à TERMINE avec au moins une caisse ouverte.
    SHIFT_OPEN_AT_END: define('SHIFT_OPEN_AT_END', {
        label: 'Caisse encore ouverte à la fin', channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d, 'caisse'),
        inApp: (d) => {
            const n = count(d, 'open_shifts');
            return {
                title: 'Caisse encore ouverte',
                content: n > 1
                    ? `${q(text(d, 'title'))} est terminé et ${n} caisses restent ouvertes. Fermez-les dans l'onglet Caisse du pilotage.`
                    : `${q(text(d, 'title'))} est terminé et 1 caisse reste ouverte. Fermez-la dans l'onglet Caisse du pilotage.`,
            };
        },
        sms: (d, ctx) => {
            const n = count(d, 'open_shifts');
            const tail = n > 1 ? `${n} caisses restent ouvertes. Fermez-les` : '1 caisse reste ouverte. Fermez-la';
            return `${SMS_PREFIX}${smsVar(text(d, 'title'), 25)} est terminé et ${tail} dans le pilotage : ${appLink(ctx, '/partner/events')}`;
        },
        sample: { ...SAMPLE_EVENT, open_shifts: 2 },
    }),
    // N9 (R61, X22) : billet remboursé pendant son transfert ; SMS au numéro, in-app, push et email au compte.
    TRANSFER_REVOKED: define('TRANSFER_REVOKED', {
        label: 'Transfert annulé par un remboursement', channels: ['SMS', 'IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        link: () => '/tickets?tab=recus',
        inApp: (d) => ({ title: 'Transfert annulé', content: `Le billet pour ${q(text(d, 'title'))} a été remboursé à son acheteur : le transfert est annulé.` }),
        sms: (d) => `${SMS_PREFIX}le billet ${smsVar(text(d, 'title'), 30)} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    // N10 (R46) : le destinataire refuse le billet ; l'expéditeur le garde.
    TRANSFER_DECLINED_SENDER: define('TRANSFER_DECLINED_SENDER', {
        label: 'Transfert refusé (expéditeur)', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        night: 'DEFER',
        link: ticketPath,
        inApp: (d) => ({ title: 'Billet refusé', content: `Le destinataire a refusé votre billet pour ${q(text(d, 'title'))} : il reste dans vos billets.` }),
        // Finition 4 (point 4, E-46) : billet revenu à l'expéditeur
        sms: (d, ctx) => `${SMS_PREFIX}le destinataire a refusé votre billet ${endWithPeriod(smsVar(text(d, 'title'), 30))} Il vous revient : ${appLink(ctx, '/tickets')}`,
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    // N11 (R63) : le destinataire change de numéro ; le transfert est annulé.
    TRANSFER_RECIPIENT_CHANGED: define('TRANSFER_RECIPIENT_CHANGED', {
        label: 'Transfert annulé (numéro du destinataire changé)', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_TRANSFER',
        night: 'DEFER',
        link: ticketPath,
        // Finition 4 (point 4, E-46) : billet revenu à l'expéditeur
        sms: (d, ctx) => `${SMS_PREFIX}transfert du billet ${smsVar(text(d, 'title'), 25)} annulé, le destinataire a changé de numéro. Il vous revient : ${appLink(ctx, '/tickets')}`,
        inApp: (d) => ({
            title: 'Transfert annulé',
            content: `Le destinataire de votre billet pour ${q(text(d, 'title'))} a changé de numéro : le transfert est annulé et le billet reste dans vos billets.`,
        }),
        sample: { ...SAMPLE_EVENT, transfer_id: SAMPLE_ID.transfer, ticket_id: SAMPLE_ID.ticket },
    }),
    // N12 (R37) : invitation à contrôler, acceptée par le titulaire dans l'application (page /invitations).
    CONTROLLER_INVITATION: define('CONTROLLER_INVITATION', {
        label: 'Invitation à contrôler l’entrée', channels: ['SMS', 'IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: (d) => `/invitations#invitation-${ident(d, 'invitation_id')}`,
        inApp: (d) => {
            const main = mainAssignment(d);
            const company = text(d, 'company');
            const more = main.others > 0 ? ` et ${main.others} ${main.others > 1 ? 'autres événements' : 'autre événement'}` : '';
            return {
                title: `Invitation de ${company}`,
                content: `${company} vous invite à contrôler l'entrée de ${q(main.title)}${more}. Répondez avant le ${formatDateTime(iso(d, 'expires_at'))}.`,
            };
        },
        sms: (d, ctx) => {
            const main = mainAssignment(d);
            const body = `${smsVar(text(d, 'company'), 18)} vous invite à scanner les billets de ${smsVar(main.title, 18)}${othersClause(main.others)}`;
            return `${SMS_PREFIX}${endWithPeriod(body)} Répondez sur ${appLink(ctx, '/invitations')}`;
        },
        sample: {
            invitation_id: SAMPLE_ID.invitation, company: 'Sabar Events', expires_at: '2026-11-12T18:30:00.000Z',
            events: [
                { event_id: SAMPLE_EVENT.event_id, title: SAMPLE_EVENT.title, start_at: SAMPLE_EVENT.start_at },
                { event_id: SAMPLE_ID.otherEvent, title: 'Nuit du Mbalax', start_at: '2026-11-21T21:00:00.000Z' },
            ],
        },
    }),
    // Finition 1 (E-20) : avis à la partenaire quand le contrôleur invité accepte, refuse ou laisse expirer l'invitation.
    // Cloche, push et email ; jamais de SMS (consigne). Nom complet pour une acceptation, masqué sinon.
    CONTROLLER_INVITATION_ACCEPTED: define('CONTROLLER_INVITATION_ACCEPTED', {
        label: 'Invitation de contrôleur acceptée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        night: 'DEFER',
        link: () => '/partner/team',
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'controller_name'), 18)} a accepté de scanner les billets à vos entrées. Choisissez sa porte : ${appLink(ctx, '/partner/team')}`,
        inApp: (d) => ({
            title: 'Invitation acceptée',
            content: `${text(d, 'controller_name')} a accepté votre invitation à contrôler l'entrée de ${invitedEventsClause(d)}. Choisissez sa porte et les espèces dans votre équipe.`,
        }),
        sample: { ...SAMPLE_TEAM_NOTICE, controller_name: 'Aminata Fall' },
    }),
    CONTROLLER_INVITATION_DECLINED: define('CONTROLLER_INVITATION_DECLINED', {
        label: 'Invitation de contrôleur refusée', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        night: 'DEFER',
        link: () => '/partner/team',
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'controller_name'), 18)} a refusé de scanner les billets à vos entrées. Invitez une autre personne : ${appLink(ctx, '/partner/team')}`,
        inApp: (d) => ({
            title: 'Invitation refusée',
            content: `${text(d, 'controller_name')} a refusé votre invitation à contrôler l'entrée de ${invitedEventsClause(d)}. Invitez une autre personne depuis votre équipe.`,
        }),
        sample: { ...SAMPLE_TEAM_NOTICE, controller_name: 'Ou*** B***' },
    }),
    CONTROLLER_INVITATION_EXPIRED: define('CONTROLLER_INVITATION_EXPIRED', {
        label: 'Invitation de contrôleur sans réponse', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        night: 'DEFER',
        link: () => '/partner/team',
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'controller_name'), 18)} n'a pas répondu à votre invitation à scanner les billets. Invitez de nouveau : ${appLink(ctx, '/partner/team')}`,
        inApp: (d) => ({
            title: 'Invitation sans réponse',
            content: `${text(d, 'controller_name')} n'a pas répondu à votre invitation à contrôler l'entrée de ${invitedEventsClause(d)} : elle a expiré. Invitez de nouveau depuis votre équipe.`,
        }),
        sample: { ...SAMPLE_TEAM_NOTICE, controller_name: 'Kh*** S***' },
    }),
    // Correctifs de la contre-vérification (migration 20261115000014) : un contrôleur devenu compte d'administration quitte
    // l'équipe de l'organisatrice. Cloche, push et email ; jamais de SMS (décision de l'utilisateur).
    CONTROLLER_BECAME_ADMIN: define('CONTROLLER_BECAME_ADMIN', {
        label: 'Contrôleur devenu administrateur', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        night: 'DEFER',
        link: () => '/partner/team',
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'controller_name'), 18)} ne fait plus partie de votre équipe d'entrée. Invitez une autre personne : ${appLink(ctx, '/partner/team')}`,
        inApp: (d) => ({
            title: 'Contrôleur retiré de votre équipe',
            content: `${text(d, 'controller_name')} ne fait plus partie de votre équipe : son compte est devenu un compte d'administration Event Village. Invitez une autre personne pour vos entrées.`,
        }),
        sample: { controller_name: 'Aminata Fall' },
    }),
    // N13 (R15) : propriétaire d'un événement annulé par un admin ; avis public, jamais le motif interne.
    EVENT_CANCELLED_BY_ADMIN: define('EVENT_CANCELLED_BY_ADMIN', {
        label: 'Annulation d’un événement par l’administration', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d, 'cloture'),
        inApp: (d) => {
            const notice = optText(d, 'public_notice');
            return {
                title: 'Événement annulé par l\'administration',
                content: `${q(text(d, 'title'))} du ${formatDateTime(iso(d, 'start_at'))} est annulé par l'administration.${notice ? ` Motif : ${sentence(notice)}` : ''} Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture.`,
            };
        },
        sms: (d, ctx) => {
            const notice = optText(d, 'public_notice');
            return `${SMS_PREFIX}${smsVar(text(d, 'title'), 25)} annulé par l'administration.${notice ? ` Motif : ${endWithPeriod(smsClause(notice, 35))}` : ''} ${appLink(ctx, '/partner/events')}`;
        },
        sample: { ...SAMPLE_EVENT, public_notice: 'Intempéries annoncées sur Dakar.' },
    }),
    // N14 (R15) : admins events.read, annulation par l'organisateur, motif interne.
    ADMIN_EVENT_CANCELLED: define('ADMIN_EVENT_CANCELLED', {
        label: 'Événement annulé par l’organisateur', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'events.read', inAppType: 'EVENT_STATUS',
        link: (d) => `/admin/events/${ident(d, 'event_id')}`,
        inApp: (d) => {
            const company = optText(d, 'company');
            const reason = optText(d, 'reason');
            return {
                title: 'Événement annulé par l\'organisateur',
                content: `${q(text(d, 'title'))}${company ? ` de ${company}` : ''} est annulé par l'organisateur.${reason ? ` Motif interne : ${sentence(reason)}` : ''}`,
            };
        },
        sample: { ...SAMPLE_EVENT, company: 'Sabar Events', reason: 'Salle indisponible à la date prévue.' },
    }),
    // N15 (R33) : contrôleurs affectés (affectations acceptées) à l'annulation.
    CONTROLLER_EVENT_CANCELLED: define('CONTROLLER_EVENT_CANCELLED', {
        label: 'Annulation d’un événement contrôlé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: () => '/controller/scanner',
        inApp: (d) => ({
            title: 'Contrôle annulé',
            content: `${q(text(d, 'title'))} du ${formatDateTime(iso(d, 'start_at'))} est annulé : votre affectation à l'entrée est retirée.`,
        }),
        sms: (d) => `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} du ${smsDateTime(iso(d, 'start_at'))} est annulé. Votre affectation à l'entrée est retirée.`,
        sample: { ...SAMPLE_EVENT },
    }),
    // N16 (R33) : changement de date ou de lieu ; SMS et email regroupés sur 10 minutes, in-app immédiat.
    CONTROLLER_EVENT_CHANGED: define('CONTROLLER_EVENT_CHANGED', {
        label: 'Changement d’un événement contrôlé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: () => '/controller/scanner',
        inApp: controllerChangedInApp,
        sms: controllerChangedSms,
        sample: { ...SAMPLE_EVENT, changed_fields: ['start_date', 'start_time'], new_start_at: '2026-11-21T21:00:00.000Z' },
    }),
    // N17 (R33) : suspension et reprise, in-app et email seulement.
    CONTROLLER_EVENT_STATUS: define('CONTROLLER_EVENT_STATUS', {
        label: 'Suspension ou reprise d’un événement contrôlé', channels: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'], audience: 'CONTROLLER', suspendedPolicy: 'BLOCK', inAppType: 'CONTROLLER',
        link: () => '/controller/scanner',
        sms: (d) => {
            const status = text(d, 'status');
            if (status === 'SUSPENDU') return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} est suspendu : le scan des billets est fermé jusqu'à nouvel avis.`;
            if (status === 'PUBLIE') return `${SMS_PREFIX}${smsVar(text(d, 'title'), 30)} reprend : votre affectation à l'entrée est maintenue.`;
            throw new TemplateDataError('status', 'inconnu (SUSPENDU ou PUBLIE attendu)');
        },
        inApp: (d) => {
            const status = text(d, 'status');
            if (status === 'SUSPENDU') {
                return { title: 'Événement suspendu', content: `${q(text(d, 'title'))} est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis.` };
            }
            if (status === 'PUBLIE') return { title: 'Événement de nouveau en ligne', content: `${q(text(d, 'title'))} reprend : votre affectation est maintenue.` };
            throw new TemplateDataError('status', 'inconnu (SUSPENDU ou PUBLIE attendu)');
        },
        sample: { ...SAMPLE_EVENT, status: 'SUSPENDU' },
    }),
    // N18 (R22) : invitation, billet gratuit ou billet payé en espèces annulé hors annulation de l'événement.
    TICKET_CANCELLED: define('TICKET_CANCELLED', {
        label: 'Billet annulé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'TICKET',
        link: ticketPath,
        inApp: (d) => {
            const kind = text(d, 'kind');
            const what = `${q(text(d, 'title'))} du ${formatDateTime(iso(d, 'start_at'))}`;
            if (kind === 'INVITATION') return { title: 'Invitation annulée', content: `Votre invitation pour ${what} est annulée par l'organisateur.` };
            if (kind === 'FREE') return { title: 'Billet annulé', content: `Votre billet gratuit pour ${what} est annulé par l'organisateur.` };
            if (kind === 'CASH') return { title: 'Billet annulé', content: `Votre billet pour ${what} est annulé. Le remboursement se fait auprès de l'organisateur.` };
            throw new TemplateDataError('kind', 'inconnu (INVITATION, FREE ou CASH attendu)');
        },
        sms: (d) => {
            const kind = text(d, 'kind');
            const what = `${smsVar(text(d, 'title'), 30)} du ${smsDateTime(iso(d, 'start_at'))}`;
            if (kind === 'INVITATION') return `${SMS_PREFIX}votre invitation pour ${what} est annulée par l'organisateur.`;
            if (kind === 'FREE') return `${SMS_PREFIX}votre billet gratuit pour ${what} est annulé par l'organisateur.`;
            if (kind === 'CASH') return `${SMS_PREFIX}votre billet pour ${what} est annulé. Remboursement par l'organisateur.`;
            throw new TemplateDataError('kind', 'inconnu (INVITATION, FREE ou CASH attendu)');
        },
        sample: { ...SAMPLE_EVENT, ticket_id: SAMPLE_ID.ticket, kind: 'INVITATION' },
    }),
    // N19 (R59, A8, B74) : envoyé malgré la suspension (politique ALLOW) ; les billets payés restent valables à l'entrée.
    ACCOUNT_SUSPENDED: define('ACCOUNT_SUSPENDED', {
        // Lot 9 quinquies (B1) : lien de la page d'aide au lieu de « Contactez le support. » ; « Billets payés valables à
        // l'entrée. » (plus court) pour garder un motif de 33 septets dans un segment
        label: 'Compte suspendu', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'SECURITY',
        // Finition 4 (point 5, E-04) : aucune promesse du billet hors ligne (la fermeture de session l'efface) ni de la saisie
        // du numéro (réglage access.manual_entry_scope) ; seulement ce qui est vrai : les billets payés restent valables (le
        // contrôle d'accès ne lit pas le statut du compte du porteur), le support répond.
        link: () => '/aide',
        inApp: (d) => ({
            title: 'Compte suspendu',
            content: `Votre compte est suspendu. Motif : ${sentence(text(d, 'reason'))} Vos billets payés restent valables. Pour toute question, et avant de vous rendre à un événement, ouvrez la page Aide pour joindre le support.`,
        }),
        sms: (d, ctx) => `${SMS_PREFIX}votre compte est suspendu. Motif : ${endWithPeriod(smsClause(text(d, 'reason'), 33))} Vos billets payés restent valables. Aide : ${appLink(ctx, '/aide')}`,
        sample: { reason: 'Paiements contestés' },
    }),
    // N20 (R59) : réactivation du compte.
    ACCOUNT_REACTIVATED: define('ACCOUNT_REACTIVATED', {
        label: 'Compte réactivé', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: 'SECURITY',
        link: () => '/login',
        inApp: () => ({ title: 'Compte réactivé', content: 'Votre compte est réactivé : vous pouvez de nouveau vous connecter.' }),
        sms: (_d, ctx) => `${SMS_PREFIX}votre compte est réactivé. Vous pouvez de nouveau vous connecter : ${appLink(ctx, '/login')}`,
        sample: {},
    }),
    // N21 (R18) : titre, affiche, lieu, date changés ou catégorie ajoutée après validation ; events.read.
    // Lot 9 ter (M1, 9t.10) : prix ou canaux de vente d'une catégorie changés (parties PRICE et CHANNELS).
    ADMIN_EVENT_CHANGED: define('ADMIN_EVENT_CHANGED', {
        label: 'Événement modifié après validation', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'events.read', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/events/${ident(d, 'event_id')}`,
        inApp: (d) => {
            const company = optText(d, 'company');
            return {
                title: 'Événement modifié après validation',
                content: `${q(text(d, 'title'))}${company ? ` de ${company}` : ''} : ${adminChangeList(d)} après validation. Vérifiez la fiche.`,
            };
        },
        sample: { ...SAMPLE_EVENT, company: 'Sabar Events', changes: ['TITLE', 'POSTER'], old_title: 'Gala Teranga', category: null },
    }),
    // N22 (R95) : accusé de soumission à la propriétaire.
    EVENT_SUBMITTED_ACK: define('EVENT_SUBMITTED_ACK', {
        label: 'Événement envoyé en validation', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'EVENT_STATUS',
        link: (d) => partnerEventPath(d),
        inApp: (d) => ({
            title: 'Événement envoyé en validation',
            content: `${q(text(d, 'title'))} est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision.`,
        }),
        sample: { ...SAMPLE_EVENT },
    }),
    // N23 (R72) : passage à TERMINE sans caisse ouverte.
    EVENT_FINISHED: define('EVENT_FINISHED', {
        label: 'Événement terminé', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        night: 'DEFER',
        link: (d) => partnerEventPath(d, 'cloture'),
        inApp: (d) => ({ title: 'Événement terminé', content: `${q(text(d, 'title'))} est terminé. Le rapport de clôture est prêt dans l'onglet Clôture.` }),
        sample: { ...SAMPLE_EVENT },
    }),
    // N24 (R72) : dernière caisse fermée d'un événement terminé.
    CLOSING_REPORT_READY: define('CLOSING_REPORT_READY', {
        label: 'Rapport de clôture prêt', channels: ['IN_APP', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        night: 'DEFER',
        link: (d) => partnerEventPath(d, 'cloture'),
        inApp: (d) => ({ title: 'Rapport de clôture prêt', content: `Toutes les caisses de ${q(text(d, 'title'))} sont fermées : le rapport de clôture est prêt.` }),
        sample: { ...SAMPLE_EVENT },
    }),
    // N25 (R72) : recettes d'un événement terminé disponibles au retrait (règle de B15), sans montant.
    FUNDS_AVAILABLE: define('FUNDS_AVAILABLE', {
        label: 'Recettes disponibles', channels: ['IN_APP', 'EMAIL', 'PUSH', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'SALES',
        night: 'DEFER',
        link: () => '/partner/finance',
        inApp: (d) => ({ title: 'Recettes disponibles', content: `Les recettes de ${q(text(d, 'title'))} sont disponibles sur votre solde : vous pouvez demander un retrait.` }),
        // Finition 4 (point 4, E-47)
        sms: (d, ctx) => `${SMS_PREFIX}les recettes de ${smsVar(text(d, 'title'), 30)} sont disponibles. Demandez votre retrait : ${appLink(ctx, '/partner/finance')}`,
        sample: { ...SAMPLE_EVENT },
    }),
    // ── Lot 9 ter (contrat 11.1, 11.2 N1 à N4) ──
    // N1 (9t.2, consigne 0.2) : détenteur actuel d'un billet transféré, remboursé hors annulation à l'acheteur d'origine.
    TICKET_REFUNDED_HOLDER: define('TICKET_REFUNDED_HOLDER', {
        label: 'Billet transféré annulé (détenteur)', channels: ['SMS', 'IN_APP', 'PUSH', 'EMAIL'], audience: 'CLIENT', suspendedPolicy: 'ALLOW', inAppType: 'TICKET',
        link: ticketPath,
        inApp: (d) => ({
            title: 'Billet annulé',
            content: `Votre billet ${text(d, 'category')} pour ${q(text(d, 'title'))} du ${formatDateTime(iso(d, 'start_at'))} a été annulé. Le remboursement est versé à l'acheteur d'origine.`,
        }),
        sms: (d) => `${SMS_PREFIX}votre billet ${smsVar(text(d, 'category'), 25)} pour ${smsVar(text(d, 'title'), 30)} a été annulé. Le remboursement est versé à l'acheteur d'origine.`,
        sample: { ...SAMPLE_EVENT, ticket_id: SAMPLE_ID.ticket, category: 'VIP' },
    }),
    // N2 (9t.10, R95) : publication par l'organisatrice d'un événement validé ; events.read.
    ADMIN_EVENT_PUBLISHED: define('ADMIN_EVENT_PUBLISHED', {
        label: 'Événement publié par l’organisateur', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'events.read', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/events/${ident(d, 'event_id')}`,
        inApp: (d) => {
            const company = optText(d, 'company');
            return {
                title: 'Événement publié par l\'organisateur',
                content: `${q(text(d, 'title'))}${company ? ` de ${company}` : ''} est publié par l'organisateur : sa page publique est en ligne.`,
            };
        },
        sample: { ...SAMPLE_EVENT, company: 'Sabar Events' },
    }),
    // N3 (9t.10, R95) : soumission retirée de la validation par l'organisatrice ; events.read.
    ADMIN_EVENT_WITHDRAWN: define('ADMIN_EVENT_WITHDRAWN', {
        label: 'Soumission retirée par l’organisateur', channels: ['IN_APP', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', adminPermission: 'events.read', inAppType: 'ADMIN_REVIEW',
        link: (d) => `/admin/events/${ident(d, 'event_id')}`,
        inApp: (d) => {
            const company = optText(d, 'company');
            return {
                title: 'Soumission retirée par l\'organisateur',
                content: `${q(text(d, 'title'))}${company ? ` de ${company}` : ''} est retiré de la validation par l'organisateur : il n'attend plus votre examen.`,
            };
        },
        sample: { ...SAMPLE_EVENT, company: 'Sabar Events' },
    }),
    // N4 (9t.18, D-pil 4) : refus en série à une porte, à la partenaire ; aucun SMS (D-P3).
    SCAN_REFUSALS_ALERT: define('SCAN_REFUSALS_ALERT', {
        label: 'Refus en série à une porte', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'ALERT',
        link: (d) => partnerEventPath(d, 'entrees'),
        // Finition 4 (point 4, E-47) : au plus un SMS par porte et par 15 minutes (scan_refusal_alert)
        sms: (d, ctx) => `${SMS_PREFIX}${smsVar(text(d, 'gate_name'), 12)} : ${count(d, 'refused_count')} refus en ${count(d, 'window_minutes')} min pour ${endWithPeriod(smsVar(text(d, 'title'), 20))} Vérifiez cette porte avec votre équipe. ${appLink(ctx, '/partner/events')}`,
        inApp: (d) => ({
            title: 'Refus en série à une porte',
            content: `${text(d, 'gate_name')} : ${count(d, 'refused_count')} refus en ${plural(count(d, 'window_minutes'), 'minute', 'minutes')} pour ${q(text(d, 'title'))}. Vérifiez la porte avec vos contrôleurs.`,
        }),
        sample: { ...SAMPLE_EVENT, gate_name: 'Porte B', zone_name: 'Entrée générale', refused_count: 12, window_minutes: 5, threshold: 10 },
    }),
    // Lot 9 quinquies (D1) : SMS indispensable aux admins qui peuvent agir, regroupé (au plus un par 30 minutes et par
    // admin, rien de 22 h à 8 h : migration 20261112000001). Une candidature seule : texte nominatif ; sinon le
    // regroupé (la partie à zéro est omise). Guillemets droits : « » n'existent pas en GSM-7.
    ADMIN_REVIEW_SMS: define('ADMIN_REVIEW_SMS', {
        label: 'SMS aux administrateurs : à valider', channels: ['SMS'], audience: 'ADMIN', suspendedPolicy: 'BLOCK', inAppType: null,
        // Finition 4 (point 1) : D1 suit la plage de nuit réglée (report à sa fin)
        night: 'DEFER',
        link: () => '/admin/dashboard',
        sms: (d, ctx) => adminReviewSms(d, ctx),
        sample: { partner_count: 1, event_count: 0, company: 'Association culturelle Sabar Events Dakar Plateau' },
    }),
    // Lot 9 quinquies (A1 : AUTH-01) : 10e échec de mot de passe en 15 minutes, une fois par jour. SMS de la consigne
    // ramené à 160 septets avec l'URL de 27 caractères : « plusieurs connexions ont échoué » (au lieu de « plusieurs
    // essais de connexion ont échoué », 169 septets, deux segments).
    ACCOUNT_LOGIN_FAILURES: define('ACCOUNT_LOGIN_FAILURES', {
        label: 'Essais de connexion échoués', channels: ['SMS', 'EMAIL'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: null,
        link: () => '/forgot-password',
        inApp: () => ({
            title: 'Essais de connexion échoués',
            content: 'Plusieurs essais de connexion ont échoué sur votre compte. Si ce n’est pas vous, changez votre mot de passe avec « Mot de passe oublié ».',
        }),
        sms: (_d, ctx) => `${SMS_PREFIX}plusieurs connexions ont échoué sur votre compte. Si ce n'est pas vous, changez votre mot de passe : ${appLink(ctx, '/forgot-password')}`,
        sample: { day: '2026-11-13' },
    }),
    // Lot 9 quinquies (C2 : AUTH-09) : SMS indispensable au numéro du compte (texte du chef de projet) et email de
    // confirmation à l'adresse désormais vérifiée ; l'adresse n'est jamais écrite dans le SMS.
    EMAIL_ADDED: define('EMAIL_ADDED', {
        label: 'Adresse email ajoutée au compte', channels: ['SMS', 'EMAIL'], audience: 'ANY', suspendedPolicy: 'BLOCK', inAppType: null,
        link: () => '/aide',
        inApp: () => ({
            title: 'Adresse email ajoutée',
            content: 'Cette adresse email est désormais celle de votre compte Event Village : elle sert à vous connecter et à recevoir vos billets. Si ce n’est pas vous, ouvrez la page d’aide pour joindre le support.',
        }),
        sms: (_d, ctx) => `${SMS_PREFIX}une adresse email a été ajoutée à votre compte. Si ce n'est pas vous : ${appLink(ctx, '/aide')}`,
        sample: {},
    }),
    // Finition 3d (point 4a) : espèces d'une vente au guichet marquées rendues par un admin, à la place de l'organisatrice ;
    // le motif est écrit. Lien vers l'onglet Clôture du pilotage (liste des espèces à rembourser).
    CASH_REFUND_MARKED_BY_ADMIN: define('CASH_REFUND_MARKED_BY_ADMIN', {
        label: 'Espèces marquées rendues par l’administration', channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], audience: 'PARTNER', suspendedPolicy: 'ALLOW', inAppType: 'EVENT_STATUS',
        night: 'DEFER',
        link: (d) => partnerEventPath(d, 'cloture'),
        sms: (d) => `${SMS_PREFIX}l'administration a marqué rendues les espèces de la vente ${smsVar(text(d, 'reference'), 10)} (${smsAmount(num(d, 'amount'))}) pour ${endWithPeriod(smsVar(text(d, 'title'), 20))}`,
        inApp: (d) => ({
            title: 'Espèces marquées rendues par l’administration',
            content: `L'administration a marqué rendues les espèces de la vente ${text(d, 'reference')} (${money(d, 'amount')}) pour ${q(text(d, 'title'))}. Motif : ${sentence(text(d, 'reason'))}`,
        }),
        sample: { ...SAMPLE_EVENT, payment_id: SAMPLE_ID.payment, reference: '1F6E2B9C', amount: 6_000, reason: 'Espèces rendues par la billetterie du lieu' },
    }),
    // Finition 3d (point 3) : un compte devient SUPERADMIN ; alerte (SMS et cloche) à chaque SUPERADMIN actif, l'auteur
    // compris. Pire cas : deux noms tronqués à 25 caractères, 152 septets, un segment GSM-7.
    SUPERADMIN_PROMOTED: define('SUPERADMIN_PROMOTED', {
        label: 'Nouveau super-administrateur (alerte)', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'ALLOW', inAppType: 'SECURITY',
        link: () => '/admin/users',
        inApp: (d) => ({
            title: 'Nouveau super-administrateur',
            content: `${text(d, 'user_name')} est maintenant super-administrateur, nommé par ${text(d, 'actor_name')}. Si ce n’est pas prévu, réagissez tout de suite : changez son rôle depuis Comptes.`,
        }),
        // Run 299 (R74) : nom tronqué (« ... ») sans point ajouté derrière (endWithPeriod)
        sms: (d) => `${SMS_PREFIX}${smsVar(text(d, 'user_name'), 20)} est maintenant super-administrateur, nommé par ${endWithPeriod(smsVar(text(d, 'actor_name'), 20))} Si ce n'est pas prévu, réagissez tout de suite.`,
        sample: { user_name: 'Mame Diarra Bousso Ndiaye Diop', actor_name: 'Aminata Sophie Gueye Sarr Fall' },
    }),
    // Finition 3d (point 2c) : un code de secours a servi (SMS à l'ancien numéro, écrit dans la ligne d'envoi ; email).
    ADMIN_BACKUP_CODE_USED: define('ADMIN_BACKUP_CODE_USED', {
        label: 'Code de secours utilisé (alerte)', channels: ['SMS', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'ALLOW', inAppType: null,
        link: () => '/admin/securite',
        inApp: (d) => ({
            title: 'Code de secours utilisé',
            content: `Un code de secours de votre compte de super-administrateur vient de servir pour ouvrir l’administration. Il vous en reste ${formatInteger(count(d, 'remaining'))}. Si ce n’est pas vous, alertez tout de suite un autre super-administrateur et créez de nouveaux codes.`,
        }),
        // Design 1c : « super-administrateur », plus long : « alertez vite » pour tenir en un SMS (157 caractères)
        sms: () => `${SMS_PREFIX}un code de secours de votre compte de super-administrateur vient de servir. Si ce n'est pas vous, alertez vite un autre super-administrateur.`,
        sample: { remaining: 9 },
    }),
    // Finition 3d (points 2a et 2c) : SMS à l'ANCIEN numéro (sans compte : l'envoyeur viserait le nouveau). EMAIL déclaré
    // (G.49) comme PHONE_CHANGED ; la ligne à l'ancien numéro reste SMS seul, l'email au compte part avec
    // ADMIN_PHONE_CONFIRMED (un seul email pour un seul changement).
    ADMIN_PHONE_CHANGED: define('ADMIN_PHONE_CHANGED', {
        label: 'Numéro d’un administrateur remplacé (ancien numéro)', channels: ['SMS', 'EMAIL'], audience: 'ANY', suspendedPolicy: 'ALLOW', inAppType: null,
        link: () => '/profile',
        inApp: (d) => ({
            title: 'Numéro de téléphone remplacé',
            content: bool(d, 'by_self')
                ? 'Le numéro de votre compte de super-administrateur a été remplacé. Si ce n’est pas vous, alertez tout de suite un autre super-administrateur.'
                : 'Le super-administrateur a remplacé le numéro de votre compte administrateur. L’ancien téléphone ne sert plus pour vos codes.',
        }),
        sms: (d) => (bool(d, 'by_self')
            ? `${SMS_PREFIX}le numéro de votre compte de super-administrateur a été remplacé. Si ce n'est pas vous, alertez tout de suite un autre super-administrateur.`
            : `${SMS_PREFIX}le super-administrateur a remplacé ce numéro sur votre compte administrateur. Ce téléphone ne sert plus pour vos codes.`),
        sample: { by_self: false },
    }),
    // Finition 3d (points 2a et 2c) : SMS au NOUVEAU numéro et cloche au compte
    ADMIN_PHONE_CONFIRMED: define('ADMIN_PHONE_CONFIRMED', {
        label: 'Numéro d’un administrateur confirmé (nouveau numéro)', channels: ['IN_APP', 'SMS', 'EMAIL'], audience: 'ADMIN', suspendedPolicy: 'ALLOW', inAppType: 'SECURITY',
        link: () => '/profile',
        inApp: (d) => ({
            title: 'Numéro de téléphone changé',
            content: bool(d, 'by_self')
                ? 'Le numéro de votre compte de super-administrateur a été remplacé. Vos autres appareils sont déconnectés.'
                : 'Le super-administrateur a remplacé le numéro de votre compte administrateur. Les codes administrateur arrivent désormais sur ce numéro.',
        }),
        sms: (d) => (bool(d, 'by_self')
            ? `${SMS_PREFIX}ce numéro est maintenant celui de votre compte de super-administrateur. Vos autres appareils sont déconnectés.`
            : `${SMS_PREFIX}ce numéro est maintenant celui de votre compte administrateur. Reconnectez-vous avec votre mot de passe.`),
        sample: { by_self: false },
    }),
    // ── Finition 4 (décisions du client du 19/11) ──────────────────────────
    // Point 2 : SMS des ventes groupé, au plus toutes les 30 minutes (notif_sale_recorded), sans recompter le premier billet.
    SALES_UPDATE_SMS: define('SALES_UPDATE_SMS', {
        label: 'Ventes groupées par SMS', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channels: ['SMS'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: null, link: null,
        sms: (d) => {
            const n = count(d, 'ticket_count');
            return `${SMS_PREFIX}${smsCount(n)} ${n > 1 ? 'billets vendus' : 'billet vendu'} depuis ${smsTime(iso(d, 'since'))} pour ${smsVar(text(d, 'title'), 30)} : ${smsAmount(num(d, 'total'))}.`;
        },
        sample: { ...SAMPLE_EVENT, payment_id: SAMPLE_ID.payment, ticket_count: 12, total: 60_000, since: '2026-11-14T14:00:00.000Z' },
    }),
    // Point 2 : résumé du matin à 9:00 (notification_daily_checks), ventes, remboursements et entrées de la veille.
    PARTNER_DAILY_SUMMARY: define('PARTNER_DAILY_SUMMARY', {
        label: 'Résumé du matin (ventes de la veille)', family: 'OPTIONAL', topic: 'SALES_SUMMARY', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK',
        inAppType: 'SALES', link: salesPath,
        inApp: (d) => {
            const sold = count(d, 'sold_count');
            const refunds = count(d, 'refund_count');
            const entries = count(d, 'entry_count');
            const events = count(d, 'event_count');
            const title = optText(d, 'title');
            const parts = [
                sold > 0 ? `${plural(sold, 'billet vendu', 'billets vendus')} (+${money(d, 'sold_amount')})` : 'aucun billet vendu',
                refunds > 0 ? `${plural(refunds, 'billet remboursé', 'billets remboursés')} (-${money(d, 'refund_amount')})` : null,
                entries > 0 ? plural(entries, 'entrée', 'entrées') : null,
            ].filter((x): x is string => x !== null);
            const scope = events === 1 && title ? `pour ${q(title)}` : `sur ${events} événements`;
            return { title: 'Résumé de la veille', content: `Hier (${formatDate(iso(d, 'day'))}), ${scope} : ${parts.join(', ')}.` };
        },
        sms: (d) => {
            const sold = count(d, 'sold_count');
            const refunds = count(d, 'refund_count');
            const entries = count(d, 'entry_count');
            const events = count(d, 'event_count');
            const title = optText(d, 'title');
            const parts = [
                sold > 0 ? `${smsCount(sold)} ${sold > 1 ? 'billets vendus' : 'billet vendu'} (${smsAmount(num(d, 'sold_amount'))})` : 'aucun billet vendu',
                refunds > 0 ? `${smsCount(refunds)} ${refunds > 1 ? 'remboursés' : 'remboursé'} (-${smsAmount(num(d, 'refund_amount'))})` : null,
                entries > 0 ? `${smsCount(entries)} ${entries > 1 ? 'entrées' : 'entrée'}` : null,
            ].filter((x): x is string => x !== null);
            const scope = events === 1 && title ? `pour ${smsVar(title, 25)}` : `sur ${smsCount(events)} événements`;
            return `${SMS_PREFIX}hier ${scope} : ${parts.join(', ')}.`;
        },
        sample: {
            ...SAMPLE_EVENT, day: '2026-11-14', sold_count: 1_234, sold_amount: 6_170_000, refund_count: 12, refund_amount: 60_000, entry_count: 1_180, event_count: 1,
        },
    }),
    // Point 3 : bienvenue au premier passage du spectateur (notif_tickets_scanned), une fois par spectateur et par événement ;
    // tient lieu d'« Entrée validée » pour ce billet.
    ENTRY_WELCOME: define('ENTRY_WELCOME', {
        label: 'Bienvenue à l’entrée', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK', inAppType: 'TICKET_SCANNED',
        link: eventPath,
        inApp: (d) => ({
            title: 'Bienvenue',
            content: `Bienvenue à ${q(text(d, 'title'))} ! Bonne soirée avec ${sentence(text(d, 'organizer'))} Votre entrée est validée.`,
        }),
        sms: (d) => `${SMS_PREFIX}Bienvenue à ${smsVar(text(d, 'title'), 40)} ! Bonne soirée avec ${endWithPeriod(smsClause(text(d, 'organizer'), 30))}`,
        sample: { ...SAMPLE_EVENT, organizer: 'Sabar Events', ticket_id: SAMPLE_ID.ticket, entered_at: '2026-11-14T20:05:00.000Z' },
    }),
    // Point 3 : merci le lendemain à 11:00 (désactivable, sujet AFTER_EVENT), avec le lien de l'événement.
    ENTRY_THANKS: define('ENTRY_THANKS', {
        label: 'Merci du lendemain', family: 'OPTIONAL', topic: 'AFTER_EVENT', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'CLIENT', suspendedPolicy: 'BLOCK',
        inAppType: 'THANKS', link: eventPath,
        inApp: (d) => ({
            title: 'Merci d’être venu',
            content: `Merci d'être venu à ${q(text(d, 'title'))}. ${text(d, 'organizer')} et Event Village espèrent vous revoir bientôt.`,
        }),
        // SMS : « être » n'est pas dans l'alphabet GSM-7 (un seul segment exigé) : « merci de votre présence »
        sms: (d, ctx) => `${SMS_PREFIX}merci de votre présence à ${smsVar(text(d, 'title'), 30)} ! ${appLink(ctx, eventPath(d))}`,
        sample: { ...SAMPLE_EVENT, organizer: 'Sabar Events' },
    }),
    // Point 2 : demandes de remboursement des clients, groupées toutes les 15 minutes, sans nom ni numéro du client.
    PARTNER_REFUND_REQUESTS: define('PARTNER_REFUND_REQUESTS', {
        label: 'Remboursements demandés par des clients', channels: ['IN_APP', 'SMS', 'EMAIL', 'PUSH'], audience: 'PARTNER', suspendedPolicy: 'BLOCK', inAppType: 'REFUND_REQUESTED',
        night: 'DEFER',
        link: (d) => partnerEventPath(d, 'ventes'),
        inApp: (d) => {
            const n = count(d, 'ticket_count');
            return n > 1
                ? {
                    title: 'Remboursements demandés',
                    content: `${n} billets de ${q(text(d, 'title'))} sont remboursés à la demande de leurs acheteurs depuis ${formatTime(iso(d, 'since'))} (-${money(d, 'amount')}) : ils sont retirés de vos ventes.`,
                }
                : { title: 'Remboursement demandé', content: `Un billet de ${q(text(d, 'title'))} est remboursé à la demande de son acheteur (-${money(d, 'amount')}) : il est retiré de vos ventes.` };
        },
        sms: (d) => {
            const n = count(d, 'ticket_count');
            return n > 1
                ? `${SMS_PREFIX}${smsCount(n)} billets de ${smsVar(text(d, 'title'), 25)} remboursés à la demande des acheteurs depuis ${smsTime(iso(d, 'since'))} (-${smsAmount(num(d, 'amount'))}).`
                : `${SMS_PREFIX}un billet de ${smsVar(text(d, 'title'), 25)} est remboursé à la demande de son acheteur (-${smsAmount(num(d, 'amount'))}).`;
        },
        sample: { ...SAMPLE_EVENT, ticket_count: 3, amount: 15_000, since: '2026-11-14T14:05:00.000Z' },
    }),
    OTP_LOGIN: defineSync('OTP_LOGIN', 'Code de connexion'),
    OTP_REGISTER: defineSync('OTP_REGISTER', 'Code d’inscription'),
    OTP_PASSWORD_RESET: defineSync('OTP_PASSWORD_RESET', 'Code de réinitialisation du mot de passe'),
    OTP_WITHDRAWAL: defineSync('OTP_WITHDRAWAL', 'Code de confirmation d’un retrait'),
    OTP_PHONE_CHANGE: defineSync('OTP_PHONE_CHANGE', 'Code de changement de numéro'),
    OTP_AUTH_HOOK: defineSync('OTP_AUTH_HOOK', 'Code de connexion (Supabase)'),
    CONTROLLER_INVITE: defineSync('CONTROLLER_INVITE', 'Invitation d’un contrôleur'),
    // Lot 9 quinquies (A2, A3)
    ACCOUNT_ACTIVATION: defineSync('ACCOUNT_ACTIVATION', 'Lien d’activation d’un compte créé par un administrateur'),
    OTP_ADMIN: defineSync('OTP_ADMIN', 'Code administrateur'),
    // Finition 3d (point 2a) : code au nouveau numéro d'un administrateur, à dicter au Superadmin
    OTP_ADMIN_PHONE: defineSync('OTP_ADMIN_PHONE', 'Code au nouveau numéro d’un administrateur'),
    // Lot 12a : code de remise d'une commande (retrait, livraison, nouveau code), envoyé tout de suite, jamais stocké
    ORDER_HANDOVER_CODE: defineSync('ORDER_HANDOVER_CODE', 'Code de remise d’une commande'),
    // N26 (tâche 48) : lien de vérification d'une adresse email, seul envoi vers une adresse non vérifiée.
    EMAIL_VERIFICATION: defineSyncEmail('EMAIL_VERIFICATION', 'Vérification de l’adresse email'),
} satisfies { readonly [T in NotificationType]: NotificationTemplate<TemplateData[T]> };

/**
 * Lot 9 quinquies (D1) : texte du SMS aux admins. `partner_count` (candidatures et dossiers complétés) et `event_count` (événements
 * soumis) ; une candidature nouvelle seule (`company` présent) → texte nominatif ; sinon texte regroupé du chef de projet.
 */
export function adminReviewSms(d: object, ctx: RenderContext): string {
    const partners = count(d, 'partner_count');
    const events = count(d, 'event_count');
    // Lot 11a : établissements soumis à la validation (absent des SMS mis en file avant le lot : 0)
    const venues = optNum(d, 'venue_count') ?? 0;
    // Lot 10b : salles envoyées en validation (absent des SMS mis en file avant le lot : 0) ; contre-vérification (T6) :
    // salles validées modifiées, à revoir
    const halls = optNum(d, 'hall_count') ?? 0;
    const changed = optNum(d, 'hall_changed_count') ?? 0;
    const company = optText(d, 'company');
    const link = appLink(ctx, '/admin/dashboard');
    if (partners === 1 && events === 0 && venues === 0 && halls === 0 && changed === 0 && company) {
        return `${SMS_PREFIX}nouvelle demande de partenaire "${smsVar(company, 40)}". Vérifiez son dossier : ${link}`;
    }
    const parts: string[] = [];
    if (partners > 0) parts.push(`${partners} demande(s) de partenaire`);
    if (events > 0) parts.push(`${events} événement(s)`);
    if (venues > 0) parts.push(`${venues} établissement(s)`);
    if (halls > 0) parts.push(`${halls} salle(s)`);
    if (parts.length === 0 && changed > 0) return `${SMS_PREFIX}${changed} salle(s) validée(s) modifiée(s) à vérifier : ${link}`;
    if (changed > 0) parts.push(`${changed} salle(s) modifiée(s)`);
    if (parts.length === 0) throw new TemplateDataError('partner_count', 'event_count, venue_count, hall_count et hall_changed_count à zéro : rien à valider');
    const detailed = `${SMS_PREFIX}${parts.join(' et ')} attendent votre validation : ${link}`;
    // Lot 10b : quatre rubriques peuvent dépasser un segment ; alors le total seul
    if (smsSegments(detailed).segments <= 1) return detailed;
    return `${SMS_PREFIX}${partners + events + venues + halls + changed} demandes attendent votre validation : ${link}`;
}

/** Lot 11a : nom de l'établissement entre guillemets, sinon « votre établissement ». */
function venueName(d: object, capital = false): string {
    const name = optText(d, 'venue_name');
    return name ? q(name) : capital ? 'Votre établissement' : 'votre établissement';
}

/** Lot 11a : « le 5 décembre 2026 à 20:00 » ; version SMS : « le 5 déc. à 20:00 ». */
function tablePeriod(d: object): string {
    return `le ${formatDate(iso(d, 'date'))} à ${text(d, 'time')}`;
}

function smsTablePeriod(d: object): string {
    return `le ${smsDay(iso(d, 'date'))} à ${text(d, 'time')}`;
}

/** Lot 11b : heure « 21 h 30 » (« 21 h » à l'heure pile) depuis « HH:MM » (heure de Dakar). */
function hm(value: string): string {
    const m = /^(\d{2}):(\d{2})/.exec(value);
    if (!m) throw new TemplateDataError('heure', `« ${value} » n’est pas une heure`);
    const h = String(Number(m[1]));
    return m[2] === '00' ? `${h} h` : `${h} h ${m[2]}`;
}

/**
 * Lot 11b : échéance d'une réponse (au plus 2 h après la demande), heure de Dakar : « 21 h 30 » le jour même,
 * « demain 0 h 15 » le lendemain, sinon « le 5 déc. à 21 h 30 ».
 */
function dueText(value: string, now: Date = new Date(), short = false): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new TemplateDataError('response_due_at', 'n’est pas une date');
    const day = (x: Date): string => x.toISOString().slice(0, 10);
    const t = hm(d.toISOString().slice(11, 16));
    if (day(d) === day(now)) return t;
    if (day(d) === day(new Date(now.getTime() + 86_400_000))) return `demain ${t}`;
    // SMS : « 28 sept. 21 h 45 » (un segment au pire cas) ; ailleurs « le 28 sept. à 21 h 45 »
    return short ? `${smsDay(d)} ${t}` : `le ${smsDay(d)} à ${t}`;
}

/**
 * Lot 11b : fin de l'annulation gratuite (donnée facultative, date et heure de Dakar « AAAA-MM-JJTHH:MM ») :
 * « Annulation gratuite avant le sam. 5 déc. 2026 à 18:00. », ou rien si elle manque ou est illisible.
 */
function cancelFreeSentence(d: object): string {
    const value = optText(d, 'cancel_free_until');
    if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
    return ` Annulation gratuite avant le ${formatDateTime(`${value}:00Z`)}.`;
}

/** Lot 11b : page de la réservation pour le client, pour l'établissement ; lien court des SMS (« /t/<code> »). */
function tableClientLink(d: object): string {
    return `/tables/reservations/${ident(d, 'reservation_id')}`;
}

function tablePartnerLink(d: object): string {
    return `/partner/tables/reservations/${ident(d, 'reservation_id')}`;
}

function tableSmsLink(d: object, ctx: RenderContext): string {
    return appLink(ctx, `/t/${ident(d, 'short_code')}`);
}

function guestsText(d: object): string {
    const n = count(d, 'guests');
    return `${formatInteger(n)} personne${n > 1 ? 's' : ''}`;
}

function tableRefundSentence(d: object): string {
    if (num(d, 'refund_amount') > 0) return `Vous êtes remboursé de ${money(d, 'refund_amount')} sur votre compte de paiement.`;
    return num(d, 'paid_amount') > 0 ? 'Selon les conditions de réservation, l’acompte n’est pas remboursé.' : '';
}

/** Lot 12a : numéro de la commande (« CMD-261121-A1B2C3 »). */
function orderRef(d: object): string {
    return text(d, 'order_number');
}

/** Lot 12a : heure estimée de la remise (« 12:45 »), ou null. */
function orderEta(d: object): string | null {
    const at = optIso(d, 'estimated_at');
    return at ? formatTime(at) : null;
}

/** Lot 12a : remise selon le mode, au participe : livrée, retirée, servie. */
function orderDoneWord(d: object): string {
    const mode = text(d, 'mode');
    return mode === 'LIVRAISON' ? 'livrée' : mode === 'SUR_PLACE' ? 'servie' : 'retirée';
}

/** Lot 12a : mode de remise, pour la partenaire : « Livraison (zone Almadies) », « Retrait », « Sur place (table 4) ». */
function orderModeText(d: object): string {
    const mode = text(d, 'mode');
    if (mode === 'LIVRAISON') {
        const zone = optText(d, 'zone_name');
        return zone ? `Livraison (zone ${zone})` : 'Livraison';
    }
    if (mode === 'SUR_PLACE') {
        const spot = optText(d, 'onsite_label');
        return spot ? `Sur place (${spot})` : 'Sur place';
    }
    return 'Retrait';
}

/** Lot 12d : motif d'un signalement en mots (« un retard », « une commande incomplète », « une erreur… », « un problème »). */
function orderIssueReason(d: object): string {
    const r = text(d, 'reason');
    if (r === 'RETARD') return 'un retard';
    if (r === 'INCOMPLETE') return 'une commande incomplète';
    if (r === 'ERREUR') return 'une erreur dans la commande';
    if (r === 'AUTRE') return 'un problème';
    throw new TemplateDataError('reason', 'inconnu (RETARD, INCOMPLETE, ERREUR ou AUTRE attendu)');
}

/** Lot 12a : remboursement annoncé au client, ou rien. */
function orderRefundSentence(d: object): string {
    return num(d, 'refund_amount') > 0 ? `Vous êtes remboursé de ${money(d, 'refund_amount')} sur votre compte de paiement.` : '';
}

function orderLink(d: object): string {
    return `/orders/${ident(d, 'order_id')}`;
}

function partnerOrderLink(d: object): string {
    return `/partner/orders/${ident(d, 'order_id')}`;
}

function courierOrderLink(d: object): string {
    return `/courier/orders/${ident(d, 'order_id')}`;
}

function hallName(d: object, capital = false): string {
    const name = optText(d, 'hall_name');
    return name ? q(name) : capital ? 'Votre salle' : 'votre salle';
}

/** Lot 10a : « le 5 décembre 2026 », « du 5 au 6 décembre 2026 » ou « le 5 décembre 2026 de 18:00 à 23:00 ». */
function hallPeriod(d: object): string {
    const start = iso(d, 'start_date');
    const end = iso(d, 'end_date');
    const from = optText(d, 'start_time');
    const to = optText(d, 'end_time');
    if (from && to) return `le ${formatDate(start)} de ${from} à ${to}`;
    return start === end ? `le ${formatDate(start)}` : `du ${formatDate(start)} au ${formatDate(end)}`;
}

/** Fin de phrase : pas de second point après une abréviation (« 5 déc. »). */
function dot(value: string): string {
    return value.endsWith('.') ? value : `${value}.`;
}

/** Version SMS : « le 5 déc. », « du 5 déc. au 6 déc. », « le 5 déc. à 18:00 ». */
function smsHallPeriod(d: object): string {
    const start = iso(d, 'start_date');
    const end = iso(d, 'end_date');
    const from = optText(d, 'start_time');
    if (from) return `le ${smsDay(start)} à ${from}`;
    return start === end ? `le ${smsDay(start)}` : `du ${smsDay(start)} au ${smsDay(end)}`;
}

function hallPaidSentence(d: object): string {
    const paid = num(d, 'paid_amount');
    const total = num(d, 'total_amount');
    return paid >= total ? `Elle est entièrement payée : ${money(d, 'total_amount')}.` : `L’acompte est payé : ${money(d, 'paid_amount')} sur ${money(d, 'total_amount')}.`;
}

function hallRefundSentence(d: object): string {
    return num(d, 'refund_amount') > 0
        ? `Vous êtes remboursé de ${money(d, 'refund_amount')} sur votre compte de paiement.`
        : 'Selon les conditions d’annulation de la salle, aucun remboursement n’est dû.';
}

/** Lot 10b : réservation dans « Mes réservations » (client). */
function hallClientLink(d: object): string {
    const id = optText(d, 'reservation_id');
    return id ? `/halls/reservations/${encodeURIComponent(id)}` : '/halls/reservations';
}

/** Lot 10b : réservation dans l'espace de la salle (partenaire). */
function hallPartnerLink(d: object): string {
    const id = optText(d, 'reservation_id');
    return id ? `/partner/halls/reservations/${encodeURIComponent(id)}` : '/partner/halls';
}

/** Lot 10b : « à 18:00 » pour une réservation à l'heure, rien à la journée (précédé d'une espace). */
function hallStartTime(d: object): string {
    const from = optText(d, 'start_time');
    return from ? ` à ${from}` : '';
}

const HALL_CHANGE_LABELS: Readonly<Record<string, string>> = { NOM: 'nom', ADRESSE: 'adresse', PRIX: 'prix', PHOTOS: 'photos' };

/** Lot 10b : « prix et photos » (champs changés d'une salle validée). */
function hallChangesText(d: object): string {
    const raw = field(d, 'changes');
    const list = (Array.isArray(raw) ? raw : []).map((c) => HALL_CHANGE_LABELS[String(c)]).filter((c): c is string => Boolean(c));
    if (list.length === 0) return 'sa fiche';
    return list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;
}

/** Contre-vérification du lot 10b : codes de droits d'une liste de l'avis (inconnus gardés : phrase générique). */
function codes(d: object, key: string): string[] {
    const raw = field(d, key);
    return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string' && c.length > 0) : [];
}

/** « valider les salles et les établissements » : libellé du droit, première lettre en minuscule ; jamais le code. */
function rightPhrase(code: string): string {
    const label = PERMISSION_LABELS[code] ?? 'Réaliser une action d’administration';
    return label.charAt(0).toLowerCase() + label.slice(1);
}

/** « Vous pouvez maintenant … . Vous ne pouvez plus … . » (ou « Peut maintenant … » pour l'alerte aux super-administrateurs). */
function rightsSentences(d: object, third = false): string {
    const can = third ? 'Peut maintenant' : 'Vous pouvez maintenant';
    const cannot = third ? 'Ne peut plus' : 'Vous ne pouvez plus';
    const lines = [...codes(d, 'added').map((c) => `${can} ${rightPhrase(c)}.`), ...codes(d, 'removed').map((c) => `${cannot} ${rightPhrase(c)}.`)];
    return lines.length > 0 ? lines.join(' ') : 'Vos droits ont été revus.';
}

function smsHallRefund(d: object): string {
    return num(d, 'refund_amount') > 0
        ? `Remboursement de ${smsAmount(num(d, 'refund_amount'))} en cours.`
        : 'Aucun remboursement selon les conditions de la salle.';
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
 * Textes des envois synchrones (OTP, invitation d'un contrôleur), lot 9 bis (11.2 M11 à M17, R73, R107) : préfixe
 * unique « Event Village : », code de retrait dédié, invitation d'un contrôleur sur un segment (prénom translittéré et
 * borné à 9 septets). Le code n'est passé qu'ici, au moment de l'envoi : il n'est jamais stocké.
 */
export function renderSyncSms(type: SyncType, data: { code?: string; firstName?: string; setupLink?: string; orderNumber?: string; step?: 'RETRAIT' | 'LIVRAISON' | 'NOUVEAU' }): string {
    // Lot 9 quinquies (A2) : le lien d'activation d'un compte créé par un admin n'a pas de code (le jeton est dans le lien)
    if (type === 'ACCOUNT_ACTIVATION') {
        const link = typeof data?.setupLink === 'string' ? data.setupLink.trim() : '';
        if (!/^https?:\/\/\S+\/activation\?t=[A-Za-z0-9_-]{16,64}$/.test(link)) throw new TemplateDataError('setupLink', 'absent ou illisible');
        return `${SMS_PREFIX}votre compte est créé. Choisissez votre mot de passe sous 24 h : ${link}`;
    }
    const code = typeof data?.code === 'string' ? data.code.trim() : '';
    if (!/^\d{4,8}$/.test(code)) throw new TemplateDataError('code', 'absent ou illisible');
    switch (type) {
        case 'OTP_LOGIN':
        case 'OTP_REGISTER':
        case 'OTP_PHONE_CHANGE':
        case 'OTP_AUTH_HOOK':
            // Lot 9 quinquies (C1 : AUTH-10) : « Ne le donnez à personne. » (texte du chef de projet)
            return `${SMS_PREFIX}votre code est ${code}. Ne le donnez à personne. Valable 10 minutes.`;
        case 'OTP_WITHDRAWAL':
            return `${SMS_PREFIX}votre code de retrait est ${code}. Valable 10 minutes. Ne le donnez à personne.`;
        case 'OTP_PASSWORD_RESET':
            return `${SMS_PREFIX}votre code de réinitialisation est ${code}. Ne le donnez à personne. Valable 10 minutes.`;
        // Lot 9 quinquies (A3 : AUTH-05) : texte du chef de projet
        case 'OTP_ADMIN':
            return `${SMS_PREFIX}code administrateur ${code}. Ne le donnez à personne. Valable 10 minutes.`;
        // Finition 3d (point 2a) : la personne dicte ce code au Superadmin qui change son numéro
        case 'OTP_ADMIN_PHONE':
            return `${SMS_PREFIX}code ${code} pour confirmer ce numéro sur un compte administrateur. Donnez-le seulement au super-administrateur. Valable 10 minutes.`;
        // Lot 12a : code de remise d'une commande (complément du 21/11 : le texte dit quoi faire)
        case 'ORDER_HANDOVER_CODE': {
            if (!/^\d{4}$/.test(code)) throw new TemplateDataError('code', 'n’est pas un code à 4 chiffres');
            const ref = typeof data.orderNumber === 'string' ? data.orderNumber.trim() : '';
            if (!/^[A-Z0-9-]{4,24}$/.test(ref)) throw new TemplateDataError('orderNumber', 'absent ou illisible');
            if (data.step === 'RETRAIT') return `${SMS_PREFIX}votre commande ${ref} vous attend. Donnez le code ${code} au comptoir pour la retirer, à personne d'autre.`;
            if (data.step === 'LIVRAISON') return `${SMS_PREFIX}votre commande ${ref} est en route. Donnez le code ${code} au livreur à son arrivée, pas avant.`;
            if (data.step === 'NOUVEAU') return `${SMS_PREFIX}nouveau code de la commande ${ref} : ${code}. L'ancien ne marche plus. Donnez-le seulement à la remise.`;
            throw new TemplateDataError('step', 'absent ou illisible');
        }
        case 'CONTROLLER_INVITE': {
            const link = typeof data.setupLink === 'string' ? data.setupLink.trim() : '';
            if (!/^https?:\/\//.test(link)) throw new TemplateDataError('setupLink', 'absent ou illisible');
            const name = typeof data.firstName === 'string' ? smsVar(data.firstName, 9) : '';
            const greeting = name ? `Bonjour ${name}, code` : 'code';
            return `${SMS_PREFIX}${greeting} d'activation ${code} (24 h) pour scanner les billets : ${link}`;
        }
        default:
            throw new TemplateDataError('type', `${JSON.stringify(type)} n’est pas un envoi synchrone`);
    }
}

/**
 * Lot 9 quinquies (C2 : AUTH-09) : email à l'ANCIENNE adresse vérifiée quand une autre adresse la remplace (envoi
 * synchrone de POST /api/account/email/verify). Aucune des deux adresses n'est écrite dans le message.
 */
export const EMAIL_CHANGED_OLD_TEXTS = {
    subject: 'Adresse email de votre compte modifiée — Event Village',
    title: 'Adresse email modifiée',
    paragraph: 'L’adresse email de votre compte Event Village vient d’être remplacée par une autre adresse. Vous ne recevrez plus nos messages ici.',
    notice: 'Si ce n’est pas vous : ouvrez la page d’aide pour joindre le support, et changez votre mot de passe avec « Mot de passe oublié ».',
    button: 'Obtenir de l’aide',
} as const;

export function renderEmailChangedOld(ctx: RenderContext): { subject: string; html: string; text: string } {
    const T = EMAIL_CHANGED_OLD_TEXTS;
    const { html, text: plain } = emailLayout({
        appUrl: ctx.appUrl,
        heading: T.title,
        paragraphs: [T.paragraph],
        notice: [T.notice],
        cta: { label: T.button, path: '/aide' },
        unsubscribeTopic: null,
    });
    return { subject: T.subject, html, text: plain };
}

/** Lot 9 quinquies (B2 : AUTH-08) : email « Mot de passe oublié », envoyé par l'application (Resend), en français. */
export const PASSWORD_RESET_EMAIL_TEXTS = {
    subject: 'Choisir un nouveau mot de passe — Event Village',
    title: 'Mot de passe oublié',
    paragraph: 'Vous avez demandé à choisir un nouveau mot de passe pour votre compte Event Village. Ouvrez le lien ci-dessous pour le faire.',
    button: 'Choisir un nouveau mot de passe',
    note: 'Ce lien est valable 60 minutes et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe ne change pas.',
} as const;

/** Rendu de l'email « Mot de passe oublié » ; le jeton (base64url) n'est passé qu'ici, jamais stocké ni journalisé. */
export function renderPasswordResetEmail(token: string, ctx: RenderContext): { subject: string; html: string; text: string } {
    const t = typeof token === 'string' ? token.trim() : '';
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(t)) throw new TemplateDataError('token', 'absent ou illisible');
    const T = PASSWORD_RESET_EMAIL_TEXTS;
    const { html, text: plain } = emailLayout({
        appUrl: ctx.appUrl,
        heading: T.title,
        paragraphs: [T.paragraph],
        cta: { label: T.button, path: `/reset-password?t=${t}` },
        footnote: T.note,
        unsubscribeTopic: null,
    });
    return { subject: T.subject, html, text: plain };
}

/** Lot 9 bis (11.1 N26) : textes de l'email de vérification d'adresse, mot pour mot. */
export const EMAIL_VERIFICATION_TEXTS = {
    subject: 'Vérifiez votre adresse email — Event Village',
    title: 'Vérifiez votre adresse email',
    paragraph: 'Vous avez indiqué cette adresse pour votre compte Event Village. Confirmez-la pour recevoir vos billets et vos confirmations par email.',
    button: 'Vérifier mon adresse',
    note: 'Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : l’adresse ne sera pas ajoutée.',
} as const;

/**
 * Lot 9 bis (11.1 N26, tâche 48) : email synchrone de vérification d'une adresse (EMAIL_VERIFICATION), seul envoi vers
 * une adresse non vérifiée. Le jeton (base64url) n'est passé qu'ici, au moment de l'envoi : il n'est jamais stocké ni
 * journalisé. Bouton vers `{APP_URL}/verify-email?t={jeton}`, aucune image, aucun pied de désabonnement.
 */
export function renderEmailVerification(token: string, ctx: RenderContext): { subject: string; html: string; text: string } {
    const t = typeof token === 'string' ? token.trim() : '';
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(t)) throw new TemplateDataError('token', 'absent ou illisible');
    const T = EMAIL_VERIFICATION_TEXTS;
    const { html, text: plain } = emailLayout({
        appUrl: ctx.appUrl,
        heading: T.title,
        paragraphs: [T.paragraph],
        cta: { label: T.button, path: `/verify-email?t=${t}` },
        footnote: T.note,
        unsubscribeTopic: null,
    });
    return { subject: T.subject, html, text: plain };
}
