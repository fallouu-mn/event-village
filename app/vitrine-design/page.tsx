import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Vitrine } from './Vitrine';

export const metadata: Metadata = { title: 'Vitrine des composants — Event Village', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Design 1a — vitrine des composants de base, pour les captures de l'e2e (scripts/e2e/start-app.mjs pose
 * EV_VITRINE_DESIGN=1). Partout ailleurs, y compris en production : page introuvable. Données fictives seulement : aucune
 * session lue, aucun appel d'API. `?erreur=1` lève une erreur volontaire, pour capturer la page d'erreur (app/error.tsx).
 */
export default async function VitrinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.EV_VITRINE_DESIGN !== '1') notFound();
  if ((await searchParams).erreur === '1') throw new Error('vitrine : erreur volontaire pour la capture de la page d’erreur');
  return <Vitrine />;
}
