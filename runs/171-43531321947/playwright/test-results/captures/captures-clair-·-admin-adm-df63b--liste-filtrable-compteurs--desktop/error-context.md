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
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]: Administration
        - link "Tableau de bord" [ref=e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e27]:
          - paragraph [ref=e28]: Gestion
          - generic [ref=e29]:
            - link "Événements" [ref=e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e47]:
          - paragraph [ref=e48]: Finances
          - generic [ref=e49]:
            - link "Finance" [ref=e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=e57]:
          - paragraph [ref=e58]: Engagement
          - generic [ref=e59]:
            - link "Parrainage" [ref=e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=e70]:
          - paragraph [ref=e71]: Système
          - generic [ref=e72]:
            - link "Notifications" [ref=e73] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e80] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=e89] [cursor=pointer]:
          - /url: /
      - generic [ref=e94]:
        - link "Aïda Diallo Administrateur" [ref=e95] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e96]: AD
          - generic [ref=e97]:
            - generic [ref=e98]: Aïda Diallo
            - generic [ref=e99]: Administrateur
        - generic [ref=e100]:
          - button "Se déconnecter" [ref=e101] [cursor=pointer]
          - button "Basculer le thème" [ref=e106] [cursor=pointer]
    - generic [ref=e110]:
      - banner [ref=e111]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e113] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 40 non lues" [ref=e120] [cursor=pointer]:
          - generic [ref=e124]: "40"
      - main [ref=e125]:
        - generic [ref=e127]:
          - generic [ref=e130]:
            - status [ref=e132]: En direct
            - heading "Notifications" [level=1] [ref=e134]
            - paragraph [ref=e135]: "Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar."
          - region [ref=e136]:
            - heading "Compteurs" [level=2] [ref=e137]
            - generic [ref=e138]:
              - generic [ref=e139]:
                - paragraph [ref=e141]: SMS aujourd'hui
                - paragraph [ref=e145]: "194"
                - paragraph [ref=e146]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=e147]:
                - paragraph [ref=e149]: SMS optionnels aujourd'hui
                - paragraph [ref=e154]: "0"
                - paragraph [ref=e155]: "Plafond : 700 par jour, alerte à 560."
              - generic [ref=e156]:
                - paragraph [ref=e158]: SMS ce mois-ci
                - paragraph [ref=e165]: "194"
                - paragraph [ref=e166]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=e167]:
            - heading "Envois" [level=2] [ref=e168]
            - tablist "Filtrer par statut" [ref=e171]:
              - tab "Toutes" [selected] [ref=e172] [cursor=pointer]
              - tab "En attente , 125" [ref=e174] [cursor=pointer]:
                - generic [ref=e175]: En attente
                - generic [ref=e176]:
                  - generic [ref=e177]: ","
                  - text: "125"
              - tab "En cours d'envoi , 0" [ref=e178] [cursor=pointer]:
                - generic [ref=e179]: En cours d'envoi
                - generic [ref=e180]:
                  - generic [ref=e181]: ","
                  - text: "0"
              - tab "Envoyée , 656" [ref=e182] [cursor=pointer]:
                - generic [ref=e183]: Envoyée
                - generic [ref=e184]:
                  - generic [ref=e185]: ","
                  - text: "656"
              - tab "En échec , 1" [ref=e186] [cursor=pointer]:
                - generic [ref=e187]: En échec
                - generic [ref=e188]:
                  - generic [ref=e189]: ","
                  - text: "1"
              - tab "Non envoyée , 533" [ref=e190] [cursor=pointer]:
                - generic [ref=e191]: Non envoyée
                - generic [ref=e192]:
                  - generic [ref=e193]: ","
                  - text: "533"
              - tab "Annulée , 9" [ref=e194] [cursor=pointer]:
                - generic [ref=e195]: Annulée
                - generic [ref=e196]:
                  - generic [ref=e197]: ","
                  - text: "9"
              - tab "Incertaine , 1" [ref=e198] [cursor=pointer]:
                - generic [ref=e199]: Incertaine
                - generic [ref=e200]:
                  - generic [ref=e201]: ","
                  - text: "1"
            - search [ref=e202]:
              - generic [ref=e203]:
                - generic [ref=e204]: Rechercher
                - searchbox "Rechercher" [ref=e206]
              - generic [ref=e207]:
                - generic [ref=e208]: Canal
                - combobox "Canal" [ref=e211] [cursor=pointer]:
                  - option "Tous les canaux" [selected]
                  - option "Application"
                  - option "SMS"
                  - option "Email"
                  - option "Notification push"
              - generic [ref=e212]:
                - generic [ref=e213]: Type
                - combobox "Type" [ref=e216] [cursor=pointer]:
                  - option "Tous les types" [selected]
                  - option "Abonnement activé"
                  - option "Adresse email ajoutée au compte"
                  - option "Adresse email validée par un autre compte"
                  - option "Affectation de contrôle"
                  - option "Affectation de contrôle retirée"
                  - option "Billet ou invitation annulé"
                  - option "Billet reçu"
                  - option "Billet transféré"
                  - option "Billet transféré annulé (détenteur)"
                  - option "Billets gratuits confirmés"
                  - option "Caisse encore ouverte à la fin"
                  - option "Caisse fermée par un tiers"
                  - option "Catégorie complète"
                  - option "Code administrateur"
                  - option "Code d'inscription"
                  - option "Code de changement de numéro"
                  - option "Code de confirmation de retrait"
                  - option "Code de connexion"
                  - option "Code de connexion (authentification)"
                  - option "Code de réinitialisation du mot de passe"
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
                  - option "Créance sur un compte"
                  - option "Demande de réservation de salle"
                  - option "Demande partenaire refusée"
                  - option "Dossier partenaire complété"
                  - option "Écart de caisse"
                  - option "Entrée validée"
                  - option "Essais de connexion échoués"
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
                  - option "Invitation reçue"
                  - option "Lien d'activation d'un compte"
                  - option "Lien de vérification de l'adresse email"
                  - option "Mise en avant décidée"
                  - option "Mot de passe modifié"
                  - option "Notification d'essai"
                  - option "Notification en échec"
                  - option "Nouvelle candidature partenaire"
                  - option "Nouvelle commande"
                  - option "Numéro de téléphone modifié"
                  - option "Paiement confirmé"
                  - option "Paiement en double remboursé"
                  - option "Période d'essai activée"
                  - option "Plafond de SMS atteint"
                  - option "Premier billet vendu"
                  - option "Quota de SMS hors codes atteint"
                  - option "Rappel avant le début"
                  - option "Rappel de contrôle la veille"
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
                  - option "Réservation de salle annulée"
                  - option "Réservation de salle confirmée"
                  - option "Retrait en vérification"
                  - option "Retrait refusé"
                  - option "Retrait refusé par l'opérateur"
                  - option "Retrait retardé"
                  - option "Retrait versé"
                  - 'option "SMS aux administrateurs : à valider"'
                  - option "SMS optionnels à 80 % du plafond"
                  - option "Soumission retirée par l’organisateur"
                  - option "Suspension ou reprise d’un contrôle"
                  - option "Transfert accepté"
                  - option "Transfert annulé"
                  - 'option "Transfert annulé : numéro du destinataire changé"'
                  - option "Transfert annulé par un remboursement"
                  - option "Transfert expiré"
                  - option "Transfert refusé"
                  - option "Versement à reprendre"
                  - option "Versement incertain"
                  - option "Volume de SMS indispensables élevé"
              - generic [ref=e217]:
                - generic [ref=e218]:
                  - generic [ref=e219]: Du
                  - textbox "Du" [ref=e221]
                - generic [ref=e222]:
                  - generic [ref=e223]: Au
                  - textbox "Au" [ref=e225]
            - tabpanel "Toutes" [ref=e226]:
              - generic [ref=e227]:
                - table [ref=e230]:
                  - caption [ref=e231]: Notifications de la boîte d’envoi
                  - rowgroup [ref=e232]:
                    - row [ref=e233]:
                      - columnheader "Date" [ref=e234]
                      - columnheader "Type" [ref=e235]
                      - columnheader "Canal" [ref=e236]
                      - columnheader "Destinataire" [ref=e237]
                      - columnheader "Statut" [ref=e238]
                      - columnheader "Motif" [ref=e239]
                      - columnheader "Détail" [ref=e240]
                  - rowgroup [ref=e241]:
                    - row [ref=e242]:
                      - cell [ref=e243]:
                        - time [ref=e244]: sam. 14 nov. 2026 à 00:39
                      - cell "Code administrateur" [ref=e245]
                      - cell "SMS" [ref=e248]
                      - cell "+221 70 *** ** 07" [ref=e249]
                      - cell "Envoyée" [ref=e250]
                      - cell "—" [ref=e254]
                      - cell [ref=e255]:
                        - 'link "Voir le détail : Code administrateur, sam. 14 nov. 2026 à 00:39" [ref=e256] [cursor=pointer]':
                          - /url: /admin/notifications/2648ec31-165e-4f41-96da-28b61ea1f272
                          - generic [ref=e257]: Voir
                    - row [ref=e261]:
                      - cell [ref=e262]:
                        - time [ref=e263]: sam. 14 nov. 2026 à 00:39
                      - cell "Code administrateur" [ref=e264]
                      - cell "SMS" [ref=e267]
                      - cell "+221 70 *** ** 04" [ref=e268]
                      - cell "Envoyée" [ref=e269]
                      - cell "—" [ref=e273]
                      - cell [ref=e274]:
                        - 'link "Voir le détail : Code administrateur, sam. 14 nov. 2026 à 00:39" [ref=e275] [cursor=pointer]':
                          - /url: /admin/notifications/43e8f156-bb0d-4988-8c08-cf4102bc910a
                          - generic [ref=e276]: Voir
                    - row [ref=e280]:
                      - cell [ref=e281]:
                        - time [ref=e282]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e283]:
                        - generic [ref=e284]:
                          - generic [ref=e285]: Confirmation d’achat
                          - generic [ref=e286]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e287]
                      - cell "Alioune F." [ref=e288]
                      - cell "Envoyée" [ref=e289]
                      - cell "—" [ref=e293]
                      - cell [ref=e294]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e295] [cursor=pointer]':
                          - /url: /admin/notifications/69ed230e-8428-4119-815f-622bfb4f6e02
                          - generic [ref=e296]: Voir
                    - row [ref=e300]:
                      - cell [ref=e301]:
                        - time [ref=e302]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e303]:
                        - generic [ref=e304]:
                          - generic [ref=e305]: Confirmation d’achat
                          - generic [ref=e306]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e307]
                      - cell "+221 70 *** ** 08" [ref=e308]
                      - cell "Envoyée" [ref=e309]
                      - cell "—" [ref=e313]
                      - cell [ref=e314]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e315] [cursor=pointer]':
                          - /url: /admin/notifications/62fd9d33-6ad9-4416-8bb5-e0d10c865a0f
                          - generic [ref=e316]: Voir
                    - row [ref=e320]:
                      - cell [ref=e321]:
                        - time [ref=e322]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e323]:
                        - generic [ref=e324]:
                          - generic [ref=e325]: Confirmation d’achat
                          - generic [ref=e326]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e327]
                      - cell "Alioune F." [ref=e328]
                      - cell "Non envoyée" [ref=e329]
                      - cell "Adresse email non vérifiée" [ref=e333]
                      - cell [ref=e334]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e335] [cursor=pointer]':
                          - /url: /admin/notifications/4909bf76-3796-4a6d-9a3c-ce57b2cffc93
                          - generic [ref=e336]: Voir
                    - row [ref=e340]:
                      - cell [ref=e341]:
                        - time [ref=e342]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e343]:
                        - generic [ref=e344]:
                          - generic [ref=e345]: Nouvelle commande
                          - generic [ref=e346]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e347]
                      - cell "Ousmane F." [ref=e348]
                      - cell "Envoyée" [ref=e349]
                      - cell "—" [ref=e353]
                      - cell [ref=e354]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e355] [cursor=pointer]':
                          - /url: /admin/notifications/313f84fc-c749-4389-82a9-1b3d6fc44662
                          - generic [ref=e356]: Voir
                    - row [ref=e360]:
                      - cell [ref=e361]:
                        - time [ref=e362]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e363]:
                        - generic [ref=e364]:
                          - generic [ref=e365]: Confirmation d’achat
                          - generic [ref=e366]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e367]
                      - cell "+221 70 *** ** 07" [ref=e368]
                      - cell "Envoyée" [ref=e369]
                      - cell "—" [ref=e373]
                      - cell [ref=e374]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e375] [cursor=pointer]':
                          - /url: /admin/notifications/ca2f15fa-18ad-4e10-a517-bf4c85b90dd1
                          - generic [ref=e376]: Voir
                    - row [ref=e380]:
                      - cell [ref=e381]:
                        - time [ref=e382]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e383]:
                        - generic [ref=e384]:
                          - generic [ref=e385]: Confirmation d’achat
                          - generic [ref=e386]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e387]
                      - cell "Mame N." [ref=e388]
                      - cell "Envoyée" [ref=e389]
                      - cell "—" [ref=e393]
                      - cell [ref=e394]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e395] [cursor=pointer]':
                          - /url: /admin/notifications/c2317a30-c5ca-4a20-8636-e7e551e41184
                          - generic [ref=e396]: Voir
                    - row [ref=e400]:
                      - cell [ref=e401]:
                        - time [ref=e402]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e403]:
                        - generic [ref=e404]:
                          - generic [ref=e405]: Nouvelle commande
                          - generic [ref=e406]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e407]
                      - cell "Ousmane F." [ref=e408]
                      - cell "Envoyée" [ref=e409]
                      - cell "—" [ref=e413]
                      - cell [ref=e414]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e415] [cursor=pointer]':
                          - /url: /admin/notifications/9376a449-c605-4df6-a2d4-0be10ea252da
                          - generic [ref=e416]: Voir
                    - row [ref=e420]:
                      - cell [ref=e421]:
                        - time [ref=e422]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e423]:
                        - generic [ref=e424]:
                          - generic [ref=e425]: Confirmation d’achat
                          - generic [ref=e426]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e427]
                      - cell "Mame N." [ref=e428]
                      - cell "Non envoyée" [ref=e429]
                      - cell "Adresse email non vérifiée" [ref=e433]
                      - cell [ref=e434]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e435] [cursor=pointer]':
                          - /url: /admin/notifications/1a24f37c-8ee6-4c38-bdd9-4d0c5ed009f5
                          - generic [ref=e436]: Voir
                    - row [ref=e440]:
                      - cell [ref=e441]:
                        - time [ref=e442]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e443]:
                        - generic [ref=e444]:
                          - generic [ref=e445]: Confirmation d’achat
                          - generic [ref=e446]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e447]
                      - cell "Babacar D." [ref=e448]
                      - cell "Envoyée" [ref=e449]
                      - cell "—" [ref=e453]
                      - cell [ref=e454]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e455] [cursor=pointer]':
                          - /url: /admin/notifications/b031025d-a158-499d-9556-6118ab68436d
                          - generic [ref=e456]: Voir
                    - row [ref=e460]:
                      - cell [ref=e461]:
                        - time [ref=e462]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e463]:
                        - generic [ref=e464]:
                          - generic [ref=e465]: Confirmation d’achat
                          - generic [ref=e466]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e467]
                      - cell "Babacar D." [ref=e468]
                      - cell "Non envoyée" [ref=e469]
                      - cell "Adresse email non vérifiée" [ref=e473]
                      - cell [ref=e474]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e475] [cursor=pointer]':
                          - /url: /admin/notifications/aab2363b-30f5-4c19-ad7f-27c6adc7238f
                          - generic [ref=e476]: Voir
                    - row [ref=e480]:
                      - cell [ref=e481]:
                        - time [ref=e482]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e483]:
                        - generic [ref=e484]:
                          - generic [ref=e485]: Nouvelle commande
                          - generic [ref=e486]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e487]
                      - cell "Ousmane F." [ref=e488]
                      - cell "Envoyée" [ref=e489]
                      - cell "—" [ref=e493]
                      - cell [ref=e494]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e495] [cursor=pointer]':
                          - /url: /admin/notifications/99567f9e-98a0-454b-858e-c9ca13fb8520
                          - generic [ref=e496]: Voir
                    - row [ref=e500]:
                      - cell [ref=e501]:
                        - time [ref=e502]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e503]:
                        - generic [ref=e504]:
                          - generic [ref=e505]: Confirmation d’achat
                          - generic [ref=e506]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e507]
                      - cell "+221 70 *** ** 06" [ref=e508]
                      - cell "Envoyée" [ref=e509]
                      - cell "—" [ref=e513]
                      - cell [ref=e514]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e515] [cursor=pointer]':
                          - /url: /admin/notifications/149d093f-2773-47d4-9b28-a0c5727881f0
                          - generic [ref=e516]: Voir
                    - row [ref=e520]:
                      - cell [ref=e521]:
                        - time [ref=e522]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e523]:
                        - generic [ref=e524]:
                          - generic [ref=e525]: Confirmation d’achat
                          - generic [ref=e526]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e527]
                      - cell "Ndeye T." [ref=e528]
                      - cell "Non envoyée" [ref=e529]
                      - cell "Adresse email non vérifiée" [ref=e533]
                      - cell [ref=e534]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e535] [cursor=pointer]':
                          - /url: /admin/notifications/cf9b5ad7-eee0-4375-acc2-3348d4d61469
                          - generic [ref=e536]: Voir
                    - row [ref=e540]:
                      - cell [ref=e541]:
                        - time [ref=e542]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e543]:
                        - generic [ref=e544]:
                          - generic [ref=e545]: Nouvelle commande
                          - generic [ref=e546]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e547]
                      - cell "Ousmane F." [ref=e548]
                      - cell "Envoyée" [ref=e549]
                      - cell "—" [ref=e553]
                      - cell [ref=e554]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e555] [cursor=pointer]':
                          - /url: /admin/notifications/7f7d8534-5942-498b-adf6-28fbdf8b6656
                          - generic [ref=e556]: Voir
                    - row [ref=e560]:
                      - cell [ref=e561]:
                        - time [ref=e562]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e563]:
                        - generic [ref=e564]:
                          - generic [ref=e565]: Confirmation d’achat
                          - generic [ref=e566]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e567]
                      - cell "Ndeye T." [ref=e568]
                      - cell "Envoyée" [ref=e569]
                      - cell "—" [ref=e573]
                      - cell [ref=e574]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e575] [cursor=pointer]':
                          - /url: /admin/notifications/2518c89a-6ae8-413f-9b4d-3da91a7ca2d4
                          - generic [ref=e576]: Voir
                    - row [ref=e580]:
                      - cell [ref=e581]:
                        - time [ref=e582]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e583]:
                        - generic [ref=e584]:
                          - generic [ref=e585]: Confirmation d’achat
                          - generic [ref=e586]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e587]
                      - cell "+221 70 *** ** 05" [ref=e588]
                      - cell "Envoyée" [ref=e589]
                      - cell "—" [ref=e593]
                      - cell [ref=e594]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e595] [cursor=pointer]':
                          - /url: /admin/notifications/0524f1a0-deba-4fb7-aa39-1a658f090222
                          - generic [ref=e596]: Voir
                    - row [ref=e600]:
                      - cell [ref=e601]:
                        - time [ref=e602]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e603]:
                        - generic [ref=e604]:
                          - generic [ref=e605]: Confirmation d’achat
                          - generic [ref=e606]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e607]
                      - cell "Cheikh S." [ref=e608]
                      - cell "Envoyée" [ref=e609]
                      - cell "—" [ref=e613]
                      - cell [ref=e614]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e615] [cursor=pointer]':
                          - /url: /admin/notifications/e8fc8026-adf1-4223-963b-d62f4df7287b
                          - generic [ref=e616]: Voir
                    - row [ref=e620]:
                      - cell [ref=e621]:
                        - time [ref=e622]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e623]:
                        - generic [ref=e624]:
                          - generic [ref=e625]: Nouvelle commande
                          - generic [ref=e626]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e627]
                      - cell "Ousmane F." [ref=e628]
                      - cell "Envoyée" [ref=e629]
                      - cell "—" [ref=e633]
                      - cell [ref=e634]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e635] [cursor=pointer]':
                          - /url: /admin/notifications/e2f40c6a-7e73-4e7b-86ec-8907b8a0f013
                          - generic [ref=e636]: Voir
                - navigation "Pages des notifications" [ref=e640]:
                  - button "Précédent" [disabled] [ref=e641]
                  - paragraph [ref=e646]:
                    - text: Page 1 sur 67
                    - generic [ref=e647]: · 1 325 résultats
                  - button "Suivant" [ref=e648] [cursor=pointer]
          - region [ref=e653]:
            - generic [ref=e654]:
              - heading "Par jour et par canal" [level=2] [ref=e655]
              - paragraph [ref=e656]: 14 derniers jours, heure de Dakar.
            - table [ref=e659]:
              - caption [ref=e660]: Notifications par jour et par canal
              - rowgroup [ref=e661]:
                - row [ref=e662]:
                  - columnheader "Jour" [ref=e663]
                  - columnheader "Canal" [ref=e664]
                  - columnheader "Envoyées" [ref=e665]
                  - columnheader "En échec" [ref=e666]
                  - columnheader "Non envoyées" [ref=e667]
                  - columnheader "Incertaines" [ref=e668]
                  - columnheader "Annulées" [ref=e669]
              - rowgroup [ref=e670]:
                - row [ref=e671]:
                  - cell "14 nov. 2026" [ref=e672]
                  - cell "Email" [ref=e673]
                  - cell "0" [ref=e674]
                  - cell "0" [ref=e675]
                  - cell "377" [ref=e676]
                  - cell "0" [ref=e677]
                  - cell "0" [ref=e678]
                - row [ref=e679]:
                  - cell "14 nov. 2026" [ref=e680]
                  - cell "Application" [ref=e681]
                  - cell "463" [ref=e682]
                  - cell "0" [ref=e683]
                  - cell "0" [ref=e684]
                  - cell "0" [ref=e685]
                  - cell "3" [ref=e686]
                - row [ref=e687]:
                  - cell "14 nov. 2026" [ref=e688]
                  - cell "Notification push" [ref=e689]
                  - cell "0" [ref=e690]
                  - cell "0" [ref=e691]
                  - cell "123" [ref=e692]
                  - cell "0" [ref=e693]
                  - cell "3" [ref=e694]
                - row [ref=e695]:
                  - cell "14 nov. 2026" [ref=e696]
                  - cell "SMS" [ref=e697]
                  - cell "193" [ref=e698]
                  - cell "1" [ref=e699]
                  - cell "17" [ref=e700]
                  - cell "1" [ref=e701]
                  - cell "3" [ref=e702]
  - alert [ref=e703]
```

# Test source

```ts
  215 |     }, payload);
  216 | }
  217 | 
  218 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  219 | async function expectScanResult(page: Page, result: string): Promise<void> {
  220 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
  221 | }
  222 | 
  223 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  224 | function demoPayload(c: ScreenContext): string {
  225 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  226 | }
  227 | 
  228 | const SCAN_URL = /\/api\/controller\/scan$/;
  229 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  230 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  231 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  232 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  233 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  234 | 
  235 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  236 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  237 |     const result = String(body.result);
  238 |     return {
  239 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  240 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  241 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  242 |         ready: async ({ page }) => startScanner(page),
  243 |         actions: async (c) => {
  244 |             await presentToFakeDetector(c.page, demoPayload(c));
  245 |             await expectScanResult(c.page, result);
  246 |         },
  247 |     };
  248 | }
  249 | 
  250 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  251 | function offlineLink(page: Page, ticketId: string): Locator {
  252 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  253 | }
  254 | 
  255 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  256 | 
  257 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  258 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  259 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  260 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  261 |     return counters;
  262 | }
  263 | 
  264 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  265 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  266 |     await expectHeading(page, /^préférences de notification$/i);
  267 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  268 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  269 | }
  270 | 
  271 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  272 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  273 |     const counters = await fakePushCounters(page);
  274 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  275 | }
  276 | 
  277 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  278 | 
  279 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  280 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  281 | 
  282 | function cdpKids(node: CdpNode): CdpNode[] {
  283 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  284 | }
  285 | 
  286 | function findDateInput(node: CdpNode): CdpNode | null {
  287 |     const attrs = node.attributes ?? [];
  288 |     if (node.nodeName === 'INPUT') {
  289 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  290 |     }
  291 |     for (const kid of cdpKids(node)) {
  292 |         const found = findDateInput(kid);
  293 |         if (found) return found;
  294 |     }
  295 |     return null;
  296 | }
  297 | 
  298 | function cdpText(node: CdpNode): string {
  299 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  300 |     return own + cdpKids(node).map(cdpText).join('');
  301 | }
  302 | 
  303 | /**
  304 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  305 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  306 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  307 |  */
  308 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  309 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  310 |     const cdp = await c.context.newCDPSession(c.page);
  311 |     try {
  312 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  313 |         const input = findDateInput(root);
  314 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
> 315 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
      |                                                                                ^ Error: gabarit du champ de date, lu par CDP (8.2 t)
  316 |     } finally {
  317 |         await cdp.detach();
  318 |     }
  319 | }
  320 | 
  321 | /** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
  322 | async function fontSizePx(target: Locator): Promise<number> {
  323 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  324 | }
  325 | 
  326 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  327 | async function openTicketingStep(page: Page): Promise<void> {
  328 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  329 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  330 | }
  331 | 
  332 | const ONLINE_BOX = /^vendue en ligne/i;
  333 | const COUNTER_BOX = /^vendue au guichet/i;
  334 | 
  335 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  336 | function categorySections(page: Page): Locator {
  337 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  338 | }
  339 | 
  340 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  341 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  342 | /** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
  343 | const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
  344 | /**
  345 |  * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
  346 |  * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
  347 |  * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
  348 |  * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
  349 |  */
  350 | const CASHOUTS_TO_RESUME = {
  351 |     items: [
  352 |         {
  353 |             id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
  354 |             since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
  355 |             block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  356 |         },
  357 |         {
  358 |             id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
  359 |             since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
  360 |             block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  361 |         },
  362 |         {
  363 |             id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
  364 |             since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
  365 |             block_label: null, can_resend: false, can_mark_paid: true, can_mark_not_sent: true, advice: ADVICE_UNCERTAIN_NO_ID,
  366 |         },
  367 |         {
  368 |             id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
  369 |             since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
  370 |             block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  371 |         },
  372 |         {
  373 |             id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
  374 |             since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
  375 |             block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, can_mark_not_sent: false, advice: null,
  376 |         },
  377 |     ],
  378 |     total: 5,
  379 | };
  380 | const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
  381 | const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
  382 | /** Lot 9 ter (A.2.3, A.2.6) : « Constater non versé » sur la seule ligne INCERTAIN sans identifiant SamirPay (SUPERADMIN). */
  383 | const CASHOUTS_NOT_SENT = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_not_sent).length;
  384 | const EMPTY_RECONCILIATION = {
  385 |     summary: {
  386 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  387 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  388 |     },
  389 |     items: [],
  390 |     // Lot 9 bis (H6, contrat 4.1), relecture des captures du run 121 : sans ces champs, readCashoutFees (app/admin/finance/page.tsx)
  391 |     // affichait « Frais SamirPay non disponibles » sur la capture. Forme de cashoutFeeReconciliation (lib/admin/finance-reconciliation.ts) ;
  392 |     // cashinNote recopie CASHIN_FEES_NOTE. Aucun versement à la page : 12 versements aux frais connus, 280 000 F CFA au taux de 1,5 %.
  393 |     cashoutFeesReal: 4290,
  394 |     cashoutFeesEstimated: 4200,
  395 |     gap: 90,
  396 |     cashoutFeeRate: 1.5,
  397 |     cashoutCount: 12,
  398 |     cashinFeesReal: null,
  399 |     cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
  400 | };
  401 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  402 | const CASHOUTS_STUBS: StubResponse[] = [
  403 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  404 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  405 | ];
  406 | 
  407 | /**
  408 |  * Lot 9 bis : « Versements à reprendre » de /admin/finance (RefundsToRetry, contrat 5.1) chargé : titre exact, ligne
  409 |  * « Retrait » (retraits compris, R10), conseil exact d'un versement incertain sans identifiant (B2), puis un bouton
  410 |  * « Renvoyer » par ligne où can_resend n'est pas faux et un « Marquer versé » par ligne où can_mark_paid est vrai
  411 |  * (R51 : boutons conditionnés), et plus aucun « Relancer » (route retry supprimée, B4). Lot 9 ter (A.2.6) : un
  412 |  * « Constater non versé » par ligne où can_mark_not_sent est vrai (jamais grisé, absent ailleurs).
  413 |  */
  414 | async function cashoutsReady(page: Page): Promise<{ resend: Locator; markPaid: Locator; markNotSent: Locator }> {
  415 |     await expect(page.getByRole('heading', { name: /^versements à reprendre$/i })).toBeVisible();
```