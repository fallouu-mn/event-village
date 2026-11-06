'use client';

import React, { useState } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatDateTime, formatFcfa } from '@/lib/format';

/**
 * Lot 8 (8.1, contrat 5.3, L75) — panneau d'un paiement simulé, affiché par /dev/paiements/[id] et capturé par
 * scripts/e2e/render-dev-page.tsx (rendu statique : `payment` seul, boutons présents et inertes).
 *
 * Présentation pure : ni appel réseau ni état serveur ici. La décision vient de `onDecide`, action serveur donnée par
 * la page, qui rend un message déjà rédigé ; l'état local ne sert qu'à montrer l'attente et ce message. `useFormStatus`
 * est écarté : le react-dom stable du script de capture ne l'a pas. Aucune page de production n'importe ce fichier.
 */
export interface FakePayment {
  id: string;
  amount: number;
  /** Libellé de l'opérateur (Wave, Orange Money), jamais le code du faux service. */
  operator: string;
  /** Numéro déjà masqué par le faux service. */
  phone: string;
  status: string;
  createdAt: string;
}

export type FakePaymentDecision = 'validate' | 'refuse';

export interface FakePaymentOutcome {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  detail: string;
  /** Validation à relancer : le faux service a déjà noté le succès, mais son webhook n'est pas parti. */
  retry?: boolean;
  /** Ajoute le lien vers Mes billets. */
  tickets?: boolean;
}

export interface FakePaymentPanelProps {
  payment: FakePayment;
  onDecide?: (decision: FakePaymentDecision) => Promise<FakePaymentOutcome>;
}

const STATE_META: Readonly<Record<string, { label: string; variant: BadgeVariant }>> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  SUCCESS: { label: 'Validé', variant: 'success' },
  FAILED: { label: 'Refusé', variant: 'danger' },
};
const UNKNOWN_STATE = { label: 'État inconnu', variant: 'neutral' } as const;

const NO_ANSWER: FakePaymentOutcome = {
  tone: 'danger',
  title: 'Action impossible',
  detail: 'Le serveur de développement n’a pas répondu. Vérifiez qu’il tourne toujours, puis réessayez.',
};

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-3">
    <dt className="flex-shrink-0 text-sm text-fg-muted">{label}</dt>
    <dd className="min-w-0 text-right text-sm font-medium text-fg">{children}</dd>
  </div>
);

export function FakePaymentPanel({ payment, onDecide }: FakePaymentPanelProps) {
  const [running, setRunning] = useState<FakePaymentDecision | null>(null);
  const [outcome, setOutcome] = useState<FakePaymentOutcome | null>(null);

  const state = STATE_META[payment.status] ?? UNKNOWN_STATE;
  const pending = payment.status === 'PENDING';
  const canValidate = pending || outcome?.retry === true;

  const decide = async (decision: FakePaymentDecision): Promise<void> => {
    if (!onDecide) return;
    setRunning(decision);
    setOutcome(null);
    try {
      setOutcome(await onDecide(decision));
    } catch (err) {
      console.error('[dev/paiements] action sans réponse :', err);
      setOutcome(NO_ANSWER);
    } finally {
      setRunning(null);
    }
  };

  return (
    <section aria-labelledby="fake-payment-title" className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <StatusBanner tone="warning" title="Paiement simulé : aucun argent réel">
        Cette page remplace l’écran de l’opérateur pendant vos essais.
      </StatusBanner>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="fake-payment-title" className="text-sm font-medium text-fg-muted">Montant à payer</h2>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-fg">{formatFcfa(payment.amount)}</p>
        </div>
        <Badge variant={state.variant}>{state.label}</Badge>
      </div>

      <dl className="divide-y divide-border border-y border-border">
        <Detail label="Opérateur">{payment.operator}</Detail>
        <Detail label="Téléphone"><span className="tabular-nums">{payment.phone}</span></Detail>
        <Detail label="Créé le"><time dateTime={payment.createdAt} className="tabular-nums">{formatDateTime(payment.createdAt)}</time></Detail>
        <Detail label="Référence"><span className="break-all">{payment.id}</span></Detail>
      </dl>

      {outcome && (
        <StatusBanner
          tone={outcome.tone}
          title={outcome.title}
          announce="alert"
          action={outcome.tickets ? <LinkButton href="/tickets" variant="secondary">Voir mes billets</LinkButton> : undefined}
        >
          {outcome.detail}
        </StatusBanner>
      )}

      {!canValidate && !outcome && (
        <p className="text-sm leading-relaxed text-fg-muted">Ce paiement est déjà traité : plus aucune action n’est possible.</p>
      )}

      {canValidate && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" fullWidth className="sm:flex-1" isLoading={running === 'validate'} disabled={running !== null} onClick={() => decide('validate')}>
            Valider le paiement
          </Button>
          {pending && (
            <Button type="button" variant="secondary" fullWidth className="sm:flex-1" isLoading={running === 'refuse'} disabled={running !== null} onClick={() => decide('refuse')}>
              Refuser le paiement
            </Button>
          )}
        </div>
      )}

      {/* Toujours présent : une région d'annonce ajoutée au moment de l'attente ne serait pas lue. */}
      <p role="status" className="-mt-3 min-h-5 text-sm text-fg-muted">
        {running ? 'Traitement en cours : le premier essai peut prendre plusieurs secondes.' : ''}
      </p>
    </section>
  );
}
