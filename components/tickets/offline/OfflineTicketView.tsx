'use client';

/**
 * Lot 7, tâche 7.1 (contrat 5.2, D26, D35) — billet présenté sans réseau, à partir du lot enregistré sur le
 * téléphone (aucune donnée du serveur au moment de l'affichage).
 *
 *  - Le code affiché est celui de l'heure du serveur : heure du téléphone + écart mesuré au téléchargement
 *    (pickOfflineCode) ; la minuterie est calée sur la frontière de pas, le QR change à l'instant où le
 *    serveur change de code. Jamais de QR figé : hors du lot, plus de QR.
 *  - Le conteneur du QR porte `data-ev-qr-payload` (contenu identique au QR) et `data-ev-qr-counter` (e2e).
 *  - Fond blanc fixe sous le QR, même en thème sombre : contraste maximal pour les lecteurs (trace E2-002).
 *  - Rappels : numéro du billet et pièce d'identité au contrôle, capture d'écran refusée, iPhone.
 *  - L'écran reste allumé pendant l'affichage du QR quand le navigateur le permet (Wake Lock).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarDays, IdCard, MapPin, ShieldCheck, Smartphone } from 'lucide-react';
import { formatDateTime, formatTime } from '@/lib/format';
import { pickOfflineCode, type OfflineLot } from '@/lib/tickets/offline-clock';
import { OfflineStatusBadge } from './OfflineStatusBadge';

export interface OfflineTicketViewProps {
  lot: OfflineLot;
}

/** Écart d'horloge à partir duquel le téléphone est signalé « pas à l'heure » (le code reste juste). */
const NOTICEABLE_OFFSET_MS = 60_000;

function offsetLabel(offsetMs: number): string {
  const minutes = Math.round(Math.abs(offsetMs) / 60_000);
  const amount = minutes >= 1 ? `${minutes} min` : `${Math.round(Math.abs(offsetMs) / 1000)} s`;
  return offsetMs > 0 ? `en retard de ${amount}` : `en avance de ${amount}`;
}

/** Garde l'écran allumé tant que `active` ; un refus du navigateur est journalisé, l'affichage continue. */
function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (!wakeLock) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      wakeLock.request('screen').then((s) => {
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
      }).catch((err: unknown) => {
        console.warn('[hors-ligne] écran laissé en veille automatique (Wake Lock refusé) :', err instanceof Error ? err.message : String(err));
      });
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      if (sentinel) {
        sentinel.release().catch((err: unknown) => {
          console.warn('[hors-ligne] libération du Wake Lock impossible :', err instanceof Error ? err.message : String(err));
        });
      }
    };
  }, [active]);
}

export const OfflineTicketView: React.FC<OfflineTicketViewProps> = ({ lot }) => {
  const [deviceNow, setDeviceNow] = useState<number>(() => Date.now());
  const pick = useMemo(() => pickOfflineCode(lot, deviceNow), [lot, deviceNow]);

  // Minuterie calée sur la frontière de pas (au plus une seconde, pour le compte à rebours).
  useEffect(() => {
    const delay = pick.state === 'code' ? Math.min(1000, pick.nextChangeInMs + 20) : 1000;
    const timer = setTimeout(() => setDeviceNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [deviceNow, pick]);

  useEffect(() => {
    if (pick.state === 'corrupt') console.warn(`[hors-ligne] lot du billet ${lot.ticket_id} illisible : ${pick.reason}`);
  }, [pick, lot.ticket_id]);

  const showing = pick.state === 'code';
  useScreenWakeLock(showing);

  const t = lot.ticket;
  const secondsLeft = pick.state === 'code' ? Math.max(1, Math.ceil(pick.nextChangeInMs / 1000)) : 0;
  const stepSeconds = Math.max(1, Number(lot.step_seconds) || 20);
  const offsetMs = Number(lot.offsetMs) || 0;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-surface shadow-md" aria-labelledby={`hors-ligne-${lot.ticket_id}`}>
      <header className="space-y-2 border-b-2 border-dashed border-border p-5">
        <h2 id={`hors-ligne-${lot.ticket_id}`} className="text-xl font-bold leading-tight tracking-tight text-fg">{t.event_title}</h2>
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <CalendarDays size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          <time dateTime={t.event_start_at} className="font-medium text-fg">{formatDateTime(t.event_start_at)}</time>
        </p>
        {(t.location || t.city) && (
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <MapPin size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
            <span>{[t.location, t.city].filter(Boolean).join(', ')}</span>
          </p>
        )}
        {t.category && <p className="text-sm font-semibold text-fg">{t.category}</p>}
      </header>

      <div className="flex flex-col items-center gap-4 p-5">
        {pick.state === 'code' ? (
          <>
            <OfflineStatusBadge state="available" className="w-full" />
            <div
              data-ev-qr-payload={pick.payload}
              data-ev-qr-counter={pick.counter}
              className="flex aspect-square w-full max-w-72 items-center justify-center rounded-2xl border border-border bg-white p-4"
            >
              <QRCodeSVG value={pick.payload} size={256} level="M" title="QR d’entrée du billet" className="h-full w-full" />
            </div>
            <div className="w-full space-y-2 rounded-xl border border-border bg-surface-sunken p-3">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold text-fg">
                <span>Code renouvelé toutes les {stepSeconds} s</span>
                <span className="font-mono tabular-nums text-brand-fg">
                  <span aria-hidden="true">{secondsLeft} s</span>
                  <span className="sr-only">Nouveau code dans {secondsLeft} secondes</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-brand-decor transition-[width] duration-1000 ease-linear"
                  style={{ width: `${Math.max(5, Math.min(100, (pick.nextChangeInMs / pick.stepMs) * 100))}%` }}
                />
              </div>
              <p className="text-center text-sm text-fg-muted">
                Heure du contrôle : <time dateTime={new Date(pick.serverNow).toISOString()} className="font-mono tabular-nums text-fg">{formatTime(pick.serverNow)}</time>
              </p>
              {Math.abs(offsetMs) >= NOTICEABLE_OFFSET_MS && (
                <p className="text-center text-sm text-fg-muted">
                  Ce téléphone est {offsetLabel(offsetMs)} : le code affiché en tient compte.
                </p>
              )}
            </div>
          </>
        ) : pick.state === 'not_yet' ? (
          <div className="w-full space-y-2" data-ev-offline-detail="not_yet">
            <OfflineStatusBadge state="not_yet" className="w-full" availableFrom={pick.opensAt} />
            <p className="text-sm text-fg-muted">
              Le code d’entrée s’affichera ici à partir du <time dateTime={pick.opensAt} className="font-semibold text-fg">{formatDateTime(pick.opensAt)}</time>, même sans réseau.
            </p>
          </div>
        ) : (
          <div className="w-full space-y-2" data-ev-offline-detail={pick.state}>
            <OfflineStatusBadge state="expired" className="w-full" />
            <p className="text-sm text-fg-muted">
              {pick.state === 'clock_changed'
                ? 'L’heure de ce téléphone a reculé depuis l’enregistrement du billet : le code ne peut plus être calculé. Remettez l’heure automatique, ou ouvrez le billet avec du réseau.'
                : pick.state === 'corrupt'
                  ? 'Le billet enregistré sur ce téléphone est illisible. Ouvrez-le avec du réseau pour l’enregistrer de nouveau.'
                  : 'Ouvrez le billet dans Mes billets avec du réseau pour recevoir de nouveaux codes.'}
            </p>
          </div>
        )}

        <p className="text-center">
          <span className="block text-sm text-fg-muted">Numéro du billet</span>
          <span className="font-mono text-lg font-bold tabular-nums tracking-wide text-fg">{t.ticket_number}</span>
        </p>

        <ul className="w-full space-y-2 text-sm leading-snug text-fg-muted">
          <li className="flex items-start gap-2">
            <IdCard size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
            <span>Sans téléphone : numéro du billet et pièce d’identité au contrôle.</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
            <span>Une capture d’écran n’est pas acceptée : le code change toutes les {stepSeconds} s.</span>
          </li>
          <li className="flex items-start gap-2">
            <Smartphone size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
            <span>Sur iPhone, ouvrez Event Village depuis son icône de l’écran d’accueil, avec du réseau, avant d’arriver : le billet y reste disponible sans réseau.</span>
          </li>
        </ul>
      </div>
    </article>
  );
};
