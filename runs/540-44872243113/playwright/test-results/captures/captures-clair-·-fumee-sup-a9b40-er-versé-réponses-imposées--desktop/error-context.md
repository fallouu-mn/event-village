# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-remboursements-a-reprendre — Administration — finances : versements à reprendre (Renvoyer, Marquer versé ; réponses imposées)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de admin-remboursements-a-reprendre__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core target-size (serious, 1 nœud(s)) : All touch targets must be 24px large, or leave sufficient space",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - link "Event Village, accueil" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=e16]:
        - generic [ref=e17]: Administration
        - link "Tableau de bord" [ref=e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e29]:
          - paragraph [ref=e30]: Gestion
          - generic [ref=e31]:
            - link "Événements" [ref=e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=e55]:
          - paragraph [ref=e56]: Finances
          - link "Finance" [ref=e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=e62]:
          - paragraph [ref=e63]: Engagement
          - generic [ref=e64]:
            - link "Parrainage" [ref=e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=e79]:
          - paragraph [ref=e80]: Système
          - generic [ref=e81]:
            - link "Réglages" [ref=e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=e113] [cursor=pointer]:
          - /url: /
      - generic [ref=e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e121]: ES
          - generic [ref=e122]:
            - generic [ref=e123]: Elhadji SuperAdmin
            - generic [ref=e124]: Super-administrateur
        - generic [ref=e125]:
          - button "Se déconnecter" [ref=e126] [cursor=pointer]
          - button "Basculer le thème" [ref=e131] [cursor=pointer]
    - generic [ref=e135]:
      - banner [ref=e136]:
        - link "Rechercher un événement…" [ref=e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=e143]:
          - button "Notifications, 61 non lues" [ref=e145] [cursor=pointer]:
            - generic [ref=e149]: "61"
          - button "Elhadji SuperAdmin" [ref=e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=e152]: ES
      - main [ref=e156]:
        - generic [ref=e158]:
          - generic [ref=e160]:
            - generic [ref=e161]:
              - heading "Finance" [level=1] [ref=e162]
              - paragraph [ref=e163]: Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay.
            - link "Réglages de la plateforme" [ref=e165] [cursor=pointer]:
              - /url: /admin/finance-settings
          - group [ref=e171]:
            - heading "Période" [level=2] [ref=e175]
            - generic [ref=e177]:
              - generic [ref=e178]: Afficher
              - combobox "Afficher" [ref=e181] [cursor=pointer]:
                - option "Aujourd’hui"
                - option "7 derniers jours"
                - option "30 derniers jours"
                - option "Ce mois-ci" [selected]
                - option "Mois dernier"
                - option "Dates choisies…"
            - paragraph [ref=e182]: "Période affichée : du 1er au 21 novembre 2026. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant."
          - generic [ref=e183]:
            - region [ref=e184]:
              - heading "Gagné par Event Village" [level=2] [ref=e186]
              - paragraph [ref=e191]: 57 540,72 F CFA
              - paragraph [ref=e192]: "Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
              - paragraph [ref=e193]: Paiements encaissés, retraits versés et versements confirmés du 1er au 21 novembre 2026.
              - link "Voir le détail" [ref=e194] [cursor=pointer]:
                - /url: "#detail-gagne"
            - region [ref=e195]:
              - heading "Dû aux partenaires" [level=2] [ref=e197]
              - paragraph [ref=e202]: 1 749 000 F CFA
              - paragraph [ref=e203]: "L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
              - paragraph [ref=e204]: "Dont 0 F CFA retirables aujourd’hui. Dû aux parrains : 0 F CFA. À l’instant."
              - link "Voir le détail" [ref=e205] [cursor=pointer]:
                - /url: "#du-aux-partenaires"
            - region [ref=e206]:
              - heading "Retirable par Event Village" [level=2] [ref=e208]
              - paragraph [ref=e212]: 47 163 125 F CFA
              - paragraph [ref=e213]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
              - paragraph [ref=e214]:
                - text: Solde SamirPay lu à
                - time [ref=e215]: 06:07
                - text: ", moins tout ce qui est dû et la réserve de prudence."
              - link "Voir le calcul" [ref=e216] [cursor=pointer]:
                - /url: "#calcul-retirable"
            - region [ref=e217]:
              - heading "Créances" [level=2] [ref=e219]
              - paragraph [ref=e225]: 0 F CFA
              - paragraph [ref=e226]: Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre.
              - paragraph [ref=e227]: Aucune créance à l’instant.
              - link "Voir les créances" [ref=e228] [cursor=pointer]:
                - /url: "#creances"
          - region [ref=e230]:
            - generic [ref=e231]:
              - heading "Versements à reprendre" [level=2] [ref=e232]
              - paragraph [ref=e233]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - region "Versements à reprendre" [ref=e235]:
              - table [ref=e236]:
                - caption [ref=e237]: Versements à reprendre
                - rowgroup [ref=e238]:
                  - row [ref=e239]:
                    - columnheader "Montant" [ref=e240]
                    - columnheader "Versement" [ref=e241]
                    - columnheader "Bénéficiaire" [ref=e242]
                    - columnheader "État" [ref=e243]
                    - columnheader "Depuis le" [ref=e244]
                    - columnheader "Reprise" [ref=e245]
                - rowgroup [ref=e246]:
                  - row [ref=e247]:
                    - cell "5 250 F CFA" [ref=e248]
                    - cell [ref=e249]:
                      - generic [ref=e250]:
                        - paragraph [ref=e251]: Remboursement d’un billet
                        - paragraph [ref=e252]: Croisière musicale vers Gorée
                    - cell "77 ••• •• 34" [ref=e253]
                    - cell "Envoi en échec Refusé par l’opérateur Mobile Money" [ref=e254]:
                      - generic [ref=e255]:
                        - generic [ref=e256]: Envoi en échec
                        - generic [ref=e258]: Refusé par l’opérateur Mobile Money
                    - cell [ref=e259]:
                      - time [ref=e260]: mer. 4 nov. 2026 à 18:30
                    - cell [ref=e261]:
                      - generic [ref=e263]:
                        - button "Renvoyer le versement de 5 250 F CFA" [ref=e264] [cursor=pointer]:
                          - generic [ref=e269]: Renvoyer
                        - button "Marquer versé le versement de 5 250 F CFA" [ref=e270] [cursor=pointer]:
                          - generic [ref=e275]: Marquer versé
                  - row [ref=e276]:
                    - cell "48 500 F CFA" [ref=e277]
                    - cell [ref=e278]:
                      - paragraph [ref=e280]: Retrait
                    - cell "76 ••• •• 18" [ref=e281]
                    - cell "Bloqué Solde SamirPay insuffisant" [ref=e282]:
                      - generic [ref=e283]:
                        - generic [ref=e284]: Bloqué
                        - generic [ref=e286]: Solde SamirPay insuffisant
                    - cell [ref=e287]:
                      - time [ref=e288]: mer. 4 nov. 2026 à 19:05
                    - cell [ref=e289]:
                      - generic [ref=e291]:
                        - button "Renvoyer le versement de 48 500 F CFA" [ref=e292] [cursor=pointer]:
                          - generic [ref=e297]: Renvoyer
                        - button "Marquer versé le versement de 48 500 F CFA" [ref=e298] [cursor=pointer]:
                          - generic [ref=e303]: Marquer versé
                  - row [ref=e304]:
                    - cell "3 150 F CFA" [ref=e305]
                    - cell [ref=e306]:
                      - generic [ref=e307]:
                        - paragraph [ref=e308]: Annulation d’événement
                        - paragraph [ref=e309]: Festival Jazz sur le Fleuve
                    - cell "78 ••• •• 52" [ref=e310]
                    - cell "Issue incertaine" [ref=e311]
                    - cell [ref=e315]:
                      - time [ref=e316]: mer. 4 nov. 2026 à 20:40
                    - cell [ref=e317]:
                      - generic [ref=e318]:
                        - paragraph [ref=e319]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                        - generic [ref=e320]:
                          - button "Marquer versé le versement de 3 150 F CFA" [ref=e321] [cursor=pointer]:
                            - generic [ref=e326]: Marquer versé
                          - button "Constater non versé le versement de 3 150 F CFA" [ref=e327] [cursor=pointer]:
                            - generic [ref=e332]: Constater non versé
                  - row [ref=e333]:
                    - cell "10 500 F CFA" [ref=e334]
                    - cell [ref=e335]:
                      - generic [ref=e336]:
                        - paragraph [ref=e337]: Remboursement d’un paiement
                        - paragraph [ref=e338]: Nuit du Sabar — édition d’automne
                    - cell "70 ••• •• 61" [ref=e339]
                    - cell "Envoyé, non confirmé" [ref=e340]
                    - cell [ref=e344]:
                      - time [ref=e345]: mer. 4 nov. 2026 à 21:10
                    - cell [ref=e346]:
                      - generic [ref=e348]:
                        - button "Renvoyer le versement de 10 500 F CFA" [ref=e349] [cursor=pointer]:
                          - generic [ref=e354]: Renvoyer
                        - button "Marquer versé le versement de 10 500 F CFA" [ref=e355] [cursor=pointer]:
                          - generic [ref=e360]: Marquer versé
                  - row [ref=e361]:
                    - cell "7 350 F CFA" [ref=e362]
                    - cell [ref=e363]:
                      - generic [ref=e364]:
                        - paragraph [ref=e365]: Remboursement d’un billet
                        - paragraph [ref=e366]: Croisière musicale vers Gorée
                    - cell "77 ••• •• 09" [ref=e367]
                    - cell "Bloqué Opérateur Mobile Money inconnu" [ref=e368]:
                      - generic [ref=e369]:
                        - generic [ref=e370]: Bloqué
                        - generic [ref=e372]: Opérateur Mobile Money inconnu
                    - cell [ref=e373]:
                      - time [ref=e374]: mer. 4 nov. 2026 à 21:45
                    - cell [ref=e375]:
                      - button "Marquer versé le versement de 7 350 F CFA" [ref=e378] [cursor=pointer]:
                        - generic [ref=e383]: Marquer versé
          - region [ref=e384]:
            - generic [ref=e385]:
              - heading "Remboursements à verser" [level=2] [ref=e386]
              - paragraph [ref=e387]: Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
              - paragraph [ref=e388]: 4 remboursements pour 91 350 F CFA.
            - region "Remboursements à verser" [ref=e390]:
              - table [ref=e391]:
                - caption [ref=e392]: Remboursements à verser
                - rowgroup [ref=e393]:
                  - row [ref=e394]:
                    - columnheader "Demandé le" [ref=e395]
                    - columnheader "Remboursement" [ref=e396]
                    - columnheader "Client" [ref=e397]
                    - columnheader "Montant" [ref=e398]
                    - columnheader "Où il en est" [ref=e399]
                - rowgroup [ref=e400]:
                  - row [ref=e401]:
                    - cell [ref=e402]:
                      - time [ref=e403]: sam. 21 nov. 2026 à 05:46
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e404]:
                      - generic [ref=e405]:
                        - generic [ref=e406]: Remboursement d’une annulation
                        - generic [ref=e407]: Croisière musicale vers Gorée
                    - cell "Fatoumata C. · 70*****13" [ref=e408]
                    - cell "18 900 F CFA" [ref=e409]
                    - cell "Envoyé, en attente de confirmation" [ref=e410]
                  - row [ref=e413]:
                    - cell [ref=e414]:
                      - time [ref=e415]: sam. 21 nov. 2026 à 05:46
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e416]:
                      - generic [ref=e417]:
                        - generic [ref=e418]: Remboursement d’une annulation
                        - generic [ref=e419]: Croisière musicale vers Gorée
                    - cell "Astou S. · 70*****15" [ref=e420]
                    - cell "9 450 F CFA" [ref=e421]
                    - cell "Envoyé, en attente de confirmation" [ref=e422]
                  - row [ref=e425]:
                    - cell [ref=e426]:
                      - time [ref=e427]: sam. 21 nov. 2026 à 05:46
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e428]:
                      - generic [ref=e429]:
                        - generic [ref=e430]: Remboursement d’une annulation
                        - generic [ref=e431]: Croisière musicale vers Gorée
                    - cell "Awa D. · 70*****01" [ref=e432]
                    - cell "31 500 F CFA" [ref=e433]
                    - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=e434]':
                      - generic [ref=e435]:
                        - generic [ref=e436]: "Issue incertaine : à vérifier"
                        - link "Traiter dans « Versements à reprendre »" [ref=e437] [cursor=pointer]:
                          - /url: "#versements-a-reprendre"
                  - row [ref=e438]:
                    - cell [ref=e439]:
                      - time [ref=e440]: sam. 21 nov. 2026 à 05:46
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e441]:
                      - generic [ref=e442]:
                        - generic [ref=e443]: Remboursement d’une annulation
                        - generic [ref=e444]: Croisière musicale vers Gorée
                    - cell "Ibou M. · 70*****16" [ref=e445]
                    - cell "31 500 F CFA" [ref=e446]
                    - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=e447]':
                      - generic [ref=e448]:
                        - generic [ref=e449]: "Issue incertaine : à vérifier"
                        - link "Traiter dans « Versements à reprendre »" [ref=e450] [cursor=pointer]:
                          - /url: "#versements-a-reprendre"
          - region [ref=e451]:
            - generic [ref=e452]:
              - heading "Créances" [level=2] [ref=e453]
              - paragraph [ref=e454]: Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ; ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
            - generic [ref=e455]:
              - heading "Aucune créance" [level=3] [ref=e460]
              - paragraph [ref=e461]: Personne ne doit d’argent à Event Village.
          - region [ref=e462]:
            - generic [ref=e463]:
              - heading "Détail de ce qui a été gagné" [level=2] [ref=e464]
              - paragraph [ref=e465]: "Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés du 1er au 21 novembre 2026."
            - generic [ref=e466]:
              - generic [ref=e467]:
                - term [ref=e468]:
                  - generic [ref=e469]: Frais de service, moins les frais d’encaissement SamirPay
                  - generic [ref=e470]: "133 paiements encaissés du 1er au 21 novembre 2026 : 94 950 F CFA de frais de service, 29 909,28 F CFA de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas)."
                - definition [ref=e471]: + 65 040,72 F CFA
              - generic [ref=e472]:
                - term [ref=e473]:
                  - generic [ref=e474]: Part rendue avec les remboursements
                  - generic [ref=e475]: Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.
                - definition [ref=e476]: − 7 500 F CFA
              - generic [ref=e477]:
                - term [ref=e478]:
                  - generic [ref=e479]: Frais de retrait
                  - generic [ref=e480]: 0 retrait versé du 1er au 21 novembre 2026.
                - definition [ref=e481]: + 0 F CFA
              - generic [ref=e482]:
                - term [ref=e483]:
                  - generic [ref=e484]: Frais SamirPay des versements
                  - generic [ref=e485]: Frais réels de 0 versement confirmé du 1er au 21 novembre 2026 (remboursements et retraits).
                - definition [ref=e486]: − 0 F CFA
              - generic [ref=e487]:
                - term [ref=e488]:
                  - generic [ref=e489]: Commissions de parrainage
                  - generic [ref=e490]: Sur les paiements encaissés de la période, annulations et reprises déduites.
                - definition [ref=e491]: − 0 F CFA
              - generic [ref=e492]:
                - term [ref=e493]:
                  - generic [ref=e494]: Gagné par Event Village
                - definition [ref=e495]: 57 540,72 F CFA
          - region [ref=e496]:
            - generic [ref=e497]:
              - heading "Dû aux partenaires" [level=2] [ref=e498]
              - paragraph [ref=e499]: L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
            - generic [ref=e500]:
              - generic [ref=e501]:
                - term [ref=e502]:
                  - generic [ref=e503]: Disponible pour les partenaires
                  - generic [ref=e504]: Dont 0 F CFA retirables tout de suite et 0 F CFA gelés (événements suspendus, libérés à la reprise).
                - definition [ref=e505]: 0 F CFA
              - generic [ref=e506]:
                - term [ref=e507]:
                  - generic [ref=e508]: En attente de la fin des événements
                - definition [ref=e509]: 1 749 000 F CFA
              - generic [ref=e510]:
                - term [ref=e511]:
                  - generic [ref=e512]: Retraits en cours d’envoi
                  - generic [ref=e513]: Demandés par les partenaires, pas encore confirmés par SamirPay.
                - definition [ref=e514]: 0 F CFA
              - generic [ref=e515]:
                - term [ref=e516]:
                  - generic [ref=e517]: Dû aux partenaires
                - definition [ref=e518]: 1 749 000 F CFA
            - region "Dû aux partenaires, compte par compte" [ref=e520]:
              - table [ref=e521]:
                - caption [ref=e522]: Dû aux partenaires, compte par compte
                - rowgroup [ref=e523]:
                  - row [ref=e524]:
                    - columnheader "Partenaire" [ref=e525]
                    - columnheader "Dû" [ref=e526]
                    - columnheader "Retirable aujourd’hui" [ref=e527]
                    - columnheader "En attente" [ref=e528]
                    - columnheader "Gelé" [ref=e529]
                    - columnheader "Retrait en cours" [ref=e530]
                - rowgroup [ref=e531]:
                  - row [ref=e532]:
                    - cell "Baobab Scène Productions" [ref=e533]
                    - cell "828 000 F CFA" [ref=e534]
                    - cell "0 F CFA" [ref=e535]
                    - cell "828 000 F CFA" [ref=e536]
                    - cell "0 F CFA" [ref=e537]
                    - cell "0 F CFA" [ref=e538]
                  - row [ref=e539]:
                    - cell "Sine-Saloum Culture & Loisirs" [ref=e540]
                    - cell "806 000 F CFA" [ref=e541]
                    - cell "0 F CFA" [ref=e542]
                    - cell "806 000 F CFA" [ref=e543]
                    - cell "0 F CFA" [ref=e544]
                    - cell "0 F CFA" [ref=e545]
                  - row [ref=e546]:
                    - cell "Atelier Petite-Côte" [ref=e547]
                    - cell "115 000 F CFA" [ref=e548]
                    - cell "0 F CFA" [ref=e549]
                    - cell "115 000 F CFA" [ref=e550]
                    - cell "0 F CFA" [ref=e551]
                    - cell "0 F CFA" [ref=e552]
            - generic [ref=e553]:
              - heading "Dû aux parrains" [level=3] [ref=e554]
              - paragraph [ref=e555]: "Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village. Total : 0 F CFA."
              - generic [ref=e556]:
                - heading "Rien n’est dû aux parrains" [level=3] [ref=e563]
                - paragraph [ref=e564]: Aucun solde à verser pour le moment.
          - region [ref=e565]:
            - generic [ref=e566]:
              - heading "Calcul de ce qui est retirable" [level=2] [ref=e567]
              - paragraph [ref=e568]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. Si ce chiffre est à 0, ne retirez rien.
            - generic [ref=e569]:
              - generic [ref=e570]:
                - term [ref=e571]:
                  - generic [ref=e572]: Solde du compte SamirPay
                  - generic [ref=e573]:
                    - text: Lu à
                    - time [ref=e574]: 06:07
                    - text: (heure de Dakar), relu au plus toutes les 5 minutes.
                - definition [ref=e575]: 50 000 000 F CFA
              - generic [ref=e576]:
                - term [ref=e577]:
                  - generic [ref=e578]: Dû aux partenaires
                - definition [ref=e579]: − 1 749 000 F CFA
              - generic [ref=e580]:
                - term [ref=e581]:
                  - generic [ref=e582]: Dû aux parrains
                - definition [ref=e583]: − 0 F CFA
              - generic [ref=e584]:
                - term [ref=e585]:
                  - generic [ref=e586]: Remboursements à verser
                - definition [ref=e587]: − 91 350 F CFA
              - generic [ref=e588]:
                - term [ref=e589]:
                  - generic [ref=e590]: Réserve de prudence
                  - generic [ref=e591]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Automatique : les encaissements des 3 derniers jours, soit 996 525 F CFA aujourd’hui."
                - definition [ref=e592]: − 996 525 F CFA
              - generic [ref=e593]:
                - term [ref=e594]:
                  - generic [ref=e595]: Retirable par Event Village
                - definition [ref=e596]: 47 163 125 F CFA
            - link "Changer la réserve de prudence" [ref=e598] [cursor=pointer]:
              - /url: /admin/finance-settings
          - region [ref=e600]:
            - generic [ref=e601]:
              - heading "Paiements encaissés" [level=2] [ref=e602]
              - paragraph [ref=e606]: Paiements en ligne encaissés du 1er au 21 novembre 2026. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            - generic [ref=e607]:
              - generic [ref=e608]: Statut
              - combobox "Statut" [ref=e611] [cursor=pointer]:
                - option "Tous les paiements" [selected]
                - option "Payé"
                - option "Remboursé en partie"
                - option "Remboursement en cours"
                - option "Remboursé"
            - region "Paiements encaissés" [ref=e613]:
              - table [ref=e614]:
                - caption [ref=e615]: Paiements encaissés
                - rowgroup [ref=e616]:
                  - row [ref=e617]:
                    - columnheader "Encaissé le" [ref=e618]
                    - columnheader "Référence" [ref=e619]
                    - columnheader "Objet" [ref=e620]
                    - columnheader "Payé" [ref=e621]
                    - columnheader "Frais de service" [ref=e622]
                    - columnheader "Pour Event Village" [ref=e623]
                    - columnheader "Statut" [ref=e624]
                - rowgroup [ref=e625]:
                  - row [ref=e626]:
                    - cell [ref=e627]:
                      - time [ref=e628]: sam. 21 nov. 2026 à 05:47
                    - cell "Réf. interne C9036A34" [ref=e629]
                    - cell "Billets Nuit du slam de Kaolack" [ref=e630]:
                      - generic [ref=e631]:
                        - generic [ref=e632]: Billets
                        - generic [ref=e633]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=e634]
                    - cell "450 F CFA" [ref=e635]
                    - cell "308,25 F CFA" [ref=e636]
                    - cell "Payé" [ref=e637]
                  - row [ref=e641]:
                    - cell [ref=e642]:
                      - time [ref=e643]: sam. 21 nov. 2026 à 05:47
                    - cell "Réf. interne 41E8EF5A" [ref=e644]
                    - cell "Billets Nuit du slam de Kaolack" [ref=e645]:
                      - generic [ref=e646]:
                        - generic [ref=e647]: Billets
                        - generic [ref=e648]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=e649]
                    - cell "450 F CFA" [ref=e650]
                    - cell "308,25 F CFA" [ref=e651]
                    - cell "Payé" [ref=e652]
                  - row [ref=e656]:
                    - cell [ref=e657]:
                      - time [ref=e658]: sam. 21 nov. 2026 à 05:47
                    - cell "Réf. interne 29878189" [ref=e659]
                    - cell "Billets Nuit du slam de Kaolack" [ref=e660]:
                      - generic [ref=e661]:
                        - generic [ref=e662]: Billets
                        - generic [ref=e663]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=e664]
                    - cell "450 F CFA" [ref=e665]
                    - cell "308,25 F CFA" [ref=e666]
                    - cell "Payé" [ref=e667]
                  - row [ref=e671]:
                    - cell [ref=e672]:
                      - time [ref=e673]: sam. 21 nov. 2026 à 05:47
                    - cell "Réf. interne DD0FD5F4" [ref=e674]
                    - cell "Billets Nuit du slam de Kaolack" [ref=e675]:
                      - generic [ref=e676]:
                        - generic [ref=e677]: Billets
                        - generic [ref=e678]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=e679]
                    - cell "450 F CFA" [ref=e680]
                    - cell "308,25 F CFA" [ref=e681]
                    - cell "Payé" [ref=e682]
                  - row [ref=e686]:
                    - cell [ref=e687]:
                      - time [ref=e688]: sam. 21 nov. 2026 à 05:47
                    - cell "Réf. interne EF31BEA1" [ref=e689]
                    - cell "Billets Nuit du slam de Kaolack" [ref=e690]:
                      - generic [ref=e691]:
                        - generic [ref=e692]: Billets
                        - generic [ref=e693]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=e694]
                    - cell "450 F CFA" [ref=e695]
                    - cell "308,25 F CFA" [ref=e696]
                    - cell "Payé" [ref=e697]
                  - row [ref=e701]:
                    - cell [ref=e702]:
                      - time [ref=e703]: sam. 21 nov. 2026 à 05:47
                    - cell "Réf. interne 1D36FB06" [ref=e704]
                    - cell "Billets Nuit du slam de Kaolack" [ref=e705]:
                      - generic [ref=e706]:
                        - generic [ref=e707]: Billets
                        - generic [ref=e708]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=e709]
                    - cell "450 F CFA" [ref=e710]
                    - cell "308,25 F CFA" [ref=e711]
                    - cell "Payé" [ref=e712]
                  - row [ref=e716]:
                    - cell [ref=e717]:
                      - time [ref=e718]: sam. 21 nov. 2026 à 05:46
                    - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-BIS-B-1" [ref=e719]
                    - cell "Billets" [ref=e720]
                    - cell "4 000 F CFA" [ref=e723]
                    - cell "0 F CFA" [ref=e724]
                    - cell "0 F CFA" [ref=e725]
                    - cell "Payé" [ref=e726]
                  - row [ref=e730]:
                    - cell [ref=e731]:
                      - time [ref=e732]: sam. 21 nov. 2026 à 05:46
                    - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-A-1" [ref=e733]
                    - cell "Billets" [ref=e734]
                    - cell "5 000 F CFA" [ref=e737]
                    - cell "0 F CFA" [ref=e738]
                    - cell "0 F CFA" [ref=e739]
                    - cell "Payé" [ref=e740]
                  - row [ref=e744]:
                    - cell [ref=e745]:
                      - time [ref=e746]: sam. 21 nov. 2026 à 04:48
                    - cell "Réf. interne 4A6734A7" [ref=e747]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=e748]:
                      - generic [ref=e749]:
                        - generic [ref=e750]: Billets
                        - generic [ref=e751]: Nuit du Sabar — édition d’automne
                    - cell "6 300 F CFA" [ref=e752]
                    - cell "300 F CFA" [ref=e753]
                    - cell "205,5 F CFA" [ref=e754]
                    - cell "Payé" [ref=e755]
                  - row [ref=e759]:
                    - cell [ref=e760]:
                      - time [ref=e761]: sam. 21 nov. 2026 à 04:34
                    - cell "Réf. interne 1F38F8C0" [ref=e762]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=e763]:
                      - generic [ref=e764]:
                        - generic [ref=e765]: Billets
                        - generic [ref=e766]: Nuit du Sabar — édition d’automne
                    - cell "3 150 F CFA" [ref=e767]
                    - cell "150 F CFA" [ref=e768]
                    - cell "102,75 F CFA" [ref=e769]
                    - cell "Payé" [ref=e770]
                  - row [ref=e774]:
                    - cell [ref=e775]:
                      - time [ref=e776]: sam. 21 nov. 2026 à 04:20
                    - cell "Réf. interne 03FEECAD" [ref=e777]
                    - cell "Billets Rencontres du conte et de la parole" [ref=e778]:
                      - generic [ref=e779]:
                        - generic [ref=e780]: Billets
                        - generic [ref=e781]: Rencontres du conte et de la parole
                    - cell "3 150 F CFA" [ref=e782]
                    - cell "150 F CFA" [ref=e783]
                    - cell "102,75 F CFA" [ref=e784]
                    - cell "Payé" [ref=e785]
                  - row [ref=e789]:
                    - cell [ref=e790]:
                      - time [ref=e791]: sam. 21 nov. 2026 à 03:46
                    - cell "Réf. interne F1ACE4FB" [ref=e792]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=e793]:
                      - generic [ref=e794]:
                        - generic [ref=e795]: Billets
                        - generic [ref=e796]: Marché gourmand de la Petite-Côte
                    - cell "5 250 F CFA" [ref=e797]
                    - cell "250 F CFA" [ref=e798]
                    - cell "171,25 F CFA" [ref=e799]
                    - cell "Payé" [ref=e800]
                  - row [ref=e804]:
                    - cell [ref=e805]:
                      - time [ref=e806]: sam. 21 nov. 2026 à 03:36
                    - cell "Réf. interne CD070E55" [ref=e807]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=e808]:
                      - generic [ref=e809]:
                        - generic [ref=e810]: Billets
                        - generic [ref=e811]: Marché gourmand de la Petite-Côte
                    - cell "4 200 F CFA" [ref=e812]
                    - cell "200 F CFA" [ref=e813]
                    - cell "137 F CFA" [ref=e814]
                    - cell "Payé" [ref=e815]
                  - row [ref=e819]:
                    - cell [ref=e820]:
                      - time [ref=e821]: sam. 21 nov. 2026 à 02:48
                    - cell "Réf. interne 9192FF89" [ref=e822]
                    - cell "Billets Festival Jazz sur le Fleuve" [ref=e823]:
                      - generic [ref=e824]:
                        - generic [ref=e825]: Billets
                        - generic [ref=e826]: Festival Jazz sur le Fleuve
                    - cell "15 750 F CFA" [ref=e827]
                    - cell "750 F CFA" [ref=e828]
                    - cell "513,75 F CFA" [ref=e829]
                    - cell "Payé" [ref=e830]
                  - row [ref=e834]:
                    - cell [ref=e835]:
                      - time [ref=e836]: sam. 21 nov. 2026 à 02:31
                    - cell "Réf. interne 64639B9C" [ref=e837]
                    - cell "Billets Croisière musicale vers Gorée" [ref=e838]:
                      - generic [ref=e839]:
                        - generic [ref=e840]: Billets
                        - generic [ref=e841]: Croisière musicale vers Gorée
                    - cell "31 500 F CFA" [ref=e842]
                    - cell "1 500 F CFA" [ref=e843]
                    - cell "-472,5 F CFA" [ref=e844]
                    - cell "Payé" [ref=e845]
                  - row [ref=e849]:
                    - cell [ref=e850]:
                      - time [ref=e851]: sam. 21 nov. 2026 à 02:08
                    - cell "Réf. interne 33C53BD6" [ref=e852]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=e853]:
                      - generic [ref=e854]:
                        - generic [ref=e855]: Billets
                        - generic [ref=e856]: Marché gourmand de la Petite-Côte
                    - cell "10 500 F CFA" [ref=e857]
                    - cell "500 F CFA" [ref=e858]
                    - cell "342,5 F CFA" [ref=e859]
                    - cell "Payé" [ref=e860]
                  - row [ref=e864]:
                    - cell [ref=e865]:
                      - time [ref=e866]: sam. 21 nov. 2026 à 02:07
                    - cell "Réf. interne 64F336D7" [ref=e867]
                    - cell "Billets Dîner-spectacle au bord du Saloum" [ref=e868]:
                      - generic [ref=e869]:
                        - generic [ref=e870]: Billets
                        - generic [ref=e871]: Dîner-spectacle au bord du Saloum
                    - cell "52 500 F CFA" [ref=e872]
                    - cell "2 500 F CFA" [ref=e873]
                    - cell "1 712,5 F CFA" [ref=e874]
                    - cell "Payé" [ref=e875]
                  - row [ref=e879]:
                    - cell [ref=e880]:
                      - time [ref=e881]: sam. 21 nov. 2026 à 01:34
                    - cell "Réf. interne BCB9FE8F" [ref=e882]
                    - cell "Billets Croisière musicale vers Gorée" [ref=e883]:
                      - generic [ref=e884]:
                        - generic [ref=e885]: Billets
                        - generic [ref=e886]: Croisière musicale vers Gorée
                    - cell "15 750 F CFA" [ref=e887]
                    - cell "750 F CFA" [ref=e888]
                    - cell "-236,25 F CFA" [ref=e889]
                    - cell "Remboursé" [ref=e890]
                  - row [ref=e894]:
                    - cell [ref=e895]:
                      - time [ref=e896]: sam. 21 nov. 2026 à 01:18
                    - cell "Réf. interne 439F9F72" [ref=e897]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=e898]:
                      - generic [ref=e899]:
                        - generic [ref=e900]: Billets
                        - generic [ref=e901]: Nuit du Sabar — édition d’automne
                    - cell "15 750 F CFA" [ref=e902]
                    - cell "750 F CFA" [ref=e903]
                    - cell "513,75 F CFA" [ref=e904]
                    - cell "Payé" [ref=e905]
                  - row [ref=e909]:
                    - cell [ref=e910]:
                      - time [ref=e911]: sam. 21 nov. 2026 à 01:16
                    - cell "Réf. interne D3C88395" [ref=e912]
                    - cell "Billets Carnaval des enfants de Saly" [ref=e913]:
                      - generic [ref=e914]:
                        - generic [ref=e915]: Billets
                        - generic [ref=e916]: Carnaval des enfants de Saly
                    - cell "4 200 F CFA" [ref=e917]
                    - cell "200 F CFA" [ref=e918]
                    - cell "137 F CFA" [ref=e919]
                    - cell "Payé" [ref=e920]
            - navigation "Pages des paiements" [ref=e924]:
              - button "Précédent" [disabled] [ref=e925]
              - paragraph [ref=e930]:
                - text: Page 1 sur 7
                - generic [ref=e931]: · 133 résultats
              - button "Suivant" [ref=e932] [cursor=pointer]
  - alert [ref=e937]
```

# Test source

```ts
  224 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  225 |             }
  226 |             if (screen.injectError) {
  227 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  228 |                 await page.route(screen.injectError, (route) => route.fulfill({
  229 |                     status: 500,
  230 |                     contentType: 'application/json; charset=utf-8',
  231 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  232 |                 }));
  233 |             }
  234 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  235 |             for (const stub of stubs) {
  236 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  237 |                 await page.route(stub.url, async (route) => {
  238 |                     if (!methodMatches(stub.method, route.request().method())) {
  239 |                         await route.fallback();
  240 |                         return;
  241 |                     }
  242 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  243 |                 });
  244 |             }
  245 |             for (const hold of screen.holdRequests ?? []) {
  246 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  247 |                 await page.route(hold.url, async (route) => {
  248 |                     if (!methodMatches(hold.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  253 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  254 |                 });
  255 |             }
  256 |             if (screen.fakePush) {
  257 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  258 |                 record.notes.push(screen.fakePush === 'granted'
  259 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  260 |                     : screen.fakePush === 'denied'
  261 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  262 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  263 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  264 |             }
  265 |             if (screen.fakeCamera) {
  266 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  267 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  268 |                 await context.addInitScript(installFakeCamera, { mode });
  269 |             }
  270 |             if (screen.offline === 'before-load') {
  271 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  272 |                 guard.freeze();
  273 |                 await context.setOffline(true);
  274 |             }
  275 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  276 |             record.status = response ? response.status() : null;
  277 |             if (screen.expectStatus !== undefined) {
  278 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  279 |             }
  280 |             if (screen.offline === 'after-load') {
  281 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const sc = { page, context, guard, ids: demo };
  286 |             if (screen.ready) await screen.ready(sc);
  287 |             await settle(page, guard, record.notes);
  288 |             if (screen.actions) {
  289 |                 await screen.actions(sc);
  290 |                 await settle(page, guard, record.notes);
  291 |             }
  292 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  293 |                 const problem = await markAllOnOneLine(page);
  294 |                 if (problem) record.blocking.push(problem);
  295 |             }
  296 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  297 |             record.blocking.push(...checks.blocking);
  298 |             record.warnings.push(...checks.warnings);
  299 |             record.axeDetails = checks.axeDetails;
  300 |             record.smallTextDetails = checks.smallTextDetails;
  301 |             record.metrics = checks.metrics;
  302 |             const shot = await capture(page, screen, file);
  303 |             record.captured = true;
  304 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  305 |         } catch (err) {
  306 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  307 |             if (!record.captured && !page.isClosed()) {
  308 |                 await capture(page, screen, file).then(
  309 |                     async (shot) => {
  310 |                         record.captured = true;
  311 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  312 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  313 |                     },
  314 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  315 |                 );
  316 |             }
  317 |             throw err;
  318 |         } finally {
  319 |             record.blocking.push(...guard.blockingIssues());
  320 |             record.warnings.push(...guard.nonBlockingIssues());
  321 |             record.durationMs = Date.now() - started;
  322 |             writeCaptureRecord(record);
  323 |         }
> 324 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de admin-remboursements-a-reprendre__ordinateur__clair.png
  325 |     });
  326 | }
  327 | 
  328 | for (const theme of THEMES) {
  329 |     for (const role of ROLE_ORDER) {
  330 |         const screens = SCREENS.filter((s) => s.role === role);
  331 |         if (screens.length === 0) continue;
  332 |         test.describe(`${theme.key} · ${role}`, () => {
  333 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  334 | 
  335 |             for (const screen of screens) {
  336 |                 if (screen.serviceWorkers === 'allow') {
  337 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  338 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  339 |                         test.use({ serviceWorkers: 'allow' });
  340 |                         defineCapture(screen, theme, role);
  341 |                     });
  342 |                 } else {
  343 |                     defineCapture(screen, theme, role);
  344 |                 }
  345 |             }
  346 |         });
  347 |     }
  348 | }
  349 | 
```