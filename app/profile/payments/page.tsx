'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, LogIn, ReceiptText, RotateCcw, Wallet } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useServerData } from '@/components/partner/useServerData';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { formatDateTime, formatFcfa } from '@/lib/format';
import Loading from './loading';

/**
 * Mes paiements (lot 9, tâche 9.2, contrat 4.3 et 5.3) : liste paginée par le serveur et totaux calculés par lui.
 * Chaque ligne est un lien vers la page de statut ; l'identifiant ne sert qu'à ce lien, jamais à l'affichage.
 * Date, libellé, montant, opérateur et statut viennent déjà traduits de la route.
 *
 * Une seule liste pour toutes les largeurs : DataList rendrait deux fois chaque lien, le premier masqué sur mobile.
 */

interface PaymentRow {
  id: string;
  created_at: string;
  amount: number;
  refunded_amount: number;
  operator_label: string;
  status_label: string;
  target_label: string;
  event_title: string | null;
}

interface PaymentsResponse {
  items: PaymentRow[];
  page: number;
  page_size: number;
  total_count: number;
  total_paid: number;
  total_refunded: number;
}

/** Ton de la pastille selon le libellé servi par la route ; le libellé reste toujours écrit. */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  Confirmé: 'success',
  'En attente': 'warning',
  Échoué: 'danger',
  'Remboursement en cours': 'info',
  Remboursé: 'info',
  'Remboursé en partie': 'info',
};

export default function PaymentsPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [page, setPage] = useState(1);
  const { data, error, loading, refreshing, reload } = useServerData<PaymentsResponse>(
    isAuthenticated ? `/api/account/payments?page=${page}` : null,
  );

  if (isAuthLoading) return <Loading />;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          icon={<LogIn size={28} />}
          title="Connectez-vous pour voir vos paiements"
          description="L’historique de vos paiements et de vos remboursements est lié à votre compte."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Fprofile%2Fpayments"
        />
      </div>
    );
  }

  const header = <PageHeader title="Mes paiements" back={{ href: '/profile', label: 'Mon profil' }} />;

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl pb-24 lg:pb-12">
        {header}
        <ErrorState title="Vos paiements n’ont pas pu être chargés" description={error} onRetry={() => void reload()} isRetrying={refreshing || loading} />
      </div>
    );
  }

  if (loading || !data) return <Loading />;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24 lg:pb-12">
      {header}

      {data.total_count === 0 ? (
        <EmptyState
          icon={<ReceiptText size={28} />}
          title="Aucun paiement pour le moment"
          description="Vos paiements apparaîtront ici dès votre premier achat."
          actionLabel="Découvrir les événements"
          actionHref="/explore"
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard label="Total payé" value={formatFcfa(data.total_paid)} tone="brand" icon={<Wallet size={18} />} />
            <KpiCard label="Total remboursé" value={formatFcfa(data.total_refunded)} tone="info" icon={<RotateCcw size={18} />} />
          </div>

          <ul className="space-y-3" aria-label="Liste de vos paiements">
            {data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/paiement/${item.id}`}
                  className="group flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors duration-200 hover:border-brand-fg/40 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block break-words text-sm font-semibold text-fg group-hover:text-brand-fg">{item.event_title ?? item.target_label}</span>
                    <span className="block text-sm text-fg-muted">
                      <time dateTime={item.created_at} className="tabular-nums">{formatDateTime(item.created_at)}</time>
                    </span>
                    <span className="block text-sm text-fg-muted">{item.operator_label}</span>
                    {item.refunded_amount > 0 && (
                      <span className="block text-sm text-fg-muted tabular-nums">{`Remboursé : ${formatFcfa(item.refunded_amount)}`}</span>
                    )}
                  </span>
                  <span className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-bold text-fg tabular-nums">{formatFcfa(item.amount)}</span>
                    <Badge variant={STATUS_VARIANTS[item.status_label] ?? 'neutral'} className="whitespace-nowrap">{item.status_label}</Badge>
                  </span>
                  <ChevronRight size={18} className="flex-shrink-0 text-fg-muted group-hover:text-brand-fg" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total_count}
            onPageChange={setPage}
            isLoading={loading || refreshing}
            ariaLabel="Pagination de vos paiements"
          />
        </>
      )}
    </div>
  );
}
