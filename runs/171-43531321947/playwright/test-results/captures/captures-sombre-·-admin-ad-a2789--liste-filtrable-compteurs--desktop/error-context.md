# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · admin >> admin-notifications — Administration — supervision des notifications (liste filtrable, compteurs)
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
          - button "Basculer le thème" [pressed] [ref=e106] [cursor=pointer]
    - generic [ref=e114]:
      - banner [ref=e115]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e117] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 40 non lues" [ref=e124] [cursor=pointer]:
          - generic [ref=e128]: "40"
      - main [ref=e129]:
        - generic [ref=e131]:
          - generic [ref=e134]:
            - status [ref=e136]: En direct
            - heading "Notifications" [level=1] [ref=e138]
            - paragraph [ref=e139]: "Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar."
          - region [ref=e140]:
            - heading "Compteurs" [level=2] [ref=e141]
            - generic [ref=e142]:
              - generic [ref=e143]:
                - paragraph [ref=e145]: SMS aujourd'hui
                - paragraph [ref=e149]: "194"
                - paragraph [ref=e150]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=e151]:
                - paragraph [ref=e153]: SMS optionnels aujourd'hui
                - paragraph [ref=e158]: "0"
                - paragraph [ref=e159]: "Plafond : 700 par jour, alerte à 560."
              - generic [ref=e160]:
                - paragraph [ref=e162]: SMS ce mois-ci
                - paragraph [ref=e169]: "194"
                - paragraph [ref=e170]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=e171]:
            - heading "Envois" [level=2] [ref=e172]
            - tablist "Filtrer par statut" [ref=e175]:
              - tab "Toutes" [selected] [ref=e176] [cursor=pointer]
              - tab "En attente , 125" [ref=e178] [cursor=pointer]:
                - generic [ref=e179]: En attente
                - generic [ref=e180]:
                  - generic [ref=e181]: ","
                  - text: "125"
              - tab "En cours d'envoi , 0" [ref=e182] [cursor=pointer]:
                - generic [ref=e183]: En cours d'envoi
                - generic [ref=e184]:
                  - generic [ref=e185]: ","
                  - text: "0"
              - tab "Envoyée , 656" [ref=e186] [cursor=pointer]:
                - generic [ref=e187]: Envoyée
                - generic [ref=e188]:
                  - generic [ref=e189]: ","
                  - text: "656"
              - tab "En échec , 1" [ref=e190] [cursor=pointer]:
                - generic [ref=e191]: En échec
                - generic [ref=e192]:
                  - generic [ref=e193]: ","
                  - text: "1"
              - tab "Non envoyée , 533" [ref=e194] [cursor=pointer]:
                - generic [ref=e195]: Non envoyée
                - generic [ref=e196]:
                  - generic [ref=e197]: ","
                  - text: "533"
              - tab "Annulée , 9" [ref=e198] [cursor=pointer]:
                - generic [ref=e199]: Annulée
                - generic [ref=e200]:
                  - generic [ref=e201]: ","
                  - text: "9"
              - tab "Incertaine , 1" [ref=e202] [cursor=pointer]:
                - generic [ref=e203]: Incertaine
                - generic [ref=e204]:
                  - generic [ref=e205]: ","
                  - text: "1"
            - search [ref=e206]:
              - generic [ref=e207]:
                - generic [ref=e208]: Rechercher
                - searchbox "Rechercher" [ref=e210]
              - generic [ref=e211]:
                - generic [ref=e212]: Canal
                - combobox "Canal" [ref=e215] [cursor=pointer]:
                  - option "Tous les canaux" [selected]
                  - option "Application"
                  - option "SMS"
                  - option "Email"
                  - option "Notification push"
              - generic [ref=e216]:
                - generic [ref=e217]: Type
                - combobox "Type" [ref=e220] [cursor=pointer]:
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
              - generic [ref=e221]:
                - generic [ref=e222]:
                  - generic [ref=e223]: Du
                  - textbox "Du" [ref=e225]
                - generic [ref=e226]:
                  - generic [ref=e227]: Au
                  - textbox "Au" [ref=e229]
            - tabpanel "Toutes" [ref=e230]:
              - generic [ref=e231]:
                - table [ref=e234]:
                  - caption [ref=e235]: Notifications de la boîte d’envoi
                  - rowgroup [ref=e236]:
                    - row [ref=e237]:
                      - columnheader "Date" [ref=e238]
                      - columnheader "Type" [ref=e239]
                      - columnheader "Canal" [ref=e240]
                      - columnheader "Destinataire" [ref=e241]
                      - columnheader "Statut" [ref=e242]
                      - columnheader "Motif" [ref=e243]
                      - columnheader "Détail" [ref=e244]
                  - rowgroup [ref=e245]:
                    - row [ref=e246]:
                      - cell [ref=e247]:
                        - time [ref=e248]: sam. 14 nov. 2026 à 00:39
                      - cell "Code administrateur" [ref=e249]
                      - cell "SMS" [ref=e252]
                      - cell "+221 70 *** ** 07" [ref=e253]
                      - cell "Envoyée" [ref=e254]
                      - cell "—" [ref=e258]
                      - cell [ref=e259]:
                        - 'link "Voir le détail : Code administrateur, sam. 14 nov. 2026 à 00:39" [ref=e260] [cursor=pointer]':
                          - /url: /admin/notifications/2648ec31-165e-4f41-96da-28b61ea1f272
                          - generic [ref=e261]: Voir
                    - row [ref=e265]:
                      - cell [ref=e266]:
                        - time [ref=e267]: sam. 14 nov. 2026 à 00:39
                      - cell "Code administrateur" [ref=e268]
                      - cell "SMS" [ref=e271]
                      - cell "+221 70 *** ** 04" [ref=e272]
                      - cell "Envoyée" [ref=e273]
                      - cell "—" [ref=e277]
                      - cell [ref=e278]:
                        - 'link "Voir le détail : Code administrateur, sam. 14 nov. 2026 à 00:39" [ref=e279] [cursor=pointer]':
                          - /url: /admin/notifications/43e8f156-bb0d-4988-8c08-cf4102bc910a
                          - generic [ref=e280]: Voir
                    - row [ref=e284]:
                      - cell [ref=e285]:
                        - time [ref=e286]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e287]:
                        - generic [ref=e288]:
                          - generic [ref=e289]: Confirmation d’achat
                          - generic [ref=e290]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e291]
                      - cell "Alioune F." [ref=e292]
                      - cell "Envoyée" [ref=e293]
                      - cell "—" [ref=e297]
                      - cell [ref=e298]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e299] [cursor=pointer]':
                          - /url: /admin/notifications/69ed230e-8428-4119-815f-622bfb4f6e02
                          - generic [ref=e300]: Voir
                    - row [ref=e304]:
                      - cell [ref=e305]:
                        - time [ref=e306]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e307]:
                        - generic [ref=e308]:
                          - generic [ref=e309]: Confirmation d’achat
                          - generic [ref=e310]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e311]
                      - cell "+221 70 *** ** 08" [ref=e312]
                      - cell "Envoyée" [ref=e313]
                      - cell "—" [ref=e317]
                      - cell [ref=e318]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e319] [cursor=pointer]':
                          - /url: /admin/notifications/62fd9d33-6ad9-4416-8bb5-e0d10c865a0f
                          - generic [ref=e320]: Voir
                    - row [ref=e324]:
                      - cell [ref=e325]:
                        - time [ref=e326]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e327]:
                        - generic [ref=e328]:
                          - generic [ref=e329]: Confirmation d’achat
                          - generic [ref=e330]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e331]
                      - cell "Alioune F." [ref=e332]
                      - cell "Non envoyée" [ref=e333]
                      - cell "Adresse email non vérifiée" [ref=e337]
                      - cell [ref=e338]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e339] [cursor=pointer]':
                          - /url: /admin/notifications/4909bf76-3796-4a6d-9a3c-ce57b2cffc93
                          - generic [ref=e340]: Voir
                    - row [ref=e344]:
                      - cell [ref=e345]:
                        - time [ref=e346]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e347]:
                        - generic [ref=e348]:
                          - generic [ref=e349]: Nouvelle commande
                          - generic [ref=e350]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e351]
                      - cell "Ousmane F." [ref=e352]
                      - cell "Envoyée" [ref=e353]
                      - cell "—" [ref=e357]
                      - cell [ref=e358]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e359] [cursor=pointer]':
                          - /url: /admin/notifications/313f84fc-c749-4389-82a9-1b3d6fc44662
                          - generic [ref=e360]: Voir
                    - row [ref=e364]:
                      - cell [ref=e365]:
                        - time [ref=e366]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e367]:
                        - generic [ref=e368]:
                          - generic [ref=e369]: Confirmation d’achat
                          - generic [ref=e370]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e371]
                      - cell "+221 70 *** ** 07" [ref=e372]
                      - cell "Envoyée" [ref=e373]
                      - cell "—" [ref=e377]
                      - cell [ref=e378]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e379] [cursor=pointer]':
                          - /url: /admin/notifications/ca2f15fa-18ad-4e10-a517-bf4c85b90dd1
                          - generic [ref=e380]: Voir
                    - row [ref=e384]:
                      - cell [ref=e385]:
                        - time [ref=e386]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e387]:
                        - generic [ref=e388]:
                          - generic [ref=e389]: Confirmation d’achat
                          - generic [ref=e390]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e391]
                      - cell "Mame N." [ref=e392]
                      - cell "Envoyée" [ref=e393]
                      - cell "—" [ref=e397]
                      - cell [ref=e398]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e399] [cursor=pointer]':
                          - /url: /admin/notifications/c2317a30-c5ca-4a20-8636-e7e551e41184
                          - generic [ref=e400]: Voir
                    - row [ref=e404]:
                      - cell [ref=e405]:
                        - time [ref=e406]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e407]:
                        - generic [ref=e408]:
                          - generic [ref=e409]: Nouvelle commande
                          - generic [ref=e410]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e411]
                      - cell "Ousmane F." [ref=e412]
                      - cell "Envoyée" [ref=e413]
                      - cell "—" [ref=e417]
                      - cell [ref=e418]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e419] [cursor=pointer]':
                          - /url: /admin/notifications/9376a449-c605-4df6-a2d4-0be10ea252da
                          - generic [ref=e420]: Voir
                    - row [ref=e424]:
                      - cell [ref=e425]:
                        - time [ref=e426]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e427]:
                        - generic [ref=e428]:
                          - generic [ref=e429]: Confirmation d’achat
                          - generic [ref=e430]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e431]
                      - cell "Mame N." [ref=e432]
                      - cell "Non envoyée" [ref=e433]
                      - cell "Adresse email non vérifiée" [ref=e437]
                      - cell [ref=e438]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e439] [cursor=pointer]':
                          - /url: /admin/notifications/1a24f37c-8ee6-4c38-bdd9-4d0c5ed009f5
                          - generic [ref=e440]: Voir
                    - row [ref=e444]:
                      - cell [ref=e445]:
                        - time [ref=e446]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e447]:
                        - generic [ref=e448]:
                          - generic [ref=e449]: Confirmation d’achat
                          - generic [ref=e450]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e451]
                      - cell "Babacar D." [ref=e452]
                      - cell "Envoyée" [ref=e453]
                      - cell "—" [ref=e457]
                      - cell [ref=e458]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e459] [cursor=pointer]':
                          - /url: /admin/notifications/b031025d-a158-499d-9556-6118ab68436d
                          - generic [ref=e460]: Voir
                    - row [ref=e464]:
                      - cell [ref=e465]:
                        - time [ref=e466]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e467]:
                        - generic [ref=e468]:
                          - generic [ref=e469]: Confirmation d’achat
                          - generic [ref=e470]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e471]
                      - cell "Babacar D." [ref=e472]
                      - cell "Non envoyée" [ref=e473]
                      - cell "Adresse email non vérifiée" [ref=e477]
                      - cell [ref=e478]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e479] [cursor=pointer]':
                          - /url: /admin/notifications/aab2363b-30f5-4c19-ad7f-27c6adc7238f
                          - generic [ref=e480]: Voir
                    - row [ref=e484]:
                      - cell [ref=e485]:
                        - time [ref=e486]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e487]:
                        - generic [ref=e488]:
                          - generic [ref=e489]: Nouvelle commande
                          - generic [ref=e490]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e491]
                      - cell "Ousmane F." [ref=e492]
                      - cell "Envoyée" [ref=e493]
                      - cell "—" [ref=e497]
                      - cell [ref=e498]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e499] [cursor=pointer]':
                          - /url: /admin/notifications/99567f9e-98a0-454b-858e-c9ca13fb8520
                          - generic [ref=e500]: Voir
                    - row [ref=e504]:
                      - cell [ref=e505]:
                        - time [ref=e506]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e507]:
                        - generic [ref=e508]:
                          - generic [ref=e509]: Confirmation d’achat
                          - generic [ref=e510]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e511]
                      - cell "+221 70 *** ** 06" [ref=e512]
                      - cell "Envoyée" [ref=e513]
                      - cell "—" [ref=e517]
                      - cell [ref=e518]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e519] [cursor=pointer]':
                          - /url: /admin/notifications/149d093f-2773-47d4-9b28-a0c5727881f0
                          - generic [ref=e520]: Voir
                    - row [ref=e524]:
                      - cell [ref=e525]:
                        - time [ref=e526]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e527]:
                        - generic [ref=e528]:
                          - generic [ref=e529]: Confirmation d’achat
                          - generic [ref=e530]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e531]
                      - cell "Ndeye T." [ref=e532]
                      - cell "Non envoyée" [ref=e533]
                      - cell "Adresse email non vérifiée" [ref=e537]
                      - cell [ref=e538]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e539] [cursor=pointer]':
                          - /url: /admin/notifications/cf9b5ad7-eee0-4375-acc2-3348d4d61469
                          - generic [ref=e540]: Voir
                    - row [ref=e544]:
                      - cell [ref=e545]:
                        - time [ref=e546]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e547]:
                        - generic [ref=e548]:
                          - generic [ref=e549]: Nouvelle commande
                          - generic [ref=e550]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e551]
                      - cell "Ousmane F." [ref=e552]
                      - cell "Envoyée" [ref=e553]
                      - cell "—" [ref=e557]
                      - cell [ref=e558]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e559] [cursor=pointer]':
                          - /url: /admin/notifications/7f7d8534-5942-498b-adf6-28fbdf8b6656
                          - generic [ref=e560]: Voir
                    - row [ref=e564]:
                      - cell [ref=e565]:
                        - time [ref=e566]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e567]:
                        - generic [ref=e568]:
                          - generic [ref=e569]: Confirmation d’achat
                          - generic [ref=e570]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e571]
                      - cell "Ndeye T." [ref=e572]
                      - cell "Envoyée" [ref=e573]
                      - cell "—" [ref=e577]
                      - cell [ref=e578]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e579] [cursor=pointer]':
                          - /url: /admin/notifications/2518c89a-6ae8-413f-9b4d-3da91a7ca2d4
                          - generic [ref=e580]: Voir
                    - row [ref=e584]:
                      - cell [ref=e585]:
                        - time [ref=e586]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e587]:
                        - generic [ref=e588]:
                          - generic [ref=e589]: Confirmation d’achat
                          - generic [ref=e590]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e591]
                      - cell "+221 70 *** ** 05" [ref=e592]
                      - cell "Envoyée" [ref=e593]
                      - cell "—" [ref=e597]
                      - cell [ref=e598]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e599] [cursor=pointer]':
                          - /url: /admin/notifications/0524f1a0-deba-4fb7-aa39-1a658f090222
                          - generic [ref=e600]: Voir
                    - row [ref=e604]:
                      - cell [ref=e605]:
                        - time [ref=e606]: sam. 14 nov. 2026 à 00:39
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e607]:
                        - generic [ref=e608]:
                          - generic [ref=e609]: Confirmation d’achat
                          - generic [ref=e610]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e611]
                      - cell "Cheikh S." [ref=e612]
                      - cell "Envoyée" [ref=e613]
                      - cell "—" [ref=e617]
                      - cell [ref=e618]:
                        - 'link "Voir le détail : Confirmation d’achat, sam. 14 nov. 2026 à 00:39" [ref=e619] [cursor=pointer]':
                          - /url: /admin/notifications/e8fc8026-adf1-4223-963b-d62f4df7287b
                          - generic [ref=e620]: Voir
                    - row [ref=e624]:
                      - cell [ref=e625]:
                        - time [ref=e626]: sam. 14 nov. 2026 à 00:39
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e627]:
                        - generic [ref=e628]:
                          - generic [ref=e629]: Nouvelle commande
                          - generic [ref=e630]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e631]
                      - cell "Ousmane F." [ref=e632]
                      - cell "Envoyée" [ref=e633]
                      - cell "—" [ref=e637]
                      - cell [ref=e638]:
                        - 'link "Voir le détail : Nouvelle commande, sam. 14 nov. 2026 à 00:39" [ref=e639] [cursor=pointer]':
                          - /url: /admin/notifications/e2f40c6a-7e73-4e7b-86ec-8907b8a0f013
                          - generic [ref=e640]: Voir
                - navigation "Pages des notifications" [ref=e644]:
                  - button "Précédent" [disabled] [ref=e645]
                  - paragraph [ref=e650]:
                    - text: Page 1 sur 67
                    - generic [ref=e651]: · 1 325 résultats
                  - button "Suivant" [ref=e652] [cursor=pointer]
          - region [ref=e657]:
            - generic [ref=e658]:
              - heading "Par jour et par canal" [level=2] [ref=e659]
              - paragraph [ref=e660]: 14 derniers jours, heure de Dakar.
            - table [ref=e663]:
              - caption [ref=e664]: Notifications par jour et par canal
              - rowgroup [ref=e665]:
                - row [ref=e666]:
                  - columnheader "Jour" [ref=e667]
                  - columnheader "Canal" [ref=e668]
                  - columnheader "Envoyées" [ref=e669]
                  - columnheader "En échec" [ref=e670]
                  - columnheader "Non envoyées" [ref=e671]
                  - columnheader "Incertaines" [ref=e672]
                  - columnheader "Annulées" [ref=e673]
              - rowgroup [ref=e674]:
                - row [ref=e675]:
                  - cell "14 nov. 2026" [ref=e676]
                  - cell "Email" [ref=e677]
                  - cell "0" [ref=e678]
                  - cell "0" [ref=e679]
                  - cell "377" [ref=e680]
                  - cell "0" [ref=e681]
                  - cell "0" [ref=e682]
                - row [ref=e683]:
                  - cell "14 nov. 2026" [ref=e684]
                  - cell "Application" [ref=e685]
                  - cell "463" [ref=e686]
                  - cell "0" [ref=e687]
                  - cell "0" [ref=e688]
                  - cell "0" [ref=e689]
                  - cell "3" [ref=e690]
                - row [ref=e691]:
                  - cell "14 nov. 2026" [ref=e692]
                  - cell "Notification push" [ref=e693]
                  - cell "0" [ref=e694]
                  - cell "0" [ref=e695]
                  - cell "123" [ref=e696]
                  - cell "0" [ref=e697]
                  - cell "3" [ref=e698]
                - row [ref=e699]:
                  - cell "14 nov. 2026" [ref=e700]
                  - cell "SMS" [ref=e701]
                  - cell "193" [ref=e702]
                  - cell "1" [ref=e703]
                  - cell "17" [ref=e704]
                  - cell "1" [ref=e705]
                  - cell "3" [ref=e706]
  - alert [ref=e707]
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