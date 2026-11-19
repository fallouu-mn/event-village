# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-journal — Journal
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-journal (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 37

- Array []
+ Array [
+   "320 px : défilement horizontal (largeur du document 351 px, fenêtre 320 px)",
+   "320 px : texte tronqué sans le texte entier : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent)",
+   "320 px : textes qui se chevauchent : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b63e8fa2-dbf4-48e9-87d6-56d75066da21 » sur span.min-w-0 « Examiner » (44×6 px)",
+   "320 px : tableau sur téléphone (cartes attendues) : tableau « sans légende » (571 px)",
+   "320 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "320 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "320 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
+   "360 px : texte tronqué sans le texte entier : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b63e8fa2-dbf4-48e9-87d6-56d75066da21 » sur span.min-w-0 « Examiner » (44×6 px)",
+   "360 px : tableau sur téléphone (cartes attendues) : tableau « sans légende » (571 px)",
+   "360 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "360 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "360 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
+   "390 px : texte tronqué sans le texte entier : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent)",
+   "390 px : textes qui se chevauchent : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b63e8fa2-dbf4-48e9-87d6-56d75066da21 » sur span.min-w-0 « Examiner » (44×6 px)",
+   "390 px : tableau sur téléphone (cartes attendues) : tableau « sans légende » (571 px)",
+   "390 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "390 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "390 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
+   "768 px : texte hors de l’écran : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » de 533 à 770 px (fenêtre 768 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » de 533 à 770 px (fenêtre 768 px)",
+   "768 px : texte tronqué sans le texte entier : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (44×6 px)",
+   "768 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "768 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "768 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; span.block.truncate « Superadmin » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent)",
+   "1024 px : textes qui se chevauchent : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (44×6 px) ; td.py-3.font-mono « b63e8fa2-dbf4-48e9-87d6-56d75066da21 » sur span.min-w-0 « Examiner » (44×6 px)",
+   "1024 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "1024 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "1024 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » (points de suspension, texte entier absent) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » (points de suspension, texte entier absent) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » (points de suspension, texte entier absent) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » (points de suspension, texte entier absent)",
+   "1440 px : textes qui se chevauchent : td.py-3.font-mono « f38b3651-7b86-43d9-b918-54f5fe8d04eb » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « a1bead7e-787c-4b01-b09b-81c698014bd7 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « a31842ef-54d0-43a2-8755-9462afac2cbc » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « b4fabbe2-253b-42e1-be14-7046995980ea » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 0ca965aa-3ed2-4406-b26e-78620f9be286 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 0e40836a-8b8f-4ff3-b1ca-277db48ee696 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « 1c01b7b7-0c4a-41a9-8225-a7502a48e1af » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « ee5c5547-db6a-449d-bb69-9145dd59f743 » sur span.min-w-0 « Examiner » (27×6 px) ; td.py-3.font-mono « b63e8fa2-dbf4-48e9-87d6-56d75066da21 » sur span.min-w-0 « Examiner » (27×6 px)",
+   "1440 px : valeur technique affichée : f38b3651-7b86-43d9-b918-54f5fe8d04eb ; 37dcd681-a2c3-43f5-ac3d-df0055c611bf ; a1bead7e-787c-4b01-b09b-81c698014bd7 ; 5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce ; a31842ef-54d0-43a2-8755-9462afac2cbc ; b4fabbe2-253b-42e1-be14-7046995980ea ; 57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f ; 0ca965aa-3ed2-4406-b26e-78620f9be286 ; 0e40836a-8b8f-4ff3-b1ca-277db48ee696 ; 1c01b7b7-0c4a-41a9-8225-a7502a48e1af — ex. texte : « f38b3651-7b86-43d9-b918-54f5fe8d04eb » ; texte : « 37dcd681-a2c3-43f5-ac3d-df0055c611bf » ; texte : « a1bead7e-787c-4b01-b09b-81c698014bd7 »",
+   "1440 px : 3 cible(s) < 44 px : a « sans nom » 40×40 ; select « Toutes les actions Compte suspendu ou ré » 310×35 ; select « Tous les objets Compte Partenaire Événem » 125×35",
+   "1440 px : 611 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 10 px « Action » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 10 px « Entité / Objet » (div.flex.flex-wrap > div > label.block.text-[10px]) ; 12 px « 100 » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 12 px « entrée(s) trouvée(s) » (div.p-6.rounded-3xl > div.flex.flex-wrap > span.text-xs.font-bold) ; 10 px « Horodatage » (thead > tr.border-b.border-slate-200 > th.pb-3)",
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
        - generic [ref=f5e10]: Administration
        - link "Tableau de bord" [ref=f5e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e22]:
          - paragraph [ref=f5e23]: Gestion
          - generic [ref=f5e24]:
            - link "Événements" [ref=f5e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f5e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f5e42]:
          - paragraph [ref=f5e43]: Finances
          - link "Finance" [ref=f5e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f5e49]:
          - paragraph [ref=f5e50]: Engagement
          - generic [ref=f5e51]:
            - link "Parrainage" [ref=f5e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f5e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f5e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f5e66]:
          - paragraph [ref=f5e67]: Système
          - generic [ref=f5e68]:
            - link "Réglages" [ref=f5e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f5e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f5e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f5e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f5e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e107]: ES
          - generic [ref=f5e108]:
            - generic [ref=f5e109]: Elhadji SuperAdmin
            - generic [ref=f5e110]: Superadmin
        - generic [ref=f5e111]:
          - button "Se déconnecter" [ref=f5e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e117] [cursor=pointer]
    - generic [ref=f5e121]:
      - banner [ref=f5e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=f5e131] [cursor=pointer]:
          - generic [ref=f5e135]: "58"
      - main [ref=f5e136]:
        - generic [ref=f5e138]:
          - generic [ref=f5e139]:
            - generic [ref=f5e140]:
              - link [ref=f5e141] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Journal d’audit" [level=1] [ref=f5e145]
            - button "Actualiser" [ref=f5e146] [cursor=pointer]
          - generic [ref=f5e153]:
            - generic [ref=f5e154]:
              - generic [ref=f5e155]:
                - generic [ref=f5e156]:
                  - generic [ref=f5e157]: Action
                  - combobox [ref=f5e158]:
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
                - generic [ref=f5e159]:
                  - generic [ref=f5e160]: Entité / Objet
                  - combobox [ref=f5e161]:
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
              - generic [ref=f5e162]: 100 entrée(s) trouvée(s)
            - table [ref=f5e164]:
              - rowgroup [ref=f5e165]:
                - row [ref=f5e166]:
                  - columnheader "Horodatage" [ref=f5e167]
                  - columnheader "Utilisateur" [ref=f5e168]
                  - columnheader "Rôle à l’action" [ref=f5e169]
                  - columnheader "Action" [ref=f5e170]
                  - columnheader "Objet" [ref=f5e171]
                  - columnheader "ID Objet" [ref=f5e172]
                  - columnheader "Détails JSON" [ref=f5e173]
              - rowgroup [ref=f5e174]:
                - row [ref=f5e175]:
                  - cell "19 nov. 2026, 10:37:06" [ref=f5e176]
                  - cell "Système" [ref=f5e177]
                  - cell "Automatique" [ref=f5e179]
                  - cell "Autre action" [ref=f5e180]
                  - cell "Paiement" [ref=f5e181]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f5e182]
                  - cell [ref=f5e183]:
                    - button "Examiner" [ref=f5e184] [cursor=pointer]
                - row [ref=f5e191]:
                  - cell "19 nov. 2026, 10:36:59" [ref=f5e192]
                  - cell "Système" [ref=f5e193]
                  - cell "Automatique" [ref=f5e195]
                  - cell "Autre action" [ref=f5e196]
                  - cell "Paiement" [ref=f5e197]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f5e198]
                  - cell [ref=f5e199]:
                    - button "Examiner" [ref=f5e200] [cursor=pointer]
                - row [ref=f5e207]:
                  - cell "19 nov. 2026, 10:36:52" [ref=f5e208]
                  - cell "Système" [ref=f5e209]
                  - cell "Automatique" [ref=f5e211]
                  - cell "Autre action" [ref=f5e212]
                  - cell "Paiement" [ref=f5e213]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f5e214]
                  - cell [ref=f5e215]:
                    - button "Examiner" [ref=f5e216] [cursor=pointer]
                - row [ref=f5e223]:
                  - cell "19 nov. 2026, 10:36:46" [ref=f5e224]
                  - cell "Système" [ref=f5e225]
                  - cell "Automatique" [ref=f5e227]
                  - cell "Autre action" [ref=f5e228]
                  - cell "Paiement" [ref=f5e229]
                  - cell "f38b3651-7b86-43d9-b918-54f5fe8d04eb" [ref=f5e230]
                  - cell [ref=f5e231]:
                    - button "Examiner" [ref=f5e232] [cursor=pointer]
                - row [ref=f5e239]:
                  - cell "19 nov. 2026, 10:35:52" [ref=f5e240]
                  - 'cell "Elhadji SuperAdmin Aujourd’hui : Superadmin" [ref=f5e241]':
                    - generic [ref=f5e242]: Elhadji SuperAdmin
                    - generic [ref=f5e243]: "Aujourd’hui : Superadmin"
                  - cell "Automatique" [ref=f5e244]
                  - cell "Autre action" [ref=f5e245]
                  - cell "Compte" [ref=f5e246]
                  - cell "37dcd681-a2c3-43f5-ac3d-df0055c611bf" [ref=f5e247]
                  - cell [ref=f5e248]:
                    - button "Examiner" [ref=f5e249] [cursor=pointer]
                - row [ref=f5e256]:
                  - cell "19 nov. 2026, 10:35:45" [ref=f5e257]
                  - 'cell "Aïda Diallo Aujourd’hui : Administrateur" [ref=f5e258]':
                    - generic [ref=f5e259]: Aïda Diallo
                    - generic [ref=f5e260]: "Aujourd’hui : Administrateur"
                  - cell "Automatique" [ref=f5e261]
                  - cell "Autre action" [ref=f5e262]
                  - cell "Compte" [ref=f5e263]
                  - cell "a1bead7e-787c-4b01-b09b-81c698014bd7" [ref=f5e264]
                  - cell [ref=f5e265]:
                    - button "Examiner" [ref=f5e266] [cursor=pointer]
                - row [ref=f5e273]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e274]
                  - cell "Système" [ref=f5e275]
                  - cell "Automatique" [ref=f5e277]
                  - cell "Autre action" [ref=f5e278]
                  - cell "Paiement" [ref=f5e279]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f5e280]
                  - cell [ref=f5e281]:
                    - button "Examiner" [ref=f5e282] [cursor=pointer]
                - row [ref=f5e289]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e290]
                  - cell "Système" [ref=f5e291]
                  - cell "Automatique" [ref=f5e293]
                  - cell "Autre action" [ref=f5e294]
                  - cell "Paiement" [ref=f5e295]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f5e296]
                  - cell [ref=f5e297]:
                    - button "Examiner" [ref=f5e298] [cursor=pointer]
                - row [ref=f5e305]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e306]
                  - cell "Système" [ref=f5e307]
                  - cell "Automatique" [ref=f5e309]
                  - cell "Autre action" [ref=f5e310]
                  - cell "Paiement" [ref=f5e311]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f5e312]
                  - cell [ref=f5e313]:
                    - button "Examiner" [ref=f5e314] [cursor=pointer]
                - row [ref=f5e321]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e322]
                  - cell "Système" [ref=f5e323]
                  - cell "Automatique" [ref=f5e325]
                  - cell "Autre action" [ref=f5e326]
                  - cell "Paiement" [ref=f5e327]
                  - cell "5c2e337a-a3bb-4f0b-ac16-6bd9271a5fce" [ref=f5e328]
                  - cell [ref=f5e329]:
                    - button "Examiner" [ref=f5e330] [cursor=pointer]
                - row [ref=f5e337]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e338]
                  - cell "Système" [ref=f5e339]
                  - cell "Automatique" [ref=f5e341]
                  - cell "Autre action" [ref=f5e342]
                  - cell "Paiement" [ref=f5e343]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f5e344]
                  - cell [ref=f5e345]:
                    - button "Examiner" [ref=f5e346] [cursor=pointer]
                - row [ref=f5e353]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e354]
                  - cell "Système" [ref=f5e355]
                  - cell "Automatique" [ref=f5e357]
                  - cell "Autre action" [ref=f5e358]
                  - cell "Paiement" [ref=f5e359]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f5e360]
                  - cell [ref=f5e361]:
                    - button "Examiner" [ref=f5e362] [cursor=pointer]
                - row [ref=f5e369]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e370]
                  - cell "Système" [ref=f5e371]
                  - cell "Automatique" [ref=f5e373]
                  - cell "Autre action" [ref=f5e374]
                  - cell "Paiement" [ref=f5e375]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f5e376]
                  - cell [ref=f5e377]:
                    - button "Examiner" [ref=f5e378] [cursor=pointer]
                - row [ref=f5e385]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e386]
                  - cell "Système" [ref=f5e387]
                  - cell "Automatique" [ref=f5e389]
                  - cell "Autre action" [ref=f5e390]
                  - cell "Paiement" [ref=f5e391]
                  - cell "a31842ef-54d0-43a2-8755-9462afac2cbc" [ref=f5e392]
                  - cell [ref=f5e393]:
                    - button "Examiner" [ref=f5e394] [cursor=pointer]
                - row [ref=f5e401]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e402]
                  - cell "Système" [ref=f5e403]
                  - cell "Automatique" [ref=f5e405]
                  - cell "Autre action" [ref=f5e406]
                  - cell "Paiement" [ref=f5e407]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f5e408]
                  - cell [ref=f5e409]:
                    - button "Examiner" [ref=f5e410] [cursor=pointer]
                - row [ref=f5e417]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e418]
                  - cell "Système" [ref=f5e419]
                  - cell "Automatique" [ref=f5e421]
                  - cell "Autre action" [ref=f5e422]
                  - cell "Paiement" [ref=f5e423]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f5e424]
                  - cell [ref=f5e425]:
                    - button "Examiner" [ref=f5e426] [cursor=pointer]
                - row [ref=f5e433]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e434]
                  - cell "Système" [ref=f5e435]
                  - cell "Automatique" [ref=f5e437]
                  - cell "Autre action" [ref=f5e438]
                  - cell "Paiement" [ref=f5e439]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f5e440]
                  - cell [ref=f5e441]:
                    - button "Examiner" [ref=f5e442] [cursor=pointer]
                - row [ref=f5e449]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e450]
                  - cell "Système" [ref=f5e451]
                  - cell "Automatique" [ref=f5e453]
                  - cell "Autre action" [ref=f5e454]
                  - cell "Paiement" [ref=f5e455]
                  - cell "b4fabbe2-253b-42e1-be14-7046995980ea" [ref=f5e456]
                  - cell [ref=f5e457]:
                    - button "Examiner" [ref=f5e458] [cursor=pointer]
                - row [ref=f5e465]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e466]
                  - cell "Système" [ref=f5e467]
                  - cell "Automatique" [ref=f5e469]
                  - cell "Autre action" [ref=f5e470]
                  - cell "Paiement" [ref=f5e471]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f5e472]
                  - cell [ref=f5e473]:
                    - button "Examiner" [ref=f5e474] [cursor=pointer]
                - row [ref=f5e481]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e482]
                  - cell "Système" [ref=f5e483]
                  - cell "Automatique" [ref=f5e485]
                  - cell "Autre action" [ref=f5e486]
                  - cell "Paiement" [ref=f5e487]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f5e488]
                  - cell [ref=f5e489]:
                    - button "Examiner" [ref=f5e490] [cursor=pointer]
                - row [ref=f5e497]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e498]
                  - cell "Système" [ref=f5e499]
                  - cell "Automatique" [ref=f5e501]
                  - cell "Autre action" [ref=f5e502]
                  - cell "Paiement" [ref=f5e503]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f5e504]
                  - cell [ref=f5e505]:
                    - button "Examiner" [ref=f5e506] [cursor=pointer]
                - row [ref=f5e513]:
                  - cell "19 nov. 2026, 10:34:38" [ref=f5e514]
                  - cell "Système" [ref=f5e515]
                  - cell "Automatique" [ref=f5e517]
                  - cell "Autre action" [ref=f5e518]
                  - cell "Paiement" [ref=f5e519]
                  - cell "57f9a1d2-96f6-4bdb-a22b-f5ef6eee503f" [ref=f5e520]
                  - cell [ref=f5e521]:
                    - button "Examiner" [ref=f5e522] [cursor=pointer]
                - row [ref=f5e529]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e530]
                  - cell "Système" [ref=f5e531]
                  - cell "Automatique" [ref=f5e533]
                  - cell "Autre action" [ref=f5e534]
                  - cell "Paiement" [ref=f5e535]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f5e536]
                  - cell [ref=f5e537]:
                    - button "Examiner" [ref=f5e538] [cursor=pointer]
                - row [ref=f5e545]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e546]
                  - cell "Système" [ref=f5e547]
                  - cell "Automatique" [ref=f5e549]
                  - cell "Autre action" [ref=f5e550]
                  - cell "Paiement" [ref=f5e551]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f5e552]
                  - cell [ref=f5e553]:
                    - button "Examiner" [ref=f5e554] [cursor=pointer]
                - row [ref=f5e561]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e562]
                  - cell "Système" [ref=f5e563]
                  - cell "Automatique" [ref=f5e565]
                  - cell "Autre action" [ref=f5e566]
                  - cell "Paiement" [ref=f5e567]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f5e568]
                  - cell [ref=f5e569]:
                    - button "Examiner" [ref=f5e570] [cursor=pointer]
                - row [ref=f5e577]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e578]
                  - cell "Système" [ref=f5e579]
                  - cell "Automatique" [ref=f5e581]
                  - cell "Autre action" [ref=f5e582]
                  - cell "Paiement" [ref=f5e583]
                  - cell "0ca965aa-3ed2-4406-b26e-78620f9be286" [ref=f5e584]
                  - cell [ref=f5e585]:
                    - button "Examiner" [ref=f5e586] [cursor=pointer]
                - row [ref=f5e593]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e594]
                  - cell "Système" [ref=f5e595]
                  - cell "Automatique" [ref=f5e597]
                  - cell "Autre action" [ref=f5e598]
                  - cell "Paiement" [ref=f5e599]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f5e600]
                  - cell [ref=f5e601]:
                    - button "Examiner" [ref=f5e602] [cursor=pointer]
                - row [ref=f5e609]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e610]
                  - cell "Système" [ref=f5e611]
                  - cell "Automatique" [ref=f5e613]
                  - cell "Autre action" [ref=f5e614]
                  - cell "Paiement" [ref=f5e615]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f5e616]
                  - cell [ref=f5e617]:
                    - button "Examiner" [ref=f5e618] [cursor=pointer]
                - row [ref=f5e625]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e626]
                  - cell "Système" [ref=f5e627]
                  - cell "Automatique" [ref=f5e629]
                  - cell "Autre action" [ref=f5e630]
                  - cell "Paiement" [ref=f5e631]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f5e632]
                  - cell [ref=f5e633]:
                    - button "Examiner" [ref=f5e634] [cursor=pointer]
                - row [ref=f5e641]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e642]
                  - cell "Système" [ref=f5e643]
                  - cell "Automatique" [ref=f5e645]
                  - cell "Autre action" [ref=f5e646]
                  - cell "Paiement" [ref=f5e647]
                  - cell "0e40836a-8b8f-4ff3-b1ca-277db48ee696" [ref=f5e648]
                  - cell [ref=f5e649]:
                    - button "Examiner" [ref=f5e650] [cursor=pointer]
                - row [ref=f5e657]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e658]
                  - cell "Système" [ref=f5e659]
                  - cell "Automatique" [ref=f5e661]
                  - cell "Autre action" [ref=f5e662]
                  - cell "Paiement" [ref=f5e663]
                  - cell "1c01b7b7-0c4a-41a9-8225-a7502a48e1af" [ref=f5e664]
                  - cell [ref=f5e665]:
                    - button "Examiner" [ref=f5e666] [cursor=pointer]
                - row [ref=f5e673]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e674]
                  - cell "Système" [ref=f5e675]
                  - cell "Automatique" [ref=f5e677]
                  - cell "Autre action" [ref=f5e678]
                  - cell "Paiement" [ref=f5e679]
                  - cell "ee5c5547-db6a-449d-bb69-9145dd59f743" [ref=f5e680]
                  - cell [ref=f5e681]:
                    - button "Examiner" [ref=f5e682] [cursor=pointer]
                - row [ref=f5e689]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e690]
                  - cell "Système" [ref=f5e691]
                  - cell "Automatique" [ref=f5e693]
                  - cell "Autre action" [ref=f5e694]
                  - cell "Paiement" [ref=f5e695]
                  - cell "b63e8fa2-dbf4-48e9-87d6-56d75066da21" [ref=f5e696]
                  - cell [ref=f5e697]:
                    - button "Examiner" [ref=f5e698] [cursor=pointer]
                - row [ref=f5e705]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e706]
                  - cell "Système" [ref=f5e707]
                  - cell "Automatique" [ref=f5e709]
                  - cell "Autre action" [ref=f5e710]
                  - cell "Paiement" [ref=f5e711]
                  - cell "49785439-56c8-450e-948f-a7e9f90654be" [ref=f5e712]
                  - cell [ref=f5e713]:
                    - button "Examiner" [ref=f5e714] [cursor=pointer]
                - row [ref=f5e721]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e722]
                  - cell "Système" [ref=f5e723]
                  - cell "Automatique" [ref=f5e725]
                  - cell "Autre action" [ref=f5e726]
                  - cell "Paiement" [ref=f5e727]
                  - cell "d87ce68f-ed16-4d9f-8131-ac9ac5df0c67" [ref=f5e728]
                  - cell [ref=f5e729]:
                    - button "Examiner" [ref=f5e730] [cursor=pointer]
                - row [ref=f5e737]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e738]
                  - cell "Système" [ref=f5e739]
                  - cell "Automatique" [ref=f5e741]
                  - cell "Autre action" [ref=f5e742]
                  - cell "Paiement" [ref=f5e743]
                  - cell "a9048179-91b2-441c-a4fa-2353cb34f508" [ref=f5e744]
                  - cell [ref=f5e745]:
                    - button "Examiner" [ref=f5e746] [cursor=pointer]
                - row [ref=f5e753]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e754]
                  - cell "Système" [ref=f5e755]
                  - cell "Automatique" [ref=f5e757]
                  - cell "Autre action" [ref=f5e758]
                  - cell "Paiement" [ref=f5e759]
                  - cell "0d631ac2-2e55-4a5b-8cf6-40bd12675290" [ref=f5e760]
                  - cell [ref=f5e761]:
                    - button "Examiner" [ref=f5e762] [cursor=pointer]
                - row [ref=f5e769]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e770]
                  - cell "Système" [ref=f5e771]
                  - cell "Automatique" [ref=f5e773]
                  - cell "Autre action" [ref=f5e774]
                  - cell "Paiement" [ref=f5e775]
                  - cell "fb57814e-933a-43b2-be2c-3cdb68a7db5f" [ref=f5e776]
                  - cell [ref=f5e777]:
                    - button "Examiner" [ref=f5e778] [cursor=pointer]
                - row [ref=f5e785]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e786]
                  - cell "Système" [ref=f5e787]
                  - cell "Automatique" [ref=f5e789]
                  - cell "Autre action" [ref=f5e790]
                  - cell "Paiement" [ref=f5e791]
                  - cell "6a289dbf-573e-486d-9a0c-e32a54551ebc" [ref=f5e792]
                  - cell [ref=f5e793]:
                    - button "Examiner" [ref=f5e794] [cursor=pointer]
                - row [ref=f5e801]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e802]
                  - cell "Système" [ref=f5e803]
                  - cell "Automatique" [ref=f5e805]
                  - cell "Autre action" [ref=f5e806]
                  - cell "Paiement" [ref=f5e807]
                  - cell "f3f5f161-d372-416e-9645-95d3eab4f9ce" [ref=f5e808]
                  - cell [ref=f5e809]:
                    - button "Examiner" [ref=f5e810] [cursor=pointer]
                - row [ref=f5e817]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e818]
                  - cell "Système" [ref=f5e819]
                  - cell "Automatique" [ref=f5e821]
                  - cell "Autre action" [ref=f5e822]
                  - cell "Paiement" [ref=f5e823]
                  - cell "d99db65f-e8c2-461d-afdc-5b14a1abf9b2" [ref=f5e824]
                  - cell [ref=f5e825]:
                    - button "Examiner" [ref=f5e826] [cursor=pointer]
                - row [ref=f5e833]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e834]
                  - cell "Système" [ref=f5e835]
                  - cell "Automatique" [ref=f5e837]
                  - cell "Autre action" [ref=f5e838]
                  - cell "Paiement" [ref=f5e839]
                  - cell "fe2ba40b-e8b4-4184-acf2-f69162c4dac0" [ref=f5e840]
                  - cell [ref=f5e841]:
                    - button "Examiner" [ref=f5e842] [cursor=pointer]
                - row [ref=f5e849]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e850]
                  - cell "Système" [ref=f5e851]
                  - cell "Automatique" [ref=f5e853]
                  - cell "Autre action" [ref=f5e854]
                  - cell "Paiement" [ref=f5e855]
                  - cell "cbeecfeb-9239-4d41-860f-67193a1b2a7d" [ref=f5e856]
                  - cell [ref=f5e857]:
                    - button "Examiner" [ref=f5e858] [cursor=pointer]
                - row [ref=f5e865]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e866]
                  - cell "Système" [ref=f5e867]
                  - cell "Automatique" [ref=f5e869]
                  - cell "Autre action" [ref=f5e870]
                  - cell "Paiement" [ref=f5e871]
                  - cell "d0e25521-e68a-4687-a3cd-46cd761af0f4" [ref=f5e872]
                  - cell [ref=f5e873]:
                    - button "Examiner" [ref=f5e874] [cursor=pointer]
                - row [ref=f5e881]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e882]
                  - cell "Système" [ref=f5e883]
                  - cell "Automatique" [ref=f5e885]
                  - cell "Autre action" [ref=f5e886]
                  - cell "Paiement" [ref=f5e887]
                  - cell "be4d2599-793c-426d-a150-0521e6f50f4b" [ref=f5e888]
                  - cell [ref=f5e889]:
                    - button "Examiner" [ref=f5e890] [cursor=pointer]
                - row [ref=f5e897]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e898]
                  - cell "Système" [ref=f5e899]
                  - cell "Automatique" [ref=f5e901]
                  - cell "Autre action" [ref=f5e902]
                  - cell "Paiement" [ref=f5e903]
                  - cell "fb5fb459-b350-4a37-a7bd-88365efc1959" [ref=f5e904]
                  - cell [ref=f5e905]:
                    - button "Examiner" [ref=f5e906] [cursor=pointer]
                - row [ref=f5e913]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e914]
                  - cell "Système" [ref=f5e915]
                  - cell "Automatique" [ref=f5e917]
                  - cell "Autre action" [ref=f5e918]
                  - cell "Paiement" [ref=f5e919]
                  - cell "540b2017-36cc-4520-b1e1-d3dec7b69df8" [ref=f5e920]
                  - cell [ref=f5e921]:
                    - button "Examiner" [ref=f5e922] [cursor=pointer]
                - row [ref=f5e929]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e930]
                  - cell "Système" [ref=f5e931]
                  - cell "Automatique" [ref=f5e933]
                  - cell "Autre action" [ref=f5e934]
                  - cell "Paiement" [ref=f5e935]
                  - cell "c42acb74-8422-4565-9dbb-dcc61e014fe1" [ref=f5e936]
                  - cell [ref=f5e937]:
                    - button "Examiner" [ref=f5e938] [cursor=pointer]
                - row [ref=f5e945]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e946]
                  - cell "Système" [ref=f5e947]
                  - cell "Automatique" [ref=f5e949]
                  - cell "Autre action" [ref=f5e950]
                  - cell "Paiement" [ref=f5e951]
                  - cell "042d1ba8-7c7d-41d3-86fa-870aa1457b8f" [ref=f5e952]
                  - cell [ref=f5e953]:
                    - button "Examiner" [ref=f5e954] [cursor=pointer]
                - row [ref=f5e961]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e962]
                  - cell "Système" [ref=f5e963]
                  - cell "Automatique" [ref=f5e965]
                  - cell "Autre action" [ref=f5e966]
                  - cell "Paiement" [ref=f5e967]
                  - cell "b98c32d0-3f01-443a-91f2-f483184aedfe" [ref=f5e968]
                  - cell [ref=f5e969]:
                    - button "Examiner" [ref=f5e970] [cursor=pointer]
                - row [ref=f5e977]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e978]
                  - cell "Système" [ref=f5e979]
                  - cell "Automatique" [ref=f5e981]
                  - cell "Autre action" [ref=f5e982]
                  - cell "Paiement" [ref=f5e983]
                  - cell "81a2ebde-dce0-4c2d-ad75-b91c70faaca2" [ref=f5e984]
                  - cell [ref=f5e985]:
                    - button "Examiner" [ref=f5e986] [cursor=pointer]
                - row [ref=f5e993]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e994]
                  - cell "Système" [ref=f5e995]
                  - cell "Automatique" [ref=f5e997]
                  - cell "Autre action" [ref=f5e998]
                  - cell "Paiement" [ref=f5e999]
                  - cell "cd81f7c3-ae6d-4f89-8c50-fd088d2bd39b" [ref=f5e1000]
                  - cell [ref=f5e1001]:
                    - button "Examiner" [ref=f5e1002] [cursor=pointer]
                - row [ref=f5e1009]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1010]
                  - cell "Système" [ref=f5e1011]
                  - cell "Automatique" [ref=f5e1013]
                  - cell "Autre action" [ref=f5e1014]
                  - cell "Paiement" [ref=f5e1015]
                  - cell "94f055f5-a551-4d53-9ec8-616d2d999afe" [ref=f5e1016]
                  - cell [ref=f5e1017]:
                    - button "Examiner" [ref=f5e1018] [cursor=pointer]
                - row [ref=f5e1025]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1026]
                  - cell "Système" [ref=f5e1027]
                  - cell "Automatique" [ref=f5e1029]
                  - cell "Autre action" [ref=f5e1030]
                  - cell "Paiement" [ref=f5e1031]
                  - cell "06307f31-0b91-4c33-b770-e591b65a3cbd" [ref=f5e1032]
                  - cell [ref=f5e1033]:
                    - button "Examiner" [ref=f5e1034] [cursor=pointer]
                - row [ref=f5e1041]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1042]
                  - cell "Système" [ref=f5e1043]
                  - cell "Automatique" [ref=f5e1045]
                  - cell "Autre action" [ref=f5e1046]
                  - cell "Paiement" [ref=f5e1047]
                  - cell "10b30ff4-c449-4e97-96cc-899d9551fa5e" [ref=f5e1048]
                  - cell [ref=f5e1049]:
                    - button "Examiner" [ref=f5e1050] [cursor=pointer]
                - row [ref=f5e1057]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1058]
                  - cell "Système" [ref=f5e1059]
                  - cell "Automatique" [ref=f5e1061]
                  - cell "Autre action" [ref=f5e1062]
                  - cell "Paiement" [ref=f5e1063]
                  - cell "f119d65a-470c-4922-be96-f32518ca0cda" [ref=f5e1064]
                  - cell [ref=f5e1065]:
                    - button "Examiner" [ref=f5e1066] [cursor=pointer]
                - row [ref=f5e1073]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1074]
                  - cell "Système" [ref=f5e1075]
                  - cell "Automatique" [ref=f5e1077]
                  - cell "Autre action" [ref=f5e1078]
                  - cell "Paiement" [ref=f5e1079]
                  - cell "0a6bafab-393c-4afc-8d29-e7d1aa068fb7" [ref=f5e1080]
                  - cell [ref=f5e1081]:
                    - button "Examiner" [ref=f5e1082] [cursor=pointer]
                - row [ref=f5e1089]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1090]
                  - cell "Système" [ref=f5e1091]
                  - cell "Automatique" [ref=f5e1093]
                  - cell "Autre action" [ref=f5e1094]
                  - cell "Paiement" [ref=f5e1095]
                  - cell "68d44af7-97f2-4c97-b4af-d6878c25372f" [ref=f5e1096]
                  - cell [ref=f5e1097]:
                    - button "Examiner" [ref=f5e1098] [cursor=pointer]
                - row [ref=f5e1105]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1106]
                  - cell "Système" [ref=f5e1107]
                  - cell "Automatique" [ref=f5e1109]
                  - cell "Autre action" [ref=f5e1110]
                  - cell "Paiement" [ref=f5e1111]
                  - cell "5fa27489-eb90-47a6-939c-89921187f7e9" [ref=f5e1112]
                  - cell [ref=f5e1113]:
                    - button "Examiner" [ref=f5e1114] [cursor=pointer]
                - row [ref=f5e1121]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1122]
                  - cell "Système" [ref=f5e1123]
                  - cell "Automatique" [ref=f5e1125]
                  - cell "Autre action" [ref=f5e1126]
                  - cell "Paiement" [ref=f5e1127]
                  - cell "7298f6d2-bf30-4ad7-b7c8-c10b155827fb" [ref=f5e1128]
                  - cell [ref=f5e1129]:
                    - button "Examiner" [ref=f5e1130] [cursor=pointer]
                - row [ref=f5e1137]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1138]
                  - cell "Système" [ref=f5e1139]
                  - cell "Automatique" [ref=f5e1141]
                  - cell "Autre action" [ref=f5e1142]
                  - cell "Paiement" [ref=f5e1143]
                  - cell "5c1a5bf5-674f-4223-8b61-fcd254f4b3b5" [ref=f5e1144]
                  - cell [ref=f5e1145]:
                    - button "Examiner" [ref=f5e1146] [cursor=pointer]
                - row [ref=f5e1153]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1154]
                  - cell "Système" [ref=f5e1155]
                  - cell "Automatique" [ref=f5e1157]
                  - cell "Autre action" [ref=f5e1158]
                  - cell "Paiement" [ref=f5e1159]
                  - cell "47d297b1-46df-4881-87ed-0f91a00b95bf" [ref=f5e1160]
                  - cell [ref=f5e1161]:
                    - button "Examiner" [ref=f5e1162] [cursor=pointer]
                - row [ref=f5e1169]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1170]
                  - cell "Système" [ref=f5e1171]
                  - cell "Automatique" [ref=f5e1173]
                  - cell "Autre action" [ref=f5e1174]
                  - cell "Paiement" [ref=f5e1175]
                  - cell "598c149f-bcb2-49f8-b5af-5f65fe767a04" [ref=f5e1176]
                  - cell [ref=f5e1177]:
                    - button "Examiner" [ref=f5e1178] [cursor=pointer]
                - row [ref=f5e1185]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1186]
                  - cell "Système" [ref=f5e1187]
                  - cell "Automatique" [ref=f5e1189]
                  - cell "Autre action" [ref=f5e1190]
                  - cell "Paiement" [ref=f5e1191]
                  - cell "46f82031-348d-4da6-a3c5-21ee76cf396a" [ref=f5e1192]
                  - cell [ref=f5e1193]:
                    - button "Examiner" [ref=f5e1194] [cursor=pointer]
                - row [ref=f5e1201]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1202]
                  - cell "Système" [ref=f5e1203]
                  - cell "Automatique" [ref=f5e1205]
                  - cell "Autre action" [ref=f5e1206]
                  - cell "Paiement" [ref=f5e1207]
                  - cell "d4d5e6f0-0b1f-424c-a2c0-4f76d4025d59" [ref=f5e1208]
                  - cell [ref=f5e1209]:
                    - button "Examiner" [ref=f5e1210] [cursor=pointer]
                - row [ref=f5e1217]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1218]
                  - cell "Système" [ref=f5e1219]
                  - cell "Automatique" [ref=f5e1221]
                  - cell "Autre action" [ref=f5e1222]
                  - cell "Paiement" [ref=f5e1223]
                  - cell "f803e0ee-7eeb-41ce-963a-63cd13c80afd" [ref=f5e1224]
                  - cell [ref=f5e1225]:
                    - button "Examiner" [ref=f5e1226] [cursor=pointer]
                - row [ref=f5e1233]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1234]
                  - cell "Système" [ref=f5e1235]
                  - cell "Automatique" [ref=f5e1237]
                  - cell "Autre action" [ref=f5e1238]
                  - cell "Paiement" [ref=f5e1239]
                  - cell "aeba8ed1-d2b7-483a-a754-e4aea6063c80" [ref=f5e1240]
                  - cell [ref=f5e1241]:
                    - button "Examiner" [ref=f5e1242] [cursor=pointer]
                - row [ref=f5e1249]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1250]
                  - cell "Système" [ref=f5e1251]
                  - cell "Automatique" [ref=f5e1253]
                  - cell "Autre action" [ref=f5e1254]
                  - cell "Paiement" [ref=f5e1255]
                  - cell "585e6842-2e43-42d7-bc18-4c60cd285ae4" [ref=f5e1256]
                  - cell [ref=f5e1257]:
                    - button "Examiner" [ref=f5e1258] [cursor=pointer]
                - row [ref=f5e1265]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1266]
                  - cell "Système" [ref=f5e1267]
                  - cell "Automatique" [ref=f5e1269]
                  - cell "Autre action" [ref=f5e1270]
                  - cell "Paiement" [ref=f5e1271]
                  - cell "564ea482-c1eb-4b69-bced-b4e714a79e7a" [ref=f5e1272]
                  - cell [ref=f5e1273]:
                    - button "Examiner" [ref=f5e1274] [cursor=pointer]
                - row [ref=f5e1281]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1282]
                  - cell "Système" [ref=f5e1283]
                  - cell "Automatique" [ref=f5e1285]
                  - cell "Autre action" [ref=f5e1286]
                  - cell "Paiement" [ref=f5e1287]
                  - cell "9b4760c3-aae1-4eb6-b768-6a928f688af8" [ref=f5e1288]
                  - cell [ref=f5e1289]:
                    - button "Examiner" [ref=f5e1290] [cursor=pointer]
                - row [ref=f5e1297]:
                  - cell "19 nov. 2026, 10:34:37" [ref=f5e1298]
                  - cell "Système" [ref=f5e1299]
                  - cell "Automatique" [ref=f5e1301]
                  - cell "Autre action" [ref=f5e1302]
                  - cell "Paiement" [ref=f5e1303]
                  - cell "29a6da7d-a6fd-4f60-ae3e-3544f0ee0eb5" [ref=f5e1304]
                  - cell [ref=f5e1305]:
                    - button "Examiner" [ref=f5e1306] [cursor=pointer]
                - row [ref=f5e1313]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1314]
                  - cell "Système" [ref=f5e1315]
                  - cell "Automatique" [ref=f5e1317]
                  - cell "Autre action" [ref=f5e1318]
                  - cell "Paiement" [ref=f5e1319]
                  - cell "cac825ee-2941-4751-a714-1b0a761dc08f" [ref=f5e1320]
                  - cell [ref=f5e1321]:
                    - button "Examiner" [ref=f5e1322] [cursor=pointer]
                - row [ref=f5e1329]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1330]
                  - cell "Système" [ref=f5e1331]
                  - cell "Automatique" [ref=f5e1333]
                  - cell "Autre action" [ref=f5e1334]
                  - cell "Paiement" [ref=f5e1335]
                  - cell "cbb0d1e8-206a-43a5-90ce-f49e0da3a362" [ref=f5e1336]
                  - cell [ref=f5e1337]:
                    - button "Examiner" [ref=f5e1338] [cursor=pointer]
                - row [ref=f5e1345]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1346]
                  - cell "Système" [ref=f5e1347]
                  - cell "Automatique" [ref=f5e1349]
                  - cell "Autre action" [ref=f5e1350]
                  - cell "Paiement" [ref=f5e1351]
                  - cell "6f7ace22-abc2-4d69-b09d-04a7e40df8a8" [ref=f5e1352]
                  - cell [ref=f5e1353]:
                    - button "Examiner" [ref=f5e1354] [cursor=pointer]
                - row [ref=f5e1361]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1362]
                  - cell "Système" [ref=f5e1363]
                  - cell "Automatique" [ref=f5e1365]
                  - cell "Autre action" [ref=f5e1366]
                  - cell "Paiement" [ref=f5e1367]
                  - cell "90993197-b82d-44d2-b85b-568b174f283b" [ref=f5e1368]
                  - cell [ref=f5e1369]:
                    - button "Examiner" [ref=f5e1370] [cursor=pointer]
                - row [ref=f5e1377]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1378]
                  - cell "Système" [ref=f5e1379]
                  - cell "Automatique" [ref=f5e1381]
                  - cell "Autre action" [ref=f5e1382]
                  - cell "Paiement" [ref=f5e1383]
                  - cell "2f71a7c4-c832-433c-b6b7-42bb004bc239" [ref=f5e1384]
                  - cell [ref=f5e1385]:
                    - button "Examiner" [ref=f5e1386] [cursor=pointer]
                - row [ref=f5e1393]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1394]
                  - cell "Système" [ref=f5e1395]
                  - cell "Automatique" [ref=f5e1397]
                  - cell "Autre action" [ref=f5e1398]
                  - cell "Paiement" [ref=f5e1399]
                  - cell "a2ec829a-4abf-49cf-b46f-928ddccda7da" [ref=f5e1400]
                  - cell [ref=f5e1401]:
                    - button "Examiner" [ref=f5e1402] [cursor=pointer]
                - row [ref=f5e1409]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1410]
                  - cell "Système" [ref=f5e1411]
                  - cell "Automatique" [ref=f5e1413]
                  - cell "Autre action" [ref=f5e1414]
                  - cell "Paiement" [ref=f5e1415]
                  - cell "5525646c-3cb9-49ab-8882-48619f05c13a" [ref=f5e1416]
                  - cell [ref=f5e1417]:
                    - button "Examiner" [ref=f5e1418] [cursor=pointer]
                - row [ref=f5e1425]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1426]
                  - cell "Système" [ref=f5e1427]
                  - cell "Automatique" [ref=f5e1429]
                  - cell "Autre action" [ref=f5e1430]
                  - cell "Paiement" [ref=f5e1431]
                  - cell "5832938a-4ef8-497f-abba-9109af5574c5" [ref=f5e1432]
                  - cell [ref=f5e1433]:
                    - button "Examiner" [ref=f5e1434] [cursor=pointer]
                - row [ref=f5e1441]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1442]
                  - cell "Système" [ref=f5e1443]
                  - cell "Automatique" [ref=f5e1445]
                  - cell "Autre action" [ref=f5e1446]
                  - cell "Paiement" [ref=f5e1447]
                  - cell "0883244b-3971-4247-b1a4-0b8f37a4467d" [ref=f5e1448]
                  - cell [ref=f5e1449]:
                    - button "Examiner" [ref=f5e1450] [cursor=pointer]
                - row [ref=f5e1457]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1458]
                  - cell "Système" [ref=f5e1459]
                  - cell "Automatique" [ref=f5e1461]
                  - cell "Autre action" [ref=f5e1462]
                  - cell "Paiement" [ref=f5e1463]
                  - cell "3cc684f3-ffa7-4b01-bbc8-231ff8acf6ba" [ref=f5e1464]
                  - cell [ref=f5e1465]:
                    - button "Examiner" [ref=f5e1466] [cursor=pointer]
                - row [ref=f5e1473]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1474]
                  - cell "Système" [ref=f5e1475]
                  - cell "Automatique" [ref=f5e1477]
                  - cell "Autre action" [ref=f5e1478]
                  - cell "Paiement" [ref=f5e1479]
                  - cell "392e348e-d01c-431d-b992-4aa7710dfc9c" [ref=f5e1480]
                  - cell [ref=f5e1481]:
                    - button "Examiner" [ref=f5e1482] [cursor=pointer]
                - row [ref=f5e1489]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1490]
                  - cell "Système" [ref=f5e1491]
                  - cell "Automatique" [ref=f5e1493]
                  - cell "Autre action" [ref=f5e1494]
                  - cell "Paiement" [ref=f5e1495]
                  - cell "5b139137-aa0d-40f3-abb5-213e5e0f72cf" [ref=f5e1496]
                  - cell [ref=f5e1497]:
                    - button "Examiner" [ref=f5e1498] [cursor=pointer]
                - row [ref=f5e1505]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1506]
                  - cell "Système" [ref=f5e1507]
                  - cell "Automatique" [ref=f5e1509]
                  - cell "Autre action" [ref=f5e1510]
                  - cell "Paiement" [ref=f5e1511]
                  - cell "d292f27b-ea03-4f3b-9ad4-b544be4bdc38" [ref=f5e1512]
                  - cell [ref=f5e1513]:
                    - button "Examiner" [ref=f5e1514] [cursor=pointer]
                - row [ref=f5e1521]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1522]
                  - cell "Système" [ref=f5e1523]
                  - cell "Automatique" [ref=f5e1525]
                  - cell "Autre action" [ref=f5e1526]
                  - cell "Paiement" [ref=f5e1527]
                  - cell "d4e2d85d-8375-4838-877d-6703eb7ef75d" [ref=f5e1528]
                  - cell [ref=f5e1529]:
                    - button "Examiner" [ref=f5e1530] [cursor=pointer]
                - row [ref=f5e1537]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1538]
                  - cell "Système" [ref=f5e1539]
                  - cell "Automatique" [ref=f5e1541]
                  - cell "Autre action" [ref=f5e1542]
                  - cell "Paiement" [ref=f5e1543]
                  - cell "a44e58b4-b861-43fa-86fb-8e035126d778" [ref=f5e1544]
                  - cell [ref=f5e1545]:
                    - button "Examiner" [ref=f5e1546] [cursor=pointer]
                - row [ref=f5e1553]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1554]
                  - cell "Système" [ref=f5e1555]
                  - cell "Automatique" [ref=f5e1557]
                  - cell "Autre action" [ref=f5e1558]
                  - cell "Paiement" [ref=f5e1559]
                  - cell "6cf37090-9662-4a7f-8020-372961258c00" [ref=f5e1560]
                  - cell [ref=f5e1561]:
                    - button "Examiner" [ref=f5e1562] [cursor=pointer]
                - row [ref=f5e1569]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1570]
                  - cell "Système" [ref=f5e1571]
                  - cell "Automatique" [ref=f5e1573]
                  - cell "Autre action" [ref=f5e1574]
                  - cell "Paiement" [ref=f5e1575]
                  - cell "ff81fcdf-bfc7-4a75-9d53-baeed2033384" [ref=f5e1576]
                  - cell [ref=f5e1577]:
                    - button "Examiner" [ref=f5e1578] [cursor=pointer]
                - row [ref=f5e1585]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1586]
                  - cell "Système" [ref=f5e1587]
                  - cell "Automatique" [ref=f5e1589]
                  - cell "Autre action" [ref=f5e1590]
                  - cell "Paiement" [ref=f5e1591]
                  - cell "cdcacea3-da62-486c-8d58-22cd0ba680e5" [ref=f5e1592]
                  - cell [ref=f5e1593]:
                    - button "Examiner" [ref=f5e1594] [cursor=pointer]
                - row [ref=f5e1601]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1602]
                  - cell "Système" [ref=f5e1603]
                  - cell "Automatique" [ref=f5e1605]
                  - cell "Autre action" [ref=f5e1606]
                  - cell "Paiement" [ref=f5e1607]
                  - cell "83a04701-482c-47e3-80ad-3429c45d65c7" [ref=f5e1608]
                  - cell [ref=f5e1609]:
                    - button "Examiner" [ref=f5e1610] [cursor=pointer]
                - row [ref=f5e1617]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1618]
                  - cell "Système" [ref=f5e1619]
                  - cell "Automatique" [ref=f5e1621]
                  - cell "Autre action" [ref=f5e1622]
                  - cell "Paiement" [ref=f5e1623]
                  - cell "f0111e5e-db38-425f-8f22-2f7efb05b35c" [ref=f5e1624]
                  - cell [ref=f5e1625]:
                    - button "Examiner" [ref=f5e1626] [cursor=pointer]
                - row [ref=f5e1633]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1634]
                  - cell "Système" [ref=f5e1635]
                  - cell "Automatique" [ref=f5e1637]
                  - cell "Autre action" [ref=f5e1638]
                  - cell "Paiement" [ref=f5e1639]
                  - cell "e9a0e3fa-8096-4586-b838-6b245ac09196" [ref=f5e1640]
                  - cell [ref=f5e1641]:
                    - button "Examiner" [ref=f5e1642] [cursor=pointer]
                - row [ref=f5e1649]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1650]
                  - cell "Système" [ref=f5e1651]
                  - cell "Automatique" [ref=f5e1653]
                  - cell "Autre action" [ref=f5e1654]
                  - cell "Paiement" [ref=f5e1655]
                  - cell "22c03799-28f9-45fa-b612-bafad7504335" [ref=f5e1656]
                  - cell [ref=f5e1657]:
                    - button "Examiner" [ref=f5e1658] [cursor=pointer]
                - row [ref=f5e1665]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1666]
                  - cell "Système" [ref=f5e1667]
                  - cell "Automatique" [ref=f5e1669]
                  - cell "Autre action" [ref=f5e1670]
                  - cell "Paiement" [ref=f5e1671]
                  - cell "f24be767-f0bd-4627-aed8-b571cacd40f9" [ref=f5e1672]
                  - cell [ref=f5e1673]:
                    - button "Examiner" [ref=f5e1674] [cursor=pointer]
                - row [ref=f5e1681]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1682]
                  - cell "Système" [ref=f5e1683]
                  - cell "Automatique" [ref=f5e1685]
                  - cell "Autre action" [ref=f5e1686]
                  - cell "Paiement" [ref=f5e1687]
                  - cell "5b34a530-ffd3-461e-8261-297c7a8b2d1f" [ref=f5e1688]
                  - cell [ref=f5e1689]:
                    - button "Examiner" [ref=f5e1690] [cursor=pointer]
                - row [ref=f5e1697]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1698]
                  - cell "Système" [ref=f5e1699]
                  - cell "Automatique" [ref=f5e1701]
                  - cell "Autre action" [ref=f5e1702]
                  - cell "Paiement" [ref=f5e1703]
                  - cell "226f01ef-8249-45b5-88e9-eb9f55d902cc" [ref=f5e1704]
                  - cell [ref=f5e1705]:
                    - button "Examiner" [ref=f5e1706] [cursor=pointer]
                - row [ref=f5e1713]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1714]
                  - cell "Système" [ref=f5e1715]
                  - cell "Automatique" [ref=f5e1717]
                  - cell "Autre action" [ref=f5e1718]
                  - cell "Paiement" [ref=f5e1719]
                  - cell "8419743c-167e-4fab-a450-339412cfb085" [ref=f5e1720]
                  - cell [ref=f5e1721]:
                    - button "Examiner" [ref=f5e1722] [cursor=pointer]
                - row [ref=f5e1729]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1730]
                  - cell "Système" [ref=f5e1731]
                  - cell "Automatique" [ref=f5e1733]
                  - cell "Autre action" [ref=f5e1734]
                  - cell "Paiement" [ref=f5e1735]
                  - cell "e7a07230-3995-482f-a57b-af988fc305ff" [ref=f5e1736]
                  - cell [ref=f5e1737]:
                    - button "Examiner" [ref=f5e1738] [cursor=pointer]
                - row [ref=f5e1745]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1746]
                  - cell "Système" [ref=f5e1747]
                  - cell "Automatique" [ref=f5e1749]
                  - cell "Autre action" [ref=f5e1750]
                  - cell "Paiement" [ref=f5e1751]
                  - cell "3f695d36-c7f7-4d45-a737-5d11c9361f62" [ref=f5e1752]
                  - cell [ref=f5e1753]:
                    - button "Examiner" [ref=f5e1754] [cursor=pointer]
                - row [ref=f5e1761]:
                  - cell "19 nov. 2026, 10:34:36" [ref=f5e1762]
                  - cell "Système" [ref=f5e1763]
                  - cell "Automatique" [ref=f5e1765]
                  - cell "Autre action" [ref=f5e1766]
                  - cell "Paiement" [ref=f5e1767]
                  - cell "9776a762-f3bf-45bf-8d1d-63b067a7b221" [ref=f5e1768]
                  - cell [ref=f5e1769]:
                    - button "Examiner" [ref=f5e1770] [cursor=pointer]
  - alert [ref=f5e1777]
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
      |                                                                                        ^ Error: contrôles responsive de adm-journal (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```