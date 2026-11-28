'use client';

/**
 * Lot 11b — fermetures exceptionnelles d'un établissement.
 *  - Fermetures à venir (lues dans GET /api/partner/venues/[id]) ; « Retirer » : DELETE /api/partner/venues/closures/[id]
 *    (l'établissement redevient réservable ; les réservations déjà annulées le restent).
 *  - Nouvelle fermeture : un jour ou du … au …, toute la journée ou de … à … (au quart d'heure), motif envoyé aux
 *    clients → « Voir les réservations touchées » (POST …/closures?preview=1) → aperçu de la base (heure, personnes,
 *    table, prénom ; nombre et total rendu) → « Confirmer la fermeture » (POST …/closures avec expected_count = nombre de
 *    l'aperçu et expected_hash = son empreinte, contre-vérification T1 : la base n'annule que la liste montrée). Refus
 *    PREVIEW_CHANGED : la nouvelle liste est relue et réaffichée avant une nouvelle confirmation. Aucun montant calculé ici.
 */
import { useEffect, useState } from 'react';
import { ClosureOrders } from '@/components/orders/partner/closures/ClosureOrders';
import { ArrowLeft, CalendarOff, CalendarX2, CheckCircle2, Eye, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, TextInput, Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { dakarToday, dayText, fcfaText, guestsText, hmText, tableStateView } from '@/lib/tables/views';
import { ClosuresSkeleton } from './EditorSkeletons';
import { SECTION_CARD, SectionTitle } from './form-parts';
import { QUARTER_TIMES, apiCode, apiMessage, closurePeriodText, type OwnVenue } from './venue-api';
import { toneBadge } from './VenueEditView';

interface TouchedReservation {
    reservation_id: string;
    date: string;
    time: string;
    end_time: string | null;
    guests: number;
    table_number: string | null;
    booking_state: string;
    paid_amount: number | string | null;
    refund_amount: number | string | null;
    client_name: string | null;
}
interface Preview { startsAt: string; endsAt: string; reason: string; count: number; refundTotal: number; reservations: TouchedReservation[]; fingerprint: string }

type Span = 'JOUR' | 'PERIODE';
type FieldKey = 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'reason';
type Errors = Partial<Record<FieldKey, string>>;

const REASON_MAX = 200;
const START_OPTIONS = QUARTER_TIMES.map((t) => ({ value: t, label: hmText(t) }));
const END_OPTIONS = [...QUARTER_TIMES.slice(1).map((t) => ({ value: t, label: hmText(t) })), { value: '00:00', label: 'Minuit' }];

/** Champ concerné par un refus de la base (message affiché à côté). */
function fieldOfCode(code: string | null): FieldKey | null {
    if (code === 'REASON_REQUIRED') return 'reason';
    if (code === 'INVALID_TIME') return 'startTime';
    if (code === 'INVALID_DATE' || code === 'DATE_PASSED' || code === 'DATE_TOO_FAR' || code === 'CLOSURE_OVERLAP') return 'startDate';
    return null;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export function ClosuresView({ venueId }: { venueId: string }) {
    const toast = useToast();
    const url = `/api/partner/venues/${encodeURIComponent(venueId)}`;
    const editHref = `/partner/tables/edition/${encodeURIComponent(venueId)}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ venue: OwnVenue }>(url);
    const today = dakarToday();

    const [span, setSpan] = useState<Span>('JOUR');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [allDay, setAllDay] = useState(true);
    const [startTime, setStartTime] = useState('18:00');
    const [endTime, setEndTime] = useState('00:00');
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState<Errors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [changedNotice, setChangedNotice] = useState(false);
    const [busy, setBusy] = useState<'preview' | 'confirm' | null>(null);
    const [done, setDone] = useState<{ period: string; cancelled: number; refundTotal: number } | null>(null);
    const [removing, setRemoving] = useState<OwnVenue['closures'][number] | null>(null);
    const [removeBusy, setRemoveBusy] = useState(false);
    const [removeError, setRemoveError] = useState<string | null>(null);
    // Lot 12d : ?fermeture=<id> (lien de l'avis « commandes pendant la fermeture ») met cette fermeture en vue
    const [focusId, setFocusId] = useState<string | null>(null);
    useEffect(() => {
        setFocusId(new URLSearchParams(window.location.search).get('fermeture'));
    }, []);

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <ClosuresSkeleton />
                <span className="sr-only">Chargement des fermetures…</span>
            </div>
        );
    }

    if (error || !data?.venue) {
        return (
            <div className="mx-auto w-full max-w-3xl">
                <PageHeader back={{ href: '/partner/tables', label: 'Mes établissements' }} title="Fermetures exceptionnelles" />
                <ErrorState title="Fermetures indisponibles" description={error ?? 'Cet établissement n’a pas pu être chargé.'} onRetry={() => void reload()} isRetrying={refreshing} />
            </div>
        );
    }

    const venue = data.venue;

    const payload = () => ({
        start_date: startDate,
        end_date: span === 'PERIODE' ? endDate : null,
        start_time: allDay ? null : startTime,
        end_time: allDay ? null : endTime,
        reason: reason.trim(),
    });

    const validate = (): Errors => {
        const e: Errors = {};
        if (!startDate) e.startDate = span === 'JOUR' ? 'Choisissez le jour de la fermeture.' : 'Choisissez le premier jour.';
        else if (startDate < today) e.startDate = 'Une fermeture commence aujourd’hui au plus tôt.';
        if (span === 'PERIODE') {
            if (!endDate) e.endDate = 'Choisissez le dernier jour.';
            else if (startDate && endDate < startDate) e.endDate = 'Le dernier jour vient après le premier.';
        }
        if (!allDay && span === 'JOUR' && endTime !== '00:00' && endTime <= startTime) e.endTime = 'L’heure de fin vient après l’heure de début.';
        const r = reason.trim();
        if (r.length < 3) e.reason = 'Indiquez le motif (3 caractères au moins) : il est envoyé aux clients.';
        else if (r.length > REASON_MAX) e.reason = `${REASON_MAX} caractères au plus.`;
        return e;
    };

    const routeError = (err: unknown, fallback: string) => {
        const message = apiMessage(err, fallback);
        const field = fieldOfCode(apiCode(err));
        if (field) {
            setErrors({ [field]: message });
            document.getElementById(`fermeture-${field}`)?.focus();
        } else {
            setFormError(message);
        }
    };

    const askPreview = async (): Promise<Preview | null> => {
        const body = await sendJson<{ preview: Preview }>(`${url}/closures?preview=1`, 'POST', payload());
        const p = body.preview;
        return {
            ...p, count: Number(p.count) || 0, refundTotal: Number(p.refundTotal) || 0, reservations: Array.isArray(p.reservations) ? p.reservations : [],
            fingerprint: typeof p.fingerprint === 'string' ? p.fingerprint : '',
        };
    };

    const showPreview = async () => {
        if (busy) return;
        setFormError(null);
        setDone(null);
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length > 0) {
            const first = (['startDate', 'endDate', 'startTime', 'endTime', 'reason'] as FieldKey[]).find((k) => e[k]);
            if (first) document.getElementById(`fermeture-${first}`)?.focus();
            return;
        }
        setBusy('preview');
        try {
            const p = await askPreview();
            setChangedNotice(false);
            setPreview(p);
            window.setTimeout(() => document.getElementById('fermeture-apercu')?.focus(), 30);
        } catch (err) {
            routeError(err, 'Aperçu impossible pour le moment. Réessayez.');
        } finally {
            setBusy(null);
        }
    };

    const confirm = async () => {
        if (busy || !preview) return;
        setBusy('confirm');
        setFormError(null);
        try {
            const body = await sendJson<{ closure: { cancelled: number; refundTotal: number; startsAt: string; endsAt: string } }>(`${url}/closures`, 'POST', {
                ...payload(), expected_count: preview.count, ...(preview.fingerprint ? { expected_hash: preview.fingerprint } : {}),
            });
            const c = body.closure;
            setDone({ period: closurePeriodText(c.startsAt ?? preview.startsAt, c.endsAt ?? preview.endsAt), cancelled: Number(c.cancelled) || 0, refundTotal: Number(c.refundTotal) || 0 });
            toast.success('Fermeture enregistrée.');
            setPreview(null);
            setStartDate('');
            setEndDate('');
            setReason('');
            setAllDay(true);
            setErrors({});
            await reload();
            window.setTimeout(() => document.getElementById('fermeture-faite')?.focus(), 30);
        } catch (err) {
            if (apiCode(err) === 'PREVIEW_CHANGED' || apiCode(err) === 'PREVIEW_REQUIRED') {
                try {
                    const p = await askPreview();
                    setPreview(p);
                    setChangedNotice(true);
                    window.setTimeout(() => document.getElementById('fermeture-apercu')?.focus(), 30);
                } catch (again) {
                    setPreview(null);
                    routeError(again, 'Aperçu impossible pour le moment. Réessayez.');
                }
            } else {
                setFormError(apiMessage(err, 'La fermeture n’a pas été enregistrée. Réessayez.'));
            }
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        if (!removing || removeBusy) return;
        setRemoveBusy(true);
        setRemoveError(null);
        try {
            await sendJson(`/api/partner/venues/closures/${encodeURIComponent(removing.id)}`, 'DELETE');
            toast.success('Fermeture retirée : l’établissement est de nouveau réservable sur cette période.');
            setRemoving(null);
            await reload();
        } catch (err) {
            setRemoveError(apiMessage(err, 'La fermeture n’a pas été retirée. Réessayez.'));
        } finally {
            setRemoveBusy(false);
        }
    };

    const multiDay = !!preview && preview.reservations.some((r) => r.date !== preview.reservations[0]?.date);

    return (
        <div className="mx-auto w-full max-w-3xl pb-10">
            <PageHeader
                back={{ href: editHref, label: 'Retour à l’établissement' }}
                eyebrow={<Badge variant={toneBadge(venue.statusTone)}>{venue.statusLabel}</Badge>}
                title="Fermetures exceptionnelles"
                description={`${venue.name} : jour férié, travaux, soirée privée. Pendant une fermeture, personne ne peut réserver.`}
            />

            <div className="flex flex-col gap-6">
                {done && (
                    <div id="fermeture-faite" tabIndex={-1} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <StatusBanner tone="success" icon={<CheckCircle2 size={20} />} title="Fermeture enregistrée">
                            <span className="block">{done.period}.</span>
                            <span className="mt-1 block">
                                {done.cancelled > 0
                                    ? `${done.cancelled} ${plural(done.cancelled, 'réservation annulée', 'réservations annulées')} et ${done.refundTotal > 0 ? `${fcfaText(done.refundTotal)} rendus` : 'rien à rembourser'} ; chaque client a été prévenu.`
                                    : 'Aucune réservation n’était prévue sur cette période.'}
                            </span>
                        </StatusBanner>
                    </div>
                )}

                {/* Fermetures à venir */}
                <section aria-labelledby="fermetures-a-venir" className={SECTION_CARD}>
                    <SectionTitle id="fermetures-a-venir" title="Fermetures à venir" text={venue.closures.length > 0 ? undefined : 'Aucune fermeture prévue : l’établissement suit ses horaires habituels.'} />
                    {venue.closures.length > 0 && (
                        <ul className="flex flex-col gap-2">
                            {venue.closures.map((c) => (
                                <li key={c.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-background p-3 sm:items-center">
                                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-text" aria-hidden="true">
                                        <CalendarX2 size={20} />
                                    </span>
                                    <div className="min-w-0 flex-1 basis-48">
                                        <p className="text-base font-semibold text-foreground-strong">{closurePeriodText(c.startsAt, c.endsAt)}</p>
                                        {c.reason && <p className="break-words text-sm text-muted-foreground">{c.reason}</p>}
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" leftIcon={<Trash2 size={16} />} onClick={() => { setRemoveError(null); setRemoving(c); }} aria-label={`Retirer la fermeture : ${closurePeriodText(c.startsAt, c.endsAt)}`}>
                                        Retirer
                                    </Button>
                                    {/* Lot 12d : commandes déjà prévues pendant cette fermeture (rien sans service des commandes) */}
                                    <ClosureOrders closureId={c.id} closureReason={c.reason ?? null} focus={focusId === c.id} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Nouvelle fermeture */}
                {!preview ? (
                    <section aria-labelledby="fermeture-nouvelle" className={SECTION_CARD}>
                        <SectionTitle id="fermeture-nouvelle" title="Prévoir une fermeture" text="Vous verrez les réservations touchées avant de confirmer." />
                        <form noValidate onSubmit={(e) => { e.preventDefault(); void showPreview(); }} className="flex flex-col gap-5">
                            <fieldset className="flex flex-col gap-2">
                                <legend className="mb-1 text-sm font-semibold text-foreground-strong">Durée</legend>
                                <div className="grid grid-cols-2 gap-2" role="group">
                                    {([['JOUR', 'Un jour'], ['PERIODE', 'Plusieurs jours']] as const).map(([v, label]) => (
                                        <button
                                            key={v}
                                            type="button"
                                            aria-pressed={span === v}
                                            onClick={() => { setSpan(v); setErrors({}); }}
                                            className={cn(
                                                'min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-semibold transition-colors duration-fast',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                                                span === v ? 'border-primary-text bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground-strong hover:bg-muted',
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            <div className={cn('grid grid-cols-1 gap-4', span === 'PERIODE' && 'sm:grid-cols-2')}>
                                <TextInput
                                    id="fermeture-startDate"
                                    label={span === 'JOUR' ? 'Jour' : 'Du'}
                                    type="date"
                                    required
                                    min={today}
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    hint={startDate ? dayText(startDate, true) : undefined}
                                    error={errors.startDate}
                                />
                                {span === 'PERIODE' && (
                                    <TextInput
                                        id="fermeture-endDate"
                                        label="Au (inclus)"
                                        type="date"
                                        required
                                        min={startDate || today}
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        hint={endDate ? dayText(endDate, true) : undefined}
                                        error={errors.endDate}
                                    />
                                )}
                            </div>

                            <fieldset className="flex flex-col gap-3">
                                <legend className="mb-1 text-sm font-semibold text-foreground-strong">Heures</legend>
                                <div className="grid grid-cols-2 gap-2" role="group">
                                    {([[true, 'Toute la journée'], [false, 'De … à …']] as const).map(([v, label]) => (
                                        <button
                                            key={label}
                                            type="button"
                                            aria-pressed={allDay === v}
                                            onClick={() => { setAllDay(v); setErrors((e) => ({ ...e, startTime: undefined, endTime: undefined })); }}
                                            className={cn(
                                                'min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-semibold transition-colors duration-fast',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                                                allDay === v ? 'border-primary-text bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground-strong hover:bg-muted',
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {!allDay && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Select
                                            id="fermeture-startTime"
                                            label={span === 'JOUR' ? 'De' : 'Le premier jour, à partir de'}
                                            options={START_OPTIONS}
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            error={errors.startTime}
                                        />
                                        <Select
                                            id="fermeture-endTime"
                                            label={span === 'JOUR' ? 'À' : 'Le dernier jour, jusqu’à'}
                                            options={END_OPTIONS}
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            error={errors.endTime}
                                        />
                                    </div>
                                )}
                            </fieldset>

                            <Textarea
                                id="fermeture-reason"
                                label="Motif"
                                required
                                rows={3}
                                maxLength={REASON_MAX}
                                showCount
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Par exemple : fermeture pour travaux"
                                hint="Envoyé aux clients dont la réservation est annulée."
                                error={errors.reason}
                            />

                            {formError && (
                                <StatusBanner tone="danger" announce="alert" title="Aperçu impossible">
                                    <span className="block break-words">{formError}</span>
                                </StatusBanner>
                            )}

                            <div className="flex justify-end">
                                <Button type="submit" size="lg" leftIcon={<Eye size={18} />} isLoading={busy === 'preview'} disabled={busy !== null} className="w-full sm:w-auto">
                                    {busy === 'preview' ? 'Recherche des réservations…' : 'Voir les réservations touchées'}
                                </Button>
                            </div>
                        </form>
                    </section>
                ) : (
                    <section aria-labelledby="fermeture-apercu-titre" className={SECTION_CARD}>
                        <div id="fermeture-apercu" tabIndex={-1} className="flex flex-col gap-5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <SectionTitle id="fermeture-apercu-titre" title="Vérifiez avant de confirmer" />
                            <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-text" aria-hidden="true">
                                    <CalendarOff size={20} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-base font-semibold text-foreground-strong">{closurePeriodText(preview.startsAt, preview.endsAt)}</p>
                                    <p className="mt-1 break-words text-sm text-muted-foreground">{`Motif : ${preview.reason}`}</p>
                                </div>
                            </div>

                            {changedNotice && (
                                <StatusBanner tone="warning" announce="alert" title="La liste a changé depuis l’aperçu">
                                    Une réservation a été faite, payée ou annulée entre-temps. Vérifiez la nouvelle liste et le montant rendu, puis confirmez.
                                </StatusBanner>
                            )}

                            {preview.count === 0 ? (
                                <StatusBanner tone="success" title="Aucune réservation n’est touchée">
                                    Personne ne pourra réserver sur cette période.
                                </StatusBanner>
                            ) : (
                                <>
                                    <StatusBanner tone="warning" title={`${preview.count} ${plural(preview.count, 'réservation sera annulée et remboursée', 'réservations seront annulées et remboursées')} en entier`}>
                                        {preview.refundTotal > 0 ? `Total rendu : ${fcfaText(preview.refundTotal)}. ` : 'Rien à rembourser : aucune n’a été payée. '}
                                        Chaque client est prévenu, avec votre motif.
                                    </StatusBanner>
                                    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border" aria-label="Réservations touchées">
                                        {preview.reservations.map((r) => {
                                            const state = tableStateView(r.booking_state, 'partner');
                                            const refund = Number(r.refund_amount) || 0;
                                            return (
                                                <li key={r.reservation_id} className="flex flex-wrap items-start gap-x-4 gap-y-2 p-3">
                                                    <div className="w-20 flex-shrink-0">
                                                        <p className="text-base font-bold tabular-nums text-foreground-strong">{hmText(r.time)}</p>
                                                        {multiDay && <p className="text-sm text-muted-foreground">{dayText(r.date)}</p>}
                                                    </div>
                                                    <div className="min-w-0 flex-1 basis-40">
                                                        <p className="break-words text-sm font-semibold text-foreground-strong">{r.client_name?.trim() || 'Client'}</p>
                                                        <p className="inline-flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                                                            <span className="inline-flex items-center gap-1"><Users size={14} aria-hidden="true" />{guestsText(Number(r.guests) || 0)}</span>
                                                            <span aria-hidden="true">·</span>
                                                            <span>{r.table_number ? `Table ${r.table_number}` : 'Table à attribuer'}</span>
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <Badge variant={toneBadge(state.tone)} size="sm">{state.label}</Badge>
                                                        {refund > 0 && <p className="text-sm tabular-nums text-muted-foreground">{`Rendu : ${fcfaText(refund)}`}</p>}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}

                            {formError && (
                                <StatusBanner tone="danger" announce="alert" title="Fermeture non enregistrée">
                                    <span className="block break-words">{formError}</span>
                                </StatusBanner>
                            )}

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button type="button" variant="secondary" size="lg" leftIcon={<ArrowLeft size={18} />} onClick={() => { setPreview(null); setChangedNotice(false); setFormError(null); }} disabled={busy !== null}>
                                    Modifier
                                </Button>
                                <Button
                                    type="button"
                                    size="lg"
                                    variant={preview.count > 0 ? 'danger' : 'primary'}
                                    leftIcon={<CalendarOff size={18} />}
                                    isLoading={busy === 'confirm'}
                                    disabled={busy !== null}
                                    onClick={() => void confirm()}
                                >
                                    {busy === 'confirm' ? 'Enregistrement…' : 'Confirmer la fermeture'}
                                </Button>
                            </div>
                        </div>
                    </section>
                )}
            </div>

            <ConfirmDialog
                isOpen={removing !== null}
                onClose={() => { if (!removeBusy) setRemoving(null); }}
                onConfirm={() => void remove()}
                title="Retirer cette fermeture ?"
                isLoading={removeBusy}
                confirmLabel="Retirer la fermeture"
                cancelLabel="Garder"
                variant="warning"
            >
                <p className="text-sm leading-relaxed text-foreground">
                    {removing ? `${closurePeriodText(removing.startsAt, removing.endsAt)}. ` : ''}
                    L’établissement redevient réservable sur cette période. Les réservations déjà annulées le restent.
                </p>
                {removeError && <p role="alert" className="mt-2 break-words text-sm font-medium text-danger-text">{removeError}</p>}
            </ConfirmDialog>
        </div>
    );
}
