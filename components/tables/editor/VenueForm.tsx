'use client';

/**
 * Lot 11b — formulaire commun de création et de modification d'un établissement (restaurant, bar, espace).
 *  - Sections numérotées : l'établissement, adresse et position, photos, horaires, (création) zones et tables, réglages
 *    de réservation ;
 *  - réglages expliqués avec les valeurs réelles (tables.* lus en base) : délai de réponse en acceptation manuelle,
 *    frais de service payés par le client, durée du créneau par défaut ;
 *  - erreurs sous les champs et récapitulatif focalisable ; message de la route (`error`, déjà en français) affiché
 *    tel quel ; envoi protégé du double clic ; garde avant de quitter ; saisie gardée sur l'appareil (useHallDraft,
 *    lib/events/local-draft, effacée à la déconnexion), clé par compte et par établissement.
 * Envoi : création POST /api/partner/venues (fiche, photos, horaires, zones, tables en une fois, envoyée en validation) ;
 * modification PATCH /api/partner/venues/[id] (fiche, photos, horaires, réglages ; zones et tables : ZonesTablesManager) ;
 * établissement refusé : « Enregistrer et renvoyer en validation » (PATCH puis POST …/submit).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Clock, Hand, History, Save, Send, Store, Wine, Trees } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LinkButton } from '@/components/ui/LinkButton';
import { Select, TextInput, Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { fetchJson, sendJson } from '@/components/partner/fetch-json';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useHallDraft } from '@/components/halls/partner/useHallDraft';
import { formatDateTime } from '@/lib/format';
import { OTHER_CITY_VALUE, SENEGAL_CITIES, canonicalCity, cityCenter, senegalCity } from '@/lib/events/senegal-cities';
import { PLACE_SEARCH_UNAVAILABLE } from '@/lib/places/place-texts';
import type { PlaceSearchOutcome, PlaceSearchResult } from '@/components/ui/MapPicker';
import { HoursEditor, defaultWeek, parseWeek, rowsFromWeek, validateWeek, weekFromRows, type WeekHours } from './HoursEditor';
import { MAX_PHOTOS, PhotosEditor } from './PhotosEditor';
import { TablesDraftEditor, parseDraftTables, validateDraftTables, type DraftTable, type DraftZone } from './TablesDraftEditor';
import { RadioCard, SECTION_CARD, SectionTitle } from './form-parts';
import {
    SLOT_OPTIONS, VENUE_KINDS, apiMessage, delayText, durationText, rateText, wholeNumber,
    type ConfirmationMode, type OwnVenue, type VenueDefaults, type VenueKind,
} from './venue-api';

const MapPicker = dynamic(() => import('@/components/ui/MapPicker').then((m) => m.MapPicker), {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-xl bg-muted sm:h-72" aria-hidden="true" />,
});

const LIMITS = { name: 120, description: 2000, address: 300, city: 120, depositMin: 100, depositMax: 1_000_000 } as const;
const P = 'etab';
const MAP_PREFIX = 'etab-carte';
const KIND_ICON: Record<VenueKind, React.ReactNode> = { RESTAURANT: <Store size={18} />, BAR: <Wine size={18} />, ESPACE: <Trees size={18} /> };

interface VenueValues {
    kind: VenueKind;
    name: string;
    description: string;
    address: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    photos: string[];
    hours: WeekHours;
    confirmation: ConfirmationMode;
    deposit: string;
    /** '' = durée par défaut d'Event Village. */
    slot: string;
    zones: DraftZone[];
    tables: DraftTable[];
}

type FieldKey = 'name' | 'description' | 'address' | 'city' | 'position' | 'photos' | 'hours' | 'tables' | 'deposit' | 'slot';
type ErrorMap = Partial<Record<FieldKey, string>>;

const FIELD_LABELS: ReadonlyArray<[FieldKey, string]> = [
    ['name', 'Nom'],
    ['description', 'Description'],
    ['address', 'Adresse'],
    ['city', 'Ville'],
    ['position', 'Position sur la carte'],
    ['photos', 'Photos'],
    ['hours', 'Horaires'],
    ['tables', 'Zones et tables'],
    ['deposit', 'Acompte'],
    ['slot', 'Durée d’une réservation'],
];

const CITY_OPTIONS = [...SENEGAL_CITIES.map((c) => ({ value: c, label: c })), { value: OTHER_CITY_VALUE, label: 'Autre ville' }];

function initialValues(venue: OwnVenue | null | undefined): VenueValues {
    return {
        kind: venue?.kind === 'BAR' || venue?.kind === 'ESPACE' ? venue.kind : 'RESTAURANT',
        name: venue?.name ?? '',
        description: venue?.description ?? '',
        address: venue?.address ?? '',
        city: venue?.city ?? '',
        latitude: typeof venue?.latitude === 'number' ? venue.latitude : null,
        longitude: typeof venue?.longitude === 'number' ? venue.longitude : null,
        photos: Array.isArray(venue?.photos) ? venue.photos.filter((u): u is string => typeof u === 'string') : [],
        hours: venue ? weekFromRows(venue.hours ?? []) : defaultWeek(),
        confirmation: venue?.confirmation === 'MANUELLE' ? 'MANUELLE' : 'AUTO',
        deposit: venue?.depositPerPerson ? String(venue.depositPerPerson) : '',
        slot: venue?.slotMinutes ? String(venue.slotMinutes) : '',
        zones: [],
        tables: venue ? [] : [{ key: 't-depart-1', number: '1', capacity: '4', min: '', zoneKey: '' }],
    };
}

function validate(v: VenueValues, cityOther: boolean, isCreate: boolean): { errors: ErrorMap; hours: Record<string, string>; tables: Record<string, string> } {
    const errors: ErrorMap = {};
    const name = v.name.trim();
    if (!name) errors.name = 'Indiquez le nom de l’établissement.';
    else if (name.length < 2) errors.name = 'Nom trop court : 2 caractères au moins.';
    else if (name.length > LIMITS.name) errors.name = `${LIMITS.name} caractères au plus.`;
    if (v.description.length > LIMITS.description) errors.description = `${LIMITS.description} caractères au plus.`;
    if (!v.address.trim()) errors.address = 'Indiquez l’adresse : rue, quartier, point de repère.';
    else if (v.address.trim().length > LIMITS.address) errors.address = `${LIMITS.address} caractères au plus.`;
    const city = v.city.trim();
    if (!city) errors.city = cityOther ? 'Précisez la ville.' : 'Choisissez la ville.';
    else if (city.length < 2 || city.length > LIMITS.city) errors.city = 'De 2 à 120 caractères.';
    if (v.photos.length < 1) errors.photos = 'Ajoutez au moins une photo de l’établissement.';
    else if (v.photos.length > MAX_PHOTOS) errors.photos = `${MAX_PHOTOS} photos au plus.`;
    const hours = validateWeek(v.hours);
    if (Object.keys(hours).length > 0) errors.hours = hours.week ?? 'Un jour a des horaires à corriger.';
    const tables = isCreate ? validateDraftTables(v.zones, v.tables) : {};
    if (Object.keys(tables).length > 0) errors.tables = tables.tables ?? tables.zones ?? 'Une zone ou une table est à corriger.';
    if (v.deposit.trim()) {
        const n = wholeNumber(v.deposit);
        if (n === null || n < LIMITS.depositMin || n > LIMITS.depositMax) errors.deposit = 'De 100 à 1 000 000 F CFA par personne, ou laissez vide pour une réservation gratuite.';
    }
    if (v.slot && !SLOT_OPTIONS.includes(Number(v.slot))) errors.slot = 'Choisissez une durée de la liste.';
    return { errors, hours, tables };
}

function fichePayload(v: VenueValues) {
    return {
        kind: v.kind,
        name: v.name.trim(),
        description: v.description.trim() || null,
        address: v.address.trim(),
        city: canonicalCity(v.city),
        latitude: v.latitude,
        longitude: v.longitude,
        photos: v.photos,
        hours: rowsFromWeek(v.hours),
        confirmation_mode: v.confirmation,
        deposit_per_person: v.deposit.trim() ? wholeNumber(v.deposit) : null,
        slot_minutes: v.slot ? Number(v.slot) : null,
    };
}

function createPayload(v: VenueValues) {
    const usedZones = v.zones.filter((z) => z.name.trim());
    return {
        ...fichePayload(v),
        zones: usedZones.map((z) => ({ key: z.key, name: z.name.trim() })),
        tables: v.tables.map((t) => {
            const min = t.min.trim() ? wholeNumber(t.min) : null;
            return {
                number: t.number.trim(),
                capacity: wholeNumber(t.capacity),
                ...(min !== null ? { min_capacity: min } : {}),
                zone_key: t.zoneKey && usedZones.some((z) => z.key === t.zoneKey) ? t.zoneKey : null,
            };
        }),
    };
}

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

interface DraftData { values: VenueValues; cityOther: boolean }

const PHOTO_URL = /^(https?:\/\/|\/)\S*$/;

function parseDraft(raw: unknown): DraftData | null {
    const r = raw as { values?: unknown; cityOther?: unknown } | null;
    const v = r?.values && typeof r.values === 'object' ? (r.values as Record<string, unknown>) : null;
    if (!v) return null;
    const s = (x: unknown, max: number) => (typeof x === 'string' && x.length <= max ? x : null);
    const coord = (c: unknown, lim: number): number | null | undefined => (c === null ? null : typeof c === 'number' && Number.isFinite(c) && Math.abs(c) <= lim ? c : undefined);
    const kind = v.kind === 'RESTAURANT' || v.kind === 'BAR' || v.kind === 'ESPACE' ? v.kind : null;
    const confirmation = v.confirmation === 'AUTO' || v.confirmation === 'MANUELLE' ? v.confirmation : null;
    const name = s(v.name, LIMITS.name * 2);
    const description = s(v.description, LIMITS.description * 2);
    const address = s(v.address, LIMITS.address * 2);
    const city = s(v.city, LIMITS.city * 2);
    const deposit = s(v.deposit, 20);
    const slot = s(v.slot, 5);
    const latitude = coord(v.latitude, 90);
    const longitude = coord(v.longitude, 180);
    const photos = Array.isArray(v.photos) ? v.photos.filter((u): u is string => typeof u === 'string' && u.length <= 2048 && PHOTO_URL.test(u)).slice(0, MAX_PHOTOS) : null;
    const hours = parseWeek(v.hours);
    const zt = parseDraftTables({ zones: v.zones, tables: v.tables });
    if (!kind || !confirmation || name === null || description === null || address === null || city === null || deposit === null || slot === null
        || latitude === undefined || longitude === undefined || !photos || !hours || !zt) return null;
    return {
        values: { kind, name, description, address, city, latitude, longitude, photos, hours, confirmation, deposit, slot, zones: zt.zones, tables: zt.tables },
        cityOther: r?.cityOther === true,
    };
}

function domIdOf(key: FieldKey, cityOther: boolean): string {
    switch (key) {
        case 'name': return `${P}-nom`;
        case 'description': return `${P}-description`;
        case 'address': return `${P}-adresse`;
        case 'city': return cityOther ? `${P}-ville-autre` : `${P}-ville`;
        case 'position': return `${MAP_PREFIX}-latitude`;
        case 'photos': return `${P}-photos`;
        case 'hours': return `${P}-horaires`;
        case 'tables': return `${P}-tables`;
        case 'deposit': return `${P}-acompte`;
        case 'slot': return `${P}-creneau`;
    }
}

export interface VenueFormProps {
    mode: 'create' | 'edit';
    venue?: OwnVenue | null;
    defaults: VenueDefaults;
    /** Modification enregistrée (sans renvoi) : la page relit l'établissement. */
    onSaved?: () => void;
}

export function VenueForm({ mode, venue, defaults, onSaved }: VenueFormProps) {
    const router = useRouter();
    const toast = useToast();
    const { user } = useAuth();
    const isEdit = mode === 'edit' && !!venue;
    const isCreate = !isEdit;
    const resubmit = isEdit && venue?.status === 'REFUSEE';
    const [start, setStart] = useState<VenueValues>(() => initialValues(venue));
    const [values, setValues] = useState<VenueValues>(start);
    const [cityOther, setCityOther] = useState<boolean>(() => !!start.city && !senegalCity(start.city));
    const [errors, setErrors] = useState<ErrorMap>({});
    const [hoursErrors, setHoursErrors] = useState<Record<string, string>>({});
    const [tableErrors, setTableErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [resubmitError, setResubmitError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const savingRef = useRef(false);
    const summaryRef = useRef<HTMLDivElement>(null);
    const resubmitRef = useRef<HTMLDivElement>(null);

    const dirty = !leaving && JSON.stringify(values) !== JSON.stringify(start);
    const describeUnsaved = useCallback(() => ['Les informations de l’établissement'], []);
    const unsaved = useUnsavedGuard(dirty, describeUnsaved);

    const draftKey = user?.id ? `${user.id}::etablissement-${isEdit && venue ? venue.id : 'nouveau'}` : null;
    const draftValue = useMemo<DraftData>(() => ({ values, cityOther }), [values, cityOther]);
    const draftBaseline = useMemo<DraftData>(() => ({ values: start, cityOther: !!start.city && !senegalCity(start.city) }), [start]);
    const draft = useHallDraft<DraftData>({
        storageKey: draftKey,
        value: draftValue,
        baseline: draftBaseline,
        base: isEdit && venue ? venue.updatedAt : null,
        enabled: !leaving && !saving,
        parse: parseDraft,
    });
    const draftOffer = draft.offer;
    const draftStale = !!draftOffer && isEdit && !!venue && draftOffer.base !== null && draftOffer.base !== venue.updatedAt;
    const resumeDraft = () => {
        const offer = draft.resume();
        if (!offer) return;
        setValues(isEdit ? { ...offer.data.values, zones: [], tables: [] } : offer.data.values);
        setCityOther(offer.data.cityOther);
        toast.success(isEdit ? 'Changements repris.' : 'Établissement en cours repris.');
    };

    useEffect(() => {
        if (!submitted) return;
        const r = validate(values, cityOther, isCreate);
        setErrors(r.errors);
        setHoursErrors(r.hours);
        setTableErrors(r.tables);
    }, [values, cityOther, submitted, isCreate]);

    const set = <K extends keyof VenueValues>(key: K, value: VenueValues[K]) => setValues((v) => ({ ...v, [key]: value }));

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
        const r = validate(values, cityOther, isCreate);
        setErrors(r.errors);
        setHoursErrors(r.hours);
        setTableErrors(r.tables);
        setFormError(null);
        if (Object.keys(r.errors).length > 0) {
            focusSummary();
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setResubmitError(null);
        try {
            if (isEdit && venue) {
                const url = `/api/partner/venues/${encodeURIComponent(venue.id)}`;
                await sendJson<{ success: boolean }>(url, 'PATCH', fichePayload(values));
                draft.clear();
                setStart(values);
                if (resubmit) {
                    try {
                        await sendJson(`${url}/submit`, 'POST');
                    } catch (err) {
                        setResubmitError(apiMessage(err, 'Envoi impossible pour le moment. Réessayez.'));
                        toast.success('Modifications enregistrées.');
                        window.setTimeout(() => {
                            resubmitRef.current?.focus();
                            resubmitRef.current?.scrollIntoView({ block: 'start' });
                        }, 30);
                        savingRef.current = false;
                        setSaving(false);
                        onSaved?.();
                        return;
                    }
                    setLeaving(true);
                    toast.success('Établissement renvoyé en validation.');
                    router.push(`/partner/tables/${encodeURIComponent(venue.id)}?enregistre=renvoye`);
                    return;
                }
                toast.success('Modifications enregistrées.');
                savingRef.current = false;
                setSaving(false);
                onSaved?.();
            } else {
                const body = await fetchJson<{ success: boolean; venue?: { id?: string } }>('/api/partner/venues', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createPayload(values)),
                });
                draft.clear();
                setLeaving(true);
                toast.success('Établissement envoyé : il sera vérifié avant d’être visible.');
                const id = typeof body.venue?.id === 'string' ? body.venue.id : null;
                router.push(id ? `/partner/tables/${encodeURIComponent(id)}?enregistre=cree` : '/partner/tables');
            }
        } catch (err) {
            setFormError(apiMessage(err, isEdit ? 'Les modifications n’ont pas été enregistrées. Réessayez.' : 'L’établissement n’a pas été enregistré. Réessayez.'));
            focusSummary();
            savingRef.current = false;
            setSaving(false);
        }
    };

    const citySelectValue = cityOther ? OTHER_CITY_VALUE : senegalCity(values.city) ?? (values.city ? OTHER_CITY_VALUE : '');
    const draftWhen = draftOffer?.savedAt ? formatDateTime(draftOffer.savedAt) : null;
    const draftName = draftOffer?.data.values.name.trim() ?? '';
    const validated = isEdit && venue?.status === 'VALIDEE';
    const slotDefaultLabel = defaults.slotMinutes ? `Durée habituelle d’Event Village : ${durationText(defaults.slotMinutes)}` : 'Durée habituelle d’Event Village';
    const slotOptions = [{ value: '', label: slotDefaultLabel }, ...SLOT_OPTIONS.map((m) => ({ value: String(m), label: durationText(m) }))];
    const backHref = isEdit && venue ? `/partner/tables/${encodeURIComponent(venue.id)}` : '/partner/tables';

    return (
        <>
            <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6" aria-busy={saving}>
                {draftOffer && (
                    <StatusBanner
                        tone="info"
                        icon={<History size={20} />}
                        title={isEdit ? 'Reprendre vos changements non enregistrés' : 'Reprendre mon établissement en cours'}
                        action={(
                            <>
                                <Button type="button" size="sm" onClick={resumeDraft}>{isEdit ? 'Reprendre les changements' : 'Reprendre'}</Button>
                                <Button type="button" variant="secondary" size="sm" onClick={draft.discard}>{isEdit ? 'Ignorer' : 'Recommencer'}</Button>
                            </>
                        )}
                    >
                        <span className="block">
                            {isEdit
                                ? `Des changements faits sur cet appareil${draftWhen ? ` le ${draftWhen}` : ''} n’ont pas été enregistrés.`
                                : `Vous aviez commencé ${draftName ? `« ${draftName} »` : 'un établissement'} sur cet appareil${draftWhen ? ` le ${draftWhen}` : ''}. Les photos déjà déposées sont gardées.`}
                        </span>
                        {draftStale && <span className="mt-1 block font-semibold">L’établissement a été modifié depuis : vérifiez chaque champ avant d’enregistrer.</span>}
                    </StatusBanner>
                )}

                {resubmitError && (
                    <div ref={resubmitRef} tabIndex={-1} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <StatusBanner tone="warning" announce="alert" title="Modifications enregistrées, mais l’établissement n’a pas été renvoyé en validation">
                            <span className="block break-words">{resubmitError}</span>
                            <span className="mt-1 block">Complétez ce qui est demandé, puis touchez de nouveau « Enregistrer et renvoyer en validation ».</span>
                        </StatusBanner>
                    </div>
                )}

                {validated ? (
                    <StatusBanner tone="info" title="Cet établissement est validé : il reste visible pendant vos modifications.">
                        Les réservations déjà faites gardent leur heure, leur table et leurs montants.
                    </StatusBanner>
                ) : isCreate ? (
                    <StatusBanner tone="info" title="L’établissement sera vérifié par l’équipe d’Event Village avant d’être visible.">
                        Vous recevrez un message dès qu’il aura été examiné. Votre saisie est gardée sur cet appareil si vous quittez la page.
                    </StatusBanner>
                ) : null}

                {showSummary && (
                    <div
                        ref={summaryRef}
                        tabIndex={-1}
                        role="alert"
                        aria-labelledby={`${P}-erreurs-titre`}
                        className="rounded-xl border border-danger-border bg-danger-soft p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <p id={`${P}-erreurs-titre`} className="text-base font-semibold text-danger-text">
                            {errorEntries.length > 1
                                ? `Le formulaire contient ${errorEntries.length} points à corriger`
                                : errorEntries.length === 1 ? 'Le formulaire contient un point à corriger' : 'Enregistrement impossible'}
                        </p>
                        {formError && <p className="mt-1 break-words text-sm leading-relaxed text-foreground-strong">{formError}</p>}
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

                {/* 1. L'établissement */}
                <section aria-labelledby={`${P}-s1`} className={SECTION_CARD}>
                    <SectionTitle n={1} id={`${P}-s1`} title="L’établissement" text="Ce que les clients voient en premier." />
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 text-sm font-semibold text-foreground-strong">Genre</legend>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {VENUE_KINDS.map((k) => (
                                <RadioCard
                                    key={k.value}
                                    name={`${P}-genre`}
                                    id={`${P}-genre-${k.value.toLowerCase()}`}
                                    value={k.value}
                                    checked={values.kind === k.value}
                                    onChange={() => set('kind', k.value)}
                                    title={k.label}
                                    text={k.text}
                                    icon={KIND_ICON[k.value]}
                                />
                            ))}
                        </div>
                    </fieldset>
                    <TextInput
                        id={`${P}-nom`}
                        label="Nom"
                        required
                        maxLength={LIMITS.name}
                        value={values.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="Par exemple : Le Lagon 1"
                        error={errors.name}
                        autoComplete="off"
                    />
                    <Textarea
                        id={`${P}-description`}
                        label="Description"
                        rows={4}
                        maxLength={LIMITS.description}
                        showCount
                        value={values.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="Cuisine, ambiance, musique, tenue, ce qui vous rend unique…"
                        error={errors.description}
                    />
                </section>

                {/* 2. Adresse et position */}
                <section aria-labelledby={`${P}-s2`} className={SECTION_CARD}>
                    <SectionTitle n={2} id={`${P}-s2`} title="Adresse et position" text="Pour que les clients vous trouvent." />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInput
                            id={`${P}-adresse`}
                            label="Adresse"
                            required
                            maxLength={LIMITS.address}
                            value={values.address}
                            onChange={(e) => set('address', e.target.value)}
                            placeholder="Rue, quartier, point de repère"
                            error={errors.address}
                            autoComplete="street-address"
                            fieldClassName="sm:col-span-2"
                        />
                        <Select
                            id={`${P}-ville`}
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
                                id={`${P}-ville-autre`}
                                label="Précisez la ville"
                                required
                                maxLength={LIMITS.city}
                                value={values.city}
                                onChange={(e) => set('city', e.target.value)}
                                error={errors.city}
                            />
                        )}
                    </div>
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 text-sm font-semibold text-foreground-strong">
                            Position sur la carte <span className="font-normal text-muted-foreground">(conseillée)</span>
                        </legend>
                        <p className="text-sm text-muted-foreground">Placez le repère sur l’entrée : la carte s’affiche sur votre fiche.</p>
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

                {/* 3. Photos */}
                <section aria-labelledby={`${P}-s3`} className={SECTION_CARD}>
                    <SectionTitle
                        n={3}
                        id={`${P}-s3`}
                        title="Photos"
                        text={`De 1 à ${MAX_PHOTOS} photos. La première est la couverture, montrée dans la recherche. Photos : ${values.photos.length} sur ${MAX_PHOTOS}.`}
                    />
                    <PhotosEditor id={`${P}-photos`} photos={values.photos} onChange={(p) => set('photos', p)} error={errors.photos} />
                </section>

                {/* 4. Horaires */}
                <section aria-labelledby={`${P}-s4`} className={SECTION_CARD}>
                    <SectionTitle
                        n={4}
                        id={`${P}-s4`}
                        title="Horaires"
                        text="Jour par jour, jusqu’à 4 plages. Une plage peut finir après minuit : le client réserve jusqu’à la fermeture moins la durée d’une réservation."
                    />
                    <div id={`${P}-horaires`} tabIndex={-1} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <HoursEditor idPrefix={`${P}-h`} week={values.hours} onChange={(w) => set('hours', w)} errors={hoursErrors} />
                    </div>
                </section>

                {/* 5. Zones et tables (création) */}
                {isCreate && (
                    <section aria-labelledby={`${P}-s5`} className={SECTION_CARD}>
                        <SectionTitle n={5} id={`${P}-s5`} title="Zones et tables" text="Les tables que vos clients peuvent réserver, avec leur nombre de places." />
                        <div id={`${P}-tables`} tabIndex={-1} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <TablesDraftEditor
                                idPrefix={`${P}-zt`}
                                zones={values.zones}
                                tables={values.tables}
                                onChange={(zones, tables) => setValues((v) => ({ ...v, zones, tables }))}
                                errors={tableErrors}
                            />
                        </div>
                    </section>
                )}

                {/* Réglages */}
                <section aria-labelledby={`${P}-s6`} className={SECTION_CARD}>
                    <SectionTitle n={isCreate ? 6 : 5} id={`${P}-s6`} title="Réglages des réservations" text="Comment une demande devient une table gardée." />
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 text-sm font-semibold text-foreground-strong">Confirmation</legend>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <RadioCard
                                name={`${P}-confirmation`}
                                id={`${P}-confirmation-auto`}
                                value="AUTO"
                                checked={values.confirmation === 'AUTO'}
                                onChange={() => set('confirmation', 'AUTO')}
                                title="Confirmation immédiate"
                                icon={<CalendarCheck size={18} />}
                                text="La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté."
                            />
                            <RadioCard
                                name={`${P}-confirmation`}
                                id={`${P}-confirmation-manuelle`}
                                value="MANUELLE"
                                checked={values.confirmation === 'MANUELLE'}
                                onChange={() => set('confirmation', 'MANUELLE')}
                                title="J’accepte chaque demande"
                                icon={<Hand size={18} />}
                                text={defaults.responseMinutes
                                    ? `Vous avez ${delayText(defaults.responseMinutes)} pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client.`
                                    : 'Vous répondez à chaque demande dans le délai fixé par Event Village. Sans réponse, elle est annulée et l’acompte rendu au client.'}
                            />
                        </div>
                    </fieldset>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInput
                            id={`${P}-acompte`}
                            label="Acompte par personne (F CFA)"
                            inputMode="numeric"
                            value={values.deposit}
                            onChange={(e) => set('deposit', e.target.value)}
                            placeholder="Vide = réservation gratuite"
                            hint={defaults.serviceFeeRate !== null
                                ? `Facultatif, de 100 à 1 000 000 F CFA. Des frais de service de ${rateText(defaults.serviceFeeRate)} sont payés par le client en plus.`
                                : 'Facultatif, de 100 à 1 000 000 F CFA. Des frais de service sont payés par le client en plus.'}
                            error={errors.deposit}
                            autoComplete="off"
                        />
                        <Select
                            id={`${P}-creneau`}
                            label="Durée d’une réservation"
                            options={slotOptions}
                            value={values.slot}
                            onChange={(e) => set('slot', e.target.value)}
                            hint="Le temps pendant lequel la table est gardée pour un groupe."
                            error={errors.slot}
                        />
                    </div>
                    <p className="inline-flex items-start gap-2 rounded-xl bg-background p-3 text-sm leading-relaxed text-muted-foreground">
                        <Clock size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
                        <span>
                            {values.deposit.trim()
                                ? `Avec un acompte, le client paie en réservant pour garder la table.${defaults.cancelFreeHours !== null ? ` Il est remboursé s’il annule au moins ${defaults.cancelFreeHours} h avant.` : ''}`
                                : 'Sans acompte, la réservation est gratuite pour le client.'}
                            {defaults.noShowMinutes ? ` Un client en retard de plus de ${delayText(defaults.noShowMinutes)} peut être noté absent : la table est libérée.` : ''}
                        </span>
                    </p>
                </section>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <LinkButton href={backHref} variant="secondary" size="lg">Annuler</LinkButton>
                    {resubmit ? (
                        <Button type="submit" size="lg" isLoading={saving} disabled={saving} leftIcon={<Send size={18} />}>
                            {saving ? 'Envoi en cours…' : 'Enregistrer et renvoyer en validation'}
                        </Button>
                    ) : isEdit ? (
                        <Button type="submit" size="lg" isLoading={saving} disabled={saving || !dirty} leftIcon={<Save size={18} />}>
                            {saving ? 'Enregistrement…' : dirty ? 'Enregistrer les modifications' : 'Aucune modification'}
                        </Button>
                    ) : (
                        <Button type="submit" variant="gradient" isLoading={saving} disabled={saving} leftIcon={<Send size={18} />}>
                            {saving ? 'Envoi en cours…' : 'Envoyer en validation'}
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
                    : 'Vos saisies ne sont pas enregistrées et seront perdues.'}
                confirmLabel="Quitter sans enregistrer"
                cancelLabel="Rester sur la page"
                variant={draft.available ? 'warning' : 'danger'}
            />
        </>
    );
}
