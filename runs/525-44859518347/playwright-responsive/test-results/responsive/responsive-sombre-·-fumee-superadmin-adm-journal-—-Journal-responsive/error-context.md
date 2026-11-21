# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-journal — Journal
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-journal (sombre)

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
          - generic [ref=f2e159]:
            - link "Accueil de l’administration" [ref=f2e161] [cursor=pointer]:
              - /url: /admin/dashboard
            - generic [ref=f2e166]:
              - generic [ref=f2e167]:
                - heading "Journal" [level=1] [ref=f2e168]
                - paragraph [ref=f2e169]: "Les actions sensibles de l’administration : qui, quand, sur quoi. Les 100 plus récentes."
              - button "Actualiser" [ref=f2e171] [cursor=pointer]
          - generic [ref=f2e179]:
            - generic [ref=f2e180]:
              - generic [ref=f2e181]: Action
              - combobox "Action" [ref=f2e184] [cursor=pointer]:
                - option "Toutes les actions" [selected]
                - option "Compte suspendu ou réactivé"
                - option "Rôles du compte changés"
                - option "Droits d’un administrateur changés"
                - option "Partenaire validé, refusé, suspendu ou réactivé"
                - option "Événement modifié"
                - option "Versement marqué versé"
                - option "Versement constaté non versé"
                - option "Compte supprimé (données effacées)"
                - option "Tentative d’accès refusée"
            - generic [ref=f2e185]:
              - generic [ref=f2e186]: Objet
              - combobox "Objet" [ref=f2e189] [cursor=pointer]:
                - option "Tous les objets" [selected]
                - option "Compte"
                - option "Partenaire"
                - option "Événement"
                - option "Versement"
                - option "Paiement"
                - option "Réglage"
                - option "Droits"
                - option "Campagne"
                - option "À la une"
            - paragraph [ref=f2e190]: 100 entrées
          - region "Journal des actions" [ref=f2e192]:
            - table [ref=f2e193]:
              - caption [ref=f2e194]: Journal des actions
              - rowgroup [ref=f2e195]:
                - row [ref=f2e196]:
                  - columnheader "Date" [ref=f2e197]
                  - columnheader "Auteur" [ref=f2e198]
                  - columnheader "Rôle à l’action" [ref=f2e199]
                  - columnheader "Action" [ref=f2e200]
                  - columnheader "Objet" [ref=f2e201]
                  - columnheader "Détail" [ref=f2e202]
              - rowgroup [ref=f2e203]:
                - row [ref=f2e204]:
                  - cell [ref=f2e205]:
                    - time [ref=f2e206]: sam. 21 nov. 2026 à 03:21
                  - cell "Système" [ref=f2e207]
                  - cell "Automatique" [ref=f2e210]
                  - cell "Autre action" [ref=f2e211]
                  - cell "Paiement" [ref=f2e212]
                  - cell [ref=f2e213]:
                    - button "Examiner" [ref=f2e214] [cursor=pointer]
                - row [ref=f2e222]:
                  - cell [ref=f2e223]:
                    - time [ref=f2e224]: sam. 21 nov. 2026 à 03:21
                  - cell "Système" [ref=f2e225]
                  - cell "Automatique" [ref=f2e228]
                  - cell "Autre action" [ref=f2e229]
                  - cell "Paiement" [ref=f2e230]
                  - cell [ref=f2e231]:
                    - button "Examiner" [ref=f2e232] [cursor=pointer]
                - row [ref=f2e240]:
                  - cell [ref=f2e241]:
                    - time [ref=f2e242]: sam. 21 nov. 2026 à 03:13
                  - cell "Système" [ref=f2e243]
                  - cell "Automatique" [ref=f2e246]
                  - cell "Autre action" [ref=f2e247]
                  - cell "Paiement" [ref=f2e248]
                  - cell [ref=f2e249]:
                    - button "Examiner" [ref=f2e250] [cursor=pointer]
                - row [ref=f2e258]:
                  - cell [ref=f2e259]:
                    - time [ref=f2e260]: sam. 21 nov. 2026 à 03:12
                  - cell "Système" [ref=f2e261]
                  - cell "Automatique" [ref=f2e264]
                  - cell "Autre action" [ref=f2e265]
                  - cell "Paiement" [ref=f2e266]
                  - cell [ref=f2e267]:
                    - button "Examiner" [ref=f2e268] [cursor=pointer]
                - row [ref=f2e276]:
                  - cell [ref=f2e277]:
                    - time [ref=f2e278]: sam. 21 nov. 2026 à 03:12
                  - cell "Système" [ref=f2e279]
                  - cell "Automatique" [ref=f2e282]
                  - cell "Autre action" [ref=f2e283]
                  - cell "Paiement" [ref=f2e284]
                  - cell [ref=f2e285]:
                    - button "Examiner" [ref=f2e286] [cursor=pointer]
                - row [ref=f2e294]:
                  - cell [ref=f2e295]:
                    - time [ref=f2e296]: sam. 21 nov. 2026 à 03:12
                  - cell "Système" [ref=f2e297]
                  - cell "Automatique" [ref=f2e300]
                  - cell "Autre action" [ref=f2e301]
                  - cell "Paiement" [ref=f2e302]
                  - cell [ref=f2e303]:
                    - button "Examiner" [ref=f2e304] [cursor=pointer]
                - row [ref=f2e312]:
                  - cell [ref=f2e313]:
                    - time [ref=f2e314]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Super-administrateur" [ref=f2e315]':
                    - generic [ref=f2e316]:
                      - generic [ref=f2e317]: Elhadji SuperAdmin
                      - generic [ref=f2e318]: "Aujourd’hui : Super-administrateur"
                  - cell "Automatique" [ref=f2e319]
                  - cell "Autre action" [ref=f2e320]
                  - cell "Compte" [ref=f2e321]
                  - cell [ref=f2e322]:
                    - button "Examiner" [ref=f2e323] [cursor=pointer]
                - row [ref=f2e331]:
                  - cell [ref=f2e332]:
                    - time [ref=f2e333]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Aïda Diallo Aujourd’hui : Administrateur" [ref=f2e334]':
                    - generic [ref=f2e335]:
                      - generic [ref=f2e336]: Aïda Diallo
                      - generic [ref=f2e337]: "Aujourd’hui : Administrateur"
                  - cell "Automatique" [ref=f2e338]
                  - cell "Autre action" [ref=f2e339]
                  - cell "Compte" [ref=f2e340]
                  - cell [ref=f2e341]:
                    - button "Examiner" [ref=f2e342] [cursor=pointer]
                - row [ref=f2e350]:
                  - cell [ref=f2e351]:
                    - time [ref=f2e352]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Fatou Mbaye Aujourd’hui : Client" [ref=f2e353]':
                    - generic [ref=f2e354]:
                      - generic [ref=f2e355]: Fatou Mbaye
                      - generic [ref=f2e356]: "Aujourd’hui : Client"
                  - cell "Client" [ref=f2e357]
                  - cell "Autre action" [ref=f2e358]
                  - cell "Autre" [ref=f2e359]
                  - cell [ref=f2e360]:
                    - button "Examiner" [ref=f2e361] [cursor=pointer]
                - row [ref=f2e369]:
                  - cell [ref=f2e370]:
                    - time [ref=f2e371]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Super-administrateur" [ref=f2e372]':
                    - generic [ref=f2e373]:
                      - generic [ref=f2e374]: Elhadji SuperAdmin
                      - generic [ref=f2e375]: "Aujourd’hui : Super-administrateur"
                  - cell "Super-administrateur" [ref=f2e376]
                  - cell "Autre action" [ref=f2e377]
                  - cell "Autre" [ref=f2e378]
                  - cell [ref=f2e379]:
                    - button "Examiner" [ref=f2e380] [cursor=pointer]
                - row [ref=f2e388]:
                  - cell [ref=f2e389]:
                    - time [ref=f2e390]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Super-administrateur" [ref=f2e391]':
                    - generic [ref=f2e392]:
                      - generic [ref=f2e393]: Elhadji SuperAdmin
                      - generic [ref=f2e394]: "Aujourd’hui : Super-administrateur"
                  - cell "Super-administrateur" [ref=f2e395]
                  - cell "Autre action" [ref=f2e396]
                  - cell "Autre" [ref=f2e397]
                  - cell [ref=f2e398]:
                    - button "Examiner" [ref=f2e399] [cursor=pointer]
                - row [ref=f2e407]:
                  - cell [ref=f2e408]:
                    - time [ref=f2e409]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e410]
                  - cell "Automatique" [ref=f2e413]
                  - cell "Autre action" [ref=f2e414]
                  - cell "Paiement" [ref=f2e415]
                  - cell [ref=f2e416]:
                    - button "Examiner" [ref=f2e417] [cursor=pointer]
                - row [ref=f2e425]:
                  - cell [ref=f2e426]:
                    - time [ref=f2e427]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e428]
                  - cell "Automatique" [ref=f2e431]
                  - cell "Autre action" [ref=f2e432]
                  - cell "Paiement" [ref=f2e433]
                  - cell [ref=f2e434]:
                    - button "Examiner" [ref=f2e435] [cursor=pointer]
                - row [ref=f2e443]:
                  - cell [ref=f2e444]:
                    - time [ref=f2e445]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e446]
                  - cell "Automatique" [ref=f2e449]
                  - cell "Autre action" [ref=f2e450]
                  - cell "Paiement" [ref=f2e451]
                  - cell [ref=f2e452]:
                    - button "Examiner" [ref=f2e453] [cursor=pointer]
                - row [ref=f2e461]:
                  - cell [ref=f2e462]:
                    - time [ref=f2e463]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e464]
                  - cell "Automatique" [ref=f2e467]
                  - cell "Autre action" [ref=f2e468]
                  - cell "Paiement" [ref=f2e469]
                  - cell [ref=f2e470]:
                    - button "Examiner" [ref=f2e471] [cursor=pointer]
                - row [ref=f2e479]:
                  - cell [ref=f2e480]:
                    - time [ref=f2e481]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e482]
                  - cell "Automatique" [ref=f2e485]
                  - cell "Autre action" [ref=f2e486]
                  - cell "Paiement" [ref=f2e487]
                  - cell [ref=f2e488]:
                    - button "Examiner" [ref=f2e489] [cursor=pointer]
                - row [ref=f2e497]:
                  - cell [ref=f2e498]:
                    - time [ref=f2e499]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e500]
                  - cell "Automatique" [ref=f2e503]
                  - cell "Autre action" [ref=f2e504]
                  - cell "Paiement" [ref=f2e505]
                  - cell [ref=f2e506]:
                    - button "Examiner" [ref=f2e507] [cursor=pointer]
                - row [ref=f2e515]:
                  - cell [ref=f2e516]:
                    - time [ref=f2e517]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e518]
                  - cell "Automatique" [ref=f2e521]
                  - cell "Autre action" [ref=f2e522]
                  - cell "Paiement" [ref=f2e523]
                  - cell [ref=f2e524]:
                    - button "Examiner" [ref=f2e525] [cursor=pointer]
                - row [ref=f2e533]:
                  - cell [ref=f2e534]:
                    - time [ref=f2e535]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e536]
                  - cell "Automatique" [ref=f2e539]
                  - cell "Autre action" [ref=f2e540]
                  - cell "Paiement" [ref=f2e541]
                  - cell [ref=f2e542]:
                    - button "Examiner" [ref=f2e543] [cursor=pointer]
                - row [ref=f2e551]:
                  - cell [ref=f2e552]:
                    - time [ref=f2e553]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e554]
                  - cell "Automatique" [ref=f2e557]
                  - cell "Autre action" [ref=f2e558]
                  - cell "Paiement" [ref=f2e559]
                  - cell [ref=f2e560]:
                    - button "Examiner" [ref=f2e561] [cursor=pointer]
                - row [ref=f2e569]:
                  - cell [ref=f2e570]:
                    - time [ref=f2e571]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e572]
                  - cell "Automatique" [ref=f2e575]
                  - cell "Autre action" [ref=f2e576]
                  - cell "Paiement" [ref=f2e577]
                  - cell [ref=f2e578]:
                    - button "Examiner" [ref=f2e579] [cursor=pointer]
                - row [ref=f2e587]:
                  - cell [ref=f2e588]:
                    - time [ref=f2e589]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e590]
                  - cell "Automatique" [ref=f2e593]
                  - cell "Autre action" [ref=f2e594]
                  - cell "Paiement" [ref=f2e595]
                  - cell [ref=f2e596]:
                    - button "Examiner" [ref=f2e597] [cursor=pointer]
                - row [ref=f2e605]:
                  - cell [ref=f2e606]:
                    - time [ref=f2e607]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e608]
                  - cell "Automatique" [ref=f2e611]
                  - cell "Autre action" [ref=f2e612]
                  - cell "Paiement" [ref=f2e613]
                  - cell [ref=f2e614]:
                    - button "Examiner" [ref=f2e615] [cursor=pointer]
                - row [ref=f2e623]:
                  - cell [ref=f2e624]:
                    - time [ref=f2e625]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e626]
                  - cell "Automatique" [ref=f2e629]
                  - cell "Autre action" [ref=f2e630]
                  - cell "Paiement" [ref=f2e631]
                  - cell [ref=f2e632]:
                    - button "Examiner" [ref=f2e633] [cursor=pointer]
                - row [ref=f2e641]:
                  - cell [ref=f2e642]:
                    - time [ref=f2e643]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e644]
                  - cell "Automatique" [ref=f2e647]
                  - cell "Autre action" [ref=f2e648]
                  - cell "Paiement" [ref=f2e649]
                  - cell [ref=f2e650]:
                    - button "Examiner" [ref=f2e651] [cursor=pointer]
                - row [ref=f2e659]:
                  - cell [ref=f2e660]:
                    - time [ref=f2e661]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e662]
                  - cell "Automatique" [ref=f2e665]
                  - cell "Autre action" [ref=f2e666]
                  - cell "Paiement" [ref=f2e667]
                  - cell [ref=f2e668]:
                    - button "Examiner" [ref=f2e669] [cursor=pointer]
                - row [ref=f2e677]:
                  - cell [ref=f2e678]:
                    - time [ref=f2e679]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e680]
                  - cell "Automatique" [ref=f2e683]
                  - cell "Autre action" [ref=f2e684]
                  - cell "Paiement" [ref=f2e685]
                  - cell [ref=f2e686]:
                    - button "Examiner" [ref=f2e687] [cursor=pointer]
                - row [ref=f2e695]:
                  - cell [ref=f2e696]:
                    - time [ref=f2e697]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e698]
                  - cell "Automatique" [ref=f2e701]
                  - cell "Autre action" [ref=f2e702]
                  - cell "Paiement" [ref=f2e703]
                  - cell [ref=f2e704]:
                    - button "Examiner" [ref=f2e705] [cursor=pointer]
                - row [ref=f2e713]:
                  - cell [ref=f2e714]:
                    - time [ref=f2e715]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e716]
                  - cell "Automatique" [ref=f2e719]
                  - cell "Autre action" [ref=f2e720]
                  - cell "Paiement" [ref=f2e721]
                  - cell [ref=f2e722]:
                    - button "Examiner" [ref=f2e723] [cursor=pointer]
                - row [ref=f2e731]:
                  - cell [ref=f2e732]:
                    - time [ref=f2e733]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e734]
                  - cell "Automatique" [ref=f2e737]
                  - cell "Autre action" [ref=f2e738]
                  - cell "Paiement" [ref=f2e739]
                  - cell [ref=f2e740]:
                    - button "Examiner" [ref=f2e741] [cursor=pointer]
                - row [ref=f2e749]:
                  - cell [ref=f2e750]:
                    - time [ref=f2e751]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e752]
                  - cell "Automatique" [ref=f2e755]
                  - cell "Autre action" [ref=f2e756]
                  - cell "Paiement" [ref=f2e757]
                  - cell [ref=f2e758]:
                    - button "Examiner" [ref=f2e759] [cursor=pointer]
                - row [ref=f2e767]:
                  - cell [ref=f2e768]:
                    - time [ref=f2e769]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e770]
                  - cell "Automatique" [ref=f2e773]
                  - cell "Autre action" [ref=f2e774]
                  - cell "Paiement" [ref=f2e775]
                  - cell [ref=f2e776]:
                    - button "Examiner" [ref=f2e777] [cursor=pointer]
                - row [ref=f2e785]:
                  - cell [ref=f2e786]:
                    - time [ref=f2e787]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e788]
                  - cell "Automatique" [ref=f2e791]
                  - cell "Autre action" [ref=f2e792]
                  - cell "Paiement" [ref=f2e793]
                  - cell [ref=f2e794]:
                    - button "Examiner" [ref=f2e795] [cursor=pointer]
                - row [ref=f2e803]:
                  - cell [ref=f2e804]:
                    - time [ref=f2e805]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e806]
                  - cell "Automatique" [ref=f2e809]
                  - cell "Autre action" [ref=f2e810]
                  - cell "Paiement" [ref=f2e811]
                  - cell [ref=f2e812]:
                    - button "Examiner" [ref=f2e813] [cursor=pointer]
                - row [ref=f2e821]:
                  - cell [ref=f2e822]:
                    - time [ref=f2e823]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e824]
                  - cell "Automatique" [ref=f2e827]
                  - cell "Autre action" [ref=f2e828]
                  - cell "Paiement" [ref=f2e829]
                  - cell [ref=f2e830]:
                    - button "Examiner" [ref=f2e831] [cursor=pointer]
                - row [ref=f2e839]:
                  - cell [ref=f2e840]:
                    - time [ref=f2e841]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e842]
                  - cell "Automatique" [ref=f2e845]
                  - cell "Autre action" [ref=f2e846]
                  - cell "Paiement" [ref=f2e847]
                  - cell [ref=f2e848]:
                    - button "Examiner" [ref=f2e849] [cursor=pointer]
                - row [ref=f2e857]:
                  - cell [ref=f2e858]:
                    - time [ref=f2e859]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e860]
                  - cell "Automatique" [ref=f2e863]
                  - cell "Autre action" [ref=f2e864]
                  - cell "Paiement" [ref=f2e865]
                  - cell [ref=f2e866]:
                    - button "Examiner" [ref=f2e867] [cursor=pointer]
                - row [ref=f2e875]:
                  - cell [ref=f2e876]:
                    - time [ref=f2e877]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e878]
                  - cell "Automatique" [ref=f2e881]
                  - cell "Autre action" [ref=f2e882]
                  - cell "Paiement" [ref=f2e883]
                  - cell [ref=f2e884]:
                    - button "Examiner" [ref=f2e885] [cursor=pointer]
                - row [ref=f2e893]:
                  - cell [ref=f2e894]:
                    - time [ref=f2e895]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e896]
                  - cell "Automatique" [ref=f2e899]
                  - cell "Autre action" [ref=f2e900]
                  - cell "Paiement" [ref=f2e901]
                  - cell [ref=f2e902]:
                    - button "Examiner" [ref=f2e903] [cursor=pointer]
                - row [ref=f2e911]:
                  - cell [ref=f2e912]:
                    - time [ref=f2e913]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e914]
                  - cell "Automatique" [ref=f2e917]
                  - cell "Autre action" [ref=f2e918]
                  - cell "Paiement" [ref=f2e919]
                  - cell [ref=f2e920]:
                    - button "Examiner" [ref=f2e921] [cursor=pointer]
                - row [ref=f2e929]:
                  - cell [ref=f2e930]:
                    - time [ref=f2e931]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e932]
                  - cell "Automatique" [ref=f2e935]
                  - cell "Autre action" [ref=f2e936]
                  - cell "Paiement" [ref=f2e937]
                  - cell [ref=f2e938]:
                    - button "Examiner" [ref=f2e939] [cursor=pointer]
                - row [ref=f2e947]:
                  - cell [ref=f2e948]:
                    - time [ref=f2e949]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e950]
                  - cell "Automatique" [ref=f2e953]
                  - cell "Autre action" [ref=f2e954]
                  - cell "Paiement" [ref=f2e955]
                  - cell [ref=f2e956]:
                    - button "Examiner" [ref=f2e957] [cursor=pointer]
                - row [ref=f2e965]:
                  - cell [ref=f2e966]:
                    - time [ref=f2e967]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e968]
                  - cell "Automatique" [ref=f2e971]
                  - cell "Autre action" [ref=f2e972]
                  - cell "Paiement" [ref=f2e973]
                  - cell [ref=f2e974]:
                    - button "Examiner" [ref=f2e975] [cursor=pointer]
                - row [ref=f2e983]:
                  - cell [ref=f2e984]:
                    - time [ref=f2e985]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e986]
                  - cell "Automatique" [ref=f2e989]
                  - cell "Autre action" [ref=f2e990]
                  - cell "Paiement" [ref=f2e991]
                  - cell [ref=f2e992]:
                    - button "Examiner" [ref=f2e993] [cursor=pointer]
                - row [ref=f2e1001]:
                  - cell [ref=f2e1002]:
                    - time [ref=f2e1003]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1004]
                  - cell "Automatique" [ref=f2e1007]
                  - cell "Autre action" [ref=f2e1008]
                  - cell "Paiement" [ref=f2e1009]
                  - cell [ref=f2e1010]:
                    - button "Examiner" [ref=f2e1011] [cursor=pointer]
                - row [ref=f2e1019]:
                  - cell [ref=f2e1020]:
                    - time [ref=f2e1021]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1022]
                  - cell "Automatique" [ref=f2e1025]
                  - cell "Autre action" [ref=f2e1026]
                  - cell "Paiement" [ref=f2e1027]
                  - cell [ref=f2e1028]:
                    - button "Examiner" [ref=f2e1029] [cursor=pointer]
                - row [ref=f2e1037]:
                  - cell [ref=f2e1038]:
                    - time [ref=f2e1039]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1040]
                  - cell "Automatique" [ref=f2e1043]
                  - cell "Autre action" [ref=f2e1044]
                  - cell "Paiement" [ref=f2e1045]
                  - cell [ref=f2e1046]:
                    - button "Examiner" [ref=f2e1047] [cursor=pointer]
                - row [ref=f2e1055]:
                  - cell [ref=f2e1056]:
                    - time [ref=f2e1057]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1058]
                  - cell "Automatique" [ref=f2e1061]
                  - cell "Autre action" [ref=f2e1062]
                  - cell "Paiement" [ref=f2e1063]
                  - cell [ref=f2e1064]:
                    - button "Examiner" [ref=f2e1065] [cursor=pointer]
                - row [ref=f2e1073]:
                  - cell [ref=f2e1074]:
                    - time [ref=f2e1075]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1076]
                  - cell "Automatique" [ref=f2e1079]
                  - cell "Autre action" [ref=f2e1080]
                  - cell "Paiement" [ref=f2e1081]
                  - cell [ref=f2e1082]:
                    - button "Examiner" [ref=f2e1083] [cursor=pointer]
                - row [ref=f2e1091]:
                  - cell [ref=f2e1092]:
                    - time [ref=f2e1093]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1094]
                  - cell "Automatique" [ref=f2e1097]
                  - cell "Autre action" [ref=f2e1098]
                  - cell "Paiement" [ref=f2e1099]
                  - cell [ref=f2e1100]:
                    - button "Examiner" [ref=f2e1101] [cursor=pointer]
                - row [ref=f2e1109]:
                  - cell [ref=f2e1110]:
                    - time [ref=f2e1111]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1112]
                  - cell "Automatique" [ref=f2e1115]
                  - cell "Autre action" [ref=f2e1116]
                  - cell "Paiement" [ref=f2e1117]
                  - cell [ref=f2e1118]:
                    - button "Examiner" [ref=f2e1119] [cursor=pointer]
                - row [ref=f2e1127]:
                  - cell [ref=f2e1128]:
                    - time [ref=f2e1129]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1130]
                  - cell "Automatique" [ref=f2e1133]
                  - cell "Autre action" [ref=f2e1134]
                  - cell "Paiement" [ref=f2e1135]
                  - cell [ref=f2e1136]:
                    - button "Examiner" [ref=f2e1137] [cursor=pointer]
                - row [ref=f2e1145]:
                  - cell [ref=f2e1146]:
                    - time [ref=f2e1147]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1148]
                  - cell "Automatique" [ref=f2e1151]
                  - cell "Autre action" [ref=f2e1152]
                  - cell "Paiement" [ref=f2e1153]
                  - cell [ref=f2e1154]:
                    - button "Examiner" [ref=f2e1155] [cursor=pointer]
                - row [ref=f2e1163]:
                  - cell [ref=f2e1164]:
                    - time [ref=f2e1165]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1166]
                  - cell "Automatique" [ref=f2e1169]
                  - cell "Autre action" [ref=f2e1170]
                  - cell "Paiement" [ref=f2e1171]
                  - cell [ref=f2e1172]:
                    - button "Examiner" [ref=f2e1173] [cursor=pointer]
                - row [ref=f2e1181]:
                  - cell [ref=f2e1182]:
                    - time [ref=f2e1183]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1184]
                  - cell "Automatique" [ref=f2e1187]
                  - cell "Autre action" [ref=f2e1188]
                  - cell "Paiement" [ref=f2e1189]
                  - cell [ref=f2e1190]:
                    - button "Examiner" [ref=f2e1191] [cursor=pointer]
                - row [ref=f2e1199]:
                  - cell [ref=f2e1200]:
                    - time [ref=f2e1201]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1202]
                  - cell "Automatique" [ref=f2e1205]
                  - cell "Autre action" [ref=f2e1206]
                  - cell "Paiement" [ref=f2e1207]
                  - cell [ref=f2e1208]:
                    - button "Examiner" [ref=f2e1209] [cursor=pointer]
                - row [ref=f2e1217]:
                  - cell [ref=f2e1218]:
                    - time [ref=f2e1219]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1220]
                  - cell "Automatique" [ref=f2e1223]
                  - cell "Autre action" [ref=f2e1224]
                  - cell "Paiement" [ref=f2e1225]
                  - cell [ref=f2e1226]:
                    - button "Examiner" [ref=f2e1227] [cursor=pointer]
                - row [ref=f2e1235]:
                  - cell [ref=f2e1236]:
                    - time [ref=f2e1237]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1238]
                  - cell "Automatique" [ref=f2e1241]
                  - cell "Autre action" [ref=f2e1242]
                  - cell "Paiement" [ref=f2e1243]
                  - cell [ref=f2e1244]:
                    - button "Examiner" [ref=f2e1245] [cursor=pointer]
                - row [ref=f2e1253]:
                  - cell [ref=f2e1254]:
                    - time [ref=f2e1255]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1256]
                  - cell "Automatique" [ref=f2e1259]
                  - cell "Autre action" [ref=f2e1260]
                  - cell "Paiement" [ref=f2e1261]
                  - cell [ref=f2e1262]:
                    - button "Examiner" [ref=f2e1263] [cursor=pointer]
                - row [ref=f2e1271]:
                  - cell [ref=f2e1272]:
                    - time [ref=f2e1273]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1274]
                  - cell "Automatique" [ref=f2e1277]
                  - cell "Autre action" [ref=f2e1278]
                  - cell "Paiement" [ref=f2e1279]
                  - cell [ref=f2e1280]:
                    - button "Examiner" [ref=f2e1281] [cursor=pointer]
                - row [ref=f2e1289]:
                  - cell [ref=f2e1290]:
                    - time [ref=f2e1291]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1292]
                  - cell "Automatique" [ref=f2e1295]
                  - cell "Autre action" [ref=f2e1296]
                  - cell "Paiement" [ref=f2e1297]
                  - cell [ref=f2e1298]:
                    - button "Examiner" [ref=f2e1299] [cursor=pointer]
                - row [ref=f2e1307]:
                  - cell [ref=f2e1308]:
                    - time [ref=f2e1309]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1310]
                  - cell "Automatique" [ref=f2e1313]
                  - cell "Autre action" [ref=f2e1314]
                  - cell "Paiement" [ref=f2e1315]
                  - cell [ref=f2e1316]:
                    - button "Examiner" [ref=f2e1317] [cursor=pointer]
                - row [ref=f2e1325]:
                  - cell [ref=f2e1326]:
                    - time [ref=f2e1327]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1328]
                  - cell "Automatique" [ref=f2e1331]
                  - cell "Autre action" [ref=f2e1332]
                  - cell "Paiement" [ref=f2e1333]
                  - cell [ref=f2e1334]:
                    - button "Examiner" [ref=f2e1335] [cursor=pointer]
                - row [ref=f2e1343]:
                  - cell [ref=f2e1344]:
                    - time [ref=f2e1345]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1346]
                  - cell "Automatique" [ref=f2e1349]
                  - cell "Autre action" [ref=f2e1350]
                  - cell "Paiement" [ref=f2e1351]
                  - cell [ref=f2e1352]:
                    - button "Examiner" [ref=f2e1353] [cursor=pointer]
                - row [ref=f2e1361]:
                  - cell [ref=f2e1362]:
                    - time [ref=f2e1363]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1364]
                  - cell "Automatique" [ref=f2e1367]
                  - cell "Autre action" [ref=f2e1368]
                  - cell "Paiement" [ref=f2e1369]
                  - cell [ref=f2e1370]:
                    - button "Examiner" [ref=f2e1371] [cursor=pointer]
                - row [ref=f2e1379]:
                  - cell [ref=f2e1380]:
                    - time [ref=f2e1381]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1382]
                  - cell "Automatique" [ref=f2e1385]
                  - cell "Autre action" [ref=f2e1386]
                  - cell "Paiement" [ref=f2e1387]
                  - cell [ref=f2e1388]:
                    - button "Examiner" [ref=f2e1389] [cursor=pointer]
                - row [ref=f2e1397]:
                  - cell [ref=f2e1398]:
                    - time [ref=f2e1399]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1400]
                  - cell "Automatique" [ref=f2e1403]
                  - cell "Autre action" [ref=f2e1404]
                  - cell "Paiement" [ref=f2e1405]
                  - cell [ref=f2e1406]:
                    - button "Examiner" [ref=f2e1407] [cursor=pointer]
                - row [ref=f2e1415]:
                  - cell [ref=f2e1416]:
                    - time [ref=f2e1417]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1418]
                  - cell "Automatique" [ref=f2e1421]
                  - cell "Autre action" [ref=f2e1422]
                  - cell "Paiement" [ref=f2e1423]
                  - cell [ref=f2e1424]:
                    - button "Examiner" [ref=f2e1425] [cursor=pointer]
                - row [ref=f2e1433]:
                  - cell [ref=f2e1434]:
                    - time [ref=f2e1435]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1436]
                  - cell "Automatique" [ref=f2e1439]
                  - cell "Autre action" [ref=f2e1440]
                  - cell "Paiement" [ref=f2e1441]
                  - cell [ref=f2e1442]:
                    - button "Examiner" [ref=f2e1443] [cursor=pointer]
                - row [ref=f2e1451]:
                  - cell [ref=f2e1452]:
                    - time [ref=f2e1453]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1454]
                  - cell "Automatique" [ref=f2e1457]
                  - cell "Autre action" [ref=f2e1458]
                  - cell "Paiement" [ref=f2e1459]
                  - cell [ref=f2e1460]:
                    - button "Examiner" [ref=f2e1461] [cursor=pointer]
                - row [ref=f2e1469]:
                  - cell [ref=f2e1470]:
                    - time [ref=f2e1471]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1472]
                  - cell "Automatique" [ref=f2e1475]
                  - cell "Autre action" [ref=f2e1476]
                  - cell "Paiement" [ref=f2e1477]
                  - cell [ref=f2e1478]:
                    - button "Examiner" [ref=f2e1479] [cursor=pointer]
                - row [ref=f2e1487]:
                  - cell [ref=f2e1488]:
                    - time [ref=f2e1489]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1490]
                  - cell "Automatique" [ref=f2e1493]
                  - cell "Autre action" [ref=f2e1494]
                  - cell "Paiement" [ref=f2e1495]
                  - cell [ref=f2e1496]:
                    - button "Examiner" [ref=f2e1497] [cursor=pointer]
                - row [ref=f2e1505]:
                  - cell [ref=f2e1506]:
                    - time [ref=f2e1507]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1508]
                  - cell "Automatique" [ref=f2e1511]
                  - cell "Autre action" [ref=f2e1512]
                  - cell "Paiement" [ref=f2e1513]
                  - cell [ref=f2e1514]:
                    - button "Examiner" [ref=f2e1515] [cursor=pointer]
                - row [ref=f2e1523]:
                  - cell [ref=f2e1524]:
                    - time [ref=f2e1525]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1526]
                  - cell "Automatique" [ref=f2e1529]
                  - cell "Autre action" [ref=f2e1530]
                  - cell "Paiement" [ref=f2e1531]
                  - cell [ref=f2e1532]:
                    - button "Examiner" [ref=f2e1533] [cursor=pointer]
                - row [ref=f2e1541]:
                  - cell [ref=f2e1542]:
                    - time [ref=f2e1543]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1544]
                  - cell "Automatique" [ref=f2e1547]
                  - cell "Autre action" [ref=f2e1548]
                  - cell "Paiement" [ref=f2e1549]
                  - cell [ref=f2e1550]:
                    - button "Examiner" [ref=f2e1551] [cursor=pointer]
                - row [ref=f2e1559]:
                  - cell [ref=f2e1560]:
                    - time [ref=f2e1561]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1562]
                  - cell "Automatique" [ref=f2e1565]
                  - cell "Autre action" [ref=f2e1566]
                  - cell "Paiement" [ref=f2e1567]
                  - cell [ref=f2e1568]:
                    - button "Examiner" [ref=f2e1569] [cursor=pointer]
                - row [ref=f2e1577]:
                  - cell [ref=f2e1578]:
                    - time [ref=f2e1579]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1580]
                  - cell "Automatique" [ref=f2e1583]
                  - cell "Autre action" [ref=f2e1584]
                  - cell "Paiement" [ref=f2e1585]
                  - cell [ref=f2e1586]:
                    - button "Examiner" [ref=f2e1587] [cursor=pointer]
                - row [ref=f2e1595]:
                  - cell [ref=f2e1596]:
                    - time [ref=f2e1597]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1598]
                  - cell "Automatique" [ref=f2e1601]
                  - cell "Autre action" [ref=f2e1602]
                  - cell "Paiement" [ref=f2e1603]
                  - cell [ref=f2e1604]:
                    - button "Examiner" [ref=f2e1605] [cursor=pointer]
                - row [ref=f2e1613]:
                  - cell [ref=f2e1614]:
                    - time [ref=f2e1615]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1616]
                  - cell "Automatique" [ref=f2e1619]
                  - cell "Autre action" [ref=f2e1620]
                  - cell "Paiement" [ref=f2e1621]
                  - cell [ref=f2e1622]:
                    - button "Examiner" [ref=f2e1623] [cursor=pointer]
                - row [ref=f2e1631]:
                  - cell [ref=f2e1632]:
                    - time [ref=f2e1633]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1634]
                  - cell "Automatique" [ref=f2e1637]
                  - cell "Autre action" [ref=f2e1638]
                  - cell "Paiement" [ref=f2e1639]
                  - cell [ref=f2e1640]:
                    - button "Examiner" [ref=f2e1641] [cursor=pointer]
                - row [ref=f2e1649]:
                  - cell [ref=f2e1650]:
                    - time [ref=f2e1651]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1652]
                  - cell "Automatique" [ref=f2e1655]
                  - cell "Autre action" [ref=f2e1656]
                  - cell "Paiement" [ref=f2e1657]
                  - cell [ref=f2e1658]:
                    - button "Examiner" [ref=f2e1659] [cursor=pointer]
                - row [ref=f2e1667]:
                  - cell [ref=f2e1668]:
                    - time [ref=f2e1669]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1670]
                  - cell "Automatique" [ref=f2e1673]
                  - cell "Autre action" [ref=f2e1674]
                  - cell "Paiement" [ref=f2e1675]
                  - cell [ref=f2e1676]:
                    - button "Examiner" [ref=f2e1677] [cursor=pointer]
                - row [ref=f2e1685]:
                  - cell [ref=f2e1686]:
                    - time [ref=f2e1687]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1688]
                  - cell "Automatique" [ref=f2e1691]
                  - cell "Autre action" [ref=f2e1692]
                  - cell "Paiement" [ref=f2e1693]
                  - cell [ref=f2e1694]:
                    - button "Examiner" [ref=f2e1695] [cursor=pointer]
                - row [ref=f2e1703]:
                  - cell [ref=f2e1704]:
                    - time [ref=f2e1705]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1706]
                  - cell "Automatique" [ref=f2e1709]
                  - cell "Autre action" [ref=f2e1710]
                  - cell "Paiement" [ref=f2e1711]
                  - cell [ref=f2e1712]:
                    - button "Examiner" [ref=f2e1713] [cursor=pointer]
                - row [ref=f2e1721]:
                  - cell [ref=f2e1722]:
                    - time [ref=f2e1723]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1724]
                  - cell "Automatique" [ref=f2e1727]
                  - cell "Autre action" [ref=f2e1728]
                  - cell "Paiement" [ref=f2e1729]
                  - cell [ref=f2e1730]:
                    - button "Examiner" [ref=f2e1731] [cursor=pointer]
                - row [ref=f2e1739]:
                  - cell [ref=f2e1740]:
                    - time [ref=f2e1741]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1742]
                  - cell "Automatique" [ref=f2e1745]
                  - cell "Autre action" [ref=f2e1746]
                  - cell "Paiement" [ref=f2e1747]
                  - cell [ref=f2e1748]:
                    - button "Examiner" [ref=f2e1749] [cursor=pointer]
                - row [ref=f2e1757]:
                  - cell [ref=f2e1758]:
                    - time [ref=f2e1759]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1760]
                  - cell "Automatique" [ref=f2e1763]
                  - cell "Autre action" [ref=f2e1764]
                  - cell "Paiement" [ref=f2e1765]
                  - cell [ref=f2e1766]:
                    - button "Examiner" [ref=f2e1767] [cursor=pointer]
                - row [ref=f2e1775]:
                  - cell [ref=f2e1776]:
                    - time [ref=f2e1777]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1778]
                  - cell "Automatique" [ref=f2e1781]
                  - cell "Autre action" [ref=f2e1782]
                  - cell "Paiement" [ref=f2e1783]
                  - cell [ref=f2e1784]:
                    - button "Examiner" [ref=f2e1785] [cursor=pointer]
                - row [ref=f2e1793]:
                  - cell [ref=f2e1794]:
                    - time [ref=f2e1795]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1796]
                  - cell "Automatique" [ref=f2e1799]
                  - cell "Autre action" [ref=f2e1800]
                  - cell "Paiement" [ref=f2e1801]
                  - cell [ref=f2e1802]:
                    - button "Examiner" [ref=f2e1803] [cursor=pointer]
                - row [ref=f2e1811]:
                  - cell [ref=f2e1812]:
                    - time [ref=f2e1813]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1814]
                  - cell "Automatique" [ref=f2e1817]
                  - cell "Autre action" [ref=f2e1818]
                  - cell "Paiement" [ref=f2e1819]
                  - cell [ref=f2e1820]:
                    - button "Examiner" [ref=f2e1821] [cursor=pointer]
                - row [ref=f2e1829]:
                  - cell [ref=f2e1830]:
                    - time [ref=f2e1831]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1832]
                  - cell "Automatique" [ref=f2e1835]
                  - cell "Autre action" [ref=f2e1836]
                  - cell "Paiement" [ref=f2e1837]
                  - cell [ref=f2e1838]:
                    - button "Examiner" [ref=f2e1839] [cursor=pointer]
                - row [ref=f2e1847]:
                  - cell [ref=f2e1848]:
                    - time [ref=f2e1849]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1850]
                  - cell "Automatique" [ref=f2e1853]
                  - cell "Autre action" [ref=f2e1854]
                  - cell "Paiement" [ref=f2e1855]
                  - cell [ref=f2e1856]:
                    - button "Examiner" [ref=f2e1857] [cursor=pointer]
                - row [ref=f2e1865]:
                  - cell [ref=f2e1866]:
                    - time [ref=f2e1867]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1868]
                  - cell "Automatique" [ref=f2e1871]
                  - cell "Autre action" [ref=f2e1872]
                  - cell "Paiement" [ref=f2e1873]
                  - cell [ref=f2e1874]:
                    - button "Examiner" [ref=f2e1875] [cursor=pointer]
                - row [ref=f2e1883]:
                  - cell [ref=f2e1884]:
                    - time [ref=f2e1885]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1886]
                  - cell "Automatique" [ref=f2e1889]
                  - cell "Autre action" [ref=f2e1890]
                  - cell "Paiement" [ref=f2e1891]
                  - cell [ref=f2e1892]:
                    - button "Examiner" [ref=f2e1893] [cursor=pointer]
                - row [ref=f2e1901]:
                  - cell [ref=f2e1902]:
                    - time [ref=f2e1903]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1904]
                  - cell "Automatique" [ref=f2e1907]
                  - cell "Autre action" [ref=f2e1908]
                  - cell "Paiement" [ref=f2e1909]
                  - cell [ref=f2e1910]:
                    - button "Examiner" [ref=f2e1911] [cursor=pointer]
                - row [ref=f2e1919]:
                  - cell [ref=f2e1920]:
                    - time [ref=f2e1921]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1922]
                  - cell "Automatique" [ref=f2e1925]
                  - cell "Autre action" [ref=f2e1926]
                  - cell "Paiement" [ref=f2e1927]
                  - cell [ref=f2e1928]:
                    - button "Examiner" [ref=f2e1929] [cursor=pointer]
                - row [ref=f2e1937]:
                  - cell [ref=f2e1938]:
                    - time [ref=f2e1939]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1940]
                  - cell "Automatique" [ref=f2e1943]
                  - cell "Autre action" [ref=f2e1944]
                  - cell "Paiement" [ref=f2e1945]
                  - cell [ref=f2e1946]:
                    - button "Examiner" [ref=f2e1947] [cursor=pointer]
                - row [ref=f2e1955]:
                  - cell [ref=f2e1956]:
                    - time [ref=f2e1957]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1958]
                  - cell "Automatique" [ref=f2e1961]
                  - cell "Autre action" [ref=f2e1962]
                  - cell "Paiement" [ref=f2e1963]
                  - cell [ref=f2e1964]:
                    - button "Examiner" [ref=f2e1965] [cursor=pointer]
                - row [ref=f2e1973]:
                  - cell [ref=f2e1974]:
                    - time [ref=f2e1975]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1976]
                  - cell "Automatique" [ref=f2e1979]
                  - cell "Autre action" [ref=f2e1980]
                  - cell "Paiement" [ref=f2e1981]
                  - cell [ref=f2e1982]:
                    - button "Examiner" [ref=f2e1983] [cursor=pointer]
                - row [ref=f2e1991]:
                  - cell [ref=f2e1992]:
                    - time [ref=f2e1993]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f2e1994]
                  - cell "Automatique" [ref=f2e1997]
                  - cell "Autre action" [ref=f2e1998]
                  - cell "Paiement" [ref=f2e1999]
                  - cell [ref=f2e2000]:
                    - button "Examiner" [ref=f2e2001] [cursor=pointer]
  - alert [ref=f2e2009]
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
      |                                                                                        ^ Error: contrôles responsive de adm-journal (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```