# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-parrainage — Parrainage
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-parrainage (clair)

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
                - heading "Parrainage et ambassadeurs" [level=1] [ref=f5e168]
                - paragraph [ref=f5e169]: Taux et durée du parrainage, et comptes nommés ambassadeurs.
              - button "Actualiser" [ref=f5e171] [cursor=pointer]
          - generic [ref=f5e179]:
            - generic [ref=f5e180]:
              - paragraph [ref=f5e182]: Comptes affichés
              - paragraph [ref=f5e189]: "42"
              - paragraph [ref=f5e190]: 42 sans statut d’ambassadeur
            - generic [ref=f5e191]:
              - paragraph [ref=f5e193]: Ambassadeurs
              - paragraph [ref=f5e197]: "0"
              - paragraph [ref=f5e198]: "Taux ambassadeur : 7 % sur les filleuls directs, 2 % sur les filleuls de ses filleuls"
            - generic [ref=f5e199]:
              - paragraph [ref=f5e201]: Durée du parrainage
              - paragraph [ref=f5e206]: 12 mois
              - paragraph [ref=f5e207]: Compte standard ; 24 mois pour un ambassadeur
          - status [ref=f5e208]:
            - paragraph [ref=f5e214]: La personnalisation des taux n’est pas disponible pour le moment.
          - region [ref=f5e215]:
            - generic [ref=f5e216]:
              - heading "Comptes" [level=2] [ref=f5e217]
              - paragraph [ref=f5e218]: Nommez un ambassadeur pour majorer ses commissions sur ses filleuls directs et sur les filleuls de ses filleuls.
            - generic [ref=f5e219]:
              - searchbox "Rechercher un compte" [ref=f5e221]
              - group "Filtrer par statut" [ref=f5e222]:
                - button "Tous" [pressed] [ref=f5e223] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e224]: ✓
                  - text: Tous
                - button "Ambassadeurs" [ref=f5e225] [cursor=pointer]
                - button "Sans statut d’ambassadeur" [ref=f5e226] [cursor=pointer]
            - list "Comptes du parrainage" [ref=f5e227]:
              - listitem [ref=f5e228]:
                - generic [ref=f5e229]:
                  - generic [ref=f5e230]:
                    - paragraph [ref=f5e231]: Assane Badji
                    - generic [ref=f5e232]: Client
                    - generic [ref=f5e234]: Parrainage standard
                  - generic [ref=f5e236]:
                    - generic [ref=f5e237]:
                      - generic [ref=f5e240]: "Téléphone :"
                      - generic [ref=f5e241]: "+221700000224"
                    - generic [ref=f5e242]:
                      - generic [ref=f5e246]: "Email :"
                      - generic [ref=f5e247]: assane.badji.24@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e249] [cursor=pointer]
              - listitem [ref=f5e254]:
                - generic [ref=f5e255]:
                  - generic [ref=f5e256]:
                    - paragraph [ref=f5e257]: Marième Niang
                    - generic [ref=f5e258]: Client
                    - generic [ref=f5e260]: Parrainage standard
                  - generic [ref=f5e262]:
                    - generic [ref=f5e263]:
                      - generic [ref=f5e266]: "Téléphone :"
                      - generic [ref=f5e267]: "+221700000223"
                    - generic [ref=f5e268]:
                      - generic [ref=f5e272]: "Email :"
                      - generic [ref=f5e273]: marieme.niang.23@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e275] [cursor=pointer]
              - listitem [ref=f5e280]:
                - generic [ref=f5e281]:
                  - generic [ref=f5e282]:
                    - paragraph [ref=f5e283]: Omar Gaye
                    - generic [ref=f5e284]: Client
                    - generic [ref=f5e286]: Parrainage standard
                  - generic [ref=f5e288]:
                    - generic [ref=f5e289]:
                      - generic [ref=f5e292]: "Téléphone :"
                      - generic [ref=f5e293]: "+221700000222"
                    - generic [ref=f5e294]:
                      - generic [ref=f5e298]: "Email :"
                      - generic [ref=f5e299]: omar.gaye.22@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e301] [cursor=pointer]
              - listitem [ref=f5e306]:
                - generic [ref=f5e307]:
                  - generic [ref=f5e308]:
                    - paragraph [ref=f5e309]: Dieynaba Tall
                    - generic [ref=f5e310]: Client
                    - generic [ref=f5e312]: Parrainage standard
                  - generic [ref=f5e314]:
                    - generic [ref=f5e315]:
                      - generic [ref=f5e318]: "Téléphone :"
                      - generic [ref=f5e319]: "+221700000221"
                    - generic [ref=f5e320]:
                      - generic [ref=f5e324]: "Email :"
                      - generic [ref=f5e325]: dieynaba.tall.21@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e327] [cursor=pointer]
              - listitem [ref=f5e332]:
                - generic [ref=f5e333]:
                  - generic [ref=f5e334]:
                    - paragraph [ref=f5e335]: Saliou Touré
                    - generic [ref=f5e336]: Client
                    - generic [ref=f5e338]: Parrainage standard
                  - generic [ref=f5e340]:
                    - generic [ref=f5e341]:
                      - generic [ref=f5e344]: "Téléphone :"
                      - generic [ref=f5e345]: "+221700000220"
                    - generic [ref=f5e346]:
                      - generic [ref=f5e350]: "Email :"
                      - generic [ref=f5e351]: saliou.toure.20@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e353] [cursor=pointer]
              - listitem [ref=f5e358]:
                - generic [ref=f5e359]:
                  - generic [ref=f5e360]:
                    - paragraph [ref=f5e361]: Bineta Kane
                    - generic [ref=f5e362]: Client
                    - generic [ref=f5e364]: Parrainage standard
                  - generic [ref=f5e366]:
                    - generic [ref=f5e367]:
                      - generic [ref=f5e370]: "Téléphone :"
                      - generic [ref=f5e371]: "+221700000219"
                    - generic [ref=f5e372]:
                      - generic [ref=f5e376]: "Email :"
                      - generic [ref=f5e377]: bineta.kane.19@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e379] [cursor=pointer]
              - listitem [ref=f5e384]:
                - generic [ref=f5e385]:
                  - generic [ref=f5e386]:
                    - paragraph [ref=f5e387]: Modou Mboup
                    - generic [ref=f5e388]: Client
                    - generic [ref=f5e390]: Parrainage standard
                  - generic [ref=f5e392]:
                    - generic [ref=f5e393]:
                      - generic [ref=f5e396]: "Téléphone :"
                      - generic [ref=f5e397]: "+221700000218"
                    - generic [ref=f5e398]:
                      - generic [ref=f5e402]: "Email :"
                      - generic [ref=f5e403]: modou.mboup.18@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e405] [cursor=pointer]
              - listitem [ref=f5e410]:
                - generic [ref=f5e411]:
                  - generic [ref=f5e412]:
                    - paragraph [ref=f5e413]: Yacine Dieng
                    - generic [ref=f5e414]: Client
                    - generic [ref=f5e416]: Parrainage standard
                  - generic [ref=f5e418]:
                    - generic [ref=f5e419]:
                      - generic [ref=f5e422]: "Téléphone :"
                      - generic [ref=f5e423]: "+221700000217"
                    - generic [ref=f5e424]:
                      - generic [ref=f5e428]: "Email :"
                      - generic [ref=f5e429]: yacine.dieng.17@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e431] [cursor=pointer]
              - listitem [ref=f5e436]:
                - generic [ref=f5e437]:
                  - generic [ref=f5e438]:
                    - paragraph [ref=f5e439]: Ibou Mbengue
                    - generic [ref=f5e440]: Client
                    - generic [ref=f5e442]: Parrainage standard
                  - generic [ref=f5e444]:
                    - generic [ref=f5e445]:
                      - generic [ref=f5e448]: "Téléphone :"
                      - generic [ref=f5e449]: "+221700000216"
                    - generic [ref=f5e450]:
                      - generic [ref=f5e454]: "Email :"
                      - generic [ref=f5e455]: ibou.mbengue.16@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e457] [cursor=pointer]
              - listitem [ref=f5e462]:
                - generic [ref=f5e463]:
                  - generic [ref=f5e464]:
                    - paragraph [ref=f5e465]: Astou Sow
                    - generic [ref=f5e466]: Client
                    - generic [ref=f5e468]: Parrainage standard
                  - generic [ref=f5e470]:
                    - generic [ref=f5e471]:
                      - generic [ref=f5e474]: "Téléphone :"
                      - generic [ref=f5e475]: "+221700000215"
                    - generic [ref=f5e476]:
                      - generic [ref=f5e480]: "Email :"
                      - generic [ref=f5e481]: astou.sow.15@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e483] [cursor=pointer]
              - listitem [ref=f5e488]:
                - generic [ref=f5e489]:
                  - generic [ref=f5e490]:
                    - paragraph [ref=f5e491]: Mamadou Kébé
                    - generic [ref=f5e492]: Client
                    - generic [ref=f5e494]: Parrainage standard
                  - generic [ref=f5e496]:
                    - generic [ref=f5e497]:
                      - generic [ref=f5e500]: "Téléphone :"
                      - generic [ref=f5e501]: "+221700000214"
                    - generic [ref=f5e502]:
                      - generic [ref=f5e506]: "Email :"
                      - generic [ref=f5e507]: mamadou.kebe.14@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e509] [cursor=pointer]
              - listitem [ref=f5e514]:
                - generic [ref=f5e515]:
                  - generic [ref=f5e516]:
                    - paragraph [ref=f5e517]: Fatoumata Camara
                    - generic [ref=f5e518]: Client
                    - generic [ref=f5e520]: Parrainage standard
                  - generic [ref=f5e522]:
                    - generic [ref=f5e523]:
                      - generic [ref=f5e526]: "Téléphone :"
                      - generic [ref=f5e527]: "+221700000213"
                    - generic [ref=f5e528]:
                      - generic [ref=f5e532]: "Email :"
                      - generic [ref=f5e533]: fatoumata.camara.13@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e535] [cursor=pointer]
              - listitem [ref=f5e540]:
                - generic [ref=f5e541]:
                  - generic [ref=f5e542]:
                    - paragraph [ref=f5e543]: Adama Diouf
                    - generic [ref=f5e544]: Client
                    - generic [ref=f5e546]: Parrainage standard
                  - generic [ref=f5e548]:
                    - generic [ref=f5e549]:
                      - generic [ref=f5e552]: "Téléphone :"
                      - generic [ref=f5e553]: "+221700000212"
                    - generic [ref=f5e554]:
                      - generic [ref=f5e558]: "Email :"
                      - generic [ref=f5e559]: adama.diouf.12@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e561] [cursor=pointer]
              - listitem [ref=f5e566]:
                - generic [ref=f5e567]:
                  - generic [ref=f5e568]:
                    - paragraph [ref=f5e569]: Rokhaya Ndao
                    - generic [ref=f5e570]: Client
                    - generic [ref=f5e572]: Parrainage standard
                  - generic [ref=f5e574]:
                    - generic [ref=f5e575]:
                      - generic [ref=f5e578]: "Téléphone :"
                      - generic [ref=f5e579]: "+221700000211"
                    - generic [ref=f5e580]:
                      - generic [ref=f5e584]: "Email :"
                      - generic [ref=f5e585]: rokhaya.ndao.11@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e587] [cursor=pointer]
              - listitem [ref=f5e592]:
                - generic [ref=f5e593]:
                  - generic [ref=f5e594]:
                    - paragraph [ref=f5e595]: Pape Lo
                    - generic [ref=f5e596]: Client
                    - generic [ref=f5e598]: Parrainage standard
                  - generic [ref=f5e600]:
                    - generic [ref=f5e601]:
                      - generic [ref=f5e604]: "Téléphone :"
                      - generic [ref=f5e605]: "+221700000210"
                    - generic [ref=f5e606]:
                      - generic [ref=f5e610]: "Email :"
                      - generic [ref=f5e611]: pape.lo.10@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e613] [cursor=pointer]
              - listitem [ref=f5e618]:
                - generic [ref=f5e619]:
                  - generic [ref=f5e620]:
                    - paragraph [ref=f5e621]: Coumba Ka
                    - generic [ref=f5e622]: Client
                    - generic [ref=f5e624]: Parrainage standard
                  - generic [ref=f5e626]:
                    - generic [ref=f5e627]:
                      - generic [ref=f5e630]: "Téléphone :"
                      - generic [ref=f5e631]: "+221700000209"
                    - generic [ref=f5e632]:
                      - generic [ref=f5e636]: "Email :"
                      - generic [ref=f5e637]: coumba.ka.09@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e639] [cursor=pointer]
              - listitem [ref=f5e644]:
                - generic [ref=f5e645]:
                  - generic [ref=f5e646]:
                    - paragraph [ref=f5e647]: Alioune Fall
                    - generic [ref=f5e648]: Client
                    - generic [ref=f5e650]: Parrainage standard
                  - generic [ref=f5e652]:
                    - generic [ref=f5e653]:
                      - generic [ref=f5e656]: "Téléphone :"
                      - generic [ref=f5e657]: "+221700000208"
                    - generic [ref=f5e658]:
                      - generic [ref=f5e662]: "Email :"
                      - generic [ref=f5e663]: alioune.fall.08@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e665] [cursor=pointer]
              - listitem [ref=f5e670]:
                - generic [ref=f5e671]:
                  - generic [ref=f5e672]:
                    - paragraph [ref=f5e673]: Mame Ndour
                    - generic [ref=f5e674]: Client
                    - generic [ref=f5e676]: Parrainage standard
                  - generic [ref=f5e678]:
                    - generic [ref=f5e679]:
                      - generic [ref=f5e682]: "Téléphone :"
                      - generic [ref=f5e683]: "+221700000207"
                    - generic [ref=f5e684]:
                      - generic [ref=f5e688]: "Email :"
                      - generic [ref=f5e689]: mame.ndour.07@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e691] [cursor=pointer]
              - listitem [ref=f5e696]:
                - generic [ref=f5e697]:
                  - generic [ref=f5e698]:
                    - paragraph [ref=f5e699]: Babacar Diagne
                    - generic [ref=f5e700]: Client
                    - generic [ref=f5e702]: Parrainage standard
                  - generic [ref=f5e704]:
                    - generic [ref=f5e705]:
                      - generic [ref=f5e708]: "Téléphone :"
                      - generic [ref=f5e709]: "+221700000206"
                    - generic [ref=f5e710]:
                      - generic [ref=f5e714]: "Email :"
                      - generic [ref=f5e715]: babacar.diagne.06@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e717] [cursor=pointer]
              - listitem [ref=f5e722]:
                - generic [ref=f5e723]:
                  - generic [ref=f5e724]:
                    - paragraph [ref=f5e725]: Ndeye Thiam
                    - generic [ref=f5e726]: Client
                    - generic [ref=f5e728]: Parrainage standard
                  - generic [ref=f5e730]:
                    - generic [ref=f5e731]:
                      - generic [ref=f5e734]: "Téléphone :"
                      - generic [ref=f5e735]: "+221700000205"
                    - generic [ref=f5e736]:
                      - generic [ref=f5e740]: "Email :"
                      - generic [ref=f5e741]: ndeye.thiam.05@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e743] [cursor=pointer]
              - listitem [ref=f5e748]:
                - generic [ref=f5e749]:
                  - generic [ref=f5e750]:
                    - paragraph [ref=f5e751]: Cheikh Sarr
                    - generic [ref=f5e752]: Client
                    - generic [ref=f5e754]: Parrainage standard
                  - generic [ref=f5e756]:
                    - generic [ref=f5e757]:
                      - generic [ref=f5e760]: "Téléphone :"
                      - generic [ref=f5e761]: "+221700000204"
                    - generic [ref=f5e762]:
                      - generic [ref=f5e766]: "Email :"
                      - generic [ref=f5e767]: cheikh.sarr.04@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e769] [cursor=pointer]
              - listitem [ref=f5e774]:
                - generic [ref=f5e775]:
                  - generic [ref=f5e776]:
                    - paragraph [ref=f5e777]: Aminata Sène
                    - generic [ref=f5e778]: Client
                    - generic [ref=f5e780]: Parrainage standard
                  - generic [ref=f5e782]:
                    - generic [ref=f5e783]:
                      - generic [ref=f5e786]: "Téléphone :"
                      - generic [ref=f5e787]: "+221700000203"
                    - generic [ref=f5e788]:
                      - generic [ref=f5e792]: "Email :"
                      - generic [ref=f5e793]: aminata.sene.03@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e795] [cursor=pointer]
              - listitem [ref=f5e800]:
                - generic [ref=f5e801]:
                  - generic [ref=f5e802]:
                    - paragraph [ref=f5e803]: Moussa Sy
                    - generic [ref=f5e804]: Client
                    - generic [ref=f5e806]: Parrainage standard
                  - generic [ref=f5e808]:
                    - generic [ref=f5e809]:
                      - generic [ref=f5e812]: "Téléphone :"
                      - generic [ref=f5e813]: "+221700000202"
                    - generic [ref=f5e814]:
                      - generic [ref=f5e818]: "Email :"
                      - generic [ref=f5e819]: moussa.sy.02@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e821] [cursor=pointer]
              - listitem [ref=f5e826]:
                - generic [ref=f5e827]:
                  - generic [ref=f5e828]:
                    - paragraph [ref=f5e829]: Awa Diop
                    - generic [ref=f5e830]: Client
                    - generic [ref=f5e832]: Parrainage standard
                  - generic [ref=f5e834]:
                    - generic [ref=f5e835]:
                      - generic [ref=f5e838]: "Téléphone :"
                      - generic [ref=f5e839]: "+221700000201"
                    - generic [ref=f5e840]:
                      - generic [ref=f5e844]: "Email :"
                      - generic [ref=f5e845]: awa.diop.01@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e847] [cursor=pointer]
              - listitem [ref=f5e852]:
                - generic [ref=f5e853]:
                  - generic [ref=f5e854]:
                    - paragraph [ref=f5e855]: Mamadou Sall
                    - generic [ref=f5e856]: Contrôleur
                    - generic [ref=f5e858]: Parrainage standard
                  - generic [ref=f5e860]:
                    - generic [ref=f5e861]:
                      - generic [ref=f5e864]: "Téléphone :"
                      - generic [ref=f5e865]: "+221700000110"
                    - generic [ref=f5e866]:
                      - generic [ref=f5e870]: "Email :"
                      - generic [ref=f5e871]: mamadou.sall@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e873] [cursor=pointer]
              - listitem [ref=f5e878]:
                - generic [ref=f5e879]:
                  - generic [ref=f5e880]:
                    - paragraph [ref=f5e881]: Ndèye Gning
                    - generic [ref=f5e882]: Partenaire
                    - generic [ref=f5e884]: Parrainage standard
                  - generic [ref=f5e886]:
                    - generic [ref=f5e887]:
                      - generic [ref=f5e890]: "Téléphone :"
                      - generic [ref=f5e891]: "+221700000109"
                    - generic [ref=f5e892]:
                      - generic [ref=f5e896]: "Email :"
                      - generic [ref=f5e897]: ndeye.gning@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e899] [cursor=pointer]
              - listitem [ref=f5e904]:
                - generic [ref=f5e905]:
                  - generic [ref=f5e906]:
                    - paragraph [ref=f5e907]: Lamine Cissé
                    - generic [ref=f5e908]: Contrôleur
                    - generic [ref=f5e910]: Parrainage standard
                  - generic [ref=f5e912]:
                    - generic [ref=f5e913]:
                      - generic [ref=f5e916]: "Téléphone :"
                      - generic [ref=f5e917]: "+221700000108"
                    - generic [ref=f5e918]:
                      - generic [ref=f5e922]: "Email :"
                      - generic [ref=f5e923]: lamine.cisse@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e925] [cursor=pointer]
              - listitem [ref=f5e930]:
                - generic [ref=f5e931]:
                  - generic [ref=f5e932]:
                    - paragraph [ref=f5e933]: Seynabou Ba
                    - generic [ref=f5e934]: Contrôleur
                    - generic [ref=f5e936]: Parrainage standard
                  - generic [ref=f5e938]:
                    - generic [ref=f5e939]:
                      - generic [ref=f5e942]: "Téléphone :"
                      - generic [ref=f5e943]: "+221700000107"
                    - generic [ref=f5e944]:
                      - generic [ref=f5e948]: "Email :"
                      - generic [ref=f5e949]: seynabou.ba@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e951] [cursor=pointer]
              - listitem [ref=f5e956]:
                - generic [ref=f5e957]:
                  - generic [ref=f5e958]:
                    - paragraph [ref=f5e959]: Ibrahima Gueye
                    - generic [ref=f5e960]: Contrôleur
                    - generic [ref=f5e962]: Parrainage standard
                  - generic [ref=f5e964]:
                    - generic [ref=f5e965]:
                      - generic [ref=f5e968]: "Téléphone :"
                      - generic [ref=f5e969]: "+221700000106"
                    - generic [ref=f5e970]:
                      - generic [ref=f5e974]: "Email :"
                      - generic [ref=f5e975]: ibrahima.gueye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e977] [cursor=pointer]
              - listitem [ref=f5e982]:
                - generic [ref=f5e983]:
                  - generic [ref=f5e984]:
                    - paragraph [ref=f5e985]: Fatou Mbaye
                    - generic [ref=f5e986]: Client
                    - generic [ref=f5e988]: Parrainage standard
                  - generic [ref=f5e990]:
                    - generic [ref=f5e991]:
                      - generic [ref=f5e994]: "Téléphone :"
                      - generic [ref=f5e995]: "+221700000105"
                    - generic [ref=f5e996]:
                      - generic [ref=f5e1000]: "Email :"
                      - generic [ref=f5e1001]: fatou.mbaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1003] [cursor=pointer]
              - listitem [ref=f5e1008]:
                - generic [ref=f5e1009]:
                  - generic [ref=f5e1010]:
                    - paragraph [ref=f5e1011]: Aïda Diallo
                    - generic [ref=f5e1012]: Administrateur
                    - generic [ref=f5e1014]: Parrainage standard
                  - generic [ref=f5e1016]:
                    - generic [ref=f5e1017]:
                      - generic [ref=f5e1020]: "Téléphone :"
                      - generic [ref=f5e1021]: "+221700000104"
                    - generic [ref=f5e1022]:
                      - generic [ref=f5e1026]: "Email :"
                      - generic [ref=f5e1027]: aida.diallo@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1029] [cursor=pointer]
              - listitem [ref=f5e1034]:
                - generic [ref=f5e1035]:
                  - generic [ref=f5e1036]:
                    - paragraph [ref=f5e1037]: Khady Sarr
                    - generic [ref=f5e1038]: Partenaire
                    - generic [ref=f5e1040]: Parrainage standard
                  - generic [ref=f5e1042]:
                    - generic [ref=f5e1043]:
                      - generic [ref=f5e1046]: "Téléphone :"
                      - generic [ref=f5e1047]: "+221700000103"
                    - generic [ref=f5e1048]:
                      - generic [ref=f5e1052]: "Email :"
                      - generic [ref=f5e1053]: khady.sarr@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1055] [cursor=pointer]
              - listitem [ref=f5e1060]:
                - generic [ref=f5e1061]:
                  - generic [ref=f5e1062]:
                    - paragraph [ref=f5e1063]: Ousmane Faye
                    - generic [ref=f5e1064]: Partenaire
                    - generic [ref=f5e1066]: Parrainage standard
                  - generic [ref=f5e1068]:
                    - generic [ref=f5e1069]:
                      - generic [ref=f5e1072]: "Téléphone :"
                      - generic [ref=f5e1073]: "+221700000102"
                    - generic [ref=f5e1074]:
                      - generic [ref=f5e1078]: "Email :"
                      - generic [ref=f5e1079]: ousmane.faye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1081] [cursor=pointer]
              - listitem [ref=f5e1086]:
                - generic [ref=f5e1087]:
                  - generic [ref=f5e1088]:
                    - paragraph [ref=f5e1089]: Mariama Ndiaye
                    - generic [ref=f5e1090]: Partenaire
                    - generic [ref=f5e1092]: Parrainage standard
                  - generic [ref=f5e1094]:
                    - generic [ref=f5e1095]:
                      - generic [ref=f5e1098]: "Téléphone :"
                      - generic [ref=f5e1099]: "+221700000101"
                    - generic [ref=f5e1100]:
                      - generic [ref=f5e1104]: "Email :"
                      - generic [ref=f5e1105]: mariama.ndiaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1107] [cursor=pointer]
              - listitem [ref=f5e1112]:
                - generic [ref=f5e1113]:
                  - generic [ref=f5e1114]:
                    - paragraph [ref=f5e1115]: Fatou Suspendue
                    - generic [ref=f5e1116]: Client
                    - generic [ref=f5e1118]: Parrainage standard
                  - generic [ref=f5e1120]:
                    - generic [ref=f5e1121]:
                      - generic [ref=f5e1124]: "Téléphone :"
                      - generic [ref=f5e1125]: "+221700000008"
                    - generic [ref=f5e1126]:
                      - generic [ref=f5e1130]: "Email :"
                      - generic [ref=f5e1131]: suspendu@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1133] [cursor=pointer]
              - listitem [ref=f5e1138]:
                - generic [ref=f5e1139]:
                  - generic [ref=f5e1140]:
                    - paragraph [ref=f5e1141]: Elhadji SuperAdmin
                    - generic [ref=f5e1142]: Super-administrateur
                    - generic [ref=f5e1144]: Parrainage standard
                  - generic [ref=f5e1146]:
                    - generic [ref=f5e1147]:
                      - generic [ref=f5e1150]: "Téléphone :"
                      - generic [ref=f5e1151]: "+221700000007"
                    - generic [ref=f5e1152]:
                      - generic [ref=f5e1156]: "Email :"
                      - generic [ref=f5e1157]: superadmin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1159] [cursor=pointer]
              - listitem [ref=f5e1164]:
                - generic [ref=f5e1165]:
                  - generic [ref=f5e1166]:
                    - paragraph [ref=f5e1167]: Dior Admin
                    - generic [ref=f5e1168]: Administrateur
                    - generic [ref=f5e1170]: Parrainage standard
                  - generic [ref=f5e1172]:
                    - generic [ref=f5e1173]:
                      - generic [ref=f5e1176]: "Téléphone :"
                      - generic [ref=f5e1177]: "+221700000006"
                    - generic [ref=f5e1178]:
                      - generic [ref=f5e1182]: "Email :"
                      - generic [ref=f5e1183]: admin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1185] [cursor=pointer]
              - listitem [ref=f5e1190]:
                - generic [ref=f5e1191]:
                  - generic [ref=f5e1192]:
                    - paragraph [ref=f5e1193]: Cheikh ControleurA
                    - generic [ref=f5e1194]: Contrôleur
                    - generic [ref=f5e1196]: Parrainage standard
                  - generic [ref=f5e1198]:
                    - generic [ref=f5e1199]:
                      - generic [ref=f5e1202]: "Téléphone :"
                      - generic [ref=f5e1203]: "+221700000005"
                    - generic [ref=f5e1204]:
                      - generic [ref=f5e1208]: "Email :"
                      - generic [ref=f5e1209]: controller-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1211] [cursor=pointer]
              - listitem [ref=f5e1216]:
                - generic [ref=f5e1217]:
                  - generic [ref=f5e1218]:
                    - paragraph [ref=f5e1219]: Bassirou OrgaB
                    - generic [ref=f5e1220]: Partenaire
                    - generic [ref=f5e1222]: Parrainage standard
                  - generic [ref=f5e1224]:
                    - generic [ref=f5e1225]:
                      - generic [ref=f5e1228]: "Téléphone :"
                      - generic [ref=f5e1229]: "+221700000004"
                    - generic [ref=f5e1230]:
                      - generic [ref=f5e1234]: "Email :"
                      - generic [ref=f5e1235]: partner-b@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1237] [cursor=pointer]
              - listitem [ref=f5e1242]:
                - generic [ref=f5e1243]:
                  - generic [ref=f5e1244]:
                    - paragraph [ref=f5e1245]: Aïssatou OrgaA
                    - generic [ref=f5e1246]: Partenaire
                    - generic [ref=f5e1248]: Parrainage standard
                  - generic [ref=f5e1250]:
                    - generic [ref=f5e1251]:
                      - generic [ref=f5e1254]: "Téléphone :"
                      - generic [ref=f5e1255]: "+221700000003"
                    - generic [ref=f5e1256]:
                      - generic [ref=f5e1260]: "Email :"
                      - generic [ref=f5e1261]: partner-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1263] [cursor=pointer]
              - listitem [ref=f5e1268]:
                - generic [ref=f5e1269]:
                  - generic [ref=f5e1270]:
                    - paragraph [ref=f5e1271]: Birame ClientBis
                    - generic [ref=f5e1272]: Client
                    - generic [ref=f5e1274]: Parrainage standard
                  - generic [ref=f5e1276]:
                    - generic [ref=f5e1277]:
                      - generic [ref=f5e1280]: "Téléphone :"
                      - generic [ref=f5e1281]: "+221700000002"
                    - generic [ref=f5e1282]:
                      - generic [ref=f5e1286]: "Email :"
                      - generic [ref=f5e1287]: client-bis@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1289] [cursor=pointer]
              - listitem [ref=f5e1294]:
                - generic [ref=f5e1295]:
                  - generic [ref=f5e1296]:
                    - paragraph [ref=f5e1297]: Awa Client
                    - generic [ref=f5e1298]: Client
                    - generic [ref=f5e1300]: Parrainage standard
                  - generic [ref=f5e1302]:
                    - generic [ref=f5e1303]:
                      - generic [ref=f5e1306]: "Téléphone :"
                      - generic [ref=f5e1307]: "+221700000001"
                    - generic [ref=f5e1308]:
                      - generic [ref=f5e1312]: "Email :"
                      - generic [ref=f5e1313]: client@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f5e1315] [cursor=pointer]
  - alert [ref=f5e1320]
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
      |                                                                                        ^ Error: contrôles responsive de adm-parrainage (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```