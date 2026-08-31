'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Download, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export interface TicketCardProps {
  id: string;
  ticketNumber: string;
  eventTitle: string;
  eventSubtitle?: string;
  eventImageUrl: string;
  dateFormatted: string;
  timeFormatted: string;
  venue: string;
  seat?: string;
  qrCodeValue: string;
  status: 'VALIDE' | 'UTILISE' | 'ANNULE' | 'REMBOURSE';
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticketNumber,
  eventTitle,
  eventSubtitle = 'Live Performance',
  eventImageUrl,
  dateFormatted,
  timeFormatted,
  venue,
  seat = 'Fosse générale (Place libre)',
  qrCodeValue,
  status,
}) => {
  const toast = useToast();
  const ticketRef = useRef<HTMLDivElement>(null);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Billet ${eventTitle}`,
        text: `Mon billet officiel pour ${eventTitle} (N° ${ticketNumber})`,
      });
    } else {
      navigator.clipboard.writeText(ticketNumber);
      toast.success('Numéro de billet copié !');
    }
  };

  const handlePrint = () => {
    if (!ticketRef.current) return;
    const printWindow = window.open('', '_blank', 'width=480,height=760');
    if (!printWindow) return;

    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join('');
        } catch {
          return '';
        }
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Billet — ${eventTitle} — ${ticketNumber}</title>
          <meta charset="UTF-8"/>
          <style>
            ${styles}
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            body { background: white; display: flex; justify-content: center; padding: 24px; font-family: sans-serif; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>${ticketRef.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      {/* 1. Carte Billet Perforée */}
      <div ref={ticketRef} className="w-full ev-ticket-card">
        {/* Notches concaves latérales de découpe */}
        <div className="ticket-notch-left top-44" />
        <div className="ticket-notch-right top-44" />

        {/* Partie Haute : Visuel Événement */}
        <div className="relative w-full h-44 bg-slate-950 overflow-hidden">
          <Image
            src={eventImageUrl}
            alt={eventTitle}
            fill
            className="object-cover"
            sizes="(max-width: 28rem) 100vw, 28rem"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="absolute top-3 right-3">
            <StatusBadge status={status} />
          </div>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h2 className="text-lg font-black tracking-tight leading-tight">{eventTitle}</h2>
            <p className="text-xs text-zinc-300 font-medium">{eventSubtitle}</p>
          </div>
        </div>

        {/* Ligne de Perforation en Pointillés */}
        <div className="ticket-divider-dashed my-3" />

        {/* Partie Médiane : Grille 2x2 des informations d'accès */}
        <div className="p-5 pt-1 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Date</span>
              <p className="font-black text-slate-900 dark:text-white mt-0.5">{dateFormatted}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Heure d&apos;accès</span>
              <p className="font-black text-slate-900 dark:text-white mt-0.5">{timeFormatted}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Lieu & Salle</span>
              <p className="font-black text-slate-900 dark:text-white mt-0.5 truncate">{venue}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Emplacement</span>
              <p className="font-black text-slate-900 dark:text-white mt-0.5 truncate">{seat}</p>
            </div>
          </div>

          {/* Ligne de Séparation */}
          <div className="ticket-divider-dashed my-2" />

          {/* QR Code réel basé sur qrCodeValue (valeur cryptographique API) */}
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-inner">
              <QRCodeSVG
                value={qrCodeValue || ticketNumber}
                size={152}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="M"
                includeMargin={false}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400 mt-2">
              {ticketNumber}
            </span>
          </div>

          {/* Sceau de validation */}
          {status === 'VALIDE' && (
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
              <CheckCircle2 size={14} />
              <span>Billet authentique — Validé par Event Village</span>
            </div>
          )}

          {/* Instructions pour le porteur */}
          <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#FF5722] text-[11px] font-medium text-center border border-orange-100 dark:border-orange-900/30">
            Présentez ce QR Code au contrôleur à l&apos;entrée de l&apos;événement.
          </div>
        </div>
      </div>

      {/* 2. Actions (Partage / Téléchargement PDF) */}
      <div className="mt-4 flex items-center gap-2 w-full max-w-md justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleShare}
          leftIcon={<Share2 size={13} />}
        >
          Partager
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrint}
          leftIcon={<Download size={13} />}
        >
          PDF
        </Button>
      </div>
    </div>
  );
};
