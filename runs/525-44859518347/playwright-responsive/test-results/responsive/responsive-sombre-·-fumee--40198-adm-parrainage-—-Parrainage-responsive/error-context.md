# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-parrainage — Parrainage
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-parrainage (sombre)

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
                - heading "Parrainage et ambassadeurs" [level=1] [ref=f2e168]
                - paragraph [ref=f2e169]: Taux et durée du parrainage, et comptes nommés ambassadeurs.
              - button "Actualiser" [ref=f2e171] [cursor=pointer]
          - generic [ref=f2e179]:
            - generic [ref=f2e180]:
              - paragraph [ref=f2e182]: Comptes affichés
              - paragraph [ref=f2e189]: "42"
              - paragraph [ref=f2e190]: 42 sans statut d’ambassadeur
            - generic [ref=f2e191]:
              - paragraph [ref=f2e193]: Ambassadeurs
              - paragraph [ref=f2e197]: "0"
              - paragraph [ref=f2e198]: "Taux ambassadeur : 7 % sur les filleuls directs, 2 % sur les filleuls de ses filleuls"
            - generic [ref=f2e199]:
              - paragraph [ref=f2e201]: Durée du parrainage
              - paragraph [ref=f2e206]: 12 mois
              - paragraph [ref=f2e207]: Compte standard ; 24 mois pour un ambassadeur
          - status [ref=f2e208]:
            - paragraph [ref=f2e214]: La personnalisation des taux n’est pas disponible pour le moment.
          - region [ref=f2e215]:
            - generic [ref=f2e216]:
              - heading "Comptes" [level=2] [ref=f2e217]
              - paragraph [ref=f2e218]: Nommez un ambassadeur pour majorer ses commissions sur ses filleuls directs et sur les filleuls de ses filleuls.
            - generic [ref=f2e219]:
              - searchbox "Rechercher un compte" [ref=f2e221]
              - group "Filtrer par statut" [ref=f2e222]:
                - button "Tous" [pressed] [ref=f2e223] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f2e224]: ✓
                  - text: Tous
                - button "Ambassadeurs" [ref=f2e225] [cursor=pointer]
                - button "Sans statut d’ambassadeur" [ref=f2e226] [cursor=pointer]
            - list "Comptes du parrainage" [ref=f2e227]:
              - listitem [ref=f2e228]:
                - generic [ref=f2e229]:
                  - generic [ref=f2e230]:
                    - paragraph [ref=f2e231]: Assane Badji
                    - generic [ref=f2e232]: Client
                    - generic [ref=f2e234]: Parrainage standard
                  - generic [ref=f2e236]:
                    - generic [ref=f2e237]:
                      - generic [ref=f2e240]: "Téléphone :"
                      - generic [ref=f2e241]: "+221700000224"
                    - generic [ref=f2e242]:
                      - generic [ref=f2e246]: "Email :"
                      - generic [ref=f2e247]: assane.badji.24@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e249] [cursor=pointer]
              - listitem [ref=f2e254]:
                - generic [ref=f2e255]:
                  - generic [ref=f2e256]:
                    - paragraph [ref=f2e257]: Marième Niang
                    - generic [ref=f2e258]: Client
                    - generic [ref=f2e260]: Parrainage standard
                  - generic [ref=f2e262]:
                    - generic [ref=f2e263]:
                      - generic [ref=f2e266]: "Téléphone :"
                      - generic [ref=f2e267]: "+221700000223"
                    - generic [ref=f2e268]:
                      - generic [ref=f2e272]: "Email :"
                      - generic [ref=f2e273]: marieme.niang.23@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e275] [cursor=pointer]
              - listitem [ref=f2e280]:
                - generic [ref=f2e281]:
                  - generic [ref=f2e282]:
                    - paragraph [ref=f2e283]: Omar Gaye
                    - generic [ref=f2e284]: Client
                    - generic [ref=f2e286]: Parrainage standard
                  - generic [ref=f2e288]:
                    - generic [ref=f2e289]:
                      - generic [ref=f2e292]: "Téléphone :"
                      - generic [ref=f2e293]: "+221700000222"
                    - generic [ref=f2e294]:
                      - generic [ref=f2e298]: "Email :"
                      - generic [ref=f2e299]: omar.gaye.22@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e301] [cursor=pointer]
              - listitem [ref=f2e306]:
                - generic [ref=f2e307]:
                  - generic [ref=f2e308]:
                    - paragraph [ref=f2e309]: Dieynaba Tall
                    - generic [ref=f2e310]: Client
                    - generic [ref=f2e312]: Parrainage standard
                  - generic [ref=f2e314]:
                    - generic [ref=f2e315]:
                      - generic [ref=f2e318]: "Téléphone :"
                      - generic [ref=f2e319]: "+221700000221"
                    - generic [ref=f2e320]:
                      - generic [ref=f2e324]: "Email :"
                      - generic [ref=f2e325]: dieynaba.tall.21@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e327] [cursor=pointer]
              - listitem [ref=f2e332]:
                - generic [ref=f2e333]:
                  - generic [ref=f2e334]:
                    - paragraph [ref=f2e335]: Saliou Touré
                    - generic [ref=f2e336]: Client
                    - generic [ref=f2e338]: Parrainage standard
                  - generic [ref=f2e340]:
                    - generic [ref=f2e341]:
                      - generic [ref=f2e344]: "Téléphone :"
                      - generic [ref=f2e345]: "+221700000220"
                    - generic [ref=f2e346]:
                      - generic [ref=f2e350]: "Email :"
                      - generic [ref=f2e351]: saliou.toure.20@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e353] [cursor=pointer]
              - listitem [ref=f2e358]:
                - generic [ref=f2e359]:
                  - generic [ref=f2e360]:
                    - paragraph [ref=f2e361]: Bineta Kane
                    - generic [ref=f2e362]: Client
                    - generic [ref=f2e364]: Parrainage standard
                  - generic [ref=f2e366]:
                    - generic [ref=f2e367]:
                      - generic [ref=f2e370]: "Téléphone :"
                      - generic [ref=f2e371]: "+221700000219"
                    - generic [ref=f2e372]:
                      - generic [ref=f2e376]: "Email :"
                      - generic [ref=f2e377]: bineta.kane.19@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e379] [cursor=pointer]
              - listitem [ref=f2e384]:
                - generic [ref=f2e385]:
                  - generic [ref=f2e386]:
                    - paragraph [ref=f2e387]: Modou Mboup
                    - generic [ref=f2e388]: Client
                    - generic [ref=f2e390]: Parrainage standard
                  - generic [ref=f2e392]:
                    - generic [ref=f2e393]:
                      - generic [ref=f2e396]: "Téléphone :"
                      - generic [ref=f2e397]: "+221700000218"
                    - generic [ref=f2e398]:
                      - generic [ref=f2e402]: "Email :"
                      - generic [ref=f2e403]: modou.mboup.18@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e405] [cursor=pointer]
              - listitem [ref=f2e410]:
                - generic [ref=f2e411]:
                  - generic [ref=f2e412]:
                    - paragraph [ref=f2e413]: Yacine Dieng
                    - generic [ref=f2e414]: Client
                    - generic [ref=f2e416]: Parrainage standard
                  - generic [ref=f2e418]:
                    - generic [ref=f2e419]:
                      - generic [ref=f2e422]: "Téléphone :"
                      - generic [ref=f2e423]: "+221700000217"
                    - generic [ref=f2e424]:
                      - generic [ref=f2e428]: "Email :"
                      - generic [ref=f2e429]: yacine.dieng.17@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e431] [cursor=pointer]
              - listitem [ref=f2e436]:
                - generic [ref=f2e437]:
                  - generic [ref=f2e438]:
                    - paragraph [ref=f2e439]: Ibou Mbengue
                    - generic [ref=f2e440]: Client
                    - generic [ref=f2e442]: Parrainage standard
                  - generic [ref=f2e444]:
                    - generic [ref=f2e445]:
                      - generic [ref=f2e448]: "Téléphone :"
                      - generic [ref=f2e449]: "+221700000216"
                    - generic [ref=f2e450]:
                      - generic [ref=f2e454]: "Email :"
                      - generic [ref=f2e455]: ibou.mbengue.16@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e457] [cursor=pointer]
              - listitem [ref=f2e462]:
                - generic [ref=f2e463]:
                  - generic [ref=f2e464]:
                    - paragraph [ref=f2e465]: Astou Sow
                    - generic [ref=f2e466]: Client
                    - generic [ref=f2e468]: Parrainage standard
                  - generic [ref=f2e470]:
                    - generic [ref=f2e471]:
                      - generic [ref=f2e474]: "Téléphone :"
                      - generic [ref=f2e475]: "+221700000215"
                    - generic [ref=f2e476]:
                      - generic [ref=f2e480]: "Email :"
                      - generic [ref=f2e481]: astou.sow.15@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e483] [cursor=pointer]
              - listitem [ref=f2e488]:
                - generic [ref=f2e489]:
                  - generic [ref=f2e490]:
                    - paragraph [ref=f2e491]: Mamadou Kébé
                    - generic [ref=f2e492]: Client
                    - generic [ref=f2e494]: Parrainage standard
                  - generic [ref=f2e496]:
                    - generic [ref=f2e497]:
                      - generic [ref=f2e500]: "Téléphone :"
                      - generic [ref=f2e501]: "+221700000214"
                    - generic [ref=f2e502]:
                      - generic [ref=f2e506]: "Email :"
                      - generic [ref=f2e507]: mamadou.kebe.14@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e509] [cursor=pointer]
              - listitem [ref=f2e514]:
                - generic [ref=f2e515]:
                  - generic [ref=f2e516]:
                    - paragraph [ref=f2e517]: Fatoumata Camara
                    - generic [ref=f2e518]: Client
                    - generic [ref=f2e520]: Parrainage standard
                  - generic [ref=f2e522]:
                    - generic [ref=f2e523]:
                      - generic [ref=f2e526]: "Téléphone :"
                      - generic [ref=f2e527]: "+221700000213"
                    - generic [ref=f2e528]:
                      - generic [ref=f2e532]: "Email :"
                      - generic [ref=f2e533]: fatoumata.camara.13@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e535] [cursor=pointer]
              - listitem [ref=f2e540]:
                - generic [ref=f2e541]:
                  - generic [ref=f2e542]:
                    - paragraph [ref=f2e543]: Adama Diouf
                    - generic [ref=f2e544]: Client
                    - generic [ref=f2e546]: Parrainage standard
                  - generic [ref=f2e548]:
                    - generic [ref=f2e549]:
                      - generic [ref=f2e552]: "Téléphone :"
                      - generic [ref=f2e553]: "+221700000212"
                    - generic [ref=f2e554]:
                      - generic [ref=f2e558]: "Email :"
                      - generic [ref=f2e559]: adama.diouf.12@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e561] [cursor=pointer]
              - listitem [ref=f2e566]:
                - generic [ref=f2e567]:
                  - generic [ref=f2e568]:
                    - paragraph [ref=f2e569]: Rokhaya Ndao
                    - generic [ref=f2e570]: Client
                    - generic [ref=f2e572]: Parrainage standard
                  - generic [ref=f2e574]:
                    - generic [ref=f2e575]:
                      - generic [ref=f2e578]: "Téléphone :"
                      - generic [ref=f2e579]: "+221700000211"
                    - generic [ref=f2e580]:
                      - generic [ref=f2e584]: "Email :"
                      - generic [ref=f2e585]: rokhaya.ndao.11@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e587] [cursor=pointer]
              - listitem [ref=f2e592]:
                - generic [ref=f2e593]:
                  - generic [ref=f2e594]:
                    - paragraph [ref=f2e595]: Pape Lo
                    - generic [ref=f2e596]: Client
                    - generic [ref=f2e598]: Parrainage standard
                  - generic [ref=f2e600]:
                    - generic [ref=f2e601]:
                      - generic [ref=f2e604]: "Téléphone :"
                      - generic [ref=f2e605]: "+221700000210"
                    - generic [ref=f2e606]:
                      - generic [ref=f2e610]: "Email :"
                      - generic [ref=f2e611]: pape.lo.10@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e613] [cursor=pointer]
              - listitem [ref=f2e618]:
                - generic [ref=f2e619]:
                  - generic [ref=f2e620]:
                    - paragraph [ref=f2e621]: Coumba Ka
                    - generic [ref=f2e622]: Client
                    - generic [ref=f2e624]: Parrainage standard
                  - generic [ref=f2e626]:
                    - generic [ref=f2e627]:
                      - generic [ref=f2e630]: "Téléphone :"
                      - generic [ref=f2e631]: "+221700000209"
                    - generic [ref=f2e632]:
                      - generic [ref=f2e636]: "Email :"
                      - generic [ref=f2e637]: coumba.ka.09@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e639] [cursor=pointer]
              - listitem [ref=f2e644]:
                - generic [ref=f2e645]:
                  - generic [ref=f2e646]:
                    - paragraph [ref=f2e647]: Alioune Fall
                    - generic [ref=f2e648]: Client
                    - generic [ref=f2e650]: Parrainage standard
                  - generic [ref=f2e652]:
                    - generic [ref=f2e653]:
                      - generic [ref=f2e656]: "Téléphone :"
                      - generic [ref=f2e657]: "+221700000208"
                    - generic [ref=f2e658]:
                      - generic [ref=f2e662]: "Email :"
                      - generic [ref=f2e663]: alioune.fall.08@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e665] [cursor=pointer]
              - listitem [ref=f2e670]:
                - generic [ref=f2e671]:
                  - generic [ref=f2e672]:
                    - paragraph [ref=f2e673]: Mame Ndour
                    - generic [ref=f2e674]: Client
                    - generic [ref=f2e676]: Parrainage standard
                  - generic [ref=f2e678]:
                    - generic [ref=f2e679]:
                      - generic [ref=f2e682]: "Téléphone :"
                      - generic [ref=f2e683]: "+221700000207"
                    - generic [ref=f2e684]:
                      - generic [ref=f2e688]: "Email :"
                      - generic [ref=f2e689]: mame.ndour.07@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e691] [cursor=pointer]
              - listitem [ref=f2e696]:
                - generic [ref=f2e697]:
                  - generic [ref=f2e698]:
                    - paragraph [ref=f2e699]: Babacar Diagne
                    - generic [ref=f2e700]: Client
                    - generic [ref=f2e702]: Parrainage standard
                  - generic [ref=f2e704]:
                    - generic [ref=f2e705]:
                      - generic [ref=f2e708]: "Téléphone :"
                      - generic [ref=f2e709]: "+221700000206"
                    - generic [ref=f2e710]:
                      - generic [ref=f2e714]: "Email :"
                      - generic [ref=f2e715]: babacar.diagne.06@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e717] [cursor=pointer]
              - listitem [ref=f2e722]:
                - generic [ref=f2e723]:
                  - generic [ref=f2e724]:
                    - paragraph [ref=f2e725]: Ndeye Thiam
                    - generic [ref=f2e726]: Client
                    - generic [ref=f2e728]: Parrainage standard
                  - generic [ref=f2e730]:
                    - generic [ref=f2e731]:
                      - generic [ref=f2e734]: "Téléphone :"
                      - generic [ref=f2e735]: "+221700000205"
                    - generic [ref=f2e736]:
                      - generic [ref=f2e740]: "Email :"
                      - generic [ref=f2e741]: ndeye.thiam.05@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e743] [cursor=pointer]
              - listitem [ref=f2e748]:
                - generic [ref=f2e749]:
                  - generic [ref=f2e750]:
                    - paragraph [ref=f2e751]: Cheikh Sarr
                    - generic [ref=f2e752]: Client
                    - generic [ref=f2e754]: Parrainage standard
                  - generic [ref=f2e756]:
                    - generic [ref=f2e757]:
                      - generic [ref=f2e760]: "Téléphone :"
                      - generic [ref=f2e761]: "+221700000204"
                    - generic [ref=f2e762]:
                      - generic [ref=f2e766]: "Email :"
                      - generic [ref=f2e767]: cheikh.sarr.04@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e769] [cursor=pointer]
              - listitem [ref=f2e774]:
                - generic [ref=f2e775]:
                  - generic [ref=f2e776]:
                    - paragraph [ref=f2e777]: Aminata Sène
                    - generic [ref=f2e778]: Client
                    - generic [ref=f2e780]: Parrainage standard
                  - generic [ref=f2e782]:
                    - generic [ref=f2e783]:
                      - generic [ref=f2e786]: "Téléphone :"
                      - generic [ref=f2e787]: "+221700000203"
                    - generic [ref=f2e788]:
                      - generic [ref=f2e792]: "Email :"
                      - generic [ref=f2e793]: aminata.sene.03@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e795] [cursor=pointer]
              - listitem [ref=f2e800]:
                - generic [ref=f2e801]:
                  - generic [ref=f2e802]:
                    - paragraph [ref=f2e803]: Moussa Sy
                    - generic [ref=f2e804]: Client
                    - generic [ref=f2e806]: Parrainage standard
                  - generic [ref=f2e808]:
                    - generic [ref=f2e809]:
                      - generic [ref=f2e812]: "Téléphone :"
                      - generic [ref=f2e813]: "+221700000202"
                    - generic [ref=f2e814]:
                      - generic [ref=f2e818]: "Email :"
                      - generic [ref=f2e819]: moussa.sy.02@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e821] [cursor=pointer]
              - listitem [ref=f2e826]:
                - generic [ref=f2e827]:
                  - generic [ref=f2e828]:
                    - paragraph [ref=f2e829]: Awa Diop
                    - generic [ref=f2e830]: Client
                    - generic [ref=f2e832]: Parrainage standard
                  - generic [ref=f2e834]:
                    - generic [ref=f2e835]:
                      - generic [ref=f2e838]: "Téléphone :"
                      - generic [ref=f2e839]: "+221700000201"
                    - generic [ref=f2e840]:
                      - generic [ref=f2e844]: "Email :"
                      - generic [ref=f2e845]: awa.diop.01@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e847] [cursor=pointer]
              - listitem [ref=f2e852]:
                - generic [ref=f2e853]:
                  - generic [ref=f2e854]:
                    - paragraph [ref=f2e855]: Mamadou Sall
                    - generic [ref=f2e856]: Contrôleur
                    - generic [ref=f2e858]: Parrainage standard
                  - generic [ref=f2e860]:
                    - generic [ref=f2e861]:
                      - generic [ref=f2e864]: "Téléphone :"
                      - generic [ref=f2e865]: "+221700000110"
                    - generic [ref=f2e866]:
                      - generic [ref=f2e870]: "Email :"
                      - generic [ref=f2e871]: mamadou.sall@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e873] [cursor=pointer]
              - listitem [ref=f2e878]:
                - generic [ref=f2e879]:
                  - generic [ref=f2e880]:
                    - paragraph [ref=f2e881]: Ndèye Gning
                    - generic [ref=f2e882]: Partenaire
                    - generic [ref=f2e884]: Parrainage standard
                  - generic [ref=f2e886]:
                    - generic [ref=f2e887]:
                      - generic [ref=f2e890]: "Téléphone :"
                      - generic [ref=f2e891]: "+221700000109"
                    - generic [ref=f2e892]:
                      - generic [ref=f2e896]: "Email :"
                      - generic [ref=f2e897]: ndeye.gning@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e899] [cursor=pointer]
              - listitem [ref=f2e904]:
                - generic [ref=f2e905]:
                  - generic [ref=f2e906]:
                    - paragraph [ref=f2e907]: Lamine Cissé
                    - generic [ref=f2e908]: Contrôleur
                    - generic [ref=f2e910]: Parrainage standard
                  - generic [ref=f2e912]:
                    - generic [ref=f2e913]:
                      - generic [ref=f2e916]: "Téléphone :"
                      - generic [ref=f2e917]: "+221700000108"
                    - generic [ref=f2e918]:
                      - generic [ref=f2e922]: "Email :"
                      - generic [ref=f2e923]: lamine.cisse@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e925] [cursor=pointer]
              - listitem [ref=f2e930]:
                - generic [ref=f2e931]:
                  - generic [ref=f2e932]:
                    - paragraph [ref=f2e933]: Seynabou Ba
                    - generic [ref=f2e934]: Contrôleur
                    - generic [ref=f2e936]: Parrainage standard
                  - generic [ref=f2e938]:
                    - generic [ref=f2e939]:
                      - generic [ref=f2e942]: "Téléphone :"
                      - generic [ref=f2e943]: "+221700000107"
                    - generic [ref=f2e944]:
                      - generic [ref=f2e948]: "Email :"
                      - generic [ref=f2e949]: seynabou.ba@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e951] [cursor=pointer]
              - listitem [ref=f2e956]:
                - generic [ref=f2e957]:
                  - generic [ref=f2e958]:
                    - paragraph [ref=f2e959]: Ibrahima Gueye
                    - generic [ref=f2e960]: Contrôleur
                    - generic [ref=f2e962]: Parrainage standard
                  - generic [ref=f2e964]:
                    - generic [ref=f2e965]:
                      - generic [ref=f2e968]: "Téléphone :"
                      - generic [ref=f2e969]: "+221700000106"
                    - generic [ref=f2e970]:
                      - generic [ref=f2e974]: "Email :"
                      - generic [ref=f2e975]: ibrahima.gueye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e977] [cursor=pointer]
              - listitem [ref=f2e982]:
                - generic [ref=f2e983]:
                  - generic [ref=f2e984]:
                    - paragraph [ref=f2e985]: Fatou Mbaye
                    - generic [ref=f2e986]: Client
                    - generic [ref=f2e988]: Parrainage standard
                  - generic [ref=f2e990]:
                    - generic [ref=f2e991]:
                      - generic [ref=f2e994]: "Téléphone :"
                      - generic [ref=f2e995]: "+221700000105"
                    - generic [ref=f2e996]:
                      - generic [ref=f2e1000]: "Email :"
                      - generic [ref=f2e1001]: fatou.mbaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1003] [cursor=pointer]
              - listitem [ref=f2e1008]:
                - generic [ref=f2e1009]:
                  - generic [ref=f2e1010]:
                    - paragraph [ref=f2e1011]: Aïda Diallo
                    - generic [ref=f2e1012]: Administrateur
                    - generic [ref=f2e1014]: Parrainage standard
                  - generic [ref=f2e1016]:
                    - generic [ref=f2e1017]:
                      - generic [ref=f2e1020]: "Téléphone :"
                      - generic [ref=f2e1021]: "+221700000104"
                    - generic [ref=f2e1022]:
                      - generic [ref=f2e1026]: "Email :"
                      - generic [ref=f2e1027]: aida.diallo@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1029] [cursor=pointer]
              - listitem [ref=f2e1034]:
                - generic [ref=f2e1035]:
                  - generic [ref=f2e1036]:
                    - paragraph [ref=f2e1037]: Khady Sarr
                    - generic [ref=f2e1038]: Partenaire
                    - generic [ref=f2e1040]: Parrainage standard
                  - generic [ref=f2e1042]:
                    - generic [ref=f2e1043]:
                      - generic [ref=f2e1046]: "Téléphone :"
                      - generic [ref=f2e1047]: "+221700000103"
                    - generic [ref=f2e1048]:
                      - generic [ref=f2e1052]: "Email :"
                      - generic [ref=f2e1053]: khady.sarr@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1055] [cursor=pointer]
              - listitem [ref=f2e1060]:
                - generic [ref=f2e1061]:
                  - generic [ref=f2e1062]:
                    - paragraph [ref=f2e1063]: Ousmane Faye
                    - generic [ref=f2e1064]: Partenaire
                    - generic [ref=f2e1066]: Parrainage standard
                  - generic [ref=f2e1068]:
                    - generic [ref=f2e1069]:
                      - generic [ref=f2e1072]: "Téléphone :"
                      - generic [ref=f2e1073]: "+221700000102"
                    - generic [ref=f2e1074]:
                      - generic [ref=f2e1078]: "Email :"
                      - generic [ref=f2e1079]: ousmane.faye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1081] [cursor=pointer]
              - listitem [ref=f2e1086]:
                - generic [ref=f2e1087]:
                  - generic [ref=f2e1088]:
                    - paragraph [ref=f2e1089]: Mariama Ndiaye
                    - generic [ref=f2e1090]: Partenaire
                    - generic [ref=f2e1092]: Parrainage standard
                  - generic [ref=f2e1094]:
                    - generic [ref=f2e1095]:
                      - generic [ref=f2e1098]: "Téléphone :"
                      - generic [ref=f2e1099]: "+221700000101"
                    - generic [ref=f2e1100]:
                      - generic [ref=f2e1104]: "Email :"
                      - generic [ref=f2e1105]: mariama.ndiaye@demo.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1107] [cursor=pointer]
              - listitem [ref=f2e1112]:
                - generic [ref=f2e1113]:
                  - generic [ref=f2e1114]:
                    - paragraph [ref=f2e1115]: Fatou Suspendue
                    - generic [ref=f2e1116]: Client
                    - generic [ref=f2e1118]: Parrainage standard
                  - generic [ref=f2e1120]:
                    - generic [ref=f2e1121]:
                      - generic [ref=f2e1124]: "Téléphone :"
                      - generic [ref=f2e1125]: "+221700000008"
                    - generic [ref=f2e1126]:
                      - generic [ref=f2e1130]: "Email :"
                      - generic [ref=f2e1131]: suspendu@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1133] [cursor=pointer]
              - listitem [ref=f2e1138]:
                - generic [ref=f2e1139]:
                  - generic [ref=f2e1140]:
                    - paragraph [ref=f2e1141]: Elhadji SuperAdmin
                    - generic [ref=f2e1142]: Super-administrateur
                    - generic [ref=f2e1144]: Parrainage standard
                  - generic [ref=f2e1146]:
                    - generic [ref=f2e1147]:
                      - generic [ref=f2e1150]: "Téléphone :"
                      - generic [ref=f2e1151]: "+221700000007"
                    - generic [ref=f2e1152]:
                      - generic [ref=f2e1156]: "Email :"
                      - generic [ref=f2e1157]: superadmin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1159] [cursor=pointer]
              - listitem [ref=f2e1164]:
                - generic [ref=f2e1165]:
                  - generic [ref=f2e1166]:
                    - paragraph [ref=f2e1167]: Dior Admin
                    - generic [ref=f2e1168]: Administrateur
                    - generic [ref=f2e1170]: Parrainage standard
                  - generic [ref=f2e1172]:
                    - generic [ref=f2e1173]:
                      - generic [ref=f2e1176]: "Téléphone :"
                      - generic [ref=f2e1177]: "+221700000006"
                    - generic [ref=f2e1178]:
                      - generic [ref=f2e1182]: "Email :"
                      - generic [ref=f2e1183]: admin@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1185] [cursor=pointer]
              - listitem [ref=f2e1190]:
                - generic [ref=f2e1191]:
                  - generic [ref=f2e1192]:
                    - paragraph [ref=f2e1193]: Cheikh ControleurA
                    - generic [ref=f2e1194]: Contrôleur
                    - generic [ref=f2e1196]: Parrainage standard
                  - generic [ref=f2e1198]:
                    - generic [ref=f2e1199]:
                      - generic [ref=f2e1202]: "Téléphone :"
                      - generic [ref=f2e1203]: "+221700000005"
                    - generic [ref=f2e1204]:
                      - generic [ref=f2e1208]: "Email :"
                      - generic [ref=f2e1209]: controller-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1211] [cursor=pointer]
              - listitem [ref=f2e1216]:
                - generic [ref=f2e1217]:
                  - generic [ref=f2e1218]:
                    - paragraph [ref=f2e1219]: Bassirou OrgaB
                    - generic [ref=f2e1220]: Partenaire
                    - generic [ref=f2e1222]: Parrainage standard
                  - generic [ref=f2e1224]:
                    - generic [ref=f2e1225]:
                      - generic [ref=f2e1228]: "Téléphone :"
                      - generic [ref=f2e1229]: "+221700000004"
                    - generic [ref=f2e1230]:
                      - generic [ref=f2e1234]: "Email :"
                      - generic [ref=f2e1235]: partner-b@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1237] [cursor=pointer]
              - listitem [ref=f2e1242]:
                - generic [ref=f2e1243]:
                  - generic [ref=f2e1244]:
                    - paragraph [ref=f2e1245]: Aïssatou OrgaA
                    - generic [ref=f2e1246]: Partenaire
                    - generic [ref=f2e1248]: Parrainage standard
                  - generic [ref=f2e1250]:
                    - generic [ref=f2e1251]:
                      - generic [ref=f2e1254]: "Téléphone :"
                      - generic [ref=f2e1255]: "+221700000003"
                    - generic [ref=f2e1256]:
                      - generic [ref=f2e1260]: "Email :"
                      - generic [ref=f2e1261]: partner-a@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1263] [cursor=pointer]
              - listitem [ref=f2e1268]:
                - generic [ref=f2e1269]:
                  - generic [ref=f2e1270]:
                    - paragraph [ref=f2e1271]: Birame ClientBis
                    - generic [ref=f2e1272]: Client
                    - generic [ref=f2e1274]: Parrainage standard
                  - generic [ref=f2e1276]:
                    - generic [ref=f2e1277]:
                      - generic [ref=f2e1280]: "Téléphone :"
                      - generic [ref=f2e1281]: "+221700000002"
                    - generic [ref=f2e1282]:
                      - generic [ref=f2e1286]: "Email :"
                      - generic [ref=f2e1287]: client-bis@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1289] [cursor=pointer]
              - listitem [ref=f2e1294]:
                - generic [ref=f2e1295]:
                  - generic [ref=f2e1296]:
                    - paragraph [ref=f2e1297]: Awa Client
                    - generic [ref=f2e1298]: Client
                    - generic [ref=f2e1300]: Parrainage standard
                  - generic [ref=f2e1302]:
                    - generic [ref=f2e1303]:
                      - generic [ref=f2e1306]: "Téléphone :"
                      - generic [ref=f2e1307]: "+221700000001"
                    - generic [ref=f2e1308]:
                      - generic [ref=f2e1312]: "Email :"
                      - generic [ref=f2e1313]: client@test.eventvillage.local
                - button "Nommer ambassadeur" [ref=f2e1315] [cursor=pointer]
  - alert [ref=f2e1320]
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
      |                                                                                        ^ Error: contrôles responsive de adm-parrainage (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```