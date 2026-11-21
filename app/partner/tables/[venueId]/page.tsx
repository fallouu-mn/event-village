import { PlanningView } from '@/components/tables/partner/PlanningView';

/**
 * Lot 11b : fiche d'un établissement = planning du jour en temps réel, pour sa propriétaire. Page serveur : seul le jour
 * demandé (`?date=AAAA-MM-JJ`, aujourd'hui sinon) est lu ici ; la fiche et le planning sont lus dans le navigateur
 * (GET /api/partner/venues/[id], GET /api/partner/venues/[id]/planning : seulement la propriétaire, sinon 404).
 * Ouverte même service fermé (réservations existantes, liens des notifications).
 */
export const dynamic = 'force-dynamic';

export default async function VenuePlanningPage({
    params,
    searchParams,
}: {
    params: Promise<{ venueId: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ venueId }, sp] = await Promise.all([params, searchParams]);
    const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
    return <PlanningView key={venueId} venueId={venueId} initialDate={date} />;
}
