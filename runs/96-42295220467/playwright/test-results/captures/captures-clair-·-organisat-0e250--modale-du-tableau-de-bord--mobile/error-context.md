# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-rapport-cloture — Rapport de clôture d’un événement terminé (modale du tableau de bord)
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: contrôles bloquants de partenaire-rapport-cloture__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   "valeur technique affichée : CLOTURE — ex. texte : « CLOTURE-7AEA2CF2-20261106 »",
+   "46 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « CLOTURE-7AEA2CF2-20261106 » (div.space-y-1.min-w-0 > div.flex.items-center > span.text-xs.font-mono) ; 12 px « lun. 2 nov. 2026 à 12:00 » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center) ; 12 px « Rooftop de la Pointe des Almadies » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center) ; 12 px « , » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center) ; 12 px « Dakar » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center)",
+   "axe-core color-contrast (serious, 7 nœud(s)) : Elements must meet minimum color contrast ratio thresholds",
+   "axe-core scrollable-region-focusable (serious, 2 nœud(s)) : Scrollable region must have keyboard access",
+   "axe-core target-size (serious, 1 nœud(s)) : All touch targets must be 24px large, or leave sufficient space",
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
        - generic [ref=e16]:
          - button "Notifications, 97 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "97"
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: MN
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - generic [ref=e37]: Espace organisateur
              - heading "Baobab Scène" [level=1] [ref=e39]
              - paragraph [ref=e40]: Ventes, entrées et solde de vos événements, mis à jour par le serveur.
            - generic [ref=e41]:
              - button "Actualiser" [ref=e42] [cursor=pointer]
              - link "Export comptable" [ref=e50] [cursor=pointer]:
                - /url: /api/partner/reports/accounting?format=csv
              - link "Scanner des billets" [ref=e54] [cursor=pointer]:
                - /url: /partner/scan
          - status [ref=e63]:
            - generic [ref=e69]:
              - paragraph [ref=e70]: Période d’essai gratuite en cours
              - generic [ref=e71]:
                - text: 150 jours offerts, jusqu’au
                - time [ref=e72]: mar. 5 janv. 2027
                - text: .
          - region [ref=e73]:
            - heading "Indicateurs" [level=2] [ref=e74]
            - generic [ref=e75]:
              - generic [ref=e76]:
                - paragraph [ref=e78]: Ventes en ligne
                - paragraph [ref=e83]: 978 000 F CFA
                - paragraph [ref=e84]: Prix des billets vendus en ligne, tous événements.
              - generic [ref=e85]:
                - paragraph [ref=e87]: Net partenaire
                - paragraph [ref=e92]: 828 000 F CFA
                - paragraph [ref=e93]: Après 150 000 F CFA de remboursements.
              - generic [ref=e94]:
                - paragraph [ref=e96]: Billets vendus
                - paragraph [ref=e100]: "130"
                - paragraph [ref=e101]: 68 entrées validées aux portes.
              - generic [ref=e102]:
                - paragraph [ref=e104]: Disponible au retrait
                - paragraph [ref=e109]: 0 F CFA
                - paragraph [ref=e110]: "Déjà versé : 0 F CFA."
            - paragraph [ref=e111]:
              - text: Les ventes en espèces au guichet (110 000 F CFA) et les invitations n’alimentent pas le solde.
              - link "Voir mes finances" [ref=e112] [cursor=pointer]:
                - /url: /partner/finance
          - region [ref=e114]:
            - generic [ref=e115]:
              - generic [ref=e116]:
                - heading "Mes événements" [level=2] [ref=e117]
                - generic [ref=e120]: 8 au total
              - link "Tous mes événements" [ref=e122] [cursor=pointer]:
                - /url: /partner/events
            - list "Ventes, entrées et rapports par événement" [ref=e125]:
              - listitem [ref=e126]:
                - generic [ref=e127]: Concert acoustique au jardin
                - generic [ref=e128]:
                  - term [ref=e129]: Événement
                  - definition [ref=e130]:
                    - generic [ref=e131]:
                      - generic [ref=e132]: Concert acoustique au jardin
                      - generic "En cours de rédaction par l’organisateur, visible de lui seul." [ref=e133]: Brouillon
                  - term [ref=e136]: Date et lieu
                  - definition [ref=e137]:
                    - generic [ref=e138]:
                      - time [ref=e139]: mer. 16 déc. 2026 à 19:00
                      - generic [ref=e140]: Dakar
                  - term [ref=e141]: Vendus / capacité
                  - definition [ref=e142]:
                    - generic [ref=e143]:
                      - generic [ref=e144]: 0 / 100
                      - generic [ref=e145]: 0 % rempli
                  - term [ref=e146]: Entrées
                  - definition [ref=e147]:
                    - generic [ref=e148]:
                      - generic [ref=e149]: "0"
                      - generic [ref=e150]: 0 % des vendus
                  - term [ref=e151]: Ventes en ligne
                  - definition [ref=e152]: 0 F CFA
                  - term [ref=e153]: Net partenaire
                  - definition [ref=e154]: 0 F CFA
                  - term [ref=e155]: Rapports
                  - definition [ref=e156]:
                    - generic [ref=e157]:
                      - button "Clôture" [ref=e158] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert acoustique au jardin" [ref=e164] [cursor=pointer]
                      - button "Exporter les ventes de Concert acoustique au jardin en CSV" [ref=e169] [cursor=pointer]
              - listitem [ref=e174]:
                - generic [ref=e175]: Matinée gospel et chorales
                - generic [ref=e176]:
                  - term [ref=e177]: Événement
                  - definition [ref=e178]:
                    - generic [ref=e179]:
                      - generic [ref=e180]: Matinée gospel et chorales
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=e181]: En attente de validation
                  - term [ref=e184]: Date et lieu
                  - definition [ref=e185]:
                    - generic [ref=e186]:
                      - time [ref=e187]: lun. 30 nov. 2026 à 10:00
                      - generic [ref=e188]: Dakar
                  - term [ref=e189]: Vendus / capacité
                  - definition [ref=e190]:
                    - generic [ref=e191]:
                      - generic [ref=e192]: 0 / 300
                      - generic [ref=e193]: 0 % rempli
                  - term [ref=e194]: Entrées
                  - definition [ref=e195]:
                    - generic [ref=e196]:
                      - generic [ref=e197]: "0"
                      - generic [ref=e198]: 0 % des vendus
                  - term [ref=e199]: Ventes en ligne
                  - definition [ref=e200]: 0 F CFA
                  - term [ref=e201]: Net partenaire
                  - definition [ref=e202]: 0 F CFA
                  - term [ref=e203]: Rapports
                  - definition [ref=e204]:
                    - generic [ref=e205]:
                      - button "Clôture" [ref=e206] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Matinée gospel et chorales" [ref=e212] [cursor=pointer]
                      - button "Exporter les ventes de Matinée gospel et chorales en CSV" [ref=e217] [cursor=pointer]
              - listitem [ref=e222]:
                - generic [ref=e223]: Croisière musicale vers Gorée
                - generic [ref=e224]:
                  - term [ref=e225]: Événement
                  - definition [ref=e226]:
                    - generic [ref=e227]:
                      - generic [ref=e228]: Croisière musicale vers Gorée
                      - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e229]': Annulé
                  - term [ref=e232]: Date et lieu
                  - definition [ref=e233]:
                    - generic [ref=e234]:
                      - time [ref=e235]: mar. 24 nov. 2026 à 17:30
                      - generic [ref=e236]: Dakar
                  - term [ref=e237]: Vendus / capacité
                  - definition [ref=e238]:
                    - generic [ref=e239]:
                      - generic [ref=e240]: 0 / 120
                      - generic [ref=e241]: 0 % rempli
                  - term [ref=e242]: Entrées
                  - definition [ref=e243]:
                    - generic [ref=e244]:
                      - generic [ref=e245]: "0"
                      - generic [ref=e246]: 0 % des vendus
                  - term [ref=e247]: Ventes en ligne
                  - definition [ref=e248]: 150 000 F CFA
                  - term [ref=e249]: Net partenaire
                  - definition [ref=e250]: 0 F CFA
                  - term [ref=e251]: Rapports
                  - definition [ref=e252]:
                    - generic [ref=e253]:
                      - button "Clôture" [ref=e254] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Croisière musicale vers Gorée" [ref=e260] [cursor=pointer]
                      - button "Exporter les ventes de Croisière musicale vers Gorée en CSV" [ref=e265] [cursor=pointer]
              - listitem [ref=e270]:
                - generic [ref=e271]: Soirée Kora & Lumières
                - generic [ref=e272]:
                  - term [ref=e273]: Événement
                  - definition [ref=e274]:
                    - generic [ref=e275]:
                      - generic [ref=e276]: Soirée Kora & Lumières
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e277]': Publié
                  - term [ref=e280]: Date et lieu
                  - definition [ref=e281]:
                    - generic [ref=e282]:
                      - time [ref=e283]: lun. 23 nov. 2026 à 20:30
                      - generic [ref=e284]: Dakar
                  - term [ref=e285]: Vendus / capacité
                  - definition [ref=e286]:
                    - generic [ref=e287]:
                      - generic [ref=e288]: 5 / 150
                      - generic [ref=e289]: 3 % rempli
                  - term [ref=e290]: Entrées
                  - definition [ref=e291]:
                    - generic [ref=e292]:
                      - generic [ref=e293]: "0"
                      - generic [ref=e294]: 0 % des vendus
                  - term [ref=e295]: Ventes en ligne
                  - definition [ref=e296]: 42 000 F CFA
                  - term [ref=e297]: Net partenaire
                  - definition [ref=e298]: 42 000 F CFA
                  - term [ref=e299]: Rapports
                  - definition [ref=e300]:
                    - generic [ref=e301]:
                      - button "Clôture" [ref=e302] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Soirée Kora & Lumières" [ref=e308] [cursor=pointer]
                      - button "Exporter les ventes de Soirée Kora & Lumières en CSV" [ref=e313] [cursor=pointer]
              - listitem [ref=e318]:
                - generic [ref=e319]: Festival Jazz sur le Fleuve
                - generic [ref=e320]:
                  - term [ref=e321]: Événement
                  - definition [ref=e322]:
                    - generic [ref=e323]:
                      - generic [ref=e324]: Festival Jazz sur le Fleuve
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e325]': Publié
                  - term [ref=e328]: Date et lieu
                  - definition [ref=e329]:
                    - generic [ref=e330]:
                      - time [ref=e331]: mer. 18 nov. 2026 à 18:00
                      - generic [ref=e332]: Saint-Louis
                  - term [ref=e333]: Vendus / capacité
                  - definition [ref=e334]:
                    - generic [ref=e335]:
                      - generic [ref=e336]: 22 / 400
                      - generic [ref=e337]: 6 % rempli
                  - term [ref=e338]: Entrées
                  - definition [ref=e339]:
                    - generic [ref=e340]:
                      - generic [ref=e341]: "0"
                      - generic [ref=e342]: 0 % des vendus
                  - term [ref=e343]: Ventes en ligne
                  - definition [ref=e344]: 201 000 F CFA
                  - term [ref=e345]: Net partenaire
                  - definition [ref=e346]: 201 000 F CFA
                  - term [ref=e347]: Rapports
                  - definition [ref=e348]:
                    - generic [ref=e349]:
                      - button "Clôture" [ref=e350] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Festival Jazz sur le Fleuve" [ref=e356] [cursor=pointer]
                      - button "Exporter les ventes de Festival Jazz sur le Fleuve en CSV" [ref=e361] [cursor=pointer]
              - listitem [ref=e366]:
                - generic [ref=e367]: Concert des Lumières de Gorée
                - generic [ref=e368]:
                  - term [ref=e369]: Événement
                  - definition [ref=e370]:
                    - generic [ref=e371]:
                      - generic [ref=e372]: Concert des Lumières de Gorée
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e373]': Publié
                  - term [ref=e376]: Date et lieu
                  - definition [ref=e377]:
                    - generic [ref=e378]:
                      - time [ref=e379]: sam. 7 nov. 2026 à 17:30
                      - generic [ref=e380]: Gorée
                  - term [ref=e381]: Vendus / capacité
                  - definition [ref=e382]:
                    - generic [ref=e383]:
                      - generic [ref=e384]: 11 / 250
                      - generic [ref=e385]: 4 % rempli
                  - term [ref=e386]: Entrées
                  - definition [ref=e387]:
                    - generic [ref=e388]:
                      - generic [ref=e389]: "0"
                      - generic [ref=e390]: 0 % des vendus
                  - term [ref=e391]: Ventes en ligne
                  - definition [ref=e392]: 84 000 F CFA
                  - term [ref=e393]: Net partenaire
                  - definition [ref=e394]: 84 000 F CFA
                  - term [ref=e395]: Rapports
                  - definition [ref=e396]:
                    - generic [ref=e397]:
                      - button "Clôture" [ref=e398] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert des Lumières de Gorée" [ref=e404] [cursor=pointer]
                      - button "Exporter les ventes de Concert des Lumières de Gorée en CSV" [ref=e409] [cursor=pointer]
              - listitem [ref=e414]:
                - generic [ref=e415]: Nuit du Sabar — édition d’automne
                - generic [ref=e416]:
                  - term [ref=e417]: Événement
                  - definition [ref=e418]:
                    - generic [ref=e419]:
                      - generic [ref=e420]: Nuit du Sabar — édition d’automne
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e421]': Publié
                  - term [ref=e424]: Date et lieu
                  - definition [ref=e425]:
                    - generic [ref=e426]:
                      - time [ref=e427]: ven. 6 nov. 2026 à 22:15
                      - generic [ref=e428]: Dakar
                  - term [ref=e429]: Vendus / capacité
                  - definition [ref=e430]:
                    - generic [ref=e431]:
                      - generic [ref=e432]: 82 / 300
                      - generic [ref=e433]: 27 % rempli
                  - term [ref=e434]: Entrées
                  - definition [ref=e435]:
                    - generic [ref=e436]:
                      - generic [ref=e437]: "60"
                      - generic [ref=e438]: 73 % des vendus
                  - term [ref=e439]: Ventes en ligne
                  - definition [ref=e440]: 351 000 F CFA
                  - term [ref=e441]: Net partenaire
                  - definition [ref=e442]: 351 000 F CFA
                  - term [ref=e443]: Rapports
                  - definition [ref=e444]:
                    - generic [ref=e445]:
                      - button "Clôture" [ref=e446] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Nuit du Sabar — édition d’automne" [ref=e452] [cursor=pointer]
                      - button "Exporter les ventes de Nuit du Sabar — édition d’automne en CSV" [ref=e457] [cursor=pointer]
              - listitem [ref=e462]:
                - generic [ref=e463]: Brunch électro des Almadies
                - generic [ref=e464]:
                  - term [ref=e465]: Événement
                  - definition [ref=e466]:
                    - generic [ref=e467]:
                      - generic [ref=e468]: Brunch électro des Almadies
                      - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=e469]': Terminé
                  - term [ref=e472]: Date et lieu
                  - definition [ref=e473]:
                    - generic [ref=e474]:
                      - time [ref=e475]: lun. 2 nov. 2026 à 12:00
                      - generic [ref=e476]: Dakar
                  - term [ref=e477]: Vendus / capacité
                  - definition [ref=e478]:
                    - generic [ref=e479]:
                      - generic [ref=e480]: 10 / 80
                      - generic [ref=e481]: 13 % rempli
                  - term [ref=e482]: Entrées
                  - definition [ref=e483]:
                    - generic [ref=e484]:
                      - generic [ref=e485]: "8"
                      - generic [ref=e486]: 80 % des vendus
                  - term [ref=e487]: Ventes en ligne
                  - definition [ref=e488]: 150 000 F CFA
                  - term [ref=e489]: Net partenaire
                  - definition [ref=e490]: 150 000 F CFA
                  - term [ref=e491]: Rapports
                  - definition [ref=e492]:
                    - generic [ref=e493]:
                      - button "Clôture" [ref=e494] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Brunch électro des Almadies" [ref=e500] [cursor=pointer]
                      - button "Exporter les ventes de Brunch électro des Almadies en CSV" [ref=e505] [cursor=pointer]
          - region [ref=e511]:
            - heading "Activité récente" [level=2] [ref=e512]
            - list [ref=e515]:
              - listitem [ref=e516]:
                - generic [ref=e521]:
                  - paragraph [ref=e522]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e523]: Billet TCK-20261106-AFD0D7FF32 · 5 000 F CFA
                - time [ref=e524]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e525]:
                - generic [ref=e530]:
                  - paragraph [ref=e531]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e532]: Billet TCK-20261106-F8F80CA495 · 5 000 F CFA
                - time [ref=e533]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e534]:
                - generic [ref=e539]:
                  - paragraph [ref=e540]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e541]: Billet TCK-20261106-A0E5C0E90A · 5 000 F CFA
                - time [ref=e542]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e543]:
                - generic [ref=e548]:
                  - paragraph [ref=e549]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e550]: Billet TCK-20261106-40697CB989 · 5 000 F CFA
                - time [ref=e551]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e552]:
                - generic [ref=e557]:
                  - paragraph [ref=e558]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e559]: Billet TCK-20261106-B03D1C44F2 · 15 000 F CFA
                - time [ref=e560]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e561]:
                - generic [ref=e566]:
                  - paragraph [ref=e567]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e568]: Billet TCK-20261106-2124CD6580 · 15 000 F CFA
                - time [ref=e569]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e570]:
                - generic [ref=e575]:
                  - paragraph [ref=e576]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e577]: Billet TCK-20261106-B679089A0D · 15 000 F CFA
                - time [ref=e578]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e579]:
                - generic [ref=e584]:
                  - paragraph [ref=e585]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e586]: Billet TCK-20261106-3818540BA6 · 5 000 F CFA
                - time [ref=e587]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e588]:
                - generic [ref=e594]:
                  - paragraph [ref=e595]: Commande CMD-DEMO-1794000670198-40C2AC
                  - paragraph [ref=e596]: Sur place · 15 000 F CFA
                - time [ref=e597]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e598]:
                - generic [ref=e607]:
                  - paragraph [ref=e608]: Entrée validée
                  - paragraph [ref=e609]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e610]: ven. 6 nov. 2026 à 21:28
              - listitem [ref=e611]:
                - generic [ref=e620]:
                  - paragraph [ref=e621]: Entrée validée
                  - paragraph [ref=e622]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e623]: ven. 6 nov. 2026 à 21:27
              - listitem [ref=e624]:
                - generic [ref=e633]:
                  - paragraph [ref=e634]: Entrée validée
                  - paragraph [ref=e635]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e636]: ven. 6 nov. 2026 à 21:25
              - listitem [ref=e637]:
                - generic [ref=e646]:
                  - paragraph [ref=e647]: Entrée validée
                  - paragraph [ref=e648]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e649]: ven. 6 nov. 2026 à 21:24
              - listitem [ref=e650]:
                - generic [ref=e659]:
                  - paragraph [ref=e660]: Entrée validée
                  - paragraph [ref=e661]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e662]: ven. 6 nov. 2026 à 21:22
    - navigation "Navigation rapide" [ref=e663]:
      - generic [ref=e664]:
        - link "Accueil" [ref=e665] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e672] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e676] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e684] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e688] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e693]
  - dialog [active] [ref=e696]:
    - generic [ref=e697]:
      - generic [ref=e703]:
        - heading "Rapport de Clôture & Bilan Z" [level=2] [ref=e704]
        - paragraph [ref=e705]: Brunch électro des Almadies
      - button "Fermer" [ref=e706] [cursor=pointer]
    - generic [ref=e712]:
      - generic [ref=e713]:
        - generic [ref=e714]:
          - generic [ref=e715]:
            - generic [ref=e716]: CLOTURE-7AEA2CF2-20261106
            - generic [ref=e717]: Clôture Certifiée
          - heading "Brunch électro des Almadies" [level=4] [ref=e719]
          - generic [ref=e720]:
            - generic [ref=e721]: lun. 2 nov. 2026 à 12:00
            - generic [ref=e724]: Rooftop de la Pointe des Almadies, Dakar
        - generic [ref=e728]:
          - generic [ref=e729]: Net Partenaire à Reverser
          - text: 150 000 F CFA
      - generic [ref=e730]:
        - generic [ref=e731]:
          - generic [ref=e732]: Billets Vendus
          - generic [ref=e739]: 10 / 80
          - paragraph [ref=e740]: "Taux de remplissage : 13%"
        - generic [ref=e741]:
          - generic [ref=e742]: Entrées Validées (Scan)
          - generic [ref=e750]: 8 entrées
          - paragraph [ref=e751]: "Taux de présence : 80%"
        - generic [ref=e752]:
          - generic [ref=e753]: Paiements Confirmés
          - generic [ref=e757]: 7 transactions
          - paragraph [ref=e758]: "Ventes en ligne : 150 000 F CFA"
      - generic [ref=e759]:
        - heading "1. Ventilation des Ventes par Catégorie" [level=5] [ref=e760]
        - table [ref=e762]:
          - rowgroup [ref=e763]:
            - row [ref=e764]:
              - columnheader "Formule / Catégorie" [ref=e765]
              - columnheader "Prix Unit." [ref=e766]
              - columnheader "Alloués" [ref=e767]
              - columnheader "Vendus" [ref=e768]
              - columnheader "Compostés" [ref=e769]
              - columnheader "Ventes en ligne" [ref=e770]
          - rowgroup [ref=e771]:
            - row [ref=e772]:
              - cell "Brunch" [ref=e773]
              - cell "15 000 F CFA" [ref=e774]
              - cell "80" [ref=e775]
              - cell "10" [ref=e776]
              - cell "8" [ref=e777]
              - cell "150 000 F CFA" [ref=e778]
      - generic [ref=e779]:
        - heading "2. Synthèse Comptable & Reversement Net" [level=5] [ref=e780]
        - generic [ref=e784]:
          - generic [ref=e785]:
            - generic [ref=e786]: "Ventes en ligne (prix faciaux des billets) :"
            - generic [ref=e787]: 150 000 F CFA
          - generic [ref=e788]:
            - generic [ref=e789]: "Montant Net à Reverser au Partenaire :"
            - generic [ref=e790]: 150 000 F CFA
          - generic [ref=e791]: "Dont disponible : 0 F CFA · en attente : 150 000 F CFA"
          - generic [ref=e793]:
            - generic [ref=e794]: "Frais de service payés par l'acheteur (non déduits) :"
            - generic [ref=e795]: 7 500 F CFA
          - generic [ref=e796]:
            - generic [ref=e797]: "Ventes espèces au guichet (0 billet, hors plateforme, informatif) :"
            - generic [ref=e798]: 0 F CFA
    - generic [ref=e800]:
      - generic [ref=e801]: Document certifié Event Village • Conforme CDC V3.0
      - generic [ref=e806]:
        - button "Export CSV / Excel" [ref=e807] [cursor=pointer]
        - button "Télécharger PDF Officiel" [ref=e813] [cursor=pointer]
```

# Test source

```ts
  184 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  185 |             }
  186 |             if (screen.injectError) {
  187 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  188 |                 await page.route(screen.injectError, (route) => route.fulfill({
  189 |                     status: 500,
  190 |                     contentType: 'application/json; charset=utf-8',
  191 |                     body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  192 |                 }));
  193 |             }
  194 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  195 |             for (const stub of stubs) {
  196 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  197 |                 await page.route(stub.url, async (route) => {
  198 |                     if (!methodMatches(stub.method, route.request().method())) {
  199 |                         await route.fallback();
  200 |                         return;
  201 |                     }
  202 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  203 |                 });
  204 |             }
  205 |             for (const hold of screen.holdRequests ?? []) {
  206 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  207 |                 await page.route(hold.url, async (route) => {
  208 |                     if (!methodMatches(hold.method, route.request().method())) {
  209 |                         await route.fallback();
  210 |                         return;
  211 |                     }
  212 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  213 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  214 |                 });
  215 |             }
  216 |             if (screen.fakePush) {
  217 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  218 |                 record.notes.push(screen.fakePush === 'granted'
  219 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  220 |                     : screen.fakePush === 'denied'
  221 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  222 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  223 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  224 |             }
  225 |             if (screen.fakeCamera) {
  226 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  227 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  228 |                 await context.addInitScript(installFakeCamera, { mode });
  229 |             }
  230 |             if (screen.offline === 'before-load') {
  231 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  232 |                 guard.freeze();
  233 |                 await context.setOffline(true);
  234 |             }
  235 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  236 |             record.status = response ? response.status() : null;
  237 |             if (screen.expectStatus !== undefined) {
  238 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  239 |             }
  240 |             if (screen.offline === 'after-load') {
  241 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  242 |                 guard.freeze();
  243 |                 await context.setOffline(true);
  244 |             }
  245 |             const sc = { page, context, guard, ids: demo };
  246 |             if (screen.ready) await screen.ready(sc);
  247 |             await settle(page, guard, record.notes);
  248 |             if (screen.actions) {
  249 |                 await screen.actions(sc);
  250 |                 await settle(page, guard, record.notes);
  251 |             }
  252 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  253 |                 const problem = await markAllOnOneLine(page);
  254 |                 if (problem) record.blocking.push(problem);
  255 |             }
  256 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  257 |             record.blocking.push(...checks.blocking);
  258 |             record.warnings.push(...checks.warnings);
  259 |             record.axeDetails = checks.axeDetails;
  260 |             record.smallTextDetails = checks.smallTextDetails;
  261 |             record.metrics = checks.metrics;
  262 |             const shot = await capture(page, screen, file);
  263 |             record.captured = true;
  264 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  265 |         } catch (err) {
  266 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  267 |             if (!record.captured && !page.isClosed()) {
  268 |                 await capture(page, screen, file).then(
  269 |                     async (shot) => {
  270 |                         record.captured = true;
  271 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  272 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  273 |                     },
  274 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  275 |                 );
  276 |             }
  277 |             throw err;
  278 |         } finally {
  279 |             record.blocking.push(...guard.blockingIssues());
  280 |             record.warnings.push(...guard.nonBlockingIssues());
  281 |             record.durationMs = Date.now() - started;
  282 |             writeCaptureRecord(record);
  283 |         }
> 284 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de partenaire-rapport-cloture__mobile__clair.png
  285 |     });
  286 | }
  287 | 
  288 | for (const theme of THEMES) {
  289 |     for (const role of ROLE_ORDER) {
  290 |         const screens = SCREENS.filter((s) => s.role === role);
  291 |         if (screens.length === 0) continue;
  292 |         test.describe(`${theme.key} · ${role}`, () => {
  293 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  294 | 
  295 |             for (const screen of screens) {
  296 |                 if (screen.serviceWorkers === 'allow') {
  297 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  298 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  299 |                         test.use({ serviceWorkers: 'allow' });
  300 |                         defineCapture(screen, theme, role);
  301 |                     });
  302 |                 } else {
  303 |                     defineCapture(screen, theme, role);
  304 |                 }
  305 |             }
  306 |         });
  307 |     }
  308 | }
  309 | 
```