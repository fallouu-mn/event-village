# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-comptes — Comptes et administrateurs
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-comptes (clair)

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
                - heading "Comptes et administrateurs" [level=1] [ref=f5e168]
                - paragraph [ref=f5e169]: Créez un compte, donnez ses droits à un administrateur, suspendez ou supprimez un compte.
              - generic [ref=f5e170]:
                - button "Actualiser" [ref=f5e171] [cursor=pointer]
                - button "Créer un compte" [ref=f5e179] [cursor=pointer]
          - generic [ref=f5e185]:
            - searchbox "Rechercher un compte" [ref=f5e187]
            - group "Filtrer par rôle" [ref=f5e188]:
              - button "Tous" [pressed] [ref=f5e189] [cursor=pointer]:
                - generic [aria-hidden] [ref=f5e190]: ✓
                - text: Tous
              - button "Super-administrateur" [ref=f5e191] [cursor=pointer]
              - button "Administrateur" [ref=f5e192] [cursor=pointer]
              - button "Partenaire" [ref=f5e193] [cursor=pointer]
              - button "Contrôleur" [ref=f5e194] [cursor=pointer]
              - button "Client" [ref=f5e195] [cursor=pointer]
          - list "Comptes" [ref=f5e196]:
            - listitem [ref=f5e197]:
              - generic [ref=f5e198]:
                - generic [ref=f5e199]:
                  - paragraph [ref=f5e200]: Assane Badji
                  - generic [ref=f5e201]: Client
                  - generic [ref=f5e203]: Actif
                - generic [ref=f5e205]:
                  - generic [ref=f5e206]:
                    - generic [ref=f5e209]: "Téléphone :"
                    - generic [ref=f5e210]: "+221700000224"
                  - generic [ref=f5e211]:
                    - generic [ref=f5e215]: "Email :"
                    - generic [ref=f5e216]: assane.badji.24@demo.eventvillage.local
              - generic [ref=f5e217]:
                - button "Changer le rôle" [ref=f5e218] [cursor=pointer]
                - button "Suspendre" [ref=f5e233] [cursor=pointer]
                - button "Supprimer" [ref=f5e235] [cursor=pointer]
            - listitem [ref=f5e241]:
              - generic [ref=f5e242]:
                - generic [ref=f5e243]:
                  - paragraph [ref=f5e244]: Marième Niang
                  - generic [ref=f5e245]: Client
                  - generic [ref=f5e247]: Actif
                - generic [ref=f5e249]:
                  - generic [ref=f5e250]:
                    - generic [ref=f5e253]: "Téléphone :"
                    - generic [ref=f5e254]: "+221700000223"
                  - generic [ref=f5e255]:
                    - generic [ref=f5e259]: "Email :"
                    - generic [ref=f5e260]: marieme.niang.23@demo.eventvillage.local
              - generic [ref=f5e261]:
                - button "Changer le rôle" [ref=f5e262] [cursor=pointer]
                - button "Suspendre" [ref=f5e277] [cursor=pointer]
                - button "Supprimer" [ref=f5e279] [cursor=pointer]
            - listitem [ref=f5e285]:
              - generic [ref=f5e286]:
                - generic [ref=f5e287]:
                  - paragraph [ref=f5e288]: Omar Gaye
                  - generic [ref=f5e289]: Client
                  - generic [ref=f5e291]: Actif
                - generic [ref=f5e293]:
                  - generic [ref=f5e294]:
                    - generic [ref=f5e297]: "Téléphone :"
                    - generic [ref=f5e298]: "+221700000222"
                  - generic [ref=f5e299]:
                    - generic [ref=f5e303]: "Email :"
                    - generic [ref=f5e304]: omar.gaye.22@demo.eventvillage.local
              - generic [ref=f5e305]:
                - button "Changer le rôle" [ref=f5e306] [cursor=pointer]
                - button "Suspendre" [ref=f5e321] [cursor=pointer]
                - button "Supprimer" [ref=f5e323] [cursor=pointer]
            - listitem [ref=f5e329]:
              - generic [ref=f5e330]:
                - generic [ref=f5e331]:
                  - paragraph [ref=f5e332]: Dieynaba Tall
                  - generic [ref=f5e333]: Client
                  - generic [ref=f5e335]: Actif
                - generic [ref=f5e337]:
                  - generic [ref=f5e338]:
                    - generic [ref=f5e341]: "Téléphone :"
                    - generic [ref=f5e342]: "+221700000221"
                  - generic [ref=f5e343]:
                    - generic [ref=f5e347]: "Email :"
                    - generic [ref=f5e348]: dieynaba.tall.21@demo.eventvillage.local
              - generic [ref=f5e349]:
                - button "Changer le rôle" [ref=f5e350] [cursor=pointer]
                - button "Suspendre" [ref=f5e365] [cursor=pointer]
                - button "Supprimer" [ref=f5e367] [cursor=pointer]
            - listitem [ref=f5e373]:
              - generic [ref=f5e374]:
                - generic [ref=f5e375]:
                  - paragraph [ref=f5e376]: Saliou Touré
                  - generic [ref=f5e377]: Client
                  - generic [ref=f5e379]: Actif
                - generic [ref=f5e381]:
                  - generic [ref=f5e382]:
                    - generic [ref=f5e385]: "Téléphone :"
                    - generic [ref=f5e386]: "+221700000220"
                  - generic [ref=f5e387]:
                    - generic [ref=f5e391]: "Email :"
                    - generic [ref=f5e392]: saliou.toure.20@demo.eventvillage.local
              - generic [ref=f5e393]:
                - button "Changer le rôle" [ref=f5e394] [cursor=pointer]
                - button "Suspendre" [ref=f5e409] [cursor=pointer]
                - button "Supprimer" [ref=f5e411] [cursor=pointer]
            - listitem [ref=f5e417]:
              - generic [ref=f5e418]:
                - generic [ref=f5e419]:
                  - paragraph [ref=f5e420]: Bineta Kane
                  - generic [ref=f5e421]: Client
                  - generic [ref=f5e423]: Actif
                - generic [ref=f5e425]:
                  - generic [ref=f5e426]:
                    - generic [ref=f5e429]: "Téléphone :"
                    - generic [ref=f5e430]: "+221700000219"
                  - generic [ref=f5e431]:
                    - generic [ref=f5e435]: "Email :"
                    - generic [ref=f5e436]: bineta.kane.19@demo.eventvillage.local
              - generic [ref=f5e437]:
                - button "Changer le rôle" [ref=f5e438] [cursor=pointer]
                - button "Suspendre" [ref=f5e453] [cursor=pointer]
                - button "Supprimer" [ref=f5e455] [cursor=pointer]
            - listitem [ref=f5e461]:
              - generic [ref=f5e462]:
                - generic [ref=f5e463]:
                  - paragraph [ref=f5e464]: Modou Mboup
                  - generic [ref=f5e465]: Client
                  - generic [ref=f5e467]: Actif
                - generic [ref=f5e469]:
                  - generic [ref=f5e470]:
                    - generic [ref=f5e473]: "Téléphone :"
                    - generic [ref=f5e474]: "+221700000218"
                  - generic [ref=f5e475]:
                    - generic [ref=f5e479]: "Email :"
                    - generic [ref=f5e480]: modou.mboup.18@demo.eventvillage.local
              - generic [ref=f5e481]:
                - button "Changer le rôle" [ref=f5e482] [cursor=pointer]
                - button "Suspendre" [ref=f5e497] [cursor=pointer]
                - button "Supprimer" [ref=f5e499] [cursor=pointer]
            - listitem [ref=f5e505]:
              - generic [ref=f5e506]:
                - generic [ref=f5e507]:
                  - paragraph [ref=f5e508]: Yacine Dieng
                  - generic [ref=f5e509]: Client
                  - generic [ref=f5e511]: Actif
                - generic [ref=f5e513]:
                  - generic [ref=f5e514]:
                    - generic [ref=f5e517]: "Téléphone :"
                    - generic [ref=f5e518]: "+221700000217"
                  - generic [ref=f5e519]:
                    - generic [ref=f5e523]: "Email :"
                    - generic [ref=f5e524]: yacine.dieng.17@demo.eventvillage.local
              - generic [ref=f5e525]:
                - button "Changer le rôle" [ref=f5e526] [cursor=pointer]
                - button "Suspendre" [ref=f5e541] [cursor=pointer]
                - button "Supprimer" [ref=f5e543] [cursor=pointer]
            - listitem [ref=f5e549]:
              - generic [ref=f5e550]:
                - generic [ref=f5e551]:
                  - paragraph [ref=f5e552]: Ibou Mbengue
                  - generic [ref=f5e553]: Client
                  - generic [ref=f5e555]: Actif
                - generic [ref=f5e557]:
                  - generic [ref=f5e558]:
                    - generic [ref=f5e561]: "Téléphone :"
                    - generic [ref=f5e562]: "+221700000216"
                  - generic [ref=f5e563]:
                    - generic [ref=f5e567]: "Email :"
                    - generic [ref=f5e568]: ibou.mbengue.16@demo.eventvillage.local
              - generic [ref=f5e569]:
                - button "Changer le rôle" [ref=f5e570] [cursor=pointer]
                - button "Suspendre" [ref=f5e585] [cursor=pointer]
                - button "Supprimer" [ref=f5e587] [cursor=pointer]
            - listitem [ref=f5e593]:
              - generic [ref=f5e594]:
                - generic [ref=f5e595]:
                  - paragraph [ref=f5e596]: Astou Sow
                  - generic [ref=f5e597]: Client
                  - generic [ref=f5e599]: Actif
                - generic [ref=f5e601]:
                  - generic [ref=f5e602]:
                    - generic [ref=f5e605]: "Téléphone :"
                    - generic [ref=f5e606]: "+221700000215"
                  - generic [ref=f5e607]:
                    - generic [ref=f5e611]: "Email :"
                    - generic [ref=f5e612]: astou.sow.15@demo.eventvillage.local
              - generic [ref=f5e613]:
                - button "Changer le rôle" [ref=f5e614] [cursor=pointer]
                - button "Suspendre" [ref=f5e629] [cursor=pointer]
                - button "Supprimer" [ref=f5e631] [cursor=pointer]
            - listitem [ref=f5e637]:
              - generic [ref=f5e638]:
                - generic [ref=f5e639]:
                  - paragraph [ref=f5e640]: Mamadou Kébé
                  - generic [ref=f5e641]: Client
                  - generic [ref=f5e643]: Actif
                - generic [ref=f5e645]:
                  - generic [ref=f5e646]:
                    - generic [ref=f5e649]: "Téléphone :"
                    - generic [ref=f5e650]: "+221700000214"
                  - generic [ref=f5e651]:
                    - generic [ref=f5e655]: "Email :"
                    - generic [ref=f5e656]: mamadou.kebe.14@demo.eventvillage.local
              - generic [ref=f5e657]:
                - button "Changer le rôle" [ref=f5e658] [cursor=pointer]
                - button "Suspendre" [ref=f5e673] [cursor=pointer]
                - button "Supprimer" [ref=f5e675] [cursor=pointer]
            - listitem [ref=f5e681]:
              - generic [ref=f5e682]:
                - generic [ref=f5e683]:
                  - paragraph [ref=f5e684]: Fatoumata Camara
                  - generic [ref=f5e685]: Client
                  - generic [ref=f5e687]: Actif
                - generic [ref=f5e689]:
                  - generic [ref=f5e690]:
                    - generic [ref=f5e693]: "Téléphone :"
                    - generic [ref=f5e694]: "+221700000213"
                  - generic [ref=f5e695]:
                    - generic [ref=f5e699]: "Email :"
                    - generic [ref=f5e700]: fatoumata.camara.13@demo.eventvillage.local
              - generic [ref=f5e701]:
                - button "Changer le rôle" [ref=f5e702] [cursor=pointer]
                - button "Suspendre" [ref=f5e717] [cursor=pointer]
                - button "Supprimer" [ref=f5e719] [cursor=pointer]
            - listitem [ref=f5e725]:
              - generic [ref=f5e726]:
                - generic [ref=f5e727]:
                  - paragraph [ref=f5e728]: Adama Diouf
                  - generic [ref=f5e729]: Client
                  - generic [ref=f5e731]: Actif
                - generic [ref=f5e733]:
                  - generic [ref=f5e734]:
                    - generic [ref=f5e737]: "Téléphone :"
                    - generic [ref=f5e738]: "+221700000212"
                  - generic [ref=f5e739]:
                    - generic [ref=f5e743]: "Email :"
                    - generic [ref=f5e744]: adama.diouf.12@demo.eventvillage.local
              - generic [ref=f5e745]:
                - button "Changer le rôle" [ref=f5e746] [cursor=pointer]
                - button "Suspendre" [ref=f5e761] [cursor=pointer]
                - button "Supprimer" [ref=f5e763] [cursor=pointer]
            - listitem [ref=f5e769]:
              - generic [ref=f5e770]:
                - generic [ref=f5e771]:
                  - paragraph [ref=f5e772]: Rokhaya Ndao
                  - generic [ref=f5e773]: Client
                  - generic [ref=f5e775]: Actif
                - generic [ref=f5e777]:
                  - generic [ref=f5e778]:
                    - generic [ref=f5e781]: "Téléphone :"
                    - generic [ref=f5e782]: "+221700000211"
                  - generic [ref=f5e783]:
                    - generic [ref=f5e787]: "Email :"
                    - generic [ref=f5e788]: rokhaya.ndao.11@demo.eventvillage.local
              - generic [ref=f5e789]:
                - button "Changer le rôle" [ref=f5e790] [cursor=pointer]
                - button "Suspendre" [ref=f5e805] [cursor=pointer]
                - button "Supprimer" [ref=f5e807] [cursor=pointer]
            - listitem [ref=f5e813]:
              - generic [ref=f5e814]:
                - generic [ref=f5e815]:
                  - paragraph [ref=f5e816]: Pape Lo
                  - generic [ref=f5e817]: Client
                  - generic [ref=f5e819]: Actif
                - generic [ref=f5e821]:
                  - generic [ref=f5e822]:
                    - generic [ref=f5e825]: "Téléphone :"
                    - generic [ref=f5e826]: "+221700000210"
                  - generic [ref=f5e827]:
                    - generic [ref=f5e831]: "Email :"
                    - generic [ref=f5e832]: pape.lo.10@demo.eventvillage.local
              - generic [ref=f5e833]:
                - button "Changer le rôle" [ref=f5e834] [cursor=pointer]
                - button "Suspendre" [ref=f5e849] [cursor=pointer]
                - button "Supprimer" [ref=f5e851] [cursor=pointer]
            - listitem [ref=f5e857]:
              - generic [ref=f5e858]:
                - generic [ref=f5e859]:
                  - paragraph [ref=f5e860]: Coumba Ka
                  - generic [ref=f5e861]: Client
                  - generic [ref=f5e863]: Actif
                - generic [ref=f5e865]:
                  - generic [ref=f5e866]:
                    - generic [ref=f5e869]: "Téléphone :"
                    - generic [ref=f5e870]: "+221700000209"
                  - generic [ref=f5e871]:
                    - generic [ref=f5e875]: "Email :"
                    - generic [ref=f5e876]: coumba.ka.09@demo.eventvillage.local
              - generic [ref=f5e877]:
                - button "Changer le rôle" [ref=f5e878] [cursor=pointer]
                - button "Suspendre" [ref=f5e893] [cursor=pointer]
                - button "Supprimer" [ref=f5e895] [cursor=pointer]
            - listitem [ref=f5e901]:
              - generic [ref=f5e902]:
                - generic [ref=f5e903]:
                  - paragraph [ref=f5e904]: Alioune Fall
                  - generic [ref=f5e905]: Client
                  - generic [ref=f5e907]: Actif
                - generic [ref=f5e909]:
                  - generic [ref=f5e910]:
                    - generic [ref=f5e913]: "Téléphone :"
                    - generic [ref=f5e914]: "+221700000208"
                  - generic [ref=f5e915]:
                    - generic [ref=f5e919]: "Email :"
                    - generic [ref=f5e920]: alioune.fall.08@demo.eventvillage.local
              - generic [ref=f5e921]:
                - button "Changer le rôle" [ref=f5e922] [cursor=pointer]
                - button "Suspendre" [ref=f5e937] [cursor=pointer]
                - button "Supprimer" [ref=f5e939] [cursor=pointer]
            - listitem [ref=f5e945]:
              - generic [ref=f5e946]:
                - generic [ref=f5e947]:
                  - paragraph [ref=f5e948]: Mame Ndour
                  - generic [ref=f5e949]: Client
                  - generic [ref=f5e951]: Actif
                - generic [ref=f5e953]:
                  - generic [ref=f5e954]:
                    - generic [ref=f5e957]: "Téléphone :"
                    - generic [ref=f5e958]: "+221700000207"
                  - generic [ref=f5e959]:
                    - generic [ref=f5e963]: "Email :"
                    - generic [ref=f5e964]: mame.ndour.07@demo.eventvillage.local
              - generic [ref=f5e965]:
                - button "Changer le rôle" [ref=f5e966] [cursor=pointer]
                - button "Suspendre" [ref=f5e981] [cursor=pointer]
                - button "Supprimer" [ref=f5e983] [cursor=pointer]
            - listitem [ref=f5e989]:
              - generic [ref=f5e990]:
                - generic [ref=f5e991]:
                  - paragraph [ref=f5e992]: Babacar Diagne
                  - generic [ref=f5e993]: Client
                  - generic [ref=f5e995]: Actif
                - generic [ref=f5e997]:
                  - generic [ref=f5e998]:
                    - generic [ref=f5e1001]: "Téléphone :"
                    - generic [ref=f5e1002]: "+221700000206"
                  - generic [ref=f5e1003]:
                    - generic [ref=f5e1007]: "Email :"
                    - generic [ref=f5e1008]: babacar.diagne.06@demo.eventvillage.local
              - generic [ref=f5e1009]:
                - button "Changer le rôle" [ref=f5e1010] [cursor=pointer]
                - button "Suspendre" [ref=f5e1025] [cursor=pointer]
                - button "Supprimer" [ref=f5e1027] [cursor=pointer]
            - listitem [ref=f5e1033]:
              - generic [ref=f5e1034]:
                - generic [ref=f5e1035]:
                  - paragraph [ref=f5e1036]: Ndeye Thiam
                  - generic [ref=f5e1037]: Client
                  - generic [ref=f5e1039]: Actif
                - generic [ref=f5e1041]:
                  - generic [ref=f5e1042]:
                    - generic [ref=f5e1045]: "Téléphone :"
                    - generic [ref=f5e1046]: "+221700000205"
                  - generic [ref=f5e1047]:
                    - generic [ref=f5e1051]: "Email :"
                    - generic [ref=f5e1052]: ndeye.thiam.05@demo.eventvillage.local
              - generic [ref=f5e1053]:
                - button "Changer le rôle" [ref=f5e1054] [cursor=pointer]
                - button "Suspendre" [ref=f5e1069] [cursor=pointer]
                - button "Supprimer" [ref=f5e1071] [cursor=pointer]
            - listitem [ref=f5e1077]:
              - generic [ref=f5e1078]:
                - generic [ref=f5e1079]:
                  - paragraph [ref=f5e1080]: Cheikh Sarr
                  - generic [ref=f5e1081]: Client
                  - generic [ref=f5e1083]: Actif
                - generic [ref=f5e1085]:
                  - generic [ref=f5e1086]:
                    - generic [ref=f5e1089]: "Téléphone :"
                    - generic [ref=f5e1090]: "+221700000204"
                  - generic [ref=f5e1091]:
                    - generic [ref=f5e1095]: "Email :"
                    - generic [ref=f5e1096]: cheikh.sarr.04@demo.eventvillage.local
              - generic [ref=f5e1097]:
                - button "Changer le rôle" [ref=f5e1098] [cursor=pointer]
                - button "Suspendre" [ref=f5e1113] [cursor=pointer]
                - button "Supprimer" [ref=f5e1115] [cursor=pointer]
            - listitem [ref=f5e1121]:
              - generic [ref=f5e1122]:
                - generic [ref=f5e1123]:
                  - paragraph [ref=f5e1124]: Aminata Sène
                  - generic [ref=f5e1125]: Client
                  - generic [ref=f5e1127]: Actif
                - generic [ref=f5e1129]:
                  - generic [ref=f5e1130]:
                    - generic [ref=f5e1133]: "Téléphone :"
                    - generic [ref=f5e1134]: "+221700000203"
                  - generic [ref=f5e1135]:
                    - generic [ref=f5e1139]: "Email :"
                    - generic [ref=f5e1140]: aminata.sene.03@demo.eventvillage.local
              - generic [ref=f5e1141]:
                - button "Changer le rôle" [ref=f5e1142] [cursor=pointer]
                - button "Suspendre" [ref=f5e1157] [cursor=pointer]
                - button "Supprimer" [ref=f5e1159] [cursor=pointer]
            - listitem [ref=f5e1165]:
              - generic [ref=f5e1166]:
                - generic [ref=f5e1167]:
                  - paragraph [ref=f5e1168]: Moussa Sy
                  - generic [ref=f5e1169]: Client
                  - generic [ref=f5e1171]: Actif
                - generic [ref=f5e1173]:
                  - generic [ref=f5e1174]:
                    - generic [ref=f5e1177]: "Téléphone :"
                    - generic [ref=f5e1178]: "+221700000202"
                  - generic [ref=f5e1179]:
                    - generic [ref=f5e1183]: "Email :"
                    - generic [ref=f5e1184]: moussa.sy.02@demo.eventvillage.local
              - generic [ref=f5e1185]:
                - button "Changer le rôle" [ref=f5e1186] [cursor=pointer]
                - button "Suspendre" [ref=f5e1201] [cursor=pointer]
                - button "Supprimer" [ref=f5e1203] [cursor=pointer]
            - listitem [ref=f5e1209]:
              - generic [ref=f5e1210]:
                - generic [ref=f5e1211]:
                  - paragraph [ref=f5e1212]: Awa Diop
                  - generic [ref=f5e1213]: Client
                  - generic [ref=f5e1215]: Actif
                - generic [ref=f5e1217]:
                  - generic [ref=f5e1218]:
                    - generic [ref=f5e1221]: "Téléphone :"
                    - generic [ref=f5e1222]: "+221700000201"
                  - generic [ref=f5e1223]:
                    - generic [ref=f5e1227]: "Email :"
                    - generic [ref=f5e1228]: awa.diop.01@demo.eventvillage.local
              - generic [ref=f5e1229]:
                - button "Changer le rôle" [ref=f5e1230] [cursor=pointer]
                - button "Suspendre" [ref=f5e1245] [cursor=pointer]
                - button "Supprimer" [ref=f5e1247] [cursor=pointer]
            - listitem [ref=f5e1253]:
              - generic [ref=f5e1254]:
                - generic [ref=f5e1255]:
                  - paragraph [ref=f5e1256]: Mamadou Sall
                  - generic [ref=f5e1257]: Contrôleur
                  - generic [ref=f5e1259]: Actif
                - generic [ref=f5e1261]:
                  - generic [ref=f5e1262]:
                    - generic [ref=f5e1265]: "Téléphone :"
                    - generic [ref=f5e1266]: "+221700000110"
                  - generic [ref=f5e1267]:
                    - generic [ref=f5e1271]: "Email :"
                    - generic [ref=f5e1272]: mamadou.sall@demo.eventvillage.local
              - generic [ref=f5e1273]:
                - button "Changer le rôle" [ref=f5e1274] [cursor=pointer]
                - button "Suspendre" [ref=f5e1289] [cursor=pointer]
                - button "Supprimer" [ref=f5e1291] [cursor=pointer]
            - listitem [ref=f5e1297]:
              - generic [ref=f5e1298]:
                - generic [ref=f5e1299]:
                  - paragraph [ref=f5e1300]: Ndèye Gning
                  - generic [ref=f5e1301]: Partenaire
                  - generic [ref=f5e1303]: Actif
                - generic [ref=f5e1305]:
                  - generic [ref=f5e1306]:
                    - generic [ref=f5e1309]: "Téléphone :"
                    - generic [ref=f5e1310]: "+221700000109"
                  - generic [ref=f5e1311]:
                    - generic [ref=f5e1315]: "Email :"
                    - generic [ref=f5e1316]: ndeye.gning@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f5e1318] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=50d0eb56-f5a1-4afa-99c8-091c7a9d21e4
            - listitem [ref=f5e1320]:
              - generic [ref=f5e1321]:
                - generic [ref=f5e1322]:
                  - paragraph [ref=f5e1323]: Lamine Cissé
                  - generic [ref=f5e1324]: Contrôleur
                  - generic [ref=f5e1326]: Actif
                - generic [ref=f5e1328]:
                  - generic [ref=f5e1329]:
                    - generic [ref=f5e1332]: "Téléphone :"
                    - generic [ref=f5e1333]: "+221700000108"
                  - generic [ref=f5e1334]:
                    - generic [ref=f5e1338]: "Email :"
                    - generic [ref=f5e1339]: lamine.cisse@demo.eventvillage.local
              - generic [ref=f5e1340]:
                - button "Changer le rôle" [ref=f5e1341] [cursor=pointer]
                - button "Suspendre" [ref=f5e1356] [cursor=pointer]
                - button "Supprimer" [ref=f5e1358] [cursor=pointer]
            - listitem [ref=f5e1364]:
              - generic [ref=f5e1365]:
                - generic [ref=f5e1366]:
                  - paragraph [ref=f5e1367]: Seynabou Ba
                  - generic [ref=f5e1368]: Contrôleur
                  - generic [ref=f5e1370]: Actif
                - generic [ref=f5e1372]:
                  - generic [ref=f5e1373]:
                    - generic [ref=f5e1376]: "Téléphone :"
                    - generic [ref=f5e1377]: "+221700000107"
                  - generic [ref=f5e1378]:
                    - generic [ref=f5e1382]: "Email :"
                    - generic [ref=f5e1383]: seynabou.ba@demo.eventvillage.local
              - generic [ref=f5e1384]:
                - button "Changer le rôle" [ref=f5e1385] [cursor=pointer]
                - button "Suspendre" [ref=f5e1400] [cursor=pointer]
                - button "Supprimer" [ref=f5e1402] [cursor=pointer]
            - listitem [ref=f5e1408]:
              - generic [ref=f5e1409]:
                - generic [ref=f5e1410]:
                  - paragraph [ref=f5e1411]: Ibrahima Gueye
                  - generic [ref=f5e1412]: Contrôleur
                  - generic [ref=f5e1414]: Actif
                - generic [ref=f5e1416]:
                  - generic [ref=f5e1417]:
                    - generic [ref=f5e1420]: "Téléphone :"
                    - generic [ref=f5e1421]: "+221700000106"
                  - generic [ref=f5e1422]:
                    - generic [ref=f5e1426]: "Email :"
                    - generic [ref=f5e1427]: ibrahima.gueye@demo.eventvillage.local
              - generic [ref=f5e1428]:
                - button "Changer le rôle" [ref=f5e1429] [cursor=pointer]
                - button "Suspendre" [ref=f5e1444] [cursor=pointer]
                - button "Supprimer" [ref=f5e1446] [cursor=pointer]
            - listitem [ref=f5e1452]:
              - generic [ref=f5e1453]:
                - generic [ref=f5e1454]:
                  - paragraph [ref=f5e1455]: Fatou Mbaye
                  - generic [ref=f5e1456]: Client
                  - generic [ref=f5e1458]: Actif
                - generic [ref=f5e1460]:
                  - generic [ref=f5e1461]:
                    - generic [ref=f5e1464]: "Téléphone :"
                    - generic [ref=f5e1465]: "+221700000105"
                  - generic [ref=f5e1466]:
                    - generic [ref=f5e1470]: "Email :"
                    - generic [ref=f5e1471]: fatou.mbaye@demo.eventvillage.local
              - generic [ref=f5e1472]:
                - button "Changer le rôle" [ref=f5e1473] [cursor=pointer]
                - button "Suspendre" [ref=f5e1488] [cursor=pointer]
                - button "Supprimer" [ref=f5e1490] [cursor=pointer]
            - listitem [ref=f5e1496]:
              - generic [ref=f5e1497]:
                - generic [ref=f5e1498]:
                  - paragraph [ref=f5e1499]: Aïda Diallo
                  - generic [ref=f5e1500]: Administrateur
                  - generic [ref=f5e1502]: Actif
                - generic [ref=f5e1504]:
                  - generic [ref=f5e1505]:
                    - generic [ref=f5e1508]: "Téléphone :"
                    - generic [ref=f5e1509]: "+221700000104"
                  - generic [ref=f5e1510]:
                    - generic [ref=f5e1514]: "Email :"
                    - generic [ref=f5e1515]: aida.diallo@demo.eventvillage.local
              - generic [ref=f5e1516]:
                - button "Permissions" [ref=f5e1517] [cursor=pointer]
                - button "Changer le rôle" [ref=f5e1524] [cursor=pointer]
                - button "Changer le numéro" [ref=f5e1539] [cursor=pointer]
                - button "Suspendre" [ref=f5e1541] [cursor=pointer]
                - button "Supprimer" [ref=f5e1543] [cursor=pointer]
            - listitem [ref=f5e1549]:
              - generic [ref=f5e1550]:
                - generic [ref=f5e1551]:
                  - paragraph [ref=f5e1552]: Khady Sarr
                  - generic [ref=f5e1553]: Partenaire
                  - generic [ref=f5e1555]: Actif
                - generic [ref=f5e1557]:
                  - generic [ref=f5e1558]:
                    - generic [ref=f5e1561]: "Téléphone :"
                    - generic [ref=f5e1562]: "+221700000103"
                  - generic [ref=f5e1563]:
                    - generic [ref=f5e1567]: "Email :"
                    - generic [ref=f5e1568]: khady.sarr@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f5e1570] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=d80b3ea6-6e9a-4b2f-b4b6-7a01bba724f1
            - listitem [ref=f5e1572]:
              - generic [ref=f5e1573]:
                - generic [ref=f5e1574]:
                  - paragraph [ref=f5e1575]: Ousmane Faye
                  - generic [ref=f5e1576]: Partenaire
                  - generic [ref=f5e1578]: Actif
                - generic [ref=f5e1580]:
                  - generic [ref=f5e1581]:
                    - generic [ref=f5e1584]: "Téléphone :"
                    - generic [ref=f5e1585]: "+221700000102"
                  - generic [ref=f5e1586]:
                    - generic [ref=f5e1590]: "Email :"
                    - generic [ref=f5e1591]: ousmane.faye@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f5e1593] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=84b02701-f6ca-4fce-99a2-195c0c071290
            - listitem [ref=f5e1595]:
              - generic [ref=f5e1596]:
                - generic [ref=f5e1597]:
                  - paragraph [ref=f5e1598]: Mariama Ndiaye
                  - generic [ref=f5e1599]: Partenaire
                  - generic [ref=f5e1601]: Actif
                - generic [ref=f5e1603]:
                  - generic [ref=f5e1604]:
                    - generic [ref=f5e1607]: "Téléphone :"
                    - generic [ref=f5e1608]: "+221700000101"
                  - generic [ref=f5e1609]:
                    - generic [ref=f5e1613]: "Email :"
                    - generic [ref=f5e1614]: mariama.ndiaye@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f5e1616] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=a9cfd61c-1494-42df-96bc-02fb2894d44f
            - listitem [ref=f5e1618]:
              - generic [ref=f5e1619]:
                - generic [ref=f5e1620]:
                  - paragraph [ref=f5e1621]: Fatou Suspendue
                  - generic [ref=f5e1622]: Client
                  - generic [ref=f5e1624]: Suspendu
                - generic [ref=f5e1626]:
                  - generic [ref=f5e1627]:
                    - generic [ref=f5e1630]: "Téléphone :"
                    - generic [ref=f5e1631]: "+221700000008"
                  - generic [ref=f5e1632]:
                    - generic [ref=f5e1636]: "Email :"
                    - generic [ref=f5e1637]: suspendu@test.eventvillage.local
              - generic [ref=f5e1638]:
                - button "Changer le rôle" [ref=f5e1639] [cursor=pointer]
                - button "Réactiver" [ref=f5e1654] [cursor=pointer]
                - button "Supprimer" [ref=f5e1656] [cursor=pointer]
            - listitem [ref=f5e1662]:
              - generic [ref=f5e1663]:
                - generic [ref=f5e1664]:
                  - paragraph [ref=f5e1665]: Elhadji SuperAdmin
                  - generic [ref=f5e1666]: Super-administrateur
                  - generic [ref=f5e1668]: Actif
                - generic [ref=f5e1670]:
                  - generic [ref=f5e1671]:
                    - generic [ref=f5e1674]: "Téléphone :"
                    - generic [ref=f5e1675]: "+221700000007"
                  - generic [ref=f5e1676]:
                    - generic [ref=f5e1680]: "Email :"
                    - generic [ref=f5e1681]: superadmin@test.eventvillage.local
              - button "Quitter le rôle de super-administrateur" [ref=f5e1683] [cursor=pointer]
            - listitem [ref=f5e1698]:
              - generic [ref=f5e1699]:
                - generic [ref=f5e1700]:
                  - paragraph [ref=f5e1701]: Dior Admin
                  - generic [ref=f5e1702]: Administrateur
                  - generic [ref=f5e1704]: Actif
                - generic [ref=f5e1706]:
                  - generic [ref=f5e1707]:
                    - generic [ref=f5e1710]: "Téléphone :"
                    - generic [ref=f5e1711]: "+221700000006"
                  - generic [ref=f5e1712]:
                    - generic [ref=f5e1716]: "Email :"
                    - generic [ref=f5e1717]: admin@test.eventvillage.local
              - generic [ref=f5e1718]:
                - button "Permissions" [ref=f5e1719] [cursor=pointer]
                - button "Changer le rôle" [ref=f5e1726] [cursor=pointer]
                - button "Changer le numéro" [ref=f5e1741] [cursor=pointer]
                - button "Suspendre" [ref=f5e1743] [cursor=pointer]
                - button "Supprimer" [ref=f5e1745] [cursor=pointer]
            - listitem [ref=f5e1751]:
              - generic [ref=f5e1752]:
                - generic [ref=f5e1753]:
                  - paragraph [ref=f5e1754]: Cheikh ControleurA
                  - generic [ref=f5e1755]: Contrôleur
                  - generic [ref=f5e1757]: Actif
                - generic [ref=f5e1759]:
                  - generic [ref=f5e1760]:
                    - generic [ref=f5e1763]: "Téléphone :"
                    - generic [ref=f5e1764]: "+221700000005"
                  - generic [ref=f5e1765]:
                    - generic [ref=f5e1769]: "Email :"
                    - generic [ref=f5e1770]: controller-a@test.eventvillage.local
              - generic [ref=f5e1771]:
                - button "Changer le rôle" [ref=f5e1772] [cursor=pointer]
                - button "Suspendre" [ref=f5e1787] [cursor=pointer]
                - button "Supprimer" [ref=f5e1789] [cursor=pointer]
            - listitem [ref=f5e1795]:
              - generic [ref=f5e1796]:
                - generic [ref=f5e1797]:
                  - paragraph [ref=f5e1798]: Bassirou OrgaB
                  - generic [ref=f5e1799]: Partenaire
                  - generic [ref=f5e1801]: Actif
                - generic [ref=f5e1803]:
                  - generic [ref=f5e1804]:
                    - generic [ref=f5e1807]: "Téléphone :"
                    - generic [ref=f5e1808]: "+221700000004"
                  - generic [ref=f5e1809]:
                    - generic [ref=f5e1813]: "Email :"
                    - generic [ref=f5e1814]: partner-b@test.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f5e1816] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=e3e142d7-edd6-449a-8f41-eef9cc301e4a
            - listitem [ref=f5e1818]:
              - generic [ref=f5e1819]:
                - generic [ref=f5e1820]:
                  - paragraph [ref=f5e1821]: Aïssatou OrgaA
                  - generic [ref=f5e1822]: Partenaire
                  - generic [ref=f5e1824]: Actif
                - generic [ref=f5e1826]:
                  - generic [ref=f5e1827]:
                    - generic [ref=f5e1830]: "Téléphone :"
                    - generic [ref=f5e1831]: "+221700000003"
                  - generic [ref=f5e1832]:
                    - generic [ref=f5e1836]: "Email :"
                    - generic [ref=f5e1837]: partner-a@test.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f5e1839] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=666f30d9-3b7f-4ad5-a39e-ae2b26d2a2d1
            - listitem [ref=f5e1841]:
              - generic [ref=f5e1842]:
                - generic [ref=f5e1843]:
                  - paragraph [ref=f5e1844]: Birame ClientBis
                  - generic [ref=f5e1845]: Client
                  - generic [ref=f5e1847]: Actif
                - generic [ref=f5e1849]:
                  - generic [ref=f5e1850]:
                    - generic [ref=f5e1853]: "Téléphone :"
                    - generic [ref=f5e1854]: "+221700000002"
                  - generic [ref=f5e1855]:
                    - generic [ref=f5e1859]: "Email :"
                    - generic [ref=f5e1860]: client-bis@test.eventvillage.local
              - generic [ref=f5e1861]:
                - button "Changer le rôle" [ref=f5e1862] [cursor=pointer]
                - button "Suspendre" [ref=f5e1877] [cursor=pointer]
                - button "Supprimer" [ref=f5e1879] [cursor=pointer]
            - listitem [ref=f5e1885]:
              - generic [ref=f5e1886]:
                - generic [ref=f5e1887]:
                  - paragraph [ref=f5e1888]: Awa Client
                  - generic [ref=f5e1889]: Client
                  - generic [ref=f5e1891]: Actif
                - generic [ref=f5e1893]:
                  - generic [ref=f5e1894]:
                    - generic [ref=f5e1897]: "Téléphone :"
                    - generic [ref=f5e1898]: "+221700000001"
                  - generic [ref=f5e1899]:
                    - generic [ref=f5e1903]: "Email :"
                    - generic [ref=f5e1904]: client@test.eventvillage.local
              - generic [ref=f5e1905]:
                - button "Changer le rôle" [ref=f5e1906] [cursor=pointer]
                - button "Suspendre" [ref=f5e1921] [cursor=pointer]
                - button "Supprimer" [ref=f5e1923] [cursor=pointer]
  - alert [ref=f5e1929]
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
      |                                                                                        ^ Error: contrôles responsive de adm-comptes (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```