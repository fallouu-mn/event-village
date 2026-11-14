import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { readPublicEventStatus } from '@/lib/events/public-status';

export const dynamic = 'force-dynamic';

/**
 * Lot 8 (8.2 h, L49, L50) : un événement non public, inconnu ou d'identifiant illisible répond un vrai 404 HTTP
 * (app/not-found.tsx), rendu côté serveur ; la page reste un composant client (D79). Une erreur de lecture est
 * journalisée et la page s'affiche : l'API reste protectrice, et EventNotFound couvre un événement retiré
 * pendant la consultation.
 */
export default async function PublicEventLayout(props: { params: Promise<{ id: string }>; children: ReactNode }) {
 const params = await props.params;

 const {
  children
 } = props;

 const status = await readPublicEventStatus(params.id);
 if (status === 'NOT_PUBLIC') notFound();
 return children;
}
