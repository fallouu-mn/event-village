# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · admin >> admin-notifications — Administration — supervision des notifications (liste filtrable, compteurs)
- Location: e2e/captures.spec.ts:185:9

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
                - paragraph [ref=e120]: "242"
                - paragraph [ref=e121]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=e122]:
                - paragraph [ref=e124]: SMS optionnels aujourd'hui
                - paragraph [ref=e129]: "20"
                - paragraph [ref=e130]: "Plafond : 20 000 par jour, alerte à 16 000."
              - generic [ref=e131]:
                - paragraph [ref=e133]: SMS ce mois-ci
                - paragraph [ref=e140]: "242"
                - paragraph [ref=e141]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=e142]:
            - heading "Envois" [level=2] [ref=e143]
            - tablist "Filtrer par statut" [ref=e146]:
              - tab "Toutes" [selected] [ref=e147] [cursor=pointer]
              - tab "En attente , 189" [ref=e149] [cursor=pointer]:
                - generic [ref=e150]: En attente
                - generic [ref=e151]:
                  - generic [ref=e152]: ","
                  - text: "189"
              - tab "En cours d'envoi , 0" [ref=e153] [cursor=pointer]:
                - generic [ref=e154]: En cours d'envoi
                - generic [ref=e155]:
                  - generic [ref=e156]: ","
                  - text: "0"
              - tab "Envoyée , 613" [ref=e157] [cursor=pointer]:
                - generic [ref=e158]: Envoyée
                - generic [ref=e159]:
                  - generic [ref=e160]: ","
                  - text: "613"
              - tab "En échec , 1" [ref=e161] [cursor=pointer]:
                - generic [ref=e162]: En échec
                - generic [ref=e163]:
                  - generic [ref=e164]: ","
                  - text: "1"
              - tab "Non envoyée , 747" [ref=e165] [cursor=pointer]:
                - generic [ref=e166]: Non envoyée
                - generic [ref=e167]:
                  - generic [ref=e168]: ","
                  - text: "747"
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
                  - option "Rappels de demain au-delà du budget SMS"
                  - option "Rapport de clôture prêt"
                  - option "Recettes disponibles"
                  - option "Reçu de vente au guichet"
                  - option "Refus en série à une porte"
                  - option "Remboursement à reprendre"
                  - option "Remboursement d’un paiement"
                  - option "Remboursement demandé"
                  - option "Remboursement retardé"
                  - option "Remboursement versé"
                  - option "Remboursements de l'annulation en attente"
                  - option "Remboursements de l'annulation terminés"
                  - option "Remboursements demandés par des clients"
                  - option "Réservation de salle annulée"
                  - option "Réservation de salle annulée (salle)"
                  - option "Réservation de salle confirmée"
                  - option "Réservation de table annulée"
                  - option "Réservation de table annulée (établissement)"
                  - option "Réservation de table confirmée"
                  - option "Résumé du matin"
                  - option "Retrait en vérification"
                  - option "Retrait refusé"
                  - option "Retrait refusé par l'opérateur ou constaté non versé"
                  - option "Retrait retardé"
                  - option "Retrait versé"
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
                          - time [ref=e219]: ven. 20 nov. 2026 à 10:43
                        - cell "Code administrateur" [ref=e220]
                        - cell "SMS" [ref=e223]
                        - cell "+221 70 *** ** 07" [ref=e224]
                        - cell "Envoyée" [ref=e225]
                        - cell "—" [ref=e229]
                        - cell [ref=e230]:
                          - 'link "Voir le détail : Code administrateur, ven. 20 nov. 2026 à 10:43" [ref=e231] [cursor=pointer]':
                            - /url: /admin/notifications/a4e31220-450b-4ad8-8b15-30401c2d7de1
                            - generic [ref=e232]: Voir
                      - row [ref=e236]:
                        - cell [ref=e237]:
                          - time [ref=e238]: ven. 20 nov. 2026 à 10:42
                        - cell "Code administrateur" [ref=e239]
                        - cell "SMS" [ref=e242]
                        - cell "+221 70 *** ** 04" [ref=e243]
                        - cell "Envoyée" [ref=e244]
                        - cell "—" [ref=e248]
                        - cell [ref=e249]:
                          - 'link "Voir le détail : Code administrateur, ven. 20 nov. 2026 à 10:42" [ref=e250] [cursor=pointer]':
                            - /url: /admin/notifications/ecf93dba-261d-4965-a7d1-5d5651e1ff4e
                            - generic [ref=e251]: Voir
                      - row [ref=e255]:
                        - cell [ref=e256]:
                          - time [ref=e257]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e258]
                        - cell "SMS" [ref=e261]
                        - cell "Mariama N." [ref=e262]
                        - cell "En attente" [ref=e263]
                        - cell "—" [ref=e267]
                        - cell [ref=e268]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e269] [cursor=pointer]':
                            - /url: /admin/notifications/f8f8d129-6a43-493f-bd3d-a2ec253c51a3
                            - generic [ref=e270]: Voir
                      - row [ref=e274]:
                        - cell [ref=e275]:
                          - time [ref=e276]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e277]
                        - cell "Email" [ref=e280]
                        - cell "Mariama N." [ref=e281]
                        - cell "Non envoyée" [ref=e282]
                        - cell "Adresse email non vérifiée" [ref=e286]
                        - cell [ref=e287]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e288] [cursor=pointer]':
                            - /url: /admin/notifications/f4922c1d-a55a-46d9-aea2-688987e2e83f
                            - generic [ref=e289]: Voir
                      - row [ref=e293]:
                        - cell [ref=e294]:
                          - time [ref=e295]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e296]
                        - cell "SMS" [ref=e299]
                        - cell "Ousmane F." [ref=e300]
                        - cell "En attente" [ref=e301]
                        - cell "—" [ref=e305]
                        - cell [ref=e306]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e307] [cursor=pointer]':
                            - /url: /admin/notifications/f34535dd-7e03-4892-a9d7-f375662a057c
                            - generic [ref=e308]: Voir
                      - row [ref=e312]:
                        - cell [ref=e313]:
                          - time [ref=e314]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e315]
                        - cell "Notification push" [ref=e318]
                        - cell "Mariama N." [ref=e319]
                        - cell "En attente" [ref=e320]
                        - cell "—" [ref=e324]
                        - cell [ref=e325]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e326] [cursor=pointer]':
                            - /url: /admin/notifications/7a110aff-0766-4db4-9fea-d3ffc51a27b2
                            - generic [ref=e327]: Voir
                      - row [ref=e331]:
                        - cell [ref=e332]:
                          - time [ref=e333]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e334]
                        - cell "Email" [ref=e337]
                        - cell "Ousmane F." [ref=e338]
                        - cell "Non envoyée" [ref=e339]
                        - cell "Adresse email non vérifiée" [ref=e343]
                        - cell [ref=e344]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e345] [cursor=pointer]':
                            - /url: /admin/notifications/5dbd96ce-18ee-450f-a39d-bdd237f378c6
                            - generic [ref=e346]: Voir
                      - row [ref=e350]:
                        - cell [ref=e351]:
                          - time [ref=e352]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e353]
                        - cell "Application" [ref=e356]
                        - cell "Ousmane F." [ref=e357]
                        - cell "En attente" [ref=e358]
                        - cell "—" [ref=e362]
                        - cell [ref=e363]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e364] [cursor=pointer]':
                            - /url: /admin/notifications/1f58907a-035a-4313-ab33-46f5783c6866
                            - generic [ref=e365]: Voir
                      - row [ref=e369]:
                        - cell [ref=e370]:
                          - time [ref=e371]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e372]
                        - cell "Notification push" [ref=e375]
                        - cell "Ousmane F." [ref=e376]
                        - cell "En attente" [ref=e377]
                        - cell "—" [ref=e381]
                        - cell [ref=e382]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e383] [cursor=pointer]':
                            - /url: /admin/notifications/1ecc43ab-06e1-4568-9ec2-74e263f3a10b
                            - generic [ref=e384]: Voir
                      - row [ref=e388]:
                        - cell [ref=e389]:
                          - time [ref=e390]: ven. 20 nov. 2026 à 10:42
                        - cell "Résumé du matin" [ref=e391]
                        - cell "Application" [ref=e394]
                        - cell "Mariama N." [ref=e395]
                        - cell "En attente" [ref=e396]
                        - cell "—" [ref=e400]
                        - cell [ref=e401]:
                          - 'link "Voir le détail : Résumé du matin, ven. 20 nov. 2026 à 10:42" [ref=e402] [cursor=pointer]':
                            - /url: /admin/notifications/192c7de8-75ce-4b83-af11-f0a90930d212
                            - generic [ref=e403]: Voir
                      - row [ref=e407]:
                        - cell [ref=e408]:
                          - time [ref=e409]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e410]:
                          - generic [ref=e411]:
                            - generic [ref=e412]: Confirmation d’achat
                            - generic [ref=e413]: Nuit du slam de Kaolack
                        - cell "Application" [ref=e414]
                        - cell "Alioune F." [ref=e415]
                        - cell "Envoyée" [ref=e416]
                        - cell "—" [ref=e420]
                        - cell [ref=e421]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e422] [cursor=pointer]':
                            - /url: /admin/notifications/dc0dd45f-a02b-416c-896a-90e74c388995
                            - generic [ref=e423]: Voir
                      - row [ref=e427]:
                        - cell [ref=e428]:
                          - time [ref=e429]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e430]:
                          - generic [ref=e431]:
                            - generic [ref=e432]: Confirmation d’achat
                            - generic [ref=e433]: Nuit du slam de Kaolack
                        - cell "Notification push" [ref=e434]
                        - cell "Alioune F." [ref=e435]
                        - cell "Non envoyée" [ref=e436]
                        - cell "Aucun appareil abonné aux notifications push" [ref=e440]
                        - cell [ref=e441]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e442] [cursor=pointer]':
                            - /url: /admin/notifications/a541983c-62a0-4797-a6e2-5bcf8bdb9869
                            - generic [ref=e443]: Voir
                      - row [ref=e447]:
                        - cell [ref=e448]:
                          - time [ref=e449]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e450]:
                          - generic [ref=e451]:
                            - generic [ref=e452]: Confirmation d’achat
                            - generic [ref=e453]: Nuit du slam de Kaolack
                        - cell "SMS" [ref=e454]
                        - cell "+221 70 *** ** 08" [ref=e455]
                        - cell "Envoyée" [ref=e456]
                        - cell "—" [ref=e460]
                        - cell [ref=e461]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e462] [cursor=pointer]':
                            - /url: /admin/notifications/72e03b11-5e01-4ee2-bf11-30012a95b706
                            - generic [ref=e463]: Voir
                      - row [ref=e467]:
                        - cell [ref=e468]:
                          - time [ref=e469]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e470]:
                          - generic [ref=e471]:
                            - generic [ref=e472]: Confirmation d’achat
                            - generic [ref=e473]: Nuit du slam de Kaolack
                        - cell "Email" [ref=e474]
                        - cell "Alioune F." [ref=e475]
                        - cell "Non envoyée" [ref=e476]
                        - cell "Adresse email non vérifiée" [ref=e480]
                        - cell [ref=e481]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e482] [cursor=pointer]':
                            - /url: /admin/notifications/32e95c62-7ee5-4b54-a117-c3eb2f7a6948
                            - generic [ref=e483]: Voir
                      - row [ref=e487]:
                        - cell [ref=e488]:
                          - time [ref=e489]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e490]:
                          - generic [ref=e491]:
                            - generic [ref=e492]: Confirmation d’achat
                            - generic [ref=e493]: Nuit du slam de Kaolack
                        - cell "Email" [ref=e494]
                        - cell "Mame N." [ref=e495]
                        - cell "Non envoyée" [ref=e496]
                        - cell "Adresse email non vérifiée" [ref=e500]
                        - cell [ref=e501]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e502] [cursor=pointer]':
                            - /url: /admin/notifications/f8695600-d2b6-4413-86de-f9511ab791b9
                            - generic [ref=e503]: Voir
                      - row [ref=e507]:
                        - cell [ref=e508]:
                          - time [ref=e509]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e510]:
                          - generic [ref=e511]:
                            - generic [ref=e512]: Confirmation d’achat
                            - generic [ref=e513]: Nuit du slam de Kaolack
                        - cell "Notification push" [ref=e514]
                        - cell "Mame N." [ref=e515]
                        - cell "Non envoyée" [ref=e516]
                        - cell "Aucun appareil abonné aux notifications push" [ref=e520]
                        - cell [ref=e521]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e522] [cursor=pointer]':
                            - /url: /admin/notifications/f3372746-ac5d-45ec-8d1f-0c675117fde3
                            - generic [ref=e523]: Voir
                      - row [ref=e527]:
                        - cell [ref=e528]:
                          - time [ref=e529]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e530]:
                          - generic [ref=e531]:
                            - generic [ref=e532]: Confirmation d’achat
                            - generic [ref=e533]: Nuit du slam de Kaolack
                        - cell "Application" [ref=e534]
                        - cell "Mame N." [ref=e535]
                        - cell "Envoyée" [ref=e536]
                        - cell "—" [ref=e540]
                        - cell [ref=e541]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e542] [cursor=pointer]':
                            - /url: /admin/notifications/cf657469-c144-409d-b38b-34225cc913b0
                            - generic [ref=e543]: Voir
                      - row [ref=e547]:
                        - cell [ref=e548]:
                          - time [ref=e549]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e550]:
                          - generic [ref=e551]:
                            - generic [ref=e552]: Confirmation d’achat
                            - generic [ref=e553]: Nuit du slam de Kaolack
                        - cell "SMS" [ref=e554]
                        - cell "+221 70 *** ** 07" [ref=e555]
                        - cell "Envoyée" [ref=e556]
                        - cell "—" [ref=e560]
                        - cell [ref=e561]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e562] [cursor=pointer]':
                            - /url: /admin/notifications/ce9bf1b6-ac33-4f16-9b4d-b1e0ad5f6a41
                            - generic [ref=e563]: Voir
                      - row [ref=e567]:
                        - cell [ref=e568]:
                          - time [ref=e569]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e570]:
                          - generic [ref=e571]:
                            - generic [ref=e572]: Confirmation d’achat
                            - generic [ref=e573]: Nuit du slam de Kaolack
                        - cell "Application" [ref=e574]
                        - cell "Babacar D." [ref=e575]
                        - cell "Envoyée" [ref=e576]
                        - cell "—" [ref=e580]
                        - cell [ref=e581]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e582] [cursor=pointer]':
                            - /url: /admin/notifications/fa6a9c07-a91f-446e-b7de-7796b8c757ca
                            - generic [ref=e583]: Voir
                      - row [ref=e587]:
                        - cell [ref=e588]:
                          - time [ref=e589]: ven. 20 nov. 2026 à 10:42
                        - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e590]:
                          - generic [ref=e591]:
                            - generic [ref=e592]: Confirmation d’achat
                            - generic [ref=e593]: Nuit du slam de Kaolack
                        - cell "Email" [ref=e594]
                        - cell "Babacar D." [ref=e595]
                        - cell "Non envoyée" [ref=e596]
                        - cell "Adresse email non vérifiée" [ref=e600]
                        - cell [ref=e601]:
                          - 'link "Voir le détail : Confirmation d’achat, ven. 20 nov. 2026 à 10:42" [ref=e602] [cursor=pointer]':
                            - /url: /admin/notifications/57c4b936-6a15-4bea-9812-d716c2ba00a0
                            - generic [ref=e603]: Voir
                - navigation "Pages des notifications" [ref=e607]:
                  - button "Précédent" [disabled] [ref=e608]
                  - paragraph [ref=e613]:
                    - text: Page 1 sur 78
                    - generic [ref=e614]: · 1 560 résultats
                  - button "Suivant" [ref=e615] [cursor=pointer]
          - region [ref=e620]:
            - generic [ref=e621]:
              - heading "Par jour et par canal" [level=2] [ref=e622]
              - paragraph [ref=e623]: 14 derniers jours, heure de Dakar.
            - region "Notifications par jour et par canal" [ref=e625]:
              - table [ref=e626]:
                - caption [ref=e627]: Notifications par jour et par canal
                - rowgroup [ref=e628]:
                  - row [ref=e629]:
                    - columnheader "Jour" [ref=e630]
                    - columnheader "Canal" [ref=e631]
                    - columnheader "Envoyées" [ref=e632]
                    - columnheader "En échec" [ref=e633]
                    - columnheader "Non envoyées" [ref=e634]
                    - columnheader "Incertaines" [ref=e635]
                    - columnheader "Annulées" [ref=e636]
                - rowgroup [ref=e637]:
                  - row [ref=e638]:
                    - cell "20 nov. 2026" [ref=e639]
                    - cell "Email" [ref=e640]
                    - cell "0" [ref=e641]
                    - cell "0" [ref=e642]
                    - cell "415" [ref=e643]
                    - cell "0" [ref=e644]
                    - cell "0" [ref=e645]
                  - row [ref=e646]:
                    - cell "20 nov. 2026" [ref=e647]
                    - cell "Application" [ref=e648]
                    - cell "372" [ref=e649]
                    - cell "0" [ref=e650]
                    - cell "0" [ref=e651]
                    - cell "0" [ref=e652]
                    - cell "3" [ref=e653]
                  - row [ref=e654]:
                    - cell "20 nov. 2026" [ref=e655]
                    - cell "Notification push" [ref=e656]
                    - cell "0" [ref=e657]
                    - cell "0" [ref=e658]
                    - cell "316" [ref=e659]
                    - cell "0" [ref=e660]
                    - cell "3" [ref=e661]
                  - row [ref=e662]:
                    - cell "20 nov. 2026" [ref=e663]
                    - cell "SMS" [ref=e664]
                    - cell "241" [ref=e665]
                    - cell "1" [ref=e666]
                    - cell "0" [ref=e667]
                    - cell "1" [ref=e668]
                    - cell "3" [ref=e669]
  - alert [ref=e670]
```

# Test source

```ts
  221 |     }, payload);
  222 | }
  223 | 
  224 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  225 | async function expectScanResult(page: Page, result: string): Promise<void> {
  226 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
  227 | }
  228 | 
  229 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  230 | function demoPayload(c: ScreenContext): string {
  231 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  232 | }
  233 | 
  234 | const SCAN_URL = /\/api\/controller\/scan$/;
  235 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  236 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  237 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  238 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  239 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  240 | 
  241 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  242 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  243 |     const result = String(body.result);
  244 |     return {
  245 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  246 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  247 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  248 |         ready: async ({ page }) => startScanner(page),
  249 |         actions: async (c) => {
  250 |             await presentToFakeDetector(c.page, demoPayload(c));
  251 |             await expectScanResult(c.page, result);
  252 |         },
  253 |     };
  254 | }
  255 | 
  256 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  257 | function offlineLink(page: Page, ticketId: string): Locator {
  258 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  259 | }
  260 | 
  261 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  262 | 
  263 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  264 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  265 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  266 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  267 |     return counters;
  268 | }
  269 | 
  270 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  271 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  272 |     await expectHeading(page, /^préférences de notification$/i);
  273 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  274 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  275 | }
  276 | 
  277 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  278 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  279 |     const counters = await fakePushCounters(page);
  280 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  281 | }
  282 | 
  283 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  284 | 
  285 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  286 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  287 | 
  288 | function cdpKids(node: CdpNode): CdpNode[] {
  289 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  290 | }
  291 | 
  292 | function findDateInput(node: CdpNode): CdpNode | null {
  293 |     const attrs = node.attributes ?? [];
  294 |     if (node.nodeName === 'INPUT') {
  295 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  296 |     }
  297 |     for (const kid of cdpKids(node)) {
  298 |         const found = findDateInput(kid);
  299 |         if (found) return found;
  300 |     }
  301 |     return null;
  302 | }
  303 | 
  304 | function cdpText(node: CdpNode): string {
  305 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  306 |     return own + cdpKids(node).map(cdpText).join('');
  307 | }
  308 | 
  309 | /**
  310 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  311 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  312 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  313 |  */
  314 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  315 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  316 |     const cdp = await c.context.newCDPSession(c.page);
  317 |     try {
  318 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  319 |         const input = findDateInput(root);
  320 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
> 321 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
      |                                                                                ^ Error: gabarit du champ de date, lu par CDP (8.2 t)
  322 |     } finally {
  323 |         await cdp.detach();
  324 |     }
  325 | }
  326 | 
  327 | /** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
  328 | async function fontSizePx(target: Locator): Promise<number> {
  329 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  330 | }
  331 | 
  332 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  333 | async function openTicketingStep(page: Page): Promise<void> {
  334 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  335 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  336 | }
  337 | 
  338 | const ONLINE_BOX = /^vendue en ligne/i;
  339 | const COUNTER_BOX = /^vendue au guichet/i;
  340 | 
  341 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  342 | function categorySections(page: Page): Locator {
  343 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  344 | }
  345 | 
  346 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  347 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  348 | /** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
  349 | const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
  350 | /**
  351 |  * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
  352 |  * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
  353 |  * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
  354 |  * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
  355 |  */
  356 | const CASHOUTS_TO_RESUME = {
  357 |     items: [
  358 |         {
  359 |             id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
  360 |             since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
  361 |             block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  362 |         },
  363 |         {
  364 |             id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
  365 |             since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
  366 |             block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  367 |         },
  368 |         {
  369 |             id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
  370 |             since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
  371 |             block_label: null, can_resend: false, can_mark_paid: true, can_mark_not_sent: true, advice: ADVICE_UNCERTAIN_NO_ID,
  372 |         },
  373 |         {
  374 |             id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
  375 |             since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
  376 |             block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  377 |         },
  378 |         {
  379 |             id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
  380 |             since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
  381 |             block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, can_mark_not_sent: false, advice: null,
  382 |         },
  383 |     ],
  384 |     total: 5,
  385 | };
  386 | const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
  387 | const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
  388 | /** Lot 9 ter (A.2.3, A.2.6) : « Constater non versé » sur la seule ligne INCERTAIN sans identifiant SamirPay (SUPERADMIN). */
  389 | const CASHOUTS_NOT_SENT = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_not_sent).length;
  390 | const EMPTY_RECONCILIATION = {
  391 |     summary: {
  392 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  393 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  394 |     },
  395 |     items: [],
  396 |     // Lot 9 bis (H6, contrat 4.1), relecture des captures du run 121 : sans ces champs, readCashoutFees (app/admin/finance/page.tsx)
  397 |     // affichait « Frais SamirPay non disponibles » sur la capture. Forme de cashoutFeeReconciliation (lib/admin/finance-reconciliation.ts) ;
  398 |     // cashinNote recopie CASHIN_FEES_NOTE. Aucun versement à la page : 12 versements aux frais connus, 280 000 F CFA au taux de 1,5 %.
  399 |     cashoutFeesReal: 4290,
  400 |     cashoutFeesEstimated: 4200,
  401 |     gap: 90,
  402 |     cashoutFeeRate: 1.5,
  403 |     cashoutCount: 12,
  404 |     cashinFeesReal: null,
  405 |     cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
  406 | };
  407 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  408 | const CASHOUTS_STUBS: StubResponse[] = [
  409 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  410 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  411 | ];
  412 | 
  413 | // ── Finition 3a : argent de l'administration (page Finance, accueil) ─────────
  414 | // Réponses imposées aux montants cohérents entre eux (voir le rapport de la finition 3a) : les captures montrent chaque
  415 | // état sans dépendre des données du seed ; les règles de calcul sont prouvées par les suites f3a-* (base locale).
  416 | const F3A_SUMMARY_URL = /\/api\/admin\/finance\/summary(\?.*)?$/;
  417 | const F3A_PAYMENTS_URL = /\/api\/admin\/finance\/payments(\?.*)?$/;
  418 | const F3A_DEBTS_URL = /\/api\/admin\/finance\/debts(\?.*)?$/;
  419 | const F3A_WAITING_URL = /\/api\/admin\/finance\/waiting(\?.*)?$/;
  420 | const F3A_PERIOD = {
  421 |     key: 'month', from: '2026-11-01T00:00:00.000Z', to: '2026-11-17T00:00:00.000Z', firstDay: '2026-11-01', lastDay: '2026-11-16',
```