'use client';

/**
 * Lot 11b : actions de l'établissement sur une réservation, partagées par le planning du jour et le détail
 * (PATCH /api/partner/tables/reservations/[id] { action, reason?, amount?, method? }).
 *  - « Accepter » et « Client arrivé » : un toucher, sans fenêtre (gestes courants du service, la base revérifie).
 *  - « Refuser » et « Annuler » : motif obligatoire (5 caractères au moins, envoyé au client), ReasonDialog.
 *  - « Client absent » : confirmation (la table est libérée, l'acompte n'est pas rendu).
 *  - « Paiement sur place » : montant (clavier numérique) et moyen ; jamais compté dans les recettes.
 * Un seul envoi à la fois ; message de la route en cas de refus (dans la fenêtre, ou en toast avec « Réessayer »).
 */
import React, { useCallback, useRef, useState } from 'react';
import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { fcfaText, guestsText, hmText } from '@/lib/tables/views';
import {
    actionDoneText, ONSITE_METHODS, REASON_MAX, REASON_MIN, routeMessage, sendReservationAction,
    type ActionResult, type PartnerTableReservationView, type ReservationAction,
} from './venue-api';

type Target = Pick<PartnerTableReservationView, 'id' | 'guests' | 'time' | 'tableNumber' | 'client' | 'onsiteAmount'>;
type DialogKind = 'REFUSER' | 'ANNULER' | 'ABSENT' | 'PAIEMENT_SUR_PLACE';

/** Rappel de la réservation dans les fenêtres : « 4 personnes à 20 h · table 5 · Awa D. ». */
export function reservationSummary(r: Pick<Target, 'guests' | 'time' | 'tableNumber' | 'client'>): string {
    return [`${guestsText(r.guests)} à ${hmText(r.time)}`, r.tableNumber ? `table ${r.tableNumber}` : null, r.client?.name].filter(Boolean).join(' · ');
}

export interface ReservationActions {
    /** Réservation dont une action est en cours d'envoi, sinon null. */
    busyId: string | null;
    busyAction: ReservationAction | null;
    run: (action: ReservationAction, r: Target) => void;
    dialogs: React.ReactNode;
}

export function useReservationActions({ onDone }: { onDone: (action: ReservationAction, r: Target, result: ActionResult) => void }): ReservationActions {
    const toast = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<ReservationAction | null>(null);
    const [dialog, setDialog] = useState<{ kind: DialogKind; r: Target } | null>(null);
    const [dialogError, setDialogError] = useState<string | undefined>(undefined);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<string>('');
    const [fieldErrors, setFieldErrors] = useState<{ amount?: string; method?: string }>({});
    const sending = useRef(false);

    const send = useCallback(async (action: ReservationAction, r: Target, extra: { reason?: string; amount?: number; method?: string } = {}, inDialog = false) => {
        if (sending.current) return;
        sending.current = true;
        setBusyId(r.id);
        setBusyAction(action);
        setDialogError(undefined);
        try {
            const result = await sendReservationAction(r.id, action, extra);
            toast.success(actionDoneText(action, result, fcfaText));
            setDialog(null);
            onDone(action, r, result);
        } catch (err) {
            const message = routeMessage(err, 'Action impossible pour le moment. Réessayez.');
            if (inDialog) setDialogError(message);
            else toast.error(message, { onRetry: () => void send(action, r, extra, false) });
        } finally {
            sending.current = false;
            setBusyId(null);
            setBusyAction(null);
        }
    }, [toast, onDone]);

    const run = useCallback((action: ReservationAction, r: Target) => {
        if (sending.current) return;
        if (action === 'ACCEPTER' || action === 'ARRIVEE') {
            void send(action, r);
            return;
        }
        setDialogError(undefined);
        setFieldErrors({});
        if (action === 'PAIEMENT_SUR_PLACE') {
            setAmount(r.onsiteAmount ? String(r.onsiteAmount) : '');
            setMethod('');
        }
        setDialog({ kind: action, r });
    }, [send]);

    const close = () => {
        if (!sending.current) setDialog(null);
    };

    const submitOnsite = () => {
        if (!dialog) return;
        const digits = amount.replace(/\s+/g, '');
        const errors: { amount?: string; method?: string } = {};
        if (!/^\d+$/.test(digits) || Number(digits) < 1) errors.amount = 'Indiquez le montant payé, en francs CFA, sans centimes.';
        else if (Number(digits) > 10_000_000) errors.amount = 'Le montant ne peut pas dépasser 10 000 000 F CFA.';
        if (!method) errors.method = 'Choisissez le moyen de paiement.';
        setFieldErrors(errors);
        if (errors.amount || errors.method) return;
        void send('PAIEMENT_SUR_PLACE', dialog.r, { amount: Number(digits), method }, true);
    };

    const loading = busyId !== null;
    const summary = dialog ? reservationSummary(dialog.r) : '';

    const dialogs = (
        <>
            <ReasonDialog
                isOpen={dialog?.kind === 'REFUSER'}
                onClose={close}
                onConfirm={(reason) => dialog && void send('REFUSER', dialog.r, { reason }, true)}
                title="Refuser la demande ?"
                description={`${summary}. Le client est prévenu avec votre motif ; s’il a payé un acompte, il lui est rendu en entier.`}
                label="Motif du refus"
                hint={`Au moins ${REASON_MIN} caractères. Il est envoyé au client.`}
                placeholder="Par exemple : nous sommes complets ce soir-là."
                confirmLabel="Refuser la demande"
                cancelLabel="Revenir"
                variant="danger"
                isLoading={loading}
                error={dialogError}
                minLength={REASON_MIN}
                maxLength={REASON_MAX}
            />
            <ReasonDialog
                isOpen={dialog?.kind === 'ANNULER'}
                onClose={close}
                onConfirm={(reason) => dialog && void send('ANNULER', dialog.r, { reason }, true)}
                title="Annuler la réservation ?"
                description={`${summary}. Le client est prévenu avec votre motif et récupère en entier ce qu’il a payé. La table est libérée.`}
                label="Motif de l’annulation"
                hint={`Au moins ${REASON_MIN} caractères. Il est envoyé au client.`}
                placeholder="Par exemple : fermeture imprévue de la terrasse."
                confirmLabel="Annuler la réservation"
                cancelLabel="Garder la réservation"
                variant="danger"
                isLoading={loading}
                error={dialogError}
                minLength={REASON_MIN}
                maxLength={REASON_MAX}
            />
            <ConfirmDialog
                isOpen={dialog?.kind === 'ABSENT'}
                onClose={close}
                onConfirm={() => dialog && void send('ABSENT', dialog.r, {}, true)}
                title="Le client n’est pas venu ?"
                message={summary}
                confirmLabel="Oui, client absent"
                cancelLabel="Revenir"
                variant="warning"
                isLoading={loading}
            >
                <p className="text-sm leading-relaxed text-foreground">
                    La table est libérée tout de suite. L’acompte payé n’est pas rendu au client.
                </p>
                {dialogError && <p role="alert" className="mt-3 text-sm font-medium text-danger-text">{dialogError}</p>}
            </ConfirmDialog>
            <Modal
                isOpen={dialog?.kind === 'PAIEMENT_SUR_PLACE'}
                onClose={close}
                title="Paiement sur place"
                subtitle={summary}
                icon={<Banknote size={20} aria-hidden="true" />}
                maxWidth="md"
                busy={loading}
                sheetOnMobile
                footer={(
                    <>
                        <Button variant="secondary" onClick={close} disabled={loading} className="flex-1 sm:flex-none">Revenir</Button>
                        <Button onClick={submitOnsite} isLoading={loading} disabled={loading} className="flex-1 sm:flex-none">Enregistrer le paiement</Button>
                    </>
                )}
            >
                <form
                    noValidate
                    onSubmit={(e) => { e.preventDefault(); submitOnsite(); }}
                    className="flex flex-col gap-5"
                >
                    <TextInput
                        label="Montant payé (F CFA)"
                        inputMode="numeric"
                        autoComplete="off"
                        pattern="[0-9]*"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ''))}
                        error={fieldErrors.amount}
                        hint={dialog?.r.onsiteAmount ? `Déjà enregistré : ${fcfaText(dialog.r.onsiteAmount)}. Le nouveau montant le remplace.` : 'Ce que le client a réglé à l’établissement.'}
                        required
                        className="tabular-nums"
                    />
                    <fieldset aria-describedby={fieldErrors.method ? 'paiement-moyen-erreur' : undefined}>
                        <legend className="mb-2 text-sm font-semibold text-foreground-strong">Moyen de paiement</legend>
                        <div className="grid grid-cols-2 gap-2">
                            {ONSITE_METHODS.map((m) => (
                                <label
                                    key={m.value}
                                    className={cn(
                                        'flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors duration-fast ease-standard focus-within:ring-2 focus-within:ring-ring',
                                        method === m.value ? 'border-primary bg-primary-soft text-primary-text' : 'border-input bg-card text-foreground-strong hover:bg-muted',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="paiement-moyen"
                                        value={m.value}
                                        checked={method === m.value}
                                        onChange={() => setMethod(m.value)}
                                        className="h-5 w-5 flex-shrink-0 accent-primary"
                                    />
                                    {m.label}
                                </label>
                            ))}
                        </div>
                        {fieldErrors.method && <p id="paiement-moyen-erreur" role="alert" className="mt-2 text-sm font-medium text-danger-text">{fieldErrors.method}</p>}
                    </fieldset>
                    <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                        Noté sur la réservation pour votre suivi. Ce paiement n’est pas encaissé par Event Village et n’apparaît pas dans vos recettes.
                    </p>
                    {dialogError && <p role="alert" className="text-sm font-medium text-danger-text">{dialogError}</p>}
                </form>
            </Modal>
        </>
    );

    return { busyId, busyAction, run, dialogs };
}
