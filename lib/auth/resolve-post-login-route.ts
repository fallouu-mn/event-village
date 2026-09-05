/**
 * EVENT VILLAGE — ROUTAGE POST-CONNEXION DÉTERMINISTE (§Audit Contrôleur)
 * 
 * Centralise et sécurise la décision de redirection après authentification
 * réussie selon le rôle effectif de l'utilisateur et le paramètre `redirect` d'URL.
 * Normalise automatiquement les anciennes routes dépréciées (/scan, /partner/scan)
 * vers la route officielle de production du module Contrôleur : `/controller/scanner`.
 */
export function resolvePostLoginRoute(
    role?: string | null,
    redirectUrl?: string | null
): string {
    const rawTarget = redirectUrl && redirectUrl !== '/' ? redirectUrl.trim() : '/';

    // 1. Si aucune redirection spécifique demandée (ou redirect = '/'), routage strict par rôle
    if (!redirectUrl || redirectUrl === '/') {
        switch (role) {
            case 'SUPERADMIN':
            case 'ADMIN':
                return '/admin';
            case 'PARTENAIRE':
                return '/partner';
            case 'CONTROLEUR':
                return '/controller/scanner';
            case 'CLIENT':
            default:
                return '/';
        }
    }

    // 2. Normalisation critique : si le rôle est CONTROLEUR, intercepter et rediriger les anciens chemins scanner
    if (role === 'CONTROLEUR' && (rawTarget === '/scan' || rawTarget === '/partner/scan' || rawTarget === '/')) {
        return '/controller/scanner';
    }

    return rawTarget;
}
