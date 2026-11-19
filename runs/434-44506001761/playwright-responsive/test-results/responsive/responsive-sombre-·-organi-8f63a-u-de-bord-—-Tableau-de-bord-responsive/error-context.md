# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-tableau-de-bord — Tableau de bord
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-tableau-de-bord (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 10

- Array []
+ Array [
+   "360 px : texte hors de l’écran : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » de 81 à 374 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » de 81 à 395 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » de 81 à 374 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » de 81 à 393 px (fenêtre 360 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 360 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » de 81 à 488 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » de 81 à 395 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » de 81 à 397 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 360 px)",
+   "360 px : texte coupé : p.truncate.text-sm « Entrée validée » dépasse de p.truncate.text-sm «  »",
+   "360 px : texte tronqué sans le texte entier : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Entrée validée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Entrée validée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (139×6 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (139×6 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-F6445248D5 · 10 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FB784700E3 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-C30E048138 · 5 000 F CFA » (139×6 px)",
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Rapports » de 787 à 849 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Rapports » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
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
        - generic [ref=f2e10]:
          - paragraph [ref=f2e11]: Gestion
          - generic [ref=f2e12]:
            - link "Tableau de bord" [ref=f2e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f2e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f2e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f2e31]:
          - paragraph [ref=f2e32]: Outils
          - generic [ref=f2e33]:
            - link "Finances" [ref=f2e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f2e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f2e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f2e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f2e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f2e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f2e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f2e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e73]: MN
          - generic [ref=f2e74]:
            - generic [ref=f2e75]: Mariama Ndiaye
            - generic [ref=f2e76]: Partenaire
        - generic [ref=f2e77]:
          - button "Se déconnecter" [ref=f2e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e83] [cursor=pointer]
    - generic [ref=f2e87]:
      - banner [ref=f2e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f2e97] [cursor=pointer]:
          - generic [ref=f2e101]: 99+
      - main [ref=f2e102]:
        - generic [ref=f2e104]:
          - generic [ref=f2e106]:
            - generic [ref=f2e107]:
              - generic [ref=f2e108]: Espace partenaire
              - heading "Baobab Scène" [level=1] [ref=f2e110]
              - paragraph [ref=f2e111]: Ventes, entrées et solde de vos événements.
            - generic [ref=f2e112]:
              - button "Actualiser" [ref=f2e113] [cursor=pointer]
              - link "Export comptable" [ref=f2e121] [cursor=pointer]:
                - /url: /api/partner/reports/accounting?format=csv
              - link "Scanner des billets" [ref=f2e125] [cursor=pointer]:
                - /url: /partner/scan
          - status [ref=f2e134]:
            - generic [ref=f2e140]:
              - paragraph [ref=f2e141]: Période d’essai gratuite en cours
              - generic [ref=f2e142]:
                - text: 150 jours offerts, jusqu’au
                - time [ref=f2e143]: lun. 18 janv. 2027
                - text: .
          - region [ref=f2e144]:
            - heading "Indicateurs" [level=2] [ref=f2e145]
            - generic [ref=f2e146]:
              - generic [ref=f2e147]:
                - paragraph [ref=f2e149]: Ventes en ligne
                - paragraph [ref=f2e154]: 978 000 F CFA
                - paragraph [ref=f2e155]: Prix des billets vendus en ligne, tous événements.
              - generic [ref=f2e156]:
                - paragraph [ref=f2e158]: Net partenaire
                - paragraph [ref=f2e163]: 828 000 F CFA
                - paragraph [ref=f2e164]: Après 150 000 F CFA de remboursements.
              - generic [ref=f2e165]:
                - paragraph [ref=f2e167]: Billets vendus
                - paragraph [ref=f2e171]: "134"
                - paragraph [ref=f2e172]: 71 entrées validées aux portes.
              - generic [ref=f2e173]:
                - paragraph [ref=f2e175]: Disponible au retrait
                - paragraph [ref=f2e180]: 0 F CFA
                - paragraph [ref=f2e181]: "Déjà versé : 0 F CFA."
            - paragraph [ref=f2e182]:
              - text: Les ventes en espèces au guichet (138 000 F CFA) et les invitations n’alimentent pas le solde.
              - link "Voir mes finances" [ref=f2e183] [cursor=pointer]:
                - /url: /partner/finance
          - region [ref=f2e185]:
            - generic [ref=f2e186]:
              - generic [ref=f2e187]:
                - heading "Mes événements" [level=2] [ref=f2e188]
                - generic [ref=f2e191]: 9 au total
              - link "Tous mes événements" [ref=f2e193] [cursor=pointer]:
                - /url: /partner/events
            - table [ref=f2e197]:
              - caption [ref=f2e198]: Ventes, entrées et rapports par événement
              - rowgroup [ref=f2e199]:
                - row [ref=f2e200]:
                  - columnheader "Événement" [ref=f2e201]
                  - columnheader "Date et lieu" [ref=f2e202]
                  - columnheader "Vendus / capacité" [ref=f2e203]
                  - columnheader "Entrées" [ref=f2e204]
                  - columnheader "Ventes en ligne" [ref=f2e205]
                  - columnheader "Net partenaire" [ref=f2e206]
                  - columnheader "Rapports" [ref=f2e207]
              - rowgroup [ref=f2e208]:
                - row [ref=f2e209]:
                  - cell "Concert acoustique au jardin Brouillon" [ref=f2e210]:
                    - generic [ref=f2e211]:
                      - generic [ref=f2e212]: Concert acoustique au jardin
                      - generic "En cours de rédaction par l’organisateur, visible de lui seul." [ref=f2e213]: Brouillon
                  - cell "mar. 29 déc. 2026 à 19:00 Dakar" [ref=f2e216]:
                    - generic [ref=f2e217]:
                      - time [ref=f2e218]: mar. 29 déc. 2026 à 19:00
                      - generic [ref=f2e219]: Dakar
                  - cell "0 / 100 0 % rempli" [ref=f2e220]:
                    - generic [ref=f2e221]:
                      - generic [ref=f2e222]: 0 / 100
                      - generic [ref=f2e223]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=f2e224]:
                    - generic [ref=f2e225]:
                      - generic [ref=f2e226]: "0"
                      - generic [ref=f2e227]: 0 % des vendus
                  - cell "0 F CFA" [ref=f2e228]
                  - cell "0 F CFA" [ref=f2e229]
                  - cell [ref=f2e230]:
                    - generic [ref=f2e231]:
                      - button "Clôture" [ref=f2e232] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert acoustique au jardin" [ref=f2e238] [cursor=pointer]
                      - button "Exporter les ventes de Concert acoustique au jardin en CSV" [ref=f2e243] [cursor=pointer]
                - row [ref=f2e248]:
                  - cell "Matinée gospel et chorales En attente de validation" [ref=f2e249]:
                    - generic [ref=f2e250]:
                      - generic [ref=f2e251]: Matinée gospel et chorales
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f2e252]: En attente de validation
                  - cell "dim. 13 déc. 2026 à 10:00 Dakar" [ref=f2e255]:
                    - generic [ref=f2e256]:
                      - time [ref=f2e257]: dim. 13 déc. 2026 à 10:00
                      - generic [ref=f2e258]: Dakar
                  - cell "0 / 300 0 % rempli" [ref=f2e259]:
                    - generic [ref=f2e260]:
                      - generic [ref=f2e261]: 0 / 300
                      - generic [ref=f2e262]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=f2e263]:
                    - generic [ref=f2e264]:
                      - generic [ref=f2e265]: "0"
                      - generic [ref=f2e266]: 0 % des vendus
                  - cell "0 F CFA" [ref=f2e267]
                  - cell "0 F CFA" [ref=f2e268]
                  - cell [ref=f2e269]:
                    - generic [ref=f2e270]:
                      - button "Clôture" [ref=f2e271] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Matinée gospel et chorales" [ref=f2e277] [cursor=pointer]
                      - button "Exporter les ventes de Matinée gospel et chorales en CSV" [ref=f2e282] [cursor=pointer]
                - row [ref=f2e287]:
                  - cell "Soirée Kora & Lumières Publié" [ref=f2e288]:
                    - generic [ref=f2e289]:
                      - generic [ref=f2e290]: Soirée Kora & Lumières
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e291]': Publié
                  - cell "dim. 6 déc. 2026 à 20:30 Dakar" [ref=f2e294]:
                    - generic [ref=f2e295]:
                      - time [ref=f2e296]: dim. 6 déc. 2026 à 20:30
                      - generic [ref=f2e297]: Dakar
                  - cell "5 / 150 3 % rempli" [ref=f2e298]:
                    - generic [ref=f2e299]:
                      - generic [ref=f2e300]: 5 / 150
                      - generic [ref=f2e301]: 3 % rempli
                  - cell "0 0 % des vendus" [ref=f2e302]:
                    - generic [ref=f2e303]:
                      - generic [ref=f2e304]: "0"
                      - generic [ref=f2e305]: 0 % des vendus
                  - cell "42 000 F CFA" [ref=f2e306]
                  - cell "42 000 F CFA" [ref=f2e307]
                  - cell [ref=f2e308]:
                    - generic [ref=f2e309]:
                      - button "Clôture" [ref=f2e310] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Soirée Kora & Lumières" [ref=f2e316] [cursor=pointer]
                      - button "Exporter les ventes de Soirée Kora & Lumières en CSV" [ref=f2e321] [cursor=pointer]
                - row [ref=f2e326]:
                  - cell "Festival Jazz sur le Fleuve Publié" [ref=f2e327]:
                    - generic [ref=f2e328]:
                      - generic [ref=f2e329]: Festival Jazz sur le Fleuve
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e330]': Publié
                  - cell "mar. 1 déc. 2026 à 18:00 Saint-Louis" [ref=f2e333]:
                    - generic [ref=f2e334]:
                      - time [ref=f2e335]: mar. 1 déc. 2026 à 18:00
                      - generic [ref=f2e336]: Saint-Louis
                  - cell "22 / 400 6 % rempli" [ref=f2e337]:
                    - generic [ref=f2e338]:
                      - generic [ref=f2e339]: 22 / 400
                      - generic [ref=f2e340]: 6 % rempli
                  - cell "0 0 % des vendus" [ref=f2e341]:
                    - generic [ref=f2e342]:
                      - generic [ref=f2e343]: "0"
                      - generic [ref=f2e344]: 0 % des vendus
                  - cell "201 000 F CFA" [ref=f2e345]
                  - cell "201 000 F CFA" [ref=f2e346]
                  - cell [ref=f2e347]:
                    - generic [ref=f2e348]:
                      - button "Clôture" [ref=f2e349] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Festival Jazz sur le Fleuve" [ref=f2e355] [cursor=pointer]
                      - button "Exporter les ventes de Festival Jazz sur le Fleuve en CSV" [ref=f2e360] [cursor=pointer]
                - row [ref=f2e365]:
                  - cell "Grande soirée du Monument de la Renaissance Validé" [ref=f2e366]:
                    - generic [ref=f2e367]:
                      - generic [ref=f2e368]: Grande soirée du Monument de la Renaissance
                      - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=f2e369]': Validé
                  - cell "dim. 22 nov. 2026 à 20:00 Dakar" [ref=f2e372]:
                    - generic [ref=f2e373]:
                      - time [ref=f2e374]: dim. 22 nov. 2026 à 20:00
                      - generic [ref=f2e375]: Dakar
                  - cell "1 / 170 1 % rempli" [ref=f2e376]:
                    - generic [ref=f2e377]:
                      - generic [ref=f2e378]: 1 / 170
                      - generic [ref=f2e379]: 1 % rempli
                  - cell "0 0 % des vendus" [ref=f2e380]:
                    - generic [ref=f2e381]:
                      - generic [ref=f2e382]: "0"
                      - generic [ref=f2e383]: 0 % des vendus
                  - cell "0 F CFA" [ref=f2e384]
                  - cell "0 F CFA" [ref=f2e385]
                  - cell [ref=f2e386]:
                    - generic [ref=f2e387]:
                      - button "Clôture" [ref=f2e388] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Grande soirée du Monument de la Renaissance" [ref=f2e394] [cursor=pointer]
                      - button "Exporter les ventes de Grande soirée du Monument de la Renaissance en CSV" [ref=f2e399] [cursor=pointer]
                - row [ref=f2e404]:
                  - cell "Concert des Lumières de Gorée Publié" [ref=f2e405]:
                    - generic [ref=f2e406]:
                      - generic [ref=f2e407]: Concert des Lumières de Gorée
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e408]': Publié
                  - cell "ven. 20 nov. 2026 à 06:45 Gorée" [ref=f2e411]:
                    - generic [ref=f2e412]:
                      - time [ref=f2e413]: ven. 20 nov. 2026 à 06:45
                      - generic [ref=f2e414]: Gorée
                  - cell "11 / 250 4 % rempli" [ref=f2e415]:
                    - generic [ref=f2e416]:
                      - generic [ref=f2e417]: 11 / 250
                      - generic [ref=f2e418]: 4 % rempli
                  - cell "0 0 % des vendus" [ref=f2e419]:
                    - generic [ref=f2e420]:
                      - generic [ref=f2e421]: "0"
                      - generic [ref=f2e422]: 0 % des vendus
                  - cell "84 000 F CFA" [ref=f2e423]
                  - cell "84 000 F CFA" [ref=f2e424]
                  - cell [ref=f2e425]:
                    - generic [ref=f2e426]:
                      - button "Clôture" [ref=f2e427] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert des Lumières de Gorée" [ref=f2e433] [cursor=pointer]
                      - button "Exporter les ventes de Concert des Lumières de Gorée en CSV" [ref=f2e438] [cursor=pointer]
                - row [ref=f2e443]:
                  - cell "Nuit du Sabar — édition d’automne Publié" [ref=f2e444]:
                    - generic [ref=f2e445]:
                      - generic [ref=f2e446]: Nuit du Sabar — édition d’automne
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e447]': Publié
                  - cell "jeu. 19 nov. 2026 à 11:30 Dakar" [ref=f2e450]:
                    - generic [ref=f2e451]:
                      - time [ref=f2e452]: jeu. 19 nov. 2026 à 11:30
                      - generic [ref=f2e453]: Dakar
                  - cell "83 / 300 28 % rempli" [ref=f2e454]:
                    - generic [ref=f2e455]:
                      - generic [ref=f2e456]: 83 / 300
                      - generic [ref=f2e457]: 28 % rempli
                  - cell "61 73 % des vendus" [ref=f2e458]:
                    - generic [ref=f2e459]:
                      - generic [ref=f2e460]: "61"
                      - generic [ref=f2e461]: 73 % des vendus
                  - cell "351 000 F CFA" [ref=f2e462]
                  - cell "351 000 F CFA" [ref=f2e463]
                  - cell [ref=f2e464]:
                    - generic [ref=f2e465]:
                      - button "Clôture" [ref=f2e466] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Nuit du Sabar — édition d’automne" [ref=f2e472] [cursor=pointer]
                      - button "Exporter les ventes de Nuit du Sabar — édition d’automne en CSV" [ref=f2e477] [cursor=pointer]
                - row [ref=f2e482]:
                  - cell "Croisière musicale vers Gorée Annulé" [ref=f2e483]:
                    - generic [ref=f2e484]:
                      - generic [ref=f2e485]: Croisière musicale vers Gorée
                      - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=f2e486]': Annulé
                  - cell "jeu. 19 nov. 2026 à 14:45 Dakar" [ref=f2e489]:
                    - generic [ref=f2e490]:
                      - time [ref=f2e491]: jeu. 19 nov. 2026 à 14:45
                      - generic [ref=f2e492]: Dakar
                  - cell "2 / 120 2 % rempli" [ref=f2e493]:
                    - generic [ref=f2e494]:
                      - generic [ref=f2e495]: 2 / 120
                      - generic [ref=f2e496]: 2 % rempli
                  - cell "2 100 % des vendus" [ref=f2e497]:
                    - generic [ref=f2e498]:
                      - generic [ref=f2e499]: "2"
                      - generic [ref=f2e500]: 100 % des vendus
                  - cell "150 000 F CFA" [ref=f2e501]
                  - cell "0 F CFA" [ref=f2e502]
                  - cell [ref=f2e503]:
                    - generic [ref=f2e504]:
                      - button "Clôture" [ref=f2e505] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Croisière musicale vers Gorée" [ref=f2e511] [cursor=pointer]
                      - button "Exporter les ventes de Croisière musicale vers Gorée en CSV" [ref=f2e516] [cursor=pointer]
                - row [ref=f2e521]:
                  - cell "Brunch électro des Almadies Terminé" [ref=f2e522]:
                    - generic [ref=f2e523]:
                      - generic [ref=f2e524]: Brunch électro des Almadies
                      - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=f2e525]': Terminé
                  - cell "dim. 15 nov. 2026 à 12:00 Dakar" [ref=f2e528]:
                    - generic [ref=f2e529]:
                      - time [ref=f2e530]: dim. 15 nov. 2026 à 12:00
                      - generic [ref=f2e531]: Dakar
                  - cell "10 / 80 13 % rempli" [ref=f2e532]:
                    - generic [ref=f2e533]:
                      - generic [ref=f2e534]: 10 / 80
                      - generic [ref=f2e535]: 13 % rempli
                  - cell "8 80 % des vendus" [ref=f2e536]:
                    - generic [ref=f2e537]:
                      - generic [ref=f2e538]: "8"
                      - generic [ref=f2e539]: 80 % des vendus
                  - cell "150 000 F CFA" [ref=f2e540]
                  - cell "150 000 F CFA" [ref=f2e541]
                  - cell [ref=f2e542]:
                    - generic [ref=f2e543]:
                      - button "Clôture" [ref=f2e544] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Brunch électro des Almadies" [ref=f2e550] [cursor=pointer]
                      - button "Exporter les ventes de Brunch électro des Almadies en CSV" [ref=f2e555] [cursor=pointer]
          - region [ref=f2e561]:
            - heading "Activité récente" [level=2] [ref=f2e562]
            - list [ref=f2e565]:
              - listitem [ref=f2e566]:
                - generic [ref=f2e571]:
                  - paragraph [ref=f2e572]: "Billet vendu : Croisière musicale vers Gorée"
                  - paragraph [ref=f2e573]: Billet TCK-20261119-63D6A7A031 · 9 000 F CFA
                - time [ref=f2e574]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e575]:
                - generic [ref=f2e580]:
                  - paragraph [ref=f2e581]: "Billet vendu : Croisière musicale vers Gorée"
                  - paragraph [ref=f2e582]: Billet TCK-20261119-4F17201CC6 · 9 000 F CFA
                - time [ref=f2e583]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e584]:
                - generic [ref=f2e593]:
                  - paragraph [ref=f2e594]: Entrée validée
                  - paragraph [ref=f2e595]: Croisière musicale vers Gorée · contrôle à l’entrée
                - time [ref=f2e596]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e597]:
                - generic [ref=f2e606]:
                  - paragraph [ref=f2e607]: Entrée validée
                  - paragraph [ref=f2e608]: Croisière musicale vers Gorée · contrôle à l’entrée
                - time [ref=f2e609]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e610]:
                - generic [ref=f2e615]:
                  - paragraph [ref=f2e616]: "Billet vendu : Grande soirée du Monument de la Renaissance"
                  - paragraph [ref=f2e617]: Billet TCK-20261119-FA5CD4181F · 0 F CFA
                - time [ref=f2e618]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e619]:
                - generic [ref=f2e624]:
                  - paragraph [ref=f2e625]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f2e626]: Billet TCK-20261119-3A906F91A0 · 5 000 F CFA
                - time [ref=f2e627]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e628]:
                - generic [ref=f2e633]:
                  - paragraph [ref=f2e634]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f2e635]: Billet TCK-20261119-629F5E3A44 · 5 000 F CFA
                - time [ref=f2e636]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e637]:
                - generic [ref=f2e642]:
                  - paragraph [ref=f2e643]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f2e644]: Billet TCK-20261119-F6445248D5 · 10 000 F CFA
                - time [ref=f2e645]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e646]:
                - generic [ref=f2e651]:
                  - paragraph [ref=f2e652]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f2e653]: Billet TCK-20261119-FB784700E3 · 5 000 F CFA
                - time [ref=f2e654]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e655]:
                - generic [ref=f2e660]:
                  - paragraph [ref=f2e661]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f2e662]: Billet TCK-20261119-C30E048138 · 5 000 F CFA
                - time [ref=f2e663]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e664]:
                - generic [ref=f2e670]:
                  - paragraph [ref=f2e671]: Commande CMD-DEMO-1795084471761-90FDF0
                  - paragraph [ref=f2e672]: Sur place · 5 000 F CFA
                - time [ref=f2e673]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f2e674]:
                - generic [ref=f2e683]:
                  - paragraph [ref=f2e684]: Entrée validée
                  - paragraph [ref=f2e685]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=f2e686]: jeu. 19 nov. 2026 à 10:31
              - listitem [ref=f2e687]:
                - generic [ref=f2e696]:
                  - paragraph [ref=f2e697]: Entrée validée
                  - paragraph [ref=f2e698]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=f2e699]: jeu. 19 nov. 2026 à 10:29
              - listitem [ref=f2e700]:
                - generic [ref=f2e709]:
                  - paragraph [ref=f2e710]: Entrée validée
                  - paragraph [ref=f2e711]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=f2e712]: jeu. 19 nov. 2026 à 10:28
  - alert [ref=f2e713]
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
      |                                                                                        ^ Error: contrôles responsive de org-tableau-de-bord (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```