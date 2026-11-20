# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · admin >> admin-notifications — Administration — supervision des notifications (liste filtrable, compteurs)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: gabarit du champ de date, lu par CDP (8.2 t)

expect(received).toBe(expected) // Object.is equality

Expected: "dd/mm/yyyy"
Received: "mm/dd/yyyy"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Event Village
      - navigation "Navigation principale" [ref=e9]:
        - generic [ref=e10]: Administration
        - link "Tableau de bord" [ref=e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e22]:
          - paragraph [ref=e23]: Gestion
          - generic [ref=e24]:
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Catalogues et services" [ref=e29] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e35]:
          - paragraph [ref=e36]: Engagement
          - link "Campagnes" [ref=e38] [cursor=pointer]:
            - /url: /admin/communications
        - generic [ref=e43]:
          - paragraph [ref=e44]: Système
          - generic [ref=e45]:
            - link "Réglages" [ref=e46] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Notifications" [ref=e51] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Mes droits" [ref=e58] [cursor=pointer]:
              - /url: /admin/mes-droits
        - link "Retour au site" [ref=e64] [cursor=pointer]:
          - /url: /
      - generic [ref=e69]:
        - link "Aïda Diallo Administrateur" [ref=e70] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e71]: AD
          - generic [ref=e72]:
            - generic [ref=e73]: Aïda Diallo
            - generic [ref=e74]: Administrateur
        - generic [ref=e75]:
          - button "Se déconnecter" [ref=e76] [cursor=pointer]
          - button "Basculer le thème" [ref=e81] [cursor=pointer]
    - generic [ref=e85]:
      - banner [ref=e86]:
        - link "Rechercher un événement…" [ref=e88] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 40 non lues" [ref=e95] [cursor=pointer]:
          - generic [ref=e99]: "40"
      - main [ref=e100]:
        - generic [ref=e102]:
          - generic [ref=e105]:
            - status [ref=e107]: En direct
            - heading "Notifications" [level=1] [ref=e109]
            - paragraph [ref=e110]: "Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar."
          - region [ref=e111]:
            - heading "Compteurs" [level=2] [ref=e112]
            - generic [ref=e113]:
              - generic [ref=e114]:
                - paragraph [ref=e116]: SMS aujourd'hui
                - paragraph [ref=e120]: "245"
                - paragraph [ref=e121]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=e122]:
                - paragraph [ref=e124]: SMS optionnels aujourd'hui
                - paragraph [ref=e129]: "20"
                - paragraph [ref=e130]: "Plafond : 20 000 par jour, alerte à 16 000."
              - generic [ref=e131]:
                - paragraph [ref=e133]: SMS ce mois-ci
                - paragraph [ref=e140]: "245"
                - paragraph [ref=e141]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=e142]:
            - heading "Envois" [level=2] [ref=e143]
            - tablist "Filtrer par statut" [ref=e146]:
              - tab "Toutes" [selected] [ref=e147] [cursor=pointer]
              - tab "En attente , 184" [ref=e149] [cursor=pointer]:
                - generic [ref=e150]: En attente
                - generic [ref=e151]:
                  - generic [ref=e152]: ","
                  - text: "184"
              - tab "En cours d'envoi , 0" [ref=e153] [cursor=pointer]:
                - generic [ref=e154]: En cours d'envoi
                - generic [ref=e155]:
                  - generic [ref=e156]: ","
                  - text: "0"
              - tab "Envoyée , 622" [ref=e157] [cursor=pointer]:
                - generic [ref=e158]: Envoyée
                - generic [ref=e159]:
                  - generic [ref=e160]: ","
                  - text: "622"
              - tab "En échec , 1" [ref=e161] [cursor=pointer]:
                - generic [ref=e162]: En échec
                - generic [ref=e163]:
                  - generic [ref=e164]: ","
                  - text: "1"
              - tab "Non envoyée , 757" [ref=e165] [cursor=pointer]:
                - generic [ref=e166]: Non envoyée
                - generic [ref=e167]:
                  - generic [ref=e168]: ","
                  - text: "757"
              - tab "Annulée , 9" [ref=e169] [cursor=pointer]:
                - generic [ref=e170]: Annulée
                - generic [ref=e171]:
                  - generic [ref=e172]: ","
                  - text: "9"
              - tab "Incertaine , 1" [ref=e173] [cursor=pointer]:
                - generic [ref=e174]: Incertaine
                - generic [ref=e175]:
                  - generic [ref=e176]: ","
                  - text: "1"
            - search [ref=e177]:
              - generic [ref=e178]:
                - generic [ref=e179]: Rechercher
                - searchbox "Rechercher" [ref=e181]
              - generic [ref=e182]:
                - generic [ref=e183]: Canal
                - combobox "Canal" [ref=e186] [cursor=pointer]:
                  - option "Tous les canaux" [selected]
                  - option "Application"
                  - option "SMS"
                  - option "Email"
                  - option "Notification push"
              - generic [ref=e187]:
                - generic [ref=e188]: Type
                - combobox "Type" [ref=e191] [cursor=pointer]:
                  - option "Tous les types" [selected]
                  - option "Abonnement activé"
                  - option "Absence à une réservation de table"
                  - option "Acompte de table non payé à temps"
                  - option "Adresse email ajoutée au compte"
                  - option "Adresse email validée par un autre compte"
                  - option "Affectation de contrôle"
                  - option "Affectation de contrôle retirée"
                  - option "Bienvenue à l’entrée"
                  - option "Billet ou invitation annulé"
                  - option "Billet reçu"
                  - option "Billet transféré"
                  - option "Billet transféré annulé (détenteur)"
                  - option "Billets gratuits confirmés"
                  - option "Caisse encore ouverte à la fin"
                  - option "Caisse fermée par un tiers"
                  - option "Catégorie complète"
                  - option "Code administrateur"
                  - option "Code au nouveau numéro d’un administrateur"
                  - option "Code d'inscription"
                  - option "Code de changement de numéro"
                  - option "Code de confirmation de retrait"
                  - option "Code de connexion"
                  - option "Code de connexion (authentification)"
                  - option "Code de réinitialisation du mot de passe"
                  - option "Code de secours utilisé (alerte)"
                  - 'option "Codes d’inscription : part du jour atteinte"'
                  - option "Compte de contrôle activé"
                  - option "Compte partenaire réactivé"
                  - option "Compte partenaire suspendu"
                  - option "Compte partenaire validé"
                  - option "Compte réactivé"
                  - option "Compte suspendu"
                  - option "Confirmation d’achat"
                  - option "Contrôle annulé"
                  - option "Contrôle modifié"
                  - option "Contrôleur devenu administrateur"
                  - option "Créance sur un compte"
                  - option "Décision sur un établissement"
                  - option "Décision sur une salle"
                  - option "Délai de paiement d’une réservation de salle dépassé"
                  - option "Demande de table à accepter"
                  - option "Demande de table envoyée"
                  - option "Demande de table refusée"
                  - option "Demande de table sans réponse"
                  - option "Demande partenaire refusée"
                  - option "Dossier partenaire complété"
                  - option "Droits d’administration modifiés"
                  - option "Droits d’un administrateur modifiés (super-administrateurs)"
                  - option "Écart de caisse"
                  - option "Entrée validée"
                  - option "Espèces marquées rendues par l’administration"
                  - option "Essais de connexion échoués"
                  - option "Établissement à valider"
                  - option "Événement à valider"
                  - option "Événement annulé"
                  - option "Événement annulé par l'administration"
                  - option "Événement annulé par l'organisateur"
                  - option "Événement clos par l'administration"
                  - option "Événement complet"
                  - option "Événement de nouveau en ligne (porteurs)"
                  - option "Événement envoyé en validation"
                  - option "Événement modifié"
                  - option "Événement modifié après validation"
                  - option "Événement non validé"
                  - option "Événement publié par l'administration"
                  - option "Événement publié par l’organisateur"
                  - option "Événement réactivé"
                  - option "Événement suspendu"
                  - option "Événement suspendu (porteurs)"
                  - option "Événement suspendu clos (porteurs)"
                  - option "Événement terminé"
                  - option "Événement validé"
                  - option "Inscription partenaire reçue"
                  - option "Invitation à contrôler l’entrée"
                  - option "Invitation d'un contrôleur"
                  - option "Invitation de contrôleur acceptée"
                  - option "Invitation de contrôleur refusée"
                  - option "Invitation de contrôleur sans réponse"
                  - option "Invitation reçue"
                  - option "Lien d'activation d'un compte"
                  - option "Lien de vérification de l'adresse email"
                  - option "Merci du lendemain"
                  - option "Mise en avant décidée"
                  - option "Mot de passe modifié"
                  - option "Notification d'essai"
                  - option "Notification en échec"
                  - option "Nouveau super-administrateur (alerte)"
                  - option "Nouvelle candidature partenaire"
                  - option "Nouvelle commande"
                  - option "Nouvelle réservation de salle"
                  - option "Nouvelle réservation de table"
                  - option "Numéro d’un administrateur confirmé (nouveau numéro)"
                  - option "Numéro d’un administrateur remplacé (ancien numéro)"
                  - option "Numéro de téléphone modifié"
                  - option "Paiement confirmé"
                  - option "Paiement de salle remboursé"
                  - option "Paiement de table remboursé"
                  - option "Paiement en double remboursé"
                  - option "Période d'essai activée"
                  - option "Plafond de SMS atteint"
                  - option "Premier billet vendu"
                  - option "Quota de SMS hors codes atteint"
                  - option "Rappel avant le début"
                  - option "Rappel de contrôle la veille"
                  - option "Rappel de réservation de table"
                  - option "Rappel du solde d’une réservation de salle"
                  - option "Rappel la veille"
                  - option "Rappel la veille d’une réservation de salle"
                  - option "Rappels de demain au-delà du budget SMS"
                  - option "Rapport de clôture prêt"
                  - option "Recettes d’une réservation de salle disponibles"
                  - option "Recettes disponibles"
                  - option "Reçu de vente au guichet"
                  - option "Refus en série à une porte"
                  - option "Remboursement à reprendre"
                  - option "Remboursement d’un paiement"
                  - option "Remboursement d’une réservation de salle versé"
                  - option "Remboursement demandé"
                  - option "Remboursement retardé"
                  - option "Remboursement versé"
                  - option "Remboursements de l'annulation en attente"
                  - option "Remboursements de l'annulation terminés"
                  - option "Remboursements demandés par des clients"
                  - option "Réservation de salle annulée"
                  - option "Réservation de salle annulée (salle)"
                  - option "Réservation de salle confirmée"
                  - option "Réservation de salle demandée"
                  - option "Réservation de table annulée"
                  - option "Réservation de table annulée (établissement)"
                  - option "Réservation de table confirmée"
                  - option "Résumé du matin"
                  - option "Retrait en vérification"
                  - option "Retrait refusé"
                  - option "Retrait refusé par l'opérateur ou constaté non versé"
                  - option "Retrait retardé"
                  - option "Retrait versé"
                  - option "Salle à valider"
                  - option "Salle validée modifiée"
                  - 'option "SMS aux administrateurs : à valider"'
                  - option "SMS optionnels à 80 % du plafond"
                  - option "Solde d’une réservation de salle payé"
                  - option "Soumission retirée par l’organisateur"
                  - option "Suspension ou reprise d’un contrôle"
                  - option "Transfert accepté"
                  - option "Transfert annulé"
                  - 'option "Transfert annulé : numéro du destinataire changé"'
                  - option "Transfert annulé par un remboursement"
                  - option "Transfert expiré"
                  - option "Transfert refusé"
                  - option "Ventes groupées par SMS"
                  - option "Versement à reprendre"
                  - option "Versement incertain"
                  - option "Volume de SMS indispensables élevé"
              - generic [ref=e192]:
                - generic [ref=e193]:
                  - generic [ref=e194]: Du
                  - textbox "Du" [ref=e196]
                - generic [ref=e197]:
                  - generic [ref=e198]: Au
                  - textbox "Au" [ref=e200]
            - tabpanel "Toutes" [ref=e201]:
              - generic [ref=e202]:
                - region "Notifications de la boîte d’envoi" [ref=e204]:
                  - table [ref=e205]:
                    - caption [ref=e206]: Notifications de la boîte d’envoi
                    - rowgroup [ref=e207]:
                      - row [ref=e208]:
                        - columnheader "Date" [ref=e209]
                        - columnheader "Type" [ref=e210]
                        - columnheader "Canal" [ref=e211]
                        - columnheader "Destinataire" [ref=e212]
                        - columnheader "Statut" [ref=e213]
                        - columnheader "Motif" [ref=e214]
                        - columnheader "Détail" [ref=e215]
                    - rowgroup [ref=e216]:
                      - row [ref=e217]:
                        - cell [ref=e218]:
                          - time [ref=e219]: ven. 20 nov. 2026 à 12:55
                        - cell "Code administrateur" [ref=e220]
                        - cell "SMS" [ref=e223]
                        - cell "+221 70 *** ** 07" [ref=e224]
                        - cell "Envoyée" [ref=e225]
                        - cell "—" [ref=e229]
                        - cell [ref=e230]:
                          - 'link "Voir le détail : Code administrateur, ven. 20 nov. 2026 à 12:55" [ref=e231] [cursor=pointer]':
                            - /url: /admin/notifications/a5b543e7-c38f-4fa9-9297-f808257d9f5d
                            - generic [ref=e232]: Voir
                      - row [ref=e236]:
                        - cell [ref=e237]:
                          - time [ref=e238]: ven. 20 nov. 2026 à 12:55
                        - cell "Code administrateur" [ref=e239]
                        - cell "SMS" [ref=e242]
                        - cell "+221 70 *** ** 04" [ref=e243]
                        - cell "Envoyée" [ref=e244]
                        - cell "—" [ref=e248]
                        - cell [ref=e249]:
                          - 'link "Voir le détail : Code administrateur, ven. 20 nov. 2026 à 12:55" [ref=e250] [cursor=pointer]':
                            - /url: /admin/notifications/5c6717dd-f623-4a0e-ba80-b1b9a07bb3eb
                            - generic [ref=e251]: Voir
                      - row [ref=e255]:
                        - cell [ref=e256]:
                          - time [ref=e257]: ven. 20 nov. 2026 à 12:54
                        - cell "Réservation de salle demandée" [ref=e258]
                        - cell "Application" [ref=e261]
                        - cell "Fatou M." [ref=e262]
                        - cell "Envoyée" [ref=e263]
                        - cell "—" [ref=e267]
                        - cell [ref=e268]:
                          - 'link "Voir le détail : Réservation de salle demandée, ven. 20 nov. 2026 à 12:54" [ref=e269] [cursor=pointer]':
                            - /url: /admin/notifications/f8942675-9ecf-4309-86ec-435872b63468
                            - generic [ref=e270]: Voir
                      - row [ref=e274]:
                        - cell [ref=e275]:
                          - time [ref=e276]: ven. 20 nov. 2026 à 12:54
                        - cell "Réservation de salle demandée" [ref=e277]
                        - cell "SMS" [ref=e280]
                        - cell "Fatou M." [ref=e281]
                        - cell "Envoyée" [ref=e282]
                        - cell "—" [ref=e286]
                        - cell [ref=e287]:
                          - 'link "Voir le détail : Réservation de salle demandée, ven. 20 nov. 2026 à 12:54" [ref=e288] [cursor=pointer]':
                            - /url: /admin/notifications/9bfd4094-76ea-46b7-a2ca-8583d52f223b
                            - generic [ref=e289]: Voir
                      - row [ref=e293]:
                        - cell [ref=e294]:
                          - time [ref=e295]: ven. 20 nov. 2026 à 12:54
                        - cell "Réservation de salle demandée" [ref=e296]
                        - cell "Email" [ref=e299]
                        - cell "Fatou M." [ref=e300]
                        - cell "Non envoyée" [ref=e301]
                        - cell "Adresse email non vérifiée" [ref=e305]
                        - cell [ref=e306]:
                          - 'link "Voir le détail : Réservation de salle demandée, ven. 20 nov. 2026 à 12:54" [ref=e307] [cursor=pointer]':
                            - /url: /admin/notifications/2ba9d34c-9154-468c-bd48-04bde2e8a392
                            - generic [ref=e308]: Voir
                      - row [ref=e312]:
                        - cell [ref=e313]:
                          - time [ref=e314]: ven. 20 nov. 2026 à 12:54
                        - cell "Réservation de salle demandée" [ref=e315]
                        - cell "Notification push" [ref=e318]
                        - cell "Fatou M." [ref=e319]
                        - cell "Non envoyée" [ref=e320]
                        - cell "Aucun appareil abonné aux notifications push" [ref=e324]
                        - cell [ref=e325]:
                          - 'link "Voir le détail : Réservation de salle demandée, ven. 20 nov. 2026 à 12:54" [ref=e326] [cursor=pointer]':
                            - /url: /admin/notifications/1e50873a-2dca-4e10-b5e6-239eb2a0fefb
                            - generic [ref=e327]: Voir
                      - row [ref=e331]:
                        - cell [ref=e332]:
                          - time [ref=e333]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e334]
                        - cell "Notification push" [ref=e337]
                        - cell "Mariama N." [ref=e338]
                        - cell "Non envoyée" [ref=e339]
                        - cell "Aucun appareil abonné aux notifications push" [ref=e343]
                        - cell [ref=e344]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e345] [cursor=pointer]':
                            - /url: /admin/notifications/ce668cd1-25a4-4787-b214-05b9a7b80cff
                            - generic [ref=e346]: Voir
                      - row [ref=e350]:
                        - cell [ref=e351]:
                          - time [ref=e352]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e353]
                        - cell "SMS" [ref=e356]
                        - cell "Mariama N." [ref=e357]
                        - cell "Envoyée" [ref=e358]
                        - cell "—" [ref=e362]
                        - cell [ref=e363]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e364] [cursor=pointer]':
                            - /url: /admin/notifications/bb81ec76-875c-4949-bcb4-2ea9fc64c45e
                            - generic [ref=e365]: Voir
                      - row [ref=e369]:
                        - cell [ref=e370]:
                          - time [ref=e371]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e372]
                        - cell "Email" [ref=e375]
                        - cell "Mariama N." [ref=e376]
                        - cell "Non envoyée" [ref=e377]
                        - cell "Adresse email non vérifiée" [ref=e381]
                        - cell [ref=e382]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e383] [cursor=pointer]':
                            - /url: /admin/notifications/73c9a8f3-17c1-42bf-801b-38c799582a84
                            - generic [ref=e384]: Voir
                      - row [ref=e388]:
                        - cell [ref=e389]:
                          - time [ref=e390]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e391]
                        - cell "Application" [ref=e394]
                        - cell "Mariama N." [ref=e395]
                        - cell "Envoyée" [ref=e396]
                        - cell "—" [ref=e400]
                        - cell [ref=e401]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e402] [cursor=pointer]':
                            - /url: /admin/notifications/55ab6808-a5c5-4ba7-8b86-2254868361b7
                            - generic [ref=e403]: Voir
                      - row [ref=e407]:
                        - cell [ref=e408]:
                          - time [ref=e409]: ven. 20 nov. 2026 à 12:54
                        - cell "Salle à valider" [ref=e410]
                        - cell "Notification push" [ref=e413]
                        - cell "Elhadji S." [ref=e414]
                        - cell "Non envoyée" [ref=e415]
                        - cell "Aucun appareil abonné aux notifications push" [ref=e419]
                        - cell [ref=e420]:
                          - 'link "Voir le détail : Salle à valider, ven. 20 nov. 2026 à 12:54" [ref=e421] [cursor=pointer]':
                            - /url: /admin/notifications/ebef7005-e941-41eb-b3fa-8ed6f8c02f89
                            - generic [ref=e422]: Voir
                      - row [ref=e426]:
                        - cell [ref=e427]:
                          - time [ref=e428]: ven. 20 nov. 2026 à 12:54
                        - cell "Salle à valider" [ref=e429]
                        - cell "Application" [ref=e432]
                        - cell "Elhadji S." [ref=e433]
                        - cell "Envoyée" [ref=e434]
                        - cell "—" [ref=e438]
                        - cell [ref=e439]:
                          - 'link "Voir le détail : Salle à valider, ven. 20 nov. 2026 à 12:54" [ref=e440] [cursor=pointer]':
                            - /url: /admin/notifications/21b48370-dc5e-4bec-a19a-d7b049bd3835
                            - generic [ref=e441]: Voir
                      - row [ref=e445]:
                        - cell [ref=e446]:
                          - time [ref=e447]: ven. 20 nov. 2026 à 12:54
                        - cell "Salle à valider" [ref=e448]
                        - cell "Email" [ref=e451]
                        - cell "Elhadji S." [ref=e452]
                        - cell "Non envoyée" [ref=e453]
                        - cell "Adresse email non vérifiée" [ref=e457]
                        - cell [ref=e458]:
                          - 'link "Voir le détail : Salle à valider, ven. 20 nov. 2026 à 12:54" [ref=e459] [cursor=pointer]':
                            - /url: /admin/notifications/18ae1004-03ef-4b3b-922f-7273939e5902
                            - generic [ref=e460]: Voir
                      - row [ref=e464]:
                        - cell [ref=e465]:
                          - time [ref=e466]: ven. 20 nov. 2026 à 12:54
                        - cell "Salle à valider" [ref=e467]
                        - cell "Application" [ref=e470]
                        - cell "Elhadji S." [ref=e471]
                        - cell "Envoyée" [ref=e472]
                        - cell "—" [ref=e476]
                        - cell [ref=e477]:
                          - 'link "Voir le détail : Salle à valider, ven. 20 nov. 2026 à 12:54" [ref=e478] [cursor=pointer]':
                            - /url: /admin/notifications/f5289812-035a-4864-a312-d4c2bea28b7e
                            - generic [ref=e479]: Voir
                      - row [ref=e483]:
                        - cell [ref=e484]:
                          - time [ref=e485]: ven. 20 nov. 2026 à 12:54
                        - cell "Salle à valider" [ref=e486]
                        - cell "Notification push" [ref=e489]
                        - cell "Elhadji S." [ref=e490]
                        - cell "Non envoyée" [ref=e491]
                        - cell "Aucun appareil abonné aux notifications push" [ref=e495]
                        - cell [ref=e496]:
                          - 'link "Voir le détail : Salle à valider, ven. 20 nov. 2026 à 12:54" [ref=e497] [cursor=pointer]':
                            - /url: /admin/notifications/b7ffac10-09e5-4092-93ee-f0e5c6ab54b6
                            - generic [ref=e498]: Voir
                      - row [ref=e502]:
                        - cell [ref=e503]:
                          - time [ref=e504]: ven. 20 nov. 2026 à 12:54
                        - cell "Salle à valider" [ref=e505]
                        - cell "Email" [ref=e508]
                        - cell "Elhadji S." [ref=e509]
                        - cell "Non envoyée" [ref=e510]
                        - cell "Adresse email non vérifiée" [ref=e514]
                        - cell [ref=e515]:
                          - 'link "Voir le détail : Salle à valider, ven. 20 nov. 2026 à 12:54" [ref=e516] [cursor=pointer]':
                            - /url: /admin/notifications/655a9021-d17b-4f39-b8d0-d240b85cb5ab
                            - generic [ref=e517]: Voir
                      - row [ref=e521]:
                        - cell [ref=e522]:
                          - time [ref=e523]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e524]
                        - cell "SMS" [ref=e527]
                        - cell "Mariama N." [ref=e528]
                        - cell "Envoyée" [ref=e529]
                        - cell "—" [ref=e533]
                        - cell [ref=e534]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e535] [cursor=pointer]':
                            - /url: /admin/notifications/e52cf469-c901-41d8-9d01-390ffe603e63
                            - generic [ref=e536]: Voir
                      - row [ref=e540]:
                        - cell [ref=e541]:
                          - time [ref=e542]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e543]
                        - cell "Application" [ref=e546]
                        - cell "Mariama N." [ref=e547]
                        - cell "Envoyée" [ref=e548]
                        - cell "—" [ref=e552]
                        - cell [ref=e553]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e554] [cursor=pointer]':
                            - /url: /admin/notifications/b4d8fc39-cd0f-42be-bcc4-c3fa5dacddfb
                            - generic [ref=e555]: Voir
                      - row [ref=e559]:
                        - cell [ref=e560]:
                          - time [ref=e561]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e562]
                        - cell "Email" [ref=e565]
                        - cell "Mariama N." [ref=e566]
                        - cell "Non envoyée" [ref=e567]
                        - cell "Adresse email non vérifiée" [ref=e571]
                        - cell [ref=e572]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e573] [cursor=pointer]':
                            - /url: /admin/notifications/60db5566-190e-4409-814f-25a9e1ec8e1f
                            - generic [ref=e574]: Voir
                      - row [ref=e578]:
                        - cell [ref=e579]:
                          - time [ref=e580]: ven. 20 nov. 2026 à 12:54
                        - cell "Décision sur une salle" [ref=e581]
                        - cell "Notification push" [ref=e584]
                        - cell "Mariama N." [ref=e585]
                        - cell "Non envoyée" [ref=e586]
                        - cell "Aucun appareil abonné aux notifications push" [ref=e590]
                        - cell [ref=e591]:
                          - 'link "Voir le détail : Décision sur une salle, ven. 20 nov. 2026 à 12:54" [ref=e592] [cursor=pointer]':
                            - /url: /admin/notifications/42819e2e-f0d4-4cd8-a11a-faa565d11850
                            - generic [ref=e593]: Voir
                - navigation "Pages des notifications" [ref=e597]:
                  - button "Précédent" [disabled] [ref=e598]
                  - paragraph [ref=e603]:
                    - text: Page 1 sur 79
                    - generic [ref=e604]: · 1 574 résultats
                  - button "Suivant" [ref=e605] [cursor=pointer]
          - region [ref=e610]:
            - generic [ref=e611]:
              - heading "Par jour et par canal" [level=2] [ref=e612]
              - paragraph [ref=e613]: 14 derniers jours, heure de Dakar.
            - region "Notifications par jour et par canal" [ref=e615]:
              - table [ref=e616]:
                - caption [ref=e617]: Notifications par jour et par canal
                - rowgroup [ref=e618]:
                  - row [ref=e619]:
                    - columnheader "Jour" [ref=e620]
                    - columnheader "Canal" [ref=e621]
                    - columnheader "Envoyées" [ref=e622]
                    - columnheader "En échec" [ref=e623]
                    - columnheader "Non envoyées" [ref=e624]
                    - columnheader "Incertaines" [ref=e625]
                    - columnheader "Annulées" [ref=e626]
                - rowgroup [ref=e627]:
                  - row [ref=e628]:
                    - cell "20 nov. 2026" [ref=e629]
                    - cell "Email" [ref=e630]
                    - cell "0" [ref=e631]
                    - cell "0" [ref=e632]
                    - cell "419" [ref=e633]
                    - cell "0" [ref=e634]
                    - cell "0" [ref=e635]
                  - row [ref=e636]:
                    - cell "20 nov. 2026" [ref=e637]
                    - cell "Application" [ref=e638]
                    - cell "378" [ref=e639]
                    - cell "0" [ref=e640]
                    - cell "0" [ref=e641]
                    - cell "0" [ref=e642]
                    - cell "3" [ref=e643]
                  - row [ref=e644]:
                    - cell "20 nov. 2026" [ref=e645]
                    - cell "Notification push" [ref=e646]
                    - cell "0" [ref=e647]
                    - cell "0" [ref=e648]
                    - cell "322" [ref=e649]
                    - cell "0" [ref=e650]
                    - cell "3" [ref=e651]
                  - row [ref=e652]:
                    - cell "20 nov. 2026" [ref=e653]
                    - cell "SMS" [ref=e654]
                    - cell "244" [ref=e655]
                    - cell "1" [ref=e656]
                    - cell "0" [ref=e657]
                    - cell "1" [ref=e658]
                    - cell "3" [ref=e659]
  - alert [ref=e660]
```

# Test source

```ts
  232 |     }, payload);
  233 | }
  234 | 
  235 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  236 | async function expectScanResult(page: Page, result: string): Promise<void> {
  237 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
  238 | }
  239 | 
  240 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  241 | function demoPayload(c: ScreenContext): string {
  242 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  243 | }
  244 | 
  245 | const SCAN_URL = /\/api\/controller\/scan$/;
  246 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  247 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  248 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  249 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  250 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  251 | 
  252 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  253 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  254 |     const result = String(body.result);
  255 |     return {
  256 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  257 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  258 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  259 |         ready: async ({ page }) => startScanner(page),
  260 |         actions: async (c) => {
  261 |             await presentToFakeDetector(c.page, demoPayload(c));
  262 |             await expectScanResult(c.page, result);
  263 |         },
  264 |     };
  265 | }
  266 | 
  267 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  268 | function offlineLink(page: Page, ticketId: string): Locator {
  269 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  270 | }
  271 | 
  272 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  273 | 
  274 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  275 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  276 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  277 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  278 |     return counters;
  279 | }
  280 | 
  281 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  282 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  283 |     await expectHeading(page, /^préférences de notification$/i);
  284 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  285 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  286 | }
  287 | 
  288 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  289 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  290 |     const counters = await fakePushCounters(page);
  291 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  292 | }
  293 | 
  294 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  295 | 
  296 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  297 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  298 | 
  299 | function cdpKids(node: CdpNode): CdpNode[] {
  300 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  301 | }
  302 | 
  303 | function findDateInput(node: CdpNode): CdpNode | null {
  304 |     const attrs = node.attributes ?? [];
  305 |     if (node.nodeName === 'INPUT') {
  306 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  307 |     }
  308 |     for (const kid of cdpKids(node)) {
  309 |         const found = findDateInput(kid);
  310 |         if (found) return found;
  311 |     }
  312 |     return null;
  313 | }
  314 | 
  315 | function cdpText(node: CdpNode): string {
  316 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  317 |     return own + cdpKids(node).map(cdpText).join('');
  318 | }
  319 | 
  320 | /**
  321 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  322 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  323 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  324 |  */
  325 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  326 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  327 |     const cdp = await c.context.newCDPSession(c.page);
  328 |     try {
  329 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  330 |         const input = findDateInput(root);
  331 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
> 332 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
      |                                                                                ^ Error: gabarit du champ de date, lu par CDP (8.2 t)
  333 |     } finally {
  334 |         await cdp.detach();
  335 |     }
  336 | }
  337 | 
  338 | /** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
  339 | async function fontSizePx(target: Locator): Promise<number> {
  340 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  341 | }
  342 | 
  343 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  344 | async function openTicketingStep(page: Page): Promise<void> {
  345 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  346 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  347 | }
  348 | 
  349 | const ONLINE_BOX = /^vendue en ligne/i;
  350 | const COUNTER_BOX = /^vendue au guichet/i;
  351 | 
  352 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  353 | function categorySections(page: Page): Locator {
  354 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  355 | }
  356 | 
  357 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  358 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  359 | /** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
  360 | const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
  361 | /**
  362 |  * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
  363 |  * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
  364 |  * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
  365 |  * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
  366 |  */
  367 | const CASHOUTS_TO_RESUME = {
  368 |     items: [
  369 |         {
  370 |             id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
  371 |             since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
  372 |             block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  373 |         },
  374 |         {
  375 |             id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
  376 |             since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
  377 |             block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  378 |         },
  379 |         {
  380 |             id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
  381 |             since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
  382 |             block_label: null, can_resend: false, can_mark_paid: true, can_mark_not_sent: true, advice: ADVICE_UNCERTAIN_NO_ID,
  383 |         },
  384 |         {
  385 |             id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
  386 |             since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
  387 |             block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  388 |         },
  389 |         {
  390 |             id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
  391 |             since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
  392 |             block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, can_mark_not_sent: false, advice: null,
  393 |         },
  394 |     ],
  395 |     total: 5,
  396 | };
  397 | const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
  398 | const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
  399 | /** Lot 9 ter (A.2.3, A.2.6) : « Constater non versé » sur la seule ligne INCERTAIN sans identifiant SamirPay (SUPERADMIN). */
  400 | const CASHOUTS_NOT_SENT = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_not_sent).length;
  401 | const EMPTY_RECONCILIATION = {
  402 |     summary: {
  403 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  404 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  405 |     },
  406 |     items: [],
  407 |     // Lot 9 bis (H6, contrat 4.1), relecture des captures du run 121 : sans ces champs, readCashoutFees (app/admin/finance/page.tsx)
  408 |     // affichait « Frais SamirPay non disponibles » sur la capture. Forme de cashoutFeeReconciliation (lib/admin/finance-reconciliation.ts) ;
  409 |     // cashinNote recopie CASHIN_FEES_NOTE. Aucun versement à la page : 12 versements aux frais connus, 280 000 F CFA au taux de 1,5 %.
  410 |     cashoutFeesReal: 4290,
  411 |     cashoutFeesEstimated: 4200,
  412 |     gap: 90,
  413 |     cashoutFeeRate: 1.5,
  414 |     cashoutCount: 12,
  415 |     cashinFeesReal: null,
  416 |     cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
  417 | };
  418 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  419 | const CASHOUTS_STUBS: StubResponse[] = [
  420 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  421 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  422 | ];
  423 | 
  424 | // ── Finition 3a : argent de l'administration (page Finance, accueil) ─────────
  425 | // Réponses imposées aux montants cohérents entre eux (voir le rapport de la finition 3a) : les captures montrent chaque
  426 | // état sans dépendre des données du seed ; les règles de calcul sont prouvées par les suites f3a-* (base locale).
  427 | const F3A_SUMMARY_URL = /\/api\/admin\/finance\/summary(\?.*)?$/;
  428 | const F3A_PAYMENTS_URL = /\/api\/admin\/finance\/payments(\?.*)?$/;
  429 | const F3A_DEBTS_URL = /\/api\/admin\/finance\/debts(\?.*)?$/;
  430 | const F3A_WAITING_URL = /\/api\/admin\/finance\/waiting(\?.*)?$/;
  431 | const F3A_PERIOD = {
  432 |     key: 'month', from: '2026-11-01T00:00:00.000Z', to: '2026-11-17T00:00:00.000Z', firstDay: '2026-11-01', lastDay: '2026-11-16',
```