'use client';

/**
 * Design 1b (point 8) — QR en grand, plein écran blanc, ouvert au toucher du QR de la carte (chargé à la demande).
 *  - Le QR reçu est celui que la carte affiche à cet instant (code dynamique du serveur, ou code du lot enregistré sur ce
 *    téléphone quand le réseau manque) : la carte continue de le renouveler, cette vue suit.
 *  - « Luminosité » : une page web ne peut pas régler la luminosité du téléphone ; on maximise ce qui est possible : fond
 *    blanc sur tout l'écran (même en thème sombre), QR noir le plus grand possible, et écran gardé allumé par l'API Screen
 *    Wake Lock quand le navigateur l'a (redemandée au retour sur la page) ; sans elle, rien ne bloque.
 *  - Fenêtre native <dialog> ouverte par showModal() : au-dessus de tout, fond inerte, Échap ferme, focus rendu au QR de
 *    la carte à la fermeture. Apparition de 200 ms en transparence seulement, coupée si « réduire les animations ».
 */
import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';

export interface QrFullscreenProps {
  /** Contenu du QR affiché par la carte à cet instant (jamais un identifiant statique). */
  value: string;
  eventTitle: string;
  categoryName: string;
  ticketNumber: string;
  /** Secondes avant le prochain code. */
  secondsLeft: number;
  onClose: () => void;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };

export function QrFullscreen({ value, eventTitle, categoryName, ticketNumber, secondsLeft, onClose }: QrFullscreenProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', onCancel);

    // Écran gardé allumé tant que le QR est en grand (navigateurs qui ont l'API) ; perdu quand la page est masquée.
    let sentinel: WakeLockSentinelLike | null = null;
    let active = true;
    const lock = async () => {
      const wakeLock = (navigator as WakeLockNavigator).wakeLock;
      if (!wakeLock || document.visibilityState !== 'visible') return;
      try {
        const s = await wakeLock.request('screen');
        if (active) sentinel = s;
        else void s.release().catch(() => undefined);
      } catch (err) {
        // Refus (économie d'énergie, onglet en arrière-plan) : l'écran suit son réglage, le QR reste affiché.
        console.warn('[QR en grand] écran non gardé allumé :', err instanceof Error ? err.message : String(err));
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void lock(); };
    void lock();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      dialog.removeEventListener('cancel', onCancel);
      document.removeEventListener('visibilitychange', onVisible);
      if (sentinel) void sentinel.release().catch(() => undefined);
      if (dialog.open) dialog.close();
      returnFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="qr-grand-titre"
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-white p-0 text-black backdrop:bg-white motion-safe:animate-in motion-safe:fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-full flex-col items-center justify-center gap-5 px-4 py-6 text-center">
        <div className="max-w-md">
          <h2 id="qr-grand-titre" className="text-lg font-bold leading-snug">{eventTitle}</h2>
          <p className="mt-1 text-base font-semibold">{categoryName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le QR en grand"
          className="rounded-2xl bg-white p-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <QRCodeSVG
            value={value}
            size={320}
            level="M"
            includeMargin
            title="QR d’entrée en grand"
            className="h-auto w-[min(84vw,60vh,22rem)]"
          />
        </button>
        <div className="space-y-1">
          <p className="text-base font-semibold tabular-nums tracking-wide">
            <span className="sr-only">Numéro du billet : </span>
            {ticketNumber}
          </p>
          <p className="text-base tabular-nums" aria-live="off">{`Nouveau code dans ${secondsLeft} s`}</p>
          <p className="text-sm">Montez la luminosité de votre téléphone pour faciliter le contrôle.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-black px-5 text-base font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <X size={18} aria-hidden="true" />
          Fermer
        </button>
      </div>
    </dialog>
  );
}
