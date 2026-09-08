'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Smartphone,
  QrCode,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Sparkles,
  FileText,
  UserCheck,
  Send,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TransferExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferExplainerModal: React.FC<TransferExplainerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!isOpen) return null;

  const faqs = [
    {
      q: 'Mon proche doit-il avoir un compte pour recevoir le billet ?',
      a: 'Oui, la création de compte est instantanée et 100% gratuite (juste son numéro de téléphone ou email). Cela garantit qu\'il est le seul propriétaire légitime du billet et que son QR code lui appartient.',
    },
    {
      q: 'Pourquoi une capture d\'écran (screenshot) ne marche pas ?',
      a: 'Pour protéger les festivaliers contre les duplications et le marché noir, nos billets utilisent un QR Code dynamique qui change automatiquement toutes les 20 secondes. Une capture figée sera refusée par les scanners officiels aux portes.',
    },
    {
      q: 'Que se passe-t-il si le destinataire ne réclame pas le billet ?',
      a: 'Le lien de transfert est sécurisé et valable pendant 48 heures. Si le destinataire ne l\'accepte pas dans ce délai, le billet revient automatiquement dans votre portefeuille sans aucune action de votre part.',
    },
    {
      q: 'Puis-je annuler le transfert si je me suis trompé de numéro ?',
      a: 'Absolument ! Tant que le destinataire n\'a pas cliqué sur "Accepter le billet", vous pouvez cliquer sur "Annuler le transfert" dans votre portefeuille. Le billet est immédiatement déverrouillé.',
    },
    {
      q: 'Puis-je exporter le billet en PDF et l\'imprimer ?',
      a: 'Oui, le bouton "PDF" génère un document officiel imprimable doté d\'une signature cryptographique de secours valide pour un scan unique aux entrées.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#16161A] border border-slate-200/80 dark:border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden text-left"
      >
        {/* Header Pinned */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-gradient-to-r from-orange-50/70 via-white to-orange-50/30 dark:from-orange-950/20 dark:via-[#16161A] dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF6A3D] to-[#FF3D68] text-white flex items-center justify-center shadow-md shadow-[#FF5722]/30 flex-shrink-0">
              <ArrowRightLeft size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  Comment marche le transfert ?
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                  <ShieldCheck size={11} /> 100% Officiel
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Transférez vos billets à vos proches en 3 étapes sécurisées.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-800 dark:text-zinc-200 text-xs sm:text-sm">
          {/* Les 3 Étapes Clés */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">
              Le parcours en 3 étapes simples
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Étape 1 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <Smartphone size={18} className="text-[#FF5722]" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    Indiquez le destinataire
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Saisissez son numéro de téléphone ou son email. Aucun frais ne s&apos;applique.
                  </p>
                </div>
              </div>

              {/* Étape 2 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <Send size={18} className="text-[#FF5722]" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    Lien envoyé par SMS
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Votre proche reçoit son lien privé sécurisé valable 48 heures.
                  </p>
                </div>
              </div>

              {/* Étape 3 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <UserCheck size={18} className="text-emerald-500" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    Réclamation en 1 clic
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Le billet est transféré sur son compte avec un nouveau QR code exclusif.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Comparatif Anti-Fraude : Capture vs Transfert Officiel */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-zinc-950 text-white border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles size={14} />
              <span>Pourquoi le transfert officiel est obligatoire ?</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 space-y-1.5">
                <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                  <AlertTriangle size={15} />
                  <span>Capture d&apos;écran (Interdit)</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Le QR code tourne toutes les 20s. Une capture d&apos;écran est <strong className="text-red-300">invalide et refusée</strong> à l&apos;entrée par les agents de sécurité.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/50 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 size={15} />
                  <span>Transfert Officiel (Garanti)</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Votre proche dispose de son propre QR code vivant et synchronisé. Entrée fluide et sereine garantie.
                </p>
              </div>
            </div>
          </div>

          {/* Foire Aux Questions (Accordéon) */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">
              Questions Fréquentes
            </h4>
            <div className="space-y-2">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-3.5 flex items-center justify-between text-left text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-100/50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
                        openFaq === idx ? 'rotate-180 text-[#FF5722]' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-3.5 pb-3.5 text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-100 dark:border-zinc-800/60 pt-2">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Pinned */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-[#16161A] flex items-center justify-end">
          <Button variant="primary" size="md" onClick={onClose} fullWidth className="sm:w-auto">
            J&apos;ai compris, c&apos;est clair !
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
