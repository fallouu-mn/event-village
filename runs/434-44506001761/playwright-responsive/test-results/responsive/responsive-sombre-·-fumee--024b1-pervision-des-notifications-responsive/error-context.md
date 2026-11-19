# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-notifications — Supervision des notifications
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-notifications (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Détail » de 809 à 848 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; td.px-4.py-3 « Adresse email non vérifiée » de 722 à 777 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px) ; td.px-4.py-3 « Adresse email non vérifiée » de 722 à 777 px (fenêtre 768 px) ; span.min-w-0 « Voir » de 824 à 850 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Motif » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Détail » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; td.px-4.py-3 « Adresse email non vérifiée » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Voir » dépasse de div.hidden.overflow-hidden «  » ; td.px-4.py-3 « Adresse email non vérifiée » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e6]: Event Village
      - navigation "Navigation principale" [ref=f2e9]:
        - generic [ref=f2e10]: Administration
        - link "Tableau de bord" [ref=f2e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e22]:
          - paragraph [ref=f2e23]: Gestion
          - generic [ref=f2e24]:
            - link "Événements" [ref=f2e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Finances
          - link "Finance" [ref=f2e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e49]:
          - paragraph [ref=f2e50]: Engagement
          - generic [ref=f2e51]:
            - link "Parrainage" [ref=f2e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e66]:
          - paragraph [ref=f2e67]: Système
          - generic [ref=f2e68]:
            - link "Réglages" [ref=f2e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f2e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e107]: ES
          - generic [ref=f2e108]:
            - generic [ref=f2e109]: Elhadji SuperAdmin
            - generic [ref=f2e110]: Superadmin
        - generic [ref=f2e111]:
          - button "Se déconnecter" [ref=f2e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e117] [cursor=pointer]
    - generic [ref=f2e121]:
      - banner [ref=f2e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=f2e131] [cursor=pointer]:
          - generic [ref=f2e135]: "58"
      - main [ref=f2e136]:
        - generic [ref=f2e138]:
          - generic [ref=f2e141]:
            - status [ref=f2e143]: En direct
            - heading "Notifications" [level=1] [ref=f2e145]
            - paragraph [ref=f2e146]: "Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar."
          - region [ref=f2e147]:
            - heading "Compteurs" [level=2] [ref=f2e148]
            - generic [ref=f2e149]:
              - generic [ref=f2e150]:
                - paragraph [ref=f2e152]: SMS aujourd'hui
                - paragraph [ref=f2e156]: "213"
                - paragraph [ref=f2e157]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=f2e158]:
                - paragraph [ref=f2e160]: SMS optionnels aujourd'hui
                - paragraph [ref=f2e165]: "17"
                - paragraph [ref=f2e166]: "Plafond : 700 par jour, alerte à 560."
              - generic [ref=f2e167]:
                - paragraph [ref=f2e169]: SMS ce mois-ci
                - paragraph [ref=f2e176]: "213"
                - paragraph [ref=f2e177]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=f2e178]:
            - heading "Envois" [level=2] [ref=f2e179]
            - tablist "Filtrer par statut" [ref=f2e182]:
              - tab "Toutes" [selected] [ref=f2e183] [cursor=pointer]
              - tab "En attente , 123" [ref=f2e185] [cursor=pointer]:
                - generic [ref=f2e186]: En attente
                - generic [ref=f2e187]:
                  - generic [ref=f2e188]: ","
                  - text: "123"
              - tab "En cours d'envoi , 0" [ref=f2e189] [cursor=pointer]:
                - generic [ref=f2e190]: En cours d'envoi
                - generic [ref=f2e191]:
                  - generic [ref=f2e192]: ","
                  - text: "0"
              - tab "Envoyée , 675" [ref=f2e193] [cursor=pointer]:
                - generic [ref=f2e194]: Envoyée
                - generic [ref=f2e195]:
                  - generic [ref=f2e196]: ","
                  - text: "675"
              - tab "En échec , 1" [ref=f2e197] [cursor=pointer]:
                - generic [ref=f2e198]: En échec
                - generic [ref=f2e199]:
                  - generic [ref=f2e200]: ","
                  - text: "1"
              - tab "Non envoyée , 516" [ref=f2e201] [cursor=pointer]:
                - generic [ref=f2e202]: Non envoyée
                - generic [ref=f2e203]:
                  - generic [ref=f2e204]: ","
                  - text: "516"
              - tab "Annulée , 9" [ref=f2e205] [cursor=pointer]:
                - generic [ref=f2e206]: Annulée
                - generic [ref=f2e207]:
                  - generic [ref=f2e208]: ","
                  - text: "9"
              - tab "Incertaine , 1" [ref=f2e209] [cursor=pointer]:
                - generic [ref=f2e210]: Incertaine
                - generic [ref=f2e211]:
                  - generic [ref=f2e212]: ","
                  - text: "1"
            - search [ref=f2e213]:
              - generic [ref=f2e214]:
                - generic [ref=f2e215]: Rechercher
                - searchbox "Rechercher" [ref=f2e217]
              - generic [ref=f2e218]:
                - generic [ref=f2e219]: Canal
                - combobox "Canal" [ref=f2e222] [cursor=pointer]:
                  - option "Tous les canaux" [selected]
                  - option "Application"
                  - option "SMS"
                  - option "Email"
                  - option "Notification push"
              - generic [ref=f2e223]:
                - generic [ref=f2e224]: Type
                - combobox "Type" [ref=f2e227] [cursor=pointer]:
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
                  - option "Réservation de salle annulée (salle)"
                  - option "Réservation de salle confirmée"
                  - option "Réservation de table annulée"
                  - option "Réservation de table annulée (établissement)"
                  - option "Réservation de table confirmée"
                  - option "Retrait en vérification"
                  - option "Retrait refusé"
                  - option "Retrait refusé par l'opérateur"
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
                  - option "Versement à reprendre"
                  - option "Versement incertain"
                  - option "Volume de SMS indispensables élevé"
              - generic [ref=f2e228]:
                - generic [ref=f2e229]:
                  - generic [ref=f2e230]: Du
                  - textbox "Du" [ref=f2e232]
                - generic [ref=f2e233]:
                  - generic [ref=f2e234]: Au
                  - textbox "Au" [ref=f2e236]
            - tabpanel "Toutes" [ref=f2e237]:
              - generic [ref=f2e238]:
                - table [ref=f2e241]:
                  - caption [ref=f2e242]: Notifications de la boîte d’envoi
                  - rowgroup [ref=f2e243]:
                    - row [ref=f2e244]:
                      - columnheader "Date" [ref=f2e245]
                      - columnheader "Type" [ref=f2e246]
                      - columnheader "Canal" [ref=f2e247]
                      - columnheader "Destinataire" [ref=f2e248]
                      - columnheader "Statut" [ref=f2e249]
                      - columnheader "Motif" [ref=f2e250]
                      - columnheader "Détail" [ref=f2e251]
                  - rowgroup [ref=f2e252]:
                    - row [ref=f2e253]:
                      - cell [ref=f2e254]:
                        - time [ref=f2e255]: jeu. 19 nov. 2026 à 10:35
                      - cell "Code administrateur" [ref=f2e256]
                      - cell "SMS" [ref=f2e259]
                      - cell "+221 70 *** ** 07" [ref=f2e260]
                      - cell "Envoyée" [ref=f2e261]
                      - cell "—" [ref=f2e265]
                      - cell [ref=f2e266]:
                        - 'link "Voir le détail : Code administrateur, jeu. 19 nov. 2026 à 10:35" [ref=f2e267] [cursor=pointer]':
                          - /url: /admin/notifications/d28cdb58-43f0-4b98-b069-dc97fe105c05
                          - generic [ref=f2e268]: Voir
                    - row [ref=f2e272]:
                      - cell [ref=f2e273]:
                        - time [ref=f2e274]: jeu. 19 nov. 2026 à 10:35
                      - cell "Code administrateur" [ref=f2e275]
                      - cell "SMS" [ref=f2e278]
                      - cell "+221 70 *** ** 04" [ref=f2e279]
                      - cell "Envoyée" [ref=f2e280]
                      - cell "—" [ref=f2e284]
                      - cell [ref=f2e285]:
                        - 'link "Voir le détail : Code administrateur, jeu. 19 nov. 2026 à 10:35" [ref=f2e286] [cursor=pointer]':
                          - /url: /admin/notifications/374e0d16-0c56-41fb-8fc8-02196cdad868
                          - generic [ref=f2e287]: Voir
                    - row [ref=f2e291]:
                      - cell [ref=f2e292]:
                        - time [ref=f2e293]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e294]:
                        - generic [ref=f2e295]:
                          - generic [ref=f2e296]: Confirmation d’achat
                          - generic [ref=f2e297]: Nuit du slam de Kaolack
                      - cell "Email" [ref=f2e298]
                      - cell "Alioune F." [ref=f2e299]
                      - cell "Non envoyée" [ref=f2e300]
                      - cell "Adresse email non vérifiée" [ref=f2e304]
                      - cell [ref=f2e305]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e306] [cursor=pointer]':
                          - /url: /admin/notifications/fdeaac89-f37e-403a-a71a-a3affcce6086
                          - generic [ref=f2e307]: Voir
                    - row [ref=f2e311]:
                      - cell [ref=f2e312]:
                        - time [ref=f2e313]: jeu. 19 nov. 2026 à 10:34
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=f2e314]:
                        - generic [ref=f2e315]:
                          - generic [ref=f2e316]: Nouvelle commande
                          - generic [ref=f2e317]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e318]
                      - cell "Ousmane F." [ref=f2e319]
                      - cell "Envoyée" [ref=f2e320]
                      - cell "—" [ref=f2e324]
                      - cell [ref=f2e325]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 10:34" [ref=f2e326] [cursor=pointer]':
                          - /url: /admin/notifications/451ab9af-c46a-4cce-8825-4591b1162a2a
                          - generic [ref=f2e327]: Voir
                    - row [ref=f2e331]:
                      - cell [ref=f2e332]:
                        - time [ref=f2e333]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e334]:
                        - generic [ref=f2e335]:
                          - generic [ref=f2e336]: Confirmation d’achat
                          - generic [ref=f2e337]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e338]
                      - cell "Alioune F." [ref=f2e339]
                      - cell "Envoyée" [ref=f2e340]
                      - cell "—" [ref=f2e344]
                      - cell [ref=f2e345]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e346] [cursor=pointer]':
                          - /url: /admin/notifications/133549f0-7423-4273-9e02-6b97e1f50398
                          - generic [ref=f2e347]: Voir
                    - row [ref=f2e351]:
                      - cell [ref=f2e352]:
                        - time [ref=f2e353]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e354]:
                        - generic [ref=f2e355]:
                          - generic [ref=f2e356]: Confirmation d’achat
                          - generic [ref=f2e357]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=f2e358]
                      - cell "+221 70 *** ** 08" [ref=f2e359]
                      - cell "Envoyée" [ref=f2e360]
                      - cell "—" [ref=f2e364]
                      - cell [ref=f2e365]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e366] [cursor=pointer]':
                          - /url: /admin/notifications/12f5935f-101d-41a3-980a-c5378e4f73dc
                          - generic [ref=f2e367]: Voir
                    - row [ref=f2e371]:
                      - cell [ref=f2e372]:
                        - time [ref=f2e373]: jeu. 19 nov. 2026 à 10:34
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=f2e374]:
                        - generic [ref=f2e375]:
                          - generic [ref=f2e376]: Nouvelle commande
                          - generic [ref=f2e377]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e378]
                      - cell "Ousmane F." [ref=f2e379]
                      - cell "Envoyée" [ref=f2e380]
                      - cell "—" [ref=f2e384]
                      - cell [ref=f2e385]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 10:34" [ref=f2e386] [cursor=pointer]':
                          - /url: /admin/notifications/a4e32d07-dfc5-4691-8697-e2d686644b1e
                          - generic [ref=f2e387]: Voir
                    - row [ref=f2e391]:
                      - cell [ref=f2e392]:
                        - time [ref=f2e393]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e394]:
                        - generic [ref=f2e395]:
                          - generic [ref=f2e396]: Confirmation d’achat
                          - generic [ref=f2e397]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e398]
                      - cell "Mame N." [ref=f2e399]
                      - cell "Envoyée" [ref=f2e400]
                      - cell "—" [ref=f2e404]
                      - cell [ref=f2e405]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e406] [cursor=pointer]':
                          - /url: /admin/notifications/98d3306b-cf2e-4c2e-95d3-4eb2df87832d
                          - generic [ref=f2e407]: Voir
                    - row [ref=f2e411]:
                      - cell [ref=f2e412]:
                        - time [ref=f2e413]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e414]:
                        - generic [ref=f2e415]:
                          - generic [ref=f2e416]: Confirmation d’achat
                          - generic [ref=f2e417]: Nuit du slam de Kaolack
                      - cell "Email" [ref=f2e418]
                      - cell "Mame N." [ref=f2e419]
                      - cell "Non envoyée" [ref=f2e420]
                      - cell "Adresse email non vérifiée" [ref=f2e424]
                      - cell [ref=f2e425]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e426] [cursor=pointer]':
                          - /url: /admin/notifications/72a17db3-252a-4bb7-9f13-61d6d655abbf
                          - generic [ref=f2e427]: Voir
                    - row [ref=f2e431]:
                      - cell [ref=f2e432]:
                        - time [ref=f2e433]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e434]:
                        - generic [ref=f2e435]:
                          - generic [ref=f2e436]: Confirmation d’achat
                          - generic [ref=f2e437]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=f2e438]
                      - cell "+221 70 *** ** 07" [ref=f2e439]
                      - cell "Envoyée" [ref=f2e440]
                      - cell "—" [ref=f2e444]
                      - cell [ref=f2e445]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e446] [cursor=pointer]':
                          - /url: /admin/notifications/66d1b7e8-0142-40b0-b7e5-0a91671322f6
                          - generic [ref=f2e447]: Voir
                    - row [ref=f2e451]:
                      - cell [ref=f2e452]:
                        - time [ref=f2e453]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e454]:
                        - generic [ref=f2e455]:
                          - generic [ref=f2e456]: Confirmation d’achat
                          - generic [ref=f2e457]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=f2e458]
                      - cell "+221 70 *** ** 06" [ref=f2e459]
                      - cell "Envoyée" [ref=f2e460]
                      - cell "—" [ref=f2e464]
                      - cell [ref=f2e465]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e466] [cursor=pointer]':
                          - /url: /admin/notifications/86d04bf6-3de9-406e-ba12-168437dbb99f
                          - generic [ref=f2e467]: Voir
                    - row [ref=f2e471]:
                      - cell [ref=f2e472]:
                        - time [ref=f2e473]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e474]:
                        - generic [ref=f2e475]:
                          - generic [ref=f2e476]: Confirmation d’achat
                          - generic [ref=f2e477]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e478]
                      - cell "Babacar D." [ref=f2e479]
                      - cell "Envoyée" [ref=f2e480]
                      - cell "—" [ref=f2e484]
                      - cell [ref=f2e485]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e486] [cursor=pointer]':
                          - /url: /admin/notifications/7bf28695-0e67-473e-946f-a71f76aad2eb
                          - generic [ref=f2e487]: Voir
                    - row [ref=f2e491]:
                      - cell [ref=f2e492]:
                        - time [ref=f2e493]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e494]:
                        - generic [ref=f2e495]:
                          - generic [ref=f2e496]: Confirmation d’achat
                          - generic [ref=f2e497]: Nuit du slam de Kaolack
                      - cell "Email" [ref=f2e498]
                      - cell "Babacar D." [ref=f2e499]
                      - cell "Non envoyée" [ref=f2e500]
                      - cell "Adresse email non vérifiée" [ref=f2e504]
                      - cell [ref=f2e505]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e506] [cursor=pointer]':
                          - /url: /admin/notifications/6721aad4-1f5e-41ab-83fa-4e07222ead04
                          - generic [ref=f2e507]: Voir
                    - row [ref=f2e511]:
                      - cell [ref=f2e512]:
                        - time [ref=f2e513]: jeu. 19 nov. 2026 à 10:34
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=f2e514]:
                        - generic [ref=f2e515]:
                          - generic [ref=f2e516]: Nouvelle commande
                          - generic [ref=f2e517]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e518]
                      - cell "Ousmane F." [ref=f2e519]
                      - cell "Envoyée" [ref=f2e520]
                      - cell "—" [ref=f2e524]
                      - cell [ref=f2e525]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 10:34" [ref=f2e526] [cursor=pointer]':
                          - /url: /admin/notifications/55b42ab1-ba0b-451d-8e63-9e99d92adf74
                          - generic [ref=f2e527]: Voir
                    - row [ref=f2e531]:
                      - cell [ref=f2e532]:
                        - time [ref=f2e533]: jeu. 19 nov. 2026 à 10:34
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=f2e534]:
                        - generic [ref=f2e535]:
                          - generic [ref=f2e536]: Nouvelle commande
                          - generic [ref=f2e537]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e538]
                      - cell "Ousmane F." [ref=f2e539]
                      - cell "Envoyée" [ref=f2e540]
                      - cell "—" [ref=f2e544]
                      - cell [ref=f2e545]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 10:34" [ref=f2e546] [cursor=pointer]':
                          - /url: /admin/notifications/f345b20e-de73-4fff-b4c2-90d0a68952d4
                          - generic [ref=f2e547]: Voir
                    - row [ref=f2e551]:
                      - cell [ref=f2e552]:
                        - time [ref=f2e553]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e554]:
                        - generic [ref=f2e555]:
                          - generic [ref=f2e556]: Confirmation d’achat
                          - generic [ref=f2e557]: Nuit du slam de Kaolack
                      - cell "SMS" [ref=f2e558]
                      - cell "+221 70 *** ** 05" [ref=f2e559]
                      - cell "Envoyée" [ref=f2e560]
                      - cell "—" [ref=f2e564]
                      - cell [ref=f2e565]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e566] [cursor=pointer]':
                          - /url: /admin/notifications/9cde3712-a821-495b-b540-a498ab6512e0
                          - generic [ref=f2e567]: Voir
                    - row [ref=f2e571]:
                      - cell [ref=f2e572]:
                        - time [ref=f2e573]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e574]:
                        - generic [ref=f2e575]:
                          - generic [ref=f2e576]: Confirmation d’achat
                          - generic [ref=f2e577]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e578]
                      - cell "Ndeye T." [ref=f2e579]
                      - cell "Envoyée" [ref=f2e580]
                      - cell "—" [ref=f2e584]
                      - cell [ref=f2e585]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e586] [cursor=pointer]':
                          - /url: /admin/notifications/86262bc0-58b9-4f3e-9fdb-6c5ddbced8ef
                          - generic [ref=f2e587]: Voir
                    - row [ref=f2e591]:
                      - cell [ref=f2e592]:
                        - time [ref=f2e593]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e594]:
                        - generic [ref=f2e595]:
                          - generic [ref=f2e596]: Confirmation d’achat
                          - generic [ref=f2e597]: Nuit du slam de Kaolack
                      - cell "Email" [ref=f2e598]
                      - cell "Ndeye T." [ref=f2e599]
                      - cell "Non envoyée" [ref=f2e600]
                      - cell "Adresse email non vérifiée" [ref=f2e604]
                      - cell [ref=f2e605]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e606] [cursor=pointer]':
                          - /url: /admin/notifications/785f85fc-0c99-49bc-a96b-06168a4f13e8
                          - generic [ref=f2e607]: Voir
                    - row [ref=f2e611]:
                      - cell [ref=f2e612]:
                        - time [ref=f2e613]: jeu. 19 nov. 2026 à 10:34
                      - cell "Confirmation d’achat Nuit du slam de Kaolack" [ref=f2e614]:
                        - generic [ref=f2e615]:
                          - generic [ref=f2e616]: Confirmation d’achat
                          - generic [ref=f2e617]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e618]
                      - cell "Cheikh S." [ref=f2e619]
                      - cell "Envoyée" [ref=f2e620]
                      - cell "—" [ref=f2e624]
                      - cell [ref=f2e625]:
                        - 'link "Voir le détail : Confirmation d’achat, jeu. 19 nov. 2026 à 10:34" [ref=f2e626] [cursor=pointer]':
                          - /url: /admin/notifications/b2cb5925-f774-460a-a618-1fc0e46d06eb
                          - generic [ref=f2e627]: Voir
                    - row [ref=f2e631]:
                      - cell [ref=f2e632]:
                        - time [ref=f2e633]: jeu. 19 nov. 2026 à 10:34
                      - cell "Nouvelle commande Nuit du slam de Kaolack" [ref=f2e634]:
                        - generic [ref=f2e635]:
                          - generic [ref=f2e636]: Nouvelle commande
                          - generic [ref=f2e637]: Nuit du slam de Kaolack
                      - cell "Application" [ref=f2e638]
                      - cell "Ousmane F." [ref=f2e639]
                      - cell "Envoyée" [ref=f2e640]
                      - cell "—" [ref=f2e644]
                      - cell [ref=f2e645]:
                        - 'link "Voir le détail : Nouvelle commande, jeu. 19 nov. 2026 à 10:34" [ref=f2e646] [cursor=pointer]':
                          - /url: /admin/notifications/aba914bc-34e6-4749-be51-db5ef729951b
                          - generic [ref=f2e647]: Voir
                - navigation "Pages des notifications" [ref=f2e651]:
                  - button "Précédent" [disabled] [ref=f2e652]
                  - paragraph [ref=f2e657]:
                    - text: Page 1 sur 67
                    - generic [ref=f2e658]: · 1 325 résultats
                  - button "Suivant" [ref=f2e659] [cursor=pointer]
          - region [ref=f2e664]:
            - generic [ref=f2e665]:
              - heading "Par jour et par canal" [level=2] [ref=f2e666]
              - paragraph [ref=f2e667]: 14 derniers jours, heure de Dakar.
            - table [ref=f2e670]:
              - caption [ref=f2e671]: Notifications par jour et par canal
              - rowgroup [ref=f2e672]:
                - row [ref=f2e673]:
                  - columnheader "Jour" [ref=f2e674]
                  - columnheader "Canal" [ref=f2e675]
                  - columnheader "Envoyées" [ref=f2e676]
                  - columnheader "En échec" [ref=f2e677]
                  - columnheader "Non envoyées" [ref=f2e678]
                  - columnheader "Incertaines" [ref=f2e679]
                  - columnheader "Annulées" [ref=f2e680]
              - rowgroup [ref=f2e681]:
                - row [ref=f2e682]:
                  - cell "19 nov. 2026" [ref=f2e683]
                  - cell "Email" [ref=f2e684]
                  - cell "0" [ref=f2e685]
                  - cell "0" [ref=f2e686]
                  - cell "377" [ref=f2e687]
                  - cell "0" [ref=f2e688]
                  - cell "0" [ref=f2e689]
                - row [ref=f2e690]:
                  - cell "19 nov. 2026" [ref=f2e691]
                  - cell "Application" [ref=f2e692]
                  - cell "463" [ref=f2e693]
                  - cell "0" [ref=f2e694]
                  - cell "0" [ref=f2e695]
                  - cell "0" [ref=f2e696]
                  - cell "3" [ref=f2e697]
                - row [ref=f2e698]:
                  - cell "19 nov. 2026" [ref=f2e699]
                  - cell "Notification push" [ref=f2e700]
                  - cell "0" [ref=f2e701]
                  - cell "0" [ref=f2e702]
                  - cell "123" [ref=f2e703]
                  - cell "0" [ref=f2e704]
                  - cell "3" [ref=f2e705]
                - row [ref=f2e706]:
                  - cell "19 nov. 2026" [ref=f2e707]
                  - cell "SMS" [ref=f2e708]
                  - cell "212" [ref=f2e709]
                  - cell "1" [ref=f2e710]
                  - cell "0" [ref=f2e711]
                  - cell "1" [ref=f2e712]
                  - cell "3" [ref=f2e713]
  - alert [ref=f2e714]
```

# Test source

```ts
  6   |  * aussi en paysage), pour que tout ce qui se décide au chargement suive la largeur. En clair : toutes les largeurs ; en
  7   |  * sombre : les largeurs capturées (360, 768, 1440) et le paysage. Les contrôles sont bloquants à chaque largeur contrôlée.
  8   |  *
  9   |  * Captures (JPEG, échelle 1, fenêtre visible) : .e2e-captures/captures-responsive/<page>__<largeur>__<thème>.jpg ;
  10  |  * résultats : .e2e-captures/responsive/<page>__<thème>.json, résumés par scripts/e2e/responsive-resume.mjs
  11  |  * (responsive.tsv et responsive.txt, publiés sur ci-results).
  12  |  */
  13  | import fs from 'node:fs';
  14  | import path from 'node:path';
  15  | import type { Page } from '@playwright/test';
  16  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  17  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  18  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  19  | import {
  20  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  21  | } from './support/responsive-pages';
  22  | import { runResponsiveChecks } from './support/responsive-checks';
  23  | 
  24  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  25  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  26  | 
  27  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  28  |     { key: 'clair', colorScheme: 'light' },
  29  |     { key: 'sombre', colorScheme: 'dark' },
  30  | ];
  31  | 
  32  | interface Size { width: number; height: number; paysage?: boolean }
  33  | 
  34  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  35  |     const base: Size[] = RESPONSIVE_WIDTHS
  36  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  37  |         .map((w) => ({ width: w.width, height: w.height }));
  38  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  39  |     return [...base, ...land];
  40  | }
  41  | 
  42  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  43  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  44  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  45  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  46  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  47  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  48  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  49  | }
  50  | 
  51  | interface ResponsiveRecord {
  52  |     page: string;
  53  |     titre: string;
  54  |     groupe: string;
  55  |     role: CaptureRole;
  56  |     theme: ThemeKey;
  57  |     url: string | null;
  58  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  59  |     notes: string[];
  60  |     error: string | null;
  61  | }
  62  | 
  63  | for (const theme of THEMES) {
  64  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  65  |     for (const role of roles) {
  66  |         test.describe(`${theme.key} · ${role}`, () => {
  67  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  68  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  69  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard }) => {
  70  |                     test.setTimeout(240_000);
  71  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  72  |                     try {
  73  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  74  |                         record.url = p.path(demo);
  75  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  76  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  77  |                         for (const size of sizesFor(p, theme.key)) {
  78  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  79  |                             await page.setViewportSize({ width: size.width, height: size.height });
  80  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  81  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  82  |                             if (p.ready) await p.ready(page);
  83  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  84  |                             if (p.actions) await p.actions(page);
  85  |                             await settle(page, record.notes, at);
  86  |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  87  |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  88  |                             let capture: string | null = null;
  89  |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  90  |                                 fs.mkdirSync(SHOTS, { recursive: true });
  91  |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  92  |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  93  |                             }
  94  |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  95  |                         }
  96  |                     } catch (err) {
  97  |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  98  |                         throw err;
  99  |                     } finally {
  100 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  101 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  102 |                         fs.mkdirSync(RESULTS, { recursive: true });
  103 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  104 |                     }
  105 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 106 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de adm-notifications (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```