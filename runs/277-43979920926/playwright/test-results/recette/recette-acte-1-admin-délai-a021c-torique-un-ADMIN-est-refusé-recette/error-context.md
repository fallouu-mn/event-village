# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé
- Location: e2e/recette.spec.ts:322:5

# Error details

```
Error: lecture seule annoncée

expect(locator).toBeVisible() failed

Locator: getByText(/^lecture seule : seul un superadministrateur peut modifier ces réglages\./i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - lecture seule annoncée getByText(/^lecture seule : seul un superadministrateur peut modifier ces réglages\./i) with timeout 15000ms
  - waiting for getByText(/^lecture seule : seul un superadministrateur peut modifier ces réglages\./i)

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - text: Administration
    - link "Tableau de bord":
      - /url: /admin/dashboard
      - img
      - text: Tableau de bord
    - paragraph: Gestion
    - link "Événements":
      - /url: /admin/events
      - img
      - text: Événements
    - link "Catalogues et services":
      - /url: /admin/services
      - img
      - text: Catalogues et services
    - paragraph: Engagement
    - link "Campagnes":
      - /url: /admin/communications
      - img
      - text: Campagnes
    - paragraph: Système
    - link "Réglages":
      - /url: /admin/finance-settings
      - img
      - text: Réglages
    - link "Notifications":
      - /url: /admin/notifications
      - img
      - text: Notifications
    - link "Mes droits":
      - /url: /admin/mes-droits
      - img
      - text: Mes droits
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Aïda Diallo Administrateur":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 45 non lues": "45"
- main:
  - link "Accueil":
    - /url: /admin/dashboard
  - heading "Réglages de la plateforme" [level=1]
  - paragraph: "Lecture seule : seul un Superadmin peut modifier ces réglages. Chaque modification est historisée et ne s’applique qu’aux opérations futures."
  - button "Actualiser"
  - navigation "Sommaire des réglages":
    - paragraph: Thèmes
    - list:
      - listitem:
        - link "Finance":
          - /url: "#finance"
      - listitem:
        - link "Contrôle d’accès":
          - /url: "#controle"
      - listitem:
        - link "Contact du support":
          - /url: "#support"
      - listitem:
        - link "Notifications et SMS":
          - /url: "#notifications"
      - listitem:
        - link "Services en préparation":
          - /url: "#services"
  - region "Finance":
    - heading "Finance" [level=2]
    - paragraph: Frais, délais de disponibilité des ventes, retraits et commissions.
    - list:
      - listitem:
        - paragraph: Frais de service
        - paragraph: Payés par l’acheteur, arrondis au franc CFA supérieur par billet. De 0 à 50 %.
        - paragraph:
          - text: "Par défaut : 5 % · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 5 %
      - listitem:
        - paragraph: Durée de garde des places pendant un paiement (minutes)
        - paragraph: "Temps pendant lequel les places d’un paiement en attente restent réservées. Le paiement reste valable 1 heure chez SamirPay : validé après l’échéance, il donne les billets s’il reste des places, sinon il est remboursé automatiquement. Entier de 5 à 60."
        - paragraph:
          - text: "Par défaut : 10 min · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 10 min
      - listitem:
        - paragraph: Prix minimum d’un billet payant (F CFA)
        - paragraph: Appliqué à toute catégorie payante créée ou dont le prix change ; un billet gratuit reste à 0. À ajuster quand SamirPay donnera son minimum d’encaissement. Entier de 1 à 100 000.
        - paragraph:
          - text: "Par défaut : 100 F CFA · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 100 F CFA
      - listitem:
        - paragraph: Frais agrégateur Wave
        - paragraph: Coût SamirPay d’un paiement Wave. De 0 à 10 %.
        - paragraph:
          - text: "Par défaut : 1,5 % · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 1,5 %
      - listitem:
        - paragraph: Frais agrégateur Orange Money
        - paragraph: Coût SamirPay d’un paiement Orange Money. De 0 à 10 %.
        - paragraph:
          - text: "Par défaut : 1,5 % · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 1,5 %
      - listitem:
        - paragraph: Frais agrégateur d’une annulation
        - paragraph: Qui supporte les frais agrégateur quand un billet est remboursé.
        - paragraph:
          - text: "Par défaut : Event Village · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Event Village
      - listitem:
        - paragraph: Délai de garde des ventes
        - paragraph: "Désactivé : les ventes sont disponibles dès la confirmation du paiement."
        - paragraph:
          - text: "Par défaut : Activé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:43
        - text: Désactivé
        - status:
          - paragraph: Valeur risquée
          - text: Un partenaire peut retirer avant l’événement ; s’il est annulé, Event Village rembourse sans pouvoir reprendre l’argent.
      - listitem:
        - paragraph: Délai après la fin de l’événement
        - paragraph: Nombre d’heures avant que les ventes deviennent disponibles. De 0 à 720.
        - paragraph:
          - text: "Par défaut : 48 h · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 48 h
      - listitem:
        - paragraph: Frais de retrait
        - paragraph: Arrondis au franc CFA supérieur, déduits du montant versé. De 0 à 10 %.
        - paragraph:
          - text: "Par défaut : 1 % · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 1 %
        - paragraph: "Frais SamirPay constatés sur 90 jours : 0 % (maximum 0 %)."
      - listitem:
        - paragraph: Montant minimum de retrait
        - paragraph: Montant entier en francs CFA.
        - paragraph:
          - text: "Par défaut : 5 000 F CFA · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 5 000 F CFA
      - listitem:
        - paragraph: Retraits par virement bancaire
        - paragraph: Tant qu’il est désactivé, seuls Wave et Orange Money sont proposés.
        - paragraph:
          - text: "Par défaut : Désactivé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Désactivé
      - listitem:
        - paragraph: Délai de validation des commissions
        - paragraph: Jours avant qu’une commission de parrainage devienne disponible. De 7 à 14.
        - paragraph:
          - text: "Par défaut : 7 jours · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 7 jours
      - listitem:
        - paragraph: Réserve de prudence
        - paragraph: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Elle est déduite de « Retirable par Event Village ». Automatique : les encaissements des 3 derniers jours. Montant fixe : le montant du réglage suivant."
        - paragraph:
          - text: "Par défaut : Automatique : encaissements des 3 derniers jours · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: "Automatique : encaissements des 3 derniers jours"
      - listitem:
        - paragraph: Montant fixe de la réserve de prudence
        - paragraph: Lu seulement quand la réserve est « Montant fixe ». Entier de 0 à 1 000 000 000 F CFA.
        - paragraph:
          - text: "Par défaut : 0 F CFA · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 0 F CFA
  - region "Contrôle d’accès":
    - heading "Contrôle d’accès" [level=2]
    - paragraph: Fenêtre de scan, saisie manuelle des numéros de billet, vente au guichet, seuil de stock affiché au public et alerte de refus à une porte.
    - list:
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: Heures avant le début de l’événement à partir desquelles les billets peuvent être scannés. De 0 à 48.
        - paragraph:
          - text: "Par défaut : 6 h · Modifié le"
          - time: mar. 17 nov. 2026 à 00:43
        - text: 24 h
      - listitem:
        - paragraph: Fermeture du contrôle après la fin
        - paragraph: Heures après la fin de l’événement pendant lesquelles les billets peuvent encore être scannés. De 0 à 48.
        - paragraph:
          - text: "Par défaut : 6 h · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 6 h
      - listitem:
        - paragraph: Saisie manuelle d’un numéro de billet
        - paragraph: Qui peut valider un billet par son numéro, toujours après vérification de la pièce d’identité.
        - paragraph:
          - text: "Par défaut : Contrôleur affecté seul · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Contrôleur affecté seul
      - listitem:
        - paragraph: Vente au guichet en espèces
        - paragraph: Un contrôleur autorisé à encaisser, avec une caisse ouverte, vend des billets au prix facial, sans frais.
        - paragraph:
          - text: "Par défaut : Activé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Activé
      - listitem:
        - paragraph: Seuil « bientôt complet »
        - paragraph: Quand il reste ce nombre de places ou moins dans une catégorie, la page publique affiche le restant ; au-delà, seulement « disponible ». Entier de 1 à 1000.
        - paragraph:
          - text: "Par défaut : 10 places · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 10 places
      - listitem:
        - paragraph: "Alerte de refus à une porte : nombre de refus"
        - paragraph: Quand une porte enregistre ce nombre de refus ou plus pendant la durée observée, l’organisateur reçoit une alerte, au plus une fois par porte et par durée. Comptent les billets invalides, déjà utilisés, annulés, remboursés, d’un autre événement, en attente de transfert, présentés dans la mauvaise zone ou pas encore entrés ; pas les refus liés au téléphone ou aux droits du contrôleur, à l’encaissement ni aux horaires de l’événement. Entier de 3 à 500.
        - paragraph:
          - text: "Par défaut : 10 refus · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 10 refus
      - listitem:
        - paragraph: "Alerte de refus à une porte : durée observée"
        - paragraph: Durée pendant laquelle les refus d’une même porte sont comptés pour l’alerte. Entier de 1 à 60.
        - paragraph:
          - text: "Par défaut : 5 min · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 5 min
  - region "Contact du support":
    - heading "Contact du support" [level=2]
    - paragraph: Moyens de joindre le support, affichés sur la page publique Aide et dans les messages de sécurité. Au moins un est exigé avant une séance réelle.
    - list:
      - listitem:
        - paragraph: Numéro WhatsApp du support
        - paragraph: Format international, par exemple +221771234567. Laissez vide si aucun. Au moins un moyen de contact est exigé avant une séance réelle.
        - paragraph:
          - text: "Par défaut : Non renseigné · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Non renseigné
      - listitem:
        - paragraph: Téléphone du support
        - paragraph: Format international, par exemple +221338000000. Laissez vide si aucun.
        - paragraph:
          - text: "Par défaut : Non renseigné · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Non renseigné
      - listitem:
        - paragraph: Email du support
        - paragraph: Adresse lue par l’équipe du support. Laissez vide si aucune.
        - paragraph:
          - text: "Par défaut : Non renseigné · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Non renseigné
  - region "Notifications":
    - heading "Notifications" [level=2]
    - paragraph: Rappels la veille et avant le début, SMS des rappels, plage de nuit sans SMS, plafond quotidien des SMS optionnels, alerte sur les SMS indispensables et rappels des billets gratuits.
    - list:
      - listitem:
        - paragraph: Rappel la veille
        - paragraph: Rappel envoyé la veille du début aux porteurs d’un billet valable de l’événement en ligne.
        - paragraph:
          - text: "Par défaut : Activé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Activé
      - listitem:
        - paragraph: Heure du rappel de la veille
        - paragraph: Heure de Dakar à laquelle part le rappel de la veille. De 6 à 20.
        - paragraph:
          - text: "Par défaut : 10 h · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 10 h
      - listitem:
        - paragraph: Rappel avant le début
        - paragraph: Rappel envoyé quelques heures avant le début, avec le conseil d’ouvrir son billet avant d’arriver.
        - paragraph:
          - text: "Par défaut : Activé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Activé
      - listitem:
        - paragraph: Heures avant le début
        - paragraph: Nombre d’heures entre le rappel et le début de l’événement. De 1 à 12.
        - paragraph:
          - text: "Par défaut : 3 h · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 3 h
      - listitem:
        - paragraph: SMS du rappel de la veille
        - paragraph: Envoi du SMS en plus de l’application et des notifications push.
        - paragraph:
          - text: "Par défaut : Toujours · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Toujours
        - status:
          - paragraph: Valeur risquée
          - text: Un SMS facturé par détenteur et par événement.
      - listitem:
        - paragraph: SMS du rappel avant le début
        - paragraph: Envoi du SMS en plus de l’application et des notifications push.
        - paragraph:
          - text: "Par défaut : Seulement sans notification push · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Seulement sans notification push
      - listitem:
        - paragraph: Début de la plage sans SMS
        - paragraph: Heure de Dakar à partir de laquelle aucun SMS optionnel ne part ; le rappel passe alors par les autres canaux. De 0 à 23.
        - paragraph:
          - text: "Par défaut : 22 h · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 22 h
      - listitem:
        - paragraph: Fin de la plage sans SMS
        - paragraph: Heure de Dakar de fin de la plage. Un début égal à la fin supprime la plage. De 0 à 23.
        - paragraph:
          - text: "Par défaut : 8 h · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 8 h
      - listitem:
        - paragraph: Plafond quotidien des SMS optionnels
        - paragraph: "Nombre maximal de SMS optionnels (rappels, annonces, signaux aux professionnels) envoyés par jour de Dakar ; au-delà, ils partent sans SMS, par l’application et les notifications push. Les SMS indispensables (achat, transfert, annulation, remboursement, sécurité du compte) ne sont jamais plafonnés. Les administrateurs sont alertés à 80 %. De 0 à 1 000 000 ; 0 : aucun SMS optionnel."
        - paragraph:
          - text: "Par défaut : 700 SMS · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 700 SMS
      - listitem:
        - paragraph: Seuil d’alerte des SMS indispensables du jour
        - paragraph: "Nombre de SMS indispensables envoyés dans la journée de Dakar à partir duquel les administrateurs sont alertés, une fois par jour. Ces SMS ne sont jamais plafonnés : le seuil sert à repérer un volume anormal. De 1 à 1 000 000."
        - paragraph:
          - text: "Par défaut : 2 000 SMS · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: 2 000 SMS
      - listitem:
        - paragraph: SMS des rappels pour les billets gratuits
        - paragraph: Pour un porteur qui ne détient que des billets gratuits ou des invitations de l’événement. Les rappels arrivent toujours dans l’application et en notification push.
        - paragraph:
          - text: "Par défaut : Jamais · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Jamais
  - region "Services en préparation":
    - heading "Services en préparation" [level=2]
    - paragraph: "Pas prêt pour le public : ces services ne sont pas encore vérifiés pour les paiements. Un service désactivé n’est ni visible ni utilisable par les clients et les partenaires. Pour en activer un, tapez ACTIVER."
    - list:
      - listitem:
        - paragraph: Salles de fête
        - paragraph: Pas prêt pour le public
        - paragraph: "Réservation de salles par les clients et gestion des salles par les partenaires. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent."
        - paragraph:
          - text: "Par défaut : Désactivé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Désactivé
      - listitem:
        - paragraph: Réservation de tables
        - paragraph: Pas prêt pour le public
        - paragraph: "Réservation de tables dans les restaurants et gestion des tables par les partenaires. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent."
        - paragraph:
          - text: "Par défaut : Désactivé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Désactivé
      - listitem:
        - paragraph: Commandes de repas
        - paragraph: Pas prêt pour le public
        - paragraph: "Menus, produits et commandes de repas. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent. Les achats de billets ne sont pas concernés."
        - paragraph:
          - text: "Par défaut : Désactivé · Modifié le"
          - time: mar. 17 nov. 2026 à 00:12
        - text: Désactivé
  - region "Historique des modifications":
    - heading "Historique des modifications" [level=2]
    - list:
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:43
          - text: "· Par Elhadji SuperAdmin · Motif : Recette 00.43.30 : contrôle ouvert la veille"
      - listitem:
        - paragraph: Délai de garde des ventes
        - paragraph: Activé devient Désactivé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:43
          - text: "· Par Elhadji SuperAdmin · Motif : Recette 00.43.30 : fonds disponibles dès le paiement"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : ecart de caisse"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : renvoi seulement"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : taille du lot"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : plein ecran"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : barre achat"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:40
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:39
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : reprise de session"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:39
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:39
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : camera en arriere-plan"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:39
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:39
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : vibrations"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:39
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : mesure du scan"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : idempotence"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : cache sans api"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : écart -5 min"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : écart +5 min"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 24 h devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:38
          - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: 6 h devient 24 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:37
          - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : fumee prolongee"
      - listitem:
        - paragraph: Montant fixe de la réserve de prudence
        - paragraph: — devient 0 F CFA
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Réserve de prudence
        - paragraph: "— devient Automatique : encaissements des 3 derniers jours"
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Numéro WhatsApp du support
        - paragraph: — devient Non renseigné
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Téléphone du support
        - paragraph: — devient Non renseigné
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Email du support
        - paragraph: — devient Non renseigné
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: "Alerte de refus à une porte : durée observée"
        - paragraph: — devient 5 min
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: "Alerte de refus à une porte : nombre de refus"
        - paragraph: — devient 10 refus
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Seuil d’alerte des SMS indispensables du jour
        - paragraph: — devient 2 000 SMS
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Prix minimum d’un billet payant (F CFA)
        - paragraph: — devient 100 F CFA
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Durée de garde des places pendant un paiement (minutes)
        - paragraph: — devient 10 min
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Plafond quotidien des SMS optionnels
        - paragraph: — devient 700 SMS
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: SMS des rappels pour les billets gratuits
        - paragraph: — devient Jamais
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Réglage retiré ou sans libellé
        - paragraph: 2 000 devient —
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: "· Par Automatique · Motif : suppression"
      - listitem:
        - paragraph: Commandes de repas
        - paragraph: — devient Désactivé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Réservation de tables
        - paragraph: — devient Désactivé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Salles de fête
        - paragraph: — devient Désactivé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Heures avant le début
        - paragraph: — devient 3 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Réglage retiré ou sans libellé
        - paragraph: — devient 2 000
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Fin de la plage sans SMS
        - paragraph: — devient 8 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Début de la plage sans SMS
        - paragraph: — devient 22 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: SMS du rappel avant le début
        - paragraph: — devient Seulement sans notification push
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: SMS du rappel de la veille
        - paragraph: — devient Toujours
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Rappel avant le début
        - paragraph: — devient Activé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Heure du rappel de la veille
        - paragraph: — devient 10 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Rappel la veille
        - paragraph: — devient Activé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Seuil « bientôt complet »
        - paragraph: — devient 10 places
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Saisie manuelle d’un numéro de billet
        - paragraph: — devient Contrôleur affecté seul
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Vente au guichet en espèces
        - paragraph: — devient Activé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Fermeture du contrôle après la fin
        - paragraph: — devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Ouverture du contrôle avant le début
        - paragraph: — devient 6 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Délai après la fin de l’événement
        - paragraph: — devient 48 h
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Délai de garde des ventes
        - paragraph: — devient Activé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Frais de service
        - paragraph: — devient 5 %
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Frais agrégateur d’une annulation
        - paragraph: — devient Event Village
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Frais agrégateur Orange Money
        - paragraph: — devient 1,5 %
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Frais agrégateur Wave
        - paragraph: — devient 1,5 %
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Délai de validation des commissions
        - paragraph: — devient 7 jours
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Retraits par virement bancaire
        - paragraph: — devient Désactivé
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Montant minimum de retrait
        - paragraph: — devient 5 000 F CFA
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
      - listitem:
        - paragraph: Frais de retrait
        - paragraph: — devient 1 %
        - paragraph:
          - time: mar. 17 nov. 2026 à 00:12
          - text: · Par Automatique
- alert
```

# Test source

```ts
  253 |     const { data, error } = await serviceClient().from('tickets').select('id').eq('event_id', eventId).eq('user_id', userId).eq('category_id', categoryId).order('ticket_number');
  254 |     if (error) throw new Error(`[e2e] billets de ${userId} : ${error.message}`);
  255 |     return (data ?? []).map((t) => String(t.id));
  256 | }
  257 | 
  258 | async function ticketStatus(id: string): Promise<string> {
  259 |     const { data, error } = await serviceClient().from('tickets').select('status').eq('id', id).single();
  260 |     if (error || !data) throw new Error(`[e2e] billet ${id} : ${error?.message ?? 'introuvable'}`);
  261 |     return String(data.status);
  262 | }
  263 | 
  264 | /** Plein écran du résultat refermé : le scanner reçoit de nouveau les gestes. */
  265 | async function resultClosed(page: Page): Promise<void> {
  266 |     await expect(page.locator('[data-scan-state="result"]'), 'plein écran du résultat refermé').toHaveCount(0, { timeout: 20_000 });
  267 | }
  268 | 
  269 | async function expectScan(page: Page, payload: string, what: string, expected: string): Promise<void> {
  270 |     const { record } = await presentPayload(page, payload, what);
  271 |     await expect(page.locator(`[data-scan-result="${expected}"]`).first(), `${what} : « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  272 |     await resultClosed(page);
  273 | }
  274 | 
  275 | async function videoPlaying(page: Page, what: string): Promise<void> {
  276 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  277 |         .catch((err: unknown) => {
  278 |             throw new Error(`${what} : aucun flux vidéo en lecture (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  279 |         });
  280 | }
  281 | 
  282 | /** Remboursement unitaire à l'écran (A4) : recherche, motif, confirmation ; le POST ne part que de la seconde étape. */
  283 | async function refundOnScreen(page: Page, ticketNumber: string, reason: string, expectedNotice: RegExp): Promise<void> {
  284 |     await page.goto(`/partner/events/${r.e1.id}`);
  285 |     await openTab(page, /^ventes/i);
  286 |     await page.getByLabel(/^numéro du billet/i).fill(ticketNumber);
  287 |     await expectRoute(page, 'GET', /\/tickets\/lookup$/, () => page.getByRole('button', { name: /^rechercher le billet$/i }).click(), 200, `recherche du billet ${ticketNumber}`);
  288 |     await page.getByRole('button', { name: /^rembourser ce billet$/i }).click();
  289 |     const reasonDialog = page.getByRole('dialog', { name: /^motif du remboursement$/i });
  290 |     await expect(reasonDialog).toBeVisible();
  291 |     await reasonDialog.getByRole('textbox').fill(reason);
  292 |     await reasonDialog.getByRole('button', { name: /^continuer$/i }).click();
  293 |     const confirm = page.getByRole('alertdialog', { name: /^confirmer le remboursement/i });
  294 |     await expect(confirm).toBeVisible();
  295 |     await expect(confirm.getByText(reason), 'motif rappelé dans la confirmation').toBeVisible();
  296 |     await expect(confirm.getByRole('button', { name: /^revenir à la fiche$/i })).toBeVisible();
  297 |     await expectRoute(page, 'POST', /\/tickets\/[^/]+\/refund$/, () => confirm.getByRole('button', { name: /^rembourser le client$/i }).click(), 200, `remboursement du billet ${ticketNumber}`);
  298 |     await expect(page.getByText(expectedNotice).first(), `issue du remboursement du billet ${ticketNumber}`).toBeVisible();
  299 | }
  300 | 
  301 | test.beforeAll(() => {
  302 |     e2eConfig();
  303 | });
  304 | 
  305 | test.afterAll(async () => {
  306 |     const problems: string[] = [];
  307 |     const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  308 |     for (const [key, value] of Array.from(previousSettings.entries())) {
  309 |         await restoreSetting(key, value, superadminId).catch((err: unknown) => problems.push(err instanceof Error ? err.message : String(err)));
  310 |     }
  311 |     const balance = await fakeServices('/__test/samirpay/balance', { solde: FAKE_BALANCE })
  312 |         .catch((err: unknown) => ({ status: 0, json: { error: err instanceof Error ? err.message : String(err) } }));
  313 |     if (balance.status !== 200) problems.push(`solde du faux SamirPay non rétabli : ${JSON.stringify(balance)}`);
  314 |     for (const { who, guard } of opened) {
  315 |         const seen = [...guard.blockingIssues(), ...guard.nonBlockingIssues()];
  316 |         if (seen.length > 0) console.log(`[e2e][recette] ${who} — observations du navigateur (non bloquantes) :\n${seen.join('\n')}`);
  317 |     }
  318 |     for (const c of Array.from(new Set(opened.map((o) => o.context)))) await c.close();
  319 |     if (problems.length > 0) throw new Error(`[e2e][recette] remise en état incomplète :\n${problems.join('\n')}`);
  320 | });
  321 | 
  322 | test('acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé', async ({ browser }, testInfo) => {
  323 |     for (const key of [HOLD_KEY, SCAN_WINDOW_KEY]) previousSettings.set(key, await settingValue(key));
  324 |     const page = await asRole(browser, testInfo, 'fumee-superadmin');
  325 |     const hold = 'Délai de garde des ventes';
  326 |     const holdReason = `Recette ${STAMP} : fonds disponibles dès le paiement`;
  327 | 
  328 |     await test.step('motif exigé, puis réglage enregistré et historisé', async () => {
  329 |         await page.goto('/admin/finance-settings');
  330 |         const row = settingRow(page, hold);
  331 |         await row.getByRole('button', { name: `Modifier ${hold}` }).click();
  332 |         await row.getByLabel(/^nouvelle valeur/i).selectOption('false');
  333 |         await row.getByRole('button', { name: /^vérifier et enregistrer$/i }).click();
  334 |         await expect(row.getByText(/indiquez le motif/i), 'sans motif, rien n’est envoyé').toBeVisible();
  335 |         await row.getByRole('button', { name: /^annuler$/i }).click();
  336 | 
  337 |         const edited = await editSetting(page, hold, (l) => l.getByLabel(/^nouvelle valeur/i).selectOption('false'), holdReason);
  338 |         await saveSetting(page, hold, edited, 'Désactivé');
  339 |         await expect(page.getByRole('listitem').filter({ hasText: holdReason }), 'motif dans l’historique des modifications').toBeVisible();
  340 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} en base`).toBe(false);
  341 |     });
  342 | 
  343 |     await test.step('fenêtre de scan portée à 24 h (billet et contrôle de la veille)', async () => {
  344 |         const label = 'Ouverture du contrôle avant le début';
  345 |         const row = await editSetting(page, label, (l) => l.getByLabel(/^nouvelle valeur/i).fill('24'), `Recette ${STAMP} : contrôle ouvert la veille`);
  346 |         await saveSetting(page, label, row, '24 h');
  347 |         expect(await settingValue(SCAN_WINDOW_KEY), `${SCAN_WINDOW_KEY} en base`).toBe(24);
  348 |     });
  349 | 
  350 |     await test.step('un ADMIN lit les réglages sans « Modifier » (R51), sa modification envoyée directement est refusée', async () => {
  351 |         const admin = await asRole(browser, testInfo, 'admin');
  352 |         await admin.goto('/admin/finance-settings');
> 353 |         await expect(admin.getByText(/^lecture seule : seul un superadministrateur peut modifier ces réglages\./i), 'lecture seule annoncée').toBeVisible();
      |                                                                                                                                               ^ Error: lecture seule annoncée
  354 |         await expect(settingRow(admin, hold).getByText('Désactivé', { exact: true }), 'réglage lu par un ADMIN').toBeVisible();
  355 |         await expect(admin.getByRole('button', { name: /^modifier /i }), 'aucun bouton « Modifier » sans le droit (R51, B34)').toHaveCount(0);
  356 |         // Le serveur reste juge : la même modification envoyée sans l'écran est refusée
  357 |         const status = await admin.evaluate(async (key) => {
  358 |             const res = await fetch('/api/admin/finance-settings', {
  359 |                 method: 'PUT', headers: { 'Content-Type': 'application/json' },
  360 |                 body: JSON.stringify({ key, value: true, reason: 'Tentative d’un ADMIN sans le droit' }),
  361 |             });
  362 |             return res.status;
  363 |         }, HOLD_KEY);
  364 |         expect(status, 'modification par un ADMIN').toBe(403);
  365 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} inchangé après le refus`).toBe(false);
  366 |     });
  367 | });
  368 | 
  369 | test('acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2', async ({ browser }, testInfo) => {
  370 |     const partner = await asNew(browser, testInfo, 'P1');
  371 |     const admin = await asRole(browser, testInfo, 'fumee-superadmin');
  372 | 
  373 |     await test.step('inscription du partenaire : formulaire, 2 pièces, code SMS', async () => {
  374 |         await partner.goto('/partner/register');
  375 |         await partner.locator('#partenaire-raison-sociale').fill(r.p1.company);
  376 |         await partner.locator('#partenaire-description').fill('Organisateur de la recette de la billetterie. Données fictives.');
  377 |         await partner.locator('#partenaire-adresse').fill('12, route de la Corniche, Ngor');
  378 |         await partner.locator('#partenaire-ville').fill('Dakar');
  379 |         await partner.locator('#partenaire-prenom').fill(r.p1.firstName);
  380 |         await partner.locator('#partenaire-nom').fill('Recette');
  381 |         await partner.locator('#partenaire-telephone').fill(r.p1.local);
  382 |         await partner.locator('#partenaire-email').fill(r.p1.email);
  383 |         await partner.locator('#partenaire-mot-de-passe').fill(TEST_PASSWORD);
  384 |         await partner.locator('#partenaire-confirmation').fill(TEST_PASSWORD);
  385 |         await partner.locator('#partenaire-piece-identite').setInputFiles(pdfDocument('piece-identite.pdf'));
  386 |         await partner.locator('#partenaire-document-entreprise').setInputFiles(pdfDocument('rccm.pdf'));
  387 |         const seen = await smsSeen(r.p1.phone);
  388 |         // Lot 9 bis (R53, B40) : appel 1, code envoyé, rien n'est créé tant que le code n'est pas saisi
  389 |         await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^envoyer mon dossier$/i }).click(), 200, 'dossier, appel 1 : envoi du code');
  390 |         await expect(partner.getByRole('heading', { name: /^vérifiez votre numéro$/i })).toBeVisible();
  391 |         const { data: early, error: earlyErr } = await serviceClient().from('users').select('id').in('phone', [r.p1.phone, r.p1.phone.slice(1)]);
  392 |         if (earlyErr) throw new Error(`[e2e] compte de P1 avant le code : ${earlyErr.message}`);
  393 |         expect(early ?? [], 'aucun compte créé avant le code (R53)').toEqual([]);
  394 |         await fillOtp(partner, await smsCode(r.p1.phone, seen, 'inscription du partenaire'));
  395 |         await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^vérifier le code$/i }).click(), 201, 'dossier, appel 2 : compte et fiche créés');
  396 |         await expect(partner.getByRole('heading', { name: /^dossier reçu$/i })).toBeVisible();
  397 |     });
  398 | 
  399 |     await test.step('R7 : espace partenaire en attente, « Compte en cours de vérification » avant la validation', async () => {
  400 |         await partner.getByRole('button', { name: /^ouvrir mon espace partenaire$/i }).click();
  401 |         await partner.waitForURL(/\/partner\/dashboard/, { timeout: 30_000 });
  402 |         await expect(partner.getByText('Compte en cours de vérification', { exact: true }).first(), 'bandeau du compte en attente (R7)').toBeVisible();
  403 |         // Session de l'inscription refermée : la connexion de P1 par son numéro est prouvée après la validation
  404 |         await partner.context().clearCookies();
  405 |     });
  406 | 
  407 |     await test.step('validation par le SUPERADMIN, après consultation d’une pièce', async () => {
  408 |         await admin.goto('/admin/dashboard');
  409 |         await openTab(admin, /^en attente/i);
  410 |         const row = admin.locator('tr').filter({ hasText: r.p1.company });
  411 |         await row.getByRole('button', { name: /^dossier$/i }).click();
  412 |         const details = admin.getByRole('dialog', { name: /^dossier du partenaire/i });
  413 |         await expect(details).toBeVisible();
  414 |         const signed = await expectRoute(admin, 'GET', '/api/partner/documents/signed-url',
  415 |             () => details.getByRole('button', { name: /^ouvrir la pièce d’identité/i }).click(), 200, 'lien de consultation de la pièce d’identité');
  416 |         expect(typeof signed.signedUrl, 'URL signée de la pièce').toBe('string');
  417 |         const file = await fetch(String(signed.signedUrl));
  418 |         expect(file.status, 'pièce lue par son URL signée').toBe(200);
  419 |         expect((await file.text()).startsWith('%PDF-'), 'pièce d’identité : le fichier déposé').toBe(true);
  420 |         await details.getByRole('button', { name: /^valider la candidature$/i }).click();
  421 |         const validation = admin.getByRole('alertdialog', { name: /^valider la candidature/i });
  422 |         await expectRoute(admin, 'PATCH', /^\/api\/admin\/partners\/[^/]+\/status$/, () => validation.getByRole('button', { name: /^valider la candidature$/i }).click(), 200, 'validation de la candidature');
  423 |         await expect(row, 'candidature sortie de la file').toHaveCount(0);
  424 |     });
  425 | 
  426 |     await test.step('P1 se connecte, crée E1 : affiche, programme, infos pratiques, 4 catégories et leurs canaux', async () => {
  427 |         // Lot 9 bis (R87) : l'adresse saisie attend sa vérification, P1 se connecte par son numéro
  428 |         await signIn(partner, r.p1.local, /^\/partner(\/|$)/);
  429 |         r.p1.userId = await userIdByPhone(r.p1.phone);
  430 | 
  431 |         const start = new Date(Date.now() + 20 * 3600_000);
  432 |         start.setUTCSeconds(0, 0);
  433 |         start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
  434 |         const s = dakarParts(start);
  435 |         const e = dakarParts(new Date(start.getTime() + 4 * 3600_000));
  436 |         await partner.goto('/partner/events/new');
  437 |         await partner.getByLabel(/^titre/i).fill(r.e1.title);
  438 |         await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
  439 |         await partner.getByLabel(/^description/i).fill('Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives.');
  440 |         await partner.getByLabel(/date de début/i).fill(s.date);
  441 |         await partner.getByLabel(/heure de début/i).fill(s.time);
  442 |         await partner.getByLabel(/date de fin/i).fill(e.date);
  443 |         await partner.getByLabel(/heure de fin/i).fill(e.time);
  444 |         await partner.getByLabel(/^lieu/i).fill('Corniche de Ngor');
  445 |         await partner.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
  446 |         await partner.getByLabel(/capacité/i).fill('100');
  447 |         const upload = partner.waitForResponse((res) => res.url().includes('/api/partner/upload') && res.request().method() === 'POST');
  448 |         await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-recette.png', mimeType: 'image/png', buffer: await posterPng(partner, 'Nuit de Ngor', `${s.date} · ${s.time}`) });
  449 |         expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);
  450 | 
  451 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  452 |         await expect(partner.getByRole('heading', { level: 2, name: /^programme$/i })).toBeVisible();
  453 |         await partner.getByRole('button', { name: /^ajouter une ligne$/i }).click();
```