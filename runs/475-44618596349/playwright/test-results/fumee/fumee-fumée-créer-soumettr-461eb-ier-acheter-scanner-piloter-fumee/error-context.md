# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:99:5

# Error details

```
Test timeout of 1200000ms exceeded.
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
        - link "Aïssatou OrgaA Partenaire" [ref=f2e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e73]: AO
          - generic [ref=f2e74]:
            - generic [ref=f2e75]: Aïssatou OrgaA
            - generic [ref=f2e76]: Partenaire
        - generic [ref=f2e77]:
          - button "Se déconnecter" [ref=f2e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e83] [cursor=pointer]
    - generic [ref=f2e87]:
      - banner [ref=f2e88]:
        - link "Rechercher un événement…" [ref=f2e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 7 non lues" [ref=f2e97] [cursor=pointer]:
          - generic [ref=f2e101]: "7"
      - main [ref=f2e102]:
        - generic [ref=f2e104]:
          - generic [ref=f2e105]:
            - generic [ref=f2e106]:
              - heading "Contrôle des entrées" [level=1] [ref=f2e107]
              - paragraph [ref=f2e115]: QR dynamique de l’application, ou numéro du billet avec pièce d’identité.
            - link "Tableau de bord" [ref=f2e116] [cursor=pointer]:
              - /url: /partner/dashboard
          - generic [ref=f2e121]:
            - generic [ref=f2e122]: Événement contrôlé
            - combobox "Événement contrôlé" [ref=f2e125] [cursor=pointer]:
              - option "Fumée — Concert des Parcelles 22.03.19 — 20 nov. 2026" [selected]
          - status [ref=f2e126]: "Vos entrées : 0 entrée"
          - group "Mode de contrôle" [ref=f2e129]:
            - button "Caméra" [pressed] [ref=f2e130] [cursor=pointer]
            - button "Saisie manuelle" [ref=f2e136] [cursor=pointer]
            - button "Guichet" [ref=f2e141] [cursor=pointer]
          - generic [ref=f2e149]:
            - generic "Image de la caméra" [ref=f2e150]
            - generic [ref=f2e151]:
              - status [ref=f2e156]:
                - paragraph [ref=f2e157]: Caméra en veille
                - paragraph [ref=f2e158]: "Aucun billet lu depuis 3 minutes : la caméra est coupée pour la batterie."
              - button "Reprendre le contrôle" [ref=f2e159] [cursor=pointer]
          - 'button "Derniers scans Vous : 0 entrée, 0 refus" [ref=f2e166] [cursor=pointer]':
            - generic [ref=f2e171]:
              - generic [ref=f2e172]: Derniers scans
              - generic [ref=f2e173]: "Vous : 0 entrée, 0 refus"
  - alert [ref=f2e176]
```