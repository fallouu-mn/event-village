'use client';

import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useServerData } from '@/components/partner/useServerData';
import { CardFavorites } from '@/components/events/CardFavorites';
import { CardLiveBadges } from '@/components/events/CardLiveBadge';
import { CardTransitions } from '@/components/events/CardLink';
import { EventCard } from '@/components/events/EventCard';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import type { CatalogEventDto } from '@/lib/events/catalog.server';
import Loading from './loading';

/**
 * Design 1d (point 8) — Mes favoris : les événements gardés avec le cœur, du plus récent au plus ancien. Lus par
 * GET /api/favorites?cartes=1 (compte de la session seulement : une personne ne voit jamais les favoris d'une autre).
 * Mêmes cartes d'affiche que l'accueil et Explorer ; un événement suspendu, annulé ou terminé reste listé avec son état.
 * Retirer un cœur ici retire le favori ; la carte reste affichée jusqu'au prochain chargement (on peut le remettre).
 * Aucun avis n'est envoyé (le rappel de la veille viendra dans un lot suivant).
 */

const STATUS_TEXT: Record<string, string> = {
  SUSPENDU: 'Événement suspendu',
  ANNULE: 'Événement annulé',
  TERMINE: 'Événement terminé',
};

export default function FavoritesPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { data, error, loading, refreshing, reload } = useServerData<{ events: CatalogEventDto[] }>(
    isAuthenticated ? '/api/favorites?cartes=1' : null,
  );

  if (isAuthLoading) return <Loading />;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          illustrated
          title="Connectez-vous pour voir vos favoris"
          description="Touchez le cœur d’un événement pour le retrouver ici."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Fprofile%2Ffavoris"
        />
      </div>
    );
  }

  const header = (
    <PageHeader
      title="Mes favoris"
      description="Les événements que vous avez gardés avec le cœur."
      back={{ href: '/profile', label: 'Mon profil' }}
    />
  );

  if (error && !data) {
    return (
      <div className="mx-auto max-w-5xl pb-24 lg:pb-12">
        {header}
        <ErrorState title="Vos favoris n’ont pas pu être chargés" description={error} onRetry={() => void reload()} isRetrying={refreshing || loading} />
      </div>
    );
  }

  if (loading || !data) return <Loading />;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 lg:pb-12">
      <CardTransitions />
      <CardLiveBadges />
      <CardFavorites />
      {header}

      {data.events.length === 0 ? (
        <EmptyState
          illustrated
          title="Aucun favori pour le moment"
          description="Touchez le cœur d’un événement pour le garder ici et le retrouver en un instant."
          actionLabel="Explorer les événements"
          actionHref="/explore"
        />
      ) : (
        <ul className="ev-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4" aria-label="Vos événements favoris">
          {data.events.map((evt) => (
            <li key={evt.id} className="flex flex-col gap-2">
              <EventCard
                id={evt.id}
                title={evt.title}
                imageUrl={evt.imageUrl}
                posterColor={evt.posterColor}
                size="compact"
                dateFormatted={evt.dateFormatted}
                timeFormatted={evt.timeFormatted}
                venue={evt.venue}
                city={evt.city}
                categoryLabel={evt.categoryLabel}
                price={evt.price}
                paidFrom={evt.paidFrom}
                saleLabel={evt.saleLabel}
                stock={evt.stock}
                startsAt={evt.startsAt}
                endsAt={evt.endsAt}
              />
              {STATUS_TEXT[evt.status] && (
                <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground-strong">{STATUS_TEXT[evt.status]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
