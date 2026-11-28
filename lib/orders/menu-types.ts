/**
 * Lot 12b — carte des plats d'un établissement, telle que la sert la route publique GET /api/restaurants/[id]/menu
 * (fonction en base order_venue_menu). Types sans dépendance serveur : utilisables par les écrans.
 *
 * Aucun montant n'est calculé à partir de ces données dans le navigateur : les prix affichés sur la carte sont ceux de
 * la base ; le panier affiche toujours le devis de la base (POST /api/orders/quote), relu à chaque changement.
 */

import type { DishVisual } from './dish-visual';

export type OrderMode = 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE';
export type OrderPaymentChoice = 'INTEGRAL' | 'ACOMPTE' | 'DIFFERE';
export type ProductAvailability = 'DISPONIBLE' | 'INDISPONIBLE' | 'EPUISE' | 'SUSPENDU';

export interface MenuOption {
    id: string;
    name: string;
    price: number;
}

export interface MenuProduct {
    id: string;
    name: string;
    description: string | null;
    price: number;
    /** Photo de la fiche du produit, ou null (jamais une photo de remplacement venue d'un site extérieur). */
    image: string | null;
    categoryId: string | null;
    availability: ProductAvailability;
    /** Produit réglementé (alcool, tabac) : affiché avec son prix, jamais commandable en ligne. */
    regulated: boolean;
    /** Produit en cours de vérification par Event Village : affiché avec son prix, non commandable en ligne. */
    inReview: boolean;
    /** Commandable maintenant (disponible, ni réglementé ni en vérification, portions ou stock restants). */
    orderable: boolean;
    daily: boolean;
    /** Plat du jour : portions restantes aujourd'hui (null pour un autre produit). */
    portionsLeft: number | null;
    /** Plat du jour : portions prévues aujourd'hui (null pour un autre produit). */
    portionsTotal: number | null;
    options: MenuOption[];
}

/**
 * Lot 12d : allergènes (codes de la liste fermée : GLUTEN, CRUSTACES, OEUFS…) et niveau de piment (0 pas pimenté à 3 très
 * pimenté ; null = non renseigné) d'un plat. Servis à part des produits (`VenueMenu.dishFacts`) : la liste des champs d'un
 * produit de la carte est figée par tests/audit/cv12b-2-gardes.test.ts (G6).
 */
export interface DishFactsData {
    allergens: string[];
    spiceLevel: number | null;
}

export interface MenuZone {
    id: string;
    name: string;
    fee: number;
    minOrder: number;
}

export interface MenuSpot {
    id: string;
    label: string;
    zone: string | null;
}

/** Plage d'ouverture : jour ISO (1 = lundi … 7 = dimanche), ouverture, fermeture (« 24:00 » possible). */
export type MenuHours = [number, string, string];

/** Fenêtre où une heure peut être choisie (heure de Dakar, « AAAA-MM-JJTHH:MM »), début inclus, fin exclue. */
export type MenuWindow = [string, string];

export interface VenueMenu {
    /** Lot 12d : allergènes et piment par identifiant de plat (plats sans information : absents). */
    dishFacts: Record<string, DishFactsData>;
    venue: {
        id: string;
        name: string;
        kind: string;
        city: string | null;
        address: string | null;
        description: string | null;
        photos: string[];
    };
    ordering: {
        modes: OrderMode[];
        /** Acompte proposé (pourcentage) ; null si l'établissement ne le propose pas. */
        depositPercent: number | null;
        payOnHandover: boolean;
        prepMinutes: number;
        serviceFeeRate: number;
        asapAvailable: boolean;
        /** Fin de la fermeture exceptionnelle en cours (heure de Dakar, « AAAA-MM-JJTHH:MM »), ou null. */
        closedUntil: string | null;
        /** Lot 12d : fin de la pause des commandes en cours (heure de Dakar, « AAAA-MM-JJTHH:MM »), ou null. */
        pausedUntil: string | null;
        /** Heure de Dakar au moment de la lecture (« AAAA-MM-JJTHH:MM »). */
        now: string;
        windows: MenuWindow[];
    };
    hours: MenuHours[];
    zones: MenuZone[];
    spots: MenuSpot[];
    categories: Array<{ id: string; name: string }>;
    products: MenuProduct[];
    /**
     * Visuel dessiné (fichier local) de chaque plat, choisi par le serveur d'après sa catégorie puis son nom (correctifs
     * après contre-vérification, idée 13) ; table à part : la fiche d'un plat garde exactement ses champs (audit cv12b-2 G6).
     */
    visuals: Record<string, DishVisual>;
}

export const ORDER_MODE_LABELS: Readonly<Record<OrderMode, string>> = {
    LIVRAISON: 'Livraison',
    RETRAIT: 'À emporter',
    SUR_PLACE: 'Sur place',
};

export const AVAILABILITY_LABELS: Readonly<Record<ProductAvailability, string>> = {
    DISPONIBLE: 'Disponible',
    INDISPONIBLE: 'Indisponible',
    EPUISE: 'Épuisé',
    SUSPENDU: 'Momentanément suspendu',
};
