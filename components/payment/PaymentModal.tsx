'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertCircle, CheckCircle, Clock, CreditCard, Monitor, Smartphone, ShieldCheck } from 'lucide-react';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'ORDER' | 'HALL_RESERVATION' | 'TABLE_RESERVATION' | 'TICKET' | 'SUBSCRIPTION';
  targetId: string;
  amountFormatted: string;
  title: string;
  onPaymentSuccess?: () => void;
}

type ModalScreen = 'form' | 'ussd_pending' | 'qr_pending' | 'success';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  amountFormatted,
  title,
  onPaymentSuccess,
}) => {
  const [operator, setOperator] = useState<'wave' | 'om' | 'card'>('wave');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isInitiating, setIsInitiating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [screen, setScreen] = useState<ModalScreen>('form');
  const [pendingTransactionId, setPendingTransactionId] = useState('');
  const [omRedirectUrl, setOmRedirectUrl] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [pollElapsed, setPollElapsed] = useState(0);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const isPhoneValid = operator === 'card' || /^(7[0-8])\d{7}$/.test(phoneNumber.replace(/\s/g, ''));
  const phoneSanitized = phoneNumber.replace(/\s/g, '');

  // Nettoyage du polling quand le modal se ferme ou le composant se démonte
  useEffect(() => {
    if (!isOpen) stopPolling();
    return () => stopPolling();
  }, [isOpen]);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const startPolling = (transactionId: string) => {
    pollStartRef.current = Date.now();
    setPollElapsed(0);

    pollIntervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      setPollElapsed(elapsed);

      // Timeout après 3 minutes
      if (elapsed >= POLL_TIMEOUT_MS) {
        stopPolling();
        setScreen('form');
        setErrorMessage('Le délai de confirmation Orange Money a expiré. Vérifiez votre téléphone et réessayez.');
        return;
      }

      try {
        const res = await fetch(`/api/payments/${transactionId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        const status: string = data.status || data.payment?.status || '';

        if (status === 'SUCCESS') {
          stopPolling();
          setScreen('success');
          onPaymentSuccess?.();
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          stopPolling();
          setScreen('form');
          setErrorMessage('Le paiement Orange Money a échoué ou a été annulé. Veuillez réessayer.');
        }
      } catch {
        // Erreur réseau transitoire — on continue de poller
      }
    }, POLL_INTERVAL_MS);
  };

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          operator: operator === 'om' ? 'ORANGE_MONEY' : operator.toUpperCase(),
          customerPhone: phoneSanitized,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Échec de l\'initialisation du paiement.');
      }

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const redirectTarget: string = data.redirect_url || data.payment_url || '';
      const qrCodeData: string = data.qr_code || '';

      // ── Mobile : Deep Link immédiat (Wave OU Orange Money) ──
      if (isMobile && redirectTarget) {
        window.location.href = redirectTarget;
        return;
      }

      // ── Desktop + QR Code : affichage QR + polling ──
      if (!isMobile && qrCodeData) {
        setQrCode(qrCodeData);
        setPendingTransactionId(data.transaction_id);
        setScreen('qr_pending');
        startPolling(data.transaction_id);
        setIsInitiating(false);
        return;
      }

      // ── Fallback Desktop sans QR : redirection quand même ──
      if (redirectTarget) {
        window.location.href = redirectTarget;
        return;
      }

      // ── Fallback ultime OM Push USSD (aucune URL, aucun QR) ──
      if (data.is_push_ussd) {
        setPendingTransactionId(data.transaction_id);
        setOmRedirectUrl('');
        setScreen('ussd_pending');
        startPolling(data.transaction_id);
        setIsInitiating(false);
        return;
      }

      throw new Error('URL de paiement non reçue. Veuillez réessayer.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur inattendue.');
      setIsInitiating(false);
    }
  };

  const handleClose = () => {
    if (screen === 'ussd_pending') return; // Bloquer la fermeture pendant le Push USSD
    stopPolling();
    setErrorMessage('');
    setScreen('form');
    setPendingTransactionId('');
    setQrCode('');
    setOmRedirectUrl('');
    onClose();
  };

  const handleCancelUssd = () => {
    stopPolling();
    setScreen('form');
    setPendingTransactionId('');
    setOmRedirectUrl('');
    setQrCode('');
    setErrorMessage('');
  };

  const pollRemainingMs = Math.max(0, POLL_TIMEOUT_MS - pollElapsed);
  const pollRemainingMin = Math.ceil(pollRemainingMs / 60000);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Paiement Sécurisé SamirPay">
      <div className="space-y-4">

        {/* ── ÉCRAN : FORMULAIRE ── */}
        {screen === 'form' && (
          <>
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

            {/* Erreur */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-700 dark:text-red-300">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => setErrorMessage('')}
                    className="text-[11px] text-red-500 hover:text-red-700 font-bold mt-1"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            )}

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
                  onClick={() => setOperator('card')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all col-span-2 ${
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

            {/* Numéro de téléphone */}
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

            <Button
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isInitiating}
              disabled={operator !== 'card' && !isPhoneValid}
              onClick={handleInitiatePayment}
            >
              {isInitiating ? 'Connexion à SamirPay...' : `Payer ${amountFormatted}`}
            </Button>
          </>
        )}

        {/* ── ÉCRAN : ATTENTE PUSH USSD ORANGE MONEY ── */}
        {screen === 'ussd_pending' && (
          <div className="flex flex-col items-center gap-5 py-4">
            {/* Icône animée */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40 animate-ping opacity-30" />
              <div className="relative w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 flex items-center justify-center">
                <Smartphone size={28} className="text-[#F44336]" />
              </div>
            </div>

            {/* Instruction principale */}
            <div className="text-center space-y-1.5 px-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Validez sur votre téléphone
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Un message <span className="font-bold text-[#F44336]">Orange Money</span> a été envoyé
                au <span className="font-mono font-bold">+221{phoneSanitized}</span>.
                Saisissez votre <span className="font-bold">code secret Orange Money</span> pour confirmer le paiement de{' '}
                <span className="font-bold text-[#FF5722]">{amountFormatted}</span>.
              </p>
            </div>

            {/* Indicateur de polling */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
              <Clock size={12} className="animate-pulse" />
              <span>En attente de confirmation… ({pollRemainingMin} min restante{pollRemainingMin > 1 ? 's' : ''})</span>
            </div>

            {/* Bouton de secours : Fallback Deep Link OM (si SamirPay le fournit) */}
            {omRedirectUrl && (
              <a
                href={omRedirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/40 text-xs font-bold text-[#F44336] hover:bg-orange-100 dark:hover:bg-orange-950/60 transition-colors"
              >
                <Smartphone size={15} />
                Si le Push ne s&apos;affiche pas — Ouvrir Orange Money
              </a>
            )}

            {/* Ref transaction (debug discret) */}
            <p className="text-[10px] text-slate-300 dark:text-zinc-600 font-mono">
              Ref : {pendingTransactionId.slice(-12)}
            </p>

            <button
              type="button"
              onClick={handleCancelUssd}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 underline"
            >
              Annuler et choisir un autre moyen de paiement
            </button>
          </div>
        )}

        {/* ── ÉCRAN : QR CODE (DESKTOP) ── */}
        {screen === 'qr_pending' && (
          <div className="flex flex-col items-center gap-5 py-4">
            {/* En-tête Desktop */}
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
                <Monitor size={16} className="text-slate-400 dark:text-zinc-500" />
                Scannez avec votre téléphone
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Ouvrez{' '}
                <span className="font-bold text-[#F44336]">
                  {operator === 'om' ? 'Orange Money' : operator === 'wave' ? 'Wave' : 'votre application'}
                </span>{' '}
                sur mobile et scannez ce code
              </p>
            </div>

            {/* QR Code Image */}
            <div className="p-3 rounded-2xl bg-white border border-slate-200 dark:border-zinc-700 shadow-sm">
              <img
                src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code de paiement"
                width={176}
                height={176}
                className="w-44 h-44 object-contain"
              />
            </div>

            <p className="text-[11px] text-slate-400 dark:text-zinc-500 text-center max-w-[220px] leading-relaxed">
              Appuyez sur <span className="font-bold">Scanner</span> dans l&apos;application, pointez vers ce QR Code et confirmez le paiement de{' '}
              <span className="font-bold text-[#FF5722]">{amountFormatted}</span>.
            </p>

            {/* Indicateur de polling */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
              <Clock size={12} className="animate-pulse" />
              <span>En attente du scan… ({pollRemainingMin} min restante{pollRemainingMin > 1 ? 's' : ''})</span>
            </div>

            {/* Ref transaction */}
            <p className="text-[10px] text-slate-300 dark:text-zinc-600 font-mono">
              Ref : {pendingTransactionId.slice(-12)}
            </p>

            <button
              type="button"
              onClick={handleCancelUssd}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 underline"
            >
              Annuler et choisir un autre moyen de paiement
            </button>
          </div>
        )}

        {/* ── ÉCRAN : SUCCÈS ── */}
        {screen === 'success' && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Paiement confirmé !</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Votre paiement Orange Money de <span className="font-bold text-emerald-600">{amountFormatted}</span> a été validé.
              </p>
            </div>
            <Button variant="primary" fullWidth onClick={() => { setScreen('form'); onClose(); }}>
              Fermer
            </Button>
          </div>
        )}

      </div>
    </Modal>
  );
};
