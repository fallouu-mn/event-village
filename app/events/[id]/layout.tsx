import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { readPublicSheet } from '@/lib/events/event-detail.server';

/**
 * Lot 8 (8.2 h, L49, L50) : un événement non public, inconnu ou d'identifiant illisible répond un vrai 404 HTTP
 * (app/not-found.tsx), rendu côté serveur, sans rien laisser paraître de l'événement.
 * Design 1b (point 1) : la fiche est préparée par le serveur et mise en cache 60 s ; le contrôle lit la même fiche
 * publique en cache (readPublicSheet de lib/events/event-detail.server.ts), plus de rendu forcé à chaque visite. Une
 * panne de lecture est journalisée et le layout laisse passer : la page lève alors une erreur (page d'erreur avec
 * « Réessayer »), jamais un faux 404, et rien n'est mis en cache.
 */
export default async function PublicEventLayout(props: { params: Promise<{ id: string }>; children: ReactNode }) {
  const params = await props.params;
  const read = await readPublicSheet(params.id);
  if (read.kind === 'not-public') notFound();
  return props.children;
}
