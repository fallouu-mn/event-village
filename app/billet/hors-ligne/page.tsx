'use client';

/**
 * Lot 7, tâche 7.1 (contrat 5.2, D26, D35, D36) — page publique et statique du billet hors ligne,
 * `/billet/hors-ligne?id=<billet>`.
 *
 *  - Rien de personnel ni de lié à la session dans le HTML : la page est prérendue, mise en cache par
 *    public/sw.js, et toutes ses données viennent d'IndexedDB (lots du compte meta.currentUserId).
 *  - L'identifiant est lu par window.location.search dans un effet (aucun useSearchParams : la page reste
 *    statique) ; aucun import() ni next/dynamic (un morceau chargé plus tard manquerait au cache) ; aucun
 *    appel au serveur.
 *  - États : billet affiché (QR de l'heure du serveur), pas encore ouvert, codes expirés, billet absent de ce
 *    téléphone (aucun QR), stockage indisponible. Liens <a href> : navigation complète, sans charge RSC.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Ticket } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { OfflineStatusBadge } from '@/components/tickets/offline/OfflineStatusBadge';
import { OfflineTicketView } from '@/components/tickets/offline/OfflineTicketView';
import { formatDateTime } from '@/lib/format';
import type { OfflineLot } from '@/lib/tickets/offline-clock';
import { listCurrentOfflineLots, OFFLINE_SHELL_PATH, OFFLINE_STORE_UNAVAILABLE } from '@/lib/tickets/offline-store';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; requestedId: string | null; lots: OfflineLot[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestedTicketId(): string | null {
  const raw = new URLSearchParams(window.location.search).get('id');
  return raw && UUID.test(raw) ? raw.toLowerCase() : null;
}

function ticketHref(id: string): string {
  return `${OFFLINE_SHELL_PATH}?id=${encodeURIComponent(id)}`;
}

export default function OfflineTicketPage() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [online, setOnline] = useState<boolean>(true);

  const load = useCallback(async () => {
    const requestedId = requestedTicketId();
    try {
      const { lots } = await listCurrentOfflineLots();
      setPhase({ kind: 'ready', requestedId, lots });
    } catch (err) {
      console.warn('[hors-ligne] page hors ligne : billets enregistrés illisibles', err instanceof Error ? err.message : String(err));
      setPhase({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
    setOnline(navigator.onLine);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [load]);

  const shown: OfflineLot | null = phase.kind === 'ready'
    ? (phase.requestedId
      ? phase.lots.find((l) => l.ticket_id.toLowerCase() === phase.requestedId) ?? null
      : phase.lots.length === 1 ? phase.lots[0] : null)
    : null;
  const others = phase.kind === 'ready' ? phase.lots.filter((l) => l !== shown) : [];
  const missingRequested = phase.kind === 'ready' && !shown && (phase.requestedId !== null || phase.lots.length === 0);

  return (
    <main className="min-h-dvh bg-surface-sunken text-fg">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-12 pt-6">
        <header className="flex items-center justify-between gap-3">
          <Logo variant="full" linkToHome={false} />
          {online && (
            <a href="/tickets" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              <ArrowLeft size={16} aria-hidden="true" />
              Mes billets
            </a>
          )}
        </header>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Billet hors ligne</h1>
          <p className="text-sm text-fg-muted">
            {/* La page s'affiche aussi sans QR (aucun billet enregistré, codes pas encore ouverts) : « Présentez le QR au
                contrôle » seul y était faux (relecture du run 77). */}
            Le billet enregistré sur ce téléphone s’affiche ici, même sans réseau. Présentez son QR au contrôle dès qu’il
            apparaît.
          </p>
        </div>

        {phase.kind === 'loading' ? (
          <div className="space-y-3 rounded-3xl border border-border bg-surface p-5" aria-busy="true">
            <p role="status" className="text-sm text-fg-muted">Lecture du billet enregistré…</p>
            <div className="mx-auto aspect-square w-full max-w-72 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" aria-hidden="true" />
          </div>
        ) : phase.kind === 'error' ? (
          <>
            <StatusBanner tone="danger" announce="alert" title={OFFLINE_STORE_UNAVAILABLE}>
              Ce navigateur ne permet pas de garder le billet sur le téléphone (navigation privée, stockage effacé ou
              plein).
            </StatusBanner>
            <OfflineStatusBadge state="offline_missing" />
          </>
        ) : (
          <>
            {shown ? <OfflineTicketView lot={shown} /> : null}

            {missingRequested && (
              <section className="space-y-3 rounded-3xl border border-border bg-surface p-5">
                <OfflineStatusBadge state="offline_missing" />
                <p className="text-sm text-fg-muted">
                  Pour l’avoir sans réseau, ouvrez Mes billets avec du réseau avant d’arriver : le billet s’enregistre tout
                  seul sur ce téléphone, dès la veille de l’événement.
                </p>
              </section>
            )}

            {others.length > 0 && (
              <nav aria-labelledby="autres-billets" className="space-y-3">
                <h2 id="autres-billets" className="text-base font-semibold text-fg">
                  {shown ? 'Autres billets enregistrés sur ce téléphone' : 'Billets enregistrés sur ce téléphone'}
                </h2>
                <ul className="space-y-2">
                  {others.map((l) => (
                    <li key={l.ticket_id}>
                      <a
                        href={ticketHref(l.ticket_id)}
                        className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-fg transition-colors duration-200 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Ticket size={20} aria-hidden="true" className="flex-shrink-0 text-brand-fg" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{l.ticket.event_title}</span>
                          <span className="block text-sm text-fg-muted">
                            <time dateTime={l.ticket.event_start_at}>{formatDateTime(l.ticket.event_start_at)}</time>
                            {' · '}
                            <span className="whitespace-nowrap font-mono tabular-nums">{l.ticket.ticket_number}</span>
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
