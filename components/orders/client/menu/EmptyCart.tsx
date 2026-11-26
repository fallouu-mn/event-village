import React from 'react';
import { Button } from '@/components/ui/Button';

/** Lot 12b — panier vide, illustré (dessin local sur les jetons : un sac et une assiette, aucun fichier extérieur). */
export function EmptyCart({ onBrowse }: { onBrowse?: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted px-4 py-8 text-center">
            <svg width="96" height="80" viewBox="0 0 96 80" aria-hidden="true" className="text-primary-text">
                <ellipse cx="48" cy="72" rx="34" ry="5" className="fill-current opacity-15" />
                <path d="M26 30h44l-4 38H30z" className="fill-current opacity-20" />
                <path d="M26 30h44l-4 38H30z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M37 30v-6a11 11 0 0 1 22 0v6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="48" cy="48" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            </svg>
            <p className="text-lg font-bold text-foreground-strong">Votre panier est vide</p>
            <p className="max-w-xs text-sm text-muted-foreground">Touchez un plat pour l’ajouter : le total exact s’affiche ici.</p>
            {onBrowse && <Button variant="secondary" onClick={onBrowse}>Voir la carte</Button>}
        </div>
    );
}
