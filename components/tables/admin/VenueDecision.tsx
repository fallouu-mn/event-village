'use client';

/**
 * Lot 11b (administration) : décisions sur un établissement de la réservation de tables (valider, refuser,
 * suspendre, réactiver). Même gabarit que les salles (components/halls/admin/HallDecision.tsx).
 *  - Boutons selon le statut : Valider et Refuser depuis « En attente de validation », Suspendre depuis « Validé »,
 *    Réactiver depuis « Suspendu ». Rien pour un établissement refusé (la partenaire le corrige puis le renvoie).
 *  - Valider est impossible tant que le compte de la partenaire n'est pas validé (règle de la base) : bouton désactivé,
 *    raison dite sous les boutons et lue avec le bouton.
 *  - Valider et réactiver : confirmation. Refuser et suspendre : motif obligatoire (5 caractères au moins, même règle
 *    que la base), envoyé à la partenaire. Envoi : POST /api/admin/venues/[id]/validation { decision, reason? } ;
 *    la route et la base décident, leur message est affiché tel quel en cas de refus.
 *  - Le parent ne monte ce composant qu'avec le droit halls.validate (masquage seulement).
 */

import React, { useId, useState } from 'react';
import { Ban, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { readError } from '@/components/halls/admin/types';

/** Longueur minimale d'un motif de refus ou de suspension (même règle que venue_validation_decide). */
export const VENUE_REASON_MIN_LENGTH = 5;

type Decision = 'VALIDER' | 'REFUSER' | 'SUSPENDRE' | 'REACTIVER';

interface DecisionCopy {
  button: string;
  title: string;
  body: string;
  confirm: string;
  success: string;
}

function upcomingSentence(n: number): string {
  if (n <= 0) return 'Aucune réservation à venir dans cet établissement.';
  return n === 1 ? '1 réservation à venir dans cet établissement.' : `${n} réservations à venir dans cet établissement.`;
}

const OFF_SALE = 'La partenaire l’a retiré de la vente : il restera invisible jusqu’à ce qu’elle le remette en vente.';

function copyFor(decision: Decision, upcoming: number, isActive: boolean): DecisionCopy {
  switch (decision) {
    case 'VALIDER':
      return {
        button: 'Valider l’établissement',
        title: 'Valider l’établissement ?',
        body: isActive
          ? 'L’établissement devient visible et ses tables réservables par les clients. La partenaire est prévenue.'
          : `L’établissement sera validé. ${OFF_SALE} La partenaire est prévenue.`,
        confirm: 'Valider l’établissement',
        success: 'Établissement validé. La partenaire est prévenue.',
      };
    case 'REFUSER':
      return {
        button: 'Refuser',
        title: 'Refuser l’établissement',
        body: 'L’établissement reste invisible des clients. Votre motif est envoyé à la partenaire : elle pourra le corriger puis le renvoyer en validation.',
        confirm: 'Refuser l’établissement',
        success: 'Établissement refusé. Votre motif a été envoyé à la partenaire.',
      };
    case 'SUSPENDRE':
      return {
        button: 'Suspendre',
        title: 'Suspendre l’établissement',
        body: `L’établissement n’est plus visible et plus aucune table ne peut être réservée. Les réservations déjà prises sont maintenues. ${upcomingSentence(upcoming)} Votre motif est envoyé à la partenaire.`,
        confirm: 'Suspendre l’établissement',
        success: 'Établissement suspendu. Les réservations déjà prises sont maintenues et la partenaire est prévenue.',
      };
    case 'REACTIVER':
    default:
      return {
        button: 'Réactiver l’établissement',
        title: 'Réactiver l’établissement ?',
        body: isActive
          ? 'L’établissement redevient visible et ses tables réservables par les clients. La partenaire est prévenue.'
          : `L’établissement sera réactivé. ${OFF_SALE} La partenaire est prévenue.`,
        confirm: 'Réactiver l’établissement',
        success: 'Établissement réactivé. La partenaire est prévenue.',
      };
  }
}

interface VenueDecisionProps {
  venueId: string;
  venueName: string;
  status: string;
  partnerValidated: boolean;
  isActive: boolean;
  upcomingReservations: number;
  /** Relit la fiche après une décision (ou un refus dû à un état qui a changé). */
  onChanged: () => Promise<void> | void;
}

export function VenueDecision({ venueId, venueName, status, partnerValidated, isActive, upcomingReservations, onChanged }: VenueDecisionProps) {
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
      const res = await fetch(`/api/admin/venues/${encodeURIComponent(venueId)}/validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason !== undefined ? { decision, reason } : { decision }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(readError(body) ?? 'La décision n’a pas été enregistrée. Réessayez dans un instant.');
        // L'état a pu changer entre-temps (autre administrateur, établissement modifié) : la fiche est relue.
        void onChanged();
        return;
      }
      toast.success(copyFor(decision, upcomingReservations, isActive).success);
      setConfirmDecision(null);
      setReasonDecision(null);
      await onChanged();
    } catch (err) {
      console.error('[admin/venues/[id]] décision en échec', err);
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
        Aucune décision possible pour l’instant : la partenaire doit corriger l’établissement puis le renvoyer en validation.
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
        message={venueName}
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
        hint={`Au moins ${VENUE_REASON_MIN_LENGTH} caractères. Ce motif est envoyé à la partenaire et reste dans l’historique de l’établissement.`}
        confirmLabel={reasonCopy?.confirm ?? 'Confirmer'}
        variant="danger"
        isLoading={isSubmitting}
        error={actionError ?? undefined}
        minLength={VENUE_REASON_MIN_LENGTH}
      />
    </div>
  );
}
