import React from 'react';
import { SearchX } from 'lucide-react';
import { EmptyState } from './EmptyState';

/**
 * Finition 5 (point 2) — page d'arrivée d'un avis dont l'objet n'est plus là (supprimé, transféré, annulé, service
 * fermé) ou n'est pas lié au compte : même texte dans tous les cas (aucun indice sur l'existence de l'objet), un lien
 * utile vers la liste du même espace. Jamais une erreur technique.
 */
export function UnavailableItem({ actionLabel, actionHref, description }: { actionLabel: string; actionHref: string; description?: string }) {
    return (
        <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
            <EmptyState
                icon={<SearchX size={28} />}
                title="Cet élément n’est plus disponible"
                description={description ?? 'Il a pu être transféré, annulé ou supprimé, ou il n’est pas lié à votre compte. Retrouvez le reste de vos informations ici :'}
                actionLabel={actionLabel}
                actionHref={actionHref}
            />
        </div>
    );
}
