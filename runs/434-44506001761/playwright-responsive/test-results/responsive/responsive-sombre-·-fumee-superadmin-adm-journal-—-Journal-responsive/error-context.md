# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-journal — Journal
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-journal (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 19

- Array []
+ Array [
+   "360 px : texte tronqué sans le texte entier : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b63e8fa2-dbf4-48e9-87d6-56d75066da21 » sur span.min-w-0 « Examiner » (44×6 px)",
+   "360 px : tableau sur téléphone (cartes attendues) : tableau « sans légende » (571 px)",
+   "360 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "360 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "360 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
+   "768 px : texte hors de l’écran : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px)",
+   "768 px : texte tronqué sans le texte entier : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (44×6 px)",
+   "768 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "768 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "768 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent)",
+   "1440 px : textes qui se chevauchent : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « b63e8fa2-dbf4-48e9-87d6-56d75066da21 » sur span.min-w-0 « Examiner » (27×6 px)",
+   "1440 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "1440 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "1440 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
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
        - generic [ref=f2e10]: Administration
        - link "Tableau de bord" [ref=f2e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e22]:
          - paragraph [ref=f2e23]: Gestion
          - generic [ref=f2e24]:
            - link "Événements" [ref=f2e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Finances
          - link "Finance" [ref=f2e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e49]:
          - paragraph [ref=f2e50]: Engagement
          - generic [ref=f2e51]:
            - link "Parrainage" [ref=f2e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e66]:
          - paragraph [ref=f2e67]: Système
          - generic [ref=f2e68]:
            - link "Réglages" [ref=f2e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f2e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e107]: ES
          - generic [ref=f2e108]:
            - generic [ref=f2e109]: Elhadji SuperAdmin
            - generic [ref=f2e110]: Superadmin
        - generic [ref=f2e111]:
          - button "Se déconnecter" [ref=f2e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e117] [cursor=pointer]
    - generic [ref=f2e121]:
      - banner [ref=f2e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=f2e131] [cursor=pointer]:
          - generic [ref=f2e135]: "58"
      - main [ref=f2e136]:
        - generic [ref=f2e138]:
          - generic [ref=f2e139]:
            - generic [ref=f2e140]:
              - link [ref=f2e141] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Journal d’audit" [level=1] [ref=f2e145]
            - button "Actualiser" [ref=f2e146] [cursor=pointer]
          - generic [ref=f2e153]:
            - generic [ref=f2e154]:
              - generic [ref=f2e155]:
                - generic [ref=f2e156]:
                  - generic [ref=f2e157]: Action
                  - combobox [ref=f2e158]:
                    - option "Toutes les actions" [selected]
                    - option "Compte suspendu ou réactivé"
                    - option "Rôles du compte changés"
                    - option "Droits d’un administrateur changés"
                    - option "Partenaire validé, refusé, suspendu ou réactivé"
                    - option "Événement modifié"
                    - option "Versement marqué versé"
                    - option "Versement constaté non versé"
                    - option "Compte supprimé (données effacées)"
                    - option "Tentative d’accès refusée"
                - generic [ref=f2e159]:
                  - generic [ref=f2e160]: Entité / Objet
                  - combobox [ref=f2e161]:
                    - option "Tous les objets" [selected]
                    - option "Compte"
                    - option "Partenaire"
                    - option "Événement"
                    - option "Versement"
                    - option "Paiement"
                    - option "Réglage"
                    - option "Droits"
                    - option "Campagne"
                    - option "À la une"
              - generic [ref=f2e162]: 100 entrée(s) trouvée(s)
            - table [ref=f2e164]:
              - rowgroup [ref=f2e165]:
                - row [ref=f2e166]:
                  - columnheader "Horodatage" [ref=f2e167]
                  - columnheader "Utilisateur" [ref=f2e168]
                  - columnheader "Rôle à l’action" [ref=f2e169]
                  - columnheader "Action" [ref=f2e170]
                  - columnheader "Objet" [ref=f2e171]
                  - columnheader "ID Objet" [ref=f2e172]
                  - columnheader "Détails JSON" [ref=f2e173]
              - rowgroup [ref=f2e174]:
                - row [ref=f2e175]:
                  - cell "19 nov. 2026, 10:43:48" [ref=f2e176]
                  - cell "Système" [ref=f2e177]
                  - cell "Automatique" [ref=f2e179]
                  - cell "Autre action" [ref=f2e180]
                  - cell "Paiement" [ref=f2e181]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f2e182]
                  - cell [ref=f2e183]:
                    - button "Examiner" [ref=f2e184] [cursor=pointer]
                - row [ref=f2e191]:
                  - cell "19 nov. 2026, 10:43:42" [ref=f2e192]
                  - cell "Système" [ref=f2e193]
                  - cell "Automatique" [ref=f2e195]
                  - cell "Autre action" [ref=f2e196]
                  - cell "Paiement" [ref=f2e197]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f2e198]
                  - cell [ref=f2e199]:
                    - button "Examiner" [ref=f2e200] [cursor=pointer]
                - row [ref=f2e207]:
                  - cell "19 nov. 2026, 10:37:06" [ref=f2e208]
                  - cell "Système" [ref=f2e209]
                  - cell "Automatique" [ref=f2e211]
                  - cell "Autre action" [ref=f2e212]
                  - cell "Paiement" [ref=f2e213]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f2e214]
                  - cell [ref=f2e215]:
                    - button "Examiner" [ref=f2e216] [cursor=pointer]
                - row [ref=f2e223]:
                  - cell "19 nov. 2026, 10:36:59" [ref=f2e224]
                  - cell "Système" [ref=f2e225]
                  - cell "Automatique" [ref=f2e227]
                  - cell "Autre action" [ref=f2e228]
                  - cell "Paiement" [ref=f2e229]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f2e230]
                  - cell [ref=f2e231]:
                    - button "Examiner" [ref=f2e232] [cursor=pointer]
                - row [ref=f2e239]:
                  - cell "19 nov. 2026, 10:36:52" [ref=f2e240]
                  - cell "Système" [ref=f2e241]
                  - cell "Automatique" [ref=f2e243]
                  - cell "Autre action" [ref=f2e244]
                  - cell "Paiement" [ref=f2e245]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f2e246]
                  - cell [ref=f2e247]:
                    - button "Examiner" [ref=f2e248] [cursor=pointer]
                - row [ref=f2e255]:
                  - cell "19 nov. 2026, 10:36:46" [ref=f2e256]
                  - cell "Système" [ref=f2e257]
                  - cell "Automatique" [ref=f2e259]
                  - cell "Autre action" [ref=f2e260]
                  - cell "Paiement" [ref=f2e261]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f2e262]
                  - cell [ref=f2e263]:
                    - button "Examiner" [ref=f2e264] [cursor=pointer]
                - row [ref=f2e271]:
                  - cell "19 nov. 2026, 10:35:52" [ref=f2e272]
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Superadmin" [ref=f2e273]':
                    - generic [ref=f2e274]: Elhadji SuperAdmin
                    - generic [ref=f2e275]: "Aujourd’hui : Superadmin"
                  - cell "Automatique" [ref=f2e276]
                  - cell "Autre action" [ref=f2e277]
                  - cell "Compte" [ref=f2e278]
                  - cell "37dcd681-a2c3-43f5-ac3d-df0055c611bf" [ref=f2e279]
                  - cell [ref=f2e280]:
                    - button "Examiner" [ref=f2e281] [cursor=pointer]
                - row [ref=f2e288]:
                  - cell "19 nov. 2026, 10:35:45" [ref=f2e289]
                  - 'cell "Aïda Diallo Aujourd’hui : Administrateur" [ref=f2e290]':
                    - generic [ref=f2e291]: Aïda Diallo
                    - generic [ref=f2e292]: "Aujourd’hui : Administrateur"
                  - cell "Automatique" [ref=f2e293]
                  - cell "Autre action" [ref=f2e294]
                  - cell "Compte" [ref=f2e295]
                  - cell "a1bead7e-787c-4b01-b09b-81c698014bd7" [ref=f2e296]
                  - cell [ref=f2e297]:
                    - button "Examiner" [ref=f2e298] [cursor=pointer]
                - row [ref=f2e305]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e306]
                  - cell "Système" [ref=f2e307]
                  - cell "Automatique" [ref=f2e309]
                  - cell "Autre action" [ref=f2e310]
                  - cell "Paiement" [ref=f2e311]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f2e312]
                  - cell [ref=f2e313]:
                    - button "Examiner" [ref=f2e314] [cursor=pointer]
                - row [ref=f2e321]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e322]
                  - cell "Système" [ref=f2e323]
                  - cell "Automatique" [ref=f2e325]
                  - cell "Autre action" [ref=f2e326]
                  - cell "Paiement" [ref=f2e327]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f2e328]
                  - cell [ref=f2e329]:
                    - button "Examiner" [ref=f2e330] [cursor=pointer]
                - row [ref=f2e337]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e338]
                  - cell "Système" [ref=f2e339]
                  - cell "Automatique" [ref=f2e341]
                  - cell "Autre action" [ref=f2e342]
                  - cell "Paiement" [ref=f2e343]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f2e344]
                  - cell [ref=f2e345]:
                    - button "Examiner" [ref=f2e346] [cursor=pointer]
                - row [ref=f2e353]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e354]
                  - cell "Système" [ref=f2e355]
                  - cell "Automatique" [ref=f2e357]
                  - cell "Autre action" [ref=f2e358]
                  - cell "Paiement" [ref=f2e359]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f2e360]
                  - cell [ref=f2e361]:
                    - button "Examiner" [ref=f2e362] [cursor=pointer]
                - row [ref=f2e369]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e370]
                  - cell "Système" [ref=f2e371]
                  - cell "Automatique" [ref=f2e373]
                  - cell "Autre action" [ref=f2e374]
                  - cell "Paiement" [ref=f2e375]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f2e376]
                  - cell [ref=f2e377]:
                    - button "Examiner" [ref=f2e378] [cursor=pointer]
                - row [ref=f2e385]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e386]
                  - cell "Système" [ref=f2e387]
                  - cell "Automatique" [ref=f2e389]
                  - cell "Autre action" [ref=f2e390]
                  - cell "Paiement" [ref=f2e391]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f2e392]
                  - cell [ref=f2e393]:
                    - button "Examiner" [ref=f2e394] [cursor=pointer]
                - row [ref=f2e401]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e402]
                  - cell "Système" [ref=f2e403]
                  - cell "Automatique" [ref=f2e405]
                  - cell "Autre action" [ref=f2e406]
                  - cell "Paiement" [ref=f2e407]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f2e408]
                  - cell [ref=f2e409]:
                    - button "Examiner" [ref=f2e410] [cursor=pointer]
                - row [ref=f2e417]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e418]
                  - cell "Système" [ref=f2e419]
                  - cell "Automatique" [ref=f2e421]
                  - cell "Autre action" [ref=f2e422]
                  - cell "Paiement" [ref=f2e423]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f2e424]
                  - cell [ref=f2e425]:
                    - button "Examiner" [ref=f2e426] [cursor=pointer]
                - row [ref=f2e433]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e434]
                  - cell "Système" [ref=f2e435]
                  - cell "Automatique" [ref=f2e437]
                  - cell "Autre action" [ref=f2e438]
                  - cell "Paiement" [ref=f2e439]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f2e440]
                  - cell [ref=f2e441]:
                    - button "Examiner" [ref=f2e442] [cursor=pointer]
                - row [ref=f2e449]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e450]
                  - cell "Système" [ref=f2e451]
                  - cell "Automatique" [ref=f2e453]
                  - cell "Autre action" [ref=f2e454]
                  - cell "Paiement" [ref=f2e455]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f2e456]
                  - cell [ref=f2e457]:
                    - button "Examiner" [ref=f2e458] [cursor=pointer]
                - row [ref=f2e465]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e466]
                  - cell "Système" [ref=f2e467]
                  - cell "Automatique" [ref=f2e469]
                  - cell "Autre action" [ref=f2e470]
                  - cell "Paiement" [ref=f2e471]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f2e472]
                  - cell [ref=f2e473]:
                    - button "Examiner" [ref=f2e474] [cursor=pointer]
                - row [ref=f2e481]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e482]
                  - cell "Système" [ref=f2e483]
                  - cell "Automatique" [ref=f2e485]
                  - cell "Autre action" [ref=f2e486]
                  - cell "Paiement" [ref=f2e487]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f2e488]
                  - cell [ref=f2e489]:
                    - button "Examiner" [ref=f2e490] [cursor=pointer]
                - row [ref=f2e497]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e498]
                  - cell "Système" [ref=f2e499]
                  - cell "Automatique" [ref=f2e501]
                  - cell "Autre action" [ref=f2e502]
                  - cell "Paiement" [ref=f2e503]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f2e504]
                  - cell [ref=f2e505]:
                    - button "Examiner" [ref=f2e506] [cursor=pointer]
                - row [ref=f2e513]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e514]
                  - cell "Système" [ref=f2e515]
                  - cell "Automatique" [ref=f2e517]
                  - cell "Autre action" [ref=f2e518]
                  - cell "Paiement" [ref=f2e519]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f2e520]
                  - cell [ref=f2e521]:
                    - button "Examiner" [ref=f2e522] [cursor=pointer]
                - row [ref=f2e529]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e530]
                  - cell "Système" [ref=f2e531]
                  - cell "Automatique" [ref=f2e533]
                  - cell "Autre action" [ref=f2e534]
                  - cell "Paiement" [ref=f2e535]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f2e536]
                  - cell [ref=f2e537]:
                    - button "Examiner" [ref=f2e538] [cursor=pointer]
                - row [ref=f2e545]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f2e546]
                  - cell "Système" [ref=f2e547]
                  - cell "Automatique" [ref=f2e549]
                  - cell "Autre action" [ref=f2e550]
                  - cell "Paiement" [ref=f2e551]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f2e552]
                  - cell [ref=f2e553]:
                    - button "Examiner" [ref=f2e554] [cursor=pointer]
                - row [ref=f2e561]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e562]
                  - cell "Système" [ref=f2e563]
                  - cell "Automatique" [ref=f2e565]
                  - cell "Autre action" [ref=f2e566]
                  - cell "Paiement" [ref=f2e567]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f2e568]
                  - cell [ref=f2e569]:
                    - button "Examiner" [ref=f2e570] [cursor=pointer]
                - row [ref=f2e577]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e578]
                  - cell "Système" [ref=f2e579]
                  - cell "Automatique" [ref=f2e581]
                  - cell "Autre action" [ref=f2e582]
                  - cell "Paiement" [ref=f2e583]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f2e584]
                  - cell [ref=f2e585]:
                    - button "Examiner" [ref=f2e586] [cursor=pointer]
                - row [ref=f2e593]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e594]
                  - cell "Système" [ref=f2e595]
                  - cell "Automatique" [ref=f2e597]
                  - cell "Autre action" [ref=f2e598]
                  - cell "Paiement" [ref=f2e599]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f2e600]
                  - cell [ref=f2e601]:
                    - button "Examiner" [ref=f2e602] [cursor=pointer]
                - row [ref=f2e609]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e610]
                  - cell "Système" [ref=f2e611]
                  - cell "Automatique" [ref=f2e613]
                  - cell "Autre action" [ref=f2e614]
                  - cell "Paiement" [ref=f2e615]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f2e616]
                  - cell [ref=f2e617]:
                    - button "Examiner" [ref=f2e618] [cursor=pointer]
                - row [ref=f2e625]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e626]
                  - cell "Système" [ref=f2e627]
                  - cell "Automatique" [ref=f2e629]
                  - cell "Autre action" [ref=f2e630]
                  - cell "Paiement" [ref=f2e631]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f2e632]
                  - cell [ref=f2e633]:
                    - button "Examiner" [ref=f2e634] [cursor=pointer]
                - row [ref=f2e641]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e642]
                  - cell "Système" [ref=f2e643]
                  - cell "Automatique" [ref=f2e645]
                  - cell "Autre action" [ref=f2e646]
                  - cell "Paiement" [ref=f2e647]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f2e648]
                  - cell [ref=f2e649]:
                    - button "Examiner" [ref=f2e650] [cursor=pointer]
                - row [ref=f2e657]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e658]
                  - cell "Système" [ref=f2e659]
                  - cell "Automatique" [ref=f2e661]
                  - cell "Autre action" [ref=f2e662]
                  - cell "Paiement" [ref=f2e663]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f2e664]
                  - cell [ref=f2e665]:
                    - button "Examiner" [ref=f2e666] [cursor=pointer]
                - row [ref=f2e673]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e674]
                  - cell "Système" [ref=f2e675]
                  - cell "Automatique" [ref=f2e677]
                  - cell "Autre action" [ref=f2e678]
                  - cell "Paiement" [ref=f2e679]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f2e680]
                  - cell [ref=f2e681]:
                    - button "Examiner" [ref=f2e682] [cursor=pointer]
                - row [ref=f2e689]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e690]
                  - cell "Système" [ref=f2e691]
                  - cell "Automatique" [ref=f2e693]
                  - cell "Autre action" [ref=f2e694]
                  - cell "Paiement" [ref=f2e695]
                  - cell "1c01b7b7-0c4a-41a9-8225-a7502a48e1af" [ref=f2e696]
                  - cell [ref=f2e697]:
                    - button "Examiner" [ref=f2e698] [cursor=pointer]
                - row [ref=f2e705]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e706]
                  - cell "Système" [ref=f2e707]
                  - cell "Automatique" [ref=f2e709]
                  - cell "Autre action" [ref=f2e710]
                  - cell "Paiement" [ref=f2e711]
                  - cell "ee5c5547-db6a-449d-bb69-9145dd59f743" [ref=f2e712]
                  - cell [ref=f2e713]:
                    - button "Examiner" [ref=f2e714] [cursor=pointer]
                - row [ref=f2e721]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e722]
                  - cell "Système" [ref=f2e723]
                  - cell "Automatique" [ref=f2e725]
                  - cell "Autre action" [ref=f2e726]
                  - cell "Paiement" [ref=f2e727]
                  - cell "b63e8fa2-dbf4-48e9-87d6-56d75066da21" [ref=f2e728]
                  - cell [ref=f2e729]:
                    - button "Examiner" [ref=f2e730] [cursor=pointer]
                - row [ref=f2e737]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e738]
                  - cell "Système" [ref=f2e739]
                  - cell "Automatique" [ref=f2e741]
                  - cell "Autre action" [ref=f2e742]
                  - cell "Paiement" [ref=f2e743]
                  - cell "49785439-56c8-450e-948f-a7e9f90654be" [ref=f2e744]
                  - cell [ref=f2e745]:
                    - button "Examiner" [ref=f2e746] [cursor=pointer]
                - row [ref=f2e753]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e754]
                  - cell "Système" [ref=f2e755]
                  - cell "Automatique" [ref=f2e757]
                  - cell "Autre action" [ref=f2e758]
                  - cell "Paiement" [ref=f2e759]
                  - cell "d87ce68f-ed16-4d9f-8131-ac9ac5df0c67" [ref=f2e760]
                  - cell [ref=f2e761]:
                    - button "Examiner" [ref=f2e762] [cursor=pointer]
                - row [ref=f2e769]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e770]
                  - cell "Système" [ref=f2e771]
                  - cell "Automatique" [ref=f2e773]
                  - cell "Autre action" [ref=f2e774]
                  - cell "Paiement" [ref=f2e775]
                  - cell "a9048179-91b2-441c-a4fa-2353cb34f508" [ref=f2e776]
                  - cell [ref=f2e777]:
                    - button "Examiner" [ref=f2e778] [cursor=pointer]
                - row [ref=f2e785]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e786]
                  - cell "Système" [ref=f2e787]
                  - cell "Automatique" [ref=f2e789]
                  - cell "Autre action" [ref=f2e790]
                  - cell "Paiement" [ref=f2e791]
                  - cell "0d631ac2-2e55-4a5b-8cf6-40bd12675290" [ref=f2e792]
                  - cell [ref=f2e793]:
                    - button "Examiner" [ref=f2e794] [cursor=pointer]
                - row [ref=f2e801]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e802]
                  - cell "Système" [ref=f2e803]
                  - cell "Automatique" [ref=f2e805]
                  - cell "Autre action" [ref=f2e806]
                  - cell "Paiement" [ref=f2e807]
                  - cell "fb57814e-933a-43b2-be2c-3cdb68a7db5f" [ref=f2e808]
                  - cell [ref=f2e809]:
                    - button "Examiner" [ref=f2e810] [cursor=pointer]
                - row [ref=f2e817]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e818]
                  - cell "Système" [ref=f2e819]
                  - cell "Automatique" [ref=f2e821]
                  - cell "Autre action" [ref=f2e822]
                  - cell "Paiement" [ref=f2e823]
                  - cell "6a289dbf-573e-486d-9a0c-e32a54551ebc" [ref=f2e824]
                  - cell [ref=f2e825]:
                    - button "Examiner" [ref=f2e826] [cursor=pointer]
                - row [ref=f2e833]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e834]
                  - cell "Système" [ref=f2e835]
                  - cell "Automatique" [ref=f2e837]
                  - cell "Autre action" [ref=f2e838]
                  - cell "Paiement" [ref=f2e839]
                  - cell "f3f5f161-d372-416e-9645-95d3eab4f9ce" [ref=f2e840]
                  - cell [ref=f2e841]:
                    - button "Examiner" [ref=f2e842] [cursor=pointer]
                - row [ref=f2e849]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e850]
                  - cell "Système" [ref=f2e851]
                  - cell "Automatique" [ref=f2e853]
                  - cell "Autre action" [ref=f2e854]
                  - cell "Paiement" [ref=f2e855]
                  - cell "d99db65f-e8c2-461d-afdc-5b14a1abf9b2" [ref=f2e856]
                  - cell [ref=f2e857]:
                    - button "Examiner" [ref=f2e858] [cursor=pointer]
                - row [ref=f2e865]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e866]
                  - cell "Système" [ref=f2e867]
                  - cell "Automatique" [ref=f2e869]
                  - cell "Autre action" [ref=f2e870]
                  - cell "Paiement" [ref=f2e871]
                  - cell "fe2ba40b-e8b4-4184-acf2-f69162c4dac0" [ref=f2e872]
                  - cell [ref=f2e873]:
                    - button "Examiner" [ref=f2e874] [cursor=pointer]
                - row [ref=f2e881]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e882]
                  - cell "Système" [ref=f2e883]
                  - cell "Automatique" [ref=f2e885]
                  - cell "Autre action" [ref=f2e886]
                  - cell "Paiement" [ref=f2e887]
                  - cell "cbeecfeb-9239-4d41-860f-67193a1b2a7d" [ref=f2e888]
                  - cell [ref=f2e889]:
                    - button "Examiner" [ref=f2e890] [cursor=pointer]
                - row [ref=f2e897]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e898]
                  - cell "Système" [ref=f2e899]
                  - cell "Automatique" [ref=f2e901]
                  - cell "Autre action" [ref=f2e902]
                  - cell "Paiement" [ref=f2e903]
                  - cell "d0e25521-e68a-4687-a3cd-46cd761af0f4" [ref=f2e904]
                  - cell [ref=f2e905]:
                    - button "Examiner" [ref=f2e906] [cursor=pointer]
                - row [ref=f2e913]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e914]
                  - cell "Système" [ref=f2e915]
                  - cell "Automatique" [ref=f2e917]
                  - cell "Autre action" [ref=f2e918]
                  - cell "Paiement" [ref=f2e919]
                  - cell "be4d2599-793c-426d-a150-0521e6f50f4b" [ref=f2e920]
                  - cell [ref=f2e921]:
                    - button "Examiner" [ref=f2e922] [cursor=pointer]
                - row [ref=f2e929]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e930]
                  - cell "Système" [ref=f2e931]
                  - cell "Automatique" [ref=f2e933]
                  - cell "Autre action" [ref=f2e934]
                  - cell "Paiement" [ref=f2e935]
                  - cell "fb5fb459-b350-4a37-a7bd-88365efc1959" [ref=f2e936]
                  - cell [ref=f2e937]:
                    - button "Examiner" [ref=f2e938] [cursor=pointer]
                - row [ref=f2e945]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e946]
                  - cell "Système" [ref=f2e947]
                  - cell "Automatique" [ref=f2e949]
                  - cell "Autre action" [ref=f2e950]
                  - cell "Paiement" [ref=f2e951]
                  - cell "540b2017-36cc-4520-b1e1-d3dec7b69df8" [ref=f2e952]
                  - cell [ref=f2e953]:
                    - button "Examiner" [ref=f2e954] [cursor=pointer]
                - row [ref=f2e961]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e962]
                  - cell "Système" [ref=f2e963]
                  - cell "Automatique" [ref=f2e965]
                  - cell "Autre action" [ref=f2e966]
                  - cell "Paiement" [ref=f2e967]
                  - cell "c42acb74-8422-4565-9dbb-dcc61e014fe1" [ref=f2e968]
                  - cell [ref=f2e969]:
                    - button "Examiner" [ref=f2e970] [cursor=pointer]
                - row [ref=f2e977]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e978]
                  - cell "Système" [ref=f2e979]
                  - cell "Automatique" [ref=f2e981]
                  - cell "Autre action" [ref=f2e982]
                  - cell "Paiement" [ref=f2e983]
                  - cell "042d1ba8-7c7d-41d3-86fa-870aa1457b8f" [ref=f2e984]
                  - cell [ref=f2e985]:
                    - button "Examiner" [ref=f2e986] [cursor=pointer]
                - row [ref=f2e993]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e994]
                  - cell "Système" [ref=f2e995]
                  - cell "Automatique" [ref=f2e997]
                  - cell "Autre action" [ref=f2e998]
                  - cell "Paiement" [ref=f2e999]
                  - cell "b98c32d0-3f01-443a-91f2-f483184aedfe" [ref=f2e1000]
                  - cell [ref=f2e1001]:
                    - button "Examiner" [ref=f2e1002] [cursor=pointer]
                - row [ref=f2e1009]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1010]
                  - cell "Système" [ref=f2e1011]
                  - cell "Automatique" [ref=f2e1013]
                  - cell "Autre action" [ref=f2e1014]
                  - cell "Paiement" [ref=f2e1015]
                  - cell "81a2ebde-dce0-4c2d-ad75-b91c70faaca2" [ref=f2e1016]
                  - cell [ref=f2e1017]:
                    - button "Examiner" [ref=f2e1018] [cursor=pointer]
                - row [ref=f2e1025]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1026]
                  - cell "Système" [ref=f2e1027]
                  - cell "Automatique" [ref=f2e1029]
                  - cell "Autre action" [ref=f2e1030]
                  - cell "Paiement" [ref=f2e1031]
                  - cell "cd81f7c3-ae6d-4f89-8c50-fd088d2bd39b" [ref=f2e1032]
                  - cell [ref=f2e1033]:
                    - button "Examiner" [ref=f2e1034] [cursor=pointer]
                - row [ref=f2e1041]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1042]
                  - cell "Système" [ref=f2e1043]
                  - cell "Automatique" [ref=f2e1045]
                  - cell "Autre action" [ref=f2e1046]
                  - cell "Paiement" [ref=f2e1047]
                  - cell "94f055f5-a551-4d53-9ec8-616d2d999afe" [ref=f2e1048]
                  - cell [ref=f2e1049]:
                    - button "Examiner" [ref=f2e1050] [cursor=pointer]
                - row [ref=f2e1057]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1058]
                  - cell "Système" [ref=f2e1059]
                  - cell "Automatique" [ref=f2e1061]
                  - cell "Autre action" [ref=f2e1062]
                  - cell "Paiement" [ref=f2e1063]
                  - cell "06307f31-0b91-4c33-b770-e591b65a3cbd" [ref=f2e1064]
                  - cell [ref=f2e1065]:
                    - button "Examiner" [ref=f2e1066] [cursor=pointer]
                - row [ref=f2e1073]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1074]
                  - cell "Système" [ref=f2e1075]
                  - cell "Automatique" [ref=f2e1077]
                  - cell "Autre action" [ref=f2e1078]
                  - cell "Paiement" [ref=f2e1079]
                  - cell "10b30ff4-c449-4e97-96cc-899d9551fa5e" [ref=f2e1080]
                  - cell [ref=f2e1081]:
                    - button "Examiner" [ref=f2e1082] [cursor=pointer]
                - row [ref=f2e1089]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1090]
                  - cell "Système" [ref=f2e1091]
                  - cell "Automatique" [ref=f2e1093]
                  - cell "Autre action" [ref=f2e1094]
                  - cell "Paiement" [ref=f2e1095]
                  - cell "f119d65a-470c-4922-be96-f32518ca0cda" [ref=f2e1096]
                  - cell [ref=f2e1097]:
                    - button "Examiner" [ref=f2e1098] [cursor=pointer]
                - row [ref=f2e1105]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1106]
                  - cell "Système" [ref=f2e1107]
                  - cell "Automatique" [ref=f2e1109]
                  - cell "Autre action" [ref=f2e1110]
                  - cell "Paiement" [ref=f2e1111]
                  - cell "0a6bafab-393c-4afc-8d29-e7d1aa068fb7" [ref=f2e1112]
                  - cell [ref=f2e1113]:
                    - button "Examiner" [ref=f2e1114] [cursor=pointer]
                - row [ref=f2e1121]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1122]
                  - cell "Système" [ref=f2e1123]
                  - cell "Automatique" [ref=f2e1125]
                  - cell "Autre action" [ref=f2e1126]
                  - cell "Paiement" [ref=f2e1127]
                  - cell "68d44af7-97f2-4c97-b4af-d6878c25372f" [ref=f2e1128]
                  - cell [ref=f2e1129]:
                    - button "Examiner" [ref=f2e1130] [cursor=pointer]
                - row [ref=f2e1137]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1138]
                  - cell "Système" [ref=f2e1139]
                  - cell "Automatique" [ref=f2e1141]
                  - cell "Autre action" [ref=f2e1142]
                  - cell "Paiement" [ref=f2e1143]
                  - cell "5fa27489-eb90-47a6-939c-89921187f7e9" [ref=f2e1144]
                  - cell [ref=f2e1145]:
                    - button "Examiner" [ref=f2e1146] [cursor=pointer]
                - row [ref=f2e1153]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1154]
                  - cell "Système" [ref=f2e1155]
                  - cell "Automatique" [ref=f2e1157]
                  - cell "Autre action" [ref=f2e1158]
                  - cell "Paiement" [ref=f2e1159]
                  - cell "7298f6d2-bf30-4ad7-b7c8-c10b155827fb" [ref=f2e1160]
                  - cell [ref=f2e1161]:
                    - button "Examiner" [ref=f2e1162] [cursor=pointer]
                - row [ref=f2e1169]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1170]
                  - cell "Système" [ref=f2e1171]
                  - cell "Automatique" [ref=f2e1173]
                  - cell "Autre action" [ref=f2e1174]
                  - cell "Paiement" [ref=f2e1175]
                  - cell "5c1a5bf5-674f-4223-8b61-fcd254f4b3b5" [ref=f2e1176]
                  - cell [ref=f2e1177]:
                    - button "Examiner" [ref=f2e1178] [cursor=pointer]
                - row [ref=f2e1185]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1186]
                  - cell "Système" [ref=f2e1187]
                  - cell "Automatique" [ref=f2e1189]
                  - cell "Autre action" [ref=f2e1190]
                  - cell "Paiement" [ref=f2e1191]
                  - cell "47d297b1-46df-4881-87ed-0f91a00b95bf" [ref=f2e1192]
                  - cell [ref=f2e1193]:
                    - button "Examiner" [ref=f2e1194] [cursor=pointer]
                - row [ref=f2e1201]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1202]
                  - cell "Système" [ref=f2e1203]
                  - cell "Automatique" [ref=f2e1205]
                  - cell "Autre action" [ref=f2e1206]
                  - cell "Paiement" [ref=f2e1207]
                  - cell "598c149f-bcb2-49f8-b5af-5f65fe767a04" [ref=f2e1208]
                  - cell [ref=f2e1209]:
                    - button "Examiner" [ref=f2e1210] [cursor=pointer]
                - row [ref=f2e1217]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1218]
                  - cell "Système" [ref=f2e1219]
                  - cell "Automatique" [ref=f2e1221]
                  - cell "Autre action" [ref=f2e1222]
                  - cell "Paiement" [ref=f2e1223]
                  - cell "46f82031-348d-4da6-a3c5-21ee76cf396a" [ref=f2e1224]
                  - cell [ref=f2e1225]:
                    - button "Examiner" [ref=f2e1226] [cursor=pointer]
                - row [ref=f2e1233]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1234]
                  - cell "Système" [ref=f2e1235]
                  - cell "Automatique" [ref=f2e1237]
                  - cell "Autre action" [ref=f2e1238]
                  - cell "Paiement" [ref=f2e1239]
                  - cell "d4d5e6f0-0b1f-424c-a2c0-4f76d4025d59" [ref=f2e1240]
                  - cell [ref=f2e1241]:
                    - button "Examiner" [ref=f2e1242] [cursor=pointer]
                - row [ref=f2e1249]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1250]
                  - cell "Système" [ref=f2e1251]
                  - cell "Automatique" [ref=f2e1253]
                  - cell "Autre action" [ref=f2e1254]
                  - cell "Paiement" [ref=f2e1255]
                  - cell "f803e0ee-7eeb-41ce-963a-63cd13c80afd" [ref=f2e1256]
                  - cell [ref=f2e1257]:
                    - button "Examiner" [ref=f2e1258] [cursor=pointer]
                - row [ref=f2e1265]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1266]
                  - cell "Système" [ref=f2e1267]
                  - cell "Automatique" [ref=f2e1269]
                  - cell "Autre action" [ref=f2e1270]
                  - cell "Paiement" [ref=f2e1271]
                  - cell "aeba8ed1-d2b7-483a-a754-e4aea6063c80" [ref=f2e1272]
                  - cell [ref=f2e1273]:
                    - button "Examiner" [ref=f2e1274] [cursor=pointer]
                - row [ref=f2e1281]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1282]
                  - cell "Système" [ref=f2e1283]
                  - cell "Automatique" [ref=f2e1285]
                  - cell "Autre action" [ref=f2e1286]
                  - cell "Paiement" [ref=f2e1287]
                  - cell "585e6842-2e43-42d7-bc18-4c60cd285ae4" [ref=f2e1288]
                  - cell [ref=f2e1289]:
                    - button "Examiner" [ref=f2e1290] [cursor=pointer]
                - row [ref=f2e1297]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1298]
                  - cell "Système" [ref=f2e1299]
                  - cell "Automatique" [ref=f2e1301]
                  - cell "Autre action" [ref=f2e1302]
                  - cell "Paiement" [ref=f2e1303]
                  - cell "564ea482-c1eb-4b69-bced-b4e714a79e7a" [ref=f2e1304]
                  - cell [ref=f2e1305]:
                    - button "Examiner" [ref=f2e1306] [cursor=pointer]
                - row [ref=f2e1313]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1314]
                  - cell "Système" [ref=f2e1315]
                  - cell "Automatique" [ref=f2e1317]
                  - cell "Autre action" [ref=f2e1318]
                  - cell "Paiement" [ref=f2e1319]
                  - cell "9b4760c3-aae1-4eb6-b768-6a928f688af8" [ref=f2e1320]
                  - cell [ref=f2e1321]:
                    - button "Examiner" [ref=f2e1322] [cursor=pointer]
                - row [ref=f2e1329]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f2e1330]
                  - cell "Système" [ref=f2e1331]
                  - cell "Automatique" [ref=f2e1333]
                  - cell "Autre action" [ref=f2e1334]
                  - cell "Paiement" [ref=f2e1335]
                  - cell "29a6da7d-a6fd-4f60-ae3e-3544f0ee0eb5" [ref=f2e1336]
                  - cell [ref=f2e1337]:
                    - button "Examiner" [ref=f2e1338] [cursor=pointer]
                - row [ref=f2e1345]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1346]
                  - cell "Système" [ref=f2e1347]
                  - cell "Automatique" [ref=f2e1349]
                  - cell "Autre action" [ref=f2e1350]
                  - cell "Paiement" [ref=f2e1351]
                  - cell "cac825ee-2941-4751-a714-1b0a761dc08f" [ref=f2e1352]
                  - cell [ref=f2e1353]:
                    - button "Examiner" [ref=f2e1354] [cursor=pointer]
                - row [ref=f2e1361]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1362]
                  - cell "Système" [ref=f2e1363]
                  - cell "Automatique" [ref=f2e1365]
                  - cell "Autre action" [ref=f2e1366]
                  - cell "Paiement" [ref=f2e1367]
                  - cell "cbb0d1e8-206a-43a5-90ce-f49e0da3a362" [ref=f2e1368]
                  - cell [ref=f2e1369]:
                    - button "Examiner" [ref=f2e1370] [cursor=pointer]
                - row [ref=f2e1377]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1378]
                  - cell "Système" [ref=f2e1379]
                  - cell "Automatique" [ref=f2e1381]
                  - cell "Autre action" [ref=f2e1382]
                  - cell "Paiement" [ref=f2e1383]
                  - cell "6f7ace22-abc2-4d69-b09d-04a7e40df8a8" [ref=f2e1384]
                  - cell [ref=f2e1385]:
                    - button "Examiner" [ref=f2e1386] [cursor=pointer]
                - row [ref=f2e1393]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1394]
                  - cell "Système" [ref=f2e1395]
                  - cell "Automatique" [ref=f2e1397]
                  - cell "Autre action" [ref=f2e1398]
                  - cell "Paiement" [ref=f2e1399]
                  - cell "90993197-b82d-44d2-b85b-568b174f283b" [ref=f2e1400]
                  - cell [ref=f2e1401]:
                    - button "Examiner" [ref=f2e1402] [cursor=pointer]
                - row [ref=f2e1409]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1410]
                  - cell "Système" [ref=f2e1411]
                  - cell "Automatique" [ref=f2e1413]
                  - cell "Autre action" [ref=f2e1414]
                  - cell "Paiement" [ref=f2e1415]
                  - cell "2f71a7c4-c832-433c-b6b7-42bb004bc239" [ref=f2e1416]
                  - cell [ref=f2e1417]:
                    - button "Examiner" [ref=f2e1418] [cursor=pointer]
                - row [ref=f2e1425]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1426]
                  - cell "Système" [ref=f2e1427]
                  - cell "Automatique" [ref=f2e1429]
                  - cell "Autre action" [ref=f2e1430]
                  - cell "Paiement" [ref=f2e1431]
                  - cell "a2ec829a-4abf-49cf-b46f-928ddccda7da" [ref=f2e1432]
                  - cell [ref=f2e1433]:
                    - button "Examiner" [ref=f2e1434] [cursor=pointer]
                - row [ref=f2e1441]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1442]
                  - cell "Système" [ref=f2e1443]
                  - cell "Automatique" [ref=f2e1445]
                  - cell "Autre action" [ref=f2e1446]
                  - cell "Paiement" [ref=f2e1447]
                  - cell "5525646c-3cb9-49ab-8882-48619f05c13a" [ref=f2e1448]
                  - cell [ref=f2e1449]:
                    - button "Examiner" [ref=f2e1450] [cursor=pointer]
                - row [ref=f2e1457]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1458]
                  - cell "Système" [ref=f2e1459]
                  - cell "Automatique" [ref=f2e1461]
                  - cell "Autre action" [ref=f2e1462]
                  - cell "Paiement" [ref=f2e1463]
                  - cell "5832938a-4ef8-497f-abba-9109af5574c5" [ref=f2e1464]
                  - cell [ref=f2e1465]:
                    - button "Examiner" [ref=f2e1466] [cursor=pointer]
                - row [ref=f2e1473]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1474]
                  - cell "Système" [ref=f2e1475]
                  - cell "Automatique" [ref=f2e1477]
                  - cell "Autre action" [ref=f2e1478]
                  - cell "Paiement" [ref=f2e1479]
                  - cell "0883244b-3971-4247-b1a4-0b8f37a4467d" [ref=f2e1480]
                  - cell [ref=f2e1481]:
                    - button "Examiner" [ref=f2e1482] [cursor=pointer]
                - row [ref=f2e1489]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1490]
                  - cell "Système" [ref=f2e1491]
                  - cell "Automatique" [ref=f2e1493]
                  - cell "Autre action" [ref=f2e1494]
                  - cell "Paiement" [ref=f2e1495]
                  - cell "3cc684f3-ffa7-4b01-bbc8-231ff8acf6ba" [ref=f2e1496]
                  - cell [ref=f2e1497]:
                    - button "Examiner" [ref=f2e1498] [cursor=pointer]
                - row [ref=f2e1505]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1506]
                  - cell "Système" [ref=f2e1507]
                  - cell "Automatique" [ref=f2e1509]
                  - cell "Autre action" [ref=f2e1510]
                  - cell "Paiement" [ref=f2e1511]
                  - cell "392e348e-d01c-431d-b992-4aa7710dfc9c" [ref=f2e1512]
                  - cell [ref=f2e1513]:
                    - button "Examiner" [ref=f2e1514] [cursor=pointer]
                - row [ref=f2e1521]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1522]
                  - cell "Système" [ref=f2e1523]
                  - cell "Automatique" [ref=f2e1525]
                  - cell "Autre action" [ref=f2e1526]
                  - cell "Paiement" [ref=f2e1527]
                  - cell "5b139137-aa0d-40f3-abb5-213e5e0f72cf" [ref=f2e1528]
                  - cell [ref=f2e1529]:
                    - button "Examiner" [ref=f2e1530] [cursor=pointer]
                - row [ref=f2e1537]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1538]
                  - cell "Système" [ref=f2e1539]
                  - cell "Automatique" [ref=f2e1541]
                  - cell "Autre action" [ref=f2e1542]
                  - cell "Paiement" [ref=f2e1543]
                  - cell "d292f27b-ea03-4f3b-9ad4-b544be4bdc38" [ref=f2e1544]
                  - cell [ref=f2e1545]:
                    - button "Examiner" [ref=f2e1546] [cursor=pointer]
                - row [ref=f2e1553]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1554]
                  - cell "Système" [ref=f2e1555]
                  - cell "Automatique" [ref=f2e1557]
                  - cell "Autre action" [ref=f2e1558]
                  - cell "Paiement" [ref=f2e1559]
                  - cell "d4e2d85d-8375-4838-877d-6703eb7ef75d" [ref=f2e1560]
                  - cell [ref=f2e1561]:
                    - button "Examiner" [ref=f2e1562] [cursor=pointer]
                - row [ref=f2e1569]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1570]
                  - cell "Système" [ref=f2e1571]
                  - cell "Automatique" [ref=f2e1573]
                  - cell "Autre action" [ref=f2e1574]
                  - cell "Paiement" [ref=f2e1575]
                  - cell "a44e58b4-b861-43fa-86fb-8e035126d778" [ref=f2e1576]
                  - cell [ref=f2e1577]:
                    - button "Examiner" [ref=f2e1578] [cursor=pointer]
                - row [ref=f2e1585]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1586]
                  - cell "Système" [ref=f2e1587]
                  - cell "Automatique" [ref=f2e1589]
                  - cell "Autre action" [ref=f2e1590]
                  - cell "Paiement" [ref=f2e1591]
                  - cell "6cf37090-9662-4a7f-8020-372961258c00" [ref=f2e1592]
                  - cell [ref=f2e1593]:
                    - button "Examiner" [ref=f2e1594] [cursor=pointer]
                - row [ref=f2e1601]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1602]
                  - cell "Système" [ref=f2e1603]
                  - cell "Automatique" [ref=f2e1605]
                  - cell "Autre action" [ref=f2e1606]
                  - cell "Paiement" [ref=f2e1607]
                  - cell "ff81fcdf-bfc7-4a75-9d53-baeed2033384" [ref=f2e1608]
                  - cell [ref=f2e1609]:
                    - button "Examiner" [ref=f2e1610] [cursor=pointer]
                - row [ref=f2e1617]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1618]
                  - cell "Système" [ref=f2e1619]
                  - cell "Automatique" [ref=f2e1621]
                  - cell "Autre action" [ref=f2e1622]
                  - cell "Paiement" [ref=f2e1623]
                  - cell "cdcacea3-da62-486c-8d58-22cd0ba680e5" [ref=f2e1624]
                  - cell [ref=f2e1625]:
                    - button "Examiner" [ref=f2e1626] [cursor=pointer]
                - row [ref=f2e1633]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1634]
                  - cell "Système" [ref=f2e1635]
                  - cell "Automatique" [ref=f2e1637]
                  - cell "Autre action" [ref=f2e1638]
                  - cell "Paiement" [ref=f2e1639]
                  - cell "83a04701-482c-47e3-80ad-3429c45d65c7" [ref=f2e1640]
                  - cell [ref=f2e1641]:
                    - button "Examiner" [ref=f2e1642] [cursor=pointer]
                - row [ref=f2e1649]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1650]
                  - cell "Système" [ref=f2e1651]
                  - cell "Automatique" [ref=f2e1653]
                  - cell "Autre action" [ref=f2e1654]
                  - cell "Paiement" [ref=f2e1655]
                  - cell "f0111e5e-db38-425f-8f22-2f7efb05b35c" [ref=f2e1656]
                  - cell [ref=f2e1657]:
                    - button "Examiner" [ref=f2e1658] [cursor=pointer]
                - row [ref=f2e1665]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1666]
                  - cell "Système" [ref=f2e1667]
                  - cell "Automatique" [ref=f2e1669]
                  - cell "Autre action" [ref=f2e1670]
                  - cell "Paiement" [ref=f2e1671]
                  - cell "e9a0e3fa-8096-4586-b838-6b245ac09196" [ref=f2e1672]
                  - cell [ref=f2e1673]:
                    - button "Examiner" [ref=f2e1674] [cursor=pointer]
                - row [ref=f2e1681]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1682]
                  - cell "Système" [ref=f2e1683]
                  - cell "Automatique" [ref=f2e1685]
                  - cell "Autre action" [ref=f2e1686]
                  - cell "Paiement" [ref=f2e1687]
                  - cell "22c03799-28f9-45fa-b612-bafad7504335" [ref=f2e1688]
                  - cell [ref=f2e1689]:
                    - button "Examiner" [ref=f2e1690] [cursor=pointer]
                - row [ref=f2e1697]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1698]
                  - cell "Système" [ref=f2e1699]
                  - cell "Automatique" [ref=f2e1701]
                  - cell "Autre action" [ref=f2e1702]
                  - cell "Paiement" [ref=f2e1703]
                  - cell "f24be767-f0bd-4627-aed8-b571cacd40f9" [ref=f2e1704]
                  - cell [ref=f2e1705]:
                    - button "Examiner" [ref=f2e1706] [cursor=pointer]
                - row [ref=f2e1713]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1714]
                  - cell "Système" [ref=f2e1715]
                  - cell "Automatique" [ref=f2e1717]
                  - cell "Autre action" [ref=f2e1718]
                  - cell "Paiement" [ref=f2e1719]
                  - cell "5b34a530-ffd3-461e-8261-297c7a8b2d1f" [ref=f2e1720]
                  - cell [ref=f2e1721]:
                    - button "Examiner" [ref=f2e1722] [cursor=pointer]
                - row [ref=f2e1729]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1730]
                  - cell "Système" [ref=f2e1731]
                  - cell "Automatique" [ref=f2e1733]
                  - cell "Autre action" [ref=f2e1734]
                  - cell "Paiement" [ref=f2e1735]
                  - cell "226f01ef-8249-45b5-88e9-eb9f55d902cc" [ref=f2e1736]
                  - cell [ref=f2e1737]:
                    - button "Examiner" [ref=f2e1738] [cursor=pointer]
                - row [ref=f2e1745]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1746]
                  - cell "Système" [ref=f2e1747]
                  - cell "Automatique" [ref=f2e1749]
                  - cell "Autre action" [ref=f2e1750]
                  - cell "Paiement" [ref=f2e1751]
                  - cell "8419743c-167e-4fab-a450-339412cfb085" [ref=f2e1752]
                  - cell [ref=f2e1753]:
                    - button "Examiner" [ref=f2e1754] [cursor=pointer]
                - row [ref=f2e1761]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f2e1762]
                  - cell "Système" [ref=f2e1763]
                  - cell "Automatique" [ref=f2e1765]
                  - cell "Autre action" [ref=f2e1766]
                  - cell "Paiement" [ref=f2e1767]
                  - cell "e7a07230-3995-482f-a57b-af988fc305ff" [ref=f2e1768]
                  - cell [ref=f2e1769]:
                    - button "Examiner" [ref=f2e1770] [cursor=pointer]
  - alert [ref=f2e1777]
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
      |                                                                                        ^ Error: contrôles responsive de adm-journal (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```