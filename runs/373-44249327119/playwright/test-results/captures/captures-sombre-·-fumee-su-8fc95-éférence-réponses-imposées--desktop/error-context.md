# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-versements-marquer-verse — Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-versements-marquer-verse__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "valeur technique affichée : f60e3404-1d39-4e9c-964b-7344e43a3104 ; 5b6d460c-de30-492a-a859-4aba1f8ab1a7 ; 900bbcbd-88a3-4e15-9d2b-2b76c59390ae ; e90dbf12-395d-4c77-b406-9d5c3da1c3ba ; dd6a67e8-88ec-4400-94e2-35a1c681ca30 ; a11be73d-200e-495e-82e7-792cd3016384 ; 71f24e3b-b1c7-434c-9d6a-5bc42a65f491 ; 0e364272-5091-4c9b-a8b6-7777dd5a3170 ; 67c05056-f0e4-4c72-9775-f9983726cd1f ; 3c93eb2d-6d06-4be7-958e-44c7671c5571 — ex. texte : « f60e3404-1d39-4e9c-964b-7344e43a3104 » ; texte : « 5b6d460c-de30-492a-a859-4aba1f8ab1a7 » ; texte : « 900bbcbd-88a3-4e15-9d2b-2b76c59390ae »",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Event Village
      - navigation "Navigation principale" [ref=e9]:
        - generic [ref=e10]: Administration
        - link "Tableau de bord" [ref=e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e22]:
          - paragraph [ref=e23]: Gestion
          - generic [ref=e24]:
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e42]:
          - paragraph [ref=e43]: Finances
          - link "Finance" [ref=e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=e49]:
          - paragraph [ref=e50]: Engagement
          - generic [ref=e51]:
            - link "Parrainage" [ref=e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=e66]:
          - paragraph [ref=e67]: Système
          - generic [ref=e68]:
            - link "Réglages" [ref=e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=e100] [cursor=pointer]:
          - /url: /
      - generic [ref=e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e107]: ES
          - generic [ref=e108]:
            - generic [ref=e109]: Elhadji SuperAdmin
            - generic [ref=e110]: Superadmin
        - generic [ref=e111]:
          - button "Se déconnecter" [ref=e112] [cursor=pointer]
          - button "Basculer le thème" [ref=e117] [cursor=pointer]
    - generic [ref=e121]:
      - banner [ref=e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=e131] [cursor=pointer]:
          - generic [ref=e135]: "58"
      - main [ref=e136]:
        - generic [ref=e138]:
          - generic [ref=e140]:
            - generic [ref=e141]:
              - heading "Finance" [level=1] [ref=e142]
              - paragraph [ref=e143]: Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay.
            - link "Réglages de la plateforme" [ref=e145] [cursor=pointer]:
              - /url: /admin/finance-settings
          - group [ref=e151]:
            - heading "Période" [level=2] [ref=e155]
            - generic [ref=e157]:
              - generic [ref=e158]: Afficher
              - combobox "Afficher" [ref=e161] [cursor=pointer]:
                - option "Aujourd’hui"
                - option "7 derniers jours"
                - option "30 derniers jours"
                - option "Ce mois-ci" [selected]
                - option "Mois dernier"
                - option "Dates choisies…"
            - paragraph [ref=e162]: "Période affichée : du 1er au 18 novembre 2026. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant."
          - generic [ref=e163]:
            - region [ref=e164]:
              - heading "Gagné par Event Village" [level=2] [ref=e166]
              - paragraph [ref=e171]: 57 266,72 F CFA
              - paragraph [ref=e172]: "Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
              - paragraph [ref=e173]: Paiements encaissés, retraits versés et versements confirmés du 1er au 18 novembre 2026.
              - link "Voir le détail" [ref=e174] [cursor=pointer]:
                - /url: "#detail-gagne"
            - region [ref=e175]:
              - heading "Dû aux partenaires" [level=2] [ref=e177]
              - paragraph [ref=e182]: 1 749 000 F CFA
              - paragraph [ref=e183]: "L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
              - paragraph [ref=e184]: "Dont 0 F CFA retirables aujourd’hui. Dû aux parrains : 0 F CFA. À l’instant."
              - link "Voir le détail" [ref=e185] [cursor=pointer]:
                - /url: "#du-aux-partenaires"
            - region [ref=e186]:
              - heading "Retirable par Event Village" [level=2] [ref=e188]
              - paragraph [ref=e192]: 47 166 275 F CFA
              - paragraph [ref=e193]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
              - paragraph [ref=e194]:
                - text: Solde SamirPay lu à
                - time [ref=e195]: 06:41
                - text: ", moins tout ce qui est dû et la réserve de prudence."
              - link "Voir le calcul" [ref=e196] [cursor=pointer]:
                - /url: "#calcul-retirable"
            - region [ref=e197]:
              - heading "Créances" [level=2] [ref=e199]
              - paragraph [ref=e205]: 0 F CFA
              - paragraph [ref=e206]: Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre.
              - paragraph [ref=e207]: Aucune créance à l’instant.
              - link "Voir les créances" [ref=e208] [cursor=pointer]:
                - /url: "#creances"
          - region [ref=e210]:
            - generic [ref=e211]:
              - heading "Versements à reprendre" [level=2] [ref=e212]
              - paragraph [ref=e213]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - table [ref=e216]:
              - caption [ref=e217]: Versements à reprendre
              - rowgroup [ref=e218]:
                - row [ref=e219]:
                  - columnheader "Montant" [ref=e220]
                  - columnheader "Versement" [ref=e221]
                  - columnheader "Bénéficiaire" [ref=e222]
                  - columnheader "État" [ref=e223]
                  - columnheader "Depuis le" [ref=e224]
                  - columnheader "Reprise" [ref=e225]
              - rowgroup [ref=e226]:
                - row [ref=e227]:
                  - cell "5 250 F CFA" [ref=e228]
                  - cell [ref=e229]:
                    - generic [ref=e230]:
                      - paragraph [ref=e231]: Remboursement d’un billet
                      - paragraph [ref=e232]: Croisière musicale vers Gorée
                  - cell "77 ••• •• 34" [ref=e233]
                  - cell "Envoi en échec Refusé par l’opérateur Mobile Money" [ref=e234]:
                    - generic [ref=e235]:
                      - generic [ref=e236]: Envoi en échec
                      - generic [ref=e238]: Refusé par l’opérateur Mobile Money
                  - cell [ref=e239]:
                    - time [ref=e240]: mer. 4 nov. 2026 à 18:30
                  - cell [ref=e241]:
                    - generic [ref=e243]:
                      - button "Renvoyer le versement de 5 250 F CFA" [ref=e244] [cursor=pointer]:
                        - generic [ref=e249]: Renvoyer
                      - button "Marquer versé le versement de 5 250 F CFA" [ref=e250] [cursor=pointer]:
                        - generic [ref=e255]: Marquer versé
                - row [ref=e256]:
                  - cell "48 500 F CFA" [ref=e257]
                  - cell [ref=e258]:
                    - paragraph [ref=e260]: Retrait
                  - cell "76 ••• •• 18" [ref=e261]
                  - cell "Bloqué Solde SamirPay insuffisant" [ref=e262]:
                    - generic [ref=e263]:
                      - generic [ref=e264]: Bloqué
                      - generic [ref=e266]: Solde SamirPay insuffisant
                  - cell [ref=e267]:
                    - time [ref=e268]: mer. 4 nov. 2026 à 19:05
                  - cell [ref=e269]:
                    - generic [ref=e271]:
                      - button "Renvoyer le versement de 48 500 F CFA" [ref=e272] [cursor=pointer]:
                        - generic [ref=e277]: Renvoyer
                      - button "Marquer versé le versement de 48 500 F CFA" [ref=e278] [cursor=pointer]:
                        - generic [ref=e283]: Marquer versé
                - row [ref=e284]:
                  - cell "3 150 F CFA" [ref=e285]
                  - cell [ref=e286]:
                    - generic [ref=e287]:
                      - paragraph [ref=e288]: Annulation d’événement
                      - paragraph [ref=e289]: Festival Jazz sur le Fleuve
                  - cell "78 ••• •• 52" [ref=e290]
                  - cell "Issue incertaine" [ref=e291]
                  - cell [ref=e295]:
                    - time [ref=e296]: mer. 4 nov. 2026 à 20:40
                  - cell [ref=e297]:
                    - generic [ref=e298]:
                      - paragraph [ref=e299]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                      - generic [ref=e300]:
                        - button "Marquer versé le versement de 3 150 F CFA" [ref=e301] [cursor=pointer]:
                          - generic [ref=e306]: Marquer versé
                        - button "Constater non versé le versement de 3 150 F CFA" [ref=e307] [cursor=pointer]:
                          - generic [ref=e312]: Constater non versé
                - row [ref=e313]:
                  - cell "10 500 F CFA" [ref=e314]
                  - cell [ref=e315]:
                    - generic [ref=e316]:
                      - paragraph [ref=e317]: Remboursement d’un paiement
                      - paragraph [ref=e318]: Nuit du Sabar — édition d’automne
                  - cell "70 ••• •• 61" [ref=e319]
                  - cell "Envoyé, non confirmé" [ref=e320]
                  - cell [ref=e324]:
                    - time [ref=e325]: mer. 4 nov. 2026 à 21:10
                  - cell [ref=e326]:
                    - generic [ref=e328]:
                      - button "Renvoyer le versement de 10 500 F CFA" [ref=e329] [cursor=pointer]:
                        - generic [ref=e334]: Renvoyer
                      - button "Marquer versé le versement de 10 500 F CFA" [ref=e335] [cursor=pointer]:
                        - generic [ref=e340]: Marquer versé
                - row [ref=e341]:
                  - cell "7 350 F CFA" [ref=e342]
                  - cell [ref=e343]:
                    - generic [ref=e344]:
                      - paragraph [ref=e345]: Remboursement d’un billet
                      - paragraph [ref=e346]: Croisière musicale vers Gorée
                  - cell "77 ••• •• 09" [ref=e347]
                  - cell "Bloqué Opérateur Mobile Money inconnu" [ref=e348]:
                    - generic [ref=e349]:
                      - generic [ref=e350]: Bloqué
                      - generic [ref=e352]: Opérateur Mobile Money inconnu
                  - cell [ref=e353]:
                    - time [ref=e354]: mer. 4 nov. 2026 à 21:45
                  - cell [ref=e355]:
                    - button "Marquer versé le versement de 7 350 F CFA" [ref=e358] [cursor=pointer]:
                      - generic [ref=e363]: Marquer versé
          - region [ref=e364]:
            - generic [ref=e365]:
              - heading "Remboursements à verser" [level=2] [ref=e366]
              - paragraph [ref=e367]: Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
              - paragraph [ref=e368]: 4 remboursements pour 88 200 F CFA.
            - table [ref=e371]:
              - caption [ref=e372]: Remboursements à verser
              - rowgroup [ref=e373]:
                - row [ref=e374]:
                  - columnheader "Demandé le" [ref=e375]
                  - columnheader "Remboursement" [ref=e376]
                  - columnheader "Client" [ref=e377]
                  - columnheader "Montant" [ref=e378]
                  - columnheader "Où il en est" [ref=e379]
              - rowgroup [ref=e380]:
                - row [ref=e381]:
                  - cell [ref=e382]:
                    - time [ref=e383]: mer. 18 nov. 2026 à 06:13
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e384]:
                    - generic [ref=e385]:
                      - generic [ref=e386]: Remboursement d’une annulation
                      - generic [ref=e387]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=e388]
                  - cell "31 500 F CFA" [ref=e389]
                  - cell "Envoyé, en attente de confirmation" [ref=e390]
                - row [ref=e393]:
                  - cell [ref=e394]:
                    - time [ref=e395]: mer. 18 nov. 2026 à 06:13
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e396]:
                    - generic [ref=e397]:
                      - generic [ref=e398]: Remboursement d’une annulation
                      - generic [ref=e399]: Croisière musicale vers Gorée
                  - cell "Ibou M. · 70*****16" [ref=e400]
                  - cell "9 450 F CFA" [ref=e401]
                  - cell "Envoyé, en attente de confirmation" [ref=e402]
                - row [ref=e405]:
                  - cell [ref=e406]:
                    - time [ref=e407]: mer. 18 nov. 2026 à 06:13
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e408]:
                    - generic [ref=e409]:
                      - generic [ref=e410]: Remboursement d’une annulation
                      - generic [ref=e411]: Croisière musicale vers Gorée
                  - cell "Awa D. · 70*****01" [ref=e412]
                  - cell "31 500 F CFA" [ref=e413]
                  - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=e414]':
                    - generic [ref=e415]:
                      - generic [ref=e416]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=e417] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
                - row [ref=e418]:
                  - cell [ref=e419]:
                    - time [ref=e420]: mer. 18 nov. 2026 à 06:13
                  - cell "Remboursement d’une annulation Croisière musicale vers Gorée" [ref=e421]:
                    - generic [ref=e422]:
                      - generic [ref=e423]: Remboursement d’une annulation
                      - generic [ref=e424]: Croisière musicale vers Gorée
                  - cell "Modou M. · 70*****18" [ref=e425]
                  - cell "15 750 F CFA" [ref=e426]
                  - 'cell "Issue incertaine : à vérifier Traiter dans « Versements à reprendre »" [ref=e427]':
                    - generic [ref=e428]:
                      - generic [ref=e429]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=e430] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
          - region [ref=e431]:
            - generic [ref=e432]:
              - heading "Créances" [level=2] [ref=e433]
              - paragraph [ref=e434]: Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ; ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
            - generic [ref=e435]:
              - heading "Aucune créance" [level=3] [ref=e440]
              - paragraph [ref=e441]: Personne ne doit d’argent à Event Village.
          - region [ref=e442]:
            - generic [ref=e443]:
              - heading "Détail de ce qui a été gagné" [level=2] [ref=e444]
              - paragraph [ref=e445]: "Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés du 1er au 18 novembre 2026."
            - generic [ref=e446]:
              - generic [ref=e447]:
                - term [ref=e448]:
                  - generic [ref=e449]: Frais de service, moins les frais d’encaissement SamirPay
                  - generic [ref=e450]: "131 paiements encaissés du 1er au 18 novembre 2026 : 94 550 F CFA de frais de service, 29 783,28 F CFA de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas)."
                - definition [ref=e451]: + 64 766,72 F CFA
              - generic [ref=e452]:
                - term [ref=e453]:
                  - generic [ref=e454]: Part rendue avec les remboursements
                  - generic [ref=e455]: Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.
                - definition [ref=e456]: − 7 500 F CFA
              - generic [ref=e457]:
                - term [ref=e458]:
                  - generic [ref=e459]: Frais de retrait
                  - generic [ref=e460]: 0 retrait versé du 1er au 18 novembre 2026.
                - definition [ref=e461]: + 0 F CFA
              - generic [ref=e462]:
                - term [ref=e463]:
                  - generic [ref=e464]: Frais SamirPay des versements
                  - generic [ref=e465]: Frais réels de 0 versement confirmé du 1er au 18 novembre 2026 (remboursements et retraits).
                - definition [ref=e466]: − 0 F CFA
              - generic [ref=e467]:
                - term [ref=e468]:
                  - generic [ref=e469]: Commissions de parrainage
                  - generic [ref=e470]: Sur les paiements encaissés de la période, annulations et reprises déduites.
                - definition [ref=e471]: − 0 F CFA
              - generic [ref=e472]:
                - term [ref=e473]:
                  - generic [ref=e474]: Gagné par Event Village
                - definition [ref=e475]: 57 266,72 F CFA
          - region [ref=e476]:
            - generic [ref=e477]:
              - heading "Dû aux partenaires" [level=2] [ref=e478]
              - paragraph [ref=e479]: L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
            - generic [ref=e480]:
              - generic [ref=e481]:
                - term [ref=e482]:
                  - generic [ref=e483]: Disponible pour les partenaires
                  - generic [ref=e484]: Dont 0 F CFA retirables tout de suite et 0 F CFA gelés (événements suspendus, libérés à la reprise).
                - definition [ref=e485]: 0 F CFA
              - generic [ref=e486]:
                - term [ref=e487]:
                  - generic [ref=e488]: En attente de la fin des événements
                - definition [ref=e489]: 1 749 000 F CFA
              - generic [ref=e490]:
                - term [ref=e491]:
                  - generic [ref=e492]: Retraits en cours d’envoi
                  - generic [ref=e493]: Demandés par les partenaires, pas encore confirmés par SamirPay.
                - definition [ref=e494]: 0 F CFA
              - generic [ref=e495]:
                - term [ref=e496]:
                  - generic [ref=e497]: Dû aux partenaires
                - definition [ref=e498]: 1 749 000 F CFA
            - table [ref=e501]:
              - caption [ref=e502]: Dû aux partenaires, compte par compte
              - rowgroup [ref=e503]:
                - row [ref=e504]:
                  - columnheader "Partenaire" [ref=e505]
                  - columnheader "Dû" [ref=e506]
                  - columnheader "Retirable aujourd’hui" [ref=e507]
                  - columnheader "En attente" [ref=e508]
                  - columnheader "Gelé" [ref=e509]
                  - columnheader "Retrait en cours" [ref=e510]
              - rowgroup [ref=e511]:
                - row [ref=e512]:
                  - cell "Baobab Scène Productions" [ref=e513]
                  - cell "828 000 F CFA" [ref=e514]
                  - cell "0 F CFA" [ref=e515]
                  - cell "828 000 F CFA" [ref=e516]
                  - cell "0 F CFA" [ref=e517]
                  - cell "0 F CFA" [ref=e518]
                - row [ref=e519]:
                  - cell "Sine-Saloum Culture & Loisirs" [ref=e520]
                  - cell "806 000 F CFA" [ref=e521]
                  - cell "0 F CFA" [ref=e522]
                  - cell "806 000 F CFA" [ref=e523]
                  - cell "0 F CFA" [ref=e524]
                  - cell "0 F CFA" [ref=e525]
                - row [ref=e526]:
                  - cell "Atelier Petite-Côte" [ref=e527]
                  - cell "115 000 F CFA" [ref=e528]
                  - cell "0 F CFA" [ref=e529]
                  - cell "115 000 F CFA" [ref=e530]
                  - cell "0 F CFA" [ref=e531]
                  - cell "0 F CFA" [ref=e532]
            - generic [ref=e533]:
              - heading "Dû aux parrains" [level=3] [ref=e534]
              - paragraph [ref=e535]: "Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village. Total : 0 F CFA."
              - generic [ref=e536]:
                - heading "Rien n’est dû aux parrains" [level=3] [ref=e543]
                - paragraph [ref=e544]: Aucun solde à verser pour le moment.
          - region [ref=e545]:
            - generic [ref=e546]:
              - heading "Calcul de ce qui est retirable" [level=2] [ref=e547]
              - paragraph [ref=e548]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. Si ce chiffre est à 0, ne retirez rien.
            - generic [ref=e549]:
              - generic [ref=e550]:
                - term [ref=e551]:
                  - generic [ref=e552]: Solde du compte SamirPay
                  - generic [ref=e553]:
                    - text: Lu à
                    - time [ref=e554]: 06:41
                    - text: (heure de Dakar), relu au plus toutes les 5 minutes.
                - definition [ref=e555]: 50 000 000 F CFA
              - generic [ref=e556]:
                - term [ref=e557]:
                  - generic [ref=e558]: Dû aux partenaires
                - definition [ref=e559]: − 1 749 000 F CFA
              - generic [ref=e560]:
                - term [ref=e561]:
                  - generic [ref=e562]: Dû aux parrains
                - definition [ref=e563]: − 0 F CFA
              - generic [ref=e564]:
                - term [ref=e565]:
                  - generic [ref=e566]: Remboursements à verser
                - definition [ref=e567]: − 88 200 F CFA
              - generic [ref=e568]:
                - term [ref=e569]:
                  - generic [ref=e570]: Réserve de prudence
                  - generic [ref=e571]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Automatique : les encaissements des 3 derniers jours, soit 996 525 F CFA aujourd’hui."
                - definition [ref=e572]: − 996 525 F CFA
              - generic [ref=e573]:
                - term [ref=e574]:
                  - generic [ref=e575]: Retirable par Event Village
                - definition [ref=e576]: 47 166 275 F CFA
            - link "Changer la réserve de prudence" [ref=e578] [cursor=pointer]:
              - /url: /admin/finance-settings
          - region [ref=e580]:
            - generic [ref=e581]:
              - heading "Paiements encaissés" [level=2] [ref=e582]
              - paragraph [ref=e586]: Paiements en ligne encaissés du 1er au 18 novembre 2026. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            - generic [ref=e587]:
              - generic [ref=e588]: Statut
              - combobox "Statut" [ref=e591] [cursor=pointer]:
                - option "Tous les paiements" [selected]
                - option "Payé"
                - option "Remboursé en partie"
                - option "Remboursement en cours"
                - option "Remboursé"
            - table [ref=e594]:
              - caption [ref=e595]: Paiements encaissés
              - rowgroup [ref=e596]:
                - row [ref=e597]:
                  - columnheader "Encaissé le" [ref=e598]
                  - columnheader "Référence" [ref=e599]
                  - columnheader "Objet" [ref=e600]
                  - columnheader "Payé" [ref=e601]
                  - columnheader "Frais de service" [ref=e602]
                  - columnheader "Pour Event Village" [ref=e603]
                  - columnheader "Statut" [ref=e604]
              - rowgroup [ref=e605]:
                - row [ref=e606]:
                  - cell [ref=e607]:
                    - time [ref=e608]: mer. 18 nov. 2026 à 06:13
                  - cell "f60e3404-1d39-4e9c-964b-7344e43a3104" [ref=e609]
                  - cell "Billets Nuit du slam de Kaolack" [ref=e610]:
                    - generic [ref=e611]:
                      - generic [ref=e612]: Billets
                      - generic [ref=e613]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=e614]
                  - cell "450 F CFA" [ref=e615]
                  - cell "308,25 F CFA" [ref=e616]
                  - cell "Payé" [ref=e617]
                - row [ref=e621]:
                  - cell [ref=e622]:
                    - time [ref=e623]: mer. 18 nov. 2026 à 06:13
                  - cell "5b6d460c-de30-492a-a859-4aba1f8ab1a7" [ref=e624]
                  - cell "Billets Nuit du slam de Kaolack" [ref=e625]:
                    - generic [ref=e626]:
                      - generic [ref=e627]: Billets
                      - generic [ref=e628]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=e629]
                  - cell "450 F CFA" [ref=e630]
                  - cell "308,25 F CFA" [ref=e631]
                  - cell "Payé" [ref=e632]
                - row [ref=e636]:
                  - cell [ref=e637]:
                    - time [ref=e638]: mer. 18 nov. 2026 à 06:13
                  - cell "900bbcbd-88a3-4e15-9d2b-2b76c59390ae" [ref=e639]
                  - cell "Billets Nuit du slam de Kaolack" [ref=e640]:
                    - generic [ref=e641]:
                      - generic [ref=e642]: Billets
                      - generic [ref=e643]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=e644]
                  - cell "450 F CFA" [ref=e645]
                  - cell "308,25 F CFA" [ref=e646]
                  - cell "Payé" [ref=e647]
                - row [ref=e651]:
                  - cell [ref=e652]:
                    - time [ref=e653]: mer. 18 nov. 2026 à 06:13
                  - cell "e90dbf12-395d-4c77-b406-9d5c3da1c3ba" [ref=e654]
                  - cell "Billets Nuit du slam de Kaolack" [ref=e655]:
                    - generic [ref=e656]:
                      - generic [ref=e657]: Billets
                      - generic [ref=e658]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=e659]
                  - cell "450 F CFA" [ref=e660]
                  - cell "308,25 F CFA" [ref=e661]
                  - cell "Payé" [ref=e662]
                - row [ref=e666]:
                  - cell [ref=e667]:
                    - time [ref=e668]: mer. 18 nov. 2026 à 06:13
                  - cell "dd6a67e8-88ec-4400-94e2-35a1c681ca30" [ref=e669]
                  - cell "Billets Nuit du slam de Kaolack" [ref=e670]:
                    - generic [ref=e671]:
                      - generic [ref=e672]: Billets
                      - generic [ref=e673]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=e674]
                  - cell "450 F CFA" [ref=e675]
                  - cell "308,25 F CFA" [ref=e676]
                  - cell "Payé" [ref=e677]
                - row [ref=e681]:
                  - cell [ref=e682]:
                    - time [ref=e683]: mer. 18 nov. 2026 à 06:13
                  - cell "a11be73d-200e-495e-82e7-792cd3016384" [ref=e684]
                  - cell "Billets Nuit du slam de Kaolack" [ref=e685]:
                    - generic [ref=e686]:
                      - generic [ref=e687]: Billets
                      - generic [ref=e688]: Nuit du slam de Kaolack
                  - cell "9 450 F CFA" [ref=e689]
                  - cell "450 F CFA" [ref=e690]
                  - cell "308,25 F CFA" [ref=e691]
                  - cell "Payé" [ref=e692]
                - row [ref=e696]:
                  - cell [ref=e697]:
                    - time [ref=e698]: mer. 18 nov. 2026 à 06:12
                  - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-BIS-B-1" [ref=e699]
                  - cell "Billets" [ref=e700]
                  - cell "4 000 F CFA" [ref=e703]
                  - cell "0 F CFA" [ref=e704]
                  - cell "0 F CFA" [ref=e705]
                  - cell "Payé" [ref=e706]
                - row [ref=e710]:
                  - cell [ref=e711]:
                    - time [ref=e712]: mer. 18 nov. 2026 à 06:12
                  - cell "TX-FIXTURE-TCK-FIXTURE-CLIENT-A-1" [ref=e713]
                  - cell "Billets" [ref=e714]
                  - cell "5 000 F CFA" [ref=e717]
                  - cell "0 F CFA" [ref=e718]
                  - cell "0 F CFA" [ref=e719]
                  - cell "Payé" [ref=e720]
                - row [ref=e724]:
                  - cell [ref=e725]:
                    - time [ref=e726]: mer. 18 nov. 2026 à 05:14
                  - cell "71f24e3b-b1c7-434c-9d6a-5bc42a65f491" [ref=e727]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=e728]:
                    - generic [ref=e729]:
                      - generic [ref=e730]: Billets
                      - generic [ref=e731]: Nuit du Sabar — édition d’automne
                  - cell "6 300 F CFA" [ref=e732]
                  - cell "300 F CFA" [ref=e733]
                  - cell "205,5 F CFA" [ref=e734]
                  - cell "Payé" [ref=e735]
                - row [ref=e739]:
                  - cell [ref=e740]:
                    - time [ref=e741]: mer. 18 nov. 2026 à 05:00
                  - cell "0e364272-5091-4c9b-a8b6-7777dd5a3170" [ref=e742]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=e743]:
                    - generic [ref=e744]:
                      - generic [ref=e745]: Billets
                      - generic [ref=e746]: Nuit du Sabar — édition d’automne
                  - cell "3 150 F CFA" [ref=e747]
                  - cell "150 F CFA" [ref=e748]
                  - cell "102,75 F CFA" [ref=e749]
                  - cell "Payé" [ref=e750]
                - row [ref=e754]:
                  - cell [ref=e755]:
                    - time [ref=e756]: mer. 18 nov. 2026 à 04:46
                  - cell "67c05056-f0e4-4c72-9775-f9983726cd1f" [ref=e757]
                  - cell "Billets Rencontres du conte et de la parole" [ref=e758]:
                    - generic [ref=e759]:
                      - generic [ref=e760]: Billets
                      - generic [ref=e761]: Rencontres du conte et de la parole
                  - cell "3 150 F CFA" [ref=e762]
                  - cell "150 F CFA" [ref=e763]
                  - cell "102,75 F CFA" [ref=e764]
                  - cell "Payé" [ref=e765]
                - row [ref=e769]:
                  - cell [ref=e770]:
                    - time [ref=e771]: mer. 18 nov. 2026 à 04:12
                  - cell "3c93eb2d-6d06-4be7-958e-44c7671c5571" [ref=e772]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=e773]:
                    - generic [ref=e774]:
                      - generic [ref=e775]: Billets
                      - generic [ref=e776]: Marché gourmand de la Petite-Côte
                  - cell "5 250 F CFA" [ref=e777]
                  - cell "250 F CFA" [ref=e778]
                  - cell "171,25 F CFA" [ref=e779]
                  - cell "Payé" [ref=e780]
                - row [ref=e784]:
                  - cell [ref=e785]:
                    - time [ref=e786]: mer. 18 nov. 2026 à 04:02
                  - cell "fa1f0d02-256b-4de7-80bc-d870f73643c3" [ref=e787]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=e788]:
                    - generic [ref=e789]:
                      - generic [ref=e790]: Billets
                      - generic [ref=e791]: Marché gourmand de la Petite-Côte
                  - cell "4 200 F CFA" [ref=e792]
                  - cell "200 F CFA" [ref=e793]
                  - cell "137 F CFA" [ref=e794]
                  - cell "Payé" [ref=e795]
                - row [ref=e799]:
                  - cell [ref=e800]:
                    - time [ref=e801]: mer. 18 nov. 2026 à 03:14
                  - cell "0bca5b28-ee7d-45b5-b3f1-13f9f50aaf8f" [ref=e802]
                  - cell "Billets Festival Jazz sur le Fleuve" [ref=e803]:
                    - generic [ref=e804]:
                      - generic [ref=e805]: Billets
                      - generic [ref=e806]: Festival Jazz sur le Fleuve
                  - cell "15 750 F CFA" [ref=e807]
                  - cell "750 F CFA" [ref=e808]
                  - cell "513,75 F CFA" [ref=e809]
                  - cell "Payé" [ref=e810]
                - row [ref=e814]:
                  - cell [ref=e815]:
                    - time [ref=e816]: mer. 18 nov. 2026 à 02:57
                  - cell "2c425498-7ea2-4b11-80b2-3c5dc290fce4" [ref=e817]
                  - cell "Billets Croisière musicale vers Gorée" [ref=e818]:
                    - generic [ref=e819]:
                      - generic [ref=e820]: Billets
                      - generic [ref=e821]: Croisière musicale vers Gorée
                  - cell "31 500 F CFA" [ref=e822]
                  - cell "1 500 F CFA" [ref=e823]
                  - cell "-472,5 F CFA" [ref=e824]
                  - cell "Payé" [ref=e825]
                - row [ref=e829]:
                  - cell [ref=e830]:
                    - time [ref=e831]: mer. 18 nov. 2026 à 02:34
                  - cell "01593687-242e-4707-9c73-7e0487a737c1" [ref=e832]
                  - cell "Billets Marché gourmand de la Petite-Côte" [ref=e833]:
                    - generic [ref=e834]:
                      - generic [ref=e835]: Billets
                      - generic [ref=e836]: Marché gourmand de la Petite-Côte
                  - cell "10 500 F CFA" [ref=e837]
                  - cell "500 F CFA" [ref=e838]
                  - cell "342,5 F CFA" [ref=e839]
                  - cell "Payé" [ref=e840]
                - row [ref=e844]:
                  - cell [ref=e845]:
                    - time [ref=e846]: mer. 18 nov. 2026 à 02:33
                  - cell "5401afd7-be49-4a69-9fce-df7cf20f19e8" [ref=e847]
                  - cell "Billets Dîner-spectacle au bord du Saloum" [ref=e848]:
                    - generic [ref=e849]:
                      - generic [ref=e850]: Billets
                      - generic [ref=e851]: Dîner-spectacle au bord du Saloum
                  - cell "52 500 F CFA" [ref=e852]
                  - cell "2 500 F CFA" [ref=e853]
                  - cell "1 712,5 F CFA" [ref=e854]
                  - cell "Payé" [ref=e855]
                - row [ref=e859]:
                  - cell [ref=e860]:
                    - time [ref=e861]: mer. 18 nov. 2026 à 02:00
                  - cell "f131f7e1-29a3-401e-bedb-cb9fc26f555f" [ref=e862]
                  - cell "Billets Croisière musicale vers Gorée" [ref=e863]:
                    - generic [ref=e864]:
                      - generic [ref=e865]: Billets
                      - generic [ref=e866]: Croisière musicale vers Gorée
                  - cell "15 750 F CFA" [ref=e867]
                  - cell "750 F CFA" [ref=e868]
                  - cell "-236,25 F CFA" [ref=e869]
                  - cell "Remboursé" [ref=e870]
                - row [ref=e874]:
                  - cell [ref=e875]:
                    - time [ref=e876]: mer. 18 nov. 2026 à 01:44
                  - cell "c61ef107-735d-4150-9263-2853bc1859f6" [ref=e877]
                  - cell "Billets Nuit du Sabar — édition d’automne" [ref=e878]:
                    - generic [ref=e879]:
                      - generic [ref=e880]: Billets
                      - generic [ref=e881]: Nuit du Sabar — édition d’automne
                  - cell "15 750 F CFA" [ref=e882]
                  - cell "750 F CFA" [ref=e883]
                  - cell "513,75 F CFA" [ref=e884]
                  - cell "Payé" [ref=e885]
                - row [ref=e889]:
                  - cell [ref=e890]:
                    - time [ref=e891]: mer. 18 nov. 2026 à 01:42
                  - cell "bb659cd6-1442-479e-9f56-6981f2765b4d" [ref=e892]
                  - cell "Billets Carnaval des enfants de Saly" [ref=e893]:
                    - generic [ref=e894]:
                      - generic [ref=e895]: Billets
                      - generic [ref=e896]: Carnaval des enfants de Saly
                  - cell "4 200 F CFA" [ref=e897]
                  - cell "200 F CFA" [ref=e898]
                  - cell "137 F CFA" [ref=e899]
                  - cell "Payé" [ref=e900]
            - navigation "Pages des paiements" [ref=e904]:
              - button "Précédent" [disabled] [ref=e905]
              - paragraph [ref=e910]:
                - text: Page 1 sur 7
                - generic [ref=e911]: · 131 résultats
              - button "Suivant" [ref=e912] [cursor=pointer]
  - alert [ref=e917]
  - alertdialog [ref=e920]:
    - generic [ref=e921]:
      - heading "Marquer ce versement versé ?" [level=2] [ref=e924]
      - button "Fermer" [ref=e925] [cursor=pointer]
    - generic [ref=e931]:
      - paragraph [ref=e936]: "Un SMS part tout de suite à 78 ••• •• 52 : ne le faites qu’après avoir vérifié le versement. Vérifiez auprès du support SamirPay que ce versement est bien parti, puis indiquez sa référence. Il sera confirmé sans nouvel envoi. Prévenu : le client par SMS, notification et email (si une adresse vérifiée), sans votre motif."
      - generic [ref=e937]:
        - generic [ref=e938]:
          - term [ref=e939]: Montant
          - definition [ref=e940]: 3 150 F CFA
          - term [ref=e941]: Versement
          - definition [ref=e942]: Annulation d’événement · Festival Jazz sur le Fleuve
          - term [ref=e943]: Bénéficiaire
          - definition [ref=e944]: 78 ••• •• 52
          - term [ref=e945]: État
          - definition [ref=e946]: Issue incertaine
        - generic [ref=e947]:
          - generic [ref=e948]:
            - generic [ref=e949]:
              - text: Justification*
              - generic [ref=e950]: (obligatoire)
            - generic [ref=e951]: 0 / 500
          - textbox "Justification (obligatoire)" [active] [ref=e952]
          - paragraph [ref=e953]: 10 caractères au moins, gardée au journal des décisions.
        - generic [ref=e954]:
          - generic [ref=e956]:
            - text: Référence SamirPay*
            - generic [ref=e957]: (obligatoire)
          - textbox "Référence SamirPay (obligatoire)" [ref=e958]
          - paragraph [ref=e959]: Référence de la transaction (TX suivi de 8 caractères) ou son identifiant, lue dans le tableau de bord SamirPay.
        - generic [ref=e960]:
          - generic [ref=e961]: Frais SamirPay (F CFA), facultatif
          - textbox "Frais SamirPay (F CFA), facultatif" [ref=e963]
          - paragraph [ref=e964]: Frais réellement prélevés, s’ils sont connus.
    - generic [ref=e965]:
      - button "Annuler" [ref=e966] [cursor=pointer]
      - button "Marquer versé" [disabled] [ref=e968]
```

# Test source

```ts
  210 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  211 |             }
  212 |             if (screen.injectError) {
  213 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  214 |                 await page.route(screen.injectError, (route) => route.fulfill({
  215 |                     status: 500,
  216 |                     contentType: 'application/json; charset=utf-8',
  217 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  218 |                 }));
  219 |             }
  220 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  221 |             for (const stub of stubs) {
  222 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  223 |                 await page.route(stub.url, async (route) => {
  224 |                     if (!methodMatches(stub.method, route.request().method())) {
  225 |                         await route.fallback();
  226 |                         return;
  227 |                     }
  228 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  229 |                 });
  230 |             }
  231 |             for (const hold of screen.holdRequests ?? []) {
  232 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  233 |                 await page.route(hold.url, async (route) => {
  234 |                     if (!methodMatches(hold.method, route.request().method())) {
  235 |                         await route.fallback();
  236 |                         return;
  237 |                     }
  238 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  239 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  240 |                 });
  241 |             }
  242 |             if (screen.fakePush) {
  243 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  244 |                 record.notes.push(screen.fakePush === 'granted'
  245 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  246 |                     : screen.fakePush === 'denied'
  247 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  248 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  249 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  250 |             }
  251 |             if (screen.fakeCamera) {
  252 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  253 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  254 |                 await context.addInitScript(installFakeCamera, { mode });
  255 |             }
  256 |             if (screen.offline === 'before-load') {
  257 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  258 |                 guard.freeze();
  259 |                 await context.setOffline(true);
  260 |             }
  261 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  262 |             record.status = response ? response.status() : null;
  263 |             if (screen.expectStatus !== undefined) {
  264 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  265 |             }
  266 |             if (screen.offline === 'after-load') {
  267 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  268 |                 guard.freeze();
  269 |                 await context.setOffline(true);
  270 |             }
  271 |             const sc = { page, context, guard, ids: demo };
  272 |             if (screen.ready) await screen.ready(sc);
  273 |             await settle(page, guard, record.notes);
  274 |             if (screen.actions) {
  275 |                 await screen.actions(sc);
  276 |                 await settle(page, guard, record.notes);
  277 |             }
  278 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  279 |                 const problem = await markAllOnOneLine(page);
  280 |                 if (problem) record.blocking.push(problem);
  281 |             }
  282 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  283 |             record.blocking.push(...checks.blocking);
  284 |             record.warnings.push(...checks.warnings);
  285 |             record.axeDetails = checks.axeDetails;
  286 |             record.smallTextDetails = checks.smallTextDetails;
  287 |             record.metrics = checks.metrics;
  288 |             const shot = await capture(page, screen, file);
  289 |             record.captured = true;
  290 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  291 |         } catch (err) {
  292 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  293 |             if (!record.captured && !page.isClosed()) {
  294 |                 await capture(page, screen, file).then(
  295 |                     async (shot) => {
  296 |                         record.captured = true;
  297 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  298 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  299 |                     },
  300 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  301 |                 );
  302 |             }
  303 |             throw err;
  304 |         } finally {
  305 |             record.blocking.push(...guard.blockingIssues());
  306 |             record.warnings.push(...guard.nonBlockingIssues());
  307 |             record.durationMs = Date.now() - started;
  308 |             writeCaptureRecord(record);
  309 |         }
> 310 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de admin-versements-marquer-verse__ordinateur__sombre.png
  311 |     });
  312 | }
  313 | 
  314 | for (const theme of THEMES) {
  315 |     for (const role of ROLE_ORDER) {
  316 |         const screens = SCREENS.filter((s) => s.role === role);
  317 |         if (screens.length === 0) continue;
  318 |         test.describe(`${theme.key} · ${role}`, () => {
  319 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  320 | 
  321 |             for (const screen of screens) {
  322 |                 if (screen.serviceWorkers === 'allow') {
  323 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  324 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  325 |                         test.use({ serviceWorkers: 'allow' });
  326 |                         defineCapture(screen, theme, role);
  327 |                     });
  328 |                 } else {
  329 |                     defineCapture(screen, theme, role);
  330 |                 }
  331 |             }
  332 |         });
  333 |     }
  334 | }
  335 | 
```