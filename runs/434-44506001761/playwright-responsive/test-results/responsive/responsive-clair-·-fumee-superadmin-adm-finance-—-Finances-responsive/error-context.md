# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-finance — Finances
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-finance (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 17

- Array []
+ Array [
+   "320 px : texte tronqué sans le texte entier : small.text-caption.max-w-full « Validation » (points de suspension, texte entier absent)",
+   "320 px : textes qui se chevauchent : dt.text-muted-foreground « Remboursement » sur span.text-fg « Remboursement d’une annulation » (18×18 px)",
+   "320 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+   "360 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+   "390 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Reprise » de 741 à 792 px (fenêtre 768 px) ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » de 741 à 914 px (fenêtre 768 px) ; span.min-w-0 « Marquer versé » de 778 à 876 px (fenêtre 768 px) ; span.min-w-0 « Constater non versé » de 778 à 917 px (fenêtre 768 px) ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » de 741 à 914 px (fenêtre 768 px) ; span.min-w-0 « Marquer versé » de 778 à 876 px (fenêtre 768 px) ; span.min-w-0 « Constater non versé » de 778 à 917 px (fenêtre 768 px) ; span « Remboursé » de 730 à 796 px (fenêtre 768 px) ; span « Remboursé » de 730 à 796 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Reprise » dépasse de div.hidden.overflow-hidden «  » ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Marquer versé » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Constater non versé » dépasse de div.hidden.overflow-hidden «  » ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Marquer versé » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Constater non versé » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Statut » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+   "1024 px : texte hors de l’écran : th.px-4.py-3 « Reprise » de 1005 à 1056 px (fenêtre 1024 px) ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » de 1005 à 1178 px (fenêtre 1024 px) ; span.min-w-0 « Marquer versé » de 1042 à 1140 px (fenêtre 1024 px) ; span.min-w-0 « Constater non versé » de 1042 à 1181 px (fenêtre 1024 px) ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » de 1005 à 1178 px (fenêtre 1024 px) ; span.min-w-0 « Marquer versé » de 1042 à 1140 px (fenêtre 1024 px) ; span.min-w-0 « Constater non versé » de 1042 à 1181 px (fenêtre 1024 px) ; th.px-4.py-3 « Statut » de 985 à 1028 px (fenêtre 1024 px) ; span « Remboursé » de 994 à 1060 px (fenêtre 1024 px) ; span « Remboursé » de 994 à 1060 px (fenêtre 1024 px)",
+   "1024 px : texte coupé : th.px-4.py-3 « Reprise » dépasse de div.hidden.overflow-hidden «  » ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » dépasse de div.hidden.overflow-hidden «  » ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Marquer versé » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Constater non versé » dépasse de div.hidden.overflow-hidden «  » ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » dépasse de div.hidden.overflow-hidden «  » ; p.text-sm.leading-relaxed « Vérifiez auprès du support SamirPay. Si le verseme » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Marquer versé » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Constater non versé » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Statut » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  » ; span « Payé » dépasse de div.hidden.overflow-hidden «  »",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; span.block.truncate « Superadmin » (points de suspension, texte entier absent)",
+   "1024 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+   "1440 px : valeur technique affichée : 4e1fccb1-2a59-4759-9712-5899d9c1b656 ; ec552fe8-161d-4982-b556-2bb987351625 ; cd66ae36-1423-49ce-8aa1-f234de0bc59e ; 038ca260-1190-4fc1-80f2-4876ff17a158 ; a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4 ; 9a5a85e4-1e8e-4a4b-89d8-53b28ac42162 ; 67ca89c9-adfc-45d8-b709-b5e2bf10ef32 ; 2b8f29c0-728c-4b74-8805-acc2deae0d9a ; e9c34302-6913-49da-a43d-1b608344e855 ; 7f4f993b-a821-4566-bbdf-b442b633df80 — ex. texte : « 4e1fccb1-2a59-4759-9712-5899d9c1b656 » ; texte : « ec552fe8-161d-4982-b556-2bb987351625 » ; texte : « cd66ae36-1423-49ce-8aa1-f234de0bc59e »",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e6]: Event Village
      - navigation "Navigation principale" [ref=f5e9]:
        - generic [ref=f5e10]: Administration
        - link "Tableau de bord" [ref=f5e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e22]:
          - paragraph [ref=f5e23]: Gestion
          - generic [ref=f5e24]:
            - link "Événements" [ref=f5e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f5e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f5e42]:
          - paragraph [ref=f5e43]: Finances
          - link "Finance" [ref=f5e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f5e49]:
          - paragraph [ref=f5e50]: Engagement
          - generic [ref=f5e51]:
            - link "Parrainage" [ref=f5e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f5e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f5e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f5e66]:
          - paragraph [ref=f5e67]: Système
          - generic [ref=f5e68]:
            - link "Réglages" [ref=f5e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f5e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f5e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f5e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f5e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e107]: ES
          - generic [ref=f5e108]:
            - generic [ref=f5e109]: Elhadji SuperAdmin
            - generic [ref=f5e110]: Superadmin
        - generic [ref=f5e111]:
          - button "Se déconnecter" [ref=f5e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e117] [cursor=pointer]
    - generic [ref=f5e121]:
      - banner [ref=f5e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=f5e131] [cursor=pointer]:
          - generic [ref=f5e135]: "58"
      - main [ref=f5e136]:
        - generic [ref=f5e138]:
          - generic [ref=f5e140]:
            - generic [ref=f5e141]:
              - heading "Finance" [level=1] [ref=f5e142]
              - paragraph [ref=f5e143]: Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay.
            - link "Réglages de la plateforme" [ref=f5e145] [cursor=pointer]:
              - /url: /admin/finance-settings
          - group [ref=f5e151]:
            - heading "Période" [level=2] [ref=f5e155]
            - generic [ref=f5e157]:
              - generic [ref=f5e158]: Afficher
              - combobox "Afficher" [ref=f5e161] [cursor=pointer]:
                - option "Aujourd’hui"
                - option "7 derniers jours"
                - option "30 derniers jours"
                - option "Ce mois-ci" [selected]
                - option "Mois dernier"
                - option "Dates choisies…"
            - paragraph [ref=f5e162]: "Période affichée : du 1er au 19 novembre 2026. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant."
          - generic [ref=f5e163]:
            - region [ref=f5e164]:
              - heading "Gagné par Event Village" [level=2] [ref=f5e166]
              - paragraph [ref=f5e171]: 57 335,22 F CFA
              - paragraph [ref=f5e172]: "Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
              - paragraph [ref=f5e173]: Paiements encaissés, retraits versés et versements confirmés du 1er au 19 novembre 2026.
              - link "Voir le détail" [ref=f5e174] [cursor=pointer]:
                - /url: "#detail-gagne"
            - region [ref=f5e175]:
              - heading "Dû aux partenaires" [level=2] [ref=f5e177]
              - paragraph [ref=f5e182]: 1 749 000 F CFA
              - paragraph [ref=f5e183]: "L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
              - paragraph [ref=f5e184]: "Dont 0 F CFA retirables aujourd’hui. Dû aux parrains : 0 F CFA. À l’instant."
              - link "Voir le détail" [ref=f5e185] [cursor=pointer]:
                - /url: "#du-aux-partenaires"
            - region [ref=f5e186]:
              - heading "Retirable par Event Village" [level=2] [ref=f5e188]
              - paragraph [ref=f5e192]: 47 188 325 F CFA
              - paragraph [ref=f5e193]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
              - paragraph [ref=f5e194]:
                - text: Solde SamirPay lu à
                - time [ref=f5e195]: 10:41
                - text: ", moins tout ce qui est dû et la réserve de prudence."
              - link "Voir le calcul" [ref=f5e196] [cursor=pointer]:
                - /url: "#calcul-retirable"
            - region [ref=f5e197]:
              - heading "Créances" [level=2] [ref=f5e199]
              - paragraph [ref=f5e205]: 0 F CFA
              - paragraph [ref=f5e206]: Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre.
              - paragraph [ref=f5e207]: Aucune créance à l’instant.
              - link "Voir les créances" [ref=f5e208] [cursor=pointer]:
                - /url: "#creances"
          - region [ref=f5e210]:
            - generic [ref=f5e211]:
              - heading "Versements à reprendre" [level=2] [ref=f5e212]
              - paragraph [ref=f5e213]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - table [ref=f5e216]:
              - caption [ref=f5e217]: Versements à reprendre
              - rowgroup [ref=f5e218]:
                - row [ref=f5e219]:
                  - columnheader "Montant" [ref=f5e220]
                  - columnheader "Versement" [ref=f5e221]
                  - columnheader "Bénéficiaire" [ref=f5e222]
                  - columnheader "État" [ref=f5e223]
                  - columnheader "Depuis le" [ref=f5e224]
                  - columnheader "Reprise" [ref=f5e225]
              - rowgroup [ref=f5e226]:
                - row [ref=f5e227]:
                  - cell "31 500 F CFA" [ref=f5e228]
                  - cell [ref=f5e229]:
                    - generic [ref=f5e230]:
                      - paragraph [ref=f5e231]: Remboursement d’une annulation
                      - paragraph [ref=f5e232]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f5e233]
                  - cell "Issue incertaine" [ref=f5e234]
                  - cell [ref=f5e238]:
                    - time [ref=f5e239]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f5e240]:
                    - generic [ref=f5e241]:
                      - paragraph [ref=f5e242]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                      - generic [ref=f5e243]:
                        - button "Marquer versé le versement de 31 500 F CFA" [ref=f5e244] [cursor=pointer]:
                          - generic [ref=f5e249]: Marquer versé
                        - button "Constater non versé le versement de 31 500 F CFA" [ref=f5e250] [cursor=pointer]:
                          - generic [ref=f5e255]: Constater non versé
                - row [ref=f5e256]:
                  - cell "9 450 F CFA" [ref=f5e257]
                  - cell [ref=f5e258]:
                    - generic [ref=f5e259]:
                      - paragraph [ref=f5e260]: Remboursement d’une annulation
                      - paragraph [ref=f5e261]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f5e262]
                  - cell "Issue incertaine" [ref=f5e263]
                  - cell [ref=f5e267]:
                    - time [ref=f5e268]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f5e269]:
                    - generic [ref=f5e270]:
                      - paragraph [ref=f5e271]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                      - generic [ref=f5e272]:
                        - button "Marquer versé le versement de 9 450 F CFA" [ref=f5e273] [cursor=pointer]:
                          - generic [ref=f5e278]: Marquer versé
                        - button "Constater non versé le versement de 9 450 F CFA" [ref=f5e279] [cursor=pointer]:
                          - generic [ref=f5e284]: Constater non versé
          - region [ref=f5e285]:
            - generic [ref=f5e286]:
              - heading "Remboursements à verser" [level=2] [ref=f5e287]
              - paragraph [ref=f5e288]: Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
              - paragraph [ref=f5e289]: 4 remboursements pour 66 150 F CFA.
            - table [ref=f5e292]:
              - caption [ref=f5e293]: Remboursements à verser
              - rowgroup [ref=f5e294]:
                - row [ref=f5e295]:
                  - columnheader "Demandé le" [ref=f5e296]
                  - columnheader "Remboursement" [ref=f5e297]
                  - columnheader "Client" [ref=f5e298]
                  - columnheader "Montant" [ref=f5e299]
                  - columnheader "Où il en est" [ref=f5e300]
              - rowgroup [ref=f5e301]:
                - row [ref=f5e302]:
                  - cell [ref=f5e303]:
                    - time [ref=f5e304]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e305]:
                    - generic [ref=f5e306]:
                      - generic [ref=f5e307]: Remboursement d’une annulation
                      - generic [ref=f5e308]: Croisière musicale vers Gorée
                  - cell "Modou M. · 70*****18" [ref=f5e309]
                  - cell "15 750 F CFA" [ref=f5e310]
                  - cell "Envoyé, en attente de confirmation" [ref=f5e311]
                - row [ref=f5e314]:
                  - cell [ref=f5e315]:
                    - time [ref=f5e316]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e317]:
                    - generic [ref=f5e318]:
                      - generic [ref=f5e319]: Remboursement d’une annulation
                      - generic [ref=f5e320]: Croisière musicale vers Gorée
                  - cell "Astou S. · 70*****15" [ref=f5e321]
                  - cell "9 450 F CFA" [ref=f5e322]
                  - cell "Envoyé, en attente de confirmation" [ref=f5e323]
                - row [ref=f5e326]:
                  - cell [ref=f5e327]:
                    - time [ref=f5e328]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e329]:
                    - generic [ref=f5e330]:
                      - generic [ref=f5e331]: Remboursement d’une annulation
                      - generic [ref=f5e332]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f5e333]
                  - cell "31 500 F CFA" [ref=f5e334]
                  - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f5e335]':
                    - generic [ref=f5e336]:
                      - generic [ref=f5e337]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=f5e338] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
                - row [ref=f5e339]:
                  - cell [ref=f5e340]:
                    - time [ref=f5e341]: jeu. 19 nov. 2026 à 10:34
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=f5e342]:
                    - generic [ref=f5e343]:
                      - generic [ref=f5e344]: Remboursement d’une annulation
                      - generic [ref=f5e345]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=f5e346]
                  - cell "9 450 F CFA" [ref=f5e347]
                  - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=f5e348]':
                    - generic [ref=f5e349]:
                      - generic [ref=f5e350]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=f5e351] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
          - region [ref=f5e352]:
            - generic [ref=f5e353]:
              - heading "Créances" [level=2] [ref=f5e354]
              - paragraph [ref=f5e355]: Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ; ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
            - generic [ref=f5e356]:
              - heading "Aucune créance" [level=3] [ref=f5e361]
              - paragraph [ref=f5e362]: Personne ne doit d’argent à Event Village.
          - region [ref=f5e363]:
            - generic [ref=f5e364]:
              - heading "Détail de ce qui a été gagné" [level=2] [ref=f5e365]
              - paragraph [ref=f5e366]: "Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés du 1er au 19 novembre 2026."
            - generic [ref=f5e367]:
              - generic [ref=f5e368]:
                - term [ref=f5e369]:
                  - generic [ref=f5e370]: Frais de service, moins les frais d’encaissement SamirPay
                  - generic [ref=f5e371]: "132 paiements encaissés du 1er au 19 novembre 2026 : 94 650 F CFA de frais de service, 29 814,78 F CFA de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas)."
                - definition [ref=f5e372]: + 64 835,22 F CFA
              - generic [ref=f5e373]:
                - term [ref=f5e374]:
                  - generic [ref=f5e375]: Part rendue avec les remboursements
                  - generic [ref=f5e376]: Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.
                - definition [ref=f5e377]: − 7 500 F CFA
              - generic [ref=f5e378]:
                - term [ref=f5e379]:
                  - generic [ref=f5e380]: Frais de retrait
                  - generic [ref=f5e381]: 0 retrait versé du 1er au 19 novembre 2026.
                - definition [ref=f5e382]: + 0 F CFA
              - generic [ref=f5e383]:
                - term [ref=f5e384]:
                  - generic [ref=f5e385]: Frais SamirPay des versements
                  - generic [ref=f5e386]: Frais réels de 0 versement confirmé du 1er au 19 novembre 2026 (remboursements et retraits).
                - definition [ref=f5e387]: − 0 F CFA
              - generic [ref=f5e388]:
                - term [ref=f5e389]:
                  - generic [ref=f5e390]: Commissions de parrainage
                  - generic [ref=f5e391]: Sur les paiements encaissés de la période, annulations et reprises déduites.
                - definition [ref=f5e392]: − 0 F CFA
              - generic [ref=f5e393]:
                - term [ref=f5e394]:
                  - generic [ref=f5e395]: Gagné par Event Village
                - definition [ref=f5e396]: 57 335,22 F CFA
          - region [ref=f5e397]:
            - generic [ref=f5e398]:
              - heading "Dû aux partenaires" [level=2] [ref=f5e399]
              - paragraph [ref=f5e400]: L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
            - generic [ref=f5e401]:
              - generic [ref=f5e402]:
                - term [ref=f5e403]:
                  - generic [ref=f5e404]: Disponible pour les partenaires
                  - generic [ref=f5e405]: Dont 0 F CFA retirables tout de suite et 0 F CFA gelés (événements suspendus, libérés à la reprise).
                - definition [ref=f5e406]: 0 F CFA
              - generic [ref=f5e407]:
                - term [ref=f5e408]:
                  - generic [ref=f5e409]: En attente de la fin des événements
                - definition [ref=f5e410]: 1 749 000 F CFA
              - generic [ref=f5e411]:
                - term [ref=f5e412]:
                  - generic [ref=f5e413]: Retraits en cours d’envoi
                  - generic [ref=f5e414]: Demandés par les partenaires, pas encore confirmés par SamirPay.
                - definition [ref=f5e415]: 0 F CFA
              - generic [ref=f5e416]:
                - term [ref=f5e417]:
                  - generic [ref=f5e418]: Dû aux partenaires
                - definition [ref=f5e419]: 1 749 000 F CFA
            - table [ref=f5e422]:
              - caption [ref=f5e423]: Dû aux partenaires, compte par compte
              - rowgroup [ref=f5e424]:
                - row [ref=f5e425]:
                  - columnheader "Partenaire" [ref=f5e426]
                  - columnheader "Dû" [ref=f5e427]
                  - columnheader "Retirable aujourd’hui" [ref=f5e428]
                  - columnheader "En attente" [ref=f5e429]
                  - columnheader "Gelé" [ref=f5e430]
                  - columnheader "Retrait en cours" [ref=f5e431]
              - rowgroup [ref=f5e432]:
                - row [ref=f5e433]:
                  - cell "Baobab Scène Productions" [ref=f5e434]
                  - cell "828 000 F CFA" [ref=f5e435]
                  - cell "0 F CFA" [ref=f5e436]
                  - cell "828 000 F CFA" [ref=f5e437]
                  - cell "0 F CFA" [ref=f5e438]
                  - cell "0 F CFA" [ref=f5e439]
                - row [ref=f5e440]:
                  - cell "Sine-Saloum Culture & Loisirs" [ref=f5e441]
                  - cell "806 000 F CFA" [ref=f5e442]
                  - cell "0 F CFA" [ref=f5e443]
                  - cell "806 000 F CFA" [ref=f5e444]
                  - cell "0 F CFA" [ref=f5e445]
                  - cell "0 F CFA" [ref=f5e446]
                - row [ref=f5e447]:
                  - cell "Atelier Petite-Côte" [ref=f5e448]
                  - cell "115 000 F CFA" [ref=f5e449]
                  - cell "0 F CFA" [ref=f5e450]
                  - cell "115 000 F CFA" [ref=f5e451]
                  - cell "0 F CFA" [ref=f5e452]
                  - cell "0 F CFA" [ref=f5e453]
            - generic [ref=f5e454]:
              - heading "Dû aux parrains" [level=3] [ref=f5e455]
              - paragraph [ref=f5e456]: "Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village. Total : 0 F CFA."
              - generic [ref=f5e457]:
                - heading "Rien n’est dû aux parrains" [level=3] [ref=f5e464]
                - paragraph [ref=f5e465]: Aucun solde à verser pour le moment.
          - region [ref=f5e466]:
            - generic [ref=f5e467]:
              - heading "Calcul de ce qui est retirable" [level=2] [ref=f5e468]
              - paragraph [ref=f5e469]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. Si ce chiffre est à 0, ne retirez rien.
            - generic [ref=f5e470]:
              - generic [ref=f5e471]:
                - term [ref=f5e472]:
                  - generic [ref=f5e473]: Solde du compte SamirPay
                  - generic [ref=f5e474]:
                    - text: Lu à
                    - time [ref=f5e475]: 10:41
                    - text: (heure de Dakar), relu au plus toutes les 5 minutes.
                - definition [ref=f5e476]: 50 000 000 F CFA
              - generic [ref=f5e477]:
                - term [ref=f5e478]:
                  - generic [ref=f5e479]: Dû aux partenaires
                - definition [ref=f5e480]: − 1 749 000 F CFA
              - generic [ref=f5e481]:
                - term [ref=f5e482]:
                  - generic [ref=f5e483]: Dû aux parrains
                - definition [ref=f5e484]: − 0 F CFA
              - generic [ref=f5e485]:
                - term [ref=f5e486]:
                  - generic [ref=f5e487]: Remboursements à verser
                - definition [ref=f5e488]: − 66 150 F CFA
              - generic [ref=f5e489]:
                - term [ref=f5e490]:
                  - generic [ref=f5e491]: Réserve de prudence
                  - generic [ref=f5e492]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Automatique : les encaissements des 3 derniers jours, soit 996 525 F CFA aujourd’hui."
                - definition [ref=f5e493]: − 996 525 F CFA
              - generic [ref=f5e494]:
                - term [ref=f5e495]:
                  - generic [ref=f5e496]: Retirable par Event Village
                - definition [ref=f5e497]: 47 188 325 F CFA
            - link "Changer la réserve de prudence" [ref=f5e499] [cursor=pointer]:
              - /url: /admin/finance-settings
          - region [ref=f5e501]:
            - generic [ref=f5e502]:
              - heading "Paiements encaissés" [level=2] [ref=f5e503]
              - paragraph [ref=f5e507]: Paiements en ligne encaissés du 1er au 19 novembre 2026. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            - generic [ref=f5e508]:
              - generic [ref=f5e509]: Statut
              - combobox "Statut" [ref=f5e512] [cursor=pointer]:
                - option "Tous les paiements" [selected]
                - option "Payé"
                - option "Remboursé en partie"
                - option "Remboursement en cours"
                - option "Remboursé"
            - table [ref=f5e515]:
              - caption [ref=f5e516]: Paiements encaissés
              - rowgroup [ref=f5e517]:
                - row [ref=f5e518]:
                  - columnheader "Encaissé le" [ref=f5e519]
                  - columnheader "Référence" [ref=f5e520]
                  - columnheader "Objet" [ref=f5e521]
                  - columnheader "Payé" [ref=f5e522]
                  - columnheader "Frais de service" [ref=f5e523]
                  - columnheader "Pour Event Village" [ref=f5e524]
                  - columnheader "Statut" [ref=f5e525]
              - rowgroup [ref=f5e526]:
                - row [ref=f5e527]:
                  - cell [ref=f5e528]:
                    - time [ref=f5e529]: jeu. 19 nov. 2026 à 10:34
                  - cell "4e1fccb1-2a59-4759-9712-5899d9c1b656" [ref=f5e530]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f5e531]:
                    - generic [ref=f5e532]:
                      - generic [ref=f5e533]: Billets
                      - generic [ref=f5e534]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f5e535]
                  - cell "450 F CFA" [ref=f5e536]
                  - cell "308,25 F CFA" [ref=f5e537]
                  - cell "Payé" [ref=f5e538]
                - row [ref=f5e542]:
                  - cell [ref=f5e543]:
                    - time [ref=f5e544]: jeu. 19 nov. 2026 à 10:34
                  - cell "ec552fe8-161d-4982-b556-2bb987351625" [ref=f5e545]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f5e546]:
                    - generic [ref=f5e547]:
                      - generic [ref=f5e548]: Billets
                      - generic [ref=f5e549]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f5e550]
                  - cell "450 F CFA" [ref=f5e551]
                  - cell "308,25 F CFA" [ref=f5e552]
                  - cell "Payé" [ref=f5e553]
                - row [ref=f5e557]:
                  - cell [ref=f5e558]:
                    - time [ref=f5e559]: jeu. 19 nov. 2026 à 10:34
                  - cell "cd66ae36-1423-49ce-8aa1-f234de0bc59e" [ref=f5e560]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f5e561]:
                    - generic [ref=f5e562]:
                      - generic [ref=f5e563]: Billets
                      - generic [ref=f5e564]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f5e565]
                  - cell "450 F CFA" [ref=f5e566]
                  - cell "308,25 F CFA" [ref=f5e567]
                  - cell "Payé" [ref=f5e568]
                - row [ref=f5e572]:
                  - cell [ref=f5e573]:
                    - time [ref=f5e574]: jeu. 19 nov. 2026 à 10:34
                  - cell "038ca260-1190-4fc1-80f2-4876ff17a158" [ref=f5e575]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f5e576]:
                    - generic [ref=f5e577]:
                      - generic [ref=f5e578]: Billets
                      - generic [ref=f5e579]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f5e580]
                  - cell "450 F CFA" [ref=f5e581]
                  - cell "308,25 F CFA" [ref=f5e582]
                  - cell "Payé" [ref=f5e583]
                - row [ref=f5e587]:
                  - cell [ref=f5e588]:
                    - time [ref=f5e589]: jeu. 19 nov. 2026 à 10:34
                  - cell "a4bea6e2-aaa4-44c4-8ad9-12920bcf2fe4" [ref=f5e590]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f5e591]:
                    - generic [ref=f5e592]:
                      - generic [ref=f5e593]: Billets
                      - generic [ref=f5e594]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f5e595]
                  - cell "450 F CFA" [ref=f5e596]
                  - cell "308,25 F CFA" [ref=f5e597]
                  - cell "Payé" [ref=f5e598]
                - row [ref=f5e602]:
                  - cell [ref=f5e603]:
                    - time [ref=f5e604]: jeu. 19 nov. 2026 à 10:34
                  - cell "9a5a85e4-1e8e-4a4b-89d8-53b28ac42162" [ref=f5e605]
                  - cell "Billets Nuit du slam de Kaolack" [ref=f5e606]:
                    - generic [ref=f5e607]:
                      - generic [ref=f5e608]: Billets
                      - generic [ref=f5e609]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=f5e610]
                  - cell "450 F CFA" [ref=f5e611]
                  - cell "308,25 F CFA" [ref=f5e612]
                  - cell "Payé" [ref=f5e613]
                - row [ref=f5e617]:
                  - cell [ref=f5e618]:
                    - time [ref=f5e619]: jeu. 19 nov. 2026 à 10:34
                  - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-BIS-B-1" [ref=f5e620]
                  - cell "Billets" [ref=f5e621]
                  - cell "4 000 F CFA" [ref=f5e624]
                  - cell "0 F CFA" [ref=f5e625]
                  - cell "0 F CFA" [ref=f5e626]
                  - cell "Payé" [ref=f5e627]
                - row [ref=f5e631]:
                  - cell [ref=f5e632]:
                    - time [ref=f5e633]: jeu. 19 nov. 2026 à 10:34
                  - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-A-1" [ref=f5e634]
                  - cell "Billets" [ref=f5e635]
                  - cell "5 000 F CFA" [ref=f5e638]
                  - cell "0 F CFA" [ref=f5e639]
                  - cell "0 F CFA" [ref=f5e640]
                  - cell "Payé" [ref=f5e641]
                - row [ref=f5e645]:
                  - cell [ref=f5e646]:
                    - time [ref=f5e647]: jeu. 19 nov. 2026 à 09:36
                  - cell "67ca89c9-adfc-45d8-b709-b5e2bf10ef32" [ref=f5e648]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=f5e649]:
                    - generic [ref=f5e650]:
                      - generic [ref=f5e651]: Billets
                      - generic [ref=f5e652]: Nuit du Sabar — édition d’automne
                  - cell "6 300 F CFA" [ref=f5e653]
                  - cell "300 F CFA" [ref=f5e654]
                  - cell "205,5 F CFA" [ref=f5e655]
                  - cell "Payé" [ref=f5e656]
                - row [ref=f5e660]:
                  - cell [ref=f5e661]:
                    - time [ref=f5e662]: jeu. 19 nov. 2026 à 09:22
                  - cell "2b8f29c0-728c-4b74-8805-acc2deae0d9a" [ref=f5e663]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=f5e664]:
                    - generic [ref=f5e665]:
                      - generic [ref=f5e666]: Billets
                      - generic [ref=f5e667]: Nuit du Sabar — édition d’automne
                  - cell "3 150 F CFA" [ref=f5e668]
                  - cell "150 F CFA" [ref=f5e669]
                  - cell "102,75 F CFA" [ref=f5e670]
                  - cell "Payé" [ref=f5e671]
                - row [ref=f5e675]:
                  - cell [ref=f5e676]:
                    - time [ref=f5e677]: jeu. 19 nov. 2026 à 09:08
                  - cell "e9c34302-6913-49da-a43d-1b608344e855" [ref=f5e678]
                  - cell "Billets Rencontres du conte et de la parole" [ref=f5e679]:
                    - generic [ref=f5e680]:
                      - generic [ref=f5e681]: Billets
                      - generic [ref=f5e682]: Rencontres du conte et de la parole
                  - cell "3 150 F CFA" [ref=f5e683]
                  - cell "150 F CFA" [ref=f5e684]
                  - cell "102,75 F CFA" [ref=f5e685]
                  - cell "Payé" [ref=f5e686]
                - row [ref=f5e690]:
                  - cell [ref=f5e691]:
                    - time [ref=f5e692]: jeu. 19 nov. 2026 à 08:34
                  - cell "7f4f993b-a821-4566-bbdf-b442b633df80" [ref=f5e693]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=f5e694]:
                    - generic [ref=f5e695]:
                      - generic [ref=f5e696]: Billets
                      - generic [ref=f5e697]: Marché gourmand de la Petite-Côte
                  - cell "5 250 F CFA" [ref=f5e698]
                  - cell "250 F CFA" [ref=f5e699]
                  - cell "171,25 F CFA" [ref=f5e700]
                  - cell "Payé" [ref=f5e701]
                - row [ref=f5e705]:
                  - cell [ref=f5e706]:
                    - time [ref=f5e707]: jeu. 19 nov. 2026 à 08:24
                  - cell "7030404c-6a13-433c-a71a-d0de420ef633" [ref=f5e708]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=f5e709]:
                    - generic [ref=f5e710]:
                      - generic [ref=f5e711]: Billets
                      - generic [ref=f5e712]: Marché gourmand de la Petite-Côte
                  - cell "4 200 F CFA" [ref=f5e713]
                  - cell "200 F CFA" [ref=f5e714]
                  - cell "137 F CFA" [ref=f5e715]
                  - cell "Payé" [ref=f5e716]
                - row [ref=f5e720]:
                  - cell [ref=f5e721]:
                    - time [ref=f5e722]: jeu. 19 nov. 2026 à 07:36
                  - cell "01fad902-649c-47ff-b6c2-bb26675acf69" [ref=f5e723]
                  - cell "Billets Festival Jazz sur le Fleuve" [ref=f5e724]:
                    - generic [ref=f5e725]:
                      - generic [ref=f5e726]: Billets
                      - generic [ref=f5e727]: Festival Jazz sur le Fleuve
                  - cell "15 750 F CFA" [ref=f5e728]
                  - cell "750 F CFA" [ref=f5e729]
                  - cell "513,75 F CFA" [ref=f5e730]
                  - cell "Payé" [ref=f5e731]
                - row [ref=f5e735]:
                  - cell [ref=f5e736]:
                    - time [ref=f5e737]: jeu. 19 nov. 2026 à 07:19
                  - cell "bda650d3-6bea-4b1b-b122-afd081b129e5" [ref=f5e738]
                  - cell "Billets Croisière musicale vers Gorée" [ref=f5e739]:
                    - generic [ref=f5e740]:
                      - generic [ref=f5e741]: Billets
                      - generic [ref=f5e742]: Croisière musicale vers Gorée
                  - cell "31 500 F CFA" [ref=f5e743]
                  - cell "1 500 F CFA" [ref=f5e744]
                  - cell "-472,5 F CFA" [ref=f5e745]
                  - cell "Remboursé" [ref=f5e746]
                - row [ref=f5e750]:
                  - cell [ref=f5e751]:
                    - time [ref=f5e752]: jeu. 19 nov. 2026 à 06:56
                  - cell "53db5ac5-f3c4-4b58-ba3a-d0e40597c433" [ref=f5e753]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=f5e754]:
                    - generic [ref=f5e755]:
                      - generic [ref=f5e756]: Billets
                      - generic [ref=f5e757]: Marché gourmand de la Petite-Côte
                  - cell "10 500 F CFA" [ref=f5e758]
                  - cell "500 F CFA" [ref=f5e759]
                  - cell "342,5 F CFA" [ref=f5e760]
                  - cell "Payé" [ref=f5e761]
                - row [ref=f5e765]:
                  - cell [ref=f5e766]:
                    - time [ref=f5e767]: jeu. 19 nov. 2026 à 06:55
                  - cell "b560318e-25d6-4b88-a386-35d371cdc32e" [ref=f5e768]
                  - cell "Billets Dîner-spectacle au bord du Saloum" [ref=f5e769]:
                    - generic [ref=f5e770]:
                      - generic [ref=f5e771]: Billets
                      - generic [ref=f5e772]: Dîner-spectacle au bord du Saloum
                  - cell "52 500 F CFA" [ref=f5e773]
                  - cell "2 500 F CFA" [ref=f5e774]
                  - cell "1 712,5 F CFA" [ref=f5e775]
                  - cell "Payé" [ref=f5e776]
                - row [ref=f5e780]:
                  - cell [ref=f5e781]:
                    - time [ref=f5e782]: jeu. 19 nov. 2026 à 06:22
                  - cell "085ed2d1-a026-4017-aa84-949cb85df44d" [ref=f5e783]
                  - cell "Billets Croisière musicale vers Gorée" [ref=f5e784]:
                    - generic [ref=f5e785]:
                      - generic [ref=f5e786]: Billets
                      - generic [ref=f5e787]: Croisière musicale vers Gorée
                  - cell "15 750 F CFA" [ref=f5e788]
                  - cell "750 F CFA" [ref=f5e789]
                  - cell "-236,25 F CFA" [ref=f5e790]
                  - cell "Remboursé" [ref=f5e791]
                - row [ref=f5e795]:
                  - cell [ref=f5e796]:
                    - time [ref=f5e797]: jeu. 19 nov. 2026 à 06:06
                  - cell "c57bc527-f0b7-42e2-a575-83359fd6955e" [ref=f5e798]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=f5e799]:
                    - generic [ref=f5e800]:
                      - generic [ref=f5e801]: Billets
                      - generic [ref=f5e802]: Nuit du Sabar — édition d’automne
                  - cell "15 750 F CFA" [ref=f5e803]
                  - cell "750 F CFA" [ref=f5e804]
                  - cell "513,75 F CFA" [ref=f5e805]
                  - cell "Payé" [ref=f5e806]
                - row [ref=f5e810]:
                  - cell [ref=f5e811]:
                    - time [ref=f5e812]: jeu. 19 nov. 2026 à 06:04
                  - cell "5ce649bf-0ec1-46bc-9eb9-6273f5dad79c" [ref=f5e813]
                  - cell "Billets Carnaval des enfants de Saly" [ref=f5e814]:
                    - generic [ref=f5e815]:
                      - generic [ref=f5e816]: Billets
                      - generic [ref=f5e817]: Carnaval des enfants de Saly
                  - cell "4 200 F CFA" [ref=f5e818]
                  - cell "200 F CFA" [ref=f5e819]
                  - cell "137 F CFA" [ref=f5e820]
                  - cell "Payé" [ref=f5e821]
            - navigation "Pages des paiements" [ref=f5e825]:
              - button "Précédent" [disabled] [ref=f5e826]
              - paragraph [ref=f5e831]:
                - text: Page 1 sur 7
                - generic [ref=f5e832]: · 132 résultats
              - button "Suivant" [ref=f5e833] [cursor=pointer]
  - alert [ref=f5e838]
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
      |                                                                                        ^ Error: contrôles responsive de adm-finance (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```