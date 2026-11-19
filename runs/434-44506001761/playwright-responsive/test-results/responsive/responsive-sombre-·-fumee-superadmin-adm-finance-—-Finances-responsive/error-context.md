# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-finance — Finances
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-finance (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 9

- Array []
+ Array [
+   "360 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Reprise » de 741 à 792 px (fenêtre 768 px) ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » de 741 à 914 px (fenêtre 768 px) ; span.min-w-0 « Marquer versé » de 778 à 876 px (fenêtre 768 px) ; span.min-w-0 « Constater non versé » de 778 à 917 px (fenêtre 768 px) ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » de 741 à 914 px (fenêtre 768 px) ; span.min-w-0 « Marquer versé » de 778 à 876 px (fenêtre 768 px) ; span.min-w-0 « Constater non versé » de 778 à 917 px (fenêtre 768 px) ; span « Remboursé » de 730 à 796 px (fenêtre 768 px) ; span « Remboursé » de 730 à 796 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Reprise » dépasse de div.hidden.overflow-hidden «  » ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Marquer versé » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Constater non versé » dépasse de div.hidden.overflow-hidden «  » ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Marquer versé » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Constater non versé » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Statut » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+   "1440 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
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
          - generic [ref=f2e140]:
            - generic [ref=f2e141]:
              - heading "Finance" [level=1] [ref=f2e142]
              - paragraph [ref=f2e143]: Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay.
            - link "Réglages de la plateforme" [ref=f2e145] [cursor=pointer]:
              - /url: /admin/finance-settings
          - group [ref=f2e151]:
            - heading "Période" [level=2] [ref=f2e155]
            - generic [ref=f2e157]:
              - generic [ref=f2e158]: Afficher
              - combobox "Afficher" [ref=f2e161] [cursor=pointer]:
                - option "Aujourd’hui"
                - option "7 derniers jours"
                - option "30 derniers jours"
                - option "Ce mois-ci" [selected]
                - option "Mois dernier"
                - option "Dates choisies…"
            - paragraph [ref=f2e162]: "Période affichée : du 1er au 19 novembre 2026. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant."
          - generic [ref=f2e163]:
            - region [ref=f2e164]:
              - heading "Gagné par Event Village" [level=2] [ref=f2e166]
              - paragraph [ref=f2e171]: 57 335,22 F CFA
              - paragraph [ref=f2e172]: "Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
              - paragraph [ref=f2e173]: Paiements encaissés, retraits versés et versements confirmés du 1er au 19 novembre 2026.
              - link "Voir le détail" [ref=f2e174] [cursor=pointer]:
                - /url: "#detail-gagne"
            - region [ref=f2e175]:
              - heading "Dû aux partenaires" [level=2] [ref=f2e177]
              - paragraph [ref=f2e182]: 1 749 000 F CFA
              - paragraph [ref=f2e183]: "L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
              - paragraph [ref=f2e184]: "Dont 0 F CFA retirables aujourd’hui. Dû aux parrains : 0 F CFA. À l’instant."
              - link "Voir le détail" [ref=f2e185] [cursor=pointer]:
                - /url: "#du-aux-partenaires"
            - region [ref=f2e186]:
              - heading "Retirable par Event Village" [level=2] [ref=f2e188]
              - paragraph [ref=f2e192]: 47 188 325 F CFA
              - paragraph [ref=f2e193]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
              - paragraph [ref=f2e194]:
                - text: Solde SamirPay lu à
                - time [ref=f2e195]: 10:41
                - text: ", moins tout ce qui est dû et la réserve de prudence."
              - link "Voir le calcul" [ref=f2e196] [cursor=pointer]:
                - /url: "#calcul-retirable"
            - region [ref=f2e197]:
              - heading "Créances" [level=2] [ref=f2e199]
              - paragraph [ref=f2e205]: 0 F CFA
              - paragraph [ref=f2e206]: Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre.
              - paragraph [ref=f2e207]: Aucune créance à l’instant.
              - link "Voir les créances" [ref=f2e208] [cursor=pointer]:
                - /url: "#creances"
          - region [ref=f2e210]:
            - generic [ref=f2e211]:
              - heading "Versements à reprendre" [level=2] [ref=f2e212]
              - paragraph [ref=f2e213]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - table [ref=f2e216]:
              - caption [ref=f2e217]: Versements à reprendre
              - rowgroup [ref=f2e218]:
                - row [ref=f2e219]:
                  - columnheader "Montant" [ref=f2e220]
                  - columnheader "Versement" [ref=f2e221]
                  - columnheader "Bénéficiaire" [ref=f2e222]
                  - columnheader "État" [ref=f2e223]
                  - columnheader "Depuis le" [ref=f2e224]
                  - columnheader "Reprise" [ref=f2e225]
              - rowgroup [ref=f2e226]:
                - row [ref=f2e227]:
                  - cell "31 500 F CFA" [ref=f2e228]
                  - cell [ref=f2e229]:
                    - generic [ref=f2e230]:
                      - paragraph [ref=f2e231]: Remboursement d’une annulation
                      - paragraph [ref=f2e232]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f2e233]
                  - cell "Issue incertaine" [ref=f2e234]
                  - cell [ref=f2e238]:
                    - time [ref=f2e239]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f2e240]:
                    - generic [ref=f2e241]:
                      - paragraph [ref=f2e242]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                      - generic [ref=f2e243]:
                        - button "Marquer versé le versement de 31 500 F CFA" [ref=f2e244] [cursor=pointer]:
                          - generic [ref=f2e249]: Marquer versé
                        - button "Constater non versé le versement de 31 500 F CFA" [ref=f2e250] [cursor=pointer]:
                          - generic [ref=f2e255]: Constater non versé
                - row [ref=f2e256]:
                  - cell "9 450 F CFA" [ref=f2e257]
                  - cell [ref=f2e258]:
                    - generic [ref=f2e259]:
                      - paragraph [ref=f2e260]: Remboursement d’une annulation
                      - paragraph [ref=f2e261]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f2e262]
                  - cell "Issue incertaine" [ref=f2e263]
                  - cell [ref=f2e267]:
                    - time [ref=f2e268]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f2e269]:
                    - generic [ref=f2e270]:
                      - paragraph [ref=f2e271]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                      - generic [ref=f2e272]:
                        - button "Marquer versé le versement de 9 450 F CFA" [ref=f2e273] [cursor=pointer]:
                          - generic [ref=f2e278]: Marquer versé
                        - button "Constater non versé le versement de 9 450 F CFA" [ref=f2e279] [cursor=pointer]:
                          - generic [ref=f2e284]: Constater non versé
          - region [ref=f2e285]:
            - generic [ref=f2e286]:
              - heading "Remboursements à verser" [level=2] [ref=f2e287]
              - paragraph [ref=f2e288]: Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
              - paragraph [ref=f2e289]: 4 remboursements pour 66 150 F CFA.
            - table [ref=f2e292]:
              - caption [ref=f2e293]: Remboursements à verser
              - rowgroup [ref=f2e294]:
                - row [ref=f2e295]:
                  - columnheader "Demandé le" [ref=f2e296]
                  - columnheader "Remboursement" [ref=f2e297]
                  - columnheader "Client" [ref=f2e298]
                  - columnheader "Montant" [ref=f2e299]
                  - columnheader "Où il en est" [ref=f2e300]
              - rowgroup [ref=f2e301]:
                - row [ref=f2e302]:
                  - cell [ref=f2e303]:
                    - time [ref=f2e304]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e305]:
                    - generic [ref=f2e306]:
                      - generic [ref=f2e307]: Remboursement d’une annulation
                      - generic [ref=f2e308]: Croisière musicale vers Gorée
                  - cell "Modou M. · 70*****18" [ref=f2e309]
                  - cell "15 750 F CFA" [ref=f2e310]
                  - cell "Envoyé, en attente de confirmation" [ref=f2e311]
                - row [ref=f2e314]:
                  - cell [ref=f2e315]:
                    - time [ref=f2e316]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e317]:
                    - generic [ref=f2e318]:
                      - generic [ref=f2e319]: Remboursement d’une annulation
                      - generic [ref=f2e320]: Croisière musicale vers Gorée
                  - cell "Astou S. · 70*****15" [ref=f2e321]
                  - cell "9 450 F CFA" [ref=f2e322]
                  - cell "Envoyé, en attente de confirmation" [ref=f2e323]
                - row [ref=f2e326]:
                  - cell [ref=f2e327]:
                    - time [ref=f2e328]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e329]:
                    - generic [ref=f2e330]:
                      - generic [ref=f2e331]: Remboursement d’une annulation
                      - generic [ref=f2e332]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f2e333]
                  - cell "31 500 F CFA" [ref=f2e334]
                  - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f2e335]':
                    - generic [ref=f2e336]:
                      - generic [ref=f2e337]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=f2e338] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
                - row [ref=f2e339]:
                  - cell [ref=f2e340]:
                    - time [ref=f2e341]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f2e342]:
                    - generic [ref=f2e343]:
                      - generic [ref=f2e344]: Remboursement d’une annulation
                      - generic [ref=f2e345]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f2e346]
                  - cell "9 450 F CFA" [ref=f2e347]
                  - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f2e348]':
                    - generic [ref=f2e349]:
                      - generic [ref=f2e350]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=f2e351] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
          - region [ref=f2e352]:
            - generic [ref=f2e353]:
              - heading "Créances" [level=2] [ref=f2e354]
              - paragraph [ref=f2e355]: Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ; ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
            - generic [ref=f2e356]:
              - heading "Aucune créance" [level=3] [ref=f2e361]
              - paragraph [ref=f2e362]: Personne ne doit d’argent à Event Village.
          - region [ref=f2e363]:
            - generic [ref=f2e364]:
              - heading "Détail de ce qui a été gagné" [level=2] [ref=f2e365]
              - paragraph [ref=f2e366]: "Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés du 1er au 19 novembre 2026."
            - generic [ref=f2e367]:
              - generic [ref=f2e368]:
                - term [ref=f2e369]:
                  - generic [ref=f2e370]: Frais de service, moins les frais d’encaissement SamirPay
                  - generic [ref=f2e371]: "132 paiements encaissés du 1er au 19 novembre 2026 : 94 650 F CFA de frais de service, 29 814,78 F CFA de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas)."
                - definition [ref=f2e372]: + 64 835,22 F CFA
              - generic [ref=f2e373]:
                - term [ref=f2e374]:
                  - generic [ref=f2e375]: Part rendue avec les remboursements
                  - generic [ref=f2e376]: Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.
                - definition [ref=f2e377]: − 7 500 F CFA
              - generic [ref=f2e378]:
                - term [ref=f2e379]:
                  - generic [ref=f2e380]: Frais de retrait
                  - generic [ref=f2e381]: 0 retrait versé du 1er au 19 novembre 2026.
                - definition [ref=f2e382]: + 0 F CFA
              - generic [ref=f2e383]:
                - term [ref=f2e384]:
                  - generic [ref=f2e385]: Frais SamirPay des versements
                  - generic [ref=f2e386]: Frais réels de 0 versement confirmé du 1er au 19 novembre 2026 (remboursements et retraits).
                - definition [ref=f2e387]: − 0 F CFA
              - generic [ref=f2e388]:
                - term [ref=f2e389]:
                  - generic [ref=f2e390]: Commissions de parrainage
                  - generic [ref=f2e391]: Sur les paiements encaissés de la période, annulations et reprises déduites.
                - definition [ref=f2e392]: − 0 F CFA
              - generic [ref=f2e393]:
                - term [ref=f2e394]:
                  - generic [ref=f2e395]: Gagné par Event Village
                - definition [ref=f2e396]: 57 335,22 F CFA
          - region [ref=f2e397]:
            - generic [ref=f2e398]:
              - heading "Dû aux partenaires" [level=2] [ref=f2e399]
              - paragraph [ref=f2e400]: L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
            - generic [ref=f2e401]:
              - generic [ref=f2e402]:
                - term [ref=f2e403]:
                  - generic [ref=f2e404]: Disponible pour les partenaires
                  - generic [ref=f2e405]: Dont 0 F CFA retirables tout de suite et 0 F CFA gelés (événements suspendus, libérés à la reprise).
                - definition [ref=f2e406]: 0 F CFA
              - generic [ref=f2e407]:
                - term [ref=f2e408]:
                  - generic [ref=f2e409]: En attente de la fin des événements
                - definition [ref=f2e410]: 1 749 000 F CFA
              - generic [ref=f2e411]:
                - term [ref=f2e412]:
                  - generic [ref=f2e413]: Retraits en cours d’envoi
                  - generic [ref=f2e414]: Demandés par les partenaires, pas encore confirmés par SamirPay.
                - definition [ref=f2e415]: 0 F CFA
              - generic [ref=f2e416]:
                - term [ref=f2e417]:
                  - generic [ref=f2e418]: Dû aux partenaires
                - definition [ref=f2e419]: 1 749 000 F CFA
            - table [ref=f2e422]:
              - caption [ref=f2e423]: Dû aux partenaires, compte par compte
              - rowgroup [ref=f2e424]:
                - row [ref=f2e425]:
                  - columnheader "Partenaire" [ref=f2e426]
                  - columnheader "Dû" [ref=f2e427]
                  - columnheader "Retirable aujourd’hui" [ref=f2e428]
                  - columnheader "En attente" [ref=f2e429]
                  - columnheader "Gelé" [ref=f2e430]
                  - columnheader "Retrait en cours" [ref=f2e431]
              - rowgroup [ref=f2e432]:
                - row [ref=f2e433]:
                  - cell "Baobab Scène Productions" [ref=f2e434]
                  - cell "828 000 F CFA" [ref=f2e435]
                  - cell "0 F CFA" [ref=f2e436]
                  - cell "828 000 F CFA" [ref=f2e437]
                  - cell "0 F CFA" [ref=f2e438]
                  - cell "0 F CFA" [ref=f2e439]
                - row [ref=f2e440]:
                  - cell "Sine-Saloum Culture & Loisirs" [ref=f2e441]
                  - cell "806 000 F CFA" [ref=f2e442]
                  - cell "0 F CFA" [ref=f2e443]
                  - cell "806 000 F CFA" [ref=f2e444]
                  - cell "0 F CFA" [ref=f2e445]
                  - cell "0 F CFA" [ref=f2e446]
                - row [ref=f2e447]:
                  - cell "Atelier Petite-Côte" [ref=f2e448]
                  - cell "115 000 F CFA" [ref=f2e449]
                  - cell "0 F CFA" [ref=f2e450]
                  - cell "115 000 F CFA" [ref=f2e451]
                  - cell "0 F CFA" [ref=f2e452]
                  - cell "0 F CFA" [ref=f2e453]
            - generic [ref=f2e454]:
              - heading "Dû aux parrains" [level=3] [ref=f2e455]
              - paragraph [ref=f2e456]: "Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village. Total : 0 F CFA."
              - generic [ref=f2e457]:
                - heading "Rien n’est dû aux parrains" [level=3] [ref=f2e464]
                - paragraph [ref=f2e465]: Aucun solde à verser pour le moment.
          - region [ref=f2e466]:
            - generic [ref=f2e467]:
              - heading "Calcul de ce qui est retirable" [level=2] [ref=f2e468]
              - paragraph [ref=f2e469]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. Si ce chiffre est à 0, ne retirez rien.
            - generic [ref=f2e470]:
              - generic [ref=f2e471]:
                - term [ref=f2e472]:
                  - generic [ref=f2e473]: Solde du compte SamirPay
                  - generic [ref=f2e474]:
                    - text: Lu à
                    - time [ref=f2e475]: 10:41
                    - text: (heure de Dakar), relu au plus toutes les 5 minutes.
                - definition [ref=f2e476]: 50 000 000 F CFA
              - generic [ref=f2e477]:
                - term [ref=f2e478]:
                  - generic [ref=f2e479]: Dû aux partenaires
                - definition [ref=f2e480]: − 1 749 000 F CFA
              - generic [ref=f2e481]:
                - term [ref=f2e482]:
                  - generic [ref=f2e483]: Dû aux parrains
                - definition [ref=f2e484]: − 0 F CFA
              - generic [ref=f2e485]:
                - term [ref=f2e486]:
                  - generic [ref=f2e487]: Remboursements à verser
                - definition [ref=f2e488]: − 66 150 F CFA
              - generic [ref=f2e489]:
                - term [ref=f2e490]:
                  - generic [ref=f2e491]: Réserve de prudence
                  - generic [ref=f2e492]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Automatique : les encaissements des 3 derniers jours, soit 996 525 F CFA aujourd’hui."
                - definition [ref=f2e493]: − 996 525 F CFA
              - generic [ref=f2e494]:
                - term [ref=f2e495]:
                  - generic [ref=f2e496]: Retirable par Event Village
                - definition [ref=f2e497]: 47 188 325 F CFA
            - link "Changer la réserve de prudence" [ref=f2e499] [cursor=pointer]:
              - /url: /admin/finance-settings
          - region [ref=f2e501]:
            - generic [ref=f2e502]:
              - heading "Paiements encaissés" [level=2] [ref=f2e503]
              - paragraph [ref=f2e507]: Paiements en ligne encaissés du 1er au 19 novembre 2026. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            - generic [ref=f2e508]:
              - generic [ref=f2e509]: Statut
              - combobox "Statut" [ref=f2e512] [cursor=pointer]:
                - option "Tous les paiements" [selected]
                - option "Payé"
                - option "Remboursé en partie"
                - option "Remboursement en cours"
                - option "Remboursé"
            - table [ref=f2e515]:
              - caption [ref=f2e516]: Paiements encaissés
              - rowgroup [ref=f2e517]:
                - row [ref=f2e518]:
                  - columnheader "Encaissé le" [ref=f2e519]
                  - columnheader "Référence" [ref=f2e520]
                  - columnheader "Objet" [ref=f2e521]
                  - columnheader "Payé" [ref=f2e522]
                  - columnheader "Frais de service" [ref=f2e523]
                  - columnheader "Pour Event Village" [ref=f2e524]
                  - columnheader "Statut" [ref=f2e525]
              - rowgroup [ref=f2e526]:
                - row [ref=f2e527]:
                  - cell [ref=f2e528]:
                    - time [ref=f2e529]: jeu. 19 nov. 2026 à 10:34
                  - cell "4e1fccb1-2a59-4759-9712-5899d9c1b656" [ref=f2e530]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f2e531]:
                    - generic [ref=f2e532]:
                      - generic [ref=f2e533]: Billets
                      - generic [ref=f2e534]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f2e535]
                  - cell "450 F CFA" [ref=f2e536]
                  - cell "308,25 F CFA" [ref=f2e537]
                  - cell "Payé" [ref=f2e538]
                - row [ref=f2e542]:
                  - cell [ref=f2e543]:
                    - time [ref=f2e544]: jeu. 19 nov. 2026 à 10:34
                  - cell "ec552fe8-161d-4982-b556-2bb987351625" [ref=f2e545]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f2e546]:
                    - generic [ref=f2e547]:
                      - generic [ref=f2e548]: Billets
                      - generic [ref=f2e549]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f2e550]
                  - cell "450 F CFA" [ref=f2e551]
                  - cell "308,25 F CFA" [ref=f2e552]
                  - cell "Payé" [ref=f2e553]
                - row [ref=f2e557]:
                  - cell [ref=f2e558]:
                    - time [ref=f2e559]: jeu. 19 nov. 2026 à 10:34
                  - cell "cd66ae36-1423-49ce-8aa1-f234de0bc59e" [ref=f2e560]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f2e561]:
                    - generic [ref=f2e562]:
                      - generic [ref=f2e563]: Billets
                      - generic [ref=f2e564]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f2e565]
                  - cell "450 F CFA" [ref=f2e566]
                  - cell "308,25 F CFA" [ref=f2e567]
                  - cell "Payé" [ref=f2e568]
                - row [ref=f2e572]:
                  - cell [ref=f2e573]:
                    - time [ref=f2e574]: jeu. 19 nov. 2026 à 10:34
                  - cell "038ca260-1190-4fc1-80f2-4876ff17a158" [ref=f2e575]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f2e576]:
                    - generic [ref=f2e577]:
                      - generic [ref=f2e578]: Billets
                      - generic [ref=f2e579]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f2e580]
                  - cell "450 F CFA" [ref=f2e581]
                  - cell "308,25 F CFA" [ref=f2e582]
                  - cell "Payé" [ref=f2e583]
                - row [ref=f2e587]:
                  - cell [ref=f2e588]:
                    - time [ref=f2e589]: jeu. 19 nov. 2026 à 10:34
                  - cell "a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4" [ref=f2e590]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f2e591]:
                    - generic [ref=f2e592]:
                      - generic [ref=f2e593]: Billets
                      - generic [ref=f2e594]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f2e595]
                  - cell "450 F CFA" [ref=f2e596]
                  - cell "308,25 F CFA" [ref=f2e597]
                  - cell "Payé" [ref=f2e598]
                - row [ref=f2e602]:
                  - cell [ref=f2e603]:
                    - time [ref=f2e604]: jeu. 19 nov. 2026 à 10:34
                  - cell "9a5a85e4-1e8e-4a4b-89d8-53b28ac42162" [ref=f2e605]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f2e606]:
                    - generic [ref=f2e607]:
                      - generic [ref=f2e608]: Billets
                      - generic [ref=f2e609]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f2e610]
                  - cell "450 F CFA" [ref=f2e611]
                  - cell "308,25 F CFA" [ref=f2e612]
                  - cell "Payé" [ref=f2e613]
                - row [ref=f2e617]:
                  - cell [ref=f2e618]:
                    - time [ref=f2e619]: jeu. 19 nov. 2026 à 10:34
                  - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-BIS-B-1" [ref=f2e620]
                  - cell "Billets" [ref=f2e621]
                  - cell "4 000 F CFA" [ref=f2e624]
                  - cell "0 F CFA" [ref=f2e625]
                  - cell "0 F CFA" [ref=f2e626]
                  - cell "Payé" [ref=f2e627]
                - row [ref=f2e631]:
                  - cell [ref=f2e632]:
                    - time [ref=f2e633]: jeu. 19 nov. 2026 à 10:34
                  - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-A-1" [ref=f2e634]
                  - cell "Billets" [ref=f2e635]
                  - cell "5 000 F CFA" [ref=f2e638]
                  - cell "0 F CFA" [ref=f2e639]
                  - cell "0 F CFA" [ref=f2e640]
                  - cell "Payé" [ref=f2e641]
                - row [ref=f2e645]:
                  - cell [ref=f2e646]:
                    - time [ref=f2e647]: jeu. 19 nov. 2026 à 09:36
                  - cell "67ca89c9-adfc-45d8-b709-b5e2bf10ef32" [ref=f2e648]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=f2e649]:
                    - generic [ref=f2e650]:
                      - generic [ref=f2e651]: Billets
                      - generic [ref=f2e652]: Nuit du Sabar — édition d’automne
                  - cell "6 300 F CFA" [ref=f2e653]
                  - cell "300 F CFA" [ref=f2e654]
                  - cell "205,5 F CFA" [ref=f2e655]
                  - cell "Payé" [ref=f2e656]
                - row [ref=f2e660]:
                  - cell [ref=f2e661]:
                    - time [ref=f2e662]: jeu. 19 nov. 2026 à 09:22
                  - cell "2b8f29c0-728c-4b74-8805-acc2deae0d9a" [ref=f2e663]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=f2e664]:
                    - generic [ref=f2e665]:
                      - generic [ref=f2e666]: Billets
                      - generic [ref=f2e667]: Nuit du Sabar — édition d’automne
                  - cell "3 150 F CFA" [ref=f2e668]
                  - cell "150 F CFA" [ref=f2e669]
                  - cell "102,75 F CFA" [ref=f2e670]
                  - cell "Payé" [ref=f2e671]
                - row [ref=f2e675]:
                  - cell [ref=f2e676]:
                    - time [ref=f2e677]: jeu. 19 nov. 2026 à 09:08
                  - cell "e9c34302-6913-49da-a43d-1b608344e855" [ref=f2e678]
                  - cell "Billets Rencontres du conte et de la parole" [ref=f2e679]:
                    - generic [ref=f2e680]:
                      - generic [ref=f2e681]: Billets
                      - generic [ref=f2e682]: Rencontres du conte et de la parole
                  - cell "3 150 F CFA" [ref=f2e683]
                  - cell "150 F CFA" [ref=f2e684]
                  - cell "102,75 F CFA" [ref=f2e685]
                  - cell "Payé" [ref=f2e686]
                - row [ref=f2e690]:
                  - cell [ref=f2e691]:
                    - time [ref=f2e692]: jeu. 19 nov. 2026 à 08:34
                  - cell "7f4f993b-a821-4566-bbdf-b442b633df80" [ref=f2e693]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=f2e694]:
                    - generic [ref=f2e695]:
                      - generic [ref=f2e696]: Billets
                      - generic [ref=f2e697]: Marché gourmand de la Petite-Côte
                  - cell "5 250 F CFA" [ref=f2e698]
                  - cell "250 F CFA" [ref=f2e699]
                  - cell "171,25 F CFA" [ref=f2e700]
                  - cell "Payé" [ref=f2e701]
                - row [ref=f2e705]:
                  - cell [ref=f2e706]:
                    - time [ref=f2e707]: jeu. 19 nov. 2026 à 08:24
                  - cell "7030404c-6a13-433c-a71a-d0de420ef633" [ref=f2e708]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=f2e709]:
                    - generic [ref=f2e710]:
                      - generic [ref=f2e711]: Billets
                      - generic [ref=f2e712]: Marché gourmand de la Petite-Côte
                  - cell "4 200 F CFA" [ref=f2e713]
                  - cell "200 F CFA" [ref=f2e714]
                  - cell "137 F CFA" [ref=f2e715]
                  - cell "Payé" [ref=f2e716]
                - row [ref=f2e720]:
                  - cell [ref=f2e721]:
                    - time [ref=f2e722]: jeu. 19 nov. 2026 à 07:36
                  - cell "01fad902-649c-47ff-b6c2-bb26675acf69" [ref=f2e723]
                  - cell "Billets Festival Jazz sur le Fleuve" [ref=f2e724]:
                    - generic [ref=f2e725]:
                      - generic [ref=f2e726]: Billets
                      - generic [ref=f2e727]: Festival Jazz sur le Fleuve
                  - cell "15 750 F CFA" [ref=f2e728]
                  - cell "750 F CFA" [ref=f2e729]
                  - cell "513,75 F CFA" [ref=f2e730]
                  - cell "Payé" [ref=f2e731]
                - row [ref=f2e735]:
                  - cell [ref=f2e736]:
                    - time [ref=f2e737]: jeu. 19 nov. 2026 à 07:19
                  - cell "bda650d3-6bea-4b1b-b122-afd081b129e5" [ref=f2e738]
                  - cell "Billets Croisière musicale vers Gorée" [ref=f2e739]:
                    - generic [ref=f2e740]:
                      - generic [ref=f2e741]: Billets
                      - generic [ref=f2e742]: Croisière musicale vers Gorée
                  - cell "31 500 F CFA" [ref=f2e743]
                  - cell "1 500 F CFA" [ref=f2e744]
                  - cell "-472,5 F CFA" [ref=f2e745]
                  - cell "Remboursé" [ref=f2e746]
                - row [ref=f2e750]:
                  - cell [ref=f2e751]:
                    - time [ref=f2e752]: jeu. 19 nov. 2026 à 06:56
                  - cell "53db5ac5-f3c4-4b58-ba3a-d0e40597c433" [ref=f2e753]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=f2e754]:
                    - generic [ref=f2e755]:
                      - generic [ref=f2e756]: Billets
                      - generic [ref=f2e757]: Marché gourmand de la Petite-Côte
                  - cell "10 500 F CFA" [ref=f2e758]
                  - cell "500 F CFA" [ref=f2e759]
                  - cell "342,5 F CFA" [ref=f2e760]
                  - cell "Payé" [ref=f2e761]
                - row [ref=f2e765]:
                  - cell [ref=f2e766]:
                    - time [ref=f2e767]: jeu. 19 nov. 2026 à 06:55
                  - cell "b560318e-25d6-4b88-a386-35d371cdc32e" [ref=f2e768]
                  - cell "Billets Dîner-spectacle au bord du Saloum" [ref=f2e769]:
                    - generic [ref=f2e770]:
                      - generic [ref=f2e771]: Billets
                      - generic [ref=f2e772]: Dîner-spectacle au bord du Saloum
                  - cell "52 500 F CFA" [ref=f2e773]
                  - cell "2 500 F CFA" [ref=f2e774]
                  - cell "1 712,5 F CFA" [ref=f2e775]
                  - cell "Payé" [ref=f2e776]
                - row [ref=f2e780]:
                  - cell [ref=f2e781]:
                    - time [ref=f2e782]: jeu. 19 nov. 2026 à 06:22
                  - cell "085ed2d1-a026-4017-aa84-949cb85df44d" [ref=f2e783]
                  - cell "Billets Croisière musicale vers Gorée" [ref=f2e784]:
                    - generic [ref=f2e785]:
                      - generic [ref=f2e786]: Billets
                      - generic [ref=f2e787]: Croisière musicale vers Gorée
                  - cell "15 750 F CFA" [ref=f2e788]
                  - cell "750 F CFA" [ref=f2e789]
                  - cell "-236,25 F CFA" [ref=f2e790]
                  - cell "Remboursé" [ref=f2e791]
                - row [ref=f2e795]:
                  - cell [ref=f2e796]:
                    - time [ref=f2e797]: jeu. 19 nov. 2026 à 06:06
                  - cell "c57bc527-f0b7-42e2-a575-83359fd6955e" [ref=f2e798]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=f2e799]:
                    - generic [ref=f2e800]:
                      - generic [ref=f2e801]: Billets
                      - generic [ref=f2e802]: Nuit du Sabar — édition d’automne
                  - cell "15 750 F CFA" [ref=f2e803]
                  - cell "750 F CFA" [ref=f2e804]
                  - cell "513,75 F CFA" [ref=f2e805]
                  - cell "Payé" [ref=f2e806]
                - row [ref=f2e810]:
                  - cell [ref=f2e811]:
                    - time [ref=f2e812]: jeu. 19 nov. 2026 à 06:04
                  - cell "5ce649bf-0ec1-46bc-9eb9-6273f5dad79c" [ref=f2e813]
                  - cell "Billets Carnaval des enfants de Saly" [ref=f2e814]:
                    - generic [ref=f2e815]:
                      - generic [ref=f2e816]: Billets
                      - generic [ref=f2e817]: Carnaval des enfants de Saly
                  - cell "4 200 F CFA" [ref=f2e818]
                  - cell "200 F CFA" [ref=f2e819]
                  - cell "137 F CFA" [ref=f2e820]
                  - cell "Payé" [ref=f2e821]
            - navigation "Pages des paiements" [ref=f2e825]:
              - button "Précédent" [disabled] [ref=f2e826]
              - paragraph [ref=f2e831]:
                - text: Page 1 sur 7
                - generic [ref=f2e832]: · 132 résultats
              - button "Suivant" [ref=f2e833] [cursor=pointer]
  - alert [ref=f2e838]
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
      |                                                                                        ^ Error: contrôles responsive de adm-finance (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```