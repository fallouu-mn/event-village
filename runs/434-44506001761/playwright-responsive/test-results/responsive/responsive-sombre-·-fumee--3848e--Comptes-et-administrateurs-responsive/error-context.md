# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-comptes — Comptes et administrateurs
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-comptes (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   "360 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+   "1440 px : 324 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Assane » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 12 px « Badji » (div.space-y-1.flex-1 > div.flex.flex-wrap > h4.text-xs.font-black) ; 10 px « Client » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-black) ; 10 px « Actif » (div.space-y-1.flex-1 > div.flex.flex-wrap > span.text-[10px].font-bold) ; 12 px « +221700000224 » (div.flex.flex-wrap > span.flex.items-center > span)",
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
              - link "Retour à l’accueil de l’administration" [ref=f2e141] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Comptes et administrateurs" [level=1] [ref=f2e145]
            - generic [ref=f2e146]:
              - button "Actualiser" [ref=f2e147] [cursor=pointer]
              - button "Créer un compte" [ref=f2e154] [cursor=pointer]
          - generic [ref=f2e160]:
            - generic [ref=f2e161]:
              - searchbox "Rechercher un compte" [ref=f2e166]
              - group "Filtrer par rôle" [ref=f2e167]:
                - button "Tous" [pressed] [ref=f2e168] [cursor=pointer]
                - button "Superadmin" [ref=f2e169] [cursor=pointer]
                - button "Administrateur" [ref=f2e170] [cursor=pointer]
                - button "Partenaire" [ref=f2e171] [cursor=pointer]
                - button "Contrôleur" [ref=f2e172] [cursor=pointer]
                - button "Client" [ref=f2e173] [cursor=pointer]
            - generic [ref=f2e174]:
              - generic [ref=f2e175]:
                - generic [ref=f2e176]:
                  - generic [ref=f2e177]:
                    - heading "Assane Badji" [level=4] [ref=f2e178]
                    - generic [ref=f2e179]: Client
                    - generic [ref=f2e180]: Actif
                  - generic [ref=f2e181]:
                    - generic [ref=f2e182]: "+221700000224"
                    - generic [ref=f2e186]: assane.badji.24@demo.eventvillage.local
                - generic [ref=f2e191]:
                  - button "Changer le rôle" [ref=f2e192] [cursor=pointer]
                  - button "Suspendre" [ref=f2e194] [cursor=pointer]
                  - button "Supprimer" [ref=f2e196] [cursor=pointer]
              - generic [ref=f2e201]:
                - generic [ref=f2e202]:
                  - generic [ref=f2e203]:
                    - heading "Marième Niang" [level=4] [ref=f2e204]
                    - generic [ref=f2e205]: Client
                    - generic [ref=f2e206]: Actif
                  - generic [ref=f2e207]:
                    - generic [ref=f2e208]: "+221700000223"
                    - generic [ref=f2e212]: marieme.niang.23@demo.eventvillage.local
                - generic [ref=f2e217]:
                  - button "Changer le rôle" [ref=f2e218] [cursor=pointer]
                  - button "Suspendre" [ref=f2e220] [cursor=pointer]
                  - button "Supprimer" [ref=f2e222] [cursor=pointer]
              - generic [ref=f2e227]:
                - generic [ref=f2e228]:
                  - generic [ref=f2e229]:
                    - heading "Omar Gaye" [level=4] [ref=f2e230]
                    - generic [ref=f2e231]: Client
                    - generic [ref=f2e232]: Actif
                  - generic [ref=f2e233]:
                    - generic [ref=f2e234]: "+221700000222"
                    - generic [ref=f2e238]: omar.gaye.22@demo.eventvillage.local
                - generic [ref=f2e243]:
                  - button "Changer le rôle" [ref=f2e244] [cursor=pointer]
                  - button "Suspendre" [ref=f2e246] [cursor=pointer]
                  - button "Supprimer" [ref=f2e248] [cursor=pointer]
              - generic [ref=f2e253]:
                - generic [ref=f2e254]:
                  - generic [ref=f2e255]:
                    - heading "Dieynaba Tall" [level=4] [ref=f2e256]
                    - generic [ref=f2e257]: Client
                    - generic [ref=f2e258]: Actif
                  - generic [ref=f2e259]:
                    - generic [ref=f2e260]: "+221700000221"
                    - generic [ref=f2e264]: dieynaba.tall.21@demo.eventvillage.local
                - generic [ref=f2e269]:
                  - button "Changer le rôle" [ref=f2e270] [cursor=pointer]
                  - button "Suspendre" [ref=f2e272] [cursor=pointer]
                  - button "Supprimer" [ref=f2e274] [cursor=pointer]
              - generic [ref=f2e279]:
                - generic [ref=f2e280]:
                  - generic [ref=f2e281]:
                    - heading "Saliou Touré" [level=4] [ref=f2e282]
                    - generic [ref=f2e283]: Client
                    - generic [ref=f2e284]: Actif
                  - generic [ref=f2e285]:
                    - generic [ref=f2e286]: "+221700000220"
                    - generic [ref=f2e290]: saliou.toure.20@demo.eventvillage.local
                - generic [ref=f2e295]:
                  - button "Changer le rôle" [ref=f2e296] [cursor=pointer]
                  - button "Suspendre" [ref=f2e298] [cursor=pointer]
                  - button "Supprimer" [ref=f2e300] [cursor=pointer]
              - generic [ref=f2e305]:
                - generic [ref=f2e306]:
                  - generic [ref=f2e307]:
                    - heading "Bineta Kane" [level=4] [ref=f2e308]
                    - generic [ref=f2e309]: Client
                    - generic [ref=f2e310]: Actif
                  - generic [ref=f2e311]:
                    - generic [ref=f2e312]: "+221700000219"
                    - generic [ref=f2e316]: bineta.kane.19@demo.eventvillage.local
                - generic [ref=f2e321]:
                  - button "Changer le rôle" [ref=f2e322] [cursor=pointer]
                  - button "Suspendre" [ref=f2e324] [cursor=pointer]
                  - button "Supprimer" [ref=f2e326] [cursor=pointer]
              - generic [ref=f2e331]:
                - generic [ref=f2e332]:
                  - generic [ref=f2e333]:
                    - heading "Modou Mboup" [level=4] [ref=f2e334]
                    - generic [ref=f2e335]: Client
                    - generic [ref=f2e336]: Actif
                  - generic [ref=f2e337]:
                    - generic [ref=f2e338]: "+221700000218"
                    - generic [ref=f2e342]: modou.mboup.18@demo.eventvillage.local
                - generic [ref=f2e347]:
                  - button "Changer le rôle" [ref=f2e348] [cursor=pointer]
                  - button "Suspendre" [ref=f2e350] [cursor=pointer]
                  - button "Supprimer" [ref=f2e352] [cursor=pointer]
              - generic [ref=f2e357]:
                - generic [ref=f2e358]:
                  - generic [ref=f2e359]:
                    - heading "Yacine Dieng" [level=4] [ref=f2e360]
                    - generic [ref=f2e361]: Client
                    - generic [ref=f2e362]: Actif
                  - generic [ref=f2e363]:
                    - generic [ref=f2e364]: "+221700000217"
                    - generic [ref=f2e368]: yacine.dieng.17@demo.eventvillage.local
                - generic [ref=f2e373]:
                  - button "Changer le rôle" [ref=f2e374] [cursor=pointer]
                  - button "Suspendre" [ref=f2e376] [cursor=pointer]
                  - button "Supprimer" [ref=f2e378] [cursor=pointer]
              - generic [ref=f2e383]:
                - generic [ref=f2e384]:
                  - generic [ref=f2e385]:
                    - heading "Ibou Mbengue" [level=4] [ref=f2e386]
                    - generic [ref=f2e387]: Client
                    - generic [ref=f2e388]: Actif
                  - generic [ref=f2e389]:
                    - generic [ref=f2e390]: "+221700000216"
                    - generic [ref=f2e394]: ibou.mbengue.16@demo.eventvillage.local
                - generic [ref=f2e399]:
                  - button "Changer le rôle" [ref=f2e400] [cursor=pointer]
                  - button "Suspendre" [ref=f2e402] [cursor=pointer]
                  - button "Supprimer" [ref=f2e404] [cursor=pointer]
              - generic [ref=f2e409]:
                - generic [ref=f2e410]:
                  - generic [ref=f2e411]:
                    - heading "Astou Sow" [level=4] [ref=f2e412]
                    - generic [ref=f2e413]: Client
                    - generic [ref=f2e414]: Actif
                  - generic [ref=f2e415]:
                    - generic [ref=f2e416]: "+221700000215"
                    - generic [ref=f2e420]: astou.sow.15@demo.eventvillage.local
                - generic [ref=f2e425]:
                  - button "Changer le rôle" [ref=f2e426] [cursor=pointer]
                  - button "Suspendre" [ref=f2e428] [cursor=pointer]
                  - button "Supprimer" [ref=f2e430] [cursor=pointer]
              - generic [ref=f2e435]:
                - generic [ref=f2e436]:
                  - generic [ref=f2e437]:
                    - heading "Mamadou Kébé" [level=4] [ref=f2e438]
                    - generic [ref=f2e439]: Client
                    - generic [ref=f2e440]: Actif
                  - generic [ref=f2e441]:
                    - generic [ref=f2e442]: "+221700000214"
                    - generic [ref=f2e446]: mamadou.kebe.14@demo.eventvillage.local
                - generic [ref=f2e451]:
                  - button "Changer le rôle" [ref=f2e452] [cursor=pointer]
                  - button "Suspendre" [ref=f2e454] [cursor=pointer]
                  - button "Supprimer" [ref=f2e456] [cursor=pointer]
              - generic [ref=f2e461]:
                - generic [ref=f2e462]:
                  - generic [ref=f2e463]:
                    - heading "Fatoumata Camara" [level=4] [ref=f2e464]
                    - generic [ref=f2e465]: Client
                    - generic [ref=f2e466]: Actif
                  - generic [ref=f2e467]:
                    - generic [ref=f2e468]: "+221700000213"
                    - generic [ref=f2e472]: fatoumata.camara.13@demo.eventvillage.local
                - generic [ref=f2e477]:
                  - button "Changer le rôle" [ref=f2e478] [cursor=pointer]
                  - button "Suspendre" [ref=f2e480] [cursor=pointer]
                  - button "Supprimer" [ref=f2e482] [cursor=pointer]
              - generic [ref=f2e487]:
                - generic [ref=f2e488]:
                  - generic [ref=f2e489]:
                    - heading "Adama Diouf" [level=4] [ref=f2e490]
                    - generic [ref=f2e491]: Client
                    - generic [ref=f2e492]: Actif
                  - generic [ref=f2e493]:
                    - generic [ref=f2e494]: "+221700000212"
                    - generic [ref=f2e498]: adama.diouf.12@demo.eventvillage.local
                - generic [ref=f2e503]:
                  - button "Changer le rôle" [ref=f2e504] [cursor=pointer]
                  - button "Suspendre" [ref=f2e506] [cursor=pointer]
                  - button "Supprimer" [ref=f2e508] [cursor=pointer]
              - generic [ref=f2e513]:
                - generic [ref=f2e514]:
                  - generic [ref=f2e515]:
                    - heading "Rokhaya Ndao" [level=4] [ref=f2e516]
                    - generic [ref=f2e517]: Client
                    - generic [ref=f2e518]: Actif
                  - generic [ref=f2e519]:
                    - generic [ref=f2e520]: "+221700000211"
                    - generic [ref=f2e524]: rokhaya.ndao.11@demo.eventvillage.local
                - generic [ref=f2e529]:
                  - button "Changer le rôle" [ref=f2e530] [cursor=pointer]
                  - button "Suspendre" [ref=f2e532] [cursor=pointer]
                  - button "Supprimer" [ref=f2e534] [cursor=pointer]
              - generic [ref=f2e539]:
                - generic [ref=f2e540]:
                  - generic [ref=f2e541]:
                    - heading "Pape Lo" [level=4] [ref=f2e542]
                    - generic [ref=f2e543]: Client
                    - generic [ref=f2e544]: Actif
                  - generic [ref=f2e545]:
                    - generic [ref=f2e546]: "+221700000210"
                    - generic [ref=f2e550]: pape.lo.10@demo.eventvillage.local
                - generic [ref=f2e555]:
                  - button "Changer le rôle" [ref=f2e556] [cursor=pointer]
                  - button "Suspendre" [ref=f2e558] [cursor=pointer]
                  - button "Supprimer" [ref=f2e560] [cursor=pointer]
              - generic [ref=f2e565]:
                - generic [ref=f2e566]:
                  - generic [ref=f2e567]:
                    - heading "Coumba Ka" [level=4] [ref=f2e568]
                    - generic [ref=f2e569]: Client
                    - generic [ref=f2e570]: Actif
                  - generic [ref=f2e571]:
                    - generic [ref=f2e572]: "+221700000209"
                    - generic [ref=f2e576]: coumba.ka.09@demo.eventvillage.local
                - generic [ref=f2e581]:
                  - button "Changer le rôle" [ref=f2e582] [cursor=pointer]
                  - button "Suspendre" [ref=f2e584] [cursor=pointer]
                  - button "Supprimer" [ref=f2e586] [cursor=pointer]
              - generic [ref=f2e591]:
                - generic [ref=f2e592]:
                  - generic [ref=f2e593]:
                    - heading "Alioune Fall" [level=4] [ref=f2e594]
                    - generic [ref=f2e595]: Client
                    - generic [ref=f2e596]: Actif
                  - generic [ref=f2e597]:
                    - generic [ref=f2e598]: "+221700000208"
                    - generic [ref=f2e602]: alioune.fall.08@demo.eventvillage.local
                - generic [ref=f2e607]:
                  - button "Changer le rôle" [ref=f2e608] [cursor=pointer]
                  - button "Suspendre" [ref=f2e610] [cursor=pointer]
                  - button "Supprimer" [ref=f2e612] [cursor=pointer]
              - generic [ref=f2e617]:
                - generic [ref=f2e618]:
                  - generic [ref=f2e619]:
                    - heading "Mame Ndour" [level=4] [ref=f2e620]
                    - generic [ref=f2e621]: Client
                    - generic [ref=f2e622]: Actif
                  - generic [ref=f2e623]:
                    - generic [ref=f2e624]: "+221700000207"
                    - generic [ref=f2e628]: mame.ndour.07@demo.eventvillage.local
                - generic [ref=f2e633]:
                  - button "Changer le rôle" [ref=f2e634] [cursor=pointer]
                  - button "Suspendre" [ref=f2e636] [cursor=pointer]
                  - button "Supprimer" [ref=f2e638] [cursor=pointer]
              - generic [ref=f2e643]:
                - generic [ref=f2e644]:
                  - generic [ref=f2e645]:
                    - heading "Babacar Diagne" [level=4] [ref=f2e646]
                    - generic [ref=f2e647]: Client
                    - generic [ref=f2e648]: Actif
                  - generic [ref=f2e649]:
                    - generic [ref=f2e650]: "+221700000206"
                    - generic [ref=f2e654]: babacar.diagne.06@demo.eventvillage.local
                - generic [ref=f2e659]:
                  - button "Changer le rôle" [ref=f2e660] [cursor=pointer]
                  - button "Suspendre" [ref=f2e662] [cursor=pointer]
                  - button "Supprimer" [ref=f2e664] [cursor=pointer]
              - generic [ref=f2e669]:
                - generic [ref=f2e670]:
                  - generic [ref=f2e671]:
                    - heading "Ndeye Thiam" [level=4] [ref=f2e672]
                    - generic [ref=f2e673]: Client
                    - generic [ref=f2e674]: Actif
                  - generic [ref=f2e675]:
                    - generic [ref=f2e676]: "+221700000205"
                    - generic [ref=f2e680]: ndeye.thiam.05@demo.eventvillage.local
                - generic [ref=f2e685]:
                  - button "Changer le rôle" [ref=f2e686] [cursor=pointer]
                  - button "Suspendre" [ref=f2e688] [cursor=pointer]
                  - button "Supprimer" [ref=f2e690] [cursor=pointer]
              - generic [ref=f2e695]:
                - generic [ref=f2e696]:
                  - generic [ref=f2e697]:
                    - heading "Cheikh Sarr" [level=4] [ref=f2e698]
                    - generic [ref=f2e699]: Client
                    - generic [ref=f2e700]: Actif
                  - generic [ref=f2e701]:
                    - generic [ref=f2e702]: "+221700000204"
                    - generic [ref=f2e706]: cheikh.sarr.04@demo.eventvillage.local
                - generic [ref=f2e711]:
                  - button "Changer le rôle" [ref=f2e712] [cursor=pointer]
                  - button "Suspendre" [ref=f2e714] [cursor=pointer]
                  - button "Supprimer" [ref=f2e716] [cursor=pointer]
              - generic [ref=f2e721]:
                - generic [ref=f2e722]:
                  - generic [ref=f2e723]:
                    - heading "Aminata Sène" [level=4] [ref=f2e724]
                    - generic [ref=f2e725]: Client
                    - generic [ref=f2e726]: Actif
                  - generic [ref=f2e727]:
                    - generic [ref=f2e728]: "+221700000203"
                    - generic [ref=f2e732]: aminata.sene.03@demo.eventvillage.local
                - generic [ref=f2e737]:
                  - button "Changer le rôle" [ref=f2e738] [cursor=pointer]
                  - button "Suspendre" [ref=f2e740] [cursor=pointer]
                  - button "Supprimer" [ref=f2e742] [cursor=pointer]
              - generic [ref=f2e747]:
                - generic [ref=f2e748]:
                  - generic [ref=f2e749]:
                    - heading "Moussa Sy" [level=4] [ref=f2e750]
                    - generic [ref=f2e751]: Client
                    - generic [ref=f2e752]: Actif
                  - generic [ref=f2e753]:
                    - generic [ref=f2e754]: "+221700000202"
                    - generic [ref=f2e758]: moussa.sy.02@demo.eventvillage.local
                - generic [ref=f2e763]:
                  - button "Changer le rôle" [ref=f2e764] [cursor=pointer]
                  - button "Suspendre" [ref=f2e766] [cursor=pointer]
                  - button "Supprimer" [ref=f2e768] [cursor=pointer]
              - generic [ref=f2e773]:
                - generic [ref=f2e774]:
                  - generic [ref=f2e775]:
                    - heading "Awa Diop" [level=4] [ref=f2e776]
                    - generic [ref=f2e777]: Client
                    - generic [ref=f2e778]: Actif
                  - generic [ref=f2e779]:
                    - generic [ref=f2e780]: "+221700000201"
                    - generic [ref=f2e784]: awa.diop.01@demo.eventvillage.local
                - generic [ref=f2e789]:
                  - button "Changer le rôle" [ref=f2e790] [cursor=pointer]
                  - button "Suspendre" [ref=f2e792] [cursor=pointer]
                  - button "Supprimer" [ref=f2e794] [cursor=pointer]
              - generic [ref=f2e799]:
                - generic [ref=f2e800]:
                  - generic [ref=f2e801]:
                    - heading "Mamadou Sall" [level=4] [ref=f2e802]
                    - generic [ref=f2e803]: Contrôleur
                    - generic [ref=f2e804]: Actif
                  - generic [ref=f2e805]:
                    - generic [ref=f2e806]: "+221700000110"
                    - generic [ref=f2e810]: mamadou.sall@demo.eventvillage.local
                - generic [ref=f2e815]:
                  - button "Changer le rôle" [ref=f2e816] [cursor=pointer]
                  - button "Suspendre" [ref=f2e818] [cursor=pointer]
                  - button "Supprimer" [ref=f2e820] [cursor=pointer]
              - generic [ref=f2e825]:
                - generic [ref=f2e826]:
                  - generic [ref=f2e827]:
                    - heading "Ndèye Gning" [level=4] [ref=f2e828]
                    - generic [ref=f2e829]: Partenaire
                    - generic [ref=f2e830]: Actif
                  - generic [ref=f2e831]:
                    - generic [ref=f2e832]: "+221700000109"
                    - generic [ref=f2e836]: ndeye.gning@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f2e842] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=d66bc21f-5a8b-4bf8-a268-87de08b91a57
              - generic [ref=f2e844]:
                - generic [ref=f2e845]:
                  - generic [ref=f2e846]:
                    - heading "Lamine Cissé" [level=4] [ref=f2e847]
                    - generic [ref=f2e848]: Contrôleur
                    - generic [ref=f2e849]: Actif
                  - generic [ref=f2e850]:
                    - generic [ref=f2e851]: "+221700000108"
                    - generic [ref=f2e855]: lamine.cisse@demo.eventvillage.local
                - generic [ref=f2e860]:
                  - button "Changer le rôle" [ref=f2e861] [cursor=pointer]
                  - button "Suspendre" [ref=f2e863] [cursor=pointer]
                  - button "Supprimer" [ref=f2e865] [cursor=pointer]
              - generic [ref=f2e870]:
                - generic [ref=f2e871]:
                  - generic [ref=f2e872]:
                    - heading "Seynabou Ba" [level=4] [ref=f2e873]
                    - generic [ref=f2e874]: Contrôleur
                    - generic [ref=f2e875]: Actif
                  - generic [ref=f2e876]:
                    - generic [ref=f2e877]: "+221700000107"
                    - generic [ref=f2e881]: seynabou.ba@demo.eventvillage.local
                - generic [ref=f2e886]:
                  - button "Changer le rôle" [ref=f2e887] [cursor=pointer]
                  - button "Suspendre" [ref=f2e889] [cursor=pointer]
                  - button "Supprimer" [ref=f2e891] [cursor=pointer]
              - generic [ref=f2e896]:
                - generic [ref=f2e897]:
                  - generic [ref=f2e898]:
                    - heading "Ibrahima Gueye" [level=4] [ref=f2e899]
                    - generic [ref=f2e900]: Contrôleur
                    - generic [ref=f2e901]: Actif
                  - generic [ref=f2e902]:
                    - generic [ref=f2e903]: "+221700000106"
                    - generic [ref=f2e907]: ibrahima.gueye@demo.eventvillage.local
                - generic [ref=f2e912]:
                  - button "Changer le rôle" [ref=f2e913] [cursor=pointer]
                  - button "Suspendre" [ref=f2e915] [cursor=pointer]
                  - button "Supprimer" [ref=f2e917] [cursor=pointer]
              - generic [ref=f2e922]:
                - generic [ref=f2e923]:
                  - generic [ref=f2e924]:
                    - heading "Fatou Mbaye" [level=4] [ref=f2e925]
                    - generic [ref=f2e926]: Client
                    - generic [ref=f2e927]: Actif
                  - generic [ref=f2e928]:
                    - generic [ref=f2e929]: "+221700000105"
                    - generic [ref=f2e933]: fatou.mbaye@demo.eventvillage.local
                - generic [ref=f2e938]:
                  - button "Changer le rôle" [ref=f2e939] [cursor=pointer]
                  - button "Suspendre" [ref=f2e941] [cursor=pointer]
                  - button "Supprimer" [ref=f2e943] [cursor=pointer]
              - generic [ref=f2e948]:
                - generic [ref=f2e949]:
                  - generic [ref=f2e950]:
                    - heading "Aïda Diallo" [level=4] [ref=f2e951]
                    - generic [ref=f2e952]: Administrateur
                    - generic [ref=f2e953]: Actif
                  - generic [ref=f2e954]:
                    - generic [ref=f2e955]: "+221700000104"
                    - generic [ref=f2e959]: aida.diallo@demo.eventvillage.local
                - generic [ref=f2e964]:
                  - button "Permissions" [ref=f2e965] [cursor=pointer]
                  - button "Changer le rôle" [ref=f2e971] [cursor=pointer]
                  - button "Changer le numéro" [ref=f2e973] [cursor=pointer]
                  - button "Suspendre" [ref=f2e975] [cursor=pointer]
                  - button "Supprimer" [ref=f2e977] [cursor=pointer]
              - generic [ref=f2e982]:
                - generic [ref=f2e983]:
                  - generic [ref=f2e984]:
                    - heading "Khady Sarr" [level=4] [ref=f2e985]
                    - generic [ref=f2e986]: Partenaire
                    - generic [ref=f2e987]: Actif
                  - generic [ref=f2e988]:
                    - generic [ref=f2e989]: "+221700000103"
                    - generic [ref=f2e993]: khady.sarr@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f2e999] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=f7aa34b4-ffad-42d7-b878-637dce341f12
              - generic [ref=f2e1001]:
                - generic [ref=f2e1002]:
                  - generic [ref=f2e1003]:
                    - heading "Ousmane Faye" [level=4] [ref=f2e1004]
                    - generic [ref=f2e1005]: Partenaire
                    - generic [ref=f2e1006]: Actif
                  - generic [ref=f2e1007]:
                    - generic [ref=f2e1008]: "+221700000102"
                    - generic [ref=f2e1012]: ousmane.faye@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f2e1018] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=ba306006-671d-4b8f-8ef7-5a3939d50f8f
              - generic [ref=f2e1020]:
                - generic [ref=f2e1021]:
                  - generic [ref=f2e1022]:
                    - heading "Mariama Ndiaye" [level=4] [ref=f2e1023]
                    - generic [ref=f2e1024]: Partenaire
                    - generic [ref=f2e1025]: Actif
                  - generic [ref=f2e1026]:
                    - generic [ref=f2e1027]: "+221700000101"
                    - generic [ref=f2e1031]: mariama.ndiaye@demo.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f2e1037] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=d9bfdb1c-4152-452a-8453-bb5a7f00b153
              - generic [ref=f2e1039]:
                - generic [ref=f2e1040]:
                  - generic [ref=f2e1041]:
                    - heading "Fatou Suspendue" [level=4] [ref=f2e1042]
                    - generic [ref=f2e1043]: Client
                    - generic [ref=f2e1044]: Suspendu
                  - generic [ref=f2e1045]:
                    - generic [ref=f2e1046]: "+221700000008"
                    - generic [ref=f2e1050]: suspendu@test.eventvillage.local
                - generic [ref=f2e1055]:
                  - button "Changer le rôle" [ref=f2e1056] [cursor=pointer]
                  - button "Réactiver" [ref=f2e1058] [cursor=pointer]
                  - button "Supprimer" [ref=f2e1060] [cursor=pointer]
              - generic [ref=f2e1065]:
                - generic [ref=f2e1066]:
                  - generic [ref=f2e1067]:
                    - heading "Elhadji SuperAdmin" [level=4] [ref=f2e1068]
                    - generic [ref=f2e1069]: Superadmin
                    - generic [ref=f2e1070]: Actif
                  - generic [ref=f2e1071]:
                    - generic [ref=f2e1072]: "+221700000007"
                    - generic [ref=f2e1076]: superadmin@test.eventvillage.local
                - button "Quitter le rôle de Superadmin" [ref=f2e1082] [cursor=pointer]
              - generic [ref=f2e1084]:
                - generic [ref=f2e1085]:
                  - generic [ref=f2e1086]:
                    - heading "Dior Admin" [level=4] [ref=f2e1087]
                    - generic [ref=f2e1088]: Administrateur
                    - generic [ref=f2e1089]: Actif
                  - generic [ref=f2e1090]:
                    - generic [ref=f2e1091]: "+221700000006"
                    - generic [ref=f2e1095]: admin@test.eventvillage.local
                - generic [ref=f2e1100]:
                  - button "Permissions" [ref=f2e1101] [cursor=pointer]
                  - button "Changer le rôle" [ref=f2e1107] [cursor=pointer]
                  - button "Changer le numéro" [ref=f2e1109] [cursor=pointer]
                  - button "Suspendre" [ref=f2e1111] [cursor=pointer]
                  - button "Supprimer" [ref=f2e1113] [cursor=pointer]
              - generic [ref=f2e1118]:
                - generic [ref=f2e1119]:
                  - generic [ref=f2e1120]:
                    - heading "Cheikh ControleurA" [level=4] [ref=f2e1121]
                    - generic [ref=f2e1122]: Contrôleur
                    - generic [ref=f2e1123]: Actif
                  - generic [ref=f2e1124]:
                    - generic [ref=f2e1125]: "+221700000005"
                    - generic [ref=f2e1129]: controller-a@test.eventvillage.local
                - generic [ref=f2e1134]:
                  - button "Changer le rôle" [ref=f2e1135] [cursor=pointer]
                  - button "Suspendre" [ref=f2e1137] [cursor=pointer]
                  - button "Supprimer" [ref=f2e1139] [cursor=pointer]
              - generic [ref=f2e1144]:
                - generic [ref=f2e1145]:
                  - generic [ref=f2e1146]:
                    - heading "Bassirou OrgaB" [level=4] [ref=f2e1147]
                    - generic [ref=f2e1148]: Partenaire
                    - generic [ref=f2e1149]: Actif
                  - generic [ref=f2e1150]:
                    - generic [ref=f2e1151]: "+221700000004"
                    - generic [ref=f2e1155]: partner-b@test.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f2e1161] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=76e3363a-31f6-47a3-9b16-be7ff88b632c
              - generic [ref=f2e1163]:
                - generic [ref=f2e1164]:
                  - generic [ref=f2e1165]:
                    - heading "Aïssatou OrgaA" [level=4] [ref=f2e1166]
                    - generic [ref=f2e1167]: Partenaire
                    - generic [ref=f2e1168]: Actif
                  - generic [ref=f2e1169]:
                    - generic [ref=f2e1170]: "+221700000003"
                    - generic [ref=f2e1174]: partner-a@test.eventvillage.local
                - link "Voir la fiche partenaire" [ref=f2e1180] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=ALL&dossier=4c25f910-0faf-4b06-9f4a-ba76ec958b5f
              - generic [ref=f2e1182]:
                - generic [ref=f2e1183]:
                  - generic [ref=f2e1184]:
                    - heading "Birame ClientBis" [level=4] [ref=f2e1185]
                    - generic [ref=f2e1186]: Client
                    - generic [ref=f2e1187]: Actif
                  - generic [ref=f2e1188]:
                    - generic [ref=f2e1189]: "+221700000002"
                    - generic [ref=f2e1193]: client-bis@test.eventvillage.local
                - generic [ref=f2e1198]:
                  - button "Changer le rôle" [ref=f2e1199] [cursor=pointer]
                  - button "Suspendre" [ref=f2e1201] [cursor=pointer]
                  - button "Supprimer" [ref=f2e1203] [cursor=pointer]
              - generic [ref=f2e1208]:
                - generic [ref=f2e1209]:
                  - generic [ref=f2e1210]:
                    - heading "Awa Client" [level=4] [ref=f2e1211]
                    - generic [ref=f2e1212]: Client
                    - generic [ref=f2e1213]: Actif
                  - generic [ref=f2e1214]:
                    - generic [ref=f2e1215]: "+221700000001"
                    - generic [ref=f2e1219]: client@test.eventvillage.local
                - generic [ref=f2e1224]:
                  - button "Changer le rôle" [ref=f2e1225] [cursor=pointer]
                  - button "Suspendre" [ref=f2e1227] [cursor=pointer]
                  - button "Supprimer" [ref=f2e1229] [cursor=pointer]
  - alert [ref=f2e1234]
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
      |                                                                                        ^ Error: contrôles responsive de adm-comptes (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```