'use client';

import React, { useState } from 'react';
import { CalendarClock, Gift, Hourglass, MapPin, ShieldCheck, Ticket, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { PhoneVerifyDialog } from '@/components/tickets/PhoneVerifyDialog';
import { formatDateTime, formatEventDateTime, formatFcfa } from '@/lib/format';

/**
 * Billets reçus (lot 6, contrat B3 à B5 et amendement 2) : onglet « Reçus » de « Mes billets ».
 *
 *  - Source : GET /api/tickets/transfers/incoming (transferts en attente vers le numéro VÉRIFIÉ du compte,
 *    expéditeur masqué « Prénom N. ») ; lue par readIncomingTransfers, appelée par la page.
 *  - « Accepter le billet » : confirmation (ConfirmDialog), puis POST /api/tickets/transfers/{id}/claim ;
 *    le billet rejoint « Mes billets » avec un nouveau QR code. Les refus du serveur sont affichés en clair.
 *  - Numéro non vérifié : aucun détail n'est montré (le serveur n'en donne pas) ; un bandeau invite à
 *    confirmer le numéro par un code SMS (PhoneVerifyDialog), puis la liste est relue.
 */

export interface IncomingTransfer {
  transfer_id: string;
  expires_at: string;
  sender_display: string;
  ticket: { category_name: string | null; price: number };
  event: {
    id: string;
    title: string;
    start_date: string;
    start_time: string;
    location: string;
    city: string | null;
    image_url: string | null;
  };
}

export interface IncomingTransfersData {
  items: IncomingTransfer[];
  phoneVerificationRequired: boolean;
}

export type IncomingLoadResult = ({ ok: true } & IncomingTransfersData) | { ok: false; message: string };

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toTransfer(raw: unknown): IncomingTransfer | null {
  if (!isRecord(raw) || typeof raw.transfer_id !== 'string' || !isRecord(raw.event) || !isRecord(raw.ticket)) return null;
  const e = raw.event;
  const t = raw.ticket;
  if (typeof e.title !== 'string') return null;
  return {
    transfer_id: raw.transfer_id,
    expires_at: typeof raw.expires_at === 'string' ? raw.expires_at : '',
    sender_display: typeof raw.sender_display === 'string' && raw.sender_display ? raw.sender_display : 'Un utilisateur',
    ticket: {
      category_name: typeof t.category_name === 'string' ? t.category_name : null,
      price: typeof t.price === 'number' ? t.price : Number(t.price ?? 0),
    },
    event: {
      id: typeof e.id === 'string' ? e.id : '',
      title: e.title,
      start_date: typeof e.start_date === 'string' ? e.start_date : '',
      start_time: typeof e.start_time === 'string' ? e.start_time : '',
      location: typeof e.location === 'string' ? e.location : '',
      city: typeof e.city === 'string' ? e.city : null,
      image_url: typeof e.image_url === 'string' ? e.image_url : null,
    },
  };
}

/** Billets qui attendent le compte connecté (GET /api/tickets/transfers/incoming). */
export async function readIncomingTransfers(): Promise<IncomingLoadResult> {
  let res: Response;
  try {
    res = await fetch('/api/tickets/transfers/incoming', { cache: 'no-store' });
  } catch (err) {
    console.error('[Billets reçus] liste injoignable :', err instanceof Error ? err.message : String(err));
    return { ok: false, message: NETWORK_MESSAGE };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`[Billets reçus] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return { ok: false, message: `Réponse inattendue du serveur (erreur ${res.status}).` };
  }
  if (!res.ok) {
    const message = isRecord(body) && typeof body.error === 'string' && body.error ? body.error : `Les billets reçus n’ont pas pu être chargés (erreur ${res.status}).`;
    return { ok: false, message };
  }
  if (!isRecord(body) || !Array.isArray(body.items)) {
    console.error('[Billets reçus] réponse sans liste :', body);
    return { ok: false, message: 'Réponse inattendue du serveur.' };
  }
  return {
    ok: true,
    items: body.items.map(toTransfer).filter((t): t is IncomingTransfer => t !== null),
    phoneVerificationRequired: body.phoneVerificationRequired === true,
  };
}

interface IncomingTransfersProps {
  phase: 'loading' | 'ready' | 'error';
  data: IncomingTransfersData;
  error: string | null;
  onRetry: () => void;
  isRetrying?: boolean;
  /** Numéro du compte connecté, pour la confirmation par code SMS. */
  phone: string | null | undefined;
  /** Relecture des billets et des transferts reçus (après acceptation ou confirmation du numéro). */
  onChanged: () => void;
}

export function IncomingTransfers({ phase, data, error, onRetry, isRetrying = false, phone, onChanged }: IncomingTransfersProps) {
  const toast = useToast();
  const [confirming, setConfirming] = useState<IncomingTransfer | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);

  const accept = async () => {
    if (!confirming) return;
    const transfer = confirming;
    setIsAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/tickets/transfers/${transfer.transfer_id}/claim`, { method: 'POST' });
      let body: { message?: unknown; error?: unknown; code?: unknown } = {};
      try {
        body = await res.json();
      } catch (err) {
        console.error(`[Billets reçus] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
      }
      if (!res.ok) {
        const message = typeof body.error === 'string' && body.error ? body.error : `Le billet n’a pas pu être accepté (erreur ${res.status}).`;
        setAcceptError(message);
        setConfirming(null);
        if (body.code === 'PHONE_NOT_VERIFIED') setIsVerifyOpen(true);
        onChanged();
        return;
      }
      toast.success(typeof body.message === 'string' && body.message ? body.message : 'Billet ajouté à vos billets.');
      setConfirming(null);
      onChanged();
    } catch (err) {
      console.error('[Billets reçus] acceptation injoignable :', err instanceof Error ? err.message : String(err));
      setAcceptError(NETWORK_MESSAGE);
      setConfirming(null);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="space-y-4">
      {data.phoneVerificationRequired && phase === 'ready' && (
        <StatusBanner
          tone="info"
          title="Un billet vous attend peut-être. Confirmez votre numéro pour le voir."
          action={(
            <Button variant="primary" size="sm" onClick={() => setIsVerifyOpen(true)} leftIcon={<ShieldCheck size={16} aria-hidden="true" />}>
              Confirmer mon numéro
            </Button>
          )}
        >
          Par sécurité, un billet transféré ne s’affiche qu’après la confirmation de votre numéro par un code SMS.
        </StatusBanner>
      )}

      {acceptError && (
        <StatusBanner tone="danger" announce="alert" title="Billet non accepté">
          {acceptError}
        </StatusBanner>
      )}

      {phase === 'loading' ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Chargement des billets reçus…</span>
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-5" aria-hidden="true">
              <div className="h-5 w-2/3 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
              <div className="h-4 w-1/2 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
              <div className="h-11 w-40 rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ) : phase === 'error' ? (
        <ErrorState
          title="Impossible d’afficher les billets reçus"
          description={error ?? NETWORK_MESSAGE}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Gift size={28} />}
          title="Aucun billet reçu en attente"
          description="Quand quelqu’un vous transfère un billet, vous recevez un SMS et il apparaît ici. Vous avez 48 h pour l’accepter."
        />
      ) : (
        <ul className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {data.items.map((t) => {
            const place = [t.event.location, t.event.city].filter(Boolean).join(', ');
            return (
              <li key={t.transfer_id} className="min-w-0">
                <article aria-labelledby={`recu-${t.transfer_id}`} className="space-y-4 rounded-2xl border border-brand-fg/30 bg-surface p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                      <Ticket size={20} />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <h3 id={`recu-${t.transfer_id}`} className="break-words text-base font-semibold leading-snug text-fg">{t.event.title}</h3>
                      <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                        <UserRound size={16} aria-hidden="true" />
                        Envoyé par {t.sender_display}
                      </p>
                    </div>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="sr-only">Date</dt>
                      <dd className="flex items-start gap-2 text-fg">
                        <CalendarClock size={16} className="mt-0.5 flex-shrink-0 text-fg-muted" aria-hidden="true" />
                        <span className="min-w-0">{formatEventDateTime(t.event.start_date, t.event.start_time)}</span>
                      </dd>
                    </div>
                    {place && (
                      <div>
                        <dt className="sr-only">Lieu</dt>
                        <dd className="flex items-start gap-2 text-fg">
                          <MapPin size={16} className="mt-0.5 flex-shrink-0 text-fg-muted" aria-hidden="true" />
                          <span className="min-w-0 break-words">{place}</span>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="sr-only">Billet</dt>
                      <dd className="flex items-start gap-2 text-fg">
                        <Ticket size={16} className="mt-0.5 flex-shrink-0 text-fg-muted" aria-hidden="true" />
                        <span className="min-w-0">
                          {t.ticket.category_name ?? 'Billet'}
                          {t.ticket.price > 0 ? ` · ${formatFcfa(t.ticket.price)}` : ' · Gratuit'}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Délai</dt>
                      <dd className="flex items-start gap-2 font-semibold text-warning-fg">
                        <Hourglass size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span className="min-w-0">
                          {t.expires_at ? `À accepter avant le ${formatDateTime(t.expires_at)}` : 'À accepter sous 48 h'}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => {
                      setAcceptError(null);
                      setConfirming(t);
                    }}
                    leftIcon={<Gift size={18} aria-hidden="true" />}
                  >
                    Accepter le billet
                  </Button>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirming)}
        onClose={() => { if (!isAccepting) setConfirming(null); }}
        onConfirm={() => void accept()}
        title="Accepter ce billet ?"
        message={confirming ? `Le billet pour « ${confirming.event.title} » rejoint vos billets avec un nouveau QR code. L’expéditeur est prévenu et ne peut plus l’utiliser.` : undefined}
        confirmLabel="Accepter le billet"
        variant="default"
        isLoading={isAccepting}
      />

      <PhoneVerifyDialog
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        phone={phone}
        onVerified={() => {
          toast.success('Numéro confirmé. Les billets qui vous attendent s’affichent maintenant.');
          onChanged();
        }}
      />
    </div>
  );
}
