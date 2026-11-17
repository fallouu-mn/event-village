/**
 * Finition 2b (C) — tous les brouillons du formulaire d'événement gardés dans ce navigateur sont effacés, quel que soit le
 * compte (appareil partagé), par components/providers/AuthProvider.tsx :
 *  - au bouton « Se déconnecter » de l'application, avant la fermeture de la session ;
 *  - à toute fin de session signalée au navigateur (SIGNED_OUT : autre onglet, « Déconnecter tous mes appareils »,
 *    déconnexion du contrôleur, mot de passe réinitialisé).
 * Une session close sans que le navigateur en soit averti (cookies effacés par le serveur) laisse le brouillon jusqu'à
 * la prochaine déconnexion : voir docs/apres-lancement.md. Un brouillon n'est jamais proposé à un autre compte (clé et
 * contenu propres au compte, lib/events/local-draft.ts).
 *
 * Module à part, sans dépendance, appelé par components/providers/AuthProvider.tsx (chargé par chaque page) : le module
 * des brouillons (lib/events/local-draft.ts : lecture, écriture, contrôles) reste dans le seul JavaScript du formulaire.
 * Run complet 275 : importé depuis AuthProvider, il entrait dans chaque page (budgets de scripts/js-budget.json dépassés).
 *
 * Clés effacées : celles qui commencent par « ev-brouillon: » (préfixe des clés de lib/events/local-draft.ts, toutes
 * versions) ; les autres clés du navigateur sont gardées. Stockage absent ou refusé (navigation privée) : rien n'est
 * effacé, aucune exception, la déconnexion continue. Contrôlé par tests/parcours/f2b-brouillon-local.test.ts.
 */
export function clearAllDrafts(): void {
    try {
        const s = window.localStorage;
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k?.startsWith('ev-brouillon:')) keys.push(k);
        }
        for (const k of keys) s.removeItem(k);
    } catch {
        // stockage absent ou refusé : rien à effacer
    }
}
