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
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 40 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "40"
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Aïda Diallo)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: AD
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e36]:
            - status [ref=e38]: En direct
            - heading "Notifications" [level=1] [ref=e40]
            - paragraph [ref=e41]: "Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar."
          - region [ref=e42]:
            - heading "Compteurs" [level=2] [ref=e43]
            - generic [ref=e44]:
              - generic [ref=e45]:
                - paragraph [ref=e47]: SMS aujourd'hui
                - paragraph [ref=e51]: "194"
                - paragraph [ref=e52]: Tous les SMS du jour, indispensables, optionnels et codes de connexion.
              - generic [ref=e53]:
                - paragraph [ref=e55]: SMS optionnels aujourd'hui
                - paragraph [ref=e60]: "0"
                - paragraph [ref=e61]: "Plafond : 700 par jour, alerte à 560."
              - generic [ref=e62]:
                - paragraph [ref=e64]: SMS ce mois-ci
                - paragraph [ref=e71]: "194"
                - paragraph [ref=e72]: En novembre 2026, dont 3 codes de connexion et 1 à l’issue incertaine (peut-être facturé)
          - region [ref=e73]:
            - heading "Envois" [level=2] [ref=e74]
            - tablist "Filtrer par statut" [ref=e77]:
              - tab "Toutes" [selected] [ref=e78] [cursor=pointer]
              - tab "En attente , 125" [ref=e80] [cursor=pointer]:
                - generic [ref=e81]: En attente
                - generic [ref=e82]:
                  - generic [ref=e83]: ","
                  - text: "125"
              - tab "En cours d'envoi , 0" [ref=e84] [cursor=pointer]:
                - generic [ref=e85]: En cours d'envoi
                - generic [ref=e86]:
                  - generic [ref=e87]: ","
                  - text: "0"
              - tab "Envoyée , 656" [ref=e88] [cursor=pointer]:
                - generic [ref=e89]: Envoyée
                - generic [ref=e90]:
                  - generic [ref=e91]: ","
                  - text: "656"
              - tab "En échec , 1" [ref=e92] [cursor=pointer]:
                - generic [ref=e93]: En échec
                - generic [ref=e94]:
                  - generic [ref=e95]: ","
                  - text: "1"
              - tab "Non envoyée , 533" [ref=e96] [cursor=pointer]:
                - generic [ref=e97]: Non envoyée
                - generic [ref=e98]:
                  - generic [ref=e99]: ","
                  - text: "533"
              - tab "Annulée , 9" [ref=e100] [cursor=pointer]:
                - generic [ref=e101]: Annulée
                - generic [ref=e102]:
                  - generic [ref=e103]: ","
                  - text: "9"
              - tab "Incertaine , 1" [ref=e104] [cursor=pointer]:
                - generic [ref=e105]: Incertaine
                - generic [ref=e106]:
                  - generic [ref=e107]: ","
                  - text: "1"
            - search [ref=e108]:
              - generic [ref=e109]:
                - generic [ref=e110]: Rechercher
                - searchbox "Rechercher" [ref=e112]
              - generic [ref=e113]:
                - generic [ref=e114]: Canal
                - combobox "Canal" [ref=e117] [cursor=pointer]:
                  - option "Tous les canaux" [selected]
                  - option "Application"
                  - option "SMS"
                  - option "Email"
                  - option "Notification push"
              - generic [ref=e118]:
                - generic [ref=e119]: Type
                - combobox "Type" [ref=e122] [cursor=pointer]:
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
              - generic [ref=e123]:
                - generic [ref=e124]:
                  - generic [ref=e125]: Du
                  - textbox "Du" [ref=e127]
                - generic [ref=e128]:
                  - generic [ref=e129]: Au
                  - textbox "Au" [ref=e131]
            - tabpanel "Toutes" [ref=e132]:
              - generic [ref=e133]:
                - list "Notifications de la boîte d’envoi" [ref=e135]:
                  - listitem [ref=e136]:
                    - generic [ref=e137]:
                      - generic [ref=e138]:
                        - paragraph [ref=e139]: Code administrateur
                        - generic [ref=e140]: Envoyée
                      - paragraph [ref=e143]: SMS · +221 70 *** ** 07
                      - generic [ref=e144]:
                        - time [ref=e145]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e146] [cursor=pointer]:
                          - /url: /admin/notifications/2648ec31-165e-4f41-96da-28b61ea1f272
                  - listitem [ref=e151]:
                    - generic [ref=e152]:
                      - generic [ref=e153]:
                        - paragraph [ref=e154]: Code administrateur
                        - generic [ref=e155]: Envoyée
                      - paragraph [ref=e158]: SMS · +221 70 *** ** 04
                      - generic [ref=e159]:
                        - time [ref=e160]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e161] [cursor=pointer]:
                          - /url: /admin/notifications/43e8f156-bb0d-4988-8c08-cf4102bc910a
                  - listitem [ref=e166]:
                    - generic [ref=e167]:
                      - generic [ref=e168]:
                        - paragraph [ref=e169]: Confirmation d’achat
                        - generic [ref=e170]: Envoyée
                      - paragraph [ref=e173]: Nuit du slam de Kaolack
                      - paragraph [ref=e174]: Application · Alioune F.
                      - generic [ref=e175]:
                        - time [ref=e176]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e177] [cursor=pointer]:
                          - /url: /admin/notifications/69ed230e-8428-4119-815f-622bfb4f6e02
                  - listitem [ref=e182]:
                    - generic [ref=e183]:
                      - generic [ref=e184]:
                        - paragraph [ref=e185]: Confirmation d’achat
                        - generic [ref=e186]: Envoyée
                      - paragraph [ref=e189]: Nuit du slam de Kaolack
                      - paragraph [ref=e190]: SMS · +221 70 *** ** 08
                      - generic [ref=e191]:
                        - time [ref=e192]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e193] [cursor=pointer]:
                          - /url: /admin/notifications/62fd9d33-6ad9-4416-8bb5-e0d10c865a0f
                  - listitem [ref=e198]:
                    - generic [ref=e199]:
                      - generic [ref=e200]:
                        - paragraph [ref=e201]: Confirmation d’achat
                        - generic [ref=e202]: Non envoyée
                      - paragraph [ref=e205]: Nuit du slam de Kaolack
                      - paragraph [ref=e206]: Email · Alioune F.
                      - paragraph [ref=e207]: Adresse email non vérifiée
                      - generic [ref=e208]:
                        - time [ref=e209]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e210] [cursor=pointer]:
                          - /url: /admin/notifications/4909bf76-3796-4a6d-9a3c-ce57b2cffc93
                  - listitem [ref=e215]:
                    - generic [ref=e216]:
                      - generic [ref=e217]:
                        - paragraph [ref=e218]: Nouvelle commande
                        - generic [ref=e219]: Envoyée
                      - paragraph [ref=e222]: Nuit du slam de Kaolack
                      - paragraph [ref=e223]: Application · Ousmane F.
                      - generic [ref=e224]:
                        - time [ref=e225]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e226] [cursor=pointer]:
                          - /url: /admin/notifications/313f84fc-c749-4389-82a9-1b3d6fc44662
                  - listitem [ref=e231]:
                    - generic [ref=e232]:
                      - generic [ref=e233]:
                        - paragraph [ref=e234]: Confirmation d’achat
                        - generic [ref=e235]: Envoyée
                      - paragraph [ref=e238]: Nuit du slam de Kaolack
                      - paragraph [ref=e239]: SMS · +221 70 *** ** 07
                      - generic [ref=e240]:
                        - time [ref=e241]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e242] [cursor=pointer]:
                          - /url: /admin/notifications/ca2f15fa-18ad-4e10-a517-bf4c85b90dd1
                  - listitem [ref=e247]:
                    - generic [ref=e248]:
                      - generic [ref=e249]:
                        - paragraph [ref=e250]: Confirmation d’achat
                        - generic [ref=e251]: Envoyée
                      - paragraph [ref=e254]: Nuit du slam de Kaolack
                      - paragraph [ref=e255]: Application · Mame N.
                      - generic [ref=e256]:
                        - time [ref=e257]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e258] [cursor=pointer]:
                          - /url: /admin/notifications/c2317a30-c5ca-4a20-8636-e7e551e41184
                  - listitem [ref=e263]:
                    - generic [ref=e264]:
                      - generic [ref=e265]:
                        - paragraph [ref=e266]: Nouvelle commande
                        - generic [ref=e267]: Envoyée
                      - paragraph [ref=e270]: Nuit du slam de Kaolack
                      - paragraph [ref=e271]: Application · Ousmane F.
                      - generic [ref=e272]:
                        - time [ref=e273]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e274] [cursor=pointer]:
                          - /url: /admin/notifications/9376a449-c605-4df6-a2d4-0be10ea252da
                  - listitem [ref=e279]:
                    - generic [ref=e280]:
                      - generic [ref=e281]:
                        - paragraph [ref=e282]: Confirmation d’achat
                        - generic [ref=e283]: Non envoyée
                      - paragraph [ref=e286]: Nuit du slam de Kaolack
                      - paragraph [ref=e287]: Email · Mame N.
                      - paragraph [ref=e288]: Adresse email non vérifiée
                      - generic [ref=e289]:
                        - time [ref=e290]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e291] [cursor=pointer]:
                          - /url: /admin/notifications/1a24f37c-8ee6-4c38-bdd9-4d0c5ed009f5
                  - listitem [ref=e296]:
                    - generic [ref=e297]:
                      - generic [ref=e298]:
                        - paragraph [ref=e299]: Confirmation d’achat
                        - generic [ref=e300]: Envoyée
                      - paragraph [ref=e303]: Nuit du slam de Kaolack
                      - paragraph [ref=e304]: Application · Babacar D.
                      - generic [ref=e305]:
                        - time [ref=e306]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e307] [cursor=pointer]:
                          - /url: /admin/notifications/b031025d-a158-499d-9556-6118ab68436d
                  - listitem [ref=e312]:
                    - generic [ref=e313]:
                      - generic [ref=e314]:
                        - paragraph [ref=e315]: Confirmation d’achat
                        - generic [ref=e316]: Non envoyée
                      - paragraph [ref=e319]: Nuit du slam de Kaolack
                      - paragraph [ref=e320]: Email · Babacar D.
                      - paragraph [ref=e321]: Adresse email non vérifiée
                      - generic [ref=e322]:
                        - time [ref=e323]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e324] [cursor=pointer]:
                          - /url: /admin/notifications/aab2363b-30f5-4c19-ad7f-27c6adc7238f
                  - listitem [ref=e329]:
                    - generic [ref=e330]:
                      - generic [ref=e331]:
                        - paragraph [ref=e332]: Nouvelle commande
                        - generic [ref=e333]: Envoyée
                      - paragraph [ref=e336]: Nuit du slam de Kaolack
                      - paragraph [ref=e337]: Application · Ousmane F.
                      - generic [ref=e338]:
                        - time [ref=e339]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e340] [cursor=pointer]:
                          - /url: /admin/notifications/99567f9e-98a0-454b-858e-c9ca13fb8520
                  - listitem [ref=e345]:
                    - generic [ref=e346]:
                      - generic [ref=e347]:
                        - paragraph [ref=e348]: Confirmation d’achat
                        - generic [ref=e349]: Envoyée
                      - paragraph [ref=e352]: Nuit du slam de Kaolack
                      - paragraph [ref=e353]: SMS · +221 70 *** ** 06
                      - generic [ref=e354]:
                        - time [ref=e355]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e356] [cursor=pointer]:
                          - /url: /admin/notifications/149d093f-2773-47d4-9b28-a0c5727881f0
                  - listitem [ref=e361]:
                    - generic [ref=e362]:
                      - generic [ref=e363]:
                        - paragraph [ref=e364]: Confirmation d’achat
                        - generic [ref=e365]: Non envoyée
                      - paragraph [ref=e368]: Nuit du slam de Kaolack
                      - paragraph [ref=e369]: Email · Ndeye T.
                      - paragraph [ref=e370]: Adresse email non vérifiée
                      - generic [ref=e371]:
                        - time [ref=e372]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e373] [cursor=pointer]:
                          - /url: /admin/notifications/cf9b5ad7-eee0-4375-acc2-3348d4d61469
                  - listitem [ref=e378]:
                    - generic [ref=e379]:
                      - generic [ref=e380]:
                        - paragraph [ref=e381]: Nouvelle commande
                        - generic [ref=e382]: Envoyée
                      - paragraph [ref=e385]: Nuit du slam de Kaolack
                      - paragraph [ref=e386]: Application · Ousmane F.
                      - generic [ref=e387]:
                        - time [ref=e388]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e389] [cursor=pointer]:
                          - /url: /admin/notifications/7f7d8534-5942-498b-adf6-28fbdf8b6656
                  - listitem [ref=e394]:
                    - generic [ref=e395]:
                      - generic [ref=e396]:
                        - paragraph [ref=e397]: Confirmation d’achat
                        - generic [ref=e398]: Envoyée
                      - paragraph [ref=e401]: Nuit du slam de Kaolack
                      - paragraph [ref=e402]: Application · Ndeye T.
                      - generic [ref=e403]:
                        - time [ref=e404]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e405] [cursor=pointer]:
                          - /url: /admin/notifications/2518c89a-6ae8-413f-9b4d-3da91a7ca2d4
                  - listitem [ref=e410]:
                    - generic [ref=e411]:
                      - generic [ref=e412]:
                        - paragraph [ref=e413]: Confirmation d’achat
                        - generic [ref=e414]: Envoyée
                      - paragraph [ref=e417]: Nuit du slam de Kaolack
                      - paragraph [ref=e418]: SMS · +221 70 *** ** 05
                      - generic [ref=e419]:
                        - time [ref=e420]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e421] [cursor=pointer]:
                          - /url: /admin/notifications/0524f1a0-deba-4fb7-aa39-1a658f090222
                  - listitem [ref=e426]:
                    - generic [ref=e427]:
                      - generic [ref=e428]:
                        - paragraph [ref=e429]: Confirmation d’achat
                        - generic [ref=e430]: Envoyée
                      - paragraph [ref=e433]: Nuit du slam de Kaolack
                      - paragraph [ref=e434]: Application · Cheikh S.
                      - generic [ref=e435]:
                        - time [ref=e436]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e437] [cursor=pointer]:
                          - /url: /admin/notifications/e8fc8026-adf1-4223-963b-d62f4df7287b
                  - listitem [ref=e442]:
                    - generic [ref=e443]:
                      - generic [ref=e444]:
                        - paragraph [ref=e445]: Nouvelle commande
                        - generic [ref=e446]: Envoyée
                      - paragraph [ref=e449]: Nuit du slam de Kaolack
                      - paragraph [ref=e450]: Application · Ousmane F.
                      - generic [ref=e451]:
                        - time [ref=e452]: sam. 14 nov. 2026 à 00:39
                        - link "Voir le détail" [ref=e453] [cursor=pointer]:
                          - /url: /admin/notifications/e2f40c6a-7e73-4e7b-86ec-8907b8a0f013
                - navigation "Pages des notifications" [ref=e458]:
                  - button "Précédent" [disabled] [ref=e459]
                  - paragraph [ref=e464]: Page 1 sur 67
                  - button "Suivant" [ref=e465] [cursor=pointer]
          - region [ref=e470]:
            - generic [ref=e471]:
              - heading "Par jour et par canal" [level=2] [ref=e472]
              - paragraph [ref=e473]: 14 derniers jours, heure de Dakar.
            - list "Notifications par jour et par canal" [ref=e475]:
              - listitem [ref=e476]:
                - generic [ref=e477]: 14 nov. 2026 · Email
                - generic [ref=e478]:
                  - term [ref=e479]: Jour
                  - definition [ref=e480]: 14 nov. 2026
                  - term [ref=e481]: Canal
                  - definition [ref=e482]: Email
                  - term [ref=e483]: Envoyées
                  - definition [ref=e484]: "0"
                  - term [ref=e485]: En échec
                  - definition [ref=e486]: "0"
                  - term [ref=e487]: Non envoyées
                  - definition [ref=e488]: "377"
                  - term [ref=e489]: Incertaines
                  - definition [ref=e490]: "0"
                  - term [ref=e491]: Annulées
                  - definition [ref=e492]: "0"
              - listitem [ref=e493]:
                - generic [ref=e494]: 14 nov. 2026 · Application
                - generic [ref=e495]:
                  - term [ref=e496]: Jour
                  - definition [ref=e497]: 14 nov. 2026
                  - term [ref=e498]: Canal
                  - definition [ref=e499]: Application
                  - term [ref=e500]: Envoyées
                  - definition [ref=e501]: "463"
                  - term [ref=e502]: En échec
                  - definition [ref=e503]: "0"
                  - term [ref=e504]: Non envoyées
                  - definition [ref=e505]: "0"
                  - term [ref=e506]: Incertaines
                  - definition [ref=e507]: "0"
                  - term [ref=e508]: Annulées
                  - definition [ref=e509]: "3"
              - listitem [ref=e510]:
                - generic [ref=e511]: 14 nov. 2026 · Notification push
                - generic [ref=e512]:
                  - term [ref=e513]: Jour
                  - definition [ref=e514]: 14 nov. 2026
                  - term [ref=e515]: Canal
                  - definition [ref=e516]: Notification push
                  - term [ref=e517]: Envoyées
                  - definition [ref=e518]: "0"
                  - term [ref=e519]: En échec
                  - definition [ref=e520]: "0"
                  - term [ref=e521]: Non envoyées
                  - definition [ref=e522]: "123"
                  - term [ref=e523]: Incertaines
                  - definition [ref=e524]: "0"
                  - term [ref=e525]: Annulées
                  - definition [ref=e526]: "3"
              - listitem [ref=e527]:
                - generic [ref=e528]: 14 nov. 2026 · SMS
                - generic [ref=e529]:
                  - term [ref=e530]: Jour
                  - definition [ref=e531]: 14 nov. 2026
                  - term [ref=e532]: Canal
                  - definition [ref=e533]: SMS
                  - term [ref=e534]: Envoyées
                  - definition [ref=e535]: "193"
                  - term [ref=e536]: En échec
                  - definition [ref=e537]: "1"
                  - term [ref=e538]: Non envoyées
                  - definition [ref=e539]: "17"
                  - term [ref=e540]: Incertaines
                  - definition [ref=e541]: "1"
                  - term [ref=e542]: Annulées
                  - definition [ref=e543]: "3"
    - navigation "Navigation rapide" [ref=e544]:
      - generic [ref=e545]:
        - link "Accueil" [ref=e546] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e553] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e557] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e564] [cursor=pointer]:
          - /url: /admin/finance
  - alert [ref=e568]
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