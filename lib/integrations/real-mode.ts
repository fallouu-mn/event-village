/**
 * Lot 9 bis, tâche I3 (contrat 4.7, 5.65, arbitrage A9, X14, B110) — démarrage en mode réel.
 *
 * Mode réel : ni serveur d'essai (isSimulationRun faux), ni EV_INTEGRATIONS=fake, et SAMIRPAY_API_URL hors de la
 * boucle locale, quel que soit NODE_ENV. La CI e2e (fournisseurs en 127.0.0.1) n'est donc jamais en mode réel.
 * En mode réel, une ligne prévient que l'argent est réel ; et le démarrage est refusé si NEXT_PUBLIC_APP_URL n'est pas
 * en https : l'avis de paiement de SamirPay (callback construit sur cette adresse) ne pourrait pas arriver.
 *
 * Module sans dépendance hors ./simulation, sans réseau. L'environnement est lu par le paramètre `env`, jamais par
 * une référence littérale à process.env.NEXT_PUBLIC_APP_URL (remplaçable au build). Le refus nomme les variables
 * sans jamais afficher leur valeur.
 */
import { isLoopbackUrl, isSimulationRun } from './simulation';

export const REAL_BANNER = '[réel] SMS, paiements et emails RÉELS : de l’argent réel sera débité.';

export const REAL_REFUSAL = '[réel] Refus de démarrer : en réel, NEXT_PUBLIC_APP_URL doit commencer par https://, sinon l’avis de paiement de SamirPay ne peut pas arriver. Ouvrez le tunnel (docs/essai-local.md, section 9), mettez son adresse dans NEXT_PUBLIC_APP_URL et EV_DEV_TUNNEL_URL, puis relancez.';

export interface RealRunStartup {
    /** Vrai : écrire REAL_BANNER une fois. */
    banner: boolean;
    /** Texte du refus de démarrer, ou null. */
    refusal: string | null;
}

/** Mode réel au sens de l'arbitrage A9. */
export function isRealRun(env: NodeJS.ProcessEnv = process.env): boolean {
    return !isSimulationRun(env) && env.EV_INTEGRATIONS !== 'fake' && !isLoopbackUrl(env.SAMIRPAY_API_URL);
}

function isHttpsUrl(value: string | undefined): boolean {
    return !!value && URL.canParse(value) && new URL(value).protocol === 'https:';
}

/** Décision du démarrage : ligne [réel], refus, ou rien hors du mode réel. */
export function realRunStartup(env: NodeJS.ProcessEnv = process.env): RealRunStartup {
    if (!isRealRun(env)) return { banner: false, refusal: null };
    if (!isHttpsUrl(env.NEXT_PUBLIC_APP_URL)) return { banner: false, refusal: REAL_REFUSAL };
    return { banner: true, refusal: null };
}
