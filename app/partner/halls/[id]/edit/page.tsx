import { HallEditView } from '@/components/halls/partner/HallEditView';
import { readHallDefaults, readPolicyTexts } from '@/components/halls/partner/read-policy-texts';

/**
 * Lot 10b (point 3) : modification d'une salle par sa propriétaire. Page serveur : textes des trois règles
 * d'annulation (policyTexts) ; la salle est lue dans le navigateur (GET /api/partner/halls/[id], propriété vérifiée par
 * la route) puis modifiée par le formulaire commun (HallForm, PUT /api/partner/halls/[id]).
 * Lot 10b (correctifs, point 3) : réglages réels des salles (hallDefaults) passés au formulaire.
 */
export const dynamic = 'force-dynamic';

export default async function EditHallPage({ params }: { params: Promise<{ id: string }> }) {
    const [{ id }, texts, defaults] = await Promise.all([params, readPolicyTexts(), readHallDefaults()]);
    return <HallEditView hallId={id} policyTexts={texts} defaults={defaults} />;
}
