import { HallEditView } from '@/components/halls/partner/HallEditView';
import { readPolicyTexts } from '@/components/halls/partner/read-policy-texts';

/**
 * Lot 10b (point 3) : modification d'une salle par sa propriétaire. Page serveur : textes des trois règles
 * d'annulation (policyTexts) ; la salle est lue dans le navigateur (GET /api/partner/halls/[id], propriété vérifiée par
 * la route) puis modifiée par le formulaire commun (HallForm, PUT /api/partner/halls/[id]).
 */
export const dynamic = 'force-dynamic';

export default async function EditHallPage({ params }: { params: Promise<{ id: string }> }) {
    const [{ id }, texts] = await Promise.all([params, readPolicyTexts()]);
    return <HallEditView hallId={id} policyTexts={texts} />;
}
