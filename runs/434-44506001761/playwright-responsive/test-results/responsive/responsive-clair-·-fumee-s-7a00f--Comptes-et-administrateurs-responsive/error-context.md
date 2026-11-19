# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-comptes — Comptes et administrateurs
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-comptes (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 14

- Array []
+ Array [
+   "320 px : défilement horizontal (largeur du document 336 px, fenêtre 320 px)",
+   "320 px : texte hors de l’écran : span « fatoumata.camara.13@demo.eventvillage.local » de 66 à 336 px (fenêtre 320 px) ; span « babacar.diagne.06@demo.eventvillage.local » de 66 à 324 px (fenêtre 320 px)",
+   "320 px : texte tronqué sans le texte entier : small.text-caption.max-w-full « Validation » (points de suspension, texte entier absent)",
+   "320 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
+   "360 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
+   "390 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; span.block.truncate « Superadmin » (points de suspension, texte entier absent)",
+   "1024 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+   "1440 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
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
              - link "Retour à l’accueil de l’administration" [ref=f5e141] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Comptes et administrateurs" [level=1] [ref=f5e145]
            - generic [ref=f5e146]:
              - button "Actualiser" [ref=f5e147] [cursor=pointer]
              - button "Créer un compte" [ref=f5e154] [cursor=pointer]
          - generic [ref=f5e160]:
            - generic [ref=f5e161]:
              - searchbox "Rechercher un compte" [ref=f5e166]
              - group "Filtrer par rôle" [ref=f5e167]:
                - button "Tous" [pressed] [ref=f5e168] [cursor=pointer]
                - button "Superadmin" [ref=f5e169] [cursor=pointer]
                - button "Administrateur" [ref=f5e170] [cursor=pointer]
                - button "Partenaire" [ref=f5e171] [cursor=pointer]
                - button "Contrôleur" [ref=f5e172] [cursor=pointer]
                - button "Client" [ref=f5e173] [cursor=pointer]
            - generic [ref=f5e174]:
              - generic [ref=f5e175]:
                - generic [ref=f5e176]:
                  - generic [ref=f5e177]:
                    - heading "Assane Badji" [level=4] [ref=f5e178]
                    - generic [ref=f5e179]: Client
                    - generic [ref=f5e180]: Actif
                  - generic [ref=f5e181]:
                    - generic [ref=f5e182]: "+221700000224"
                    - generic [ref=f5e186]: assane.badji.24@demo.eventvillage.local
                - generic [ref=f5e191]:
                  - button "Changer le rôle" [ref=f5e192] [cursor=pointer]
                  - button "Suspendre" [ref=f5e194] [cursor=pointer]
                  - button "Supprimer" [ref=f5e196] [cursor=pointer]
              - generic [ref=f5e201]:
                - generic [ref=f5e202]:
                  - generic [ref=f5e203]:
                    - heading "Marième Niang" [level=4] [ref=f5e204]
                    - generic [ref=f5e205]: Client
                    - generic [ref=f5e206]: Actif
                  - generic [ref=f5e207]:
                    - generic [ref=f5e208]: "+221700000223"
                    - generic [ref=f5e212]: marieme.niang.23@demo.eventvillage.local
                - generic [ref=f5e217]:
                  - button "Changer le rôle" [ref=f5e218] [cursor=pointer]
                  - button "Suspendre" [ref=f5e220] [cursor=pointer]
                  - button "Supprimer" [ref=f5e222] [cursor=pointer]
              - generic [ref=f5e227]:
                - generic [ref=f5e228]:
                  - generic [ref=f5e229]:
                    - heading "Omar Gaye" [level=4] [ref=f5e230]
                    - generic [ref=f5e231]: Client
                    - generic [ref=f5e232]: Actif
                  - generic [ref=f5e233]:
                    - generic [ref=f5e234]: "+221700000222"
                    - generic [ref=f5e238]: omar.gaye.22@demo.eventvillage.local
                - generic [ref=f5e243]:
                  - button "Changer le rôle" [ref=f5e244] [cursor=pointer]
                  - button "Suspendre" [ref=f5e246] [cursor=pointer]
                  - button "Supprimer" [ref=f5e248] [cursor=pointer]
              - generic [ref=f5e253]:
                - generic [ref=f5e254]:
                  - generic [ref=f5e255]:
                    - heading "Dieynaba Tall" [level=4] [ref=f5e256]
                    - generic [ref=f5e257]: Client
                    - generic [ref=f5e258]: Actif
                  - generic [ref=f5e259]:
                    - generic [ref=f5e260]: "+221700000221"
                    - generic [ref=f5e264]: dieynaba.tall.21@demo.eventvillage.local
                - generic [ref=f5e269]:
                  - button "Changer le rôle" [ref=f5e270] [cursor=pointer]
                  - button "Suspendre" [ref=f5e272] [cursor=pointer]
                  - button "Supprimer" [ref=f5e274] [cursor=pointer]
              - generic [ref=f5e279]:
                - generic [ref=f5e280]:
                  - generic [ref=f5e281]:
                    - heading "Saliou Touré" [level=4] [ref=f5e282]
                    - generic [ref=f5e283]: Client
                    - generic [ref=f5e284]: Actif
                  - generic [ref=f5e285]:
                    - generic [ref=f5e286]: "+221700000220"
                    - generic [ref=f5e290]: saliou.toure.20@demo.eventvillage.local
                - generic [ref=f5e295]:
                  - button "Changer le rôle" [ref=f5e296] [cursor=pointer]
                  - button "Suspendre" [ref=f5e298] [cursor=pointer]
                  - button "Supprimer" [ref=f5e300] [cursor=pointer]
              - generic [ref=f5e305]:
                - generic [ref=f5e306]:
                  - generic [ref=f5e307]:
                    - heading "Bineta Kane" [level=4] [ref=f5e308]
                    - generic [ref=f5e309]: Client
                    - generic [ref=f5e310]: Actif
                  - generic [ref=f5e311]:
                    - generic [ref=f5e312]: "+221700000219"
                    - generic [ref=f5e316]: bineta.kane.19@demo.eventvillage.local
                - generic [ref=f5e321]:
                  - button "Changer le rôle" [ref=f5e322] [cursor=pointer]
                  - button "Suspendre" [ref=f5e324] [cursor=pointer]
                  - button "Supprimer" [ref=f5e326] [cursor=pointer]
              - generic [ref=f5e331]:
                - generic [ref=f5e332]:
                  - generic [ref=f5e333]:
                    - heading "Modou Mboup" [level=4] [ref=f5e334]
                    - generic [ref=f5e335]: Client
                    - generic [ref=f5e336]: Actif
                  - generic [ref=f5e337]:
                    - generic [ref=f5e338]: "+221700000218"
                    - generic [ref=f5e342]: modou.mboup.18@demo.eventvillage.local
                - generic [ref=f5e347]:
                  - button "Changer le rôle" [ref=f5e348] [cursor=pointer]
                  - button "Suspendre" [ref=f5e350] [cursor=pointer]
                  - button "Supprimer" [ref=f5e352] [cursor=pointer]
              - generic [ref=f5e357]:
                - generic [ref=f5e358]:
                  - generic [ref=f5e359]:
                    - heading "Yacine Dieng" [level=4] [ref=f5e360]
                    - generic [ref=f5e361]: Client
                    - generic [ref=f5e362]: Actif
                  - generic [ref=f5e363]:
                    - generic [ref=f5e364]: "+221700000217"
                    - generic [ref=f5e368]: yacine.dieng.17@demo.eventvillage.local
                - generic [ref=f5e373]:
                  - button "Changer le rôle" [ref=f5e374] [cursor=pointer]
                  - button "Suspendre" [ref=f5e376] [cursor=pointer]
                  - button "Supprimer" [ref=f5e378] [cursor=pointer]
              - generic [ref=f5e383]:
                - generic [ref=f5e384]:
                  - generic [ref=f5e385]:
                    - heading "Ibou Mbengue" [level=4] [ref=f5e386]
                    - generic [ref=f5e387]: Client
                    - generic [ref=f5e388]: Actif
                  - generic [ref=f5e389]:
                    - generic [ref=f5e390]: "+221700000216"
                    - generic [ref=f5e394]: ibou.mbengue.16@demo.eventvillage.local
                - generic [ref=f5e399]:
                  - button "Changer le rôle" [ref=f5e400] [cursor=pointer]
                  - button "Suspendre" [ref=f5e402] [cursor=pointer]
                  - button "Supprimer" [ref=f5e404] [cursor=pointer]
              - generic [ref=f5e409]:
                - generic [ref=f5e410]:
                  - generic [ref=f5e411]:
                    - heading "Astou Sow" [level=4] [ref=f5e412]
                    - generic [ref=f5e413]: Client
                    - generic [ref=f5e414]: Actif
                  - generic [ref=f5e415]:
                    - generic [ref=f5e416]: "+221700000215"
                    - generic [ref=f5e420]: astou.sow.15@demo.eventvillage.local
                - generic [ref=f5e425]:
                  - button "Changer le rôle" [ref=f5e426] [cursor=pointer]
                  - button "Suspendre" [ref=f5e428] [cursor=pointer]
                  - button "Supprimer" [ref=f5e430] [cursor=pointer]
              - generic [ref=f5e435]:
                - generic [ref=f5e436]:
                  - generic [ref=f5e437]:
                    - heading "Mamadou Kébé" [level=4] [ref=f5e438]
                    - generic [ref=f5e439]: Client
                    - generic [ref=f5e440]: Actif
                  - generic [ref=f5e441]:
                    - generic [ref=f5e442]: "+221700000214"
                    - generic [ref=f5e446]: mamadou.kebe.14@demo.eventvillage.local
                - generic [ref=f5e451]:
                  - button "Changer le rôle" [ref=f5e452] [cursor=pointer]
                  - button "Suspendre" [ref=f5e454] [cursor=pointer]
                  - button "Supprimer" [ref=f5e456] [cursor=pointer]
              - generic [ref=f5e461]:
                - generic [ref=f5e462]:
                  - generic [ref=f5e463]:
                    - heading "Fatoumata Camara" [level=4] [ref=f5e464]
                    - generic [ref=f5e465]: Client
                    - generic [ref=f5e466]: Actif
                  - generic [ref=f5e467]:
                    - generic [ref=f5e468]: "+221700000213"
                    - generic [ref=f5e472]: fatoumata.camara.13@demo.eventvillage.local
                - generic [ref=f5e477]:
                  - button "Changer le rôle" [ref=f5e478] [cursor=pointer]
                  - button "Suspendre" [ref=f5e480] [cursor=pointer]
                  - button "Supprimer" [ref=f5e482] [cursor=pointer]
              - generic [ref=f5e487]:
                - generic [ref=f5e488]:
                  - generic [ref=f5e489]:
                    - heading "Adama Diouf" [level=4] [ref=f5e490]
                    - generic [ref=f5e491]: Client
                    - generic [ref=f5e492]: Actif
                  - generic [ref=f5e493]:
                    - generic [ref=f5e494]: "+221700000212"
                    - generic [ref=f5e498]: adama.diouf.12@demo.eventvillage.local
                - generic [ref=f5e503]:
                  - button "Changer le rôle" [ref=f5e504] [cursor=pointer]
                  - button "Suspendre" [ref=f5e506] [cursor=pointer]
                  - button "Supprimer" [ref=f5e508] [cursor=pointer]
              - generic [ref=f5e513]:
                - generic [ref=f5e514]:
                  - generic [ref=f5e515]:
                    - heading "Rokhaya Ndao" [level=4] [ref=f5e516]
                    - generic [ref=f5e517]: Client
                    - generic [ref=f5e518]: Actif
                  - generic [ref=f5e519]:
                    - generic [ref=f5e520]: "+221700000211"
                    - generic [ref=f5e524]: rokhaya.ndao.11@demo.eventvillage.local
                - generic [ref=f5e529]:
                  - button "Changer le rôle" [ref=f5e530] [cursor=pointer]
                  - button "Suspendre" [ref=f5e532] [cursor=pointer]
                  - button "Supprimer" [ref=f5e534] [cursor=pointer]
              - generic [ref=f5e539]:
                - generic [ref=f5e540]:
                  - generic [ref=f5e541]:
                    - heading "Pape Lo" [level=4] [ref=f5e542]
                    - generic [ref=f5e543]: Client
                    - generic [ref=f5e544]: Actif
                  - generic [ref=f5e545]:
                    - generic [ref=f5e546]: "+221700000210"
                    - generic [ref=f5e550]: pape.lo.10@demo.eventvillage.local
                - generic [ref=f5e555]:
                  - button "Changer le rôle" [ref=f5e556] [cursor=pointer]
                  - button "Suspendre" [ref=f5e558] [cursor=pointer]
                  - button "Supprimer" [ref=f5e560] [cursor=pointer]
              - generic [ref=f5e565]:
                - generic [ref=f5e566]:
                  - generic [ref=f5e567]:
                    - heading "Coumba Ka" [level=4] [ref=f5e568]
                    - generic [ref=f5e569]: Client
                    - generic [ref=f5e570]: Actif
                  - generic [ref=f5e571]:
                    - generic [ref=f5e572]: "+221700000209"
                    - generic [ref=f5e576]: coumba.ka.09@demo.eventvillage.local
                - generic [ref=f5e581]:
                  - button "Changer le rôle" [ref=f5e582] [cursor=pointer]
                  - button "Suspendre" [ref=f5e584] [cursor=pointer]
                  - button "Supprimer" [ref=f5e586] [cursor=pointer]
              - generic [ref=f5e591]:
                - generic [ref=f5e592]:
                  - generic [ref=f5e593]:
                    - heading "Alioune Fall" [level=4] [ref=f5e594]
                    - generic [ref=f5e595]: Client
                    - generic [ref=f5e596]: Actif
                  - generic [ref=f5e597]:
                    - generic [ref=f5e598]: "+221700000208"
                    - generic [ref=f5e602]: alioune.fall.08@demo.eventvillage.local
                - generic [ref=f5e607]:
                  - button "Changer le rôle" [ref=f5e608] [cursor=pointer]
                  - button "Suspendre" [ref=f5e610] [cursor=pointer]
                  - button "Supprimer" [ref=f5e612] [cursor=pointer]
              - generic [ref=f5e617]:
                - generic [ref=f5e618]:
                  - generic [ref=f5e619]:
                    - heading "Mame Ndour" [level=4] [ref=f5e620]
                    - generic [ref=f5e621]: Client
                    - generic [ref=f5e622]: Actif
                  - generic [ref=f5e623]:
                    - generic [ref=f5e624]: "+221700000207"
                    - generic [ref=f5e628]: mame.ndour.07@demo.eventvillage.local
                - generic [ref=f5e633]:
                  - button "Changer le rôle" [ref=f5e634] [cursor=pointer]
                  - button "Suspendre" [ref=f5e636] [cursor=pointer]
                  - button "Supprimer" [ref=f5e638] [cursor=pointer]
              - generic [ref=f5e643]:
                - generic [ref=f5e644]:
                  - generic [ref=f5e645]:
                    - heading "Babacar Diagne" [level=4] [ref=f5e646]
                    - generic [ref=f5e647]: Client
                    - generic [ref=f5e648]: Actif
                  - generic [ref=f5e649]:
                    - generic [ref=f5e650]: "+221700000206"
                    - generic [ref=f5e654]: babacar.diagne.06@demo.eventvillage.local
                - generic [ref=f5e659]:
                  - button "Changer le rôle" [ref=f5e660] [cursor=pointer]
                  - button "Suspendre" [ref=f5e662] [cursor=pointer]
                  - button "Supprimer" [ref=f5e664] [cursor=pointer]
              - generic [ref=f5e669]:
                - generic [ref=f5e670]:
                  - generic [ref=f5e671]:
                    - heading "Ndeye Thiam" [level=4] [ref=f5e672]
                    - generic [ref=f5e673]: Client
                    - generic [ref=f5e674]: Actif
                  - generic [ref=f5e675]:
                    - generic [ref=f5e676]: "+221700000205"
                    - generic [ref=f5e680]: ndeye.thiam.05@demo.eventvillage.local
                - generic [ref=f5e685]:
                  - button "Changer le rôle" [ref=f5e686] [cursor=pointer]
                  - button "Suspendre" [ref=f5e688] [cursor=pointer]
                  - button "Supprimer" [ref=f5e690] [cursor=pointer]
              - generic [ref=f5e695]:
                - generic [ref=f5e696]:
                  - generic [ref=f5e697]:
                    - heading "Cheikh Sarr" [level=4] [ref=f5e698]
                    - generic [ref=f5e699]: Client
                    - generic [ref=f5e700]: Actif
                  - generic [ref=f5e701]:
                    - generic [ref=f5e702]: "+221700000204"
                    - generic [ref=f5e706]: cheikh.sarr.04@demo.eventvillage.local
                - generic [ref=f5e711]:
                  - button "Changer le rôle" [ref=f5e712] [cursor=pointer]
                  - button "Suspendre" [ref=f5e714] [cursor=pointer]
                  - button "Supprimer" [ref=f5e716] [cursor=pointer]
              - generic [ref=f5e721]:
                - generic [ref=f5e722]:
                  - generic [ref=f5e723]:
                    - heading "Aminata Sène" [level=4] [ref=f5e724]
                    - generic [ref=f5e725]: Client
                    - generic [ref=f5e726]: Actif
                  - generic [ref=f5e727]:
                    - generic [ref=f5e728]: "+221700000203"
                    - generic [ref=f5e732]: aminata.sene.03@demo.eventvillage.local
                - generic [ref=f5e737]:
                  - button "Changer le rôle" [ref=f5e738] [cursor=pointer]
                  - button "Suspendre" [ref=f5e740] [cursor=pointer]
                  - button "Supprimer" [ref=f5e742] [cursor=pointer]
              - generic [ref=f5e747]:
                - generic [ref=f5e748]:
                  - generic [ref=f5e749]:
                    - heading "Moussa Sy" [level=4] [ref=f5e750]
                    - generic [ref=f5e751]: Client
                    - generic [ref=f5e752]: Actif
                  - generic [ref=f5e753]:
                    - generic [ref=f5e754]: "+221700000202"
                    - generic [ref=f5e758]: moussa.sy.02@demo.eventvillage.local
                - generic [ref=f5e763]:
                  - button "Changer le rôle" [ref=f5e764] [cursor=pointer]
                  - button "Suspendre" [ref=f5e766] [cursor=pointer]
                  - button "Supprimer" [ref=f5e768] [cursor=pointer]
              - generic [ref=f5e773]:
                - generic [ref=f5e774]:
                  - generic [ref=f5e775]:
                    - heading "Awa Diop" [level=4] [ref=f5e776]
                    - generic [ref=f5e777]: Client
                    - generic [ref=f5e778]: Actif
                  - generic [ref=f5e779]:
                    - generic [ref=f5e780]: "+221700000201"
                    - generic [ref=f5e784]: awa.diop.01@demo.eventvillage.local
                - generic [ref=f5e789]:
                  - button "Changer le rôle" [ref=f5e790] [cursor=pointer]
                  - button "Suspendre" [ref=f5e792] [cursor=pointer]
                  - button "Supprimer" [ref=f5e794] [cursor=pointer]
              - generic [ref=f5e799]:
                - generic [ref=f5e800]:
                  - generic [ref=f5e801]:
                    - heading "Mamadou Sall" [level=4] [ref=f5e802]
                    - generic [ref=f5e803]: Contrôleur
                    - generic [ref=f5e804]: Actif
                  - generic [ref=f5e805]:
                    - generic [ref=f5e806]: "+221700000110"
                    - generic [ref=f5e810]: mamadou.sall@demo.eventvillage.local
                - generic [ref=f5e815]:
                  - button "Changer le rôle" [ref=f5e816] [cursor=pointer]
                  - button "Suspendre" [ref=f5e818] [cursor=pointer]
                  - button "Supprimer" [ref=f5e820] [cursor=pointer]
              - generic [ref=f5e825]:
                - generic [ref=f5e826]:
                  - generic [ref=f5e827]:
                    - heading "Ndèye Gning" [level=4] [ref=f5e828]
                    - generic [ref=f5e829]: Partenaire
                    - generic [ref=f5e830]: Actif
                  - generic [ref=f5e831]:
                    - generic [ref=f5e832]: "+221700000109"
                    - generic [ref=f5e836]: ndeye.gning@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f5e842] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=d66bc21f-5a8b-4bf8-a268-87de08b91a57
              - generic [ref=f5e844]:
                - generic [ref=f5e845]:
                  - generic [ref=f5e846]:
                    - heading "Lamine Cissé" [level=4] [ref=f5e847]
                    - generic [ref=f5e848]: Contrôleur
                    - generic [ref=f5e849]: Actif
                  - generic [ref=f5e850]:
                    - generic [ref=f5e851]: "+221700000108"
                    - generic [ref=f5e855]: lamine.cisse@demo.eventvillage.local
                - generic [ref=f5e860]:
                  - button "Changer le rôle" [ref=f5e861] [cursor=pointer]
                  - button "Suspendre" [ref=f5e863] [cursor=pointer]
                  - button "Supprimer" [ref=f5e865] [cursor=pointer]
              - generic [ref=f5e870]:
                - generic [ref=f5e871]:
                  - generic [ref=f5e872]:
                    - heading "Seynabou Ba" [level=4] [ref=f5e873]
                    - generic [ref=f5e874]: Contrôleur
                    - generic [ref=f5e875]: Actif
                  - generic [ref=f5e876]:
                    - generic [ref=f5e877]: "+221700000107"
                    - generic [ref=f5e881]: seynabou.ba@demo.eventvillage.local
                - generic [ref=f5e886]:
                  - button "Changer le rôle" [ref=f5e887] [cursor=pointer]
                  - button "Suspendre" [ref=f5e889] [cursor=pointer]
                  - button "Supprimer" [ref=f5e891] [cursor=pointer]
              - generic [ref=f5e896]:
                - generic [ref=f5e897]:
                  - generic [ref=f5e898]:
                    - heading "Ibrahima Gueye" [level=4] [ref=f5e899]
                    - generic [ref=f5e900]: Contrôleur
                    - generic [ref=f5e901]: Actif
                  - generic [ref=f5e902]:
                    - generic [ref=f5e903]: "+221700000106"
                    - generic [ref=f5e907]: ibrahima.gueye@demo.eventvillage.local
                - generic [ref=f5e912]:
                  - button "Changer le rôle" [ref=f5e913] [cursor=pointer]
                  - button "Suspendre" [ref=f5e915] [cursor=pointer]
                  - button "Supprimer" [ref=f5e917] [cursor=pointer]
              - generic [ref=f5e922]:
                - generic [ref=f5e923]:
                  - generic [ref=f5e924]:
                    - heading "Fatou Mbaye" [level=4] [ref=f5e925]
                    - generic [ref=f5e926]: Client
                    - generic [ref=f5e927]: Actif
                  - generic [ref=f5e928]:
                    - generic [ref=f5e929]: "+221700000105"
                    - generic [ref=f5e933]: fatou.mbaye@demo.eventvillage.local
                - generic [ref=f5e938]:
                  - button "Changer le rôle" [ref=f5e939] [cursor=pointer]
                  - button "Suspendre" [ref=f5e941] [cursor=pointer]
                  - button "Supprimer" [ref=f5e943] [cursor=pointer]
              - generic [ref=f5e948]:
                - generic [ref=f5e949]:
                  - generic [ref=f5e950]:
                    - heading "Aïda Diallo" [level=4] [ref=f5e951]
                    - generic [ref=f5e952]: Administrateur
                    - generic [ref=f5e953]: Actif
                  - generic [ref=f5e954]:
                    - generic [ref=f5e955]: "+221700000104"
                    - generic [ref=f5e959]: aida.diallo@demo.eventvillage.local
                - generic [ref=f5e964]:
                  - button "Permissions" [ref=f5e965] [cursor=pointer]
                  - button "Changer le rôle" [ref=f5e971] [cursor=pointer]
                  - button "Changer le numéro" [ref=f5e973] [cursor=pointer]
                  - button "Suspendre" [ref=f5e975] [cursor=pointer]
                  - button "Supprimer" [ref=f5e977] [cursor=pointer]
              - generic [ref=f5e982]:
                - generic [ref=f5e983]:
                  - generic [ref=f5e984]:
                    - heading "Khady Sarr" [level=4] [ref=f5e985]
                    - generic [ref=f5e986]: Partenaire
                    - generic [ref=f5e987]: Actif
                  - generic [ref=f5e988]:
                    - generic [ref=f5e989]: "+221700000103"
                    - generic [ref=f5e993]: khady.sarr@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f5e999] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=f7aa34b4-ffad-42d7-b878-637dce341f12
              - generic [ref=f5e1001]:
                - generic [ref=f5e1002]:
                  - generic [ref=f5e1003]:
                    - heading "Ousmane Faye" [level=4] [ref=f5e1004]
                    - generic [ref=f5e1005]: Partenaire
                    - generic [ref=f5e1006]: Actif
                  - generic [ref=f5e1007]:
                    - generic [ref=f5e1008]: "+221700000102"
                    - generic [ref=f5e1012]: ousmane.faye@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f5e1018] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=ba306006-671d-4b8f-8ef7-5a3939d50f8f
              - generic [ref=f5e1020]:
                - generic [ref=f5e1021]:
                  - generic [ref=f5e1022]:
                    - heading "Mariama Ndiaye" [level=4] [ref=f5e1023]
                    - generic [ref=f5e1024]: Partenaire
                    - generic [ref=f5e1025]: Actif
                  - generic [ref=f5e1026]:
                    - generic [ref=f5e1027]: "+221700000101"
                    - generic [ref=f5e1031]: mariama.ndiaye@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f5e1037] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=d9bfdb1c-4152-452a-8453-bb5a7f00b153
              - generic [ref=f5e1039]:
                - generic [ref=f5e1040]:
                  - generic [ref=f5e1041]:
                    - heading "Fatou Suspendue" [level=4] [ref=f5e1042]
                    - generic [ref=f5e1043]: Client
                    - generic [ref=f5e1044]: Suspendu
                  - generic [ref=f5e1045]:
                    - generic [ref=f5e1046]: "+221700000008"
                    - generic [ref=f5e1050]: suspendu@test.eventvillage.local
                - generic [ref=f5e1055]:
                  - button "Changer le rôle" [ref=f5e1056] [cursor=pointer]
                  - button "Réactiver" [ref=f5e1058] [cursor=pointer]
                  - button "Supprimer" [ref=f5e1060] [cursor=pointer]
              - generic [ref=f5e1065]:
                - generic [ref=f5e1066]:
                  - generic [ref=f5e1067]:
                    - heading "Elhadji SuperAdmin" [level=4] [ref=f5e1068]
                    - generic [ref=f5e1069]: Superadmin
                    - generic [ref=f5e1070]: Actif
                  - generic [ref=f5e1071]:
                    - generic [ref=f5e1072]: "+221700000007"
                    - generic [ref=f5e1076]: superadmin@test.eventvillage.local
                - button "Quitter le rôle de Superadmin" [ref=f5e1082] [cursor=pointer]
              - generic [ref=f5e1084]:
                - generic [ref=f5e1085]:
                  - generic [ref=f5e1086]:
                    - heading "Dior Admin" [level=4] [ref=f5e1087]
                    - generic [ref=f5e1088]: Administrateur
                    - generic [ref=f5e1089]: Actif
                  - generic [ref=f5e1090]:
                    - generic [ref=f5e1091]: "+221700000006"
                    - generic [ref=f5e1095]: admin@test.eventvillage.local
                - generic [ref=f5e1100]:
                  - button "Permissions" [ref=f5e1101] [cursor=pointer]
                  - button "Changer le rôle" [ref=f5e1107] [cursor=pointer]
                  - button "Changer le numéro" [ref=f5e1109] [cursor=pointer]
                  - button "Suspendre" [ref=f5e1111] [cursor=pointer]
                  - button "Supprimer" [ref=f5e1113] [cursor=pointer]
              - generic [ref=f5e1118]:
                - generic [ref=f5e1119]:
                  - generic [ref=f5e1120]:
                    - heading "Cheikh ControleurA" [level=4] [ref=f5e1121]
                    - generic [ref=f5e1122]: Contrôleur
                    - generic [ref=f5e1123]: Actif
                  - generic [ref=f5e1124]:
                    - generic [ref=f5e1125]: "+221700000005"
                    - generic [ref=f5e1129]: controller-a@test.eventvillage.local
                - generic [ref=f5e1134]:
                  - button "Changer le rôle" [ref=f5e1135] [cursor=pointer]
                  - button "Suspendre" [ref=f5e1137] [cursor=pointer]
                  - button "Supprimer" [ref=f5e1139] [cursor=pointer]
              - generic [ref=f5e1144]:
                - generic [ref=f5e1145]:
                  - generic [ref=f5e1146]:
                    - heading "Bassirou OrgaB" [level=4] [ref=f5e1147]
                    - generic [ref=f5e1148]: Partenaire
                    - generic [ref=f5e1149]: Actif
                  - generic [ref=f5e1150]:
                    - generic [ref=f5e1151]: "+221700000004"
                    - generic [ref=f5e1155]: partner-b@test.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f5e1161] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=76e3363a-31f6-47a3-9b16-be7ff88b632c
              - generic [ref=f5e1163]:
                - generic [ref=f5e1164]:
                  - generic [ref=f5e1165]:
                    - heading "Aïssatou OrgaA" [level=4] [ref=f5e1166]
                    - generic [ref=f5e1167]: Partenaire
                    - generic [ref=f5e1168]: Actif
                  - generic [ref=f5e1169]:
                    - generic [ref=f5e1170]: "+221700000003"
                    - generic [ref=f5e1174]: partner-a@test.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f5e1180] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=4c25f910-0faf-4b06-9f4a-ba76ec958b5f
              - generic [ref=f5e1182]:
                - generic [ref=f5e1183]:
                  - generic [ref=f5e1184]:
                    - heading "Birame ClientBis" [level=4] [ref=f5e1185]
                    - generic [ref=f5e1186]: Client
                    - generic [ref=f5e1187]: Actif
                  - generic [ref=f5e1188]:
                    - generic [ref=f5e1189]: "+221700000002"
                    - generic [ref=f5e1193]: client-bis@test.eventvillage.local
                - generic [ref=f5e1198]:
                  - button "Changer le rôle" [ref=f5e1199] [cursor=pointer]
                  - button "Suspendre" [ref=f5e1201] [cursor=pointer]
                  - button "Supprimer" [ref=f5e1203] [cursor=pointer]
              - generic [ref=f5e1208]:
                - generic [ref=f5e1209]:
                  - generic [ref=f5e1210]:
                    - heading "Awa Client" [level=4] [ref=f5e1211]
                    - generic [ref=f5e1212]: Client
                    - generic [ref=f5e1213]: Actif
                  - generic [ref=f5e1214]:
                    - generic [ref=f5e1215]: "+221700000001"
                    - generic [ref=f5e1219]: client@test.eventvillage.local
                - generic [ref=f5e1224]:
                  - button "Changer le rôle" [ref=f5e1225] [cursor=pointer]
                  - button "Suspendre" [ref=f5e1227] [cursor=pointer]
                  - button "Supprimer" [ref=f5e1229] [cursor=pointer]
  - alert [ref=f5e1234]
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
      |                                                                                        ^ Error: contrôles responsive de adm-comptes (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```