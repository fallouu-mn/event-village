import { HallSheetView, type SavedNotice } from '@/components/halls/partner/HallSheetView';
import { readPolicyTexts } from '@/components/halls/partner/read-policy-texts';

/**
 * Lot 10b (point 3) : fiche d'une salle et calendrier de ses réservations, pour sa propriétaire. Page serveur : textes
 * des règles d'annulation (policyTexts) et message d'après l'enregistrement (`?enregistree=creee|modifiee`) ; la salle
 * et ses réservations sont lues dans le navigateur (GET /api/partner/halls/[id], GET /api/partner/halls/reservations).
 */
export const dynamic = 'force-dynamic';

export default async function HallSheetPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ id }, sp, texts] = await Promise.all([params, searchParams, readPolicyTexts()]);
    const saved: SavedNotice = sp.enregistree === 'creee' ? 'creee' : sp.enregistree === 'modifiee' ? 'modifiee' : null;
    return <HallSheetView hallId={id} policyTexts={texts} saved={saved} />;
}
