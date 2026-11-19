# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-parrainage — Parrainage
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-parrainage (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 20

- Array []
+ Array [
+   "320 px : défilement horizontal (largeur du document 344 px, fenêtre 320 px)",
+   "320 px : texte hors de l’écran : span « marieme.niang.23@demo.eventvillage.local » de 74 à 324 px (fenêtre 320 px) ; span « modou.mboup.18@demo.eventvillage.local » de 74 à 324 px (fenêtre 320 px) ; span « mamadou.kebe.14@demo.eventvillage.local » de 74 à 328 px (fenêtre 320 px) ; span « fatoumata.camara.13@demo.eventvillage.local » de 74 à 344 px (fenêtre 320 px) ; span « babacar.diagne.06@demo.eventvillage.local » de 74 à 332 px (fenêtre 320 px)",
+   "320 px : texte tronqué sans le texte entier : small.text-caption.max-w-full « Validation » (points de suspension, texte entier absent)",
+   "320 px : 5 cible(s) < 44 px : a « sans nom » 31×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "320 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
+   "360 px : 5 cible(s) < 44 px : a « sans nom » 35×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "360 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
+   "390 px : 5 cible(s) < 44 px : a « sans nom » 39×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "390 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : 5 cible(s) < 44 px : a « sans nom » 40×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "768 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; span.block.truncate « Superadmin » (points de suspension, texte entier absent)",
+   "1024 px : 5 cible(s) < 44 px : a « sans nom » 40×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "1024 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+   "1440 px : 5 cible(s) < 44 px : a « sans nom » 40×40 ; input « sans nom » 202×30 ; button « Tous » 47×24 ; button « Ambassadeurs » 106×24 ; button « Standard » 74×24",
+   "1440 px : 298 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Nommez un ambassadeur pour majorer ses … » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « Tous » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Ambassadeurs » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Standard » (div.flex.flex-wrap > div.flex.items-center > button.px-2.5.py-1) ; 12 px « Assane » (div.space-y-1.flex-1 > div.flex.items-center > h4.text-xs.font-black)",
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
          - generic [ref=f5e139]:
            - generic [ref=f5e140]:
              - link [ref=f5e141] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Parrainage et ambassadeurs" [level=1] [ref=f5e145]
            - button "Actualiser" [ref=f5e146] [cursor=pointer]
          - generic [ref=f5e153]:
            - generic [ref=f5e154]:
              - paragraph [ref=f5e156]: Utilisateurs
              - paragraph [ref=f5e163]: "42"
              - paragraph [ref=f5e164]: 42 compte(s) standard
            - generic [ref=f5e165]:
              - paragraph [ref=f5e167]: Ambassadeurs actifs
              - paragraph [ref=f5e171]: "0"
              - paragraph [ref=f5e172]: "Taux ambassadeur : 7 % sur les filleuls directs, 2 % sur les filleuls de ses filleuls"
            - generic [ref=f5e173]:
              - paragraph [ref=f5e175]: Durée du parrainage
              - paragraph [ref=f5e180]: 12 mois
              - paragraph [ref=f5e181]: Compte standard ; 24 mois pour un ambassadeur
          - status [ref=f5e182]:
            - paragraph [ref=f5e188]: La personnalisation des taux n’est pas disponible pour le moment.
          - generic [ref=f5e189]:
            - generic [ref=f5e190]:
              - generic [ref=f5e191]:
                - heading "Répertoire des Utilisateurs" [level=2] [ref=f5e192]
                - paragraph [ref=f5e193]: Nommez un ambassadeur pour majorer ses commissions sur ses filleuls directs et sur les filleuls de ses filleuls.
              - generic [ref=f5e194]:
                - textbox "Rechercher par nom, email, téléphone..." [ref=f5e199]
                - generic [ref=f5e200]:
                  - button "Tous" [ref=f5e201] [cursor=pointer]
                  - button "Ambassadeurs" [ref=f5e202] [cursor=pointer]
                  - button "Standard" [ref=f5e203] [cursor=pointer]
            - generic [ref=f5e204]:
              - generic [ref=f5e205]:
                - generic [ref=f5e206]:
                  - generic [ref=f5e207]:
                    - heading "Assane Badji" [level=4] [ref=f5e208]
                    - generic [ref=f5e209]: Client
                    - generic [ref=f5e210]: Parrainage Standard
                  - generic [ref=f5e211]:
                    - generic [ref=f5e212]: "+221700000224"
                    - generic [ref=f5e216]: assane.badji.24@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e222] [cursor=pointer]
              - generic [ref=f5e224]:
                - generic [ref=f5e225]:
                  - generic [ref=f5e226]:
                    - heading "Marième Niang" [level=4] [ref=f5e227]
                    - generic [ref=f5e228]: Client
                    - generic [ref=f5e229]: Parrainage Standard
                  - generic [ref=f5e230]:
                    - generic [ref=f5e231]: "+221700000223"
                    - generic [ref=f5e235]: marieme.niang.23@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e241] [cursor=pointer]
              - generic [ref=f5e243]:
                - generic [ref=f5e244]:
                  - generic [ref=f5e245]:
                    - heading "Omar Gaye" [level=4] [ref=f5e246]
                    - generic [ref=f5e247]: Client
                    - generic [ref=f5e248]: Parrainage Standard
                  - generic [ref=f5e249]:
                    - generic [ref=f5e250]: "+221700000222"
                    - generic [ref=f5e254]: omar.gaye.22@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e260] [cursor=pointer]
              - generic [ref=f5e262]:
                - generic [ref=f5e263]:
                  - generic [ref=f5e264]:
                    - heading "Dieynaba Tall" [level=4] [ref=f5e265]
                    - generic [ref=f5e266]: Client
                    - generic [ref=f5e267]: Parrainage Standard
                  - generic [ref=f5e268]:
                    - generic [ref=f5e269]: "+221700000221"
                    - generic [ref=f5e273]: dieynaba.tall.21@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e279] [cursor=pointer]
              - generic [ref=f5e281]:
                - generic [ref=f5e282]:
                  - generic [ref=f5e283]:
                    - heading "Saliou Touré" [level=4] [ref=f5e284]
                    - generic [ref=f5e285]: Client
                    - generic [ref=f5e286]: Parrainage Standard
                  - generic [ref=f5e287]:
                    - generic [ref=f5e288]: "+221700000220"
                    - generic [ref=f5e292]: saliou.toure.20@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e298] [cursor=pointer]
              - generic [ref=f5e300]:
                - generic [ref=f5e301]:
                  - generic [ref=f5e302]:
                    - heading "Bineta Kane" [level=4] [ref=f5e303]
                    - generic [ref=f5e304]: Client
                    - generic [ref=f5e305]: Parrainage Standard
                  - generic [ref=f5e306]:
                    - generic [ref=f5e307]: "+221700000219"
                    - generic [ref=f5e311]: bineta.kane.19@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e317] [cursor=pointer]
              - generic [ref=f5e319]:
                - generic [ref=f5e320]:
                  - generic [ref=f5e321]:
                    - heading "Modou Mboup" [level=4] [ref=f5e322]
                    - generic [ref=f5e323]: Client
                    - generic [ref=f5e324]: Parrainage Standard
                  - generic [ref=f5e325]:
                    - generic [ref=f5e326]: "+221700000218"
                    - generic [ref=f5e330]: modou.mboup.18@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e336] [cursor=pointer]
              - generic [ref=f5e338]:
                - generic [ref=f5e339]:
                  - generic [ref=f5e340]:
                    - heading "Yacine Dieng" [level=4] [ref=f5e341]
                    - generic [ref=f5e342]: Client
                    - generic [ref=f5e343]: Parrainage Standard
                  - generic [ref=f5e344]:
                    - generic [ref=f5e345]: "+221700000217"
                    - generic [ref=f5e349]: yacine.dieng.17@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e355] [cursor=pointer]
              - generic [ref=f5e357]:
                - generic [ref=f5e358]:
                  - generic [ref=f5e359]:
                    - heading "Ibou Mbengue" [level=4] [ref=f5e360]
                    - generic [ref=f5e361]: Client
                    - generic [ref=f5e362]: Parrainage Standard
                  - generic [ref=f5e363]:
                    - generic [ref=f5e364]: "+221700000216"
                    - generic [ref=f5e368]: ibou.mbengue.16@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e374] [cursor=pointer]
              - generic [ref=f5e376]:
                - generic [ref=f5e377]:
                  - generic [ref=f5e378]:
                    - heading "Astou Sow" [level=4] [ref=f5e379]
                    - generic [ref=f5e380]: Client
                    - generic [ref=f5e381]: Parrainage Standard
                  - generic [ref=f5e382]:
                    - generic [ref=f5e383]: "+221700000215"
                    - generic [ref=f5e387]: astou.sow.15@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e393] [cursor=pointer]
              - generic [ref=f5e395]:
                - generic [ref=f5e396]:
                  - generic [ref=f5e397]:
                    - heading "Mamadou Kébé" [level=4] [ref=f5e398]
                    - generic [ref=f5e399]: Client
                    - generic [ref=f5e400]: Parrainage Standard
                  - generic [ref=f5e401]:
                    - generic [ref=f5e402]: "+221700000214"
                    - generic [ref=f5e406]: mamadou.kebe.14@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e412] [cursor=pointer]
              - generic [ref=f5e414]:
                - generic [ref=f5e415]:
                  - generic [ref=f5e416]:
                    - heading "Fatoumata Camara" [level=4] [ref=f5e417]
                    - generic [ref=f5e418]: Client
                    - generic [ref=f5e419]: Parrainage Standard
                  - generic [ref=f5e420]:
                    - generic [ref=f5e421]: "+221700000213"
                    - generic [ref=f5e425]: fatoumata.camara.13@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e431] [cursor=pointer]
              - generic [ref=f5e433]:
                - generic [ref=f5e434]:
                  - generic [ref=f5e435]:
                    - heading "Adama Diouf" [level=4] [ref=f5e436]
                    - generic [ref=f5e437]: Client
                    - generic [ref=f5e438]: Parrainage Standard
                  - generic [ref=f5e439]:
                    - generic [ref=f5e440]: "+221700000212"
                    - generic [ref=f5e444]: adama.diouf.12@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e450] [cursor=pointer]
              - generic [ref=f5e452]:
                - generic [ref=f5e453]:
                  - generic [ref=f5e454]:
                    - heading "Rokhaya Ndao" [level=4] [ref=f5e455]
                    - generic [ref=f5e456]: Client
                    - generic [ref=f5e457]: Parrainage Standard
                  - generic [ref=f5e458]:
                    - generic [ref=f5e459]: "+221700000211"
                    - generic [ref=f5e463]: rokhaya.ndao.11@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e469] [cursor=pointer]
              - generic [ref=f5e471]:
                - generic [ref=f5e472]:
                  - generic [ref=f5e473]:
                    - heading "Pape Lo" [level=4] [ref=f5e474]
                    - generic [ref=f5e475]: Client
                    - generic [ref=f5e476]: Parrainage Standard
                  - generic [ref=f5e477]:
                    - generic [ref=f5e478]: "+221700000210"
                    - generic [ref=f5e482]: pape.lo.10@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e488] [cursor=pointer]
              - generic [ref=f5e490]:
                - generic [ref=f5e491]:
                  - generic [ref=f5e492]:
                    - heading "Coumba Ka" [level=4] [ref=f5e493]
                    - generic [ref=f5e494]: Client
                    - generic [ref=f5e495]: Parrainage Standard
                  - generic [ref=f5e496]:
                    - generic [ref=f5e497]: "+221700000209"
                    - generic [ref=f5e501]: coumba.ka.09@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e507] [cursor=pointer]
              - generic [ref=f5e509]:
                - generic [ref=f5e510]:
                  - generic [ref=f5e511]:
                    - heading "Alioune Fall" [level=4] [ref=f5e512]
                    - generic [ref=f5e513]: Client
                    - generic [ref=f5e514]: Parrainage Standard
                  - generic [ref=f5e515]:
                    - generic [ref=f5e516]: "+221700000208"
                    - generic [ref=f5e520]: alioune.fall.08@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e526] [cursor=pointer]
              - generic [ref=f5e528]:
                - generic [ref=f5e529]:
                  - generic [ref=f5e530]:
                    - heading "Mame Ndour" [level=4] [ref=f5e531]
                    - generic [ref=f5e532]: Client
                    - generic [ref=f5e533]: Parrainage Standard
                  - generic [ref=f5e534]:
                    - generic [ref=f5e535]: "+221700000207"
                    - generic [ref=f5e539]: mame.ndour.07@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e545] [cursor=pointer]
              - generic [ref=f5e547]:
                - generic [ref=f5e548]:
                  - generic [ref=f5e549]:
                    - heading "Babacar Diagne" [level=4] [ref=f5e550]
                    - generic [ref=f5e551]: Client
                    - generic [ref=f5e552]: Parrainage Standard
                  - generic [ref=f5e553]:
                    - generic [ref=f5e554]: "+221700000206"
                    - generic [ref=f5e558]: babacar.diagne.06@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e564] [cursor=pointer]
              - generic [ref=f5e566]:
                - generic [ref=f5e567]:
                  - generic [ref=f5e568]:
                    - heading "Ndeye Thiam" [level=4] [ref=f5e569]
                    - generic [ref=f5e570]: Client
                    - generic [ref=f5e571]: Parrainage Standard
                  - generic [ref=f5e572]:
                    - generic [ref=f5e573]: "+221700000205"
                    - generic [ref=f5e577]: ndeye.thiam.05@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e583] [cursor=pointer]
              - generic [ref=f5e585]:
                - generic [ref=f5e586]:
                  - generic [ref=f5e587]:
                    - heading "Cheikh Sarr" [level=4] [ref=f5e588]
                    - generic [ref=f5e589]: Client
                    - generic [ref=f5e590]: Parrainage Standard
                  - generic [ref=f5e591]:
                    - generic [ref=f5e592]: "+221700000204"
                    - generic [ref=f5e596]: cheikh.sarr.04@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e602] [cursor=pointer]
              - generic [ref=f5e604]:
                - generic [ref=f5e605]:
                  - generic [ref=f5e606]:
                    - heading "Aminata Sène" [level=4] [ref=f5e607]
                    - generic [ref=f5e608]: Client
                    - generic [ref=f5e609]: Parrainage Standard
                  - generic [ref=f5e610]:
                    - generic [ref=f5e611]: "+221700000203"
                    - generic [ref=f5e615]: aminata.sene.03@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e621] [cursor=pointer]
              - generic [ref=f5e623]:
                - generic [ref=f5e624]:
                  - generic [ref=f5e625]:
                    - heading "Moussa Sy" [level=4] [ref=f5e626]
                    - generic [ref=f5e627]: Client
                    - generic [ref=f5e628]: Parrainage Standard
                  - generic [ref=f5e629]:
                    - generic [ref=f5e630]: "+221700000202"
                    - generic [ref=f5e634]: moussa.sy.02@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e640] [cursor=pointer]
              - generic [ref=f5e642]:
                - generic [ref=f5e643]:
                  - generic [ref=f5e644]:
                    - heading "Awa Diop" [level=4] [ref=f5e645]
                    - generic [ref=f5e646]: Client
                    - generic [ref=f5e647]: Parrainage Standard
                  - generic [ref=f5e648]:
                    - generic [ref=f5e649]: "+221700000201"
                    - generic [ref=f5e653]: awa.diop.01@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e659] [cursor=pointer]
              - generic [ref=f5e661]:
                - generic [ref=f5e662]:
                  - generic [ref=f5e663]:
                    - heading "Mamadou Sall" [level=4] [ref=f5e664]
                    - generic [ref=f5e665]: Contrôleur
                    - generic [ref=f5e666]: Parrainage Standard
                  - generic [ref=f5e667]:
                    - generic [ref=f5e668]: "+221700000110"
                    - generic [ref=f5e672]: mamadou.sall@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e678] [cursor=pointer]
              - generic [ref=f5e680]:
                - generic [ref=f5e681]:
                  - generic [ref=f5e682]:
                    - heading "Ndèye Gning" [level=4] [ref=f5e683]
                    - generic [ref=f5e684]: Partenaire
                    - generic [ref=f5e685]: Parrainage Standard
                  - generic [ref=f5e686]:
                    - generic [ref=f5e687]: "+221700000109"
                    - generic [ref=f5e691]: ndeye.gning@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e697] [cursor=pointer]
              - generic [ref=f5e699]:
                - generic [ref=f5e700]:
                  - generic [ref=f5e701]:
                    - heading "Lamine Cissé" [level=4] [ref=f5e702]
                    - generic [ref=f5e703]: Contrôleur
                    - generic [ref=f5e704]: Parrainage Standard
                  - generic [ref=f5e705]:
                    - generic [ref=f5e706]: "+221700000108"
                    - generic [ref=f5e710]: lamine.cisse@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e716] [cursor=pointer]
              - generic [ref=f5e718]:
                - generic [ref=f5e719]:
                  - generic [ref=f5e720]:
                    - heading "Seynabou Ba" [level=4] [ref=f5e721]
                    - generic [ref=f5e722]: Contrôleur
                    - generic [ref=f5e723]: Parrainage Standard
                  - generic [ref=f5e724]:
                    - generic [ref=f5e725]: "+221700000107"
                    - generic [ref=f5e729]: seynabou.ba@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e735] [cursor=pointer]
              - generic [ref=f5e737]:
                - generic [ref=f5e738]:
                  - generic [ref=f5e739]:
                    - heading "Ibrahima Gueye" [level=4] [ref=f5e740]
                    - generic [ref=f5e741]: Contrôleur
                    - generic [ref=f5e742]: Parrainage Standard
                  - generic [ref=f5e743]:
                    - generic [ref=f5e744]: "+221700000106"
                    - generic [ref=f5e748]: ibrahima.gueye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e754] [cursor=pointer]
              - generic [ref=f5e756]:
                - generic [ref=f5e757]:
                  - generic [ref=f5e758]:
                    - heading "Fatou Mbaye" [level=4] [ref=f5e759]
                    - generic [ref=f5e760]: Client
                    - generic [ref=f5e761]: Parrainage Standard
                  - generic [ref=f5e762]:
                    - generic [ref=f5e763]: "+221700000105"
                    - generic [ref=f5e767]: fatou.mbaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e773] [cursor=pointer]
              - generic [ref=f5e775]:
                - generic [ref=f5e776]:
                  - generic [ref=f5e777]:
                    - heading "Aïda Diallo" [level=4] [ref=f5e778]
                    - generic [ref=f5e779]: Administrateur
                    - generic [ref=f5e780]: Parrainage Standard
                  - generic [ref=f5e781]:
                    - generic [ref=f5e782]: "+221700000104"
                    - generic [ref=f5e786]: aida.diallo@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e792] [cursor=pointer]
              - generic [ref=f5e794]:
                - generic [ref=f5e795]:
                  - generic [ref=f5e796]:
                    - heading "Khady Sarr" [level=4] [ref=f5e797]
                    - generic [ref=f5e798]: Partenaire
                    - generic [ref=f5e799]: Parrainage Standard
                  - generic [ref=f5e800]:
                    - generic [ref=f5e801]: "+221700000103"
                    - generic [ref=f5e805]: khady.sarr@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e811] [cursor=pointer]
              - generic [ref=f5e813]:
                - generic [ref=f5e814]:
                  - generic [ref=f5e815]:
                    - heading "Ousmane Faye" [level=4] [ref=f5e816]
                    - generic [ref=f5e817]: Partenaire
                    - generic [ref=f5e818]: Parrainage Standard
                  - generic [ref=f5e819]:
                    - generic [ref=f5e820]: "+221700000102"
                    - generic [ref=f5e824]: ousmane.faye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e830] [cursor=pointer]
              - generic [ref=f5e832]:
                - generic [ref=f5e833]:
                  - generic [ref=f5e834]:
                    - heading "Mariama Ndiaye" [level=4] [ref=f5e835]
                    - generic [ref=f5e836]: Partenaire
                    - generic [ref=f5e837]: Parrainage Standard
                  - generic [ref=f5e838]:
                    - generic [ref=f5e839]: "+221700000101"
                    - generic [ref=f5e843]: mariama.ndiaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e849] [cursor=pointer]
              - generic [ref=f5e851]:
                - generic [ref=f5e852]:
                  - generic [ref=f5e853]:
                    - heading "Fatou Suspendue" [level=4] [ref=f5e854]
                    - generic [ref=f5e855]: Client
                    - generic [ref=f5e856]: Parrainage Standard
                  - generic [ref=f5e857]:
                    - generic [ref=f5e858]: "+221700000008"
                    - generic [ref=f5e862]: suspendu@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e868] [cursor=pointer]
              - generic [ref=f5e870]:
                - generic [ref=f5e871]:
                  - generic [ref=f5e872]:
                    - heading "Elhadji SuperAdmin" [level=4] [ref=f5e873]
                    - generic [ref=f5e874]: Superadmin
                    - generic [ref=f5e875]: Parrainage Standard
                  - generic [ref=f5e876]:
                    - generic [ref=f5e877]: "+221700000007"
                    - generic [ref=f5e881]: superadmin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e887] [cursor=pointer]
              - generic [ref=f5e889]:
                - generic [ref=f5e890]:
                  - generic [ref=f5e891]:
                    - heading "Dior Admin" [level=4] [ref=f5e892]
                    - generic [ref=f5e893]: Administrateur
                    - generic [ref=f5e894]: Parrainage Standard
                  - generic [ref=f5e895]:
                    - generic [ref=f5e896]: "+221700000006"
                    - generic [ref=f5e900]: admin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e906] [cursor=pointer]
              - generic [ref=f5e908]:
                - generic [ref=f5e909]:
                  - generic [ref=f5e910]:
                    - heading "Cheikh ControleurA" [level=4] [ref=f5e911]
                    - generic [ref=f5e912]: Contrôleur
                    - generic [ref=f5e913]: Parrainage Standard
                  - generic [ref=f5e914]:
                    - generic [ref=f5e915]: "+221700000005"
                    - generic [ref=f5e919]: controller-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e925] [cursor=pointer]
              - generic [ref=f5e927]:
                - generic [ref=f5e928]:
                  - generic [ref=f5e929]:
                    - heading "Bassirou OrgaB" [level=4] [ref=f5e930]
                    - generic [ref=f5e931]: Partenaire
                    - generic [ref=f5e932]: Parrainage Standard
                  - generic [ref=f5e933]:
                    - generic [ref=f5e934]: "+221700000004"
                    - generic [ref=f5e938]: partner-b@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e944] [cursor=pointer]
              - generic [ref=f5e946]:
                - generic [ref=f5e947]:
                  - generic [ref=f5e948]:
                    - heading "Aïssatou OrgaA" [level=4] [ref=f5e949]
                    - generic [ref=f5e950]: Partenaire
                    - generic [ref=f5e951]: Parrainage Standard
                  - generic [ref=f5e952]:
                    - generic [ref=f5e953]: "+221700000003"
                    - generic [ref=f5e957]: partner-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e963] [cursor=pointer]
              - generic [ref=f5e965]:
                - generic [ref=f5e966]:
                  - generic [ref=f5e967]:
                    - heading "Birame ClientBis" [level=4] [ref=f5e968]
                    - generic [ref=f5e969]: Client
                    - generic [ref=f5e970]: Parrainage Standard
                  - generic [ref=f5e971]:
                    - generic [ref=f5e972]: "+221700000002"
                    - generic [ref=f5e976]: client-bis@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e982] [cursor=pointer]
              - generic [ref=f5e984]:
                - generic [ref=f5e985]:
                  - generic [ref=f5e986]:
                    - heading "Awa Client" [level=4] [ref=f5e987]
                    - generic [ref=f5e988]: Client
                    - generic [ref=f5e989]: Parrainage Standard
                  - generic [ref=f5e990]:
                    - generic [ref=f5e991]: "+221700000001"
                    - generic [ref=f5e995]: client@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1001] [cursor=pointer]
  - alert [ref=f5e1003]
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
      |                                                                                        ^ Error: contrôles responsive de adm-parrainage (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```