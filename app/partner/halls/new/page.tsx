import { PageHeader } from '@/components/ui/PageHeader';
import { HallForm } from '@/components/halls/partner/HallForm';
import { readHallDefaults, readPolicyTexts } from '@/components/halls/partner/read-policy-texts';

/**
 * Lot 10b (point 3) : ajout d'une salle par sa propriétaire. Page serveur : elle lit les textes des trois règles
 * d'annulation (policyTexts) et les passe au formulaire commun (HallForm, mode création, POST /api/partner/halls).
 * Après l'envoi, retour vers la fiche de la salle avec un message.
 * Lot 10b (correctifs, point 3) : réglages réels des salles (hallDefaults) passés au formulaire (acompte par défaut,
 * durée de garde, échéance du solde).
 */
export const dynamic = 'force-dynamic';

export default async function NewHallPage() {
    const [texts, defaults] = await Promise.all([readPolicyTexts(), readHallDefaults()]);
    return (
        <div className="mx-auto w-full max-w-4xl pb-10">
            <PageHeader
                back={{ href: '/partner/halls', label: 'Mes salles' }}
                title="Ajouter une salle"
                description="Décrivez la salle, son prix, sa règle d’annulation et ajoutez des photos."
            />
            <HallForm mode="create" policyTexts={texts} defaults={defaults} />
        </div>
    );
}
