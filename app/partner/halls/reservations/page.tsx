import { redirect } from 'next/navigation';

/**
 * Lot 10b (point 3) : les réservations se consultent dans le calendrier de chaque salle ; l'adresse sans identifiant
 * renvoie vers « Mes salles » (au lieu d'une fiche de salle introuvable).
 */
export default function PartnerHallReservationsIndex(): never {
    redirect('/partner/halls');
}
