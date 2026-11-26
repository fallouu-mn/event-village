'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextInput, Textarea } from '@/components/ui/Field';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { formatFcfa } from '@/lib/format';
import type { TableTypeRow } from './types';

/**
 * Lot 11c-c — création ou modification d'un type de table (« Carré VIP, 6 places, 150 000 F »). Tout est contrôlé par la
 * base (places 2 à 20, prix entier, jauge en places, nom unique, garde de la billetterie) ; son refus s'affiche tel quel,
 * sous le champ qu'il nomme ou en tête de la fenêtre. « Soit … F par personne » vient du serveur : réponse enregistrée
 * pour un type existant, sinon l'aperçu GET …/tables/price pendant la saisie (calcul du serveur, rien en base).
 * Prix et places figés après la première vente ou attente : champs verrouillés, avec la raison écrite.
 */

interface Draft { name: string; seats: string; price: string; included: string; onsite: string; count: string }

const LIMITS = { name: 60, included: 1000, onsite: 500 } as const;

function draftOf(t: TableTypeRow | null): Draft {
    if (!t) return { name: '', seats: '6', price: '', included: '', onsite: '', count: '4' };
    return { name: t.name, seats: String(t.seats), price: String(t.price), included: t.included_text ?? '', onsite: t.onsite_note ?? '', count: String(t.total_tables) };
}

const FIELD_OF: Record<string, keyof Draft> = { name: 'name', seats: 'seats', seats_per_unit: 'seats', price: 'price', included_text: 'included', onsite_note: 'onsite', count: 'count', total_quantity: 'count' };

export interface TableTypeDialogProps {
    eventId: string;
    open: boolean;
    /** Type modifié (null : création). */
    type: TableTypeRow | null;
    onClose: () => void;
    onSaved: (message: string) => void;
}

export function TableTypeDialog({ eventId, open, type, onClose, onSaved }: TableTypeDialogProps) {
    const [draft, setDraft] = useState<Draft>(() => draftOf(type));
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Draft, string>>>({});
    const [preview, setPreview] = useState<{ per: number; exact: boolean } | null>(null);
    const seq = useRef(0);
    const locked = type?.locked === true;

    useEffect(() => {
        if (!open) return;
        setDraft(draftOf(type));
        setFormError(null);
        setFieldErrors({});
        setPreview(type ? { per: type.price_per_person, exact: type.price_per_person_exact } : null);
    }, [open, type]);

    // Aperçu du prix par personne (serveur), 300 ms après la dernière frappe
    useEffect(() => {
        if (!open) return;
        if (type && draft.price === String(type.price) && draft.seats === String(type.seats)) {
            setPreview({ per: type.price_per_person, exact: type.price_per_person_exact });
            return;
        }
        if (!/^\d{1,9}$/.test(draft.price.trim()) || !/^\d{1,2}$/.test(draft.seats.trim())) {
            setPreview(null);
            return;
        }
        const mine = ++seq.current;
        const timer = window.setTimeout(() => {
            fetchJson<{ price_per_person: number; price_per_person_exact: boolean }>(
                `/api/partner/events/${eventId}/tables/price?price=${encodeURIComponent(draft.price.trim())}&seats=${encodeURIComponent(draft.seats.trim())}`,
            )
                .then((r) => { if (mine === seq.current) setPreview({ per: r.price_per_person, exact: r.price_per_person_exact }); })
                .catch((err: unknown) => {
                    if (mine !== seq.current) return;
                    setPreview(null);
                    if (!(err instanceof ApiError && err.status === 400)) console.warn('[tables] aperçu du prix par personne :', err);
                });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [open, type, draft.price, draft.seats, eventId]);

    const set = (key: keyof Draft, value: string) => {
        setDraft((d) => ({ ...d, [key]: value }));
        setFieldErrors((e) => ({ ...e, [key]: undefined }));
    };

    const submit = async () => {
        setBusy(true);
        setFormError(null);
        setFieldErrors({});
        const body: Record<string, unknown> = {
            name: draft.name.trim(),
            included_text: draft.included.trim() || null,
            onsite_note: draft.onsite.trim() || null,
        };
        if (!locked) {
            body.seats = Number(draft.seats);
            body.price = Number(draft.price);
        }
        try {
            if (type) {
                await sendJson(`/api/partner/events/${eventId}/tables/types/${type.id}`, 'PATCH', body);
                onSaved(`Type « ${draft.name.trim()} » enregistré.`);
            } else {
                await sendJson(`/api/partner/events/${eventId}/tables/types`, 'POST', { type: { ...body, payment_mode: 'FULL' }, count: Number(draft.count) });
                onSaved(`Type « ${draft.name.trim()} » ajouté avec ses tables.`);
            }
        } catch (err) {
            const message = errorMessage(err, 'Enregistrement impossible pour le moment.');
            const field = err instanceof ApiError && typeof err.body?.field === 'string' ? FIELD_OF[err.body.field] : undefined;
            if (field) setFieldErrors({ [field]: message });
            else setFormError(message);
        } finally {
            setBusy(false);
        }
    };

    const lockReason = 'Figé : une table de ce type est vendue ou en cours de paiement. Le client a payé ce qu’il a vu.';

    return (
        <Modal
            isOpen={open}
            onClose={() => { if (!busy) onClose(); }}
            title={type ? 'Modifier le type de table' : 'Nouveau type de table'}
            subtitle={type ? type.name : 'Le prix est celui de toute la table, payé en entier.'}
            maxWidth="lg"
            busy={busy}
            sheetOnMobile
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1 sm:flex-none">Annuler</Button>
                    <Button variant="primary" onClick={() => void submit()} isLoading={busy} className="flex-1 sm:flex-none">
                        {type ? 'Enregistrer' : 'Ajouter le type'}
                    </Button>
                </>
            }
        >
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => { e.preventDefault(); void submit(); }}
                noValidate
            >
                {formError && (
                    <p role="alert" className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm font-medium text-danger-text">{formError}</p>
                )}
                <TextInput id="tt-name" label="Nom du type" required maxLength={LIMITS.name} value={draft.name}
                    onChange={(e) => set('name', e.target.value)} placeholder="Carré VIP, Table d’honneur…" error={fieldErrors.name} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextInput id="tt-seats" type="number" inputMode="numeric" min={2} max={20} label="Places par table" required
                        value={draft.seats} onChange={(e) => set('seats', e.target.value)} disabled={locked}
                        hint={locked ? undefined : 'De 2 à 20 : un billet par invité.'} error={fieldErrors.seats}
                        aside={locked ? <Lock size={16} aria-label="Figé" className="text-muted-foreground" /> : undefined} />
                    <TextInput id="tt-price" type="number" inputMode="numeric" min={1} label="Prix de la table (F CFA)" required
                        value={draft.price} onChange={(e) => set('price', e.target.value)} disabled={locked} error={fieldErrors.price}
                        aside={locked ? <Lock size={16} aria-label="Figé" className="text-muted-foreground" /> : undefined}
                        hint={preview ? `Soit ${formatFcfa(preview.per)} par personne${preview.exact ? '' : ' (arrondi)'}.` : 'Le prix de toute la table.'} />
                </div>
                {locked && <p className="text-sm text-muted-foreground">{lockReason}</p>}
                {!type && (
                    <TextInput id="tt-count" type="number" inputMode="numeric" min={1} max={200} label="Nombre de tables" required
                        value={draft.count} onChange={(e) => set('count', e.target.value)} error={fieldErrors.count}
                        hint="Numérotées à la suite des tables existantes ; vous les renumérotez ensuite." />
                )}
                <Textarea id="tt-included" label="Ce qui est compris" rows={3} maxLength={LIMITS.included} showCount value={draft.included}
                    onChange={(e) => set('included', e.target.value)} placeholder="Une bouteille, un plateau de fruits…" error={fieldErrors.included}
                    hint="Facultatif. Affiché aux clients tel quel." />
                <TextInput id="tt-onsite" label="Minimum sur place" maxLength={LIMITS.onsite} value={draft.onsite}
                    onChange={(e) => set('onsite', e.target.value)} placeholder="50 000 F de consommations sur place" error={fieldErrors.onsite}
                    hint="Facultatif. Un simple texte : rien n’est encaissé en plus." />
            </form>
        </Modal>
    );
}
