'use client';

/**
 * Saisie manuelle d'un billet (spectateur sans téléphone), en deux temps (lot 7, D43) :
 *  1. « Vérifier » : POST /api/controller/scan/lookup, lecture seule (aucune entrée, aucune ligne de
 *     journal des scans, vérification journalisée côté serveur) : titulaire enregistré, catégorie, statut
 *     du billet et résultat qu'aurait le scan ;
 *  2. « Pièce conforme, valider l'entrée » : le contrôleur a comparé la pièce d'identité au titulaire ;
 *     POST /api/controller/scan avec identityVerified et la clé d'idempotence créée à la vérification
 *     (un second appui après une coupure ne crée jamais une seconde entrée).
 * Le serveur refuse toute saisie hors du périmètre réglé (access.manual_entry_scope).
 * Lot 5 (contrat Q) : champs et cases sur le système de design (TextInput, tokens, cibles de 44 px).
 */
import React, { useId, useState } from 'react';
import { IdCard, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { lookupManualTicket, newIdempotencyKey, type ManualLookup } from './scan-client';

export interface ManualEntryFormProps {
    eventId: string;
    /** Lot 9 ter (9t.15) : porte de l'affectation sur un événement à zones (absente sans zone). */
    gateId?: string | null;
    /** Second temps : validation de l'entrée (numéro vérifié, clé de la vérification). */
    onValidate: (ticketNumber: string, idempotencyKey: string) => Promise<void>;
    isSubmitting: boolean;
    disabled?: boolean;
    /** Raison affichée quand la saisie est suspendue (ex. hors ligne). */
    disabledReason?: string;
    /** Session expirée pendant la vérification (HTTP 401). */
    onSessionExpired?: () => void;
}

/** Résultats prévus qui permettent de valider l'entrée. */
const ADMISSIBLE = new Set(['valid']);

export function ManualEntryForm({ eventId, gateId, onValidate, isSubmitting, disabled = false, disabledReason, onSessionExpired }: ManualEntryFormProps) {
    const numberId = useId();
    const identityId = useId();
    const identityHelpId = useId();
    const [ticketNumber, setTicketNumber] = useState('');
    const [checking, setChecking] = useState(false);
    const [lookup, setLookup] = useState<{ number: string; key: string; reply: ManualLookup } | null>(null);
    const [identityVerified, setIdentityVerified] = useState(false);
    const normalized = ticketNumber.trim().toUpperCase();
    const canCheck = normalized.length >= 4 && !checking && !isSubmitting && !disabled;

    const reset = () => {
        setLookup(null);
        setIdentityVerified(false);
    };

    const handleCheck = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canCheck) return;
        setChecking(true);
        reset();
        try {
            const reply = await lookupManualTicket(eventId, normalized, gateId);
            if (reply.kind === 'refused' && reply.httpStatus === 401) onSessionExpired?.();
            setLookup({ number: normalized, key: newIdempotencyKey(), reply });
        } finally {
            setChecking(false);
        }
    };

    const handleValidate = async () => {
        if (!lookup || lookup.reply.kind !== 'found' || !identityVerified || isSubmitting || disabled) return;
        await onValidate(lookup.number, lookup.key);
        setTicketNumber('');
        reset();
    };

    const reply = lookup?.reply ?? null;
    const found = reply?.kind === 'found' ? reply.ticket : null;
    const admissible = found ? ADMISSIBLE.has(found.preview) : false;

    return (
        <div className="flex flex-col gap-4">
            <form onSubmit={handleCheck} className="flex flex-col gap-3" noValidate>
                <TextInput
                    id={numberId}
                    label="Numéro du billet"
                    hint="Spectateur sans téléphone : saisissez le numéro imprimé sur son billet, puis vérifiez le titulaire avant de valider."
                    value={ticketNumber}
                    onChange={(e) => { setTicketNumber(e.target.value); if (lookup) reset(); }}
                    placeholder="TCK-20261101-XXXXXXXXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={disabled}
                    className="tabular-nums"
                />
                <Button type="submit" variant="secondary" fullWidth size="lg" isLoading={checking} disabled={!canCheck} leftIcon={<Search size={18} />}>
                    Vérifier le billet
                </Button>
            </form>

            {disabled && disabledReason && (
                <p role="status" className="text-sm font-medium text-warning-fg">{disabledReason}</p>
            )}

            {reply?.kind === 'not_found' && (
                <StatusBanner tone="warning" title="Aucun billet de cet événement ne porte ce numéro" announce="alert">
                    Vérifiez la saisie avec le spectateur. Aucune entrée n’a été validée.
                </StatusBanner>
            )}

            {reply?.kind === 'refused' && (
                <StatusBanner tone="danger" title="Vérification impossible" announce="alert">
                    {reply.message}
                </StatusBanner>
            )}

            {found && (
                <section aria-labelledby={`${numberId}-titulaire`} className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface p-4">
                    <h3 id={`${numberId}-titulaire`} className="text-base font-semibold text-fg">Billet {found.ticket_number}</h3>
                    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm text-fg">
                        <dt className="font-semibold">Titulaire</dt>
                        <dd className="break-words text-base font-bold">{found.holder || 'Non renseigné'}</dd>
                        <dt className="font-semibold">Catégorie</dt>
                        <dd className="break-words">{found.category || 'Non renseignée'}</dd>
                        <dt className="font-semibold">Billet</dt>
                        <dd>{found.status_label}</dd>
                        <dt className="font-semibold">Résultat prévu</dt>
                        <dd className="font-semibold">{found.preview_label}</dd>
                    </dl>

                    {admissible ? (
                        <>
                            <label htmlFor={identityId} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border-strong bg-surface-sunken p-3">
                                <input
                                    id={identityId}
                                    type="checkbox"
                                    checked={identityVerified}
                                    onChange={(e) => setIdentityVerified(e.target.checked)}
                                    disabled={disabled || isSubmitting}
                                    aria-describedby={identityHelpId}
                                    className="mt-0.5 h-6 w-6 flex-shrink-0 cursor-pointer rounded border-border-strong accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                                        <IdCard size={18} aria-hidden="true" className="flex-shrink-0 text-fg-muted" />
                                        Pièce d’identité conforme au titulaire
                                    </span>
                                    <span id={identityHelpId} className="text-sm text-fg-muted">
                                        Le nom sur la pièce correspond au titulaire ci-dessus. Obligatoire.
                                    </span>
                                </span>
                            </label>
                            <Button variant="primary" fullWidth size="lg" isLoading={isSubmitting} disabled={!identityVerified || disabled} onClick={() => void handleValidate()}>
                                Pièce conforme, valider l’entrée
                            </Button>
                        </>
                    ) : (
                        <StatusBanner tone="danger" title={`Entrée impossible : ${found.preview_label}`} announce="alert">
                            Ne laissez pas entrer le spectateur avec ce billet.
                        </StatusBanner>
                    )}

                    <Button variant="ghost" fullWidth onClick={() => { setTicketNumber(''); reset(); }} leftIcon={<RotateCcw size={18} />}>
                        Nouvelle vérification
                    </Button>
                </section>
            )}
        </div>
    );
}
