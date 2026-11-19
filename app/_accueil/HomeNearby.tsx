'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePageSettled } from '@/hooks/usePageSettled';

/**
 * Design 1b (point 3) — « Près de chez vous » chargé après la page, côté navigateur seulement : la ville vient du profil
 * ou de l'appareil, elle n'entre jamais dans le HTML mis en cache. Code à part (hors du premier chargement de /).
 * Place réservée pendant le chargement, à la hauteur de la section.
 *
 * Décision du 18/11 (temps de blocage de l'accueil, run 406) : section sous le premier écran, chargée quand elle approche
 * de l'écran (400 px) ou, sinon, une fois la page chargée et le téléphone libre — jamais pendant le chargement.
 */
const Skeleton = () => (
  <div className="space-y-4" aria-hidden="true">
    <div className="h-7 w-48 rounded-md bg-muted motion-safe:animate-pulse" />
    <div className="aspect-[16/10] w-[78%] rounded-xl bg-muted motion-safe:animate-pulse sm:w-1/3" />
  </div>
);

const HomeDiscovery = dynamic(() => import('@/components/events/HomeDiscovery').then((m) => m.HomeDiscovery), {
  ssr: false,
  loading: Skeleton,
});

export function HomeNearby({ cities }: { cities: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const settled = usePageSettled();
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return settled || near ? <HomeDiscovery cities={cities} /> : <div ref={ref}><Skeleton /></div>;
}
