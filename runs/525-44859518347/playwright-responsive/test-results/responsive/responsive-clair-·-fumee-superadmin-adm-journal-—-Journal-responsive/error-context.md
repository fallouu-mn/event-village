# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-journal — Journal
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-journal (clair)

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
          - generic [ref=f5e159]:
            - link "Accueil de l’administration" [ref=f5e161] [cursor=pointer]:
              - /url: /admin/dashboard
            - generic [ref=f5e166]:
              - generic [ref=f5e167]:
                - heading "Journal" [level=1] [ref=f5e168]
                - paragraph [ref=f5e169]: "Les actions sensibles de l’administration : qui, quand, sur quoi. Les 100 plus récentes."
              - button "Actualiser" [ref=f5e171] [cursor=pointer]
          - generic [ref=f5e179]:
            - generic [ref=f5e180]:
              - generic [ref=f5e181]: Action
              - combobox "Action" [ref=f5e184] [cursor=pointer]:
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
            - generic [ref=f5e185]:
              - generic [ref=f5e186]: Objet
              - combobox "Objet" [ref=f5e189] [cursor=pointer]:
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
            - paragraph [ref=f5e190]: 100 entrées
          - region "Journal des actions" [ref=f5e192]:
            - table [ref=f5e193]:
              - caption [ref=f5e194]: Journal des actions
              - rowgroup [ref=f5e195]:
                - row [ref=f5e196]:
                  - columnheader "Date" [ref=f5e197]
                  - columnheader "Auteur" [ref=f5e198]
                  - columnheader "Rôle à l’action" [ref=f5e199]
                  - columnheader "Action" [ref=f5e200]
                  - columnheader "Objet" [ref=f5e201]
                  - columnheader "Détail" [ref=f5e202]
              - rowgroup [ref=f5e203]:
                - row [ref=f5e204]:
                  - cell [ref=f5e205]:
                    - time [ref=f5e206]: sam. 21 nov. 2026 à 03:13
                  - cell "Système" [ref=f5e207]
                  - cell "Automatique" [ref=f5e210]
                  - cell "Autre action" [ref=f5e211]
                  - cell "Paiement" [ref=f5e212]
                  - cell [ref=f5e213]:
                    - button "Examiner" [ref=f5e214] [cursor=pointer]
                - row [ref=f5e222]:
                  - cell [ref=f5e223]:
                    - time [ref=f5e224]: sam. 21 nov. 2026 à 03:12
                  - cell "Système" [ref=f5e225]
                  - cell "Automatique" [ref=f5e228]
                  - cell "Autre action" [ref=f5e229]
                  - cell "Paiement" [ref=f5e230]
                  - cell [ref=f5e231]:
                    - button "Examiner" [ref=f5e232] [cursor=pointer]
                - row [ref=f5e240]:
                  - cell [ref=f5e241]:
                    - time [ref=f5e242]: sam. 21 nov. 2026 à 03:12
                  - cell "Système" [ref=f5e243]
                  - cell "Automatique" [ref=f5e246]
                  - cell "Autre action" [ref=f5e247]
                  - cell "Paiement" [ref=f5e248]
                  - cell [ref=f5e249]:
                    - button "Examiner" [ref=f5e250] [cursor=pointer]
                - row [ref=f5e258]:
                  - cell [ref=f5e259]:
                    - time [ref=f5e260]: sam. 21 nov. 2026 à 03:12
                  - cell "Système" [ref=f5e261]
                  - cell "Automatique" [ref=f5e264]
                  - cell "Autre action" [ref=f5e265]
                  - cell "Paiement" [ref=f5e266]
                  - cell [ref=f5e267]:
                    - button "Examiner" [ref=f5e268] [cursor=pointer]
                - row [ref=f5e276]:
                  - cell [ref=f5e277]:
                    - time [ref=f5e278]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Super-administrateur" [ref=f5e279]':
                    - generic [ref=f5e280]:
                      - generic [ref=f5e281]: Elhadji SuperAdmin
                      - generic [ref=f5e282]: "Aujourd’hui : Super-administrateur"
                  - cell "Automatique" [ref=f5e283]
                  - cell "Autre action" [ref=f5e284]
                  - cell "Compte" [ref=f5e285]
                  - cell [ref=f5e286]:
                    - button "Examiner" [ref=f5e287] [cursor=pointer]
                - row [ref=f5e295]:
                  - cell [ref=f5e296]:
                    - time [ref=f5e297]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Aïda Diallo Aujourd’hui : Administrateur" [ref=f5e298]':
                    - generic [ref=f5e299]:
                      - generic [ref=f5e300]: Aïda Diallo
                      - generic [ref=f5e301]: "Aujourd’hui : Administrateur"
                  - cell "Automatique" [ref=f5e302]
                  - cell "Autre action" [ref=f5e303]
                  - cell "Compte" [ref=f5e304]
                  - cell [ref=f5e305]:
                    - button "Examiner" [ref=f5e306] [cursor=pointer]
                - row [ref=f5e314]:
                  - cell [ref=f5e315]:
                    - time [ref=f5e316]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Fatou Mbaye Aujourd’hui : Client" [ref=f5e317]':
                    - generic [ref=f5e318]:
                      - generic [ref=f5e319]: Fatou Mbaye
                      - generic [ref=f5e320]: "Aujourd’hui : Client"
                  - cell "Client" [ref=f5e321]
                  - cell "Autre action" [ref=f5e322]
                  - cell "Autre" [ref=f5e323]
                  - cell [ref=f5e324]:
                    - button "Examiner" [ref=f5e325] [cursor=pointer]
                - row [ref=f5e333]:
                  - cell [ref=f5e334]:
                    - time [ref=f5e335]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Super-administrateur" [ref=f5e336]':
                    - generic [ref=f5e337]:
                      - generic [ref=f5e338]: Elhadji SuperAdmin
                      - generic [ref=f5e339]: "Aujourd’hui : Super-administrateur"
                  - cell "Super-administrateur" [ref=f5e340]
                  - cell "Autre action" [ref=f5e341]
                  - cell "Autre" [ref=f5e342]
                  - cell [ref=f5e343]:
                    - button "Examiner" [ref=f5e344] [cursor=pointer]
                - row [ref=f5e352]:
                  - cell [ref=f5e353]:
                    - time [ref=f5e354]: sam. 21 nov. 2026 à 03:11
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Super-administrateur" [ref=f5e355]':
                    - generic [ref=f5e356]:
                      - generic [ref=f5e357]: Elhadji SuperAdmin
                      - generic [ref=f5e358]: "Aujourd’hui : Super-administrateur"
                  - cell "Super-administrateur" [ref=f5e359]
                  - cell "Autre action" [ref=f5e360]
                  - cell "Autre" [ref=f5e361]
                  - cell [ref=f5e362]:
                    - button "Examiner" [ref=f5e363] [cursor=pointer]
                - row [ref=f5e371]:
                  - cell [ref=f5e372]:
                    - time [ref=f5e373]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e374]
                  - cell "Automatique" [ref=f5e377]
                  - cell "Autre action" [ref=f5e378]
                  - cell "Paiement" [ref=f5e379]
                  - cell [ref=f5e380]:
                    - button "Examiner" [ref=f5e381] [cursor=pointer]
                - row [ref=f5e389]:
                  - cell [ref=f5e390]:
                    - time [ref=f5e391]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e392]
                  - cell "Automatique" [ref=f5e395]
                  - cell "Autre action" [ref=f5e396]
                  - cell "Paiement" [ref=f5e397]
                  - cell [ref=f5e398]:
                    - button "Examiner" [ref=f5e399] [cursor=pointer]
                - row [ref=f5e407]:
                  - cell [ref=f5e408]:
                    - time [ref=f5e409]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e410]
                  - cell "Automatique" [ref=f5e413]
                  - cell "Autre action" [ref=f5e414]
                  - cell "Paiement" [ref=f5e415]
                  - cell [ref=f5e416]:
                    - button "Examiner" [ref=f5e417] [cursor=pointer]
                - row [ref=f5e425]:
                  - cell [ref=f5e426]:
                    - time [ref=f5e427]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e428]
                  - cell "Automatique" [ref=f5e431]
                  - cell "Autre action" [ref=f5e432]
                  - cell "Paiement" [ref=f5e433]
                  - cell [ref=f5e434]:
                    - button "Examiner" [ref=f5e435] [cursor=pointer]
                - row [ref=f5e443]:
                  - cell [ref=f5e444]:
                    - time [ref=f5e445]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e446]
                  - cell "Automatique" [ref=f5e449]
                  - cell "Autre action" [ref=f5e450]
                  - cell "Paiement" [ref=f5e451]
                  - cell [ref=f5e452]:
                    - button "Examiner" [ref=f5e453] [cursor=pointer]
                - row [ref=f5e461]:
                  - cell [ref=f5e462]:
                    - time [ref=f5e463]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e464]
                  - cell "Automatique" [ref=f5e467]
                  - cell "Autre action" [ref=f5e468]
                  - cell "Paiement" [ref=f5e469]
                  - cell [ref=f5e470]:
                    - button "Examiner" [ref=f5e471] [cursor=pointer]
                - row [ref=f5e479]:
                  - cell [ref=f5e480]:
                    - time [ref=f5e481]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e482]
                  - cell "Automatique" [ref=f5e485]
                  - cell "Autre action" [ref=f5e486]
                  - cell "Paiement" [ref=f5e487]
                  - cell [ref=f5e488]:
                    - button "Examiner" [ref=f5e489] [cursor=pointer]
                - row [ref=f5e497]:
                  - cell [ref=f5e498]:
                    - time [ref=f5e499]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e500]
                  - cell "Automatique" [ref=f5e503]
                  - cell "Autre action" [ref=f5e504]
                  - cell "Paiement" [ref=f5e505]
                  - cell [ref=f5e506]:
                    - button "Examiner" [ref=f5e507] [cursor=pointer]
                - row [ref=f5e515]:
                  - cell [ref=f5e516]:
                    - time [ref=f5e517]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e518]
                  - cell "Automatique" [ref=f5e521]
                  - cell "Autre action" [ref=f5e522]
                  - cell "Paiement" [ref=f5e523]
                  - cell [ref=f5e524]:
                    - button "Examiner" [ref=f5e525] [cursor=pointer]
                - row [ref=f5e533]:
                  - cell [ref=f5e534]:
                    - time [ref=f5e535]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e536]
                  - cell "Automatique" [ref=f5e539]
                  - cell "Autre action" [ref=f5e540]
                  - cell "Paiement" [ref=f5e541]
                  - cell [ref=f5e542]:
                    - button "Examiner" [ref=f5e543] [cursor=pointer]
                - row [ref=f5e551]:
                  - cell [ref=f5e552]:
                    - time [ref=f5e553]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e554]
                  - cell "Automatique" [ref=f5e557]
                  - cell "Autre action" [ref=f5e558]
                  - cell "Paiement" [ref=f5e559]
                  - cell [ref=f5e560]:
                    - button "Examiner" [ref=f5e561] [cursor=pointer]
                - row [ref=f5e569]:
                  - cell [ref=f5e570]:
                    - time [ref=f5e571]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e572]
                  - cell "Automatique" [ref=f5e575]
                  - cell "Autre action" [ref=f5e576]
                  - cell "Paiement" [ref=f5e577]
                  - cell [ref=f5e578]:
                    - button "Examiner" [ref=f5e579] [cursor=pointer]
                - row [ref=f5e587]:
                  - cell [ref=f5e588]:
                    - time [ref=f5e589]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e590]
                  - cell "Automatique" [ref=f5e593]
                  - cell "Autre action" [ref=f5e594]
                  - cell "Paiement" [ref=f5e595]
                  - cell [ref=f5e596]:
                    - button "Examiner" [ref=f5e597] [cursor=pointer]
                - row [ref=f5e605]:
                  - cell [ref=f5e606]:
                    - time [ref=f5e607]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e608]
                  - cell "Automatique" [ref=f5e611]
                  - cell "Autre action" [ref=f5e612]
                  - cell "Paiement" [ref=f5e613]
                  - cell [ref=f5e614]:
                    - button "Examiner" [ref=f5e615] [cursor=pointer]
                - row [ref=f5e623]:
                  - cell [ref=f5e624]:
                    - time [ref=f5e625]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e626]
                  - cell "Automatique" [ref=f5e629]
                  - cell "Autre action" [ref=f5e630]
                  - cell "Paiement" [ref=f5e631]
                  - cell [ref=f5e632]:
                    - button "Examiner" [ref=f5e633] [cursor=pointer]
                - row [ref=f5e641]:
                  - cell [ref=f5e642]:
                    - time [ref=f5e643]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e644]
                  - cell "Automatique" [ref=f5e647]
                  - cell "Autre action" [ref=f5e648]
                  - cell "Paiement" [ref=f5e649]
                  - cell [ref=f5e650]:
                    - button "Examiner" [ref=f5e651] [cursor=pointer]
                - row [ref=f5e659]:
                  - cell [ref=f5e660]:
                    - time [ref=f5e661]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e662]
                  - cell "Automatique" [ref=f5e665]
                  - cell "Autre action" [ref=f5e666]
                  - cell "Paiement" [ref=f5e667]
                  - cell [ref=f5e668]:
                    - button "Examiner" [ref=f5e669] [cursor=pointer]
                - row [ref=f5e677]:
                  - cell [ref=f5e678]:
                    - time [ref=f5e679]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e680]
                  - cell "Automatique" [ref=f5e683]
                  - cell "Autre action" [ref=f5e684]
                  - cell "Paiement" [ref=f5e685]
                  - cell [ref=f5e686]:
                    - button "Examiner" [ref=f5e687] [cursor=pointer]
                - row [ref=f5e695]:
                  - cell [ref=f5e696]:
                    - time [ref=f5e697]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e698]
                  - cell "Automatique" [ref=f5e701]
                  - cell "Autre action" [ref=f5e702]
                  - cell "Paiement" [ref=f5e703]
                  - cell [ref=f5e704]:
                    - button "Examiner" [ref=f5e705] [cursor=pointer]
                - row [ref=f5e713]:
                  - cell [ref=f5e714]:
                    - time [ref=f5e715]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e716]
                  - cell "Automatique" [ref=f5e719]
                  - cell "Autre action" [ref=f5e720]
                  - cell "Paiement" [ref=f5e721]
                  - cell [ref=f5e722]:
                    - button "Examiner" [ref=f5e723] [cursor=pointer]
                - row [ref=f5e731]:
                  - cell [ref=f5e732]:
                    - time [ref=f5e733]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e734]
                  - cell "Automatique" [ref=f5e737]
                  - cell "Autre action" [ref=f5e738]
                  - cell "Paiement" [ref=f5e739]
                  - cell [ref=f5e740]:
                    - button "Examiner" [ref=f5e741] [cursor=pointer]
                - row [ref=f5e749]:
                  - cell [ref=f5e750]:
                    - time [ref=f5e751]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e752]
                  - cell "Automatique" [ref=f5e755]
                  - cell "Autre action" [ref=f5e756]
                  - cell "Paiement" [ref=f5e757]
                  - cell [ref=f5e758]:
                    - button "Examiner" [ref=f5e759] [cursor=pointer]
                - row [ref=f5e767]:
                  - cell [ref=f5e768]:
                    - time [ref=f5e769]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e770]
                  - cell "Automatique" [ref=f5e773]
                  - cell "Autre action" [ref=f5e774]
                  - cell "Paiement" [ref=f5e775]
                  - cell [ref=f5e776]:
                    - button "Examiner" [ref=f5e777] [cursor=pointer]
                - row [ref=f5e785]:
                  - cell [ref=f5e786]:
                    - time [ref=f5e787]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e788]
                  - cell "Automatique" [ref=f5e791]
                  - cell "Autre action" [ref=f5e792]
                  - cell "Paiement" [ref=f5e793]
                  - cell [ref=f5e794]:
                    - button "Examiner" [ref=f5e795] [cursor=pointer]
                - row [ref=f5e803]:
                  - cell [ref=f5e804]:
                    - time [ref=f5e805]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e806]
                  - cell "Automatique" [ref=f5e809]
                  - cell "Autre action" [ref=f5e810]
                  - cell "Paiement" [ref=f5e811]
                  - cell [ref=f5e812]:
                    - button "Examiner" [ref=f5e813] [cursor=pointer]
                - row [ref=f5e821]:
                  - cell [ref=f5e822]:
                    - time [ref=f5e823]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e824]
                  - cell "Automatique" [ref=f5e827]
                  - cell "Autre action" [ref=f5e828]
                  - cell "Paiement" [ref=f5e829]
                  - cell [ref=f5e830]:
                    - button "Examiner" [ref=f5e831] [cursor=pointer]
                - row [ref=f5e839]:
                  - cell [ref=f5e840]:
                    - time [ref=f5e841]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e842]
                  - cell "Automatique" [ref=f5e845]
                  - cell "Autre action" [ref=f5e846]
                  - cell "Paiement" [ref=f5e847]
                  - cell [ref=f5e848]:
                    - button "Examiner" [ref=f5e849] [cursor=pointer]
                - row [ref=f5e857]:
                  - cell [ref=f5e858]:
                    - time [ref=f5e859]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e860]
                  - cell "Automatique" [ref=f5e863]
                  - cell "Autre action" [ref=f5e864]
                  - cell "Paiement" [ref=f5e865]
                  - cell [ref=f5e866]:
                    - button "Examiner" [ref=f5e867] [cursor=pointer]
                - row [ref=f5e875]:
                  - cell [ref=f5e876]:
                    - time [ref=f5e877]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e878]
                  - cell "Automatique" [ref=f5e881]
                  - cell "Autre action" [ref=f5e882]
                  - cell "Paiement" [ref=f5e883]
                  - cell [ref=f5e884]:
                    - button "Examiner" [ref=f5e885] [cursor=pointer]
                - row [ref=f5e893]:
                  - cell [ref=f5e894]:
                    - time [ref=f5e895]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e896]
                  - cell "Automatique" [ref=f5e899]
                  - cell "Autre action" [ref=f5e900]
                  - cell "Paiement" [ref=f5e901]
                  - cell [ref=f5e902]:
                    - button "Examiner" [ref=f5e903] [cursor=pointer]
                - row [ref=f5e911]:
                  - cell [ref=f5e912]:
                    - time [ref=f5e913]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e914]
                  - cell "Automatique" [ref=f5e917]
                  - cell "Autre action" [ref=f5e918]
                  - cell "Paiement" [ref=f5e919]
                  - cell [ref=f5e920]:
                    - button "Examiner" [ref=f5e921] [cursor=pointer]
                - row [ref=f5e929]:
                  - cell [ref=f5e930]:
                    - time [ref=f5e931]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e932]
                  - cell "Automatique" [ref=f5e935]
                  - cell "Autre action" [ref=f5e936]
                  - cell "Paiement" [ref=f5e937]
                  - cell [ref=f5e938]:
                    - button "Examiner" [ref=f5e939] [cursor=pointer]
                - row [ref=f5e947]:
                  - cell [ref=f5e948]:
                    - time [ref=f5e949]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e950]
                  - cell "Automatique" [ref=f5e953]
                  - cell "Autre action" [ref=f5e954]
                  - cell "Paiement" [ref=f5e955]
                  - cell [ref=f5e956]:
                    - button "Examiner" [ref=f5e957] [cursor=pointer]
                - row [ref=f5e965]:
                  - cell [ref=f5e966]:
                    - time [ref=f5e967]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e968]
                  - cell "Automatique" [ref=f5e971]
                  - cell "Autre action" [ref=f5e972]
                  - cell "Paiement" [ref=f5e973]
                  - cell [ref=f5e974]:
                    - button "Examiner" [ref=f5e975] [cursor=pointer]
                - row [ref=f5e983]:
                  - cell [ref=f5e984]:
                    - time [ref=f5e985]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e986]
                  - cell "Automatique" [ref=f5e989]
                  - cell "Autre action" [ref=f5e990]
                  - cell "Paiement" [ref=f5e991]
                  - cell [ref=f5e992]:
                    - button "Examiner" [ref=f5e993] [cursor=pointer]
                - row [ref=f5e1001]:
                  - cell [ref=f5e1002]:
                    - time [ref=f5e1003]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1004]
                  - cell "Automatique" [ref=f5e1007]
                  - cell "Autre action" [ref=f5e1008]
                  - cell "Paiement" [ref=f5e1009]
                  - cell [ref=f5e1010]:
                    - button "Examiner" [ref=f5e1011] [cursor=pointer]
                - row [ref=f5e1019]:
                  - cell [ref=f5e1020]:
                    - time [ref=f5e1021]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1022]
                  - cell "Automatique" [ref=f5e1025]
                  - cell "Autre action" [ref=f5e1026]
                  - cell "Paiement" [ref=f5e1027]
                  - cell [ref=f5e1028]:
                    - button "Examiner" [ref=f5e1029] [cursor=pointer]
                - row [ref=f5e1037]:
                  - cell [ref=f5e1038]:
                    - time [ref=f5e1039]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1040]
                  - cell "Automatique" [ref=f5e1043]
                  - cell "Autre action" [ref=f5e1044]
                  - cell "Paiement" [ref=f5e1045]
                  - cell [ref=f5e1046]:
                    - button "Examiner" [ref=f5e1047] [cursor=pointer]
                - row [ref=f5e1055]:
                  - cell [ref=f5e1056]:
                    - time [ref=f5e1057]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1058]
                  - cell "Automatique" [ref=f5e1061]
                  - cell "Autre action" [ref=f5e1062]
                  - cell "Paiement" [ref=f5e1063]
                  - cell [ref=f5e1064]:
                    - button "Examiner" [ref=f5e1065] [cursor=pointer]
                - row [ref=f5e1073]:
                  - cell [ref=f5e1074]:
                    - time [ref=f5e1075]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1076]
                  - cell "Automatique" [ref=f5e1079]
                  - cell "Autre action" [ref=f5e1080]
                  - cell "Paiement" [ref=f5e1081]
                  - cell [ref=f5e1082]:
                    - button "Examiner" [ref=f5e1083] [cursor=pointer]
                - row [ref=f5e1091]:
                  - cell [ref=f5e1092]:
                    - time [ref=f5e1093]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1094]
                  - cell "Automatique" [ref=f5e1097]
                  - cell "Autre action" [ref=f5e1098]
                  - cell "Paiement" [ref=f5e1099]
                  - cell [ref=f5e1100]:
                    - button "Examiner" [ref=f5e1101] [cursor=pointer]
                - row [ref=f5e1109]:
                  - cell [ref=f5e1110]:
                    - time [ref=f5e1111]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1112]
                  - cell "Automatique" [ref=f5e1115]
                  - cell "Autre action" [ref=f5e1116]
                  - cell "Paiement" [ref=f5e1117]
                  - cell [ref=f5e1118]:
                    - button "Examiner" [ref=f5e1119] [cursor=pointer]
                - row [ref=f5e1127]:
                  - cell [ref=f5e1128]:
                    - time [ref=f5e1129]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1130]
                  - cell "Automatique" [ref=f5e1133]
                  - cell "Autre action" [ref=f5e1134]
                  - cell "Paiement" [ref=f5e1135]
                  - cell [ref=f5e1136]:
                    - button "Examiner" [ref=f5e1137] [cursor=pointer]
                - row [ref=f5e1145]:
                  - cell [ref=f5e1146]:
                    - time [ref=f5e1147]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1148]
                  - cell "Automatique" [ref=f5e1151]
                  - cell "Autre action" [ref=f5e1152]
                  - cell "Paiement" [ref=f5e1153]
                  - cell [ref=f5e1154]:
                    - button "Examiner" [ref=f5e1155] [cursor=pointer]
                - row [ref=f5e1163]:
                  - cell [ref=f5e1164]:
                    - time [ref=f5e1165]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1166]
                  - cell "Automatique" [ref=f5e1169]
                  - cell "Autre action" [ref=f5e1170]
                  - cell "Paiement" [ref=f5e1171]
                  - cell [ref=f5e1172]:
                    - button "Examiner" [ref=f5e1173] [cursor=pointer]
                - row [ref=f5e1181]:
                  - cell [ref=f5e1182]:
                    - time [ref=f5e1183]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1184]
                  - cell "Automatique" [ref=f5e1187]
                  - cell "Autre action" [ref=f5e1188]
                  - cell "Paiement" [ref=f5e1189]
                  - cell [ref=f5e1190]:
                    - button "Examiner" [ref=f5e1191] [cursor=pointer]
                - row [ref=f5e1199]:
                  - cell [ref=f5e1200]:
                    - time [ref=f5e1201]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1202]
                  - cell "Automatique" [ref=f5e1205]
                  - cell "Autre action" [ref=f5e1206]
                  - cell "Paiement" [ref=f5e1207]
                  - cell [ref=f5e1208]:
                    - button "Examiner" [ref=f5e1209] [cursor=pointer]
                - row [ref=f5e1217]:
                  - cell [ref=f5e1218]:
                    - time [ref=f5e1219]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1220]
                  - cell "Automatique" [ref=f5e1223]
                  - cell "Autre action" [ref=f5e1224]
                  - cell "Paiement" [ref=f5e1225]
                  - cell [ref=f5e1226]:
                    - button "Examiner" [ref=f5e1227] [cursor=pointer]
                - row [ref=f5e1235]:
                  - cell [ref=f5e1236]:
                    - time [ref=f5e1237]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1238]
                  - cell "Automatique" [ref=f5e1241]
                  - cell "Autre action" [ref=f5e1242]
                  - cell "Paiement" [ref=f5e1243]
                  - cell [ref=f5e1244]:
                    - button "Examiner" [ref=f5e1245] [cursor=pointer]
                - row [ref=f5e1253]:
                  - cell [ref=f5e1254]:
                    - time [ref=f5e1255]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1256]
                  - cell "Automatique" [ref=f5e1259]
                  - cell "Autre action" [ref=f5e1260]
                  - cell "Paiement" [ref=f5e1261]
                  - cell [ref=f5e1262]:
                    - button "Examiner" [ref=f5e1263] [cursor=pointer]
                - row [ref=f5e1271]:
                  - cell [ref=f5e1272]:
                    - time [ref=f5e1273]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1274]
                  - cell "Automatique" [ref=f5e1277]
                  - cell "Autre action" [ref=f5e1278]
                  - cell "Paiement" [ref=f5e1279]
                  - cell [ref=f5e1280]:
                    - button "Examiner" [ref=f5e1281] [cursor=pointer]
                - row [ref=f5e1289]:
                  - cell [ref=f5e1290]:
                    - time [ref=f5e1291]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1292]
                  - cell "Automatique" [ref=f5e1295]
                  - cell "Autre action" [ref=f5e1296]
                  - cell "Paiement" [ref=f5e1297]
                  - cell [ref=f5e1298]:
                    - button "Examiner" [ref=f5e1299] [cursor=pointer]
                - row [ref=f5e1307]:
                  - cell [ref=f5e1308]:
                    - time [ref=f5e1309]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1310]
                  - cell "Automatique" [ref=f5e1313]
                  - cell "Autre action" [ref=f5e1314]
                  - cell "Paiement" [ref=f5e1315]
                  - cell [ref=f5e1316]:
                    - button "Examiner" [ref=f5e1317] [cursor=pointer]
                - row [ref=f5e1325]:
                  - cell [ref=f5e1326]:
                    - time [ref=f5e1327]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1328]
                  - cell "Automatique" [ref=f5e1331]
                  - cell "Autre action" [ref=f5e1332]
                  - cell "Paiement" [ref=f5e1333]
                  - cell [ref=f5e1334]:
                    - button "Examiner" [ref=f5e1335] [cursor=pointer]
                - row [ref=f5e1343]:
                  - cell [ref=f5e1344]:
                    - time [ref=f5e1345]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1346]
                  - cell "Automatique" [ref=f5e1349]
                  - cell "Autre action" [ref=f5e1350]
                  - cell "Paiement" [ref=f5e1351]
                  - cell [ref=f5e1352]:
                    - button "Examiner" [ref=f5e1353] [cursor=pointer]
                - row [ref=f5e1361]:
                  - cell [ref=f5e1362]:
                    - time [ref=f5e1363]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1364]
                  - cell "Automatique" [ref=f5e1367]
                  - cell "Autre action" [ref=f5e1368]
                  - cell "Paiement" [ref=f5e1369]
                  - cell [ref=f5e1370]:
                    - button "Examiner" [ref=f5e1371] [cursor=pointer]
                - row [ref=f5e1379]:
                  - cell [ref=f5e1380]:
                    - time [ref=f5e1381]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1382]
                  - cell "Automatique" [ref=f5e1385]
                  - cell "Autre action" [ref=f5e1386]
                  - cell "Paiement" [ref=f5e1387]
                  - cell [ref=f5e1388]:
                    - button "Examiner" [ref=f5e1389] [cursor=pointer]
                - row [ref=f5e1397]:
                  - cell [ref=f5e1398]:
                    - time [ref=f5e1399]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1400]
                  - cell "Automatique" [ref=f5e1403]
                  - cell "Autre action" [ref=f5e1404]
                  - cell "Paiement" [ref=f5e1405]
                  - cell [ref=f5e1406]:
                    - button "Examiner" [ref=f5e1407] [cursor=pointer]
                - row [ref=f5e1415]:
                  - cell [ref=f5e1416]:
                    - time [ref=f5e1417]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1418]
                  - cell "Automatique" [ref=f5e1421]
                  - cell "Autre action" [ref=f5e1422]
                  - cell "Paiement" [ref=f5e1423]
                  - cell [ref=f5e1424]:
                    - button "Examiner" [ref=f5e1425] [cursor=pointer]
                - row [ref=f5e1433]:
                  - cell [ref=f5e1434]:
                    - time [ref=f5e1435]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1436]
                  - cell "Automatique" [ref=f5e1439]
                  - cell "Autre action" [ref=f5e1440]
                  - cell "Paiement" [ref=f5e1441]
                  - cell [ref=f5e1442]:
                    - button "Examiner" [ref=f5e1443] [cursor=pointer]
                - row [ref=f5e1451]:
                  - cell [ref=f5e1452]:
                    - time [ref=f5e1453]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1454]
                  - cell "Automatique" [ref=f5e1457]
                  - cell "Autre action" [ref=f5e1458]
                  - cell "Paiement" [ref=f5e1459]
                  - cell [ref=f5e1460]:
                    - button "Examiner" [ref=f5e1461] [cursor=pointer]
                - row [ref=f5e1469]:
                  - cell [ref=f5e1470]:
                    - time [ref=f5e1471]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1472]
                  - cell "Automatique" [ref=f5e1475]
                  - cell "Autre action" [ref=f5e1476]
                  - cell "Paiement" [ref=f5e1477]
                  - cell [ref=f5e1478]:
                    - button "Examiner" [ref=f5e1479] [cursor=pointer]
                - row [ref=f5e1487]:
                  - cell [ref=f5e1488]:
                    - time [ref=f5e1489]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1490]
                  - cell "Automatique" [ref=f5e1493]
                  - cell "Autre action" [ref=f5e1494]
                  - cell "Paiement" [ref=f5e1495]
                  - cell [ref=f5e1496]:
                    - button "Examiner" [ref=f5e1497] [cursor=pointer]
                - row [ref=f5e1505]:
                  - cell [ref=f5e1506]:
                    - time [ref=f5e1507]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1508]
                  - cell "Automatique" [ref=f5e1511]
                  - cell "Autre action" [ref=f5e1512]
                  - cell "Paiement" [ref=f5e1513]
                  - cell [ref=f5e1514]:
                    - button "Examiner" [ref=f5e1515] [cursor=pointer]
                - row [ref=f5e1523]:
                  - cell [ref=f5e1524]:
                    - time [ref=f5e1525]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1526]
                  - cell "Automatique" [ref=f5e1529]
                  - cell "Autre action" [ref=f5e1530]
                  - cell "Paiement" [ref=f5e1531]
                  - cell [ref=f5e1532]:
                    - button "Examiner" [ref=f5e1533] [cursor=pointer]
                - row [ref=f5e1541]:
                  - cell [ref=f5e1542]:
                    - time [ref=f5e1543]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1544]
                  - cell "Automatique" [ref=f5e1547]
                  - cell "Autre action" [ref=f5e1548]
                  - cell "Paiement" [ref=f5e1549]
                  - cell [ref=f5e1550]:
                    - button "Examiner" [ref=f5e1551] [cursor=pointer]
                - row [ref=f5e1559]:
                  - cell [ref=f5e1560]:
                    - time [ref=f5e1561]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1562]
                  - cell "Automatique" [ref=f5e1565]
                  - cell "Autre action" [ref=f5e1566]
                  - cell "Paiement" [ref=f5e1567]
                  - cell [ref=f5e1568]:
                    - button "Examiner" [ref=f5e1569] [cursor=pointer]
                - row [ref=f5e1577]:
                  - cell [ref=f5e1578]:
                    - time [ref=f5e1579]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1580]
                  - cell "Automatique" [ref=f5e1583]
                  - cell "Autre action" [ref=f5e1584]
                  - cell "Paiement" [ref=f5e1585]
                  - cell [ref=f5e1586]:
                    - button "Examiner" [ref=f5e1587] [cursor=pointer]
                - row [ref=f5e1595]:
                  - cell [ref=f5e1596]:
                    - time [ref=f5e1597]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1598]
                  - cell "Automatique" [ref=f5e1601]
                  - cell "Autre action" [ref=f5e1602]
                  - cell "Paiement" [ref=f5e1603]
                  - cell [ref=f5e1604]:
                    - button "Examiner" [ref=f5e1605] [cursor=pointer]
                - row [ref=f5e1613]:
                  - cell [ref=f5e1614]:
                    - time [ref=f5e1615]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1616]
                  - cell "Automatique" [ref=f5e1619]
                  - cell "Autre action" [ref=f5e1620]
                  - cell "Paiement" [ref=f5e1621]
                  - cell [ref=f5e1622]:
                    - button "Examiner" [ref=f5e1623] [cursor=pointer]
                - row [ref=f5e1631]:
                  - cell [ref=f5e1632]:
                    - time [ref=f5e1633]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1634]
                  - cell "Automatique" [ref=f5e1637]
                  - cell "Autre action" [ref=f5e1638]
                  - cell "Paiement" [ref=f5e1639]
                  - cell [ref=f5e1640]:
                    - button "Examiner" [ref=f5e1641] [cursor=pointer]
                - row [ref=f5e1649]:
                  - cell [ref=f5e1650]:
                    - time [ref=f5e1651]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1652]
                  - cell "Automatique" [ref=f5e1655]
                  - cell "Autre action" [ref=f5e1656]
                  - cell "Paiement" [ref=f5e1657]
                  - cell [ref=f5e1658]:
                    - button "Examiner" [ref=f5e1659] [cursor=pointer]
                - row [ref=f5e1667]:
                  - cell [ref=f5e1668]:
                    - time [ref=f5e1669]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1670]
                  - cell "Automatique" [ref=f5e1673]
                  - cell "Autre action" [ref=f5e1674]
                  - cell "Paiement" [ref=f5e1675]
                  - cell [ref=f5e1676]:
                    - button "Examiner" [ref=f5e1677] [cursor=pointer]
                - row [ref=f5e1685]:
                  - cell [ref=f5e1686]:
                    - time [ref=f5e1687]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1688]
                  - cell "Automatique" [ref=f5e1691]
                  - cell "Autre action" [ref=f5e1692]
                  - cell "Paiement" [ref=f5e1693]
                  - cell [ref=f5e1694]:
                    - button "Examiner" [ref=f5e1695] [cursor=pointer]
                - row [ref=f5e1703]:
                  - cell [ref=f5e1704]:
                    - time [ref=f5e1705]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1706]
                  - cell "Automatique" [ref=f5e1709]
                  - cell "Autre action" [ref=f5e1710]
                  - cell "Paiement" [ref=f5e1711]
                  - cell [ref=f5e1712]:
                    - button "Examiner" [ref=f5e1713] [cursor=pointer]
                - row [ref=f5e1721]:
                  - cell [ref=f5e1722]:
                    - time [ref=f5e1723]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1724]
                  - cell "Automatique" [ref=f5e1727]
                  - cell "Autre action" [ref=f5e1728]
                  - cell "Paiement" [ref=f5e1729]
                  - cell [ref=f5e1730]:
                    - button "Examiner" [ref=f5e1731] [cursor=pointer]
                - row [ref=f5e1739]:
                  - cell [ref=f5e1740]:
                    - time [ref=f5e1741]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1742]
                  - cell "Automatique" [ref=f5e1745]
                  - cell "Autre action" [ref=f5e1746]
                  - cell "Paiement" [ref=f5e1747]
                  - cell [ref=f5e1748]:
                    - button "Examiner" [ref=f5e1749] [cursor=pointer]
                - row [ref=f5e1757]:
                  - cell [ref=f5e1758]:
                    - time [ref=f5e1759]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1760]
                  - cell "Automatique" [ref=f5e1763]
                  - cell "Autre action" [ref=f5e1764]
                  - cell "Paiement" [ref=f5e1765]
                  - cell [ref=f5e1766]:
                    - button "Examiner" [ref=f5e1767] [cursor=pointer]
                - row [ref=f5e1775]:
                  - cell [ref=f5e1776]:
                    - time [ref=f5e1777]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1778]
                  - cell "Automatique" [ref=f5e1781]
                  - cell "Autre action" [ref=f5e1782]
                  - cell "Paiement" [ref=f5e1783]
                  - cell [ref=f5e1784]:
                    - button "Examiner" [ref=f5e1785] [cursor=pointer]
                - row [ref=f5e1793]:
                  - cell [ref=f5e1794]:
                    - time [ref=f5e1795]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1796]
                  - cell "Automatique" [ref=f5e1799]
                  - cell "Autre action" [ref=f5e1800]
                  - cell "Paiement" [ref=f5e1801]
                  - cell [ref=f5e1802]:
                    - button "Examiner" [ref=f5e1803] [cursor=pointer]
                - row [ref=f5e1811]:
                  - cell [ref=f5e1812]:
                    - time [ref=f5e1813]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1814]
                  - cell "Automatique" [ref=f5e1817]
                  - cell "Autre action" [ref=f5e1818]
                  - cell "Paiement" [ref=f5e1819]
                  - cell [ref=f5e1820]:
                    - button "Examiner" [ref=f5e1821] [cursor=pointer]
                - row [ref=f5e1829]:
                  - cell [ref=f5e1830]:
                    - time [ref=f5e1831]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1832]
                  - cell "Automatique" [ref=f5e1835]
                  - cell "Autre action" [ref=f5e1836]
                  - cell "Paiement" [ref=f5e1837]
                  - cell [ref=f5e1838]:
                    - button "Examiner" [ref=f5e1839] [cursor=pointer]
                - row [ref=f5e1847]:
                  - cell [ref=f5e1848]:
                    - time [ref=f5e1849]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1850]
                  - cell "Automatique" [ref=f5e1853]
                  - cell "Autre action" [ref=f5e1854]
                  - cell "Paiement" [ref=f5e1855]
                  - cell [ref=f5e1856]:
                    - button "Examiner" [ref=f5e1857] [cursor=pointer]
                - row [ref=f5e1865]:
                  - cell [ref=f5e1866]:
                    - time [ref=f5e1867]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1868]
                  - cell "Automatique" [ref=f5e1871]
                  - cell "Autre action" [ref=f5e1872]
                  - cell "Paiement" [ref=f5e1873]
                  - cell [ref=f5e1874]:
                    - button "Examiner" [ref=f5e1875] [cursor=pointer]
                - row [ref=f5e1883]:
                  - cell [ref=f5e1884]:
                    - time [ref=f5e1885]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1886]
                  - cell "Automatique" [ref=f5e1889]
                  - cell "Autre action" [ref=f5e1890]
                  - cell "Paiement" [ref=f5e1891]
                  - cell [ref=f5e1892]:
                    - button "Examiner" [ref=f5e1893] [cursor=pointer]
                - row [ref=f5e1901]:
                  - cell [ref=f5e1902]:
                    - time [ref=f5e1903]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1904]
                  - cell "Automatique" [ref=f5e1907]
                  - cell "Autre action" [ref=f5e1908]
                  - cell "Paiement" [ref=f5e1909]
                  - cell [ref=f5e1910]:
                    - button "Examiner" [ref=f5e1911] [cursor=pointer]
                - row [ref=f5e1919]:
                  - cell [ref=f5e1920]:
                    - time [ref=f5e1921]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1922]
                  - cell "Automatique" [ref=f5e1925]
                  - cell "Autre action" [ref=f5e1926]
                  - cell "Paiement" [ref=f5e1927]
                  - cell [ref=f5e1928]:
                    - button "Examiner" [ref=f5e1929] [cursor=pointer]
                - row [ref=f5e1937]:
                  - cell [ref=f5e1938]:
                    - time [ref=f5e1939]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1940]
                  - cell "Automatique" [ref=f5e1943]
                  - cell "Autre action" [ref=f5e1944]
                  - cell "Paiement" [ref=f5e1945]
                  - cell [ref=f5e1946]:
                    - button "Examiner" [ref=f5e1947] [cursor=pointer]
                - row [ref=f5e1955]:
                  - cell [ref=f5e1956]:
                    - time [ref=f5e1957]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1958]
                  - cell "Automatique" [ref=f5e1961]
                  - cell "Autre action" [ref=f5e1962]
                  - cell "Paiement" [ref=f5e1963]
                  - cell [ref=f5e1964]:
                    - button "Examiner" [ref=f5e1965] [cursor=pointer]
                - row [ref=f5e1973]:
                  - cell [ref=f5e1974]:
                    - time [ref=f5e1975]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1976]
                  - cell "Automatique" [ref=f5e1979]
                  - cell "Autre action" [ref=f5e1980]
                  - cell "Paiement" [ref=f5e1981]
                  - cell [ref=f5e1982]:
                    - button "Examiner" [ref=f5e1983] [cursor=pointer]
                - row [ref=f5e1991]:
                  - cell [ref=f5e1992]:
                    - time [ref=f5e1993]: sam. 21 nov. 2026 à 03:11
                  - cell "Système" [ref=f5e1994]
                  - cell "Automatique" [ref=f5e1997]
                  - cell "Autre action" [ref=f5e1998]
                  - cell "Paiement" [ref=f5e1999]
                  - cell [ref=f5e2000]:
                    - button "Examiner" [ref=f5e2001] [cursor=pointer]
  - alert [ref=f5e2009]
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
      |                                                                                        ^ Error: contrôles responsive de adm-journal (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```