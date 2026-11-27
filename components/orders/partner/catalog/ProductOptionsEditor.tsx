'use client';

import React, { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatFcfa } from '@/lib/format';
import type { CatalogOption } from './catalog-client';

const parseFcfa = (raw: string): number | null => (/^\d{1,7}$/.test(raw.trim()) ? Number(raw.trim()) : null);

/**
 * Lot 12c — suppléments d'un produit (« sauce piquante + 200 F CFA ») : ajout, modification, masquage, retrait par les
 * routes serveur (product_option_set / _remove en base). Le prix déjà figé sur une commande passée ne change jamais.
 */
export function ProductOptionsEditor({ productId, options, readOnly, onChanged }: {
    productId: string;
    options: readonly CatalogOption[];
    readOnly: boolean;
    onChanged: () => Promise<void>;
}) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [editing, setEditing] = useState<{ id: string; name: string; price: string } | null>(null);

    async function run(key: string, fn: () => Promise<{ reviewRequested?: boolean } | void>, ok: string) {
        setBusy(key);
        setError(null);
        try {
            const r = await fn();
            if (r && r.reviewRequested) toast.info('Ce supplément met le produit en vérification par Event Village.');
            else toast.success(ok);
            await onChanged();
            return true;
        } catch (err) {
            setError(errorMessage(err, 'Supplément non enregistré. Réessayez.'));
            return false;
        } finally {
            setBusy(null);
        }
    }

    async function add(e: React.FormEvent) {
        e.preventDefault();
        const p = parseFcfa(price || '0');
        if (!name.trim()) return setError('Indiquez le nom du supplément.');
        if (p === null) return setError('Le prix est un nombre entier de F CFA, sans virgule.');
        const done = await run('ajout', () => sendJson(`/api/partner/products/${productId}/options`, 'POST', { name: name.trim(), price: p }), 'Supplément ajouté.');
        if (done) {
            setName('');
            setPrice('');
        }
    }

    async function saveEdit() {
        if (!editing) return;
        const p = parseFcfa(editing.price || '0');
        if (!editing.name.trim()) return setError('Indiquez le nom du supplément.');
        if (p === null) return setError('Le prix est un nombre entier de F CFA, sans virgule.');
        const done = await run(editing.id, () => sendJson(`/api/partner/products/${productId}/options/${editing.id}`, 'PATCH', { name: editing.name.trim(), price: p }), 'Supplément modifié.');
        if (done) setEditing(null);
    }

    return (
        <div className="space-y-4">
            {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun supplément. Ajoutez par exemple une sauce, une boisson ou une portion en plus.</p>
            ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                    {options.map((o) => (
                        <li key={o.id} className="p-3">
                            {editing?.id === o.id ? (
                                <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                                    <TextInput label="Nom" value={editing.name} maxLength={80} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                                    <TextInput label="Prix (F CFA)" inputMode="numeric" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value.replace(/\D/g, '') })} />
                                    <div className="flex gap-2">
                                        <IconButton aria-label="Enregistrer le supplément" variant="primary" onClick={() => void saveEdit()} isLoading={busy === o.id}>
                                            <Check size={18} aria-hidden="true" />
                                        </IconButton>
                                        <IconButton aria-label="Annuler la modification" onClick={() => setEditing(null)} disabled={busy === o.id}>
                                            <X size={18} aria-hidden="true" />
                                        </IconButton>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="break-words text-sm font-semibold text-foreground-strong">{o.name}</p>
                                        <p className="text-sm text-muted-foreground tabular-nums">{o.price > 0 ? `+ ${formatFcfa(o.price)}` : 'Offert'}</p>
                                    </div>
                                    {!o.isActive && <Badge variant="neutral" size="sm">Masqué</Badge>}
                                    {!readOnly && (
                                        <div className="flex items-center gap-1">
                                            <Switch
                                                label={<span className="sr-only">Proposer {o.name}</span>}
                                                checked={o.isActive}
                                                loading={busy === `actif-${o.id}`}
                                                onChange={(next) => void run(`actif-${o.id}`, () => sendJson(`/api/partner/products/${productId}/options/${o.id}`, 'PATCH', { isActive: next }), next ? 'Supplément proposé.' : 'Supplément masqué.')}
                                            />
                                            <IconButton aria-label={`Modifier ${o.name}`} onClick={() => setEditing({ id: o.id, name: o.name, price: String(o.price) })}>
                                                <Pencil size={18} aria-hidden="true" />
                                            </IconButton>
                                            <IconButton aria-label={`Retirer ${o.name}`} variant="danger" isLoading={busy === `retrait-${o.id}`}
                                                onClick={() => void run(`retrait-${o.id}`, () => sendJson(`/api/partner/products/${productId}/options/${o.id}`, 'DELETE'), 'Supplément retiré.')}>
                                                <Trash2 size={18} aria-hidden="true" />
                                            </IconButton>
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {error && <p role="alert" className="text-sm font-medium text-danger-text">{error}</p>}
            {!readOnly && (
                <form onSubmit={(e) => void add(e)} className="grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                    <TextInput label="Nouveau supplément" placeholder="Sauce piquante" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                    <TextInput label="Prix (F CFA)" inputMode="numeric" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
                    <Button type="submit" variant="secondary" leftIcon={<Plus size={18} aria-hidden="true" />} isLoading={busy === 'ajout'}>Ajouter</Button>
                </form>
            )}
        </div>
    );
}
