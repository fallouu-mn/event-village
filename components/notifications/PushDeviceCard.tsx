'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellOff, BellRing, MonitorSmartphone, Send, ShieldOff, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { TONE_ICON, type Tone } from '@/components/ui/tones';
import { currentPushState, disablePush, enablePush, type PushState } from '@/lib/push/client';

/**
 * État des notifications push SUR CET APPAREIL (lot 6, contrat H4 et F4 « Client »).
 *
 *  - Lecture de l'état au montage par currentPushState(), qui ne demande jamais rien.
 *  - La demande d'autorisation du navigateur n'a lieu QU'AU CLIC sur « Activer les notifications »
 *    (handleEnable, gestionnaire onClick qui appelle enablePush) : jamais au chargement ni dans un effet.
 *  - Cinq états : activées (Désactiver, Envoyer une notification d'essai), refusées dans le navigateur
 *    (aide pour les réactiver, pas de bouton d'activation), non prises en charge (aide pour iPhone),
 *    indisponibles pour le moment (canal non configuré sur le serveur, bouton inactif), désactivées.
 *  - Le bouton d'essai appelle POST /api/notifications/essai-push : la notification part au prochain
 *    passage de l'envoyeur (aucun envoi depuis le navigateur).
 */

type CardState = PushState | 'checking';

interface StateCopy {
  title: string;
  description: string;
  icon: React.ElementType;
  tone: Tone;
}

const COPY: Record<PushState, StateCopy> = {
  enabled: {
    title: 'Activées sur cet appareil',
    description: 'Rappels, transferts et changements d’événement s’affichent ici, même quand l’application est fermée.',
    icon: BellRing,
    tone: 'success',
  },
  denied: {
    title: 'Refusées dans le navigateur',
    description: 'Vous avez bloqué les notifications pour Event Village. Pour les réactiver, ouvrez les réglages du site dans votre navigateur (icône à gauche de l’adresse), autorisez les notifications, puis revenez sur cette page.',
    icon: ShieldOff,
    tone: 'warning',
  },
  unsupported: {
    title: 'Non prises en charge par ce navigateur',
    description: 'Ce navigateur ne reçoit pas les notifications push. Sur iPhone, ajoutez d’abord Event Village à l’écran d’accueil (bouton Partager, puis « Sur l’écran d’accueil »), ouvrez l’application depuis cette icône, puis revenez ici.',
    icon: MonitorSmartphone,
    tone: 'neutral',
  },
  unavailable: {
    title: 'Indisponibles pour le moment',
    description: 'Les notifications push ne sont pas encore proposées par Event Village. Vous recevez vos messages dans l’application et par SMS.',
    icon: WifiOff,
    tone: 'neutral',
  },
  disabled: {
    title: 'Désactivées',
    description: 'Activez-les pour recevoir vos rappels et vos billets transférés sur cet appareil, sans ouvrir l’application.',
    icon: BellOff,
    tone: 'neutral',
  },
};

async function readTestResponse(res: Response): Promise<{ message: string | null }> {
  try {
    const body = await res.json() as { message?: unknown; error?: unknown };
    const text = res.ok ? body.message : body.error;
    return { message: typeof text === 'string' && text ? text : null };
  } catch (err) {
    console.error(`[PushDeviceCard] réponse de l’essai illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return { message: null };
  }
}

export function PushDeviceCard() {
  const toast = useToast();
  const [state, setState] = useState<CardState>('checking');
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const refreshState = useCallback(async () => {
    try {
      setState(await currentPushState());
      setReadError(null);
    } catch (err) {
      console.error('[PushDeviceCard] état du push illisible :', err instanceof Error ? err.message : String(err));
      setReadError('L’état des notifications sur cet appareil n’a pas pu être lu.');
      setState('unavailable');
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const handleEnable = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      const next = await enablePush();
      setState(next);
      if (next === 'enabled') toast.success('Notifications activées sur cet appareil.');
      else if (next === 'denied') setActionError('Vous avez refusé les notifications dans le navigateur.');
      else if (next === 'disabled') setActionError('Aucune autorisation donnée : les notifications restent désactivées.');
    } catch (err) {
      console.error('[PushDeviceCard] activation impossible :', err instanceof Error ? err.message : String(err));
      setActionError(err instanceof Error && err.message ? err.message : 'Activation impossible pour le moment. Réessayez.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisable = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      await disablePush();
      toast.success('Notifications désactivées sur cet appareil.');
      await refreshState();
    } catch (err) {
      console.error('[PushDeviceCard] désactivation impossible :', err instanceof Error ? err.message : String(err));
      setActionError(err instanceof Error && err.message ? err.message : 'Désactivation impossible pour le moment. Réessayez.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/notifications/essai-push', { method: 'POST', credentials: 'same-origin' });
      const { message } = await readTestResponse(res);
      if (res.ok) {
        toast.success(message ?? 'Notification d’essai envoyée : elle arrive dans la minute.');
      } else {
        setActionError(message ?? `La notification d’essai n’a pas pu être envoyée (erreur ${res.status}).`);
      }
    } catch (err) {
      console.error('[PushDeviceCard] essai injoignable :', err instanceof Error ? err.message : String(err));
      setActionError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsTesting(false);
    }
  };

  const headingId = 'appareil-push-titre';

  if (state === 'checking') {
    return (
      <section aria-labelledby={headingId} aria-busy="true" className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold text-fg">
          <Smartphone size={18} aria-hidden="true" />
          Sur cet appareil
        </h2>
        <div className="mt-3 h-5 w-2/3 rounded-md bg-surface-sunken motion-safe:animate-pulse" aria-hidden="true" />
        <p className="sr-only">Lecture de l’état des notifications…</p>
      </section>
    );
  }

  const copy = COPY[state];
  const Icon = copy.icon;

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold text-fg">
        <Smartphone size={18} aria-hidden="true" />
        Sur cet appareil
      </h2>

      <div className="flex items-start gap-3" role="status">
        <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', TONE_ICON[copy.tone])} aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-fg">{copy.title}</p>
          <p className="text-sm leading-relaxed text-fg-muted">{copy.description}</p>
        </div>
      </div>

      {readError && (
        <StatusBanner tone="warning" title="État incertain">
          {readError}
        </StatusBanner>
      )}

      {actionError && (
        <StatusBanner tone="danger" announce="alert" title="Action impossible">
          {actionError}
        </StatusBanner>
      )}

      <div className="flex flex-wrap gap-2">
        {state === 'enabled' && (
          <>
            <Button
              variant="primary"
              onClick={() => void handleTest()}
              isLoading={isTesting}
              disabled={isWorking}
              leftIcon={<Send size={18} aria-hidden="true" />}
            >
              {"Envoyer une notification d'essai"}
            </Button>
            <Button variant="secondary" onClick={() => void handleDisable()} isLoading={isWorking} disabled={isTesting}>
              Désactiver
            </Button>
          </>
        )}
        {state === 'disabled' && (
          <Button variant="primary" onClick={() => void handleEnable()} isLoading={isWorking} leftIcon={<BellRing size={18} aria-hidden="true" />}>
            Activer les notifications
          </Button>
        )}
        {state === 'unavailable' && (
          <Button variant="secondary" disabled leftIcon={<BellRing size={18} aria-hidden="true" />}>
            Activer les notifications
          </Button>
        )}
      </div>
    </section>
  );
}
