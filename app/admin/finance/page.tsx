'use client';

/**
 * Finance de l'administration — finition 3a (E-06, E-07, E-30, E-31, E-38).
 *
 * En tête, une seule période pour toute la page (calculée par le serveur en heure de Dakar), puis trois chiffres et les
 * créances, chacun avec une phrase simple, la date qu'il utilise et un lien vers son détail :
 *  - « Gagné par Event Village » (période) ;
 *  - « Dû aux partenaires » (à l'instant, grand livre) ;
 *  - « Retirable par Event Village » (SUPERADMIN seulement ; solde SamirPay lu par le serveur, cache de 5 minutes) ;
 *  - « Créances » (bloc à part, jamais déduit).
 * Puis l'argent qui attend (versements à reprendre, remboursements à verser, créances), le détail de chaque chiffre et la
 * liste des paiements encaissés, paginée par le serveur, dont le filtre de statut ne change que la liste.
 * Aucun calcul ici : tout vient de GET /api/admin/finance/* (lib/finance). Les avis de l'administration mènent aux
 * ancres (#versements-a-reprendre, #remboursements-a-verser, #creances, #du-aux-partenaires).
 * Remplace le rapprochement du lot 3 (tous les paiements chargés, trois « revenus » différents, filtres qui changeaient
 * les chiffres du haut) ; la route /api/admin/finance/reconciliation n'est plus lue par l'écran.
 */

import React, { useCallback, useEffect, useId, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Landmark, Receipt, Scale, Settings2, TrendingUp, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useAuth } from '@/components/providers/AuthProvider';
import { RefundsToRetry } from '@/components/admin/RefundsToRetry';
import { DebtsList } from '@/components/admin/finance/DebtsList';
import { EarnedDetail } from '@/components/admin/finance/EarnedDetail';
import { MoneyFigure } from '@/components/admin/finance/MoneyFigure';
import { OwedDetail } from '@/components/admin/finance/OwedDetail';
import { PeriodPicker, type PeriodChoice } from '@/components/admin/finance/PeriodPicker';
import { RefundsToPayList } from '@/components/admin/finance/RefundsToPayList';
import { BALANCE_UNREADABLE, NOTHING_WITHDRAWABLE, WithdrawableDetail, type WithdrawableView } from '@/components/admin/finance/WithdrawableDetail';
import { useHashScroll } from '@/hooks/useHashScroll';
import { getJson } from '@/lib/finance/admin-client';
import type { PaymentLine } from '@/lib/finance/admin-lists';
import type { FinanceSummary } from '@/lib/finance/admin-summary';
import { PAYMENT_STATUS_FILTER, paymentStatusLabel, readablePaymentReference } from '@/lib/finance/payment-labels';
import { DEFAULT_PERIOD, PERIOD_KEYS, type FinancePeriod, type PeriodKey } from '@/lib/finance/period';
import { formatDateTime, formatFcfaPrecise, formatTime, toDakarDateTimeLocal } from '@/lib/format';

interface SummaryBody {
  period: FinancePeriod;
  summary: FinanceSummary;
  withdrawable: { visible: false } | WithdrawableView;
}

interface PaymentsBody {
  page: number;
  pageSize: number;
  total: number;
  items: PaymentLine[];
}

type StatusFilter = (typeof PAYMENT_STATUS_FILTER)[number]['value'];

/** Paramètres de période de l'adresse (?period=…&from=…&to=…), pour un lien qui rouvre la même vue. */
function periodQuery(choice: PeriodChoice): string {
  const params = new URLSearchParams({ period: choice.key });
  if (choice.key === 'custom') {
    params.set('from', choice.from ?? '');
    params.set('to', choice.to ?? '');
  }
  return params.toString();
}

function readChoice(): PeriodChoice {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('period');
  if (key && (PERIOD_KEYS as readonly string[]).includes(key)) {
    return { key: key as PeriodKey, from: params.get('from') ?? undefined, to: params.get('to') ?? undefined };
  }
  return { key: DEFAULT_PERIOD };
}

export default function AdminFinancePage() {
  const fieldId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const { hasRole, hasPermission, isLoading: authLoading } = useAuth();
  // Droits lus une fois la session connue (sinon tout paraîtrait refusé le temps du chargement)
  const canRead = !authLoading && hasPermission('payments.read');
  const canRefunds = !authLoading && hasPermission('refunds.manage');
  const isSuperadmin = !authLoading && hasRole('SUPERADMIN');

  const [choice, setChoice] = useState<PeriodChoice | null>(null);
  const [summary, setSummary] = useState<SummaryBody | null>(null);
  const [summaryPhase, setSummaryPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [payments, setPayments] = useState<PaymentsBody | null>(null);
  const [paymentsPhase, setPaymentsPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  /** Nouvel essai demandé par « Réessayer » (même page, même filtre). */
  const [paymentsTick, setPaymentsTick] = useState(0);

  useEffect(() => setChoice(readChoice()), []);

  const changePeriod = useCallback((next: PeriodChoice) => {
    setChoice(next);
    setPage(1);
    router.replace(`${pathname}?${periodQuery(next)}`, { scroll: false });
  }, [pathname, router]);

  const loadSummary = useCallback(async (current: PeriodChoice) => {
    const r = await getJson<SummaryBody>(`/api/admin/finance/summary?${periodQuery(current)}`, 'synthèse financière');
    setRetrying(false);
    if (!r.ok) {
      if (r.status === 400) {
        setPeriodError(r.message);
        setSummaryPhase((p) => (p === 'loading' ? 'error' : p));
        return;
      }
      setSummaryError(r.message);
      setSummaryPhase('error');
      return;
    }
    setPeriodError(null);
    setSummaryError(null);
    setSummary(r.data);
    setSummaryPhase('ready');
  }, []);

  useEffect(() => {
    if (!choice || !canRead) return;
    void loadSummary(choice);
  }, [choice, canRead, loadSummary]);

  useEffect(() => {
    if (!choice || !canRead) return;
    let cancelled = false;
    setPaymentsPhase((p) => (p === 'ready' ? 'ready' : 'loading'));
    void getJson<PaymentsBody>(`/api/admin/finance/payments?${periodQuery(choice)}&status=${status}&page=${page}`, 'paiements encaissés').then((r) => {
      if (cancelled) return;
      if (!r.ok || !Array.isArray(r.data.items)) {
        setPaymentsError(r.ok ? null : r.message);
        setPaymentsPhase('error');
        return;
      }
      setPayments(r.data);
      setPaymentsError(null);
      setPaymentsPhase('ready');
    });
    return () => { cancelled = true; };
  }, [choice, canRead, status, page, paymentsTick]);

  // Avis de l'administration et liens de l'accueil : défilement vers la liste visée une fois la page en place
  useHashScroll(!authLoading && (!canRead || summaryPhase !== 'loading'));

  const s = summary?.summary ?? null;
  const range = summary?.period.range ?? null;
  const w = summary && summary.withdrawable.visible ? summary.withdrawable : null;
  const loading = summaryPhase === 'loading';

  const paymentColumns: DataColumn<PaymentLine>[] = [
    {
      key: 'at', header: 'Encaissé le',
      render: (p) => <time dateTime={toDakarDateTimeLocal(p.encashedAt)} className="tabular-nums">{formatDateTime(p.encashedAt)}</time>,
    },
    {
      key: 'ref', header: 'Référence',
      render: (p) => <span className="break-all font-mono text-sm text-foreground-strong">{readablePaymentReference(p.transactionReference)}</span>,
    },
    {
      key: 'what', header: 'Objet',
      render: (p) => (
        <span className="flex flex-col">
          <span className="text-foreground-strong">{p.target}</span>
          {p.eventTitle && <span className="text-sm text-muted-foreground">{p.eventTitle}</span>}
        </span>
      ),
    },
    { key: 'amount', header: 'Payé', align: 'right', render: (p) => <span className="font-semibold tabular-nums">{formatFcfaPrecise(p.amount)}</span> },
    { key: 'fee', header: 'Frais de service', align: 'right', render: (p) => <span className="tabular-nums">{formatFcfaPrecise(p.serviceFee)}</span> },
    { key: 'ev', header: 'Pour Event Village', align: 'right', render: (p) => <span className="tabular-nums">{formatFcfaPrecise(p.evNet)}</span> },
    {
      key: 'status', header: 'Statut',
      render: (p) => {
        const label = paymentStatusLabel(p.status);
        return (
          <span className="flex flex-col items-start gap-1">
            <Badge variant={label.variant} size="sm">{label.label}</Badge>
            {p.discrepancy > 0 && <span className="text-sm font-semibold text-danger-text tabular-nums">Écart de {formatFcfaPrecise(p.discrepancy)}</span>}
          </span>
        );
      },
    },
  ];

  const renderPaymentCard = (p: PaymentLine) => {
    const label = paymentStatusLabel(p.status);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <span className="text-lg font-bold text-foreground-strong tabular-nums">{formatFcfaPrecise(p.amount)}</span>
          <Badge variant={label.variant} size="sm" className="flex-shrink-0">{label.label}</Badge>
        </div>
        <span className="text-sm text-foreground-strong">{p.target}{p.eventTitle ? ` · ${p.eventTitle}` : ''}</span>
        <time dateTime={toDakarDateTimeLocal(p.encashedAt)} className="text-sm text-muted-foreground tabular-nums">Encaissé le {formatDateTime(p.encashedAt)}</time>
        <span className="break-all font-mono text-sm text-muted-foreground">{readablePaymentReference(p.transactionReference)}</span>
        <span className="text-sm text-muted-foreground">
          Frais de service <span className="tabular-nums text-foreground-strong">{formatFcfaPrecise(p.serviceFee)}</span> · pour Event Village{' '}
          <span className="tabular-nums text-foreground-strong">{formatFcfaPrecise(p.evNet)}</span>
        </span>
        {p.discrepancy > 0 && <span className="text-sm font-semibold text-danger-text tabular-nums">Écart de {formatFcfaPrecise(p.discrepancy)}</span>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      <PageHeader
        title="Finance"
        description="Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay."
        actions={(
          <LinkButton href="/admin/finance-settings" variant="ghost" size="sm" leftIcon={<Settings2 size={16} />}>
            Réglages de la plateforme
          </LinkButton>
        )}
      />

      {!authLoading && !canRead && (
        <StatusBanner tone="info" title="Chiffres de la finance non affichés">
          Votre compte n’a pas la permission « Consulter les paiements ». Demandez-la au super-administrateur pour voir ce que gagne Event Village et ce qui est dû.
        </StatusBanner>
      )}

      {canRead && choice && (
        <PeriodPicker value={choice} range={range} error={periodError} disabled={loading} onChange={changePeriod} />
      )}

      {canRead && summaryPhase === 'error' && !summary && (
        <ErrorState
          title="Chiffres de la finance indisponibles"
          description={summaryError ?? periodError ?? undefined}
          onRetry={() => { setRetrying(true); if (choice) void loadSummary(choice); }}
          isRetrying={retrying}
        />
      )}

      {canRead && (summaryPhase !== 'error' || summary) && (
        <div className="grid gap-4 md:grid-cols-2">
          <MoneyFigure
            id={`${fieldId}-gagne`}
            title="Gagné par Event Village"
            tone="brand"
            icon={<TrendingUp size={18} />}
            loading={loading}
            value={s ? formatFcfaPrecise(s.earned.total) : null}
            explanation="Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
            basis={range ? <>Paiements encaissés, retraits versés et versements confirmés {range}.</> : null}
            detailHref="#detail-gagne"
            detailLabel="Voir le détail"
          />
          <MoneyFigure
            id={`${fieldId}-du`}
            title="Dû aux partenaires"
            tone="info"
            icon={<Wallet size={18} />}
            loading={loading}
            value={s ? formatFcfaPrecise(s.owed_partners.total) : null}
            explanation="L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
            basis={s ? (
              <>
                Dont <span className="font-semibold text-foreground-strong tabular-nums">{formatFcfaPrecise(s.owed_partners.withdrawable_now)}</span> retirables aujourd’hui.
                Dû aux parrains : <span className="font-semibold text-foreground-strong tabular-nums">{formatFcfaPrecise(s.owed_referrers.total)}</span>. À l’instant.
              </>
            ) : null}
            detailHref="#du-aux-partenaires"
            detailLabel="Voir le détail"
          />
          {isSuperadmin && (
            <MoneyFigure
              id={`${fieldId}-retirable`}
              title="Retirable par Event Village"
              tone={w && w.amount !== null && w.amount > 0 ? 'success' : 'warning'}
              icon={<Landmark size={18} />}
              loading={loading}
              value={w && w.amount !== null ? formatFcfaPrecise(w.amount) : null}
              explanation={!w || w.balance === null
                ? <><span className="font-semibold text-warning-text">{BALANCE_UNREADABLE}</span>. Ne retirez rien avant qu’il s’affiche.</>
                : w.amount === 0
                  ? <span className="font-semibold text-foreground-strong">{NOTHING_WITHDRAWABLE}</span>
                  : 'Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.'}
              basis={w && w.balance ? (
                <>
                  Solde SamirPay lu à <time dateTime={w.balance.readAt} className="tabular-nums">{formatTime(w.balance.readAt)}</time>, moins tout ce qui est dû et la réserve de prudence.
                  {w.simulated && ' Mode d’essai : chiffre sans valeur réelle.'}
                </>
              ) : null}
              detailHref="#calcul-retirable"
              detailLabel="Voir le calcul"
            />
          )}
          <MoneyFigure
            id={`${fieldId}-creances`}
            title="Créances"
            tone={s && s.debts.count > 0 ? 'warning' : 'neutral'}
            icon={<Scale size={18} />}
            loading={loading}
            value={s ? formatFcfaPrecise(s.debts.total) : null}
            explanation="Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre."
            basis={s ? <>{s.debts.count > 1 ? `${s.debts.count} créances` : s.debts.count === 1 ? '1 créance' : 'Aucune créance'} à l’instant.</> : null}
            detailHref="#creances"
            detailLabel="Voir les créances"
          />
        </div>
      )}

      {canRefunds && (
        <div id="versements-a-reprendre" className="scroll-mt-20">
          <RefundsToRetry />
        </div>
      )}

      {(canRead || canRefunds) && <RefundsToPayList canResume={canRefunds} />}

      {canRead && <DebtsList />}

      {canRead && s && range && <EarnedDetail earned={s.earned} range={range} />}

      {canRead && <OwedDetail partners={s?.owed_partners ?? null} referrers={s?.owed_referrers ?? null} />}

      {canRead && w && s && <WithdrawableDetail view={w} summary={s} />}

      {canRead && (
        <section id="paiements" aria-labelledby={`${fieldId}-paiements`} className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 id={`${fieldId}-paiements`} className="flex items-center gap-2 text-lg font-semibold text-foreground-strong">
              <Receipt size={20} className="flex-shrink-0 text-primary-text" aria-hidden="true" />
              Paiements encaissés
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Paiements en ligne encaissés {range ?? 'sur la période'}. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            </p>
          </div>
          <Select
            label="Statut"
            id={`${fieldId}-statut`}
            value={status}
            options={PAYMENT_STATUS_FILTER.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            fieldClassName="md:w-80"
          />
          {paymentsPhase === 'loading' && (
            <div role="status" aria-busy="true" aria-label="Chargement des paiements" className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          )}
          {paymentsPhase === 'error' && (
            <ErrorState title="Paiements indisponibles" description={paymentsError ?? undefined} onRetry={() => setPaymentsTick((t) => t + 1)} />
          )}
          {paymentsPhase === 'ready' && payments && (
            <>
              <DataList
                items={payments.items}
                columns={paymentColumns} breakpoint="xl"
                getKey={(p) => p.id}
                caption="Paiements encaissés"
                renderCard={renderPaymentCard}
                empty={<EmptyState title="Aucun paiement" description="Aucun paiement en ligne encaissé sur cette période avec ce statut." />}
              />
              <Pagination page={payments.page} pageSize={payments.pageSize} total={payments.total} onPageChange={setPage} ariaLabel="Pages des paiements" />
            </>
          )}
        </section>
      )}
    </div>
  );
}
