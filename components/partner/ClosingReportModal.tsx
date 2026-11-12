'use client';

import React, { useState } from 'react';
import { Banknote, Calendar, Download, FileSpreadsheet, FileText, MapPin, QrCode, Users, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { ErrorState } from '@/components/ui/EmptyState';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { apiErrorOf } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { DefinitionRow, KpiAmount, KpiValue } from '@/components/partner/pilotage/PilotageBlocks';
import type { CategorySalesSummary, ClosingReportData } from '@/lib/partner/partner-dashboard.service';
import { formatDateTime, formatEventDateTime, formatFcfa, formatInteger, formatPercent } from '@/lib/format';

interface ClosingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  eventTitle?: string;
}

type DownloadKind = 'pdf' | 'csv';

const DOWNLOADS: Record<DownloadKind, { url: (eventId: string) => string; fileName: (eventId: string) => string; done: string; label: string }> = {
  pdf: {
    url: (id) => `/api/partner/reports/closing/pdf?eventId=${encodeURIComponent(id)}`,
    fileName: (id) => `EventVillage-Rapport-Cloture-${id.slice(0, 8)}.pdf`,
    done: 'Rapport de clôture téléchargé.',
    label: 'Le PDF du rapport',
  },
  csv: {
    url: (id) => `/api/partner/reports/accounting?eventId=${encodeURIComponent(id)}&format=csv`,
    fileName: (id) => `EventVillage-Comptabilite-${id.slice(0, 8)}.csv`,
    done: 'Fichier comptable téléchargé.',
    label: 'Le fichier comptable',
  },
};

const SALES_COLUMNS: DataColumn<CategorySalesSummary>[] = [
  { key: 'name', header: 'Catégorie', render: (cat) => <span className="font-semibold">{cat.name}</span>, hideOnCard: true },
  { key: 'unitPrice', header: 'Prix unitaire', align: 'right', render: (cat) => formatFcfa(cat.unitPrice) },
  { key: 'allocated', header: 'Quota', align: 'right', render: (cat) => formatInteger(cat.totalAllocated) },
  { key: 'sold', header: 'Vendus', align: 'right', render: (cat) => formatInteger(cat.soldQuantity) },
  { key: 'invitations', header: 'Invitations', align: 'right', render: (cat) => formatInteger(cat.invitations) },
  { key: 'gross', header: 'Ventes en ligne', align: 'right', render: (cat) => <span className="font-semibold tabular-nums">{formatFcfa(cat.grossAmount)}</span> },
];

function amount(value: number, prefix = ''): React.ReactNode {
  return <span className="whitespace-nowrap tabular-nums">{prefix}{formatFcfa(value)}</span>;
}

function ReportSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-busy="true" aria-label="Chargement du rapport de clôture">
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
    </div>
  );
}

function ReportBody({ report }: { report: ClosingReportData }) {
  const { event, financialSummary: money, ticketsSummary: tickets } = report;
  // Lot 9 ter (R106 b) : données lues de pilotage_closing ; taux calculés ici, en attendant le composant partagé (vague E)
  const fillRate = tickets.capacity > 0 ? Math.min(1, tickets.sold / tickets.capacity) : 0;
  const presenceRate = tickets.sold > 0 ? Math.min(1, tickets.entries / tickets.sold) : 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="break-all rounded-md bg-brand-bg px-2 py-0.5 font-mono text-sm font-semibold text-brand-fg">{report.reportId}</span>
          <p className="text-sm text-fg-muted">
            Généré le <time dateTime={report.generatedAt} className="tabular-nums">{formatDateTime(report.generatedAt)}</time>
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
          <li className="flex items-center gap-1.5 tabular-nums">
            <Calendar size={16} aria-hidden="true" className="flex-shrink-0" />
            {formatEventDateTime(event.startDate, event.startTime)}
          </li>
          <li className="flex min-w-0 items-center gap-1.5">
            <MapPin size={16} aria-hidden="true" className="flex-shrink-0" />
            <span className="min-w-0 break-words">{event.venue}, {event.city}</span>
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 tabular-nums lg:grid-cols-4">
        <KpiCard
          label="Billets vendus"
          value={<KpiValue>{formatInteger(tickets.sold)} / {formatInteger(tickets.capacity)}</KpiValue>}
          hint={`Remplissage : ${formatPercent(fillRate)}`}
          icon={<Users size={18} />}
        />
        <KpiCard
          label="Entrées validées"
          value={<KpiValue>{formatInteger(tickets.entries)}</KpiValue>}
          hint={`Présence : ${formatPercent(presenceRate)}`}
          tone="success"
          icon={<QrCode size={18} />}
        />
        <KpiCard
          label="Ventes en ligne"
          value={<KpiAmount value={formatFcfa(money.totalGross)} />}
          hint={`Ventes au guichet : ${formatFcfa(money.cashSales)}`}
          icon={<Banknote size={18} />}
        />
        <KpiCard
          label="Net à reverser"
          value={<KpiAmount value={formatFcfa(money.totalNet)} />}
          tone="brand"
          icon={<Wallet size={18} />}
        />
      </div>

      <section aria-labelledby="rapport-ventes" className="flex flex-col gap-3">
        <h3 id="rapport-ventes" className="text-base font-bold text-fg">Ventes par catégorie</h3>
        <DataList
          items={report.salesByCategory}
          columns={SALES_COLUMNS}
          getKey={(cat) => cat.categoryId}
          caption="Ventes par catégorie"
          cardTitle={(cat) => cat.name}
          className="tabular-nums"
          empty={<p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">Aucune vente sur cet événement.</p>}
        />
      </section>

      <section aria-labelledby="rapport-synthese" className="flex flex-col gap-3">
        <h3 id="rapport-synthese" className="text-base font-bold text-fg">Synthèse comptable</h3>
        <dl className="rounded-2xl bg-surface-sunken px-4 py-1 tabular-nums">
          <DefinitionRow label="Ventes en ligne, prix des billets" value={amount(money.totalGross)} />
          {money.totalRefunded > 0 && (
            <DefinitionRow label="Remboursements aux acheteurs" value={<span className="text-danger-fg">{amount(money.totalRefunded, '− ')}</span>} />
          )}
          <DefinitionRow
            label={<span className="font-semibold text-fg">Net à reverser au partenaire</span>}
            value={<span className="text-base font-bold text-brand-fg">{amount(money.totalNet)}</span>}
          />
          <DefinitionRow label="Dont disponible" value={amount(money.availableNet)} />
          <DefinitionRow label="Dont en attente" value={amount(money.pendingNet)} />
          <DefinitionRow label="Frais de service payés par l’acheteur, non déduits" value={amount(money.buyerServiceFees)} />
          <DefinitionRow
            label={`Espèces au guichet, ${formatInteger(money.cashTickets)} billet${money.cashTickets > 1 ? 's' : ''}, hors plateforme, pour information`}
            value={amount(money.cashSales)}
          />
        </dl>
      </section>
    </div>
  );
}

/**
 * Rapport de clôture d'un événement (tableau de bord partenaire, 8.2 r). Les chiffres viennent de la route ; une
 * lecture ou un téléchargement en échec est signalé par un texte fixe, jamais par le message de la réponse.
 */
export const ClosingReportModal: React.FC<ClosingReportModalProps> = ({ isOpen, onClose, eventId, eventTitle }) => {
  const toast = useToast();
  const url = isOpen && eventId ? `/api/partner/reports/closing?eventId=${encodeURIComponent(eventId)}` : null;
  const { data, error, loading, refreshing, reload } = useServerData<{ report: ClosingReportData }>(url);
  const report = data?.report ?? null;
  const [downloading, setDownloading] = useState<DownloadKind | null>(null);
  const [failedDownload, setFailedDownload] = useState<DownloadKind | null>(null);

  const download = async (kind: DownloadKind): Promise<void> => {
    if (!eventId) return;
    const target = DOWNLOADS[kind];
    setDownloading(kind);
    setFailedDownload(null);
    try {
      const res = await fetch(target.url(eventId), { cache: 'no-store' });
      if (!res.ok) throw await apiErrorOf(res);
      const objectUrl = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = target.fileName(eventId);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(target.done);
    } catch (err) {
      console.error(`[rapport de clôture] téléchargement ${kind}`, err);
      setFailedDownload(kind);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rapport de clôture"
      subtitle={eventTitle || report?.event.title || 'Bilan de l’événement'}
      icon={<FileText size={18} />}
      maxWidth="4xl"
      scrollRegionLabel="Contenu du rapport de clôture"
      footer={
        <div className="flex w-full flex-col gap-3">
          {failedDownload && (
            <StatusBanner tone="danger" title="Le téléchargement n’a pas abouti" announce="alert">
              {DOWNLOADS[failedDownload].label} n’a pas pu être préparé. Réessayez dans un instant.
            </StatusBanner>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">Document généré par Event Village</p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void download('csv')}
                disabled={!report || downloading !== null}
                isLoading={downloading === 'csv'}
                leftIcon={<FileSpreadsheet size={16} />}
              >
                Export CSV / Excel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void download('pdf')}
                disabled={!report || downloading !== null}
                isLoading={downloading === 'pdf'}
                leftIcon={<Download size={16} />}
              >
                Télécharger le PDF
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {loading ? (
        <ReportSkeleton />
      ) : error ? (
        <ErrorState
          title="Rapport de clôture indisponible"
          description="Le rapport n’a pas pu être préparé. Vérifiez votre connexion, puis réessayez."
          onRetry={() => void reload()}
          isRetrying={refreshing}
        />
      ) : report ? (
        <ReportBody report={report} />
      ) : null}
    </Modal>
  );
};
