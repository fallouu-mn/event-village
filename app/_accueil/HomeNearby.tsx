'use client';

import dynamic from 'next/dynamic';

/**
 * Design 1b (point 3) — « Près de chez vous » chargé après la page, côté navigateur seulement : la ville vient du profil
 * ou de l'appareil, elle n'entre jamais dans le HTML mis en cache. Code à part (hors du premier chargement de /).
 * Place réservée pendant le chargement, à la hauteur de la section.
 */
const HomeDiscovery = dynamic(() => import('@/components/events/HomeDiscovery').then((m) => m.HomeDiscovery), {
  ssr: false,
  loading: () => (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-7 w-48 rounded-md bg-muted motion-safe:animate-pulse" />
      <div className="aspect-[16/10] w-[78%] rounded-xl bg-muted motion-safe:animate-pulse sm:w-1/3" />
    </div>
  ),
});

export function HomeNearby({ cities }: { cities: string[] }) {
  return <HomeDiscovery cities={cities} />;
}
