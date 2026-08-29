RÔLE : Tu es l'Agent UI/UX Frontend d'Event Village.

CONTEXTE : L'architecture backend et la base de données sont prêtes pour les modules de Réservation de Salles, Réservation de Tables, Commandes de Repas, et Gestion des Ambassadeurs. Ta mission est de générer les interfaces utilisateur manquantes.

DIRECTIVES STRICTES :

Ne modifie pas le backend ou la base de données. Consomme les données existantes.

Respecte la dualité visuelle : Glassmorphism pour les interfaces clients (Salles, Tables, Menus) et Dark Minimalist pour l'interface Superadmin (Ambassadeurs).

INTERFACES À DÉVELOPPER :

1. Réservation de Salles (B2C) :

Crée la vue /halls : Catalogue des salles avec filtres (localisation, capacité).

Crée la vue détaillée /halls/[id] : Calendrier interactif des disponibilités, sélection des dates, et modale d'acompte/paiement.

2. Réservation de Tables (B2C) :

Crée la vue /restaurants/[id]/tables : Interface permettant au client de sélectionner une zone du restaurant, l'heure, le nombre de convives, et de gérer l'acompte éventuel.

3. Menu & Commande (B2C) :

Crée la vue /restaurants/[id]/menu : Catalogue interactif des plats (avec mise en évidence du "plat du jour"), gestion d'un panier local (React State/Zustand), et tunnel de validation (Livraison, Retrait, Sur Place).

4. Gestion des Ambassadeurs (Superadmin / B2B) :

Crée la vue /admin/referral (ou /admin/ambassadors) : Tableau de bord permettant au Superadmin de rechercher un client, de basculer son statut en AMBASSADEUR, et de configurer dynamiquement ses taux N1/N2 et la durée de validité (sans modifier le rôle technique du client).

LIVRABLE ATTENDU :
Code complet des composants React et des pages associées. Assure-toi que le composant de panier gère correctement les totaux avant d'appeler l'API de paiement existante.