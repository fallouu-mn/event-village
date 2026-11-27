import React from 'react';
import { Clock, Eye, ShieldAlert, ShoppingBag } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatFcfa } from '@/lib/format';
import { ProductVisual } from './ProductVisual';

export interface PreviewProduct {
    name: string;
    description: string | null;
    price: number | null;
    image: string | null;
    isDailySpecial: boolean;
    isRegulated: boolean;
    underReview: boolean;
    refused: boolean;
    available: boolean;
    portionsLeft: number | null;
    options: ReadonlyArray<{ id: string; name: string; price: number; isActive: boolean }>;
}

/**
 * Lot 12c — aperçu « vue client » d'un produit : la carte telle que le client la verra sur le menu de l'établissement,
 * sans bouton de commande actif (une simple mention dit s'il se commande en ligne). Prix et suppléments affichés tels
 * qu'ils sont saisis ou servis : aucun total n'est calculé.
 */
export function ProductPreview({ product }: { product: PreviewProduct }) {
    const state = product.underReview
        ? { icon: <Clock size={16} aria-hidden="true" />, text: 'En vérification par Event Village : pas encore commandable', tone: 'bg-info-soft text-info-text' }
        : product.isRegulated || product.refused
            ? { icon: <ShieldAlert size={16} aria-hidden="true" />, text: 'Affiché avec son prix, acheté sur place seulement', tone: 'bg-warning-soft text-warning-text' }
            : !product.available || product.portionsLeft === 0
                ? { icon: <ShoppingBag size={16} aria-hidden="true" />, text: 'Indisponible pour le moment', tone: 'bg-muted text-muted-foreground' }
                : { icon: <ShoppingBag size={16} aria-hidden="true" />, text: 'Commandable en ligne', tone: 'bg-success-soft text-success-text' };
    const options = product.options.filter((o) => o.isActive);
    return (
        <section aria-labelledby="vue-client" className="rounded-xl border border-border bg-background p-3">
            <h2 id="vue-client" className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Eye size={16} aria-hidden="true" /> Vue client
            </h2>
            <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <ProductVisual src={product.image} />
                <div className="space-y-3 p-4">
                    {product.isDailySpecial && (
                        <p className="text-sm font-semibold text-primary-text">
                            Plat du jour{product.portionsLeft !== null && product.portionsLeft > 0 ? <span className="tabular-nums"> · plus que {product.portionsLeft}</span> : null}
                        </p>
                    )}
                    <div>
                        <p className="break-words text-lg font-bold leading-snug text-foreground-strong">{product.name || 'Nom du plat'}</p>
                        {product.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{product.description}</p>}
                    </div>
                    <p className="text-2xl font-bold tracking-tight text-foreground-strong tabular-nums">
                        {product.price === null ? 'Prix à indiquer' : formatFcfa(product.price)}
                    </p>
                    {options.length > 0 && (
                        <div>
                            <p className="mb-1.5 text-sm font-semibold text-foreground-strong">Suppléments</p>
                            <ul className="space-y-1">
                                {options.map((o) => (
                                    <li key={o.id} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                                        <span className="min-w-0 truncate">{o.name}</span>
                                        <span className="flex-shrink-0 tabular-nums">{o.price > 0 ? `+ ${formatFcfa(o.price)}` : 'offert'}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <p className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', state.tone)}>
                        {state.icon}
                        <span>{state.text}</span>
                    </p>
                </div>
            </article>
        </section>
    );
}
