/**
 * Démarrage du serveur Next.js (lot 1C.8) : si RESEND_API_KEY est absente, un avertissement
 * unique signale que le canal email est désactivé. Aucun envoi, aucune exception.
 * Lot 8 (8.1) : sur un serveur d'essai, une bannière rappelle que rien n'est réel. Le refus de EV_INTEGRATIONS=fake
 * reste au premier appel (getServerEnv, registre), prouvé contre le build par scripts/e2e/fake-prod.mjs.
 * Lot 9 bis (I3, arbitrage A9) : en mode réel (hors simulation, sans EV_INTEGRATIONS=fake, SamirPay hors boucle
 * locale), une ligne [réel] prévient que l'argent est réel, et le démarrage est refusé si NEXT_PUBLIC_APP_URL n'est pas
 * en https (lib/integrations/real-mode.ts) : l'erreur levée ici arrête next dev comme next start.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { emailChannelAvailable } = await import('./lib/notifications/channels');
    emailChannelAvailable();
    const { isSimulationRun } = await import('./lib/integrations/simulation');
    if (isSimulationRun()) console.warn('[essai] Intégrations simulées : aucun SMS ni paiement réel.');
    const { realRunStartup, REAL_BANNER } = await import('./lib/integrations/real-mode');
    const real = realRunStartup(process.env);
    if (real.refusal) throw new Error(real.refusal);
    if (real.banner) console.warn(REAL_BANNER);
}
