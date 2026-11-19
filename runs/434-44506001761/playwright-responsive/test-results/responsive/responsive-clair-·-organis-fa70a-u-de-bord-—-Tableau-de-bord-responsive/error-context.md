# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-tableau-de-bord — Tableau de bord
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-tableau-de-bord (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 19

- Array []
+ Array [
+   "320 px : texte hors de l’écran : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » de 81 à 374 px (fenêtre 320 px) ; p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » de 81 à 395 px (fenêtre 320 px) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » de 81 à 374 px (fenêtre 320 px) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » de 81 à 393 px (fenêtre 320 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 320 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 320 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » de 81 à 488 px (fenêtre 320 px) ; p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » de 81 à 361 px (fenêtre 320 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 320 px) ; p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » de 81 à 395 px (fenêtre 320 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 320 px) ; p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » de 81 à 397 px (fenêtre 320 px)",
+   "320 px : texte tronqué sans le texte entier : span.truncate « En attente de validation » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Entrée validée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Entrée validée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » (points de suspension, texte entier absent)",
+   "320 px : textes qui se chevauchent : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (139×6 px) ; p.truncate.text-sm « Entrée validée » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (30×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (139×6 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (139×6 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-F6445248D5 · 10 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FB784700E3 · 5 000 F CFA » (139×6 px)",
+   "360 px : texte hors de l’écran : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » de 81 à 374 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » de 81 à 395 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » de 81 à 374 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » de 81 à 393 px (fenêtre 360 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 360 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » de 81 à 488 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » de 81 à 395 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 360 px) ; p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » de 81 à 397 px (fenêtre 360 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 360 px)",
+   "360 px : texte coupé : p.truncate.text-sm « Entrée validée » dépasse de p.truncate.text-sm «  »",
+   "360 px : texte tronqué sans le texte entier : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Entrée validée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Entrée validée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (139×6 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (139×6 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-F6445248D5 · 10 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FB784700E3 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-C30E048138 · 5 000 F CFA » (139×6 px)",
+   "390 px : texte hors de l’écran : p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » de 81 à 395 px (fenêtre 390 px) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » de 81 à 393 px (fenêtre 390 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 390 px) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » de 81 à 417 px (fenêtre 390 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » de 81 à 488 px (fenêtre 390 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 390 px) ; p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » de 81 à 395 px (fenêtre 390 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 390 px) ; p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » de 81 à 397 px (fenêtre 390 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 390 px) ; p.truncate.text-sm « Billet TCK-20261119-F6445248D5 · 10 000 F CFA » de 81 à 405 px (fenêtre 390 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » de 81 à 407 px (fenêtre 390 px)",
+   "390 px : texte tronqué sans le texte entier : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » (points de suspension, texte entier absent) ; p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » (points de suspension, texte entier absent)",
+   "390 px : textes qui se chevauchent : p.truncate.text-sm « Billet vendu : Croisière musicale vers Gorée » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-63D6A7A031 · 9 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-4F17201CC6 · 9 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Croisière musicale vers Gorée · contrôle à l’entré » (139×6 px) ; p.truncate.text-sm « Billet vendu : Grande soirée du Monument de la Ren » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FA5CD4181F · 0 F CFA » (139×6 px) ; p.truncate.text-sm « Billet vendu : Nuit du Sabar — édition d’automne » sur time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » (139×7 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-3A906F91A0 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-629F5E3A44 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-F6445248D5 · 10 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-FB784700E3 · 5 000 F CFA » (139×6 px) ; time.flex-shrink-0.text-caption « jeu. 19 nov. 2026 à 10:34 » sur p.truncate.text-sm « Billet TCK-20261119-C30E048138 · 5 000 F CFA » (139×6 px)",
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Rapports » de 787 à 849 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px) ; span.min-w-0 « Clôture » de 783 à 834 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Rapports » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte hors de l’écran : th.px-4.py-3 « Rapports » de 1051 à 1113 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px) ; span.min-w-0 « Clôture » de 1047 à 1098 px (fenêtre 1024 px)",
+   "1024 px : texte coupé : th.px-4.py-3 « Rapports » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Clôture » dépasse de div.hidden.overflow-hidden «  »",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
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
        - generic [ref=f5e10]:
          - paragraph [ref=f5e11]: Gestion
          - generic [ref=f5e12]:
            - link "Tableau de bord" [ref=f5e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f5e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f5e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e31]:
          - paragraph [ref=f5e32]: Outils
          - generic [ref=f5e33]:
            - link "Finances" [ref=f5e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e73]: MN
          - generic [ref=f5e74]:
            - generic [ref=f5e75]: Mariama Ndiaye
            - generic [ref=f5e76]: Partenaire
        - generic [ref=f5e77]:
          - button "Se déconnecter" [ref=f5e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e83] [cursor=pointer]
    - generic [ref=f5e87]:
      - banner [ref=f5e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f5e97] [cursor=pointer]:
          - generic [ref=f5e101]: 99+
      - main [ref=f5e102]:
        - generic [ref=f5e104]:
          - generic [ref=f5e106]:
            - generic [ref=f5e107]:
              - generic [ref=f5e108]: Espace partenaire
              - heading "Baobab Scène" [level=1] [ref=f5e110]
              - paragraph [ref=f5e111]: Ventes, entrées et solde de vos événements.
            - generic [ref=f5e112]:
              - button "Actualiser" [ref=f5e113] [cursor=pointer]
              - link "Export comptable" [ref=f5e121] [cursor=pointer]:
                - /url: /api/partner/reports/accounting?format=csv
              - link "Scanner des billets" [ref=f5e125] [cursor=pointer]:
                - /url: /partner/scan
          - status [ref=f5e134]:
            - generic [ref=f5e140]:
              - paragraph [ref=f5e141]: Période d’essai gratuite en cours
              - generic [ref=f5e142]:
                - text: 150 jours offerts, jusqu’au
                - time [ref=f5e143]: lun. 18 janv. 2027
                - text: .
          - region [ref=f5e144]:
            - heading "Indicateurs" [level=2] [ref=f5e145]
            - generic [ref=f5e146]:
              - generic [ref=f5e147]:
                - paragraph [ref=f5e149]: Ventes en ligne
                - paragraph [ref=f5e154]: 978 000 F CFA
                - paragraph [ref=f5e155]: Prix des billets vendus en ligne, tous événements.
              - generic [ref=f5e156]:
                - paragraph [ref=f5e158]: Net partenaire
                - paragraph [ref=f5e163]: 828 000 F CFA
                - paragraph [ref=f5e164]: Après 150 000 F CFA de remboursements.
              - generic [ref=f5e165]:
                - paragraph [ref=f5e167]: Billets vendus
                - paragraph [ref=f5e171]: "134"
                - paragraph [ref=f5e172]: 71 entrées validées aux portes.
              - generic [ref=f5e173]:
                - paragraph [ref=f5e175]: Disponible au retrait
                - paragraph [ref=f5e180]: 0 F CFA
                - paragraph [ref=f5e181]: "Déjà versé : 0 F CFA."
            - paragraph [ref=f5e182]:
              - text: Les ventes en espèces au guichet (138 000 F CFA) et les invitations n’alimentent pas le solde.
              - link "Voir mes finances" [ref=f5e183] [cursor=pointer]:
                - /url: /partner/finance
          - region [ref=f5e185]:
            - generic [ref=f5e186]:
              - generic [ref=f5e187]:
                - heading "Mes événements" [level=2] [ref=f5e188]
                - generic [ref=f5e191]: 9 au total
              - link "Tous mes événements" [ref=f5e193] [cursor=pointer]:
                - /url: /partner/events
            - table [ref=f5e197]:
              - caption [ref=f5e198]: Ventes, entrées et rapports par événement
              - rowgroup [ref=f5e199]:
                - row [ref=f5e200]:
                  - columnheader "Événement" [ref=f5e201]
                  - columnheader "Date et lieu" [ref=f5e202]
                  - columnheader "Vendus / capacité" [ref=f5e203]
                  - columnheader "Entrées" [ref=f5e204]
                  - columnheader "Ventes en ligne" [ref=f5e205]
                  - columnheader "Net partenaire" [ref=f5e206]
                  - columnheader "Rapports" [ref=f5e207]
              - rowgroup [ref=f5e208]:
                - row [ref=f5e209]:
                  - cell "Concert acoustique au jardin Brouillon" [ref=f5e210]:
                    - generic [ref=f5e211]:
                      - generic [ref=f5e212]: Concert acoustique au jardin
                      - generic "En cours de rédaction par l’organisateur, visible de lui seul." [ref=f5e213]: Brouillon
                  - cell "mar. 29 déc. 2026 à 19:00 Dakar" [ref=f5e216]:
                    - generic [ref=f5e217]:
                      - time [ref=f5e218]: mar. 29 déc. 2026 à 19:00
                      - generic [ref=f5e219]: Dakar
                  - cell "0 / 100 0 % rempli" [ref=f5e220]:
                    - generic [ref=f5e221]:
                      - generic [ref=f5e222]: 0 / 100
                      - generic [ref=f5e223]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=f5e224]:
                    - generic [ref=f5e225]:
                      - generic [ref=f5e226]: "0"
                      - generic [ref=f5e227]: 0 % des vendus
                  - cell "0 F CFA" [ref=f5e228]
                  - cell "0 F CFA" [ref=f5e229]
                  - cell [ref=f5e230]:
                    - generic [ref=f5e231]:
                      - button "Clôture" [ref=f5e232] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert acoustique au jardin" [ref=f5e238] [cursor=pointer]
                      - button "Exporter les ventes de Concert acoustique au jardin en CSV" [ref=f5e243] [cursor=pointer]
                - row [ref=f5e248]:
                  - cell "Matinée gospel et chorales En attente de validation" [ref=f5e249]:
                    - generic [ref=f5e250]:
                      - generic [ref=f5e251]: Matinée gospel et chorales
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e252]: En attente de validation
                  - cell "dim. 13 déc. 2026 à 10:00 Dakar" [ref=f5e255]:
                    - generic [ref=f5e256]:
                      - time [ref=f5e257]: dim. 13 déc. 2026 à 10:00
                      - generic [ref=f5e258]: Dakar
                  - cell "0 / 300 0 % rempli" [ref=f5e259]:
                    - generic [ref=f5e260]:
                      - generic [ref=f5e261]: 0 / 300
                      - generic [ref=f5e262]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=f5e263]:
                    - generic [ref=f5e264]:
                      - generic [ref=f5e265]: "0"
                      - generic [ref=f5e266]: 0 % des vendus
                  - cell "0 F CFA" [ref=f5e267]
                  - cell "0 F CFA" [ref=f5e268]
                  - cell [ref=f5e269]:
                    - generic [ref=f5e270]:
                      - button "Clôture" [ref=f5e271] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Matinée gospel et chorales" [ref=f5e277] [cursor=pointer]
                      - button "Exporter les ventes de Matinée gospel et chorales en CSV" [ref=f5e282] [cursor=pointer]
                - row [ref=f5e287]:
                  - cell "Soirée Kora & Lumières Publié" [ref=f5e288]:
                    - generic [ref=f5e289]:
                      - generic [ref=f5e290]: Soirée Kora & Lumières
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e291]': Publié
                  - cell "dim. 6 déc. 2026 à 20:30 Dakar" [ref=f5e294]:
                    - generic [ref=f5e295]:
                      - time [ref=f5e296]: dim. 6 déc. 2026 à 20:30
                      - generic [ref=f5e297]: Dakar
                  - cell "5 / 150 3 % rempli" [ref=f5e298]:
                    - generic [ref=f5e299]:
                      - generic [ref=f5e300]: 5 / 150
                      - generic [ref=f5e301]: 3 % rempli
                  - cell "0 0 % des vendus" [ref=f5e302]:
                    - generic [ref=f5e303]:
                      - generic [ref=f5e304]: "0"
                      - generic [ref=f5e305]: 0 % des vendus
                  - cell "42 000 F CFA" [ref=f5e306]
                  - cell "42 000 F CFA" [ref=f5e307]
                  - cell [ref=f5e308]:
                    - generic [ref=f5e309]:
                      - button "Clôture" [ref=f5e310] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Soirée Kora & Lumières" [ref=f5e316] [cursor=pointer]
                      - button "Exporter les ventes de Soirée Kora & Lumières en CSV" [ref=f5e321] [cursor=pointer]
                - row [ref=f5e326]:
                  - cell "Festival Jazz sur le Fleuve Publié" [ref=f5e327]:
                    - generic [ref=f5e328]:
                      - generic [ref=f5e329]: Festival Jazz sur le Fleuve
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e330]': Publié
                  - cell "mar. 1 déc. 2026 à 18:00 Saint-Louis" [ref=f5e333]:
                    - generic [ref=f5e334]:
                      - time [ref=f5e335]: mar. 1 déc. 2026 à 18:00
                      - generic [ref=f5e336]: Saint-Louis
                  - cell "22 / 400 6 % rempli" [ref=f5e337]:
                    - generic [ref=f5e338]:
                      - generic [ref=f5e339]: 22 / 400
                      - generic [ref=f5e340]: 6 % rempli
                  - cell "0 0 % des vendus" [ref=f5e341]:
                    - generic [ref=f5e342]:
                      - generic [ref=f5e343]: "0"
                      - generic [ref=f5e344]: 0 % des vendus
                  - cell "201 000 F CFA" [ref=f5e345]
                  - cell "201 000 F CFA" [ref=f5e346]
                  - cell [ref=f5e347]:
                    - generic [ref=f5e348]:
                      - button "Clôture" [ref=f5e349] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Festival Jazz sur le Fleuve" [ref=f5e355] [cursor=pointer]
                      - button "Exporter les ventes de Festival Jazz sur le Fleuve en CSV" [ref=f5e360] [cursor=pointer]
                - row [ref=f5e365]:
                  - cell "Grande soirée du Monument de la Renaissance Validé" [ref=f5e366]:
                    - generic [ref=f5e367]:
                      - generic [ref=f5e368]: Grande soirée du Monument de la Renaissance
                      - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=f5e369]': Validé
                  - cell "dim. 22 nov. 2026 à 20:00 Dakar" [ref=f5e372]:
                    - generic [ref=f5e373]:
                      - time [ref=f5e374]: dim. 22 nov. 2026 à 20:00
                      - generic [ref=f5e375]: Dakar
                  - cell "1 / 170 1 % rempli" [ref=f5e376]:
                    - generic [ref=f5e377]:
                      - generic [ref=f5e378]: 1 / 170
                      - generic [ref=f5e379]: 1 % rempli
                  - cell "0 0 % des vendus" [ref=f5e380]:
                    - generic [ref=f5e381]:
                      - generic [ref=f5e382]: "0"
                      - generic [ref=f5e383]: 0 % des vendus
                  - cell "0 F CFA" [ref=f5e384]
                  - cell "0 F CFA" [ref=f5e385]
                  - cell [ref=f5e386]:
                    - generic [ref=f5e387]:
                      - button "Clôture" [ref=f5e388] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Grande soirée du Monument de la Renaissance" [ref=f5e394] [cursor=pointer]
                      - button "Exporter les ventes de Grande soirée du Monument de la Renaissance en CSV" [ref=f5e399] [cursor=pointer]
                - row [ref=f5e404]:
                  - cell "Concert des Lumières de Gorée Publié" [ref=f5e405]:
                    - generic [ref=f5e406]:
                      - generic [ref=f5e407]: Concert des Lumières de Gorée
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e408]': Publié
                  - cell "ven. 20 nov. 2026 à 06:45 Gorée" [ref=f5e411]:
                    - generic [ref=f5e412]:
                      - time [ref=f5e413]: ven. 20 nov. 2026 à 06:45
                      - generic [ref=f5e414]: Gorée
                  - cell "11 / 250 4 % rempli" [ref=f5e415]:
                    - generic [ref=f5e416]:
                      - generic [ref=f5e417]: 11 / 250
                      - generic [ref=f5e418]: 4 % rempli
                  - cell "0 0 % des vendus" [ref=f5e419]:
                    - generic [ref=f5e420]:
                      - generic [ref=f5e421]: "0"
                      - generic [ref=f5e422]: 0 % des vendus
                  - cell "84 000 F CFA" [ref=f5e423]
                  - cell "84 000 F CFA" [ref=f5e424]
                  - cell [ref=f5e425]:
                    - generic [ref=f5e426]:
                      - button "Clôture" [ref=f5e427] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert des Lumières de Gorée" [ref=f5e433] [cursor=pointer]
                      - button "Exporter les ventes de Concert des Lumières de Gorée en CSV" [ref=f5e438] [cursor=pointer]
                - row [ref=f5e443]:
                  - cell "Nuit du Sabar — édition d’automne Publié" [ref=f5e444]:
                    - generic [ref=f5e445]:
                      - generic [ref=f5e446]: Nuit du Sabar — édition d’automne
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e447]': Publié
                  - cell "jeu. 19 nov. 2026 à 11:30 Dakar" [ref=f5e450]:
                    - generic [ref=f5e451]:
                      - time [ref=f5e452]: jeu. 19 nov. 2026 à 11:30
                      - generic [ref=f5e453]: Dakar
                  - cell "83 / 300 28 % rempli" [ref=f5e454]:
                    - generic [ref=f5e455]:
                      - generic [ref=f5e456]: 83 / 300
                      - generic [ref=f5e457]: 28 % rempli
                  - cell "61 73 % des vendus" [ref=f5e458]:
                    - generic [ref=f5e459]:
                      - generic [ref=f5e460]: "61"
                      - generic [ref=f5e461]: 73 % des vendus
                  - cell "351 000 F CFA" [ref=f5e462]
                  - cell "351 000 F CFA" [ref=f5e463]
                  - cell [ref=f5e464]:
                    - generic [ref=f5e465]:
                      - button "Clôture" [ref=f5e466] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Nuit du Sabar — édition d’automne" [ref=f5e472] [cursor=pointer]
                      - button "Exporter les ventes de Nuit du Sabar — édition d’automne en CSV" [ref=f5e477] [cursor=pointer]
                - row [ref=f5e482]:
                  - cell "Croisière musicale vers Gorée Annulé" [ref=f5e483]:
                    - generic [ref=f5e484]:
                      - generic [ref=f5e485]: Croisière musicale vers Gorée
                      - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=f5e486]': Annulé
                  - cell "jeu. 19 nov. 2026 à 14:45 Dakar" [ref=f5e489]:
                    - generic [ref=f5e490]:
                      - time [ref=f5e491]: jeu. 19 nov. 2026 à 14:45
                      - generic [ref=f5e492]: Dakar
                  - cell "2 / 120 2 % rempli" [ref=f5e493]:
                    - generic [ref=f5e494]:
                      - generic [ref=f5e495]: 2 / 120
                      - generic [ref=f5e496]: 2 % rempli
                  - cell "2 100 % des vendus" [ref=f5e497]:
                    - generic [ref=f5e498]:
                      - generic [ref=f5e499]: "2"
                      - generic [ref=f5e500]: 100 % des vendus
                  - cell "150 000 F CFA" [ref=f5e501]
                  - cell "0 F CFA" [ref=f5e502]
                  - cell [ref=f5e503]:
                    - generic [ref=f5e504]:
                      - button "Clôture" [ref=f5e505] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Croisière musicale vers Gorée" [ref=f5e511] [cursor=pointer]
                      - button "Exporter les ventes de Croisière musicale vers Gorée en CSV" [ref=f5e516] [cursor=pointer]
                - row [ref=f5e521]:
                  - cell "Brunch électro des Almadies Terminé" [ref=f5e522]:
                    - generic [ref=f5e523]:
                      - generic [ref=f5e524]: Brunch électro des Almadies
                      - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=f5e525]': Terminé
                  - cell "dim. 15 nov. 2026 à 12:00 Dakar" [ref=f5e528]:
                    - generic [ref=f5e529]:
                      - time [ref=f5e530]: dim. 15 nov. 2026 à 12:00
                      - generic [ref=f5e531]: Dakar
                  - cell "10 / 80 13 % rempli" [ref=f5e532]:
                    - generic [ref=f5e533]:
                      - generic [ref=f5e534]: 10 / 80
                      - generic [ref=f5e535]: 13 % rempli
                  - cell "8 80 % des vendus" [ref=f5e536]:
                    - generic [ref=f5e537]:
                      - generic [ref=f5e538]: "8"
                      - generic [ref=f5e539]: 80 % des vendus
                  - cell "150 000 F CFA" [ref=f5e540]
                  - cell "150 000 F CFA" [ref=f5e541]
                  - cell [ref=f5e542]:
                    - generic [ref=f5e543]:
                      - button "Clôture" [ref=f5e544] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Brunch électro des Almadies" [ref=f5e550] [cursor=pointer]
                      - button "Exporter les ventes de Brunch électro des Almadies en CSV" [ref=f5e555] [cursor=pointer]
          - region [ref=f5e561]:
            - heading "Activité récente" [level=2] [ref=f5e562]
            - list [ref=f5e565]:
              - listitem [ref=f5e566]:
                - generic [ref=f5e571]:
                  - paragraph [ref=f5e572]: "Billet vendu : Croisière musicale vers Gorée"
                  - paragraph [ref=f5e573]: Billet TCK-20261119-63D6A7A031 · 9 000 F CFA
                - time [ref=f5e574]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e575]:
                - generic [ref=f5e580]:
                  - paragraph [ref=f5e581]: "Billet vendu : Croisière musicale vers Gorée"
                  - paragraph [ref=f5e582]: Billet TCK-20261119-4F17201CC6 · 9 000 F CFA
                - time [ref=f5e583]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e584]:
                - generic [ref=f5e593]:
                  - paragraph [ref=f5e594]: Entrée validée
                  - paragraph [ref=f5e595]: Croisière musicale vers Gorée · contrôle à l’entrée
                - time [ref=f5e596]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e597]:
                - generic [ref=f5e606]:
                  - paragraph [ref=f5e607]: Entrée validée
                  - paragraph [ref=f5e608]: Croisière musicale vers Gorée · contrôle à l’entrée
                - time [ref=f5e609]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e610]:
                - generic [ref=f5e615]:
                  - paragraph [ref=f5e616]: "Billet vendu : Grande soirée du Monument de la Renaissance"
                  - paragraph [ref=f5e617]: Billet TCK-20261119-FA5CD4181F · 0 F CFA
                - time [ref=f5e618]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e619]:
                - generic [ref=f5e624]:
                  - paragraph [ref=f5e625]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f5e626]: Billet TCK-20261119-3A906F91A0 · 5 000 F CFA
                - time [ref=f5e627]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e628]:
                - generic [ref=f5e633]:
                  - paragraph [ref=f5e634]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f5e635]: Billet TCK-20261119-629F5E3A44 · 5 000 F CFA
                - time [ref=f5e636]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e637]:
                - generic [ref=f5e642]:
                  - paragraph [ref=f5e643]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f5e644]: Billet TCK-20261119-F6445248D5 · 10 000 F CFA
                - time [ref=f5e645]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e646]:
                - generic [ref=f5e651]:
                  - paragraph [ref=f5e652]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f5e653]: Billet TCK-20261119-FB784700E3 · 5 000 F CFA
                - time [ref=f5e654]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e655]:
                - generic [ref=f5e660]:
                  - paragraph [ref=f5e661]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=f5e662]: Billet TCK-20261119-C30E048138 · 5 000 F CFA
                - time [ref=f5e663]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e664]:
                - generic [ref=f5e670]:
                  - paragraph [ref=f5e671]: Commande CMD-DEMO-1795084471761-90FDF0
                  - paragraph [ref=f5e672]: Sur place · 5 000 F CFA
                - time [ref=f5e673]: jeu. 19 nov. 2026 à 10:34
              - listitem [ref=f5e674]:
                - generic [ref=f5e683]:
                  - paragraph [ref=f5e684]: Entrée validée
                  - paragraph [ref=f5e685]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=f5e686]: jeu. 19 nov. 2026 à 10:31
              - listitem [ref=f5e687]:
                - generic [ref=f5e696]:
                  - paragraph [ref=f5e697]: Entrée validée
                  - paragraph [ref=f5e698]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=f5e699]: jeu. 19 nov. 2026 à 10:29
              - listitem [ref=f5e700]:
                - generic [ref=f5e709]:
                  - paragraph [ref=f5e710]: Entrée validée
                  - paragraph [ref=f5e711]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=f5e712]: jeu. 19 nov. 2026 à 10:28
  - alert [ref=f5e713]
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
      |                                                                                        ^ Error: contrôles responsive de org-tableau-de-bord (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```