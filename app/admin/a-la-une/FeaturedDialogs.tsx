'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarClock, Search, Sparkles, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TextInput, Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { useIdentityConfirm } from '@/components/admin/IdentityConfirm';
import { formatDateTime, formatEventDateTime, toDakarDateTimeLocal } from '@/lib/format';
import type { FeaturedAdminItem, FeaturedCandidate } from '@/lib/events/featured.server';
import { dakarLocalToIso, featuredLabelText } from './featured-labels';

const REASON_MIN = 3;
const REASON_MAX = 500;

/** Aperçu de l'étiquette vue par les visiteurs sur la carte de l'événement. */
export function FeaturedLabelPreview({ label = 'A_LA_UNE' }: { label?: string }) {
    return (
        <Badge variant="brand" icon={<Sparkles size={12} aria-hidden="true" />}>{featuredLabelText(label)}</Badge>
    );
}

/** Champs des dates d'affichage (heure de Dakar), bornés par la fin de l'événement. */
function WindowFields({ start, end, onStart, onEnd, max, error }: {
    start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void; max?: string; error?: string;
}) {
    const min = toDakarDateTimeLocal(new Date());
    return (
        <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground-strong">Dates d’affichage (heure de Dakar, facultatives)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label="Début" type="datetime-local" value={start} onChange={(e) => onStart(e.target.value)} max={max}
                    hint="Vide : dès maintenant." />
                <TextInput label="Fin" type="datetime-local" value={end} onChange={(e) => onEnd(e.target.value)} min={min} max={max}
                    hint="Vide : jusqu’à la fin de l’événement." error={error} />
            </div>
        </fieldset>
    );
}

/** Contrôle local des dates (le serveur revérifie) : message, ou null. */
function windowProblem(start: string, end: string, eventEnd: string | null): string | null {
    const s = dakarLocalToIso(start);
    const e = dakarLocalToIso(end);
    if (s === undefined || e === undefined) return 'Date illisible : choisissez-la dans le calendrier.';
    if (e && Date.parse(e) <= Date.now()) return 'La fin d’affichage est déjà passée.';
    if (s && e && Date.parse(e) <= Date.parse(s)) return 'La fin d’affichage doit venir après le début.';
    if (eventEnd && ((e && Date.parse(e) > Date.parse(eventEnd)) || (s && Date.parse(s) >= Date.parse(eventEnd)))) {
        return 'L’affichage s’arrête au plus tard à la fin de l’événement.';
    }
    return null;
}

function ReasonField({ value, onChange, touched, onBlur, hint }: {
    value: string; onChange: (v: string) => void; touched: boolean; onBlur: () => void; hint: string;
}) {
    const short = value.trim().length < REASON_MIN;
    return (
        <Textarea
            label="Motif (obligatoire)"
            hint={hint}
            required
            rows={3}
            minLength={REASON_MIN}
            maxLength={REASON_MAX}
            showCount
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            error={touched && short ? `Le motif doit contenir au moins ${REASON_MIN} caractères.` : undefined}
        />
    );
}

// ── Ajouter un événement ─────────────────────────────────────────────────────────────────────────────────────────

export function AddFeaturedDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
    const listId = useId();
    const toast = useToast();
    const { run, dialog } = useIdentityConfirm();
    const [q, setQ] = useState('');
    const [results, setResults] = useState<FeaturedCandidate[] | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selected, setSelected] = useState<FeaturedCandidate | null>(null);
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const seq = useRef(0);

    useEffect(() => {
        const mine = ++seq.current;
        const timer = window.setTimeout(() => {
            setSearchError(null);
            fetchJson<{ events: FeaturedCandidate[] }>(`/api/admin/a-la-une/evenements?q=${encodeURIComponent(q.trim())}`)
                .then((r) => { if (seq.current === mine) setResults(r.events); })
                .catch((err: unknown) => { if (seq.current === mine) setSearchError(errorMessage(err, 'La recherche n’a pas abouti. Réessayez.')); });
        }, q ? 300 : 0);
        return () => window.clearTimeout(timer);
    }, [q]);

    const problem = selected ? windowProblem(start, end, selected.event_end_at) : null;
    const reasonOk = reason.trim().length >= REASON_MIN;

    const submit = async () => {
        setTouched(true);
        if (!selected || !reasonOk || problem || busy) return;
        setBusy(true);
        setError(null);
        try {
            const reply = await run(() => sendJson<{ ok?: boolean; id?: string }>('/api/admin/a-la-une', 'POST', {
                event_id: selected.id, starts_at: dakarLocalToIso(start) ?? null, ends_at: dakarLocalToIso(end) ?? null, reason: reason.trim(),
            }));
            if (reply === null) return;
            if (reply.ok === true && reply.id) {
                toast.success(`« ${selected.title} » est à la une.`);
                onAdded();
                return;
            }
            setError('Le serveur n’a pas confirmé l’ajout : relisez la liste avant de recommencer.');
        } catch (err) {
            setError(errorMessage(err, 'L’événement n’a pas pu être ajouté. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Modal
                isOpen
                onClose={() => { if (!busy) onClose(); }}
                title="Mettre un événement à la une"
                subtitle="Seuls les événements publiés et pas encore terminés sont proposés."
                icon={<Sparkles size={20} />}
                maxWidth="lg"
                busy={busy}
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1 sm:flex-none">Annuler</Button>
                        <Button variant="primary" onClick={() => void submit()} isLoading={busy} disabled={!selected || busy} className="flex-1 sm:flex-none">
                            Mettre à la une
                        </Button>
                    </>
                }
            >
                <form className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                    {error && <StatusBanner tone="danger" announce="alert" title="Rien n’a changé">{error}</StatusBanner>}
                    <div className="space-y-3">
                        <TextInput
                            label="Rechercher un événement"
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Titre ou ville"
                            maxLength={100}
                            autoComplete="off"
                            aria-controls={listId}
                        />
                        <div id={listId} role="radiogroup" aria-label="Événements proposés" aria-busy={results === null}
                            className="max-h-72 space-y-2 overflow-y-auto overscroll-contain">
                            {searchError ? (
                                <StatusBanner tone="danger" title="Recherche impossible">{searchError}</StatusBanner>
                            ) : results === null ? (
                                <>
                                    <Skeleton className="h-16 rounded-xl" />
                                    <Skeleton className="h-16 rounded-xl" />
                                </>
                            ) : results.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                    {q.trim() ? 'Aucun événement publié à venir ne correspond.' : 'Aucun événement publié à venir à proposer.'}
                                </p>
                            ) : results.map((ev) => {
                                const checked = selected?.id === ev.id;
                                return (
                                    <label key={ev.id}
                                        className={cn('ev-press flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-fast',
                                            checked ? 'border-primary bg-primary-soft' : 'border-border bg-card hover:bg-muted')}>
                                        <input type="radio" name={`${listId}-event`} value={ev.id} checked={checked} onChange={() => setSelected(ev)}
                                            className="mt-1 h-5 w-5 flex-shrink-0 accent-primary" />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-foreground-strong">{ev.title}</span>
                                            <span className="block text-sm text-muted-foreground">
                                                {formatEventDateTime(ev.start_date, ev.start_time)}{ev.city ? ` · ${ev.city}` : ''}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        {touched && !selected && <p role="alert" className="text-sm font-medium text-danger-text">Choisissez un événement dans la liste.</p>}
                    </div>

                    {selected && (
                        <WindowFields start={start} end={end} onStart={setStart} onEnd={setEnd}
                            max={toDakarDateTimeLocal(selected.event_end_at)} error={problem ?? undefined} />
                    )}
                    <ReasonField value={reason} onChange={setReason} touched={touched} onBlur={() => setTouched(true)}
                        hint="Pourquoi cet événement ? 3 caractères au moins. Le motif reste dans le journal, jamais sur l’accueil." />
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                        <span>Étiquette vue par les visiteurs :</span>
                        <FeaturedLabelPreview />
                    </div>
                    <p className="text-sm text-muted-foreground">Votre mot de passe et le code administrateur reçu par SMS peuvent vous être demandés.</p>
                </form>
            </Modal>
            {dialog}
        </>
    );
}

// ── Modifier les dates ───────────────────────────────────────────────────────────────────────────────────────────

export function WindowDialog({ item, onClose, onSaved }: { item: FeaturedAdminItem; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const { run, dialog } = useIdentityConfirm();
    const [start, setStart] = useState(item.starts_at ? toDakarDateTimeLocal(item.starts_at) : '');
    const [end, setEnd] = useState(item.ends_at ? toDakarDateTimeLocal(item.ends_at) : '');
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const problem = windowProblem(start, end, item.event_end_at);
    const reasonOk = reason.trim().length >= REASON_MIN;

    const submit = async () => {
        setTouched(true);
        if (!reasonOk || problem || busy) return;
        setBusy(true);
        setError(null);
        try {
            const reply = await run(() => sendJson<{ ok?: boolean }>(`/api/admin/a-la-une/${item.id}`, 'PATCH', {
                starts_at: dakarLocalToIso(start) ?? null, ends_at: dakarLocalToIso(end) ?? null, reason: reason.trim(),
            }));
            if (reply === null) return;
            if (reply.ok === true) {
                toast.success(`Dates d’affichage enregistrées pour « ${item.title} ».`);
                onSaved();
                return;
            }
            setError('Le serveur n’a pas confirmé les dates : relisez la liste avant de recommencer.');
        } catch (err) {
            setError(errorMessage(err, 'Les dates n’ont pas pu être enregistrées. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Modal
                isOpen
                onClose={() => { if (!busy) onClose(); }}
                title="Dates d’affichage"
                subtitle={`${item.title} · fin de l’événement : ${formatDateTime(item.event_end_at)}`}
                icon={<CalendarClock size={20} />}
                maxWidth="md"
                busy={busy}
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1 sm:flex-none">Annuler</Button>
                        <Button variant="primary" onClick={() => void submit()} isLoading={busy} className="flex-1 sm:flex-none">Enregistrer les dates</Button>
                    </>
                }
            >
                <form className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                    {error && <StatusBanner tone="danger" announce="alert" title="Rien n’a changé">{error}</StatusBanner>}
                    <WindowFields start={start} end={end} onStart={setStart} onEnd={setEnd}
                        max={toDakarDateTimeLocal(item.event_end_at)} error={problem ?? undefined} />
                    <ReasonField value={reason} onChange={setReason} touched={touched} onBlur={() => setTouched(true)}
                        hint="Pourquoi ces dates ? 3 caractères au moins. Le motif reste dans le journal." />
                </form>
            </Modal>
            {dialog}
        </>
    );
}

// ── Retirer ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function RemoveDialog({ item, onClose, onRemoved }: { item: FeaturedAdminItem; onClose: () => void; onRemoved: () => void }) {
    const toast = useToast();
    const { run, dialog } = useIdentityConfirm();
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reasonOk = reason.trim().length >= REASON_MIN;

    const submit = async () => {
        setTouched(true);
        if (!reasonOk || busy) return;
        setBusy(true);
        setError(null);
        try {
            const reply = await run(() => sendJson<{ ok?: boolean }>(`/api/admin/a-la-une/${item.id}`, 'DELETE', { reason: reason.trim() }));
            if (reply === null) return;
            if (reply.ok === true) {
                toast.success(`« ${item.title} » n’est plus à la une.`);
                onRemoved();
                return;
            }
            setError('Le serveur n’a pas confirmé le retrait : relisez la liste avant de recommencer.');
        } catch (err) {
            setError(errorMessage(err, 'L’événement n’a pas pu être retiré. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Modal
                isOpen
                role="alertdialog"
                onClose={() => { if (!busy) onClose(); }}
                title="Retirer de la une ?"
                subtitle={item.title}
                icon={<Trash2 size={20} />}
                maxWidth="md"
                busy={busy}
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1 sm:flex-none">Garder</Button>
                        <Button variant="danger" onClick={() => void submit()} isLoading={busy} className="flex-1 sm:flex-none">Retirer de la une</Button>
                    </>
                }
            >
                <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                    {error && <StatusBanner tone="danger" announce="alert" title="Rien n’a changé">{error}</StatusBanner>}
                    <StatusBanner tone="info" title="Qui est prévenu ?">
                        Personne : l’événement quitte seulement la une de l’accueil. Il reste en vente, et l’organisatrice n’est pas avertie.
                    </StatusBanner>
                    <ReasonField value={reason} onChange={setReason} touched={touched} onBlur={() => setTouched(true)}
                        hint="Pourquoi le retirer ? 3 caractères au moins. Le motif reste dans le journal." />
                </form>
            </Modal>
            {dialog}
        </>
    );
}
