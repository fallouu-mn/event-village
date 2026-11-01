import { pilotageGetHandler } from '@/lib/events/pilotage.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/[id]/pilotage/entries — lot 5 (contrat I). Partenaire propriétaire (compte ACTIF)
 * ou admin : 200 avec le corps de la RPC pilotage_entries ; partenaire B, client ou événement inconnu : 404.
 */
export const GET = pilotageGetHandler('entries');
