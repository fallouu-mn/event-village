'use client';

/**
 * Lot 12c — choix de la catégorie d'un produit, avec création sur place (POST /api/partner/products/categories : nom de 2
 * à 60 caractères ; un nom déjà pris rend la catégorie existante). La catégorie créée est choisie tout de suite. Placé dans
 * le formulaire du produit : aucun <form> imbriqué, la touche Entrée du champ ajoute la catégorie sans envoyer le produit.
 */
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';

export interface CategoryChoice { id: string; name: string }

export function CategoryPicker({ categories, value, onChange, onCreated, readOnly }: {
    categories: readonly CategoryChoice[];
    value: string;
    onChange: (id: string) => void;
    onCreated: (category: CategoryChoice) => void;
    readOnly: boolean;
}) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function add() {
        const clean = name.trim().replace(/\s+/g, ' ');
        if (clean.length < 2 || clean.length > 60) {
            setError('Le nom de la catégorie compte de 2 à 60 caractères.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const r = await sendJson<{ category: CategoryChoice }>('/api/partner/products/categories', 'POST', { name: clean });
            onCreated(r.category);
            onChange(r.category.id);
            setName('');
            toast.success(`Catégorie « ${r.category.name} » choisie.`);
        } catch (err) {
            setError(errorMessage(err, 'Catégorie non créée. Réessayez.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3">
            {categories.length > 0 && (
                <Select label="Catégorie" value={value} onChange={(e) => onChange(e.target.value)}
                    options={[{ value: '', label: 'Sans catégorie' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
            )}
            {!readOnly && (
                <div className="flex flex-wrap items-end gap-3">
                    <TextInput
                        label={categories.length > 0 ? 'Nouvelle catégorie' : 'Catégorie (facultatif)'}
                        placeholder="Plats, boissons, desserts…"
                        maxLength={60}
                        value={name}
                        fieldClassName="min-w-0 flex-1 basis-48"
                        error={error ?? undefined}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                void add();
                            }
                        }}
                    />
                    <Button type="button" variant="secondary" leftIcon={<Plus size={18} aria-hidden="true" />} isLoading={busy} onClick={() => void add()}>
                        Ajouter
                    </Button>
                </div>
            )}
        </div>
    );
}
