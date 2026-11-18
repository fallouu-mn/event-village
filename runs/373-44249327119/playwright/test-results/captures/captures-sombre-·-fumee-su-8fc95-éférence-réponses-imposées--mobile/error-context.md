# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-versements-marquer-verse — Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-versements-marquer-verse__mobile__sombre.png

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
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications, 58 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "58"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Elhadji SuperAdmin)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: ES
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e32]:
            - generic [ref=e33]:
              - heading "Finance" [level=1] [ref=e34]
              - paragraph [ref=e35]: Ce que gagne Event Village, ce qui est dû aux partenaires et ce qui peut sortir du compte SamirPay.
            - link "Réglages de la plateforme" [ref=e37] [cursor=pointer]:
              - /url: /admin/finance-settings
          - group [ref=e43]:
            - heading "Période" [level=2] [ref=e47]
            - generic [ref=e49]:
              - generic [ref=e50]: Afficher
              - combobox "Afficher" [ref=e53] [cursor=pointer]:
                - option "Aujourd’hui"
                - option "7 derniers jours"
                - option "30 derniers jours"
                - option "Ce mois-ci" [selected]
                - option "Mois dernier"
                - option "Dates choisies…"
            - paragraph [ref=e54]: "Période affichée : du 1er au 18 novembre 2026. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant."
          - generic [ref=e55]:
            - region [ref=e56]:
              - heading "Gagné par Event Village" [level=2] [ref=e58]
              - paragraph [ref=e63]: 57 266,72 F CFA
              - paragraph [ref=e64]: "Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits."
              - paragraph [ref=e65]: Paiements encaissés, retraits versés et versements confirmés du 1er au 18 novembre 2026.
              - link "Voir le détail" [ref=e66] [cursor=pointer]:
                - /url: "#detail-gagne"
            - region [ref=e67]:
              - heading "Dû aux partenaires" [level=2] [ref=e69]
              - paragraph [ref=e74]: 1 749 000 F CFA
              - paragraph [ref=e75]: "L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village."
              - paragraph [ref=e76]: "Dont 0 F CFA retirables aujourd’hui. Dû aux parrains : 0 F CFA. À l’instant."
              - link "Voir le détail" [ref=e77] [cursor=pointer]:
                - /url: "#du-aux-partenaires"
            - region [ref=e78]:
              - heading "Retirable par Event Village" [level=2] [ref=e80]
              - paragraph [ref=e84]: 47 166 275 F CFA
              - paragraph [ref=e85]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
              - paragraph [ref=e86]:
                - text: Solde SamirPay lu à
                - time [ref=e87]: 06:26
                - text: ", moins tout ce qui est dû et la réserve de prudence."
              - link "Voir le calcul" [ref=e88] [cursor=pointer]:
                - /url: "#calcul-retirable"
            - region [ref=e89]:
              - heading "Créances" [level=2] [ref=e91]
              - paragraph [ref=e97]: 0 F CFA
              - paragraph [ref=e98]: Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre.
              - paragraph [ref=e99]: Aucune créance à l’instant.
              - link "Voir les créances" [ref=e100] [cursor=pointer]:
                - /url: "#creances"
          - region [ref=e102]:
            - generic [ref=e103]:
              - heading "Versements à reprendre" [level=2] [ref=e104]
              - paragraph [ref=e105]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - list "Versements à reprendre" [ref=e107]:
              - listitem [ref=e108]:
                - generic [ref=e109]:
                  - generic [ref=e110]:
                    - paragraph [ref=e111]: 5 250 F CFA
                    - generic [ref=e112]: Envoi en échec
                  - generic [ref=e116]:
                    - paragraph [ref=e117]: Remboursement d’un billet
                    - paragraph [ref=e118]: Croisière musicale vers Gorée
                  - paragraph [ref=e119]: Refusé par l’opérateur Mobile Money
                  - generic [ref=e120]:
                    - generic [ref=e121]: 77 ••• •• 34
                    - time [ref=e122]: mer. 4 nov. 2026 à 18:30
                  - generic [ref=e124]:
                    - button "Renvoyer le versement de 5 250 F CFA" [ref=e125] [cursor=pointer]:
                      - generic [ref=e130]: Renvoyer
                    - button "Marquer versé le versement de 5 250 F CFA" [ref=e131] [cursor=pointer]:
                      - generic [ref=e136]: Marquer versé
              - listitem [ref=e137]:
                - generic [ref=e138]:
                  - generic [ref=e139]:
                    - paragraph [ref=e140]: 48 500 F CFA
                    - generic [ref=e141]: Bloqué
                  - paragraph [ref=e146]: Retrait
                  - paragraph [ref=e147]: Solde SamirPay insuffisant
                  - generic [ref=e148]:
                    - generic [ref=e149]: 76 ••• •• 18
                    - time [ref=e150]: mer. 4 nov. 2026 à 19:05
                  - generic [ref=e152]:
                    - button "Renvoyer le versement de 48 500 F CFA" [ref=e153] [cursor=pointer]:
                      - generic [ref=e158]: Renvoyer
                    - button "Marquer versé le versement de 48 500 F CFA" [ref=e159] [cursor=pointer]:
                      - generic [ref=e164]: Marquer versé
              - listitem [ref=e165]:
                - generic [ref=e166]:
                  - generic [ref=e167]:
                    - paragraph [ref=e168]: 3 150 F CFA
                    - generic [ref=e169]: Issue incertaine
                  - generic [ref=e173]:
                    - paragraph [ref=e174]: Annulation d’événement
                    - paragraph [ref=e175]: Festival Jazz sur le Fleuve
                  - generic [ref=e176]:
                    - generic [ref=e177]: 78 ••• •• 52
                    - time [ref=e178]: mer. 4 nov. 2026 à 20:40
                  - generic [ref=e179]:
                    - paragraph [ref=e180]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                    - generic [ref=e181]:
                      - button "Marquer versé le versement de 3 150 F CFA" [ref=e182] [cursor=pointer]:
                        - generic [ref=e187]: Marquer versé
                      - button "Constater non versé le versement de 3 150 F CFA" [ref=e188] [cursor=pointer]:
                        - generic [ref=e193]: Constater non versé
              - listitem [ref=e194]:
                - generic [ref=e195]:
                  - generic [ref=e196]:
                    - paragraph [ref=e197]: 10 500 F CFA
                    - generic [ref=e198]: Envoyé, non confirmé
                  - generic [ref=e202]:
                    - paragraph [ref=e203]: Remboursement d’un paiement
                    - paragraph [ref=e204]: Nuit du Sabar — édition d’automne
                  - generic [ref=e205]:
                    - generic [ref=e206]: 70 ••• •• 61
                    - time [ref=e207]: mer. 4 nov. 2026 à 21:10
                  - generic [ref=e209]:
                    - button "Renvoyer le versement de 10 500 F CFA" [ref=e210] [cursor=pointer]:
                      - generic [ref=e215]: Renvoyer
                    - button "Marquer versé le versement de 10 500 F CFA" [ref=e216] [cursor=pointer]:
                      - generic [ref=e221]: Marquer versé
              - listitem [ref=e222]:
                - generic [ref=e223]:
                  - generic [ref=e224]:
                    - paragraph [ref=e225]: 7 350 F CFA
                    - generic [ref=e226]: Bloqué
                  - generic [ref=e230]:
                    - paragraph [ref=e231]: Remboursement d’un billet
                    - paragraph [ref=e232]: Croisière musicale vers Gorée
                  - paragraph [ref=e233]: Opérateur Mobile Money inconnu
                  - generic [ref=e234]:
                    - generic [ref=e235]: 77 ••• •• 09
                    - time [ref=e236]: mer. 4 nov. 2026 à 21:45
                  - button "Marquer versé le versement de 7 350 F CFA" [ref=e239] [cursor=pointer]:
                    - generic [ref=e244]: Marquer versé
          - region [ref=e245]:
            - generic [ref=e246]:
              - heading "Remboursements à verser" [level=2] [ref=e247]
              - paragraph [ref=e248]: Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
              - paragraph [ref=e249]: 4 remboursements pour 88 200 F CFA.
            - list "Remboursements à verser" [ref=e251]:
              - listitem [ref=e252]:
                - generic [ref=e253]: 31 500 F CFA
                - generic [ref=e254]:
                  - term [ref=e255]: Demandé le
                  - definition [ref=e256]:
                    - time [ref=e257]: mer. 18 nov. 2026 à 06:13
                  - term [ref=e258]: Remboursement
                  - definition [ref=e259]:
                    - generic [ref=e260]:
                      - generic [ref=e261]: Remboursement d’une annulation
                      - generic [ref=e262]: Croisière musicale vers Gorée
                  - term [ref=e263]: Client
                  - definition [ref=e264]: Ibou M. · 70*****16
                  - term [ref=e265]: Montant
                  - definition [ref=e266]: 31 500 F CFA
                  - term [ref=e267]: Où il en est
                  - definition [ref=e268]:
                    - generic [ref=e269]: Envoyé, en attente de confirmation
              - listitem [ref=e271]:
                - generic [ref=e272]: 9 450 F CFA
                - generic [ref=e273]:
                  - term [ref=e274]: Demandé le
                  - definition [ref=e275]:
                    - time [ref=e276]: mer. 18 nov. 2026 à 06:13
                  - term [ref=e277]: Remboursement
                  - definition [ref=e278]:
                    - generic [ref=e279]:
                      - generic [ref=e280]: Remboursement d’une annulation
                      - generic [ref=e281]: Croisière musicale vers Gorée
                  - term [ref=e282]: Client
                  - definition [ref=e283]: Ibou M. · 70*****16
                  - term [ref=e284]: Montant
                  - definition [ref=e285]: 9 450 F CFA
                  - term [ref=e286]: Où il en est
                  - definition [ref=e287]:
                    - generic [ref=e288]: Envoyé, en attente de confirmation
              - listitem [ref=e290]:
                - generic [ref=e291]: 31 500 F CFA
                - generic [ref=e292]:
                  - term [ref=e293]: Demandé le
                  - definition [ref=e294]:
                    - time [ref=e295]: mer. 18 nov. 2026 à 06:13
                  - term [ref=e296]: Remboursement
                  - definition [ref=e297]:
                    - generic [ref=e298]:
                      - generic [ref=e299]: Remboursement d’une annulation
                      - generic [ref=e300]: Croisière musicale vers Gorée
                  - term [ref=e301]: Client
                  - definition [ref=e302]: Awa D. · 70*****01
                  - term [ref=e303]: Montant
                  - definition [ref=e304]: 31 500 F CFA
                  - term [ref=e305]: Où il en est
                  - definition [ref=e306]:
                    - generic [ref=e307]:
                      - generic [ref=e308]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=e309] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
              - listitem [ref=e310]:
                - generic [ref=e311]: 15 750 F CFA
                - generic [ref=e312]:
                  - term [ref=e313]: Demandé le
                  - definition [ref=e314]:
                    - time [ref=e315]: mer. 18 nov. 2026 à 06:13
                  - term [ref=e316]: Remboursement
                  - definition [ref=e317]:
                    - generic [ref=e318]:
                      - generic [ref=e319]: Remboursement d’une annulation
                      - generic [ref=e320]: Croisière musicale vers Gorée
                  - term [ref=e321]: Client
                  - definition [ref=e322]: Modou M. · 70*****18
                  - term [ref=e323]: Montant
                  - definition [ref=e324]: 15 750 F CFA
                  - term [ref=e325]: Où il en est
                  - definition [ref=e326]:
                    - generic [ref=e327]:
                      - generic [ref=e328]: "Issue incertaine : à vérifier"
                      - link "Traiter dans « Versements à reprendre »" [ref=e329] [cursor=pointer]:
                        - /url: "#versements-a-reprendre"
          - region [ref=e330]:
            - generic [ref=e331]:
              - heading "Créances" [level=2] [ref=e332]
              - paragraph [ref=e333]: Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ; ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
            - generic [ref=e334]:
              - heading "Aucune créance" [level=3] [ref=e339]
              - paragraph [ref=e340]: Personne ne doit d’argent à Event Village.
          - region [ref=e341]:
            - generic [ref=e342]:
              - heading "Détail de ce qui a été gagné" [level=2] [ref=e343]
              - paragraph [ref=e344]: "Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés du 1er au 18 novembre 2026."
            - generic [ref=e345]:
              - generic [ref=e346]:
                - term [ref=e347]:
                  - generic [ref=e348]: Frais de service, moins les frais d’encaissement SamirPay
                  - generic [ref=e349]: "131 paiements encaissés du 1er au 18 novembre 2026 : 94 550 F CFA de frais de service, 29 783,28 F CFA de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas)."
                - definition [ref=e350]: + 64 766,72 F CFA
              - generic [ref=e351]:
                - term [ref=e352]:
                  - generic [ref=e353]: Part rendue avec les remboursements
                  - generic [ref=e354]: Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.
                - definition [ref=e355]: − 7 500 F CFA
              - generic [ref=e356]:
                - term [ref=e357]:
                  - generic [ref=e358]: Frais de retrait
                  - generic [ref=e359]: 0 retrait versé du 1er au 18 novembre 2026.
                - definition [ref=e360]: + 0 F CFA
              - generic [ref=e361]:
                - term [ref=e362]:
                  - generic [ref=e363]: Frais SamirPay des versements
                  - generic [ref=e364]: Frais réels de 0 versement confirmé du 1er au 18 novembre 2026 (remboursements et retraits).
                - definition [ref=e365]: − 0 F CFA
              - generic [ref=e366]:
                - term [ref=e367]:
                  - generic [ref=e368]: Commissions de parrainage
                  - generic [ref=e369]: Sur les paiements encaissés de la période, annulations et reprises déduites.
                - definition [ref=e370]: − 0 F CFA
              - generic [ref=e371]:
                - term [ref=e372]:
                  - generic [ref=e373]: Gagné par Event Village
                - definition [ref=e374]: 57 266,72 F CFA
          - region [ref=e375]:
            - generic [ref=e376]:
              - heading "Dû aux partenaires" [level=2] [ref=e377]
              - paragraph [ref=e378]: L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
            - generic [ref=e379]:
              - generic [ref=e380]:
                - term [ref=e381]:
                  - generic [ref=e382]: Disponible pour les partenaires
                  - generic [ref=e383]: Dont 0 F CFA retirables tout de suite et 0 F CFA gelés (événements suspendus, libérés à la reprise).
                - definition [ref=e384]: 0 F CFA
              - generic [ref=e385]:
                - term [ref=e386]:
                  - generic [ref=e387]: En attente de la fin des événements
                - definition [ref=e388]: 1 749 000 F CFA
              - generic [ref=e389]:
                - term [ref=e390]:
                  - generic [ref=e391]: Retraits en cours d’envoi
                  - generic [ref=e392]: Demandés par les partenaires, pas encore confirmés par SamirPay.
                - definition [ref=e393]: 0 F CFA
              - generic [ref=e394]:
                - term [ref=e395]:
                  - generic [ref=e396]: Dû aux partenaires
                - definition [ref=e397]: 1 749 000 F CFA
            - list "Dû aux partenaires, compte par compte" [ref=e399]:
              - listitem [ref=e400]:
                - generic [ref=e401]: Baobab Scène Productions
                - generic [ref=e402]:
                  - term [ref=e403]: Partenaire
                  - definition [ref=e404]: Baobab Scène Productions
                  - term [ref=e405]: Dû
                  - definition [ref=e406]: 828 000 F CFA
                  - term [ref=e407]: Retirable aujourd’hui
                  - definition [ref=e408]: 0 F CFA
                  - term [ref=e409]: En attente
                  - definition [ref=e410]: 828 000 F CFA
                  - term [ref=e411]: Gelé
                  - definition [ref=e412]: 0 F CFA
                  - term [ref=e413]: Retrait en cours
                  - definition [ref=e414]: 0 F CFA
              - listitem [ref=e415]:
                - generic [ref=e416]: Sine-Saloum Culture & Loisirs
                - generic [ref=e417]:
                  - term [ref=e418]: Partenaire
                  - definition [ref=e419]: Sine-Saloum Culture & Loisirs
                  - term [ref=e420]: Dû
                  - definition [ref=e421]: 806 000 F CFA
                  - term [ref=e422]: Retirable aujourd’hui
                  - definition [ref=e423]: 0 F CFA
                  - term [ref=e424]: En attente
                  - definition [ref=e425]: 806 000 F CFA
                  - term [ref=e426]: Gelé
                  - definition [ref=e427]: 0 F CFA
                  - term [ref=e428]: Retrait en cours
                  - definition [ref=e429]: 0 F CFA
              - listitem [ref=e430]:
                - generic [ref=e431]: Atelier Petite-Côte
                - generic [ref=e432]:
                  - term [ref=e433]: Partenaire
                  - definition [ref=e434]: Atelier Petite-Côte
                  - term [ref=e435]: Dû
                  - definition [ref=e436]: 115 000 F CFA
                  - term [ref=e437]: Retirable aujourd’hui
                  - definition [ref=e438]: 0 F CFA
                  - term [ref=e439]: En attente
                  - definition [ref=e440]: 115 000 F CFA
                  - term [ref=e441]: Gelé
                  - definition [ref=e442]: 0 F CFA
                  - term [ref=e443]: Retrait en cours
                  - definition [ref=e444]: 0 F CFA
            - generic [ref=e445]:
              - heading "Dû aux parrains" [level=3] [ref=e446]
              - paragraph [ref=e447]: "Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village. Total : 0 F CFA."
              - generic [ref=e448]:
                - heading "Rien n’est dû aux parrains" [level=3] [ref=e455]
                - paragraph [ref=e456]: Aucun solde à verser pour le moment.
          - region [ref=e457]:
            - generic [ref=e458]:
              - heading "Calcul de ce qui est retirable" [level=2] [ref=e459]
              - paragraph [ref=e460]: Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. Si ce chiffre est à 0, ne retirez rien.
            - generic [ref=e461]:
              - generic [ref=e462]:
                - term [ref=e463]:
                  - generic [ref=e464]: Solde du compte SamirPay
                  - generic [ref=e465]:
                    - text: Lu à
                    - time [ref=e466]: 06:26
                    - text: (heure de Dakar), relu au plus toutes les 5 minutes.
                - definition [ref=e467]: 50 000 000 F CFA
              - generic [ref=e468]:
                - term [ref=e469]:
                  - generic [ref=e470]: Dû aux partenaires
                - definition [ref=e471]: − 1 749 000 F CFA
              - generic [ref=e472]:
                - term [ref=e473]:
                  - generic [ref=e474]: Dû aux parrains
                - definition [ref=e475]: − 0 F CFA
              - generic [ref=e476]:
                - term [ref=e477]:
                  - generic [ref=e478]: Remboursements à verser
                - definition [ref=e479]: − 88 200 F CFA
              - generic [ref=e480]:
                - term [ref=e481]:
                  - generic [ref=e482]: Réserve de prudence
                  - generic [ref=e483]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Automatique : les encaissements des 3 derniers jours, soit 996 525 F CFA aujourd’hui."
                - definition [ref=e484]: − 996 525 F CFA
              - generic [ref=e485]:
                - term [ref=e486]:
                  - generic [ref=e487]: Retirable par Event Village
                - definition [ref=e488]: 47 166 275 F CFA
            - link "Changer la réserve de prudence" [ref=e490] [cursor=pointer]:
              - /url: /admin/finance-settings
          - region [ref=e492]:
            - generic [ref=e493]:
              - heading "Paiements encaissés" [level=2] [ref=e494]
              - paragraph [ref=e498]: Paiements en ligne encaissés du 1er au 18 novembre 2026. Le statut choisi ne change que cette liste, jamais les chiffres du haut.
            - generic [ref=e499]:
              - generic [ref=e500]: Statut
              - combobox "Statut" [ref=e503] [cursor=pointer]:
                - option "Tous les paiements" [selected]
                - option "Payé"
                - option "Remboursé en partie"
                - option "Remboursement en cours"
                - option "Remboursé"
            - list "Paiements encaissés" [ref=e505]:
              - listitem [ref=e506]:
                - generic [ref=e507]:
                  - generic [ref=e508]:
                    - generic [ref=e509]: 9 450 F CFA
                    - generic [ref=e510]: Payé
                  - generic [ref=e512]: Billets · Nuit du slam de Kaolack
                  - time [ref=e513]: Encaissé le mer. 18 nov. 2026 à 06:13
                  - generic [ref=e514]: f60e3404-1d39-4e9c-964b-7344e43a3104
                  - generic [ref=e515]: Frais de service 450 F CFA · pour Event Village 308,25 F CFA
              - listitem [ref=e516]:
                - generic [ref=e517]:
                  - generic [ref=e518]:
                    - generic [ref=e519]: 9 450 F CFA
                    - generic [ref=e520]: Payé
                  - generic [ref=e522]: Billets · Nuit du slam de Kaolack
                  - time [ref=e523]: Encaissé le mer. 18 nov. 2026 à 06:13
                  - generic [ref=e524]: 5b6d460c-de30-492a-a859-4aba1f8ab1a7
                  - generic [ref=e525]: Frais de service 450 F CFA · pour Event Village 308,25 F CFA
              - listitem [ref=e526]:
                - generic [ref=e527]:
                  - generic [ref=e528]:
                    - generic [ref=e529]: 9 450 F CFA
                    - generic [ref=e530]: Payé
                  - generic [ref=e532]: Billets · Nuit du slam de Kaolack
                  - time [ref=e533]: Encaissé le mer. 18 nov. 2026 à 06:13
                  - generic [ref=e534]: 900bbcbd-88a3-4e15-9d2b-2b76c59390ae
                  - generic [ref=e535]: Frais de service 450 F CFA · pour Event Village 308,25 F CFA
              - listitem [ref=e536]:
                - generic [ref=e537]:
                  - generic [ref=e538]:
                    - generic [ref=e539]: 9 450 F CFA
                    - generic [ref=e540]: Payé
                  - generic [ref=e542]: Billets · Nuit du slam de Kaolack
                  - time [ref=e543]: Encaissé le mer. 18 nov. 2026 à 06:13
                  - generic [ref=e544]: e90dbf12-395d-4c77-b406-9d5c3da1c3ba
                  - generic [ref=e545]: Frais de service 450 F CFA · pour Event Village 308,25 F CFA
              - listitem [ref=e546]:
                - generic [ref=e547]:
                  - generic [ref=e548]:
                    - generic [ref=e549]: 9 450 F CFA
                    - generic [ref=e550]: Payé
                  - generic [ref=e552]: Billets · Nuit du slam de Kaolack
                  - time [ref=e553]: Encaissé le mer. 18 nov. 2026 à 06:13
                  - generic [ref=e554]: dd6a67e8-88ec-4400-94e2-35a1c681ca30
                  - generic [ref=e555]: Frais de service 450 F CFA · pour Event Village 308,25 F CFA
              - listitem [ref=e556]:
                - generic [ref=e557]:
                  - generic [ref=e558]:
                    - generic [ref=e559]: 9 450 F CFA
                    - generic [ref=e560]: Payé
                  - generic [ref=e562]: Billets · Nuit du slam de Kaolack
                  - time [ref=e563]: Encaissé le mer. 18 nov. 2026 à 06:13
                  - generic [ref=e564]: a11be73d-200e-495e-82e7-792cd3016384
                  - generic [ref=e565]: Frais de service 450 F CFA · pour Event Village 308,25 F CFA
              - listitem [ref=e566]:
                - generic [ref=e567]:
                  - generic [ref=e568]:
                    - generic [ref=e569]: 4 000 F CFA
                    - generic [ref=e570]: Payé
                  - generic [ref=e572]: Billets
                  - time [ref=e573]: Encaissé le mer. 18 nov. 2026 à 06:12
                  - generic [ref=e574]: TX-FIXTURE-TCK-FIXTURE-CLIENT-BIS-B-1
                  - generic [ref=e575]: Frais de service 0 F CFA · pour Event Village 0 F CFA
              - listitem [ref=e576]:
                - generic [ref=e577]:
                  - generic [ref=e578]:
                    - generic [ref=e579]: 5 000 F CFA
                    - generic [ref=e580]: Payé
                  - generic [ref=e582]: Billets
                  - time [ref=e583]: Encaissé le mer. 18 nov. 2026 à 06:12
                  - generic [ref=e584]: TX-FIXTURE-TCK-FIXTURE-CLIENT-A-1
                  - generic [ref=e585]: Frais de service 0 F CFA · pour Event Village 0 F CFA
              - listitem [ref=e586]:
                - generic [ref=e587]:
                  - generic [ref=e588]:
                    - generic [ref=e589]: 6 300 F CFA
                    - generic [ref=e590]: Payé
                  - generic [ref=e592]: Billets · Nuit du Sabar — édition d’automne
                  - time [ref=e593]: Encaissé le mer. 18 nov. 2026 à 05:14
                  - generic [ref=e594]: 71f24e3b-b1c7-434c-9d6a-5bc42a65f491
                  - generic [ref=e595]: Frais de service 300 F CFA · pour Event Village 205,5 F CFA
              - listitem [ref=e596]:
                - generic [ref=e597]:
                  - generic [ref=e598]:
                    - generic [ref=e599]: 3 150 F CFA
                    - generic [ref=e600]: Payé
                  - generic [ref=e602]: Billets · Nuit du Sabar — édition d’automne
                  - time [ref=e603]: Encaissé le mer. 18 nov. 2026 à 05:00
                  - generic [ref=e604]: 0e364272-5091-4c9b-a8b6-7777dd5a3170
                  - generic [ref=e605]: Frais de service 150 F CFA · pour Event Village 102,75 F CFA
              - listitem [ref=e606]:
                - generic [ref=e607]:
                  - generic [ref=e608]:
                    - generic [ref=e609]: 3 150 F CFA
                    - generic [ref=e610]: Payé
                  - generic [ref=e612]: Billets · Rencontres du conte et de la parole
                  - time [ref=e613]: Encaissé le mer. 18 nov. 2026 à 04:46
                  - generic [ref=e614]: 67c05056-f0e4-4c72-9775-f9983726cd1f
                  - generic [ref=e615]: Frais de service 150 F CFA · pour Event Village 102,75 F CFA
              - listitem [ref=e616]:
                - generic [ref=e617]:
                  - generic [ref=e618]:
                    - generic [ref=e619]: 5 250 F CFA
                    - generic [ref=e620]: Payé
                  - generic [ref=e622]: Billets · Marché gourmand de la Petite-Côte
                  - time [ref=e623]: Encaissé le mer. 18 nov. 2026 à 04:12
                  - generic [ref=e624]: 3c93eb2d-6d06-4be7-958e-44c7671c5571
                  - generic [ref=e625]: Frais de service 250 F CFA · pour Event Village 171,25 F CFA
              - listitem [ref=e626]:
                - generic [ref=e627]:
                  - generic [ref=e628]:
                    - generic [ref=e629]: 4 200 F CFA
                    - generic [ref=e630]: Payé
                  - generic [ref=e632]: Billets · Marché gourmand de la Petite-Côte
                  - time [ref=e633]: Encaissé le mer. 18 nov. 2026 à 04:02
                  - generic [ref=e634]: fa1f0d02-256b-4de7-80bc-d870f73643c3
                  - generic [ref=e635]: Frais de service 200 F CFA · pour Event Village 137 F CFA
              - listitem [ref=e636]:
                - generic [ref=e637]:
                  - generic [ref=e638]:
                    - generic [ref=e639]: 15 750 F CFA
                    - generic [ref=e640]: Payé
                  - generic [ref=e642]: Billets · Festival Jazz sur le Fleuve
                  - time [ref=e643]: Encaissé le mer. 18 nov. 2026 à 03:14
                  - generic [ref=e644]: 0bca5b28-ee7d-45b5-b3f1-13f9f50aaf8f
                  - generic [ref=e645]: Frais de service 750 F CFA · pour Event Village 513,75 F CFA
              - listitem [ref=e646]:
                - generic [ref=e647]:
                  - generic [ref=e648]:
                    - generic [ref=e649]: 31 500 F CFA
                    - generic [ref=e650]: Payé
                  - generic [ref=e652]: Billets · Croisière musicale vers Gorée
                  - time [ref=e653]: Encaissé le mer. 18 nov. 2026 à 02:57
                  - generic [ref=e654]: 2c425498-7ea2-4b11-80b2-3c5dc290fce4
                  - generic [ref=e655]: Frais de service 1 500 F CFA · pour Event Village -472,5 F CFA
              - listitem [ref=e656]:
                - generic [ref=e657]:
                  - generic [ref=e658]:
                    - generic [ref=e659]: 10 500 F CFA
                    - generic [ref=e660]: Payé
                  - generic [ref=e662]: Billets · Marché gourmand de la Petite-Côte
                  - time [ref=e663]: Encaissé le mer. 18 nov. 2026 à 02:34
                  - generic [ref=e664]: 01593687-242e-4707-9c73-7e0487a737c1
                  - generic [ref=e665]: Frais de service 500 F CFA · pour Event Village 342,5 F CFA
              - listitem [ref=e666]:
                - generic [ref=e667]:
                  - generic [ref=e668]:
                    - generic [ref=e669]: 52 500 F CFA
                    - generic [ref=e670]: Payé
                  - generic [ref=e672]: Billets · Dîner-spectacle au bord du Saloum
                  - time [ref=e673]: Encaissé le mer. 18 nov. 2026 à 02:33
                  - generic [ref=e674]: 5401afd7-be49-4a69-9fce-df7cf20f19e8
                  - generic [ref=e675]: Frais de service 2 500 F CFA · pour Event Village 1 712,5 F CFA
              - listitem [ref=e676]:
                - generic [ref=e677]:
                  - generic [ref=e678]:
                    - generic [ref=e679]: 15 750 F CFA
                    - generic [ref=e680]: Remboursé
                  - generic [ref=e682]: Billets · Croisière musicale vers Gorée
                  - time [ref=e683]: Encaissé le mer. 18 nov. 2026 à 02:00
                  - generic [ref=e684]: f131f7e1-29a3-401e-bedb-cb9fc26f555f
                  - generic [ref=e685]: Frais de service 750 F CFA · pour Event Village -236,25 F CFA
              - listitem [ref=e686]:
                - generic [ref=e687]:
                  - generic [ref=e688]:
                    - generic [ref=e689]: 15 750 F CFA
                    - generic [ref=e690]: Payé
                  - generic [ref=e692]: Billets · Nuit du Sabar — édition d’automne
                  - time [ref=e693]: Encaissé le mer. 18 nov. 2026 à 01:44
                  - generic [ref=e694]: c61ef107-735d-4150-9263-2853bc1859f6
                  - generic [ref=e695]: Frais de service 750 F CFA · pour Event Village 513,75 F CFA
              - listitem [ref=e696]:
                - generic [ref=e697]:
                  - generic [ref=e698]:
                    - generic [ref=e699]: 4 200 F CFA
                    - generic [ref=e700]: Payé
                  - generic [ref=e702]: Billets · Carnaval des enfants de Saly
                  - time [ref=e703]: Encaissé le mer. 18 nov. 2026 à 01:42
                  - generic [ref=e704]: bb659cd6-1442-479e-9f56-6981f2765b4d
                  - generic [ref=e705]: Frais de service 200 F CFA · pour Event Village 137 F CFA
            - navigation "Pages des paiements" [ref=e706]:
              - button "Précédent" [disabled] [ref=e707]
              - paragraph [ref=e712]: Page 1 sur 7
              - button "Suivant" [ref=e713] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e718]:
      - generic [ref=e719]:
        - link "Accueil" [ref=e720] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e727] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e731] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e738] [cursor=pointer]:
          - /url: /admin/finance
        - link "Audit" [ref=e742] [cursor=pointer]:
          - /url: /admin/audit
  - alert [ref=e746]
  - alertdialog [ref=e749]:
    - generic [ref=e750]:
      - heading "Marquer ce versement versé ?" [level=2] [ref=e753]
      - button "Fermer" [ref=e754] [cursor=pointer]
    - generic [ref=e760]:
      - paragraph [ref=e765]: "Un SMS part tout de suite à 78 ••• •• 52 : ne le faites qu’après avoir vérifié le versement. Vérifiez auprès du support SamirPay que ce versement est bien parti, puis indiquez sa référence. Il sera confirmé sans nouvel envoi. Prévenu : le client par SMS, notification et email (si une adresse vérifiée), sans votre motif."
      - generic [ref=e766]:
        - generic [ref=e767]:
          - term [ref=e768]: Montant
          - definition [ref=e769]: 3 150 F CFA
          - term [ref=e770]: Versement
          - definition [ref=e771]: Annulation d’événement · Festival Jazz sur le Fleuve
          - term [ref=e772]: Bénéficiaire
          - definition [ref=e773]: 78 ••• •• 52
          - term [ref=e774]: État
          - definition [ref=e775]: Issue incertaine
        - generic [ref=e776]:
          - generic [ref=e777]:
            - generic [ref=e778]:
              - text: Justification*
              - generic [ref=e779]: (obligatoire)
            - generic [ref=e780]: 0 / 500
          - textbox "Justification (obligatoire)" [active] [ref=e781]
          - paragraph [ref=e782]: 10 caractères au moins, gardée au journal des décisions.
        - generic [ref=e783]:
          - generic [ref=e785]:
            - text: Référence SamirPay*
            - generic [ref=e786]: (obligatoire)
          - textbox "Référence SamirPay (obligatoire)" [ref=e787]
          - paragraph [ref=e788]: Référence de la transaction (TX suivi de 8 caractères) ou son identifiant, lue dans le tableau de bord SamirPay.
        - generic [ref=e789]:
          - generic [ref=e790]: Frais SamirPay (F CFA), facultatif
          - textbox "Frais SamirPay (F CFA), facultatif" [ref=e792]
          - paragraph [ref=e793]: Frais réellement prélevés, s’ils sont connus.
    - generic [ref=e794]:
      - button "Annuler" [ref=e795] [cursor=pointer]
      - button "Marquer versé" [disabled] [ref=e797]
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
      |                                                                   ^ Error: contrôles bloquants de admin-versements-marquer-verse__mobile__sombre.png
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