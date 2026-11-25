'use client';

/**
 * Lot 10b (point 3) : formulaire commun de création et de modification d'une salle, par sa propriétaire.
 *  - six sections numérotées : la salle, prix et acompte, règle d'annulation, adresse et position, équipements, photos ;
 *  - textes des trois règles d'annulation reçus du serveur (policyTexts, lib/halls/policies.server.ts) : aucun
 *    pourcentage écrit en dur ici ;
 *  - carte chargée à la demande (next/dynamic, sans rendu serveur), recherche de lieu par GET /api/partner/places/search ;
 *  - photos de 1 à 12 déposées par ImageUpload (dossier halls, réencodées par la route de dépôt), à retirer et à
 *    ordonner ; la première est la photo principale ;
 *  - erreurs sous les champs et récapitulatif focalisable ; enregistrement protégé du double clic ; garde avant de
 *    quitter avec des saisies non enregistrées.
 * Envoi : POST /api/partner/halls (création) ou PUT /api/partner/halls/[id] (modification). Les règles sont revérifiées
 * par la route ; son refus (`error`) est affiché tel quel dans le récapitulatif.
 * Lot 10b (correctifs) :
 *  - point 1 : la saisie est gardée sur l'appareil (useHallDraft, localStorage, clé par compte et par fiche) ; à
 *    l'ouverture, bandeau « Reprendre ma salle en cours » (création) ou reprise des changements non enregistrés
 *    (modification) ; brouillon effacé après un enregistrement réussi ; photos = adresses déjà déposées ;
 *  - point 2 : salle refusée : motif affiché en tête, bouton « Enregistrer et renvoyer en validation » (PUT puis
 *    POST /api/partner/halls/[id]/submit) ; un renvoi refusé laisse les changements enregistrés et montre le message
 *    de la route ;
 *  - point 3 : vraies valeurs (hallDefaults, lues par la page serveur) : pourcentage de l'acompte par défaut, durée de
 *    garde d'une date et échéance du solde rappelées dans l'aide de l'acompte.
 * Lot Carte B3 : question « Qui accueille ? » (chez un particulier, présélectionné à la création, ou lieu professionnel)
 * près de l'adresse, envoyée en `host_kind` à la création et à la modification et gardée dans le brouillon ; chez un
 * particulier, l'aide de l'adresse rappelle qu'elle reste cachée jusqu'à une réservation confirmée.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, History, Lock, Plus, Save, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { LinkButton } from '@/components/ui/LinkButton';
import { Select, TextInput, Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { AMENITY_SUGGESTIONS, POLICY_LABELS } from '@/lib/halls/views';
import { OTHER_CITY_VALUE, SENEGAL_CITIES, canonicalCity, cityCenter, senegalCity } from '@/lib/events/senegal-cities';
import { PLACE_SEARCH_UNAVAILABLE } from '@/lib/places/place-texts';
import { HOST_KINDS, HOST_KIND_TEXT, hostKindOf, type HostKind } from '@/lib/lieux/position-publique';
// Types seulement : la carte reste chargée à la demande
import type { PlaceSearchOutcome, PlaceSearchResult } from '@/components/ui/MapPicker';
import { POLICY_KEYS, daysText, minutesText, percentText, putJson, type HallDefaults, type OwnHall, type PolicyKey } from './hall-api';
import { useHallDraft } from './useHallDraft';

const MapPicker = dynamic(() => import('@/components/ui/MapPicker').then((m) => m.MapPicker), {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-xl bg-muted sm:h-72" aria-hidden="true" />,
});

/** Limites des routes (lib/halls/hall.service.ts) reprises pour guider la saisie ; la route reste juge. */
const LIMITS = { name: 120, description: 4000, address: 200, city: 80, amenity: 40, amenities: 30, photos: 12, capacity: 100_000 } as const;
const MAP_PREFIX = 'hall-carte';

type DepositChoice = 'DEFAUT' | 'POURCENTAGE' | 'MONTANT_FIXE';

interface HallValues {
    name: string;
    description: string;
    capacity: string;
    pricePerDay: string;
    pricePerHour: string;
    depositChoice: DepositChoice;
    depositValue: string;
    policy: PolicyKey;
    /** Lot Carte B3 : chez un particulier (adresse cachée au public) ou lieu professionnel. */
    hostKind: HostKind;
    address: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    amenities: string[];
    images: string[];
}

type FieldKey = 'name' | 'description' | 'capacity' | 'pricePerDay' | 'pricePerHour' | 'depositValue' | 'address' | 'city' | 'position' | 'amenities' | 'images';
type ErrorMap = Partial<Record<FieldKey, string>>;

/** Ordre du récapitulatif et libellé de chaque champ. */
const FIELD_LABELS: ReadonlyArray<[FieldKey, string]> = [
    ['name', 'Nom de la salle'],
    ['description', 'Description'],
    ['capacity', 'Capacité'],
    ['pricePerDay', 'Prix par jour'],
    ['pricePerHour', 'Prix par heure'],
    ['depositValue', 'Acompte'],
    ['address', 'Adresse'],
    ['city', 'Ville'],
    ['position', 'Position sur la carte'],
    ['amenities', 'Équipements'],
    ['images', 'Photos'],
];

/** Les trois façons de fixer l'acompte ; le pourcentage par défaut est la valeur réelle du réglage (hallDefaults). */
function depositOptions(defaultPercent: number | null): ReadonlyArray<{ value: DepositChoice; title: string; text: string }> {
    return [
        {
            value: 'DEFAUT',
            title: defaultPercent !== null ? `Acompte d’Event Village : ${percentText(defaultPercent)}` : 'Acompte d’Event Village',
            text: defaultPercent !== null
                ? `${percentText(defaultPercent)} du prix, la valeur par défaut fixée par Event Village.`
                : 'La valeur par défaut fixée par Event Village.',
        },
        { value: 'POURCENTAGE', title: 'Pourcentage du prix', text: 'Vous choisissez la part du prix payée à la réservation.' },
        { value: 'MONTANT_FIXE', title: 'Montant fixe', text: 'Le même acompte en francs CFA, quelle que soit la durée.' },
    ];
}

/** Aide de l'acompte : durée de garde d'une date et échéance du solde, avec les valeurs réelles quand elles sont lues. */
function depositHelp(d: HallDefaults | null | undefined): string {
    const hold = d?.holdMinutes
        ? `La date est tenue ${minutesText(d.holdMinutes)} le temps de payer l’acompte.`
        : 'La date est tenue le temps de payer l’acompte.';
    const due = d?.balanceDueDays
        ? `Le solde est à payer au plus tard ${daysText(d.balanceDueDays)} avant la date ; pour une date plus proche, tout se paie en une fois.`
        : 'Le solde est à payer avant l’échéance ; pour une date proche, tout se paie en une fois.';
    return `Le client paie l’acompte en réservant pour garder la date. ${hold} ${due}`;
}

const CITY_OPTIONS = [
    ...SENEGAL_CITIES.map((c) => ({ value: c, label: c })),
    { value: OTHER_CITY_VALUE, label: 'Autre ville' },
];

function domIdOf(key: FieldKey, cityOther: boolean): string {
    switch (key) {
        case 'name': return 'hall-name';
        case 'description': return 'hall-description';
        case 'capacity': return 'hall-capacity';
        case 'pricePerDay': return 'hall-price-day';
        case 'pricePerHour': return 'hall-price-hour';
        case 'depositValue': return 'hall-deposit-value';
        case 'address': return 'hall-address';
        case 'city': return cityOther ? 'hall-city-other' : 'hall-city';
        case 'position': return `${MAP_PREFIX}-latitude`;
        case 'amenities': return 'hall-amenity-new';
        case 'images': return 'hall-photos-add';
    }
}

/** Nombre entier saisi avec ou sans espaces (« 150 000 ») ; null s'il n'est pas lisible. */
function wholeNumber(text: string): number | null {
    const clean = text.replace(/[\s  ]/g, '');
    if (!/^\d+$/.test(clean)) return null;
    const n = Number(clean);
    return Number.isSafeInteger(n) ? n : null;
}

/** Pourcentage saisi (virgule ou point) ; null s'il n'est pas lisible. */
function percentNumber(text: string): number | null {
    const clean = text.replace(/[\s  %]/g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(clean)) return null;
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
}

function initialValues(hall: OwnHall | null | undefined): HallValues {
    const mode = hall?.deposit_mode === 'MONTANT_FIXE' ? 'MONTANT_FIXE' : 'POURCENTAGE';
    const hasValue = hall?.deposit_value !== null && hall?.deposit_value !== undefined;
    const policy = POLICY_KEYS.find((k) => k === hall?.cancellation_policy) ?? 'MODEREE';
    return {
        name: hall?.name ?? '',
        description: hall?.description ?? '',
        capacity: hall?.capacity ? String(hall.capacity) : '',
        pricePerDay: hall?.price_per_day ? String(hall.price_per_day) : '',
        pricePerHour: hall?.price_per_hour ? String(hall.price_per_hour) : '',
        depositChoice: mode === 'MONTANT_FIXE' ? 'MONTANT_FIXE' : hasValue ? 'POURCENTAGE' : 'DEFAUT',
        depositValue: hasValue ? String(hall?.deposit_value) : '',
        policy,
        // Création : particulier (protection par défaut) ; modification : la valeur enregistrée
        hostKind: hostKindOf(hall?.host_kind),
        address: hall?.address ?? '',
        city: hall?.city ?? '',
        latitude: typeof hall?.latitude === 'number' ? hall.latitude : null,
        longitude: typeof hall?.longitude === 'number' ? hall.longitude : null,
        amenities: Array.isArray(hall?.amenities) ? hall.amenities.filter((a): a is string => typeof a === 'string') : [],
        images: Array.isArray(hall?.images) ? hall.images.filter((u): u is string => typeof u === 'string') : [],
    };
}

/** Contrôles de l'écran (mêmes bornes que la route) ; la route revérifie tout. */
function validate(v: HallValues, cityOther: boolean): ErrorMap {
    const errors: ErrorMap = {};
    if (!v.name.trim()) errors.name = 'Indiquez le nom de la salle.';
    else if (v.name.trim().length > LIMITS.name) errors.name = `${LIMITS.name} caractères au plus.`;
    if (v.description.length > LIMITS.description) errors.description = `${LIMITS.description} caractères au plus.`;

    const capacity = wholeNumber(v.capacity);
    if (!v.capacity.trim()) errors.capacity = 'Indiquez le nombre de personnes que la salle peut accueillir.';
    else if (capacity === null || capacity < 1 || capacity > LIMITS.capacity) errors.capacity = 'Nombre entier de personnes, de 1 à 100 000.';

    const day = wholeNumber(v.pricePerDay);
    if (!v.pricePerDay.trim()) errors.pricePerDay = 'Indiquez le prix d’une journée.';
    else if (day === null || day < 1) errors.pricePerDay = 'Nombre entier de francs CFA, au moins 1.';

    if (v.pricePerHour.trim()) {
        const hour = wholeNumber(v.pricePerHour);
        if (hour === null || hour < 1) errors.pricePerHour = 'Nombre entier de francs CFA, au moins 1, ou laissez vide.';
    }

    if (v.depositChoice === 'POURCENTAGE') {
        const pct = percentNumber(v.depositValue);
        if (!v.depositValue.trim()) errors.depositValue = 'Indiquez le pourcentage, ou choisissez l’acompte d’Event Village.';
        else if (pct === null || pct < 1 || pct > 100) errors.depositValue = 'Pourcentage de 1 à 100.';
    } else if (v.depositChoice === 'MONTANT_FIXE') {
        const fixed = wholeNumber(v.depositValue);
        if (!v.depositValue.trim()) errors.depositValue = 'Indiquez le montant de l’acompte.';
        else if (fixed === null || fixed < 1) errors.depositValue = 'Nombre entier de francs CFA, au moins 1.';
    }

    if (!v.address.trim()) errors.address = 'Indiquez l’adresse : rue, quartier, point de repère.';
    else if (v.address.trim().length > LIMITS.address) errors.address = `${LIMITS.address} caractères au plus.`;

    const city = v.city.trim();
    if (!city) errors.city = cityOther ? 'Précisez la ville.' : 'Choisissez la ville.';
    else if (city.length < 2 || city.length > LIMITS.city) errors.city = 'De 2 à 80 caractères.';

    if (v.latitude === null || v.longitude === null) errors.position = 'Placez le repère sur la carte, à l’entrée de la salle.';
    if (v.amenities.length > LIMITS.amenities) errors.amenities = `${LIMITS.amenities} équipements au plus.`;
    if (v.images.length < 1) errors.images = 'Ajoutez au moins une photo de la salle.';
    else if (v.images.length > LIMITS.photos) errors.images = `${LIMITS.photos} photos au plus.`;
    return errors;
}

/** Corps envoyé à la route : seulement les champs de la salle (jamais un montant de réservation). */
function payloadOf(v: HallValues) {
    const deposit = v.depositChoice === 'DEFAUT'
        ? null
        : v.depositChoice === 'POURCENTAGE' ? percentNumber(v.depositValue) : wholeNumber(v.depositValue);
    return {
        name: v.name.trim(),
        description: v.description.trim(),
        capacity: wholeNumber(v.capacity),
        price_per_day: wholeNumber(v.pricePerDay),
        price_per_hour: v.pricePerHour.trim() ? wholeNumber(v.pricePerHour) : null,
        deposit_mode: v.depositChoice === 'MONTANT_FIXE' ? 'MONTANT_FIXE' : 'POURCENTAGE',
        deposit_value: deposit,
        cancellation_policy: v.policy,
        host_kind: v.hostKind,
        latitude: v.latitude,
        longitude: v.longitude,
        address: v.address.trim(),
        city: canonicalCity(v.city),
        amenities: v.amenities,
        images: v.images,
    };
}

/** Recherche de lieu par le serveur (même contrat que le formulaire d'un événement). */
async function searchPlaces(query: string): Promise<PlaceSearchOutcome> {
    try {
        const res = await fetch(`/api/partner/places/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as { results?: PlaceSearchResult[]; error?: unknown } | null;
        if (res.ok && Array.isArray(body?.results)) return { kind: 'results', results: body.results };
        return { kind: 'error', message: typeof body?.error === 'string' && body.error ? body.error : PLACE_SEARCH_UNAVAILABLE };
    } catch {
        return { kind: 'error', message: PLACE_SEARCH_UNAVAILABLE };
    }
}

/** Contenu d'un brouillon gardé sur l'appareil. */
interface HallDraftData {
    values: HallValues;
    cityOther: boolean;
}

const PHOTO_URL = /^(https?:\/\/|\/)\S*$/;

function str(v: unknown, max: number): string | null {
    return typeof v === 'string' && v.length <= max ? v : null;
}

/** Coordonnée lue : nombre fini dans ses bornes, null (pas encore placée), ou undefined (illisible). */
function coord(c: unknown, limit: number): number | null | undefined {
    if (c === null) return null;
    return typeof c === 'number' && Number.isFinite(c) && Math.abs(c) <= limit ? c : undefined;
}

/** Lecture prudente d'un brouillon (il vient du stockage de l'appareil : rien n'est cru sur parole). */
function parseDraft(raw: unknown): HallDraftData | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as { values?: unknown; cityOther?: unknown };
    const v = r.values && typeof r.values === 'object' ? (r.values as Record<string, unknown>) : null;
    if (!v) return null;
    const name = str(v.name, LIMITS.name * 2);
    const description = str(v.description, LIMITS.description * 2);
    const capacity = str(v.capacity, 40);
    const pricePerDay = str(v.pricePerDay, 40);
    const pricePerHour = str(v.pricePerHour, 40);
    const depositValue = str(v.depositValue, 40);
    const address = str(v.address, LIMITS.address * 2);
    const city = str(v.city, LIMITS.city * 2);
    const depositChoice = v.depositChoice === 'DEFAUT' || v.depositChoice === 'POURCENTAGE' || v.depositChoice === 'MONTANT_FIXE' ? v.depositChoice : null;
    const policy = POLICY_KEYS.find((k) => k === v.policy) ?? null;
    // Brouillon d'avant le lot Carte B3 (sans ce champ) ou valeur illisible : particulier, le choix protecteur
    const hostKind = hostKindOf(v.hostKind);
    const latitude = coord(v.latitude, 90);
    const longitude = coord(v.longitude, 180);
    const amenities = Array.isArray(v.amenities)
        ? v.amenities.filter((a): a is string => typeof a === 'string' && a.length > 0 && a.length <= LIMITS.amenity).slice(0, LIMITS.amenities)
        : null;
    const images = Array.isArray(v.images)
        ? v.images.filter((u): u is string => typeof u === 'string' && u.length <= 2048 && PHOTO_URL.test(u)).slice(0, LIMITS.photos)
        : null;
    if (name === null || description === null || capacity === null || pricePerDay === null || pricePerHour === null || depositValue === null
        || address === null || city === null || depositChoice === null || policy === null || latitude === undefined || longitude === undefined
        || amenities === null || images === null) return null;
    return {
        values: { name, description, capacity, pricePerDay, pricePerHour, depositChoice, depositValue, policy, hostKind, address, city, latitude, longitude, amenities, images },
        cityOther: r.cityOther === true,
    };
}

/** En-tête numéroté d'une section du formulaire. */
function SectionTitle({ n, id, title, text }: { n: number; id: string; title: string; text?: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-primary-text tabular-nums" aria-hidden="true">
                {n}
            </span>
            <div className="min-w-0">
                <h2 id={id} className="text-lg font-bold leading-snug text-foreground-strong">{title}</h2>
                {text && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>}
            </div>
        </div>
    );
}

/** Option d'un groupe de boutons radio présentée en carte (libellé, texte, cible de 44 px au moins). */
function RadioCard({ name, id, value, checked, onChange, title, text }: {
    name: string; id: string; value: string; checked: boolean; onChange: () => void; title: string; text: string;
}) {
    return (
        <label
            htmlFor={id}
            className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-fast ease-standard',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                checked ? 'border-primary-text bg-primary-soft' : 'border-border bg-card hover:bg-muted',
            )}
        >
            <input id={id} type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 h-5 w-5 flex-shrink-0 accent-primary" />
            <span className="min-w-0">
                <span className="block text-base font-semibold text-foreground-strong">{title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{text}</span>
            </span>
        </label>
    );
}

/** Lot Carte B3 : rappel sous l'adresse d'une salle chez un particulier (aide du champ, lue avec lui). */
function PrivateAddressHint() {
    return (
        <span className="inline-flex items-start gap-1.5">
            <Lock size={14} className="mt-0.5 flex-shrink-0 text-primary-text" aria-hidden="true" />
            <span>Votre adresse reste cachée : le public voit seulement le quartier. Elle est donnée à la cliente une fois sa réservation confirmée.</span>
        </span>
    );
}

export interface HallFormProps {
    mode: 'create' | 'edit';
    /** Salle lue par GET /api/partner/halls/[id] (modification). */
    hall?: OwnHall | null;
    /** Textes des trois règles d'annulation, lus par la page serveur ; null si la lecture a échoué. */
    policyTexts: Record<PolicyKey, string> | null;
    /** Réglages réels des salles (acompte par défaut, durée de garde, échéance du solde), lus par la page serveur. */
    defaults?: HallDefaults | null;
}

export function HallForm({ mode, hall, policyTexts, defaults }: HallFormProps) {
    const router = useRouter();
    const toast = useToast();
    const { user } = useAuth();
    const isEdit = mode === 'edit' && !!hall;
    const resubmit = isEdit && hall?.validation_status === 'REFUSEE';
    // Valeurs enregistrées : celles de la salle, puis celles du dernier enregistrement réussi (renvoi refusé)
    const [start, setStart] = useState<HallValues>(() => initialValues(hall));
    const [values, setValues] = useState<HallValues>(start);
    const [cityOther, setCityOther] = useState<boolean>(() => !!start.city && !senegalCity(start.city));
    const [resubmitError, setResubmitError] = useState<string | null>(null);
    const [errors, setErrors] = useState<ErrorMap>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [amenityDraft, setAmenityDraft] = useState('');
    const [amenityError, setAmenityError] = useState<string | null>(null);
    const [photoNotice, setPhotoNotice] = useState('');
    const savingRef = useRef(false);
    const summaryRef = useRef<HTMLDivElement>(null);
    const resubmitRef = useRef<HTMLDivElement>(null);

    const dirty = !leaving && JSON.stringify(values) !== JSON.stringify(start);
    const describeUnsaved = useCallback(() => ['Les informations de la salle'], []);
    const unsaved = useUnsavedGuard(dirty, describeUnsaved);

    // ── Brouillon gardé sur l'appareil ──
    // Brouillon par compte et par salle (lib/events/local-draft : effacé à la déconnexion)
    const draftKey = user?.id ? `${user.id}::salle-${isEdit && hall ? hall.id : 'nouvelle'}` : null;
    const draftValue = useMemo<HallDraftData>(() => ({ values, cityOther }), [values, cityOther]);
    const draftBaseline = useMemo<HallDraftData>(() => ({ values: start, cityOther: !!start.city && !senegalCity(start.city) }), [start]);
    const draft = useHallDraft<HallDraftData>({
        storageKey: draftKey,
        value: draftValue,
        baseline: draftBaseline,
        base: isEdit && hall ? hall.updated_at : null,
        enabled: !leaving && !saving,
        parse: parseDraft,
    });
    const draftOffer = draft.offer;
    const draftStale = !!draftOffer && isEdit && !!hall && draftOffer.base !== null && draftOffer.base !== hall.updated_at;
    const resumeDraft = () => {
        const offer = draft.resume();
        if (!offer) return;
        setValues(offer.data.values);
        setCityOther(offer.data.cityOther);
        toast.success(isEdit ? 'Changements repris.' : 'Salle en cours reprise.');
    };

    // Après un premier envoi refusé, les erreurs suivent la saisie
    useEffect(() => {
        if (submitted) setErrors(validate(values, cityOther));
    }, [values, cityOther, submitted]);

    const set = <K extends keyof HallValues>(key: K, value: HallValues[K]) => setValues((v) => ({ ...v, [key]: value }));

    const errorEntries = FIELD_LABELS.filter(([k]) => errors[k]).map(([k, label]) => ({ key: k, label, message: errors[k] as string }));
    const showSummary = errorEntries.length > 0 || formError !== null;

    const focusField = (key: FieldKey) => {
        const el = document.getElementById(domIdOf(key, cityOther));
        el?.focus();
        el?.scrollIntoView({ block: 'center' });
    };

    const focusSummary = () => window.setTimeout(() => {
        summaryRef.current?.focus();
        summaryRef.current?.scrollIntoView({ block: 'start' });
    }, 30);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (savingRef.current) return;
        setSubmitted(true);
        const found = validate(values, cityOther);
        setErrors(found);
        setFormError(null);
        if (Object.keys(found).length > 0) {
            focusSummary();
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setResubmitError(null);
        try {
            if (isEdit && hall) {
                const hallUrl = `/api/partner/halls/${encodeURIComponent(hall.id)}`;
                await putJson<{ success: boolean }>(hallUrl, payloadOf(values));
                draft.clear();
                if (resubmit) {
                    try {
                        await sendJson(`${hallUrl}/submit`, 'POST');
                    } catch (err) {
                        // Les changements sont enregistrés (nouvelle base du formulaire) ; seul le renvoi a échoué
                        setStart(values);
                        setResubmitError(errorMessage(err, 'Envoi impossible pour le moment. Réessayez.'));
                        toast.success('Modifications enregistrées.');
                        window.setTimeout(() => {
                            resubmitRef.current?.focus();
                            resubmitRef.current?.scrollIntoView({ block: 'start' });
                        }, 30);
                        savingRef.current = false;
                        setSaving(false);
                        return;
                    }
                    setLeaving(true);
                    toast.success('Salle renvoyée en validation.');
                    router.push(`/partner/halls/${encodeURIComponent(hall.id)}?enregistree=renvoyee`);
                    return;
                }
                setLeaving(true);
                toast.success('Modifications enregistrées.');
                router.push(`/partner/halls/${encodeURIComponent(hall.id)}?enregistree=modifiee`);
            } else {
                const body = await fetchJson<{ success: boolean; hall?: { id?: string } }>('/api/partner/halls', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadOf(values)),
                });
                draft.clear();
                setLeaving(true);
                toast.success('Salle enregistrée : elle sera vérifiée avant d’être visible.');
                const id = typeof body.hall?.id === 'string' ? body.hall.id : null;
                router.push(id ? `/partner/halls/${encodeURIComponent(id)}?enregistree=creee` : '/partner/halls');
            }
        } catch (err) {
            setFormError(errorMessage(err, 'La salle n’a pas été enregistrée. Réessayez.'));
            focusSummary();
            savingRef.current = false;
            setSaving(false);
        }
    };

    // ── Équipements ──
    const hasAmenity = (a: string) => values.amenities.some((x) => x.toLowerCase() === a.toLowerCase());
    const toggleAmenity = (a: string) => {
        setAmenityError(null);
        if (hasAmenity(a)) {
            set('amenities', values.amenities.filter((x) => x.toLowerCase() !== a.toLowerCase()));
            return;
        }
        if (values.amenities.length >= LIMITS.amenities) {
            setAmenityError(`${LIMITS.amenities} équipements au plus : retirez-en un pour en ajouter un autre.`);
            return;
        }
        set('amenities', [...values.amenities, a]);
    };
    const addAmenity = () => {
        const a = amenityDraft.replace(/\s+/g, ' ').trim();
        if (!a) {
            setAmenityError('Écrivez l’équipement à ajouter.');
            return;
        }
        if (a.length > LIMITS.amenity) {
            setAmenityError(`${LIMITS.amenity} caractères au plus par équipement.`);
            return;
        }
        if (hasAmenity(a)) {
            setAmenityError('Cet équipement est déjà dans la liste.');
            return;
        }
        if (values.amenities.length >= LIMITS.amenities) {
            setAmenityError(`${LIMITS.amenities} équipements au plus : retirez-en un pour en ajouter un autre.`);
            return;
        }
        setAmenityError(null);
        set('amenities', [...values.amenities, a]);
        setAmenityDraft('');
    };
    const customAmenities = values.amenities.filter((a) => !AMENITY_SUGGESTIONS.some((s) => s.toLowerCase() === a.toLowerCase()));

    // ── Photos ──
    const addPhoto = (url: string) => {
        if (!url) return;
        setValues((v) => (v.images.includes(url) || v.images.length >= LIMITS.photos ? v : { ...v, images: [...v.images, url] }));
        setPhotoNotice('Photo ajoutée.');
    };
    const movePhoto = (from: number, to: number) => {
        setValues((v) => {
            if (to < 0 || to >= v.images.length) return v;
            const next = [...v.images];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return { ...v, images: next };
        });
        setPhotoNotice(to === 0 ? 'Photo placée en premier : c’est la photo principale.' : `Photo placée en position ${to + 1}.`);
    };
    const removePhoto = (index: number) => {
        setValues((v) => ({ ...v, images: v.images.filter((_, i) => i !== index) }));
        setPhotoNotice(`Photo ${index + 1} retirée.`);
    };

    const citySelectValue = cityOther ? OTHER_CITY_VALUE : senegalCity(values.city) ?? (values.city ? OTHER_CITY_VALUE : '');
    const validated = isEdit && hall?.validation_status === 'VALIDEE';
    const cardClass = 'flex flex-col gap-5 p-4 sm:p-6';
    const draftWhen = draftOffer?.savedAt ? formatDateTime(draftOffer.savedAt) : null;
    const draftName = draftOffer?.data.values.name.trim() ?? '';

    return (
        <>
            <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6" aria-busy={saving}>
                {draftOffer && (
                    <StatusBanner
                        tone="info"
                        icon={<History size={20} />}
                        title={isEdit ? 'Reprendre vos changements non enregistrés' : 'Reprendre ma salle en cours'}
                        action={(
                            <>
                                <Button type="button" size="sm" onClick={resumeDraft}>
                                    {isEdit ? 'Reprendre les changements' : 'Reprendre'}
                                </Button>
                                <Button type="button" variant="secondary" size="sm" onClick={draft.discard}>
                                    {isEdit ? 'Ignorer' : 'Recommencer'}
                                </Button>
                            </>
                        )}
                    >
                        <span className="block">
                            {isEdit
                                ? `Des changements de cette salle, faits sur cet appareil${draftWhen ? ` le ${draftWhen}` : ''}, n’ont pas été enregistrés.`
                                : `Vous aviez commencé ${draftName ? `« ${draftName} »` : 'une salle'} sur cet appareil${draftWhen ? ` le ${draftWhen}` : ''}. Les photos déjà déposées sont gardées.`}
                        </span>
                        {draftStale && (
                            <span className="mt-1 block font-semibold">La salle a été modifiée depuis : vérifiez chaque champ avant d’enregistrer.</span>
                        )}
                        <span className="mt-1 block">
                            {isEdit
                                ? '« Ignorer » efface ces changements et garde la salle telle qu’elle est enregistrée.'
                                : '« Recommencer » efface ce brouillon et ouvre un formulaire vide.'}
                        </span>
                    </StatusBanner>
                )}

                {resubmit && hall && (
                    <StatusBanner tone="danger" title="Salle refusée : corrigez-la puis renvoyez-la en validation">
                        <span className="block font-semibold">Motif de l’équipe d’Event Village :</span>
                        <span className="mt-1 block whitespace-pre-line break-words rounded-xl border border-danger-border bg-card px-3 py-2 text-base font-medium text-foreground-strong">
                            {hall.validation_reason?.trim() || 'Aucun motif n’a été transmis.'}
                        </span>
                        <span className="mt-2 block">« Enregistrer et renvoyer en validation » enregistre vos corrections et renvoie la salle à l’équipe.</span>
                    </StatusBanner>
                )}

                {resubmitError && (
                    <div ref={resubmitRef} tabIndex={-1} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <StatusBanner tone="warning" announce="alert" title="Modifications enregistrées, mais la salle n’a pas été renvoyée en validation">
                            <span className="block break-words">{resubmitError}</span>
                            <span className="mt-1 block">Complétez ce qui est demandé, puis touchez de nouveau « Enregistrer et renvoyer en validation ».</span>
                        </StatusBanner>
                    </div>
                )}

                {validated ? (
                    <StatusBanner tone="warning" title="Cette salle est validée : elle reste visible pendant vos modifications.">
                        Un changement de prix, d’adresse, de nom ou de photos est signalé à l’équipe d’Event Village. Les réservations déjà faites gardent leurs montants et leur règle d’annulation.
                    </StatusBanner>
                ) : !isEdit ? (
                    <StatusBanner tone="info" title="La salle sera vérifiée par l’équipe d’Event Village avant d’être visible.">
                        Vous recevrez un message dès qu’elle aura été examinée. Les champs marqués d’un astérisque sont obligatoires.
                    </StatusBanner>
                ) : null}

                {showSummary && (
                    <div
                        ref={summaryRef}
                        tabIndex={-1}
                        role="alert"
                        aria-labelledby="hall-erreurs-titre"
                        className="rounded-xl border border-danger-border bg-danger-soft p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <p id="hall-erreurs-titre" className="text-base font-semibold text-danger-text">
                            {errorEntries.length > 1
                                ? `Le formulaire contient ${errorEntries.length} points à corriger`
                                : errorEntries.length === 1 ? 'Le formulaire contient un point à corriger' : 'Enregistrement impossible'}
                        </p>
                        {formError && <p className="mt-1 text-sm leading-relaxed text-foreground-strong">{formError}</p>}
                        {errorEntries.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-1">
                                {errorEntries.map((entry) => (
                                    <li key={entry.key}>
                                        <button
                                            type="button"
                                            onClick={() => focusField(entry.key)}
                                            className="min-h-11 cursor-pointer text-left text-sm font-medium text-danger-text underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {`${entry.label} : ${entry.message}`}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* 1. La salle */}
                <section aria-labelledby="hall-s1" className={cn('rounded-xl border border-border bg-card shadow-sm', cardClass)}>
                    <SectionTitle n={1} id="hall-s1" title="La salle" text="Ce que les clients voient en premier." />
                    <TextInput
                        id="hall-name"
                        label="Nom de la salle"
                        required
                        maxLength={LIMITS.name}
                        value={values.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="Par exemple : Salle des fêtes Les Almadies"
                        error={errors.name}
                        autoComplete="off"
                    />
                    <Textarea
                        id="hall-description"
                        label="Description"
                        rows={5}
                        maxLength={LIMITS.description}
                        showCount
                        value={values.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="Ambiance, type de fêtes accueillies, services proposés…"
                        error={errors.description}
                    />
                    <TextInput
                        id="hall-capacity"
                        label="Capacité (nombre de personnes)"
                        required
                        inputMode="numeric"
                        value={values.capacity}
                        onChange={(e) => set('capacity', e.target.value)}
                        placeholder="Par exemple : 300"
                        hint="Nombre de personnes que la salle peut accueillir."
                        error={errors.capacity}
                        fieldClassName="sm:max-w-xs"
                    />
                </section>

                {/* 2. Prix et acompte */}
                <section aria-labelledby="hall-s2" className={cn('rounded-xl border border-border bg-card shadow-sm', cardClass)}>
                    <SectionTitle n={2} id="hall-s2" title="Prix et acompte" text="Les frais de service d’Event Village s’ajoutent au prix et sont montrés au client avant qu’il paie." />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInput
                            id="hall-price-day"
                            label="Prix par jour (F CFA)"
                            required
                            inputMode="numeric"
                            value={values.pricePerDay}
                            onChange={(e) => set('pricePerDay', e.target.value)}
                            placeholder="Par exemple : 150 000"
                            error={errors.pricePerDay}
                        />
                        <TextInput
                            id="hall-price-hour"
                            label="Prix par heure (F CFA)"
                            inputMode="numeric"
                            value={values.pricePerHour}
                            onChange={(e) => set('pricePerHour', e.target.value)}
                            placeholder="Facultatif"
                            hint="Facultatif. Laissez vide si la salle ne se loue qu’à la journée."
                            error={errors.pricePerHour}
                        />
                    </div>
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 text-sm font-semibold text-foreground-strong">Acompte</legend>
                        <p className="text-sm leading-relaxed text-muted-foreground">{depositHelp(defaults)}</p>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            {depositOptions(defaults?.depositDefaultPercent ?? null).map((o) => (
                                <RadioCard
                                    key={o.value}
                                    name="hall-deposit"
                                    id={`hall-deposit-${o.value.toLowerCase()}`}
                                    value={o.value}
                                    checked={values.depositChoice === o.value}
                                    onChange={() => setValues((v) => ({ ...v, depositChoice: o.value, depositValue: v.depositChoice === o.value ? v.depositValue : '' }))}
                                    title={o.title}
                                    text={o.text}
                                />
                            ))}
                        </div>
                        {values.depositChoice === 'POURCENTAGE' && (
                            <TextInput
                                id="hall-deposit-value"
                                label="Acompte (en % du prix)"
                                required
                                inputMode="decimal"
                                value={values.depositValue}
                                onChange={(e) => set('depositValue', e.target.value)}
                                placeholder="Par exemple : 30"
                                hint="De 1 à 100 %."
                                error={errors.depositValue}
                                fieldClassName="sm:max-w-xs"
                            />
                        )}
                        {values.depositChoice === 'MONTANT_FIXE' && (
                            <TextInput
                                id="hall-deposit-value"
                                label="Acompte (en F CFA)"
                                required
                                inputMode="numeric"
                                value={values.depositValue}
                                onChange={(e) => set('depositValue', e.target.value)}
                                placeholder="Par exemple : 50 000"
                                hint="Nombre entier de francs CFA."
                                error={errors.depositValue}
                                fieldClassName="sm:max-w-xs"
                            />
                        )}
                    </fieldset>
                </section>

                {/* 3. Règle d'annulation */}
                <section aria-labelledby="hall-s3" className={cn('rounded-xl border border-border bg-card shadow-sm', cardClass)}>
                    <SectionTitle
                        n={3}
                        id="hall-s3"
                        title="Règle d’annulation"
                        text={isEdit
                            ? 'Elle est montrée au client avant qu’il paie. Une réservation déjà faite garde la règle de sa création.'
                            : 'Elle est montrée au client avant qu’il paie.'}
                    />
                    <fieldset className="flex flex-col gap-3">
                        <legend className="sr-only">Choisissez la règle d’annulation</legend>
                        {POLICY_KEYS.map((k) => (
                            <RadioCard
                                key={k}
                                name="hall-policy"
                                id={`hall-policy-${k.toLowerCase()}`}
                                value={k}
                                checked={values.policy === k}
                                onChange={() => set('policy', k)}
                                title={POLICY_LABELS[k] ?? ''}
                                text={policyTexts?.[k] ?? 'Le détail de cette règle n’a pas pu être chargé. Rechargez la page pour le lire.'}
                            />
                        ))}
                    </fieldset>
                </section>

                {/* 4. Adresse et position */}
                <section aria-labelledby="hall-s4" className={cn('rounded-xl border border-border bg-card shadow-sm', cardClass)}>
                    <SectionTitle n={4} id="hall-s4" title="Adresse et position" text="Pour que les clients trouvent la salle." />
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 text-sm font-semibold text-foreground-strong">Qui accueille ?</legend>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {HOST_KINDS.map((k) => (
                                <RadioCard
                                    key={k}
                                    name="hall-accueil"
                                    id={`hall-accueil-${k.toLowerCase()}`}
                                    value={k}
                                    checked={values.hostKind === k}
                                    onChange={() => set('hostKind', k)}
                                    title={HOST_KIND_TEXT[k].label}
                                    text={HOST_KIND_TEXT[k].hint}
                                />
                            ))}
                        </div>
                    </fieldset>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInput
                            id="hall-address"
                            label="Adresse"
                            required
                            maxLength={LIMITS.address}
                            value={values.address}
                            onChange={(e) => set('address', e.target.value)}
                            placeholder="Rue, quartier, point de repère"
                            hint={values.hostKind === 'PARTICULIER' ? <PrivateAddressHint /> : undefined}
                            error={errors.address}
                            autoComplete="street-address"
                            fieldClassName="sm:col-span-2"
                        />
                        <Select
                            id="hall-city"
                            label="Ville"
                            required
                            options={CITY_OPTIONS}
                            placeholder="Choisir la ville"
                            value={citySelectValue}
                            onChange={(e) => {
                                const choice = e.target.value;
                                setCityOther(choice === OTHER_CITY_VALUE);
                                set('city', choice === OTHER_CITY_VALUE ? '' : choice);
                            }}
                            error={cityOther ? undefined : errors.city}
                        />
                        {cityOther && (
                            <TextInput
                                id="hall-city-other"
                                label="Précisez la ville"
                                required
                                maxLength={LIMITS.city}
                                value={values.city}
                                onChange={(e) => set('city', e.target.value)}
                                hint="Ville absente de la liste."
                                error={errors.city}
                            />
                        )}
                    </div>
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 text-sm font-semibold text-foreground-strong">
                            Position sur la carte
                            <span className="ml-0.5 text-danger-text" aria-hidden="true">*</span>
                            <span className="sr-only"> (obligatoire)</span>
                        </legend>
                        <MapPicker
                            idPrefix={MAP_PREFIX}
                            latitude={values.latitude}
                            longitude={values.longitude}
                            onChange={(lat, lng) => setValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
                            error={errors.position}
                            center={cityCenter(values.city)}
                            onSearch={searchPlaces}
                        />
                    </fieldset>
                </section>

                {/* 5. Équipements */}
                <section aria-labelledby="hall-s5" className={cn('rounded-xl border border-border bg-card shadow-sm', cardClass)}>
                    <SectionTitle
                        n={5}
                        id="hall-s5"
                        title="Équipements"
                        text={`Touchez un équipement pour l’ajouter ou le retirer (${LIMITS.amenities} au plus). Choisis : ${values.amenities.length}.`}
                    />
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Équipements proposés">
                        {AMENITY_SUGGESTIONS.map((a) => (
                            <FilterChip key={a} pressed={hasAmenity(a)} onClick={() => toggleAmenity(a)}>{a}</FilterChip>
                        ))}
                    </div>
                    {customAmenities.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-foreground-strong">Vos équipements</p>
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Vos équipements">
                                {customAmenities.map((a) => (
                                    <FilterChip key={a} pressed onClick={() => toggleAmenity(a)} aria-label={`Retirer ${a}`}>{a}</FilterChip>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <TextInput
                            id="hall-amenity-new"
                            label="Autre équipement"
                            maxLength={LIMITS.amenity}
                            value={amenityDraft}
                            onChange={(e) => { setAmenityDraft(e.target.value); setAmenityError(null); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addAmenity();
                                }
                            }}
                            placeholder="Par exemple : Piste de danse"
                            error={amenityError ?? errors.amenities}
                            autoComplete="off"
                            fieldClassName="min-w-0 flex-1"
                        />
                        <Button type="button" variant="secondary" onClick={addAmenity} leftIcon={<Plus size={16} />} className="sm:mt-7">
                            Ajouter
                        </Button>
                    </div>
                </section>

                {/* 6. Photos */}
                <section aria-labelledby="hall-s6" className={cn('rounded-xl border border-border bg-card shadow-sm', cardClass)}>
                    <SectionTitle
                        n={6}
                        id="hall-s6"
                        title="Photos"
                        text={`De 1 à ${LIMITS.photos} photos. La première est la photo principale, montrée sur la carte de la salle. Photos : ${values.images.length} sur ${LIMITS.photos}.`}
                    />
                    {values.images.length > 0 && (
                        <ol className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Photos de la salle, dans l’ordre d’affichage">
                            {values.images.map((url, i) => (
                                <li key={url} className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
                                    <div className="relative aspect-[4/3] w-full bg-muted">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- photo déposée (stockage du projet), aperçu seulement */}
                                        <img
                                            src={url}
                                            alt={i === 0 ? 'Photo principale de la salle' : `Photo ${i + 1} de la salle`}
                                            loading={i === 0 ? 'eager' : 'lazy'}
                                            decoding="async"
                                            className="h-full w-full object-cover"
                                        />
                                        {i === 0 && (
                                            <span className="absolute left-2 top-2 rounded-lg border border-border bg-card px-2 py-1 text-sm font-semibold text-foreground-strong shadow-sm">
                                                Photo principale
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-1 border-t border-border bg-card p-1">
                                        <span className="px-2 text-sm font-medium text-muted-foreground tabular-nums">{i + 1}</span>
                                        <div className="flex items-center">
                                            <IconButton aria-label={`Placer la photo ${i + 1} avant`} onClick={() => movePhoto(i, i - 1)} disabled={i === 0}>
                                                <ArrowLeft size={18} />
                                            </IconButton>
                                            <IconButton aria-label={`Placer la photo ${i + 1} après`} onClick={() => movePhoto(i, i + 1)} disabled={i === values.images.length - 1}>
                                                <ArrowRight size={18} />
                                            </IconButton>
                                            <IconButton aria-label={`Retirer la photo ${i + 1}`} variant="danger" onClick={() => removePhoto(i)}>
                                                <Trash2 size={18} />
                                            </IconButton>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                    <p className="sr-only" aria-live="polite">{photoNotice}</p>
                    {values.images.length < LIMITS.photos ? (
                        <ImageUpload
                            id="hall-photos-add"
                            label={values.images.length === 0 ? 'Ajouter une photo' : 'Ajouter une autre photo'}
                            folder="halls"
                            value=""
                            onChange={addPhoto}
                            required={values.images.length === 0}
                            downscale={1600}
                            hint="JPEG, PNG ou WebP, 5 Mo au plus. Une photo à la fois ; elle est enregistrée dans un format léger pour s’afficher vite."
                            error={errors.images}
                        />
                    ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {`${LIMITS.photos} photos au plus : retirez-en une pour en ajouter une autre.`}
                        </p>
                    )}
                </section>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <LinkButton href={isEdit && hall ? `/partner/halls/${encodeURIComponent(hall.id)}` : '/partner/halls'} variant="secondary" size="lg">
                        Annuler
                    </LinkButton>
                    {resubmit ? (
                        <Button type="submit" size="lg" isLoading={saving} disabled={saving} leftIcon={<Send size={18} />}>
                            Enregistrer et renvoyer en validation
                        </Button>
                    ) : isEdit ? (
                        <Button type="submit" size="lg" isLoading={saving} disabled={saving} leftIcon={<Save size={18} />}>
                            Enregistrer les modifications
                        </Button>
                    ) : (
                        <Button type="submit" variant="gradient" isLoading={saving} disabled={saving} leftIcon={<Send size={18} />}>
                            Envoyer la salle
                        </Button>
                    )}
                </div>
            </form>

            <ConfirmDialog
                isOpen={unsaved.open}
                onClose={unsaved.stay}
                onConfirm={unsaved.leave}
                title="Quitter sans enregistrer ?"
                message={draft.available
                    ? 'Vos saisies ne sont pas envoyées à Event Village. Elles restent gardées sur cet appareil : vous pourrez les reprendre en revenant sur ce formulaire.'
                    : 'Vos saisies sur la salle ne sont pas enregistrées et seront perdues.'}
                confirmLabel="Quitter sans enregistrer"
                cancelLabel="Rester sur la page"
                variant={draft.available ? 'warning' : 'danger'}
            />
        </>
    );
}
