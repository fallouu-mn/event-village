import { Compass, Home } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';

/**
 * Page 404 (lot 7, 7.3, D55, D56) : rendue par notFound() des layouts de garde quand un service est fermé
 * par son interrupteur (salles, tables, commandes), et pour toute adresse inconnue. Message neutre (le
 * visiteur n'a pas à savoir qu'un service existe mais est fermé), deux sorties : l'accueil et le catalogue.
 * Système de design : tokens, un seul <h1>, LinkButton (plus de <Link><Button> imbriqués).
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-2 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
        <Compass size={32} />
      </span>
      <p className="text-sm font-semibold text-fg-muted">Erreur 404</p>
      <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">Page introuvable</h1>
      <p className="text-base leading-relaxed text-fg-muted">
        Cette page n’existe pas ou n’est pas disponible. Vérifiez l’adresse, ou repartez de l’accueil.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <LinkButton href="/" leftIcon={<Home size={18} />}>
          Retour à l’accueil
        </LinkButton>
        <LinkButton href="/explore" variant="secondary">
          Voir les événements
        </LinkButton>
      </div>
    </div>
  );
}
