/**
 * Lot 9 bis, tâche I1 (contrat 4.7, 5.63, B108) — garde des comptes de démonstration.
 *
 * Hors simulation (mode réel, production, et suites sous NODE_ENV=test), aucun SMS, email ni push ne part vers un
 * compte créé par seed:dev. La RPC notification_demo_recipients (migration 20261109000012_lot9bis_mode_reel) dit,
 * pour un lot de destinataires, lesquels sont de démonstration : compte `users.demo_account`, numéro (9 derniers
 * chiffres) ou adresse d'un tel compte, domaine du seed, événement d'une partenaire de démonstration.
 *
 * Échec fermé : une RPC en erreur ou une réponse illisible rend `{ ok: false }` ; l'appelant n'envoie rien
 * (SMS_GUARD_UNAVAILABLE pour un envoi synchrone, RETRY DEMO_GUARD_UNAVAILABLE dans l'envoyeur).
 */
import { isSimulationRun } from '@/lib/integrations/simulation';
import { getServiceRoleClient } from '@/lib/supabase/server';

/** Taille maximale d'un appel (bornée aussi par la RPC). */
const MAX_ITEMS_PER_CALL = 500;

/** Un destinataire à vérifier ; `key` est rendue dans `blocked` s'il est de démonstration. */
export interface DemoProbe {
    key: string;
    user_id?: string | null;
    phone?: string | null;
    email?: string | null;
    event_id?: string | null;
}

export type DemoGuardResult =
    | { ok: true; blocked: Set<string> }
    | { ok: false; detail: string };

/** Garde active hors simulation : inactive en mode A et en mode B seulement (D-I1-4). */
export function demoGuardActive(): boolean {
    return !isSimulationRun();
}

function compact(probe: DemoProbe): Record<string, string> {
    const item: Record<string, string> = { key: probe.key };
    for (const field of ['user_id', 'phone', 'email', 'event_id'] as const) {
        const value = probe[field];
        if (typeof value === 'string' && value.trim() !== '') item[field] = value;
    }
    return item;
}

async function blockedChunk(items: Array<Record<string, string>>): Promise<DemoGuardResult> {
    const { data, error } = await getServiceRoleClient().rpc('notification_demo_recipients', { p: { items } });
    if (error) return { ok: false, detail: `notification_demo_recipients : ${error.code ?? ''} ${error.message}`.trim() };
    const reply = (data ?? null) as { ok?: unknown; blocked?: unknown; code?: unknown } | null;
    if (!reply || reply.ok !== true || !Array.isArray(reply.blocked)) {
        return { ok: false, detail: `notification_demo_recipients : réponse inattendue (${String(reply?.code ?? 'sans code')})` };
    }
    return { ok: true, blocked: new Set(reply.blocked.map((k) => String(k))) };
}

/**
 * Clés des destinataires de démonstration parmi `probes` (un appel RPC par tranche de 500). Ne lève jamais :
 * toute panne est journalisée et rendue `{ ok: false, detail }`.
 */
export async function demoBlockedKeys(probes: readonly DemoProbe[]): Promise<DemoGuardResult> {
    const blocked = new Set<string>();
    try {
        for (let start = 0; start < probes.length; start += MAX_ITEMS_PER_CALL) {
            const chunk = await blockedChunk(probes.slice(start, start + MAX_ITEMS_PER_CALL).map(compact));
            if (!chunk.ok) {
                console.error(`[demo-guard] garde des comptes de démonstration indisponible : ${chunk.detail}`);
                return chunk;
            }
            chunk.blocked.forEach((key) => blocked.add(key));
        }
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`[demo-guard] garde des comptes de démonstration indisponible : ${detail}`);
        return { ok: false, detail };
    }
    return { ok: true, blocked };
}
