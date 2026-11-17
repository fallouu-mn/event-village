/**
 * Lot 5 (5.5, 5.6) — schéma partagé d'un événement et de ses catégories de billets (contrat F1).
 *
 * Utilisé tel quel par le formulaire (client) et par le serveur (POST /api/partner/events,
 * PUT /api/partner/events/[id], routes /categories). Aucune dépendance serveur : importable côté client.
 *  - createEventSchema(ctx)  : corps de POST /api/partner/events (événement et ticket_categories) ;
 *  - updateEventSchema(ctx)  : `patch` de PUT /api/partner/events/[id] (champs facultatifs) ;
 *  - createTicketCategorySchema(ctx), updateTicketCategorySchema(ctx) : routes /categories (F4).
 * Tous les objets sont en .strict() (clé inconnue → issue unrecognized_keys). Les règles métier portent
 * leur code dans issue.params.code (EVENT_START_PAST, EVENT_END_BEFORE_START, IMAGE_ORIGIN_INVALID…).
 * Fuseau : Africa/Dakar = UTC+0 toute l'année, sans heure d'été ; les instants sont calculés par
 * Date.UTC, donc indépendants du fuseau du processus ou du navigateur.
 * Les messages par défaut de Zod sont remplacés par des messages français avec `frenchErrorMap`
 * (voir parseWithFrenchErrors et validationFailure, utilisés par les routes).
 */
import { z } from 'zod';
import { eventEndAt } from '@/lib/events/event-end';
import { STORED_IMAGE_NAME_RE } from '@/lib/images/stored-name';
import { SENEGAL_BOUNDS, canonicalCity, inSenegal } from '@/lib/events/senegal-cities';
import { SCAN_CATEGORY_CHOOSABLE, type ScanCategoryColor } from '@/lib/scan/scan-result';
import { foldText } from '@/lib/text/fold';
import { INVALID_SN_CONTACT_PHONE_MESSAGE, toSenegaleseContactE164 } from '@/lib/validations/auth';
import { contactInfoMessage, hasContactInfo } from '@/lib/validations/contact-info';

// ── Valeurs et bornes ──────────────────────────────────────────────────────

export const EVENT_CATEGORY_VALUES = ['CONCERT', 'FESTIVAL', 'FOOD', 'SALLE'] as const;
export type EventCategoryValue = (typeof EVENT_CATEGORY_VALUES)[number];

export const PROGRAM_KINDS = ['ARTISTE', 'INTERVENANT', 'ACTIVITE'] as const;
export type ProgramKind = (typeof PROGRAM_KINDS)[number];
export const PROGRAM_KIND_LABELS: Record<ProgramKind, string> = {
    ARTISTE: 'Artiste',
    INTERVENANT: 'Intervenant',
    ACTIVITE: 'Activité',
};

export const PRACTICAL_INFO_KEYS = ['address', 'accessNotes', 'parking', 'contactPhone', 'rules'] as const;

export const EVENT_LIMITS = {
    titleMin: 3,
    titleMax: 120,
    descriptionMax: 5000,
    locationMin: 2,
    locationMax: 200,
    cityMin: 2,
    cityMax: 80,
    practicalInfoMax: 300,
    programLinesMax: 50,
    programTitleMax: 120,
    programParticipantMax: 120,
    programDescriptionMax: 500,
    capacityMax: 100_000,
    categoriesMax: 50,
    categoryNameMax: 60,
    categoryDescriptionMax: 300,
    priceMax: 10_000_000,
    quotaMax: 100_000,
    maxPerOrderMax: 50,
    imageUrlMax: 2048,
} as const;

export const DEFAULT_MAX_PER_ORDER = 10;

/** Champs d'un événement jamais modifiables par le PUT (FIELD_NOT_EDITABLE, contrat F3). */
export const NON_EDITABLE_EVENT_FIELDS = [
    'status', 'services', 'gallery_urls', 'ticket_categories', 'slug', 'partner_id', 'is_featured',
    'featured_until', 'id', 'created_at', 'updated_at',
] as const;

/** Champs du patch d'un événement acceptés par le PUT. */
export const EDITABLE_EVENT_FIELDS = [
    'title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city',
    'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info',
] as const;

/** Codes métier portés par issue.params.code. */
export const EVENT_RULE_CODES = {
    START_PAST: 'EVENT_START_PAST',
    END_BEFORE_START: 'EVENT_END_BEFORE_START',
    END_DATE_REQUIRED: 'END_DATE_REQUIRED',
    IMAGE_ORIGIN_INVALID: 'IMAGE_ORIGIN_INVALID',
    SALE_DATES_INVALID: 'SALE_DATES_INVALID',
    SALE_END_AFTER_EVENT: 'SALE_END_AFTER_EVENT',
    SALE_START_AFTER_EVENT: 'SALE_START_AFTER_EVENT',
    CATEGORY_NAME_TAKEN: 'CATEGORY_NAME_TAKEN',
    QUOTA_ABOVE_CAPACITY: 'QUOTA_ABOVE_CAPACITY',
    // Finition 2a (3) : position du lieu (mêmes codes et textes que public.event_position_refusal et event_transition)
    POSITION_INCOMPLETE: 'POSITION_INCOMPLETE',
    POSITION_OUT_OF_BOUNDS: 'POSITION_OUT_OF_BOUNDS',
    POSITION_REQUIRED: 'POSITION_REQUIRED',
} as const;

/** Finition 2a (3) : textes de la position du lieu, identiques en base (migration 20261116000003). */
export const POSITION_TEXTS = {
    incomplete: 'La position du lieu est incomplète : touchez la carte pour placer le repère.',
    outOfBounds: 'Le repère doit être placé au Sénégal : touchez la carte à l’emplacement du lieu.',
    requiredToSubmit: 'Placez le repère du lieu sur la carte (étape Accès).',
    requiredAfterValidation: 'Le repère du lieu ne peut plus être retiré après la validation : déplacez-le si le lieu change.',
} as const;

// ── Dates et heures (Africa/Dakar = UTC+0) ─────────────────────────────────

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const SALE_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,6})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;

/** Date AAAA-MM-JJ existante au calendrier. */
export function isCalendarDate(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const m = DATE_RE.exec(value);
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isClockTime(value: unknown): value is string {
    return typeof value === 'string' && TIME_RE.test(value);
}

/** « HH:mm » d'une heure « HH:mm » ou « HH:mm:ss » (null sinon). */
export function toHHmm(value: string | null | undefined): string | null {
    return typeof value === 'string' && TIME_RE.test(value) ? value.slice(0, 5) : null;
}

/** Instant (ms) d'une date et d'une heure de Dakar, sans dépendre du fuseau du processus. */
export function dakarInstant(date: string, time: string): number {
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi, s] = time.split(':').map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, Number.isFinite(s) ? s : 0);
}

/**
 * Date de vente saisie en datetime-local (« AAAA-MM-JJTHH:mm », heure de Dakar), ou ISO avec décalage.
 * Renvoie l'instant ISO (UTC) à stocker, ou null si la valeur est illisible.
 */
export function parseSaleDateTime(value: string): string | null {
    const m = SALE_RE.exec(value.trim());
    if (!m || !isCalendarDate(m[1])) return null;
    const offset = m[5];
    const ms = offset
        ? Date.parse(value.trim())
        : dakarInstant(m[1], `${m[2]}:${m[3]}:${m[4] ?? '00'}`);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

interface DatesLike {
    start_date: string;
    start_time: string;
    end_date?: string | null;
    end_time?: string | null;
}

function datesReadable(d: DatesLike): boolean {
    return isCalendarDate(d.start_date) && isClockTime(d.start_time)
        && (d.end_date === null || d.end_date === undefined || isCalendarDate(d.end_date))
        && (d.end_time === null || d.end_time === undefined || isClockTime(d.end_time));
}

/** Fin de l'événement (même règle que la fonction SQL event_end_at). */
export function eventEndInstant(d: DatesLike): number {
    return eventEndAt({ start_date: d.start_date, start_time: d.start_time, end_date: d.end_date ?? null, end_time: d.end_time ?? null }).getTime();
}

// ── Affiche ────────────────────────────────────────────────────────────────

/**
 * Correctifs de la contre-vérification de la finition 2a (T5) : seul un fichier produit par la route de dépôt
 * (horodatage_8 caractères.webp, donc réencodé, sans métadonnée) est accepté comme affiche ; un fichier d'avant la
 * finition, ou posé directement dans le stockage, est refusé (IMAGE_ORIGIN_INVALID). L'affiche déjà enregistrée, renvoyée
 * telle quelle par le formulaire, reste acceptée (imageField, `unchanged`) ; scripts/reencode-posters.ts la réencode.
 */
const POSTER_FILE_RE = STORED_IMAGE_NAME_RE;

/** Préfixe des affiches du partenaire : `${SUPABASE_URL}/storage/v1/object/public/public-images/events/<partner_id>/`. */
export function posterPrefix(partnerId: string): string | null {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    if (!base) return null;
    return `${base}/storage/v1/object/public/public-images/events/${partnerId}/`;
}

/** Vrai si l'URL désigne un fichier du dossier d'affiches du partenaire, dans le stockage du projet. */
export function isPartnerPosterUrl(url: string, partnerId: string): boolean {
    const prefix = posterPrefix(partnerId);
    if (!prefix || !url.startsWith(prefix)) return false;
    return POSTER_FILE_RE.test(url.slice(prefix.length));
}

// ── Briques de champs ──────────────────────────────────────────────────────

const custom = z.ZodIssueCode.custom;

function blankToNull(v: unknown): unknown {
    return typeof v === 'string' && v.trim() === '' ? null : v;
}

const dateField = z.string().refine(isCalendarDate, { message: 'Date invalide (format AAAA-MM-JJ).' });
const timeField = z.string().regex(TIME_RE, 'Heure invalide (format HH:mm).').transform((t) => t.slice(0, 5));

// Lot 9 quater (D3 : AUD-26) : titre, lieu, ville et consigne recopiés dans les SMS : ni adresse web ni numéro
const titleField = z.string().trim()
    .min(EVENT_LIMITS.titleMin, `Le titre compte au moins ${EVENT_LIMITS.titleMin} caractères.`)
    .max(EVENT_LIMITS.titleMax, `Le titre compte au plus ${EVENT_LIMITS.titleMax} caractères.`)
    .refine((v) => !hasContactInfo(v), contactInfoMessage('Le titre'));
const descriptionField = z.preprocess(blankToNull, z.string().trim()
    .max(EVENT_LIMITS.descriptionMax, 'La description compte au plus 5 000 caractères.').nullable());
const locationField = z.string().trim()
    .min(EVENT_LIMITS.locationMin, `Le lieu compte au moins ${EVENT_LIMITS.locationMin} caractères.`)
    .max(EVENT_LIMITS.locationMax, `Le lieu compte au plus ${EVENT_LIMITS.locationMax} caractères.`)
    .refine((v) => !hasContactInfo(v), contactInfoMessage('Le lieu'));
// Lot 9 ter (R96) : une ville de la liste (lib/events/senegal-cities.ts) est ramenée à sa forme de la liste ; une autre
// ville (« Autre ville ») est gardée telle quelle, 2 à 80 caractères.
const cityField = z.string().trim()
    .min(EVENT_LIMITS.cityMin, `La ville compte au moins ${EVENT_LIMITS.cityMin} caractères.`)
    .max(EVENT_LIMITS.cityMax, `La ville compte au plus ${EVENT_LIMITS.cityMax} caractères.`)
    .refine((v) => !hasContactInfo(v), contactInfoMessage('La ville'))
    .transform(canonicalCity);
// Finition 2b (E-66) : « Type d'événement » à l'écran
const categoryField = z.enum(EVENT_CATEGORY_VALUES, { error: 'Choisissez un type d’événement dans la liste.' });
// Finition 2a (3) : bornes du Sénégal contrôlées avec la paire (checkPosition), plus de bornes -90/90 et -180/180 ici
const latitudeField = z.number().finite().nullable();
const longitudeField = z.number().finite().nullable();
const capacityField = z.number().int('La jauge est un nombre entier.')
    .min(1, 'La jauge compte au moins 1 place.').max(EVENT_LIMITS.capacityMax, 'La jauge compte au plus 100 000 places.').nullable();

function imageField(partnerId: string, unchanged?: string | null) {
    return z.preprocess(blankToNull, z.string().trim().max(EVENT_LIMITS.imageUrlMax, 'Adresse de l’affiche trop longue.')
        .superRefine((url, c) => {
            if (unchanged && url === unchanged) return;
            if (!isPartnerPosterUrl(url, partnerId)) {
                c.addIssue({
                    code: custom,
                    message: 'L’affiche doit être déposée depuis le formulaire de l’événement (stockage Event Village).',
                    params: { code: EVENT_RULE_CODES.IMAGE_ORIGIN_INVALID },
                });
            }
        })
        .nullable());
}

const practicalText = z.preprocess(blankToNull, z.string().trim()
    .max(EVENT_LIMITS.practicalInfoMax, 'Chaque information pratique compte au plus 300 caractères.').nullable()).optional();
/**
 * Lot 9 ter (R96, D-R96-2) : téléphone de contact = mobile ou fixe sénégalais, stocké en +221… ; vide → null. La valeur
 * actuelle renvoyée à l'identique est gardée telle quelle (une ancienne saisie libre ne bloque pas l'enregistrement
 * d'une autre information pratique).
 */
function contactPhoneField(unchanged?: string | null) {
    return z.preprocess(blankToNull, z.string().trim()
        .max(EVENT_LIMITS.practicalInfoMax, 'Chaque information pratique compte au plus 300 caractères.')
        .transform((v, c) => {
            if (typeof unchanged === 'string' && v === unchanged.trim()) return unchanged;
            const e164 = toSenegaleseContactE164(v);
            if (!e164) {
                c.addIssue({ code: custom, message: INVALID_SN_CONTACT_PHONE_MESSAGE });
                return z.NEVER;
            }
            return e164;
        })
        .nullable()).optional();
}

function practicalInfoField(unchangedPhone?: string | null) {
    return z.object({
        address: practicalText,
        accessNotes: practicalText,
        parking: practicalText,
        contactPhone: contactPhoneField(unchangedPhone),
        rules: practicalText,
    }).strict().nullable();
}

// Programme typé
const optionalText = (max: number, message: string) =>
    z.preprocess(blankToNull, z.string().trim().max(max, message).nullable()).optional();

const programLine = z.object({
    id: z.string().uuid('Identifiant de ligne invalide.'),
    time: timeField,
    kind: z.enum(PROGRAM_KINDS, { error: 'Choisissez le type de la ligne : artiste, intervenant ou activité.' }),
    title: z.string().trim().min(1, 'Indiquez le titre de la ligne.')
        .max(EVENT_LIMITS.programTitleMax, `Le titre d’une ligne compte au plus ${EVENT_LIMITS.programTitleMax} caractères.`),
    participant: optionalText(EVENT_LIMITS.programParticipantMax, `L’artiste ou l’intervenant compte au plus ${EVENT_LIMITS.programParticipantMax} caractères.`),
    description: optionalText(EVENT_LIMITS.programDescriptionMax, `La description d’une ligne compte au plus ${EVENT_LIMITS.programDescriptionMax} caractères.`),
    day: z.preprocess(blankToNull, dateField.nullable()).optional(),
}).strict();

export type ProgramLineInput = z.input<typeof programLine>;

export interface ProgramLine {
    id: string;
    time: string;
    kind: ProgramKind;
    title: string;
    participant?: string;
    description?: string;
    day?: string;
}

function isBlank(v: unknown): boolean {
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Ligne vide : heure, titre, participant et description vides (le type choisi par défaut ne compte pas). */
export function isEmptyProgramLine(line: unknown): boolean {
    if (!line || typeof line !== 'object' || Array.isArray(line)) return false;
    const l = line as Record<string, unknown>;
    return isBlank(l.time) && isBlank(l.title) && isBlank(l.participant) && isBlank(l.description);
}

const programField = z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((l) => !isEmptyProgramLine(l)) : v === null ? [] : v),
    z.array(programLine).max(EVENT_LIMITS.programLinesMax, `Le programme compte au plus ${EVENT_LIMITS.programLinesMax} lignes.`),
);

/** Lignes nettoyées (champs vides retirés) et triées par (jour, heure) ; une ligne sans jour se range au jour du début. */
export function sortProgram(lines: ReadonlyArray<z.output<typeof programLine>>, startDate: string): ProgramLine[] {
    return lines
        .map((l, index) => {
            const out: ProgramLine = { id: l.id, time: l.time, kind: l.kind, title: l.title };
            if (l.participant) out.participant = l.participant;
            if (l.description) out.description = l.description;
            if (l.day) out.day = l.day;
            return { out, index, key: `${l.day ?? startDate}T${l.time}` };
        })
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index))
        .map((x) => x.out);
}

// Catégories de billets
const categoryNameField = z.string().trim().min(1, 'Indiquez le nom de la catégorie.')
    .max(EVENT_LIMITS.categoryNameMax, `Le nom d’une catégorie compte au plus ${EVENT_LIMITS.categoryNameMax} caractères.`);
const categoryDescriptionField = z.preprocess(blankToNull, z.string().trim()
    .max(EVENT_LIMITS.categoryDescriptionMax, `La description d’une catégorie compte au plus ${EVENT_LIMITS.categoryDescriptionMax} caractères.`).nullable());
const priceField = z.number().int('Le prix est un montant entier en francs CFA.')
    .min(0, 'Le prix ne peut pas être négatif.').max(EVENT_LIMITS.priceMax, 'Le prix ne dépasse pas 10 000 000 F CFA.');
const quotaField = z.number().int('La quantité mise en vente est un nombre entier de billets.')
    .min(1, 'La quantité mise en vente compte au moins 1 billet.').max(EVENT_LIMITS.quotaMax, 'La quantité mise en vente compte au plus 100 000 billets.');
const maxPerOrderField = z.number().int('Le maximum par commande est un nombre entier.')
    .min(1, 'Le maximum par commande est d’au moins 1 billet.').max(EVENT_LIMITS.maxPerOrderMax, 'Le maximum par commande est de 50 billets au plus.');
const saleDateField = z.preprocess(blankToNull, z.string().transform((v, c) => {
    const iso = parseSaleDateTime(v);
    if (!iso) {
        c.addIssue({ code: custom, message: 'Date de vente invalide (format AAAA-MM-JJ HH:mm, heure de Dakar).' });
        return z.NEVER;
    }
    return iso;
}).nullable());

const categoryCreateShape = {
    name: categoryNameField,
    description: categoryDescriptionField.optional(),
    price: priceField,
    total_quantity: quotaField,
    max_per_order: maxPerOrderField.default(DEFAULT_MAX_PER_ORDER),
    sale_start: saleDateField.optional(),
    sale_end: saleDateField.optional(),
    // Lot 8 (contrat 3.3) : aucun défaut sur les canaux, sinon l'alias is_visible serait perdu au COALESCE de
    // ticket_category_normalize. Une catégorie sans canal est permise.
    sale_online: z.boolean().optional(),
    sale_counter: z.boolean().optional(),
    is_visible: z.boolean().optional(),
    is_active: z.boolean().default(true),
};


/** Fenêtre de vente : début < fin ≤ fin de l'événement ; début avant la fin de l'événement. */
function checkSaleWindow(
    c: z.RefinementCtx,
    path: Array<string | number>,
    saleStart: string | null | undefined,
    saleEnd: string | null | undefined,
    eventEnd: number | null,
): void {
    const start = typeof saleStart === 'string' ? Date.parse(saleStart) : NaN;
    const end = typeof saleEnd === 'string' ? Date.parse(saleEnd) : NaN;
    if (Number.isFinite(start) && Number.isFinite(end) && start >= end) {
        c.addIssue({ code: custom, path: [...path, 'sale_end'], message: 'La fin de vente doit être postérieure au début de vente.', params: { code: EVENT_RULE_CODES.SALE_DATES_INVALID } });
    }
    if (eventEnd !== null && Number.isFinite(end) && end > eventEnd) {
        c.addIssue({ code: custom, path: [...path, 'sale_end'], message: 'La fin de vente ne peut pas dépasser la fin de l’événement.', params: { code: EVENT_RULE_CODES.SALE_END_AFTER_EVENT } });
    }
    if (eventEnd !== null && Number.isFinite(start) && start >= eventEnd) {
        c.addIssue({ code: custom, path: [...path, 'sale_start'], message: 'Le début de vente doit précéder la fin de l’événement.', params: { code: EVENT_RULE_CODES.SALE_START_AFTER_EVENT } });
    }
}

// ── Événement : création ───────────────────────────────────────────────────

/**
 * Finition 2b (B, E-23) : portes et zones réglées dès la création. Chaque zone désigne ses catégories par leur ordre dans
 * ticket_categories (category_refs : 0 pour la première). Comme pour PUT …/zones, le schéma ne borne que la forme et la
 * taille ; les règles (20 zones, 50 portes, noms de 1 à 40 caractères, doublons, zone sans porte ou sans catégorie, au
 * moins une zone d'entrée, toute catégorie admise par une zone d'entrée, catégorie inconnue) sont celles de la base
 * (event_zones_form_refusal et event_zones_write), avec leur code et leur texte.
 */
const zoneGateCreateObject = z.object({ name: z.string().max(60) }).strict();
const zoneCreateObject = z.object({
    name: z.string().max(60),
    kind: z.enum(['ENTREE', 'CONTROLE']),
    position: z.number().int().min(0).max(99).nullable().optional(),
    category_refs: z.array(z.number().int().min(0).max(99)).max(100),
    gates: z.array(zoneGateCreateObject).max(100),
}).strict();

export interface EventSchemaContext {
    /** Partenaire propriétaire (dossier des affiches). */
    partnerId: string;
    /** Instant de référence (défaut : maintenant). */
    now?: Date;
}

export interface EventDates {
    start_date: string;
    start_time: string;
    end_date: string | null;
    end_time: string | null;
}

export interface UpdateEventSchemaContext extends EventSchemaContext {
    /** Valeurs actuelles de l'événement (heures en HH:mm ou HH:mm:ss) ; image_url : affiche actuelle, acceptée telle quelle ;
     *  city et contact_phone (practical_info.contactPhone) : lot 9 ter (R96), ville et téléphone actuels gardés tels quels. */
    current: EventDates & { image_url?: string | null; city?: string | null; contact_phone?: string | null };
}

function checkEventDates(
    c: z.RefinementCtx,
    d: { start_date: string; start_time: string; end_date?: string | null; end_time?: string | null },
    opts: { checkStartPast: boolean; now: number },
): void {
    if (d.end_time && !d.end_date) {
        c.addIssue({ code: custom, path: ['end_date'], message: 'Indiquez la date de fin pour l’heure de fin saisie.', params: { code: EVENT_RULE_CODES.END_DATE_REQUIRED } });
    }
    if (!datesReadable(d)) return;
    const start = dakarInstant(d.start_date, d.start_time);
    if (opts.checkStartPast && start <= opts.now) {
        c.addIssue({ code: custom, path: ['start_date'], message: 'Le début de l’événement doit être dans le futur (heure de Dakar).', params: { code: EVENT_RULE_CODES.START_PAST } });
    }
    if (d.end_date) {
        const end = eventEndInstant(d);
        if (end <= start) {
            c.addIssue({
                code: custom,
                path: [d.end_time ? 'end_time' : 'end_date'],
                message: 'La fin de l’événement doit être postérieure à son début.',
                params: { code: EVENT_RULE_CODES.END_BEFORE_START },
            });
        }
    }
}

/**
 * Finition 2a (3) : latitude et longitude ensemble (toutes deux présentes, toutes deux renseignées ou toutes deux vides),
 * au Sénégal. Codes et textes de la base ; le champ pointé est celui qui manque ou qui sort des bornes.
 */
function checkPosition(c: z.RefinementCtx, v: { latitude?: number | null; longitude?: number | null }): void {
    const lat = v.latitude ?? null;
    const lng = v.longitude ?? null;
    if ((v.latitude === undefined) !== (v.longitude === undefined) || (lat === null) !== (lng === null)) {
        const missing = v.latitude !== undefined && lat !== null ? 'longitude' : 'latitude';
        c.addIssue({ code: custom, path: [missing], message: POSITION_TEXTS.incomplete, params: { code: EVENT_RULE_CODES.POSITION_INCOMPLETE } });
        return;
    }
    if (lat !== null && lng !== null && !inSenegal(lat, lng)) {
        const latOut = lat < SENEGAL_BOUNDS.minLatitude || lat > SENEGAL_BOUNDS.maxLatitude;
        c.addIssue({ code: custom, path: [latOut ? 'latitude' : 'longitude'], message: POSITION_TEXTS.outOfBounds, params: { code: EVENT_RULE_CODES.POSITION_OUT_OF_BOUNDS } });
    }
}

export function createEventSchema(ctx: EventSchemaContext) {
    return z.object({
        title: titleField,
        category: categoryField,
        description: descriptionField.optional(),
        start_date: dateField,
        start_time: timeField,
        end_date: z.preprocess(blankToNull, dateField.nullable()).optional(),
        end_time: z.preprocess(blankToNull, timeField.nullable()).optional(),
        location: locationField,
        city: cityField,
        latitude: latitudeField.optional(),
        longitude: longitudeField.optional(),
        image_url: imageField(ctx.partnerId).optional(),
        capacity: capacityField.optional(),
        program: programField.default([]),
        practical_info: practicalInfoField().optional(),
        // Finition 2b (A) : couleur au contrôle et consigne d'entrée acceptées dès la création (même objet que la route
        // des catégories ; ticket_category_normalize les contrôle aussi, sous le chemin de la catégorie)
        ticket_categories: z.array(ticketCategoryCreateObject)
            .max(EVENT_LIMITS.categoriesMax, `Un événement compte au plus ${EVENT_LIMITS.categoriesMax} catégories de billets.`)
            .default([]),
        // Finition 2b (B) : facultatif ; absent ou vide : une seule entrée (aucune zone)
        zones: z.array(zoneCreateObject).max(100).optional(),
    }).strict().superRefine((v, c) => {
        const now = (ctx.now ?? new Date()).getTime();
        checkPosition(c, v);
        checkEventDates(c, v, { checkStartPast: true, now });
        const eventEnd = datesReadable(v) ? eventEndInstant(v) : null;
        const seen = new Map<string, number>();
        let activeSum = 0;
        v.ticket_categories.forEach((cat, i) => {
            const key = cat.name.trim().toLowerCase();
            if (seen.has(key)) {
                c.addIssue({ code: custom, path: ['ticket_categories', i, 'name'], message: 'Deux catégories portent ce nom : chaque nom doit être unique.', params: { code: EVENT_RULE_CODES.CATEGORY_NAME_TAKEN } });
            } else {
                seen.set(key, i);
            }
            checkSaleWindow(c, ['ticket_categories', i], cat.sale_start, cat.sale_end, eventEnd);
            if (cat.is_active !== false && Number.isFinite(cat.total_quantity)) activeSum += cat.total_quantity;
        });
        if (typeof v.capacity === 'number' && activeSum > v.capacity) {
            c.addIssue({ code: custom, path: ['capacity'], message: `La somme des quantités mises en vente des catégories actives (${activeSum}) dépasse la jauge (${v.capacity}).`, params: { code: EVENT_RULE_CODES.QUOTA_ABOVE_CAPACITY } });
        }
    }).transform((v) => ({ ...v, program: sortProgram(v.program, v.start_date) }));
}

export type CreateEventInput = z.input<ReturnType<typeof createEventSchema>>;
export type CreateEventData = z.output<ReturnType<typeof createEventSchema>>;

// ── Événement : modification ───────────────────────────────────────────────

export function updateEventSchema(ctx: UpdateEventSchemaContext) {
    const current = ctx.current;
    return z.object({
        title: titleField.optional(),
        category: categoryField.optional(),
        description: descriptionField.optional(),
        start_date: dateField.optional(),
        start_time: timeField.optional(),
        end_date: z.preprocess(blankToNull, dateField.nullable()).optional(),
        end_time: z.preprocess(blankToNull, timeField.nullable()).optional(),
        location: locationField.optional(),
        city: cityField.optional(),
        latitude: latitudeField.optional(),
        longitude: longitudeField.optional(),
        image_url: imageField(ctx.partnerId, current.image_url ?? null).optional(),
        capacity: capacityField.optional(),
        program: programField.optional(),
        practical_info: practicalInfoField(current.contact_phone ?? null).optional(),
    }).strict().superRefine((v, c) => {
        if (v.latitude !== undefined || v.longitude !== undefined) checkPosition(c, v);
        const touched = v.start_date !== undefined || v.start_time !== undefined || v.end_date !== undefined || v.end_time !== undefined;
        if (!touched) return;
        const merged = {
            start_date: v.start_date ?? current.start_date,
            start_time: v.start_time ?? current.start_time,
            end_date: v.end_date !== undefined ? v.end_date : current.end_date,
            end_time: v.end_time !== undefined ? v.end_time : current.end_time,
        };
        // Une valeur renvoyée à l'identique (heure HH:mm contre HH:mm:ss en base) n'est pas un changement.
        const startChanged = merged.start_date !== current.start_date || toHHmm(merged.start_time) !== toHHmm(current.start_time);
        checkEventDates(c, merged, { checkStartPast: startChanged, now: (ctx.now ?? new Date()).getTime() });
    }).transform((v) => {
        // Lot 9 ter (R96) : une ville égale à la ville actuelle une fois pliée (« Thiès » pour « Thies ») garde la ville
        // actuelle : aucun changement détecté, aucun porteur prévenu pour une simple normalisation.
        const sameCity = v.city !== undefined && typeof current.city === 'string' && foldText(v.city) === foldText(current.city);
        const kept = sameCity ? { ...v, city: current.city as string } : v;
        return kept.program === undefined
            ? kept
            : { ...kept, program: sortProgram(kept.program, kept.start_date ?? current.start_date) };
    });
}

export type UpdateEventInput = z.input<ReturnType<typeof updateEventSchema>>;
export type UpdateEventData = z.output<ReturnType<typeof updateEventSchema>>;

// ── Catégories de billets (routes F4) ──────────────────────────────────────

export interface TicketCategorySchemaContext {
    /** Fin de l'événement (event_end_at) ; null : non contrôlée ici (la RPC la contrôle). */
    eventEnd: Date | null;
}

/**
 * Lot 9 ter (9t.15, contrat D.2.3, X2) : couleur de la catégorie au scan (une des clés de SCAN_CATEGORY_CHOOSABLE,
 * seule liste, ou null) et consigne d'entrée (60 caractères au plus, vide → null), acceptées par les seules routes des
 * catégories ; finition 2b (A) : aussi par la création de l'événement (ticket_categories de createEventSchema), que
 * event_create accepte désormais. Refus INVALID_INPUT avec le champ en cause, comme la RPC ; messages explicites, jamais
 * remplacés par frenchErrorMap.
 */
const SCAN_COLOR_MESSAGE = 'Choisissez une couleur dans la liste.';
const ENTRY_INSTRUCTION_MESSAGE = 'La consigne d’entrée ne dépasse pas 60 caractères.';
// Contre-vérification 2b (2b) : couleurs choisissables seulement (OR retiré : confondable avec un verdict du scanner)
const scanColorField = z.custom<ScanCategoryColor>(
    (v) => typeof v === 'string' && (SCAN_CATEGORY_CHOOSABLE as readonly string[]).includes(v),
    { message: SCAN_COLOR_MESSAGE, params: { code: 'INVALID_INPUT' } },
).nullable();
/**
 * Contre-vérification 2b (2c) : caractères de contrôle (C0, DEL, C1) et marques ou contrôles de sens d'écriture refusés
 * dans la consigne (un U+202E retourne le texte à l'écran du contrôleur) ; même liste en base (ticket_category_normalize,
 * ticket_category_update, migration 20261121000008).
 */
const ENTRY_INSTRUCTION_INVISIBLE_RE = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const ENTRY_INSTRUCTION_INVISIBLE_MESSAGE = 'La consigne d’entrée contient un caractère invisible ou de contrôle : retirez-le.';
const entryInstructionField = z.custom<string>((v) => typeof v === 'string', { message: ENTRY_INSTRUCTION_MESSAGE, params: { code: 'INVALID_INPUT' } })
    .transform((v) => v.trim())
    .refine((v) => !ENTRY_INSTRUCTION_INVISIBLE_RE.test(v), { message: ENTRY_INSTRUCTION_INVISIBLE_MESSAGE, params: { code: 'INVALID_INPUT' } })
    .refine((v) => v.length <= 60, { message: ENTRY_INSTRUCTION_MESSAGE, params: { code: 'INVALID_INPUT' } })
    .refine((v) => !hasContactInfo(v), { message: contactInfoMessage('La consigne'), params: { code: 'INVALID_INPUT' } })
    .nullable()
    .transform((v) => (v === '' ? null : v));

/** Lot 9 quater (D3) : champs dont le texte part dans les SMS (contrôle statique tests/schema/lot9quater-coordonnees). */
export const EVENT_CONTACT_FIELDS = { title: titleField, location: locationField, city: cityField, entry_instruction: entryInstructionField };

const ticketCategoryCreateObject = z.object({
    ...categoryCreateShape,
    scan_color: scanColorField.optional(),
    entry_instruction: entryInstructionField.optional(),
}).strict();

export function createTicketCategorySchema(ctx: TicketCategorySchemaContext) {
    const eventEnd = ctx.eventEnd ? ctx.eventEnd.getTime() : null;
    return ticketCategoryCreateObject.superRefine((v, c) => {
        checkSaleWindow(c, [], v.sale_start, v.sale_end, eventEnd);
    });
}

export interface UpdateTicketCategorySchemaContext extends TicketCategorySchemaContext {
    current: { sale_start: string | null; sale_end: string | null };
}

export function updateTicketCategorySchema(ctx: UpdateTicketCategorySchemaContext) {
    const eventEnd = ctx.eventEnd ? ctx.eventEnd.getTime() : null;
    return z.object({
        name: categoryNameField.optional(),
        description: categoryDescriptionField.optional(),
        price: priceField.optional(),
        total_quantity: quotaField.optional(),
        max_per_order: maxPerOrderField.optional(),
        sale_start: saleDateField.optional(),
        sale_end: saleDateField.optional(),
        sale_online: z.boolean().optional(),
        sale_counter: z.boolean().optional(),
        is_visible: z.boolean().optional(),
        is_active: z.boolean().optional(),
        scan_color: scanColorField.optional(),
        entry_instruction: entryInstructionField.optional(),
    }).strict().superRefine((v, c) => {
        if (v.sale_start === undefined && v.sale_end === undefined) return;
        const start = v.sale_start !== undefined ? v.sale_start : ctx.current.sale_start;
        const end = v.sale_end !== undefined ? v.sale_end : ctx.current.sale_end;
        // La fin de l'événement borne une fin de vente modifiée ; lot 9 bis (R94) : et un début de vente modifié
        // (seul le champ envoyé est borné : une fin de vente existante n'empêche pas de corriger le début).
        checkSaleWindow(c, [], start, end, v.sale_end !== undefined ? eventEnd : null);
        if (v.sale_start !== undefined && v.sale_end === undefined) checkSaleWindow(c, [], start, null, eventEnd);
    });
}

export type CreateTicketCategoryInput = z.input<ReturnType<typeof createTicketCategorySchema>>;
export type UpdateTicketCategoryInput = z.input<ReturnType<typeof updateTicketCategorySchema>>;

// ── Messages français et réponse 400 ───────────────────────────────────────

/**
 * Messages français pour les issues sans message explicite (types, clés inconnues, formats).
 * Lot 9 sexies (zod 4) : mêmes messages qu'en zod 3, codes de zod 4 (`invalid_value` pour une liste fermée,
 * `invalid_format` pour un format, `origin` pour la nature de la valeur bornée). `not_finite` n'existe plus :
 * un nombre infini est refusé comme une valeur non numérique (JSON ne peut pas en transporter).
 */
export const frenchErrorMap: z.core.$ZodErrorMap = (issue) => {
    switch (issue.code) {
        case 'invalid_type':
            if (issue.input === undefined || issue.input === null) return 'Ce champ est obligatoire.';
            if (issue.expected === 'number') return 'Une valeur numérique est attendue.';
            if (issue.expected === 'boolean') return 'Une réponse oui ou non est attendue.';
            if (issue.expected === 'string') return 'Un texte est attendu.';
            if (issue.expected === 'array') return 'Une liste est attendue.';
            if (issue.expected === 'object') return 'Un groupe de champs est attendu.';
            return 'Type de valeur invalide.';
        case 'unrecognized_keys':
            return 'Champ non accepté par le formulaire.';
        case 'invalid_value':
            return 'Valeur hors de la liste proposée.';
        case 'too_small':
            if (issue.origin === 'string') return `Au moins ${String(issue.minimum)} caractère(s).`;
            if (issue.origin === 'array') return `Au moins ${String(issue.minimum)} élément(s).`;
            return `Valeur minimale : ${String(issue.minimum)}.`;
        case 'too_big':
            if (issue.origin === 'string') return `Au plus ${String(issue.maximum)} caractères.`;
            if (issue.origin === 'array') return `Au plus ${String(issue.maximum)} éléments.`;
            return `Valeur maximale : ${String(issue.maximum)}.`;
        case 'invalid_format':
            return 'Format invalide.';
        default:
            return 'Valeur invalide.';
    }
};

/** safeParse avec les messages français (les codes et chemins sont ceux du schéma). */
export function parseWithFrenchErrors<T extends z.ZodTypeAny>(schema: T, input: unknown): z.ZodSafeParseResult<z.output<T>> {
    return schema.safeParse(input, { error: frenchErrorMap });
}

export interface FieldError {
    /** Chemin pointé (« ticket_categories.0.price »). */
    path: string;
    /** Code métier (issue.params.code) ou UNKNOWN_FIELD pour une clé inconnue. */
    code?: string;
    message: string;
}

/** Issues Zod → liste de champs ; une clé inconnue donne une entrée par clé, à son chemin. */
export function fieldErrors(error: z.ZodError): FieldError[] {
    const out: FieldError[] = [];
    for (const issue of error.issues) {
        if (issue.code === z.ZodIssueCode.unrecognized_keys) {
            for (const key of issue.keys) {
                out.push({ path: [...issue.path, key].join('.'), code: 'UNKNOWN_FIELD', message: issue.message });
            }
            continue;
        }
        const params = issue.code === z.ZodIssueCode.custom ? (issue.params as Record<string, unknown> | undefined) : undefined;
        const code = typeof params?.code === 'string' ? params.code : undefined;
        out.push({ path: issue.path.join('.'), ...(code ? { code } : {}), message: issue.message });
    }
    return out;
}

/** Corps de la réponse 400 : `{ error, code, field, fields }` (message français, jamais de code dans le message). */
export function validationFailure(error: z.ZodError): { error: string; code: string; field?: string; fields: FieldError[] } {
    const fields = fieldErrors(error);
    const first = fields[0];
    const code = fields.length === 1 && first?.code ? first.code : 'VALIDATION_FAILED';
    const message = !first
        ? 'Les informations envoyées sont invalides.'
        : fields.length === 1
            ? first.message
            : `Le formulaire contient ${fields.length} erreurs. ${first.message}`;
    return { error: message, code, ...(first?.path ? { field: first.path } : {}), fields };
}
