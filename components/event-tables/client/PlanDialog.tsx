'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';

/**
 * Lot 11c-b — fenêtre plein écran du plan de salle (téléphone et ordinateur), sur la modale partagée (focus posé et gardé
 * dans la fenêtre, Échap, focus rendu, page derrière figée). Sur téléphone, le plan prend tout l'écran et le devis reste
 * visible dans la feuille du bas pendant qu'on touche les tables ; sur ordinateur, le devis est un panneau collant à
 * droite du plan.
 */
export function PlanDialog({ title, subtitle, onClose, plan, panel }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    plan: React.ReactNode;
    panel: React.ReactNode;
}) {
    return (
        <Modal isOpen onClose={onClose} title={title} subtitle={subtitle} fullScreen closeOnOverlayClick={false}>
            <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_26rem]">
                {/* Zone du plan qui défile (jamais coupée : run 702, légende coupée à 1 440 px) ; sur ordinateur, le plan est
                    dimensionné pour tenir en hauteur (largeur ≤ 60 % de la hauteur de l'écran × 4/3) */}
                <div className="h-full min-h-0 overflow-y-auto overscroll-contain p-3 pb-48 sm:p-4 sm:pb-48 lg:p-6">
                    <div className="mx-auto w-full lg:max-w-[calc(60vh*4/3)]">{plan}</div>
                </div>
                {/* Téléphone : feuille du bas posée sur le plan (le plan reste touchable au-dessus) ; ordinateur : colonne */}
                <section
                    aria-label="Votre table"
                    className="absolute inset-x-0 bottom-0 z-40 max-h-[80%] overflow-y-auto overscroll-contain rounded-t-[20px] border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-popover lg:static lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 lg:p-6 lg:shadow-none"
                >
                    <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-input lg:hidden" />
                    {panel}
                </section>
            </div>
        </Modal>
    );
}
