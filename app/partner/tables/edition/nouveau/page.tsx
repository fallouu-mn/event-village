import { PageHeader } from '@/components/ui/PageHeader';
import { VenueForm } from '@/components/tables/editor/VenueForm';
import { readVenueDefaults } from '@/components/tables/editor/read-venue-defaults';

/**
 * Lot 11b : ajout d'un établissement (restaurant, bar, espace) par la partenaire. Page serveur : elle lit les réglages
 * réels des tables (durée du créneau, délai de réponse, frais de service) et les passe au formulaire commun (VenueForm,
 * mode création, POST /api/partner/venues : fiche, photos, horaires, zones et tables en une fois, envoyé en validation).
 * Garde de l'interrupteur : app/partner/tables/edition/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export default async function NewVenuePage() {
    const defaults = await readVenueDefaults();
    return (
        <div className="mx-auto w-full max-w-4xl pb-10">
            <PageHeader
                back={{ href: '/partner/tables', label: 'Mes établissements' }}
                title="Ajouter un établissement"
                description="Décrivez le lieu, ses horaires et ses tables : vos clients réservent en quelques secondes."
            />
            <VenueForm mode="create" defaults={defaults} />
        </div>
    );
}
