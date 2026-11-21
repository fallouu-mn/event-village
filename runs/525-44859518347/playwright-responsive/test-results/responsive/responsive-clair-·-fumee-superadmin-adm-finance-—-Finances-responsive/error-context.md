# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-finance — Finances
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-finance (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "1024 px : textes qui se chevauchent : span.min-w-0.break-words « À la une » sur span.block.break-words « Elhadji SuperAdmin » (42×10 px) ; span.flex.flex-shrink-0 « ES » sur p.mb-1.5.block « Système » (17×14 px) ; span.block.break-words « Super-administrateur » sur p.mb-1.5.block « Système » (23×14 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Réglages » (13×16 px)",
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (77×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
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
          - generic [ref=f5e160]:
            - generic [ref=f5e161]:
              - heading "Finance" [level=1] [ref=f5e162]
              - paragraph [ref=f5e163]: Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay.
            - link "Réglages de la plateforme" [ref=f5e165] [cursor=pointer]:
              - /url: /admin/finance-settings
          - group [ref=f5e171]:
            - heading "Période" [level=2] [ref=f5e175]
            - generic [ref=f5e177]:
              - generic [ref=f5e178]: Afficher
              - combobox "Afficher" [ref=f5e181] [cursor=pointer]:
                - option "Aujourd’hui"
                - option "7 derniers jours"
                - option "30 derniers jours"
                - option "Ce mois-ci" [selected]
                - option "Mois dernier"
                - option "Dates choisies…"
            - paragraph [ref=f5e182]: "Période affichée : du 1er au 21 novembre 2026. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant."
          - generic [ref=f5e183]:
            - region [ref=f5e184]:
              - heading "Gagné par Event Village" [level=2] [ref=f5e186]
              - paragraph [ref=f5e191]: 57 540,72 F CFA
              - paragraph [ref=f5e192]: "Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
              - paragraph [ref=f5e193]: Paiements encaissés, retraits versés et versements confirmés du 1er au 21 novembre 2026.
              - link "Voir le détail" [ref=f5e194] [cursor=pointer]:
                - /url: "#detail-gagne"
            - region [ref=f5e195]:
              - heading "Dû aux partenaires" [level=2] [ref=f5e197]
              - paragraph [ref=f5e202]: 1 749 000 F CFA
              - paragraph [ref=f5e203]: "L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
              - paragraph [ref=f5e204]: "Dont 0 F CFA retirables aujourd’hui. Dû aux parrains : 0 F CFA. À l’instant."
              - link "Voir le détail" [ref=f5e205] [cursor=pointer]:
                - /url: "#du-aux-partenaires"
            - region [ref=f5e206]:
              - heading "Retirable par Event Village" [level=2] [ref=f5e208]
              - paragraph [ref=f5e212]: 47 182 025 F CFA
              - paragraph [ref=f5e213]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
              - paragraph [ref=f5e214]:
                - text: Solde SamirPay lu à
                - time [ref=f5e215]: 03:19
                - text: ", moins tout ce qui est dû et la réserve de prudence."
              - link "Voir le calcul" [ref=f5e216] [cursor=pointer]:
                - /url: "#calcul-retirable"
            - region [ref=f5e217]:
              - heading "Créances" [level=2] [ref=f5e219]
              - paragraph [ref=f5e225]: 0 F CFA
              - paragraph [ref=f5e226]: Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre.
              - paragraph [ref=f5e227]: Aucune créance à l’instant.
              - link "Voir les créances" [ref=f5e228] [cursor=pointer]:
                - /url: "#creances"
          - region [ref=f5e230]:
            - generic [ref=f5e231]:
              - heading "Versements à reprendre" [level=2] [ref=f5e232]
              - paragraph [ref=f5e233]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - region "Versements à reprendre" [ref=f5e235]:
              - table [ref=f5e236]:
                - caption [ref=f5e237]: Versements à reprendre
                - rowgroup [ref=f5e238]:
                  - row [ref=f5e239]:
                    - columnheader "Montant" [ref=f5e240]
                    - columnheader "Versement" [ref=f5e241]
                    - columnheader "Bénéficiaire" [ref=f5e242]
                    - columnheader "État" [ref=f5e243]
                    - columnheader "Depuis le" [ref=f5e244]
                    - columnheader "Reprise" [ref=f5e245]
                - rowgroup [ref=f5e246]:
                  - row [ref=f5e247]:
                    - cell "15 750 F CFA" [ref=f5e248]
                    - cell [ref=f5e249]:
                      - generic [ref=f5e250]:
                        - paragraph [ref=f5e251]: Remboursement d’une annulation
                        - paragraph [ref=f5e252]: Croisière musicale vers Gorée
                    - cell "Babacar D. · 70*****06" [ref=f5e253]
                    - cell "Issue incertaine" [ref=f5e254]
                    - cell [ref=f5e258]:
                      - time [ref=f5e259]: sam. 21 nov. 2026 à 03:11
                    - cell [ref=f5e260]:
                      - generic [ref=f5e261]:
                        - paragraph [ref=f5e262]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                        - generic [ref=f5e263]:
                          - button "Marquer versé le versement de 15 750 F CFA" [ref=f5e264] [cursor=pointer]:
                            - generic [ref=f5e269]: Marquer versé
                          - button "Constater non versé le versement de 15 750 F CFA" [ref=f5e270] [cursor=pointer]:
                            - generic [ref=f5e275]: Constater non versé
                  - row [ref=f5e276]:
                    - cell "9 450 F CFA" [ref=f5e277]
                    - cell [ref=f5e278]:
                      - generic [ref=f5e279]:
                        - paragraph [ref=f5e280]: Remboursement d’une annulation
                        - paragraph [ref=f5e281]: Croisière musicale vers Gorée
                    - cell "Pape L. · 70*****10" [ref=f5e282]
                    - cell "Issue incertaine" [ref=f5e283]
                    - cell [ref=f5e287]:
                      - time [ref=f5e288]: sam. 21 nov. 2026 à 03:11
                    - cell [ref=f5e289]:
                      - generic [ref=f5e290]:
                        - paragraph [ref=f5e291]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                        - generic [ref=f5e292]:
                          - button "Marquer versé le versement de 9 450 F CFA" [ref=f5e293] [cursor=pointer]:
                            - generic [ref=f5e298]: Marquer versé
                          - button "Constater non versé le versement de 9 450 F CFA" [ref=f5e299] [cursor=pointer]:
                            - generic [ref=f5e304]: Constater non versé
          - region [ref=f5e305]:
            - generic [ref=f5e306]:
              - heading "Remboursements à verser" [level=2] [ref=f5e307]
              - paragraph [ref=f5e308]: Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
              - paragraph [ref=f5e309]: 4 remboursements pour 72 450 F CFA.
            - region "Remboursements à verser" [ref=f5e311]:
              - table [ref=f5e312]:
                - caption [ref=f5e313]: Remboursements à verser
                - rowgroup [ref=f5e314]:
                  - row [ref=f5e315]:
                    - columnheader "Demandé le" [ref=f5e316]
                    - columnheader "Remboursement" [ref=f5e317]
                    - columnheader "Client" [ref=f5e318]
                    - columnheader "Montant" [ref=f5e319]
                    - columnheader "Où il en est" [ref=f5e320]
                - rowgroup [ref=f5e321]:
                  - row [ref=f5e322]:
                    - cell [ref=f5e323]:
                      - time [ref=f5e324]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e325]:
                      - generic [ref=f5e326]:
                        - generic [ref=f5e327]: Remboursement d’une annulation
                        - generic [ref=f5e328]: Croisière musicale vers Gorée
                    - cell "Modou M. · 70*****18" [ref=f5e329]
                    - cell "15 750 F CFA" [ref=f5e330]
                    - cell "Envoyé, en attente de confirmation" [ref=f5e331]
                  - row [ref=f5e334]:
                    - cell [ref=f5e335]:
                      - time [ref=f5e336]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e337]:
                      - generic [ref=f5e338]:
                        - generic [ref=f5e339]: Remboursement d’une annulation
                        - generic [ref=f5e340]: Croisière musicale vers Gorée
                    - cell "Awa D. · 70*****01" [ref=f5e341]
                    - cell "31 500 F CFA" [ref=f5e342]
                    - cell "Envoyé, en attente de confirmation" [ref=f5e343]
                  - row [ref=f5e346]:
                    - cell [ref=f5e347]:
                      - time [ref=f5e348]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e349]:
                      - generic [ref=f5e350]:
                        - generic [ref=f5e351]: Remboursement d’une annulation
                        - generic [ref=f5e352]: Croisière musicale vers Gorée
                    - cell "Babacar D. · 70*****06" [ref=f5e353]
                    - cell "15 750 F CFA" [ref=f5e354]
                    - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f5e355]':
                      - generic [ref=f5e356]:
                        - generic [ref=f5e357]: "Issue incertaine : à vérifier"
                        - link "Traiter dans « Versements à reprendre »" [ref=f5e358] [cursor=pointer]:
                          - /url: "#versements-a-reprendre"
                  - row [ref=f5e359]:
                    - cell [ref=f5e360]:
                      - time [ref=f5e361]: sam. 21 nov. 2026 à 03:11
                    - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e362]:
                      - generic [ref=f5e363]:
                        - generic [ref=f5e364]: Remboursement d’une annulation
                        - generic [ref=f5e365]: Croisière musicale vers Gorée
                    - cell "Pape L. · 70*****10" [ref=f5e366]
                    - cell "9 450 F CFA" [ref=f5e367]
                    - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f5e368]':
                      - generic [ref=f5e369]:
                        - generic [ref=f5e370]: "Issue incertaine : à vérifier"
                        - link "Traiter dans « Versements à reprendre »" [ref=f5e371] [cursor=pointer]:
                          - /url: "#versements-a-reprendre"
          - region [ref=f5e372]:
            - generic [ref=f5e373]:
              - heading "Créances" [level=2] [ref=f5e374]
              - paragraph [ref=f5e375]: Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ; ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
            - generic [ref=f5e376]:
              - heading "Aucune créance" [level=3] [ref=f5e381]
              - paragraph [ref=f5e382]: Personne ne doit d’argent à Event Village.
          - region [ref=f5e383]:
            - generic [ref=f5e384]:
              - heading "Détail de ce qui a été gagné" [level=2] [ref=f5e385]
              - paragraph [ref=f5e386]: "Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés du 1er au 21 novembre 2026."
            - generic [ref=f5e387]:
              - generic [ref=f5e388]:
                - term [ref=f5e389]:
                  - generic [ref=f5e390]: Frais de service, moins les frais d’encaissement SamirPay
                  - generic [ref=f5e391]: "133 paiements encaissés du 1er au 21 novembre 2026 : 94 950 F CFA de frais de service, 29 909,28 F CFA de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas)."
                - definition [ref=f5e392]: + 65 040,72 F CFA
              - generic [ref=f5e393]:
                - term [ref=f5e394]:
                  - generic [ref=f5e395]: Part rendue avec les remboursements
                  - generic [ref=f5e396]: Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.
                - definition [ref=f5e397]: − 7 500 F CFA
              - generic [ref=f5e398]:
                - term [ref=f5e399]:
                  - generic [ref=f5e400]: Frais de retrait
                  - generic [ref=f5e401]: 0 retrait versé du 1er au 21 novembre 2026.
                - definition [ref=f5e402]: + 0 F CFA
              - generic [ref=f5e403]:
                - term [ref=f5e404]:
                  - generic [ref=f5e405]: Frais SamirPay des versements
                  - generic [ref=f5e406]: Frais réels de 0 versement confirmé du 1er au 21 novembre 2026 (remboursements et retraits).
                - definition [ref=f5e407]: − 0 F CFA
              - generic [ref=f5e408]:
                - term [ref=f5e409]:
                  - generic [ref=f5e410]: Commissions de parrainage
                  - generic [ref=f5e411]: Sur les paiements encaissés de la période, annulations et reprises déduites.
                - definition [ref=f5e412]: − 0 F CFA
              - generic [ref=f5e413]:
                - term [ref=f5e414]:
                  - generic [ref=f5e415]: Gagné par Event Village
                - definition [ref=f5e416]: 57 540,72 F CFA
          - region [ref=f5e417]:
            - generic [ref=f5e418]:
              - heading "Dû aux partenaires" [level=2] [ref=f5e419]
              - paragraph [ref=f5e420]: L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
            - generic [ref=f5e421]:
              - generic [ref=f5e422]:
                - term [ref=f5e423]:
                  - generic [ref=f5e424]: Disponible pour les partenaires
                  - generic [ref=f5e425]: Dont 0 F CFA retirables tout de suite et 0 F CFA gelés (événements suspendus, libérés à la reprise).
                - definition [ref=f5e426]: 0 F CFA
              - generic [ref=f5e427]:
                - term [ref=f5e428]:
                  - generic [ref=f5e429]: En attente de la fin des événements
                - definition [ref=f5e430]: 1 749 000 F CFA
              - generic [ref=f5e431]:
                - term [ref=f5e432]:
                  - generic [ref=f5e433]: Retraits en cours d’envoi
                  - generic [ref=f5e434]: Demandés par les partenaires, pas encore confirmés par SamirPay.
                - definition [ref=f5e435]: 0 F CFA
              - generic [ref=f5e436]:
                - term [ref=f5e437]:
                  - generic [ref=f5e438]: Dû aux partenaires
                - definition [ref=f5e439]: 1 749 000 F CFA
            - region "Dû aux partenaires, compte par compte" [ref=f5e441]:
              - table [ref=f5e442]:
                - caption [ref=f5e443]: Dû aux partenaires, compte par compte
                - rowgroup [ref=f5e444]:
                  - row [ref=f5e445]:
                    - columnheader "Partenaire" [ref=f5e446]
                    - columnheader "Dû" [ref=f5e447]
                    - columnheader "Retirable aujourd’hui" [ref=f5e448]
                    - columnheader "En attente" [ref=f5e449]
                    - columnheader "Gelé" [ref=f5e450]
                    - columnheader "Retrait en cours" [ref=f5e451]
                - rowgroup [ref=f5e452]:
                  - row [ref=f5e453]:
                    - cell "Baobab Scène Productions" [ref=f5e454]
                    - cell "828 000 F CFA" [ref=f5e455]
                    - cell "0 F CFA" [ref=f5e456]
                    - cell "828 000 F CFA" [ref=f5e457]
                    - cell "0 F CFA" [ref=f5e458]
                    - cell "0 F CFA" [ref=f5e459]
                  - row [ref=f5e460]:
                    - cell "Sine-Saloum Culture & Loisirs" [ref=f5e461]
                    - cell "806 000 F CFA" [ref=f5e462]
                    - cell "0 F CFA" [ref=f5e463]
                    - cell "806 000 F CFA" [ref=f5e464]
                    - cell "0 F CFA" [ref=f5e465]
                    - cell "0 F CFA" [ref=f5e466]
                  - row [ref=f5e467]:
                    - cell "Atelier Petite-Côte" [ref=f5e468]
                    - cell "115 000 F CFA" [ref=f5e469]
                    - cell "0 F CFA" [ref=f5e470]
                    - cell "115 000 F CFA" [ref=f5e471]
                    - cell "0 F CFA" [ref=f5e472]
                    - cell "0 F CFA" [ref=f5e473]
            - generic [ref=f5e474]:
              - heading "Dû aux parrains" [level=3] [ref=f5e475]
              - paragraph [ref=f5e476]: "Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village. Total : 0 F CFA."
              - generic [ref=f5e477]:
                - heading "Rien n’est dû aux parrains" [level=3] [ref=f5e484]
                - paragraph [ref=f5e485]: Aucun solde à verser pour le moment.
          - region [ref=f5e486]:
            - generic [ref=f5e487]:
              - heading "Calcul de ce qui est retirable" [level=2] [ref=f5e488]
              - paragraph [ref=f5e489]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. Si ce chiffre est à 0, ne retirez rien.
            - generic [ref=f5e490]:
              - generic [ref=f5e491]:
                - term [ref=f5e492]:
                  - generic [ref=f5e493]: Solde du compte SamirPay
                  - generic [ref=f5e494]:
                    - text: Lu à
                    - time [ref=f5e495]: 03:19
                    - text: (heure de Dakar), relu au plus toutes les 5 minutes.
                - definition [ref=f5e496]: 50 000 000 F CFA
              - generic [ref=f5e497]:
                - term [ref=f5e498]:
                  - generic [ref=f5e499]: Dû aux partenaires
                - definition [ref=f5e500]: − 1 749 000 F CFA
              - generic [ref=f5e501]:
                - term [ref=f5e502]:
                  - generic [ref=f5e503]: Dû aux parrains
                - definition [ref=f5e504]: − 0 F CFA
              - generic [ref=f5e505]:
                - term [ref=f5e506]:
                  - generic [ref=f5e507]: Remboursements à verser
                - definition [ref=f5e508]: − 72 450 F CFA
              - generic [ref=f5e509]:
                - term [ref=f5e510]:
                  - generic [ref=f5e511]: Réserve de prudence
                  - generic [ref=f5e512]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Automatique : les encaissements des 3 derniers jours, soit 996 525 F CFA aujourd’hui."
                - definition [ref=f5e513]: − 996 525 F CFA
              - generic [ref=f5e514]:
                - term [ref=f5e515]:
                  - generic [ref=f5e516]: Retirable par Event Village
                - definition [ref=f5e517]: 47 182 025 F CFA
            - link "Changer la réserve de prudence" [ref=f5e519] [cursor=pointer]:
              - /url: /admin/finance-settings
          - region [ref=f5e521]:
            - generic [ref=f5e522]:
              - heading "Paiements encaissés" [level=2] [ref=f5e523]
              - paragraph [ref=f5e527]: Paiements en ligne encaissés du 1er au 21 novembre 2026. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            - generic [ref=f5e528]:
              - generic [ref=f5e529]: Statut
              - combobox "Statut" [ref=f5e532] [cursor=pointer]:
                - option "Tous les paiements" [selected]
                - option "Payé"
                - option "Remboursé en partie"
                - option "Remboursement en cours"
                - option "Remboursé"
            - region "Paiements encaissés" [ref=f5e534]:
              - table [ref=f5e535]:
                - caption [ref=f5e536]: Paiements encaissés
                - rowgroup [ref=f5e537]:
                  - row [ref=f5e538]:
                    - columnheader "Encaissé le" [ref=f5e539]
                    - columnheader "Référence" [ref=f5e540]
                    - columnheader "Objet" [ref=f5e541]
                    - columnheader "Payé" [ref=f5e542]
                    - columnheader "Frais de service" [ref=f5e543]
                    - columnheader "Pour Event Village" [ref=f5e544]
                    - columnheader "Statut" [ref=f5e545]
                - rowgroup [ref=f5e546]:
                  - row [ref=f5e547]:
                    - cell [ref=f5e548]:
                      - time [ref=f5e549]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 8F4D71EF" [ref=f5e550]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f5e551]:
                      - generic [ref=f5e552]:
                        - generic [ref=f5e553]: Billets
                        - generic [ref=f5e554]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f5e555]
                    - cell "450 F CFA" [ref=f5e556]
                    - cell "308,25 F CFA" [ref=f5e557]
                    - cell "Payé" [ref=f5e558]
                  - row [ref=f5e562]:
                    - cell [ref=f5e563]:
                      - time [ref=f5e564]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 0106DE2D" [ref=f5e565]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f5e566]:
                      - generic [ref=f5e567]:
                        - generic [ref=f5e568]: Billets
                        - generic [ref=f5e569]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f5e570]
                    - cell "450 F CFA" [ref=f5e571]
                    - cell "308,25 F CFA" [ref=f5e572]
                    - cell "Payé" [ref=f5e573]
                  - row [ref=f5e577]:
                    - cell [ref=f5e578]:
                      - time [ref=f5e579]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 2C9D9D98" [ref=f5e580]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f5e581]:
                      - generic [ref=f5e582]:
                        - generic [ref=f5e583]: Billets
                        - generic [ref=f5e584]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f5e585]
                    - cell "450 F CFA" [ref=f5e586]
                    - cell "308,25 F CFA" [ref=f5e587]
                    - cell "Payé" [ref=f5e588]
                  - row [ref=f5e592]:
                    - cell [ref=f5e593]:
                      - time [ref=f5e594]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 13CF901E" [ref=f5e595]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f5e596]:
                      - generic [ref=f5e597]:
                        - generic [ref=f5e598]: Billets
                        - generic [ref=f5e599]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f5e600]
                    - cell "450 F CFA" [ref=f5e601]
                    - cell "308,25 F CFA" [ref=f5e602]
                    - cell "Payé" [ref=f5e603]
                  - row [ref=f5e607]:
                    - cell [ref=f5e608]:
                      - time [ref=f5e609]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne 2605BD35" [ref=f5e610]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f5e611]:
                      - generic [ref=f5e612]:
                        - generic [ref=f5e613]: Billets
                        - generic [ref=f5e614]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f5e615]
                    - cell "450 F CFA" [ref=f5e616]
                    - cell "308,25 F CFA" [ref=f5e617]
                    - cell "Payé" [ref=f5e618]
                  - row [ref=f5e622]:
                    - cell [ref=f5e623]:
                      - time [ref=f5e624]: sam. 21 nov. 2026 à 03:11
                    - cell "Réf. interne B62DC4A3" [ref=f5e625]
                    - cell "Billets Nuit du slam de Kaolack" [ref=f5e626]:
                      - generic [ref=f5e627]:
                        - generic [ref=f5e628]: Billets
                        - generic [ref=f5e629]: Nuit du slam de Kaolack
                    - cell "9 450 F CFA" [ref=f5e630]
                    - cell "450 F CFA" [ref=f5e631]
                    - cell "308,25 F CFA" [ref=f5e632]
                    - cell "Payé" [ref=f5e633]
                  - row [ref=f5e637]:
                    - cell [ref=f5e638]:
                      - time [ref=f5e639]: sam. 21 nov. 2026 à 03:10
                    - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-BIS-B-1" [ref=f5e640]
                    - cell "Billets" [ref=f5e641]
                    - cell "4 000 F CFA" [ref=f5e644]
                    - cell "0 F CFA" [ref=f5e645]
                    - cell "0 F CFA" [ref=f5e646]
                    - cell "Payé" [ref=f5e647]
                  - row [ref=f5e651]:
                    - cell [ref=f5e652]:
                      - time [ref=f5e653]: sam. 21 nov. 2026 à 03:10
                    - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-A-1" [ref=f5e654]
                    - cell "Billets" [ref=f5e655]
                    - cell "5 000 F CFA" [ref=f5e658]
                    - cell "0 F CFA" [ref=f5e659]
                    - cell "0 F CFA" [ref=f5e660]
                    - cell "Payé" [ref=f5e661]
                  - row [ref=f5e665]:
                    - cell [ref=f5e666]:
                      - time [ref=f5e667]: sam. 21 nov. 2026 à 02:12
                    - cell "Réf. interne 4CEE00B1" [ref=f5e668]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=f5e669]:
                      - generic [ref=f5e670]:
                        - generic [ref=f5e671]: Billets
                        - generic [ref=f5e672]: Nuit du Sabar — édition d’automne
                    - cell "6 300 F CFA" [ref=f5e673]
                    - cell "300 F CFA" [ref=f5e674]
                    - cell "205,5 F CFA" [ref=f5e675]
                    - cell "Payé" [ref=f5e676]
                  - row [ref=f5e680]:
                    - cell [ref=f5e681]:
                      - time [ref=f5e682]: sam. 21 nov. 2026 à 01:58
                    - cell "Réf. interne BE64B57B" [ref=f5e683]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=f5e684]:
                      - generic [ref=f5e685]:
                        - generic [ref=f5e686]: Billets
                        - generic [ref=f5e687]: Nuit du Sabar — édition d’automne
                    - cell "3 150 F CFA" [ref=f5e688]
                    - cell "150 F CFA" [ref=f5e689]
                    - cell "102,75 F CFA" [ref=f5e690]
                    - cell "Payé" [ref=f5e691]
                  - row [ref=f5e695]:
                    - cell [ref=f5e696]:
                      - time [ref=f5e697]: sam. 21 nov. 2026 à 01:44
                    - cell "Réf. interne 0DACB56F" [ref=f5e698]
                    - cell "Billets Rencontres du conte et de la parole" [ref=f5e699]:
                      - generic [ref=f5e700]:
                        - generic [ref=f5e701]: Billets
                        - generic [ref=f5e702]: Rencontres du conte et de la parole
                    - cell "3 150 F CFA" [ref=f5e703]
                    - cell "150 F CFA" [ref=f5e704]
                    - cell "102,75 F CFA" [ref=f5e705]
                    - cell "Payé" [ref=f5e706]
                  - row [ref=f5e710]:
                    - cell [ref=f5e711]:
                      - time [ref=f5e712]: sam. 21 nov. 2026 à 01:10
                    - cell "Réf. interne 73A0D3FA" [ref=f5e713]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=f5e714]:
                      - generic [ref=f5e715]:
                        - generic [ref=f5e716]: Billets
                        - generic [ref=f5e717]: Marché gourmand de la Petite-Côte
                    - cell "5 250 F CFA" [ref=f5e718]
                    - cell "250 F CFA" [ref=f5e719]
                    - cell "171,25 F CFA" [ref=f5e720]
                    - cell "Payé" [ref=f5e721]
                  - row [ref=f5e725]:
                    - cell [ref=f5e726]:
                      - time [ref=f5e727]: sam. 21 nov. 2026 à 01:00
                    - cell "Réf. interne 745C6B46" [ref=f5e728]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=f5e729]:
                      - generic [ref=f5e730]:
                        - generic [ref=f5e731]: Billets
                        - generic [ref=f5e732]: Marché gourmand de la Petite-Côte
                    - cell "4 200 F CFA" [ref=f5e733]
                    - cell "200 F CFA" [ref=f5e734]
                    - cell "137 F CFA" [ref=f5e735]
                    - cell "Payé" [ref=f5e736]
                  - row [ref=f5e740]:
                    - cell [ref=f5e741]:
                      - time [ref=f5e742]: sam. 21 nov. 2026 à 00:12
                    - cell "Réf. interne E698F509" [ref=f5e743]
                    - cell "Billets Festival Jazz sur le Fleuve" [ref=f5e744]:
                      - generic [ref=f5e745]:
                        - generic [ref=f5e746]: Billets
                        - generic [ref=f5e747]: Festival Jazz sur le Fleuve
                    - cell "15 750 F CFA" [ref=f5e748]
                    - cell "750 F CFA" [ref=f5e749]
                    - cell "513,75 F CFA" [ref=f5e750]
                    - cell "Payé" [ref=f5e751]
                  - row [ref=f5e755]:
                    - cell [ref=f5e756]:
                      - time [ref=f5e757]: ven. 20 nov. 2026 à 23:55
                    - cell "Réf. interne 50190DCF" [ref=f5e758]
                    - cell "Billets Croisière musicale vers Gorée" [ref=f5e759]:
                      - generic [ref=f5e760]:
                        - generic [ref=f5e761]: Billets
                        - generic [ref=f5e762]: Croisière musicale vers Gorée
                    - cell "31 500 F CFA" [ref=f5e763]
                    - cell "1 500 F CFA" [ref=f5e764]
                    - cell "-472,5 F CFA" [ref=f5e765]
                    - cell "Payé" [ref=f5e766]
                  - row [ref=f5e770]:
                    - cell [ref=f5e771]:
                      - time [ref=f5e772]: ven. 20 nov. 2026 à 23:32
                    - cell "Réf. interne 3E9CD036" [ref=f5e773]
                    - cell "Billets Marché gourmand de la Petite-Côte" [ref=f5e774]:
                      - generic [ref=f5e775]:
                        - generic [ref=f5e776]: Billets
                        - generic [ref=f5e777]: Marché gourmand de la Petite-Côte
                    - cell "10 500 F CFA" [ref=f5e778]
                    - cell "500 F CFA" [ref=f5e779]
                    - cell "342,5 F CFA" [ref=f5e780]
                    - cell "Payé" [ref=f5e781]
                  - row [ref=f5e785]:
                    - cell [ref=f5e786]:
                      - time [ref=f5e787]: ven. 20 nov. 2026 à 23:31
                    - cell "Réf. interne BDD39B0D" [ref=f5e788]
                    - cell "Billets Dîner-spectacle au bord du Saloum" [ref=f5e789]:
                      - generic [ref=f5e790]:
                        - generic [ref=f5e791]: Billets
                        - generic [ref=f5e792]: Dîner-spectacle au bord du Saloum
                    - cell "52 500 F CFA" [ref=f5e793]
                    - cell "2 500 F CFA" [ref=f5e794]
                    - cell "1 712,5 F CFA" [ref=f5e795]
                    - cell "Payé" [ref=f5e796]
                  - row [ref=f5e800]:
                    - cell [ref=f5e801]:
                      - time [ref=f5e802]: ven. 20 nov. 2026 à 22:58
                    - cell "Réf. interne 61B53DB7" [ref=f5e803]
                    - cell "Billets Croisière musicale vers Gorée" [ref=f5e804]:
                      - generic [ref=f5e805]:
                        - generic [ref=f5e806]: Billets
                        - generic [ref=f5e807]: Croisière musicale vers Gorée
                    - cell "15 750 F CFA" [ref=f5e808]
                    - cell "750 F CFA" [ref=f5e809]
                    - cell "-236,25 F CFA" [ref=f5e810]
                    - cell "Remboursé" [ref=f5e811]
                  - row [ref=f5e815]:
                    - cell [ref=f5e816]:
                      - time [ref=f5e817]: ven. 20 nov. 2026 à 22:42
                    - cell "Réf. interne 37D92D28" [ref=f5e818]
                    - cell "Billets Nuit du Sabar — édition d’automne" [ref=f5e819]:
                      - generic [ref=f5e820]:
                        - generic [ref=f5e821]: Billets
                        - generic [ref=f5e822]: Nuit du Sabar — édition d’automne
                    - cell "15 750 F CFA" [ref=f5e823]
                    - cell "750 F CFA" [ref=f5e824]
                    - cell "513,75 F CFA" [ref=f5e825]
                    - cell "Payé" [ref=f5e826]
                  - row [ref=f5e830]:
                    - cell [ref=f5e831]:
                      - time [ref=f5e832]: ven. 20 nov. 2026 à 22:40
                    - cell "Réf. interne 7CE7C555" [ref=f5e833]
                    - cell "Billets Carnaval des enfants de Saly" [ref=f5e834]:
                      - generic [ref=f5e835]:
                        - generic [ref=f5e836]: Billets
                        - generic [ref=f5e837]: Carnaval des enfants de Saly
                    - cell "4 200 F CFA" [ref=f5e838]
                    - cell "200 F CFA" [ref=f5e839]
                    - cell "137 F CFA" [ref=f5e840]
                    - cell "Payé" [ref=f5e841]
            - navigation "Pages des paiements" [ref=f5e845]:
              - button "Précédent" [disabled] [ref=f5e846]
              - paragraph [ref=f5e851]:
                - text: Page 1 sur 7
                - generic [ref=f5e852]: · 133 résultats
              - button "Suivant" [ref=f5e853] [cursor=pointer]
  - alert [ref=f5e858]
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
      |                                                                                        ^ Error: contrôles responsive de adm-finance (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```