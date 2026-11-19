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
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e88] [cursor=pointer]:
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
                - paragraph [ref=e120]: "213"
                - paragraph [ref=e121]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=e122]:
                - paragraph [ref=e124]: SMS optionnels aujourd'hui
                - paragraph [ref=e129]: "17"
                - paragraph [ref=e130]: "Plafond : 700 par jour, alerte à 560."
              - generic [ref=e131]:
                - paragraph [ref=e133]: SMS ce mois-ci
                - paragraph [ref=e140]: "213"
                - paragraph [ref=e141]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=e142]:
            - heading "Envois" [level=2] [ref=e143]
            - tablist "Filtrer par statut" [ref=e146]:
              - tab "Toutes" [selected] [ref=e147] [cursor=pointer]
              - tab "En attente , 123" [ref=e149] [cursor=pointer]:
                - generic [ref=e150]: En attente
                - generic [ref=e151]:
                  - generic [ref=e152]: ","
                  - text: "123"
              - tab "En cours d'envoi , 0" [ref=e153] [cursor=pointer]:
                - generic [ref=e154]: En cours d'envoi
                - generic [ref=e155]:
                  - generic [ref=e156]: ","
                  - text: "0"
              - tab "Envoyée , 675" [ref=e157] [cursor=pointer]:
                - generic [ref=e158]: Envoyée
                - generic [ref=e159]:
                  - generic [ref=e160]: ","
                  - text: "675"
              - tab "En échec , 1" [ref=e161] [cursor=pointer]:
                - generic [ref=e162]: En échec
                - generic [ref=e163]:
                  - generic [ref=e164]: ","
                  - text: "1"
              - tab "Non envoyée , 516" [ref=e165] [cursor=pointer]:
                - generic [ref=e166]: Non envoyée
                - generic [ref=e167]:
                  - generic [ref=e168]: ","
                  - text: "516"
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
                  - option "Mise en avant décidée"
                  - option "Mot de passe modifié"
                  - option "Notification d'essai"
                  - option "Notification en échec"
                  - option "Nouveau Superadmin (alerte)"
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
                  - option "Réservation de salle annulée"
                  - option "Réservation de salle annulée (salle)"
                  - option "Réservation de salle confirmée"
                  - option "Réservation de salle demandée"
                  - option "Réservation de table annulée"
                  - option "Réservation de table annulée (établissement)"
                  - option "Réservation de table confirmée"
                  - option "Retrait en vérification"
                  - option "Retrait refusé"
                  - option "Retrait refusé par l'opérateur"
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
                        - time [ref=e219]: jeu. 19 nov. 2026 à 12:51
                      - cell "Code administrateur" [ref=e220]
                      - cell "SMS" [ref=e223]
                      - cell "+221 70 *** ** 07" [ref=e224]
                      - cell "Envoyée" [ref=e225]
                      - cell "—" [ref=e229]
                      - cell [ref=e230]:
                        - 'link "Voir le détail : Code administrateur, jeu. 19 nov. 2026 à 12:51" [ref=e231] [cursor=pointer]':
                          - /url: /admin/notifications/0a5f0328-b4fe-4e0a-a16d-e0a4ee850c4f
                          - generic [ref=e232]: Voir
                    - row [ref=e236]:
                      - cell [ref=e237]:
                        - time [ref=e238]: jeu. 19 nov. 2026 à 12:51
                      - cell "Code administrateur" [ref=e239]
                      - cell "SMS" [ref=e242]
                      - cell "+221 70 *** ** 04" [ref=e243]
                      - cell "Envoyée" [ref=e244]
                      - cell "—" [ref=e248]
                      - cell [ref=e249]:
                        - 'link "Voir le détail : Code administrateur, jeu. 19 nov. 2026 à 12:51" [ref=e250] [cursor=pointer]':
                          - /url: /admin/notifications/85c7b8ee-35b6-41df-867d-730e3eab6c14
                          - generic [ref=e251]: Voir
                    - row [ref=e255]:
                      - cell [ref=e256]:
                        - time [ref=e257]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e258]:
                        - generic [ref=e259]:
                          - generic [ref=e260]: Confirmation d’achat
                          - generic [ref=e261]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e262]
                      - cell "+221 70 *** ** 08" [ref=e263]
                      - cell "Envoyée" [ref=e264]
                      - cell "—" [ref=e268]
                      - cell [ref=e269]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e270] [cursor=pointer]':
                          - /url: /admin/notifications/d6217661-4c50-4c30-a2f2-595e1040ab3c
                          - generic [ref=e271]: Voir
                    - row [ref=e275]:
                      - cell [ref=e276]:
                        - time [ref=e277]: jeu. 19 nov. 2026 à 12:50
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e278]:
                        - generic [ref=e279]:
                          - generic [ref=e280]: Nouvelle commande
                          - generic [ref=e281]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e282]
                      - cell "Ousmane F." [ref=e283]
                      - cell "Envoyée" [ref=e284]
                      - cell "—" [ref=e288]
                      - cell [ref=e289]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 12:50" [ref=e290] [cursor=pointer]':
                          - /url: /admin/notifications/8caae1d3-e327-49f4-9845-26c4d2965e8f
                          - generic [ref=e291]: Voir
                    - row [ref=e295]:
                      - cell [ref=e296]:
                        - time [ref=e297]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e298]:
                        - generic [ref=e299]:
                          - generic [ref=e300]: Confirmation d’achat
                          - generic [ref=e301]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e302]
                      - cell "Alioune F." [ref=e303]
                      - cell "Non envoyée" [ref=e304]
                      - cell "Adresse email non vérifiée" [ref=e308]
                      - cell [ref=e309]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e310] [cursor=pointer]':
                          - /url: /admin/notifications/26494436-926d-442e-9fa1-795dff314cf3
                          - generic [ref=e311]: Voir
                    - row [ref=e315]:
                      - cell [ref=e316]:
                        - time [ref=e317]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e318]:
                        - generic [ref=e319]:
                          - generic [ref=e320]: Confirmation d’achat
                          - generic [ref=e321]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e322]
                      - cell "Alioune F." [ref=e323]
                      - cell "Envoyée" [ref=e324]
                      - cell "—" [ref=e328]
                      - cell [ref=e329]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e330] [cursor=pointer]':
                          - /url: /admin/notifications/032e523c-beee-4820-ba1e-9d5246d76d1a
                          - generic [ref=e331]: Voir
                    - row [ref=e335]:
                      - cell [ref=e336]:
                        - time [ref=e337]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e338]:
                        - generic [ref=e339]:
                          - generic [ref=e340]: Confirmation d’achat
                          - generic [ref=e341]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e342]
                      - cell "+221 70 *** ** 07" [ref=e343]
                      - cell "Envoyée" [ref=e344]
                      - cell "—" [ref=e348]
                      - cell [ref=e349]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e350] [cursor=pointer]':
                          - /url: /admin/notifications/ecf304d1-24b3-4619-bf22-f3c3be0686ae
                          - generic [ref=e351]: Voir
                    - row [ref=e355]:
                      - cell [ref=e356]:
                        - time [ref=e357]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e358]:
                        - generic [ref=e359]:
                          - generic [ref=e360]: Confirmation d’achat
                          - generic [ref=e361]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e362]
                      - cell "Mame N." [ref=e363]
                      - cell "Envoyée" [ref=e364]
                      - cell "—" [ref=e368]
                      - cell [ref=e369]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e370] [cursor=pointer]':
                          - /url: /admin/notifications/5a610ee4-94f5-46a1-9e88-e0345f4788bb
                          - generic [ref=e371]: Voir
                    - row [ref=e375]:
                      - cell [ref=e376]:
                        - time [ref=e377]: jeu. 19 nov. 2026 à 12:50
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e378]:
                        - generic [ref=e379]:
                          - generic [ref=e380]: Nouvelle commande
                          - generic [ref=e381]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e382]
                      - cell "Ousmane F." [ref=e383]
                      - cell "Envoyée" [ref=e384]
                      - cell "—" [ref=e388]
                      - cell [ref=e389]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 12:50" [ref=e390] [cursor=pointer]':
                          - /url: /admin/notifications/284d3106-5b31-4f22-9076-decef8b4ac17
                          - generic [ref=e391]: Voir
                    - row [ref=e395]:
                      - cell [ref=e396]:
                        - time [ref=e397]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e398]:
                        - generic [ref=e399]:
                          - generic [ref=e400]: Confirmation d’achat
                          - generic [ref=e401]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e402]
                      - cell "Mame N." [ref=e403]
                      - cell "Non envoyée" [ref=e404]
                      - cell "Adresse email non vérifiée" [ref=e408]
                      - cell [ref=e409]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e410] [cursor=pointer]':
                          - /url: /admin/notifications/2675763d-319c-4c5c-a882-079638461fde
                          - generic [ref=e411]: Voir
                    - row [ref=e415]:
                      - cell [ref=e416]:
                        - time [ref=e417]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e418]:
                        - generic [ref=e419]:
                          - generic [ref=e420]: Confirmation d’achat
                          - generic [ref=e421]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e422]
                      - cell "Babacar D." [ref=e423]
                      - cell "Non envoyée" [ref=e424]
                      - cell "Adresse email non vérifiée" [ref=e428]
                      - cell [ref=e429]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e430] [cursor=pointer]':
                          - /url: /admin/notifications/ebcf2270-84be-4c18-8a02-cbd4c28c5d36
                          - generic [ref=e431]: Voir
                    - row [ref=e435]:
                      - cell [ref=e436]:
                        - time [ref=e437]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e438]:
                        - generic [ref=e439]:
                          - generic [ref=e440]: Confirmation d’achat
                          - generic [ref=e441]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e442]
                      - cell "+221 70 *** ** 06" [ref=e443]
                      - cell "Envoyée" [ref=e444]
                      - cell "—" [ref=e448]
                      - cell [ref=e449]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e450] [cursor=pointer]':
                          - /url: /admin/notifications/81dd92c3-cd0f-44e3-89af-e138834fd41d
                          - generic [ref=e451]: Voir
                    - row [ref=e455]:
                      - cell [ref=e456]:
                        - time [ref=e457]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e458]:
                        - generic [ref=e459]:
                          - generic [ref=e460]: Confirmation d’achat
                          - generic [ref=e461]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e462]
                      - cell "Babacar D." [ref=e463]
                      - cell "Envoyée" [ref=e464]
                      - cell "—" [ref=e468]
                      - cell [ref=e469]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e470] [cursor=pointer]':
                          - /url: /admin/notifications/80872d04-46c2-43fe-a9db-a73b03754c8b
                          - generic [ref=e471]: Voir
                    - row [ref=e475]:
                      - cell [ref=e476]:
                        - time [ref=e477]: jeu. 19 nov. 2026 à 12:50
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e478]:
                        - generic [ref=e479]:
                          - generic [ref=e480]: Nouvelle commande
                          - generic [ref=e481]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e482]
                      - cell "Ousmane F." [ref=e483]
                      - cell "Envoyée" [ref=e484]
                      - cell "—" [ref=e488]
                      - cell [ref=e489]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 12:50" [ref=e490] [cursor=pointer]':
                          - /url: /admin/notifications/35119495-b45b-42c0-a25c-9d6f66405924
                          - generic [ref=e491]: Voir
                    - row [ref=e495]:
                      - cell [ref=e496]:
                        - time [ref=e497]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e498]:
                        - generic [ref=e499]:
                          - generic [ref=e500]: Confirmation d’achat
                          - generic [ref=e501]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=e502]
                      - cell "+221 70 *** ** 05" [ref=e503]
                      - cell "Envoyée" [ref=e504]
                      - cell "—" [ref=e508]
                      - cell [ref=e509]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e510] [cursor=pointer]':
                          - /url: /admin/notifications/e346bc1c-11e1-4d69-9b03-8abdff2a50a2
                          - generic [ref=e511]: Voir
                    - row [ref=e515]:
                      - cell [ref=e516]:
                        - time [ref=e517]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e518]:
                        - generic [ref=e519]:
                          - generic [ref=e520]: Confirmation d’achat
                          - generic [ref=e521]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e522]
                      - cell "Ndeye T." [ref=e523]
                      - cell "Envoyée" [ref=e524]
                      - cell "—" [ref=e528]
                      - cell [ref=e529]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e530] [cursor=pointer]':
                          - /url: /admin/notifications/d35b6f9f-f589-461a-8bf0-ac4935d60fcb
                          - generic [ref=e531]: Voir
                    - row [ref=e535]:
                      - cell [ref=e536]:
                        - time [ref=e537]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e538]:
                        - generic [ref=e539]:
                          - generic [ref=e540]: Confirmation d’achat
                          - generic [ref=e541]: Nuit du slam de Kaolack
                      - cell "Email" [ref=e542]
                      - cell "Ndeye T." [ref=e543]
                      - cell "Non envoyée" [ref=e544]
                      - cell "Adresse email non vérifiée" [ref=e548]
                      - cell [ref=e549]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e550] [cursor=pointer]':
                          - /url: /admin/notifications/cb142ad7-fa5a-4e6c-a748-e894ffd4ce72
                          - generic [ref=e551]: Voir
                    - row [ref=e555]:
                      - cell [ref=e556]:
                        - time [ref=e557]: jeu. 19 nov. 2026 à 12:50
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e558]:
                        - generic [ref=e559]:
                          - generic [ref=e560]: Nouvelle commande
                          - generic [ref=e561]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e562]
                      - cell "Ousmane F." [ref=e563]
                      - cell "Envoyée" [ref=e564]
                      - cell "—" [ref=e568]
                      - cell [ref=e569]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 12:50" [ref=e570] [cursor=pointer]':
                          - /url: /admin/notifications/b11b6409-1003-4f8e-a613-b002b6988c68
                          - generic [ref=e571]: Voir
                    - row [ref=e575]:
                      - cell [ref=e576]:
                        - time [ref=e577]: jeu. 19 nov. 2026 à 12:50
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=e578]:
                        - generic [ref=e579]:
                          - generic [ref=e580]: Confirmation d’achat
                          - generic [ref=e581]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e582]
                      - cell "Cheikh S." [ref=e583]
                      - cell "Envoyée" [ref=e584]
                      - cell "—" [ref=e588]
                      - cell [ref=e589]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 12:50" [ref=e590] [cursor=pointer]':
                          - /url: /admin/notifications/eb909805-de8d-4993-b004-1d3fa8f92849
                          - generic [ref=e591]: Voir
                    - row [ref=e595]:
                      - cell [ref=e596]:
                        - time [ref=e597]: jeu. 19 nov. 2026 à 12:50
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=e598]:
                        - generic [ref=e599]:
                          - generic [ref=e600]: Nouvelle commande
                          - generic [ref=e601]: Nuit du slam de Kaolack
                      - cell "Application" [ref=e602]
                      - cell "Ousmane F." [ref=e603]
                      - cell "Envoyée" [ref=e604]
                      - cell "—" [ref=e608]
                      - cell [ref=e609]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 12:50" [ref=e610] [cursor=pointer]':
                          - /url: /admin/notifications/7ab4206c-717b-4ecf-be6f-70b3e43bf2cd
                          - generic [ref=e611]: Voir
                - navigation "Pages des notifications" [ref=e615]:
                  - button "Précédent" [disabled] [ref=e616]
                  - paragraph [ref=e621]:
                    - text: Page 1 sur 67
                    - generic [ref=e622]: · 1 325 résultats
                  - button "Suivant" [ref=e623] [cursor=pointer]
          - region [ref=e628]:
            - generic [ref=e629]:
              - heading "Par jour et par canal" [level=2] [ref=e630]
              - paragraph [ref=e631]: 14 derniers jours, heure de Dakar.
            - table [ref=e634]:
              - caption [ref=e635]: Notifications par jour et par canal
              - rowgroup [ref=e636]:
                - row [ref=e637]:
                  - columnheader "Jour" [ref=e638]
                  - columnheader "Canal" [ref=e639]
                  - columnheader "Envoyées" [ref=e640]
                  - columnheader "En échec" [ref=e641]
                  - columnheader "Non envoyées" [ref=e642]
                  - columnheader "Incertaines" [ref=e643]
                  - columnheader "Annulées" [ref=e644]
              - rowgroup [ref=e645]:
                - row [ref=e646]:
                  - cell "19 nov. 2026" [ref=e647]
                  - cell "Email" [ref=e648]
                  - cell "0" [ref=e649]
                  - cell "0" [ref=e650]
                  - cell "377" [ref=e651]
                  - cell "0" [ref=e652]
                  - cell "0" [ref=e653]
                - row [ref=e654]:
                  - cell "19 nov. 2026" [ref=e655]
                  - cell "Application" [ref=e656]
                  - cell "463" [ref=e657]
                  - cell "0" [ref=e658]
                  - cell "0" [ref=e659]
                  - cell "0" [ref=e660]
                  - cell "3" [ref=e661]
                - row [ref=e662]:
                  - cell "19 nov. 2026" [ref=e663]
                  - cell "Notification push" [ref=e664]
                  - cell "0" [ref=e665]
                  - cell "0" [ref=e666]
                  - cell "123" [ref=e667]
                  - cell "0" [ref=e668]
                  - cell "3" [ref=e669]
                - row [ref=e670]:
                  - cell "19 nov. 2026" [ref=e671]
                  - cell "SMS" [ref=e672]
                  - cell "212" [ref=e673]
                  - cell "1" [ref=e674]
                  - cell "0" [ref=e675]
                  - cell "1" [ref=e676]
                  - cell "3" [ref=e677]
  - alert [ref=e678]
```

# Test source

```ts
  223 |     }, payload);
  224 | }
  225 | 
  226 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  227 | async function expectScanResult(page: Page, result: string): Promise<void> {
  228 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
  229 | }
  230 | 
  231 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  232 | function demoPayload(c: ScreenContext): string {
  233 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  234 | }
  235 | 
  236 | const SCAN_URL = /\/api\/controller\/scan$/;
  237 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  238 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  239 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  240 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  241 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  242 | 
  243 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  244 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  245 |     const result = String(body.result);
  246 |     return {
  247 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  248 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  249 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  250 |         ready: async ({ page }) => startScanner(page),
  251 |         actions: async (c) => {
  252 |             await presentToFakeDetector(c.page, demoPayload(c));
  253 |             await expectScanResult(c.page, result);
  254 |         },
  255 |     };
  256 | }
  257 | 
  258 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  259 | function offlineLink(page: Page, ticketId: string): Locator {
  260 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  261 | }
  262 | 
  263 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  264 | 
  265 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  266 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  267 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  268 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  269 |     return counters;
  270 | }
  271 | 
  272 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  273 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  274 |     await expectHeading(page, /^préférences de notification$/i);
  275 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  276 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  277 | }
  278 | 
  279 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  280 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  281 |     const counters = await fakePushCounters(page);
  282 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  283 | }
  284 | 
  285 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  286 | 
  287 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  288 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  289 | 
  290 | function cdpKids(node: CdpNode): CdpNode[] {
  291 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  292 | }
  293 | 
  294 | function findDateInput(node: CdpNode): CdpNode | null {
  295 |     const attrs = node.attributes ?? [];
  296 |     if (node.nodeName === 'INPUT') {
  297 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  298 |     }
  299 |     for (const kid of cdpKids(node)) {
  300 |         const found = findDateInput(kid);
  301 |         if (found) return found;
  302 |     }
  303 |     return null;
  304 | }
  305 | 
  306 | function cdpText(node: CdpNode): string {
  307 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  308 |     return own + cdpKids(node).map(cdpText).join('');
  309 | }
  310 | 
  311 | /**
  312 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  313 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  314 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  315 |  */
  316 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  317 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  318 |     const cdp = await c.context.newCDPSession(c.page);
  319 |     try {
  320 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  321 |         const input = findDateInput(root);
  322 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
> 323 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
      |                                                                                ^ Error: gabarit du champ de date, lu par CDP (8.2 t)
  324 |     } finally {
  325 |         await cdp.detach();
  326 |     }
  327 | }
  328 | 
  329 | /** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
  330 | async function fontSizePx(target: Locator): Promise<number> {
  331 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  332 | }
  333 | 
  334 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  335 | async function openTicketingStep(page: Page): Promise<void> {
  336 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  337 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  338 | }
  339 | 
  340 | const ONLINE_BOX = /^vendue en ligne/i;
  341 | const COUNTER_BOX = /^vendue au guichet/i;
  342 | 
  343 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  344 | function categorySections(page: Page): Locator {
  345 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  346 | }
  347 | 
  348 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  349 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  350 | /** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
  351 | const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
  352 | /**
  353 |  * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
  354 |  * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
  355 |  * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
  356 |  * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
  357 |  */
  358 | const CASHOUTS_TO_RESUME = {
  359 |     items: [
  360 |         {
  361 |             id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
  362 |             since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
  363 |             block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  364 |         },
  365 |         {
  366 |             id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
  367 |             since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
  368 |             block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  369 |         },
  370 |         {
  371 |             id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
  372 |             since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
  373 |             block_label: null, can_resend: false, can_mark_paid: true, can_mark_not_sent: true, advice: ADVICE_UNCERTAIN_NO_ID,
  374 |         },
  375 |         {
  376 |             id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
  377 |             since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
  378 |             block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  379 |         },
  380 |         {
  381 |             id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
  382 |             since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
  383 |             block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, can_mark_not_sent: false, advice: null,
  384 |         },
  385 |     ],
  386 |     total: 5,
  387 | };
  388 | const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
  389 | const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
  390 | /** Lot 9 ter (A.2.3, A.2.6) : « Constater non versé » sur la seule ligne INCERTAIN sans identifiant SamirPay (SUPERADMIN). */
  391 | const CASHOUTS_NOT_SENT = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_not_sent).length;
  392 | const EMPTY_RECONCILIATION = {
  393 |     summary: {
  394 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  395 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  396 |     },
  397 |     items: [],
  398 |     // Lot 9 bis (H6, contrat 4.1), relecture des captures du run 121 : sans ces champs, readCashoutFees (app/admin/finance/page.tsx)
  399 |     // affichait « Frais SamirPay non disponibles » sur la capture. Forme de cashoutFeeReconciliation (lib/admin/finance-reconciliation.ts) ;
  400 |     // cashinNote recopie CASHIN_FEES_NOTE. Aucun versement à la page : 12 versements aux frais connus, 280 000 F CFA au taux de 1,5 %.
  401 |     cashoutFeesReal: 4290,
  402 |     cashoutFeesEstimated: 4200,
  403 |     gap: 90,
  404 |     cashoutFeeRate: 1.5,
  405 |     cashoutCount: 12,
  406 |     cashinFeesReal: null,
  407 |     cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
  408 | };
  409 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  410 | const CASHOUTS_STUBS: StubResponse[] = [
  411 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  412 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  413 | ];
  414 | 
  415 | // ── Finition 3a : argent de l'administration (page Finance, accueil) ─────────
  416 | // Réponses imposées aux montants cohérents entre eux (voir le rapport de la finition 3a) : les captures montrent chaque
  417 | // état sans dépendre des données du seed ; les règles de calcul sont prouvées par les suites f3a-* (base locale).
  418 | const F3A_SUMMARY_URL = /\/api\/admin\/finance\/summary(\?.*)?$/;
  419 | const F3A_PAYMENTS_URL = /\/api\/admin\/finance\/payments(\?.*)?$/;
  420 | const F3A_DEBTS_URL = /\/api\/admin\/finance\/debts(\?.*)?$/;
  421 | const F3A_WAITING_URL = /\/api\/admin\/finance\/waiting(\?.*)?$/;
  422 | const F3A_PERIOD = {
  423 |     key: 'month', from: '2026-11-01T00:00:00.000Z', to: '2026-11-17T00:00:00.000Z', firstDay: '2026-11-01', lastDay: '2026-11-16',
```