'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, AlertCircle, Smartphone, CreditCard, ShieldCheck } from 'lucide-react';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'ORDER' | 'HALL_RESERVATION' | 'TABLE_RESERVATION' | 'TICKET' | 'SUBSCRIPTION';
  targetId: string;
  amountFormatted: string; // e.g. "25 000 FCFA"
  title: string;
  onPaymentSuccess?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  amountFormatted,
  title,
  onPaymentSuccess,
}) => {
  const [operator, setOperator] = useState<'wave' | 'om' | 'free' | 'card'>('wave');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isInitiating, setIsInitiating] = useState(false);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isPhoneValid = operator === 'card' || /^(7[0-8])\d{7}$/.test(phoneNumber.replace(/\s/g, ''));
  const phoneSanitized = phoneNumber.replace(/\s/g, '');

  // Hook Supabase Realtime écoutant le changement de statut en base
  const { payment, status: realtimeStatus, connected } = usePaymentStatus(activeTransactionId);

  // Effet réactif dès que la transaction passe à SUCCESS dans PostgreSQL
  useEffect(() => {
    if (realtimeStatus === 'SUCCESS') {
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    }
  }, [realtimeStatus, onPaymentSuccess]);

  const handleInitiatePayment = async () => {
    if (isInitiating) return;

    if (operator !== 'card' && !isPhoneValid) {
      setPhoneError('Entrez un numéro sénégalais valide (7X XXX XX XX).');
      return;
    }
    setPhoneError('');
    setIsInitiating(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetType,
          targetId,
          customerPhone: phoneSanitized,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Échec de l’initialisation du paiement.');
      }

      setActiveTransactionId(data.transaction_id || data.order_id);

      if (data.payment_url) {
        window.open(data.payment_url, '_blank');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur inattendue.');
      setActiveTransactionId(null);
    } finally {
      setIsInitiating(false);
    }
  };

  const handleReset = () => {
    setActiveTransactionId(null);
    setErrorMessage('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const isPending = activeTransactionId !== null && (realtimeStatus === 'PENDING' || realtimeStatus === 'IDLE');
  const isSuccess = realtimeStatus === 'SUCCESS';
  const isFailed = realtimeStatus === 'FAILED' || realtimeStatus === 'CANCELLED' || errorMessage !== '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Paiement Sécurisé SamirPay">
      {isSuccess ? (
        <div className="flex flex-col items-center text-center py-6 space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <CheckCircle2 size={36} />
          </div>
          <h4 className="text-lg font-black text-slate-900 dark:text-white">Paiement Validé !</h4>
          <p className="text-xs text-slate-600 dark:text-zinc-300">
            Votre transaction de <span className="font-bold text-[#FF5722]">{amountFormatted}</span> a été confirmée par SamirPay.
          </p>
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
            Réf : {payment?.transaction_id || activeTransactionId}
          </span>
          <div className="pt-3 w-full">
            <Button variant="primary" fullWidth onClick={handleClose}>
              Voir mes billets & commandes
            </Button>
          </div>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center text-center py-6 space-y-4">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-zinc-800 border-t-[#FF5722] animate-spin" />
            <Smartphone size={24} className="text-[#FF5722]" />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 dark:text-white">Validation en cours...</h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs">
              Veuillez approuver la notification de débit sur votre application <strong className="capitalize text-slate-900 dark:text-white">{operator}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-[11px] text-slate-600 dark:text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <span>{connected ? 'Supabase Realtime actif' : 'Connexion...'}</span>
          </div>

          <Button variant="secondary" size="sm" onClick={handleReset}>
            Changer de moyen de paiement
          </Button>
        </div>
      ) : isFailed ? (
        <div className="flex flex-col items-center text-center py-6 space-y-3">
          <div className="w-16 h-16 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/30">
            <AlertCircle size={36} />
          </div>
          <h4 className="text-lg font-black text-slate-900 dark:text-white">Échec de la transaction</h4>
          <p className="text-xs text-red-600 dark:text-red-400">{errorMessage || 'Le paiement a été rejeté ou annulé.'}</p>
          <div className="flex gap-2 w-full pt-3">
            <Button variant="secondary" fullWidth onClick={handleClose}>
              Annuler
            </Button>
            <Button variant="primary" fullWidth onClick={handleReset}>
              Réessayer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Récapitulatif */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
            <div className="max-w-[180px]">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold">Article</span>
              <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{title}</h4>
            </div>
            <span className="text-sm sm:text-base font-black text-[#FF5722] px-3 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/30">
              {amountFormatted}
            </span>
          </div>

          {/* Sélection moyen de paiement */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
              Moyen de paiement
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOperator('wave')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                  operator === 'wave'
                    ? 'border-[#FF5722] bg-[#FF5722]/10 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <Smartphone size={18} className="text-[#FF5722]" />
                <span className="text-xs">Wave Sénégal</span>
              </button>

              <button
                type="button"
                onClick={() => setOperator('om')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                  operator === 'om'
                    ? 'border-[#FF5722] bg-[#FF5722]/10 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <Smartphone size={18} className="text-[#F44336]" />
                <span className="text-xs">Orange Money</span>
              </button>

              <button
                type="button"
                onClick={() => setOperator('free')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                  operator === 'free'
                    ? 'border-[#FF5722] bg-[#FF5722]/10 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <Smartphone size={18} className="text-red-500" />
                <span className="text-xs">Free Money</span>
              </button>

              <button
                type="button"
                onClick={() => setOperator('card')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                  operator === 'card'
                    ? 'border-[#FF5722] bg-[#FF5722]/10 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <CreditCard size={18} className="text-blue-500" />
                <span className="text-xs">Carte Bancaire</span>
              </button>
            </div>
          </div>

          {/* Numéro de téléphone pour Mobile Money */}
          {operator !== 'card' && (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Numéro Mobile Money
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="77 123 45 67"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setPhoneError('');
                }}
                className={`w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border text-xs font-mono font-bold focus:outline-none ${
                  phoneError
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-200 dark:border-zinc-800 focus:border-[#FF5722]'
                }`}
              />
              {phoneError && (
                <p className="text-[11px] text-red-500 mt-1">{phoneError}</p>
              )}
            </div>
          )}

          {/* Sceau de sécurité */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Paiement crypté 256-bit certifié par SamirPay API</span>
          </div>

          {/* Bouton de confirmation */}
          <Button
            variant="primary"
            fullWidth
            size="lg"
            isLoading={isInitiating}
            disabled={operator !== 'card' && !isPhoneValid}
            onClick={handleInitiatePayment}
          >
            {isInitiating ? 'Paiement en cours...' : `Confirmer & Payer ${amountFormatted}`}
          </Button>
        </div>
      )}
    </Modal>
  );
};
