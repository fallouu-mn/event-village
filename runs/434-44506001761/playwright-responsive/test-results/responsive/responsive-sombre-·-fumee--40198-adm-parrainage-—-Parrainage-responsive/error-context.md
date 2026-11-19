# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-parrainage — Parrainage
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-parrainage (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 10

- Array []
+ Array [
+   "360 px : 5 cible(s) < 44 px : a « sans nom » 35×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "360 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : 5 cible(s) < 44 px : a « sans nom » 40×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "768 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+   "1440 px : 5 cible(s) < 44 px : a « sans nom » 40×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "1440 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
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
          - generic [ref=f2e139]:
            - generic [ref=f2e140]:
              - link [ref=f2e141] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Parrainage et ambassadeurs" [level=1] [ref=f2e145]
            - button "Actualiser" [ref=f2e146] [cursor=pointer]
          - generic [ref=f2e153]:
            - generic [ref=f2e154]:
              - paragraph [ref=f2e156]: Utilisateurs
              - paragraph [ref=f2e163]: "42"
              - paragraph [ref=f2e164]: 42 compte(s) standard
            - generic [ref=f2e165]:
              - paragraph [ref=f2e167]: Ambassadeurs actifs
              - paragraph [ref=f2e171]: "0"
              - paragraph [ref=f2e172]: "Taux ambassadeur : 7 % sur les filleuls directs, 2 % sur les filleuls de ses filleuls"
            - generic [ref=f2e173]:
              - paragraph [ref=f2e175]: Durée du parrainage
              - paragraph [ref=f2e180]: 12 mois
              - paragraph [ref=f2e181]: Compte standard ; 24 mois pour un ambassadeur
          - status [ref=f2e182]:
            - paragraph [ref=f2e188]: La personnalisation des taux n’est pas disponible pour le moment.
          - generic [ref=f2e189]:
            - generic [ref=f2e190]:
              - generic [ref=f2e191]:
                - heading "Répertoire des Utilisateurs" [level=2] [ref=f2e192]
                - paragraph [ref=f2e193]: Nommez un ambassadeur pour majorer ses commissions sur ses filleuls directs et sur les filleuls de ses filleuls.
              - generic [ref=f2e194]:
                - textbox "Rechercher par nom, email, téléphone..." [ref=f2e199]
                - generic [ref=f2e200]:
                  - button "Tous" [ref=f2e201] [cursor=pointer]
                  - button "Ambassadeurs" [ref=f2e202] [cursor=pointer]
                  - button "Standard" [ref=f2e203] [cursor=pointer]
            - generic [ref=f2e204]:
              - generic [ref=f2e205]:
                - generic [ref=f2e206]:
                  - generic [ref=f2e207]:
                    - heading "Assane Badji" [level=4] [ref=f2e208]
                    - generic [ref=f2e209]: Client
                    - generic [ref=f2e210]: Parrainage Standard
                  - generic [ref=f2e211]:
                    - generic [ref=f2e212]: "+221700000224"
                    - generic [ref=f2e216]: assane.badji.24@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e222] [cursor=pointer]
              - generic [ref=f2e224]:
                - generic [ref=f2e225]:
                  - generic [ref=f2e226]:
                    - heading "Marième Niang" [level=4] [ref=f2e227]
                    - generic [ref=f2e228]: Client
                    - generic [ref=f2e229]: Parrainage Standard
                  - generic [ref=f2e230]:
                    - generic [ref=f2e231]: "+221700000223"
                    - generic [ref=f2e235]: marieme.niang.23@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e241] [cursor=pointer]
              - generic [ref=f2e243]:
                - generic [ref=f2e244]:
                  - generic [ref=f2e245]:
                    - heading "Omar Gaye" [level=4] [ref=f2e246]
                    - generic [ref=f2e247]: Client
                    - generic [ref=f2e248]: Parrainage Standard
                  - generic [ref=f2e249]:
                    - generic [ref=f2e250]: "+221700000222"
                    - generic [ref=f2e254]: omar.gaye.22@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e260] [cursor=pointer]
              - generic [ref=f2e262]:
                - generic [ref=f2e263]:
                  - generic [ref=f2e264]:
                    - heading "Dieynaba Tall" [level=4] [ref=f2e265]
                    - generic [ref=f2e266]: Client
                    - generic [ref=f2e267]: Parrainage Standard
                  - generic [ref=f2e268]:
                    - generic [ref=f2e269]: "+221700000221"
                    - generic [ref=f2e273]: dieynaba.tall.21@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e279] [cursor=pointer]
              - generic [ref=f2e281]:
                - generic [ref=f2e282]:
                  - generic [ref=f2e283]:
                    - heading "Saliou Touré" [level=4] [ref=f2e284]
                    - generic [ref=f2e285]: Client
                    - generic [ref=f2e286]: Parrainage Standard
                  - generic [ref=f2e287]:
                    - generic [ref=f2e288]: "+221700000220"
                    - generic [ref=f2e292]: saliou.toure.20@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e298] [cursor=pointer]
              - generic [ref=f2e300]:
                - generic [ref=f2e301]:
                  - generic [ref=f2e302]:
                    - heading "Bineta Kane" [level=4] [ref=f2e303]
                    - generic [ref=f2e304]: Client
                    - generic [ref=f2e305]: Parrainage Standard
                  - generic [ref=f2e306]:
                    - generic [ref=f2e307]: "+221700000219"
                    - generic [ref=f2e311]: bineta.kane.19@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e317] [cursor=pointer]
              - generic [ref=f2e319]:
                - generic [ref=f2e320]:
                  - generic [ref=f2e321]:
                    - heading "Modou Mboup" [level=4] [ref=f2e322]
                    - generic [ref=f2e323]: Client
                    - generic [ref=f2e324]: Parrainage Standard
                  - generic [ref=f2e325]:
                    - generic [ref=f2e326]: "+221700000218"
                    - generic [ref=f2e330]: modou.mboup.18@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e336] [cursor=pointer]
              - generic [ref=f2e338]:
                - generic [ref=f2e339]:
                  - generic [ref=f2e340]:
                    - heading "Yacine Dieng" [level=4] [ref=f2e341]
                    - generic [ref=f2e342]: Client
                    - generic [ref=f2e343]: Parrainage Standard
                  - generic [ref=f2e344]:
                    - generic [ref=f2e345]: "+221700000217"
                    - generic [ref=f2e349]: yacine.dieng.17@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e355] [cursor=pointer]
              - generic [ref=f2e357]:
                - generic [ref=f2e358]:
                  - generic [ref=f2e359]:
                    - heading "Ibou Mbengue" [level=4] [ref=f2e360]
                    - generic [ref=f2e361]: Client
                    - generic [ref=f2e362]: Parrainage Standard
                  - generic [ref=f2e363]:
                    - generic [ref=f2e364]: "+221700000216"
                    - generic [ref=f2e368]: ibou.mbengue.16@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e374] [cursor=pointer]
              - generic [ref=f2e376]:
                - generic [ref=f2e377]:
                  - generic [ref=f2e378]:
                    - heading "Astou Sow" [level=4] [ref=f2e379]
                    - generic [ref=f2e380]: Client
                    - generic [ref=f2e381]: Parrainage Standard
                  - generic [ref=f2e382]:
                    - generic [ref=f2e383]: "+221700000215"
                    - generic [ref=f2e387]: astou.sow.15@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e393] [cursor=pointer]
              - generic [ref=f2e395]:
                - generic [ref=f2e396]:
                  - generic [ref=f2e397]:
                    - heading "Mamadou Kébé" [level=4] [ref=f2e398]
                    - generic [ref=f2e399]: Client
                    - generic [ref=f2e400]: Parrainage Standard
                  - generic [ref=f2e401]:
                    - generic [ref=f2e402]: "+221700000214"
                    - generic [ref=f2e406]: mamadou.kebe.14@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e412] [cursor=pointer]
              - generic [ref=f2e414]:
                - generic [ref=f2e415]:
                  - generic [ref=f2e416]:
                    - heading "Fatoumata Camara" [level=4] [ref=f2e417]
                    - generic [ref=f2e418]: Client
                    - generic [ref=f2e419]: Parrainage Standard
                  - generic [ref=f2e420]:
                    - generic [ref=f2e421]: "+221700000213"
                    - generic [ref=f2e425]: fatoumata.camara.13@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e431] [cursor=pointer]
              - generic [ref=f2e433]:
                - generic [ref=f2e434]:
                  - generic [ref=f2e435]:
                    - heading "Adama Diouf" [level=4] [ref=f2e436]
                    - generic [ref=f2e437]: Client
                    - generic [ref=f2e438]: Parrainage Standard
                  - generic [ref=f2e439]:
                    - generic [ref=f2e440]: "+221700000212"
                    - generic [ref=f2e444]: adama.diouf.12@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e450] [cursor=pointer]
              - generic [ref=f2e452]:
                - generic [ref=f2e453]:
                  - generic [ref=f2e454]:
                    - heading "Rokhaya Ndao" [level=4] [ref=f2e455]
                    - generic [ref=f2e456]: Client
                    - generic [ref=f2e457]: Parrainage Standard
                  - generic [ref=f2e458]:
                    - generic [ref=f2e459]: "+221700000211"
                    - generic [ref=f2e463]: rokhaya.ndao.11@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e469] [cursor=pointer]
              - generic [ref=f2e471]:
                - generic [ref=f2e472]:
                  - generic [ref=f2e473]:
                    - heading "Pape Lo" [level=4] [ref=f2e474]
                    - generic [ref=f2e475]: Client
                    - generic [ref=f2e476]: Parrainage Standard
                  - generic [ref=f2e477]:
                    - generic [ref=f2e478]: "+221700000210"
                    - generic [ref=f2e482]: pape.lo.10@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e488] [cursor=pointer]
              - generic [ref=f2e490]:
                - generic [ref=f2e491]:
                  - generic [ref=f2e492]:
                    - heading "Coumba Ka" [level=4] [ref=f2e493]
                    - generic [ref=f2e494]: Client
                    - generic [ref=f2e495]: Parrainage Standard
                  - generic [ref=f2e496]:
                    - generic [ref=f2e497]: "+221700000209"
                    - generic [ref=f2e501]: coumba.ka.09@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e507] [cursor=pointer]
              - generic [ref=f2e509]:
                - generic [ref=f2e510]:
                  - generic [ref=f2e511]:
                    - heading "Alioune Fall" [level=4] [ref=f2e512]
                    - generic [ref=f2e513]: Client
                    - generic [ref=f2e514]: Parrainage Standard
                  - generic [ref=f2e515]:
                    - generic [ref=f2e516]: "+221700000208"
                    - generic [ref=f2e520]: alioune.fall.08@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e526] [cursor=pointer]
              - generic [ref=f2e528]:
                - generic [ref=f2e529]:
                  - generic [ref=f2e530]:
                    - heading "Mame Ndour" [level=4] [ref=f2e531]
                    - generic [ref=f2e532]: Client
                    - generic [ref=f2e533]: Parrainage Standard
                  - generic [ref=f2e534]:
                    - generic [ref=f2e535]: "+221700000207"
                    - generic [ref=f2e539]: mame.ndour.07@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e545] [cursor=pointer]
              - generic [ref=f2e547]:
                - generic [ref=f2e548]:
                  - generic [ref=f2e549]:
                    - heading "Babacar Diagne" [level=4] [ref=f2e550]
                    - generic [ref=f2e551]: Client
                    - generic [ref=f2e552]: Parrainage Standard
                  - generic [ref=f2e553]:
                    - generic [ref=f2e554]: "+221700000206"
                    - generic [ref=f2e558]: babacar.diagne.06@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e564] [cursor=pointer]
              - generic [ref=f2e566]:
                - generic [ref=f2e567]:
                  - generic [ref=f2e568]:
                    - heading "Ndeye Thiam" [level=4] [ref=f2e569]
                    - generic [ref=f2e570]: Client
                    - generic [ref=f2e571]: Parrainage Standard
                  - generic [ref=f2e572]:
                    - generic [ref=f2e573]: "+221700000205"
                    - generic [ref=f2e577]: ndeye.thiam.05@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e583] [cursor=pointer]
              - generic [ref=f2e585]:
                - generic [ref=f2e586]:
                  - generic [ref=f2e587]:
                    - heading "Cheikh Sarr" [level=4] [ref=f2e588]
                    - generic [ref=f2e589]: Client
                    - generic [ref=f2e590]: Parrainage Standard
                  - generic [ref=f2e591]:
                    - generic [ref=f2e592]: "+221700000204"
                    - generic [ref=f2e596]: cheikh.sarr.04@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e602] [cursor=pointer]
              - generic [ref=f2e604]:
                - generic [ref=f2e605]:
                  - generic [ref=f2e606]:
                    - heading "Aminata Sène" [level=4] [ref=f2e607]
                    - generic [ref=f2e608]: Client
                    - generic [ref=f2e609]: Parrainage Standard
                  - generic [ref=f2e610]:
                    - generic [ref=f2e611]: "+221700000203"
                    - generic [ref=f2e615]: aminata.sene.03@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e621] [cursor=pointer]
              - generic [ref=f2e623]:
                - generic [ref=f2e624]:
                  - generic [ref=f2e625]:
                    - heading "Moussa Sy" [level=4] [ref=f2e626]
                    - generic [ref=f2e627]: Client
                    - generic [ref=f2e628]: Parrainage Standard
                  - generic [ref=f2e629]:
                    - generic [ref=f2e630]: "+221700000202"
                    - generic [ref=f2e634]: moussa.sy.02@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e640] [cursor=pointer]
              - generic [ref=f2e642]:
                - generic [ref=f2e643]:
                  - generic [ref=f2e644]:
                    - heading "Awa Diop" [level=4] [ref=f2e645]
                    - generic [ref=f2e646]: Client
                    - generic [ref=f2e647]: Parrainage Standard
                  - generic [ref=f2e648]:
                    - generic [ref=f2e649]: "+221700000201"
                    - generic [ref=f2e653]: awa.diop.01@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e659] [cursor=pointer]
              - generic [ref=f2e661]:
                - generic [ref=f2e662]:
                  - generic [ref=f2e663]:
                    - heading "Mamadou Sall" [level=4] [ref=f2e664]
                    - generic [ref=f2e665]: Contrôleur
                    - generic [ref=f2e666]: Parrainage Standard
                  - generic [ref=f2e667]:
                    - generic [ref=f2e668]: "+221700000110"
                    - generic [ref=f2e672]: mamadou.sall@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e678] [cursor=pointer]
              - generic [ref=f2e680]:
                - generic [ref=f2e681]:
                  - generic [ref=f2e682]:
                    - heading "Ndèye Gning" [level=4] [ref=f2e683]
                    - generic [ref=f2e684]: Partenaire
                    - generic [ref=f2e685]: Parrainage Standard
                  - generic [ref=f2e686]:
                    - generic [ref=f2e687]: "+221700000109"
                    - generic [ref=f2e691]: ndeye.gning@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e697] [cursor=pointer]
              - generic [ref=f2e699]:
                - generic [ref=f2e700]:
                  - generic [ref=f2e701]:
                    - heading "Lamine Cissé" [level=4] [ref=f2e702]
                    - generic [ref=f2e703]: Contrôleur
                    - generic [ref=f2e704]: Parrainage Standard
                  - generic [ref=f2e705]:
                    - generic [ref=f2e706]: "+221700000108"
                    - generic [ref=f2e710]: lamine.cisse@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e716] [cursor=pointer]
              - generic [ref=f2e718]:
                - generic [ref=f2e719]:
                  - generic [ref=f2e720]:
                    - heading "Seynabou Ba" [level=4] [ref=f2e721]
                    - generic [ref=f2e722]: Contrôleur
                    - generic [ref=f2e723]: Parrainage Standard
                  - generic [ref=f2e724]:
                    - generic [ref=f2e725]: "+221700000107"
                    - generic [ref=f2e729]: seynabou.ba@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e735] [cursor=pointer]
              - generic [ref=f2e737]:
                - generic [ref=f2e738]:
                  - generic [ref=f2e739]:
                    - heading "Ibrahima Gueye" [level=4] [ref=f2e740]
                    - generic [ref=f2e741]: Contrôleur
                    - generic [ref=f2e742]: Parrainage Standard
                  - generic [ref=f2e743]:
                    - generic [ref=f2e744]: "+221700000106"
                    - generic [ref=f2e748]: ibrahima.gueye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e754] [cursor=pointer]
              - generic [ref=f2e756]:
                - generic [ref=f2e757]:
                  - generic [ref=f2e758]:
                    - heading "Fatou Mbaye" [level=4] [ref=f2e759]
                    - generic [ref=f2e760]: Client
                    - generic [ref=f2e761]: Parrainage Standard
                  - generic [ref=f2e762]:
                    - generic [ref=f2e763]: "+221700000105"
                    - generic [ref=f2e767]: fatou.mbaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e773] [cursor=pointer]
              - generic [ref=f2e775]:
                - generic [ref=f2e776]:
                  - generic [ref=f2e777]:
                    - heading "Aïda Diallo" [level=4] [ref=f2e778]
                    - generic [ref=f2e779]: Administrateur
                    - generic [ref=f2e780]: Parrainage Standard
                  - generic [ref=f2e781]:
                    - generic [ref=f2e782]: "+221700000104"
                    - generic [ref=f2e786]: aida.diallo@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e792] [cursor=pointer]
              - generic [ref=f2e794]:
                - generic [ref=f2e795]:
                  - generic [ref=f2e796]:
                    - heading "Khady Sarr" [level=4] [ref=f2e797]
                    - generic [ref=f2e798]: Partenaire
                    - generic [ref=f2e799]: Parrainage Standard
                  - generic [ref=f2e800]:
                    - generic [ref=f2e801]: "+221700000103"
                    - generic [ref=f2e805]: khady.sarr@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e811] [cursor=pointer]
              - generic [ref=f2e813]:
                - generic [ref=f2e814]:
                  - generic [ref=f2e815]:
                    - heading "Ousmane Faye" [level=4] [ref=f2e816]
                    - generic [ref=f2e817]: Partenaire
                    - generic [ref=f2e818]: Parrainage Standard
                  - generic [ref=f2e819]:
                    - generic [ref=f2e820]: "+221700000102"
                    - generic [ref=f2e824]: ousmane.faye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e830] [cursor=pointer]
              - generic [ref=f2e832]:
                - generic [ref=f2e833]:
                  - generic [ref=f2e834]:
                    - heading "Mariama Ndiaye" [level=4] [ref=f2e835]
                    - generic [ref=f2e836]: Partenaire
                    - generic [ref=f2e837]: Parrainage Standard
                  - generic [ref=f2e838]:
                    - generic [ref=f2e839]: "+221700000101"
                    - generic [ref=f2e843]: mariama.ndiaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e849] [cursor=pointer]
              - generic [ref=f2e851]:
                - generic [ref=f2e852]:
                  - generic [ref=f2e853]:
                    - heading "Fatou Suspendue" [level=4] [ref=f2e854]
                    - generic [ref=f2e855]: Client
                    - generic [ref=f2e856]: Parrainage Standard
                  - generic [ref=f2e857]:
                    - generic [ref=f2e858]: "+221700000008"
                    - generic [ref=f2e862]: suspendu@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e868] [cursor=pointer]
              - generic [ref=f2e870]:
                - generic [ref=f2e871]:
                  - generic [ref=f2e872]:
                    - heading "Elhadji SuperAdmin" [level=4] [ref=f2e873]
                    - generic [ref=f2e874]: Superadmin
                    - generic [ref=f2e875]: Parrainage Standard
                  - generic [ref=f2e876]:
                    - generic [ref=f2e877]: "+221700000007"
                    - generic [ref=f2e881]: superadmin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e887] [cursor=pointer]
              - generic [ref=f2e889]:
                - generic [ref=f2e890]:
                  - generic [ref=f2e891]:
                    - heading "Dior Admin" [level=4] [ref=f2e892]
                    - generic [ref=f2e893]: Administrateur
                    - generic [ref=f2e894]: Parrainage Standard
                  - generic [ref=f2e895]:
                    - generic [ref=f2e896]: "+221700000006"
                    - generic [ref=f2e900]: admin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e906] [cursor=pointer]
              - generic [ref=f2e908]:
                - generic [ref=f2e909]:
                  - generic [ref=f2e910]:
                    - heading "Cheikh ControleurA" [level=4] [ref=f2e911]
                    - generic [ref=f2e912]: Contrôleur
                    - generic [ref=f2e913]: Parrainage Standard
                  - generic [ref=f2e914]:
                    - generic [ref=f2e915]: "+221700000005"
                    - generic [ref=f2e919]: controller-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e925] [cursor=pointer]
              - generic [ref=f2e927]:
                - generic [ref=f2e928]:
                  - generic [ref=f2e929]:
                    - heading "Bassirou OrgaB" [level=4] [ref=f2e930]
                    - generic [ref=f2e931]: Partenaire
                    - generic [ref=f2e932]: Parrainage Standard
                  - generic [ref=f2e933]:
                    - generic [ref=f2e934]: "+221700000004"
                    - generic [ref=f2e938]: partner-b@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e944] [cursor=pointer]
              - generic [ref=f2e946]:
                - generic [ref=f2e947]:
                  - generic [ref=f2e948]:
                    - heading "Aïssatou OrgaA" [level=4] [ref=f2e949]
                    - generic [ref=f2e950]: Partenaire
                    - generic [ref=f2e951]: Parrainage Standard
                  - generic [ref=f2e952]:
                    - generic [ref=f2e953]: "+221700000003"
                    - generic [ref=f2e957]: partner-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e963] [cursor=pointer]
              - generic [ref=f2e965]:
                - generic [ref=f2e966]:
                  - generic [ref=f2e967]:
                    - heading "Birame ClientBis" [level=4] [ref=f2e968]
                    - generic [ref=f2e969]: Client
                    - generic [ref=f2e970]: Parrainage Standard
                  - generic [ref=f2e971]:
                    - generic [ref=f2e972]: "+221700000002"
                    - generic [ref=f2e976]: client-bis@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e982] [cursor=pointer]
              - generic [ref=f2e984]:
                - generic [ref=f2e985]:
                  - generic [ref=f2e986]:
                    - heading "Awa Client" [level=4] [ref=f2e987]
                    - generic [ref=f2e988]: Client
                    - generic [ref=f2e989]: Parrainage Standard
                  - generic [ref=f2e990]:
                    - generic [ref=f2e991]: "+221700000001"
                    - generic [ref=f2e995]: client@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1001] [cursor=pointer]
  - alert [ref=f2e1003]
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
      |                                                                                        ^ Error: contrôles responsive de adm-parrainage (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```