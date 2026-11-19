import { HallSheetView, type SavedNotice } from '@/components/halls/partner/HallSheetView';
import { readHallDefaults, readPolicyTexts } from '@/components/halls/partner/read-policy-texts';

/**
 * Lot 10b (point 3) : fiche d'une salle et calendrier de ses réservations, pour sa propriétaire. Page serveur : textes
 * des règles d'annulation (policyTexts) et message d'après l'enregistrement (`?enregistree=creee|modifiee`) ; la salle
 * et ses réservations sont lues dans le navigateur (GET /api/partner/halls/[id], GET /api/partner/halls/reservations).
 * Lot 10b (correctifs) : message après un renvoi en validation (`?enregistree=renvoyee`) ; pourcentage réel de
 * l'acompte par défaut (hallDefaults).
 */
export const dynamic = 'force-dynamic';

export default async function HallSheetPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ id }, sp, texts, defaults] = await Promise.all([params, searchParams, readPolicyTexts(), readHallDefaults()]);
    const saved: SavedNotice = sp.enregistree === 'creee' || sp.enregistree === 'modifiee' || sp.enregistree === 'renvoyee' ? sp.enregistree : null;
    return <HallSheetView hallId={id} policyTexts={texts} saved={saved} defaultPercent={defaults.depositDefaultPercent} />;
}
