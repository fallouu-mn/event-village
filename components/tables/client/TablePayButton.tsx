'use client';

/**
 * Lot 11b (écrans du client) : « Payer l'acompte » d'une réservation de table. Ouvre la fenêtre de paiement existante
 * (PaymentModal, chargée à la demande), cible TABLE_RESERVATION : le serveur relit le montant sur la réservation
 * (table_payment_create) ; rien n'est calculé ici, le montant affiché est celui de la réservation figée.
 */
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fcfaText } from '@/lib/tables/views';

const PaymentModal = dynamic(
    () => import('@/components/payment/PaymentModal').then((m) => ({ default: m.PaymentModal })),
    { ssr: false },
);

export function TablePayButton({ reservationId, venueName, depositAmount, size = 'lg', className }: {
    reservationId: string;
    venueName: string;
    /** Acompte figé sur la réservation (hors frais de service). */
    depositAmount: number;
    size?: 'md' | 'lg';
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button variant="gradient" size={size} fullWidth leftIcon={<Wallet size={20} aria-hidden="true" />} onClick={() => setOpen(true)} className={className}>
                {`Payer l’acompte de ${fcfaText(depositAmount)}`}
            </Button>
            {open && (
                <PaymentModal
                    isOpen={open}
                    onClose={() => setOpen(false)}
                    title={`Acompte de la table — ${venueName}`}
                    targetType="TABLE_RESERVATION"
                    targetId={reservationId}
                    amountFormatted={fcfaText(depositAmount)}
                />
            )}
        </>
    );
}
