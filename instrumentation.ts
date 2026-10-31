/**
 * Démarrage du serveur Next.js (lot 1C.8) : si RESEND_API_KEY est absente, un avertissement
 * unique signale que le canal email est désactivé. Aucun envoi, aucune exception.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { emailChannelAvailable } = await import('./lib/notifications/channels');
    emailChannelAvailable();
}
