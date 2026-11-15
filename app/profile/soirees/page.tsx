'use client';

import React from 'react';
import { CalendarCheck, DoorOpen, LogIn, Ticket, Wallet } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useServerData } from '@/components/partner/useServerData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate, formatTime } from '@/lib/format';
import { eveningCashText, eveningEntriesText, type EveningCash } from '@/lib/shifts/evening-format';
import Loading from './loading';

/**
 * Mes soirées (finition 1, complément 13) : historique en lecture seule des événements passés où le compte a contrôlé.
 * Accessible depuis le profil, même quand aucun contrôle n'est ouvert (hors de l'espace /controller). Chaque chiffre
 * vient de GET /api/account/evenings (ses propres entrées et sa propre caisse seulement) ; rien n'est compté ici.
 */

interface Evening {
  event_id: string;
  title: string;
  status: string;
  start_at: string | null;
  organizer: string | null;
  gate: string | null;
  zone: string | null;
  entry_point: string | null;
  entries: number;
  cash: EveningCash | null;
}

function placeText(e: Evening): string {
  if (e.gate) return `Porte ${e.gate}${e.zone ? ` · ${e.zone}` : ''}`;
  if (e.entry_point) return `Point d’entrée : ${e.entry_point}`;
  return 'Porte non précisée';
}

function whenText(startAt: string | null): string {
  return startAt ? `${formatDate(startAt)} à ${formatTime(startAt)}` : 'Date inconnue';
}

export default function EveningsPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { data, error, loading, refreshing, reload } = useServerData<{ items: Evening[] }>(
    isAuthenticated ? '/api/account/evenings' : null,
  );

  if (isAuthLoading) return <Loading />;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          icon={<LogIn size={28} />}
          title="Connectez-vous pour voir vos soirées"
          description="L’historique des événements que vous avez contrôlés est lié à votre compte."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Fprofile%2Fsoirees"
        />
      </div>
    );
  }

  const header = (
    <PageHeader
      title="Mes soirées"
      description="Les événements passés que vous avez contrôlés : vos entrées et votre caisse."
      back={{ href: '/profile', label: 'Mon profil' }}
    />
  );

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl pb-24 lg:pb-12">
        {header}
        <ErrorState title="Vos soirées n’ont pas pu être chargées" description={error} onRetry={() => void reload()} isRetrying={refreshing || loading} />
      </div>
    );
  }

  if (loading || !data) return <Loading />;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24 lg:pb-12">
      {header}

      {data.items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={28} />}
          title="Aucune soirée pour le moment"
          description="Après un événement où vous avez contrôlé les billets, vos entrées et votre caisse apparaissent ici."
          actionLabel="Mes billets"
          actionHref="/tickets"
        />
      ) : (
        <ul className="space-y-3" aria-label="Vos soirées passées">
          {data.items.map((e) => (
            <li key={e.event_id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <h2 className="break-words text-base font-semibold text-fg">{e.title}</h2>
                  <p className="text-sm text-fg-muted">
                    {e.start_at ? <time dateTime={e.start_at} className="tabular-nums">{whenText(e.start_at)}</time> : whenText(null)}
                    {e.organizer ? ` · ${e.organizer}` : ''}
                  </p>
                </div>
                {e.status === 'ANNULE' && <Badge variant="neutral" className="whitespace-nowrap">Événement annulé</Badge>}
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <dt><DoorOpen size={16} className="text-fg-muted" aria-hidden="true" /><span className="sr-only">Votre porte</span></dt>
                  <dd className="text-fg">{placeText(e)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt><Ticket size={16} className="text-fg-muted" aria-hidden="true" /><span className="sr-only">Vos entrées</span></dt>
                  <dd className="text-fg tabular-nums">{eveningEntriesText(e.entries)}</dd>
                </div>
                <div className="flex items-center gap-2 sm:col-span-3">
                  <dt><Wallet size={16} className="text-fg-muted" aria-hidden="true" /><span className="sr-only">Votre caisse</span></dt>
                  <dd className="text-fg tabular-nums">{eveningCashText(e.cash)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
