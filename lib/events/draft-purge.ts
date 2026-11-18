/**
 * Finition 2b (C) — tous les brouillons du formulaire d'événement gardés dans ce navigateur sont effacés, quel que soit le
 * compte (appareil partagé ; à la connexion, sauf les brouillons récents du compte qui se connecte), par
 * components/providers/AuthProvider.tsx :
 *  - au bouton « Se déconnecter » de l'application, avant la fermeture de la session ;
 *  - à toute fin de session signalée au navigateur (SIGNED_OUT : autre onglet, « Déconnecter tous mes appareils »,
 *    déconnexion du contrôleur, mot de passe réinitialisé).
 *  - cvf2b 6.5 : au chargement d'une page sans session (session close à l'insu du navigateur, cookies effacés par le
 *    serveur) ;
 *  - cvf2b 5c / 5d : à toute connexion (SIGNED_IN, `keep` = compte qui se connecte), même quand le compte précédent
 *    n'est plus en mémoire (page rechargée) : brouillons des AUTRES comptes effacés, et ceux du compte de plus de 7 jours
 *    (durée de vie d'un brouillon, contrôlée aussi à la lecture par lib/events/local-draft.ts).
 * Un brouillon n'est jamais proposé à un autre compte (clé et contenu propres au compte, lib/events/local-draft.ts).
 *
 * Module à part, sans dépendance, appelé par components/providers/AuthProvider.tsx (chargé par chaque page) : le module
 * des brouillons (lib/events/local-draft.ts : lecture, écriture, contrôles) reste dans le seul JavaScript du formulaire.
 * Run complet 275 : importé depuis AuthProvider, il entrait dans chaque page (budgets de scripts/js-budget.json dépassés).
 *
 * Clés effacées : celles qui commencent par « ev-brouillon: » (préfixe des clés de lib/events/local-draft.ts, toutes
 * versions) ; les autres clés du navigateur sont gardées. Stockage absent ou refusé (navigation privée) : rien n'est
 * effacé, aucune exception, la déconnexion continue. Contrôlé par tests/parcours/f2b-brouillon-local.test.ts.
 */
export function clearAllDrafts(keep?: string): void {
    try {
        const s = window.localStorage;
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k?.startsWith('ev-brouillon:') && !(keep && k.startsWith(`ev-brouillon:v1:${keep}:`) && fresh(s.getItem(k)))) keys.push(k);
        }
        for (const k of keys) s.removeItem(k);
    } catch {
        // stockage absent ou refusé : rien à effacer
    }
}

/** Brouillon enregistré il y a moins de 7 jours (date illisible : non). */
function fresh(raw: string | null): boolean {
    try {
        return Date.now() - Date.parse((JSON.parse(raw ?? '') as { savedAt?: string }).savedAt ?? '') < 7 * 864e5;
    } catch {
        return false;
    }
}
