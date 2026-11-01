'use client';

/**
 * Lot 4.1 — saisie manuelle d'un billet (spectateur sans téléphone) : numéro du billet et case
 * « pièce d'identité vérifiée » obligatoire. Le serveur refuse toute saisie sans cette case et hors
 * du périmètre réglé ; la case est remise à zéro après chaque envoi (une vérification par personne).
 * Lot 5 (contrat Q) : champ et case sur le système de design (TextInput, tokens, cibles de 44 px).
 */
import React, { useId, useState } from 'react';
import { IdCard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';

export interface ManualEntryFormProps {
    onSubmit: (ticketNumber: string, identityVerified: boolean) => Promise<void>;
    isSubmitting: boolean;
    disabled?: boolean;
    /** Raison affichée quand la saisie est suspendue (ex. encaissement en attente). */
    disabledReason?: string;
}

export function ManualEntryForm({ onSubmit, isSubmitting, disabled = false, disabledReason }: ManualEntryFormProps) {
    const numberId = useId();
    const identityId = useId();
    const identityHelpId = useId();
    const [ticketNumber, setTicketNumber] = useState('');
    const [identityVerified, setIdentityVerified] = useState(false);
    const canSubmit = ticketNumber.trim().length >= 4 && identityVerified && !isSubmitting && !disabled;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit) return;
        await onSubmit(ticketNumber.trim().toUpperCase(), identityVerified);
        setTicketNumber('');
        setIdentityVerified(false);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <TextInput
                id={numberId}
                label="Numéro du billet"
                hint="Spectateur sans téléphone : saisissez le numéro imprimé sur son billet PDF, après contrôle d’une pièce d’identité au nom du titulaire."
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="TCK-20261101-XXXXXXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={disabled}
                className="tabular-nums"
            />

            <div className="flex items-start gap-3 rounded-xl border border-border-strong bg-surface-sunken p-3">
                <input
                    id={identityId}
                    type="checkbox"
                    checked={identityVerified}
                    onChange={(e) => setIdentityVerified(e.target.checked)}
                    disabled={disabled}
                    aria-describedby={identityHelpId}
                    className="mt-2.5 h-6 w-6 flex-shrink-0 cursor-pointer rounded border-border-strong accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                />
                <div className="min-w-0 flex-1">
                    <label htmlFor={identityId} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-fg">
                        <IdCard size={18} aria-hidden="true" className="flex-shrink-0 text-fg-muted" />
                        Pièce d’identité vérifiée
                    </label>
                    <p id={identityHelpId} className="text-sm text-fg-muted">
                        Le nom sur la pièce correspond au titulaire du billet. Obligatoire.
                    </p>
                </div>
            </div>

            {disabled && disabledReason && (
                <p role="status" className="text-sm font-medium text-warning-fg">{disabledReason}</p>
            )}

            <Button type="submit" variant="primary" fullWidth size="lg" isLoading={isSubmitting} disabled={!canSubmit}>
                Valider l’entrée manuelle
            </Button>
        </form>
    );
}
