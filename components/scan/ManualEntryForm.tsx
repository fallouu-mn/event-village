'use client';

/**
 * Lot 4.1 — saisie manuelle d'un billet (spectateur sans téléphone) : numéro du billet et case
 * « pièce d'identité vérifiée » obligatoire. Le serveur refuse toute saisie sans cette case et hors
 * du périmètre réglé ; la case est remise à zéro après chaque envoi (une vérification par personne).
 */
import React, { useId, useState } from 'react';
import { IdCard, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ManualEntryFormProps {
    onSubmit: (ticketNumber: string, identityVerified: boolean) => Promise<void>;
    isSubmitting: boolean;
    disabled?: boolean;
    /** Raison affichée quand la saisie est suspendue (ex. encaissement en attente). */
    disabledReason?: string;
}

export function ManualEntryForm({ onSubmit, isSubmitting, disabled = false, disabledReason }: ManualEntryFormProps) {
    const numberId = useId();
    const helpId = useId();
    const identityId = useId();
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
        <form onSubmit={handleSubmit} className="space-y-3" aria-describedby={helpId} noValidate>
            <div className="space-y-1.5">
                <label htmlFor={numberId} className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                    <Keyboard size={16} aria-hidden="true" className="text-[#FF5722]" />
                    Numéro du billet
                </label>
                <input
                    id={numberId}
                    type="text"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    placeholder="TCK-20261101-XXXXXXXXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={disabled}
                    aria-describedby={helpId}
                    className="w-full min-h-[48px] px-3 rounded-xl border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-base font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] disabled:opacity-60"
                />
                <p id={helpId} className="text-xs text-slate-600 dark:text-zinc-300">
                    Spectateur sans téléphone : saisissez le numéro imprimé sur son billet PDF, après contrôle d’une pièce d’identité au nom du titulaire.
                </p>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900/60">
                <input
                    id={identityId}
                    type="checkbox"
                    checked={identityVerified}
                    onChange={(e) => setIdentityVerified(e.target.checked)}
                    disabled={disabled}
                    className="mt-0.5 h-6 w-6 shrink-0 rounded border-slate-400 accent-[#FF5722] focus-visible:ring-2 focus-visible:ring-[#FF5722]"
                />
                <label htmlFor={identityId} className="text-sm font-semibold text-slate-800 dark:text-zinc-100 leading-snug cursor-pointer">
                    <span className="inline-flex items-center gap-1.5"><IdCard size={16} aria-hidden="true" /> Pièce d’identité vérifiée</span>
                    <span className="block text-xs font-normal text-slate-600 dark:text-zinc-300">Le nom sur la pièce correspond au titulaire du billet. Obligatoire.</span>
                </label>
            </div>

            {disabled && disabledReason && (
                <p role="status" className="text-sm font-medium text-amber-800 dark:text-amber-200">{disabledReason}</p>
            )}

            <Button type="submit" variant="primary" fullWidth size="lg" className="min-h-[48px]" isLoading={isSubmitting} disabled={!canSubmit}>
                Valider l’entrée manuelle
            </Button>
        </form>
    );
}
