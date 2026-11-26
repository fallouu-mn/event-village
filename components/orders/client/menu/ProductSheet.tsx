'use client';

import React, { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { formatFcfa } from '@/lib/format';
import type { MenuProduct } from '@/lib/orders/menu-types';
import { MAX_QUANTITY, NOTE_MAX } from '@/lib/orders/cart-client';
import { blockedReason } from './ProductCard';
import { portionsText } from './DailyBanner';
import { ProductVisual } from './ProductVisual';

/**
 * Lot 12b — fiche d'un plat (feuille du bas sur téléphone, fenêtre sur ordinateur) : photo, description, suppléments
 * (cases, prix ajouté tel que servi), quantité de 1 à 99, note pour la cuisine, bouton « Ajouter · <prix de la carte> ».
 * Le prix du bouton est le prix unitaire de la carte, tel que servi : le total vient du devis de la base, dans le panier.
 */
export function ProductSheet({ product, onClose, onAdd }: {
    product: MenuProduct | null;
    onClose: () => void;
    onAdd: (p: MenuProduct, quantity: number, optionIds: string[], notes: string) => void;
}) {
    const [quantity, setQuantity] = useState(1);
    const [options, setOptions] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        setQuantity(1);
        setOptions([]);
        setNotes('');
    }, [product?.id]);

    if (!product) return null;
    const blocked = blockedReason(product);
    const toggle = (id: string) => setOptions((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={product.name}
            sheetOnMobile
            maxWidth="lg"
            footer={blocked ? (
                <Button variant="secondary" fullWidth onClick={onClose}>Fermer</Button>
            ) : (
                <div className="flex w-full items-center gap-3">
                    <div className="flex items-center rounded-full border border-border bg-card" role="group" aria-label="Quantité">
                        <IconButton aria-label="Une portion de moins" variant="ghost" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
                            <Minus size={18} />
                        </IconButton>
                        <span className="min-w-8 text-center text-lg font-bold tabular-nums text-foreground-strong" aria-live="polite">{quantity}</span>
                        <IconButton aria-label="Une portion de plus" variant="ghost" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY}>
                            <Plus size={18} />
                        </IconButton>
                    </div>
                    <Button
                        variant="primary"
                        className="flex-1"
                        onClick={() => onAdd(product, quantity, options, notes)}
                        aria-label={`Ajouter ${quantity} ${product.name} au panier`}
                    >
                        <span>Ajouter</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatFcfa(product.price)}</span>
                    </Button>
                </div>
            )}
        >
            <div className="space-y-5">
                <ProductVisual image={product.image} name={product.name} sizes="(min-width: 640px) 32rem, 100vw" className="aspect-[16/10] w-full rounded-2xl" />
                <div className="space-y-2">
                    <p className="text-2xl font-extrabold tabular-nums text-foreground-strong">{formatFcfa(product.price)}</p>
                    {product.daily && <p className="text-sm font-semibold text-primary-text">{`Plat du jour · ${portionsText(product)}`}</p>}
                    {product.description && <p className="whitespace-pre-line text-base leading-relaxed text-foreground">{product.description}</p>}
                </div>
                {blocked && (
                    <StatusBanner tone={blocked.tone === 'warning' ? 'warning' : 'neutral'} title={blocked.label}>
                        {product.regulated
                            ? 'Ce produit est affiché avec son prix ; il s’achète seulement sur place, auprès de l’établissement.'
                            : product.inReview
                                ? 'Event Village vérifie ce produit. Il ne peut pas encore être commandé en ligne.'
                                : 'Ce plat ne peut pas être commandé pour le moment.'}
                    </StatusBanner>
                )}
                {!blocked && product.options.length > 0 && (
                    <fieldset className="space-y-2">
                        <legend className="mb-2 text-base font-semibold text-foreground-strong">Suppléments</legend>
                        {product.options.map((o) => {
                            const checked = options.includes(o.id);
                            return (
                                <label
                                    key={o.id}
                                    className={cn(
                                        'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-fast',
                                        checked ? 'border-brand-vif bg-primary-soft' : 'border-border bg-card hover:bg-muted',
                                    )}
                                >
                                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(o.id)} />
                                    <span aria-hidden="true" className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border', checked ? 'border-brand-vif bg-brand-vif text-brand-vif-foreground' : 'border-border bg-card')}>
                                        {checked && <Check size={16} />}
                                    </span>
                                    <span className="flex-1 text-base text-foreground-strong">{o.name}</span>
                                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">{o.price > 0 ? `+ ${formatFcfa(o.price)}` : 'Offert'}</span>
                                </label>
                            );
                        })}
                    </fieldset>
                )}
                {!blocked && (
                    <Textarea
                        label="Une précision pour la cuisine ?"
                        hint="Par exemple : sans piment, bien cuit."
                        value={notes}
                        maxLength={NOTE_MAX}
                        showCount
                        rows={2}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                )}
            </div>
        </Modal>
    );
}
