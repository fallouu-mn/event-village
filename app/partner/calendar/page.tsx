'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { EventCalendar, type CalendarEvent } from '@/components/events/EventCalendar';
import { ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchJson } from '@/components/partner/fetch-json';

interface PartnerEventsResponse {
  events?: Array<{
    id: string;
    title: string;
    start_date: string;
    start_time?: string | null;
    location?: string | null;
    city?: string | null;
    status?: string | null;
  }>;
}

/**
 * Calendrier de l'organisatrice (design 1c) : ses événements à leur date de début (aucune réservation n'est lue : le
 * texte ne le promet plus, constat W3-14). Jetons de la charte seulement ; chargement en squelette à la taille du
 * contenu ; erreur avec « Réessayer ».
 */
export default function PartnerCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setFailed(false);
    fetchJson<PartnerEventsResponse>('/api/partner/events')
      .then((data) => {
        setEvents((data.events ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          start_date: e.start_date,
          start_time: e.start_time ?? null,
          location: e.location ?? null,
          city: e.city ?? null,
          status: e.status ?? null,
        })));
      })
      .catch((err: unknown) => {
        console.error('[calendrier] lecture des événements', err);
        setFailed(true);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Calendrier"
        description="Vos événements, placés à leur date de début."
        actions={<LinkButton href="/partner/events/new" variant="primary" size="sm" leftIcon={<Plus size={16} />}>Nouvel événement</LinkButton>}
      />

      {isLoading ? (
        <div role="status" aria-busy="true" aria-label="Chargement du calendrier" className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Skeleton className="h-96 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        </div>
      ) : failed ? (
        <ErrorState
          title="Calendrier indisponible"
          description="Impossible de charger le calendrier des événements. Vérifiez votre connexion, puis réessayez."
          onRetry={load}
        />
      ) : (
        <EventCalendar events={events} />
      )}
    </div>
  );
}
