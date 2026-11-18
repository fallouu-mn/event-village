import type { Metadata } from 'next';
import { OfflineContent } from '@/components/ui/SpecialPage';

export const metadata: Metadata = { title: 'Pas de réseau — Event Village', robots: { index: false } };

/**
 * Design 1a (point 6) : page hors ligne, statique (aucune donnée personnelle, aucune lecture de session). Les billets
 * restent disponibles sans réseau sur /billet/hors-ligne (bouton « Mes billets »).
 */
export const dynamic = 'force-static';

export default function OfflinePage() {
  return <OfflineContent />;
}
