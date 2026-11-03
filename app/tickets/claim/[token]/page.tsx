import { redirect } from 'next/navigation';

/**
 * Ancienne page de réclamation d'un billet par lien (lot 6, contrat B4 et amendement 2).
 *
 * Le transfert ne passe plus par un jeton : le destinataire se connecte avec le numéro auquel le billet a
 * été envoyé et l'accepte dans « Mes billets », onglet « Reçus ». Cette page n'est plus qu'une redirection
 * côté serveur : elle ne lit ni le jeton, ni la base, ni le réseau. Sans session, le middleware renvoie
 * d'abord vers la connexion.
 */
export default function LegacyClaimPage(): never {
  redirect('/tickets?tab=recus');
}
