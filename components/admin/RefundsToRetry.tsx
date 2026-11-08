'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner, type StatusBannerTone } from '@/components/ui/StatusBanner';
import { ApiError, apiErrorOf } from '@/components/partner/fetch-json';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';

/**
 * Lot 8, anomalie A3 (contrat 3.10, 13.4) — remboursements à reprendre sur /admin/finance : envois en échec, bloqués
 * ou à l'issue incertaine, lus sur GET /api/admin/refunds?state=to_retry. « Relancer » n'existe que sous can_retry et
 * ne part que d'une confirmation. Le résultat vient du corps de la réponse (`success`, `message`) : la route répond
 * 200 même quand l'argent n'est pas parti. Sans réponse, le résultat est dit inconnu et la liste est relue avant toute
 * nouvelle relance. Une issue incertaine n'a jamais de bouton : l'argent a pu partir.
 */

type RefundState = 'ECHOUE' | 'BLOQUE' | 'INCERTAIN';

interface RefundItem {
  refund_id: string | null;
  cashout_id: string;
  kind: string;
  amount: number;
  state: RefundState;
  reason_label: string | null;
  event_title: string | null;
  phone_masked: string | null;
  created_at: string;
  can_retry: boolean;
}

interface Notice {
  tone: StatusBannerTone;
  title: string;
  text: string;
}

type Phase = 'loading' | 'ready' | 'denied' | 'error';

const STATE_META: Record<RefundState, { label: string; variant: BadgeVariant }> = {
  ECHOUE: { label: 'Envoi en échec', variant: 'danger' },
  BLOQUE: { label: 'Bloqué', variant: 'warning' },
  INCERTAIN: { label: 'Issue incertaine', variant: 'info' },
};

const UNKNOWN_STATE = { label: 'État à vérifier', variant: 'neutral' as BadgeVariant };

const KIND_LABELS: Record<string, string> = {
  REFUND: 'Remboursement d’un paiement',
  EVENT_CANCELLATION_REFUND: 'Annulation d’événement',
  TICKET_REFUND: 'Remboursement d’un billet',
};

function isRefundList(body: unknown): body is { items: RefundItem[]; truncated: boolean } {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return Array.isArray(b.items) && typeof b.truncated === 'boolean';
}

function stateOf(item: RefundItem) {
  return STATE_META[item.state] ?? UNKNOWN_STATE;
}

function eventOf(item: RefundItem): string {
  return item.event_title ?? 'Événement non rattaché';
}

function phoneOf(item: RefundItem): string {
  return item.phone_masked ?? 'Numéro inconnu';
}

function replyText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

export interface RefundsToRetryProps {
  /** Change quand l'écran est actualisé : la liste est relue avec lui. */
  refreshToken?: number;
}

export function RefundsToRetry({ refreshToken = 0 }: RefundsToRetryProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const seq = useRef(0);
  const [items, setItems] = useState<RefundItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [target, setTarget] = useState<RefundItem | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

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
      if (!isRefundList(body)) throw new Error('réponse inattendue de /api/admin/refunds');
      setItems(body.items);
      setTruncated(body.truncated);
      setLoadError(null);
      setPhase('ready');
    } catch (err) {
      if (mine !== seq.current) return;
      console.error('[remboursements à reprendre] lecture impossible :', err);
      setLoadError(err instanceof ApiError ? err.message : 'Connexion impossible : vérifiez votre réseau, puis réessayez.');
      setPhase('error');
    } finally {
      if (mine === seq.current) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const retry = async (refundId: string) => {
    setIsSending(true);
    setNotice(null);
    let result: Notice;
    try {
      const res = await fetch(`/api/admin/refunds/${encodeURIComponent(refundId)}/retry`, { method: 'POST', cache: 'no-store' });
      if (res.ok) {
        const reply = (await res.json()) as { success?: unknown; message?: unknown };
        result = reply.success === true
          ? { tone: 'success', title: 'Relance envoyée', text: replyText(reply.message, 'Le remboursement est parti.') }
          : { tone: 'warning', title: 'Remboursement non relancé', text: replyText(reply.message, 'Le serveur n’a pas confirmé l’envoi. Relisez la liste avant de recommencer.') };
      } else {
        // Le 403 de verifyAdminAuth nomme la permission technique : il ne s'affiche pas tel quel.
        const text = res.status === 403 ? 'Votre compte n’a plus la permission de gérer les remboursements.' : (await apiErrorOf(res)).message;
        result = { tone: 'danger', title: 'Relance refusée', text };
      }
    } catch (err) {
      console.error(`[remboursements à reprendre] relance ${refundId} sans réponse lisible :`, err);
      result = { tone: 'warning', title: 'Résultat inconnu', text: 'La réponse du serveur n’est pas arrivée : le remboursement a pu partir. Relisez la liste avant de recommencer.' };
    }
    setIsSending(false);
    setTarget(null);
    setNotice(result);
    await load();
    headingRef.current?.focus();
  };

  const actionOf = (item: RefundItem) => (item.can_retry ? (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={<RotateCcw size={16} aria-hidden="true" />}
      disabled={isRefreshing}
      aria-label={`Relancer le remboursement de ${formatFcfa(item.amount)}`}
      onClick={() => setTarget(item)}
      className="w-full md:w-auto"
    >
      Relancer
    </Button>
  ) : (
    <p className="text-sm leading-relaxed text-fg-muted">
      {item.state === 'INCERTAIN'
        ? 'À vérifier auprès de SamirPay avant toute décision : l’argent a pu partir.'
        : 'Aucune relance possible depuis cet écran.'}
    </p>
  ));

  const stateCell = (item: RefundItem) => (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={stateOf(item).variant} size="sm">{stateOf(item).label}</Badge>
      {item.reason_label && <span className="text-sm text-fg-muted">{item.reason_label}</span>}
    </div>
  );

  const createdAt = (item: RefundItem) => (
    <time dateTime={item.created_at} className="whitespace-nowrap text-sm tabular-nums text-fg-muted">{formatDateTime(item.created_at)}</time>
  );

  const columns: DataColumn<RefundItem>[] = [
    { key: 'amount', header: 'Montant', align: 'right', render: (item) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatFcfa(item.amount)}</span> },
    {
      key: 'event',
      header: 'Événement',
      render: (item) => (
        <div className="min-w-0 break-words">
          <p>{eventOf(item)}</p>
          <p className="text-fg-muted">{KIND_LABELS[item.kind] ?? 'Remboursement'}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Numéro', render: (item) => <span className="whitespace-nowrap tabular-nums">{phoneOf(item)}</span> },
    { key: 'state', header: 'État', render: stateCell },
    { key: 'created', header: 'Créé le', render: createdAt },
    { key: 'action', header: 'Reprise', render: actionOf },
  ];

  const renderCard = (item: RefundItem) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold tabular-nums text-fg">{formatFcfa(item.amount)}</p>
        <div className="flex-shrink-0">
          <Badge variant={stateOf(item).variant} size="sm">{stateOf(item).label}</Badge>
        </div>
      </div>
      <div className="min-w-0 break-words">
        <p className="text-sm text-fg">{eventOf(item)}</p>
        <p className="text-sm text-fg-muted">{KIND_LABELS[item.kind] ?? 'Remboursement'}</p>
      </div>
      {item.reason_label && <p className="text-sm text-fg-muted">{item.reason_label}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm tabular-nums text-fg">{phoneOf(item)}</span>
        {createdAt(item)}
      </div>
      {actionOf(item)}
    </div>
  );

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-fg focus:outline-none">Remboursements à reprendre</h2>
        <p className="text-sm leading-relaxed text-fg-muted">Envois en échec, bloqués ou à l’issue incertaine, du plus ancien au plus récent.</p>
      </div>

      {notice && (
        <StatusBanner tone={notice.tone} title={notice.title} announce={notice.tone === 'success' ? 'status' : 'alert'}>
          {notice.text}
        </StatusBanner>
      )}

      {phase === 'loading' && (
        <div role="status" aria-busy="true" aria-label="Chargement des remboursements à reprendre" className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {phase === 'denied' && (
        <StatusBanner tone="neutral" title="Reprise des remboursements réservée">
          Votre compte n’a pas la permission de gérer les remboursements.
        </StatusBanner>
      )}

      {phase === 'error' && (
        <ErrorState title="Liste indisponible" description={loadError ?? undefined} onRetry={() => void load()} isRetrying={isRefreshing} />
      )}

      {phase === 'ready' && (items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <CheckCircle2 size={18} className="flex-shrink-0 text-success-fg" aria-hidden="true" />
          Aucun envoi en échec, bloqué ou incertain.
        </p>
      ) : (
        <DataList items={items} columns={columns} getKey={(item) => item.cashout_id} caption="Remboursements à reprendre" renderCard={renderCard} />
      ))}

      {phase === 'ready' && truncated && (
        <StatusBanner tone="info" title="Liste incomplète">
          Seules les <span className="tabular-nums">{formatInteger(items.length)}</span> lignes les plus anciennes sont affichées. Traitez-les pour voir les suivantes.
        </StatusBanner>
      )}

      <ConfirmDialog
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => {
          if (target?.refund_id) void retry(target.refund_id);
        }}
        title="Relancer ce remboursement ?"
        message="Le versement repart vers ce numéro dès votre confirmation."
        confirmLabel="Relancer"
        variant="warning"
        isLoading={isSending}
      >
        {target && (
          <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-fg-muted">Montant</dt>
            <dd className="font-semibold tabular-nums text-fg">{formatFcfa(target.amount)}</dd>
            <dt className="text-fg-muted">Événement</dt>
            <dd className="min-w-0 break-words text-fg">{eventOf(target)}</dd>
            <dt className="text-fg-muted">Numéro</dt>
            <dd className="tabular-nums text-fg">{phoneOf(target)}</dd>
            {target.reason_label && (
              <>
                <dt className="text-fg-muted">Motif</dt>
                <dd className="min-w-0 break-words text-fg">{target.reason_label}</dd>
              </>
            )}
          </dl>
        )}
      </ConfirmDialog>
    </section>
  );
}
