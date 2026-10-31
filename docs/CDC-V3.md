# CAHIER DES CHARGES FONCTIONNEL — EVENT VILLAGE

Plateforme digitale de découverte, réservation, commande, vente et animation de l'écosystème événementiel

**VERSION 3.0 — AOÛT 2026 — Document consolidé (version de référence)**

## HISTORIQUE DES VERSIONS

| Version | Date | Objet |
|---|---|---|
| V1.0 | 11 août 2026 | Cahier des charges initial |
| V2.0 | 12 août 2026 | Ajout Commande & Vente, premiers ajustements économiques |
| V2.5 | 13 août 2026 | Refonte du parrainage et du modèle économique |
| V3.0 | Août 2026 | Version consolidée : services, finance, parrainage, Ambassadeurs, tarifs et chronogramme |

---

# PARTIE I — VISION ET PÉRIMÈTRE

## 1. PRÉSENTATION GÉNÉRALE

Event Village est une plateforme digitale Web et Mobile destinée à centraliser l'écosystème événementiel et les services associés.

Elle permet notamment : de découvrir des événements ; rechercher des restaurants ; rechercher des salles ; découvrir des prestataires ; réserver ; acheter des tickets ; réserver des tables ; commander des produits ; payer ; gérer les livraisons ; communiquer ; promouvoir ; parrainer.

Le principe fondamental est : **UN COMPTE → PLUSIEURS SERVICES**

Un Partenaire n'a pas besoin de créer plusieurs comptes pour exercer plusieurs activités.

## 2. PROBLÉMATIQUE

**Côté Client** : difficulté à identifier les prestataires ; informations dispersées ; manque de visibilité sur les prix ; difficulté à connaître les disponibilités ; difficulté à réserver ; difficulté à commander ; moyens de paiement dispersés.

**Côté Partenaire** : manque de visibilité ; gestion manuelle ; difficulté à vendre en ligne ; difficulté à gérer les réservations ; difficulté à communiquer ; absence d'outils statistiques.

## 3. VISION

Une plateforme de référence permettant de découvrir, réserver, acheter, commander et gérer les services liés à l'événementiel et aux loisirs.

## 4. OBJECTIFS

La découverte. La recherche. La réservation. La billetterie. La commande. Le paiement. La livraison. Le contrôle. La communication. La promotion. Le parrainage. La monétisation. Le reporting.

## 5. PÉRIMÈTRE

événements ; tickets ; salles ; tables ; restaurants ; produits ; commandes ; livraison ; paiement ; communication ; parrainage ; administration ; statistiques.

## 6. PRINCIPES FONDAMENTAUX

- Principe 1 : Un Client = un compte.
- Principe 2 : Un Partenaire = un compte pouvant gérer plusieurs activités.
- Principe 3 : Le Parrainage est une fonctionnalité du Client.
- Principe 4 : L'Ambassadeur est un Client et non un profil séparé.
- Principe 5 : Les paiements Event Village sont distincts des paiements hors plateforme.
- Principe 6 : Le calcul du parrainage est basé sur le revenu net éligible d'Event Village.

---

# PARTIE II — UTILISATEURS ET RÔLES

## 7. TYPES D'UTILISATEURS

Client ; Partenaire Business ; Administrateur ; Contrôleur ; Superadministrateur.

## 8. CLIENT

Le Client peut : rechercher ; réserver ; acheter ; commander ; payer ; recevoir ; consulter son historique ; parrainer ; recevoir des commissions.

## 9. PARTENAIRE BUSINESS

Le Partenaire peut être : restaurant ; traiteur ; salle ; organisateur ; prestataire ; pâtisserie ; établissement alimentaire ; autre activité autorisée. Un même Partenaire peut cumuler plusieurs activités.

## 10. ADMINISTRATEUR

L'Administrateur gère uniquement les fonctionnalités qui lui sont attribuées.

## 11. CONTRÔLEUR

Le Contrôleur peut notamment : scanner les QR Codes ; vérifier les tickets ; vérifier les réservations ; enregistrer certaines opérations ; confirmer certaines arrivées ; enregistrer un paiement hors plateforme selon permission.

## 12. SUPERADMINISTRATEUR

Le Superadministrateur dispose de tous les droits. Il peut notamment : gérer les utilisateurs ; gérer les partenaires ; créer des Administrateurs ; créer d'autres Superadministrateurs ; gérer les permissions ; gérer les services ; gérer les paiements ; gérer les tarifs ; gérer les commissions ; gérer le parrainage ; désigner des Ambassadeurs ; personnaliser les taux ; personnaliser les durées ; consulter les statistiques.

## 13. AMBASSADEUR / INFLUENCEUR

RÈGLE FONDAMENTALE : L'Ambassadeur est un CLIENT. Il ne constitue ni un nouveau rôle, ni un nouveau profil, ni un nouveau type de compte, ni un nouveau parcours utilisateur. Le Client devient Ambassadeur uniquement parce que le Superadministrateur lui attribue des conditions de parrainage particulières.

RÔLE TECHNIQUE : CLIENT — STATUT DE PARRAINAGE : AMBASSADEUR.

L'Ambassadeur conserve exactement les mêmes fonctionnalités qu'un Client classique. La seule différence concerne les conditions de rémunération du parrainage.

---

# PARTIE III — COMPTE CLIENT

## 14. CRÉATION
prénom ; nom ; téléphone ; email ; mot de passe ; OTP.

## 15. PROFIL
Le Client peut modifier : photo ; nom ; téléphone ; email ; préférences.

## 16. RECHERCHE
Recherche par : événement ; restaurant ; salle ; prestataire ; produit ; table ; localisation.

## 17. DÉCOUVERTE
événements populaires ; événements proches ; restaurants ; offres ; plats du jour ; salles ; prestataires.

## 18. RÉSERVATIONS
réservations futures ; réservations passées ; réservations annulées ; paiements ; soldes.

## 19. COMMANDES
commande ; produits ; quantité ; montant ; montant payé ; solde ; livraison ; statut.

## 20. TICKETS
Le Client peut consulter : événement ; ticket ; catégorie ; prix ; QR Code ; statut.

## 21. HISTORIQUE
tickets ; commandes ; réservations ; paiements ; commissions ; parrainage.

## 22. NOTIFICATIONS
SMS ; WhatsApp ; Email ; Push.

---

# PARTIE IV — ESPACE PARTENAIRE

## 23. INSCRIPTION
Le Partenaire fournit les informations nécessaires à sa validation (pièces d'identification et, lorsque disponibles, documents professionnels).

## 24. VALIDATION
Statuts : En attente ; Validé ; Refusé ; Suspendu.

## 25. PÉRIODE D'ESSAI
60 jours d'essai standard. Offre Founders : jusqu'à 90 jours.

## 26. PACKS
- STARTER : 2 500 FCFA / mois ou 7 500 FCFA / trimestre
- BUSINESS : 5 000 FCFA / mois ou 15 000 FCFA / trimestre
- PREMIUM : 10 000 FCFA / mois ou 30 000 FCFA / trimestre

## 27. TARIFICATION
- STARTER : page professionnelle ; informations ; photos limitées ; catalogue simple ; statistiques de base.
- BUSINESS : fonctionnalités Starter ; catalogue avancé ; vidéos ; statistiques ; outils de gestion.
- PREMIUM : fonctionnalités Business ; visibilité renforcée ; promotion ; statistiques avancées ; outils marketing.

## 28. PAGE PROFESSIONNELLE
nom ; activité ; description ; téléphone ; adresse ; localisation ; photos ; vidéos ; produits ; événements ; services ; réservations.

## 29. TABLEAU DE BORD
ventes ; réservations ; commandes ; tickets ; revenus ; paiements ; statistiques ; abonnement.

---

# PARTIE V — ÉVÉNEMENTS

## 30. CRÉATION
Le Partenaire renseigne : titre ; description ; date ; heure ; lieu ; image ; programme.

## 31. PUBLICATION
Statuts : Brouillon ; En attente ; Validé ; Publié ; Suspendu ; Terminé.

## 32. PROGRAMME
Possibilité d'ajouter : artistes ; horaires ; activités ; intervenants.

## 33. INFORMATIONS PRATIQUES
adresse ; accès ; parking ; contact ; règles.

## 34. SERVICES ASSOCIÉS
Un événement peut proposer : ticketing ; tables ; communication ; promotion.

---

# PARTIE VI — TICKETING

## 35. CRÉATION
Le Partenaire définit : catégorie ; prix ; quantité ; date de début ; date de fin.

## 36. VENTE
Le Client : choisit ; commande ; paie ; reçoit son ticket.

## 37. FRAIS DE SERVICE
Le ticketing peut utiliser le modèle : **Prix du ticket + frais de service**.
Exemple : Ticket 1 000 FCFA ; Frais 5 % = 50 FCFA ; Total 1 050 FCFA.

## 38. PAIEMENT
Le paiement peut être effectué via les moyens intégrés.

## 39. QR CODE
Chaque ticket possède un QR Code unique.

## 40. CONTRÔLE
Le Contrôleur scanne le QR Code. Résultat : 🟢 VALIDE ou 🔴 INVALIDE / DÉJÀ UTILISÉ.

## 41. REMBOURSEMENT
Le système doit gérer : annulation ; remboursement ; régularisation financière ; régularisation des commissions de parrainage.

---

# PARTIE VII — RÉSERVATION DE SALLES

## 42. CATALOGUE
Recherche par : localisation ; date ; prix ; capacité ; disponibilité.

## 43. DISPONIBILITÉS
disponible ; réservée ; bloquée ; indisponible.

## 44. RÉSERVATION
Recherche → Consultation → Disponibilité → Réservation → Paiement → Confirmation.

## 45. PAIEMENT
paiement intégral ; acompte ; paiement différé.

## 46. ACOMPTE
pourcentage ; montant fixe.

## 47. MORATOIRE
Une réservation peut être maintenue pendant une durée définie. À expiration : MORATOIRE EXPIRÉ.

## 48. ANNULATION
Conditions définies par le Partenaire et règles générales Event Village.

---

# PARTIE VIII — RÉSERVATION DE TABLES

## 49. PRINCIPE
restaurants ; bars autorisés ; espaces événementiels ; organisateurs.

## 50. RESTAURANT
zones ; tables ; capacité ; horaires ; disponibilité ; conditions.

## 51. ÉVÉNEMENT
zones ; catégories ; tables ; capacité ; prix ; conditions.

## 52. DISPONIBILITÉ
disponible ; en attente ; réservé ; acompte payé ; moratoire ; payé ; annulé ; occupé.

## 53. RÉSERVATION
date ; heure ; personnes ; zone ; table.

## 54. ACOMPTE
paiement intégral ; acompte ; aucun paiement immédiat.

## 55. PAIEMENT HORS PLATEFORME
Le Client peut payer directement au Partenaire lorsque cette option est autorisée. Le système enregistre l'information mais ne comptabilise pas ce paiement comme un encaissement Event Village.

---

# PARTIE IX — COMMANDE ET VENTE

## 56. PRÉSENTATION
Présenter ; publier ; vendre leurs produits (plats du jour, menus, formules, desserts, produits alimentaires autorisés).

## 57. PARTENAIRES CONCERNÉS
restaurants ; traiteurs ; pâtisseries ; établissements alimentaires ; prestataires autorisés ; organisateurs.

## 58. CATALOGUE
créer ; modifier ; publier ; désactiver ; supprimer ; fixer le prix ; gérer les quantités.

## 59. PLAT DU JOUR
Exemple : THIÉBOUDIENNE — 4 500 FCFA — 50 portions — Aujourd'hui.

## 60. PRIX
Le Partenaire fixe librement le prix dans les limites des règles Event Village.

## 61. DISPONIBILITÉ
disponible ; indisponible ; épuisé ; temporairement suspendu.

## 62. PANIER
produit ; quantité ; prix ; livraison ; total ; montant à payer ; solde éventuel.

## 63. COMMANDE
prénom ; nom ; téléphone ; email ; adresse ; commentaire.

## 64. PAIEMENT INTÉGRAL
100 % à la commande.

## 65. ACOMPTE
pourcentage ; montant fixe.

## 66. PAIEMENT DIFFÉRÉ
Total – Montant payé = Solde.

## 67. LIVRAISON
Commande confirmée → Préparation → Prête → En livraison → Livrée.

## 68. RETRAIT
Commande prête → Client arrive → Commande remise → Commande retirée.

## 69. SUR PLACE
Commande associée à : une table ; une zone ; un emplacement.

## 70. NOTIFICATIONS
SMS ; WhatsApp ; notification ; Email (produit, montant, client, téléphone, adresse de livraison).

## 71. PRODUITS INTERDITS
Alcool etc. : exposer / présenter / afficher le prix autorisés ; vente via Event Village, paiement en ligne, livraison Event Village interdits.

## 72. ANNULATION
demande ; validation ; annulation ; remboursement ; ajustement financier.

## 73. STATISTIQUES
commandes ; ventes ; panier moyen ; produits populaires ; livraisons ; annulations ; paiements.

---

# PARTIE X — PAIEMENTS ET FINANCES

## 74. PRINCIPES
Paiement Event Village : l'argent passe par la plateforme. Paiement hors plateforme : l'argent est payé directement au Partenaire.

## 75. PAIEMENT EVENT VILLAGE
Le système enregistre : transaction ; montant ; client ; partenaire ; frais ; agrégateur ; revenu Event Village ; statut.

## 76. PAIEMENT HORS PLATEFORME
espèces ; Wave direct ; Orange Money direct ; autre moyen. Il ne doit pas alimenter le solde financier Event Village.

## 77. FRAIS AGRÉGATEUR
Configurable par moyen de paiement. Référence : 1,5 %. Le taux doit être configurable.

## 78. MODÈLE FINANCIER DES SERVICES EVENT VILLAGE
Service à 1 000 FCFA : Débit Client 1 000 F ; Frais agrégateur 1,5 % × 1 000 = 15 F ; Revenu net Event Village 985 F. Le client n'est pas débité de 1 015 F. Event Village prend à sa charge le coût du paiement.

## 79. MODÈLE FINANCIER DU TICKETING
Ticket 1 000 F ; Frais de service 50 F ; Total 1 050 F ; Frais agrégateur 1,5 % × 1 050 = 15,75 F ; Organisateur 1 000 F ; Event Village 50 − 15,75 = 34,25 F.

## 80. REVENU NET EVENT VILLAGE
REVENU NET EVENT VILLAGE ÉLIGIBLE = base de calcul du parrainage lorsque la transaction est éligible.

## 81. SOLDES
montant total ; montant payé ; solde ; revenu Event Village ; commission ; retrait.

## 82. REMBOURSEMENTS
transaction corrigée ; revenu Event Village corrigé ; commission de parrainage corrigée ; historique conservé.

## 83. RETRAITS
Mobile Money ; banque. Frais recommandé 1 %. Seuil recommandé 5 000 FCFA.

## 84. RAPPROCHEMENT FINANCIER
paiements ; frais ; agrégateurs ; revenus ; commissions ; retraits.

---

# PARTIE XI — PARRAINAGE

## 85. PRINCIPE
Intégré au compte Client. Aucun profil spécifique.

## 86. PARRAINAGE CLIENT
Lien pour devenir Client.

## 87. PARRAINAGE PRESTATAIRE
Lien pour devenir Partenaire Business.

## 88. DEUX LIENS DISTINCTS
INVITER UN CLIENT et INVITER UN PRESTATAIRE. Le système conserve la nature du lien.

## 89. ATTRIBUTION
Client A → Filleul B. Relation enregistrée, non modifiable arbitrairement.

## 90. GÉNÉRATION 1
Le parrain direct reçoit un pourcentage du revenu net Event Village éligible.

## 91. GÉNÉRATION 2
Le parrain du parrain reçoit un pourcentage du même revenu net éligible. (A → B → C : B = N1, A = N2.)

## 92. BASE DE CALCUL
Commissions calculées sur le revenu net effectivement conservé par Event Village, après modèle de facturation et frais de paiement. Jamais sur le montant brut.

## 93. EXEMPLE — ABONNEMENT 1 000 FCFA
Agrégateur 15 F ; Revenu net 985 F ; N1 5 % = 49,25 F ; N2 2 % = 19,70 F ; Event Village 916,05 F.

## 94. EXEMPLE — TICKETING 1 000 FCFA
Total payé 1 050 F ; Agrégateur 15,75 F ; Organisateur 1 000 F ; Revenu net 34,25 F ; N1 5 % = 1,7125 F ; N2 2 % = 0,685 F ; Event Village ≈ 31,85 F.

## 95. TAUX CLIENT STANDARD
5 % N1 — 2 % N2 — 12 mois.

## 96. TAUX PARRAINAGE PRESTATAIRE
7 % N1 — 2 % N2 — 24 mois.

## 97. AMBASSADEUR / INFLUENCEUR
Client (7 % / 2 %, 24 mois) ; Prestataire (10 % / 3 %, 36 mois). Statut attribué par le Superadministrateur.

## 98. PERSONNALISATION PAR LE SUPERADMINISTRATEUR
Taux N1/N2 Client, taux N1/N2 Prestataire, durées, statut Ambassadeur, dates. Jamais rétroactif sur les commissions acquises. Toutes les modifications sont historisées.

## 99. DURÉE
Paramètres configurables (12 / 24 / 36 mois).

## 100. TRANSACTIONS ÉLIGIBLES
abonnements ; ticketing ; réservation de salles ; réservation de tables ; commande en ligne ; promotion ; services payants ; communication payante ; autres services générant un revenu net.

## 101. TRANSACTIONS NON ÉLIGIBLES
paiement hors plateforme ; transaction annulée ; remboursée ; fraude ; chargeback ; sans revenu Event Village ; exposition gratuite.

## 102. COMMISSIONS EN ATTENTE
Générée → En attente → Disponible. Délai 7 à 14 jours.

## 103. REMBOURSEMENT
Commission annulée ou déduite du solde futur ; journalisation obligatoire.

## 104. ANTI-FRAUDE
auto-parrainage ; faux comptes ; comptes multiples ; boucles ; modification frauduleuse ; transactions artificielles.

## 105. RETRAIT
Minimum 5 000 FCFA ; frais 1 % ; Mobile Money ; banque.

## 106. HISTORIQUE
parrain ; filleul ; type ; génération ; transaction ; base de calcul ; taux ; commission ; statut ; date ; paiement.

---

# PARTIE XII — MODÈLE ÉCONOMIQUE

## 107. PRINCIPES
abonnements ; commissions transactionnelles ; promotion ; communication ; services Premium.

## 108. SERVICES GRATUITS
Compte Client gratuit ; compte Partenaire de base gratuit ; page de base gratuite ; exposition simple gratuite ; plat du jour exposable gratuitement.

## 109. SERVICES TRANSACTIONNELS
ticketing ; réservation ; commande ; services payants.

## 110. ABONNEMENTS
STARTER 2 500 F/mois ; BUSINESS 5 000 F/mois ; PREMIUM 10 000 F/mois.

## 111. TICKETING
Pas d'abonnement obligatoire au lancement. Frais de service sur le Client.

## 112. RÉSERVATION DE TABLES
Gratuit pour le Partenaire au lancement. Commission ; promotion ; services Premium.

## 113. RÉSERVATION DE SALLES
Pas d'abonnement obligatoire au lancement. Commission ; frais de service ; promotion.

## 114. COMMANDES
Gratuit d'accès. Commission transactionnelle ; abonnement Premium ; services additionnels.

## 115. PRODUITS EXPOSÉS UNIQUEMENT
Pas de commission sur vente hors plateforme. Monétisation : abonnement ; mise en avant ; visibilité.

## 116. PROMOTION
Homepage ; mise en avant ; position prioritaire ; notification ; campagne ; contenu sponsorisé.

## 117. COMMUNICATION
SMS ; WhatsApp ; Email ; autres. Le Superadmin configure tarifs, coûts et marges.

## 118. RETRAITS
1 % ; minimum 5 000 F.

## 119. COÛT DU PARRAINAGE
KPI principal : ROI DU PARRAINAGE.

---

# PARTIE XIII — COMMUNICATION

## 120. ANIMATION
Clients ; Partenaires ; les deux.

## 121. PROFILS D'ANIMATION
Event Village Info ; Sénégal ; Actualités ; Promotion (profils internes).

## 122. CRÉATION
titre ; message ; pièces jointes.

## 123. DESTINATAIRES
Clients ; Partenaires ; segmentation.

## 124. CANAUX
SMS ; WhatsApp ; Email ; Push.

## 125. CONTRÔLE
insultes ; propos offensants ; contenu interdit ; contenu inapproprié.

## 126. TARIFICATION
coût ; tarif ; marge ; canal.

---

# PARTIE XIV — ADMINISTRATION

## 127. BACK-OFFICE
Vue globale Superadmin.

## 128. UTILISATEURS
Clients ; Partenaires ; Administrateurs ; Contrôleurs.

## 129. PARTENAIRES
validation ; suspension ; abonnement ; activités ; statistiques.

## 130. SERVICES
événements ; tickets ; tables ; salles ; produits ; commandes.

## 131. FINANCE
transactions ; frais ; revenus ; commissions ; retraits ; remboursements.

## 132. PARRAINAGE
filleuls ; taux ; durées ; commissions ; retraits ; statistiques.

## 133. AMBASSADEURS
Écran CLIENTS / AMBASSADEURS : rechercher ; activer / désactiver le statut ; modifier taux et durées ; revenus générés ; commissions ; ROI. La fiche conserve Rôle : CLIENT et Statut parrainage : AMBASSADEUR.

## 134. JOURNAL D'ACTIVITÉ
utilisateur ; rôle ; date ; heure ; action ; objet ; ancienne valeur ; nouvelle valeur ; statut.

---

# PARTIE XV — DONNÉES ET API

## 135. DONNÉES CLIENT
user_id ; prénom ; nom ; téléphone ; email ; rôle ; statut ; statut parrainage ; date inscription.

## 136. DONNÉES PARTENAIRE
partenaire_id ; activité ; pack ; essai ; date fin ; statut.

## 137. DONNÉES ÉVÉNEMENT
event_id ; partenaire ; date ; heure ; lieu ; statut.

## 138. DONNÉES TICKET
ticket_id ; événement ; catégorie ; prix ; QR ; statut.

## 139. DONNÉES RÉSERVATION
reservation_id ; client ; partenaire ; date ; heure ; montant ; acompte ; solde ; paiement ; statut.

## 140. DONNÉES PRODUIT
produit_id ; partenaire ; nom ; catégorie ; prix ; stock ; disponibilité ; statut.

## 141. DONNÉES COMMANDE
commande_id ; client ; partenaire ; produits ; quantité ; total ; payé ; solde ; livraison ; statut.

## 142. DONNÉES FINANCIÈRES
montant brut ; frais de service ; frais agrégateur ; montant reversé ; revenu brut Event Village ; revenu net Event Village ; commission N1 ; commission N2 ; revenu final.

## 143. DONNÉES PARRAINAGE
parrain_id ; filleul_id ; type filleul ; génération ; taux ; durée ; date début ; date fin ; transaction ; revenu net ; commission ; statut.

## 144. API
agrégateurs ; Mobile Money ; SMS ; WhatsApp ; Email ; autres partenaires.

---

# PARTIE XVI — AUTOMATISATION

## 145. COMPTES
inscription ; OTP ; validation ; notifications.

## 146. RÉSERVATIONS
confirmation ; rappel ; moratoire ; expiration.

## 147. COMMANDES
nouvelle commande ; confirmation ; préparation ; livraison ; retrait ; clôture.

## 148. PAIEMENTS
confirmation ; calcul frais ; calcul revenu ; remboursement ; retrait.

## 149. PARRAINAGE
TRANSACTION → Identifier le filleul → Identifier le parrain → Identifier la génération → Vérifier la période → Calculer le revenu net Event Village → Appliquer le taux → Créer commission → Mettre en attente → Valider → Rendre disponible.

## 150. COMMUNICATIONS
confirmation ; rappel ; campagne ; expiration ; notification.

---

# PARTIE XVII — SÉCURITÉ

## 151. AUTHENTIFICATION
mot de passe ; OTP ; récupération.

## 152. PERMISSIONS
Chaque rôle dispose uniquement des droits nécessaires.

## 153. OTP
Obligatoire notamment pour les opérations sensibles.

## 154. QR CODE
unique ; sécurisé ; vérifiable ; historisé.

## 155. PROTECTION DES DONNÉES
données personnelles ; financières ; de paiement ; de retrait ; de parrainage.

## 156. TRAÇABILITÉ
Toute modification sensible doit être enregistrée.

---

# PARTIE XVIII — STATISTIQUES

## 157. CLIENT
tickets ; réservations ; commandes ; paiements ; parrainage ; commissions.

## 158. PARTENAIRE
événements ; tickets ; réservations ; commandes ; produits ; chiffre d'affaires ; paiements.

## 159. COMMANDES
nombre ; ventes ; panier moyen ; produits populaires ; livraisons ; annulations.

## 160. ÉVÉNEMENTS
événements ; tickets ; participants ; réservations ; taux de présence.

## 161. FINANCE
volume ; frais ; revenu brut ; revenu net ; commissions ; retraits.

## 162. PARRAINAGE
nombre de parrains ; nombre de filleuls ; Clients apportés ; Prestataires apportés ; transactions ; revenus générés ; commissions ; en attente ; payées ; ROI.

## 163. SUPERADMINISTRATEUR
Dashboard global : UTILISATEURS, PARTENAIRES, ÉVÉNEMENTS, TICKETS, RÉSERVATIONS, COMMANDES, FINANCE, PARRAINAGE, COMMUNICATION.

---

# PARTIE XIX — CHRONOGRAMME DE DÉVELOPPEMENT

| Phase | Module | Durée |
|---|---|---|
| 0 | Cadrage / UX | 1-2 sem. |
| 1 | Socle | 3-4 sem. |
| 2 | Marketplace | 2-3 sem. |
| 3 | Événements / Ticketing (événements ; tickets ; paiement ; QR ; contrôle ; reporting) | 3-4 sem. |
| 4 | Réservations | 3-4 sem. |
| 5 | Commande / Vente | 4-5 sem. |
| 6 | Finance | 3-4 sem. |
| 7 | Communication | 2-3 sem. |
| 8 | Parrainage | 2-3 sem. |
| 9 | Monétisation | 2 sem. |
| 10 | API | 2-4 sem. |
| 11 | Analytics | 2 sem. |
| 12 | Tests / Pilote | 3-4 sem. |

Durée globale indicative : 8 à 10 mois.

---

# PARTIE XX — ARCHITECTURE GLOBALE

## 178. ARCHITECTURE
CLIENT (Événements, Tickets, Salles, Tables, Produits, Commandes, Parrainage) — PARTENAIRE (Événements, Tickets, Tables, Salles, Produits, Commandes, Statistiques) — ADMINISTRATION (Utilisateurs, Partenaires, Finance, Commandes, Parrainage, Communication, Analytics).

## 179. PARCOURS CLIENT
CRÉER COMPTE → DÉCOUVRIR → CHOISIR → RÉSERVER / ACHETER / COMMANDER → PAYER → RECEVOIR CONFIRMATION → RECEVOIR QR / REÇU → UTILISER / RECEVOIR → HISTORIQUE → PARRAINER.

## 180. PARCOURS PARTENAIRE
INSCRIPTION → VALIDATION → ESSAI → PAGE PROFESSIONNELLE → ACTIVER SERVICES → PUBLIER → RECEVOIR RÉSERVATIONS / COMMANDES / VENTES → GÉRER → RECEVOIR / LIVRER → STATISTIQUES.

## 181. PARCOURS FINANCIER
TRANSACTION → MONTANT PAYÉ → FRAIS AGRÉGATEUR → RÉPARTITION → REVENU EVENT VILLAGE → REVENU NET ÉLIGIBLE → PARRAINAGE → REVENU FINAL EVENT VILLAGE.

## 182. PARCOURS PARRAINAGE
CLIENT → LIEN → FILLEUL → INSCRIPTION → TRANSACTION → REVENU NET → TAUX → N1 → N2 → COMMISSION EN ATTENTE → DISPONIBLE → RETRAIT.

---

# PARTIE XXI — RÈGLES MÉTIER

## 183. RÈGLES GÉNÉRALES
Un Client possède un compte unique. Un Partenaire peut exercer plusieurs activités. Le Parrainage n'est pas un profil. L'Ambassadeur est un Client. Le statut Ambassadeur est attribué par le Superadmin. Les fonctionnalités Client restent identiques pour l'Ambassadeur.

## 184. RÈGLES FINANCIÈRES
Un paiement Event Village est distinct d'un paiement hors plateforme. Les frais agrégateur sont calculés selon le moyen de paiement. Le système doit déterminer le revenu net Event Village. Le revenu net éligible constitue la base du parrainage. Un remboursement entraîne une régularisation.

## 185. RÈGLES DE PARRAINAGE
CLIENT STANDARD : Client → Client 5 % / 2 % 12 mois. PRESTATAIRE : Client → Prestataire 7 % / 2 % 24 mois. AMBASSADEUR : Client → Client 7 % / 2 % 24 mois ; Client → Prestataire 10 % / 3 % 36 mois. Les taux sont appliqués au revenu net Event Village éligible et non au montant brut.

## 186. RÈGLES DE COMMANDE
paiement intégral ; acompte ; paiement différé ; livraison ; retrait ; sur place.

## 187. RÈGLES DE RÉSERVATION
payée ; partiellement payée ; non payée si autorisé ; annulée ; en moratoire.

---

# PARTIE XXII — LIVRABLES

## 188. LIVRABLES TECHNIQUES
application Web ; application Mobile ; Back-office ; API ; base de données ; infrastructure ; documentation technique.

## 189. LIVRABLES FONCTIONNELS
cahier fonctionnel ; parcours ; règles métier ; documentation utilisateur ; documentation administration.

## 190. TESTS
fonctionnels ; sécurité ; paiement ; QR ; charge ; compatibilité ; mobile ; web.

## 191. DÉPLOIEMENT
Développement ; Environnement de test ; Préproduction ; Pilote ; Production ; Monitoring ; Maintenance.

---

# PARTIE XXIII — VISION FINALE

## 192. EVENT VILLAGE — VISION GLOBALE
Plateforme unique et modulaire. UN COMPTE → PLUSIEURS SERVICES.
- Client : CHERCHER → DÉCOUVRIR → RÉSERVER → COMMANDER → PAYER → RECEVOIR → PARTICIPER
- Partenaire : S'INSCRIRE → PUBLIER → VENDRE → RÉSERVER → GÉRER → COMMUNIQUER → ANALYSER
- Client Parrain : PARTAGER → ACQUÉRIR → GÉNÉRER DES TRANSACTIONS → RECEVOIR UNE COMMISSION
- Ambassadeur : ÊTRE CLIENT → PARTAGER DAVANTAGE → ACQUÉRIR → CONDITIONS RENFORCÉES
- Event Village : ACQUÉRIR → CONNECTER → TRANSACTER → MONÉTISER → REDISTRIBUER → RÉINVESTIR → GRANDIR

---

# ANNEXES

## ANNEXE A — GRILLE FINALE DU PARRAINAGE

| Profil | Filleul | N1 | N2 | Durée |
|---|---|---|---|---|
| Client standard | Client | 5 % | 2 % | 12 mois |
| Client standard | Prestataire | 7 % | 2 % | 24 mois |
| Ambassadeur | Client | 7 % | 2 % | 24 mois |
| Ambassadeur | Prestataire | 10 % | 3 % | 36 mois |

Base dans tous les cas : Revenu net Event Village éligible.

## ANNEXE B — EXEMPLE ABONNEMENT
Service 1 000 F ; Client paie 1 000 F ; Agrégateur 15 F ; Event Village 985 F. Client standard : N1 49,25 F ; N2 19,70 F ; Event Village 916,05 F. Ambassadeur : N1 68,95 F ; N2 19,70 F ; Event Village 896,35 F.

## ANNEXE C — EXEMPLE TICKETING
Ticket 1 000 F ; Frais 50 F ; Total 1 050 F ; Agrégateur 15,75 F ; Organisateur 1 000 F ; Revenu net Event Village 34,25 F. Client standard : N1 5 % 1,71 F ; N2 2 % 0,69 F. Ambassadeur : N1 7 % 2,40 F ; N2 3 % 1,03 F.

## ANNEXE D — TARIFS PARTENAIRES

| Offre | Mensuel | Trimestriel | Essai |
|---|---|---|---|
| Starter | 2 500 F | 7 500 F | 60 jours |
| Business | 5 000 F | 15 000 F | 60 jours |
| Premium | 10 000 F | 30 000 F | 60 jours |
| Founders | Selon offre | Selon offre | 90 jours |

## ANNEXE E — SERVICES GRATUITS / PAYANTS

| Service | Partenaire | Modèle recommandé |
|---|---|---|
| Compte | Gratuit | Acquisition |
| Page de base | Gratuit | Acquisition |
| Exposition produit | Gratuit | Acquisition |
| Plat du jour | Gratuit / inclus | Acquisition |
| Ticketing | Gratuit à l'entrée | Commission |
| Réservation table | Gratuit au lancement | Commission |
| Réservation salle | Gratuit au lancement | Commission |
| Commande en ligne | Gratuit au lancement | Commission |
| Starter | 2 500 F | Abonnement |
| Business | 5 000 F | Abonnement |
| Premium | 10 000 F | Abonnement |
| Mise en avant | Payant | Promotion |
| Homepage | Payant | Promotion |
| Communication | Payant | Communication |

## ANNEXE F — RÈGLE FINANCIÈRE ESSENTIELLE

**SERVICE DIRECT EVENT VILLAGE** : Prix service → Montant payé par le Client → Frais agrégateur supportés par Event Village → Revenu net Event Village → Parrainage. Exemple : 1 000 F → agrégateur 15 F → Event Village 985 F → parrainage sur 985 F.

**TICKETING** : Prix ticket + Frais service → Montant payé par le Client → Frais agrégateur → Montant organisateur → Revenu net Event Village → Parrainage. Exemple : 1 000 F + 50 F → Client paie 1 050 F → agrégateur 15,75 F → organisateur 1 000 F → Event Village 34,25 F → parrainage sur 34,25 F.

## ANNEXE G — RÈGLE AMBASSADEUR
L'Ambassadeur n'est PAS un rôle. role = CLIENT et referral_status = STANDARD ou AMBASSADEUR. Le Superadministrateur transforme Client standard → Client Ambassadeur sans créer un nouveau type de compte.

## ANNEXE H — ORDRE DE DÉVELOPPEMENT FINAL
1. CADRAGE / UX → 2. SOCLE → 3. MARKETPLACE → 4. ÉVÉNEMENTS + TICKETING → 5. RÉSERVATION TABLES + SALLES → 6. COMMANDE & VENTE → 7. FINANCE → 8. COMMUNICATION → 9. PARRAINAGE → 10. MONÉTISATION → 11. API → 12. ANALYTICS → 13. TESTS → 14. PILOTE → 15. LANCEMENT.

Le parrainage dépend de la finance : transaction → frais → revenu Event Village → revenu net, avant revenu net → commission N1 → commission N2.

---

**VERSION À CONSIDÉRER COMME RÉFÉRENCE** : cette Version 3.0 est la version de référence du cahier des charges Event Village. L'ancien modèle (10 % de la marge du promoteur pendant un an puis 3 % en deuxième génération) est remplacé par la grille V3 : 5/2 %, 7/2 % et conditions renforcées pour les Ambassadeurs.
