'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  TrendingUp,
  Percent,
  QrCode,
  ShieldCheck,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { ClosingReportData } from '@/lib/partner/partner-dashboard.service';

interface ClosingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  eventTitle?: string;
}

export const ClosingReportModal: React.FC<ClosingReportModalProps> = ({
  isOpen,
  onClose,
  eventId,
  eventTitle,
}) => {
  const toast = useToast();
  const [data, setData] = useState<ClosingReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);

  useEffect(() => {
    if (!isOpen || !eventId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/partner/reports/closing?eventId=${encodeURIComponent(eventId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Impossible de récupérer le rapport de clôture.');
        }
        if (isMounted) {
          setData(json.report);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Erreur de chargement du rapport.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, eventId]);

  const handleDownloadPdf = async () => {
    if (!eventId) return;
    try {
      setIsDownloadingPdf(true);
      const url = `/api/partner/reports/closing/pdf?eventId=${encodeURIComponent(eventId)}`;
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `EventVillage-Rapport-Cloture-${eventId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Téléchargement du PDF de clôture en cours...');
    } catch {
      toast.error('Échec du téléchargement du PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!eventId) return;
    try {
      setIsDownloadingCsv(true);
      const url = `/api/partner/reports/accounting?eventId=${encodeURIComponent(eventId)}&format=csv`;
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `EventVillage-Comptabilite-${eventId.slice(0, 8)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Téléchargement du fichier comptable en cours...');
    } catch {
      toast.error('Échec du téléchargement du fichier comptable.');
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rapport de Clôture & Bilan Z"
      subtitle={eventTitle || (data?.event ? data.event.title : 'Clôture de session billetterie')}
      icon={<FileText size={18} />}
      maxWidth="4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Document certifié Event Village • Conforme CDC V3.0</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={isLoading || !data || isDownloadingCsv}
              isLoading={isDownloadingCsv}
              leftIcon={<FileSpreadsheet size={15} className="text-emerald-600" />}
            >
              Export CSV / Excel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isLoading || !data || isDownloadingPdf}
              isLoading={isDownloadingPdf}
              leftIcon={<Download size={15} />}
            >
              Télécharger PDF Officiel
            </Button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={36} className="animate-spin text-[#FF5722]" />
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
            Génération et calcul du rapport de clôture en cours...
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            Réconciliation des billets, scans aux portes et commissions de la plateforme.
          </p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-700 dark:text-red-300">
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5 text-red-600" />
          <div className="space-y-1">
            <h4 className="text-sm font-black">Erreur lors de la génération</h4>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* 1. Header Résumé Session */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#FF5722] bg-[#FF5722]/10 px-2 py-0.5 rounded-md">
                  {data.reportId}
                </span>
                <Badge variant="success" size="sm">
                  Clôture Certifiée
                </Badge>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                {data.event.title}
              </h4>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {new Date(data.event.startDate).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  à {data.event.startTime}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {data.event.venue}, {data.event.city}
                </span>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-200 dark:sm:border-zinc-700 sm:pl-5 space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Net Partenaire à Reverser
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#FF5722]">
                {data.financialSummary.totalNet.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>

          {/* 2. Cartes Synthèse Accès & Remplissage */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 text-xs font-bold">
                <span>Billets Vendus</span>
                <Users size={15} />
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {data.ticketsSummary.sold} / {data.ticketsSummary.totalAllocated}
              </div>
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Taux de remplissage : {data.ticketsSummary.fillRatePercent}%
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 text-xs font-bold">
                <span>Entrées Validées (Scan)</span>
                <QrCode size={15} />
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                {data.ticketsSummary.checkedIn} entrées
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                Taux de présence : {data.ticketsSummary.checkInRatePercent}%
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 text-xs font-bold">
                <span>Paiements Confirmés</span>
                <DollarSign size={15} />
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {data.paymentsSummary.confirmedCount} transactions
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                Brut encaissé : {data.financialSummary.totalGross.toLocaleString('fr-FR')} F
              </p>
            </div>
          </div>

          {/* 3. Tableau Ventes par Formule / Catégorie */}
          <div className="space-y-2.5">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              1. Ventilation des Ventes par Catégorie
            </h5>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-300 font-bold border-b border-slate-200 dark:border-zinc-700">
                    <th className="py-2.5 px-3">Formule / Catégorie</th>
                    <th className="py-2.5 px-3 text-right">Prix Unit.</th>
                    <th className="py-2.5 px-3 text-center">Alloués</th>
                    <th className="py-2.5 px-3 text-center">Vendus</th>
                    <th className="py-2.5 px-3 text-center">Compostés</th>
                    <th className="py-2.5 px-3 text-right">Total Brut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900/60">
                  {data.salesByCategory.map((cat) => (
                    <tr key={cat.categoryId} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {cat.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                        {cat.unitPrice.toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 dark:text-zinc-400">
                        {cat.totalAllocated}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                        {cat.soldQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                        {cat.checkedInQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white font-mono">
                        {cat.grossAmount.toLocaleString('fr-FR')} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Encadré Financier & Reversement Net */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-zinc-900 text-white space-y-3 shadow-lg">
            <h5 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
              <TrendingUp size={14} />
              2. Synthèse Comptable & Reversement Net
            </h5>

            <div className="space-y-2 text-xs divide-y divide-white/10">
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-300">Chiffre d&apos;affaires brut total :</span>
                <span className="font-bold text-white font-mono">
                  {data.financialSummary.totalGross.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-300">Frais de service & billetterie Event Village :</span>
                <span className="font-bold text-red-400 font-mono">
                  - {data.financialSummary.totalCommission.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              {data.financialSummary.totalRefunded > 0 && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-300">Remboursements clients :</span>
                  <span className="font-bold text-red-400 font-mono">
                    - {data.financialSummary.totalRefunded.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 text-sm">
                <span className="font-black text-orange-300 uppercase">
                  Montant Net à Reverser au Partenaire :
                </span>
                <span className="text-lg font-black text-white font-mono bg-[#FF5722] px-3 py-1 rounded-xl shadow-xs">
                  {data.financialSummary.totalNet.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
