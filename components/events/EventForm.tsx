'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Lock, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Select, TextInput, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { EVENT_CATEGORIES } from '@/lib/constants/event-categories';
import { OTHER_CITY_VALUE, SENEGAL_CITIES, cityCenter, senegalCity } from '@/lib/events/senegal-cities';
import { PLACE_SEARCH_UNAVAILABLE } from '@/lib/places/place-texts';
// Types seulement (effacés à la compilation) : la carte reste chargée à la demande (next/dynamic)
import type { PlaceSearchOutcome, PlaceSearchResult } from '@/components/ui/MapPicker';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { formatEventDateTime, formatInteger, formatShortDate, formatTime } from '@/lib/format';
import { retainedEnd } from '@/lib/events/event-end';
import { isScanCategoryColor, proposeScanColor, SCAN_CATEGORY_COLORS, ZONE_KIND_LABELS, type ScanCategoryColor } from '@/lib/scan/scan-result';
import { submissionMissing } from '@/lib/events/submission-check';
import { clearDraft, readDraft, writeDraft, type LocalDraft } from '@/lib/events/local-draft';
import { EventReview, type ReviewData } from './EventReview';
import { EntryControlStep } from './EntryControlStep';
import { EntryControlEditor } from './EntryControlEditor';
import { MAX_ZONES, type ZoneDraft } from './ZoneListEditor';
import { isBelowMinimum, priceMinimumMessage } from '@/lib/events/price-minimum';
import {
    EVENT_LIMITS,
    EVENT_RULE_CODES,
    PROGRAM_KINDS,
    PROGRAM_KIND_LABELS,
    createEventSchema,
    fieldErrors,
    isEmptyProgramLine,
    parseWithFrenchErrors,
    toHHmm,
    updateEventSchema,
    type EventCategoryValue,
    type FieldError,
    type ProgramKind,
} from '@/lib/validations/event';
import {
    CATEGORY_FIELDS,
    CATEGORY_FIELD_LABELS,
    CategoryFields,
    EventTicketingManager,
    categoryCreateBody,
    categoryFieldId,
    localKey,
    newCategoryDraft,
    numberInput,
    readApiBody,
    type ApiBody,
    type CategoryDraft,
    type CategoryErrors,
    type CategoryField,
    type Row,
} from './EventTicketing';

/**
 * Lot 5 (5.5, 5.6, 5.9 ; contrat F6) — formulaire unique de création et d'édition d'un événement.
 *  - schéma partagé lib/validations/event.ts : mêmes règles que le serveur, messages français ;
 *  - catégorie d'événement, carte (MapPicker), programme typé (heure, type, intitulé), affiche ;
 *  - création : événement et catégories de billets en un seul POST (RPC event_create) ;
 *  - édition : PUT { patch, expected_updated_at } des seuls champs modifiés, résultat
 *    { notified_holders, sms_queued } affiché ; billetterie par les routes /categories (EventTicketing) ;
 *  - erreurs du serveur (fields[]) affichées près de leur champ, récapitulatif focalisable.
 * Seule la billetterie est proposée (tâche 5.9).
 * Lot 9 ter (R93, R96) :
 *  - verrous de l'écran servis par le serveur (`edit_locks` du GET, mêmes règles qu'event_update), relus après chaque
 *    enregistrement de catégorie ; textes de la jauge selon le plancher servi ;
 *  - garde avant de quitter (useUnsavedGuard) : informations de l'événement et catégories non enregistrées ;
 *  - ville dans la liste SENEGAL_CITIES ou « Autre ville » ; téléphone de contact sénégalais (normalisé par le schéma).
 */

const MapPicker = dynamic(() => import('@/components/ui/MapPicker').then((m) => m.MapPicker), {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-2xl bg-surface-sunken motion-safe:animate-pulse" aria-hidden="true" />,
});

type StepId = 'infos' | 'programme' | 'acces' | 'billetterie' | 'controle';

const STEPS: Array<{ id: StepId; label: string; heading: string }> = [
    { id: 'infos', label: 'Informations', heading: 'Informations générales' },
    { id: 'programme', label: 'Programme', heading: 'Programme' },
    { id: 'acces', label: 'Accès', heading: 'Accès et informations pratiques' },
    { id: 'billetterie', label: 'Billets', heading: 'Billetterie' },
    // Finition 2b (B, E-23) : portes, zones et couleurs, dès la création
    { id: 'controle', label: 'Contrôle', heading: 'Contrôle à l’entrée (facultatif)' },
];

/** Finition 2b (B) : préfixe des champs de l'étape « Contrôle à l'entrée » (zones, portes, couleurs). */
const ZONES_PREFIX = 'ev-zones';

/** Finition 2b (C, E-24) : écran « Vérifier avant d'envoyer », après les 5 étapes. */
type ScreenId = StepId | 'verifier';
const SCREENS: Array<{ id: ScreenId; label: string; heading: string }> = [
    ...STEPS,
    { id: 'verifier', label: 'Vérifier', heading: 'Vérifier avant d’envoyer' },
];
const SCREEN_IDS = new Set<string>(SCREENS.map((s) => s.id));

/** Finition 2b (C) : brouillon gardé dans le navigateur (valeurs ; création : catégories et zones ; écran). */
interface FormDraft {
    values: EventValues;
    categories: CategoryDraft[];
    zones: ZoneDraft[] | null;
    step: ScreenId;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

/**
 * Finition 2b (C) : contenu d'un brouillon contrôlé champ par champ avant toute reprise (lecture protégée) ; toute autre
 * forme : refusé (le brouillon est alors effacé). Les clés locales sont refaites à la reprise.
 */
function validFormDraft(data: unknown, mode: 'create' | 'edit'): FormDraft | null {
    if (!isObj(data) || !isObj(data.values) || !SCREEN_IDS.has(String(data.step))) return null;
    const v = data.values;
    const textKeys = ['title', 'description', 'image_url', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city', 'capacity'] as const;
    if (!textKeys.every((k) => isText(v[k], 6000))) return null;
    if (!(v.category === '' || isCategoryValue(v.category))) return null;
    const coord = (x: unknown, max: number) => x === null || (typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= max);
    if (!coord(v.latitude, 90) || !coord(v.longitude, 180)) return null;
    if (!Array.isArray(v.program) || v.program.length > EVENT_LIMITS.programLinesMax) return null;
    const programOk = v.program.every((r) => isObj(r)
        && ['id', 'time', 'title', 'participant', 'description', 'day'].every((k) => isText(r[k], 2000))
        && (PROGRAM_KINDS as readonly string[]).includes(String(r.kind)));
    if (!programOk) return null;
    if (!isObj(v.practical) || !['address', 'accessNotes', 'parking', 'contactPhone', 'rules'].every((k) => isText((v.practical as Record<string, unknown>)[k], 2000))) return null;
    const values = {
        ...EMPTY_VALUES,
        ...(Object.fromEntries(textKeys.map((k) => [k, v[k]])) as Record<(typeof textKeys)[number], string>),
        category: v.category as EventValues['category'],
        latitude: v.latitude as number | null,
        longitude: v.longitude as number | null,
        program: (v.program as Array<Record<string, unknown>>).map((r) => ({
            key: localKey('p'), id: String(r.id), time: String(r.time), kind: r.kind as ProgramKind, title: String(r.title),
            participant: String(r.participant), description: String(r.description), day: String(r.day),
        })),
        practical: { ...(v.practical as unknown as PracticalValues) },
    };
    if (mode === 'edit') return { values, categories: [], zones: null, step: data.step as ScreenId };
    if (!Array.isArray(data.categories) || data.categories.length > EVENT_LIMITS.categoriesMax) return null;
    const categoriesOk = data.categories.every((c) => isObj(c) && isText(c.key, 40)
        && ['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'entry_instruction'].every((k) => isText(c[k], 1000))
        && (c.scan_color === '' || (SCAN_CATEGORY_COLORS as readonly string[]).includes(String(c.scan_color)))
        && ['sale_online', 'sale_counter', 'is_active'].every((k) => typeof c[k] === 'boolean'));
    if (!categoriesOk) return null;
    const zonesIn = data.zones;
    const zonesOk = zonesIn === null || (Array.isArray(zonesIn) && zonesIn.length <= MAX_ZONES && zonesIn.every((z) => isObj(z)
        && isText(z.name, 100) && (z.kind === 'ENTREE' || z.kind === 'CONTROLE')
        && Array.isArray(z.categoryKeys) && z.categoryKeys.every((k) => isText(k, 40))
        && Array.isArray(z.gates) && z.gates.length <= 50 && z.gates.every((g) => isObj(g) && isText(g.name, 100))));
    if (!zonesOk) return null;
    return {
        values,
        categories: (data.categories as Array<Record<string, unknown>>).map((c) => ({
            ...newCategoryDraft(),
            key: String(c.key), name: String(c.name), description: String(c.description), price: String(c.price),
            total_quantity: String(c.total_quantity), max_per_order: String(c.max_per_order), sale_start: String(c.sale_start),
            sale_end: String(c.sale_end), sale_online: c.sale_online === true, sale_counter: c.sale_counter === true,
            is_active: c.is_active === true, scan_color: String(c.scan_color), entry_instruction: String(c.entry_instruction),
        })),
        zones: zonesIn === null ? null : (zonesIn as Array<Record<string, unknown>>).map((z) => ({
            key: '', name: String(z.name), kind: z.kind as ZoneDraft['kind'], categoryKeys: (z.categoryKeys as string[]).slice(),
            gates: (z.gates as Array<Record<string, unknown>>).map((g) => ({ key: '', name: String(g.name), inUse: false })),
        })),
        step: data.step as ScreenId,
    };
}

/**
 * Finition 2b (B) : zones de la création → corps de la création, chaque zone désignant ses catégories par leur ordre
 * (category_refs) ; une catégorie retirée n'est plus citée.
 */
function zonesPayload(zones: ZoneDraft[], categories: CategoryDraft[]): Row[] {
    return zones.map((z, i) => ({
        name: z.name,
        kind: z.kind,
        position: i,
        category_refs: z.categoryKeys.map((k) => categories.findIndex((c) => c.key === k)).filter((n) => n >= 0),
        gates: z.gates.map((g) => ({ name: g.name })),
    }));
}

/**
 * Finition 2b (B) : règles des zones dites dès « Suivant », avec les textes de la base (event_zones_form_refusal et
 * event_zones_write) ; le serveur reste seul juge à l'enregistrement.
 */
function zoneRuleErrors(zones: ZoneDraft[] | null, categories: CategoryDraft[]): Record<string, string> {
    if (!zones || zones.length === 0) return {};
    const out: Record<string, string> = {};
    if (zones.length > MAX_ZONES) out.zones = '20 zones au plus par événement.';
    else if (zones.reduce((n, z) => n + z.gates.length, 0) > 50) out.zones = '50 portes au plus par événement.';
    const zoneNames = new Set<string>();
    const gateNames = new Set<string>();
    zones.forEach((z, i) => {
        const name = z.name.trim();
        if (name.length < 1 || name.length > 40) out[`zones.${i}.name`] = 'Donnez à chaque zone un nom de 1 à 40 caractères.';
        else if (zoneNames.has(name.toLowerCase())) out[`zones.${i}.name`] = `Deux zones portent le nom ${name} : choisissez des noms différents.`;
        else zoneNames.add(name.toLowerCase());
        if (z.gates.length === 0) out[`zones.${i}.gates`] = `La zone ${name || `n° ${i + 1}`} n’a aucune porte : ajoutez-en au moins une.`;
        z.gates.forEach((g, j) => {
            const gate = g.name.trim();
            if (gate.length < 1 || gate.length > 40) out[`zones.${i}.gates.${j}.name`] = 'Donnez à chaque porte un nom de 1 à 40 caractères.';
            else if (gateNames.has(gate.toLowerCase())) out[`zones.${i}.gates.${j}.name`] = `Deux portes portent le nom ${gate} : choisissez des noms différents.`;
            else gateNames.add(gate.toLowerCase());
        });
        if (!z.categoryKeys.some((k) => categories.some((c) => c.key === k))) {
            out[`zones.${i}.category_ids`] = `La zone ${name || `n° ${i + 1}`} n’admet aucune catégorie : cochez-en au moins une.`;
        }
    });
    if (!out.zones) {
        if (!zones.some((z) => z.kind === 'ENTREE')) {
            out.zones = 'Il faut au moins une zone de type Entrée : c’est là que les billets sont compostés.';
        } else {
            const outside = categories.find((c) => !zones.some((z) => z.kind === 'ENTREE' && z.categoryKeys.includes(c.key)));
            if (outside) out.zones = `La catégorie ${outside.name.trim() || 'sans nom'} n’entre par aucune zone de type Entrée : cochez-la dans une zone d’entrée.`;
        }
    }
    return out;
}

const STEP1_FIELDS = new Set(['title', 'category', 'description', 'image_url', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city', 'capacity']);

/** Statuts où l'événement est modifiable dans le formulaire (EN_ATTENTE : à retirer d'abord ; TERMINE, ANNULE : figés). */
const EDITABLE_STATUSES = new Set(['BROUILLON', 'VALIDE', 'PUBLIE', 'SUSPENDU']);
/** Après validation : règles encadrées (champs notifiés, verrous après ventes). */
const AFTER_VALIDATION = new Set(['VALIDE', 'PUBLIE', 'SUSPENDU']);
/** Statuts où des billets ont pu être émis : les détenteurs sont prévenus d'un changement. */
const WITH_HOLDERS = new Set(['PUBLIE', 'SUSPENDU']);

const NOTIFY_HINT = 'Les détenteurs de billets seront prévenus de ce changement.';
/**
 * Finition 2a (3) : recherche de lieu par le serveur (GET /api/partner/places/search), un appel par appui sur
 * « Rechercher ». Réseau coupé ou réponse illisible : « Recherche indisponible pour le moment : touchez la carte pour
 * placer le repère. » ; sinon le texte du serveur.
 */
async function searchPlacesFromServer(query: string): Promise<PlaceSearchOutcome> {
    try {
        const res = await fetch(`/api/partner/places/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as { results?: PlaceSearchResult[]; error?: unknown } | null;
        if (res.ok && Array.isArray(body?.results)) return { kind: 'results', results: body.results };
        return { kind: 'error', message: typeof body?.error === 'string' && body.error ? body.error : PLACE_SEARCH_UNAVAILABLE };
    } catch {
        return { kind: 'error', message: PLACE_SEARCH_UNAVAILABLE };
    }
}

/** Finition 2a (2, E-01) : aide sous la fin retenue quand aucune heure de fin n'est saisie. */
const RETAINED_END_HELP = 'La vente s’arrête à cette heure. Indiquez l’heure de fin si votre événement dure plus longtemps.';

const CITY_OPTIONS = [
    ...SENEGAL_CITIES.map((c) => ({ value: c, label: c })),
    { value: OTHER_CITY_VALUE, label: 'Autre ville' },
];

/** Lot 9 ter (R93, F17) : verrous servis par GET /api/partner/events/[id] (RPC event_edit_locks). */
interface EditLocks {
    has_sales: boolean;
    engaged: number;
    active_quota: number;
    capacity_floor: number;
    capacity_removable: boolean;
    categories: Record<string, boolean>;
}

function readEditLocks(v: unknown): EditLocks | null {
    if (!v || typeof v !== 'object') return null;
    const r = v as Record<string, unknown>;
    const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : Number(x) || 0);
    const categories: Record<string, boolean> = {};
    if (Array.isArray(r.categories)) {
        for (const c of r.categories as unknown[]) {
            if (c && typeof c === 'object' && typeof (c as Record<string, unknown>).id === 'string') {
                categories[(c as Record<string, unknown>).id as string] = (c as Record<string, unknown>).has_sales === true;
            }
        }
    }
    return {
        has_sales: r.has_sales === true,
        engaged: n(r.engaged),
        active_quota: n(r.active_quota),
        capacity_floor: n(r.capacity_floor),
        capacity_removable: r.capacity_removable === true,
        categories,
    };
}

/**
 * Lot 9 bis (R12, R26, B71, contrat 5.30) : résultat d'une modification. Les comptes sont prévenus tout de suite
 * dans l'application ; les SMS (comptes et numéros sans compte : invitations non réclamées, acheteurs au guichet)
 * partent après 10 minutes, les corrections faites d'ici là sont regroupées dans le même SMS.
 * Correctifs de la contre-vérification de la finition 2a (T4) : un changement de lieu part d'un seul avis (application,
 * notification et SMS ensemble) à la fin des 10 minutes ; un seul avis de changement de lieu par heure : fait moins
 * d'une heure après le précédent avis, il part à l'heure dite (event_update : place_notice_at, place_notice_held).
 */
function saveSummary({ notifiedHolders, smsQueued, placeNoticeAt, placeNoticeHeld }: SaveResult): string {
    const placeAt = placeNoticeAt ? formatTime(placeNoticeAt) : null;
    const held = placeNoticeHeld && placeAt
        ? `Le changement de lieu sera annoncé aux détenteurs de billets à ${placeAt} : un seul avis de changement de lieu part par heure.`
        : null;
    if (notifiedHolders <= 0 && smsQueued <= 0) return held ?? 'Aucun détenteur de billets n’était à prévenir.';
    if (placeAt && !placeNoticeHeld && notifiedHolders > 0) {
        return notifiedHolders > 1
            ? `${formatInteger(notifiedHolders)} détenteurs de billets seront prévenus à ${placeAt}, dans l’application et par SMS (vos corrections d’ici là y seront regroupées).`
            : `1 détenteur de billets sera prévenu à ${placeAt}, dans l’application et par SMS (vos corrections d’ici là y seront regroupées).`;
    }
    const summary = baseSummary(notifiedHolders, smsQueued);
    return held ? `${summary} ${held}` : summary;
}

function baseSummary(notifiedHolders: number, smsQueued: number): string {
    const parts: string[] = [];
    if (notifiedHolders > 0) {
        parts.push(`${formatInteger(notifiedHolders)} ${notifiedHolders > 1 ? 'détenteurs de billets prévenus' : 'détenteur de billets prévenu'} dans l’application`);
    }
    if (smsQueued > 0) {
        parts.push(smsQueued > 1
            ? `${formatInteger(smsQueued)} SMS partiront dans 10 minutes (vos corrections d’ici là y seront regroupées).`
            : '1 SMS partira dans 10 minutes (vos corrections d’ici là y seront regroupées).');
        return parts.join(' ; ');
    }
    return `${parts[0]}.`;
}
const NETWORK_MESSAGE = 'Connexion impossible : rien n’a été enregistré. Vérifiez votre réseau, puis réessayez.';

// ── Valeurs du formulaire ──────────────────────────────────────────────────

interface ProgramRow {
    key: string;
    id: string;
    time: string;
    kind: ProgramKind;
    title: string;
    participant: string;
    description: string;
    day: string;
}

interface PracticalValues {
    address: string;
    accessNotes: string;
    parking: string;
    contactPhone: string;
    rules: string;
}

interface EventValues {
    title: string;
    category: EventCategoryValue | '';
    description: string;
    image_url: string;
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
    location: string;
    city: string;
    capacity: string;
    latitude: number | null;
    longitude: number | null;
    program: ProgramRow[];
    practical: PracticalValues;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function emptyProgramRow(): ProgramRow {
    return { key: localKey('p'), id: newUuid(), time: '', kind: 'ARTISTE', title: '', participant: '', description: '', day: '' };
}

const EMPTY_VALUES: EventValues = {
    title: '',
    category: '',
    description: '',
    image_url: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location: '',
    city: 'Dakar',
    capacity: '',
    latitude: null,
    longitude: null,
    program: [],
    practical: { address: '', accessNotes: '', parking: '', contactPhone: '', rules: '' },
};

function str(v: unknown): string {
    return typeof v === 'string' ? v : '';
}

function isCategoryValue(v: unknown): v is EventCategoryValue {
    return EVENT_CATEGORIES.some((c) => c.id === v);
}

/** Événement lu en base → valeurs du formulaire (heures HH:mm, programme typé, informations pratiques). */
function valuesFromEvent(ev: Row): EventValues {
    const program = Array.isArray(ev.program) ? (ev.program as unknown[]) : [];
    const practical = ev.practical_info && typeof ev.practical_info === 'object' ? (ev.practical_info as Row) : {};
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    return {
        title: str(ev.title),
        category: isCategoryValue(ev.category) ? ev.category : '',
        description: str(ev.description),
        image_url: str(ev.image_url),
        start_date: str(ev.start_date),
        start_time: toHHmm(str(ev.start_time)) ?? '',
        end_date: str(ev.end_date),
        end_time: toHHmm(str(ev.end_time)) ?? '',
        location: str(ev.location),
        city: str(ev.city),
        capacity: ev.capacity === null || ev.capacity === undefined ? '' : String(ev.capacity),
        latitude: num(ev.latitude),
        longitude: num(ev.longitude),
        program: program
            .filter((p): p is Row => !!p && typeof p === 'object' && !Array.isArray(p))
            .map((p) => ({
                key: localKey('p'),
                id: typeof p.id === 'string' && UUID_RE.test(p.id) ? p.id : newUuid(),
                time: toHHmm(str(p.time)) ?? '',
                kind: (PROGRAM_KINDS as readonly string[]).includes(str(p.kind)) ? (p.kind as ProgramKind) : 'ACTIVITE',
                title: str(p.title),
                participant: str(p.participant) || str(p.artistOrSpeaker),
                description: str(p.description),
                day: str(p.day),
            })),
        practical: {
            address: str(practical.address),
            accessNotes: str(practical.accessNotes),
            parking: str(practical.parking),
            contactPhone: str(practical.contactPhone),
            rules: str(practical.rules),
        },
    };
}

const blank = (s: string): string | null => (s.trim() === '' ? null : s);
const required = (s: string): string | undefined => (s.trim() === '' ? undefined : s);

/** Valeurs → corps attendu par le schéma partagé ; programKeys : clé de chaque ligne envoyée (lignes vides retirées). */
function eventPayload(v: EventValues): { payload: Row; programKeys: string[] } {
    const rows = v.program
        .map((r) => ({ key: r.key, line: { id: r.id, time: required(r.time), kind: r.kind, title: r.title, participant: blank(r.participant), description: blank(r.description), day: blank(r.day) } }))
        .filter((r) => !isEmptyProgramLine(r.line));
    const payload: Row = {
        title: v.title,
        category: v.category === '' ? undefined : v.category,
        description: blank(v.description),
        start_date: required(v.start_date),
        start_time: required(v.start_time),
        end_date: blank(v.end_date),
        end_time: blank(v.end_time),
        location: v.location,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        image_url: blank(v.image_url),
        capacity: v.capacity.trim() === '' ? null : numberInput(v.capacity),
        program: rows.map((r) => r.line),
        practical_info: {
            address: blank(v.practical.address),
            accessNotes: blank(v.practical.accessNotes),
            parking: blank(v.practical.parking),
            contactPhone: blank(v.practical.contactPhone),
            rules: blank(v.practical.rules),
        },
    };
    return { payload, programKeys: rows.map((r) => r.key) };
}

/** Champs modifiés (édition) : seules les clés dont la valeur a changé partent dans le patch. */
function diffPayload(next: Row, before: Row): Row {
    const patch: Row = {};
    for (const key of Object.keys(next)) {
        if (next[key] === undefined) continue;
        if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) patch[key] = next[key];
    }
    // Finition 2a (3) : latitude et longitude partent ensemble (le serveur refuse une moitié de position)
    if ('latitude' in patch || 'longitude' in patch) {
        patch.latitude = next.latitude ?? null;
        patch.longitude = next.longitude ?? null;
    }
    return patch;
}

// ── Erreurs ────────────────────────────────────────────────────────────────

type ErrorMap = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
    title: 'Titre',
    // Finition 2b (E-66) : « Type d'événement » (avant : « Catégorie de l'événement »)
    category: 'Type d’événement',
    description: 'Description',
    image_url: 'Affiche',
    start_date: 'Date de début',
    start_time: 'Heure de début',
    end_date: 'Date de fin',
    end_time: 'Heure de fin',
    location: 'Lieu',
    city: 'Ville',
    capacity: 'Capacité',
    latitude: 'Latitude',
    longitude: 'Longitude',
    program: 'Programme',
    'practical_info.address': 'Adresse précise',
    'practical_info.accessNotes': 'Indications d’accès',
    'practical_info.parking': 'Stationnement',
    'practical_info.contactPhone': 'Téléphone de contact',
    'practical_info.rules': 'Règles à respecter',
    ticket_categories: 'Catégories de billets',
};

const PROGRAM_FIELD_LABELS: Record<string, string> = {
    time: 'Heure',
    kind: 'Type',
    title: 'Intitulé',
    participant: 'Artiste ou intervenant',
    description: 'Précisions',
    day: 'Jour',
    id: 'Identifiant',
};

interface KeyMaps {
    programKeys: string[];
    categoryKeys: string[];
}

/** Chemin d'une erreur (schéma ou serveur) → clé du formulaire (lignes du programme et catégories par leur clé locale). */
function errorKey(path: string, maps: KeyMaps): string {
    const parts = path.split('.');
    if (parts[0] === 'program' && parts.length >= 2 && /^\d+$/.test(parts[1])) {
        const key = maps.programKeys[Number(parts[1])];
        return key ? `program.${key}.${parts[2] ?? 'title'}` : 'program';
    }
    if (parts[0] === 'ticket_categories' && parts.length >= 2 && /^\d+$/.test(parts[1])) {
        const key = maps.categoryKeys[Number(parts[1])];
        const field = (CATEGORY_FIELDS as readonly string[]).includes(parts[2] ?? '') ? parts[2] : 'name';
        return key ? `billet.${key}.${field}` : 'ticket_categories';
    }
    return path || 'form';
}

function stepOfKey(key: string): StepId | null {
    if (STEP1_FIELDS.has(key)) return 'infos';
    if (key === 'program' || key.startsWith('program.')) return 'programme';
    if (key === 'latitude' || key === 'longitude' || key.startsWith('practical_info')) return 'acces';
    if (key === 'ticket_categories' || key.startsWith('billet.')) return 'billetterie';
    if (key === 'zones' || key.startsWith('zones.')) return 'controle';
    return null;
}

const MAP_PREFIX = 'ev-carte';

function domIdOfKey(key: string): string | null {
    const parts = key.split('.');
    if (parts[0] === 'program' && parts.length === 3) return `ev-program-${parts[1]}-${parts[2]}`;
    if (parts[0] === 'billet' && parts.length === 3) return categoryFieldId(parts[1], parts[2] as CategoryField);
    if (key === 'latitude' || key === 'longitude') return `${MAP_PREFIX}-${key}`;
    // Finition 2b (B) : champs de l'étape « Contrôle à l'entrée » (identifiants de ZoneListEditor)
    if (parts[0] === 'zones') {
        if (parts.length === 1) return `${ZONES_PREFIX}-choix`;
        const zone = `${ZONES_PREFIX}-z${parts[1]}`;
        if (parts[2] === 'category_ids' || parts[2] === 'category_refs') return `${zone}-c0`;
        if (parts[2] === 'gates') return `${zone}-g${parts.length >= 5 ? parts[3] : '0'}`;
        return `${zone}-name`;
    }
    if (stepOfKey(key)) return `ev-${key.replace(/\./g, '-')}`;
    return null;
}

function labelOfKey(key: string, values: EventValues, categories: CategoryDraft[]): string {
    const parts = key.split('.');
    if (parts[0] === 'program' && parts.length === 3) {
        const index = values.program.findIndex((r) => r.key === parts[1]);
        return `Programme, ligne ${index + 1} : ${PROGRAM_FIELD_LABELS[parts[2]] ?? 'ligne'}`;
    }
    if (parts[0] === 'billet' && parts.length === 3) {
        const index = categories.findIndex((c) => c.key === parts[1]);
        return `Catégorie ${index + 1} : ${CATEGORY_FIELD_LABELS[parts[2] as CategoryField] ?? 'catégorie'}`;
    }
    // Finition 2b (B) : erreurs de l'étape « Contrôle à l'entrée »
    if (parts[0] === 'zones') {
        if (parts.length === 1) return 'Portes et zones';
        const n = Number(parts[1]) + 1;
        if (parts[2] === 'category_ids' || parts[2] === 'category_refs') return `Zone ${n} : catégories admises`;
        if (parts[2] === 'gates') return parts.length >= 5 ? `Zone ${n}, porte ${Number(parts[3]) + 1} : nom` : `Zone ${n} : portes`;
        return `Zone ${n} : nom`;
    }
    return FIELD_LABELS[key] ?? 'Formulaire';
}

function issuesToErrors(issues: FieldError[], maps: KeyMaps, opts: { ignoreImageOrigin: boolean }): ErrorMap {
    const out: ErrorMap = {};
    for (const issue of issues) {
        if (opts.ignoreImageOrigin && issue.code === EVENT_RULE_CODES.IMAGE_ORIGIN_INVALID) continue;
        const key = errorKey(issue.path, maps);
        if (!out[key]) out[key] = issue.message;
    }
    return out;
}

/** Erreurs d'une réponse du serveur : fields[] d'abord, puis le champ unique (field) avec le message. */
function serverErrors(body: ApiBody, maps: KeyMaps): ErrorMap {
    const issues: FieldError[] = [];
    if (Array.isArray(body.fields)) {
        for (const f of body.fields) {
            if (f && typeof f.path === 'string' && typeof f.message === 'string') issues.push({ path: f.path, code: f.code, message: f.message });
        }
    }
    if (issues.length === 0 && typeof body.field === 'string' && typeof body.error === 'string') {
        issues.push({ path: body.field, code: body.code, message: body.error });
    }
    return issuesToErrors(issues, maps, { ignoreImageOrigin: false });
}

function categoryErrorsFor(errors: ErrorMap, key: string): CategoryErrors {
    const out: CategoryErrors = {};
    for (const field of CATEGORY_FIELDS) {
        const message = errors[`billet.${key}.${field}`];
        if (message) out[field] = message;
    }
    return out;
}

// ── Composant ──────────────────────────────────────────────────────────────

export type EventFormProps = { mode: 'create' } | { mode: 'edit'; eventId: string };

type LoadState =
    | { state: 'loading' }
    | { state: 'error'; message: string }
    | { state: 'notfound' }
    | { state: 'ready'; event: Row };

interface SaveResult {
    notifiedHolders: number;
    smsQueued: number;
    /** T4 : heure de l'avis de changement de lieu, null sans changement de lieu. */
    placeNoticeAt: string | null;
    /** T4 : avis de lieu retenu (un avis de changement de lieu est parti il y a moins d'une heure). */
    placeNoticeHeld: boolean;
}

export function EventForm(props: EventFormProps) {
    const isEdit = props.mode === 'edit';
    const eventId = props.mode === 'edit' ? props.eventId : null;
    const router = useRouter();
    const toast = useToast();
    const { partner, user } = useAuth();
    /** Finition 2b (C) : compte de la session (clé du brouillon gardé dans le navigateur). */
    const userId = user?.id ?? null;

    const [load, setLoad] = useState<LoadState>(isEdit ? { state: 'loading' } : { state: 'ready', event: {} });
    const [values, setValues] = useState<EventValues>(EMPTY_VALUES);
    const [baseline, setBaseline] = useState<Row>(() => eventPayload(EMPTY_VALUES).payload);
    const [categories, setCategories] = useState<CategoryDraft[]>([]);
    const [step, setStep] = useState<ScreenId>('infos');
    const [errors, setErrors] = useState<ErrorMap>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [formInfo, setFormInfo] = useState<string | null>(null);
    const [conflict, setConflict] = useState(false);
    const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
    const [submitting, setSubmitting] = useState(false);
    /** Version du chargement : la billetterie repart des catégories relues à chaque rechargement. */
    const [loadVersion, setLoadVersion] = useState(0);
    /** Lot 9 ter (R93) : verrous du serveur ; null en création ou tant qu'ils ne sont pas lus. */
    const [editLocks, setEditLocks] = useState<EditLocks | null>(null);
    /** Catégories modifiées et non enregistrées (édition, EventTicketingManager). */
    const [ticketingDirty, setTicketingDirty] = useState<string[]>([]);
    /** « Autre ville » choisie : la ville est saisie dans « Précisez la ville ». */
    const [cityOther, setCityOther] = useState(false);
    /** Brouillon créé : la page part vers la liste, la garde de sortie est levée. */
    const [leaving, setLeaving] = useState(false);
    /** Finition 2b (A, E-26) : prix minimum d'un billet payant, lu par le serveur (null : pas encore lu, ou illisible). */
    const [minPaidPrice, setMinPaidPrice] = useState<number | null>(null);
    /** Finition 2b (B) : portes et zones de la création (null : une seule entrée). */
    const [zones, setZones] = useState<ZoneDraft[] | null>(null);
    const zoneSeq = useRef(0);
    const newZoneKey = useCallback(() => {
        zoneSeq.current += 1;
        return `zn${zoneSeq.current}`;
    }, []);
    /** Finition 2b (B) : couleurs enregistrées à l'étape « Contrôle à l'entrée » (modification), reprises par l'étape Billets. */
    const [savedColors, setSavedColors] = useState<Record<string, string> | null>(null);
    /** Finition 2b (C) : envoi pour validation en cours (bouton « Envoyer pour validation »). */
    const [sending, setSending] = useState(false);
    /** Finition 2b (C) : brouillon gardé dans le navigateur, proposé à la reprise (null : rien à proposer). */
    const [resumable, setResumable] = useState<LocalDraft<FormDraft> | null>(null);
    const draftChecked = useRef(false);
    /** Finition 2b (C) : catégories et zones relues pour l'écran « Vérifier » (modification). */
    const [reviewSnapshot, setReviewSnapshot] = useState<{ categories: Row[]; zones: Row | null } | null>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const stepMoved = useRef(false);

    const event = load.state === 'ready' ? load.event : null;
    const status = event ? str(event.status) : '';
    const afterValidation = isEdit && AFTER_VALIDATION.has(status);
    const withHolders = isEdit && WITH_HOLDERS.has(status);
    /** Catégories lues avec l'événement, verrou de chacune (has_sales) servi par le serveur. */
    const [initialLocks, setInitialLocks] = useState<EditLocks | null>(null);
    const eventCategories = useMemo<Row[]>(
        () => (event && Array.isArray(event.ticket_categories)
            ? (event.ticket_categories as Row[]).map((c) => ({ ...c, has_sales: typeof c.id === 'string' && initialLocks?.categories[c.id] === true }))
            : []),
        [event, initialLocks],
    );
    const categoryLocks = editLocks?.categories ?? null;
    const salesStarted = editLocks?.has_sales === true;

    // Chargement (édition)
    const loadEvent = useCallback(async () => {
        if (!eventId) return;
        setLoad({ state: 'loading' });
        try {
            const res = await fetch(`/api/partner/events/${eventId}`, { cache: 'no-store' });
            const body = await readApiBody(res);
            if (res.status === 404) {
                setLoad({ state: 'notfound' });
                return;
            }
            if (!res.ok || !body.event || typeof body.event !== 'object') {
                setLoad({ state: 'error', message: res.status === 401 ? 'Votre session a expiré : reconnectez-vous, puis réessayez.' : body.error || 'Impossible de charger l’événement.' });
                return;
            }
            const ev = body.event as Row;
            const v = valuesFromEvent(ev);
            const locks = readEditLocks(body.edit_locks);
            setEditLocks(locks);
            setInitialLocks(locks);
            setCityOther(senegalCity(v.city) === null);
            setValues(v);
            setBaseline(eventPayload(v).payload);
            setErrors({});
            setFormError(null);
            setConflict(false);
            setLoadVersion((n) => n + 1);
            setLoad({ state: 'ready', event: ev });
        } catch {
            setLoad({ state: 'error', message: 'Connexion impossible : l’événement n’a pas pu être chargé. Vérifiez votre réseau.' });
        }
    }, [eventId]);

    useEffect(() => {
        void loadEvent();
    }, [loadEvent]);

    // Finition 2b (B) : « Modifier les portes et les couleurs » (page Équipe) ouvre l'étape « Contrôle à l'entrée » ;
    // (C) un envoi refusé après la création ouvre l'écran « Vérifier »
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const wanted = new URLSearchParams(window.location.search).get('etape');
        if (wanted === 'controle' || wanted === 'verifier') setStep(wanted);
    }, []);

    // Finition 2b (A, E-26) : minimum lu par le serveur (GET /api/partner/ticketing-rules) ; illisible : l'aide d'avant,
    // le serveur refuse de toute façon sous la bonne catégorie
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/partner/ticketing-rules', { cache: 'no-store' });
                const body = (await res.json().catch(() => null)) as { min_paid_price?: unknown } | null;
                const min = Number(body?.min_paid_price);
                if (!cancelled && res.ok && Number.isInteger(min) && min >= 1) setMinPaidPrice(min);
                else if (!res.ok) console.error(`[EventForm] prix minimum : HTTP ${res.status}`);
            } catch (err) {
                console.error('[EventForm] prix minimum illisible', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    /** Finition 2b (A, E-26) : prix payants sous le minimum, rangés sous la bonne catégorie (création). */
    const belowMinimumErrors = (): ErrorMap => {
        if (isEdit || minPaidPrice === null) return {};
        const out: ErrorMap = {};
        for (const c of categories) {
            if (isBelowMinimum(c.price, minPaidPrice)) out[`billet.${c.key}.price`] = priceMinimumMessage(minPaidPrice);
        }
        return out;
    };

    /** Relit les seuls verrous après un enregistrement de catégorie (jauge, catégorie d'événement, prix). */
    const refreshLocks = useCallback(async () => {
        if (!eventId) return;
        try {
            const res = await fetch(`/api/partner/events/${eventId}`, { cache: 'no-store' });
            const body = await readApiBody(res);
            if (!res.ok) throw new Error(body.error || `erreur ${res.status}`);
            setEditLocks(readEditLocks(body.edit_locks));
        } catch (err) {
            console.error('[EventForm] relecture des verrous', err);
            toast.error('Les règles de la jauge n’ont pas pu être relues : rechargez la page pour les voir à jour.');
        }
    }, [eventId, toast]);

    // Sortie de page avec des modifications non enregistrées (garde : fermeture, rechargement, liens internes)
    const current = useMemo(() => eventPayload(values), [values]);
    const fieldsDirty = isEdit ? Object.keys(diffPayload(current.payload, baseline)).length > 0 : JSON.stringify(current.payload) !== JSON.stringify(baseline);
    const dirty = !leaving && (fieldsDirty || (isEdit ? ticketingDirty.length > 0 : categories.length > 0 || zones !== null));
    const describeUnsaved = (): string[] => {
        const list: string[] = fieldsDirty ? ['Informations de l’événement'] : [];
        if (isEdit) return [...list, ...ticketingDirty];
        return [
            ...list,
            ...categories.map((c) => (c.name.trim() ? `Nouvelle catégorie « ${c.name.trim()} »` : 'Nouvelle catégorie')),
            ...(zones !== null ? ['Portes et zones'] : []),
        ];
    };
    const unsaved = useUnsavedGuard(dirty, describeUnsaved);

    // Finition 2b (C) : brouillon gardé dans le navigateur — proposé une fois l'écran prêt (modification : après la lecture
    // de l'événement ; un brouillon identique à ce qui est enregistré n'a rien à reprendre)
    useEffect(() => {
        if (!userId || draftChecked.current) return;
        if (isEdit && load.state !== 'ready') return;
        draftChecked.current = true;
        const draft = readDraft(userId, eventId, (d) => validFormDraft(d, isEdit ? 'edit' : 'create'));
        if (!draft) return;
        if (isEdit && JSON.stringify(eventPayload(draft.data.values).payload) === JSON.stringify(baseline)) {
            clearDraft(userId, eventId);
            return;
        }
        setResumable(draft);
    }, [userId, isEdit, eventId, load.state, baseline]);

    // Finition 2b (C) : saisie gardée 0,8 s après la dernière frappe, tant qu'elle n'est pas enregistrée (rien côté serveur)
    useEffect(() => {
        if (!userId || resumable || leaving || !fieldsDirty && (isEdit || (categories.length === 0 && zones === null))) return undefined;
        const timer = window.setTimeout(() => {
            writeDraft(userId, eventId, { values, categories: isEdit ? [] : categories, zones: isEdit ? null : zones, step });
        }, 800);
        return () => window.clearTimeout(timer);
    }, [userId, resumable, leaving, fieldsDirty, isEdit, eventId, values, categories, zones, step]);

    /** Finition 2b (C) : « Reprendre » — valeurs, catégories et zones du brouillon, clés locales refaites. */
    const resumeDraft = () => {
        if (!resumable) return;
        const d = resumable.data;
        if (!isEdit) {
            const keys = new Map<string, string>();
            const cats = d.categories.map((c) => {
                const key = localKey('c');
                keys.set(c.key, key);
                return { ...c, key };
            });
            setCategories(cats);
            setZones(d.zones === null ? null : d.zones.map((z) => ({
                ...z,
                key: newZoneKey(),
                categoryKeys: z.categoryKeys.map((k) => keys.get(k)).filter((k): k is string => typeof k === 'string'),
                gates: z.gates.map((g) => ({ ...g, key: newZoneKey() })),
            })));
        }
        setValues(d.values);
        setCityOther(d.values.city !== '' && senegalCity(d.values.city) === null);
        setStep(d.step);
        setResumable(null);
        toast.success('Saisie reprise.');
    };

    /** Finition 2b (C) : « Effacer » — le brouillon gardé est effacé, rien d'autre ne change. */
    const eraseDraft = () => {
        if (userId) clearDraft(userId, eventId);
        setResumable(null);
    };

    // Finition 2b (C) : écran « Vérifier » en modification — catégories et zones enregistrées, relues par le serveur
    useEffect(() => {
        if (!isEdit || !eventId || step !== 'verifier') return undefined;
        let cancelled = false;
        (async () => {
            try {
                const [evRes, zRes] = await Promise.all([
                    fetch(`/api/partner/events/${eventId}`, { cache: 'no-store' }),
                    fetch(`/api/partner/events/${eventId}/zones`, { cache: 'no-store' }),
                ]);
                const evBody = await readApiBody(evRes);
                const zBody = await readApiBody(zRes);
                if (cancelled) return;
                const ev = evRes.ok && evBody.event && typeof evBody.event === 'object' ? (evBody.event as Row) : null;
                setReviewSnapshot({
                    categories: ev && Array.isArray(ev.ticket_categories) ? (ev.ticket_categories as Row[]) : eventCategories,
                    zones: zRes.ok ? (zBody as Row) : null,
                });
            } catch (err) {
                console.error('[EventForm] relecture pour la vérification', err);
                if (!cancelled) setReviewSnapshot({ categories: eventCategories, zones: null });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isEdit, eventId, step, eventCategories]);

    // Focus du titre de l'étape après un changement d'étape
    useEffect(() => {
        if (!stepMoved.current) return;
        stepMoved.current = false;
        headingRef.current?.focus();
    }, [step]);

    const set = <K extends keyof EventValues>(field: K, value: EventValues[K]) => {
        setValues((v) => ({ ...v, [field]: value }));
        setFormInfo(null);
    };
    const setPractical = (field: keyof PracticalValues, value: string) => {
        setValues((v) => ({ ...v, practical: { ...v.practical, [field]: value } }));
        setFormInfo(null);
    };
    const setRow = (key: string, change: Partial<ProgramRow>) => {
        setValues((v) => ({ ...v, program: v.program.map((r) => (r.key === key ? { ...r, ...change } : r)) }));
    };

    const goToStep = (next: ScreenId) => {
        stepMoved.current = true;
        setStep(next);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const focusField = (key: string) => {
        const target = stepOfKey(key);
        const id = domIdOfKey(key);
        const doFocus = () => {
            if (!id) return;
            const el = document.getElementById(id);
            el?.focus();
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        };
        if (target && target !== step) {
            setStep(target);
            window.setTimeout(doFocus, 50);
        } else {
            doFocus();
        }
    };

    const showErrors = (map: ErrorMap, message: string | null) => {
        setErrors(map);
        setFormError(message);
        const firstStep = STEPS.find((s) => Object.keys(map).some((k) => stepOfKey(k) === s.id));
        if (firstStep && firstStep.id !== step) setStep(firstStep.id);
        window.setTimeout(() => {
            summaryRef.current?.focus();
            summaryRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 50);
    };

    // Validation par le schéma partagé
    const validate = (): { map: ErrorMap; body: Row; maps: KeyMaps } => {
        const { payload, programKeys } = eventPayload(values);
        const maps: KeyMaps = { programKeys, categoryKeys: categories.map((c) => c.key) };
        if (!isEdit) {
            // Finition 2b (B) : portes et zones envoyées avec la création (absentes : une seule entrée)
            const body: Row = {
                ...payload,
                ticket_categories: categories.map(categoryCreateBody),
                ...(zones && zones.length > 0 ? { zones: zonesPayload(zones, categories) } : {}),
            };
            const partnerId = partner?.id ?? '';
            const parsed = parseWithFrenchErrors(createEventSchema({ partnerId }), body);
            const map = parsed.success ? {} : issuesToErrors(fieldErrors(parsed.error), maps, { ignoreImageOrigin: partnerId === '' });
            return { map, body, maps };
        }
        const ev = event ?? {};
        const patch = diffPayload(payload, baseline);
        const parsed = parseWithFrenchErrors(updateEventSchema({
            partnerId: str(ev.partner_id),
            current: {
                start_date: str(ev.start_date),
                start_time: str(ev.start_time),
                end_date: ev.end_date ? str(ev.end_date) : null,
                end_time: ev.end_time ? str(ev.end_time) : null,
                image_url: ev.image_url ? str(ev.image_url) : null,
                // Lot 9 ter (R96) : ville et téléphone actuels gardés tels quels (anciennes saisies libres)
                city: ev.city ? str(ev.city) : null,
                contact_phone: ev.practical_info && typeof ev.practical_info === 'object'
                    ? str((ev.practical_info as Row).contactPhone) || null
                    : null,
            },
        }), patch);
        const map = parsed.success ? {} : issuesToErrors(fieldErrors(parsed.error), maps, { ignoreImageOrigin: false });
        return { map, body: patch, maps };
    };

    const handleNext = () => {
        const index = SCREENS.findIndex((s) => s.id === step);
        if (!isEdit && step !== 'verifier') {
            const { map } = validate();
            // Finition 2b (A, E-26) : le prix minimum est contrôlé dès « Suivant » ; (B) les règles des zones aussi
            const own = Object.fromEntries(Object.entries({ ...map, ...belowMinimumErrors(), ...zoneRuleErrors(zones, categories) })
                .filter(([k]) => stepOfKey(k) === step));
            if (Object.keys(own).length > 0) {
                showErrors(own, null);
                return;
            }
            setErrors({});
            setFormError(null);
        }
        if (index < SCREENS.length - 1) goToStep(SCREENS[index + 1].id);
    };

    const handlePrevious = () => {
        const index = SCREENS.findIndex((s) => s.id === step);
        if (index > 0) goToStep(SCREENS[index - 1].id);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        await save(false);
    };

    /**
     * Finition 2b (C, E-24) : « Envoyer pour validation » depuis le formulaire, après la création ou l'enregistrement des
     * champs modifiés (POST …/transition { to: 'EN_ATTENTE' }, la route de la liste). Refus : le texte du serveur (ses
     * manques) ; après une création, le brouillon existe : l'écran « Vérifier » de la modification s'ouvre.
     */
    const sendForValidation = async (id: string, created: boolean) => {
        const res = await fetch(`/api/partner/events/${id}/transition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: 'EN_ATTENTE' }),
        });
        const data = await readApiBody(res);
        if (res.ok && data.success !== false) {
            if (userId) clearDraft(userId, created ? null : eventId);
            setLeaving(true);
            toast.success('Événement envoyé pour validation. Vous recevrez un message dès qu’il aura été examiné.');
            router.push('/partner/events');
            return;
        }
        const refusal = data.error || 'L’envoi pour validation a été refusé.';
        if (created) {
            if (userId) clearDraft(userId, null);
            setLeaving(true);
            toast.error(`Brouillon enregistré, mais l’envoi a été refusé : ${refusal}`);
            router.replace(`/partner/events/${id}/edit?etape=verifier`);
            return;
        }
        setFormError(refusal);
        window.setTimeout(() => summaryRef.current?.focus(), 50);
    };

    const save = async (send: boolean) => {
        if (submitting) return;
        // Finition 2b (C) : une catégorie modifiée et non enregistrée part avec son propre bouton, avant l'envoi
        if (send && isEdit && ticketingDirty.length > 0) {
            setFormError(`Enregistrez d’abord ${ticketingDirty.join(', ')} : chaque catégorie s’enregistre avec son propre bouton, à l’étape Billets.`);
            window.setTimeout(() => summaryRef.current?.focus(), 50);
            return;
        }
        setFormInfo(null);
        setSaveResult(null);
        setConflict(false);
        const { map: schemaMap, body, maps } = validate();
        const map = { ...schemaMap, ...belowMinimumErrors(), ...(isEdit ? {} : zoneRuleErrors(zones, categories)) };
        if (isEdit && Object.keys(body).length === 0 && !send) {
            setErrors({});
            setFormError(null);
            setFormInfo('Aucune modification à enregistrer.');
            return;
        }
        if (Object.keys(map).length > 0) {
            showErrors(map, null);
            return;
        }
        setErrors({});
        setFormError(null);
        setSubmitting(true);
        setSending(send);
        try {
            if (!isEdit) {
                const res = await fetch('/api/partner/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await readApiBody(res);
                if (res.ok && data.success !== false) {
                    const createdId = data.event && typeof data.event === 'object' ? str((data.event as Row).id) : '';
                    if (send && createdId) {
                        await sendForValidation(createdId, true);
                        return;
                    }
                    if (userId) clearDraft(userId, null);
                    setLeaving(true);
                    toast.success('Brouillon enregistré. Envoyez-le pour validation quand il est prêt, depuis le formulaire ou la liste de vos événements.');
                    router.push('/partner/events');
                    return;
                }
                showErrors(serverErrors(data, maps), data.error || 'L’enregistrement a été refusé.');
                return;
            }

            const ev = event ?? {};
            if (Object.keys(body).length === 0 && send && eventId) {
                await sendForValidation(eventId, false);
                return;
            }
            const res = await fetch(`/api/partner/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patch: body, expected_updated_at: str(ev.updated_at) }),
            });
            const data = await readApiBody(res);
            if (res.ok && data.success !== false) {
                const updated = data.event && typeof data.event === 'object' ? { ...ev, ...(data.event as Row) } : ev;
                const v = valuesFromEvent(updated);
                setValues(v);
                setBaseline(eventPayload(v).payload);
                setLoad({ state: 'ready', event: updated });
                setSaveResult({
                    notifiedHolders: Number(data.notified_holders ?? 0),
                    smsQueued: Number(data.sms_queued ?? 0),
                    placeNoticeAt: typeof data.place_notice_at === 'string' ? data.place_notice_at : null,
                    placeNoticeHeld: data.place_notice_held === true,
                });
                if (userId) clearDraft(userId, eventId);
                if (send && eventId) {
                    await sendForValidation(eventId, false);
                    return;
                }
                toast.success('Modifications enregistrées.');
                return;
            }
            if (data.code === 'EDIT_CONFLICT') {
                setConflict(true);
                setFormError(null);
                return;
            }
            showErrors(serverErrors(data, maps), data.error || 'La modification a été refusée.');
        } catch {
            setFormError(NETWORK_MESSAGE);
            window.setTimeout(() => summaryRef.current?.focus(), 50);
        } finally {
            setSubmitting(false);
            setSending(false);
        }
    };

    // ── États de l'édition ────────────────────────────────────────────────

    const header = (
        <PageHeader
            back={{ href: '/partner/events', label: 'Retour à mes événements' }}
            eyebrow={isEdit && status ? <StatusBadge domain="event" status={status} /> : undefined}
            title={isEdit ? 'Modifier l’événement' : 'Créer un événement'}
            description={isEdit
                ? (event ? str(event.title) : undefined)
                : 'L’événement est enregistré en brouillon. À la dernière étape, vérifiez-le puis envoyez-le pour validation (ou plus tard, depuis la liste de vos événements).'}
        />
    );

    if (load.state === 'loading') {
        return (
            <div className="mx-auto w-full max-w-4xl py-6">
                {header}
                <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
                    <span className="sr-only">Chargement de l’événement…</span>
                    <div className="h-11 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
                    <div className="h-96 w-full rounded-3xl bg-surface-sunken motion-safe:animate-pulse" />
                </div>
            </div>
        );
    }

    if (load.state === 'error') {
        return (
            <div className="mx-auto w-full max-w-4xl py-6">
                {header}
                <ErrorState title="Événement indisponible" description={load.message} onRetry={() => void loadEvent()} />
            </div>
        );
    }

    if (load.state === 'notfound') {
        return (
            <div className="mx-auto w-full max-w-4xl py-6">
                {header}
                <EmptyState
                    title="Événement introuvable"
                    description="Cet événement n’existe pas ou n’appartient pas à votre compte."
                    actionLabel="Voir mes événements"
                    actionHref="/partner/events"
                />
            </div>
        );
    }

    if (isEdit && !EDITABLE_STATUSES.has(status)) {
        const pending = status === 'EN_ATTENTE';
        return (
            <div className="mx-auto w-full max-w-4xl py-6">
                {header}
                <StatusBanner
                    tone={pending ? 'warning' : 'neutral'}
                    title={pending ? 'Événement en cours de validation' : 'Événement figé'}
                    action={<LinkButton href="/partner/events" variant="secondary" size="sm">Voir mes événements</LinkButton>}
                >
                    {pending
                        ? 'Pour le modifier, retirez-le d’abord de la validation depuis la liste de vos événements, puis soumettez-le à nouveau.'
                        : 'Un événement terminé ou annulé ne peut plus être modifié.'}
                </StatusBanner>
            </div>
        );
    }

    // ── Formulaire ────────────────────────────────────────────────────────

    const stepIndex = SCREENS.findIndex((s) => s.id === step);
    const currentStep = SCREENS[stepIndex];
    const onReview = step === 'verifier';
    /** Finition 2b (C) : l'envoi pour validation part du formulaire pour une création ou un brouillon. */
    const canSend = !isEdit || status === 'BROUILLON';
    const errorEntries = Object.entries(errors);
    const stepsWithErrors = new Set(errorEntries.map(([k]) => stepOfKey(k)).filter(Boolean));
    const showSummary = errorEntries.length > 0 || formError !== null;
    const lastStep = onReview;
    const hint = (base: string | undefined, notify: boolean) => (notify && withHolders ? [base, NOTIFY_HINT].filter(Boolean).join(' ') : base);
    // Finition 2a (2, E-01) : sans heure de fin, la fin retenue (même règle que la base) est montrée sous les dates
    const retained = values.start_date && values.start_time && !values.end_time
        ? retainedEnd({ start_date: values.start_date, start_time: values.start_time, end_date: values.end_date || null, end_time: null })
        : null;

    // Finition 2b (C, E-24) : récapitulatif et manques de l'écran « Vérifier » (création : la saisie ; modification : la
    // saisie, les catégories et les zones enregistrées, relues)
    const reviewCategories: Array<{ name: string; price: number | null; total: number | null; active: boolean; color: string; instruction: string; sale_start: string | null; sale_end: string | null }> = isEdit
        ? (reviewSnapshot?.categories ?? eventCategories).map((c) => ({
            name: str(c.name),
            price: c.price === null || c.price === undefined ? null : Number(c.price),
            total: c.total_quantity === null || c.total_quantity === undefined ? null : Number(c.total_quantity),
            active: c.is_active !== false,
            color: isScanCategoryColor(c.scan_color) ? c.scan_color : '',
            instruction: str(c.entry_instruction),
            sale_start: c.sale_start ? str(c.sale_start) : null,
            sale_end: c.sale_end ? str(c.sale_end) : null,
        }))
        : categories.map((c) => ({
            name: c.name,
            price: numberInput(c.price) ?? null,
            total: numberInput(c.total_quantity) ?? null,
            active: c.is_active,
            color: c.scan_color,
            instruction: c.entry_instruction,
            sale_start: c.sale_start || null,
            sale_end: c.sale_end || null,
        }));
    const reviewZones: ReviewData['zones'] = (() => {
        if (!isEdit) {
            return zones === null ? null : zones.map((z) => ({
                name: z.name,
                kindLabel: ZONE_KIND_LABELS[z.kind],
                categories: z.categoryKeys.map((k) => categories.find((c) => c.key === k)?.name.trim() ?? '').filter((n) => n !== ''),
                gates: z.gates.map((g) => g.name.trim()).filter((n) => n !== ''),
            }));
        }
        const config = reviewSnapshot?.zones;
        if (!config || !Array.isArray(config.zones) || config.zones.length === 0) return null;
        const names = new Map(((config.categories ?? []) as Row[]).map((c) => [str(c.id), str(c.name)]));
        return (config.zones as Row[]).map((z) => ({
            name: str(z.name),
            kindLabel: z.kind === 'CONTROLE' ? ZONE_KIND_LABELS.CONTROLE : ZONE_KIND_LABELS.ENTREE,
            categories: ((z.category_ids ?? []) as string[]).map((id) => names.get(id) ?? '').filter((n) => n !== ''),
            gates: ((z.gates ?? []) as Row[]).map((g) => str(g.name)),
        }));
    })();
    const missing = canSend
        ? submissionMissing({
            image_url: values.image_url.trim() === '' ? null : values.image_url,
            latitude: values.latitude,
            longitude: values.longitude,
            start_date: values.start_date,
            start_time: values.start_time,
            end_date: values.end_date || null,
            end_time: values.end_time || null,
            categories: reviewCategories.map((c) => ({ name: c.name, is_active: c.active, sale_start: c.sale_start, sale_end: c.sale_end })),
        })
        : [];
    const reviewData: ReviewData = {
        title: values.title,
        typeLabel: EVENT_CATEGORIES.find((c) => c.id === values.category)?.label ?? '',
        start: values.start_date ? formatEventDateTime(values.start_date, values.start_time) : '',
        end: values.end_time
            ? formatEventDateTime(values.end_date || values.start_date, values.end_time)
            : retained ? `${retained.text} (fin retenue)` : '',
        location: values.location,
        city: values.city,
        capacity: values.capacity.trim() === '' ? null : numberInput(values.capacity) ?? null,
        hasPoster: values.image_url.trim() !== '',
        programLines: values.program.filter((r) => r.title.trim() !== '' || r.time !== '').length,
        hasPosition: values.latitude !== null && values.longitude !== null,
        address: values.practical.address,
        contactPhone: values.practical.contactPhone,
        categories: reviewCategories,
        zones: reviewZones,
    };

    return (
        <div className="mx-auto w-full max-w-4xl pb-40 pt-6 lg:pb-10">
            {header}

            {/* Finition 2b (C) : brouillon gardé dans le navigateur, proposé au retour */}
            {resumable && (
                <StatusBanner
                    tone="info"
                    title={`Reprendre votre saisie du ${formatShortDate(resumable.savedAt)} à ${formatTime(resumable.savedAt)} ?`}
                    className="mb-4"
                    action={(
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" onClick={resumeDraft}>Reprendre</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={eraseDraft}>Effacer</Button>
                        </div>
                    )}
                >
                    {isEdit
                        ? 'Des modifications de cet événement, non enregistrées, sont gardées sur cet appareil.'
                        : 'Une saisie non enregistrée est gardée sur cet appareil.'}
                </StatusBanner>
            )}

            {afterValidation && (
                <StatusBanner tone="info" title="Modifications encadrées après la validation" className="mb-4">
                    <ul className="list-disc space-y-1 pl-5">
                        <li>Description, programme, informations pratiques et affiche : modifiables librement.</li>
                        <li>Titre, dates, heures, lieu, ville et adresse&nbsp;: les détenteurs de billets sont prévenus.</li>
                        {/* Correctifs de la contre-vérification de la finition 2a (T3, T4) : dit avant d'enregistrer */}
                        <li>Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.</li>
                        <li>Type d’événement : verrouillé dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous la somme des quantités des catégories actives.</li>
                    </ul>
                </StatusBanner>
            )}

            {saveResult && (
                <StatusBanner
                    tone="success"
                    title="Modifications enregistrées"
                    className="mb-4 tabular-nums"
                    action={<LinkButton href="/partner/events" variant="secondary" size="sm">Voir mes événements</LinkButton>}
                >
                    {saveSummary(saveResult)}
                </StatusBanner>
            )}

            {conflict && (
                <StatusBanner
                    tone="warning"
                    title="L’événement a été modifié entre-temps"
                    announce="alert"
                    className="mb-4"
                    action={<Button type="button" variant="secondary" size="sm" onClick={() => unsaved.guard(() => void loadEvent())}>Recharger l’événement</Button>}
                >
                    Une autre session a enregistré des changements. Rechargez l’événement pour repartir de la dernière version (vos saisies non enregistrées seront perdues).
                </StatusBanner>
            )}

            <nav aria-label="Étapes du formulaire" className="mb-4">
                <p className="mb-2 text-sm font-medium text-fg-muted">
                    {onReview ? 'Dernière étape : vérifier avant d’envoyer' : `Étape ${stepIndex + 1} sur ${STEPS.length} : ${currentStep.heading}`}
                </p>
                {/* Finition 2b (C) : nom de chaque étape visible, sur téléphone aussi (3 colonnes, 6 sur grand écran) */}
                <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {SCREENS.map((s, i) => {
                        const active = s.id === step;
                        const hasError = s.id !== 'verifier' && stepsWithErrors.has(s.id);
                        return (
                            <li key={s.id} className="min-w-0">
                                <button
                                    type="button"
                                    onClick={() => goToStep(s.id)}
                                    aria-current={active ? 'step' : undefined}
                                    className={cn(
                                        'flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold transition-colors duration-200',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        active ? 'border-brand-fg bg-brand-bg text-brand-fg' : 'border-border bg-surface text-fg-muted hover:bg-surface-sunken hover:text-fg',
                                        hasError && !active && 'border-danger text-danger-fg',
                                    )}
                                >
                                    <span aria-hidden="true" className="tabular-nums">{s.id === 'verifier' ? <Check size={16} /> : i + 1}</span>
                                    <span aria-hidden="true" className="min-w-0 truncate">{s.label}</span>
                                    <span className="sr-only">{`${s.heading}${hasError ? ' (à corriger)' : ''}`}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:p-6">
                {showSummary && (
                    <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="ev-erreurs-titre" className="rounded-2xl border border-danger-border bg-danger-bg p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <p id="ev-erreurs-titre" className="text-base font-semibold text-danger-fg">
                            {errorEntries.length > 0
                                ? `Le formulaire contient ${errorEntries.length > 1 ? `${errorEntries.length} points à corriger` : 'un point à corriger'}`
                                : 'Enregistrement impossible'}
                        </p>
                        {formError && <p className="mt-1 text-sm leading-relaxed text-fg">{formError}</p>}
                        {errorEntries.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-1">
                                {errorEntries.map(([key, message]) => (
                                    <li key={key}>
                                        <button
                                            type="button"
                                            onClick={() => focusField(key)}
                                            className="min-h-11 cursor-pointer text-left text-sm font-medium text-danger-fg underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {`${labelOfKey(key, values, categories)} : ${message}`}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {formInfo && <StatusBanner tone="info" title={formInfo} />}

                <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-fg focus-visible:outline-none">
                    {currentStep.heading}
                </h2>

                {step === 'infos' && (
                    <div className="flex flex-col gap-5">
                        <TextInput
                            id="ev-title"
                            label="Titre de l’événement"
                            required
                            maxLength={EVENT_LIMITS.titleMax}
                            value={values.title}
                            onChange={(e) => set('title', e.target.value)}
                            placeholder="Par exemple : Nuit du Mbalax"
                            hint={hint(undefined, true)}
                            error={errors.title}
                        />

                        <CategoryRadios
                            value={values.category}
                            onChange={(c) => set('category', c)}
                            locked={salesStarted}
                            error={errors.category}
                        />

                        <Textarea
                            id="ev-description"
                            label="Description"
                            rows={6}
                            maxLength={EVENT_LIMITS.descriptionMax}
                            showCount
                            value={values.description}
                            onChange={(e) => set('description', e.target.value)}
                            placeholder="Présentez l’événement : artistes, ambiance, public attendu…"
                            error={errors.description}
                        />

                        <ImageUpload
                            id="ev-image_url"
                            label="Affiche de l’événement"
                            folder="events"
                            value={values.image_url}
                            onChange={(url) => set('image_url', url)}
                            hint="Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
                            error={errors.image_url}
                            cardPreview
                            downscale={isEdit ? undefined : 1600}
                        />

                        <fieldset className="flex flex-col gap-4 rounded-2xl border border-border p-4">
                            <legend className="px-1 text-base font-semibold text-fg">Dates et horaires (heure de Dakar)</legend>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <TextInput id="ev-start_date" type="date" label="Date de début" required value={values.start_date}
                                    onChange={(e) => set('start_date', e.target.value)} error={errors.start_date} hint={hint(undefined, true)} />
                                <TextInput id="ev-start_time" type="time" label="Heure de début" required value={values.start_time}
                                    onChange={(e) => set('start_time', e.target.value)} error={errors.start_time} />
                                <TextInput id="ev-end_date" type="date" label="Date de fin" value={values.end_date}
                                    onChange={(e) => set('end_date', e.target.value)} error={errors.end_date}
                                    hint="Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain." />
                                <TextInput id="ev-end_time" type="time" label="Heure de fin" value={values.end_time}
                                    onChange={(e) => set('end_time', e.target.value)} error={errors.end_time}
                                    hint="Facultative ; avec une heure de fin, la date de fin est demandée." />
                            </div>
                            {retained && (
                                <div className="rounded-xl bg-surface-sunken px-4 py-3">
                                    <p className="text-base font-semibold text-fg">Fin retenue : {retained.text}</p>
                                    <p className="mt-1 text-sm leading-relaxed text-fg-muted">{RETAINED_END_HELP}</p>
                                </div>
                            )}
                        </fieldset>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextInput id="ev-location" label="Lieu" required maxLength={EVENT_LIMITS.locationMax} value={values.location}
                                onChange={(e) => set('location', e.target.value)} placeholder="Par exemple : Grand Théâtre National"
                                error={errors.location} hint={hint(undefined, true)} />
                            <Select id="ev-city" label="Ville" required options={CITY_OPTIONS}
                                value={cityOther ? OTHER_CITY_VALUE : senegalCity(values.city) ?? OTHER_CITY_VALUE}
                                onChange={(e) => {
                                    const choice = e.target.value;
                                    setCityOther(choice === OTHER_CITY_VALUE);
                                    set('city', choice === OTHER_CITY_VALUE ? '' : choice);
                                }}
                                error={cityOther ? undefined : errors.city} hint={hint(undefined, true)} />
                            {cityOther && (
                                <TextInput id="ev-city-other" label="Précisez la ville" required minLength={EVENT_LIMITS.cityMin} maxLength={EVENT_LIMITS.cityMax}
                                    value={values.city} onChange={(e) => set('city', e.target.value)} error={errors.city}
                                    hint="Ville absente de la liste." fieldClassName="sm:col-start-2" />
                            )}
                        </div>

                        <TextInput
                            id="ev-capacity"
                            label="Capacité totale (jauge)"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={EVENT_LIMITS.capacityMax}
                            step={1}
                            value={values.capacity}
                            onChange={(e) => set('capacity', e.target.value)}
                            aside={salesStarted ? <Lock size={16} aria-hidden="true" /> : undefined}
                            hint={salesStarted
                                ? `Des billets sont vendus ou réservés : la jauge ne peut plus être retirée ni descendre sous ${formatInteger(editLocks?.capacity_floor ?? 0)} places.`
                                : editLocks && editLocks.active_quota > 0
                                    ? `Facultative. Elle ne descend pas sous la somme des quantités des catégories actives : ${formatInteger(editLocks.active_quota)} places.`
                                    : 'Facultative. La somme des quantités des catégories actives ne peut pas la dépasser.'}
                            error={errors.capacity}
                            fieldClassName="sm:max-w-xs"
                        />
                    </div>
                )}

                {step === 'programme' && (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm leading-relaxed text-fg-muted">
                            Facultatif. Les lignes vides sont ignorées et le programme est trié par heure à l’enregistrement.
                        </p>
                        {errors.program && <p role="alert" className="text-sm font-medium text-danger-fg">{errors.program}</p>}
                        {values.program.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-border bg-surface-sunken p-6 text-center text-sm text-fg-muted">
                                Aucune ligne de programme pour le moment.
                            </div>
                        )}
                        {values.program.map((row, index) => {
                            const fid = (f: string) => `ev-program-${row.key}-${f}`;
                            const err = (f: string) => errors[`program.${row.key}.${f}`];
                            const multiDay = values.end_date !== '' && values.end_date !== values.start_date;
                            return (
                                <section key={row.key} aria-labelledby={fid('titre')} className="flex flex-col gap-4 rounded-2xl border border-border p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 id={fid('titre')} className="text-base font-semibold text-fg">Ligne {index + 1}</h3>
                                        <IconButton
                                            aria-label={`Supprimer la ligne ${index + 1} du programme`}
                                            variant="danger"
                                            onClick={() => set('program', values.program.filter((r) => r.key !== row.key))}
                                        >
                                            <Trash2 size={18} />
                                        </IconButton>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <TextInput id={fid('time')} type="time" label="Heure" required value={row.time}
                                            onChange={(e) => setRow(row.key, { time: e.target.value })} error={err('time')} />
                                        <Select id={fid('kind')} label="Type" value={row.kind}
                                            onChange={(e) => setRow(row.key, { kind: e.target.value as ProgramKind })}
                                            options={PROGRAM_KINDS.map((k) => ({ value: k, label: PROGRAM_KIND_LABELS[k] }))}
                                            error={err('kind')} />
                                        <TextInput id={fid('title')} label="Intitulé" required maxLength={EVENT_LIMITS.programTitleMax} value={row.title}
                                            onChange={(e) => setRow(row.key, { title: e.target.value })} placeholder="Par exemple : Ouverture des portes"
                                            error={err('title')} fieldClassName="sm:col-span-2" />
                                        <TextInput id={fid('participant')} label="Artiste ou intervenant" maxLength={EVENT_LIMITS.programParticipantMax}
                                            value={row.participant} onChange={(e) => setRow(row.key, { participant: e.target.value })}
                                            error={err('participant')} fieldClassName={multiDay || row.day ? undefined : 'sm:col-span-2'} />
                                        {(multiDay || row.day !== '') && (
                                            <TextInput id={fid('day')} type="date" label="Jour" value={row.day}
                                                onChange={(e) => setRow(row.key, { day: e.target.value })}
                                                hint="Pour un événement sur plusieurs jours." error={err('day')} />
                                        )}
                                        <Textarea id={fid('description')} label="Précisions" rows={2} maxLength={EVENT_LIMITS.programDescriptionMax}
                                            value={row.description} onChange={(e) => setRow(row.key, { description: e.target.value })}
                                            error={err('description')} fieldClassName="sm:col-span-2" />
                                    </div>
                                </section>
                            );
                        })}
                        {values.program.length < EVENT_LIMITS.programLinesMax && (
                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    leftIcon={<Plus size={18} />}
                                    onClick={() => {
                                        const row = emptyProgramRow();
                                        set('program', [...values.program, row]);
                                        window.requestAnimationFrame(() => document.getElementById(`ev-program-${row.key}-time`)?.focus());
                                    }}
                                >
                                    Ajouter une ligne
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {step === 'acces' && (
                    <div className="flex flex-col gap-5">
                        <fieldset className="flex flex-col gap-3">
                            <legend className="mb-1 text-base font-semibold text-fg">Position sur la carte</legend>
                            <p className="text-sm leading-snug text-fg-muted">Obligatoire pour soumettre l’événement à la validation.</p>
                            <MapPicker
                                idPrefix={MAP_PREFIX}
                                latitude={values.latitude}
                                longitude={values.longitude}
                                onChange={(lat, lng) => setValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
                                error={errors.latitude ?? errors.longitude}
                                center={cityCenter(values.city)}
                                onSearch={searchPlacesFromServer}
                            />
                        </fieldset>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextInput id="ev-practical_info-address" label="Adresse précise" maxLength={EVENT_LIMITS.practicalInfoMax}
                                value={values.practical.address} onChange={(e) => setPractical('address', e.target.value)}
                                placeholder="Rue, quartier, point de repère" error={errors['practical_info.address']}
                                hint={hint(undefined, true)} fieldClassName="sm:col-span-2" />
                            <TextInput id="ev-practical_info-contactPhone" type="tel" inputMode="tel" label="Téléphone de contact" maxLength={EVENT_LIMITS.practicalInfoMax}
                                value={values.practical.contactPhone} onChange={(e) => setPractical('contactPhone', e.target.value)}
                                placeholder="77 123 45 67" autoComplete="tel" error={errors['practical_info.contactPhone']}
                                hint="Mobile ou fixe sénégalais, par exemple 77 123 45 67 ou 33 821 00 00." />
                            <TextInput id="ev-practical_info-parking" label="Stationnement" maxLength={EVENT_LIMITS.practicalInfoMax}
                                value={values.practical.parking} onChange={(e) => setPractical('parking', e.target.value)}
                                placeholder="Parking gratuit sur place" error={errors['practical_info.parking']} />
                            <Textarea id="ev-practical_info-accessNotes" label="Indications d’accès" rows={3} maxLength={EVENT_LIMITS.practicalInfoMax}
                                showCount value={values.practical.accessNotes} onChange={(e) => setPractical('accessNotes', e.target.value)}
                                placeholder="Entrée principale, accès pour les personnes à mobilité réduite…"
                                error={errors['practical_info.accessNotes']} fieldClassName="sm:col-span-2" />
                            <Textarea id="ev-practical_info-rules" label="Règles à respecter" rows={3} maxLength={EVENT_LIMITS.practicalInfoMax}
                                showCount value={values.practical.rules} onChange={(e) => setPractical('rules', e.target.value)}
                                placeholder="Âge minimum, objets interdits, tenue…" error={errors['practical_info.rules']}
                                fieldClassName="sm:col-span-2" />
                        </div>
                    </div>
                )}

                {isEdit && eventId && (
                    <div hidden={step !== 'billetterie'}>
                        <EventTicketingManager
                            key={loadVersion}
                            eventId={eventId}
                            initialCategories={eventCategories}
                            categoryLocks={categoryLocks}
                            minPaidPrice={minPaidPrice}
                            externalColors={savedColors}
                            onDirtyChange={setTicketingDirty}
                            onSaved={() => void refreshLocks()}
                        />
                    </div>
                )}

                {step === 'billetterie' && !isEdit && (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm leading-relaxed text-fg-muted">
                            Ajoutez au moins une catégorie de billets pour pouvoir soumettre l’événement. Les catégories sont enregistrées avec le brouillon.
                        </p>
                        {errors.ticket_categories && <p role="alert" className="text-sm font-medium text-danger-fg">{errors.ticket_categories}</p>}
                        {categories.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-border bg-surface-sunken p-6 text-center text-sm text-fg-muted">
                                Aucune catégorie de billets pour le moment.
                            </div>
                        )}
                        {categories.map((cat, index) => (
                            <section key={cat.key} aria-labelledby={`${cat.key}-titre`} className="flex flex-col gap-4 rounded-2xl border border-border p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 id={`${cat.key}-titre`} className="min-w-0 break-words text-base font-semibold text-fg">
                                        {cat.name.trim() || `Catégorie ${index + 1}`}
                                    </h3>
                                    <IconButton
                                        aria-label={`Retirer la catégorie ${index + 1}`}
                                        variant="danger"
                                        onClick={() => {
                                            setCategories((list) => list.filter((c) => c.key !== cat.key));
                                            // Finition 2b (B) : une catégorie retirée n'est plus admise par aucune zone
                                            setZones((list) => list && list.map((z) => ({ ...z, categoryKeys: z.categoryKeys.filter((k) => k !== cat.key) })));
                                        }}
                                    >
                                        <Trash2 size={18} />
                                    </IconButton>
                                </div>
                                <CategoryFields
                                    draft={cat}
                                    onChange={(next) => setCategories((list) => list.map((c) => (c.key === cat.key ? next : c)))}
                                    errors={categoryErrorsFor(errors, cat.key)}
                                    others={categories.filter((c) => c.key !== cat.key).map((c) => ({ name: c.name, color: c.scan_color }))}
                                    minPaidPrice={minPaidPrice}
                                />
                            </section>
                        ))}
                        {categories.length < EVENT_LIMITS.categoriesMax && (
                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    leftIcon={<Plus size={18} />}
                                    onClick={() => {
                                        // Finition 2b (A) : couleur proposée, distincte de celles des autres catégories
                                        const draft = { ...newCategoryDraft(), scan_color: proposeScanColor(categories.map((c) => c.scan_color)) };
                                        setCategories((list) => [...list, draft]);
                                        // Finition 2b (B) : comme en base après la création (trg_ticket_categories_zone_admit), une
                                        // catégorie ajoutée est admise par toutes les zones d'entrée
                                        setZones((list) => list && list.map((z) => (z.kind === 'ENTREE' ? { ...z, categoryKeys: [...z.categoryKeys, draft.key] } : z)));
                                        window.requestAnimationFrame(() => document.getElementById(categoryFieldId(draft.key, 'name'))?.focus());
                                    }}
                                >
                                    Ajouter une catégorie
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {step === 'controle' && !isEdit && (
                    <EntryControlStep
                        prefix={ZONES_PREFIX}
                        categories={categories.map((c) => ({ key: c.key, name: c.name, scan_color: c.scan_color, is_active: c.is_active }))}
                        zones={zones}
                        onZonesChange={(next) => {
                            setZones(next);
                            setFormInfo(null);
                        }}
                        onColorChange={(key: string, color: ScanCategoryColor) => setCategories((list) => list.map((c) => (c.key === key ? { ...c, scan_color: color } : c)))}
                        newKey={newZoneKey}
                        errors={errors}
                    />
                )}

                {step === 'controle' && isEdit && eventId && (
                    <EntryControlEditor eventId={eventId} onColorsSaved={setSavedColors} />
                )}

                {onReview && (
                    <EventReview
                        data={reviewData}
                        missing={missing}
                        canSend={canSend}
                        onEdit={(s) => goToStep(s)}
                        onFix={(m) => focusField(m.field)}
                    />
                )}

                {/* Finition 2b (C) : barre d'actions fixe en bas sous 1024 px (téléphone, tablette), à sa place au-delà ; la
                    barre « Navigation rapide » de l'application est masquée sur ce formulaire (AppLayout) */}
                <div className="form-action-bar fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 pt-3 shadow-lg lg:static lg:z-auto lg:gap-3 lg:bg-transparent lg:px-0 lg:pt-4 lg:shadow-none">
                    <Button type="button" variant="ghost" onClick={handlePrevious} disabled={stepIndex === 0} leftIcon={<ChevronLeft size={18} />}>
                        Précédent
                    </Button>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {!lastStep && (
                            <Button type="button" variant={isEdit ? 'secondary' : 'primary'} onClick={handleNext} rightIcon={<ChevronRight size={18} />}>
                                Suivant
                            </Button>
                        )}
                        {(isEdit || lastStep) && (
                            <Button type="submit" variant={onReview && canSend ? 'secondary' : 'primary'} isLoading={submitting && !sending} disabled={sending} leftIcon={<Save size={18} />}>
                                {isEdit ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}
                            </Button>
                        )}
                        {onReview && canSend && (
                            <Button type="button" variant="primary" onClick={() => void save(true)} isLoading={sending}
                                disabled={missing.length > 0 || (submitting && !sending)} leftIcon={<Send size={18} />}>
                                Envoyer pour validation
                            </Button>
                        )}
                    </div>
                </div>
                {isEdit && lastStep && (
                    <p className="text-sm text-fg-muted">
                        « Enregistrer les modifications » concerne les informations de l’événement ; chaque catégorie de billets s’enregistre avec son propre bouton.
                    </p>
                )}
            </form>

            <ConfirmDialog
                isOpen={unsaved.open}
                onClose={unsaved.stay}
                onConfirm={unsaved.leave}
                title="Quitter sans enregistrer ?"
                message={unsaved.items.length > 0
                    ? `${unsaved.items.join(', ')} : vos modifications ne sont pas enregistrées et seront perdues.`
                    : 'Vos modifications ne sont pas enregistrées et seront perdues.'}
                confirmLabel="Quitter sans enregistrer"
                cancelLabel="Rester sur la page"
                variant="danger"
            />
        </div>
    );
}

// ── Catégorie d'événement (groupe de boutons radio, flèches du clavier) ─────

function CategoryRadios({ value, onChange, locked, error }: {
    value: EventCategoryValue | '';
    onChange: (value: EventCategoryValue) => void;
    locked: boolean;
    error?: string;
}) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const selected = EVENT_CATEGORIES.findIndex((c) => c.id === value);
    const errorId = 'ev-category-erreur';
    const hintId = 'ev-category-aide';

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const n = EVENT_CATEGORIES.length;
        let next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + n) % n;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = n - 1;
        if (next < 0) return;
        e.preventDefault();
        onChange(EVENT_CATEGORIES[next].id);
        refs.current[next]?.focus();
    };

    return (
        <div className="flex flex-col gap-1.5">
            <span id="ev-category-label" className="text-sm font-semibold text-fg">
                Type d’événement
                <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
                <span className="sr-only"> (obligatoire)</span>
            </span>
            <div
                id="ev-category"
                role="radiogroup"
                tabIndex={-1}
                aria-labelledby="ev-category-label"
                aria-describedby={[error ? errorId : null, locked ? hintId : null].filter(Boolean).join(' ') || undefined}
                aria-invalid={error ? true : undefined}
                aria-required
                className="grid grid-cols-1 gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-2 lg:grid-cols-4"
            >
                {EVENT_CATEGORIES.map((c, i) => {
                    const checked = c.id === value;
                    return (
                        <button
                            key={c.id}
                            ref={(el) => { refs.current[i] = el; }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            tabIndex={(selected === -1 ? i === 0 : i === selected) ? 0 : -1}
                            disabled={locked}
                            onClick={() => onChange(c.id)}
                            onKeyDown={(e) => onKeyDown(e, i)}
                            className={cn(
                                'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors duration-200',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                                checked ? 'border-brand-fg bg-brand-bg text-brand-fg' : 'border-border-strong bg-surface text-fg hover:bg-surface-sunken',
                                error && !checked && 'border-danger',
                            )}
                        >
                            <span>{c.label}</span>
                            {checked && <Check size={18} aria-hidden="true" className="flex-shrink-0" />}
                        </button>
                    );
                })}
            </div>
            {locked && (
                <p id={hintId} className="flex items-start gap-1.5 text-sm text-fg-muted">
                    <Lock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    Verrouillé : des billets ont déjà été vendus ou réservés.
                </p>
            )}
            {error && <p id={errorId} className="text-sm font-medium text-danger-fg">{error}</p>}
        </div>
    );
}
