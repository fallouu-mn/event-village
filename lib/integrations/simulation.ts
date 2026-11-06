/**
 * Lot 8 (8.1, L28) — mode d'essai : ce serveur manipule-t-il des opérations simulées ?
 *
 * Module sans dépendance, importé par lib/supabase/server.ts et par lib/payments/cashout.service.ts. Deux
 * serveurs d'essai existent :
 *  - mode A : `next dev` avec EV_INTEGRATIONS=fake ;
 *  - mode B : `next start` lancé par scripts/dev/essai-start.mjs (EV_ESSAI_SIMULATION=1), vrais adaptateurs
 *    pointés sur le faux service local.
 *
 * Sur un tel serveur, le client service_role envoie l'en-tête x-ev-simulation : la base marque alors les
 * paiements et les versements créés (trigger, supabase/migrations/20261106000002_lot8_essai.sql). En production
 * rien n'est envoyé : `process.env.NODE_ENV` est figé au build, et la seconde branche exige un SamirPay local.
 * En test (NODE_ENV=test), EV_INTEGRATIONS=fake seul ne fait pas un serveur d'essai.
 */

export const SIMULATION_HEADER = 'x-ev-simulation';

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Vrai pour une URL http(s) de la boucle locale, lue par `new URL().hostname` (hôte piégé ou à identifiant : faux). */
export function isLoopbackUrl(value: string | undefined): boolean {
    if (!value || !URL.canParse(value)) return false;
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.username === '' && url.password === '' && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * Vrai sur un serveur d'essai seulement. NODE_ENV se lit toujours sur `process.env`, littéralement : c'est la
 * valeur figée au build, jamais celle de l'environnement du lancement. `env` ne fournit que le reste.
 */
export function isSimulationRun(env: NodeJS.ProcessEnv = process.env): boolean {
    if (process.env.NODE_ENV === 'development' && env.EV_INTEGRATIONS === 'fake') return true;
    return env.EV_ESSAI_SIMULATION === '1' && isLoopbackUrl(env.SAMIRPAY_API_URL);
}

/** En-têtes du client service_role : `{ 'x-ev-simulation': '1' }` sur un serveur d'essai, sinon vide. */
export function simulationHeaders(): Record<string, string> {
    return isSimulationRun() ? { [SIMULATION_HEADER]: '1' } : {};
}
