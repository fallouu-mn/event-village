# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-notifications — Supervision des notifications
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-notifications (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "1024 px : textes qui se chevauchent : span.min-w-0.break-words « À la une » sur span.block.break-words « Elhadji SuperAdmin » (42×10 px) ; span.flex.flex-shrink-0 « ES » sur p.mb-1.5.block « Système » (17×14 px) ; span.block.break-words « Super-administrateur » sur p.mb-1.5.block « Système » (23×14 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Réglages » (13×16 px)",
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (78×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f5e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f5e16]:
        - generic [ref=f5e17]: Administration
        - link "Tableau de bord" [ref=f5e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e29]:
          - paragraph [ref=f5e30]: Gestion
          - generic [ref=f5e31]:
            - link "Événements" [ref=f5e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f5e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f5e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=f5e55]:
          - paragraph [ref=f5e56]: Finances
          - link "Finance" [ref=f5e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f5e62]:
          - paragraph [ref=f5e63]: Engagement
          - generic [ref=f5e64]:
            - link "Parrainage" [ref=f5e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f5e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f5e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f5e79]:
          - paragraph [ref=f5e80]: Système
          - generic [ref=f5e81]:
            - link "Réglages" [ref=f5e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f5e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f5e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f5e113] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f5e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e121]: ES
          - generic [ref=f5e122]:
            - generic [ref=f5e123]: Elhadji SuperAdmin
            - generic [ref=f5e124]: Super-administrateur
        - generic [ref=f5e125]:
          - button "Se déconnecter" [ref=f5e126] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e131] [cursor=pointer]
    - generic [ref=f5e135]:
      - banner [ref=f5e136]:
        - link "Rechercher un événement…" [ref=f5e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f5e143]:
          - button "Notifications, 61 non lues" [ref=f5e145] [cursor=pointer]:
            - generic [ref=f5e149]: "61"
          - button "Elhadji SuperAdmin" [ref=f5e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=f5e152]: ES
      - main [ref=f5e156]:
        - generic [ref=f5e158]:
          - generic [ref=f5e161]:
            - status [ref=f5e163]: En direct
            - heading "Notifications" [level=1] [ref=f5e165]
            - paragraph [ref=f5e166]: "Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar."
          - region [ref=f5e167]:
            - heading "Compteurs" [level=2] [ref=f5e168]
            - generic [ref=f5e169]:
              - generic [ref=f5e170]:
                - paragraph [ref=f5e172]: SMS aujourd'hui
                - paragraph [ref=f5e176]: "203"
                - paragraph [ref=f5e177]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=f5e178]:
                - paragraph [ref=f5e180]: SMS optionnels aujourd'hui
                - paragraph [ref=f5e185]: "1"
                - paragraph [ref=f5e186]: "Plafond : 20 000 par jour, alerte à 16 000."
              - generic [ref=f5e187]:
                - paragraph [ref=f5e189]: SMS ce mois-ci
                - paragraph [ref=f5e196]: "203"
                - paragraph [ref=f5e197]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=f5e198]:
            - heading "Envois" [level=2] [ref=f5e199]
            - tablist "Filtrer par statut" [ref=f5e202]:
              - tab "Toutes" [selected] [ref=f5e203] [cursor=pointer]
              - tab "En attente , 268" [ref=f5e205] [cursor=pointer]:
                - generic [ref=f5e206]: En attente
                - generic [ref=f5e207]:
                  - generic [ref=f5e208]: ","
                  - text: "268"
              - tab "En cours d'envoi , 0" [ref=f5e209] [cursor=pointer]:
                - generic [ref=f5e210]: En cours d'envoi
                - generic [ref=f5e211]:
                  - generic [ref=f5e212]: ","
                  - text: "0"
              - tab "Envoyée , 580" [ref=f5e213] [cursor=pointer]:
                - generic [ref=f5e214]: Envoyée
                - generic [ref=f5e215]:
                  - generic [ref=f5e216]: ","
                  - text: "580"
              - tab "En échec , 1" [ref=f5e217] [cursor=pointer]:
                - generic [ref=f5e218]: En échec
                - generic [ref=f5e219]:
                  - generic [ref=f5e220]: ","
                  - text: "1"
              - tab "Non envoyée , 714" [ref=f5e221] [cursor=pointer]:
                - generic [ref=f5e222]: Non envoyée
                - generic [ref=f5e223]:
                  - generic [ref=f5e224]: ","
                  - text: "714"
              - tab "Annulée , 9" [ref=f5e225] [cursor=pointer]:
                - generic [ref=f5e226]: Annulée
                - generic [ref=f5e227]:
                  - generic [ref=f5e228]: ","
                  - text: "9"
              - tab "Incertaine , 1" [ref=f5e229] [cursor=pointer]:
                - generic [ref=f5e230]: Incertaine
                - generic [ref=f5e231]:
                  - generic [ref=f5e232]: ","
                  - text: "1"
            - search [ref=f5e233]:
              - generic [ref=f5e234]:
                - generic [ref=f5e235]: Rechercher
                - searchbox "Rechercher" [ref=f5e237]
              - generic [ref=f5e238]:
                - generic [ref=f5e239]: Canal
                - combobox "Canal" [ref=f5e242] [cursor=pointer]:
                  - option "Tous les canaux" [selected]
                  - option "Application"
                  - option "SMS"
                  - option "Email"
                  - option "Notification push"
              - generic [ref=f5e243]:
                - generic [ref=f5e244]: Type
                - combobox "Type" [ref=f5e247] [cursor=pointer]:
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
              - generic [ref=f5e248]:
                - generic [ref=f5e249]:
                  - generic [ref=f5e250]: Du
                  - textbox "Du" [ref=f5e252]
                - generic [ref=f5e253]:
                  - generic [ref=f5e254]: Au
                  - textbox "Au" [ref=f5e256]
            - tabpanel "Toutes" [ref=f5e257]:
              - generic [ref=f5e258]:
                - region "Notifications de la boîte d’envoi" [ref=f5e260]:
                  - table [ref=f5e261]:
                    - caption [ref=f5e262]: Notifications de la boîte d’envoi
                    - rowgroup [ref=f5e263]:
                      - row [ref=f5e264]:
                        - columnheader "Date" [ref=f5e265]
                        - columnheader "Type" [ref=f5e266]
                        - columnheader "Canal" [ref=f5e267]
                        - columnheader "Destinataire" [ref=f5e268]
                        - columnheader "Statut" [ref=f5e269]
                        - columnheader "Motif" [ref=f5e270]
                        - columnheader "Détail" [ref=f5e271]
                    - rowgroup [ref=f5e272]:
                      - row [ref=f5e273]:
                        - cell [ref=f5e274]:
                          - time [ref=f5e275]: sam. 21 nov. 2026 à 03:11
                        - cell "Code administrateur" [ref=f5e276]
                        - cell "SMS" [ref=f5e279]
                        - cell "+221 70 *** ** 07" [ref=f5e280]
                        - cell "Envoyée" [ref=f5e281]
                        - cell "—" [ref=f5e285]
                        - cell [ref=f5e286]:
                          - 'link "Voir le détail : Code administrateur, sam. 21 nov. 2026 à 03:11" [ref=f5e287] [cursor=pointer]':
                            - /url: /admin/notifications/2f5f60b8-7a68-4a64-8556-8439179ca289
                            - generic [ref=f5e288]: Voir
                      - row [ref=f5e292]:
                        - cell [ref=f5e293]:
                          - time [ref=f5e294]: sam. 21 nov. 2026 à 03:11
                        - cell "Code administrateur" [ref=f5e295]
                        - cell "SMS" [ref=f5e298]
                        - cell "+221 70 *** ** 04" [ref=f5e299]
                        - cell "Envoyée" [ref=f5e300]
                        - cell "—" [ref=f5e304]
                        - cell [ref=f5e305]:
                          - 'link "Voir le détail : Code administrateur, sam. 21 nov. 2026 à 03:11" [ref=f5e306] [cursor=pointer]':
                            - /url: /admin/notifications/a3fd460d-2783-4d65-b294-4607285e98b2
                            - generic [ref=f5e307]: Voir
                      - row [ref=f5e311]:
                        - cell [ref=f5e312]:
                          - time [ref=f5e313]: sam. 21 nov. 2026 à 03:11
                        - cell "Réservation de salle demandée" [ref=f5e314]
                        - cell "Email" [ref=f5e317]
                        - cell "Fatou M." [ref=f5e318]
                        - cell "Non envoyée" [ref=f5e319]
                        - cell "Adresse email non vérifiée" [ref=f5e323]
                        - cell [ref=f5e324]:
                          - 'link "Voir le détail : Réservation de salle demandée, sam. 21 nov. 2026 à 03:11" [ref=f5e325] [cursor=pointer]':
                            - /url: /admin/notifications/e6b56dc2-f0df-4249-9470-a7a526fb8194
                            - generic [ref=f5e326]: Voir
                      - row [ref=f5e330]:
                        - cell [ref=f5e331]:
                          - time [ref=f5e332]: sam. 21 nov. 2026 à 03:11
                        - cell "Réservation de salle demandée" [ref=f5e333]
                        - cell "Notification push" [ref=f5e336]
                        - cell "Fatou M." [ref=f5e337]
                        - cell "Non envoyée" [ref=f5e338]
                        - cell "Aucun appareil abonné aux notifications push" [ref=f5e342]
                        - cell [ref=f5e343]:
                          - 'link "Voir le détail : Réservation de salle demandée, sam. 21 nov. 2026 à 03:11" [ref=f5e344] [cursor=pointer]':
                            - /url: /admin/notifications/8547f80d-810f-4b53-9969-c40bd82ece49
                            - generic [ref=f5e345]: Voir
                      - row [ref=f5e349]:
                        - cell [ref=f5e350]:
                          - time [ref=f5e351]: sam. 21 nov. 2026 à 03:11
                        - cell "Réservation de salle demandée" [ref=f5e352]
                        - cell "Application" [ref=f5e355]
                        - cell "Fatou M." [ref=f5e356]
                        - cell "Envoyée" [ref=f5e357]
                        - cell "—" [ref=f5e361]
                        - cell [ref=f5e362]:
                          - 'link "Voir le détail : Réservation de salle demandée, sam. 21 nov. 2026 à 03:11" [ref=f5e363] [cursor=pointer]':
                            - /url: /admin/notifications/3a110cfe-c79b-4655-82c2-d705697d7fa4
                            - generic [ref=f5e364]: Voir
                      - row [ref=f5e368]:
                        - cell [ref=f5e369]:
                          - time [ref=f5e370]: sam. 21 nov. 2026 à 03:11
                        - cell "Réservation de salle demandée" [ref=f5e371]
                        - cell "SMS" [ref=f5e374]
                        - cell "Fatou M." [ref=f5e375]
                        - cell "Envoyée" [ref=f5e376]
                        - cell "—" [ref=f5e380]
                        - cell [ref=f5e381]:
                          - 'link "Voir le détail : Réservation de salle demandée, sam. 21 nov. 2026 à 03:11" [ref=f5e382] [cursor=pointer]':
                            - /url: /admin/notifications/171fd871-886d-4040-b7d6-dc70d71ecaca
                            - generic [ref=f5e383]: Voir
                      - row [ref=f5e387]:
                        - cell [ref=f5e388]:
                          - time [ref=f5e389]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e390]
                        - cell "Notification push" [ref=f5e393]
                        - cell "Mariama N." [ref=f5e394]
                        - cell "Non envoyée" [ref=f5e395]
                        - cell "Aucun appareil abonné aux notifications push" [ref=f5e399]
                        - cell [ref=f5e400]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e401] [cursor=pointer]':
                            - /url: /admin/notifications/da9bdf3e-2595-4157-ab55-1efa6a036991
                            - generic [ref=f5e402]: Voir
                      - row [ref=f5e406]:
                        - cell [ref=f5e407]:
                          - time [ref=f5e408]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e409]
                        - cell "SMS" [ref=f5e412]
                        - cell "Mariama N." [ref=f5e413]
                        - cell "Envoyée" [ref=f5e414]
                        - cell "—" [ref=f5e418]
                        - cell [ref=f5e419]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e420] [cursor=pointer]':
                            - /url: /admin/notifications/7da12a8a-4e3c-4734-a93e-043f4094b7f5
                            - generic [ref=f5e421]: Voir
                      - row [ref=f5e425]:
                        - cell [ref=f5e426]:
                          - time [ref=f5e427]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e428]
                        - cell "Application" [ref=f5e431]
                        - cell "Mariama N." [ref=f5e432]
                        - cell "Envoyée" [ref=f5e433]
                        - cell "—" [ref=f5e437]
                        - cell [ref=f5e438]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e439] [cursor=pointer]':
                            - /url: /admin/notifications/7b8de81a-4796-4094-8778-b8e45cae8c31
                            - generic [ref=f5e440]: Voir
                      - row [ref=f5e444]:
                        - cell [ref=f5e445]:
                          - time [ref=f5e446]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e447]
                        - cell "Email" [ref=f5e450]
                        - cell "Mariama N." [ref=f5e451]
                        - cell "Non envoyée" [ref=f5e452]
                        - cell "Adresse email non vérifiée" [ref=f5e456]
                        - cell [ref=f5e457]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e458] [cursor=pointer]':
                            - /url: /admin/notifications/45df9be3-91d7-43d7-be4c-fdcf44f3f427
                            - generic [ref=f5e459]: Voir
                      - row [ref=f5e463]:
                        - cell [ref=f5e464]:
                          - time [ref=f5e465]: sam. 21 nov. 2026 à 03:11
                        - cell "Salle à valider" [ref=f5e466]
                        - cell "Application" [ref=f5e469]
                        - cell "Elhadji S." [ref=f5e470]
                        - cell "Envoyée" [ref=f5e471]
                        - cell "—" [ref=f5e475]
                        - cell [ref=f5e476]:
                          - 'link "Voir le détail : Salle à valider, sam. 21 nov. 2026 à 03:11" [ref=f5e477] [cursor=pointer]':
                            - /url: /admin/notifications/d4d584f5-081f-436e-a517-f17fcaba84ed
                            - generic [ref=f5e478]: Voir
                      - row [ref=f5e482]:
                        - cell [ref=f5e483]:
                          - time [ref=f5e484]: sam. 21 nov. 2026 à 03:11
                        - cell "Salle à valider" [ref=f5e485]
                        - cell "Email" [ref=f5e488]
                        - cell "Elhadji S." [ref=f5e489]
                        - cell "Non envoyée" [ref=f5e490]
                        - cell "Adresse email non vérifiée" [ref=f5e494]
                        - cell [ref=f5e495]:
                          - 'link "Voir le détail : Salle à valider, sam. 21 nov. 2026 à 03:11" [ref=f5e496] [cursor=pointer]':
                            - /url: /admin/notifications/b59df4be-c2ff-48da-89f6-e5b1ee124a10
                            - generic [ref=f5e497]: Voir
                      - row [ref=f5e501]:
                        - cell [ref=f5e502]:
                          - time [ref=f5e503]: sam. 21 nov. 2026 à 03:11
                        - cell "Salle à valider" [ref=f5e504]
                        - cell "Notification push" [ref=f5e507]
                        - cell "Elhadji S." [ref=f5e508]
                        - cell "Non envoyée" [ref=f5e509]
                        - cell "Aucun appareil abonné aux notifications push" [ref=f5e513]
                        - cell [ref=f5e514]:
                          - 'link "Voir le détail : Salle à valider, sam. 21 nov. 2026 à 03:11" [ref=f5e515] [cursor=pointer]':
                            - /url: /admin/notifications/4318cefe-854e-436c-b8e5-4c0fe2d44f36
                            - generic [ref=f5e516]: Voir
                      - row [ref=f5e520]:
                        - cell [ref=f5e521]:
                          - time [ref=f5e522]: sam. 21 nov. 2026 à 03:11
                        - cell "Salle à valider" [ref=f5e523]
                        - cell "Notification push" [ref=f5e526]
                        - cell "Elhadji S." [ref=f5e527]
                        - cell "Non envoyée" [ref=f5e528]
                        - cell "Aucun appareil abonné aux notifications push" [ref=f5e532]
                        - cell [ref=f5e533]:
                          - 'link "Voir le détail : Salle à valider, sam. 21 nov. 2026 à 03:11" [ref=f5e534] [cursor=pointer]':
                            - /url: /admin/notifications/cd922b6b-c346-4d44-aa2a-097c7cb96347
                            - generic [ref=f5e535]: Voir
                      - row [ref=f5e539]:
                        - cell [ref=f5e540]:
                          - time [ref=f5e541]: sam. 21 nov. 2026 à 03:11
                        - cell "Salle à valider" [ref=f5e542]
                        - cell "Email" [ref=f5e545]
                        - cell "Elhadji S." [ref=f5e546]
                        - cell "Non envoyée" [ref=f5e547]
                        - cell "Adresse email non vérifiée" [ref=f5e551]
                        - cell [ref=f5e552]:
                          - 'link "Voir le détail : Salle à valider, sam. 21 nov. 2026 à 03:11" [ref=f5e553] [cursor=pointer]':
                            - /url: /admin/notifications/4e5ff760-398d-46a6-8715-0ef7aa8cadfa
                            - generic [ref=f5e554]: Voir
                      - row [ref=f5e558]:
                        - cell [ref=f5e559]:
                          - time [ref=f5e560]: sam. 21 nov. 2026 à 03:11
                        - cell "Salle à valider" [ref=f5e561]
                        - cell "Application" [ref=f5e564]
                        - cell "Elhadji S." [ref=f5e565]
                        - cell "Envoyée" [ref=f5e566]
                        - cell "—" [ref=f5e570]
                        - cell [ref=f5e571]:
                          - 'link "Voir le détail : Salle à valider, sam. 21 nov. 2026 à 03:11" [ref=f5e572] [cursor=pointer]':
                            - /url: /admin/notifications/0df3e867-6b0e-4c1c-8c3a-5ceab4131d9f
                            - generic [ref=f5e573]: Voir
                      - row [ref=f5e577]:
                        - cell [ref=f5e578]:
                          - time [ref=f5e579]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e580]
                        - cell "Email" [ref=f5e583]
                        - cell "Mariama N." [ref=f5e584]
                        - cell "Non envoyée" [ref=f5e585]
                        - cell "Adresse email non vérifiée" [ref=f5e589]
                        - cell [ref=f5e590]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e591] [cursor=pointer]':
                            - /url: /admin/notifications/f8e3c94c-85c0-43ac-a925-fe5a3b2ff052
                            - generic [ref=f5e592]: Voir
                      - row [ref=f5e596]:
                        - cell [ref=f5e597]:
                          - time [ref=f5e598]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e599]
                        - cell "Application" [ref=f5e602]
                        - cell "Mariama N." [ref=f5e603]
                        - cell "Envoyée" [ref=f5e604]
                        - cell "—" [ref=f5e608]
                        - cell [ref=f5e609]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e610] [cursor=pointer]':
                            - /url: /admin/notifications/da4024e7-4571-4ff3-88cc-dabf2c4a9400
                            - generic [ref=f5e611]: Voir
                      - row [ref=f5e615]:
                        - cell [ref=f5e616]:
                          - time [ref=f5e617]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e618]
                        - cell "Notification push" [ref=f5e621]
                        - cell "Mariama N." [ref=f5e622]
                        - cell "Non envoyée" [ref=f5e623]
                        - cell "Aucun appareil abonné aux notifications push" [ref=f5e627]
                        - cell [ref=f5e628]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e629] [cursor=pointer]':
                            - /url: /admin/notifications/b4bc465d-ddad-4508-9ff4-efa319cd5be3
                            - generic [ref=f5e630]: Voir
                      - row [ref=f5e634]:
                        - cell [ref=f5e635]:
                          - time [ref=f5e636]: sam. 21 nov. 2026 à 03:11
                        - cell "Décision sur une salle" [ref=f5e637]
                        - cell "SMS" [ref=f5e640]
                        - cell "Mariama N." [ref=f5e641]
                        - cell "Envoyée" [ref=f5e642]
                        - cell "—" [ref=f5e646]
                        - cell [ref=f5e647]:
                          - 'link "Voir le détail : Décision sur une salle, sam. 21 nov. 2026 à 03:11" [ref=f5e648] [cursor=pointer]':
                            - /url: /admin/notifications/4956d2f3-6d1c-4061-b492-c1b65a2595d5
                            - generic [ref=f5e649]: Voir
                - navigation "Pages des notifications" [ref=f5e653]:
                  - button "Précédent" [disabled] [ref=f5e654]
                  - paragraph [ref=f5e659]:
                    - text: Page 1 sur 79
                    - generic [ref=f5e660]: · 1 573 résultats
                  - button "Suivant" [ref=f5e661] [cursor=pointer]
          - region [ref=f5e666]:
            - generic [ref=f5e667]:
              - heading "Par jour et par canal" [level=2] [ref=f5e668]
              - paragraph [ref=f5e669]: 14 derniers jours, heure de Dakar.
            - region "Notifications par jour et par canal" [ref=f5e671]:
              - table [ref=f5e672]:
                - caption [ref=f5e673]: Notifications par jour et par canal
                - rowgroup [ref=f5e674]:
                  - row [ref=f5e675]:
                    - columnheader "Jour" [ref=f5e676]
                    - columnheader "Canal" [ref=f5e677]
                    - columnheader "Envoyées" [ref=f5e678]
                    - columnheader "En échec" [ref=f5e679]
                    - columnheader "Non envoyées" [ref=f5e680]
                    - columnheader "Incertaines" [ref=f5e681]
                    - columnheader "Annulées" [ref=f5e682]
                - rowgroup [ref=f5e683]:
                  - row [ref=f5e684]:
                    - cell "21 nov. 2026" [ref=f5e685]
                    - cell "Email" [ref=f5e686]
                    - cell "0" [ref=f5e687]
                    - cell "0" [ref=f5e688]
                    - cell "419" [ref=f5e689]
                    - cell "0" [ref=f5e690]
                    - cell "0" [ref=f5e691]
                  - row [ref=f5e692]:
                    - cell "21 nov. 2026" [ref=f5e693]
                    - cell "Application" [ref=f5e694]
                    - cell "378" [ref=f5e695]
                    - cell "0" [ref=f5e696]
                    - cell "0" [ref=f5e697]
                    - cell "0" [ref=f5e698]
                    - cell "3" [ref=f5e699]
                  - row [ref=f5e700]:
                    - cell "21 nov. 2026" [ref=f5e701]
                    - cell "Notification push" [ref=f5e702]
                    - cell "0" [ref=f5e703]
                    - cell "0" [ref=f5e704]
                    - cell "279" [ref=f5e705]
                    - cell "0" [ref=f5e706]
                    - cell "3" [ref=f5e707]
                  - row [ref=f5e708]:
                    - cell "21 nov. 2026" [ref=f5e709]
                    - cell "SMS" [ref=f5e710]
                    - cell "202" [ref=f5e711]
                    - cell "1" [ref=f5e712]
                    - cell "0" [ref=f5e713]
                    - cell "1" [ref=f5e714]
                    - cell "3" [ref=f5e715]
  - alert [ref=f5e716]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import { keepHomeOutOfHallsWindow } from './support/halls-switch';
  26  | import {
  27  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  28  | } from './support/responsive-pages';
  29  | import { runResponsiveChecks } from './support/responsive-checks';
  30  | 
  31  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  32  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  33  | 
  34  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  35  |     { key: 'clair', colorScheme: 'light' },
  36  |     { key: 'sombre', colorScheme: 'dark' },
  37  | ];
  38  | 
  39  | interface Size { width: number; height: number; paysage?: boolean }
  40  | 
  41  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  42  |     const base: Size[] = RESPONSIVE_WIDTHS
  43  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  44  |         .map((w) => ({ width: w.width, height: w.height }));
  45  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  46  |     return [...base, ...land];
  47  | }
  48  | 
  49  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  50  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  51  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  52  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  53  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  54  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  55  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  56  | }
  57  | 
  58  | interface ResponsiveRecord {
  59  |     page: string;
  60  |     titre: string;
  61  |     groupe: string;
  62  |     role: CaptureRole;
  63  |     theme: ThemeKey;
  64  |     url: string | null;
  65  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  66  |     notes: string[];
  67  |     error: string | null;
  68  | }
  69  | 
  70  | for (const theme of THEMES) {
  71  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  72  |     for (const role of roles) {
  73  |         test.describe(`${theme.key} · ${role}`, () => {
  74  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  75  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, hallsLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b : verrou des salles avant tout chargement (attente ajoutée au délai du test)
  81  |                         await hallsLock.enter(p.salles ? 'salles' : 'autres');
  82  |                         if (hallsLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des salles : ${Math.round(hallsLock.waitedMs / 1000)} s`);
  83  |                         if (p.salles) {
  84  |                             record.notes.push('page des salles : interrupteur features.halls_enabled ouvert le temps du test (e2e/support/halls-switch.ts)');
  85  |                             await keepHomeOutOfHallsWindow(page);
  86  |                         }
  87  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  88  |                         record.url = p.path(demo);
  89  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  90  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  91  |                         for (const size of sizesFor(p, theme.key)) {
  92  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  93  |                             await page.setViewportSize({ width: size.width, height: size.height });
  94  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  95  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  96  |                             if (p.ready) await p.ready(page);
  97  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  98  |                             if (p.actions) await p.actions(page);
  99  |                             await settle(page, record.notes, at);
  100 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  101 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  102 |                             let capture: string | null = null;
  103 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  104 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  105 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  106 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  107 |                             }
  108 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  109 |                         }
  110 |                     } catch (err) {
  111 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  112 |                         throw err;
  113 |                     } finally {
  114 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  115 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  116 |                         fs.mkdirSync(RESULTS, { recursive: true });
  117 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  118 |                     }
  119 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 120 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de adm-notifications (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```