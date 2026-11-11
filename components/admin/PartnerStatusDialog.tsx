'use client';

import React, { useEffect, useState } from 'react';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';

/**
 * Lot 9 bis, tâche 15 (R6, R55 ; contrat 4.2, 5.15, B16, B37) — suspension et réactivation d'un partenaire depuis sa
 * fiche (modale « Dossier du partenaire » de /admin/dashboard).
 *
 * Envoi : `PATCH /api/admin/partners/[id]/status { status, reason }` (route existante, RPC partner_status_set) :
 *  - « Suspendre » (VALIDE → SUSPENDU, permission partners.suspend) : ses événements en ligne passent SUSPENDU par la
 *    cascade, ses fonds sont gelés, ses sessions fermées ;
 *  - « Réactiver » (SUSPENDU → VALIDE, permission partners.validate) : seuls les événements suspendus par la cascade et
 *    restés tels quels reviennent en ligne.
 * Le motif est obligatoire dans les deux sens (3 à 1 000 caractères ; la RPC revalide, REASON_REQUIRED). Un refus de la
 * route (permission, transition, motif) est affiché dans la boîte, en français, tel que la route le donne ; rien n'est
 * supposé fait sans 200. Le résultat de la cascade (nombres d'événements) est rendu à l'appelant pour le message.
 */

export type PartnerStatusTarget = 'SUSPENDU' | 'VALIDE';

export interface PartnerStatusResult {
  status: PartnerStatusTarget;
  eventsSuspended: number;
  eventsRestored: number;
  eventsLeftSuspended: number;
}

export interface PartnerStatusDialogProps {
  /** Partenaire visé ; `null` ferme la boîte. */
  partner: { id: string; company_name: string } | null;
  /** SUSPENDU : suspendre ; VALIDE : réactiver un partenaire suspendu. */
  target: PartnerStatusTarget;
  onClose: () => void;
  /** Appelé après un 200 de la route, avant la fermeture. */
  onDone: (result: PartnerStatusResult) => void;
}

/** Longueur du motif (contrat 5.15). */
const REASON_MIN = 3;
const REASON_MAX = 1000;

interface StatusResponse {
  partner?: { status?: string };
  events_suspended?: unknown;
  events_restored?: unknown;
  events_left_suspended?: unknown;
}

function countOf(list: unknown): number {
  return Array.isArray(list) ? list.length : 0;
}

const COPY: Record<PartnerStatusTarget, { title: string; description: (name: string) => string; label: string; hint: string; confirm: string }> = {
  SUSPENDU: {
    title: 'Suspendre le partenaire',
    description: (name) => `« ${name} » ne pourra plus vendre : ses événements en ligne sont suspendus et ses fonds sont gelés jusqu’à la réactivation. Il est prévenu avec votre motif.`,
    label: 'Motif de la suspension',
    hint: 'Au moins 3 caractères. Ce motif est communiqué au partenaire et enregistré au journal.',
    confirm: 'Suspendre le partenaire',
  },
  VALIDE: {
    title: 'Réactiver le partenaire',
    description: (name) => `« ${name} » retrouve son compte. Seuls les événements suspendus avec le compte reviennent en ligne ; un événement suspendu pour une autre raison, ou terminé entre-temps, reste suspendu.`,
    label: 'Motif de la réactivation',
    hint: 'Au moins 3 caractères. Ce motif est communiqué au partenaire et enregistré au journal.',
    confirm: 'Réactiver le partenaire',
  },
};

export function PartnerStatusDialog({ partner, target, onClose, onDone }: PartnerStatusDialogProps) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [partner, target]);

  const copy = COPY[target];

  const submit = async (reason: string): Promise<void> => {
    if (!partner || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const body = await sendJson<StatusResponse>(
        `/api/admin/partners/${encodeURIComponent(partner.id)}/status`,
        'PATCH',
        { status: target, reason },
      );
      onDone({
        status: target,
        eventsSuspended: countOf(body.events_suspended),
        eventsRestored: countOf(body.events_restored),
        eventsLeftSuspended: countOf(body.events_left_suspended),
      });
    } catch (err) {
      console.error('[PartnerStatusDialog] changement de statut refusé :', err instanceof ApiError ? `${err.status} ${err.code ?? ''}` : String(err));
      setError(errorMessage(err, 'Le changement de statut a échoué. Réessayez dans un instant.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ReasonDialog
      isOpen={partner !== null}
      onClose={() => {
        if (!isSending) onClose();
      }}
      onConfirm={(reason) => void submit(reason)}
      title={copy.title}
      description={partner ? copy.description(partner.company_name) : undefined}
      label={copy.label}
      hint={copy.hint}
      confirmLabel={copy.confirm}
      variant={target === 'SUSPENDU' ? 'danger' : 'primary'}
      isLoading={isSending}
      error={error ?? undefined}
      minLength={REASON_MIN}
      maxLength={REASON_MAX}
    />
  );
}

export default PartnerStatusDialog;
