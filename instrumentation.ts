/**
 * Démarrage du serveur Next.js (lot 1C.8) : si RESEND_API_KEY est absente, un avertissement
 * unique signale que le canal email est désactivé. Aucun envoi, aucune exception.
 * Lot 8 (8.1) : sur un serveur d'essai, une bannière rappelle que rien n'est réel. Aucun refus ici : celui de
 * EV_INTEGRATIONS=fake reste au premier appel (getServerEnv, registre), prouvé contre le build par scripts/e2e/fake-prod.mjs.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { emailChannelAvailable } = await import('./lib/notifications/channels');
    emailChannelAvailable();
    const { isSimulationRun } = await import('./lib/integrations/simulation');
    if (isSimulationRun()) console.warn('[essai] Intégrations simulées : aucun SMS ni paiement réel.');
}
