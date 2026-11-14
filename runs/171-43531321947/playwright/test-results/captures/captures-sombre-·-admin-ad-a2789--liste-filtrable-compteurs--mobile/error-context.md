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
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 40 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "40"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Aïda Diallo)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: AD
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e40]:
            - status [ref=e42]: En direct
            - heading "Notifications" [level=1] [ref=e44]
            - paragraph [ref=e45]: "Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar."
          - region [ref=e46]:
            - heading "Compteurs" [level=2] [ref=e47]
            - generic [ref=e48]:
              - generic [ref=e49]:
                - paragraph [ref=e51]: SMS aujourd'hui
                - paragraph [ref=e55]: "194"
                - paragraph [ref=e56]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=e57]:
                - paragraph [ref=e59]: SMS optionnels aujourd'hui
                - paragraph [ref=e64]: "0"
                - paragraph [ref=e65]: "Plafond : 700 par jour, alerte à 560."
              - generic [ref=e66]:
                - paragraph [ref=e68]: SMS ce mois-ci
                - paragraph [ref=e75]: "194"
                - paragraph [ref=e76]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=e77]:
            - heading "Envois" [level=2] [ref=e78]
            - tablist "Filtrer par statut" [ref=e81]:
              - tab "Toutes" [selected] [ref=e82] [cursor=pointer]
              - tab "En attente , 125" [ref=e84] [cursor=pointer]:
                - generic [ref=e85]: En attente
                - generic [ref=e86]:
                  - generic [ref=e87]: ","
                  - text: "125"
              - tab "En cours d'envoi , 0" [ref=e88] [cursor=pointer]:
                - generic [ref=e89]: En cours d'envoi
                - generic [ref=e90]:
                  - generic [ref=e91]: ","
                  - text: "0"
              - tab "Envoyée , 656" [ref=e92] [cursor=pointer]:
                - generic [ref=e93]: Envoyée
                - generic [ref=e94]:
                  - generic [ref=e95]: ","
                  - text: "656"
              - tab "En échec , 1" [ref=e96] [cursor=pointer]:
                - generic [ref=e97]: En échec
                - generic [ref=e98]:
                  - generic [ref=e99]: ","
                  - text: "1"
              - tab "Non envoyée , 533" [ref=e100] [cursor=pointer]:
                - generic [ref=e101]: Non envoyée
                - generic [ref=e102]:
                  - generic [ref=e103]: ","
                  - text: "533"
              - tab "Annulée , 9" [ref=e104] [cursor=pointer]:
                - generic [ref=e105]: Annulée
                - generic [ref=e106]:
                  - generic [ref=e107]: ","
                  - text: "9"
              - tab "Incertaine , 1" [ref=e108] [cursor=pointer]:
                - generic [ref=e109]: Incertaine
                - generic [ref=e110]:
                  - generic [ref=e111]: ","
                  - text: "1"
            - search [ref=e112]:
              - generic [ref=e113]:
                - generic [ref=e114]: Rechercher
                - searchbox "Rechercher" [ref=e116]
              - generic [ref=e117]:
                - generic [ref=e118]: Canal
                - combobox "Canal" [ref=e121] [cursor=pointer]:
                  - option "Tous les canaux" [selected]
                  - option "Application"
                  - option "SMS"
                  - option "Email"
                  - option "Notification push"
              - generic [ref=e122]:
                - generic [ref=e123]: Type
                - combobox "Type" [ref=e126] [cursor=pointer]:
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
              - generic [ref=e127]:
                - generic [ref=e128]:
                  - generic [ref=e129]: Du
                  - textbox "Du" [ref=e131]
                - generic [ref=e132]:
                  - generic [ref=e133]: Au
                  - textbox "Au" [ref=e135]
            - tabpanel "Toutes" [ref=e136]:
              - generic [ref=e137]:
                - list "Notifications de la boîte d’envoi" [ref=e139]:
                  - listitem [ref=e140]:
                    - generic [ref=e141]:
                      - generic [ref=e142]:
                        - paragraph [ref=e143]: Code administrateur
                        - generic [ref=e144]: Envoyée
                      - paragraph [ref=e147]: SMS · +221 70 *** ** 07
                      - generic [ref=e148]:
                        - time [ref=e149]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e150] [cursor=pointer]:
                          - /url: /admin/notifications/2648ec31-165e-4f41-96da-28b61ea1f272
                  - listitem [ref=e155]:
                    - generic [ref=e156]:
                      - generic [ref=e157]:
                        - paragraph [ref=e158]: Code administrateur
                        - generic [ref=e159]: Envoyée
                      - paragraph [ref=e162]: SMS · +221 70 *** ** 04
                      - generic [ref=e163]:
                        - time [ref=e164]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e165] [cursor=pointer]:
                          - /url: /admin/notifications/43e8f156-bb0d-4988-8c08-cf4102bc910a
                  - listitem [ref=e170]:
                    - generic [ref=e171]:
                      - generic [ref=e172]:
                        - paragraph [ref=e173]: Confirmation d’achat
                        - generic [ref=e174]: Envoyée
                      - paragraph [ref=e177]: Nuit du slam de Kaolack
                      - paragraph [ref=e178]: Application · Alioune F.
                      - generic [ref=e179]:
                        - time [ref=e180]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e181] [cursor=pointer]:
                          - /url: /admin/notifications/69ed230e-8428-4119-815f-622bfb4f6e02
                  - listitem [ref=e186]:
                    - generic [ref=e187]:
                      - generic [ref=e188]:
                        - paragraph [ref=e189]: Confirmation d’achat
                        - generic [ref=e190]: Envoyée
                      - paragraph [ref=e193]: Nuit du slam de Kaolack
                      - paragraph [ref=e194]: SMS · +221 70 *** ** 08
                      - generic [ref=e195]:
                        - time [ref=e196]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e197] [cursor=pointer]:
                          - /url: /admin/notifications/62fd9d33-6ad9-4416-8bb5-e0d10c865a0f
                  - listitem [ref=e202]:
                    - generic [ref=e203]:
                      - generic [ref=e204]:
                        - paragraph [ref=e205]: Confirmation d’achat
                        - generic [ref=e206]: Non envoyée
                      - paragraph [ref=e209]: Nuit du slam de Kaolack
                      - paragraph [ref=e210]: Email · Alioune F.
                      - paragraph [ref=e211]: Adresse email non vérifiée
                      - generic [ref=e212]:
                        - time [ref=e213]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e214] [cursor=pointer]:
                          - /url: /admin/notifications/4909bf76-3796-4a6d-9a3c-ce57b2cffc93
                  - listitem [ref=e219]:
                    - generic [ref=e220]:
                      - generic [ref=e221]:
                        - paragraph [ref=e222]: Nouvelle commande
                        - generic [ref=e223]: Envoyée
                      - paragraph [ref=e226]: Nuit du slam de Kaolack
                      - paragraph [ref=e227]: Application · Ousmane F.
                      - generic [ref=e228]:
                        - time [ref=e229]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e230] [cursor=pointer]:
                          - /url: /admin/notifications/313f84fc-c749-4389-82a9-1b3d6fc44662
                  - listitem [ref=e235]:
                    - generic [ref=e236]:
                      - generic [ref=e237]:
                        - paragraph [ref=e238]: Confirmation d’achat
                        - generic [ref=e239]: Envoyée
                      - paragraph [ref=e242]: Nuit du slam de Kaolack
                      - paragraph [ref=e243]: SMS · +221 70 *** ** 07
                      - generic [ref=e244]:
                        - time [ref=e245]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e246] [cursor=pointer]:
                          - /url: /admin/notifications/ca2f15fa-18ad-4e10-a517-bf4c85b90dd1
                  - listitem [ref=e251]:
                    - generic [ref=e252]:
                      - generic [ref=e253]:
                        - paragraph [ref=e254]: Confirmation d’achat
                        - generic [ref=e255]: Envoyée
                      - paragraph [ref=e258]: Nuit du slam de Kaolack
                      - paragraph [ref=e259]: Application · Mame N.
                      - generic [ref=e260]:
                        - time [ref=e261]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e262] [cursor=pointer]:
                          - /url: /admin/notifications/c2317a30-c5ca-4a20-8636-e7e551e41184
                  - listitem [ref=e267]:
                    - generic [ref=e268]:
                      - generic [ref=e269]:
                        - paragraph [ref=e270]: Nouvelle commande
                        - generic [ref=e271]: Envoyée
                      - paragraph [ref=e274]: Nuit du slam de Kaolack
                      - paragraph [ref=e275]: Application · Ousmane F.
                      - generic [ref=e276]:
                        - time [ref=e277]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e278] [cursor=pointer]:
                          - /url: /admin/notifications/9376a449-c605-4df6-a2d4-0be10ea252da
                  - listitem [ref=e283]:
                    - generic [ref=e284]:
                      - generic [ref=e285]:
                        - paragraph [ref=e286]: Confirmation d’achat
                        - generic [ref=e287]: Non envoyée
                      - paragraph [ref=e290]: Nuit du slam de Kaolack
                      - paragraph [ref=e291]: Email · Mame N.
                      - paragraph [ref=e292]: Adresse email non vérifiée
                      - generic [ref=e293]:
                        - time [ref=e294]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e295] [cursor=pointer]:
                          - /url: /admin/notifications/1a24f37c-8ee6-4c38-bdd9-4d0c5ed009f5
                  - listitem [ref=e300]:
                    - generic [ref=e301]:
                      - generic [ref=e302]:
                        - paragraph [ref=e303]: Confirmation d’achat
                        - generic [ref=e304]: Envoyée
                      - paragraph [ref=e307]: Nuit du slam de Kaolack
                      - paragraph [ref=e308]: Application · Babacar D.
                      - generic [ref=e309]:
                        - time [ref=e310]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e311] [cursor=pointer]:
                          - /url: /admin/notifications/b031025d-a158-499d-9556-6118ab68436d
                  - listitem [ref=e316]:
                    - generic [ref=e317]:
                      - generic [ref=e318]:
                        - paragraph [ref=e319]: Confirmation d’achat
                        - generic [ref=e320]: Non envoyée
                      - paragraph [ref=e323]: Nuit du slam de Kaolack
                      - paragraph [ref=e324]: Email · Babacar D.
                      - paragraph [ref=e325]: Adresse email non vérifiée
                      - generic [ref=e326]:
                        - time [ref=e327]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e328] [cursor=pointer]:
                          - /url: /admin/notifications/aab2363b-30f5-4c19-ad7f-27c6adc7238f
                  - listitem [ref=e333]:
                    - generic [ref=e334]:
                      - generic [ref=e335]:
                        - paragraph [ref=e336]: Nouvelle commande
                        - generic [ref=e337]: Envoyée
                      - paragraph [ref=e340]: Nuit du slam de Kaolack
                      - paragraph [ref=e341]: Application · Ousmane F.
                      - generic [ref=e342]:
                        - time [ref=e343]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e344] [cursor=pointer]:
                          - /url: /admin/notifications/99567f9e-98a0-454b-858e-c9ca13fb8520
                  - listitem [ref=e349]:
                    - generic [ref=e350]:
                      - generic [ref=e351]:
                        - paragraph [ref=e352]: Confirmation d’achat
                        - generic [ref=e353]: Envoyée
                      - paragraph [ref=e356]: Nuit du slam de Kaolack
                      - paragraph [ref=e357]: SMS · +221 70 *** ** 06
                      - generic [ref=e358]:
                        - time [ref=e359]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e360] [cursor=pointer]:
                          - /url: /admin/notifications/149d093f-2773-47d4-9b28-a0c5727881f0
                  - listitem [ref=e365]:
                    - generic [ref=e366]:
                      - generic [ref=e367]:
                        - paragraph [ref=e368]: Confirmation d’achat
                        - generic [ref=e369]: Non envoyée
                      - paragraph [ref=e372]: Nuit du slam de Kaolack
                      - paragraph [ref=e373]: Email · Ndeye T.
                      - paragraph [ref=e374]: Adresse email non vérifiée
                      - generic [ref=e375]:
                        - time [ref=e376]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e377] [cursor=pointer]:
                          - /url: /admin/notifications/cf9b5ad7-eee0-4375-acc2-3348d4d61469
                  - listitem [ref=e382]:
                    - generic [ref=e383]:
                      - generic [ref=e384]:
                        - paragraph [ref=e385]: Nouvelle commande
                        - generic [ref=e386]: Envoyée
                      - paragraph [ref=e389]: Nuit du slam de Kaolack
                      - paragraph [ref=e390]: Application · Ousmane F.
                      - generic [ref=e391]:
                        - time [ref=e392]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e393] [cursor=pointer]:
                          - /url: /admin/notifications/7f7d8534-5942-498b-adf6-28fbdf8b6656
                  - listitem [ref=e398]:
                    - generic [ref=e399]:
                      - generic [ref=e400]:
                        - paragraph [ref=e401]: Confirmation d’achat
                        - generic [ref=e402]: Envoyée
                      - paragraph [ref=e405]: Nuit du slam de Kaolack
                      - paragraph [ref=e406]: Application · Ndeye T.
                      - generic [ref=e407]:
                        - time [ref=e408]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e409] [cursor=pointer]:
                          - /url: /admin/notifications/2518c89a-6ae8-413f-9b4d-3da91a7ca2d4
                  - listitem [ref=e414]:
                    - generic [ref=e415]:
                      - generic [ref=e416]:
                        - paragraph [ref=e417]: Confirmation d’achat
                        - generic [ref=e418]: Envoyée
                      - paragraph [ref=e421]: Nuit du slam de Kaolack
                      - paragraph [ref=e422]: SMS · +221 70 *** ** 05
                      - generic [ref=e423]:
                        - time [ref=e424]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e425] [cursor=pointer]:
                          - /url: /admin/notifications/0524f1a0-deba-4fb7-aa39-1a658f090222
                  - listitem [ref=e430]:
                    - generic [ref=e431]:
                      - generic [ref=e432]:
                        - paragraph [ref=e433]: Confirmation d’achat
                        - generic [ref=e434]: Envoyée
                      - paragraph [ref=e437]: Nuit du slam de Kaolack
                      - paragraph [ref=e438]: Application · Cheikh S.
                      - generic [ref=e439]:
                        - time [ref=e440]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e441] [cursor=pointer]:
                          - /url: /admin/notifications/e8fc8026-adf1-4223-963b-d62f4df7287b
                  - listitem [ref=e446]:
                    - generic [ref=e447]:
                      - generic [ref=e448]:
                        - paragraph [ref=e449]: Nouvelle commande
                        - generic [ref=e450]: Envoyée
                      - paragraph [ref=e453]: Nuit du slam de Kaolack
                      - paragraph [ref=e454]: Application · Ousmane F.
                      - generic [ref=e455]:
                        - time [ref=e456]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e457] [cursor=pointer]:
                          - /url: /admin/notifications/e2f40c6a-7e73-4e7b-86ec-8907b8a0f013
                - navigation "Pages des notifications" [ref=e462]:
                  - button "Précédent" [disabled] [ref=e463]
                  - paragraph [ref=e468]: Page 1 sur 67
                  - button "Suivant" [ref=e469] [cursor=pointer]
          - region [ref=e474]:
            - generic [ref=e475]:
              - heading "Par jour et par canal" [level=2] [ref=e476]
              - paragraph [ref=e477]: 14 derniers jours, heure de Dakar.
            - list "Notifications par jour et par canal" [ref=e479]:
              - listitem [ref=e480]:
                - generic [ref=e481]: 14 nov. 2026 · Email
                - generic [ref=e482]:
                  - term [ref=e483]: Jour
                  - definition [ref=e484]: 14 nov. 2026
                  - term [ref=e485]: Canal
                  - definition [ref=e486]: Email
                  - term [ref=e487]: Envoyées
                  - definition [ref=e488]: "0"
                  - term [ref=e489]: En échec
                  - definition [ref=e490]: "0"
                  - term [ref=e491]: Non envoyées
                  - definition [ref=e492]: "377"
                  - term [ref=e493]: Incertaines
                  - definition [ref=e494]: "0"
                  - term [ref=e495]: Annulées
                  - definition [ref=e496]: "0"
              - listitem [ref=e497]:
                - generic [ref=e498]: 14 nov. 2026 · Application
                - generic [ref=e499]:
                  - term [ref=e500]: Jour
                  - definition [ref=e501]: 14 nov. 2026
                  - term [ref=e502]: Canal
                  - definition [ref=e503]: Application
                  - term [ref=e504]: Envoyées
                  - definition [ref=e505]: "463"
                  - term [ref=e506]: En échec
                  - definition [ref=e507]: "0"
                  - term [ref=e508]: Non envoyées
                  - definition [ref=e509]: "0"
                  - term [ref=e510]: Incertaines
                  - definition [ref=e511]: "0"
                  - term [ref=e512]: Annulées
                  - definition [ref=e513]: "3"
              - listitem [ref=e514]:
                - generic [ref=e515]: 14 nov. 2026 · Notification push
                - generic [ref=e516]:
                  - term [ref=e517]: Jour
                  - definition [ref=e518]: 14 nov. 2026
                  - term [ref=e519]: Canal
                  - definition [ref=e520]: Notification push
                  - term [ref=e521]: Envoyées
                  - definition [ref=e522]: "0"
                  - term [ref=e523]: En échec
                  - definition [ref=e524]: "0"
                  - term [ref=e525]: Non envoyées
                  - definition [ref=e526]: "123"
                  - term [ref=e527]: Incertaines
                  - definition [ref=e528]: "0"
                  - term [ref=e529]: Annulées
                  - definition [ref=e530]: "3"
              - listitem [ref=e531]:
                - generic [ref=e532]: 14 nov. 2026 · SMS
                - generic [ref=e533]:
                  - term [ref=e534]: Jour
                  - definition [ref=e535]: 14 nov. 2026
                  - term [ref=e536]: Canal
                  - definition [ref=e537]: SMS
                  - term [ref=e538]: Envoyées
                  - definition [ref=e539]: "193"
                  - term [ref=e540]: En échec
                  - definition [ref=e541]: "1"
                  - term [ref=e542]: Non envoyées
                  - definition [ref=e543]: "17"
                  - term [ref=e544]: Incertaines
                  - definition [ref=e545]: "1"
                  - term [ref=e546]: Annulées
                  - definition [ref=e547]: "3"
    - navigation "Navigation rapide" [ref=e548]:
      - generic [ref=e549]:
        - link "Accueil" [ref=e550] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e557] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e561] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e568] [cursor=pointer]:
          - /url: /admin/finance
  - alert [ref=e572]
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