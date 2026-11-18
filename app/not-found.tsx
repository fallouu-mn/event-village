'use client';

import { Home } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { SPECIAL_TEXTS, SpecialPage } from '@/components/ui/SpecialPage';

/**
 * Page introuvable (lot 7, 7.3, D55, D56 : rendue par notFound() des layouts de garde quand un service est fermé).
 * Design 1a (point 6) : au style du projet, textes de la consigne : « Page introuvable », « Cette page n'existe pas ou a
 * été déplacée. », « Retour à l'accueil », « Explorer les événements ». Aucun mot technique (pas de « 404 »), aucune
 * donnée de la personne ni de l'adresse demandée.
 *
 * Design 1b (décision 3, scanner) : composant CLIENT. Next envoie la page introuvable racine avec CHAQUE page (limite
 * « introuvable » du gabarit racine) ; rendue par le serveur, elle citait next/link directement, et le manifeste client
 * rattache next/link aux fichiers de l'accueil (1910, 9415, 6264, app/page : ≈ 14,6 Ko), chargés ainsi par le scanner
 * avant son écran utile (run 392, perf/js-avant-marqueur.tsv). En client, elle ne charge que ses propres fichiers.
 */
export default function NotFound() {
  const t = SPECIAL_TEXTS.notFound;
  return (
    <SpecialPage
      tone="neutral"
      title="Page introuvable"
      message={t.message}
      actions={(
        <>
          <LinkButton href="/" leftIcon={<Home size={18} />}>
            Retour à l’accueil
          </LinkButton>
          <LinkButton href="/explore" variant="secondary">
            {t.explore}
          </LinkButton>
        </>
      )}
    />
  );
}
