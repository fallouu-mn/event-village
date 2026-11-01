'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
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
import { formatInteger } from '@/lib/format';
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
 */

const MapPicker = dynamic(() => import('@/components/ui/MapPicker').then((m) => m.MapPicker), {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-2xl bg-surface-sunken motion-safe:animate-pulse" aria-hidden="true" />,
});

type StepId = 'infos' | 'programme' | 'acces' | 'billetterie';

const STEPS: Array<{ id: StepId; label: string; heading: string }> = [
    { id: 'infos', label: 'Informations', heading: 'Informations générales' },
    { id: 'programme', label: 'Programme', heading: 'Programme' },
    { id: 'acces', label: 'Accès', heading: 'Accès et informations pratiques' },
    { id: 'billetterie', label: 'Billets', heading: 'Billetterie' },
];

const STEP1_FIELDS = new Set(['title', 'category', 'description', 'image_url', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city', 'capacity']);

/** Statuts où l'événement est modifiable dans le formulaire (EN_ATTENTE : à retirer d'abord ; TERMINE, ANNULE : figés). */
const EDITABLE_STATUSES = new Set(['BROUILLON', 'VALIDE', 'PUBLIE', 'SUSPENDU']);
/** Après validation : règles encadrées (champs notifiés, verrous après ventes). */
const AFTER_VALIDATION = new Set(['VALIDE', 'PUBLIE', 'SUSPENDU']);
/** Statuts où des billets ont pu être émis : les détenteurs sont prévenus d'un changement. */
const WITH_HOLDERS = new Set(['PUBLIE', 'SUSPENDU']);

const NOTIFY_HINT = 'Les détenteurs de billets seront prévenus de ce changement.';
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
    return patch;
}

// ── Erreurs ────────────────────────────────────────────────────────────────

type ErrorMap = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
    title: 'Titre',
    category: 'Catégorie de l’événement',
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
    return null;
}

const MAP_PREFIX = 'ev-carte';

function domIdOfKey(key: string): string | null {
    const parts = key.split('.');
    if (parts[0] === 'program' && parts.length === 3) return `ev-program-${parts[1]}-${parts[2]}`;
    if (parts[0] === 'billet' && parts.length === 3) return categoryFieldId(parts[1], parts[2] as CategoryField);
    if (key === 'latitude' || key === 'longitude') return `${MAP_PREFIX}-${key}`;
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
}

export function EventForm(props: EventFormProps) {
    const isEdit = props.mode === 'edit';
    const eventId = props.mode === 'edit' ? props.eventId : null;
    const router = useRouter();
    const toast = useToast();
    const { partner } = useAuth();

    const [load, setLoad] = useState<LoadState>(isEdit ? { state: 'loading' } : { state: 'ready', event: {} });
    const [values, setValues] = useState<EventValues>(EMPTY_VALUES);
    const [baseline, setBaseline] = useState<Row>(() => eventPayload(EMPTY_VALUES).payload);
    const [categories, setCategories] = useState<CategoryDraft[]>([]);
    const [step, setStep] = useState<StepId>('infos');
    const [errors, setErrors] = useState<ErrorMap>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [formInfo, setFormInfo] = useState<string | null>(null);
    const [conflict, setConflict] = useState(false);
    const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
    const [submitting, setSubmitting] = useState(false);
    /** Version du chargement : la billetterie repart des catégories relues à chaque rechargement. */
    const [loadVersion, setLoadVersion] = useState(0);
    const leavingRef = useRef(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const stepMoved = useRef(false);

    const event = load.state === 'ready' ? load.event : null;
    const status = event ? str(event.status) : '';
    const afterValidation = isEdit && AFTER_VALIDATION.has(status);
    const withHolders = isEdit && WITH_HOLDERS.has(status);
    const eventCategories = useMemo<Row[]>(
        () => (event && Array.isArray(event.ticket_categories) ? (event.ticket_categories as Row[]) : []),
        [event],
    );
    const salesStarted = afterValidation && eventCategories.some((c) => Number(c.sold_quantity) > 0 || Number(c.held_quantity) > 0);

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

    // Sortie de page avec des modifications non enregistrées
    const current = useMemo(() => eventPayload(values), [values]);
    const dirty = (isEdit ? Object.keys(diffPayload(current.payload, baseline)).length > 0 : JSON.stringify(current.payload) !== JSON.stringify(baseline))
        || (!isEdit && categories.length > 0);
    useEffect(() => {
        if (!dirty) return undefined;
        const handler = (e: BeforeUnloadEvent) => {
            if (leavingRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

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

    const goToStep = (next: StepId) => {
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
            const body: Row = { ...payload, ticket_categories: categories.map(categoryCreateBody) };
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
            },
        }), patch);
        const map = parsed.success ? {} : issuesToErrors(fieldErrors(parsed.error), maps, { ignoreImageOrigin: false });
        return { map, body: patch, maps };
    };

    const handleNext = () => {
        const index = STEPS.findIndex((s) => s.id === step);
        if (!isEdit) {
            const { map } = validate();
            const own = Object.fromEntries(Object.entries(map).filter(([k]) => stepOfKey(k) === step));
            if (Object.keys(own).length > 0) {
                showErrors(own, null);
                return;
            }
            setErrors({});
            setFormError(null);
        }
        if (index < STEPS.length - 1) goToStep(STEPS[index + 1].id);
    };

    const handlePrevious = () => {
        const index = STEPS.findIndex((s) => s.id === step);
        if (index > 0) goToStep(STEPS[index - 1].id);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (submitting) return;
        setFormInfo(null);
        setSaveResult(null);
        setConflict(false);
        const { map, body, maps } = validate();
        if (isEdit && Object.keys(body).length === 0) {
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
        try {
            if (!isEdit) {
                const res = await fetch('/api/partner/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await readApiBody(res);
                if (res.ok && data.success !== false) {
                    leavingRef.current = true;
                    toast.success('Brouillon enregistré. Soumettez-le à la validation depuis la liste de vos événements.');
                    router.push('/partner/events');
                    return;
                }
                showErrors(serverErrors(data, maps), data.error || 'L’enregistrement a été refusé.');
                return;
            }

            const ev = event ?? {};
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
                setSaveResult({ notifiedHolders: Number(data.notified_holders ?? 0), smsQueued: Number(data.sms_queued ?? 0) });
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
                : 'L’événement est enregistré en brouillon. Vous le soumettrez à la validation depuis la liste de vos événements.'}
        />
    );

    if (load.state === 'loading') {
        return (
            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
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
            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
                {header}
                <ErrorState title="Événement indisponible" description={load.message} onRetry={() => void loadEvent()} />
            </div>
        );
    }

    if (load.state === 'notfound') {
        return (
            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
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
            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
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

    const stepIndex = STEPS.findIndex((s) => s.id === step);
    const currentStep = STEPS[stepIndex];
    const errorEntries = Object.entries(errors);
    const stepsWithErrors = new Set(errorEntries.map(([k]) => stepOfKey(k)).filter(Boolean));
    const showSummary = errorEntries.length > 0 || formError !== null;
    const lastStep = stepIndex === STEPS.length - 1;
    const hint = (base: string | undefined, notify: boolean) => (notify && withHolders ? [base, NOTIFY_HINT].filter(Boolean).join(' ') : base);

    return (
        <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
            {header}

            {afterValidation && (
                <StatusBanner tone="info" title="Modifications encadrées après la validation" className="mb-4">
                    <ul className="list-disc space-y-1 pl-5">
                        <li>Description, programme, informations pratiques, affiche et position : modifiables librement.</li>
                        <li>Titre, dates, heures, lieu, ville et adresse : les détenteurs de billets sont prévenus.</li>
                        <li>Catégorie d’événement et jauge : verrouillées dès la première vente (la jauge peut seulement augmenter).</li>
                    </ul>
                </StatusBanner>
            )}

            {saveResult && (
                <StatusBanner
                    tone="success"
                    title="Modifications enregistrées"
                    className="mb-4"
                    action={<LinkButton href="/partner/events" variant="secondary" size="sm">Voir mes événements</LinkButton>}
                >
                    {saveResult.notifiedHolders > 0
                        ? `${formatInteger(saveResult.notifiedHolders)} ${saveResult.notifiedHolders > 1 ? 'détenteurs de billets prévenus' : 'détenteur de billets prévenu'} dans l’application${saveResult.smsQueued > 0 ? ` ; ${formatInteger(saveResult.smsQueued)} SMS en file d’envoi` : ''}.`
                        : 'Aucun détenteur de billets n’était à prévenir.'}
                </StatusBanner>
            )}

            {conflict && (
                <StatusBanner
                    tone="warning"
                    title="L’événement a été modifié entre-temps"
                    announce="alert"
                    className="mb-4"
                    action={<Button type="button" variant="secondary" size="sm" onClick={() => void loadEvent()}>Recharger l’événement</Button>}
                >
                    Une autre session a enregistré des changements. Rechargez l’événement pour repartir de la dernière version (vos saisies non enregistrées seront perdues).
                </StatusBanner>
            )}

            <nav aria-label="Étapes du formulaire" className="mb-4">
                <p className="mb-2 text-sm font-medium text-fg-muted">
                    Étape {stepIndex + 1} sur {STEPS.length} : {currentStep.heading}
                </p>
                <ol className="grid grid-cols-4 gap-2">
                    {STEPS.map((s, i) => {
                        const active = s.id === step;
                        const hasError = stepsWithErrors.has(s.id);
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
                                    <span aria-hidden="true" className="tabular-nums">{i + 1}</span>
                                    <span className="hidden truncate sm:inline">{s.label}</span>
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
                            hint="JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
                            error={errors.image_url}
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
                        </fieldset>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextInput id="ev-location" label="Lieu" required maxLength={EVENT_LIMITS.locationMax} value={values.location}
                                onChange={(e) => set('location', e.target.value)} placeholder="Par exemple : Grand Théâtre National"
                                error={errors.location} hint={hint(undefined, true)} />
                            <TextInput id="ev-city" label="Ville" required maxLength={EVENT_LIMITS.cityMax} value={values.city}
                                onChange={(e) => set('city', e.target.value)} error={errors.city} hint={hint(undefined, true)} />
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
                                ? 'Des billets sont vendus : la jauge peut augmenter, mais ni descendre sous les ventes ni être retirée.'
                                : 'Facultative. La somme des quantités des catégories de billets ne peut pas la dépasser.'}
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
                            <legend className="mb-2 text-base font-semibold text-fg">Position sur la carte</legend>
                            <MapPicker
                                idPrefix={MAP_PREFIX}
                                latitude={values.latitude}
                                longitude={values.longitude}
                                onChange={(lat, lng) => setValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
                                error={errors.latitude ?? errors.longitude}
                            />
                        </fieldset>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextInput id="ev-practical_info-address" label="Adresse précise" maxLength={EVENT_LIMITS.practicalInfoMax}
                                value={values.practical.address} onChange={(e) => setPractical('address', e.target.value)}
                                placeholder="Rue, quartier, point de repère" error={errors['practical_info.address']}
                                hint={hint(undefined, true)} fieldClassName="sm:col-span-2" />
                            <TextInput id="ev-practical_info-contactPhone" type="tel" label="Téléphone de contact" maxLength={EVENT_LIMITS.practicalInfoMax}
                                value={values.practical.contactPhone} onChange={(e) => setPractical('contactPhone', e.target.value)}
                                placeholder="77 123 45 67" autoComplete="tel" error={errors['practical_info.contactPhone']} />
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
                        <EventTicketingManager key={loadVersion} eventId={eventId} initialCategories={eventCategories} />
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
                                        onClick={() => setCategories((list) => list.filter((c) => c.key !== cat.key))}
                                    >
                                        <Trash2 size={18} />
                                    </IconButton>
                                </div>
                                <CategoryFields
                                    draft={cat}
                                    onChange={(next) => setCategories((list) => list.map((c) => (c.key === cat.key ? next : c)))}
                                    errors={categoryErrorsFor(errors, cat.key)}
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
                                        const draft = newCategoryDraft();
                                        setCategories((list) => [...list, draft]);
                                        window.requestAnimationFrame(() => document.getElementById(categoryFieldId(draft.key, 'name'))?.focus());
                                    }}
                                >
                                    Ajouter une catégorie
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
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
                            <Button type="submit" variant="primary" isLoading={submitting} leftIcon={<Save size={18} />}>
                                {isEdit ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}
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
                Catégorie de l’événement
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
                    Verrouillée : des billets ont déjà été vendus ou réservés.
                </p>
            )}
            {error && <p id={errorId} className="text-sm font-medium text-danger-fg">{error}</p>}
        </div>
    );
}
