'use client';

import React, { useState } from 'react';
import { QrCode, Barcode, Share2, Download, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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
  const [viewMode, setViewMode] = useState<'qr' | 'barcode'>('qr');

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      {/* 1. Carte Billet Perforée */}
      <div className="w-full ev-ticket-card">
        {/* Notches concaves latérales de découpe */}
        <div className="ticket-notch-left top-44" />
        <div className="ticket-notch-right top-44" />

        {/* Partie Haute : Visuel Événement */}
        <div className="relative w-full h-44 bg-slate-950 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={eventImageUrl} alt={eventTitle} className="w-full h-full object-cover" />
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
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Heure d’accès</span>
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

          {/* Partie Basse : QR Code ou Code-Barres pour contrôle d'entrée */}
          <div className="flex flex-col items-center justify-center pt-2">
            {viewMode === 'qr' ? (
              <div className="flex flex-col items-center p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-inner">
                <div className="w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center">
                  <QrCode size={140} className="text-slate-950" />
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400 mt-2">
                  {ticketNumber}
                </span>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <div className="w-full h-16 flex items-center justify-between px-2 overflow-hidden">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full bg-slate-950 dark:bg-white rounded-[1px] ${
                        i % 4 === 0 ? 'w-1.5' : i % 3 === 0 ? 'w-1' : i % 2 === 0 ? 'w-0.5' : 'w-[1px]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-mono font-bold tracking-widest text-slate-700 dark:text-zinc-300 mt-2">
                  {ticketNumber}
                </span>
              </div>
            )}
          </div>

          {/* Instructions pour le porteur */}
          <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#FF5722] text-[11px] font-medium text-center border border-orange-100 dark:border-orange-900/30">
            Présentez ce QR Code au contrôleur à l’entrée de l’événement.
          </div>
        </div>
      </div>

      {/* 2. Boutons de bascule et Actions (Partage / Téléchargement) */}
      <div className="mt-4 flex items-center gap-2 w-full max-w-md justify-between">
        <div className="flex gap-1.5 p-1 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800">
          <button
            onClick={() => setViewMode('qr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'qr'
                ? 'bg-[#FF5722] text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            QR Code
          </button>
          <button
            onClick={() => setViewMode('barcode')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'barcode'
                ? 'bg-[#FF5722] text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            Code-barres
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: `Billet ${eventTitle}`, text: `Mon billet officiel pour ${eventTitle} (N° ${ticketNumber})` });
              } else {
                navigator.clipboard.writeText(ticketNumber);
                alert('Numéro de billet copié !');
              }
            }}
            leftIcon={<Share2 size={13} />}
          >
            Partager
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => alert('Téléchargement du billet PDF en cours...')}
            leftIcon={<Download size={13} />}
          >
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
};
