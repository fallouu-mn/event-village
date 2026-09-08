'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Smartphone,
  Mail,
  ShieldCheck,
  Clock,
  HelpCircle,
  CheckCircle2,
  Share2,
  MessageCircle,
  Copy,
  Check,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';

export interface TransferTicketData {
  id: string;
  ticketNumber: string;
  eventTitle: string;
  dateFormatted?: string;
  timeFormatted?: string;
  seat?: string;
  venue?: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: TransferTicketData | null;
  onTransferSuccess: (ticketId: string) => void;
  onOpenExplainer?: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onTransferSuccess,
  onOpenExplainer,
}) => {
  const { session } = useAuth();
  const toast = useToast();

  const [recipient, setRecipient] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    transfer_id: string;
    ticket_number: string;
    recipient: string;
    expires_at: string;
    claim_url?: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !ticket) return null;

  const handleClose = () => {
    setRecipient('');
    setErrorMsg(null);
    setSuccessData(null);
    setIsCopied(false);
    onClose();
  };

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
  const isPhone = /^\+?\d{8,15}$/.test(recipient.replace(/[\s\-\(\)\.]/g, ''));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) {
      setErrorMsg('Veuillez saisir un numéro de téléphone ou une adresse email.');
      return;
    }

    if (!isEmail && !isPhone) {
      setErrorMsg('Format invalide. Saisissez un numéro (ex: 77 123 45 67) ou un email valide.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          recipient: recipient.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Impossible d\'initier le transfert.');
        return;
      }

      setSuccessData({
        transfer_id: data.transfer.transfer_id,
        ticket_number: data.transfer.ticket_number,
        recipient: data.transfer.recipient,
        expires_at: data.transfer.expires_at,
        claim_url: data.transfer.claim_url,
      });

      toast.success(`Transfert initié vers ${data.transfer.recipient}`);
      onTransferSuccess(ticket.id);
    } catch (err: any) {
      setErrorMsg('Erreur de connexion. Veuillez vérifier votre réseau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const claimLink = successData?.claim_url || (typeof window !== 'undefined' ? `${window.location.origin}/tickets` : 'https://eventvillage.sn/tickets');
  const shareText = `Bonjour ! Je viens de t'offrir un billet officiel pour "${ticket.eventTitle}" (${ticket.seat || 'Pass Standard'}) sur Event Village. Clique ici pour l'ajouter à tes billets : ${claimLink}`;

  const handleCopyShareText = () => {
    navigator.clipboard.writeText(shareText);
    setIsCopied(true);
    toast.success('Lien et message d\'invitation copiés !');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleShareWhatsapp = () => {
    const encoded = encodeURIComponent(shareText);
    const rawPhone = successData?.recipient || recipient;
    const phoneClean = rawPhone.replace(/\D/g, '');
    const waPhone = phoneClean.startsWith('221') ? phoneClean : phoneClean.length === 9 ? `221${phoneClean}` : phoneClean;
    const waUrl = waPhone.length >= 9 ? `https://wa.me/${waPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Billet ${ticket.eventTitle}`,
        text: shareText,
      }).catch(() => {});
    } else {
      handleCopyShareText();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-[#16161A] border border-slate-200/80 dark:border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-left max-h-[92dvh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-gradient-to-r from-orange-50/60 to-transparent dark:from-orange-950/20 dark:to-transparent flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF6A3D] to-[#FF3D68] text-white flex items-center justify-center shadow-md shadow-[#FF5722]/30 flex-shrink-0">
              <Send size={18} className="translate-x-0.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                Transférer ce billet
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                N° {ticket.ticketNumber} • {ticket.seat || 'Pass Standard'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800 dark:text-zinc-200">
          {successData ? (
            /* ÉTAT DE SUCCÈS */
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>

              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  Transfert initié avec succès !
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                  Le billet est maintenant réservé pour <strong className="text-slate-900 dark:text-white font-mono">{successData.recipient}</strong>.
                </p>
              </div>

              {/* Box détails & expiration */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Événement :</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {ticket.eventTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Délai d&apos;acceptation :</span>
                  <span className="font-bold text-[#FF5722] flex items-center gap-1">
                    <Clock size={12} /> 48 heures max
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Statut du billet :</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    🔒 Verrouillé jusqu&apos;à réclamation
                  </span>
                </div>
              </div>

              {/* Actions de partage immédiat */}
              <div className="space-y-2 pt-2">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Prévenez votre proche directement :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleShareWhatsapp}
                    leftIcon={<MessageCircle size={16} className="text-emerald-500" />}
                    fullWidth
                  >
                    WhatsApp
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleNativeShare}
                    leftIcon={isCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    fullWidth
                  >
                    {isCopied ? 'Copié !' : 'Partager'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* FORMULAIRE DE TRANSFERT */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Carte Récapitulative du Billet */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
                    Événement
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white truncate mt-0.5">
                    {ticket.eventTitle}
                  </p>
                  {(ticket.dateFormatted || ticket.timeFormatted) && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {ticket.dateFormatted} {ticket.timeFormatted ? `à ${ticket.timeFormatted}` : ''}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
                    Frais
                  </span>
                  <p className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    0 FCFA (Gratuit)
                  </p>
                </div>
              </div>

              {/* Champ Destinataire */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">
                  Numéro de téléphone ou Email du destinataire <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                    {isEmail ? <Mail size={16} /> : <Smartphone size={16} />}
                  </div>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => {
                      setRecipient(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Ex: 77 123 45 67 ou ami@gmail.com"
                    autoFocus
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Le destinataire recevra un SMS/Email avec son lien personnel pour réclamer le billet.
                </p>
              </div>

              {/* Message d'erreur */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Règles de Sécurité & Reassurance */}
              <div className="p-3.5 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 space-y-2 text-xs text-slate-700 dark:text-zinc-300">
                <div className="flex items-center gap-1.5 font-bold text-[#FF5722] text-xs">
                  <ShieldCheck size={14} />
                  <span>Garantie Sécurité Event Village</span>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-zinc-400">
                  <li>• Dès acceptation, un nouveau QR code dynamique sera émis pour votre proche.</li>
                  <li>• Le lien expire sous 48h : si non réclamé, le billet vous est restitué automatiquement.</li>
                  <li>• Vous pouvez annuler le transfert à tout moment avant réclamation.</li>
                </ul>
              </div>

              {/* Lien d'aide */}
              {onOpenExplainer && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={onOpenExplainer}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF5722] hover:underline"
                  >
                    <HelpCircle size={13} />
                    <span>Comment fonctionne le transfert ? (Explications & FAQ)</span>
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-[#16161A] flex items-center justify-end gap-2 flex-shrink-0">
          {successData ? (
            <Button variant="primary" size="md" onClick={handleClose} fullWidth className="sm:w-auto">
              Terminer
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="md"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                leftIcon={<Send size={15} />}
              >
                {isSubmitting ? 'Transfert en cours...' : 'Envoyer le billet (0 FCFA)'}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
