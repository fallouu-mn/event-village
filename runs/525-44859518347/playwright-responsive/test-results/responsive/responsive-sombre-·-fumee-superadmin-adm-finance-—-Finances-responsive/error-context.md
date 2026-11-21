# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-finance — Finances
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-finance (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (77×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e4]:
      - generic [ref=f2e5]:
        - link "Event Village, accueil" [ref=f2e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f2e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f2e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f2e16]:
        - generic [ref=f2e17]: Administration
        - link "Tableau de bord" [ref=f2e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e29]:
          - paragraph [ref=f2e30]: Gestion
          - generic [ref=f2e31]:
            - link "Événements" [ref=f2e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f2e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=f2e55]:
          - paragraph [ref=f2e56]: Finances
          - link "Finance" [ref=f2e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e62]:
          - paragraph [ref=f2e63]: Engagement
          - generic [ref=f2e64]:
            - link "Parrainage" [ref=f2e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e79]:
          - paragraph [ref=f2e80]: Système
          - generic [ref=f2e81]:
            - link "Réglages" [ref=f2e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e113] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f2e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e121]: ES
          - generic [ref=f2e122]:
            - generic [ref=f2e123]: Elhadji SuperAdmin
            - generic [ref=f2e124]: Super-administrateur
        - generic [ref=f2e125]:
          - button "Se déconnecter" [ref=f2e126] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e131] [cursor=pointer]
    - generic [ref=f2e135]:
      - banner [ref=f2e136]:
        - link "Rechercher un événement…" [ref=f2e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f2e143]:
          - button "Notifications, 61 non lues" [ref=f2e145] [cursor=pointer]:
            - generic [ref=f2e149]: "61"
          - button "Elhadji SuperAdmin" [ref=f2e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=f2e152]: ES
      - main [ref=f2e156]:
        - generic [ref=f2e158]:
          - generic [ref=f2e160]:
            - generic [ref=f2e161]:
              - heading "Finance" [level=1] [ref=f2e162]
              - paragraph [ref=f2e163]: Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay.
            - link "Réglages de la plateforme" [ref=f2e165] [cursor=pointer]:
              - /url: /admin/finance-settings
          - group [ref=f2e171]:
            - heading "Période" [level=2] [ref=f2e175]
            - generic [ref=f2e177]:
              - generic [ref=f2e178]: Afficher
              - combobox "Afficher" [ref=f2e181] [cursor=pointer]:
                - option "Aujourd’hui"
                - option "7 derniers jours"
                - option "30 derniers jours"
                - option "Ce mois-ci" [selected]
                - option "Mois dernier"
                - option "Dates choisies…"
            - paragraph [ref=f2e182]: "Période affichée : du 1er au 21 novembre 2026. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant."
          - generic [ref=f2e183]:
            - region [ref=f2e184]:
              - heading "Gagné par Event Village" [level=2] [ref=f2e186]
              - paragraph [ref=f2e191]: 57 540,72 F CFA
              - paragraph [ref=f2e192]: "Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
              - paragraph [ref=f2e193]: Paiements encaissés, retraits versés et versements confirmés du 1er au 21 novembre 2026.
              - link "Voir le détail" [ref=f2e194] [cursor=pointer]:
                - /url: "#detail-gagne"
            - region [ref=f2e195]:
              - heading "Dû aux partenaires" [level=2] [ref=f2e197]
              - paragraph [ref=f2e202]: 1 749 000 F CFA
              - paragraph [ref=f2e203]: "L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
              - paragraph [ref=f2e204]: "Dont 0 F CFA retirables aujourd’hui. Dû aux parrains : 0 F CFA. À l’instant."
              - link "Voir le détail" [ref=f2e205] [cursor=pointer]:
                - /url: "#du-aux-partenaires"
            - region [ref=f2e206]:
              - heading "Retirable par Event Village" [level=2] [ref=f2e208]
              - paragraph [ref=f2e212]: 47 182 025 F CFA
              - paragraph [ref=f2e213]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
              - paragraph [ref=f2e214]:
                - text: Solde SamirPay lu à
                - time [ref=f2e215]: 03:24
                - text: ", moins tout ce qui est dû et la réserve de prudence."
              - link "Voir le calcul" [ref=f2e216] [cursor=pointer]:
                - /url: "#calcul-retirable"
            - region [ref=f2e217]:
              - heading "Créances" [level=2] [ref=f2e219]
              - paragraph [ref=f2e225]: 0 F CFA
              - paragraph [ref=f2e226]: Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre.
              - paragraph [ref=f2e227]: Aucune créance à l’instant.
              - link "Voir les créances" [ref=f2e228] [cursor=pointer]:
                - /url: "#creances"
          - region [ref=f2e230]:
            - generic [ref=f2e231]:
              - heading "Versements à reprendre" [level=2] [ref=f2e232]
              - paragraph [ref=f2e233]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - region "Versements à reprendre" [ref=f2e235]:
              - table [ref=f2e236]:
                - caption [ref=f2e237]: Versements à reprendre
                - rowgroup [ref=f2e238]:
                  - row [ref=f2e239]:
                    - columnheader "Montant" [ref=f2e240]
                    - columnheader "Versement" [ref=f2e241]
                    - columnheader "Bénéficiaire" [ref=f2e242]
                    - columnheader "État" [ref=f2e243]
                    - columnheader "Depuis le" [ref=f2e244]
                    - columnheader "Reprise" [ref=f2e245]
                - rowgroup [ref=f2e246]:
                  - row [ref=f2e247]:
                    - cell "15 750 F CFA" [ref=f2e248]
                    - cell [ref=f2e249]:
                      - generic [ref=f2e250]:
                        - paragraph [ref=f2e251]: Remboursement d’une annulation
                        - paragraph [ref=f2e252]: Croisière musicale vers Gorée
                    - cell "Babacar D. · 70*****06" [ref=f2e253]
                    - cell "Issue incertaine" [ref=f2e254]
                    - cell [ref=f2e258]:
                      - time [ref=f2e259]: sam. 21 nov. 2026 à 03:11
                    - cell [ref=f2e260]:
                      - generic [ref=f2e261]:
                        - paragraph [ref=f2e262]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                        - generic [ref=f2e263]:
                          - button "Marquer versé le versement de 15 750 F CFA" [ref=f2e264] [cursor=pointer]:
                            - generic [ref=f2e269]: Marquer versé
                          - button "Constater non versé le versement de 15 750 F CFA" [ref=f2e270] [cursor=pointer]:
                            - generic [ref=f2e275]: Constater non versé
                  - row [ref=f2e276]:
                    - cell "9 450 F CFA" [ref=f2e277]
                    - cell [ref=f2e278]:
                      - generic [ref=f2e279]:
                        - paragraph [ref=f2e280]: Remboursement d’une annulation
                        - paragraph [ref=f2e281]: Croisière musicale vers Gorée
                    - cell "Pape L. · 70*****10" [ref=f2e282]
                    - cell "Issue incertaine" [ref=f2e283]
                    - cell [ref=f2e287]:
                      - time [ref=f2e288]: sam. 21 nov. 2026 à 03:11
                    - cell [ref=f2e289]:
                      - generic [ref=f2e290]:
                        - paragraph [ref=f2e291]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                        - generic [ref=f2e292]:
                          - button "Marquer versé le versement de 9 450 F CFA" [ref=f2e293] [cursor=pointer]:
                            - generic [ref=f2e298]: Marquer versé
                          - button "Constater non versé le versement de 9 450 F CFA" [ref=f2e299] [cursor=pointer]:
                            - generic [ref=f2e304]: Constater non versé
          - region [ref=f2e305]:
            - generic [ref=f2e306]:
              - heading "Remboursements à verser" [level=2] [ref=f2e307]
              - paragraph [ref=f2e308]: Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
              - paragraph [ref=f2e309]: 4 remboursements pour 72 450 F CFA.
            - region "Remboursements à verser" [ref=f2e311]:
              - table [ref=f2e312]:
                - caption [ref=f2e313]: Remboursements à verser
                - rowgroup [ref=f2e314]:
                  - row [ref=f2e315]:
                    - columnheader "Demandé le" [ref=f2e316]
                    - columnheader "Remboursement" [ref=f2e317]
                    - columnheader "Client" [ref=f2e318]
                    - columnheader "Montant" [ref=f2e319]
                    - columnheader "Où il en est" [ref=f2e320]
                - rowgroup [ref=f2e321]:
                  - row [ref=f2e322]:
                    - cell [ref=f2e323]:
                      - time [ref=f2e324]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e325]:
                      - generic [ref=f2e326]:
                        - generic [ref=f2e327]: Remboursement d’une annulation
                        - generic [ref=f2e328]: Croisière musicale vers Gorée
                    - cell "Modou M. · 70*****18" [ref=f2e329]
                    - cell "15 750 F CFA" [ref=f2e330]
                    - cell "Envoyé, en attente de confirmation" [ref=f2e331]
                  - row [ref=f2e334]:
                    - cell [ref=f2e335]:
                      - time [ref=f2e336]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e337]:
                      - generic [ref=f2e338]:
                        - generic [ref=f2e339]: Remboursement d’une annulation
                        - generic [ref=f2e340]: Croisière musicale vers Gorée
                    - cell "Awa D. · 70*****01" [ref=f2e341]
                    - cell "31 500 F CFA" [ref=f2e342]
                    - cell "Envoyé, en attente de confirmation" [ref=f2e343]
                  - row [ref=f2e346]:
                    - cell [ref=f2e347]:
                      - time [ref=f2e348]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e349]:
                      - generic [ref=f2e350]:
                        - generic [ref=f2e351]: Remboursement d’une annulation
                        - generic [ref=f2e352]: Croisière musicale vers Gorée
                    - cell "Babacar D. · 70*****06" [ref=f2e353]
                    - cell "15 750 F CFA" [ref=f2e354]
                    - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f2e355]':
                      - generic [ref=f2e356]:
                        - generic [ref=f2e357]: "Issue incertaine : à vérifier"
                        - link "Traiter dans « Versements à reprendre »" [ref=f2e358] [cursor=pointer]:
                          - /url: "#versements-a-reprendre"
                  - row [ref=f2e359]:
                    - cell [ref=f2e360]:
                      - time [ref=f2e361]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e362]:
                      - generic [ref=f2e363]:
                        - generic [ref=f2e364]: Remboursement d’une annulation
                        - generic [ref=f2e365]: Croisière musicale vers Gorée
                    - cell "Pape L. · 70*****10" [ref=f2e366]
                    - cell "9 450 F CFA" [ref=f2e367]
                    - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f2e368]':
                      - generic [ref=f2e369]:
                        - generic [ref=f2e370]: "Issue incertaine : à vérifier"
                        - link "Traiter dans « Versements à reprendre »" [ref=f2e371] [cursor=pointer]:
                          - /url: "#versements-a-reprendre"
          - region [ref=f2e372]:
            - generic [ref=f2e373]:
              - heading "Créances" [level=2] [ref=f2e374]
              - paragraph [ref=f2e375]: Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ; ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
            - generic [ref=f2e376]:
              - heading "Aucune créance" [level=3] [ref=f2e381]
              - paragraph [ref=f2e382]: Personne ne doit d’argent à Event Village.
          - region [ref=f2e383]:
            - generic [ref=f2e384]:
              - heading "Détail de ce qui a été gagné" [level=2] [ref=f2e385]
              - paragraph [ref=f2e386]: "Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés du 1er au 21 novembre 2026."
            - generic [ref=f2e387]:
              - generic [ref=f2e388]:
                - term [ref=f2e389]:
                  - generic [ref=f2e390]: Frais de service, moins les frais d’encaissement SamirPay
                  - generic [ref=f2e391]: "133 paiements encaissés du 1er au 21 novembre 2026 : 94 950 F CFA de frais de service, 29 909,28 F CFA de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas)."
                - definition [ref=f2e392]: + 65 040,72 F CFA
              - generic [ref=f2e393]:
                - term [ref=f2e394]:
                  - generic [ref=f2e395]: Part rendue avec les remboursements
                  - generic [ref=f2e396]: Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.
                - definition [ref=f2e397]: − 7 500 F CFA
              - generic [ref=f2e398]:
                - term [ref=f2e399]:
                  - generic [ref=f2e400]: Frais de retrait
                  - generic [ref=f2e401]: 0 retrait versé du 1er au 21 novembre 2026.
                - definition [ref=f2e402]: + 0 F CFA
              - generic [ref=f2e403]:
                - term [ref=f2e404]:
                  - generic [ref=f2e405]: Frais SamirPay des versements
                  - generic [ref=f2e406]: Frais réels de 0 versement confirmé du 1er au 21 novembre 2026 (remboursements et retraits).
                - definition [ref=f2e407]: − 0 F CFA
              - generic [ref=f2e408]:
                - term [ref=f2e409]:
                  - generic [ref=f2e410]: Commissions de parrainage
                  - generic [ref=f2e411]: Sur les paiements encaissés de la période, annulations et reprises déduites.
                - definition [ref=f2e412]: − 0 F CFA
              - generic [ref=f2e413]:
                - term [ref=f2e414]:
                  - generic [ref=f2e415]: Gagné par Event Village
                - definition [ref=f2e416]: 57 540,72 F CFA
          - region [ref=f2e417]:
            - generic [ref=f2e418]:
              - heading "Dû aux partenaires" [level=2] [ref=f2e419]
              - paragraph [ref=f2e420]: L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
            - generic [ref=f2e421]:
              - generic [ref=f2e422]:
                - term [ref=f2e423]:
                  - generic [ref=f2e424]: Disponible pour les partenaires
                  - generic [ref=f2e425]: Dont 0 F CFA retirables tout de suite et 0 F CFA gelés (événements suspendus, libérés à la reprise).
                - definition [ref=f2e426]: 0 F CFA
              - generic [ref=f2e427]:
                - term [ref=f2e428]:
                  - generic [ref=f2e429]: En attente de la fin des événements
                - definition [ref=f2e430]: 1 749 000 F CFA
              - generic [ref=f2e431]:
                - term [ref=f2e432]:
                  - generic [ref=f2e433]: Retraits en cours d’envoi
                  - generic [ref=f2e434]: Demandés par les partenaires, pas encore confirmés par SamirPay.
                - definition [ref=f2e435]: 0 F CFA
              - generic [ref=f2e436]:
                - term [ref=f2e437]:
                  - generic [ref=f2e438]: Dû aux partenaires
                - definition [ref=f2e439]: 1 749 000 F CFA
            - region "Dû aux partenaires, compte par compte" [ref=f2e441]:
              - table [ref=f2e442]:
                - caption [ref=f2e443]: Dû aux partenaires, compte par compte
                - rowgroup [ref=f2e444]:
                  - row [ref=f2e445]:
                    - columnheader "Partenaire" [ref=f2e446]
                    - columnheader "Dû" [ref=f2e447]
                    - columnheader "Retirable aujourd’hui" [ref=f2e448]
                    - columnheader "En attente" [ref=f2e449]
                    - columnheader "Gelé" [ref=f2e450]
                    - columnheader "Retrait en cours" [ref=f2e451]
                - rowgroup [ref=f2e452]:
                  - row [ref=f2e453]:
                    - cell "Baobab Scène Productions" [ref=f2e454]
                    - cell "828 000 F CFA" [ref=f2e455]
                    - cell "0 F CFA" [ref=f2e456]
                    - cell "828 000 F CFA" [ref=f2e457]
                    - cell "0 F CFA" [ref=f2e458]
                    - cell "0 F CFA" [ref=f2e459]
                  - row [ref=f2e460]:
                    - cell "Sine-Saloum Culture & Loisirs" [ref=f2e461]
                    - cell "806 000 F CFA" [ref=f2e462]
                    - cell "0 F CFA" [ref=f2e463]
                    - cell "806 000 F CFA" [ref=f2e464]
                    - cell "0 F CFA" [ref=f2e465]
                    - cell "0 F CFA" [ref=f2e466]
                  - row [ref=f2e467]:
                    - cell "Atelier Petite-Côte" [ref=f2e468]
                    - cell "115 000 F CFA" [ref=f2e469]
                    - cell "0 F CFA" [ref=f2e470]
                    - cell "115 000 F CFA" [ref=f2e471]
                    - cell "0 F CFA" [ref=f2e472]
                    - cell "0 F CFA" [ref=f2e473]
            - generic [ref=f2e474]:
              - heading "Dû aux parrains" [level=3] [ref=f2e475]
              - paragraph [ref=f2e476]: "Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village. Total : 0 F CFA."
              - generic [ref=f2e477]:
                - heading "Rien n’est dû aux parrains" [level=3] [ref=f2e484]
                - paragraph [ref=f2e485]: Aucun solde à verser pour le moment.
          - region [ref=f2e486]:
            - generic [ref=f2e487]:
              - heading "Calcul de ce qui est retirable" [level=2] [ref=f2e488]
              - paragraph [ref=f2e489]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. Si ce chiffre est à 0, ne retirez rien.
            - generic [ref=f2e490]:
              - generic [ref=f2e491]:
                - term [ref=f2e492]:
                  - generic [ref=f2e493]: Solde du compte SamirPay
                  - generic [ref=f2e494]:
                    - text: Lu à
                    - time [ref=f2e495]: 03:24
                    - text: (heure de Dakar), relu au plus toutes les 5 minutes.
                - definition [ref=f2e496]: 50 000 000 F CFA
              - generic [ref=f2e497]:
                - term [ref=f2e498]:
                  - generic [ref=f2e499]: Dû aux partenaires
                - definition [ref=f2e500]: − 1 749 000 F CFA
              - generic [ref=f2e501]:
                - term [ref=f2e502]:
                  - generic [ref=f2e503]: Dû aux parrains
                - definition [ref=f2e504]: − 0 F CFA
              - generic [ref=f2e505]:
                - term [ref=f2e506]:
                  - generic [ref=f2e507]: Remboursements à verser
                - definition [ref=f2e508]: − 72 450 F CFA
              - generic [ref=f2e509]:
                - term [ref=f2e510]:
                  - generic [ref=f2e511]: Réserve de prudence
                  - generic [ref=f2e512]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Automatique : les encaissements des 3 derniers jours, soit 996 525 F CFA aujourd’hui."
                - definition [ref=f2e513]: − 996 525 F CFA
              - generic [ref=f2e514]:
                - term [ref=f2e515]:
                  - generic [ref=f2e516]: Retirable par Event Village
                - definition [ref=f2e517]: 47 182 025 F CFA
            - link "Changer la réserve de prudence" [ref=f2e519] [cursor=pointer]:
              - /url: /admin/finance-settings
          - region [ref=f2e521]:
            - generic [ref=f2e522]:
              - heading "Paiements encaissés" [level=2] [ref=f2e523]
              - paragraph [ref=f2e527]: Paiements en ligne encaissés du 1er au 21 novembre 2026. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            - generic [ref=f2e528]:
              - generic [ref=f2e529]: Statut
              - combobox "Statut" [ref=f2e532] [cursor=pointer]:
                - option "Tous les paiements" [selected]
                - option "Payé"
                - option "Remboursé en partie"
                - option "Remboursement en cours"
                - option "Remboursé"
            - region "Paiements encaissés" [ref=f2e534]:
              - table [ref=f2e535]:
                - caption [ref=f2e536]: Paiements encaissés
                - rowgroup [ref=f2e537]:
                  - row [ref=f2e538]:
                    - columnheader "Encaissé le" [ref=f2e539]
                    - columnheader "Référence" [ref=f2e540]
                    - columnheader "Objet" [ref=f2e541]
                    - columnheader "Payé" [ref=f2e542]
                    - columnheader "Frais de service" [ref=f2e543]
                    - columnheader "Pour Event Village" [ref=f2e544]
                    - columnheader "Statut" [ref=f2e545]
                - rowgroup [ref=f2e546]:
                  - row [ref=f2e547]:
                    - cell [ref=f2e548]:
                      - time [ref=f2e549]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 8F4D71EF" [ref=f2e550]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f2e551]:
                      - generic [ref=f2e552]:
                        - generic [ref=f2e553]: Billets
                        - generic [ref=f2e554]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f2e555]
                    - cell "450 F CFA" [ref=f2e556]
                    - cell "308,25 F CFA" [ref=f2e557]
                    - cell "Payé" [ref=f2e558]
                  - row [ref=f2e562]:
                    - cell [ref=f2e563]:
                      - time [ref=f2e564]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 0106DE2D" [ref=f2e565]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f2e566]:
                      - generic [ref=f2e567]:
                        - generic [ref=f2e568]: Billets
                        - generic [ref=f2e569]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f2e570]
                    - cell "450 F CFA" [ref=f2e571]
                    - cell "308,25 F CFA" [ref=f2e572]
                    - cell "Payé" [ref=f2e573]
                  - row [ref=f2e577]:
                    - cell [ref=f2e578]:
                      - time [ref=f2e579]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 2C9D9D98" [ref=f2e580]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f2e581]:
                      - generic [ref=f2e582]:
                        - generic [ref=f2e583]: Billets
                        - generic [ref=f2e584]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f2e585]
                    - cell "450 F CFA" [ref=f2e586]
                    - cell "308,25 F CFA" [ref=f2e587]
                    - cell "Payé" [ref=f2e588]
                  - row [ref=f2e592]:
                    - cell [ref=f2e593]:
                      - time [ref=f2e594]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 13CF901E" [ref=f2e595]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f2e596]:
                      - generic [ref=f2e597]:
                        - generic [ref=f2e598]: Billets
                        - generic [ref=f2e599]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f2e600]
                    - cell "450 F CFA" [ref=f2e601]
                    - cell "308,25 F CFA" [ref=f2e602]
                    - cell "Payé" [ref=f2e603]
                  - row [ref=f2e607]:
                    - cell [ref=f2e608]:
                      - time [ref=f2e609]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 2605BD35" [ref=f2e610]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f2e611]:
                      - generic [ref=f2e612]:
                        - generic [ref=f2e613]: Billets
                        - generic [ref=f2e614]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f2e615]
                    - cell "450 F CFA" [ref=f2e616]
                    - cell "308,25 F CFA" [ref=f2e617]
                    - cell "Payé" [ref=f2e618]
                  - row [ref=f2e622]:
                    - cell [ref=f2e623]:
                      - time [ref=f2e624]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne B62DC4A3" [ref=f2e625]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f2e626]:
                      - generic [ref=f2e627]:
                        - generic [ref=f2e628]: Billets
                        - generic [ref=f2e629]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f2e630]
                    - cell "450 F CFA" [ref=f2e631]
                    - cell "308,25 F CFA" [ref=f2e632]
                    - cell "Payé" [ref=f2e633]
                  - row [ref=f2e637]:
                    - cell [ref=f2e638]:
                      - time [ref=f2e639]: sam. 21 nov. 2026 à 03:10
                    - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-BIS-B-1" [ref=f2e640]
                    - cell "Billets" [ref=f2e641]
                    - cell "4 000 F CFA" [ref=f2e644]
                    - cell "0 F CFA" [ref=f2e645]
                    - cell "0 F CFA" [ref=f2e646]
                    - cell "Payé" [ref=f2e647]
                  - row [ref=f2e651]:
                    - cell [ref=f2e652]:
                      - time [ref=f2e653]: sam. 21 nov. 2026 à 03:10
                    - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-A-1" [ref=f2e654]
                    - cell "Billets" [ref=f2e655]
                    - cell "5 000 F CFA" [ref=f2e658]
                    - cell "0 F CFA" [ref=f2e659]
                    - cell "0 F CFA" [ref=f2e660]
                    - cell "Payé" [ref=f2e661]
                  - row [ref=f2e665]:
                    - cell [ref=f2e666]:
                      - time [ref=f2e667]: sam. 21 nov. 2026 à 02:12
                    - cell "Réf. interne 4CEE00B1" [ref=f2e668]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=f2e669]:
                      - generic [ref=f2e670]:
                        - generic [ref=f2e671]: Billets
                        - generic [ref=f2e672]: Nuit du Sabar — édition d’automne
                    - cell "6 300 F CFA" [ref=f2e673]
                    - cell "300 F CFA" [ref=f2e674]
                    - cell "205,5 F CFA" [ref=f2e675]
                    - cell "Payé" [ref=f2e676]
                  - row [ref=f2e680]:
                    - cell [ref=f2e681]:
                      - time [ref=f2e682]: sam. 21 nov. 2026 à 01:58
                    - cell "Réf. interne BE64B57B" [ref=f2e683]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=f2e684]:
                      - generic [ref=f2e685]:
                        - generic [ref=f2e686]: Billets
                        - generic [ref=f2e687]: Nuit du Sabar — édition d’automne
                    - cell "3 150 F CFA" [ref=f2e688]
                    - cell "150 F CFA" [ref=f2e689]
                    - cell "102,75 F CFA" [ref=f2e690]
                    - cell "Payé" [ref=f2e691]
                  - row [ref=f2e695]:
                    - cell [ref=f2e696]:
                      - time [ref=f2e697]: sam. 21 nov. 2026 à 01:44
                    - cell "Réf. interne 0DACB56F" [ref=f2e698]
                    - cell "Billets Rencontres du conte et de la parole" [ref=f2e699]:
                      - generic [ref=f2e700]:
                        - generic [ref=f2e701]: Billets
                        - generic [ref=f2e702]: Rencontres du conte et de la parole
                    - cell "3 150 F CFA" [ref=f2e703]
                    - cell "150 F CFA" [ref=f2e704]
                    - cell "102,75 F CFA" [ref=f2e705]
                    - cell "Payé" [ref=f2e706]
                  - row [ref=f2e710]:
                    - cell [ref=f2e711]:
                      - time [ref=f2e712]: sam. 21 nov. 2026 à 01:10
                    - cell "Réf. interne 73A0D3FA" [ref=f2e713]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=f2e714]:
                      - generic [ref=f2e715]:
                        - generic [ref=f2e716]: Billets
                        - generic [ref=f2e717]: Marché gourmand de la Petite-Côte
                    - cell "5 250 F CFA" [ref=f2e718]
                    - cell "250 F CFA" [ref=f2e719]
                    - cell "171,25 F CFA" [ref=f2e720]
                    - cell "Payé" [ref=f2e721]
                  - row [ref=f2e725]:
                    - cell [ref=f2e726]:
                      - time [ref=f2e727]: sam. 21 nov. 2026 à 01:00
                    - cell "Réf. interne 745C6B46" [ref=f2e728]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=f2e729]:
                      - generic [ref=f2e730]:
                        - generic [ref=f2e731]: Billets
                        - generic [ref=f2e732]: Marché gourmand de la Petite-Côte
                    - cell "4 200 F CFA" [ref=f2e733]
                    - cell "200 F CFA" [ref=f2e734]
                    - cell "137 F CFA" [ref=f2e735]
                    - cell "Payé" [ref=f2e736]
                  - row [ref=f2e740]:
                    - cell [ref=f2e741]:
                      - time [ref=f2e742]: sam. 21 nov. 2026 à 00:12
                    - cell "Réf. interne E698F509" [ref=f2e743]
                    - cell "Billets Festival Jazz sur le Fleuve" [ref=f2e744]:
                      - generic [ref=f2e745]:
                        - generic [ref=f2e746]: Billets
                        - generic [ref=f2e747]: Festival Jazz sur le Fleuve
                    - cell "15 750 F CFA" [ref=f2e748]
                    - cell "750 F CFA" [ref=f2e749]
                    - cell "513,75 F CFA" [ref=f2e750]
                    - cell "Payé" [ref=f2e751]
                  - row [ref=f2e755]:
                    - cell [ref=f2e756]:
                      - time [ref=f2e757]: ven. 20 nov. 2026 à 23:55
                    - cell "Réf. interne 50190DCF" [ref=f2e758]
                    - cell "Billets Croisière musicale vers Gorée" [ref=f2e759]:
                      - generic [ref=f2e760]:
                        - generic [ref=f2e761]: Billets
                        - generic [ref=f2e762]: Croisière musicale vers Gorée
                    - cell "31 500 F CFA" [ref=f2e763]
                    - cell "1 500 F CFA" [ref=f2e764]
                    - cell "-472,5 F CFA" [ref=f2e765]
                    - cell "Payé" [ref=f2e766]
                  - row [ref=f2e770]:
                    - cell [ref=f2e771]:
                      - time [ref=f2e772]: ven. 20 nov. 2026 à 23:32
                    - cell "Réf. interne 3E9CD036" [ref=f2e773]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=f2e774]:
                      - generic [ref=f2e775]:
                        - generic [ref=f2e776]: Billets
                        - generic [ref=f2e777]: Marché gourmand de la Petite-Côte
                    - cell "10 500 F CFA" [ref=f2e778]
                    - cell "500 F CFA" [ref=f2e779]
                    - cell "342,5 F CFA" [ref=f2e780]
                    - cell "Payé" [ref=f2e781]
                  - row [ref=f2e785]:
                    - cell [ref=f2e786]:
                      - time [ref=f2e787]: ven. 20 nov. 2026 à 23:31
                    - cell "Réf. interne BDD39B0D" [ref=f2e788]
                    - cell "Billets Dîner-spectacle au bord du Saloum" [ref=f2e789]:
                      - generic [ref=f2e790]:
                        - generic [ref=f2e791]: Billets
                        - generic [ref=f2e792]: Dîner-spectacle au bord du Saloum
                    - cell "52 500 F CFA" [ref=f2e793]
                    - cell "2 500 F CFA" [ref=f2e794]
                    - cell "1 712,5 F CFA" [ref=f2e795]
                    - cell "Payé" [ref=f2e796]
                  - row [ref=f2e800]:
                    - cell [ref=f2e801]:
                      - time [ref=f2e802]: ven. 20 nov. 2026 à 22:58
                    - cell "Réf. interne 61B53DB7" [ref=f2e803]
                    - cell "Billets Croisière musicale vers Gorée" [ref=f2e804]:
                      - generic [ref=f2e805]:
                        - generic [ref=f2e806]: Billets
                        - generic [ref=f2e807]: Croisière musicale vers Gorée
                    - cell "15 750 F CFA" [ref=f2e808]
                    - cell "750 F CFA" [ref=f2e809]
                    - cell "-236,25 F CFA" [ref=f2e810]
                    - cell "Remboursé" [ref=f2e811]
                  - row [ref=f2e815]:
                    - cell [ref=f2e816]:
                      - time [ref=f2e817]: ven. 20 nov. 2026 à 22:42
                    - cell "Réf. interne 37D92D28" [ref=f2e818]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=f2e819]:
                      - generic [ref=f2e820]:
                        - generic [ref=f2e821]: Billets
                        - generic [ref=f2e822]: Nuit du Sabar — édition d’automne
                    - cell "15 750 F CFA" [ref=f2e823]
                    - cell "750 F CFA" [ref=f2e824]
                    - cell "513,75 F CFA" [ref=f2e825]
                    - cell "Payé" [ref=f2e826]
                  - row [ref=f2e830]:
                    - cell [ref=f2e831]:
                      - time [ref=f2e832]: ven. 20 nov. 2026 à 22:40
                    - cell "Réf. interne 7CE7C555" [ref=f2e833]
                    - cell "Billets Carnaval des enfants de Saly" [ref=f2e834]:
                      - generic [ref=f2e835]:
                        - generic [ref=f2e836]: Billets
                        - generic [ref=f2e837]: Carnaval des enfants de Saly
                    - cell "4 200 F CFA" [ref=f2e838]
                    - cell "200 F CFA" [ref=f2e839]
                    - cell "137 F CFA" [ref=f2e840]
                    - cell "Payé" [ref=f2e841]
            - navigation "Pages des paiements" [ref=f2e845]:
              - button "Précédent" [disabled] [ref=f2e846]
              - paragraph [ref=f2e851]:
                - text: Page 1 sur 7
                - generic [ref=f2e852]: · 133 résultats
              - button "Suivant" [ref=f2e853] [cursor=pointer]
  - alert [ref=f2e858]
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
      |                                                                                        ^ Error: contrôles responsive de adm-finance (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```