import React from 'react';
import { Ban, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { REGULATED_KIND_LABELS, productStatusMeta, type Tone } from '@/lib/orders/partner-ui';
import type { CatalogProduct } from './catalog-client';

const VARIANT: Record<Tone, BadgeVariant> = { success: 'success', neutral: 'neutral', warning: 'warning', danger: 'danger', info: 'info', brand: 'brand' };

/**
 * Lot 12c — pastilles d'un produit : disponibilité, plat du jour, réglementé (et sa sorte), en vérification, refusé à la
 * vente. Chaque pastille porte un libellé (jamais la couleur seule).
 */
export function ProductBadges({ product, showStatus = true }: { product: CatalogProduct; showStatus?: boolean }) {
    const meta = productStatusMeta(product.status);
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {showStatus && <Badge variant={VARIANT[meta.tone]} size="sm">{meta.label}</Badge>}
            {product.isDailySpecial && <Badge variant="brand" size="sm" icon={<Sparkles size={12} aria-hidden="true" />}>Plat du jour</Badge>}
            {product.underReview && <Badge variant="info" size="sm" icon={<Clock size={12} aria-hidden="true" />}>En vérification</Badge>}
            {product.adminDecision === true && <Badge variant="danger" size="sm" icon={<Ban size={12} aria-hidden="true" />}>Refusé à la vente en ligne</Badge>}
            {product.isRegulated && (
                <Badge variant="warning" size="sm" icon={<ShieldAlert size={12} aria-hidden="true" />}>
                    {product.regulatedKind ? `Réglementé : ${REGULATED_KIND_LABELS[product.regulatedKind] ?? 'autre'}` : 'Réglementé'}
                </Badge>
            )}
        </div>
    );
}
