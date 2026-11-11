'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, CircleCheckBig, RotateCcw } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { ErrorState } from '@/components/ui/EmptyState';
import { Textarea, TextInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner, type StatusBannerTone } from '@/components/ui/StatusBanner';
import { ApiError, apiErrorOf } from '@/components/partner/fetch-json';
import { isRecord, readJsonBody } from '@/lib/payments/payment-client';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';

/**
 * « Versements à reprendre » sur /admin/finance (lot 8, A3 ; lot 9 bis, tâche 1 : B1 à B4, contrat 4.1 et 5.1).
 * Tous les versements bloqués, refusés, incertains ou en retard, retraits compris, lus sur
 * GET /api/admin/refunds?state=to_retry (100 lignes au plus, du plus ancien au plus récent, `total` au-delà).
 * Décisions de l'administrateur (refunds.manage), toujours depuis une confirmation avec justification de 10 à
 * 500 caractères, journalisées par le serveur :
 *  - « Renvoyer » (POST /api/admin/cashouts/<id>/resend) n'existe que sous can_resend : rien n'est parti, ou SamirPay
 *    sera relu avant (AFTER_CHECK) ; un versement incertain sans identifiant n'a jamais ce bouton (B2) ;
 *  - « Marquer versé » (POST /api/admin/cashouts/<id>/mark-paid) n'existe que sous can_mark_paid, avec la référence
 *    SamirPay et, si on les connaît, les frais réels.
 * Le refus du serveur (texte `error`, en français) est affiché tel quel. Une réponse perdue est dite « résultat
 * inconnu » et la liste est relue avant toute nouvelle décision.
 */

type CanResend = 'NOW' | 'AFTER_CHECK' | false;
type Action = 'resend' | 'mark-paid';

interface ResumeItem {
  id: string;
  kind: string;
  kind_label: string;
  state: string;
  state_label: string;
  since: string;
  amount: number;
  beneficiary: string | null;
  event_title: string | null;
  block_label: string | null;
  can_resend: CanResend;
  can_mark_paid: boolean;
  /** Conseil du serveur ; absent quand l'état et le motif suffisent. */
  advice: string | null;
}

interface Notice {
  tone: StatusBannerTone;
  title: string;
  text: string;
}

interface Decision {
  item: ResumeItem;
  action: Action;
}

type Phase = 'loading' | 'ready' | 'denied' | 'error';

/** Justification exigée par le serveur (contrat 4.1). */
const REASON_MIN = 10;
const REASON_MAX = 500;

/** Ton du badge par état de la liste ; le libellé vient du serveur (state_label). */
const STATE_VARIANTS: Record<string, BadgeVariant> = {
  ECHOUE: 'danger',
  BLOQUE: 'warning',
  INCERTAIN: 'info',
  EN_ATTENTE: 'warning',
  ENVOYE_NON_CONFIRME: 'info',
};

function isResumeList(body: unknown): body is { items: ResumeItem[]; total: number } {
  return isRecord(body) && Array.isArray(body.items) && typeof body.total === 'number';
}

/** Frais facultatifs : vide → absent ; sinon montant positif ou nul, null s'il est illisible. */
function parseFees(raw: string): number | undefined | null {
  const text = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (text === '') return undefined;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Résultat d'un « Renvoyer » accepté (réponse `{ ok, status }`). */
function resendNotice(reply: unknown): Notice {
  const status = isRecord(reply) && typeof reply.status === 'string' ? reply.status : null;
  if (isRecord(reply) && reply.ok === true) {
    return status === 'CONFIRME'
      ? { tone: 'success', title: 'Versement confirmé', text: 'SamirPay a confirmé le versement : il quitte la liste.' }
      : { tone: 'success', title: 'Versement envoyé', text: 'Le versement est parti : la confirmation de SamirPay est attendue.' };
  }
  return { tone: 'warning', title: 'Versement non parti', text: 'Le renvoi est enregistré, mais le versement n’est pas parti : son nouvel état est affiché dans la liste.' };
}

export interface RefundsToRetryProps {
  /** Change quand l'écran est actualisé : la liste est relue avec lui. */
  refreshToken?: number;
}

export function RefundsToRetry({ refreshToken = 0 }: RefundsToRetryProps) {
  const headingId = useId();
  const fieldId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const seq = useRef(0);
  const [items, setItems] = useState<ResumeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [fees, setFees] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setIsRefreshing(true);
    setPhase((current) => (current === 'ready' ? current : 'loading'));
    try {
      const res = await fetch('/api/admin/refunds?state=to_retry', { cache: 'no-store' });
      if (mine !== seq.current) return;
      if (res.status === 403) {
        setPhase('denied');
        return;
      }
      if (!res.ok) throw await apiErrorOf(res);
      const body: unknown = await res.json();
      if (mine !== seq.current) return;
      if (!isResumeList(body)) throw new Error('réponse inattendue de /api/admin/refunds');
      setItems(body.items);
      setTotal(body.total);
      setLoadError(null);
      setPhase('ready');
    } catch (err) {
      if (mine !== seq.current) return;
      console.error('[versements à reprendre] lecture impossible :', err);
      setLoadError(err instanceof ApiError ? err.message : 'Connexion impossible : vérifiez votre réseau, puis réessayez.');
      setPhase('error');
    } finally {
      if (mine === seq.current) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const openDecision = (item: ResumeItem, action: Action) => {
    setReason('');
    setReference('');
    setFees('');
    setRefusal(null);
    setDecision({ item, action });
  };

  const closeDecision = () => {
    if (!isSending) setDecision(null);
  };

  const feesValue = parseFees(fees);
  const reasonReady = reason.trim().length >= REASON_MIN;
  const referenceReady = decision?.action !== 'mark-paid' || reference.trim() !== '';
  const feesReady = decision?.action !== 'mark-paid' || feesValue !== null;

  /** Décision envoyée au serveur ; un refus de saisie (400) reste dans la boîte, tout autre résultat la ferme. */
  const decide = async () => {
    if (!decision || isSending) return;
    const { item, action } = decision;
    setIsSending(true);
    setRefusal(null);
    let result: Notice | null = null;
    try {
      const payload = action === 'resend'
        ? { reason: reason.trim() }
        : { reason: reason.trim(), reference: reference.trim(), fees: feesValue ?? undefined };
      const url = action === 'resend'
        ? `/api/admin/cashouts/${encodeURIComponent(item.id)}/resend`
        : `/api/admin/cashouts/${encodeURIComponent(item.id)}/mark-paid`;
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await readJsonBody(res, `versement ${item.id} / ${action}`);
      if (res.ok) {
        result = action === 'resend'
          ? resendNotice(body)
          : { tone: 'success', title: 'Versement marqué versé', text: 'Le versement est confirmé avec la référence indiquée : il quitte la liste.' };
      } else {
        const message = isRecord(body) && typeof body.error === 'string' && body.error.trim() !== ''
          ? body.error
          : `Décision refusée par le serveur (erreur ${res.status}). Relisez la liste avant de recommencer.`;
        if (res.status === 400) {
          setRefusal(message);
          return;
        }
        result = { tone: 'danger', title: action === 'resend' ? 'Renvoi refusé' : 'Marquage refusé', text: message };
      }
    } catch (err) {
      console.error(`[versements à reprendre] décision ${action} sur ${item.id} sans réponse lisible :`, err);
      result = { tone: 'warning', title: 'Résultat inconnu', text: 'La réponse du serveur n’est pas arrivée : la décision a pu être prise. Relisez la liste avant de recommencer.' };
    } finally {
      setIsSending(false);
    }
    setDecision(null);
    setNotice(result);
    await load();
    headingRef.current?.focus();
  };

  const actionsOf = (item: ResumeItem) => (
    <div className="flex flex-col items-stretch gap-2 md:items-start">
      {item.advice && <p className="text-sm leading-relaxed text-fg-muted">{item.advice}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {item.can_resend !== false && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={16} aria-hidden="true" />}
            disabled={isRefreshing}
            aria-label={`Renvoyer le versement de ${formatFcfa(item.amount)}`}
            onClick={() => openDecision(item, 'resend')}
            className="w-full sm:w-auto"
          >
            Renvoyer
          </Button>
        )}
        {item.can_mark_paid && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<CircleCheckBig size={16} aria-hidden="true" />}
            disabled={isRefreshing}
            aria-label={`Marquer versé le versement de ${formatFcfa(item.amount)}`}
            onClick={() => openDecision(item, 'mark-paid')}
            className="w-full sm:w-auto"
          >
            Marquer versé
          </Button>
        )}
      </div>
    </div>
  );

  const stateCell = (item: ResumeItem) => (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={STATE_VARIANTS[item.state] ?? 'neutral'} size="sm">{item.state_label}</Badge>
      {item.block_label && <span className="text-sm text-fg-muted">{item.block_label}</span>}
    </div>
  );

  const sinceCell = (item: ResumeItem) => (
    <time dateTime={item.since} className="whitespace-nowrap text-sm tabular-nums text-fg-muted">{formatDateTime(item.since)}</time>
  );

  const whatCell = (item: ResumeItem) => (
    <div className="min-w-0 break-words">
      <p className="text-fg">{item.kind_label}</p>
      {item.event_title && <p className="text-fg-muted">{item.event_title}</p>}
    </div>
  );

  const beneficiaryOf = (item: ResumeItem) => item.beneficiary ?? 'Bénéficiaire inconnu';

  const columns: DataColumn<ResumeItem>[] = [
    { key: 'amount', header: 'Montant', align: 'right', render: (item) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatFcfa(item.amount)}</span> },
    { key: 'what', header: 'Versement', render: whatCell },
    { key: 'beneficiary', header: 'Bénéficiaire', render: (item) => <span className="tabular-nums">{beneficiaryOf(item)}</span> },
    { key: 'state', header: 'État', render: stateCell },
    { key: 'since', header: 'Depuis le', render: sinceCell },
    { key: 'action', header: 'Reprise', render: actionsOf, className: 'min-w-[16rem]' },
  ];

  const renderCard = (item: ResumeItem) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold tabular-nums text-fg">{formatFcfa(item.amount)}</p>
        <div className="flex-shrink-0">
          <Badge variant={STATE_VARIANTS[item.state] ?? 'neutral'} size="sm">{item.state_label}</Badge>
        </div>
      </div>
      <div className="text-sm">{whatCell(item)}</div>
      {item.block_label && <p className="text-sm text-fg-muted">{item.block_label}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm tabular-nums text-fg">{beneficiaryOf(item)}</span>
        {sinceCell(item)}
      </div>
      {actionsOf(item)}
    </div>
  );

  const target = decision?.item ?? null;
  const isMarkPaid = decision?.action === 'mark-paid';
  const dialogMessage = !decision
    ? undefined
    : isMarkPaid
      ? 'Vérifiez auprès du support SamirPay que ce versement est bien parti, puis indiquez sa référence. Il sera confirmé sans nouvel envoi.'
      : decision.item.can_resend === 'AFTER_CHECK'
        ? 'Le statut SamirPay est relu d’abord : le versement ne repart que s’il a échoué.'
        : 'Le versement repart vers ce bénéficiaire dès votre confirmation.';

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-fg focus:outline-none">Versements à reprendre</h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
        </p>
      </div>

      {notice && (
        <StatusBanner tone={notice.tone} title={notice.title} announce={notice.tone === 'success' ? 'status' : 'alert'}>
          {notice.text}
        </StatusBanner>
      )}

      {phase === 'loading' && (
        <div role="status" aria-busy="true" aria-label="Chargement des versements à reprendre" className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {phase === 'denied' && (
        <StatusBanner tone="neutral" title="Reprise des versements réservée">
          Votre compte n’a pas la permission de gérer les remboursements et les versements.
        </StatusBanner>
      )}

      {phase === 'error' && (
        <ErrorState title="Liste indisponible" description={loadError ?? undefined} onRetry={() => void load()} isRetrying={isRefreshing} />
      )}

      {phase === 'ready' && (items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <CheckCircle2 size={18} className="flex-shrink-0 text-success-fg" aria-hidden="true" />
          Aucun versement à reprendre.
        </p>
      ) : (
        <DataList items={items} columns={columns} getKey={(item) => item.id} caption="Versements à reprendre" renderCard={renderCard} />
      ))}

      {phase === 'ready' && total > items.length && (
        <StatusBanner tone="info" title="Liste incomplète">
          Seuls les <span className="tabular-nums">{formatInteger(items.length)}</span> versements les plus anciens sur <span className="tabular-nums">{formatInteger(total)}</span> sont affichés. Traitez-les pour voir les suivants.
        </StatusBanner>
      )}

      <ConfirmDialog
        isOpen={decision !== null}
        onClose={closeDecision}
        onConfirm={() => void decide()}
        title={isMarkPaid ? 'Marquer ce versement versé ?' : 'Renvoyer ce versement ?'}
        message={dialogMessage}
        confirmLabel={isMarkPaid ? 'Marquer versé' : 'Renvoyer'}
        variant="warning"
        maxWidth="md"
        isLoading={isSending}
        confirmDisabled={!reasonReady || !referenceReady || !feesReady}
      >
        {target && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-fg-muted">Montant</dt>
              <dd className="font-semibold tabular-nums text-fg">{formatFcfa(target.amount)}</dd>
              <dt className="text-fg-muted">Versement</dt>
              <dd className="min-w-0 break-words text-fg">{target.kind_label}{target.event_title ? ` · ${target.event_title}` : ''}</dd>
              <dt className="text-fg-muted">Bénéficiaire</dt>
              <dd className="min-w-0 break-words tabular-nums text-fg">{beneficiaryOf(target)}</dd>
              <dt className="text-fg-muted">État</dt>
              <dd className="min-w-0 break-words text-fg">{target.block_label ? `${target.state_label} : ${target.block_label}` : target.state_label}</dd>
            </dl>
            <Textarea
              id={`${fieldId}-raison`}
              label="Justification"
              required
              rows={3}
              maxLength={REASON_MAX}
              showCount
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSending}
              hint={`${REASON_MIN} caractères au moins, gardée au journal des décisions.`}
              data-autofocus="true"
            />
            {isMarkPaid && (
              <>
                <TextInput
                  id={`${fieldId}-reference`}
                  label="Référence SamirPay"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={isSending}
                  autoComplete="off"
                  spellCheck={false}
                  hint="Référence de la transaction (TX suivi de 8 caractères) ou son identifiant, lue dans le tableau de bord SamirPay."
                />
                <TextInput
                  id={`${fieldId}-frais`}
                  label="Frais SamirPay (F CFA), facultatif"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  disabled={isSending}
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  hint="Frais réellement prélevés, s’ils sont connus."
                  error={feesValue === null ? 'Indiquez un montant positif ou nul, ou laissez vide.' : undefined}
                />
              </>
            )}
            {refusal && (
              <StatusBanner tone="danger" title="Décision refusée" announce="alert">
                {refusal}
              </StatusBanner>
            )}
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}
