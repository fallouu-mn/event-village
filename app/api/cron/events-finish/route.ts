import { NextRequest, NextResponse } from 'next/server';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { purgeOrphanPosters } from '@/lib/events/poster-storage';
import { invalidatePublicEvent } from '@/lib/events/public-cache.server';

export const dynamic = 'force-dynamic';

const BATCH = 200;
const MAX_ROUNDS = 10;
/** Fiches invalidées une à une au plus ; au-delà, l'étiquette `fiche-publique` (invalidée à chaque appel) les couvre toutes. */
const FICHES_MAX = 50;

/**
 * Lot 5.4 (contrat D7) — passage automatique à TERMINE des événements PUBLIE dont la fin
 * (event_end_at : fin saisie ; date de fin sans heure : ce jour à 23:59 ; sinon début + 6 h, heure de Dakar — finition 2a,
 * E-01) est passée, par la transition
 * interne (acteur SYSTEM, canal CRON, journalisée). RPC events_finish_overdue en lots de 200
 * (FOR UPDATE SKIP LOCKED). Planification : toutes les 15 minutes (docs/deploiement-projet-neuf.md §7).
 * Protégée par CRON_SECRET (Authorization: Bearer), sans repli.
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    let finished = 0;
    const ids: string[] = [];
    for (let round = 1; round <= MAX_ROUNDS; round++) {
        const { data, error } = await rpcWithRetry<{ ok?: boolean; finished?: number; ids?: string[] }>('events_finish_overdue', { p: { limit: BATCH } });
        if (error || !data || data.ok !== true) {
            console.error('[cron events-finish] passage à TERMINE impossible :', error ? `${error.code} ${error.message}` : JSON.stringify(data));
            invalidateFinished(ids);
            return NextResponse.json({ error: 'Passage des événements terminés impossible.', finished, ids }, { status: 500 });
        }
        const n = Number(data.finished ?? 0);
        finished += n;
        ids.push(...(data.ids ?? []).map(String));
        if (n < BATCH) break;
    }
    invalidateFinished(ids);
    // Finition 2a (1b) : affiches de plus de 7 jours qu'aucun événement n'utilise (brouillons abandonnés, affiches
    // remplacées) ; jamais une affiche utilisée. Un échec est journalisé sans annuler le passage à TERMINE.
    let posters: { scanned: number; deleted: number } | { error: string };
    try {
        posters = await purgeOrphanPosters(7);
    } catch (err) {
        console.error('[cron events-finish] purge des affiches orphelines impossible :', err instanceof Error ? err.message : String(err));
        posters = { error: 'Purge des affiches momentanément impossible.' };
    }
    return NextResponse.json({ ok: true, finished, ids, posters });
}

/**
 * Contre-vérification T2 : pages publiques mises à jour après le passage à TERMINE (fiche : « Événement terminé » ;
 * catalogue, accueil, « À la une », carte), sans attendre la fin du cache de 60 s. Appelé aussi quand une ronde échoue
 * après d'autres réussies : les événements déjà passés à TERMINE le sont pour de bon.
 */
function invalidateFinished(ids: string[]): void {
    if (ids.length === 0) return;
    for (const id of ids.slice(0, FICHES_MAX)) invalidatePublicEvent(id, 'fin planifiée');
    if (ids.length > FICHES_MAX) console.info(`[cron events-finish] ${ids.length - FICHES_MAX} fiche(s) de plus couvertes par l'étiquette fiche-publique`);
}

export const GET = run;
export const POST = run;
