# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-comptes — Comptes et administrateurs
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-comptes (sombre)

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
                - heading "Comptes et administrateurs" [level=1] [ref=f2e168]
                - paragraph [ref=f2e169]: Créez un compte, donnez ses droits à un administrateur, suspendez ou supprimez un compte.
              - generic [ref=f2e170]:
                - button "Actualiser" [ref=f2e171] [cursor=pointer]
                - button "Créer un compte" [ref=f2e179] [cursor=pointer]
          - generic [ref=f2e185]:
            - searchbox "Rechercher un compte" [ref=f2e187]
            - group "Filtrer par rôle" [ref=f2e188]:
              - button "Tous" [pressed] [ref=f2e189] [cursor=pointer]:
                - generic [aria-hidden] [ref=f2e190]: ✓
                - text: Tous
              - button "Super-administrateur" [ref=f2e191] [cursor=pointer]
              - button "Administrateur" [ref=f2e192] [cursor=pointer]
              - button "Partenaire" [ref=f2e193] [cursor=pointer]
              - button "Contrôleur" [ref=f2e194] [cursor=pointer]
              - button "Client" [ref=f2e195] [cursor=pointer]
          - list "Comptes" [ref=f2e196]:
            - listitem [ref=f2e197]:
              - generic [ref=f2e198]:
                - generic [ref=f2e199]:
                  - paragraph [ref=f2e200]: Assane Badji
                  - generic [ref=f2e201]: Client
                  - generic [ref=f2e203]: Actif
                - generic [ref=f2e205]:
                  - generic [ref=f2e206]:
                    - generic [ref=f2e209]: "Téléphone :"
                    - generic [ref=f2e210]: "+221700000224"
                  - generic [ref=f2e211]:
                    - generic [ref=f2e215]: "Email :"
                    - generic [ref=f2e216]: assane.badji.24@demo.eventvillage.local
              - generic [ref=f2e217]:
                - button "Changer le rôle" [ref=f2e218] [cursor=pointer]
                - button "Suspendre" [ref=f2e233] [cursor=pointer]
                - button "Supprimer" [ref=f2e235] [cursor=pointer]
            - listitem [ref=f2e241]:
              - generic [ref=f2e242]:
                - generic [ref=f2e243]:
                  - paragraph [ref=f2e244]: Marième Niang
                  - generic [ref=f2e245]: Client
                  - generic [ref=f2e247]: Actif
                - generic [ref=f2e249]:
                  - generic [ref=f2e250]:
                    - generic [ref=f2e253]: "Téléphone :"
                    - generic [ref=f2e254]: "+221700000223"
                  - generic [ref=f2e255]:
                    - generic [ref=f2e259]: "Email :"
                    - generic [ref=f2e260]: marieme.niang.23@demo.eventvillage.local
              - generic [ref=f2e261]:
                - button "Changer le rôle" [ref=f2e262] [cursor=pointer]
                - button "Suspendre" [ref=f2e277] [cursor=pointer]
                - button "Supprimer" [ref=f2e279] [cursor=pointer]
            - listitem [ref=f2e285]:
              - generic [ref=f2e286]:
                - generic [ref=f2e287]:
                  - paragraph [ref=f2e288]: Omar Gaye
                  - generic [ref=f2e289]: Client
                  - generic [ref=f2e291]: Actif
                - generic [ref=f2e293]:
                  - generic [ref=f2e294]:
                    - generic [ref=f2e297]: "Téléphone :"
                    - generic [ref=f2e298]: "+221700000222"
                  - generic [ref=f2e299]:
                    - generic [ref=f2e303]: "Email :"
                    - generic [ref=f2e304]: omar.gaye.22@demo.eventvillage.local
              - generic [ref=f2e305]:
                - button "Changer le rôle" [ref=f2e306] [cursor=pointer]
                - button "Suspendre" [ref=f2e321] [cursor=pointer]
                - button "Supprimer" [ref=f2e323] [cursor=pointer]
            - listitem [ref=f2e329]:
              - generic [ref=f2e330]:
                - generic [ref=f2e331]:
                  - paragraph [ref=f2e332]: Dieynaba Tall
                  - generic [ref=f2e333]: Client
                  - generic [ref=f2e335]: Actif
                - generic [ref=f2e337]:
                  - generic [ref=f2e338]:
                    - generic [ref=f2e341]: "Téléphone :"
                    - generic [ref=f2e342]: "+221700000221"
                  - generic [ref=f2e343]:
                    - generic [ref=f2e347]: "Email :"
                    - generic [ref=f2e348]: dieynaba.tall.21@demo.eventvillage.local
              - generic [ref=f2e349]:
                - button "Changer le rôle" [ref=f2e350] [cursor=pointer]
                - button "Suspendre" [ref=f2e365] [cursor=pointer]
                - button "Supprimer" [ref=f2e367] [cursor=pointer]
            - listitem [ref=f2e373]:
              - generic [ref=f2e374]:
                - generic [ref=f2e375]:
                  - paragraph [ref=f2e376]: Saliou Touré
                  - generic [ref=f2e377]: Client
                  - generic [ref=f2e379]: Actif
                - generic [ref=f2e381]:
                  - generic [ref=f2e382]:
                    - generic [ref=f2e385]: "Téléphone :"
                    - generic [ref=f2e386]: "+221700000220"
                  - generic [ref=f2e387]:
                    - generic [ref=f2e391]: "Email :"
                    - generic [ref=f2e392]: saliou.toure.20@demo.eventvillage.local
              - generic [ref=f2e393]:
                - button "Changer le rôle" [ref=f2e394] [cursor=pointer]
                - button "Suspendre" [ref=f2e409] [cursor=pointer]
                - button "Supprimer" [ref=f2e411] [cursor=pointer]
            - listitem [ref=f2e417]:
              - generic [ref=f2e418]:
                - generic [ref=f2e419]:
                  - paragraph [ref=f2e420]: Bineta Kane
                  - generic [ref=f2e421]: Client
                  - generic [ref=f2e423]: Actif
                - generic [ref=f2e425]:
                  - generic [ref=f2e426]:
                    - generic [ref=f2e429]: "Téléphone :"
                    - generic [ref=f2e430]: "+221700000219"
                  - generic [ref=f2e431]:
                    - generic [ref=f2e435]: "Email :"
                    - generic [ref=f2e436]: bineta.kane.19@demo.eventvillage.local
              - generic [ref=f2e437]:
                - button "Changer le rôle" [ref=f2e438] [cursor=pointer]
                - button "Suspendre" [ref=f2e453] [cursor=pointer]
                - button "Supprimer" [ref=f2e455] [cursor=pointer]
            - listitem [ref=f2e461]:
              - generic [ref=f2e462]:
                - generic [ref=f2e463]:
                  - paragraph [ref=f2e464]: Modou Mboup
                  - generic [ref=f2e465]: Client
                  - generic [ref=f2e467]: Actif
                - generic [ref=f2e469]:
                  - generic [ref=f2e470]:
                    - generic [ref=f2e473]: "Téléphone :"
                    - generic [ref=f2e474]: "+221700000218"
                  - generic [ref=f2e475]:
                    - generic [ref=f2e479]: "Email :"
                    - generic [ref=f2e480]: modou.mboup.18@demo.eventvillage.local
              - generic [ref=f2e481]:
                - button "Changer le rôle" [ref=f2e482] [cursor=pointer]
                - button "Suspendre" [ref=f2e497] [cursor=pointer]
                - button "Supprimer" [ref=f2e499] [cursor=pointer]
            - listitem [ref=f2e505]:
              - generic [ref=f2e506]:
                - generic [ref=f2e507]:
                  - paragraph [ref=f2e508]: Yacine Dieng
                  - generic [ref=f2e509]: Client
                  - generic [ref=f2e511]: Actif
                - generic [ref=f2e513]:
                  - generic [ref=f2e514]:
                    - generic [ref=f2e517]: "Téléphone :"
                    - generic [ref=f2e518]: "+221700000217"
                  - generic [ref=f2e519]:
                    - generic [ref=f2e523]: "Email :"
                    - generic [ref=f2e524]: yacine.dieng.17@demo.eventvillage.local
              - generic [ref=f2e525]:
                - button "Changer le rôle" [ref=f2e526] [cursor=pointer]
                - button "Suspendre" [ref=f2e541] [cursor=pointer]
                - button "Supprimer" [ref=f2e543] [cursor=pointer]
            - listitem [ref=f2e549]:
              - generic [ref=f2e550]:
                - generic [ref=f2e551]:
                  - paragraph [ref=f2e552]: Ibou Mbengue
                  - generic [ref=f2e553]: Client
                  - generic [ref=f2e555]: Actif
                - generic [ref=f2e557]:
                  - generic [ref=f2e558]:
                    - generic [ref=f2e561]: "Téléphone :"
                    - generic [ref=f2e562]: "+221700000216"
                  - generic [ref=f2e563]:
                    - generic [ref=f2e567]: "Email :"
                    - generic [ref=f2e568]: ibou.mbengue.16@demo.eventvillage.local
              - generic [ref=f2e569]:
                - button "Changer le rôle" [ref=f2e570] [cursor=pointer]
                - button "Suspendre" [ref=f2e585] [cursor=pointer]
                - button "Supprimer" [ref=f2e587] [cursor=pointer]
            - listitem [ref=f2e593]:
              - generic [ref=f2e594]:
                - generic [ref=f2e595]:
                  - paragraph [ref=f2e596]: Astou Sow
                  - generic [ref=f2e597]: Client
                  - generic [ref=f2e599]: Actif
                - generic [ref=f2e601]:
                  - generic [ref=f2e602]:
                    - generic [ref=f2e605]: "Téléphone :"
                    - generic [ref=f2e606]: "+221700000215"
                  - generic [ref=f2e607]:
                    - generic [ref=f2e611]: "Email :"
                    - generic [ref=f2e612]: astou.sow.15@demo.eventvillage.local
              - generic [ref=f2e613]:
                - button "Changer le rôle" [ref=f2e614] [cursor=pointer]
                - button "Suspendre" [ref=f2e629] [cursor=pointer]
                - button "Supprimer" [ref=f2e631] [cursor=pointer]
            - listitem [ref=f2e637]:
              - generic [ref=f2e638]:
                - generic [ref=f2e639]:
                  - paragraph [ref=f2e640]: Mamadou Kébé
                  - generic [ref=f2e641]: Client
                  - generic [ref=f2e643]: Actif
                - generic [ref=f2e645]:
                  - generic [ref=f2e646]:
                    - generic [ref=f2e649]: "Téléphone :"
                    - generic [ref=f2e650]: "+221700000214"
                  - generic [ref=f2e651]:
                    - generic [ref=f2e655]: "Email :"
                    - generic [ref=f2e656]: mamadou.kebe.14@demo.eventvillage.local
              - generic [ref=f2e657]:
                - button "Changer le rôle" [ref=f2e658] [cursor=pointer]
                - button "Suspendre" [ref=f2e673] [cursor=pointer]
                - button "Supprimer" [ref=f2e675] [cursor=pointer]
            - listitem [ref=f2e681]:
              - generic [ref=f2e682]:
                - generic [ref=f2e683]:
                  - paragraph [ref=f2e684]: Fatoumata Camara
                  - generic [ref=f2e685]: Client
                  - generic [ref=f2e687]: Actif
                - generic [ref=f2e689]:
                  - generic [ref=f2e690]:
                    - generic [ref=f2e693]: "Téléphone :"
                    - generic [ref=f2e694]: "+221700000213"
                  - generic [ref=f2e695]:
                    - generic [ref=f2e699]: "Email :"
                    - generic [ref=f2e700]: fatoumata.camara.13@demo.eventvillage.local
              - generic [ref=f2e701]:
                - button "Changer le rôle" [ref=f2e702] [cursor=pointer]
                - button "Suspendre" [ref=f2e717] [cursor=pointer]
                - button "Supprimer" [ref=f2e719] [cursor=pointer]
            - listitem [ref=f2e725]:
              - generic [ref=f2e726]:
                - generic [ref=f2e727]:
                  - paragraph [ref=f2e728]: Adama Diouf
                  - generic [ref=f2e729]: Client
                  - generic [ref=f2e731]: Actif
                - generic [ref=f2e733]:
                  - generic [ref=f2e734]:
                    - generic [ref=f2e737]: "Téléphone :"
                    - generic [ref=f2e738]: "+221700000212"
                  - generic [ref=f2e739]:
                    - generic [ref=f2e743]: "Email :"
                    - generic [ref=f2e744]: adama.diouf.12@demo.eventvillage.local
              - generic [ref=f2e745]:
                - button "Changer le rôle" [ref=f2e746] [cursor=pointer]
                - button "Suspendre" [ref=f2e761] [cursor=pointer]
                - button "Supprimer" [ref=f2e763] [cursor=pointer]
            - listitem [ref=f2e769]:
              - generic [ref=f2e770]:
                - generic [ref=f2e771]:
                  - paragraph [ref=f2e772]: Rokhaya Ndao
                  - generic [ref=f2e773]: Client
                  - generic [ref=f2e775]: Actif
                - generic [ref=f2e777]:
                  - generic [ref=f2e778]:
                    - generic [ref=f2e781]: "Téléphone :"
                    - generic [ref=f2e782]: "+221700000211"
                  - generic [ref=f2e783]:
                    - generic [ref=f2e787]: "Email :"
                    - generic [ref=f2e788]: rokhaya.ndao.11@demo.eventvillage.local
              - generic [ref=f2e789]:
                - button "Changer le rôle" [ref=f2e790] [cursor=pointer]
                - button "Suspendre" [ref=f2e805] [cursor=pointer]
                - button "Supprimer" [ref=f2e807] [cursor=pointer]
            - listitem [ref=f2e813]:
              - generic [ref=f2e814]:
                - generic [ref=f2e815]:
                  - paragraph [ref=f2e816]: Pape Lo
                  - generic [ref=f2e817]: Client
                  - generic [ref=f2e819]: Actif
                - generic [ref=f2e821]:
                  - generic [ref=f2e822]:
                    - generic [ref=f2e825]: "Téléphone :"
                    - generic [ref=f2e826]: "+221700000210"
                  - generic [ref=f2e827]:
                    - generic [ref=f2e831]: "Email :"
                    - generic [ref=f2e832]: pape.lo.10@demo.eventvillage.local
              - generic [ref=f2e833]:
                - button "Changer le rôle" [ref=f2e834] [cursor=pointer]
                - button "Suspendre" [ref=f2e849] [cursor=pointer]
                - button "Supprimer" [ref=f2e851] [cursor=pointer]
            - listitem [ref=f2e857]:
              - generic [ref=f2e858]:
                - generic [ref=f2e859]:
                  - paragraph [ref=f2e860]: Coumba Ka
                  - generic [ref=f2e861]: Client
                  - generic [ref=f2e863]: Actif
                - generic [ref=f2e865]:
                  - generic [ref=f2e866]:
                    - generic [ref=f2e869]: "Téléphone :"
                    - generic [ref=f2e870]: "+221700000209"
                  - generic [ref=f2e871]:
                    - generic [ref=f2e875]: "Email :"
                    - generic [ref=f2e876]: coumba.ka.09@demo.eventvillage.local
              - generic [ref=f2e877]:
                - button "Changer le rôle" [ref=f2e878] [cursor=pointer]
                - button "Suspendre" [ref=f2e893] [cursor=pointer]
                - button "Supprimer" [ref=f2e895] [cursor=pointer]
            - listitem [ref=f2e901]:
              - generic [ref=f2e902]:
                - generic [ref=f2e903]:
                  - paragraph [ref=f2e904]: Alioune Fall
                  - generic [ref=f2e905]: Client
                  - generic [ref=f2e907]: Actif
                - generic [ref=f2e909]:
                  - generic [ref=f2e910]:
                    - generic [ref=f2e913]: "Téléphone :"
                    - generic [ref=f2e914]: "+221700000208"
                  - generic [ref=f2e915]:
                    - generic [ref=f2e919]: "Email :"
                    - generic [ref=f2e920]: alioune.fall.08@demo.eventvillage.local
              - generic [ref=f2e921]:
                - button "Changer le rôle" [ref=f2e922] [cursor=pointer]
                - button "Suspendre" [ref=f2e937] [cursor=pointer]
                - button "Supprimer" [ref=f2e939] [cursor=pointer]
            - listitem [ref=f2e945]:
              - generic [ref=f2e946]:
                - generic [ref=f2e947]:
                  - paragraph [ref=f2e948]: Mame Ndour
                  - generic [ref=f2e949]: Client
                  - generic [ref=f2e951]: Actif
                - generic [ref=f2e953]:
                  - generic [ref=f2e954]:
                    - generic [ref=f2e957]: "Téléphone :"
                    - generic [ref=f2e958]: "+221700000207"
                  - generic [ref=f2e959]:
                    - generic [ref=f2e963]: "Email :"
                    - generic [ref=f2e964]: mame.ndour.07@demo.eventvillage.local
              - generic [ref=f2e965]:
                - button "Changer le rôle" [ref=f2e966] [cursor=pointer]
                - button "Suspendre" [ref=f2e981] [cursor=pointer]
                - button "Supprimer" [ref=f2e983] [cursor=pointer]
            - listitem [ref=f2e989]:
              - generic [ref=f2e990]:
                - generic [ref=f2e991]:
                  - paragraph [ref=f2e992]: Babacar Diagne
                  - generic [ref=f2e993]: Client
                  - generic [ref=f2e995]: Actif
                - generic [ref=f2e997]:
                  - generic [ref=f2e998]:
                    - generic [ref=f2e1001]: "Téléphone :"
                    - generic [ref=f2e1002]: "+221700000206"
                  - generic [ref=f2e1003]:
                    - generic [ref=f2e1007]: "Email :"
                    - generic [ref=f2e1008]: babacar.diagne.06@demo.eventvillage.local
              - generic [ref=f2e1009]:
                - button "Changer le rôle" [ref=f2e1010] [cursor=pointer]
                - button "Suspendre" [ref=f2e1025] [cursor=pointer]
                - button "Supprimer" [ref=f2e1027] [cursor=pointer]
            - listitem [ref=f2e1033]:
              - generic [ref=f2e1034]:
                - generic [ref=f2e1035]:
                  - paragraph [ref=f2e1036]: Ndeye Thiam
                  - generic [ref=f2e1037]: Client
                  - generic [ref=f2e1039]: Actif
                - generic [ref=f2e1041]:
                  - generic [ref=f2e1042]:
                    - generic [ref=f2e1045]: "Téléphone :"
                    - generic [ref=f2e1046]: "+221700000205"
                  - generic [ref=f2e1047]:
                    - generic [ref=f2e1051]: "Email :"
                    - generic [ref=f2e1052]: ndeye.thiam.05@demo.eventvillage.local
              - generic [ref=f2e1053]:
                - button "Changer le rôle" [ref=f2e1054] [cursor=pointer]
                - button "Suspendre" [ref=f2e1069] [cursor=pointer]
                - button "Supprimer" [ref=f2e1071] [cursor=pointer]
            - listitem [ref=f2e1077]:
              - generic [ref=f2e1078]:
                - generic [ref=f2e1079]:
                  - paragraph [ref=f2e1080]: Cheikh Sarr
                  - generic [ref=f2e1081]: Client
                  - generic [ref=f2e1083]: Actif
                - generic [ref=f2e1085]:
                  - generic [ref=f2e1086]:
                    - generic [ref=f2e1089]: "Téléphone :"
                    - generic [ref=f2e1090]: "+221700000204"
                  - generic [ref=f2e1091]:
                    - generic [ref=f2e1095]: "Email :"
                    - generic [ref=f2e1096]: cheikh.sarr.04@demo.eventvillage.local
              - generic [ref=f2e1097]:
                - button "Changer le rôle" [ref=f2e1098] [cursor=pointer]
                - button "Suspendre" [ref=f2e1113] [cursor=pointer]
                - button "Supprimer" [ref=f2e1115] [cursor=pointer]
            - listitem [ref=f2e1121]:
              - generic [ref=f2e1122]:
                - generic [ref=f2e1123]:
                  - paragraph [ref=f2e1124]: Aminata Sène
                  - generic [ref=f2e1125]: Client
                  - generic [ref=f2e1127]: Actif
                - generic [ref=f2e1129]:
                  - generic [ref=f2e1130]:
                    - generic [ref=f2e1133]: "Téléphone :"
                    - generic [ref=f2e1134]: "+221700000203"
                  - generic [ref=f2e1135]:
                    - generic [ref=f2e1139]: "Email :"
                    - generic [ref=f2e1140]: aminata.sene.03@demo.eventvillage.local
              - generic [ref=f2e1141]:
                - button "Changer le rôle" [ref=f2e1142] [cursor=pointer]
                - button "Suspendre" [ref=f2e1157] [cursor=pointer]
                - button "Supprimer" [ref=f2e1159] [cursor=pointer]
            - listitem [ref=f2e1165]:
              - generic [ref=f2e1166]:
                - generic [ref=f2e1167]:
                  - paragraph [ref=f2e1168]: Moussa Sy
                  - generic [ref=f2e1169]: Client
                  - generic [ref=f2e1171]: Actif
                - generic [ref=f2e1173]:
                  - generic [ref=f2e1174]:
                    - generic [ref=f2e1177]: "Téléphone :"
                    - generic [ref=f2e1178]: "+221700000202"
                  - generic [ref=f2e1179]:
                    - generic [ref=f2e1183]: "Email :"
                    - generic [ref=f2e1184]: moussa.sy.02@demo.eventvillage.local
              - generic [ref=f2e1185]:
                - button "Changer le rôle" [ref=f2e1186] [cursor=pointer]
                - button "Suspendre" [ref=f2e1201] [cursor=pointer]
                - button "Supprimer" [ref=f2e1203] [cursor=pointer]
            - listitem [ref=f2e1209]:
              - generic [ref=f2e1210]:
                - generic [ref=f2e1211]:
                  - paragraph [ref=f2e1212]: Awa Diop
                  - generic [ref=f2e1213]: Client
                  - generic [ref=f2e1215]: Actif
                - generic [ref=f2e1217]:
                  - generic [ref=f2e1218]:
                    - generic [ref=f2e1221]: "Téléphone :"
                    - generic [ref=f2e1222]: "+221700000201"
                  - generic [ref=f2e1223]:
                    - generic [ref=f2e1227]: "Email :"
                    - generic [ref=f2e1228]: awa.diop.01@demo.eventvillage.local
              - generic [ref=f2e1229]:
                - button "Changer le rôle" [ref=f2e1230] [cursor=pointer]
                - button "Suspendre" [ref=f2e1245] [cursor=pointer]
                - button "Supprimer" [ref=f2e1247] [cursor=pointer]
            - listitem [ref=f2e1253]:
              - generic [ref=f2e1254]:
                - generic [ref=f2e1255]:
                  - paragraph [ref=f2e1256]: Mamadou Sall
                  - generic [ref=f2e1257]: Contrôleur
                  - generic [ref=f2e1259]: Actif
                - generic [ref=f2e1261]:
                  - generic [ref=f2e1262]:
                    - generic [ref=f2e1265]: "Téléphone :"
                    - generic [ref=f2e1266]: "+221700000110"
                  - generic [ref=f2e1267]:
                    - generic [ref=f2e1271]: "Email :"
                    - generic [ref=f2e1272]: mamadou.sall@demo.eventvillage.local
              - generic [ref=f2e1273]:
                - button "Changer le rôle" [ref=f2e1274] [cursor=pointer]
                - button "Suspendre" [ref=f2e1289] [cursor=pointer]
                - button "Supprimer" [ref=f2e1291] [cursor=pointer]
            - listitem [ref=f2e1297]:
              - generic [ref=f2e1298]:
                - generic [ref=f2e1299]:
                  - paragraph [ref=f2e1300]: Ndèye Gning
                  - generic [ref=f2e1301]: Partenaire
                  - generic [ref=f2e1303]: Actif
                - generic [ref=f2e1305]:
                  - generic [ref=f2e1306]:
                    - generic [ref=f2e1309]: "Téléphone :"
                    - generic [ref=f2e1310]: "+221700000109"
                  - generic [ref=f2e1311]:
                    - generic [ref=f2e1315]: "Email :"
                    - generic [ref=f2e1316]: ndeye.gning@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f2e1318] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=50d0eb56-f5a1-4afa-99c8-091c7a9d21e4
            - listitem [ref=f2e1320]:
              - generic [ref=f2e1321]:
                - generic [ref=f2e1322]:
                  - paragraph [ref=f2e1323]: Lamine Cissé
                  - generic [ref=f2e1324]: Contrôleur
                  - generic [ref=f2e1326]: Actif
                - generic [ref=f2e1328]:
                  - generic [ref=f2e1329]:
                    - generic [ref=f2e1332]: "Téléphone :"
                    - generic [ref=f2e1333]: "+221700000108"
                  - generic [ref=f2e1334]:
                    - generic [ref=f2e1338]: "Email :"
                    - generic [ref=f2e1339]: lamine.cisse@demo.eventvillage.local
              - generic [ref=f2e1340]:
                - button "Changer le rôle" [ref=f2e1341] [cursor=pointer]
                - button "Suspendre" [ref=f2e1356] [cursor=pointer]
                - button "Supprimer" [ref=f2e1358] [cursor=pointer]
            - listitem [ref=f2e1364]:
              - generic [ref=f2e1365]:
                - generic [ref=f2e1366]:
                  - paragraph [ref=f2e1367]: Seynabou Ba
                  - generic [ref=f2e1368]: Contrôleur
                  - generic [ref=f2e1370]: Actif
                - generic [ref=f2e1372]:
                  - generic [ref=f2e1373]:
                    - generic [ref=f2e1376]: "Téléphone :"
                    - generic [ref=f2e1377]: "+221700000107"
                  - generic [ref=f2e1378]:
                    - generic [ref=f2e1382]: "Email :"
                    - generic [ref=f2e1383]: seynabou.ba@demo.eventvillage.local
              - generic [ref=f2e1384]:
                - button "Changer le rôle" [ref=f2e1385] [cursor=pointer]
                - button "Suspendre" [ref=f2e1400] [cursor=pointer]
                - button "Supprimer" [ref=f2e1402] [cursor=pointer]
            - listitem [ref=f2e1408]:
              - generic [ref=f2e1409]:
                - generic [ref=f2e1410]:
                  - paragraph [ref=f2e1411]: Ibrahima Gueye
                  - generic [ref=f2e1412]: Contrôleur
                  - generic [ref=f2e1414]: Actif
                - generic [ref=f2e1416]:
                  - generic [ref=f2e1417]:
                    - generic [ref=f2e1420]: "Téléphone :"
                    - generic [ref=f2e1421]: "+221700000106"
                  - generic [ref=f2e1422]:
                    - generic [ref=f2e1426]: "Email :"
                    - generic [ref=f2e1427]: ibrahima.gueye@demo.eventvillage.local
              - generic [ref=f2e1428]:
                - button "Changer le rôle" [ref=f2e1429] [cursor=pointer]
                - button "Suspendre" [ref=f2e1444] [cursor=pointer]
                - button "Supprimer" [ref=f2e1446] [cursor=pointer]
            - listitem [ref=f2e1452]:
              - generic [ref=f2e1453]:
                - generic [ref=f2e1454]:
                  - paragraph [ref=f2e1455]: Fatou Mbaye
                  - generic [ref=f2e1456]: Client
                  - generic [ref=f2e1458]: Actif
                - generic [ref=f2e1460]:
                  - generic [ref=f2e1461]:
                    - generic [ref=f2e1464]: "Téléphone :"
                    - generic [ref=f2e1465]: "+221700000105"
                  - generic [ref=f2e1466]:
                    - generic [ref=f2e1470]: "Email :"
                    - generic [ref=f2e1471]: fatou.mbaye@demo.eventvillage.local
              - generic [ref=f2e1472]:
                - button "Changer le rôle" [ref=f2e1473] [cursor=pointer]
                - button "Suspendre" [ref=f2e1488] [cursor=pointer]
                - button "Supprimer" [ref=f2e1490] [cursor=pointer]
            - listitem [ref=f2e1496]:
              - generic [ref=f2e1497]:
                - generic [ref=f2e1498]:
                  - paragraph [ref=f2e1499]: Aïda Diallo
                  - generic [ref=f2e1500]: Administrateur
                  - generic [ref=f2e1502]: Actif
                - generic [ref=f2e1504]:
                  - generic [ref=f2e1505]:
                    - generic [ref=f2e1508]: "Téléphone :"
                    - generic [ref=f2e1509]: "+221700000104"
                  - generic [ref=f2e1510]:
                    - generic [ref=f2e1514]: "Email :"
                    - generic [ref=f2e1515]: aida.diallo@demo.eventvillage.local
              - generic [ref=f2e1516]:
                - button "Permissions" [ref=f2e1517] [cursor=pointer]
                - button "Changer le rôle" [ref=f2e1524] [cursor=pointer]
                - button "Changer le numéro" [ref=f2e1539] [cursor=pointer]
                - button "Suspendre" [ref=f2e1541] [cursor=pointer]
                - button "Supprimer" [ref=f2e1543] [cursor=pointer]
            - listitem [ref=f2e1549]:
              - generic [ref=f2e1550]:
                - generic [ref=f2e1551]:
                  - paragraph [ref=f2e1552]: Khady Sarr
                  - generic [ref=f2e1553]: Partenaire
                  - generic [ref=f2e1555]: Actif
                - generic [ref=f2e1557]:
                  - generic [ref=f2e1558]:
                    - generic [ref=f2e1561]: "Téléphone :"
                    - generic [ref=f2e1562]: "+221700000103"
                  - generic [ref=f2e1563]:
                    - generic [ref=f2e1567]: "Email :"
                    - generic [ref=f2e1568]: khady.sarr@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f2e1570] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=d80b3ea6-6e9a-4b2f-b4b6-7a01bba724f1
            - listitem [ref=f2e1572]:
              - generic [ref=f2e1573]:
                - generic [ref=f2e1574]:
                  - paragraph [ref=f2e1575]: Ousmane Faye
                  - generic [ref=f2e1576]: Partenaire
                  - generic [ref=f2e1578]: Actif
                - generic [ref=f2e1580]:
                  - generic [ref=f2e1581]:
                    - generic [ref=f2e1584]: "Téléphone :"
                    - generic [ref=f2e1585]: "+221700000102"
                  - generic [ref=f2e1586]:
                    - generic [ref=f2e1590]: "Email :"
                    - generic [ref=f2e1591]: ousmane.faye@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f2e1593] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=84b02701-f6ca-4fce-99a2-195c0c071290
            - listitem [ref=f2e1595]:
              - generic [ref=f2e1596]:
                - generic [ref=f2e1597]:
                  - paragraph [ref=f2e1598]: Mariama Ndiaye
                  - generic [ref=f2e1599]: Partenaire
                  - generic [ref=f2e1601]: Actif
                - generic [ref=f2e1603]:
                  - generic [ref=f2e1604]:
                    - generic [ref=f2e1607]: "Téléphone :"
                    - generic [ref=f2e1608]: "+221700000101"
                  - generic [ref=f2e1609]:
                    - generic [ref=f2e1613]: "Email :"
                    - generic [ref=f2e1614]: mariama.ndiaye@demo.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f2e1616] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=a9cfd61c-1494-42df-96bc-02fb2894d44f
            - listitem [ref=f2e1618]:
              - generic [ref=f2e1619]:
                - generic [ref=f2e1620]:
                  - paragraph [ref=f2e1621]: Fatou Suspendue
                  - generic [ref=f2e1622]: Client
                  - generic [ref=f2e1624]: Suspendu
                - generic [ref=f2e1626]:
                  - generic [ref=f2e1627]:
                    - generic [ref=f2e1630]: "Téléphone :"
                    - generic [ref=f2e1631]: "+221700000008"
                  - generic [ref=f2e1632]:
                    - generic [ref=f2e1636]: "Email :"
                    - generic [ref=f2e1637]: suspendu@test.eventvillage.local
              - generic [ref=f2e1638]:
                - button "Changer le rôle" [ref=f2e1639] [cursor=pointer]
                - button "Réactiver" [ref=f2e1654] [cursor=pointer]
                - button "Supprimer" [ref=f2e1656] [cursor=pointer]
            - listitem [ref=f2e1662]:
              - generic [ref=f2e1663]:
                - generic [ref=f2e1664]:
                  - paragraph [ref=f2e1665]: Elhadji SuperAdmin
                  - generic [ref=f2e1666]: Super-administrateur
                  - generic [ref=f2e1668]: Actif
                - generic [ref=f2e1670]:
                  - generic [ref=f2e1671]:
                    - generic [ref=f2e1674]: "Téléphone :"
                    - generic [ref=f2e1675]: "+221700000007"
                  - generic [ref=f2e1676]:
                    - generic [ref=f2e1680]: "Email :"
                    - generic [ref=f2e1681]: superadmin@test.eventvillage.local
              - button "Quitter le rôle de super-administrateur" [ref=f2e1683] [cursor=pointer]
            - listitem [ref=f2e1698]:
              - generic [ref=f2e1699]:
                - generic [ref=f2e1700]:
                  - paragraph [ref=f2e1701]: Dior Admin
                  - generic [ref=f2e1702]: Administrateur
                  - generic [ref=f2e1704]: Actif
                - generic [ref=f2e1706]:
                  - generic [ref=f2e1707]:
                    - generic [ref=f2e1710]: "Téléphone :"
                    - generic [ref=f2e1711]: "+221700000006"
                  - generic [ref=f2e1712]:
                    - generic [ref=f2e1716]: "Email :"
                    - generic [ref=f2e1717]: admin@test.eventvillage.local
              - generic [ref=f2e1718]:
                - button "Permissions" [ref=f2e1719] [cursor=pointer]
                - button "Changer le rôle" [ref=f2e1726] [cursor=pointer]
                - button "Changer le numéro" [ref=f2e1741] [cursor=pointer]
                - button "Suspendre" [ref=f2e1743] [cursor=pointer]
                - button "Supprimer" [ref=f2e1745] [cursor=pointer]
            - listitem [ref=f2e1751]:
              - generic [ref=f2e1752]:
                - generic [ref=f2e1753]:
                  - paragraph [ref=f2e1754]: Cheikh ControleurA
                  - generic [ref=f2e1755]: Contrôleur
                  - generic [ref=f2e1757]: Actif
                - generic [ref=f2e1759]:
                  - generic [ref=f2e1760]:
                    - generic [ref=f2e1763]: "Téléphone :"
                    - generic [ref=f2e1764]: "+221700000005"
                  - generic [ref=f2e1765]:
                    - generic [ref=f2e1769]: "Email :"
                    - generic [ref=f2e1770]: controller-a@test.eventvillage.local
              - generic [ref=f2e1771]:
                - button "Changer le rôle" [ref=f2e1772] [cursor=pointer]
                - button "Suspendre" [ref=f2e1787] [cursor=pointer]
                - button "Supprimer" [ref=f2e1789] [cursor=pointer]
            - listitem [ref=f2e1795]:
              - generic [ref=f2e1796]:
                - generic [ref=f2e1797]:
                  - paragraph [ref=f2e1798]: Bassirou OrgaB
                  - generic [ref=f2e1799]: Partenaire
                  - generic [ref=f2e1801]: Actif
                - generic [ref=f2e1803]:
                  - generic [ref=f2e1804]:
                    - generic [ref=f2e1807]: "Téléphone :"
                    - generic [ref=f2e1808]: "+221700000004"
                  - generic [ref=f2e1809]:
                    - generic [ref=f2e1813]: "Email :"
                    - generic [ref=f2e1814]: partner-b@test.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f2e1816] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=e3e142d7-edd6-449a-8f41-eef9cc301e4a
            - listitem [ref=f2e1818]:
              - generic [ref=f2e1819]:
                - generic [ref=f2e1820]:
                  - paragraph [ref=f2e1821]: Aïssatou OrgaA
                  - generic [ref=f2e1822]: Partenaire
                  - generic [ref=f2e1824]: Actif
                - generic [ref=f2e1826]:
                  - generic [ref=f2e1827]:
                    - generic [ref=f2e1830]: "Téléphone :"
                    - generic [ref=f2e1831]: "+221700000003"
                  - generic [ref=f2e1832]:
                    - generic [ref=f2e1836]: "Email :"
                    - generic [ref=f2e1837]: partner-a@test.eventvillage.local
              - link "Voir la fiche partenaire" [ref=f2e1839] [cursor=pointer]:
                - /url: /admin/dashboard?partenaires=ALL&dossier=666f30d9-3b7f-4ad5-a39e-ae2b26d2a2d1
            - listitem [ref=f2e1841]:
              - generic [ref=f2e1842]:
                - generic [ref=f2e1843]:
                  - paragraph [ref=f2e1844]: Birame ClientBis
                  - generic [ref=f2e1845]: Client
                  - generic [ref=f2e1847]: Actif
                - generic [ref=f2e1849]:
                  - generic [ref=f2e1850]:
                    - generic [ref=f2e1853]: "Téléphone :"
                    - generic [ref=f2e1854]: "+221700000002"
                  - generic [ref=f2e1855]:
                    - generic [ref=f2e1859]: "Email :"
                    - generic [ref=f2e1860]: client-bis@test.eventvillage.local
              - generic [ref=f2e1861]:
                - button "Changer le rôle" [ref=f2e1862] [cursor=pointer]
                - button "Suspendre" [ref=f2e1877] [cursor=pointer]
                - button "Supprimer" [ref=f2e1879] [cursor=pointer]
            - listitem [ref=f2e1885]:
              - generic [ref=f2e1886]:
                - generic [ref=f2e1887]:
                  - paragraph [ref=f2e1888]: Awa Client
                  - generic [ref=f2e1889]: Client
                  - generic [ref=f2e1891]: Actif
                - generic [ref=f2e1893]:
                  - generic [ref=f2e1894]:
                    - generic [ref=f2e1897]: "Téléphone :"
                    - generic [ref=f2e1898]: "+221700000001"
                  - generic [ref=f2e1899]:
                    - generic [ref=f2e1903]: "Email :"
                    - generic [ref=f2e1904]: client@test.eventvillage.local
              - generic [ref=f2e1905]:
                - button "Changer le rôle" [ref=f2e1906] [cursor=pointer]
                - button "Suspendre" [ref=f2e1921] [cursor=pointer]
                - button "Supprimer" [ref=f2e1923] [cursor=pointer]
  - alert [ref=f2e1929]
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
      |                                                                                        ^ Error: contrôles responsive de adm-comptes (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```