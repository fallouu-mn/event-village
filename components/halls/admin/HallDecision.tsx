'use client';

/**
 * Lot 10b (point 4) : décisions de l'administration sur une salle de fête (valider, refuser, suspendre, réactiver).
 *  - Boutons selon le statut : VALIDER et REFUSER depuis « En attente de validation », SUSPENDRE depuis « Validée »,
 *    REACTIVER depuis « Suspendue ». Rien pour une salle refusée (la partenaire la corrige puis la renvoie).
 *  - Valider est impossible tant que le compte de la partenaire n'est pas validé : le bouton est désactivé et la
 *    raison est dite sous les boutons (lue avec le bouton).
 *  - Valider et réactiver : confirmation. Refuser et suspendre : motif obligatoire (5 caractères au moins), envoyé à
 *    la partenaire. Envoi : POST /api/admin/halls/[id]/validation { decision, reason? } ; la route et la base décident.
 *  - Le parent ne monte ce composant que si l'administrateur a le droit halls.validate (masquage seulement).
 */

import React, { useId, useState } from 'react';
import { Ban, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { readError } from './types';

/** Longueur minimale d'un motif de refus ou de suspension (même règle que la route). */
export const HALL_REASON_MIN_LENGTH = 5;

type Decision = 'VALIDER' | 'REFUSER' | 'SUSPENDRE' | 'REACTIVER';

interface DecisionCopy {
  button: string;
  title: string;
  body: string;
  confirm: string;
  success: string;
}

function upcomingText(n: number): string {
  if (n <= 0) return 'Aucune réservation à venir sur cette salle.';
  return n === 1 ? '1 réservation à venir sur cette salle.' : `${n} réservations à venir sur cette salle.`;
}

function copyFor(decision: Decision, upcoming: number, isActive: boolean): DecisionCopy {
  switch (decision) {
    case 'VALIDER':
      return {
        button: 'Valider la salle',
        title: 'Valider la salle ?',
        body: isActive
          ? 'La salle devient visible et réservable par les clients. La partenaire est prévenue.'
          : 'La salle sera validée. La partenaire l’a retirée de la vente : elle restera invisible jusqu’à ce que la partenaire la remette en vente. La partenaire est prévenue.',
        confirm: 'Valider la salle',
        success: 'Salle validée. La partenaire est prévenue.',
      };
    case 'REFUSER':
      return {
        button: 'Refuser',
        title: 'Refuser la salle',
        body: 'La salle reste invisible des clients. Votre motif est envoyé à la partenaire : elle pourra corriger sa salle puis la renvoyer en validation.',
        confirm: 'Refuser la salle',
        success: 'Salle refusée. Votre motif a été envoyé à la partenaire.',
      };
    case 'SUSPENDRE':
      return {
        button: 'Suspendre',
        title: 'Suspendre la salle',
        body: `La salle n’est plus visible ni réservable. Les réservations déjà payées sont maintenues. ${upcomingText(upcoming)} Votre motif est envoyé à la partenaire.`,
        confirm: 'Suspendre la salle',
        success: 'Salle suspendue. Les réservations déjà payées sont maintenues et la partenaire est prévenue.',
      };
    case 'REACTIVER':
    default:
      return {
        button: 'Réactiver la salle',
        title: 'Réactiver la salle ?',
        body: isActive
          ? 'La salle redevient visible et réservable par les clients. La partenaire est prévenue.'
          : 'La salle sera réactivée. La partenaire l’a retirée de la vente : elle restera invisible jusqu’à ce que la partenaire la remette en vente. La partenaire est prévenue.',
        confirm: 'Réactiver la salle',
        success: 'Salle réactivée. La partenaire est prévenue.',
      };
  }
}

interface HallDecisionProps {
  hallId: string;
  hallName: string;
  status: string;
  partnerValidated: boolean;
  isActive: boolean;
  upcomingReservations: number;
  /** Relit la fiche après une décision (ou un refus dû à un état qui a changé). */
  onChanged: () => Promise<void> | void;
}

export function HallDecision({ hallId, hallName, status, partnerValidated, isActive, upcomingReservations, onChanged }: HallDecisionProps) {
  const toast = useToast();
  const blockedId = useId();
  const [confirmDecision, setConfirmDecision] = useState<Decision | null>(null);
  const [reasonDecision, setReasonDecision] = useState<Decision | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPending = status === 'EN_ATTENTE_VALIDATION';
  const validateBlocked = isPending && !partnerValidated;

  const open = (decision: Decision): void => {
    setActionError(null);
    if (decision === 'REFUSER' || decision === 'SUSPENDRE') setReasonDecision(decision);
    else setConfirmDecision(decision);
  };

  const close = (): void => {
    if (isSubmitting) return;
    setConfirmDecision(null);
    setReasonDecision(null);
    setActionError(null);
  };

  const send = async (decision: Decision, reason?: string): Promise<void> => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/halls/${encodeURIComponent(hallId)}/validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason !== undefined ? { decision, reason } : { decision }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(readError(body) ?? 'La décision n’a pas été enregistrée. Réessayez dans un instant.');
        // L'état a pu changer entre-temps (autre administrateur, salle modifiée) : la fiche est relue.
        void onChanged();
        return;
      }
      toast.success(copyFor(decision, upcomingReservations, isActive).success);
      setConfirmDecision(null);
      setReasonDecision(null);
      await onChanged();
    } catch (err) {
      console.error('[admin/halls/[id]] décision en échec', err);
      setActionError('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const decisions: Decision[] = isPending
    ? ['VALIDER', 'REFUSER']
    : status === 'VALIDEE'
      ? ['SUSPENDRE']
      : status === 'SUSPENDUE'
        ? ['REACTIVER']
        : [];

  const confirmCopy = confirmDecision ? copyFor(confirmDecision, upcomingReservations, isActive) : null;
  const reasonCopy = reasonDecision ? copyFor(reasonDecision, upcomingReservations, isActive) : null;

  if (decisions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune décision possible pour l’instant : la partenaire doit corriger la salle puis la renvoyer en validation.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {decisions.map((d) => {
          const c = copyFor(d, upcomingReservations, isActive);
          if (d === 'VALIDER') {
            return (
              <Button
                key={d}
                variant="primary"
                leftIcon={<CheckCircle2 size={18} />}
                onClick={() => open(d)}
                disabled={validateBlocked || isSubmitting}
                aria-describedby={validateBlocked ? blockedId : undefined}
              >
                {c.button}
              </Button>
            );
          }
          if (d === 'REACTIVER') {
            return (
              <Button key={d} variant="primary" leftIcon={<RotateCcw size={18} />} onClick={() => open(d)} disabled={isSubmitting}>
                {c.button}
              </Button>
            );
          }
          return (
            <Button
              key={d}
              variant="secondary"
              leftIcon={d === 'REFUSER' ? <XCircle size={18} /> : <Ban size={18} />}
              onClick={() => open(d)}
              disabled={isSubmitting}
            >
              {c.button}
            </Button>
          );
        })}
      </div>

      {validateBlocked && (
        <p id={blockedId} className="text-sm text-warning-text">
          Validation impossible : le compte de la partenaire n’est pas encore validé. Validez d’abord son compte.
        </p>
      )}

      <ConfirmDialog
        isOpen={!!confirmDecision}
        onClose={close}
        onConfirm={() => {
          if (confirmDecision) void send(confirmDecision);
        }}
        title={confirmCopy?.title ?? 'Confirmer'}
        message={hallName}
        confirmLabel={confirmCopy?.confirm ?? 'Confirmer'}
        isLoading={isSubmitting}
        maxWidth="md"
      >
        <p className="text-base leading-relaxed text-foreground-strong">{confirmCopy?.body}</p>
        {actionError && (
          <StatusBanner tone="danger" title="Décision impossible" announce="alert">
            {actionError}
          </StatusBanner>
        )}
      </ConfirmDialog>

      <ReasonDialog
        isOpen={!!reasonDecision}
        onClose={close}
        onConfirm={(reason) => {
          if (reasonDecision) void send(reasonDecision, reason);
        }}
        title={reasonCopy?.title ?? 'Motif'}
        description={reasonCopy?.body}
        label={reasonDecision === 'SUSPENDRE' ? 'Motif de la suspension' : 'Motif du refus'}
        hint={`Au moins ${HALL_REASON_MIN_LENGTH} caractères. Ce motif est envoyé à la partenaire et reste dans l’historique de la salle.`}
        confirmLabel={reasonCopy?.confirm ?? 'Confirmer'}
        variant="danger"
        isLoading={isSubmitting}
        error={actionError ?? undefined}
        minLength={HALL_REASON_MIN_LENGTH}
      />
    </div>
  );
}
