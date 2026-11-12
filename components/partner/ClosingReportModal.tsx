'use client';

import React, { useState } from 'react';
import { Calendar, Download, FileSpreadsheet, FileText, MapPin } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { ErrorState } from '@/components/ui/EmptyState';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { apiErrorOf } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { ClosingReportSummary } from '@/components/partner/pilotage/ClosingReportSummary';
import { PilotageSection } from '@/components/partner/pilotage/PilotageBlocks';
import type { CategorySalesSummary, ClosingReportData } from '@/lib/partner/partner-dashboard.service';
import { formatDateTime, formatEventDateTime, formatFcfa, formatInteger } from '@/lib/format';

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

/** Colonnes lues telles quelles dans pilotage_sales.by_category (même source que l'onglet Ventes). */
const SALES_COLUMNS: DataColumn<CategorySalesSummary>[] = [
  { key: 'name', header: 'Catégorie', render: (cat) => <span className="font-semibold">{cat.name}</span>, hideOnCard: true },
  { key: 'unitPrice', header: 'Prix', align: 'right', render: (cat) => formatFcfa(cat.unitPrice) },
  { key: 'sold', header: 'Vendus', align: 'right', render: (cat) => formatInteger(cat.soldQuantity) },
  { key: 'invitations', header: 'Invitations', align: 'right', render: (cat) => formatInteger(cat.invitations) },
  { key: 'remaining', header: 'Reste', align: 'right', render: (cat) => formatInteger(cat.remainingQuantity) },
];

function ReportSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true" aria-label="Chargement du rapport de clôture">
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
    </div>
  );
}

/**
 * En-tête (référence, date de génération, date et lieu), puis le rapport unique ClosingReportSummary, le même que
 * l'onglet Clôture du pilotage (lot 9 ter, R106 b), puis les ventes par catégorie.
 */
function ReportBody({ report }: { report: ClosingReportData }) {
  const { event } = report;
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

      <ClosingReportSummary closing={report.closing} />

      <PilotageSection title="Ventes par catégorie">
        <DataList
          items={report.salesByCategory}
          columns={SALES_COLUMNS}
          getKey={(cat) => cat.categoryId}
          caption="Ventes par catégorie"
          cardTitle={(cat) => cat.name}
          className="tabular-nums"
          empty={<p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">Aucune catégorie.</p>}
        />
      </PilotageSection>
    </div>
  );
}

/**
 * Rapport de clôture d'un événement (tableau de bord partenaire, 8.2 r). Les chiffres viennent de la route (corps de
 * pilotage_closing et de pilotage_sales, aucun calcul ici) ; une lecture ou un téléchargement en échec est signalé par
 * un texte fixe, jamais par le message de la réponse.
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
