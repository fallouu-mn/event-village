import React from 'react';
import { Plus, ShieldAlert, Store } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { formatFcfa } from '@/lib/format';
import { AVAILABILITY_LABELS, type MenuProduct } from '@/lib/orders/menu-types';
import { ProductVisual } from './ProductVisual';

/** Ce qui empêche de commander un plat, en mots de client (null : commandable). */
export function blockedReason(p: MenuProduct): { label: string; detail: string | null; tone: 'neutral' | 'warning' } | null {
    if (p.regulated) return { label: 'Non commandable en ligne', detail: 'Vente sur place uniquement', tone: 'warning' };
    if (p.inReview) return { label: 'Non commandable en ligne', detail: 'En cours de vérification', tone: 'warning' };
    if (p.orderable) return null;
    if (p.availability === 'DISPONIBLE') return { label: 'Momentanément indisponible', detail: null, tone: 'neutral' };
    return { label: AVAILABILITY_LABELS[p.availability], detail: null, tone: 'neutral' };
}

/**
 * Lot 12b — carte d'un plat : grande photo, nom, description, prix de la carte (tel que servi), pastille douce quand le
 * plat ne se commande pas (épuisé, indisponible, suspendu, réglementé, en vérification) : le plat reste visible.
 */
export function ProductCard({ product, inCart, onOpen }: { product: MenuProduct; inCart: number; onOpen: (p: MenuProduct) => void }) {
    const blocked = blockedReason(product);
    return (
        <article
            className={cn(
                'group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-colors duration-fast',
                inCart > 0 ? 'border-brand-vif' : 'border-border',
            )}
        >
            <button
                type="button"
                onClick={() => onOpen(product)}
                className="ev-press flex h-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={blocked ? `${product.name}, ${blocked.label}` : `Voir ${product.name}`}
            >
                <span className="relative block">
                    <ProductVisual
                        image={product.image}
                        name={product.name}
                        sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw"
                        className={cn('aspect-[4/3] w-full transition-transform duration-slow motion-safe:group-hover:scale-[1.02]', blocked && 'opacity-60')}
                    />
                    {blocked && (
                        <span className="absolute left-3 top-3">
                            <Badge variant={blocked.tone === 'warning' ? 'warning' : 'neutral'} size="sm"
                                icon={product.regulated ? <Store size={12} aria-hidden="true" /> : product.inReview ? <ShieldAlert size={12} aria-hidden="true" /> : undefined}>
                                {blocked.label}
                            </Badge>
                        </span>
                    )}
                    {inCart > 0 && (
                        <span className="absolute right-3 top-3 inline-flex min-h-8 min-w-8 items-center justify-center rounded-full bg-brand-vif px-2 text-sm font-bold tabular-nums text-brand-vif-foreground">
                            {inCart}
                            <span className="sr-only"> dans le panier</span>
                        </span>
                    )}
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-4">
                    <span className="text-lg font-bold leading-snug text-foreground-strong">{product.name}</span>
                    {product.description && <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</span>}
                    {blocked?.detail && <span className="text-sm font-semibold text-warning-text">{blocked.detail}</span>}
                    <span className="mt-auto flex items-center justify-between gap-3 pt-2">
                        <span className="text-lg font-extrabold tabular-nums text-foreground-strong">{formatFcfa(product.price)}</span>
                        {!blocked && (
                            <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-fast motion-safe:group-hover:scale-105">
                                <Plus size={20} />
                            </span>
                        )}
                    </span>
                </span>
            </button>
        </article>
    );
}
