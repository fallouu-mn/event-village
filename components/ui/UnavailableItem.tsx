import React from 'react';
import { SearchX } from 'lucide-react';
import { LinkButton } from './LinkButton';

/**
 * Finition 5 (point 2) — page d'arrivée d'un avis dont l'objet n'est plus là (supprimé, transféré, annulé, service
 * fermé) ou n'est pas lié au compte : même texte dans tous les cas (aucun indice sur l'existence de l'objet), un lien
 * utile vers la liste du même espace. Jamais une erreur technique. Aspect de l'état vide (EmptyState), mais le titre est
 * le titre de la page (niveau 1) : c'est tout ce que la page affiche.
 */
export function UnavailableItem({ actionLabel, actionHref, description }: { actionLabel: string; actionHref: string; description?: string }) {
    return (
        <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
            <div className="my-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-text" aria-hidden="true">
                    <SearchX size={28} />
                </div>
                <h1 className="mb-1 text-lg font-semibold text-foreground-strong">Cet élément n’est plus disponible</h1>
                <p className="mb-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {description ?? 'Il a pu être transféré, annulé ou supprimé, ou il n’est pas lié à votre compte. Retrouvez le reste de vos informations ici :'}
                </p>
                <LinkButton href={actionHref} variant="primary">{actionLabel}</LinkButton>
            </div>
        </div>
    );
}
