'use client';

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import {
  Share2,
  Download,
  CheckCircle2,
  Send,
  Lock,
  RotateCcw,
  HelpCircle,
  Clock,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';

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
  usedAt?: string;
  isTransferLocked?: boolean;
  activeTransfer?: {
    id: string;
    recipient: string;
    expires_at: string;
  } | null;
  onTransferClick?: () => void;
  onCancelTransferSuccess?: () => void;
  onOpenExplainer?: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  id,
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
  usedAt,
  isTransferLocked = false,
  activeTransfer = null,
  onTransferClick,
  onCancelTransferSuccess,
  onOpenExplainer,
}) => {
  const toast = useToast();
  const { session } = useAuth();
  const ticketRef = useRef<HTMLDivElement>(null);

  // QR Code Dynamique Anti-Fraude (TOTP RFC 6238)
  const [dynamicQr, setDynamicQr] = useState<string>(qrCodeValue || ticketNumber);
  const [expiresIn, setExpiresIn] = useState<number>(20);
  const [totalStep, setTotalStep] = useState<number>(20);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  useEffect(() => {
    if (status !== 'VALIDE' || isTransferLocked || !id) return;

    let isMounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchLiveCode = async () => {
      try {
        const res = await fetch(`/api/tickets/${id}/live-code`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setDynamicQr(data.qr_payload);
            setExpiresIn(data.expires_in || 20);
            setTotalStep(data.step_seconds || 20);
            setIsOffline(false);
          }
        } else {
          if (isMounted) setIsOffline(true);
        }
      } catch {
        if (isMounted) setIsOffline(true);
      }
    };

    fetchLiveCode();

    // Décompte seconde par seconde pour l'animation fluide
    timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          fetchLiveCode();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [id, status, isTransferLocked]);

  const handleShare = () => {
    const shareText = `Mon billet officiel pour ${eventTitle} (N° ${ticketNumber}) sur Event Village : https://event-village.sn/tickets`;
    if (navigator.share) {
      navigator.share({
        title: `Billet ${eventTitle}`,
        text: shareText,
        url: 'https://event-village.sn/tickets',
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(ticketNumber);
      toast.success('Numéro de billet copié !');
    }
  };

  const handleShareWhatsapp = () => {
    const shareText = `Mon billet officiel pour ${eventTitle} (${seat}) sur Event Village (N° ${ticketNumber})`;
    const encoded = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleDownloadPdf = async () => {
    if (status !== 'VALIDE') {
      toast.error('Ce billet n\'est pas au statut valide pour le téléchargement.');
      return;
    }
    if (isTransferLocked) {
      toast.error('Ce billet est actuellement en cours de transfert.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/tickets/${id}/pdf`, {
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        toast.error(errJson.error || 'Erreur lors de la génération du document PDF.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Billet-EventVillage-${ticketNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Billet officiel PDF téléchargé avec succès !');
    } catch (err) {
      console.error('[TicketCard] Erreur téléchargement PDF:', err);
      toast.error('Erreur réseau lors du téléchargement du PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!activeTransfer?.id) {
      toast.error('Identifiant de transfert introuvable.');
      return;
    }

    if (!window.confirm('Voulez-vous vraiment annuler ce transfert et récupérer votre billet ?')) {
      return;
    }

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/tickets/transfers/${activeTransfer.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Transfert annulé. Billet déverrouillé avec succès !');
        if (onCancelTransferSuccess) onCancelTransferSuccess();
      } else {
        toast.error(data.error || 'Erreur lors de l\'annulation du transfert.');
      }
    } catch {
      toast.error('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsCancelling(false);
    }
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

          <div className="absolute top-3 right-3 flex items-center gap-2">
            {isTransferLocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-md animate-pulse">
                <Lock size={10} /> Transfert en attente
              </span>
            ) : (
              <StatusBadge status={status} />
            )}
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

          {/* CAS : Billet verrouillé en transfert */}
          {isTransferLocked ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <Clock size={20} className="animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  Transfert en cours vers {activeTransfer?.recipient || 'un proche'}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Le QR code est temporairement sécurisé. Dès que le destinataire réclame le billet, la propriété lui sera transmise.
                </p>
              </div>

              {activeTransfer && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelTransfer}
                  isLoading={isCancelling}
                  leftIcon={<RotateCcw size={12} />}
                  className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Annuler le transfert
                </Button>
              )}
            </div>
          ) : (
            /* QR Code dynamique sécurisé (TOTP RFC 6238) */
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-inner">
                <QRCodeSVG
                  value={dynamicQr || qrCodeValue || ticketNumber}
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

              {/* Indicateur visuel de rotation temporelle anti-capture d'écran */}
              {status === 'VALIDE' && (
                <div className="w-full max-w-[210px] mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                      {isOffline ? 'Mode hors-ligne' : 'Protection anti-fraude'}
                    </span>
                    <span className="font-mono text-[11px] font-black text-[#FF5722]">{expiresIn}s</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-[#FF5722] to-[#FF3D68] transition-all duration-1000 ease-linear rounded-full"
                      style={{ width: `${Math.max(5, (expiresIn / totalStep) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 dark:text-zinc-400 text-center leading-tight">
                    {isOffline
                      ? 'Code actif en cache — vérifiez votre réseau'
                      : 'Le QR Code se renouvelle automatiquement (capture d\'écran invalide)'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sceau de validation */}
          {status === 'VALIDE' && !isTransferLocked && (
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
              <CheckCircle2 size={14} />
              <span>Billet authentique — Validé par Event Village</span>
            </div>
          )}

          {/* Instructions pour le porteur / Info utilisation */}
          {status === 'VALIDE' && !isTransferLocked ? (
            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#FF5722] text-[11px] font-medium text-center border border-orange-100 dark:border-orange-900/30">
              Présentez ce QR Code au contrôleur à l&apos;entrée de l&apos;événement.
            </div>
          ) : status === 'UTILISE' ? (
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 text-[11px] font-bold text-center border border-slate-200 dark:border-zinc-700 space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-zinc-300">
                <CheckCircle2 size={14} className="text-slate-500" />
                <span>Billet déjà utilisé & composté à l&apos;entrée</span>
              </div>
              {usedAt && (
                <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                  Composté le {new Date(usedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ) : !isTransferLocked ? (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 text-[11px] font-medium text-center border border-red-100 dark:border-red-900/30">
              Ce billet n&apos;est plus valide ({status.toLowerCase()}).
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. Actions (Transférer / WhatsApp / Téléchargement PDF officiel) */}
      <div className="mt-4 flex flex-wrap items-center gap-2 w-full max-w-md justify-between">
        {onOpenExplainer && (
          <button
            type="button"
            onClick={onOpenExplainer}
            className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 hover:text-[#FF5722] dark:hover:text-[#FF5722] flex items-center gap-1 transition-colors"
          >
            <HelpCircle size={13} />
            <span className="hidden sm:inline">Info transfert</span>
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {status === 'VALIDE' && !isTransferLocked && onTransferClick && (
            <Button
              variant="primary"
              size="sm"
              onClick={onTransferClick}
              leftIcon={<Send size={13} />}
            >
              Transférer
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleShareWhatsapp}
            leftIcon={<MessageCircle size={13} className="text-emerald-500" />}
            title="Partager sur WhatsApp"
          >
            WhatsApp
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadPdf}
            isLoading={isDownloadingPdf}
            disabled={status !== 'VALIDE' || isTransferLocked}
            leftIcon={<Download size={13} />}
          >
            {isDownloadingPdf ? 'Génération...' : 'PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
};
