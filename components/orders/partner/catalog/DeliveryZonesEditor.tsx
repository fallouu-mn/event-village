'use client';

/**
 * Lot 12c — zones de livraison d'un établissement (liste de quartiers : nom, frais, minimum, active), ordre choisi par la
 * partenaire : glisser la poignée à la souris ou au doigt, ou boutons « Monter » / « Descendre » (et flèches du clavier sur
 * la poignée). Écritures par les routes serveur (order_delivery_zone_set / _remove / zones_reorder en base) ; frais et
 * minimums affichés tels que servis. Une zone d'une commande en cours ne s'efface pas : la base la désactive.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, GripVertical, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { formatFcfa } from '@/lib/format';
import type { CatalogZone } from './catalog-client';

const parseFcfa = (raw: string): number | null => (/^\d{1,8}$/.test(raw.trim()) ? Number(raw.trim()) : null);

interface Draft { name: string; fee: string; minOrder: string }

function moved<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}

export function DeliveryZonesEditor({ venueId, zones, readOnly, onChanged }: {
    venueId: string;
    zones: readonly CatalogZone[];
    readOnly: boolean;
    onChanged: () => Promise<void>;
}) {
    const toast = useToast();
    const [list, setList] = useState<CatalogZone[]>([...zones]);
    const [draft, setDraft] = useState<Draft>({ name: '', fee: '', minOrder: '' });
    const [editing, setEditing] = useState<(Draft & { id: string }) | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [removing, setRemoving] = useState<CatalogZone | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const [announce, setAnnounce] = useState('');
    const rows = useRef(new Map<string, HTMLLIElement>());
    const listRef = useRef(list);
    listRef.current = list;

    useEffect(() => setList([...zones]), [zones]);

    async function persistOrder(next: CatalogZone[], label: string) {
        setBusy('ordre');
        setError(null);
        try {
            await fetchJson(`/api/partner/venues/${venueId}/zones`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneIds: next.map((z) => z.id) }),
            });
            setAnnounce(label);
            await onChanged();
        } catch (err) {
            setError(errorMessage(err, 'Ordre non enregistré. Réessayez.'));
            setList([...zones]);
        } finally {
            setBusy(null);
        }
    }

    function move(index: number, delta: number) {
        const to = index + delta;
        if (to < 0 || to >= list.length) return;
        const next = moved(list, index, to);
        setList(next);
        void persistOrder(next, `${list[index].name} : position ${to + 1} sur ${list.length}.`);
    }

    // Glisser au doigt ou à la souris : la ligne suit le pointeur, l'ordre est envoyé au relâchement
    function onHandlePointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
        if (readOnly || busy) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(id);
        const start = listRef.current.map((z) => z.id).join(',');
        const onMove = (ev: PointerEvent) => {
            const current = listRef.current;
            const from = current.findIndex((z) => z.id === id);
            let to = from;
            current.forEach((z, i) => {
                const el = rows.current.get(z.id);
                if (!el || z.id === id) return;
                const r = el.getBoundingClientRect();
                const mid = r.top + r.height / 2;
                if (i < from && ev.clientY < mid) to = Math.min(to, i);
                if (i > from && ev.clientY > mid) to = Math.max(to, i);
            });
            if (to !== from) setList(moved(current, from, to));
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            setDragging(null);
            const now = listRef.current;
            if (now.map((z) => z.id).join(',') !== start) {
                const pos = now.findIndex((z) => z.id === id);
                void persistOrder(now, `${now[pos]?.name ?? 'Zone'} : position ${pos + 1} sur ${now.length}.`);
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }

    function validDraft(d: Draft): { name: string; fee: number; minOrder: number } | null {
        const fee = parseFcfa(d.fee || '0');
        const minOrder = parseFcfa(d.minOrder || '0');
        if (d.name.trim().length < 2) { setError('Le nom de la zone compte au moins 2 lettres (par exemple « Almadies »).'); return null; }
        if (fee === null || minOrder === null) { setError('Frais et minimum : nombres entiers de F CFA, sans virgule.'); return null; }
        return { name: d.name.trim(), fee, minOrder };
    }

    async function run(key: string, fn: () => Promise<unknown>, ok: string | ((r: unknown) => string)): Promise<boolean> {
        setBusy(key);
        setError(null);
        try {
            const r = await fn();
            toast.success(typeof ok === 'string' ? ok : ok(r));
            await onChanged();
            return true;
        } catch (err) {
            setError(errorMessage(err, 'Zone non enregistrée. Réessayez.'));
            return false;
        } finally {
            setBusy(null);
        }
    }

    async function add(e: React.FormEvent) {
        e.preventDefault();
        const v = validDraft(draft);
        if (!v) return;
        if (await run('ajout', () => sendJson(`/api/partner/venues/${venueId}/zones`, 'POST', v), `Zone « ${v.name} » ajoutée.`)) {
            setDraft({ name: '', fee: '', minOrder: '' });
        }
    }

    async function saveEdit() {
        if (!editing) return;
        const v = validDraft(editing);
        if (!v) return;
        if (await run(editing.id, () => sendJson(`/api/partner/venues/${venueId}/zones/${editing.id}`, 'PATCH', v), 'Zone modifiée.')) setEditing(null);
    }

    async function confirmRemove() {
        if (!removing) return;
        const done = await run(`retrait-${removing.id}`, () => sendJson<{ message?: string }>(`/api/partner/venues/${venueId}/zones/${removing.id}`, 'DELETE'),
            (r) => (r as { message?: string }).message ?? 'Zone retirée.');
        if (done) setRemoving(null);
    }

    return (
        <div className="space-y-4">
            <p className="sr-only" role="status" aria-live="polite">{announce}</p>
            {list.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-text" aria-hidden="true"><MapPin size={24} /></span>
                    <p className="text-sm font-semibold text-foreground-strong">Aucune zone de livraison</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">Ajoutez les quartiers où vous livrez, avec vos frais et un minimum de commande.</p>
                </div>
            ) : (
                <ol className="space-y-2" aria-label="Zones de livraison, dans l’ordre proposé aux clients">
                    {list.map((z, i) => (
                        <li
                            key={z.id}
                            ref={(el) => { if (el) rows.current.set(z.id, el); else rows.current.delete(z.id); }}
                            className={cn(
                                'rounded-xl border border-border bg-card p-3 motion-safe:transition-[transform,box-shadow] motion-safe:duration-fast',
                                dragging === z.id && 'relative z-10 border-primary-text/40 shadow-lg',
                                !z.isActive && 'bg-background',
                            )}
                        >
                            {editing?.id === z.id ? (
                                <div className="grid gap-3 sm:grid-cols-[1fr_8rem_9rem_auto] sm:items-end">
                                    <TextInput label="Quartier" maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                                    <TextInput label="Frais (F CFA)" inputMode="numeric" value={editing.fee} onChange={(e) => setEditing({ ...editing, fee: e.target.value.replace(/\D/g, '') })} />
                                    <TextInput label="Minimum (F CFA)" inputMode="numeric" value={editing.minOrder} onChange={(e) => setEditing({ ...editing, minOrder: e.target.value.replace(/\D/g, '') })} />
                                    <div className="flex gap-2">
                                        <IconButton aria-label="Enregistrer la zone" variant="primary" isLoading={busy === z.id} onClick={() => void saveEdit()}><Check size={18} aria-hidden="true" /></IconButton>
                                        <IconButton aria-label="Annuler la modification" onClick={() => setEditing(null)} disabled={busy === z.id}><X size={18} aria-hidden="true" /></IconButton>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            aria-label={`Déplacer ${z.name} (position ${i + 1} sur ${list.length}) : glissez, ou flèches haut et bas`}
                                            className="flex h-11 w-11 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                                            onPointerDown={(e) => onHandlePointerDown(e, z.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
                                                if (e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
                                            }}
                                        >
                                            <GripVertical size={20} aria-hidden="true" />
                                        </button>
                                    )}
                                    <div className="min-w-0 flex-1 basis-40">
                                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground-strong">
                                            <span className="break-words">{z.name}</span>
                                            {!z.isActive && <Badge variant="neutral" size="sm">Désactivée</Badge>}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Livraison <span className="tabular-nums">{z.fee > 0 ? formatFcfa(z.fee) : 'offerte'}</span>
                                            {' · '}{z.minOrder > 0 ? <>minimum <span className="tabular-nums">{formatFcfa(z.minOrder)}</span></> : 'sans minimum'}
                                        </p>
                                    </div>
                                    {!readOnly && (
                                        <div className="flex flex-wrap items-center gap-1">
                                            <Switch label={<span className="sr-only">Proposer {z.name}</span>} checked={z.isActive} loading={busy === `actif-${z.id}`}
                                                onChange={(next) => void run(`actif-${z.id}`, () => sendJson(`/api/partner/venues/${venueId}/zones/${z.id}`, 'PATCH', { isActive: next }),
                                                    next ? `Zone « ${z.name} » proposée.` : `Zone « ${z.name} » désactivée.`)} />
                                            <IconButton aria-label={`Monter ${z.name}`} onClick={() => move(i, -1)} disabled={i === 0 || busy !== null}><ChevronUp size={18} aria-hidden="true" /></IconButton>
                                            <IconButton aria-label={`Descendre ${z.name}`} onClick={() => move(i, 1)} disabled={i === list.length - 1 || busy !== null}><ChevronDown size={18} aria-hidden="true" /></IconButton>
                                            <IconButton aria-label={`Modifier ${z.name}`} onClick={() => setEditing({ id: z.id, name: z.name, fee: String(z.fee), minOrder: String(z.minOrder) })}><Pencil size={18} aria-hidden="true" /></IconButton>
                                            <IconButton aria-label={`Retirer ${z.name}`} variant="danger" onClick={() => setRemoving(z)}><Trash2 size={18} aria-hidden="true" /></IconButton>
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            )}

            {error && <p role="alert" className="text-sm font-medium text-danger-text">{error}</p>}

            {!readOnly && (
                <form onSubmit={(e) => void add(e)} className="grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_8rem_9rem_auto] sm:items-end">
                    <TextInput label="Nouveau quartier" placeholder="Almadies" maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    <TextInput label="Frais (F CFA)" inputMode="numeric" placeholder="1000" value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value.replace(/\D/g, '') })} />
                    <TextInput label="Minimum (F CFA)" inputMode="numeric" placeholder="0" value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: e.target.value.replace(/\D/g, '') })} />
                    <Button type="submit" variant="secondary" leftIcon={<Plus size={18} aria-hidden="true" />} isLoading={busy === 'ajout'}>Ajouter</Button>
                </form>
            )}

            <ConfirmDialog
                isOpen={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={() => void confirmRemove()}
                title={removing ? `Retirer la zone « ${removing.name} » ?` : 'Retirer cette zone ?'}
                message="Si une commande en cours l’utilise, la zone est seulement désactivée : elle n’est plus proposée aux clients. Les commandes déjà passées gardent leurs frais."
                confirmLabel="Retirer"
                variant="danger"
                isLoading={removing !== null && busy === `retrait-${removing.id}`}
            />
        </div>
    );
}
