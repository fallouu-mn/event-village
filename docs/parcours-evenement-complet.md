# Parcours complet d'un événement sur Event Village

Ce document raconte toute la vie d'un événement, de l'inscription du partenaire à la fin de l'événement, étape par étape et acteur par acteur. Il a été écrit pour quelqu'un qui n'est pas développeur et qui va tester l'application à la main. Le plan de test qui l'accompagne est dans `docs/plan-de-test-evenement.md`.

Il a été écrit sur la version `7cca60f` (branche `docs/parcours-evenement`), puis mis à jour en place au lot 9 bis (branche `lot9bis/cycle-evenement`) pour chaque comportement changé par ce lot, sans renuméroter les étapes. Une étape changée le dit par une phrase « Depuis le lot 9 bis » ; ses preuves ont été relues sur le code du lot. Les preuves des étapes que le lot ne touche pas datent de `7cca60f` : un numéro de ligne peut s'y être décalé de quelques lignes, le fichier cité reste le bon. La revue critique, en fin de document, garde son texte d'origine et reçoit une colonne « État au lot 9 bis ». Le code est la seule source : chaque affirmation porte sa preuve, un fichier et un numéro de ligne, ou le nom d'une fonction de la base. Rien n'a été exécuté contre un projet distant : ce qui dépend d'un réglage hébergé ou d'un service extérieur est signalé.

## Comment lire ce document

Chaque étape a le même titre, « Étape chapitre.numéro — titre », et les mêmes 7 points :

1. Qui agit, sur quel écran (adresse de la page) et avec quel bouton.
2. Ce qu'il saisit : champs obligatoires, contrôles, messages d'erreur cités.
3. Ce que fait le système : statuts avant et après, ce qui est enregistré, ce qui devient visible ou invisible pour le public.
4. Les messages reçus, toujours dans un tableau.
5. Ce que les autres acteurs voient changer.
6. Ce qu'il est impossible de faire à ce moment, avec le message de refus.
7. Le test automatique qui le prouve et l'essai manuel correspondant, ou « aucun ».

Les textes entre guillemets français sont exacts, copiés du code : ne vous étonnez pas d'y lire parfois une faute ou un mot technique, c'est le texte réel, et il est relevé dans la revue critique. Les variables s'écrivent entre accolades, par exemple {title}, et sont suivies d'un exemple rempli.

Les lignes « Preuve : » et la colonne « Où » de la revue contiennent les noms techniques : vous pouvez les ignorer pour tester. `M/` y désigne le dossier `supabase/migrations/`. Dans une preuve, un numéro seul comme `:42` renvoie au dernier fichier cité sur la même ligne.

## Le vocabulaire de ce document

Une même chose porte un seul nom, de la première à la dernière page. Quand l'application emploie deux noms, les deux sont signalés en revue critique.

| Mot employé ici | Ce que cela désigne |
|---|---|
| partenaire | La structure qui organise l'événement et son compte. Mariama est la partenaire. L'application écrit parfois « organisateur », seulement dans les textes cités |
| billet | Le droit d'entrée d'une personne. Le mot « ticket » n'est jamais employé ici |
| catégorie | Une sorte de billet d'un événement, avec son prix et sa quantité (Standard, VIP). La fiche publique écrit parfois « formule » |
| en ligne, guichet | Les deux canaux de vente : sur le site, ou en espèces à l'entrée |
| Mes billets | L'écran `/tickets` du client |
| caisse | La session d'espèces d'un contrôleur au guichet |
| contrôleur | La personne qui scanne les billets à l'entrée |
| le pilotage | L'écran `/partner/events/{id}` de la partenaire, avec ses onglets |
| la cloche | La notification lue dans l'application (l'icône en haut de l'écran et la page `/notifications`). C'est le canal que le code appelle « in-app » |
| indispensable | Message qui part toujours, même si le client coupe ses préférences |
| optionnel | Message que le client peut couper, et qui peut être perdu en heures calmes |
| immédiat | Pendant la requête : le SMS part avant que l'écran réponde |
| prochain passage de la file | L'envoi se fait à la prochaine minute : la file des messages tourne chaque minute (`supabase/ops/schedule-crons.sql:98`) |
| heures calmes | De 22 h à 8 h, heure de Dakar : un SMS optionnel qui tombe dans cette plage est perdu définitivement, sans report (`M/20261105000002_lot7_sms.sql:293`, `:302-303`) |

Statuts tels qu'ils s'affichent, à utiliser pendant vos tests :

| Objet | Libellés à l'écran | Preuve |
|---|---|---|
| Événement | « Brouillon », « En attente de validation », « Validé », « Publié », « Suspendu », « Terminé », « Annulé » | `lib/events/event-status.ts:75-111` |
| Billet | « Valable », « Utilisé », « Annulé », « Remboursé », « Remboursement en cours » ; depuis le lot 9 bis, la carte ajoute l'état de l'événement, par exemple « Événement suspendu : … » ou « Événement terminé. » | `lib/tickets/ticket-status.ts:23-49`, `app/api/tickets/route.ts` (`notice`) |
| Caisse | « Ouverte », « Clôturée », « En litige » (jamais posé) | `components/partner/pilotage/types.ts:195-199` |

## Ce qui vaut pour tous les messages

- Un message de la file part au prochain passage. Trois essais supplémentaires sont faits en cas de panne (après 1, 5, 15 min puis 1 h, 5 tentatives au plus), puis une alerte part vers les admins (`M/20261103000002_lot6_outbox.sql:1165`).
- Un SMS marqué « Envoyée » veut dire « accepté par MTarget ». Le dépôt ne contient aucun accusé de réception : la remise réelle sur le téléphone est NON VÉRIFIÉ, car seul le fournisseur peut le dire (`lib/notifications/dispatcher.ts:295-301`).
- La cloche demande un compte. Le push demande un compte, les clés du service push et un appareil abonné. L'email demande une clé Resend et, depuis le lot 9 bis, une adresse **vérifiée** par le lien reçu (étape 1.8) : une adresse non vérifiée, ou une adresse technique en `@eventvillage.sn`, ne reçoit rien d'autre que ce lien, et la ligne de la supervision dit « Non envoyée », motif « Adresse email non vérifiée ». Depuis le lot 9 bis aussi, tout message indispensable adressé à un compte part aussi par email quand l'adresse est vérifiée, et un email lent ou en échec ne retarde ni ne bloque jamais le SMS (`lib/notifications/dispatcher.ts`, envois séparés par canal). Le SMS demande un numéro (`lib/notifications/dispatcher.ts:328-330`, `:382-386`). La présence réelle des clés sur event-village-dev est NON VÉRIFIÉ, le fichier `.env.local` n'étant pas lu.
- Un SMS optionnel est soumis aux heures calmes et à un budget de 700 par jour (`M/20261105000001_lot7_reglages.sql:30`). Un SMS indispensable part aussi la nuit (`lib/sms/sms-guard.ts:105`). Depuis le lot 9 bis, les admins reçoivent une alerte « Volume de SMS indispensables élevé » quand les SMS indispensables du jour dépassent un seuil réglé par le SUPERADMIN (2 000 par défaut, réglage `notif.sms_essential_daily_alert`, étape 18.4). Les émojis et les lettres hors de l'alphabet SMS de base sont retirés ou translittérés dans le texte des SMS seulement : un titre « Gala Teranga 🎉 » s'écrit « Gala Teranga » dans le SMS, qui reste sur un segment.
- Depuis le lot 9 bis, en réel, aucun SMS, email ni push ne part vers un compte créé par `seed:dev` : la supervision marque la ligne « Non envoyée », motif « Non envoyé : compte de démonstration » (étape 0.1, `lib/notifications/outbox-labels.ts:69-70`).
- Les exemples utilisent l'adresse `https://eventvillage.sn`. L'adresse réelle du projet est NON VÉRIFIÉ, elle est dans `.env.local`, et elle change la longueur des SMS (`lib/notifications/catalog.ts:1248`).
- Compte suspendu : les messages liés à un acte d'achat ou à l'argent partent quand même, les autres sont bloqués (`M/20261103000002_lot6_outbox.sql:377-386`). Le détail est à l'étape 17.1.

## Le scénario suivi

Un événement fil rouge, **« Gala de la Teranga »**, samedi 14 novembre 2026 à 20:00, CICAD à Diamniadio, organisé par Mariama sous le nom « Sabar Events ». Pour la suspension et l'annulation (chapitres 13 et 14), un second événement, **« Nuit du Mbalax »**. Les exemples de messages utilisent le fil rouge.

# Chapitre 0. Les personnages, les comptes, la préparation

| Personnage | Rôle dans l'histoire | Compte de `seed:dev` à utiliser | Numéro | Arrive sur |
|---|---|---|---|---|
| Aïda | SUPERADMIN | `superadmin@essai.eventvillage.invalid` | +221700009001 | `/admin/dashboard` |
| Moussa | ADMIN, avec puis sans la permission utile | `admin@essai.eventvillage.invalid` | +221700009002 | `/admin/dashboard` |
| Mariama | Partenaire (Sabar Events dans l'histoire, « Essai Événements » dans le seed) | `partenaire@essai.eventvillage.invalid` | +221700009003 | `/partner/dashboard` |
| Ibrahima | Contrôleur. Sans compte au départ dans l'histoire | `controleur@essai.eventvillage.invalid`, ou un numéro neuf pour l'invitation (étape 6.1) | +221700009004 | `/controller/scanner` |
| Awa | Second contrôleur, déjà cliente | `client1@essai.eventvillage.invalid` utilisé comme client invité (étape 6.3), ou tout client | selon compte | `/` |
| Fatou | Cliente acheteuse | `client1@essai.eventvillage.invalid` | +221700009005 | `/` |
| Lamine | Client qui reçoit un transfert | `client2@essai.eventvillage.invalid` | +221700009006 | `/` |
| Modou | Invité sans compte | aucun : un numéro inventé commençant par 70 | à choisir | — |
| Le visiteur | Non connecté | aucun : fenêtre de navigation privée | — | `/` |

Preuve : `scripts/dev/seed-dev.core.ts:116-128`, `lib/auth/resolve-post-login-route.ts:10-13`.

### Étape 0.1 — Créer les comptes et les événements d'essai

1. **Qui, où, quel bouton.** Vous, dans un terminal. Commande `npm run seed:dev`, avec le mode simulé. Le guide complet est `docs/essai-local.md`, sections 3, 4, 6 et 7.
2. **Ce qu'il saisit.** La référence du projet, retapée à l'identique, et le mot de passe commun. Refus cités : « Terminal interactif requis : la confirmation se tape au clavier. » ; « EV_DEV_PROJECT_REF absente de .env.local : indiquez la référence du projet d'essai. » ; « EV_DEV_PROJECT_REF diffère de la référence du projet de NEXT_PUBLIC_SUPABASE_URL : refus. » ; « EV_INTEGRATIONS=fake requis : les avis du seed ne doivent partir vers aucun numéro. » ; « Confirmation fausse : la référence du projet n'a pas été retapée à l'identique. » ; « Schéma en retard ({table} : {erreur}) : appliquez les migrations {migrations} sur ce projet, voir docs/essai-local.md. », exemple « Schéma en retard (users : colonne manquante) : appliquez les migrations 20261109 sur ce projet, voir docs/essai-local.md. ». Depuis le lot 9 bis, le seed exige aussi la colonne de la marque des comptes de démonstration, posée par les migrations `20261109`. Preuve : `scripts/dev/seed-dev.core.ts:60-71`, `:109-120`, `scripts/dev/seed-dev.ts:16-23`.
3. **Ce que fait le système.** Six comptes actifs, un partenaire validé « Essai Événements SARL », quatre événements : « Concert d'essai à Dakar » (Publié, dans 21 jours, catégories Pass général 5 000 F en ligne et guichet, Tarif guichet 4 000 F au guichet, Carré invités 10 000 F sans canal), « Journée portes ouvertes d'essai » (Publié, gratuit), « Gala d'essai en attente » (En attente de validation), « Atelier d'essai en brouillon » (Brouillon). Ibrahima est déjà affecté aux deux événements publiés, avec le droit d'encaisser. Aucune vente n'est créée. Une ligne déjà présente n'est jamais réécrite, mot de passe compris. Depuis le lot 9 bis : chaque compte du seed porte la marque « compte de démonstration », posée aussi sur un compte semé avant le lot (seule écriture sur un compte gardé) ; Moussa reçoit les 8 permissions de la préparation de l'étape 0.2 (Consulter les événements, Gérer les événements, Consulter les envois de messages, Relancer les envois de messages, Consulter les partenaires et leurs contacts, Valider les partenaires, Consulter les paiements, Gérer les remboursements), ajoutées même à un compte déjà semé et jamais retirées ; la fiche de Mariama a une période d'essai de 60 jours, sans statut de fondateur. Preuve : `scripts/dev/seed-dev.core.ts:32-38`, `:211-241`, `:243-257`, `:271-275`, `docs/essai-local.md:341`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Les événements publiés apparaissent sur l'accueil. En réel, la supervision des notifications marque tout message adressé à un compte du seed « Non envoyé : compte de démonstration » (`lib/notifications/demo-guard.ts`, `docs/essai-local.md:337`).
6. **Ce qui est impossible.** Lancer le seed sur un autre projet que celui nommé, ou hors mode simulé. Au plus 25 comptes réels sur le projet. Envoyer un vrai SMS, un vrai email ou un vrai push à un compte du seed, même en réel. Preuve : `scripts/dev/seed-dev.core.ts:21`, `:60-71`.
7. **Test et essai.** Test : `tests/parcours/essai-seed-dev.test.ts:201` « six comptes de démonstration, un par rôle et deux clients, marqués et fictifs » ; `tests/parcours/essai-seed-dev.test.ts:221` « partenaire VALIDE et vérifié, activité ORGANISATEUR, contrôleur affecté » ; `tests/parcours/essai-seed-dev.test.ts:232` « quatre événements : deux publiés (payant, gratuit), un en attente, un brouillon, avec affiche » ; `tests/parcours/essai-seed-dev.test.ts:274` « aucune vente : ni billet, ni paiement, stock intact » ; `tests/parcours/essai-seed-dev.test.ts:318` « mot de passe existant conservé : le rejeu ne le réécrit pas » ; `tests/parcours/essai-seed-dev-9bis.test.ts:138` « admin du seed : les 8 permissions de la préparation P0.2 » ; `tests/parcours/essai-seed-dev-9bis.test.ts:158` « essai de 60 jours, is_founder faux ». Essai : Essais 1 et 2 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 7.

### Étape 0.2 — Donner à Moussa la permission utile, puis la lui retirer

1. **Qui, où, quel bouton.** Aïda, `/admin/users`, bouton « Permissions » sur la ligne de Moussa, fenêtre « Permissions Granulaires », bouton « Enregistrer les permissions ». Preuve : `app/admin/users/page.tsx:486-495`, `:841`.
2. **Ce qu'il saisit.** Des cases. Depuis le lot 9 bis, chaque case porte un libellé français, par exemple « Gérer les événements » pour `events.write`, jamais le code. Pour tester « avec puis sans » : décocher, tester, recocher. Le tableau complet est à l'étape 18.9. Preuve : `app/admin/users/page.tsx:865`, `lib/admin/permission-labels.ts:8-25`.
3. **Ce que fait le système.** Depuis le lot 9 bis, le seed donne à Moussa les 8 permissions utiles aux essais (étape 0.1) : la préparation consiste à lui en **retirer** une pour tester le refus, puis à la lui rendre. Un ADMIN sans ligne de permission n'en a aucune : il lit par exemple « Votre compte n’a pas l’autorisation de consulter les partenaires. » sur le tableau de bord, et toute adresse d'administration refuse avec « Action non autorisée : votre compte n’a pas la permission « {libellé} ». », exemple « Action non autorisée : votre compte n’a pas la permission « Consulter les envois de messages ». ». Les boutons dont il n'a pas la permission sont masqués. Preuve : `scripts/dev/seed-dev.core.ts:32-35`, `lib/admin/admin-auth.ts:70-74`, `lib/admin/permission-labels.ts:33-35`, `app/admin/dashboard/page.tsx:257`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Moussa : effet à sa prochaine lecture, sans se reconnecter. Il reçoit aussi les alertes liées à ces permissions.
6. **Ce qui est impossible.** Moussa ne peut pas se donner une permission : « Opération réservée exclusivement au SUPERADMIN. ». Preuve : `lib/admin/admin-auth.ts:214`.
7. **Test et essai.** Test : `tests/parcours/securite-admin-lot7.test.ts:177` « témoin : admin ACTIF (users.read, notifications.read) → 200 sur /api/admin/users et /api/admin/notifications » ; `tests/parcours/securite-admin-lot7.test.ts:188` « admin ${status} (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth » ; `tests/parcours/essai-seed-dev-9bis.test.ts:138` « admin du seed : les 8 permissions de la préparation P0.2 ». Essai : Essai 53 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 7.

### Étape 0.3 — Vérifier les numéros de téléphone des comptes d'essai

1. **Qui, où, quel bouton.** Lamine (et tout compte qui doit recevoir un transfert). Soit `/tickets?tab=recus`, bouton « Confirmer mon numéro », soit une connexion par « Code SMS » sur `/login`.
2. **Ce qu'il saisit.** Le code à 6 chiffres lu dans la fenêtre 2 du mode simulé.
3. **Ce que fait le système.** Les six comptes du seed sortent avec une date de vérification du numéro vide. Or elle est exigée pour reconnaître le destinataire d'un transfert. Une connexion par code, ou le code du dialogue, la remplit une fois pour toutes. Preuve : `scripts/dev/seed-dev.core.ts:202-205`, `M/20261103000002_lot6_outbox.sql:458`, `app/api/auth/verify-otp/route.ts:68-72`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le numéro du compte | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

Preuve : `OTP_LOGIN`, `app/api/auth/send-otp/route.ts:99`.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Sans cette étape, Lamine ne voit pas le détail d'un billet transféré : il lit « Un billet vous attend peut-être. Confirmez votre numéro pour le voir. ». Preuve : `components/tickets/IncomingTransfers.tsx:166-173`.
7. **Test et essai.** Test : `tests/parcours/notif-transferts.test.ts:421` « code de connexion vérifié : phone_verified_at posé une fois (conservé ensuite) ; le transfert qui attendait devient visible ». Essai : aucun dédié, préparation de l'Essai 27 ; `docs/essai-local.md` section 8.6.

### Étape 0.4 — Lancer une séance d'essai

1. **Qui, où, quel bouton.** Vous, trois fenêtres : le faux SamirPay (`fake:samirpay`), l'application (`dev`), les tâches planifiées (`cron:local`). Guide : `docs/essai-local.md` section 6.
2. **Ce qu'il saisit.** Ajouter à `.env.local` les lignes de quotas de la section 4 du guide, sinon trois codes SMS en 15 minutes bloquent l'essai (compté aussi en simulé). Preuve : `docs/essai-local.md:220-228`.
3. **Ce que fait le système.** La bannière « [essai] Intégrations simulées : aucun SMS ni paiement réel. » s'affiche dans la fenêtre 2, pas à l'écran de l'application. Les SMS et les codes se lisent dans cette fenêtre. Sans clé Resend, l'email s'écrit dans la fenêtre sans partir. Depuis le lot 9 bis, en réel (sans `EV_INTEGRATIONS=fake` et avec une adresse SamirPay qui n'est pas celle du poste), la fenêtre 2 affiche à la place « [réel] SMS, paiements et emails RÉELS : de l’argent réel sera débité. », et l'application refuse de démarrer si `NEXT_PUBLIC_APP_URL` ne commence pas par `https://`, avec un message qui renvoie au tunnel. Avant tout passage en réel, `npm run essai:check-reel` liste, en lecture seule, ce qui partirait vers des comptes de démonstration (notifications en file, paiements et versements simulés en cours, billets de ces comptes sur des événements à venir) ; il répond « Rien ne partirait en réel » s'il n'y a rien, avec un code de sortie non nul sinon. Preuve : `instrumentation.ts:15-19`, `lib/integrations/real-mode.ts:15-17`, `scripts/dev/essai-check-reel.core.mjs:18`, `docs/essai-local.md:202`, `:279`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Recevoir un vrai SMS, ou payer pour de vrai, en mode simulé (mode A). Les essais sur téléphone et hors ligne demandent le mode B, `docs/essai-local.md` section 11. Démarrer en réel sans adresse en https : « [réel] Refus de démarrer : en réel, NEXT_PUBLIC_APP_URL doit commencer par https://, sinon l’avis de paiement de SamirPay ne peut pas arriver. Ouvrez le tunnel (docs/essai-local.md, section 9), mettez son adresse dans NEXT_PUBLIC_APP_URL et EV_DEV_TUNNEL_URL, puis relancez. ». Une séance tout en réel suit la section 13 du guide, « Tout en réel depuis votre PC ». Les valeurs réelles des quotas et réglages sur event-village-dev sont NON VÉRIFIÉ : seuls les défauts du code sont établis, `.env.local` n'est pas lu. Preuve : `lib/env.ts:55-64`.
7. **Test et essai.** Test : `tests/schema/essai-integrations.test.ts` pour la ligne « [réel] » et le refus sans https (tâche I3). Essai : Essai 1 de `docs/recette-billetterie.md`, `docs/essai-local.md` sections 6, 11 et 13.

### Étape 0.5 — Ce qu'il faut préparer à la main

1. **Qui, où, quel bouton.** Vous, avant de commencer les chapitres concernés.
2. **Ce qu'il saisit.** Les données ci-dessous.

| Besoin | Fait établi | À faire |
|---|---|---|
| Ibrahima « sans compte » (étape 6.1) | Le seed lui crée déjà un compte affecté | Inviter un numéro neuf, 70 suivi de 7 chiffres |
| Période d'essai (étape 2.11) | Le seed la pose lui-même, depuis le lot 9 bis à 60 jours sans offre fondateur : le message de démarrage ne part jamais pour Mariama | Tester avec un partenaire inscrit à l'écran |
| Modou, invité sans compte | Aucun compte | Numéro inventé commençant par 70 |
| Visiteur | Aucun compte | Fenêtre de navigation privée |

Preuve : `scripts/dev/seed-dev.core.ts:38`, `:271-275`, `M/20261103000006_lot6_pros_admin.sql:846`.

3. **Ce que fait le système.** Aucun.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Aucun. Les comptes du seed ont une adresse `@essai.eventvillage.invalid` qui ne reçoit jamais d'email, et, depuis le lot 9 bis, rien ne leur est envoyé en réel. Le contenu de la table des offres d'abonnement sur event-village-dev est NON VÉRIFIÉ : le seed y dépend d'une ligne qui peut être absente. Preuve : `docs/essai-local.md:337`, `scripts/dev/seed-dev.core.ts:259-283`.
7. **Test et essai.** Test : aucun. Essai : aucun.

# Chapitre 1. Le client

### Étape 1.1 — Inscription : le numéro

1. **Qui, où, quel bouton.** Fatou, encore visiteuse. Page `/register`, depuis le lien « Créer un compte client » de `/login`. En-tête « Étape 1 sur 2 : votre numéro », titre « Créer un compte », bouton « Recevoir le code par SMS ». Preuve : `app/register/page.tsx:331`, `components/auth/LoginForm.tsx:717`.
2. **Ce qu'il saisit.** Un seul champ obligatoire, « Numéro de téléphone (Sénégal) », aide « Mobile sénégalais : 70, 75, 76, 77 ou 78. Le code arrive par SMS sur ce numéro. ». Erreurs : depuis le lot 9 bis, un seul texte pour un numéro invalide, à l'écran comme dans la réponse du serveur, « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » ; « Ce numéro de téléphone est déjà associé à un compte. Veuillez vous connecter. », avec un bouton « Recevoir un code de connexion » ; « Trop de demandes de SMS. Réessayez dans {minutes} minute{s}. », exemple « Trop de demandes de SMS. Réessayez dans 12 minutes. » ; « Impossible d'envoyer le code de vérification par SMS. Vérifiez votre numéro et réessayez. » ; « Inscription momentanément impossible. Réessayez dans un instant. » ; « Connexion impossible : le code n’a pas pu être envoyé. Vérifiez votre réseau puis réessayez. ». Preuve : `lib/validations/auth.ts:8`, `:56`, `app/api/auth/register/start/route.ts:39`, `:49`, `:72`, `:86`, `lib/sms/sms-guard.ts:170-190`, `app/register/page.tsx:232`.
3. **Ce que fait le système.** Aucun compte n'est créé à ce stade. Un code à 6 chiffres est enregistré, chiffré, valable 10 minutes. Si le numéro est déjà inscrit, aucun SMS ne part. L'écran passe à l'étape 2 avec le bandeau « Code envoyé par SMS au {numéro}. », exemple « Code envoyé par SMS au +221701234567. ». Preuve : `app/api/auth/register/start/route.ts:14`, `:45-52`, `:59-60`, `app/register/page.tsx:159`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le numéro saisi par Fatou | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

Preuve : `OTP_REGISTER`, `app/api/auth/register/start/route.ts:64`, `lib/notifications/catalog.ts:1737`.

5. **Ce que les autres voient.** Personne. Une ligne sans le code apparaît dans la supervision des SMS (étape 18.2).
6. **Ce qui est impossible.** S'inscrire avec un numéro déjà pris ; dépasser les quotas de code. Un tiers qui lance l'inscription ne bloque pas le numéro, puisqu'aucun compte n'existe encore.
7. **Test et essai.** Test : `tests/parcours/inscription-numero-dabord.test.ts:106` « start : réponse du contrat, aucun compte, une ligne otp_codes REGISTER hachée, un seul SMS » ; `tests/parcours/inscription-numero-dabord.test.ts:126` « numéro déjà inscrit → 409 PHONE_ALREADY_REGISTERED, aucun SMS, aucun code » ; `tests/parcours/inscription-numero-dabord.test.ts:137` « numéro invalide → 400 INVALID_PHONE » ; `tests/parcours/inscription-numero-dabord.test.ts:241` « start par un tiers, code deviné refusé sans compte ; le titulaire s'inscrit avec son propre code → 200 ». Essai : Essai 7 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.6.

### Étape 1.2 — Inscription : le code et le profil

1. **Qui, où, quel bouton.** Fatou, même page, « Étape 2 sur 2 : code et profil ». Boutons « Créer mon compte » (désactivé tant que le code n'a pas 6 chiffres), « Modifier le numéro », « Recevoir un nouveau code » ou « Nouveau code dans {n} s », exemple « Nouveau code dans 42 s ». Preuve : `app/register/page.tsx:344`, `:376`, `:474`.
2. **Ce qu'il saisit.** Obligatoires : le code (6 cases), « Prénom », « Nom » (2 à 80 caractères), « Mot de passe ». Depuis le lot 9 bis, « Adresse email (facultative) » est visible directement, après le mot de passe, avec l'aide « Recommandé : recevez vos billets et confirmations par email » ; seul « Code de parrainage (facultatif) », prérempli par le lien reçu, reste sous « Plus d’options : code de parrainage ». Preuve : `app/register/page.tsx:547-562`, `:574-582`. Aucune confirmation du mot de passe, aucune case de conditions générales. Liste de robustesse : « Au moins 8 caractères », « Au moins une majuscule (A-Z) », « Au moins un chiffre (0-9) », « Au moins un caractère spécial (!@#$...) ». Erreurs : « Saisissez le code à 6 chiffres reçu par SMS. » ; « Le prénom doit contenir au moins 2 caractères » ; « Le nom doit contenir au moins 2 caractères » ; « Adresse email invalide » ; « Le mot de passe doit contenir au moins 8 caractères » ; « Code de vérification incorrect ou expiré. » ; « Le code a expiré. Demandez-en un nouveau. » ; « Trop de tentatives infructueuses. Veuillez demander un nouveau code. » ; « Trop de tentatives de vérification pour ce numéro. Réessayez plus tard. » ; « Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter. » ; depuis le lot 9 bis, sous le champ du parrainage, « Code de parrainage inconnu. Vérifiez-le ou laissez le champ vide. », sans consommer le code SMS ; « Création du compte impossible pour le moment. Demandez un nouveau code et réessayez. ». Preuve : `components/auth/PasswordStrengthChecklist.tsx:8-11`, `lib/auth/otp-store.ts:105-113`, `app/api/auth/register/route.ts:14`, `:143`, `:187`.
3. **Ce que fait le système.** Dans l'ordre : le profil est contrôlé, un code de parrainage inconnu est refusé, le code SMS vérifié et consommé (5 essais au plus), puis le compte est créé, actif, rôle client, numéro marqué comme vérifié. Le compte porte d'abord une adresse technique, exemple `221701234567@eventvillage.sn`. Depuis le lot 9 bis, une adresse saisie reste « en attente » : elle ne reçoit qu'un lien de vérification valable 24 heures, et ne devient l'adresse du compte qu'une fois le lien ouvert (étape 1.8). L'écran le dit avant de continuer : « Vérifiez votre adresse email », « Un lien de vérification a été envoyé à {adresse}. Il est valable 24 heures. », ou « Adresse enregistrée, non vérifiée » avec « Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre profil. ». Un code de parrainage connu crée le lien. Connexion automatique et retour à la page d'origine ou à l'accueil. Preuve : `app/api/auth/register/route.ts:66-82`, `:193-245`, `app/register/page.tsx:97-108`. Si la connexion échoue : « Compte créé : connectez-vous pour continuer », « Votre numéro est vérifié, mais la session n’a pas pu s’ouvrir automatiquement. ». Preuve : `app/api/auth/register/route.ts:32-35`, `:88-178`, `:114`, `app/register/page.tsx:214-221`, `:283`, `:290`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, si elle demande un nouveau code | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

| L'adresse saisie, si Fatou en a donné une | email | indispensable | immédiat | objet « Vérifiez votre adresse email — Event Village » ; titre « Vérifiez votre adresse email » ; texte « Vous avez indiqué cette adresse pour votre compte Event Village. Confirmez-la pour recevoir vos billets et vos confirmations par email. » ; bouton « Vérifier mon adresse » vers `/verify-email` ; note « Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : l’adresse ne sera pas ajoutée. » |

Aucun autre message après la création : le catalogue n'a pas de message d'accueil. Sans clé Resend, aucun email n'est tenté. Preuve : `EMAIL_VERIFICATION`, `lib/notifications/catalog.ts:1737`, `:1752-1758`.

5. **Ce que les autres voient.** Le parrain n'est pas prévenu. Aïda voit le compteur « Utilisateurs inscrits » augmenter et le compte sur `/admin/users`. Preuve : `app/admin/dashboard/page.tsx:528`.
6. **Ce qui est impossible.** Réutiliser un code, dépasser 5 essais, créer un compte sur un numéro ou un email déjà pris, donner un code de parrainage inconnu, donner une adresse en `@eventvillage.sn`.
7. **Test et essai.** Test : `tests/parcours/email-verification.test.ts` (lien valable, expiré, réutilisé, adresse prise, champ visible) ; `tests/parcours/textes-base-9bis.test.ts` (code de parrainage inconnu refusé, aucun compte) ; `tests/parcours/inscription-numero-dabord.test.ts:147` « sans code → 400 REGISTRATION_CODE_REQUIRED, aucun compte » ; `tests/parcours/inscription-numero-dabord.test.ts:194` « bon code → compte ACTIF, phone_verified_at, code consommé, aucun SMS de plus, connexion par mot de passe ; rejeu → 409 » ; `tests/parcours/inscription-numero-dabord.test.ts:254` « code de parrainage : relation CLIENT_TO_CLIENT aux taux de referral_config ; email fourni enregistré » ; `tests/parcours/otp-serveur.test.ts:87` « inscription client (numéro d’abord) → otp_codes → /api/auth/register depuis une autre instance » ; `tests/parcours/email-optionnel.test.ts:66` « inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement » ; `e2e/recette.spec.ts:487` « acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert ». Essai : Essais 7 et 49 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.6.

### Étape 1.3 — Connexion par mot de passe

1. **Qui, où, quel bouton.** Fatou, `/login`, onglet « Mot de passe », bouton « Se connecter ». Titre « Connexion », texte « Accédez à vos billets, commandes, réservations et portefeuille. ». Preuve : `components/auth/LoginForm.tsx:620`, `app/login/page.tsx:34-35`.
2. **Ce qu'il saisit.** « Email ou téléphone », « Mot de passe ». Erreurs : « Veuillez renseigner votre identifiant et votre mot de passe. » ; « Identifiant ou mot de passe incorrect. ({n} tentative{s} restante{s} avant verrouillage temporaire) », exemple « Identifiant ou mot de passe incorrect. (4 tentatives restantes avant verrouillage temporaire) », depuis le lot 9 bis aussi pour un numéro sans compte ; « Ce compte n’est plus actif. Veuillez contacter le support. » ; « Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard. » ; « Trop de tentatives. Patientez quelques instants avant de réessayer. » ; « Connexion impossible pour le moment. Réessayez dans un instant. » ; « Échec de la connexion. Vérifiez votre réseau, puis réessayez. ». Après 5 échecs dans ce navigateur : « Saisie temporairement bloquée », « Nouvel essai possible dans {n} s », pendant 60 s, exemple « Nouvel essai possible dans 47 s ». Preuve : `components/auth/LoginForm.tsx:226-236`, `:316-350`, `:516-522`, `app/api/auth/login/route.ts:23-41`, `:66-75`.
3. **Ce que fait le système.** Depuis le lot 9 bis, l'identifiant et le mot de passe partent au serveur (`/api/auth/login`) : c'est lui qui retrouve le compte d'un numéro, sans jamais le montrer, vérifie le mot de passe et ouvre la session. Un numéro sans compte et un mauvais mot de passe reçoivent la même réponse. Chaque essai compte dans un quota par connexion. La session ouverte vaut saisie récente du mot de passe pendant 10 minutes (étape 1.11). Si le navigateur ne lit pas la session : « Connexion acceptée, mais la session n’a pas pu s’ouvrir sur cet appareil. Rechargez la page, puis réessayez. ». Redirection selon le rôle, ou vers la page demandée. Preuve : `app/api/auth/login/route.ts:23-26`, `:47-62`, `:85-95`, `components/auth/LoginForm.tsx:326-364`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Compte suspendu : « Votre compte est suspendu. Veuillez contacter le support. ». Ouvrir `/login`, `/register` ou `/forgot-password` déjà connecté : renvoi vers son espace. Savoir, depuis cet écran, si un numéro a un compte. Un partenaire en attente peut se connecter. Preuve : `components/auth/LoginForm.tsx:280-284`, `middleware.ts:107-110`, `:203-214`.
7. **Test et essai.** Test : `tests/parcours/connexion-serveur.test.ts` (connexion par numéro et par email côté serveur, même refus pour un numéro inconnu, quota) ; `tests/parcours/compte-numero.test.ts:540` « connexion : le nouveau numéro et le mot de passe ouvrent une session, l’ancien numéro répond 404 » ; `tests/parcours/revocation-sessions.test.ts:81` « suspension par un admin → sessions révoquées » ; `tests/security/r28-middleware-matrice.test.ts:139` « ${role} : les pages d’authentification renvoient vers ${POST_LOGIN[role]} ». Le verrou de 5 échecs n'a aucun test. Essai : Essai 2 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 7.

### Étape 1.4 — Connexion par code SMS

1. **Qui, où, quel bouton.** Fatou, `/login`, onglet « Code SMS », bouton « Recevoir le code SMS », puis « Valider et se connecter ». Boutons « Modifier le numéro », « Renvoyer le code » ou « Renvoyer ({n} s) », exemple « Renvoyer (42 s) ». Preuve : `components/auth/LoginForm.tsx:652`, `:678`.
2. **Ce qu'il saisit.** « Numéro de téléphone (Sénégal) », puis 6 cases. Erreurs : « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » ; « Aucun compte n'est associé à ce numéro de téléphone. Veuillez vous inscrire. » ; « Impossible d'envoyer le code SMS. Réessayez dans un instant. » ; « Veuillez saisir le code complet à 6 chiffres. » ; depuis le lot 9 bis « Code incorrect ou expiré. », sans mot technique ; si le code est accepté mais que la session ne s'ouvre pas, « Code accepté, mais la connexion n’a pas pu s’ouvrir. Demandez un nouveau code et réessayez. », au lieu d'un retour silencieux. Depuis le lot 9 bis, la vérification du numéro ne rend plus ni identifiant, ni statut, ni rôle : seulement « ce numéro a un compte » ou non. Preuve : `app/api/auth/resolve-phone/route.ts:63-69`, `components/auth/LoginForm.tsx:106`, `:383`, `:402`, `:462-482`.
3. **Ce que fait le système.** Code valable 10 minutes, consommé à la vérification. Le numéro est marqué vérifié s'il ne l'était pas : c'est utile pour les transferts. Bandeau « Code de confirmation envoyé par SMS au {numéro}. », exemple « Code de confirmation envoyé par SMS au +221700009005. ». Preuve : `app/api/auth/send-otp/route.ts:86`, `app/api/auth/verify-otp/route.ts:68-129`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

Preuve : `OTP_LOGIN`, `app/api/auth/send-otp/route.ts:99`.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Se connecter avec un numéro inconnu. Un code de retrait ou de contrôleur n'ouvre pas de session. Preuve : `lib/auth/otp-store.ts:31`, `app/api/auth/verify-otp/route.ts:56-58`.
7. **Test et essai.** Test : `tests/parcours/otp-serveur.test.ts:68` « send-otp → otp_codes → verify-otp depuis une autre instance » ; `tests/parcours/otp-objet.test.ts:130` « verify-otp : un code WITHDRAWAL n’ouvre pas de session » ; `tests/parcours/sms-anti-abus.test.ts:89` « rafale parallèle sur un même numéro : seuls les envois sous la limite partent » ; `tests/parcours/sms-anti-abus.test.ts:101` « même IP, numéros différents : bloquée après la limite par IP ». Essai : aucun dédié.

### Étape 1.5 — Mot de passe oublié, par téléphone

1. **Qui, où, quel bouton.** Fatou, `/forgot-password` depuis « Mot de passe oublié ? ». Titre « Mot de passe oublié ». Bouton « Envoyer le code SMS », puis « Valider le code », « Modifier le numéro », « Renvoyer le code ». Preuve : `components/auth/LoginForm.tsx:596`, `app/forgot-password/page.tsx:494`.
2. **Ce qu'il saisit.** « Email ou numéro de téléphone », exemple « ex : email@domaine.com ou 77 123 45 67 ». Erreurs : « Saisissez une adresse email ou un numéro de téléphone sénégalais valide. » ; « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » ; « Impossible d'envoyer le SMS de réinitialisation. » ; « Veuillez saisir le code complet à 6 chiffres. » ; « Code accepté, mais la connexion n’a pas pu s’ouvrir. Demandez un nouveau code et réessayez. ». Preuve : `app/forgot-password/page.tsx:44-45`, `:249`, `:293`, `:304`, `app/api/auth/send-otp/route.ts:113`.
3. **Ce que fait le système.** Depuis le lot 9 bis, la réponse est la même qu'un compte existe ou non, comme par email : bandeau « Si un compte est associé à ce numéro, un code de récupération vient de lui être envoyé par SMS. ». Un numéro sans compte ne reçoit ni code ni SMS. Code valable 10 minutes, puis ouverture de `/reset-password` une fois la session de récupération ouverte ; si elle ne s'ouvre pas, l'écran reste sur place avec le message ci-dessus. Preuve : `app/api/auth/send-otp/route.ts:22`, `:75-80`, `:120`, `app/forgot-password/page.tsx:279`, `:334-362`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le numéro du compte | SMS | indispensable | immédiat | modèle « Event Village : votre code de réinitialisation du mot de passe est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de réinitialisation du mot de passe est 483920. Valable 10 minutes. » (94 caractères, 1 segment) |

Preuve : `OTP_PASSWORD_RESET`, `app/forgot-password/page.tsx:246`, `app/api/auth/send-otp/route.ts:99`.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Savoir si un numéro a un compte. Le code est envoyé même à un compte suspendu : aucun contrôle du statut. Preuve : `app/api/auth/send-otp/route.ts:61-80`.
7. **Test et essai.** Test : `tests/parcours/textes-base-9bis.test.ts` (numéro inconnu : 200 `{ success: true }`, aucun SMS, aucun code) ; `tests/parcours/lectures-ignorees.test.ts:157` « témoin : sans panne, réglage écrit et audit avec l’ancienne valeur (vert dès l’écriture) » ; `tests/parcours/invitation-identite.test.ts:105` « après une invitation, la réinitialisation par téléphone reste liée à l’email du client » ; `tests/parcours/notif-modeles.test.ts:822` « OTP et invitation (renderSyncSms) : textes actuels inchangés, le code n'est jamais stocké ; l'invitation seule sur 2 segments », dont les textes ont changé au lot 9 bis (`tests/parcours/textes-sms-9bis.test.ts`). Essai : Essai 8 de `docs/recette-billetterie.md`, sans section dans `docs/essai-local.md`.

### Étape 1.6 — Mot de passe oublié, par email

1. **Qui, où, quel bouton.** Fatou, même page, avec une adresse. Bouton « Envoyer le lien de récupération ». Preuve : `app/forgot-password/page.tsx:492`.
2. **Ce qu'il saisit.** L'adresse. Erreur : « Adresse email invalide. Vérifiez votre saisie. ». Preuve : `app/forgot-password/page.tsx:189`.
3. **Ce que fait le système.** La demande part vers le service d'authentification. L'écran « Lien envoyé » s'affiche toujours : « Si un compte correspond à cette adresse, un lien de récupération vient de lui être envoyé. Ouvrez-le pour choisir un nouveau mot de passe. », avec « Ouvrez l'email reçu de no-reply@eventvillage.sn. », « Choisissez « Réinitialiser mon mot de passe ». », « Le lien expire dans 60 minutes. ». Preuve : `app/forgot-password/page.tsx:198-202`, `:561-570`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, si son adresse est réelle | email | indispensable | immédiat, par le service d'authentification | NON VÉRIFIÉ : l'expéditeur, l'objet et la durée réels sont réglés sur le projet hébergé, hors du dépôt. Modèles commentés dans `supabase/config.toml:224-233` |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Savoir si le compte existe : depuis le lot 9 bis, la récupération par téléphone répond de la même façon (étape 1.5). Recevoir ce lien avec une adresse technique.
7. **Test et essai.** Test : aucun sur ce flux. Essai : aucun.

### Étape 1.7 — Choisir le nouveau mot de passe

1. **Qui, où, quel bouton.** Fatou, `/reset-password`, titre « Nouveau mot de passe », bouton « Définir le nouveau mot de passe ». Preuve : `app/reset-password/page.tsx:448`.
2. **Ce qu'il saisit.** « Nouveau mot de passe », « Confirmer le mot de passe ». Erreurs : « Votre mot de passe ne respecte pas tous les critères de sécurité. » ; « Les mots de passe ne correspondent pas. » ; « Choisissez un mot de passe différent de l'ancien. » ; « Ce mot de passe est trop faible. Choisissez-en un plus long ou moins courant. » ; « Votre demande de récupération a expiré. Recommencez depuis « Mot de passe oublié ». » ; « Impossible de mettre à jour le mot de passe. Réessayez dans un instant. ». Preuve : `app/reset-password/page.tsx:48-61`.
3. **Ce que fait le système.** Mot de passe changé, toutes les sessions fermées, retour à la connexion avec « Mot de passe modifié : connectez-vous avec le nouveau. » et le message « Mot de passe mis à jour avec succès. Veuillez vous connecter. ». Note à l'écran : « Après confirmation, toutes vos sessions sont fermées, sur tous vos appareils, pour garantir la sécurité de votre compte. ». Preuve : `components/auth/LoginForm.tsx:85`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le compte de Fatou | SMS | indispensable | prochain passage de la file | modèle « Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » ; exemple « Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » (116 caractères, 1 segment) |
| Le compte de Fatou | cloche | indispensable | prochain passage de la file | titre « Mot de passe modifié » ; modèle « Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » ; exemple « Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » |
| Le compte de Fatou | email | indispensable | prochain passage de la file | objet « Mot de passe modifié — Event Village » ; modèle : Mot de passe modifié<br>Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.<br>Ouvrir Event Village : {APP_URL}/profile<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Mot de passe modifié<br>Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.<br>Ouvrir Event Village : https://eventvillage.sn/profile<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Preuve : `PASSWORD_CHANGED` (`M/20261103000006_lot6_pros_admin.sql:946-950`).

Depuis le lot 9 bis, Fatou peut aussi changer son mot de passe en restant connectée : `/profile`, bouton « Changer mon mot de passe », fenêtre du même nom, « Les autres appareils seront déconnectés ; celui-ci reste connecté. », champs « Mot de passe actuel », « Nouveau mot de passe », « Confirmer le nouveau mot de passe ». Erreurs : « Mot de passe actuel incorrect. » ; « Le nouveau mot de passe doit être différent de l’actuel. » ; « Ce mot de passe est trop faible. Choisissez-en un autre. » ; « Trop de tentatives. Réessayez dans quelques minutes. ». Succès : « Mot de passe changé », « Mot de passe modifié. Vos autres appareils sont déconnectés. ». Les messages reçus sont ceux du tableau ci-dessus. Preuve : `components/profile/PasswordChangeDialog.tsx:44`, `:180-181`, `:207-248`, `app/api/account/password/route.ts:98`, `:111`, `:118`, `:126`.

5. **Ce que les autres voient.** Les autres appareils de Fatou sont déconnectés. Le jeton reste valable jusqu'à son expiration : 1 heure en local, durée sur le projet hébergé NON VÉRIFIÉ, le réglage n'étant pas dans le dépôt. Preuve : `supabase/config.toml:152`.
6. **Ce qui est impossible.** Ouvrir la page sans session de récupération : renvoi à la connexion, « Le lien a expiré : demandez un nouveau code. ». Preuve : `app/reset-password/page.tsx:115-118`, `:135`.
7. **Test et essai.** Test : `tests/parcours/compte-mot-de-passe.test.ts` (changement connecté : mot de passe actuel exigé, autres sessions fermées, celle-ci gardée) ; `tests/parcours/notif-canaux.test.ts:213` « PASSWORD_CHANGED : une notification IN_APP (type, titre, contenu du catalogue, metadata), notification_id posé, une seule fois » ; `tests/parcours/revocation-sessions.test.ts:97` « déconnexion globale demandée par l’utilisateur → toutes ses sessions révoquées » ; `tests/parcours/notif-interface.test.ts:529` « connexion sur le système de design : PageHeader « Connexion », StatusBanner, œil en IconButton focalisable, bascule aria-pressed, aucun « F5 », animations en motion-safe: ». Essai : Essais 8 et 76 de `docs/recette-billetterie.md`.

### Étape 1.8 — Profil : prénom, nom, email

1. **Qui, où, quel bouton.** Fatou connectée, `/profile`, titre « Mon profil », bouton « Enregistrer le profil ». Non connectée : « Connectez-vous pour voir votre profil ». Preuve : `components/profile/ProfileForm.tsx:158`, `app/profile/page.tsx:130`.
2. **Ce qu'il saisit.** « Prénom », « Nom » (2 à 80), « Adresse email » (facultative, aide « Recommandé : recevez vos billets et confirmations par email »). Erreurs : « Prénom : 2 caractères au moins. » ; « Nom : 80 caractères au plus. » ; « Adresse email invalide. » ; « Cette adresse est réservée. Saisissez votre propre adresse email. » ; « Cette adresse email est déjà associée à un compte. » ; « Votre profil a été modifié entre-temps. Rechargez la page et recommencez. » ; « Votre profil n’a pas pu être enregistré. Réessayez dans un instant. ». Bandeau « Enregistrement impossible ». Depuis le lot 9 bis, changer ou vider l'adresse demande d'abord le mot de passe, s'il n'a pas été saisi depuis moins de 10 minutes sur cet appareil : fenêtre « Confirmez votre mot de passe », « Par sécurité, cette action demande votre mot de passe. », aide « Votre saisie reste valable 10 minutes sur cet appareil. », refus « Mot de passe incorrect. » ou « Trop de tentatives. Réessayez dans quelques minutes. » ; l'enregistrement repart seul après la saisie. Preuve : `lib/validations/account.ts:9-19`, `components/profile/ProfileForm.tsx:261`, `components/auth/PasswordConfirmDialog.tsx:113-114`, `:144`, `app/api/account/password-confirm/route.ts:43`, `:51`, `app/api/account/profile/route.ts:64-75`.
3. **Ce que fait le système.** Profil mis à jour, message « Profil enregistré. ». Depuis le lot 9 bis, une nouvelle adresse n'est pas appliquée tout de suite : elle reste « en attente » et reçoit un lien de vérification valable 24 heures (« Un lien de vérification a été envoyé à {adresse}. Il est valable 24 heures. »). Le champ montre le badge « Email non vérifié » et le bouton « Renvoyer le lien » (« Lien envoyé à {adresse}. Il est valable 24 heures. », quota « Trop de liens demandés. Réessayez dans {n} minutes. »). Le lien ouvre `/verify-email`, « Vérifier mon adresse email » : « Adresse vérifiée. Vous recevrez désormais vos billets et vos confirmations par email. » ; sinon « Ce lien n’est pas valable. Demandez un nouveau lien depuis votre profil. », « Ce lien a expiré (24 heures). Demandez un nouveau lien depuis votre profil. », « Ce lien a déjà servi. » ou « Cette adresse est déjà vérifiée sur un autre compte Event Village. ». Une fois vérifiée, l'adresse devient celle du compte et de la connexion, avec le badge « Email vérifié ». Tant qu'elle ne l'est pas, elle ne reçoit que ce lien. Si l'email est vidé, l'adresse technique revient. L'écran montre aussi le téléphone, le rôle, le statut, des raccourcis selon le rôle (« Préférences de notification », « Mes paiements », « Portefeuille de parrainage », « Espace partenaire », « Contrôle des billets », « Administration ») et le thème. Preuve : `app/api/account/profile/route.ts:55-75`, `components/profile/ProfileForm.tsx:88-97`, `:204`, `:261-281`, `app/api/account/email/resend/route.ts:24`, `app/verify-email/page.tsx:34-40`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

| La nouvelle adresse | email | indispensable | immédiat | le lien de vérification, texte de l'étape 1.2 |

Rien d'autre n'est envoyé à une adresse tant qu'elle n'est pas vérifiée. Preuve : `EMAIL_VERIFICATION`, `lib/notifications/catalog.ts:1752-1758`.

5. **Ce que les autres voient.** Aïda voit l'adresse du compte sur `/admin/users` ; une adresse en attente n'y remplace l'ancienne qu'après sa vérification.
6. **Ce qui est impossible.** Prendre une adresse en `@eventvillage.sn`, ou une adresse déjà vérifiée par un autre compte. Changer d'adresse sans mot de passe récent. Compte non actif : « Votre compte n'est pas actif. Contactez le support. ».
7. **Test et essai.** Test : `tests/parcours/email-verification.test.ts` (lien valable, expiré, réutilisé, adresse prise, aucun envoi vers une adresse non vérifiée) ; `tests/parcours/mot-de-passe-recent.test.ts` (changement d'adresse sans mot de passe récent refusé) ; `tests/parcours/compte-profil.test.ts:186` « prénom, nom, email : 200, public.users et auth.users à jour, réponse sans cache, audit sans valeur » ; `tests/parcours/compte-profil.test.ts:235` « la connexion suit : nouvel email accepté, ancien refusé, connexion par numéro intacte » ; `tests/parcours/compte-profil.test.ts:250` « email vide : email technique du numéro rétabli dans les deux tables, connexion possible, email_technical vrai » ; `tests/parcours/compte-profil.test.ts:287` « champs invalides : 400 INVALID_FIELD et champ nommé, rien d’écrit, aucun appel à l’API ». Essai : Essai 66 de `docs/recette-billetterie.md`, sans section dans `docs/essai-local.md`.

### Étape 1.9 — Photo de profil

1. **Qui, où, quel bouton.** Fatou, `/profile`, boutons « Choisir une photo », « Supprimer la photo ». Confirmation « Supprimer votre photo ? », « Vos initiales s’afficheront à la place de votre photo. ». Preuve : `components/profile/AvatarEditor.tsx:99`, `:103`.
2. **Ce qu'il saisit.** Une image JPEG, PNG ou WebP de 2 Mo au plus. Erreurs : « Format non pris en charge. Choisissez une photo JPEG, PNG ou WebP. » ; « Cette photo dépasse 2 Mo. Choisissez une photo plus légère. » ; « Format non pris en charge : formats acceptés JPEG, PNG et WebP. » ; « La photo dépasse la taille maximale autorisée (2 Mo). » ; « Trop d’envois de photo pour le moment. Réessayez plus tard. » ; « Votre photo n’a pas pu être enregistrée. Réessayez dans un instant. ». Preuve : `components/profile/AvatarEditor.tsx:35`, `:39`, `app/api/account/avatar/route.ts:26-28`, `:81`, `lib/env.ts:106`.
3. **Ce que fait le système.** La photo est refaite en image carrée de 256 pixels sans métadonnées, l'ancienne supprimée. Messages « Photo de profil enregistrée. », « Photo de profil supprimée. ». Preuve : `app/api/account/avatar/route.ts:87-113`, `M/20261108000004_lot9_compte.sql:278`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** La photo apparaît dans la navigation de Fatou. Ce que voit un contrôleur n'est pas prévu : le scanner n'affiche que le nom.
6. **Ce qui est impossible.** Un autre format, plus de 2 Mo, plus de 40 millions de pixels. Preuve : `app/api/account/avatar/route.ts:20`.
7. **Test et essai.** Test : `tests/parcours/compte-photo.test.ts:252` « ${format} : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache » ; `tests/parcours/compte-photo.test.ts:370` « faux type : texte nommé .jpg et déclaré image/jpeg : 400 UNSUPPORTED_FORMAT » ; `tests/parcours/compte-photo.test.ts:670` « AppLayout et /profile passent par Avatar ; AvatarEditor porte les libellés figés » ; `tests/security/r27-avatars.test.ts:184` « A n’écrit pas dans son propre dossier : un WebP valide contournerait sharp et le retrait EXIF (AR3) ». Essai : Essai 68 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.13.

### Étape 1.10 — Ville

1. **Qui, où, quel bouton.** Fatou ou le visiteur, accueil `/`, section « Près de chez vous », liste « Votre ville ». Il n'y a pas de champ ville sur `/profile`. Preuve : `components/events/HomeDiscovery.tsx:232`.
2. **Ce qu'il saisit.** Un choix dans la liste des villes du catalogue. Erreurs : « La ville n’a pas pu être enregistrée. Réessayez dans un instant. » ; « Connexion impossible : vérifiez votre réseau, puis réessayez. » ; « La ville doit contenir de 2 à 80 caractères. ». Preuve : `components/events/HomeDiscovery.tsx:22-23`, `app/api/profile/city/route.ts:46`.
3. **Ce que fait le système.** Compte connecté : ville enregistrée sur le compte. Visiteur : gardée dans ce navigateur. Elle n'est jamais déduite de la position. Affiche jusqu'à 8 événements de cette ville. Preuve : `components/events/HomeDiscovery.tsx:21`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Effacer sa ville depuis l'écran. Saisir librement une ville : liste seulement.
7. **Test et essai.** Test : `tests/parcours/decouverte-ville.test.ts:108` « stockée en capitales, sans espaces, rendue et relue par /api/auth/me » ; `tests/parcours/decouverte-ville.test.ts:180` « compte suspendu : 403 ACCOUNT_NOT_ACTIVE, ville inchangée » ; `tests/parcours/decouverte-ville.test.ts:276` « le catalogue filtre sur la ville du profil ; Populaires reste global (L20) ». Essai : Essai 65 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.14.

### Étape 1.11 — Changer de numéro

1. **Qui, où, quel bouton.** Fatou, `/profile`, bouton « Changer de numéro ». Fenêtre « Changer de numéro », « Étape 1 sur 2 : votre nouveau numéro », bouton « Recevoir le code » ; puis « Étape 2 sur 2 : le code reçu par SMS », boutons « Confirmer », « Renvoyer le code », « Modifier le numéro », « Annuler ». Preuve : `components/profile/ProfileForm.tsx:168`, `components/profile/PhoneChangeDialog.tsx:138`, `:154`.
2. **Ce qu'il saisit.** « Nouveau numéro de téléphone », puis le code. Depuis le lot 9 bis, le mot de passe est demandé d'abord, s'il n'a pas été saisi depuis moins de 10 minutes sur cet appareil (même fenêtre qu'à l'étape 1.8) ; aucun code sur l'ancien numéro. Preuve : `app/api/account/phone/start/route.ts:33`, `app/api/account/phone/confirm/route.ts:43`. Erreurs : « Saisissez un numéro de mobile sénégalais valide, par exemple 77 123 45 67. » ; « Ce numéro est déjà celui de votre compte. » ; « Ce numéro est déjà associé à un compte. » ; « Trop de demandes de changement de numéro aujourd’hui. Réessayez demain. » ; « Impossible d’envoyer le code par SMS. Réessayez. » ; « Saisissez les 6 chiffres du code reçu par SMS. » ; « Votre numéro a été modifié entre-temps. Recommencez le changement. » ; « Votre numéro n’a pas pu être changé. Réessayez dans un instant. ». Preuve : `components/profile/PhoneChangeDialog.tsx:98`, `app/api/account/phone/start/route.ts:64`, `:81`, `lib/env.ts:105`.
3. **Ce que fait le système.** Le numéro change. Les autres appareils sont déconnectés, celui-ci reste connecté. Les billets sont conservés. Depuis le lot 9 bis : les transferts en attente adressés à l'ancien numéro sont annulés, et leur expéditeur est prévenu (une invitation en attente vers ce numéro est annulée, sa place rendue) ; tout retrait est refusé pendant 24 heures, « Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le {date}. », exemple « Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le 12/11/2026 à 10:17. ». Preuve : `M/20261109000004_lot9bis_droits.sql:802-837`, `M/20261109000006_lot9bis_argent.sql:298-307`. Message « Numéro modifié. Vos autres appareils ont été déconnectés. ». À l'écran, avant : « Une fois le numéro changé, vos autres appareils seront déconnectés et votre ancien numéro recevra un SMS d’information. ». Preuve : `M/20261108000004_lot9_compte.sql:203`, `tests/parcours/compte-numero.test.ts:488`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le nouveau numéro | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |
| L'ancien numéro, sans compte rattaché | SMS | indispensable | prochain passage de la file | modèle « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » ; exemple « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » (100 caractères, 1 segment) |

| Le compte de Fatou, si son adresse est vérifiée | email | indispensable | prochain passage de la file | objet « Numéro de téléphone modifié — Event Village » ; texte « Le numéro de téléphone de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » ; bouton vers `/profile` |
| L'expéditeur d'un transfert en attente vers l'ancien numéro | cloche, push, email | indispensable | prochain passage de la file | titre « Transfert annulé » ; modèle « Le destinataire de votre billet pour « {title} » a changé de numéro : le transfert est annulé et le billet reste dans vos billets. » ; exemple « Le destinataire de votre billet pour « Gala de la Teranga » a changé de numéro : le transfert est annulé et le billet reste dans vos billets. » |

Preuve : `PHONE_CHANGED`, `TRANSFER_RECIPIENT_CHANGED` (`M/20261109000004_lot9bis_droits.sql:831-856`, `lib/notifications/catalog.ts:1437-1446`).

5. **Ce que les autres voient.** Depuis le lot 9 bis, les transferts adressés à l'ancien numéro sont annulés et l'expéditeur retrouve son billet (étape 17.4).
6. **Ce qui est impossible.** Prendre un numéro déjà utilisé. Reprendre le même numéro. Le faire sans session réelle, ou sans mot de passe récent. Retirer de l'argent dans les 24 heures qui suivent.
7. **Test et essai.** Test : `tests/parcours/mot-de-passe-recent.test.ts` (changement de numéro sans mot de passe récent refusé) ; `tests/parcours/lot9bis-verrou-numero.test.ts` (retrait refusé 24 h) ; `tests/parcours/cycle9bis-transfert.test.ts` (transfert vers l'ancien numéro annulé, expéditeur prévenu) ; `tests/parcours/compte-numero.test.ts:286` « un code de 6 chiffres au nouveau numéro, objet PHONE_CHANGE, aucun SMS à l’ancien, journal sans le code, compte inchangé » ; `tests/parcours/compte-numero.test.ts:311` « numéro déjà pris sous la forme +221… puis 221… : 409 PHONE_TAKEN sans aucun SMS » ; `tests/parcours/compte-numero.test.ts:488` « les deux tables à jour, phone_verified_at remis à maintenant, billets inchangés, audit masqué » ; `tests/parcours/compte-numero.test.ts:563` « email technique : l’ancien numéro peut de nouveau s’inscrire (D-cpt C3) » ; `tests/parcours/compte-numero.test.ts:980` « transfert vers l’ancien numéro : plus visible et non reciblé ; vers le nouveau : visible après le changement ». Essai : Essais 67 et 74 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.15.

### Étape 1.12 — Déconnexion

1. **Qui, où, quel bouton.** Fatou, bouton « Se déconnecter » sur `/profile` ou dans le menu. Preuve : `app/profile/page.tsx:319`, `components/layout/AppLayout.tsx:395`, `:462`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** L'appareil est détaché du push, puis la session se ferme. Preuve : `AuthProvider.tsx:203-212`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Aucun.
7. **Test et essai.** Test : aucun qui exécute ce parcours (`tests/parcours/notif-interface.test.ts` ne relit que le fichier). Essai : Essai 2 de `docs/recette-billetterie.md`.

# Chapitre 2. Le partenaire

### Étape 2.1 — Dossier d'inscription et pièces

1. **Qui, où, quel bouton.** Mariama, déconnectée, `/partner/register` depuis « Espace professionnel » sur `/login`. Titre « Devenir partenaire Event Village », bouton « Envoyer mon dossier ». Connectée, elle lit « Vous êtes déjà connecté » et « Ce formulaire crée un compte professionnel distinct, avec un autre numéro de téléphone. Votre compte actuel n’est pas transformé en compte partenaire. ». Preuve : `components/auth/LoginForm.tsx:722-731`, `app/partner/register/page.tsx:354-365`, `:547`.
2. **Ce qu'il saisit.** « 1. Votre structure » : « Raison sociale »*, « Nom commercial (enseigne) », « Activités proposées »*, « Présentation de votre structure »* (10 à 2 000 caractères), « Adresse »*, « Ville »*, « NINEA (facultatif) », « RCCM (facultatif) », 40 caractères au plus chacun. « 2. Le gérant et le compte » : « Prénom »*, « Nom »*, « Téléphone professionnel »*, « Email professionnel »*, avec, depuis le lot 9 bis, l'aide « Recommandé : recevez vos billets et confirmations par email. Un lien de vérification vous est envoyé ; l’adresse ne reçoit rien d’autre tant qu’elle n’est pas vérifiée. », « Mot de passe »*, « Confirmer le mot de passe »*. « 3. Pièces justificatives » : « Pièce d’identité du gérant »*, « Document de l’entreprise »*, « PDF, JPEG, PNG ou WebP, 10 Mo au plus. ». Erreurs (tête de formulaire « Le dossier n’est pas complet : corrigez les champs signalés. ») : « La raison sociale est requise » ; « Une brève description de votre activité est requise » ; « L'adresse de l'établissement est requise » ; « Sélectionnez au moins un type d'activité » ; « Le prénom du gérant est requis » ; « Le nom du gérant est requis » ; « Adresse email professionnelle requise » ; « Veuillez confirmer le mot de passe » ; « Les mots de passe ne correspondent pas. » ; « Joignez la pièce d’identité du gérant (CNI ou passeport). » ; « Joignez le document de l’entreprise (RCCM ou NINEA). » ; « Le fichier est vide ou dépasse la taille maximale autorisée (10 Mo). » ; « Format de fichier non supporté. Formats acceptés : PDF, JPEG, PNG, WebP. » ; « Trop de dépôts depuis cette connexion. Réessayez plus tard. » ; « Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter. » ; « Pièces justificatives déjà utilisées ou expirées : déposez-les à nouveau. » ; depuis le lot 9 bis, une pièce est nommée en français, par exemple « Le dépôt de la pièce d’identité a expiré : déposez-la à nouveau. » ; « Le NINEA et le RCCM font 40 caractères au plus. » ; « Cette adresse est réservée. Saisissez votre propre adresse email. » ; « Trop de tentatives d’inscription depuis cette connexion. Réessayez plus tard. » ; « Impossible d'envoyer le code de vérification SMS. Vérifiez votre numéro et réessayez. ». Preuve : `lib/validations/auth.ts:172-206`, `lib/partners/documents.ts:78-86`, `app/api/partner/register/route.ts:67`, `:83`, `:90`, `:113`, `:144`.
3. **Ce que fait le système.** Les pièces vont dans un espace privé. Depuis le lot 9 bis, « Envoyer mon dossier » ne crée **rien** : le serveur contrôle le formulaire et les pièces, refuse un numéro ou un email déjà pris, puis envoie seulement le code SMS. Le compte et le dossier ne sont créés qu'à l'étape 2.2, une fois le code vérifié. Rien de public. Preuve : `lib/partners/documents.ts:17`, `:37`, `:42`, `app/api/partner/register/route.ts:44-56`, `:96-144`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le numéro saisi | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

Depuis le lot 9 bis, l'accusé « Inscription reçue » ne part qu'à l'étape 2.2, avec la création du dossier. Preuve : `OTP_REGISTER`, `app/api/partner/register/route.ts:131-144`.

5. **Ce que les autres voient.** Voir l'étape 2.3.
6. **Ce qui est impossible.** Un numéro ou un email déjà pris ; une pièce manquante ; une adresse en `@eventvillage.sn`. Un client connecté ne devient pas partenaire (anomalie A12).
7. **Test et essai.** Test : `tests/parcours/dossier-partenaire-9bis.test.ts:82` « appel 1 sans code : 200 { otpSent: true, phone }, un SMS de code, aucun compte, aucune fiche, aucun avis aux admins » ; `tests/parcours/documents-inscription.test.ts:54` « dépôt : chemin non devinable et jeton de dépôt » ; `tests/parcours/documents-inscription.test.ts:62` « dépôt : type de pièce hors liste et contenu non conforme refusés » ; `tests/parcours/ecritures-ignorees.test.ts:299` « panne sur les activités : 500 PARTNER_REGISTER_FAILED, aucune fiche, pièces libres, compte retiré, aucun texte de base » ; `tests/parcours/notif-pros.test.ts:639` « inscription par la route : un seul SMS (le code), PARTNER_REGISTERED_ACK in-app et email, aucune ligne SMS de la boîte d’envoi » ; `e2e/recette.spec.ts:323` « acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 ». Essai : Essai 9 de `docs/recette-billetterie.md`, sans section dans `docs/essai-local.md`.

### Étape 2.2 — Vérification du numéro

1. **Qui, où, quel bouton.** Mariama, même page, « Vérifiez votre numéro », boutons « Vérifier le code », « Renvoyer le code » ou « Renvoyer le code ({n} s) », exemple « Renvoyer le code (42 s) ». Preuve : `app/partner/register/page.tsx:406`, `:417`.
2. **Ce qu'il saisit.** Le code à 6 chiffres. Erreurs : « Saisissez les 6 chiffres du code reçu par SMS. », bandeau « Code non accepté », « Code de vérification incorrect ou expiré. » (aucune création), « Trop de tentatives de vérification pour ce numéro. Réessayez plus tard. », « Nouveau code non envoyé (erreur {statut}). Réessayez plus tard. », exemple « Nouveau code non envoyé (erreur 429). Réessayez plus tard. », et l'information « Nouveau code envoyé par SMS. L’ancien ne fonctionne plus. ». Preuve : `app/partner/register/page.tsx:446-456`, `app/api/partner/register/route.ts:96`, `:163`.
3. **Ce que fait le système.** Depuis le lot 9 bis, le formulaire est renvoyé avec le code : le serveur vérifie le code, puis crée en une seule opération le compte (numéro vérifié), le rôle partenaire, le profil, le dossier « en attente » (numéro vérifié, NINEA et RCCM enregistrés), les activités et les pièces, et ouvre la session. L'adresse saisie reste en attente de son lien de vérification (étape 1.8) ; le dossier la garde comme contact. Écran « Dossier reçu », badge « En attente de validation », « Votre numéro est vérifié. Notre équipe examine votre dossier et vos pièces. », puis « Un lien de vérification a été envoyé à {adresse}. Il est valable 24 heures. » ou « Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre profil. », étapes « 1. Vérification des pièces, en général sous 24 à 48 heures. », « 2. Un SMS vous prévient dès la validation de votre compte. », « 3. Vous créez et publiez votre premier événement depuis votre espace. », bouton « Ouvrir mon espace partenaire » (ou « Aller à la connexion » si la session n'a pas pu s'ouvrir). Preuve : `app/api/partner/register/route.ts:12-23`, `:214-290`, `app/partner/register/page.tsx:407-436`, `M/20261109000004_lot9bis_droits.sql:559`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama, si elle demande un nouveau code | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Inscription reçue » ; modèle « Votre demande de compte partenaire « {company} » est en cours d'examen. » ; exemple « Votre demande de compte partenaire « Sabar Events » est en cours d'examen. » |
| L'adresse saisie par Mariama | email | indispensable | immédiat | le lien de vérification, texte de l'étape 1.2 |
| Mariama, une fois son adresse vérifiée | email | indispensable | prochain passage de la file | objet « Inscription reçue — Event Village » ; texte « Votre demande de compte partenaire « Sabar Events » est en cours d'examen. », bouton vers `/partner/dashboard` ; avant la vérification, la ligne reste « Non envoyée », motif « Adresse email non vérifiée » |

Aucun SMS d'accusé. Preuve : `OTP_REGISTER`, `PARTNER_REGISTERED_ACK`, `EMAIL_VERIFICATION`, `app/api/auth/send-otp/route.ts:99`, `app/api/partner/register/route.ts:255-263`.

5. **Ce que les autres voient.** Depuis le lot 9 bis, les admins ne sont prévenus qu'ici, une fois le code vérifié (étape 2.3), et la fiche du dossier montre « Numéro vérifié ». Preuve : `app/admin/dashboard/page.tsx:757`.
6. **Ce qui est impossible.** Reprendre l'écran du code après un rechargement : il n'est gardé qu'en mémoire, et rien n'a encore été créé. Se réinscrire avec le même numéro une fois le dossier créé.
7. **Test et essai.** Test : `tests/parcours/dossier-partenaire-9bis.test.ts:95` « appel 2 avec un mauvais code : 400 OTP_INVALID, aucune création » ; `tests/parcours/dossier-partenaire-9bis.test.ts:106` « appel 2 avec le bon code : 201, compte et fiche, numéro vérifié (partners.phone_verified, users.phone_verified_at), avis aux admins » ; `tests/parcours/otp-serveur.test.ts:107` « inscription partenaire → otp_codes → verify-otp depuis une autre instance » ; `e2e/recette.spec.ts:345` « inscription du partenaire : formulaire, 2 pièces, code SMS ». Essai : Essai 9 de `docs/recette-billetterie.md`.

### Étape 2.3 — Ce que reçoivent les admins

1. **Qui, où, quel bouton.** Aïda et Moussa (permission `partners.read`), sans action de leur part. La cloche, `/notifications`, puis `/admin/dashboard`, section « Candidatures des partenaires », onglets « En attente », « Validés », « Refusés », « Tous ».
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** L'alerte est créée avec la fiche, c'est-à-dire, depuis le lot 9 bis, seulement après la vérification du code de Mariama. La liste et les compteurs se rechargent seuls. Preuve : `M/20261103000006_lot6_pros_admin.sql:651-655`, `M/20261102000006_lot5_temps_reel.sql:459-481`, `app/admin/dashboard/page.tsx:267-273`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `partners.read` | cloche | indispensable | prochain passage de la file | titre « Nouvelle candidature » ; modèle « {company} demande un compte partenaire. » ; exemple « Sabar Events demande un compte partenaire. » |
| Aïda et les admins avec `partners.read` | push | indispensable | prochain passage de la file | titre « Nouvelle candidature » ; modèle « {company} demande un compte partenaire. » ; exemple « Sabar Events demande un compte partenaire. » |
| Aïda et les admins avec `partners.read` | email | indispensable | prochain passage de la file | objet « Nouvelle candidature — Event Village » ; modèle : Nouvelle candidature<br>{company} demande un compte partenaire.<br>Ouvrir Event Village : {APP_URL}/admin/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Nouvelle candidature<br>Sabar Events demande un compte partenaire.<br>Ouvrir Event Village : https://eventvillage.sn/admin/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Preuve : `ADMIN_PARTNER_REGISTERED` (`M/20261103000006_lot6_pros_admin.sql:652`).

5. **Ce que les autres voient.** Compteur « Partenaires à valider », carte « Voir les candidatures ». Preuve : `app/admin/dashboard/page.tsx:478`, `:487`.
6. **Ce qui est impossible.** Moussa sans `partners.read` ne reçoit rien et lit « Votre compte n’a pas l’autorisation de consulter les partenaires. ». Depuis le lot 9 bis, un dossier abandonné avant le code ne crée ni fiche ni alerte.
7. **Test et essai.** Test : `tests/parcours/notif-admins.test.ts:208` « partenaire inscrit : ADMIN_PARTNER_REGISTERED (in-app, push, email) aux admins partners.read et au SUPERADMIN » ; `tests/notifications-and-documents.test.ts:92` « 4. TRIGGER MÉTIER SUPERADMIN : Notification in-app lors de la candidature partenaire ». Essai : Essais 9 et 10 de `docs/recette-billetterie.md`, qui ne citent pas ce message.

### Étape 2.4 — Ce que voit un partenaire en attente

1. **Qui, où, quel bouton.** Mariama, connectée, `/partner/dashboard`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Depuis le lot 9 bis, le tableau de bord est servi à un compte en attente. Mariama voit le bandeau « Compte en cours de vérification », « Vos pièces sont vérifiées par l’équipe Event Village. Vous recevrez un SMS dès la validation de votre compte ; vous pourrez alors créer et publier vos événements. En attendant, votre profil reste modifiable. », avec le bouton « Voir mon profil ». Son profil partenaire (`/partner/profile`) est ouvert ; toute autre page de l'espace partenaire la ramène au tableau de bord. Restent ouverts aussi : la cloche, ses propres pièces. Sur `/profile` : badge « Partenaire en attente de validation », statut « Compte en attente de validation ». Preuve : `app/partner/dashboard/page.tsx:452-462`, `app/partner/layout.tsx:9-13`, `app/api/notifications/route.ts:92`, `app/profile/page.tsx:56`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

L'accusé de l'étape 2.1 reste lisible dans la cloche.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Créer un événement : « Votre profil d’organisateur doit être validé avant de créer un événement. », refus fait par le serveur. Soumettre ou publier un événement existant : même refus, même pour un admin qui agit sur sa fiche. Démarrer l'essai : « Le compte partenaire doit d'abord être validé par un administrateur. ». Preuve : `app/api/partner/events/route.ts:87-92`, `lib/events/event-lifecycle.service.ts:63`, `app/api/partner/activation/route.ts:60`.
7. **Test et essai.** Test, avec un vrai compte en attente depuis le lot 9 bis : `tests/parcours/partenaire-en-attente.test.ts:97` « GET /api/partner/dashboard → 200 et partner.status = EN_ATTENTE (bandeau « Compte en cours de vérification ») » ; `tests/parcours/partenaire-en-attente.test.ts:103` « GET /api/partner/profile → 200 » ; `tests/parcours/partenaire-en-attente.test.ts:110` « POST /api/partner/events → 403 PARTNER_NOT_VALIDATED, aucun événement créé » ; `tests/parcours/partenaire-en-attente.test.ts:128` « fiche remise EN_ATTENTE : soumission et publication par la propriétaire → 403 PARTNER_NOT_VALIDATED, statuts inchangés ». Essai : Essai 9 de `docs/recette-billetterie.md`.

### Étape 2.5 — Admin : ouvrir le dossier et les pièces

1. **Qui, où, quel bouton.** Aïda, `/admin/dashboard`, ligne du partenaire, bouton « Dossier ». Fenêtre « Dossier du partenaire », boutons « Ouvrir », « Fermer », et selon le statut, depuis le lot 9 bis : « Refuser » et « Valider la candidature » pour un dossier en attente seulement (permission `partners.validate`) ; « Suspendre » pour un partenaire validé (`partners.suspend`) ; « Réactiver » pour un partenaire suspendu (`partners.validate`). Un bouton sans la permission n'est pas affiché. Preuve : `app/admin/dashboard/page.tsx:655-688`.
2. **Ce qu'il saisit.** Aucun. Erreur : « Impossible d'accéder au document justificatif sur le stockage sécurisé. ». Preuve : `lib/messages/toast-messages.ts:22`.
3. **Ce que fait le système.** Un lien valable 5 minutes s'ouvre dans un nouvel onglet, l'accès est journalisé. L'écran montre raison sociale, nom commercial, ville, adresse, responsable, téléphone avec, depuis le lot 9 bis, le badge « Numéro vérifié » ou « Numéro non vérifié », email, présentation, NINEA et RCCM saisis, la date d'un complément de dossier, « Pièce d’identité », « NINEA ou RCCM ». Pour un dossier refusé : « Motif du refus », puis « Le partenaire peut compléter son dossier une fois depuis son tableau de bord. » ou « Le partenaire a déjà complété son dossier une fois. ». Preuve : `app/api/partner/documents/signed-url/route.ts:9`, `:93`, `app/admin/dashboard/page.tsx:697-760`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Sans `partners.read`, ouvrir le dossier. Un autre partenaire : « Accès non autorisé à ce document. ».
7. **Test et essai.** Test : `tests/parcours/dossier-partenaire-9bis.test.ts:124` « enregistrés sur la fiche et servis à l’admin par GET /api/admin/partners » ; `tests/parcours/fiche-partenaire-9bis.test.ts:196` « « Valider » et « Refuser » seulement pour un dossier EN_ATTENTE ; lien profond dossier= » ; `tests/parcours/documents-inscription.test.ts:71` « URL signée : propriétaire et admin oui, compte tiers 403 » ; `tests/parcours/documents-inscription.test.ts:87` « URL signée : un chemin fourni par le client n’est plus accepté » ; `tests/parcours/documents-inscription.test.ts:108` « dossier antérieur au lot 1C.2 : chemin hérité servi à l’admin seulement » ; `e2e/recette.spec.ts:349` « validation par le SUPERADMIN, après consultation d’une pièce ». Essai : Essai 10 de `docs/recette-billetterie.md`.

### Étape 2.6 — Validation

1. **Qui, où, quel bouton.** Aïda, ou Moussa avec `partners.validate`. Bouton « Valider », puis « Valider la candidature ». Texte : « « {société} » pourra créer des événements et vendre des billets. Le responsable est prévenu par SMS. », exemple « « Sabar Events » pourra créer des événements et vendre des billets. Le responsable est prévenu par SMS. ». Preuve : `app/admin/dashboard/page.tsx:363`, `:770`.
2. **Ce qu'il saisit.** Aucun. Refus : depuis le lot 9 bis « Action non autorisée : votre compte n’a pas la permission « Valider les partenaires ». », « Le partenaire est déjà dans ce statut. », « Mise à jour du partenaire momentanément impossible. ». Preuve : `app/api/admin/partners/[id]/status/route.ts:73`, `:85`, `lib/admin/permission-labels.ts:33-35`, `M/20261109000006_lot9bis_argent.sql:772`.
3. **Ce que fait le système.** Dossier « Validé », compte actif. Message « Le partenaire « {société} » a été validé avec succès. », exemple « Le partenaire « Sabar Events » a été validé avec succès. ». Le numéro est vérifié depuis l'inscription (étape 2.2). Depuis le lot 9 bis, la décision est écrite au journal d'audit dans la même opération : si le journal échoue, rien n'est validé. Preuve : `M/20261109000006_lot9bis_argent.sql:772`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre compte partenaire {company} est validé. Connectez-vous : {APP_URL}/login » ; exemple « Event Village : votre compte partenaire Sabar Events est validé. Connectez-vous : https://eventvillage.sn/login » (111 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Compte partenaire validé » ; modèle « Votre compte partenaire « {company} » est validé. Vous pouvez créer et publier vos événements. » ; exemple « Votre compte partenaire « Sabar Events » est validé. Vous pouvez créer et publier vos événements. » |
| Mariama | email | indispensable | prochain passage de la file | objet « Compte partenaire validé — Event Village » ; modèle : Compte partenaire validé<br>Votre compte partenaire « {company} » est validé. Vous pouvez créer et publier vos événements.<br>Ouvrir Event Village : {APP_URL}/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Compte partenaire validé<br>Votre compte partenaire « Sabar Events » est validé. Vous pouvez créer et publier vos événements.<br>Ouvrir Event Village : https://eventvillage.sn/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Preuve : `PARTNER_VALIDATED` (`M/20261103000006_lot6_pros_admin.sql:663-664`, `app/api/admin/partners/[id]/status/route.ts:75`).

5. **Ce que les autres voient.** La candidature quitte la file. À sa prochaine visite, Mariama voit son tableau de bord normal et l'essai démarre (étape 2.11). Depuis le lot 9 bis, la validation ne lui envoie qu'un seul SMS : le démarrage de l'essai n'en envoie plus.
6. **Ce qui est impossible.** Valider deux fois.
7. **Test et essai.** Test : `tests/parcours/notif-pros.test.ts:665` « partner_status_set : validation d’un partenaire EN_ATTENTE → VALIDE, compte ACTIF, PARTNER_VALIDATED (in-app, SMS, email), SMS exact » ; `e2e/recette.spec.ts:349` « validation par le SUPERADMIN, après consultation d’une pièce ». Essai : Essai 10 de `docs/recette-billetterie.md`.

### Étape 2.7 — Refus avec motif

1. **Qui, où, quel bouton.** Aïda, bouton « Refuser », fenêtre « Refuser la candidature », bouton « Refuser la candidature ». Preuve : `app/admin/dashboard/page.tsx:368`.
2. **Ce qu'il saisit.** « Motif du refus », aide « Au moins 3 caractères. Par exemple : NINEA manquant ou illisible, activité non éligible. ». Erreurs : « Indiquez le motif (3 caractères au moins). », « Le motif est limité à 1 000 caractères. » ; depuis le lot 9 bis, sur un partenaire déjà validé, « Seul un dossier en attente peut être refusé. Pour un partenaire validé, utilisez la suspension. ». Preuve : `M/20261109000006_lot9bis_argent.sql:772`, `app/admin/dashboard/page.tsx:877-888`. Texte : « « {société} » sera prévenu par SMS avec votre motif. », exemple « « Sabar Events » sera prévenu par SMS avec votre motif. ».
3. **Ce que fait le système.** Dossier « Refusé », motif enregistré, compte actif. Message « La demande du partenaire « {société} » a été rejetée. », exemple « La demande du partenaire « Sabar Events » a été rejetée. ». Preuve : `M/20261103000006_lot6_pros_admin.sql:741-744`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {reason} » ; exemple « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d'identité illisible. » (106 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Demande refusée » ; modèle « Votre demande de compte partenaire n'est pas acceptée. Motif : {reason} Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. » ; exemple « Votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d’identité illisible. Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. » |
| Mariama | email | indispensable | prochain passage de la file | objet « Demande refusée — Event Village » ; modèle : Demande refusée<br>Votre demande de compte partenaire n'est pas acceptée. Motif : {reason}<br>Ouvrir Event Village : {APP_URL}/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Demande refusée<br>Votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d’identité illisible.<br>Ouvrir Event Village : https://eventvillage.sn/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Preuve : `PARTNER_REJECTED` (`M/20261103000006_lot6_pros_admin.sql:667-669`).

5. **Ce que les autres voient.** Le dossier passe dans l'onglet « Refusés ». Depuis le lot 9 bis, il n'y a plus de bouton « Valider » : un dossier refusé revient en attente seulement quand la partenaire le complète (étape 2.8). Preuve : `M/20261109000006_lot9bis_argent.sql:772`.
6. **Ce qui est impossible.** Refuser sans motif. Refuser un partenaire validé ou suspendu. Valider directement un dossier refusé : « Un dossier refusé doit d’abord être complété par le partenaire : il revient alors en attente de validation. ».
7. **Test et essai.** Test : `tests/parcours/fiche-partenaire-9bis.test.ts:77` « VALIDE → REJETE refusé (TRANSITION_NOT_ALLOWED, texte du contrat), statut inchangé » ; `tests/parcours/fiche-partenaire-9bis.test.ts:101` « REJETE → VALIDE refusé (le complément de dossier remet EN_ATTENTE), statut inchangé » ; `tests/parcours/notif-pros.test.ts:679` « partner_status_set : refus avec motif → REJETE, motif enregistré, PARTNER_REJECTED, SMS exact ; motif trop court → REASON_REQUIRED ». Essai : aucun.

### Étape 2.8 — Ce que voit un partenaire refusé

1. **Qui, où, quel bouton.** Mariama, connectée, `/partner/dashboard`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Bandeau « Demande de compte partenaire refusée », « Motif : {motif} », puis, depuis le lot 9 bis, « Vous pouvez compléter votre dossier une fois : il repasse alors en vérification. » avec le bouton « Compléter mon dossier ». La fenêtre « Compléter mon dossier », « Une seule fois : votre dossier repasse en vérification. », demande de déposer de nouveau les deux pièces, avec NINEA et RCCM facultatifs, et prévient « Après cet envoi, le dossier ne pourra plus être complété ici. » ; bouton « Envoyer mon dossier ». Le dossier repasse « en attente », le motif est gardé, les admins sont prévenus. Après ce complément, le bandeau dit « Votre dossier a déjà été complété une fois. Contactez le support pour la suite. », avec « Contacter le support ». Preuve : `app/partner/dashboard/page.tsx:125-127`, `:218-233`, `:463-475`, `M/20261109000004_lot9bis_droits.sql:639-716`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `partners.read`, après le complément | cloche, push, email | indispensable | prochain passage de la file | titre « Dossier complété » ; modèle « {company} a complété son dossier refusé : il attend un nouvel examen. » ; exemple « Sabar Events a complété son dossier refusé : il attend un nouvel examen. » |

Aucun avis à Mariama. Preuve : `ADMIN_PARTNER_RESUBMITTED` (`M/20261109000004_lot9bis_droits.sql:711`, `lib/notifications/catalog.ts:1373-1379`).

5. **Ce que les autres voient.** Le dossier revient dans l'onglet « En attente » de l'admin, avec la date du complément.
6. **Ce qui est impossible.** Créer un événement : « Votre profil d’organisateur doit être validé avant de créer un événement. ». Retirer de l'argent, démarrer l'essai. Compléter le dossier une seconde fois : « Votre dossier a déjà été complété une fois. Contactez le support. ». Se réinscrire : le numéro et l'email sont pris. Preuve : `app/api/partner/events/route.ts:87-92`, `M/20261109000004_lot9bis_droits.sql:682-686`.
7. **Test et essai.** Test : `tests/parcours/dossier-partenaire-9bis.test.ts:171` « partenaire REJETE : complément → 200, EN_ATTENTE, resubmitted_at, motif gardé, ADMIN_PARTNER_RESUBMITTED ; second essai → 409 RESUBMIT_ALREADY_USED » ; `tests/parcours/dossier-partenaire-9bis.test.ts:190` « partenaire VALIDE : complément → 409 DOSSIER_NOT_REJECTED, fiche inchangée » ; `tests/parcours/partenaire-lot7.test.ts:232` « invisible pour un partenaire EN_ATTENTE ou REJETE ; le motif du refus est servi pour le bandeau REJETE ». Essai : aucun.

### Étape 2.9 — Suspension d'un partenaire

1. **Qui, où, quel bouton.** Depuis le lot 9 bis : Aïda, ou Moussa avec `partners.suspend`, `/admin/dashboard`, fiche « Dossier du partenaire » de Mariama, bouton « Suspendre », fenêtre « Suspendre le partenaire », bouton « Suspendre le partenaire ». Sur `/admin/users`, la ligne d'un compte partenaire ne propose plus « Suspendre » : elle dit « Statut géré depuis la fiche partenaire » et propose « Voir la fiche partenaire », qui ouvre ce dossier. Preuve : `app/admin/dashboard/page.tsx:668-672`, `components/admin/PartnerStatusDialog.tsx:55-62`, `app/admin/users/page.tsx:500-511`.
2. **Ce qu'il saisit.** « Motif de la suspension », obligatoire, aide « Au moins 3 caractères. Ce motif est communiqué au partenaire et enregistré au journal. ». Texte : « « {société} » ne pourra plus vendre : ses événements en ligne sont suspendus et ses fonds sont gelés jusqu’à la réactivation. Il est prévenu avec votre motif. ». Erreurs : « Indiquez le motif (3 caractères au moins). » ; « Seul un partenaire validé peut être suspendu. » ; « Le changement de statut a échoué. Réessayez dans un instant. ». Preuve : `components/admin/PartnerStatusDialog.tsx:58-61`, `:100`, `M/20261109000006_lot9bis_argent.sql:772`.
3. **Ce que fait le système.** Dossier et compte « Suspendu », sessions fermées. Depuis le lot 9 bis, en une seule opération : chaque événement « Publié » de Mariama passe « Suspendu », motif « Organisateur suspendu », avec une trace de cette suspension en cascade ; tous ses fonds sont gelés (aucun retrait possible) ; un paiement ouvert avant et réussi après n'émet pas de billet et est remboursé ; la décision est écrite au journal d'audit. Message « {société} est suspendu. Événements suspendus avec le compte : {n}. », exemple « Sabar Events est suspendu. Événements suspendus avec le compte : 1. ». Son tableau de bord dit « Compte partenaire suspendu », « Motif : {motif}. Vos événements en ligne sont suspendus et vos fonds sont gelés jusqu’à la réactivation du compte. Contactez le support Event Village. ». Preuve : `M/20261109000006_lot9bis_argent.sql:772`, `app/admin/dashboard/page.tsx:376-377`, `app/partner/dashboard/page.tsx:477-482`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre compte partenaire est suspendu. Motif : {reason} Contactez le support. » ; exemple « Event Village : votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d'examen. Contactez le support. » (125 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Compte suspendu » ; modèle « Votre compte partenaire est suspendu. Motif : {reason} Contactez le support. » ; exemple « Votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d’examen. Contactez le support. » |
| Mariama, si son adresse est vérifiée | email | indispensable | prochain passage de la file | objet « Compte suspendu — Event Village » ; modèle : Compte suspendu<br>Votre compte partenaire est suspendu. Motif : {reason} Contactez le support.<br>Ouvrir Event Village : {APP_URL}/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Compte suspendu<br>Votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d’examen. Contactez le support.<br>Ouvrir Event Village : https://eventvillage.sn/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

| Les détenteurs de billets des événements suspendus | cloche, push, email | optionnel | prochain passage de la file | « Événement suspendu », texte de l'étape 13.1 |
| Les contrôleurs affectés à ces événements | cloche, email | indispensable | prochain passage de la file | « Événement suspendu », texte de l'étape 13.1 |

Depuis le lot 9 bis, la cascade n'envoie à Mariama aucun avis par événement : elle a déjà le message de son compte. Preuve : `PARTNER_SUSPENDED` (`M/20261103000006_lot6_pros_admin.sql:670-672`), `EVENT_SUSPENDED_HOLDER`, `CONTROLLER_EVENT_STATUS`, `M/20261109000006_lot9bis_argent.sql:772`.

5. **Ce que les autres voient.** Mariama est déconnectée. Depuis le lot 9 bis, ses événements publiés deviennent « Suspendu » : la fiche publique l'annonce et la vente s'arrête (étape 17.2). Un admin ne peut pas les republier tant qu'elle est suspendue : « PARTNER_SUSPENDED ». Sur `/admin/users`, son compte est en « Suspendu ».
6. **Ce qui est impossible.** Mariama ne peut plus revenir : « Votre compte est suspendu. Veuillez contacter le support. ». Toute page : « Votre compte n'est pas actif. Contactez le support. ». Suspendre une partenaire depuis `/admin/users` : refus « PARTNER_STATUS_VIA_PARTNER_SHEET », sans écriture.
7. **Test et essai.** Test : `tests/parcours/lot9bis-fonds-suspension.test.ts:316` « R5 reproduit : suspension par la route → l’événement PUBLIE passe SUSPENDU (motif, rôle ADMIN), une trace de cascade, aucun EVENT_SUSPENDED à la partenaire » ; `tests/parcours/lot9bis-fonds-suspension.test.ts:426` « B18 : l’admin ne republie pas l’événement d’une partenaire suspendue » ; `tests/parcours/fiche-partenaire-9bis.test.ts:144` « PATCH /api/admin/users {status: SUSPENDU} sur un compte partenaire → 409 PARTNER_STATUS_VIA_PARTNER_SHEET, aucune écriture » ; `tests/parcours/fiche-partenaire-9bis.test.ts:185` « fiche : « Suspendre » et « Réactiver » vers …/status avec un motif (PartnerStatusDialog) » ; `e2e/recette.spec.ts:1003` « suspension du compte de P1 : session refusée » ; `tests/parcours/revocation-sessions.test.ts:81` « suspension par un admin → sessions révoquées » ; `tests/parcours/statut-compte.test.ts:172` « partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE) » ; `tests/parcours/notif-pros.test.ts:700` « partner_status_set : suspension (motif) → partenaire et compte SUSPENDU, sessions révoquées, avis envoyé malgré la suspension (ALLOW) ; réactivation → VALIDE, ACTIF, PARTNER_REACTIVATED ». Essai : Essai 55 de `docs/recette-billetterie.md`, réécrit au lot 9 bis sur la fiche partenaire.

### Étape 2.10 — Réactivation d'un partenaire

1. **Qui, où, quel bouton.** Depuis le lot 9 bis : Aïda, ou Moussa avec `partners.validate`, `/admin/dashboard`, fiche « Dossier du partenaire » de Mariama, bouton « Réactiver », fenêtre « Réactiver le partenaire », bouton « Réactiver le partenaire ». Preuve : `app/admin/dashboard/page.tsx:673-677`, `components/admin/PartnerStatusDialog.tsx:63-69`.
2. **Ce qu'il saisit.** « Motif de la réactivation », obligatoire, 3 caractères au moins. Texte : « « {société} » retrouve son compte. Seuls les événements suspendus avec le compte reviennent en ligne ; un événement suspendu pour une autre raison, ou terminé entre-temps, reste suspendu. ». Erreur : « Indiquez le motif (3 caractères au moins). ». Preuve : `components/admin/PartnerStatusDialog.tsx:65-67`.
3. **Ce que fait le système.** Dossier « Validé », compte actif. Depuis le lot 9 bis, seuls les événements suspendus par la cascade de l'étape 2.9, encore « Suspendu », non terminés et sans autre changement depuis, reviennent « Publié » (motif « Organisateur réactivé ») ; les autres restent suspendus, et la trace dit pourquoi. Les fonds ne sont plus gelés. Message « {société} est réactivé. Événements remis en ligne : {n}. », suivi de « Restés suspendus : {n}. » s'il y en a, exemple « Sabar Events est réactivé. Événements remis en ligne : 1. ». Preuve : `M/20261109000006_lot9bis_argent.sql:772`, `app/admin/dashboard/page.tsx:378-380`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre compte partenaire est réactivé. Connectez-vous : {APP_URL}/login » ; exemple « Event Village : votre compte partenaire est réactivé. Connectez-vous : https://eventvillage.sn/login » (100 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Compte réactivé » ; modèle « Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements. » ; exemple « Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements. » |
| Mariama, si son adresse est vérifiée | email | indispensable | prochain passage de la file | objet « Compte réactivé — Event Village » ; modèle : Compte réactivé<br>Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements.<br>Ouvrir Event Village : {APP_URL}/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Compte réactivé<br>Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements.<br>Ouvrir Event Village : https://eventvillage.sn/partner/dashboard<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

| Les détenteurs des événements remis en ligne | cloche, push, email | optionnel | prochain passage de la file | « Événement de nouveau en ligne », texte de l'étape 13.3 |
| Les contrôleurs affectés à ces événements | cloche, email | indispensable | prochain passage de la file | « Événement de nouveau en ligne », texte de l'étape 13.3 |

Aucun avis par événement à Mariama. Preuve : `PARTNER_REACTIVATED` (`M/20261103000006_lot6_pros_admin.sql:665-666`), `EVENT_REACTIVATED_HOLDER`, `CONTROLLER_EVENT_STATUS`.

5. **Ce que les autres voient.** Mariama peut se reconnecter. Les événements remis en ligne réapparaissent sur l'accueil et sont de nouveau en vente.
6. **Ce qui est impossible.** Réactiver sans motif. Réactiver un dossier qui n'est pas suspendu.
7. **Test et essai.** Test : `tests/parcours/lot9bis-fonds-suspension.test.ts:375` « réactivation : seul l’événement cascadé intact revient PUBLIE (« Organisateur réactivé ») ; suspendu avant, terminé ou annulé pendant : traces LEFT_ENDED, LEFT_CHANGED » ; `tests/parcours/fiche-partenaire-9bis.test.ts:85` « SUSPENDU → VALIDE sans motif → REASON_REQUIRED, toujours SUSPENDU ; avec motif → VALIDE (témoin) » ; `e2e/recette.spec.ts:1011` « suspension du compte de P1 : session refusée » ; `tests/parcours/dette-suspendu-temps-reel.test.ts:547` « réactivé (SUSPENDU → VALIDE par la même route) : un nouveau client reçoit chacune des huit tables ». Essai : Essai 55 de `docs/recette-billetterie.md`.

### Étape 2.11 — Période d'essai

1. **Qui, où, quel bouton.** Elle démarre seule à la première visite de `/partner/dashboard` d'un partenaire validé. Visible aussi sur `/partner/subscription`. Preuve : `app/partner/dashboard/page.tsx:110-136`.
2. **Ce qu'il saisit.** Aucun. Erreurs : « La période d’essai n’a pas pu démarrer. Rechargez la page pour réessayer. » ; « Connexion impossible : la période d’essai démarrera à votre prochaine visite. » ; « Activation de la période d’essai momentanément impossible. ».
3. **Ce que fait le système.** 60 jours, ou 90 avec l'offre fondateur (aucun écran ne la pose ; depuis le lot 9 bis, le seed pose lui aussi 60 jours sans fondateur). Écran « Période d’essai gratuite en cours », « {jours} jours offerts, jusqu’au {date}. », exemple « 60 jours offerts, jusqu’au 8 janvier 2027. ». Sur l'abonnement : « Début », « Fin », « {n} jour{s} restant{s} », « {n} % de la période écoulée ». Terminée : « Période d’essai terminée », « Terminée le {date}. Contactez le support pour choisir une offre. ». **L'essai n'a aucun effet** : sa fin ne bloque rien et aucun message ne l'annonce. Preuve : `M/20261103000006_lot6_pros_admin.sql:826`, `:793`, `:857`, `lib/partner/partner-dashboard.service.ts:579`, `:740`, `supabase/ops/schedule-crons.sql:98-105`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | cloche | indispensable | prochain passage de la file | titre « Période d'essai activée » ; modèle « Votre période d'essai de {days} jours commence aujourd'hui. » ; exemple « Votre période d'essai de 60 jours commence aujourd'hui. » |
| Mariama, si son adresse est vérifiée | email | indispensable | prochain passage de la file | objet « Période d'essai activée — Event Village » ; texte « Votre période d'essai de 60 jours commence aujourd'hui. », bouton vers `/partner/dashboard` |

Depuis le lot 9 bis, plus aucun SMS au démarrage de l'essai : la validation n'en envoie qu'un (étape 2.6). Preuve : `TRIAL_STARTED` (`lib/notifications/catalog.ts:1033-1038`, `app/api/partner/activation/route.ts:68`).

5. **Ce que les autres voient.** Les admins n'ont aucune vue dédiée à l'essai.
6. **Ce qui est impossible.** Changer d'offre en ligne : « Le changement d’offre se fait avec l’équipe Event Village : il n’est pas encore possible en ligne. ».
7. **Test et essai.** Test : `tests/parcours/messages-sms-9bis.test.ts` (un seul SMS à la validation, aucun au démarrage de l'essai) ; `tests/parcours/notif-pros.test.ts:762` « période d’essai : TRIAL_STARTED à la première activation seulement » ; `tests/parcours/partenaire-lot7.test.ts:254` « ${founder ? 'fondateur' : 'partenaire ordinaire'} : trial.days = ${days}, trial.ends_at = fin d’essai en base » ; `tests/parcours/partenaire-lot7.test.ts:280` « ${c.label} : trial_percent_used = ${c.expected} » ; `tests/parcours/statut-compte.test.ts:188` « activation d’essai d’un partenaire par un autre compte → refusée ». Essai : aucun, classé hors périmètre par la matrice de `docs/recette-billetterie.md`.

# Chapitre 3. Création de l'événement

### Étape 3.1 — Ouvrir le formulaire

1. **Qui, où, quel bouton.** Mariama, `/partner/events`, bouton « Créer un événement ». Page `/partner/events/new`, titre « Créer un événement », texte « L’événement est enregistré en brouillon. Vous le soumettrez à la validation depuis la liste de vos événements. ». Quatre étapes : « Informations », « Programme », « Accès », « Billets », avec « Étape {n} sur 4 : {titre} », exemple « Étape 1 sur 4 : Informations générales ». Retour : « Retour à mes événements ». Preuve : `app/partner/events/page.tsx:192-194`, `EventForm.tsx:650-655`, `:72-77`, `:764`.
2. **Ce qu'il saisit.** Aucun à ce stade. Boutons « Précédent », « Suivant », et « Enregistrer le brouillon » à la dernière étape seulement. « Suivant » contrôle les champs de l'étape courante. Preuve : `EventForm.tsx:557-570`, `:1077-1090`.
3. **Ce que fait le système.** Rien n'est enregistré. Sortie de page avec des saisies : alerte du navigateur. Preuve : `EventForm.tsx:466-475`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Rien à l'ouverture : un partenaire non validé remplit les 4 étapes et n'est refusé qu'à l'enregistrement (étape 3.6). Depuis le lot 9 bis, une partenaire en attente n'atteint plus cette page : l'espace partenaire la ramène à son tableau de bord (étape 2.4).
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:770` « un seul composant components/events/EventForm.tsx, rendu par la création et l’édition, sans copie locale du formulaire ». Essai : Essai 11 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.1.

### Étape 3.2 — Étape « Informations », champ par champ

1. **Qui, où, quel bouton.** Mariama, `/partner/events/new`, étape 1, bouton « Suivant ». Preuve : `EventForm.tsx:537`.
2. **Ce qu'il saisit.** Champ vide sans message propre : « Ce champ est obligatoire. ». Récapitulatif : « {champ} : {message} », exemple « Titre : Le titre compte au moins 3 caractères. ».

| Champ à l'écran | Obligatoire | Limites et aide | Erreurs citées |
|---|---|---|---|
| « Titre de l’événement » | oui | 3 à 120, exemple « Par exemple : Nuit du Mbalax » | « Le titre compte au moins 3 caractères. » ; « Le titre compte au plus 120 caractères. » ; « Le titre compte de 3 à 120 caractères. » |
| « Catégorie de l’événement » (« Concerts & Musique », « Festivals », « Gastronomie & Tables », « Salles & Réceptions ») | oui | liste | « Choisissez une catégorie d’événement dans la liste. » |
| « Description » | non | 5 000, « Présentez l’événement : artistes, ambiance, public attendu… » | « La description compte au plus 5 000 caractères. » |
| « Affiche de l’événement » | non pour un brouillon, oui pour soumettre | JPEG, PNG ou WebP, 5 Mo, « Choisir une image ou la déposer ici », « Remplacer l’image » | « Format non pris en charge : choisissez une image JPEG, PNG ou WebP. » ; « Image trop lourde : 5 Mo au plus. » ; « Le dépôt de l’image a échoué. Réessayez. » ; « Le fichier dépasse la taille maximale autorisée (5 Mo). » ; « L’affiche doit être déposée depuis le formulaire de l’événement (stockage Event Village). » |
| « Date de début » | oui | date future, heure de Dakar | « Date invalide (format AAAA-MM-JJ). » ; « Le début de l’événement doit être dans le futur (heure de Dakar). » |
| « Heure de début » | oui | HH:mm | « Heure invalide (format HH:mm). » |
| « Date de fin » | non | « Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain. » | « Indiquez la date de fin pour l’heure de fin saisie. » ; « La fin de l’événement doit être postérieure à son début. » |
| « Heure de fin » | non, exige la date de fin | « Facultative ; avec une heure de fin, la date de fin est demandée. » | mêmes textes que la date de fin |
| « Lieu » | oui | 2 à 200, « Par exemple : Grand Théâtre National » | « Le lieu compte au moins 2 caractères. » ; « Le lieu compte au plus 200 caractères. » |
| « Ville » | oui, préremplie « Dakar » | 2 à 80, texte libre | « La ville compte au moins 2 caractères. » ; « La ville compte au plus 80 caractères. » |
| « Capacité totale (jauge) » | non | entier de 1 à 100 000, « Facultative. La somme des quantités des catégories de billets ne peut pas la dépasser. » | « La jauge est un nombre entier. » ; « La jauge compte au moins 1 place. » ; « La jauge compte au plus 100 000 places. » ; depuis le lot 9 bis « La somme des quantités mises en vente des catégories actives ({somme}) dépasse la jauge ({jauge}). », exemple « La somme des quantités mises en vente des catégories actives (150) dépasse la jauge (100). » |

Preuve : `lib/validations/event.ts:179-213`, `:197-198`, `:367-385`, `:422-426`, `EventForm.tsx:828-909`, `ImageUpload.tsx:62-91`, `app/api/partner/upload/route.ts:41-67`.

3. **Ce que fait le système.** Rien en base à ce stade. Depuis le lot 9 bis, sans date de fin, la fin vaut le début plus 6 heures (avant : ce jour-là à 23:59) ; une date de fin sans heure vaut cette date à 23:59 ; tout est à l'heure de Dakar. Exemple : début samedi 14 novembre à 20:00 sans fin saisie, fin le dimanche 15 novembre à 02:00. Cette fin compte pour la vente, le contrôle à l'entrée (étape 10.1), le passage à « Terminé » (étape 16.1), la disponibilité des fonds et le droit de remboursement de la partenaire (étape 15.2). Preuve : `lib/events/event-end.ts:1-24`, `M/20261109000008_lot9bis_cycle.sql` (`event_end_from_v2`, `event_end_at`).
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Une date de début passée. Une affiche venant d'ailleurs que du dossier du partenaire. Preuve : `lib/validations/event.ts:161-166`.
7. **Test et essai.** Test : `tests/parcours/edition-validation.test.ts:343` « longueurs bornées : titre, description, lieu, ville, infos pratiques, catégorie de billet, programme » ; `tests/parcours/edition-validation.test.ts:373` « catégorie d’événement obligatoire, parmi CONCERT, FESTIVAL, FOOD et SALLE » ; `tests/parcours/edition-validation.test.ts:406` « dates : début obligatoire, end_date exigée si end_time, fin après le début, heures au format HH:mm » ; `tests/parcours/edition-validation.test.ts:424` « début dans le futur à la création (EVENT_START_PAST), calculé à Dakar quel que soit le fuseau du processus » ; `tests/parcours/edition-validation.test.ts:496` « affiche : stockage public-images du projet, dossier du partenaire, sinon IMAGE_ORIGIN_INVALID » ; `tests/parcours/edition-validation.test.ts:533` « POST : début passé → EVENT_START_PAST ; affiche externe → IMAGE_ORIGIN_INVALID ; aucun événement créé ». Essai : Essai 11 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.1.

### Étape 3.3 — Étape « Programme »

1. **Qui, où, quel bouton.** Mariama, étape 2, bouton « Ajouter une ligne », 50 lignes au plus. Texte : « Facultatif. Les lignes vides sont ignorées et le programme est trié par heure à l’enregistrement. ». Corbeille « Supprimer la ligne {n} du programme », exemple « Supprimer la ligne 1 du programme ». Preuve : `EventForm.tsx:916`, `:933`, `:977`.
2. **Ce qu'il saisit.** « Heure » (obligatoire) ; « Type », « Artiste », « Intervenant » ou « Activité » ; « Intitulé » (120) ; « Artiste ou intervenant » (120) ; « Jour », seulement sur plusieurs jours ; « Précisions » (500). Erreurs : « Heure invalide (format HH:mm). » ; « Choisissez le type de la ligne : artiste, intervenant ou activité. » ; « Indiquez le titre de la ligne. » ; « Le titre d’une ligne compte au plus 120 caractères. » ; « L’artiste ou l’intervenant compte au plus 120 caractères. » ; « La description d’une ligne compte au plus 500 caractères. ». Récapitulatif : « Programme, ligne {n} : {champ} : {message} », exemple « Programme, ligne 1 : Heure : Ce champ est obligatoire. ». Preuve : `lib/validations/event.ts:229-238`, `EventForm.tsx:337`, `:941-960`.
3. **Ce que fait le système.** Lignes vides retirées, tri par jour puis par heure, enregistré avec le brouillon. Preuve : `lib/validations/event.ts:257-280`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Après publication : section « Programme » sur la fiche, si elle a des lignes. Preuve : `app/events/[id]/page.tsx:839-840`.
6. **Ce qui est impossible.** Plus de 50 lignes : « Le programme compte au plus 50 lignes. ». Preuve : `lib/validations/event.ts:265`.
7. **Test et essai.** Test : `tests/parcours/edition-validation.test.ts:458` « programme typé : heure HH:mm, type ARTISTE, INTERVENANT ou ACTIVITE, identifiant uuid, au plus 50 lignes » ; `tests/parcours/edition-validation.test.ts:476` « programme : lignes vides retirées, tri par jour puis par heure ». Essai : Essai 11 de `docs/recette-billetterie.md`, aucune étape programme dans `docs/essai-local.md`.

### Étape 3.4 — Étape « Accès » (informations pratiques)

1. **Qui, où, quel bouton.** Mariama, étape 3, « Accès et informations pratiques », « Position sur la carte ». Preuve : `EventForm.tsx:75`, `:987`.
2. **Ce qu'il saisit.** Tout est facultatif. Carte, « Latitude », « Longitude ». Cinq champs de 300 caractères : « Adresse précise », « Téléphone de contact », « Stationnement », « Indications d’accès », « Règles à respecter ». Erreurs : « Coordonnées invalides : latitude entre -90 et 90, longitude entre -180 et 180. » ; « La latitude est comprise entre -90 et 90. » ; « La longitude est comprise entre -180 et 180. » ; « Chaque information pratique compte au plus 300 caractères. » ; « La localisation n’est pas disponible sur cet appareil : placez le repère sur la carte. » ; « Localisation refusée : autorisez-la dans le navigateur ou placez le repère sur la carte. ». Preuve : `components/ui/MapPicker.tsx:124-157`, `lib/validations/event.ts:193-196`, `:215-216`, `EventForm.tsx:997-1014`.
3. **Ce que fait le système.** Enregistré avec le brouillon. Le téléphone n'a aucun contrôle de format. Preuve : `lib/validations/event.ts:215`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Après publication : carte, « Voir l’itinéraire », « Accès et transports », « Stationnement », téléphone cliquable. Preuve : `app/events/[id]/page.tsx:864-900`.
6. **Ce qui est impossible.** Plus de 300 caractères.
7. **Test et essai.** Test : `tests/parcours/edition-validation.test.ts:381` « coordonnées : latitude de −90 à 90, longitude de −180 à 180 » ; `tests/parcours/edition-validation.test.ts:343` « longueurs bornées : titre, description, lieu, ville, infos pratiques, catégorie de billet, programme » ; `tests/parcours/edition-formulaire.test.ts:562` « champs libres d’un PUBLIÉ (description, programme, infos pratiques hors adresse, affiche, coordonnées) : appliqués sans notification ». Essai : Essai 11 de `docs/recette-billetterie.md`.

### Étape 3.5 — Étape « Billets » : catégories et canaux

1. **Qui, où, quel bouton.** Mariama, étape 4, bouton « Ajouter une catégorie », 50 au plus. Texte : « Ajoutez au moins une catégorie de billets pour pouvoir soumettre l’événement. Les catégories sont enregistrées avec le brouillon. ». Preuve : `EventForm.tsx:1028`, `:1069`.
2. **Ce qu'il saisit.**

| Champ | Obligatoire | Défaut, aide | Erreurs citées |
|---|---|---|---|
| « Nom de la catégorie » (60) | oui | « Par exemple : Standard, VIP, Étudiant » | « Indiquez le nom de la catégorie. » ; « Le nom d’une catégorie compte au plus 60 caractères. » ; « Deux catégories portent ce nom : chaque nom doit être unique. » |
| « Prix (F CFA) » | oui | « Montant entier ; 0 pour une entrée gratuite. » | « Le prix est un montant entier en francs CFA. » ; « Le prix ne peut pas être négatif. » ; « Le prix ne dépasse pas 10 000 000 F CFA. » ; depuis le lot 9 bis, à l'enregistrement, « Le prix d’un billet payant est d’au moins {minimum} F CFA. Pour un billet gratuit, indiquez 0. », exemple « Le prix d’un billet payant est d’au moins 100 F CFA. Pour un billet gratuit, indiquez 0. » (minimum réglé par le SUPERADMIN, 100 F par défaut, étape 18.4) |
| « Quantité mise en vente » | oui | « Nombre de billets de cette catégorie (1 à 100 000). » | depuis le lot 9 bis « La quantité mise en vente est un nombre entier de billets. » ; « La quantité mise en vente compte au moins 1 billet. » ; « La quantité mise en vente compte au plus 100 000 billets. » |
| « Maximum de billets par commande » | non, défaut 10 | « De 1 à 50 billets. » | « Le maximum par commande est un nombre entier. » ; « Le maximum par commande est d’au moins 1 billet. » ; « Le maximum par commande est de 50 billets au plus. » |
| « Début de la vente » | non | « Heure de Dakar. Vide : en vente dès la publication. » | « Date de vente invalide (format AAAA-MM-JJ HH:mm, heure de Dakar). » ; « Le début de vente doit précéder la fin de l’événement. » |
| « Fin de la vente » | non | « Heure de Dakar. Au plus tard à la fin de l’événement. » | « La fin de vente doit être postérieure au début de vente. » ; « La fin de vente ne peut pas dépasser la fin de l’événement. » |
| « Détail affiché aux acheteurs » (300) | non | « Par exemple : accès à la zone devant la scène » | « La description d’une catégorie compte au plus 300 caractères. » |
| « Vendue en ligne » | non, cochée | « Affichée sur la page de l’événement et achetable sur le site. » | Aucun. |
| « Vendue au guichet » | non, cochée | « Proposée au contrôleur et vendue en espèces à l’entrée. » | Aucun. |
| « Catégorie active » | non, cochée | | Aucun. |

Le résultat des deux cases s'affiche : « En ligne et au guichet », « En ligne uniquement », « Sur place uniquement », « Invitations seulement ». Sans canal, avertissement : « Cette catégorie n’est vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage. ». Les invitations n'ont pas de case. Récapitulatif : « Catégorie {n} : {champ} : {message} », exemple « Catégorie 1 : Prix (F CFA) : Ce champ est obligatoire. ». Preuve : `components/events/EventTicketing.tsx:202-343`, `lib/validations/event.ts:283-316`, `lib/events/category-channels.ts:8-11`, `:19`, `EventForm.tsx:341`, `lib/events/event.service.ts:128-138`.

3. **Ce que fait le système.** Catégories enregistrées avec le brouillon, tout ou rien. La somme des quantités actives est comparée à la jauge. Depuis le lot 9 bis, une catégorie payante sous le prix minimum est refusée par la base, à la création comme à chaque changement de prix ; un changement qui ne touche pas au prix reste accepté. Preuve : `lib/validations/event.ts:422-426`, `M/20261109000005_lot9bis_samirpay.sql:233-260`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Le public ne verra que les catégories actives et vendues en ligne. Preuve : `app/api/events/[id]/route.ts:116`.
6. **Ce qui est impossible.** Deux noms identiques, majuscules comprises : « Deux catégories portent le nom « {nom} » : chaque nom doit être unique. », exemple « Deux catégories portent le nom « VIP » : chaque nom doit être unique. ». Plus de 50 : « Un événement compte au plus 50 catégories de billets. ». Preuve : `lib/validations/event.ts:406`, `:414-420`, `M/20261106000001_lot8_canaux.sql:786-787`.
7. **Test et essai.** Test : `tests/parcours/canaux-interface.test.ts:137` « categoryChannelLabel : les quatre cas, exactement » ; `tests/parcours/canaux-interface.test.ts:163` « création : sale_online et sale_counter acceptés, catégorie sans canal permise » ; `tests/parcours/canaux-interface.test.ts:205` « deux cases cochables, chacune avec son aide reliée par aria-describedby en text-sm » ; `tests/parcours/canaux-interface.test.ts:230` « résumé sous les cases sur les quatre cas ; aide de `none` affichée seulement sans canal » ; `tests/parcours/edition-validation.test.ts:389` « montants et quantités entiers et bornés (prix 1500,5 refusé) » ; `tests/parcours/edition-validation.test.ts:444` « dates de vente : début < fin ≤ fin de l’événement (datetime-local de Dakar) » ; `tests/parcours/paiement-prix-minimum.test.ts:85` « 1. catégorie payante à 50 F → 400 PRICE_BELOW_MINIMUM (100 F par défaut), rien de créé » ; `tests/parcours/paiement-prix-minimum.test.ts:92` « 2. 0 F (gratuit) et 100 F tout juste → acceptés ». Essai : Essais 11, 21 et 61 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.1.

### Étape 3.6 — Enregistrer le brouillon

1. **Qui, où, quel bouton.** Mariama, étape « Billets », bouton « Enregistrer le brouillon ». Preuve : `EventForm.tsx:1088`.
2. **Ce qu'il saisit.** Tout le formulaire est contrôlé. Un brouillon exige titre, catégorie d'événement, date et heure de début futures, lieu et ville ; pas d'affiche ni de catégorie de billets. Bandeau « Le formulaire contient {n} points à corriger », exemple « Le formulaire contient 2 points à corriger », ou « Le formulaire contient un point à corriger », sinon « Enregistrement impossible ». Réseau : « Connexion impossible : rien n’a été enregistré. Vérifiez votre réseau, puis réessayez. ». Preuve : `EventForm.tsx:89`, `:583`, `:798-799`.
3. **Ce que fait le système.** L'événement est créé avec le statut « Brouillon », avec ses catégories. Message « Brouillon enregistré. Soumettez-le à la validation depuis la liste de vos événements. », retour à `/partner/events`. Invisible du public : sa fiche répond 404. Preuve : `app/api/partner/events/route.ts:67-90`, `M/20261102000003_lot5_cycle.sql:254-286`, `M/20261106000001_lot8_canaux.sql:810`, `:820`, `EventForm.tsx:607-608`, `app/api/events/[id]/route.ts:93`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aïda : onglet « Brouillon » de `/admin/events`, « Jamais soumis ». Mariama : carte avec « Soumettre à la validation », « Modifier », « Supprimer le brouillon ». Preuve : `app/admin/events/page.tsx:241`, `components/partner/events-list/PartnerEventCard.tsx:114-152`.
6. **Ce qui est impossible.** « Seul un organisateur peut créer un événement. » ; « Seul un organisateur disposant d’un profil partenaire peut créer un événement. » ; « Votre profil d’organisateur doit être validé avant de créer un événement. », depuis le lot 9 bis pour tout dossier qui n'est pas validé, en attente compris ; « Votre compte n'est pas actif. » ; « L’enregistrement a été refusé. » ; « Création de l’événement impossible pour le moment. ». Aucune limite liée à l'abonnement ou à la période d'essai. Preuve : `app/api/partner/events/route.ts:87-92`, `lib/events/event.service.ts:72`, `M/20261109000008_lot9bis_cycle.sql:547`, `EventForm.tsx:611`.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:378` « événement BROUILLON et ses catégories créés ensemble, champs appliqués, historique NULL → BROUILLON (CREATION) » ; `tests/parcours/edition-formulaire.test.ts:408` « tout ou rien : deux catégories au même nom (casse différente) → refus, ni événement ni catégorie créés » ; `tests/parcours/edition-formulaire.test.ts:439` « compte sans rôle partenaire → 403, aucun événement (garde-fou) » ; `tests/parcours/edition-services.test.ts:195` « services forcé à { ticketing: true, tableBooking: false, communication: false } quand le corps n’en a pas » ; `tests/parcours/cycle-transitions.test.ts:557` « INSERT forcé à BROUILLON, avec la seule ligne NULL → BROUILLON (canal CREATION) » ; `e2e/recette.spec.ts:323` « acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 ». Essai : Essai 11 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.1.

### Étape 3.7 — Modifier un brouillon

1. **Qui, où, quel bouton.** Mariama, carte, bouton « Modifier », page `/partner/events/{id}/edit`, titre « Modifier l’événement », bouton « Enregistrer les modifications » à chaque étape. Preuve : `components/partner/events-list/PartnerEventCard.tsx:132-135`, `EventForm.tsx:652`, `:1086-1088`.
2. **Ce qu'il saisit.** Les mêmes champs et messages qu'aux étapes 3.2 à 3.5. Rien de changé : « Aucune modification à enregistrer. ». Les catégories s'enregistrent une par une (étape 5.8). Preuve : `EventForm.tsx:248-255`, `:587`.
3. **Ce que fait le système.** L'événement reste « Brouillon ». Message « Modifications enregistrées. » et bandeau « Aucun détenteur de billets n’était à prévenir. ». Preuve : `EventForm.tsx:629`, `:746`, `M/20261108000001_lot9_securite.sql:496`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Preuve : `M/20261108000001_lot9_securite.sql:248`.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Voir l'étape 5.1.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:639` « EN_ATTENTE → 409 WITHDRAW_TO_EDIT ; après retrait en BROUILLON, la modification passe » ; `tests/parcours/edition-formulaire.test.ts:688` « EDIT_CONFLICT : expected_updated_at périmé → 409, la première modification reste ». Essai : Essai 13 de `docs/recette-billetterie.md`, sans section dans `docs/essai-local.md`.

### Étape 3.8 — Supprimer un brouillon

1. **Qui, où, quel bouton.** Mariama, carte, « Supprimer le brouillon ». Fenêtre « Supprimer ce brouillon ? », « « {titre} » et ses catégories de billets seront supprimés définitivement. », exemple « « Gala de la Teranga » et ses catégories de billets seront supprimés définitivement. ». Preuve : `components/partner/events-list/PartnerEventCard.tsx:142-146`, `app/partner/events/page.tsx:345-347`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Suppression, avec catégories et historique. Message « Brouillon supprimé. ». Preuve : `app/partner/events/page.tsx:173`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** La fiche admin ouverte affiche « Cet événement n’existe pas ou a été supprimé ». Preuve : `app/admin/events/[id]/page.tsx:438`.
6. **Ce qui est impossible.** Supprimer un brouillon déjà soumis, refusé ou retiré. Depuis le lot 9 bis, le bouton « Supprimer le brouillon » n'est affiché que si la suppression est possible (le serveur le dit pour chaque carte) ; un appel direct reste refusé : « Ce brouillon a déjà été soumis : son historique est conservé, il ne peut pas être supprimé. ». Preuve : `components/partner/events-list/PartnerEventCard.tsx:147-152`. Hors brouillon : « Un événement sorti du brouillon ne peut pas être supprimé : annulez-le ou laissez-le se terminer. ». Preuve : `M/20261103000001_lot6_dette.sql:214-221`.
7. **Test et essai.** Test : `tests/parcours/textes-base-9bis.test.ts` (`can_delete` : vrai pour un brouillon neuf, faux après une soumission puis un refus) ; `tests/parcours/cycle-transitions.test.ts:612` « suppression d’un brouillon : l’historique part en cascade ». Essai : aucun.

### Étape 3.9 — Soumettre à la validation

1. **Qui, où, quel bouton.** Mariama, bouton « Soumettre à la validation » sur la carte ou le pilotage, sans confirmation. Preuve : `M/20261102000003_lot5_cycle.sql:50`, `app/partner/events/page.tsx:154-166`.
2. **Ce qu'il saisit.** Aucun. Une affiche et au moins une catégorie active sont exigées. Depuis le lot 9 bis, les dates sont aussi contrôlées : un début déjà passé, ou une catégorie dont la période de vente dépasse la fin de l'événement, empêchent la soumission. Preuve : `M/20261109000008_lot9bis_cycle.sql:310-335`.
3. **Ce que fait le système.** « Brouillon » devient « En attente de validation ». Message sur la liste : « Événement soumis : l’équipe Event Village va vérifier la fiche. ». Sur le pilotage : « Statut de l’événement mis à jour. ». La modification se ferme. Toujours invisible du public. Preuve : `app/partner/events/page.tsx:63`, `app/partner/events/[id]/page.tsx:102`, `M/20261102000006_lot5_temps_reel.sql:454`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `events.read` | cloche | indispensable | prochain passage de la file | titre « Événement à valider » ; modèle « « {title} » de {company} attend votre validation. » ; exemple « « Gala de la Teranga » de Sabar Events attend votre validation. » |
| Aïda et les admins avec `events.read` | push | indispensable | prochain passage de la file | titre « Événement à valider » ; modèle « « {title} » de {company} attend votre validation. » ; exemple « « Gala de la Teranga » de Sabar Events attend votre validation. » |
| Aïda et les admins avec `events.read` | email | indispensable | prochain passage de la file | objet « Événement à valider — Event Village » ; modèle : Événement à valider<br>« {title} » de {company} attend votre validation.<br>Ouvrir Event Village : {APP_URL}/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Événement à valider<br>« Gala de la Teranga » de Sabar Events attend votre validation.<br>Ouvrir Event Village : https://eventvillage.sn/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

| Mariama | cloche, email | indispensable | prochain passage de la file | titre « Événement envoyé en validation » ; modèle « « {title} » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision. » ; exemple « « Gala de la Teranga » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision. » ; email : objet « Événement envoyé en validation — Event Village », si son adresse est vérifiée |

Depuis le lot 9 bis, Mariama reçoit cet accusé. Preuve : `ADMIN_EVENT_SUBMITTED` (`M/20261103000005_lot6_billetterie.sql:1233-1236`), `EVENT_SUBMITTED_ACK` (`lib/notifications/catalog.ts:1591-1600`).

5. **Ce que les autres voient.** Aïda : `/admin/events`, onglet « En attente de validation », mis à jour en direct. Mariama : carte avec « Retirer de la validation » seul, bandeau d'édition « Événement en cours de validation ». Preuve : `app/admin/events/page.tsx:170-171`, `EventForm.tsx:702`, `:706`.
6. **Ce qui est impossible.** Soumettre un événement incomplet. Depuis le lot 9 bis, le refus dit ce qui manque : le message commence par « L’événement est incomplet : » suivi des manques, parmi « Ajoutez une affiche à l'événement. », « Ajoutez au moins une catégorie de billets active. », « La date de début est passée : changez-la avant de soumettre. », « La période de vente de « {nom} » dépasse la fin de l’événement. ». La liste s'ouvre dans la fenêtre « Soumission impossible : il manque des informations », « Corrigez ces points, puis soumettez de nouveau l’événement : », avec le bouton « Compléter l’événement ». Soumettre sans dossier validé : « Votre profil d’organisateur doit être validé avant de soumettre ou de publier un événement. ». « Votre compte n'est pas actif. ». Preuve : `M/20261109000008_lot9bis_cycle.sql:305-335`, `app/partner/events/page.tsx:151-155`, `:352-375`.
7. **Test et essai.** Test : `tests/parcours/cycle9bis-soumission-fiche.test.ts:98` « brouillon sans affiche : le message lui-même contient « Ajoutez une affiche » (RPC et route partenaire) » ; `tests/parcours/cycle9bis-soumission-fiche.test.ts:109` « brouillon au début passé → SUBMIT_INCOMPLETE, manque start_date » ; `tests/parcours/cycle9bis-soumission-fiche.test.ts:117` « catégorie dont la fin de vente dépasse la fin de l’événement : manque à la soumission » ; `tests/parcours/messages-changement-9bis.test.ts:298` « soumission (BROUILLON → EN_ATTENTE) : EVENT_SUBMITTED_ACK en in-app à la propriétaire » ; `tests/parcours/cycle-transitions.test.ts:442` « SUBMIT_INCOMPLETE : soumission sans affiche, sans catégorie active, ou sans rien (liste des manques) » ; `tests/parcours/cycle-transitions.test.ts:390` « route partenaire : la soumission passe et journalise le compte de la session » ; `tests/parcours/notif-admins.test.ts:195` « événement soumis : ADMIN_EVENT_SUBMITTED (in-app, push, email) aux admins events.read et au SUPERADMIN, sans SMS ». Essai : Essais 12 et 13 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.1.

### Étape 3.10 — Retirer de la validation

1. **Qui, où, quel bouton.** Mariama, bouton « Retirer de la validation ». Preuve : `M/20261102000003_lot5_cycle.sql:51`.
2. **Ce qu'il saisit.** Aucun, pas de motif.
3. **Ce que fait le système.** L'événement revient à « Brouillon ». Message « Événement retiré de la validation : vous pouvez de nouveau le modifier. ». Preuve : `app/partner/events/page.tsx:65`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Preuve : `M/20261103000005_lot6_billetterie.sql:1238`.

5. **Ce que les autres voient.** La liste des admins se met à jour en direct, sans alerte : ce retrait reste sans avis aux admins après le lot 9 bis (partie de R95 renvoyée).
6. **Ce qui est impossible.** Supprimer ce brouillon ensuite (étape 3.8).
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:639` « EN_ATTENTE → 409 WITHDRAW_TO_EDIT ; après retrait en BROUILLON, la modification passe » ; `tests/parcours/admin-evenements.test.ts:638` « partenaire propriétaire : soumettre, retirer, publier selon le statut ; can_edit et can_cancel » ; `tests/parcours/admin-evenements.test.ts:672` « refus : motif dans l’historique et la fiche admin, rendu au propriétaire (pas au tiers), plus rendu après resoumission ou retrait ; le dernier refus fait foi ». Essai : aucun.

# Chapitre 4. Validation par l'admin et publication

### Étape 4.1 — La file de validation

1. **Qui, où, quel bouton.** Aïda, ou Moussa avec `events.read`. `/admin/events`, onglet par défaut « En attente de validation », bouton « Examiner », sur mobile « Examiner la fiche ». Recherche « Rechercher par titre ». Preuve : `app/admin/events/page.tsx:40-42`, `:249`, `:289`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Lecture, 20 par page. Liste vide : « Aucun événement à valider », « Les nouvelles soumissions des organisateurs apparaissent ici en direct. ». Preuve : `app/admin/events/page.tsx:310-311`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

L'alerte a été reçue à la soumission (étape 3.9).

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Sans `events.read`, depuis le lot 9 bis : « Action non autorisée : votre compte n’a pas la permission « Consulter les événements ». ». Preuve : `lib/admin/admin-auth.ts:70-74`, `lib/admin/permission-labels.ts:33-35`.
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:346` « filtre par statut (les 7, ANNULE compris) avec q : exactement les événements de ce statut, total = vérité en base » ; `tests/parcours/admin-evenements.test.ts:419` « droits : sans session 401 ; CLIENT, partenaire et ADMIN sans events.read 403 ; ADMIN events.read et SUPERADMIN 200 ». Essai : Essai 12 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.2.

### Étape 4.2 — Examiner la fiche

1. **Qui, où, quel bouton.** Aïda ou Moussa, `/admin/events/{id}`. Sections « Dates et lieu », « Description », « Programme », « Catégories et prix », « Affiche », « Organisateur », « Historique des statuts ». Preuve : `app/admin/events/[id]/page.tsx:582-705`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Lecture, avec `events.read`. Depuis le lot 9 bis, les boutons d'action (valider, refuser, publier, suspendre, réactiver, terminer, annuler) ne sont servis et affichés qu'avec la permission `events.write`. Un bouton « Ouvrir le pilotage » mène au pilotage de l'organisatrice (`/partner/events/{id}`), lisible avec `events.read`. Preuve : `M/20261109000008_lot9bis_cycle.sql:364-400`, `app/admin/events/[id]/page.tsx:323-324`, `:545-556`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Modifier la fiche : « Seul l’organisateur modifie son événement ; l’administration agit par les changements de statut. ». Depuis le lot 9 bis, Moussa sans `events.write` ne voit aucun bouton d'action ; un appel direct reçoit « Action non autorisée : votre compte n’a pas la permission « Gérer les événements ». ». Preuve : `lib/events/event.service.ts:220`, `app/admin/events/[id]/page.tsx:545`, `lib/admin/permission-labels.ts:33-35`.
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:464` « affiche, dates, lieu, programme, catégories et prix (masquées et inactives comprises), organisateur et contact, historique, actions » ; `tests/parcours/admin-evenements.test.ts:506` « événement inconnu → 404 ; droits : 401 sans session, 403 CLIENT, partenaire propriétaire et ADMIN sans events.read » ; `tests/parcours/admin-evenements.test.ts:590` « ADMIN avec events.read seul : 403 sur /transition, statut inchangé, aucune ligne d’historique » ; `tests/parcours/admin-evenements.test.ts:644` « admin (SUPERADMIN et ADMIN) : valider, refuser, publier, suspendre, terminer, réactiver ; jamais can_edit » ; `tests/parcours/droits-boutons-9bis.test.ts` (boutons masqués sans permission, refus en français). Essai : Essais 12 et 53 de `docs/recette-billetterie.md`.

### Étape 4.3 — Valider

1. **Qui, où, quel bouton.** Aïda, ou Moussa avec `events.write`. Fiche, bouton « Valider ». Fenêtre « Valider l’événement ? », « L’organisateur est prévenu et pourra publier l’événement. La fiche ne repasse pas en validation. », boutons « Annuler », « Valider ». Preuve : `app/admin/events/[id]/page.tsx:180-186`, `:746-756`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** « En attente de validation » devient « Validé », sans motif. Message « Événement validé : l’organisateur peut maintenant le publier. ». Toujours invisible du public. Preuve : `M/20261103000005_lot6_billetterie.sql:1246-1250`, `app/api/admin/events/[id]/transition/route.ts:25`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre événement {title} est validé. Publiez-le depuis votre espace : {APP_URL}/partner/events » ; exemple « Event Village : votre événement Gala de la Teranga est validé. Publiez-le depuis votre espace : https://eventvillage.sn/partner/events » (134 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Événement validé » ; modèle « « {title} » est validé. Vous pouvez le publier depuis votre espace. » ; exemple « « Gala de la Teranga » est validé. Vous pouvez le publier depuis votre espace. » |
| Mariama | push | indispensable | prochain passage de la file | titre « Événement validé » ; modèle « « {title} » est validé. Vous pouvez le publier depuis votre espace. » ; exemple « « Gala de la Teranga » est validé. Vous pouvez le publier depuis votre espace. » |
| Mariama | email | indispensable | prochain passage de la file | objet « Événement validé — Event Village » ; modèle : Événement validé<br>« {title} » est validé. Vous pouvez le publier depuis votre espace.<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Événement validé<br>« Gala de la Teranga » est validé. Vous pouvez le publier depuis votre espace.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Preuve : `EVENT_VALIDATED` (`M/20261103000005_lot6_billetterie.sql:1246-1250`).

5. **Ce que les autres voient.** Mariama : badge « Validé », boutons « Publier », « Piloter », « Modifier », « Annuler l’événement », mis à jour en direct. Onglet « Validé » : « Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier. ». Preuve : `app/partner/events/page.tsx:126-130`.
6. **Ce qui est impossible.** Valider un événement qui n'est pas en attente : « Un événement « {statut} » ne peut pas passer à « {statut} ». », exemple « Un événement « Publié » ne peut pas passer à « Validé ». ». Preuve : `M/20261103000005_lot6_billetterie.sql:1016`.
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:530` « valider : EN_ATTENTE → VALIDE, journalisé (ADMIN, acteur, canal TRANSITION) » ; `tests/parcours/notif-pros.test.ts:270` « refus par l’admin avec motif puis validation : EVENT_REJECTED et EVENT_VALIDATED, quatre canaux, SMS exacts » ; `tests/parcours/cycle-transitions.test.ts:624` « refus avec motif, validation, suspension avec motif : acteur de la session journalisé, partenaire notifié ». Essai : Essai 13 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.2.

### Étape 4.4 — Refuser avec motif

1. **Qui, où, quel bouton.** Aïda, fiche, bouton « Refuser ». Fenêtre « Refuser l’événement », « L’événement revient en brouillon chez l’organisateur, qui voit votre motif sur sa fiche et peut le soumettre de nouveau. », champ « Motif du refus », aide « Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique. ». Preuve : `app/admin/events/[id]/page.tsx:187-193`, `:770-783`.
2. **Ce qu'il saisit.** Le motif, 3 à 500 caractères. Erreurs : « Le motif doit contenir au moins 3 caractères. » ; « Un motif d'au moins 3 caractères est obligatoire. ». Preuve : `components/ui/ReasonDialog.tsx:51`, `:65`, `M/20261103000005_lot6_billetterie.sql:1021`.
3. **Ce que fait le système.** L'événement revient à « Brouillon », motif dans l'historique. Message « Refus envoyé : l’organisateur voit votre motif. ».
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : événement {title} non validé. Motif : {reason} {APP_URL}/partner/events » ; exemple « Event Village : événement Gala de la Teranga non validé. Motif : Affiche illisible, merci d'en déposer... https://eventvillage.sn/partner/events » (144 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Événement non validé » ; modèle « « {title} » n'est pas validé. Motif : {reason} » ; exemple « « Gala de la Teranga » n'est pas validé. Motif : Affiche illisible, merci d’en déposer une nouvelle. » |
| Mariama | push | indispensable | prochain passage de la file | titre « Événement non validé » ; modèle « « {title} » n'est pas validé. Motif : {reason} » ; exemple « « Gala de la Teranga » n'est pas validé. Motif : Affiche illisible, merci d’en déposer une nouvelle. » |
| Mariama | email | indispensable | prochain passage de la file | objet « Événement non validé — Event Village » ; modèle : Événement non validé<br>« {title} » n'est pas validé. Motif : {reason}<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Événement non validé<br>« Gala de la Teranga » n'est pas validé. Motif : Affiche illisible, merci d’en déposer une nouvelle.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Preuve : `EVENT_REJECTED` (`M/20261103000005_lot6_billetterie.sql:1238-1243`, `M/20261102000003_lot5_cycle.sql:52`).

5. **Ce que les autres voient.** Mariama : carte et pilotage avec bandeau « Refusé par l’équipe Event Village », le motif, « Le {date} », exemple « Le 3 novembre 2026 ». Aïda : bandeau « Motif du refus », « Communiqué à l’organisateur le {date}. ». Preuve : `components/partner/events-list/PartnerEventCard.tsx:99-111`, `app/partner/events/[id]/page.tsx:226-238`, `app/admin/events/[id]/page.tsx:553-563`.
6. **Ce qui est impossible.** Refuser sans motif. Supprimer ce brouillon ensuite (étape 3.8).
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:538` « refuser : motif obligatoire (absent, vide ou < 3 caractères → REASON_REQUIRED, statut inchangé), puis refus motivé → BROUILLON » ; `tests/parcours/admin-evenements.test.ts:672` « refus : motif dans l’historique et la fiche admin, rendu au propriétaire (pas au tiers), plus rendu après resoumission ou retrait ; le dernier refus fait foi » ; `tests/parcours/cycle-transitions.test.ts:424` « motif obligatoire (REASON_REQUIRED) pour le refus admin et la suspension ; le retrait par le partenaire s’en passe » ; `tests/parcours/notif-pros.test.ts:270` « refus par l’admin avec motif puis validation : EVENT_REJECTED et EVENT_VALIDATED, quatre canaux, SMS exacts ». Essai : Essai 12 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.2.

### Étape 4.5 — La partenaire corrige et soumet de nouveau

1. **Qui, où, quel bouton.** Mariama, « Modifier », puis « Soumettre à la validation ».
2. **Ce qu'il saisit.** Comme à l'étape 3.7.
3. **Ce que fait le système.** Retour à « En attente de validation », nouvelle ligne d'historique, le bandeau de refus disparaît. Preuve : `M/20261102000003_lot5_cycle.sql:482-547`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `events.read` | cloche | indispensable | prochain passage de la file | titre « Événement à valider » ; modèle « « {title} » de {company} attend votre validation. » ; exemple « « Gala de la Teranga » de Sabar Events attend votre validation. » |
| Aïda et les admins avec `events.read` | push | indispensable | prochain passage de la file | titre « Événement à valider » ; modèle « « {title} » de {company} attend votre validation. » ; exemple « « Gala de la Teranga » de Sabar Events attend votre validation. » |
| Aïda et les admins avec `events.read` | email | indispensable | prochain passage de la file | objet « Événement à valider — Event Village » ; contenu cité intégralement à l’étape 3.9 |

Preuve : `ADMIN_EVENT_SUBMITTED` (`M/20261103000005_lot6_billetterie.sql:1233-1236`).

5. **Ce que les autres voient.** L'événement revient dans la file des admins.
6. **Ce qui est impossible.** Comme à l'étape 3.9.
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:672` « refus : motif dans l’historique et la fiche admin, rendu au propriétaire (pas au tiers), plus rendu après resoumission ou retrait ; le dernier refus fait foi ». Essai : Essai 13 de `docs/recette-billetterie.md`.

### Étape 4.6 — Publier, par la partenaire

1. **Qui, où, quel bouton.** Mariama, événement « Validé », bouton « Publier » sur la carte ou le pilotage. Fenêtre « Publier l’événement ? », « La page publique sera visible de tous et la billetterie ouverte selon les dates de vente de chaque catégorie. Après la publication, les changements de date, de lieu ou de titre seront notifiés aux acheteurs. », boutons « Pas maintenant », « Publier ». Preuve : `app/partner/events/page.tsx:296-322`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** « Validé » devient « Publié ». Message « Événement publié : la page publique est en ligne et la billetterie est ouverte. ». Preuve : `app/partner/events/page.tsx:64`, `M/20261106000001_lot8_canaux.sql:1117`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message, à personne. Preuve : `M/20261103000005_lot6_billetterie.sql:1253`.

5. **Ce que les autres voient.** Public : étape 4.8. Aïda : onglet « Publié ».
6. **Ce qui est impossible.** Publier après la fin : « La fin de cet événement est passée : il ne peut plus être publié. ». Mariama ne peut pas suspendre ni terminer : « Votre rôle ne permet pas de passer cet événement de « Publié » à « Suspendu ». ». Depuis le lot 9 bis : publier sans dossier validé, « Votre profil d’organisateur doit être validé avant de soumettre ou de publier un événement. » ; publier l'événement d'une partenaire suspendue, « Le partenaire est suspendu : son événement ne peut pas être remis en ligne avant sa réactivation. ». Preuve : `M/20261103000005_lot6_billetterie.sql:1014`, `:1037`, `M/20261109000008_lot9bis_cycle.sql:298-309`.
7. **Test et essai.** Test : `tests/parcours/cycle-transitions.test.ts:467` « publication d’un événement dont la fin est passée → EVENT_ENDED (fin renseignée, ou début la veille sans fin) » ; `tests/parcours/cycle-transitions.test.ts:375` « partenaire qui tente VALIDE ou SUSPENDU (et TERMINE) → refusé par la RPC (TRANSITION_NOT_ALLOWED) et par sa route (403) » ; `tests/parcours/notif-pros.test.ts:299` « publication par l’admin : EVENT_PUBLISHED_BY_ADMIN (in-app et push, sans SMS) ; publication par le partenaire : rien » ; `tests/parcours/temps-reel-public.test.ts:149` « VALIDE → PUBLIE : anon abonné à public_event_state reçoit la ligne (prix « à partir de » des seules catégories actives et visibles) et le catalogue rechargé contient l’événement ». Essai : Essai 13 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.2.

### Étape 4.7 — Publier, par l'admin

1. **Qui, où, quel bouton.** Aïda, événement « Validé », bouton « Publier ». Fenêtre « Publier l’événement ? », « La page publique devient visible de tous et la billetterie s’ouvre selon les dates de vente. ». Preuve : `app/admin/events/[id]/page.tsx:209-214`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** « Validé » devient « Publié ». Message « Événement publié. ».
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | cloche | indispensable | prochain passage de la file | titre « Événement publié » ; modèle « « {title} » a été publié par l'administration. » ; exemple « « Gala de la Teranga » a été publié par l'administration. » |
| Mariama | push | indispensable | prochain passage de la file | titre « Événement publié » ; modèle « « {title} » a été publié par l'administration. » ; exemple « « Gala de la Teranga » a été publié par l'administration. » |
| Mariama, si son adresse est vérifiée | email | indispensable | prochain passage de la file | objet « Événement publié — Event Village » ; texte « « Gala de la Teranga » a été publié par l'administration. » |

Depuis le lot 9 bis, ce message part aussi par email. Preuve : `EVENT_PUBLISHED_BY_ADMIN` (`M/20261103000005_lot6_billetterie.sql:1253-1257`, `lib/notifications/catalog.ts:912-917`).

5. **Ce que les autres voient.** Comme à l'étape 4.6.
6. **Ce qui est impossible.** Comme à l'étape 4.6, y compris, depuis le lot 9 bis, pour un admin : l'événement d'une partenaire suspendue ne se publie pas avant sa réactivation. Il faut la permission `events.write`.
7. **Test et essai.** Test : `tests/parcours/cycle-transitions.test.ts:314` « VALIDE → PUBLIE par un admin : permis et journalisé ADMIN » ; `tests/parcours/notif-pros.test.ts:299` « publication par l’admin : EVENT_PUBLISHED_BY_ADMIN (in-app et push, sans SMS) ; publication par le partenaire : rien ». Essai : aucun.

### Étape 4.8 — Ce qui apparaît sur l'accueil, dans Explorer et sur la fiche

1. **Qui, où, quel bouton.** Le visiteur, `/` et `/explore`, puis `/events/{id}`.
2. **Ce qu'il saisit.** Dans Explorer : recherche, « Ville », « Trier par », catégories d'événement.
3. **Ce que fait le système.** Seuls les événements « Publié » dont la fin est à venir s'affichent, triés par date. Accueil : section « À l’affiche », 8 premiers. Explorer : tous. Apparition au rechargement, ou d'elle-même si la page est ouverte. Carte, depuis le lot 9 bis : « À partir de {prix} F CFA », le plus bas prix des seules catégories achetables en ce moment (actives, vendues en ligne, non épuisées, vente ouverte), « Gratuit » pour 0 F. Sans catégorie achetable, une seule ligne qui dit l'état de la vente : « Bientôt en vente » (une vente en ligne va ouvrir), « Vente sur place uniquement » (catégories au guichet seulement), « Vente en ligne terminée », ou « Complet ». La fiche donne la date et l'heure de début et, depuis le lot 9 bis, la fin quand elle est saisie, par exemple « Jusqu’au dimanche 15 novembre à 02:00 ». Mentions : « Complet », « Vente à partir du {date} », « Vente terminée », « Plus que {n} places », exemple « Plus que 3 places ». Section « Billetterie » sans catégorie en vente, depuis le lot 9 bis : « La vente en ligne est terminée pour cet événement. » ; « Toutes les places sont vendues ou en cours de paiement. Des places peuvent se libérer : cette page se met à jour d’elle-même. » quand des paiements en cours retiennent des places ; « Toutes les places ont été vendues. » ; sinon « Aucune catégorie n’est en vente pour le moment. Revenez bientôt : cette page se met à jour d’elle-même. ». La recherche et le filtre « Ville » ignorent les accents et les majuscules : « thies » trouve « Thiès », et « Thiès » et « THIES » ne font qu'une ville dans la liste. Preuve : `app/api/events/route.ts:40`, `:47`, `:68`, `lib/events/catalog.server.ts:99-113`, `:138`, `components/events/EventCard.tsx`, `app/events/[id]/page.tsx:161-174`, `:905-906`, `:1150-1160`, `app/explore/page.tsx:159`, `lib/text/fold.ts`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucune annonce d'un nouvel événement n'est envoyée aux clients.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Voir un événement « Brouillon », « En attente de validation » ou « Validé » : « Événement introuvable. ». Preuve : `app/api/events/[id]/route.ts:33`, `:93`.
7. **Test et essai.** Test : `tests/parcours/cycle9bis-soumission-fiche.test.ts:170` « événement de deux jours : endFormatted « jusqu’au … » ; sans fin saisie : rien » ; `tests/parcours/cycle9bis-soumission-fiche.test.ts:188` « catégorie vendue au guichet seulement → saleLabel « Vente sur place uniquement » » ; `tests/parcours/cycle9bis-soumission-fiche.test.ts:197` « catégorie en ligne épuisée à 3 000 F et catégorie à 5 000 F → prix « À partir de » 5 000 F » ; `tests/parcours/decouverte-recherche-lot9bis.test.ts:83` « q sans accent trouve la ville accentuée » ; `tests/parcours/cycle-visibilite.test.ts:141` « BROUILLON, EN_ATTENTE et VALIDE → 404, sans rien divulguer » ; `tests/parcours/cycle-visibilite.test.ts:152` « PUBLIE : fiche normale, purchasable true, aucun bandeau » ; `tests/parcours/cycle-visibilite.test.ts:216` « seulement les PUBLIE à venir : passés, suspendus, annulés, terminés et non publics exclus ; en cours inclus » ; `tests/parcours/cycle-visibilite.test.ts:254` « jamais « Gratuit » sans catégorie achetable : sans prix, « Bientôt en vente » ; témoin : catégorie gratuite achetable → 0 F » ; `tests/parcours/temps-reel-public.test.ts:149` « VALIDE → PUBLIE : anon abonné à public_event_state reçoit la ligne (prix « à partir de » des seules catégories actives et visibles) et le catalogue rechargé contient l’événement » ; `tests/parcours/temps-reel-public.test.ts:248` « création BROUILLON, modification, soumission EN_ATTENTE, validation VALIDE : rien sur public_event_state, aucune ligne en base, rien sur events ». Essai : Essais 3, 4, 5, 6, 13 et 21 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.2.

### Étape 4.9 — Populaires et Près de chez vous

1. **Qui, où, quel bouton.** Tout visiteur, accueil, sections « Populaires » et « Près de chez vous ». Preuve : `components/events/HomeDiscovery.tsx:108-111`, `:227-228`.
2. **Ce qu'il saisit.** « Votre ville » seulement.
3. **Ce que fait le système.** Depuis le lot 9 bis, la carte affiche la même ligne de vente qu'à l'étape 4.8, et « Près de chez vous » compare les villes sans accent ni majuscule (la ville du profil « THIES » retrouve « Thiès »). Populaires : 10 événements publiés à venir, classés par billets vendus depuis 7 jours, hors invitations. Un événement tout juste publié n'y apparaît donc qu'après une vente. Le résultat est gardé 60 secondes. Pas de mise à jour en direct. Sans résultat, la section est absente. Près de chez vous : 8 au plus. La portée des 60 secondes selon le nombre de serveurs en production est NON VÉRIFIÉ, ce nombre n'étant pas dans le code. Preuve : `M/20261108000003_lot9_decouverte.sql:27-45`, `lib/events/popular.service.ts:12`, `:43`, `components/events/HomeDiscovery.tsx:81-94`, `:105`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Aucun.
7. **Test et essai.** Test : `tests/parcours/decouverte-cache.test.ts:54` « à 59 s et à 59,999 s : aucune relecture, même liste » ; `tests/parcours/decouverte-cache.test.ts:67` « à 60 s exactement : relecture, la nouvelle liste est rendue » ; `tests/parcours/decouverte-cache.test.ts:77` « la relecture repart pour 60 s » ; `tests/parcours/decouverte-ecrans.test.ts:317` « HomeDiscovery : Populaires puis Près de chez vous, lecture par readPopular et readCatalog(« proches ») » ; `tests/parcours/decouverte-ecrans.test.ts:335` « accueil : HomeDiscovery rendu sous « À l’affiche » » ; `tests/parcours/decouverte-recherche-lot9bis.test.ts:102` « cities : « Thièsx… » et « THIESX… » ne font qu’une ville ». Essai : Essais 64 et 65 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.14.

# Chapitre 5. Modification après publication

Tableau d'ensemble, pour un événement « Validé », « Publié » ou « Suspendu ». « Avec ventes » veut dire : au moins un billet, quel que soit son statut, ou une réservation en cours.

| Ce que Mariama change | Sans vente | Avec ventes | Qui est prévenu | Étape |
|---|---|---|---|---|
| Titre | oui | oui | détenteurs : cloche, push ; pas de SMS ; depuis le lot 9 bis, admins : cloche, email | 5.3 |
| Date ou heure de début, de fin | oui, nouveau début futur | oui, nouveau début futur | depuis le lot 9 bis : détenteurs (cloche, push, SMS indispensable et email après 10 minutes), numéros sans compte (SMS), contrôleurs affectés, admins | 5.4 |
| Lieu, ville, adresse | oui | oui | depuis le lot 9 bis : détenteurs (cloche, push, SMS indispensable et email après 10 minutes), numéros sans compte (SMS), contrôleurs affectés, admins | 5.5 |
| Description, programme, stationnement, accès, téléphone, règles, position | oui | oui | personne | 5.2 |
| Affiche | oui | oui | depuis le lot 9 bis, admins : cloche, email | 5.2 |
| Catégorie d'événement | oui | non | personne | 5.6 |
| Jauge | oui | oui, avec planchers | personne | 5.7 |
| Ajout d'une catégorie | oui | oui | depuis le lot 9 bis, admins : cloche, email | 5.8 |
| Nom, détail, maximum par commande | oui | oui | personne | 5.9 |
| Prix | oui | non | personne | 5.10 |
| Quantité | oui | oui, jamais sous les ventes et paiements en cours | personne, sauf Mariama si la quantité égale les ventes | 5.11 |
| Dates de vente | oui | oui | personne | 5.12 |
| Canaux | oui | oui | personne | 5.13 |
| Activer, désactiver une catégorie | oui | oui | personne | 5.14 |
| Supprimer une catégorie | oui | non | personne | 5.15 |

### Étape 5.1 — Ouvrir la modification : règles communes

1. **Qui, où, quel bouton.** Mariama, bouton « Modifier », page `/partner/events/{id}/edit`. Bandeau « Modifications encadrées après la validation » : « Description, programme, informations pratiques, affiche et position : modifiables librement. » ; « Titre, dates, heures, lieu, ville et adresse : les détenteurs de billets sont prévenus. » ; « Catégorie d’événement et jauge : verrouillées dès la première vente (la jauge peut seulement augmenter). ». Aide sur les champs concernés : « Les détenteurs de billets seront prévenus de ce changement. ». Preuve : `M/20261102000003_lot5_cycle.sql:482-547`, `EventForm.tsx:88`, `:721`, `:727-735`.
2. **Ce qu'il saisit.** Seuls les champs changés partent.
3. **Ce que fait le système.** Enregistré, statut inchangé, **aucune nouvelle validation**. Résultat : « Modifications enregistrées » et, depuis le lot 9 bis, « {n} détenteurs de billets prévenus dans l’application ; {m} SMS partiront dans 10 minutes (vos corrections d’ici là y seront regroupées). », exemple « 12 détenteurs de billets prévenus dans l’application ; 14 SMS partiront dans 10 minutes (vos corrections d’ici là y seront regroupées). » (le nombre de SMS compte aussi les numéros sans compte), sinon « Aucun détenteur de billets n’était à prévenir. ». Preuve : `EventForm.tsx:90-109`, `:648`, `M/20261109000009_lot9bis_messages.sql:392`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

À cette étape générale, aucun. Le détail est donné champ par champ, étapes 5.3 à 5.5.

5. **Ce que les autres voient.** Depuis le lot 9 bis, Aïda et les admins avec `events.read` reçoivent une alerte quand le titre, l'affiche, le lieu, la ville, l'adresse, une date ou une heure changent, ou qu'une catégorie est ajoutée, sur un événement validé, publié ou suspendu (étapes 5.3 à 5.5 et 5.8), en plus de la ligne au journal d'audit. Preuve : `M/20261109000009_lot9bis_messages.sql:36-40`.
6. **Ce qui est impossible.** En attente de validation : « L’événement est en cours de validation : retirez-le de la validation pour le modifier. ». Terminé ou annulé : « Un événement terminé ou annulé ne peut plus être modifié. », « La billetterie d’un événement terminé ou annulé ne peut plus être modifiée. », écran « Événement figé ». Admin : « Seul l’organisateur modifie son événement ; l’administration agit par les changements de statut. ». Autre partenaire : « Événement introuvable. ». Champs jamais modifiables : « Ce champ ne se modifie pas depuis le formulaire de l’événement. ». Preuve : `lib/events/event.service.ts:227-233`, `:330-338`, `lib/validations/event.ts:60-63`.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:620` « champs interdits (status, services, gallery_urls, ticket_categories, slug, partner_id, is_featured) → 400 FIELD_NOT_EDITABLE, rien n’est modifié » ; `tests/parcours/edition-formulaire.test.ts:652` « VALIDE et SUSPENDU : règles d’après publication (champ libre appliqué, statut refusé) » ; `tests/parcours/edition-formulaire.test.ts:664` « TERMINE et ANNULE → 409 EVENT_LOCKED, rien n’est modifié » ; `tests/parcours/edition-formulaire.test.ts:675` « admin → 403 ADMIN_CANNOT_EDIT ; partenaire B → refus sans effet ». Essai : Essai 14 de `docs/recette-billetterie.md` pour la date seule.

### Étape 5.2 — Description, programme, informations pratiques, affiche

1. **Qui, où, quel bouton.** Mariama, formulaire, « Enregistrer les modifications ».
2. **Ce qu'il saisit.** Règles des étapes 3.2 à 3.4. L'affiche peut être remplacée, ou retirée, même sur un événement publié. Refus : « L'affiche doit être déposée depuis le formulaire de l'événement. ». Preuve : `ImageUpload.tsx:110-113`, `M/20261108000001_lot9_securite.sql:326`.
3. **Ce que fait le système.** Enregistré, statut inchangé.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `events.read`, si l'affiche change | cloche, email | indispensable | prochain passage de la file | titre « Événement modifié après validation » ; modèle « « {title} » de {company} : nouvelle affiche après validation. Vérifiez la fiche. » ; exemple « « Gala de la Teranga » de Sabar Events : nouvelle affiche après validation. Vérifiez la fiche. » |

Aucun message aux détenteurs. Preuve : `M/20261108000001_lot9_securite.sql:387-411`, `ADMIN_EVENT_CHANGED` (`lib/notifications/catalog.ts:1578-1590`).

5. **Ce que les autres voient.** Public : au prochain chargement ; l'affiche se met à jour d'elle-même.
6. **Ce qui est impossible.** Dépasser les limites citées aux étapes 3.2 à 3.4.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:562` « champs libres d’un PUBLIÉ (description, programme, infos pratiques hors adresse, affiche, coordonnées) : appliqués sans notification ». Essai : aucun.

### Étape 5.3 — Titre

1. **Qui, où, quel bouton.** Mariama, « Titre de l’événement », « Enregistrer les modifications ».
2. **Ce qu'il saisit.** 3 à 120 caractères.
3. **Ce que fait le système.** Enregistré. L'adresse de la page ne change pas.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Chaque compte détenteur d'un billet valable | cloche | optionnel | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouveau titre (ancien titre : « {old_title} »). Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouveau titre (ancien titre : « Gala 2026 »). Vos billets restent valables. » |
| Chaque compte détenteur d'un billet valable | push | optionnel | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouveau titre (ancien titre : « {old_title} »). Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouveau titre (ancien titre : « Gala 2026 »). Vos billets restent valables. » |

| Aïda et les admins avec `events.read` | cloche, email | indispensable | prochain passage de la file | titre « Événement modifié après validation » ; modèle « « {title} » de {company} : nouveau titre (ancien : « {old_title} ») après validation. Vérifiez la fiche. » ; exemple « « Gala de la Teranga » de Sabar Events : nouveau titre (ancien : « Gala 2026 ») après validation. Vérifiez la fiche. » |

Pas de SMS ni d'email aux détenteurs pour un changement de titre seul. Depuis le lot 9 bis, ce changement reste optionnel pour les détenteurs : seuls la date et le lieu sont indispensables. Preuve : `M/20261109000009_lot9bis_messages.sql:392`, `ADMIN_EVENT_CHANGED`.

5. **Ce que les autres voient.** Listes publiques, Mes billets et la liste du contrôleur lisent le titre courant. Preuve : `app/api/tickets/route.ts:48`, `app/api/controller/assignments/route.ts:45`.
6. **Ce qui est impossible.** Dépasser les limites.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:529` « changement de titre : notification dans l’application seulement, aucun SMS en file » ; `tests/parcours/messages-changement-9bis.test.ts:187` « témoin : titre seul → SMS SKIPPED TITLE_ONLY (rien ne part par SMS) » ; `tests/parcours/messages-changement-9bis.test.ts:268` « titre changé sur un PUBLIE : alerte à l'admin events.read, rien à l'admin sans permission ». Essai : aucun.

### Étape 5.4 — Date et heure

1. **Qui, où, quel bouton.** Mariama, « Date de début », « Heure de début », « Date de fin », « Heure de fin ».
2. **Ce qu'il saisit.** Un nouveau début obligatoirement futur s'il change : « Le début de l’événement doit être dans le futur (heure de Dakar). », « Le nouveau début de l'événement doit être dans le futur (heure de Dakar). ». « La fin de l’événement doit être postérieure à son début. ». Une fin qui passerait avant une fin de vente est refusée : « La fin de vente de {catégories} dépasse la nouvelle fin de l'événement : avancez d'abord la fin de vente. », exemple « La fin de vente de « VIP » dépasse la nouvelle fin de l'événement : avancez d'abord la fin de vente. ». Preuve : `M/20261108000001_lot9_securite.sql:337`, `:379-380`.
Depuis le lot 9 bis, une fin qui tombe avant le début de vente d'une catégorie est aussi refusée : « Le début de vente doit précéder la fin de l’événement. ». Preuve : `M/20261109000009_lot9bis_messages.sql:70-72`.
3. **Ce que fait le système.** Enregistré. Si la fin recule, la date de disponibilité de l'argent recule aussi. La fenêtre de scan se recalcule. Les rappels en attente sont annulés et replanifiés. Depuis le lot 9 bis, chaque changement de début est enregistré : si le début dépasse de plus de 24 heures celui en vigueur à l'achat (reports cumulés), chaque détenteur d'un billet payé en ligne peut demander le remboursement total, prix et frais de service, depuis Mes billets jusqu'au nouveau début (étape 7.16). Une avance de date n'ouvre aucun droit. Preuve : `M/20261108000001_lot9_securite.sql:423-428`, `M/20261103000004_lot6_rappels.sql:257`, `M/20261109000006_lot9bis_argent.sql` (`event_start_changes`, `ticket_postponement_refund_open`).
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Chaque compte détenteur d'un billet valable | SMS | indispensable depuis le lot 9 bis | 10 minutes après le premier changement, les changements suivants regroupés dans le même SMS ; tout de suite si l'ancien ou le nouveau début est à moins d'une heure ; part aussi la nuit | modèle « Event Village : {title} change de date : {new_start_at}. Vos billets restent valables. {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga change de date : sam. 21 nov. à 21:00. Vos billets restent valables. https://eventvillage.sn/tickets » (135 caractères, 1 segment) |
| Chaque détenteur dont le billet ouvre le remboursement, report de plus de 24 h | SMS | indispensable | comme ci-dessus | modèle « Event Village : {title} reporté au {new_start_at}. Remboursement total possible avant cette date : {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga reporté au sam. 21 nov. à 21:00. Remboursement total possible avant cette date : https://eventvillage.sn/tickets » (147 caractères, 1 segment) ; avec un nouveau lieu « Event Village : Gala de la Teranga reporté au sam. 21 nov. à 21:00, nouveau lieu. Remboursement total avant cette date : https://eventvillage.sn/tickets » (152 caractères, 1 segment) |
| Le même détenteur, report de plus de 24 h | cloche, push | indispensable | prochain passage de la file | titre « Événement modifié » ; exemple « « Gala de la Teranga » est reporté au sam. 21 nov. 2026 à 21:00. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement. » |
| Chaque compte détenteur d'un billet valable | cloche | indispensable depuis le lot 9 bis | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouvelle date : {new_start_at}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouvelle date : sam. 21 nov. 2026 à 21:00. Vos billets restent valables. » |
| Chaque compte détenteur d'un billet valable | push | indispensable depuis le lot 9 bis | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouvelle date : {new_start_at}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouvelle date : sam. 21 nov. 2026 à 21:00. Vos billets restent valables. » |
| Chaque compte détenteur, si son adresse est vérifiée | email | indispensable | 10 minutes après, regroupé comme le SMS | objet « Événement modifié — Event Village » ; texte de la cloche, bouton vers la fiche de l'événement |
| Chaque numéro sans compte : invitation non réclamée, acheteur au guichet qui a donné son numéro | SMS | indispensable | 10 minutes après, regroupé | même modèle que le SMS des détenteurs |
| Chaque contrôleur affecté | cloche | indispensable | prochain passage de la file | titre « Contrôle modifié » ; modèle « « {title} » : nouvelle date : {new_start_at}. Votre affectation est maintenue. » ; exemple « « Gala de la Teranga » : nouvelle date : sam. 21 nov. 2026 à 21:00. Votre affectation est maintenue. » |
| Chaque contrôleur affecté | SMS, et email si l'adresse est vérifiée | indispensable | 10 minutes après, regroupé | modèle « Event Village : affectation à l'entrée de {title} : nouvelle date {new_start_at}. {APP_URL}/login » ; exemple « Event Village : affectation à l'entrée de Gala de la Teranga : nouvelle date sam. 21 nov. à 21:00. https://eventvillage.sn/login » (128 caractères, 1 segment) |
| Aïda et les admins avec `events.read` | cloche, email | indispensable | prochain passage de la file | titre « Événement modifié après validation » ; exemple « « Gala de la Teranga » de Sabar Events : nouvelle date après validation. Vérifiez la fiche. » |
| Chaque détenteur, si seule la fin change | SMS | indispensable depuis le lot 9 bis | 10 minutes après, regroupé | modèle « Event Village : {title} : nouvelle fin le {new_end_at}. Vos billets restent valables. {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga : nouvelle fin le dim. 15 nov. à 02:00. Vos billets restent valables. https://eventvillage.sn/tickets » (136 caractères, 1 segment) |
| Chaque détenteur, si seule la fin change | cloche | indispensable depuis le lot 9 bis | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouvelle fin : {new_end_at}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouvelle fin : dim. 15 nov. 2026 à 02:00. Vos billets restent valables. » |
| Chaque détenteur, si seule la fin change | push | indispensable depuis le lot 9 bis | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouvelle fin : {new_end_at}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouvelle fin : dim. 15 nov. 2026 à 02:00. Vos billets restent valables. » |

Depuis le lot 9 bis, le changement de date ou de lieu est indispensable : il n'est plus perdu la nuit, ni au-delà du budget des SMS optionnels, ni coupé par les préférences. Un SMS en attente du même événement reçoit tous les changements des 10 minutes, regroupés. Les invités sans compte et les acheteurs au guichet qui ont laissé leur numéro reçoivent le même SMS. Preuve : `EVENT_CHANGED`, `CONTROLLER_EVENT_CHANGED`, `ADMIN_EVENT_CHANGED`, `M/20261109000009_lot9bis_messages.sql:10-40`, `lib/notifications/catalog.ts:806-812`.

5. **Ce que les autres voient.** Mes billets et le contrôleur lisent la nouvelle date. Mariama : bandeau de résultat. Depuis le lot 9 bis, les admins et les contrôleurs affectés sont prévenus (tableau ci-dessus), et Mes billets propose « Me faire rembourser » après un report de plus de 24 heures. Preuve : `M/20261103000004_lot6_rappels.sql:257`, `components/tickets/TicketCard.tsx:556-563`.
6. **Ce qui est impossible.** Un début passé ; une fin avant le début ; une fin avant le début de vente d'une catégorie. Aucune limite d'amplitude du report.
7. **Test et essai.** Test : `tests/parcours/messages-changement-9bis.test.ts:136` « changement de lieu, envoyeur à 23:00 à Dakar : SMS SENT, texte exact (aucune plage de nuit) » ; `tests/parcours/messages-changement-9bis.test.ts:198` « lieu à t, envoyeur à t + 1 min, heure changée ensuite, envoyeur à t + 11 min : un seul SMS, champs unis » ; `tests/parcours/messages-changement-9bis.test.ts:222` « début à moins d'une heure : SMS dû tout de suite » ; `tests/parcours/lot9bis-report.test.ts:286` « SMS EVENT_CHANGED du porteur : texte exact de la variante « report » » ; `tests/parcours/cycle9bis-soumission-fiche.test.ts:131` « SALE_START_AFTER_EVENT » ; `tests/parcours/messages-acteurs-9bis.test.ts` (contrôleurs prévenus) ; `tests/parcours/messages-annulation-9bis.test.ts` (numéros sans compte) ; `tests/parcours/edition-formulaire.test.ts:501` « changement de date d’un PUBLIÉ : une ligne SMS EVENT_CHANGED par porteur VALIDE, notification dans l’application, { notified_holders, sms_queued } » ; `tests/parcours/edition-formulaire.test.ts:480` « enregistrement sans changement réel (heure HH:mm contre HH:mm:ss en base, champs verrouillés renvoyés à l’identique) : aucun porteur notifié » ; `tests/parcours/edition-formulaire.test.ts:702` « report de la fin après des ventes : available_at du crédit VENTE recalculé dans la même modification, jamais avancé » ; `tests/parcours/edition-validation.test.ts:434` « mise à jour : EVENT_START_PAST seulement si les dates changent ; HH:mm égal à HH:mm:ss n’est pas un changement ; fin comparée au début actuel » ; `tests/parcours/edition-validation.test.ts:571` « PUT : patch invalide → 400 avec les champs, date passée → EVENT_START_PAST, rien n’est modifié ». Essai : Essai 14 de `docs/recette-billetterie.md`, réécrit au lot 9 bis pour le report de plus de 24 heures.

### Étape 5.5 — Lieu, ville, adresse

1. **Qui, où, quel bouton.** Mariama, « Lieu », « Ville », « Adresse précise ».
2. **Ce qu'il saisit.** Règles des étapes 3.2 et 3.4.
3. **Ce que fait le système.** Enregistré, catalogue public à jour.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Chaque détenteur, changement de lieu | SMS | indispensable depuis le lot 9 bis | 10 minutes après, regroupé, part aussi la nuit (étape 5.4) | modèle « Event Village : {title} change de lieu : {new_location}. Vos billets restent valables. {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga change de lieu : Grand Théatre. Vos billets restent valables. https://eventvillage.sn/tickets » (128 caractères, 1 segment) |
| Chaque détenteur, changement de lieu | cloche | indispensable | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouveau lieu : {new_location}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouveau lieu : Grand Théâtre. Vos billets restent valables. » |
| Chaque détenteur, changement de lieu | push | indispensable | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouveau lieu : {new_location}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouveau lieu : Grand Théâtre. Vos billets restent valables. » |
| Chaque détenteur, changement de ville | cloche | indispensable | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouvelle ville : {new_city}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouvelle ville : Thiès. Vos billets restent valables. » |
| Chaque détenteur, changement d'adresse | cloche | indispensable | prochain passage de la file | titre « Événement modifié » ; modèle « « {title} » : nouvelle adresse : {new_address}. Vos billets restent valables. » ; exemple « « Gala de la Teranga » : nouvelle adresse : Route de Rufisque, sortie 10. Vos billets restent valables. » |
| Chaque détenteur, date et lieu ensemble | SMS | indispensable depuis le lot 9 bis | 10 minutes après, regroupé | modèle « Event Village : {title} change : {new_start_at}, {new_location}. Billets toujours valables. {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga change : sam. 21 nov. à 21:00, Grand Théatre. Billets toujours valables. https://eventvillage.sn/tickets » (139 caractères, 1 segment) |
| Chaque détenteur, adresse retirée sans autre changement | SMS | indispensable | 10 minutes après, regroupé | depuis le lot 9 bis, modèle « Event Village : {title} : adresse retirée, lieu {location}. Billets toujours valables. {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga : adresse retirée, lieu CICAD. Billets toujours valables. https://eventvillage.sn/tickets » (124 caractères, 1 segment) ; cloche « « Gala de la Teranga » : adresse retirée. Vos billets restent valables. » |
| Chaque contrôleur affecté, changement de lieu | cloche ; SMS, et email si l'adresse est vérifiée | indispensable | cloche au prochain passage, SMS 10 minutes après | cloche « « Gala de la Teranga » : nouveau lieu : Grand Théâtre. Votre affectation est maintenue. » ; SMS « Event Village : affectation à l'entrée de Gala de la Teranga : nouveau lieu Grand Théatre. https://eventvillage.sn/login » (120 caractères, 1 segment) |

Pour la ville et l'adresse seules, le SMS dit « change de lieu », par exemple « Event Village : Gala de la Teranga change de lieu : CICAD, Thiès. Vos billets restent valables. https://eventvillage.sn/tickets » (127 caractères, 1 segment). Les emails des détenteurs, les numéros sans compte et l'alerte aux admins suivent l'étape 5.4. Depuis le lot 9 bis, une adresse posée puis retirée dans les 10 minutes n'apparaît plus dans le SMS. Preuve : `EVENT_CHANGED`, `CONTROLLER_EVENT_CHANGED`, `M/20261109000009_lot9bis_messages.sql:75-78`, `lib/notifications/catalog.ts:411-446`.

5. **Ce que les autres voient.** Comme à l'étape 5.4.
6. **Ce qui est impossible.** Dépasser les limites de longueur.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:545` « lieu et adresse : porteur notifié, SMS en file » ; `tests/parcours/textes-base-9bis.test.ts` (adresse posée puis vidée dans la fenêtre : le SMS ne contient plus l'ancienne adresse). Essai : aucun.

### Étape 5.6 — Catégorie d'événement

1. **Qui, où, quel bouton.** Mariama, boutons de catégorie d'événement.
2. **Ce qu'il saisit.** La liste de l'étape 3.2. Verrouillée à l'écran dès qu'un billet est vendu : « Verrouillée : des billets ont déjà été vendus ou réservés. ». Preuve : `EventForm.tsx:1175`.
3. **Ce que fait le système.** Enregistré s'il n'y a aucune vente.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Le filtre public change.
6. **Ce qui est impossible.** Avec ventes : « La catégorie de l'événement ne change plus : des billets ont été vendus ou réservés. ». Preuve : `M/20261108000001_lot9_securite.sql:351`.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:594` « catégorie d’événement et jauge verrouillées dès qu’il y a des ventes (LOCKED_AFTER_SALES, champ en cause) ; hausse de jauge acceptée ; sans vente, modifiables ». Essai : aucun.

### Étape 5.7 — Jauge

1. **Qui, où, quel bouton.** Mariama, « Capacité totale (jauge) ». Avec ventes, cadenas et aide « Des billets sont vendus : la jauge peut augmenter, mais ni descendre sous les ventes ni être retirée. ». Preuve : `EventForm.tsx:904-905`.
2. **Ce qu'il saisit.** 1 à 100 000 ou vide.
3. **Ce que fait le système.** Enregistré si les planchers sont respectés.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun, hors la jauge affichée.
6. **Ce qui est impossible.** « La jauge ne peut plus être supprimée : des billets ont été vendus ou réservés. » ; « La jauge ne peut pas descendre sous {n} : billets vendus et paiements en cours compris. », exemple « La jauge ne peut pas descendre sous 42 : billets vendus et paiements en cours compris. » ; « La jauge ne peut pas descendre sous la somme des quotas des catégories actives ({n}) : baissez d'abord les quotas. », exemple « La jauge ne peut pas descendre sous la somme des quotas des catégories actives (150) : baissez d'abord les quotas. ». Preuve : `M/20261108000001_lot9_securite.sql:358-368`.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:594` « catégorie d’événement et jauge verrouillées dès qu’il y a des ventes (LOCKED_AFTER_SALES, champ en cause) ; hausse de jauge acceptée ; sans vente, modifiables ». Essai : aucun.

### Étape 5.8 — Ajouter une catégorie après publication

1. **Qui, où, quel bouton.** Mariama, étape « Billets », « Ajouter une catégorie », puis « Créer la catégorie ». Texte : « Chaque catégorie s’enregistre séparément. Le prix ne change plus dès qu’un billet est vendu ou réservé ; la quantité ne descend jamais sous les ventes. ». Preuve : `components/events/EventTicketing.tsx:532`, `:604`, `:613`.
2. **Ce qu'il saisit.** Les champs de l'étape 3.5, sans contrôle dans le navigateur. Erreurs supplémentaires : « Une catégorie « {nom} » existe déjà pour cet événement : choisissez un autre nom. », exemple « Une catégorie « VIP » existe déjà pour cet événement : choisissez un autre nom. » ; « La somme des quotas des catégories actives ({n}) dépasserait la jauge de l'événement ({j}). », exemple « La somme des quotas des catégories actives (150) dépasserait la jauge de l'événement (100). ». Preuve : `M/20261106000001_lot8_canaux.sql:864`, `:871`.
3. **Ce que fait le système.** Statut inchangé, aucune validation admin. Message « Catégorie créée. ». Si elle est active et en ligne, elle est achetable aussitôt, selon ses dates. Preuve : `components/events/EventTicketing.tsx:488`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message à Mariama ni aux détenteurs ; l'alerte aux admins est au point 5.

5. **Ce que les autres voient.** Public : la catégorie apparaît, le prix « À partir de » se recalcule, signal en direct. Détenteurs : rien. Depuis le lot 9 bis, sur un événement validé, publié ou suspendu, Aïda et les admins avec `events.read` reçoivent en cloche et par email « Événement modifié après validation », exemple « « Gala de la Teranga » de Sabar Events : catégorie « Carré VIP » ajoutée après validation. Vérifiez la fiche. ». Preuve : `ADMIN_EVENT_CHANGED`, `M/20261109000009_lot9bis_messages.sql:36-40`.
6. **Ce qui est impossible.** En attente de validation, terminé, annulé (étape 5.1).
7. **Test et essai.** Test : `tests/parcours/edition-categories.test.ts:259` « tous les champs appliqués, rien d’ignoré (is_active: false, max_per_order, dates de vente en heure de Dakar) » ; `tests/parcours/edition-categories.test.ts:278` « max_per_order 0, prix 1500,5 ou clé inconnue (sold_quantity) → 400 en français, aucune catégorie créée » ; `tests/parcours/edition-categories.test.ts:290` « Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, aucune catégorie créée » ; `tests/parcours/edition-categories.test.ts:505` « TERMINE et ANNULE → 409 EVENT_LOCKED pour la création, la modification et la suppression » ; `tests/parcours/messages-changement-9bis.test.ts:281` « catégorie créée sur un PUBLIE : alerte à l'admin events.read ». Essai : aucun.

### Étape 5.9 — Nom, détail, maximum par commande

1. **Qui, où, quel bouton.** Mariama, bouton « Enregistrer la catégorie ». Preuve : `components/events/EventTicketing.tsx:604`.
2. **Ce qu'il saisit.** Étape 3.5. Rien de changé : « Aucune modification à enregistrer pour cette catégorie. ». Preuve : `components/events/EventTicketing.tsx:493`.
3. **Ce que fait le système.** Enregistré, « Catégorie enregistrée. ». Preuve : `components/events/EventTicketing.tsx:500`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Public : au prochain chargement.
6. **Ce qui est impossible.** Doublon de nom : « Une catégorie « {nom} » existe déjà pour cet événement : choisissez un autre nom. », exemple à l'étape 5.8. Preuve : `M/20261106000001_lot8_canaux.sql:1016`.
7. **Test et essai.** Test : `tests/parcours/edition-categories.test.ts:318` « name, description, dates de vente, max_per_order, is_visible et is_active appliqués (plus rien d’ignoré) » ; `tests/parcours/edition-categories.test.ts:362` « renommer vers un nom déjà pris (casse différente) → refusé, rien n’est modifié » ; `tests/parcours/edition-categories.test.ts:468` « champs non financiers d’une catégorie vendue (nom, description, max_per_order, visibilité) : appliqués ». Essai : aucun.

### Étape 5.10 — Prix

1. **Qui, où, quel bouton.** Mariama, « Prix (F CFA) ». Avec ventes, champ grisé : « Prix verrouillé : {ventes}. Créez une autre catégorie pour un nouveau tarif. », exemple « Prix verrouillé : 12 billets vendus. Créez une autre catégorie pour un nouveau tarif. ». Preuve : `components/events/EventTicketing.tsx:173-179`.
2. **Ce qu'il saisit.** Un entier de 0 à 10 000 000 ; depuis le lot 9 bis, un prix payant d'au moins le minimum réglé (100 F par défaut) : « Le prix d’un billet payant est d’au moins 100 F CFA. Pour un billet gratuit, indiquez 0. ». Preuve : `lib/events/event.service.ts:128-138`.
3. **Ce que fait le système.** Enregistré s'il n'y a aucune vente, journal de l'ancien et du nouveau prix. Preuve : `M/20261106000001_lot8_canaux.sql:1032-1036`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Public : au prochain chargement.
6. **Ce qui est impossible.** « Le prix de cette catégorie est verrouillé : des billets ont été vendus ou réservés. Créez une nouvelle catégorie pour un autre tarif. ». Un billet annulé compte comme une vente. Preuve : `M/20261106000001_lot8_canaux.sql:988`.
7. **Test et essai.** Test : `tests/parcours/edition-categories.test.ts:334` « prix et quota modifiables sans vente ni réservation (garde-fou) » ; `tests/parcours/edition-categories.test.ts:452` « prix d’une catégorie vendue → 409 PRICE_LOCKED_AFTER_SALES, rien n’est modifié » ; `tests/parcours/edition-categories.test.ts:460` « prix d’une catégorie qui n’a qu’une réservation en cours → 409 PRICE_LOCKED_AFTER_SALES » ; `tests/parcours/edition-categories.test.ts:477` « prix d’une catégorie sans vente ni réservation : modifiable (garde-fou) » ; `tests/parcours/paiement-prix-minimum.test.ts:100` « 3. minimum réglé à 500 F : 300 → 400 F refusé ; quantité seule changée sur une catégorie à 300 F acceptée ». Essai : aucun.

### Étape 5.11 — Quantité

1. **Qui, où, quel bouton.** Mariama, « Quantité mise en vente ». Aide : « Jamais sous les ventes : {n} billets vendus, {m} en cours de paiement. », exemple « Jamais sous les ventes : 12 billets vendus, 2 en cours de paiement. ». Preuve : `components/events/EventTicketing.tsx:197-199`.
2. **Ce qu'il saisit.** 1 à 100 000.
3. **Ce que fait le système.** Enregistré ; le stock public est recalculé.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama, si la quantité devient égale aux ventes | SMS | optionnel | prochain passage de la file ; perdu en heures calmes (22 h à 8 h) ou au-delà du budget quotidien | modèle « Event Village : la catégorie {category} de {title} est complète. {APP_URL}/partner/events » ; exemple « Event Village : la catégorie Carré VIP de Gala de la Teranga est complète. https://eventvillage.sn/partner/events » (113 caractères, 1 segment) |
| Mariama, si la quantité devient égale aux ventes | cloche | optionnel | prochain passage de la file | titre « Catégorie complète » ; modèle « La catégorie « {category} » de « {title} » est complète. » ; exemple « La catégorie « Carré VIP » de « Gala de la Teranga » est complète. » |
| Mariama, si la quantité devient égale aux ventes | push | optionnel | prochain passage de la file | titre « Catégorie complète » ; modèle « La catégorie « {category} » de « {title} » est complète. » ; exemple « La catégorie « Carré VIP » de « Gala de la Teranga » est complète. » |
| Mariama, si la quantité devient égale aux ventes | email | optionnel | prochain passage de la file | objet « Catégorie complète — Event Village » ; modèle : Catégorie complète<br>La catégorie « {category} » de « {title} » est complète.<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : {APP_URL}/profile/notifications?topic=PRO_ACTIVITY ; exemple : Catégorie complète<br>La catégorie « Carré VIP » de « Gala de la Teranga » est complète.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : https://eventvillage.sn/profile/notifications?topic=PRO_ACTIVITY |
| Mariama, si c'était la dernière catégorie active | SMS | optionnel | prochain passage de la file ; perdu en heures calmes (22 h à 8 h) ou au-delà du budget quotidien | modèle « Event Village : {title} est complet, toutes les catégories sont vendues. {APP_URL}/partner/events » ; exemple « Event Village : Gala de la Teranga est complet, toutes les catégories sont vendues. https://eventvillage.sn/partner/events » (122 caractères, 1 segment) |
| Mariama, si c'était la dernière catégorie active | cloche | optionnel | prochain passage de la file | titre « Événement complet » ; modèle « Toutes les catégories de « {title} » sont vendues. » ; exemple « Toutes les catégories de « Gala de la Teranga » sont vendues. » |
| Mariama, si c'était la dernière catégorie active | push | optionnel | prochain passage de la file | titre « Événement complet » ; modèle « Toutes les catégories de « {title} » sont vendues. » ; exemple « Toutes les catégories de « Gala de la Teranga » sont vendues. » |
| Mariama, si c'était la dernière catégorie active | email | optionnel | prochain passage de la file | objet « Événement complet — Event Village » ; modèle : Événement complet<br>Toutes les catégories de « {title} » sont vendues.<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : {APP_URL}/profile/notifications?topic=PRO_ACTIVITY ; exemple : Événement complet<br>Toutes les catégories de « Gala de la Teranga » sont vendues.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : https://eventvillage.sn/profile/notifications?topic=PRO_ACTIVITY |

Preuve : `CATEGORY_SOLD_OUT` (`M/20261103000005_lot6_billetterie.sql:914`) ; `EVENT_SOLD_OUT` (`M/20261103000005_lot6_billetterie.sql:918-925`).

5. **Ce que les autres voient.** Public : disponibilité recalculée.
6. **Ce qui est impossible.** « Le quota ne peut pas descendre sous les {n} billet(s) déjà vendus. », exemple « Le quota ne peut pas descendre sous les 12 billet(s) déjà vendus. » ; « Le quota ne peut pas descendre sous {t} : {v} billet(s) vendus et {r} en cours de paiement. », exemple « Le quota ne peut pas descendre sous 14 : 12 billet(s) vendus et 2 en cours de paiement. ». Preuve : `M/20261106000001_lot8_canaux.sql:992-1008`.
7. **Test et essai.** Test : `tests/parcours/edition-categories.test.ts:420` « quota sous les vendus → QUOTA_BELOW_SOLD, rien n’est modifié » ; `tests/parcours/edition-categories.test.ts:428` « quota sous vendus + réservés → QUOTA_BELOW_HELD, sans message Postgres, rien n’est modifié » ; `tests/parcours/edition-categories.test.ts:443` « Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, rien n’est modifié » ; `tests/parcours/notif-pros.test.ts:428` « catégorie complète, de nouveau après une hausse du quota (clé avec le quota), puis événement complet ». Essai : aucun.

### Étape 5.12 — Dates de vente

1. **Qui, où, quel bouton.** Mariama, « Début de la vente », « Fin de la vente ».
2. **Ce qu'il saisit.** Modifiables avec ventes. Erreurs de l'étape 3.5. Depuis le lot 9 bis, un début de vente modifié seul est comparé à la fin de l'événement : « Le début de vente doit précéder la fin de l’événement. ». Preuve : `lib/validations/event.ts:505-510`, `M/20261109000008_lot9bis_cycle.sql:1962`.
3. **Ce que fait le système.** Enregistré, la vente s'ouvre ou se ferme selon les dates.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Public : « Vente à partir du {date} », « Vente terminée ».
6. **Ce qui est impossible.** Une fin avant le début ; une fin après la fin de l'événement ; depuis le lot 9 bis, un début de vente à la fin de l'événement ou après.
7. **Test et essai.** Test : `tests/parcours/cycle9bis-soumission-fiche.test.ts:131` « ticket_category_update { sale_start } ≥ fin → SALE_START_AFTER_EVENT (RPC et route PATCH) ; avant la fin → accepté (témoin) » ; `tests/parcours/edition-categories.test.ts:318` « name, description, dates de vente, max_per_order, is_visible et is_active appliqués (plus rien d’ignoré) » ; `tests/parcours/edition-categories.test.ts:373` « valeurs invalides (quota non numérique, prix décimal, fin de vente avant le début ou après la fin) → refus en français, sans message Postgres » ; `tests/parcours/edition-validation.test.ts:444` « dates de vente : début < fin ≤ fin de l’événement (datetime-local de Dakar) ». Essai : aucun.

### Étape 5.13 — Canaux

1. **Qui, où, quel bouton.** Mariama, cases « Vendue en ligne », « Vendue au guichet ».
2. **Ce qu'il saisit.** Oui ou non, avec ventes aussi. Erreur : « Indiquez oui ou non pour les canaux de vente et la mise en vente. ». Preuve : `M/20261106000001_lot8_canaux.sql:980`.
3. **Ce que fait le système.** Enregistré. Une catégorie retirée de la vente en ligne disparaît de la fiche ; les paiements en cours gardent la décision prise à leur lancement. Preuve : `M/20261106000001_lot8_canaux.sql:18`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Public : apparition ou disparition en direct. Contrôleur : liste du guichet.
6. **Ce qui est impossible.** Aucun. Tout est permis, même sans canal (« Invitations seulement »).
7. **Test et essai.** Test : `tests/parcours/canaux-interface.test.ts:185` « modification : sale_online et sale_counter acceptés, is_visible toujours accepté » ; `tests/parcours/canaux-interface.test.ts:262` « ligne d’état d’une catégorie enregistrée : libellé de canal, plus de « masquée au public » » ; `tests/parcours/canaux-vente.test.ts:285` « 1. checkout_create_payment en appel direct : ok false, CATEGORY_NOT_SOLD_ONLINE, aucun paiement, aucune réservation ». Essai : Essais 21 et 61 de `docs/recette-billetterie.md`.

### Étape 5.14 — Activer ou désactiver une catégorie

1. **Qui, où, quel bouton.** Mariama, case « Catégorie active », ou bouton « Retirer de la vente » proposé après un refus de suppression. Preuve : `components/events/EventTicketing.tsx:594-597`.
2. **Ce qu'il saisit.** Oui ou non.
3. **Ce que fait le système.** Enregistré, « Catégorie retirée de la vente. », état « Vente fermée ». Les billets déjà émis ne changent pas. Rien n'empêche de désactiver toutes les catégories d'un événement publié. Preuve : `components/events/EventTicketing.tsx:510`, `:565`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Public : la catégorie disparaît.
6. **Ce qui est impossible.** Réactiver au-delà de la jauge, message de l'étape 5.8.
7. **Test et essai.** Test : `tests/parcours/edition-categories.test.ts:259` « tous les champs appliqués, rien d’ignoré (is_active: false, max_per_order, dates de vente en heure de Dakar) » ; `tests/parcours/edition-categories.test.ts:342` « hausse de quota d’une catégorie désactivée : elle reste désactivée (aucune réactivation implicite) ». Essai : aucun.

### Étape 5.15 — Supprimer une catégorie

1. **Qui, où, quel bouton.** Mariama, corbeille « Supprimer la catégorie {nom} », exemple « Supprimer la catégorie VIP », visible sans vente. Fenêtre « Supprimer cette catégorie ? », « La catégorie sera supprimée définitivement. Ce n’est possible que si aucun billet n’a été vendu ni réservé. », « Supprimer », « Garder la catégorie ». Preuve : `components/events/EventTicketing.tsx:569-578`, `:621-626`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** La catégorie est supprimée.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Public : la catégorie disparaît.
6. **Ce qui est impossible.** « Des billets de cette catégorie ont été vendus ou réservés : elle ne peut pas être supprimée. Désactivez-la pour arrêter sa vente. ». Preuve : `M/20261102000004_lot5_edition.sql:1071-1073`.
7. **Test et essai.** Test : `tests/parcours/edition-categories.test.ts:484` « suppression d’une catégorie vendue ou réservée → 409 CATEGORY_HAS_SALES, la réponse propose de la désactiver » ; `tests/parcours/edition-categories.test.ts:494` « suppression d’une catégorie sans vente ni réservation : effective ». Essai : aucun.

### Étape 5.16 — Deux modifications en même temps

1. **Qui, où, quel bouton.** Mariama, deux sessions ouvertes sur le même formulaire.
2. **Ce qu'il saisit.** Comme à l'étape 5.1.
3. **Ce que fait le système.** Rien n'est enregistré. Bandeau « L’événement a été modifié entre-temps », « Une autre session a enregistré des changements. Rechargez l’événement pour repartir de la dernière version (vos saisies non enregistrées seront perdues). », bouton « Recharger l’événement ». Preuve : `EventForm.tsx:750-760`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Écraser une version plus récente.
7. **Test et essai.** Test : `tests/parcours/edition-formulaire.test.ts:688` « EDIT_CONFLICT : expected_updated_at périmé → 409, la première modification reste ». Essai : aucun.

# Chapitre 6. L'équipe

Deux écrans mènent aux mêmes actions : `/partner/team`, titre « Équipe de contrôle », pour tous les événements ; et l'onglet « Équipe » du pilotage, `/partner/events/{id}?tab=equipe`. Preuve : `app/partner/team/page.tsx:516`, `components/partner/pilotage/TeamTab.tsx:331`.

### Étape 6.1 — Inviter un contrôleur sans compte (Ibrahima)

1. **Qui, où, quel bouton.** Mariama, `/partner/team`, bouton « Inviter un contrôleur », fenêtre « Inviter un contrôleur », « Il reçoit un code d’activation par SMS. », bouton « Inviter le contrôleur » ou « Inviter sur {n} événements », exemple « Inviter sur 2 événements ». Ou l'onglet Équipe. Preuve : `app/partner/team/page.tsx:533`, `:696-697`, `:759`, `components/partner/pilotage/TeamTab.tsx:363`.
2. **Ce qu'il saisit.** « Prénom » et « Nom », facultatifs (prénom vide : « Contrôleur ») ; « Numéro du contrôleur » ou « Téléphone du contrôleur », obligatoire ; depuis le lot 9 bis, plus de champ « Email » sur `/partner/team` ; « Événements à assigner », obligatoire dans la fenêtre ; « Encaissement des espèces » ou « Autoriser l’encaissement en espèces », coupé par défaut. Erreurs : « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » (réponse du serveur) ; « Saisissez un numéro sénégalais à 9 chiffres (par exemple 77 123 45 67). » ; « Sélectionnez au moins un événement. » ; « Trop d'invitations envoyées à ce numéro aujourd'hui (maximum 3 par jour). » ; « Limite d'invitations atteinte : maximum 20 par heure. Réessayez plus tard. » ; « Un ou plusieurs événements sélectionnés sont introuvables. » ; « Vous n'êtes pas propriétaire de tous les événements sélectionnés. » ; « Ce contrôleur ne peut pas être affecté à cet événement car l'événement n'est pas encore confirmé. » ; « Un compte existe déjà avec cet email ou ce numéro. Invitez-le par le numéro de téléphone de son profil, ou contactez le support. » ; « Impossible de créer le compte contrôleur. Vérifiez le numéro et réessayez. ». Sans événement éligible : « Aucun événement disponible », « Un contrôleur ne peut être affecté qu’à un événement validé ou publié. Faites valider un événement pour l’affecter. ». Preuve : `app/partner/team/page.tsx:12-16`, `components/partner/pilotage/TeamTab.tsx:246`, `app/api/partner/team/invite/route.ts:102`, `:110`, `:187`, `:197`, `:205`, `:213`, `:231`, `:324`, `:347`, `lib/events/event-status.ts:29`.
3. **Ce que fait le système.** Un compte est créé pour ce numéro, actif, rôle contrôleur, avec un mot de passe aléatoire et une adresse technique. Une affectation par événement. Un code à 6 chiffres, valable 24 heures. Rien de visible pour le public. Depuis le lot 9 bis, le quota de 3 invitations par jour et par numéro ne compte que les SMS réellement partis : une unité est rendue si le SMS ne part pas. Preuve : `app/api/partner/team/invite/route.ts:226-262`, `:276-286`, `:345-348`, `:376-396`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima, avec prénom saisi | SMS | indispensable | immédiat | depuis le lot 9 bis, modèle « Event Village : Bonjour {firstName}, code d'activation {code} (24 h) pour scanner les billets : {APP_URL}/controller/setup?phone={phone} » ; exemple « Event Village : Bonjour Ibrahima, code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (155 caractères, 1 segment ; prénom translittéré et coupé à 9 lettres) |
| Ibrahima, sans prénom | SMS | indispensable | immédiat | modèle « Event Village : code d'activation {code} (24 h) pour scanner les billets : {APP_URL}/controller/setup?phone={phone} » ; exemple « Event Village : code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (137 caractères, 1 segment) |
| Ibrahima | cloche | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |
| Ibrahima | push | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |

Le SMS d'affectation n'est pas envoyé si l'invitation est partie depuis moins d'une heure. Le texte de ce SMS, pour un compte déjà établi, est cité à l'étape 6.5. Depuis le lot 9 bis, l'affectation part aussi par email à un compte dont l'adresse est vérifiée. Preuve : `CONTROLLER_INVITE`, `lib/notifications/catalog.ts:1743-1748`, `M/20261105000002_lot7_sms.sql:327-333`. Preuve : `CONTROLLER_ASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:559`).

Message à l'écran de Mariama : « Contrôleur créé et assigné sur l'événement. SMS avec code d'activation envoyé. » ; plusieurs : « Contrôleur créé et assigné sur {n} événements. SMS avec code d'activation envoyé. », exemple « Contrôleur créé et assigné sur 2 événements. SMS avec code d'activation envoyé. ». Échec, depuis le lot 9 bis sans code technique : « Contrôleur créé et assigné sur l'événement. SMS non envoyé : {raison}. Renvoyez l’invitation plus tard. », exemple « Contrôleur créé et assigné sur l'événement. SMS non envoyé : le service SMS n’a pas confirmé l’envoi. Renvoyez l’invitation plus tard. ». Preuve : `app/api/partner/team/invite/route.ts:30-37`, `:512-526`.

5. **Ce que les autres voient.** Mariama : une ligne dans la liste. Depuis le lot 9 bis, la colonne « État » lit l'état réel du compte : « Activation en attente » tant qu'Ibrahima n'a pas activé, puis « Actif ». Admin : journal d'audit. Preuve : `app/partner/team/page.tsx:441-453`, `M/20261109000008_lot9bis_cycle.sql:143-144`.
6. **Ce qui est impossible.** Inviter un compte suspendu : « Ce compte est au statut SUSPENDU : il ne peut pas être invité. Seul un administrateur peut le réactiver. ». Le code n'est jamais montré à Mariama. Preuve : `lib/auth/account-status.ts:35`, `app/api/partner/team/invite/route.ts:242-249`.
7. **Test et essai.** Test : `tests/parcours/invitations-controleur-quota.test.ts:110` « numéro neuf, SMS d’activation refusé par le fournisseur : l’unité est rendue, compteur à 0 » ; `tests/parcours/textes-sms-9bis.test.ts` (invitation sur un segment) ; `tests/parcours/notif-controleurs.test.ts:364` « invitation d’un nouveau compte : SMS synchrone avec le code, journal sans code, aucun second SMS d’affectation ; setup → phone_verified_at et CONTROLLER_ACTIVATED » ; `tests/parcours/equipe-eligibilite.test.ts:133` « T4 : VALIDE et PUBLIE → 201, deux affectations (témoin) » ; `tests/parcours/equipe-eligibilite.test.ts:143` « T6 : événement d’un autre partenaire → 403, aucun compte créé, aucune affectation, aucun SMS » ; `tests/parcours/acces-limiteurs.test.ts:284` « invitation : INVITE_PER_PARTNER_HOUR par partenaire » ; `tests/parcours/acces-limiteurs.test.ts:296` « invitation : INVITE_PER_PHONE_DAY par numéro invité, tous partenaires confondus » ; `e2e/recette.spec.ts:453` « acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur ». Essai : Essai 15 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.8.

### Étape 6.2 — Activation du compte d'Ibrahima

1. **Qui, où, quel bouton.** Ibrahima, lien du SMS, `/controller/setup?phone=…`, titre « Activer votre compte contrôleur », bouton « Activer mon compte ». Preuve : `app/controller/setup/page.tsx:171`, `:257`.
2. **Ce qu'il saisit.** « Numéro de téléphone », prérempli ; « Code d’activation reçu par SMS », aide « Le code est valable 24 heures. Sans code, demandez une nouvelle invitation à votre organisateur. » ; « Mot de passe », règles « Au moins 8 caractères », « Une majuscule (A-Z) », « Une minuscule (a-z) », « Un chiffre (0-9) » ; « Confirmer le mot de passe ». Erreurs : « Indiquez le numéro qui a reçu l’invitation. » ; « Saisissez les 6 chiffres du code reçu par SMS. » ; « Le mot de passe doit comporter au moins 8 caractères, une majuscule, une minuscule et un chiffre. » ; « Les mots de passe ne correspondent pas. » ; « Trop de tentatives d’activation pour ce numéro. Réessayez plus tard. » ; « Aucun compte associé à ce numéro. » ; depuis le lot 9 bis, après la vérification du code, « Ce compte est suspendu : l’activation est impossible. Contactez l’organisateur ou le support. » ; « Aucune invitation contrôleur trouvée pour ce numéro. » ; « Impossible de définir le mot de passe. Demandez une nouvelle invitation à votre organisateur. » ; et les erreurs de code de l'étape 1.2. Bandeau « Activation impossible ». Preuve : `app/controller/setup/page.tsx:34-37`, `:103-115`, `:196-200`, `app/api/controller/setup/route.ts:53`, `:86`, `:89-95`, `:111`.
3. **Ce que fait le système.** Code consommé, mot de passe posé, numéro vérifié. Écran « Compte activé », « Connexion en cours, vous allez arriver sur le scanner. », connexion automatique vers `/controller/scanner`. Preuve : `app/api/controller/setup/route.ts:64`, `:145-151`, `:165-169`, `app/controller/setup/page.tsx:155-156`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets. » ; exemple « Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets. » (91 caractères, 1 segment) |
| Ibrahima | cloche | indispensable | prochain passage de la file | titre « Compte activé » ; modèle « Votre compte est activé : vous pouvez scanner les billets. » ; exemple « Votre compte est activé : vous pouvez scanner les billets. » |
| Ibrahima, si son adresse est vérifiée | email | indispensable | prochain passage de la file | objet « Compte activé — Event Village » ; texte « Votre compte est activé : vous pouvez scanner les billets. » |

Depuis le lot 9 bis, l'activation n'envoie plus l'alerte « mot de passe modifié » : un seul SMS. Preuve : `CONTROLLER_ACTIVATED` (`M/20261103000006_lot6_pros_admin.sql:1115`), `M/20261109000009_lot9bis_messages.sql:52-55` (`notif_on_password_changed`).

5. **Ce que les autres voient.** Mariama n'a aucun message ; depuis le lot 9 bis, le badge passe de « Activation en attente » à « Actif » à son prochain chargement.
6. **Ce qui est impossible.** Un compte déjà activé : renvoi à la connexion, « Ce compte est déjà activé : connectez-vous. ». Un compte suspendu (refus ci-dessus). Preuve : `components/auth/LoginForm.tsx:80`.
7. **Test et essai.** Test : `tests/parcours/controleur-9bis.test.ts:82` « compte coquille SUSPENDU, code valide → 403 ACCOUNT_NOT_ACTIVE, mot de passe et rôles inchangés » ; `tests/parcours/messages-sms-9bis.test.ts` (aucune alerte de mot de passe à l'activation) ; `tests/parcours/activation-controleur.test.ts:173` « stocké haché : code_hash = HMAC(numéro, code), 64 hexadécimaux ; aucune colonne ne contient le code » ; `tests/parcours/activation-controleur.test.ts:188` « lié au numéro : le code de A présenté avec le numéro de B (invité) est refusé ; le code de A reste intact et active A » ; `tests/parcours/activation-controleur.test.ts:203` « 5 mauvais essais puis le bon code : TOO_MANY_ATTEMPTS (429), compte non activé » ; `tests/parcours/activation-controleur.test.ts:250` « nouvelle invitation du même numéro (compte encore temporaire) : nouveau code par SMS, utilisable ; l’ancien est refusé » ; `tests/parcours/activation-controleur.test.ts:278` « compte établi affecté, code valide : 400 ACCOUNT_ALREADY_CONFIGURED, le mot de passe d’origine ouvre la session, le mot de passe présenté est refusé » ; `tests/parcours/notif-controleurs.test.ts:348` « notification_controller_activated : CONTROLLER_ACTIVATED (in-app, SMS) une seule fois, SMS exact » ; `e2e/recette.spec.ts:616` « acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture ». Essai : Essai 29 de `docs/recette-billetterie.md`.

### Étape 6.3 — Inviter un client existant (Awa)

1. **Qui, où, quel bouton.** Mariama, même formulaire, avec le numéro d'une cliente qui a déjà un compte.
2. **Ce qu'il saisit.** Comme à l'étape 6.1. Prénom, nom et email ne s'appliquent pas.
3. **Ce que fait le système.** Première réponse sans effet : une fenêtre « Compte existant », « Attribution du rôle de contrôleur, sans nouveau compte », affiche le nom masqué et : « Ce numéro appartient déjà à un compte Event Village ({nom masqué}). Confirmez-vous l'affectation de ce titulaire comme contrôleur de vos événements ? Son identité et ses identifiants ne seront pas modifiés. », exemple « Ce numéro appartient déjà à un compte Event Village (Aw*** D***). Confirmez-vous l'affectation de ce titulaire comme contrôleur de vos événements ? Son identité et ses identifiants ne seront pas modifiés. » ; « Un seul compte, rien n’est perdu », « Cette personne garde ses billets, commandes et son portefeuille, et accède en plus au scanner de vos événements. ». Boutons « Annuler », « Attribuer le rôle de contrôleur ». Depuis le lot 9 bis, la confirmation de Mariama ne donne **ni rôle ni affectation** : elle envoie à Awa une invitation valable 72 heures, et l'écran dit « Invitation envoyée : {nom masqué} doit l’accepter dans l’application avant d’être affecté. », exemple « Invitation envoyée : Aw*** D*** doit l’accepter dans l’application avant d’être affecté. ». Awa répond sur `/invitations`, « Invitations à contrôler », « Un organisateur vous propose de contrôler l’entrée de ses événements. Rien ne change sur votre compte tant que vous n’avez pas accepté. », boutons « Accepter l’invitation » et « Refuser ». Acceptée : rôle contrôleur et affectations aux événements encore validés ou publiés, « Invitation acceptée : vous pouvez contrôler l’entrée de ces événements. ». Refusée, après « Refuser cette invitation ? » : rien n'est fait, « Invitation refusée. ». Une nouvelle invitation de la même partenaire remplace la précédente ; une invitation échue ne s'accepte plus : « Cette invitation a expiré. ». Un compte encore jamais activé, créé par une invitation, garde le chemin de l'étape 6.1 : son activation vaut accord. Preuve : `app/api/partner/team/invite/route.ts:253-290`, `app/invitations/page.tsx:100-101`, `:175-199`, `app/api/account/controller-invitations/[id]/route.ts:56-58`, `M/20261109000008_lot9bis_cycle.sql:132-145`, `:2111`, `lib/security/mask.ts:6`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Awa, à l'envoi de l'invitation | SMS | indispensable | prochain passage de la file | depuis le lot 9 bis, modèle « Event Village : {company} vous invite à scanner les billets de {title}, et 1 autre. Répondez sur {APP_URL}/invitations » ; exemple « Event Village : Sabar Events vous invite à scanner les billets de Gala de la Teranga, et 1 autre. Répondez sur https://eventvillage.sn/invitations » (146 caractères, 1 segment) ; un seul événement « Event Village : Sabar Events vous invite à scanner les billets de Gala de la Teranga. Répondez sur https://eventvillage.sn/invitations » (134 caractères, 1 segment) |
| Awa, à l'envoi de l'invitation | cloche, push, email si l'adresse est vérifiée | indispensable | prochain passage de la file | titre « Invitation de {company} », exemple « Invitation de Sabar Events » ; modèle « {company} vous invite à contrôler l'entrée de « {title} » et 1 autre événement. Répondez avant le {expires_at}. » ; exemple « Sabar Events vous invite à contrôler l'entrée de « Gala de la Teranga » et 1 autre événement. Répondez avant le jeu. 12 nov. 2026 à 18:30. » |
| Awa, après son acceptation, un seul événement | SMS | indispensable | prochain passage de la file | modèle « Event Village : affectation à l'entrée de {title}, {start_at}. {APP_URL}/login » ; exemple « Event Village : affectation à l'entrée de Gala de la Teranga, sam. 14 nov. à 20:00. https://eventvillage.sn/login » (113 caractères, 1 segment) |
| Awa, après son acceptation, avec porte et plusieurs événements | SMS | indispensable | prochain passage de la file | modèle « Event Village : affectation à l'entrée de {title}, {start_at}, point {entry_point}, et 1 autre. {APP_URL}/login » ; exemple « Event Village : affectation à l'entrée de Gala de la Teranga, sam. 14 nov. à 20:00, point Porte Nord, et 1 autre. https://eventvillage.sn/login » (143 caractères, 1 segment) |
| Awa, après son acceptation | cloche | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |
| Awa, après son acceptation | push, et email si l'adresse est vérifiée | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |

Aucun SMS de code. Preuve : `CONTROLLER_INVITATION` (`lib/notifications/catalog.ts:1447-1472`, `M/20261109000008_lot9bis_cycle.sql:2059`), `CONTROLLER_ASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:559`).

5. **Ce que les autres voient.** Mariama : la ligne d'Awa porte « Invitation en attente » et « Jusqu’au {date} », sans affectation ni bouton « Renvoyer le SMS ». Après l'acceptation, Awa se connecte comme avant, avec un lien « Scanner les billets » en plus. Ses billets ne bougent pas. Preuve : `app/partner/team/page.tsx:444-450`, `components/layout/AppLayout.tsx:204`.
6. **Ce qui est impossible.** Affecter Awa sans son accord. Un tiers ne peut pas répondre à son invitation. Compte non actif : refus de l'étape 6.1. Numéro porté par deux comptes : « Plusieurs comptes correspondent à ce numéro. Contactez le support. ». Preuve : `app/api/partner/team/invite/route.ts:131`.
7. **Test et essai.** Test : `tests/parcours/cycle9bis-equipe.test.ts:125` « invitation confirmée par la partenaire : ni rôle ni affectation, invitation PENDING de 72 h, CONTROLLER_INVITATION par SMS » ; `tests/parcours/cycle9bis-equipe.test.ts:155` « acceptation par le titulaire : rôle CONTROLEUR, affectation, CONTROLLER_ASSIGNED gardé ; un tiers ne répond pas (404) » ; `tests/parcours/cycle9bis-equipe.test.ts:174` « refus par le titulaire : DECLINED, ni rôle ni affectation » ; `tests/parcours/equipe-eligibilite.test.ts:216` « security-fixes T2.3 : compte CLIENT → requires_confirmation sans aucun effet, puis confirm_promotion → rôle CONTROLEUR, ACTIF, affecté » ; `tests/parcours/invitation-identite.test.ts:132` « « resend » ne contourne plus la confirmation ». Essai : aucun.

### Étape 6.4 — Renvoyer l'invitation

1. **Qui, où, quel bouton.** Mariama, « Renvoyer le SMS » sur `/partner/team`, ou « Renvoyer l’invitation par SMS » dans l'onglet Équipe. Depuis le lot 9 bis, le bouton ne s'affiche que pour un compte en « Activation en attente ». Preuve : `app/partner/team/page.tsx:494-503`, `components/partner/pilotage/TeamTab.tsx:198`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Compte pas encore activé : nouveau code de 24 heures, l'ancien tombe ; le quota n'est compté que si le SMS part. Compte activé : refus, avant tout quota, « Ce contrôleur a déjà activé son compte : aucun SMS n’est renvoyé. ». Preuve : `app/api/partner/team/invite/route.ts:170-174`, `:500-506`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima, compte pas encore activé | SMS | indispensable | immédiat | modèle « Event Village : Bonjour {firstName}, code d'activation {code} (24 h) pour scanner les billets : {APP_URL}/controller/setup?phone={phone} » ; exemple « Event Village : Bonjour Ibrahima, code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (155 caractères, 1 segment ; prénom translittéré et coupé à 9 lettres) |

Compte activé : aucun message, et l'écran le dit (refus ci-dessus). Preuve : `CONTROLLER_INVITE`, `app/api/partner/team/invite/route.ts:170-174`.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Dépasser le quota : « Trop d'invitations envoyées à ce numéro aujourd'hui (maximum 3 par jour). ». Renvoyer un SMS à un compte déjà activé.
7. **Test et essai.** Test : `tests/parcours/cycle9bis-equipe.test.ts:188` « 409 ALREADY_ACTIVATED « Ce contrôleur a déjà activé son compte : aucun SMS n’est renvoyé. », avant le quota, aucun SMS » ; `tests/parcours/activation-controleur.test.ts:250` « nouvelle invitation du même numéro (compte encore temporaire) : nouveau code par SMS, utilisable ; l’ancien est refusé » ; `tests/parcours/invitation-identite.test.ts:132` « « resend » ne contourne plus la confirmation ». Essai : aucun.

### Étape 6.5 — Gérer les affectations

1. **Qui, où, quel bouton.** Mariama, `/partner/team`, bouton « Gérer », fenêtre « Gérer les affectations », « Contrôleur : {nom} », exemple « Contrôleur : Ibrahima Sow », boutons « Annuler », « Enregistrer ». Preuve : `app/partner/team/page.tsx:475`, `:658-659`.
2. **Ce qu'il saisit.** Cases « Événements autorisés ({n} sur {m} assignables) », exemple « Événements autorisés (2 sur 3 assignables) » ; depuis le lot 9 bis, « Encaissement des espèces, événement par événement » : un interrupteur « Encaisse : {titre} » par événement coché, exemple « Encaisse : Gala de la Teranga ». Un événement devenu non assignable porte « À retirer ». Preuve : `app/partner/team/page.tsx:703-707`.
3. **Ce que fait le système.** Depuis le lot 9 bis, retraits, ajouts et droits d'encaisser sont enregistrés en une seule opération : tout passe ou rien ne change. Chaque affectation garde son propre droit d'encaisser ; un enregistrement sans droit d'espèces laisse les droits en place. Message « Affectations mises à jour. ». Preuve : `app/api/partner/team/assignments/route.ts`, `M/20261109000004_lot9bis_droits.sql` (affectations en une opération, tâche 18).
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima, à l'ajout | SMS | indispensable | prochain passage de la file | modèle « Event Village : affectation à l'entrée de {title}, {start_at}, point {entry_point}, et 1 autre. {APP_URL}/login » ; exemple « Event Village : affectation à l'entrée de Gala de la Teranga, sam. 14 nov. à 20:00, point Porte Nord, et 1 autre. https://eventvillage.sn/login » (143 caractères, 1 segment) |
| Ibrahima, à l'ajout | cloche | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |
| Ibrahima, à l'ajout | push | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |
| Ibrahima, au retrait | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre affectation à l'entrée de {title} est retirée. » ; exemple « Event Village : votre affectation à l'entrée de Gala de la Teranga est retirée. » (79 caractères, 1 segment) |
| Ibrahima, au retrait | cloche | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |
| Ibrahima, au retrait | push | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |

Les rappels de la veille déjà prévus sont annulés. Preuve : `M/20261103000006_lot6_pros_admin.sql:607-610`. Preuve : `CONTROLLER_ASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:559`) ; `CONTROLLER_UNASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:588`).

5. **Ce que les autres voient.** Ibrahima : cloche, et liste de son scanner au prochain chargement.
6. **Ce qui est impossible.** Ajouter un événement non éligible. Retirer un contrôleur qui a une caisse ouverte : « Ce contrôleur a une caisse ouverte : clôturez-la avant de le retirer. ». Compte inactif : « Ce compte est au statut {statut} : il ne peut pas être affecté. Seul un administrateur peut le réactiver. », exemple « Ce compte est au statut SUSPENDU : il ne peut pas être affecté. Seul un administrateur peut le réactiver. ». Preuve : `lib/shifts/shift.service.ts:119`.
7. **Test et essai.** Test : `tests/parcours/cycle9bis-equipe.test.ts:261` « assignments [{ A, false }, { B, true }] → 200, A sans espèces, B avec » ; `tests/parcours/cycle9bis-equipe.test.ts:254` « « Gérer » sans champ d’espèces : A garde ses espèces » ; `tests/parcours/controleur-9bis.test.ts:113` « insertion refusée par une contrainte d’essai : échec et rien de changé (A toujours affecté, B non) » ; `tests/parcours/notif-controleurs.test.ts:206` « trois affectations par PATCH /api/partner/team/assignments : trois in-app, trois push, un seul SMS « et 2 autres » ; notification QUEUED » ; `tests/parcours/notif-controleurs.test.ts:236` « DELETE /api/partner/team/all : CONTROLLER_UNASSIGNED par affectation, un SMS agrégé, rappels PENDING du compte annulés NO_LONGER_ASSIGNED » ; `tests/parcours/equipe-eligibilite.test.ts:186` « anti-contournement { controllerId, eventId } : brouillon 400, événement d’un autre 403, publié 200 » ; `tests/parcours/equipe-eligibilite.test.ts:199` « T12 : retrait d’affectations sur des événements devenus SUSPENDU et TERMINE → 200, seule l’affectation gardée reste » ; `tests/parcours/acces-caisse-pin.test.ts:439` « ${p.label} : refusé (${p.kind === 'route' ? '409 ' : ''}CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés ». Essai : aucun essai numéroté, `docs/essai-local.md` section 8.8.

### Étape 6.6 — Droit d'encaisser

1. **Qui, où, quel bouton.** Mariama, onglet Équipe, interrupteur « Espèces autorisées » ou « Espèces non autorisées », propre à une affectation. Texte : « Chaque scan garde le point d’entrée du contrôleur ; la permission espèces vaut pour cette affectation seulement. ». Preuve : `components/partner/pilotage/TeamTab.tsx:59`, `:372`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Messages « {nom} peut encaisser des espèces. », « {nom} ne peut plus encaisser d’espèces. », exemples « Ibrahima Sow peut encaisser des espèces. », « Ibrahima Sow ne peut plus encaisser d’espèces. ». Si une caisse est ouverte : « Une caisse est encore ouverte pour ce contrôleur : elle devra être clôturée normalement. ». Preuve : `components/partner/pilotage/TeamTab.tsx:111-112`, `M/20261102000005_lot5_pilotage.sql:967`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Preuve : `M/20261103000006_lot6_pros_admin.sql:542-543`.

5. **Ce que les autres voient.** Ibrahima : les onglets Guichet et Caisse apparaissent ou disparaissent au prochain relevé de ses affectations. Preuve : `app/controller/scanner/page.tsx:829-830`.
6. **Ce qui est impossible.** Depuis le lot 9 bis, un admin peut régler ce droit s'il a la permission `events.write` ; sans elle : « Action non autorisée : votre compte n’a pas la permission « Gérer les événements ». ». Autre partenaire : « Affectation introuvable. ». Preuve : `M/20261109000004_lot9bis_droits.sql` (`event_controller_set_cash`).
7. **Test et essai.** Test : `tests/parcours/pilotage-equipe-caisse.test.ts:94` « propriétaire : permission espèces de cette seule affectation, journalisée, visible dans l’onglet Équipe » ; `tests/parcours/pilotage-equipe-caisse.test.ts:112` « partenaire B : 404 sans effet ; admin : refusé ; corps invalide : 400 ; affectation inconnue : 404 » ; `tests/parcours/acces-encaissement.test.ts:69` « ouverture de caisse : partenaire propriétaire et admin ouvrent leur caisse ; contrôleur sans permission espèces refusé ». Essai : Essai 15 de `docs/recette-billetterie.md`.

### Étape 6.7 — Point d'entrée

1. **Qui, où, quel bouton.** Mariama, onglet Équipe, champ « Point d’entrée », exemple « Porte Nord, Entrée VIP… », bouton « Enregistrer ». Preuve : `components/partner/pilotage/TeamTab.tsx:178-188`.
2. **Ce qu'il saisit.** 80 caractères au plus. Erreur : « Point d’entrée invalide (80 caractères au plus). ». Preuve : `app/api/partner/team/entry-point/route.ts:31`.
3. **Ce que fait le système.** La porte est recopiée sur chaque scan. Messages « Point d’entrée de {nom} : {valeur}. », exemple « Point d’entrée de Ibrahima Sow : Porte Nord. », ou « Point d’entrée de {nom} effacé. ».
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Le rappel de la veille portera la valeur du moment.

5. **Ce que les autres voient.** Scanner : « Votre porte : {valeur}. Le compteur affichera les entrées de cette porte. », exemple « Votre porte : Porte Nord. Le compteur affichera les entrées de cette porte. ». Compteur : « Porte {valeur} : {n} entrées » ; depuis le lot 9 bis, « Porte » n'est ajouté que si la valeur ne commence pas déjà par un nom d'entrée : avec cette saisie, « Porte Nord : 12 entrées ». Preuve : `components/scan/ScannerStartScreen.tsx:90`, `app/api/controller/scans/route.ts:24-30`.
6. **Ce qui est impossible.** « Ce contrôleur n’est pas affecté à cet événement. ». Preuve : `app/api/partner/team/entry-point/route.ts:58`.
7. **Test et essai.** Test : `tests/parcours/scan-controleur-stats.test.ts:243` « porte nommée : door_entries = entrées acceptées de la porte A (2 contrôleurs), my_entries, my_refusals, refus ventilés, « Porte A » » ; `tests/parcours/scan-controleur-stats.test.ts:318` « entry_point et counter_sale_enabled de l’affectation ; entrée de la veille à 23 h 50 comptée dans les arrivées » ; `e2e/recette.spec.ts:453` « acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur ». Essai : aucun.

### Étape 6.8 — Code PIN régisseur

1. **Qui, où, quel bouton.** Mariama, `/partner/events/{id}?tab=caisse`, section « Code PIN régisseur », depuis le lot 9 bis « Le PIN est exigé à l’ouverture de chaque caisse et co-signe une clôture avec écart. Il n’est affiché qu’une fois, à sa génération. » ; sans code : « Aucun code PIN : vos contrôleurs ne peuvent ni ouvrir ni clôturer de caisse. » ; bouton « Générer le code PIN » ou « Régénérer le code PIN ». Fenêtre « Générer un nouveau code PIN ? », « L’ancien code cesse aussitôt d’être valable. Le nouveau code ne sera affiché qu’une seule fois. », bouton « Générer le code ». Le régisseur n'est pas un compte : c'est un code par événement. Preuve : `components/partner/pilotage/CashTab.tsx:163`, `:180`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Un code à 6 chiffres, chiffré. Fenêtre « Nouveau code PIN régisseur », « Notez-le maintenant : il ne sera plus affiché. », boutons « Copier le code », « J’ai noté le code ». Ensuite : « Un code est en place depuis le {date}. », exemple « Un code est en place depuis le 10 novembre 2026. ». Preuve : `lib/shifts/shift.service.ts:259-263`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Rien pour le contrôleur : le code se transmet de vive voix. Depuis le lot 9 bis, il le saisit à l'ouverture de chaque caisse (étape 11.1).
6. **Ce qui est impossible.** Relire le code. Avec une caisse ouverte : « Des caisses sont ouvertes », « Une caisse est ouverte : son contrôleur devra utiliser le nouveau code pour clôturer. », bouton « Générer quand même ». Autre partenaire : « Non autorisé à générer le code PIN pour cet événement. ». Preuve : `components/partner/pilotage/CashTab.tsx:191-199`.
7. **Test et essai.** Test : `tests/parcours/acces-caisse-pin.test.ts:220` « régénération sans { confirm: true } : refusée, PIN inchangé ; partenaire non propriétaire refusé » ; `tests/parcours/acces-caisse-pin.test.ts:236` « caisse ouverte : 409 OPEN_SHIFTS, puis acceptée avec confirmOpenShifts ; chaque génération journalisée sans PIN ni haché » ; `tests/parcours/acces-caisse-pin.test.ts:264` « haché = HMAC(REGISSEUR_PIN_KEY, regisseur-pin:v2:<événement>:<sel>:<pin>), sel propre à chaque événement » ; `tests/parcours/pin-regisseur.test.ts:12` « PIN régisseur : génération, vérification du bon PIN, refus d'un PIN erroné » ; `tests/parcours/pin-regisseur.test.ts:28` « PIN régisseur : un partenaire non propriétaire ne peut pas générer le PIN ». Essai : Essai 15 de `docs/recette-billetterie.md`.

### Étape 6.9 — Retirer un contrôleur d'un événement

1. **Qui, où, quel bouton.** Mariama, croix sur l'événement, fenêtre « Retirer de cet événement ? », « {nom} ne pourra plus contrôler « {titre} ». Ses autres affectations et l’historique de ses scans sont conservés. », exemple « Ibrahima Sow ne pourra plus contrôler « Gala de la Teranga ». Ses autres affectations et l’historique de ses scans sont conservés. », bouton « Retirer de l’événement ». Preuve : `app/partner/team/page.tsx:453`, `components/partner/pilotage/TeamTab.tsx:394-395`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** L'affectation est supprimée. Le rôle contrôleur reste. Preuve : `app/api/partner/team/[eventId]/route.ts:1`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre affectation à l'entrée de {title} est retirée. » ; exemple « Event Village : votre affectation à l'entrée de Gala de la Teranga est retirée. » (79 caractères, 1 segment) |
| Ibrahima | cloche | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |
| Ibrahima | push | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |

Preuve : `CONTROLLER_UNASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:588`).

5. **Ce que les autres voient.** Ibrahima, à la relecture : « Contrôle précédent non repris », « Vous n’êtes plus affecté à l’événement que vous contrôliez : choisissez un événement. ». Avant la relecture, chaque scan donne « Contrôle non autorisé ». Sans affectation : « Aucun événement assigné », « Vous serez informé lorsqu’un nouvel événement vous sera assigné. ». Preuve : `app/controller/scanner/page.tsx:323`, `:773-775`, `:799`.
6. **Ce qui est impossible.** Caisse ouverte : refus de l'étape 6.5. « Affectation introuvable pour cet événement. » ; « Non autorisé à modifier l’équipe de cet événement. ».
7. **Test et essai.** Test : `tests/parcours/dette-retrait-controleur.test.ts:226` « affectation de A2 appelée sous l’URL de A1 (même propriétaire) → 404 ASSIGNMENT_NOT_FOUND, affectation intacte » ; `tests/parcours/dette-retrait-controleur.test.ts:237` « affectation absente → 404 (plus de 200 « déjà retirée ») » ; `tests/parcours/dette-retrait-controleur.test.ts:243` « garde-fou : bonne URL → 200, affectation retirée, l’autre affectation reste » ; `tests/parcours/acces-caisse-pin.test.ts:439` « ${p.label} : refusé (${p.kind === 'route' ? '409 ' : ''}CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés ». Essai : aucun.

### Étape 6.10 — Retirer de tous les événements

1. **Qui, où, quel bouton.** Mariama, icône « Retirer de tous les événements », fenêtre « Retirer de tous vos événements ? », « {nom} sera retiré de {n} événements. Son compte et son historique restent intacts. », exemple « Ibrahima Sow sera retiré de 2 événements. Son compte et son historique restent intacts. ». Preuve : `app/partner/team/page.tsx:489`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Seulement les événements de ce partenaire. Le rôle reste. Message « Contrôleur retiré de {n} événement(s) du partenaire. », exemple « Contrôleur retiré de 2 événement(s) du partenaire. ». Preuve : `app/api/partner/team/all/route.ts:339`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima, SMS regroupé | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre affectation à l'entrée de {title} est retirée, et 1 autre. » ; exemple « Event Village : votre affectation à l'entrée de Gala de la Teranga est retirée, et 1 autre. » (91 caractères, 1 segment) |
| Ibrahima, SMS regroupé | cloche | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |
| Ibrahima, SMS regroupé | push | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |

Preuve : `CONTROLLER_UNASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:588`).

5. **Ce que les autres voient.** Comme à l'étape 6.9.
6. **Ce qui est impossible.** Une caisse ouverte sur l'un d'eux : rien n'est retiré.
7. **Test et essai.** Test : `tests/parcours/notif-controleurs.test.ts:236` « DELETE /api/partner/team/all : CONTROLLER_UNASSIGNED par affectation, un SMS agrégé, rappels PENDING du compte annulés NO_LONGER_ASSIGNED ». Essai : aucun.

### Étape 6.11 — Supprimer le contrôleur de l'équipe

1. **Qui, où, quel bouton.** Mariama, icône « Supprimer de l’équipe », fenêtre « Supprimer le contrôleur de l’équipe ? », depuis le lot 9 bis « {nom} ne contrôlera plus vos événements. S’il ne contrôle pour aucun autre organisateur, son accès au scanner est fermé aussitôt. Pour le réintégrer, invitez-le à nouveau. », exemple « Ibrahima Sow ne contrôlera plus vos événements. S’il ne contrôle pour aucun autre organisateur, son accès au scanner est fermé aussitôt. Pour le réintégrer, invitez-le à nouveau. », bouton « Supprimer le contrôleur ». Preuve : `app/partner/team/page.tsx:517`, `:666-668`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Les affectations de ce partenaire sont supprimées. S'il n'en reste aucune ailleurs, le rôle contrôleur est retiré, les sessions fermées. Depuis le lot 9 bis, la marque « compte jamais activé » n'est retirée que si le compte a été activé : un contrôleur jamais activé, supprimé puis réinvité, reçoit de nouveau un code d'activation. Le compte reste actif. Message « Contrôleur retiré de l’équipe. ». Preuve : `M/20261102000002_lot5_dette.sql:356`, `app/api/partner/team/controller/[controllerId]/route.ts:104-115`, `:140`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre affectation à l'entrée de {title} est retirée. » ; exemple « Event Village : votre affectation à l'entrée de Gala de la Teranga est retirée. » (79 caractères, 1 segment) |
| Ibrahima | cloche | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |
| Ibrahima | push | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |

Preuve : `CONTROLLER_UNASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:588`).

5. **Ce que les autres voient.** Ibrahima est renvoyé à la connexion si son rôle est retiré. Une cliente promue garde ses billets et redevient cliente.
6. **Ce qui est impossible.** Caisse ouverte : refus. « Ce contrôleur ne fait pas partie de cette équipe. » ; « Rôle Contrôleur retiré, mais la révocation des sessions a échoué. Réessayez. ».
7. **Test et essai.** Test : `tests/parcours/dette-retrait-controleur.test.ts:188` « partenaire B qui vise le contrôleur de A → 404 CONTROLLER_NOT_IN_TEAM ; rien retiré, ni SMS ni notification » ; `tests/parcours/dette-retrait-controleur.test.ts:214` « garde-fou : le partenaire A retire son contrôleur → 200, affectations de A supprimées » ; `tests/parcours/dette-retrait-controleur.test.ts:267` « T3 : retrait de la dernière affectation → rôle CLIENT, statut ACTIF (jamais SUSPENDU), commande intacte » ; `tests/parcours/dette-retrait-controleur.test.ts:283` « T5 : après retrait total, une ré-invitation redemande la confirmation, puis rend le rôle sans conflit » ; `tests/parcours/cycle9bis-equipe.test.ts:217` « réinvitation → un code d’activation au numéro ; /api/controller/setup avec ce code → 200 ». Essai : aucun.

### Étape 6.12 — Contrôleur partagé entre deux partenaires

1. **Qui, où, quel bouton.** Mariama et un second partenaire invitent le même numéro, chacun sur ses événements.
2. **Ce qu'il saisit.** Comme à l'étape 6.1. Le second n'a pas la confirmation si la personne est déjà contrôleur ; après le lot 9 bis, elle est alors affectée sans invitation à accepter (point ouvert du lot). Preuve : `app/api/partner/team/invite/route.ts:253`.
3. **Ce que fait le système.** Une affectation par événement. Chaque partenaire ne voit que les siennes. Espèces et porte sont propres à chaque affectation. Compte encore non activé : l'invitation du second émet un nouveau code et le premier tombe. Un retrait par l'un ne touche que ses affectations ; le rôle reste tant qu'il en existe ailleurs. Preuve : `app/api/partner/team/all/route.ts:132-137`, `app/api/partner/team/invite/route.ts:181`, `:390-396`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima, compte non activé, nouvelle invitation | SMS | indispensable | immédiat | modèle « Event Village : Bonjour {firstName}, code d'activation {code} (24 h) pour scanner les billets : {APP_URL}/controller/setup?phone={phone} » ; exemple « Event Village : Bonjour Ibrahima, code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (155 caractères, 1 segment ; prénom translittéré et coupé à 9 lettres) |
| Ibrahima, à chaque invitation | cloche | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |
| Ibrahima, à chaque invitation | push | indispensable | prochain passage de la file | titre « Nouvelle affectation » ; modèle « Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. » ; exemple « Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé. » |

Aucun message ne signale le partage. Preuve : `CONTROLLER_ASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:559`).

5. **Ce que les autres voient.** Scanner : tous les événements affectés, ceux ouverts au contrôle d'abord. Preuve : `app/controller/scanner/page.tsx:309`.
6. **Ce qui est impossible.** Agir sur les affectations de l'autre. Le quota de 3 invitations par jour et par numéro est commun aux partenaires. Preuve : `lib/env.ts:86`.
7. **Test et essai.** Test : `tests/parcours/dette-retrait-controleur.test.ts:176` « admin avec ?partnerId=A → retrait réel des affectations de A seulement (celle de B reste) » ; `tests/parcours/dette-retrait-controleur.test.ts:188` « partenaire B qui vise le contrôleur de A → 404 CONTROLLER_NOT_IN_TEAM ; rien retiré, ni SMS ni notification » ; `tests/parcours/acces-limiteurs.test.ts:296` « invitation : INVITE_PER_PHONE_DAY par numéro invité, tous partenaires confondus ». Essai : aucun.

# Chapitre 7. L'achat

### Étape 7.1 — Le visiteur non connecté veut acheter

1. **Qui, où, quel bouton.** Le visiteur, `/events/{id}`, bloc « Choisissez vos billets », boutons + et − de chaque catégorie, puis bouton d'achat. Preuve : `app/events/[id]/page.tsx:934`, `:1041-1051`.
2. **Ce qu'il saisit.** Des quantités. Au clic sur l'achat sans compte : message « Connectez-vous pour acheter un billet. », renvoi vers la connexion. L'adresse de retour est encodée dans le lien : la barre d'adresse affiche `/login?redirect=%2Fevents%2F{id}`, exemple `/login?redirect=%2Fevents%2F7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`, et la connexion ramène ensuite sur `/events/{id}`. Le même renvoi a lieu si la session expire au moment de payer. Preuve : `app/events/[id]/page.tsx:690-697`, `:738-742`.
3. **Ce que fait le système.** Rien n'est enregistré. Le total se calcule sans compte. Depuis le lot 9 bis, le panier est gardé 30 minutes dans cet onglet du navigateur pendant la connexion, et retrouvé au retour sur la fiche ; s'il ne peut pas l'être : « Le panier précédent n’a pas pu être repris : choisissez à nouveau vos billets. ». Preuve : `app/api/checkout/quote/route.ts:14`, `app/events/[id]/page.tsx:208-231`, `:511`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Payer sans compte : « Authentification requise. ». Compte non actif : « Votre compte n'est pas actif. Contactez le support. ». Preuve : `lib/auth/session.ts:54`, `:60`.
7. **Test et essai.** Test : `tests/schema/textes-techniques-9bis.test.ts` (panier gardé pendant la connexion) ; `tests/parcours/finance-affichage.test.ts:80` « A41 : le middleware laisse passer le devis d’un visiteur sans session ; le paiement reste protégé » ; `e2e/recette.spec.ts:487` « acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert ». Essai : Essais 3 et 5 de `docs/recette-billetterie.md`.

### Étape 7.2 — Choisir ses billets, plusieurs catégories, frais affichés

1. **Qui, où, quel bouton.** Fatou, `/events/{id}`, boutons « Ajouter un billet {nom} », exemple « Ajouter un billet VIP », et « Retirer un billet {nom} ». Plusieurs catégories dans un même panier. Preuve : `app/events/[id]/page.tsx:962`, `:973`.
2. **Ce qu'il saisit.** La quantité de chaque catégorie, plafonnée par le maximum par commande et, quand il reste peu de places, par le restant. Sous le prix : « {qté} × {prix} : {sous-total} », exemple « 2 × 5 000 F CFA : 10 000 F CFA ». Récapitulatif : « Billets », « Frais de service », « Total ({n} billet{s}) », exemple « Total (2 billets) ». Aides : « Paiement Wave ou Orange Money. Frais de service calculés par Event Village sur chaque billet. », « Billet avec QR code émis dès le paiement ». Panier vide : « Choisissez au moins un billet avec le bouton « + ». ». Erreurs : « Total indisponible » avec « Réessayer », « Le total n’a pas pu être calculé (erreur {n}). », exemple « Le total n’a pas pu être calculé (erreur 500). », « Connexion impossible : le total n’a pas pu être calculé. ». Preuve : `app/events/[id]/page.tsx:500`, `:564`, `:579`, `:985`, `:999-1014`, `:1030-1034`, `:1054-1064`.
3. **Ce que fait le système.** Le total est demandé au serveur 250 ms après le dernier clic. Frais par billet : prix × taux, arrondi au franc supérieur. Taux par défaut 5 % : 1 000 F donne 50 F de frais, soit 1 050 F. Un billet gratuit du panier n'a aucun frais. Rien n'est enregistré ni réservé. Preuve : `M/20261101000003_lot3_moteur.sql:39`, `M/20261101000002_lot3_reglages.sql:61-62`, `app/events/[id]/page.tsx:581`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** La fiche se recharge seule quand le stock ou le statut change. Preuve : `app/events/[id]/page.tsx:418-426`.
6. **Ce qui est impossible.** Dépasser la limite par commande : le bouton + se désactive. Une catégorie étrangère : « Catégorie inconnue pour cet événement ou quantité invalide. ». Preuve : `app/events/[id]/page.tsx:976`.
7. **Test et essai.** Test : `tests/parcours/finance-affichage.test.ts:87` « route publique : sous-total, frais de service (FCFA supérieur par billet), total, détail par ligne » ; `tests/parcours/finance-affichage.test.ts:112` « un seul montant : devis = montant envoyé à SamirPay = payments.amount = route de statut » ; `tests/parcours/finance-affichage.test.ts:170` « page événement : demande le devis au serveur et ne transmet plus le total calculé dans le navigateur » ; `tests/parcours/paiement-controles.test.ts:53` « 11 billets pour max_per_order = 10 → 400, aucun paiement, aucun appel SamirPay ». Essai : Essais 17, 21 et 22 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.3.

### Étape 7.3 — Billet gratuit

1. **Qui, où, quel bouton.** Fatou, `/events/{id}`, panier entièrement à 0 F. Bouton « Réserver {n} billet{s} gratuit{s} », exemple « Réserver 2 billets gratuits », « Réserver ({n}) » sur mobile. Preuve : `app/events/[id]/page.tsx:710`.
2. **Ce qu'il saisit.** Aucun : ni opérateur, ni numéro. Refus : ceux de l'étape 7.13 ; « Limite de {n} billet(s) gratuit(s) « {catégorie} » par compte atteinte. », exemple « Limite de 10 billet(s) gratuit(s) « Entrée libre » par compte atteinte. » ; « Trop de tentatives d’achat : réessayez plus tard. ». Preuve : `lib/payments/checkout.service.ts:175`, `M/20261105000007_lot7_confirmation.sql:205`.
3. **Ce que fait le système.** Le stock est pris, des billets « Valable » sont créés à 0 F. Aucun paiement. Message « {n} billets gratuits réservés. » ou « Billet gratuit réservé. », puis Mes billets. Preuve : `app/events/[id]/page.tsx:656`, `M/20261105000007_lot7_confirmation.sql:205`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, numéro du compte | SMS | indispensable | prochain passage de la file | modèle « Event Village : {ticket_count} billets gratuits pour {title} le {start_at}. Vos billets : {APP_URL}/tickets » ; exemple « Event Village : 2 billets gratuits pour Gala de la Teranga le sam. 14 nov. à 20:00. Vos billets : https://eventvillage.sn/tickets » (129 caractères, 1 segment) |
| Fatou, numéro du compte | cloche | indispensable | prochain passage de la file | titre « Billets confirmés » ; modèle « {ticket_count} billets gratuits pour « {title} » le {start_at}. Vos billets sont dans Mes billets. » ; exemple « 2 billets gratuits pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00. Vos billets sont dans Mes billets. » |
| Fatou, si son adresse est vérifiée (depuis le lot 9 bis) | email | indispensable | prochain passage de la file | objet « Billets confirmés — Event Village » ; modèle : Billets confirmés<br>{ticket_count} billets gratuits pour « {title} » le {start_at}. Vos billets sont dans Mes billets.<br>Événement : {title}<br>Date : {start_at}<br>Lieu : {location}, {city}<br>Billets gratuits : 1 × Entree libre, 1 × Invitation<br>Numéros de billets :<br>- TCK-20261104-5B7D9F1A3C<br>- TCK-20261104-6C8E0A2B4D<br>Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.<br>Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.<br>Voir mes billets : {APP_URL}/tickets<br>En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Billets confirmés<br>2 billets gratuits pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00. Vos billets sont dans Mes billets.<br>Événement : Gala de la Teranga<br>Date : sam. 14 nov. 2026 à 20:00<br>Lieu : CICAD, Diamniadio<br>Billets gratuits : 1 × Entree libre, 1 × Invitation<br>Numéros de billets :<br>- TCK-20261104-5B7D9F1A3C<br>- TCK-20261104-6C8E0A2B4D<br>Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.<br>Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.<br>Voir mes billets : https://eventvillage.sn/tickets<br>En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Preuve : `FREE_TICKETS_CONFIRMED` (`M/20261105000007_lot7_confirmation.sql:263`, `app/api/tickets/claim-free/route.ts:46`, `lib/payments/checkout.service.ts:195`).

5. **Ce que les autres voient.** Stock public mis à jour. Mariama n'a aucun « premier billet vendu », réservé aux ventes en ligne et au guichet. Dernière place : étape 7.14. Preuve : `M/20261103000005_lot6_billetterie.sql:860-863`.
6. **Ce qui est impossible.** Dépasser la limite par compte.
7. **Test et essai.** Test : `tests/parcours/paiement-gratuits.test.ts:86` « panier 100 % gratuit par /api/checkout : billets émis tout de suite, aucun paiement, aucun appel à SamirPay (cas T1 porté) » ; `tests/parcours/paiement-gratuits.test.ts:70` « claim-free : tentatives répétées et simultanées → jamais au-delà de la limite par compte et par catégorie » ; `tests/parcours/paiement-gratuits.test.ts:107` « claim-free après épuisement : 409 INSUFFICIENT_STOCK, aucun billet, stock inchangé (cas T1.2 porté) » ; `tests/parcours/rappels-gratuits.test.ts:240` « FREE_TICKETS_CONFIRMED garde son SMS sous NEVER (couverture : déjà vrai) ». Essai : Essai 20 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.5.

### Étape 7.4 — Panier mixte, payant et gratuit

1. **Qui, où, quel bouton.** Fatou, même page. Au moins un billet payant : bouton « Acheter {n} billet{s} ({total}) », exemple « Acheter 3 billets (10 500 F CFA) ». Preuve : `app/events/[id]/page.tsx:697-698`, `:711`.
2. **Ce qu'il saisit.** Comme à l'étape 7.5.
3. **Ce que fait le système.** Tout le panier passe par le paiement. Les billets gratuits sont réservés, puis émis à la confirmation. La limite par compte des billets gratuits ne s'applique pas ici. Preuve : `M/20261102000002_lot5_dette.sql:48`, `M/20261105000006_lot7_client.sql:24`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

À cette étape, aucun. Une seule confirmation part ensuite (étape 7.7).

5. **Ce que les autres voient.** Comme à l'étape 7.7.
6. **Ce qui est impossible.** Un panier partiel : une catégorie fautive refuse tout le panier.
7. **Test et essai.** Test : `tests/parcours/paiement-gratuits.test.ts:48` « panier mixte dont le paiement échoue : aucun billet gratuit émis » ; `tests/parcours/paiement-gratuits.test.ts:59` « panier mixte confirmé : payants et gratuits émis ensemble, une seule fois » ; `tests/parcours/paiement-reservation.test.ts:57` « panier partiel (une catégorie épuisée) : rien n’est réservé, aucun paiement » ; `tests/parcours/canaux-vente.test.ts:304` « 2 bis. panier mixte : refusé en entier, seule la catégorie fautive est citée, aucune réservation sur l’autre ». Essai : aucun.

### Étape 7.5 — Lancer le paiement

1. **Qui, où, quel bouton.** Fatou, fenêtre « Paiement sécurisé », « Mobile Money, par SamirPay », bouton « Payer {total} avec {opérateur} », exemple « Payer 10 500 F CFA avec Wave ». Preuve : `components/payment/PaymentModal.tsx:488`, `:500-501`.
2. **Ce qu'il saisit.** « Moyen de paiement * » : Wave ou Orange Money, rien de présélectionné. « Numéro {opérateur} du payeur * », exemple « Numéro Wave du payeur * », prérempli. Récapitulatif « Prix des billets », « Frais de service ({taux} %) », exemple « Frais de service (5 %) », « Total à payer ». Erreurs : « Choisissez l’opérateur avec lequel vous allez payer. » ; « Le numéro du payeur est obligatoire. » ; « Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78. ». Textes : « Vos billets restent réservés pendant le paiement ; le temps restant s’affiche à l’étape suivante. », « Paiement sécurisé par SamirPay. Votre code secret ne vous sera jamais demandé ici. ». Preuve : `components/payment/PaymentModal.tsx:279-281`, `:567-577`, `:652`, `:707`, `:715`, `:777`, `:789`.
3. **Ce que fait le système.** Paiement « en attente », places réservées pendant la durée de garde, depuis le lot 9 bis un réglage du SUPERADMIN (10 minutes par défaut, de 5 à 60, étape 18.4), appel à l'opérateur par SamirPay. Chaque demande porte une référence unique ; si SamirPay ne répond pas à temps, une seule relance part avec la même référence, et un doublon signalé par SamirPay reprend la transaction existante. Écran « {opérateur} est ouvert » ou « Demande {opérateur} créée », exemples « Wave est ouvert », « Demande Wave créée », « Réservation valable jusqu’à {heure} », exemple « Réservation valable jusqu’à 18:45 », puis renvoi vers `/paiement/{id}`. La réaction réelle de SamirPay est NON VÉRIFIÉ : aucun appel distant n'a été fait, seul le comportement du code est décrit. Preuve : `lib/payments/checkout.service.ts:101-117`, `:252`, `lib/payments/cashin-init.ts`, `components/payment/PaymentModal.tsx:519-533`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

L'opérateur peut demander une validation sur le téléphone : c'est hors de l'application.

5. **Ce que les autres voient.** Le stock public baisse. Mariama : prix verrouillé tant que la place est réservée. Preuve : `app/api/events/[id]/route.ts:123`, `components/events/EventTicketing.tsx:174-179`.
6. **Ce qui est impossible.** Titres d'échec : « Un paiement est déjà en attente », « Connexion impossible », « Session expirée », « Trop de tentatives », « Plus assez de places », « Panier à ajuster », « Paiement refusé », « Service de paiement indisponible », « Paiement non lancé ». Textes : « Le serveur est injoignable. Vérifiez votre connexion puis réessayez : votre demande ne sera pas dupliquée. » ; « Le prix a changé : rechargez la page. » ; « Paiement refusé par l’opérateur. Vérifiez le numéro et le solde du compte {opérateur}, ou choisissez l’autre opérateur. », exemple « Paiement refusé par l’opérateur. Vérifiez le numéro et le solde du compte Wave, ou choisissez l’autre opérateur. » ; « Le service de paiement ne répond pas : réessayez. » ; depuis le lot 9 bis, si SamirPay répond par une erreur interne (par exemple un montant sous le minimum de son compte), « Le paiement n’a pas pu être lancé. Réessayez dans quelques minutes ; si le problème continue, contactez le support. », sans relance automatique ; « Trop de tentatives d’achat. Réessayez dans {délai}. », exemple « Trop de tentatives d’achat. Réessayez dans 12 minutes. ». Preuve : `components/payment/PaymentModal.tsx:212-220`, `:393`, `:417`, `lib/payments/checkout.service.ts:317`, `lib/payments/cashin-init.ts:24`, `:41`, `lib/payments/payment-client.ts:246`.
7. **Test et essai.** Test : `tests/parcours/paiement-operateur.test.ts:27` « ${operator} : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface » ; `tests/parcours/paiement-operateur.test.ts:44` « interface : choix Wave / Orange Money obligatoire, aucune option carte, libellés selon l’opérateur » ; `tests/parcours/paiement-controles.test.ts:72` « opérateur absent, carte bancaire, téléphone payeur invalide → 400, aucun paiement » ; `tests/parcours/paiement-controles.test.ts:85` « double soumission (même Idempotency-Key, en parallèle) → un seul paiement, un seul appel SamirPay » ; `tests/parcours/paiement-controles.test.ts:98` « limite de checkout par compte (quota en base) → 429 » ; `tests/parcours/paiement-reservation.test.ts:37` « deux acheteurs simultanés pour la dernière place : une réservation, un refus avant tout appel SamirPay, aucune survente » ; `tests/parcours/paiement-reservation.test.ts:69` « refus SamirPay dans la réponse : paiement FAILED, réservation libérée » ; `tests/parcours/paiement-reservation-v12.test.ts:62` « 1. réglage à 7 minutes : places gardées 7 minutes ; statut : holdMinutes 7 et paymentDeadline = création + 60 minutes » ; `tests/parcours/paiement-reservation-v12.test.ts:88` « 3. sans modification : 10 minutes » ; `tests/parcours/paiement-init-relance.test.ts` (relance unique avec la même référence, reprise d'un doublon) ; `tests/parcours/paiement-prix-minimum.test.ts:118` « 4. faux « internal-error » : 502 PAYMENT_PROVIDER_INTERNAL, texte exact, paiement FAILED non définitif, un seul appel ». Essai : Essai 16 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.3.

### Étape 7.6 — La page d'attente

1. **Qui, où, quel bouton.** Fatou, `/paiement/{id}`. Boutons « Rouvrir {opérateur} » ou « Ouvrir {opérateur} », exemple « Rouvrir Wave », et « Annuler le paiement ». Preuve : `app/paiement/[id]/page.tsx:852`, `:934`.
2. **Ce qu'il saisit.** Aucun. Sur téléphone, lien vers l'application de l'opérateur. Sur ordinateur, « Scannez avec {opérateur} », exemple « Scannez avec Wave », et un QR de paiement. Preuve : `app/paiement/[id]/page.tsx:836`.
3. **Ce que fait le système.** Lecture du statut toutes les 3 secondes, onglet visible. Écran : pastille « En attente », « Validez le paiement », « Confirmez le paiement de {montant} dans {opérateur}. Cette page se met à jour automatiquement. », exemple « Confirmez le paiement de 10 500 F CFA dans Wave. Cette page se met à jour automatiquement. » ; étapes « Demande envoyée », « Validation {opérateur} », « Confirmation » ; depuis le lot 9 bis, « Places gardées encore » avec un décompte, puis « Vos places sont gardées {n} minutes. Validez le paiement sur votre téléphone avant l’échéance. Échéance à {heure}. », exemple « Vos places sont gardées 10 minutes. Validez le paiement sur votre téléphone avant l’échéance. Échéance à 18:40. ». Bloc « Ce que vous allez recevoir » : « Dès la confirmation : », « Un SMS de confirmation au {numéro masqué} », « Un email de confirmation, avec le détail de l’achat », « Une notification dans Event Village ». Enfin : « Gardez cette page ouverte pour suivre la confirmation. Si elle se ferme, votre achat est quand même enregistré : vous recevrez un SMS au {numéro masqué} et vos billets apparaîtront dans Mes billets. ». Preuve : `app/paiement/[id]/page.tsx:246-252`, `:833-857`, `components/payment/PaymentWaitingInfo.tsx:35-38`, `:52`, `:113-114`, `app/api/payments/[transactionId]/status/route.ts:114-118`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Sur la fiche, Fatou voit « Un paiement est déjà en attente pour cet événement », « Paiement de {montant} par {opérateur} à valider avant {heure}. Suivez-le au lieu d’en lancer un autre : vos billets arrivent dès sa confirmation. », exemple « Paiement de 10 500 F CFA par Wave à valider avant 18:45. Suivez-le au lieu d’en lancer un autre : vos billets arrivent dès sa confirmation. », bouton « Suivre le paiement ». Preuve : `components/payment/PendingPaymentBanner.tsx:115-131`.
6. **Ce qui est impossible.** Autre compte : « Paiement introuvable », « Ce paiement n’existe pas ou n’est pas associé à votre compte. Vérifiez que vous êtes connecté avec le bon compte. ». Adresse mal formée : « Lien de paiement invalide ». Sans session : « Connexion requise ». Réseau : « Connexion instable : nouvelle vérification automatique dans quelques secondes. ». Preuve : `app/paiement/[id]/page.tsx:664`, `:692`, `:713-714`, `:787`.
7. **Test et essai.** Test : `tests/parcours/paiement-retour.test.ts:38` « page /paiement/[id] : sonde la route de statut, affiche les trois états, renvoie vers le billet, permet l’annulation » ; `tests/parcours/paiement-statut.test.ts:28` « sans session → 401 ; autre compte → 404 sans donnée ; propriétaire → statut, opérateur, échéance » ; `tests/parcours/paiement-attente-lot7.test.ts:259` « billets : cible, événement, nombre de billets, lignes du panier, payeur masqué, canaux, liens de succès et de reprise » ; `tests/parcours/client-interface.test.ts:160` « attente honnête : garder la page ouverte, achat enregistré même fermée, SMS au numéro masqué, billets dans Mes billets » ; `tests/parcours/paiement-reservation-v12.test.ts:96` (« Vos places sont gardées … minutes »). Essai : Essai 19 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.3.

### Étape 7.7 — Paiement validé

1. **Qui, où, quel bouton.** Fatou valide chez l'opérateur. Le système confirme par l'avis de SamirPay, la lecture de la page ou la tâche de rapprochement.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Paiement « Confirmé », réservations converties, billets « Valable » créés avec un numéro. Écran : pastille « Confirmé », « Paiement confirmé », « Vos {n} billets sont disponibles dans Mes billets. », exemple « Vos 2 billets sont disponibles dans Mes billets. », « Billets émis », « Redirection automatique dans {n} s. », exemple « Redirection automatique dans 6 s. », « Rester sur cette page », bouton « Voir mes billets ». Renvoi vers Mes billets après 6 secondes. Preuve : `lib/payments/webhook.service.ts:4-14`, `M/20261106000003_lot8_paiement.sql:84`, `app/paiement/[id]/page.tsx:241-244`, `:945`, `:951`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le numéro qui a payé, qui peut différer du compte | SMS | indispensable | prochain passage de la file | modèle « Event Village : achat confirmé, {ticket_count} billets {title}. Frais de service {service_fee}, total payé {total}. {APP_URL}/tickets » ; exemple « Event Village : achat confirmé, 2 billets Gala de la Teranga. Frais de service 100 F CFA, total payé 10 100 F CFA. https://eventvillage.sn/tickets » (146 caractères, 1 segment) |
| Fatou, son compte | cloche | indispensable | prochain passage de la file | titre « Achat confirmé » ; modèle « {ticket_count} billets pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets. » ; exemple « 2 billets pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00. Total payé : 10 100 F CFA. Vos billets sont dans Mes billets. » |
| Fatou, si son adresse est vérifiée (depuis le lot 9 bis) et le service actif | email | indispensable | prochain passage de la file | objet « Achat confirmé — Event Village » ; modèle : Achat confirmé<br>{ticket_count} billets pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets.<br>Événement : {title}<br>Date : {start_at}<br>Lieu : {location}, {city}<br>Billets : 1 × Standard, 1 × VIP<br>Montant payé : {total}, dont frais de service {service_fee}<br>Numéros de billets :<br>- TCK-20261104-3F9A1C7E2B<br>- TCK-20261104-8D2E6B4A1F<br>Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.<br>Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.<br>Voir mes billets : {APP_URL}/tickets<br>En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Achat confirmé<br>2 billets pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00. Total payé : 10 100 F CFA. Vos billets sont dans Mes billets.<br>Événement : Gala de la Teranga<br>Date : sam. 14 nov. 2026 à 20:00<br>Lieu : CICAD, Diamniadio<br>Billets : 1 × Standard, 1 × VIP<br>Montant payé : 10 100 F CFA, dont frais de service 100 F CFA<br>Numéros de billets :<br>- TCK-20261104-3F9A1C7E2B<br>- TCK-20261104-8D2E6B4A1F<br>Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.<br>Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.<br>Voir mes billets : https://eventvillage.sn/tickets<br>En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Mariama | cloche | optionnel | prochain passage de la file | titre « Nouvelle commande » ; modèle « {ticket_count} billets vendus pour « {title} » ({total}). » ; exemple « 2 billets vendus pour « Gala de la Teranga » (10 000 F CFA). » |
| Mariama, à la première vente en ligne ou au guichet | SMS | optionnel | prochain passage de la file ; perdu en heures calmes (22 h à 8 h) ou au-delà du budget quotidien | modèle « Event Village : premier billet vendu pour {title}. Suivez vos ventes : {APP_URL}/partner/events » ; exemple « Event Village : premier billet vendu pour Gala de la Teranga. Suivez vos ventes : https://eventvillage.sn/partner/events » (120 caractères, 1 segment) |
| Mariama, à la première vente en ligne ou au guichet | cloche | optionnel | prochain passage de la file | titre « Premier billet vendu » ; modèle « Le premier billet de « {title} » est vendu. » ; exemple « Le premier billet de « Gala de la Teranga » est vendu. » |
| Mariama, à la première vente en ligne ou au guichet | push | optionnel | prochain passage de la file | titre « Premier billet vendu » ; modèle « Le premier billet de « {title} » est vendu. » ; exemple « Le premier billet de « Gala de la Teranga » est vendu. » |
| Mariama, à la première vente en ligne ou au guichet | email | optionnel | prochain passage de la file | objet « Premier billet vendu — Event Village » ; modèle : Premier billet vendu<br>Le premier billet de « {title} » est vendu.<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : {APP_URL}/profile/notifications?topic=PRO_ACTIVITY ; exemple : Premier billet vendu<br>Le premier billet de « Gala de la Teranga » est vendu.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : https://eventvillage.sn/profile/notifications?topic=PRO_ACTIVITY |

Preuve : `PURCHASE_CONFIRMED` (`M/20261106000003_lot8_paiement.sql:230`, `lib/payments/confirmation.service.ts:56`) ; `NEW_ORDER` (`M/20261106000003_lot8_paiement.sql:242`) ; `FIRST_TICKET_SOLD` (`M/20261103000005_lot6_billetterie.sql:852`).

5. **Ce que les autres voient.** Mes billets se met à jour en direct. Le pilotage de Mariama change de chiffres, mais la page n'est pas abonnée aux ventes : ils se relisent au prochain scan ou au rechargement. Preuve : `app/tickets/page.tsx:198-206`, `app/partner/events/[id]/page.tsx:82-87`.
6. **Ce qui est impossible.** Confirmer deux fois : le second passage ne fait rien.
7. **Test et essai.** Test : `tests/parcours/paiement-confirmation.test.ts:32` « deux webhooks identiques simultanés + un sondage : billets émis une seule fois, held sans double décrément » ; `tests/parcours/paiement-confirmation.test.ts:59` « RPC idempotente : un second appel ne fait rien et le dit » ; `tests/parcours/paiement-confirmation.test.ts:103` « montants lus, pas recalculés : le billet garde le prix payé si la catégorie change de prix avant la confirmation » ; `tests/parcours/achat-serveur.test.ts:59` « checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur » ; `tests/parcours/confirmation-achat.test.ts:574` « achat de 1 billet : categories et ticket_numbers figés, email complet (titre, date de Dakar, lieu, ville, « 1 × Standard », montant, numéro, P1, P2, P3, « Voir mes billets ») » ; `tests/parcours/confirmation-achat.test.ts:592` « achat de 12 billets : exactement les 10 premiers numéros dans l'ordre, « et 2 autres », les 2 derniers absents, ticket_count = 12 » ; `tests/parcours/paiement-webhook.test.ts:52` « sans jeton : enregistré, 200, aucun billet, paiement toujours PENDING ». Essai : Essai 16 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.3.

### Étape 7.8 — Paiement refusé

1. **Qui, où, quel bouton.** Refus à l'envoi, dans la fenêtre de paiement, ou après, par la lecture du statut ou la tâche de rapprochement. SamirPay ne prévient qu'en cas de succès. Preuve : `app/api/cron/payments-reconcile/route.ts:13-14`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Paiement « Échoué », places rendues, aucun billet. Écran : pastille « Échoué », « Le paiement n’a pas abouti », « {opérateur} n’a pas confirmé le paiement de {montant}. Vous pouvez réessayer ; si votre compte a tout de même été débité, contactez le support avec la référence ci-⁠dessous. », exemple « Wave n’a pas confirmé le paiement de 10 500 F CFA. Vous pouvez réessayer ; si votre compte a tout de même été débité, contactez le support avec la référence ci-⁠dessous. ». Boutons « Réessayer le paiement », « Mes billets ». À la reprise : « Panier précédent repris : vérifiez-le puis relancez le paiement. », « Panier précédent repris en partie (places limitées) : vérifiez-le puis relancez le paiement. », « Les billets de votre panier précédent ne sont plus disponibles. ». Preuve : `app/paiement/[id]/page.tsx:258-259`, `app/events/[id]/page.tsx:473-479`, `M/20261031000013_lot2_reservations.sql:192`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message, sur aucun canal. Seul l'écran prévient.

5. **Ce que les autres voient.** Stock public rendu. Rien pour Mariama.
6. **Ce qui est impossible.** Revenir en arrière : l'échec est définitif pour ce paiement.
7. **Test et essai.** Test : `tests/parcours/paiement-reservation.test.ts:69` « refus SamirPay dans la réponse : paiement FAILED, réservation libérée » ; `tests/parcours/paiement-reservation.test.ts:85` « exception SamirPay (délai dépassé) : réservation libérée » ; `tests/parcours/paiement-reconciliation.test.ts:47` « SUCCESS chez SamirPay (webhook perdu) → billets émis par la RPC ; FAILED → échec et stock rendu ; CANCELLED → annulé » ; `tests/parcours/client-interface.test.ts:171` « échec, annulation, échéance : « Réessayer le paiement » vers retry_url ; succès vers success_url ». Essai : Essai 18 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.4.

### Étape 7.9 — Annuler un paiement en attente

1. **Qui, où, quel bouton.** Fatou, `/paiement/{id}`, « Annuler le paiement », fenêtre « Annuler ce paiement ? », « Nous vérifions d’abord auprès de l’opérateur : si vous avez déjà validé sur votre téléphone, le paiement est confirmé et vos billets émis. Sinon, la demande est abandonnée et la réservation libérée. », boutons « Annuler le paiement », « Continuer le paiement ». Preuve : `app/paiement/[id]/page.tsx:1005-1008`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Le statut est demandé à SamirPay. Encore en attente : paiement annulé, places rendues. Écran « Paiement annulé », « La demande a été annulée et la réservation libérée. Si vous aviez déjà validé sur votre téléphone, le paiement sera tout de même pris en compte ou remboursé automatiquement. », message « Paiement annulé : la réservation a été libérée. ». Preuve : `app/api/payments/[transactionId]/cancel/route.ts:48-102`, `app/paiement/[id]/page.tsx:267-269`, `:629`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Stock rendu.
6. **Ce qui est impossible.** « Votre paiement vient d'être confirmé. » ; « Votre paiement a été reçu mais ne peut pas être honoré : il est en cours de remboursement. » ; « Votre paiement est en cours de vérification : il ne peut pas être annulé. » ; « Vérification impossible pour le moment : réessayez dans un instant. » ; « Ce paiement n’est plus en attente. ». Preuve : `app/api/payments/[transactionId]/cancel/route.ts:45`, `:55`, `:61`, `:71`, `:83`.
7. **Test et essai.** Test : `tests/parcours/paiement-attente-lot7.test.ts:201` « SamirPay dit SUCCESS : 409 PAYMENT_ALREADY_CONFIRMED, paiement confirmé, billets émis » ; `tests/parcours/paiement-attente-lot7.test.ts:215` « SamirPay injoignable : 503 PROVIDER_UNAVAILABLE, rien n'est annulé » ; `tests/parcours/paiement-attente-lot7.test.ts:229` « SamirPay dit PENDING : SamirPay interrogé, puis annulation (200 CANCELLED, réservation libérée) » ; `tests/parcours/paiement-attente-lot7.test.ts:242` « succès tardif d'un paiement annulé : billets émis (D4, comportement conservé) » ; `tests/parcours/paiement-reservation.test.ts:97` « annulation par le client : réservation libérée, paiement CANCELLED ; un tiers ne peut pas annuler ». Essai : aucun.

### Étape 7.10 — Délai expiré, succès tardif

1. **Qui, où, quel bouton.** Le temps passe. Tâche de rapprochement, toutes les 5 minutes.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Deux échéances. À la fin de la durée de garde (10 minutes par défaut depuis le lot 9 bis), la réservation expire et les places reviennent, mais le paiement reste en attente. Depuis le lot 9 bis, l'écran le dit ainsi : bandeau en tête « Paiement toujours en attente. », « Si vous n’avez pas validé sur votre téléphone, annulez-le : aucun autre paiement n’est possible pour cet événement tant que celui-ci n’est ni confirmé ni annulé. », « Si vous avez déjà validé, attendez : vos billets arriveront, ou vous serez remboursé. » ; titre « Places plus garanties », « Vos places ne sont plus garanties. Si vous validez quand même le paiement, vos billets seront émis s’il reste des places ; sinon vous serez remboursé automatiquement. » ; « La demande de paiement reste valable jusqu’à {heure} : cette page suit sa confirmation jusque-là. » ; le bouton « Annuler ce paiement » devient l'action principale. Plus tard : « Confirmation non reçue », « {opérateur} n’a pas encore confirmé ce paiement. Actualisez dans un instant : si votre compte a été débité, le paiement sera pris en compte automatiquement. », exemple « Wave n’a pas encore confirmé ce paiement. Actualisez dans un instant : si votre compte a été débité, le paiement sera pris en compte automatiquement. », bouton « Actualiser le statut ». À 60 minutes, si SamirPay dit encore « en attente » : expiré. Écran « Délai de paiement dépassé », « La réservation a expiré faute de confirmation à temps et les places ont été libérées. Si vous avez validé après l’échéance, le paiement sera pris en compte ou remboursé automatiquement. », « Réessayer le paiement ». Succès tardif : un paiement expiré ou annulé est recontrôlé pendant 48 heures ; depuis le lot 9 bis, un « échec » lu chez SamirPay n'est définitif que 2 heures après la création, car SamirPay peut encore confirmer un paiement qu'il a d'abord déclaré expiré. S'il reste du stock, les billets sont émis, sinon il est remboursé et le client prévenu tout de suite (étape 7.12). Preuve : `app/paiement/[id]/page.tsx:221-245`, `:776-785`, `:858-869`, `:962-977`, `lib/payments/confirmation.service.ts:184-188`, `app/api/cron/payments-reconcile/route.ts:14-23`, `:49-52`, `lib/env.ts:68`, `:74-75`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Expiration : aucun message. Succès tardif honoré : ceux de l'étape 7.7. Succès tardif impossible à honorer : étape 7.12.

5. **Ce que les autres voient.** Stock public rendu à l'échéance.
6. **Ce qui est impossible.** Depuis le lot 9 bis, tant que le paiement est en attente, échu ou non, en lancer un second pour le même événement (étape 7.11) : il faut d'abord l'annuler, ou attendre qu'il soit confirmé, échoué ou expiré. Preuve : `lib/payments/checkout.service.ts:129-133`, `:145-150`.
7. **Test et essai.** Test : `tests/parcours/paiement-reconciliation.test.ts:64` « PENDING trop ancien encore PENDING chez SamirPay → EXPIRED, réservation libérée ; paiement récent ignoré » ; `tests/parcours/paiement-reservation.test.ts:111` « réservation échue : la route cron (CRON_SECRET) rend le stock ; sans secret → 401 » ; `tests/parcours/double-paiement.test.ts:270` « 2. même chose par le cron : A EXPIRED, rattrapage tardif (RECONCILIATION), A remboursé » ; `tests/parcours/canaux-vente.test.ts:467` « 9. réservation échue honorée sur stock libre après la coupure : même décision » ; `tests/parcours/paiement-succes-tardif-v12.test.ts:139` « H1-a : 70 minutes, FAILED lu par le cron (non définitif), puis SUCCESS : le cron confirme, billets émis » ; `tests/parcours/paiement-succes-tardif-v12.test.ts:206` « H1-d : témoin : FAILED lu 2 h 05 après la création → définitif » ; `tests/parcours/paiement-attente-9bis.test.ts:231` (bandeau « Paiement toujours en attente… »). Essai : Essai 19 de `docs/recette-billetterie.md`.

### Étape 7.11 — Second paiement et double paiement

1. **Qui, où, quel bouton.** Fatou relance un achat sur le même événement.
2. **Ce qu'il saisit.** Comme à l'étape 7.5.
3. **Ce que fait le système.** Trois protections. Même demande rejouée (double clic, coupure) : le paiement existant est renvoyé. Autre demande pendant un paiement en attente, depuis le lot 9 bis même après la fin de la garde des places : refus, rien de créé. Deux paiements encaissés pour le même panier : le second est refusé et remboursé en totalité, frais compris. Panier différent, ou rachat lancé après la confirmation du premier : les deux sont honorés. Preuve : `lib/payments/checkout.service.ts:165-166`, `M/20261106000003_lot8_paiement.sql:43`, `M/20261105000006_lot7_client.sql:24`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `refunds.manage` | cloche | indispensable | prochain passage de la file | titre « Paiement en double remboursé » ; modèle « Un second paiement de {amount} a été encaissé pour le même panier : son remboursement au client est lancé. » ; exemple « Un second paiement de 21 000 F CFA a été encaissé pour le même panier : son remboursement au client est lancé. » |
| Aïda et les admins avec `refunds.manage` | push | indispensable | prochain passage de la file | titre « Paiement en double remboursé » ; modèle « Un second paiement de {amount} a été encaissé pour le même panier : son remboursement au client est lancé. » ; exemple « Un second paiement de 21 000 F CFA a été encaissé pour le même panier : son remboursement au client est lancé. » |
| Aïda et les admins avec `refunds.manage` | email | indispensable | prochain passage de la file | objet « Paiement en double remboursé — Event Village » ; modèle : Paiement en double remboursé<br>Un second paiement de {amount} a été encaissé pour le même panier : son remboursement au client est lancé.<br>Ouvrir Event Village : {APP_URL}/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Paiement en double remboursé<br>Un second paiement de 21 000 F CFA a été encaissé pour le même panier : son remboursement au client est lancé.<br>Ouvrir Event Village : https://eventvillage.sn/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Fatou, dès la création du remboursement (depuis le lot 9 bis) | SMS | indispensable | prochain passage de la file | modèle « Event Village : paiement en double de {amount} ("{title}"), remboursé sur votre compte Wave. Vos billets restent valables. » ; exemple « Event Village : paiement en double de 10 200 F CFA ("Gala de la Teranga"), remboursé sur votre compte Wave. Vos billets restent valables. » (137 caractères, 1 segment) |
| Fatou, dès la création du remboursement | cloche, push, email si l'adresse est vérifiée | indispensable | prochain passage de la file | titre « Remboursement de votre paiement » ; exemple « Un second paiement de 10 200 F CFA pour « Gala de la Teranga » a été encaissé pour le même panier. Il vous est remboursé sur votre compte Wave ; vos billets restent valables. » |
| Fatou, au versement | SMS | indispensable | prochain passage de la file | modèle « Event Village : remboursement de {amount} versé sur votre compte Wave ({title}). » ; exemple « Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave (Gala de la Teranga). » (94 caractères, 1 segment) |
| Fatou, au versement | cloche | indispensable | prochain passage de la file | titre « Remboursement versé » ; modèle « {amount} vous ont été remboursés sur votre compte Wave pour « {title} ». » ; exemple « 5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ». » |
| Fatou, au versement | push | indispensable | prochain passage de la file | titre « Remboursement versé » ; modèle « {amount} vous ont été remboursés sur votre compte Wave pour « {title} ». » ; exemple « 5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ». » |
| Fatou, au versement, si son adresse est vérifiée | email | indispensable | prochain passage de la file | objet « Remboursement versé — Event Village » ; modèle : Remboursement versé<br>{amount} vous ont été remboursés sur votre compte Wave pour « {title} ».<br>Ouvrir Event Village : {APP_URL}/tickets?tab=historique<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Remboursement versé<br>5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ».<br>Ouvrir Event Village : https://eventvillage.sn/tickets?tab=historique<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Depuis le lot 9 bis, Fatou est prévenue dès la création du remboursement, puis au versement ; si le versement est bloqué ou en retard, elle reçoit aussi l'avis « Remboursement retardé » de l'étape 7.12. Preuve : `ADMIN_DUPLICATE_PAYMENT` (`M/20261106000003_lot8_paiement.sql:191`) ; `PAYMENT_REFUND_STARTED` (`lib/notifications/catalog.ts:1347-1371`) ; `REFUND_PAID` (`M/20261103000006_lot6_pros_admin.sql:410`).

5. **Ce que les autres voient.** Sur la page du paiement refusé : « Paiement en cours de remboursement », puis « Paiement remboursé ». Preuve : `app/paiement/[id]/page.tsx:287`, `:305`.
6. **Ce qui est impossible.** Lancer un second paiement pendant le premier : titre « Un paiement est déjà en attente », « Un paiement est déjà en attente pour cet événement : suivez-le avant d’en lancer un autre. », bouton « Suivre le paiement ». Preuve : `components/payment/PaymentModal.tsx:212`, `lib/payments/payment-client.ts:218`.
7. **Test et essai.** Test : `tests/parcours/double-paiement.test.ts:258` « 1. A annulé, B confirmé, succès tardif de A par webhook : A remboursé, un seul jeu, un REFUND_PAID, une alerte par admin » ; `tests/parcours/double-paiement.test.ts:285` « 3. ordre inverse : A PENDING échu confirmé d’abord, B ensuite : B, second confirmé, est remboursé » ; `tests/parcours/double-paiement.test.ts:299` « 4. rejeu du webhook : REFUND_IN_PROGRESS, pas de second cashout, pas de second envoi » ; `tests/parcours/double-paiement.test.ts:319` « 8. concurrence : deux payment_confirm sur deux connexions, le second attend le premier : un seul jeu » ; `tests/parcours/double-paiement.test.ts:451` « 5. rachat séquentiel identique, après la confirmation du premier : deux jeux, aucun remboursement » ; `tests/parcours/double-paiement.test.ts:458` « 6. panier différent (1 VIP annulé puis 2 VIP) : le succès tardif garde les deux jeux » ; `tests/parcours/paiement-attente-lot7.test.ts:179` « deux checkouts simultanés (clés différentes) → un seul PENDING, l'autre 409 PAYMENT_PENDING » ; `tests/parcours/paiement-attente-9bis.test.ts:162` « R47-a : réservation échue, premier paiement toujours PENDING : second checkout → 409 PAYMENT_PENDING, rien de créé » ; `tests/parcours/paiement-attente-9bis.test.ts:281` « R30-b : double paiement : PAYMENT_REFUND_STARTED, variante « double », SMS exact ». Essai : aucun.

### Étape 7.12 — Paiement encaissé, panier impossible à honorer

1. **Qui, où, quel bouton.** Le système : succès tardif sans stock, ou événement suspendu, annulé ou terminé.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Aucun billet n'est émis. Le paiement passe en remboursement, automatiquement. Depuis le lot 9 bis, tout versement resté à envoyer ou bloqué est repris par la tâche planifiée et, au-delà de 30 minutes, apparaît dans « Versements à reprendre » (étape 18.7). Écran : pastille « Échoué », « Remboursement en cours », ou depuis le lot 9 bis « Remboursement retardé » quand le versement est bloqué ou en retard, « Paiement en cours de remboursement », « Ce paiement n’a pas pu être honoré : {montant} vous est reversé sur le compte {opérateur} qui a payé. », exemple « Ce paiement n’a pas pu être honoré : 10 500 F CFA vous est reversé sur le compte Wave qui a payé. ». Preuve : `M/20261106000003_lot8_paiement.sql:154-156`, `app/paiement/[id]/page.tsx:302-308`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, dès la création du remboursement (depuis le lot 9 bis) | SMS | indispensable | prochain passage de la file | modèle « Event Village : paiement de {amount} ("{title}") sans billet possible : il vous est remboursé sur votre compte Wave. » ; exemple « Event Village : paiement de 10 200 F CFA ("Gala de la Teranga") sans billet possible : il vous est remboursé sur votre compte Wave. » (131 caractères, 1 segment) |
| Fatou, dès la création du remboursement | cloche, push, email si l'adresse est vérifiée | indispensable | prochain passage de la file | titre « Remboursement de votre paiement » ; exemple « Votre paiement de 10 200 F CFA pour « Gala de la Teranga » a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte Wave : vous serez prévenu du versement. » |
| Fatou, si le versement est bloqué, refusé, incertain ou en retard (depuis le lot 9 bis) | SMS | indispensable | prochain passage de la file | modèle « Event Village : remboursement de {amount} retardé ("{title}"). L'équipe Event Village s'en occupe, aucune action de votre part. » ; exemple « Event Village : remboursement de 10 200 F CFA retardé ("Gala de la Teranga"). L'équipe Event Village s'en occupe, aucune action de votre part. » (142 caractères, 1 segment) |
| Fatou, même cas | cloche, push, email si l'adresse est vérifiée | indispensable | prochain passage de la file | titre « Remboursement retardé » ; exemple « Le remboursement de 10 200 F CFA pour « Gala de la Teranga » est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement. » |
| Aïda et les admins avec `refunds.manage`, si le versement est bloqué ou refusé | cloche | indispensable | prochain passage de la file | titre « Remboursement à reprendre » ; modèle « Un remboursement de {amount} est bloqué : opérateur du paiement inconnu. » ; exemple « Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu. » |
| Aïda et les admins avec `refunds.manage`, si le versement est bloqué ou refusé | push | indispensable | prochain passage de la file | titre « Remboursement à reprendre » ; modèle « Un remboursement de {amount} est bloqué : opérateur du paiement inconnu. » ; exemple « Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu. » |
| Aïda et les admins avec `refunds.manage`, si le versement est bloqué ou refusé | email | indispensable | prochain passage de la file | objet « Remboursement à reprendre — Event Village » ; modèle : Remboursement à reprendre<br>Un remboursement de {amount} est bloqué : opérateur du paiement inconnu.<br>Ouvrir Event Village : {APP_URL}/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Remboursement à reprendre<br>Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu.<br>Ouvrir Event Village : https://eventvillage.sn/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Au versement, le message « Remboursement versé » de l'étape 7.11. Un seul avis « retardé » par versement. Preuve : `PAYMENT_REFUND_STARTED`, `REFUND_DELAYED` (`lib/notifications/catalog.ts:1296-1371`), `ADMIN_REFUND_TO_RETRY` (`M/20261103000006_lot6_pros_admin.sql:384`).

5. **Ce que les autres voient.** Aïda : depuis le lot 9 bis, l'écran « Versements à reprendre » (étape 18.7) si le versement est bloqué ou attend depuis plus de 30 minutes. Mes paiements et Mes billets disent « Remboursement retardé, l’équipe Event Village s’en occupe. ».
6. **Ce qui est impossible.** Garder une partie du panier.
7. **Test et essai.** Test : `tests/parcours/paiement-confirmation.test.ts:73` « panier dont une catégorie ne peut pas être honorée : zéro billet, jamais de SUCCESS partiel, remboursement déclenché » ; `tests/parcours/paiement-remboursement.test.ts:85` « payeur Orange Money : remboursement sur Orange Money, au numéro payeur (9 chiffres), prénom et nom » ; `tests/parcours/paiement-remboursement.test.ts:102` « opérateur ou numéro inconnu : aucun cashout envoyé, remboursement en attente, alerte admin » ; `tests/parcours/paiement-attente-9bis.test.ts:260` « R30-a : succès tardif sans stock : PAYMENT_REFUND_STARTED avant tout versement, SMS exact » ; `tests/parcours/paiement-attente-9bis.test.ts:299` « R30-c : remboursement bloqué par un solde SamirPay nul : REFUND_DELAYED au client, un avis par canal » ; `tests/parcours/paiement-succes-tardif-v12.test.ts:152` « H1-b : places vendues entre-temps : REFUND_PENDING, un remboursement REFUND, PAYMENT_REFUND_STARTED au client ». Essai : aucun.

### Étape 7.13 — Fin des ventes, vente pas ouverte, catégorie fermée

1. **Qui, où, quel bouton.** Fatou, `/events/{id}`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Les catégories inactives ou non vendues en ligne n'apparaissent pas. Mentions : « Vente à partir du {date} », exemple « Vente à partir du 2 novembre 2026 », « Bientôt en vente », « Vente terminée », « Plus que {n} places », exemple « Plus que 3 places », « Plus qu’une place », « Disponible ». Rien à acheter : « Billetterie », depuis le lot 9 bis « La vente en ligne est terminée pour cet événement. » si toutes les ventes en ligne sont closes, sinon « Aucune catégorie n’est en vente pour le moment. Revenez bientôt : cette page se met à jour d’elle-même. ». Événement suspendu, annulé ou terminé : « La vente de billets est fermée pour cet événement. ». Preuve : `app/events/[id]/page.tsx:214-224`, `:1150-1160`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Refus cités : « Cet événement n'est pas ouvert à la vente. » ; « Cet événement est terminé. » ; « La catégorie « {nom} » n'est plus en vente. », exemple « La catégorie « VIP » n'est plus en vente. » ; « La catégorie « {nom} » n'est pas vendue en ligne. » ; « La vente de « {nom} » n'est pas encore ouverte. » ; « La vente de « {nom} » est close. » ; « Au plus {n} billet(s) « {nom} » par commande. » ; « Plus assez de places « {nom} » disponibles. » ; « Panier vide. » ; « Événement introuvable. » ; « Catégorie introuvable pour cet événement. » ; « Quantité invalide. ». Preuve : `M/20261106000001_lot8_canaux.sql:211-277`.
7. **Test et essai.** Test : `tests/parcours/paiement-controles.test.ts:58` « vente close, vente pas encore ouverte, catégorie invisible ou inactive → 400 » ; `tests/parcours/paiement-controles.test.ts:66` « événement passé ou non publié → 400 » ; `tests/parcours/canaux-vente.test.ts:285` « 1. checkout_create_payment en appel direct : ok false, CATEGORY_NOT_SOLD_ONLINE, aucun paiement, aucune réservation » ; `tests/parcours/canaux-vente.test.ts:408` « 6 ter. aucun canal : refusée en ligne, au devis et au guichet ». Essai : Essais 21, 22 et 61 de `docs/recette-billetterie.md`.

### Étape 7.14 — Catégorie épuisée, événement complet

1. **Qui, où, quel bouton.** Fatou, `/events/{id}`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Restant = quantité − ventes − réservations en cours. À 0 : « Complet », plus de boutons. Toutes les catégories à 0 : « Toutes les places ont été vendues. », ou depuis le lot 9 bis, si des paiements en cours retiennent des places, « Toutes les places sont vendues ou en cours de paiement. Des places peuvent se libérer : cette page se met à jour d’elle-même. » ; bouton « Voir d’autres événements ». Le panier ouvert se réduit seul si le stock baisse. Preuve : `app/events/[id]/page.tsx:215`, `:429-444`, `:1156-1159`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | optionnel | prochain passage de la file ; perdu en heures calmes (22 h à 8 h) ou au-delà du budget quotidien | modèle « Event Village : la catégorie {category} de {title} est complète. {APP_URL}/partner/events » ; exemple « Event Village : la catégorie Carré VIP de Gala de la Teranga est complète. https://eventvillage.sn/partner/events » (113 caractères, 1 segment) |
| Mariama | cloche | optionnel | prochain passage de la file | titre « Catégorie complète » ; modèle « La catégorie « {category} » de « {title} » est complète. » ; exemple « La catégorie « Carré VIP » de « Gala de la Teranga » est complète. » |
| Mariama | push | optionnel | prochain passage de la file | titre « Catégorie complète » ; modèle « La catégorie « {category} » de « {title} » est complète. » ; exemple « La catégorie « Carré VIP » de « Gala de la Teranga » est complète. » |
| Mariama | email | optionnel | prochain passage de la file | objet « Catégorie complète — Event Village » ; contenu cité intégralement à l’étape 5.11 |
| Mariama, dernière catégorie active | SMS | optionnel | prochain passage de la file ; perdu en heures calmes (22 h à 8 h) ou au-delà du budget quotidien | modèle « Event Village : {title} est complet, toutes les catégories sont vendues. {APP_URL}/partner/events » ; exemple « Event Village : Gala de la Teranga est complet, toutes les catégories sont vendues. https://eventvillage.sn/partner/events » (122 caractères, 1 segment) |
| Mariama, dernière catégorie active | cloche | optionnel | prochain passage de la file | titre « Événement complet » ; modèle « Toutes les catégories de « {title} » sont vendues. » ; exemple « Toutes les catégories de « Gala de la Teranga » sont vendues. » |
| Mariama, dernière catégorie active | push | optionnel | prochain passage de la file | titre « Événement complet » ; modèle « Toutes les catégories de « {title} » sont vendues. » ; exemple « Toutes les catégories de « Gala de la Teranga » sont vendues. » |
| Mariama, dernière catégorie active | email | optionnel | prochain passage de la file | objet « Événement complet — Event Village » ; contenu cité intégralement à l’étape 5.11 |

Déclencheur : ventes égales à la quantité, les réservations ne comptent pas. Preuve : `CATEGORY_SOLD_OUT` (`M/20261103000005_lot6_billetterie.sql:914`) ; `EVENT_SOLD_OUT` (`M/20261103000005_lot6_billetterie.sql:918-925`).

5. **Ce que les autres voient.** Tous les visiteurs voient « Complet » en direct.
6. **Ce qui est impossible.** « Plus assez de places « {nom} » disponibles. », exemple « Plus assez de places « VIP » disponibles. », sans débit.
7. **Test et essai.** Test : `tests/parcours/temps-reel-stock.test.ts:200` « 14 places, seuil 10 : vente de 3 (AVAILABLE, rien diffusé), de 3 (LOW, restant 8), de 8 (SOLD_OUT) ; anon ne reçoit ni billets, ni paiements, ni réservations » ; `tests/parcours/paiement-reservation.test.ts:37` « deux acheteurs simultanés pour la dernière place : une réservation, un refus avant tout appel SamirPay, aucune survente ». Essai : aucun.

### Étape 7.15 — Confirmation reçue, Mes paiements

1. **Qui, où, quel bouton.** Fatou, `/profile/payments`, titre « Mes paiements ». Preuve : `app/profile/payments/page.tsx:77`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** La liste récapitule les paiements du compte, avec le montant, le statut et le détail. Depuis le lot 9 bis, un remboursement bloqué ou en retard se lit « Remboursement retardé, l’équipe Event Village s’en occupe. ». Les confirmations ont été envoyées aux étapes 7.3 et 7.7. Preuve : `app/api/account/payments/route.ts:82`, `:100`, `lib/payments/payment-labels.ts:26-33`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Voir les paiements d'un autre compte.
7. **Test et essai.** Test : `tests/parcours/compte-paiements.test.ts:132` « A ne voit jamais les paiements de B ». Essai : Essai 69 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.12.

### Étape 7.16 — Mes billets

1. **Qui, où, quel bouton.** Fatou, `/tickets`, titre « Mes billets », « Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte. ». Onglets « À venir », « Tous mes billets », « Historique », « Reçus ». Depuis le lot 9 bis, la page s'ouvre d'office sur « Reçus » quand un billet y attend et qu'aucun onglet n'est demandé dans l'adresse. Preuve : `app/tickets/page.tsx:75`, `:186`, `:233-236`.
2. **Ce qu'il saisit.** Aucun. Sans session : « Connectez-vous pour voir vos billets ». Preuve : `app/tickets/page.tsx:244`.
3. **Ce que fait le système.** Liste mise à jour en direct. Carte : titre, partenaire, « Date », « Heure d’accès », « Lieu », « Catégorie », et depuis le lot 9 bis « Prix » (le montant, « Gratuit » ou « Invitation ») et « Frais de service » quand il y en a. Depuis le lot 9 bis aussi, la carte dit l'état de l'événement quand il n'est pas publié : « Événement suspendu : l’entrée n’est pas possible pour le moment. » ou « Événement terminé. » à la place du QR ; « Remboursement retardé, l’équipe Event Village s’en occupe. » quand un remboursement de ce billet est bloqué ou en retard ; après un report de plus de 24 heures, « L’événement a été reporté de plus de 24 h : remboursement total possible ({montant}, frais de service compris) jusqu’au {date}. », exemple « L’événement a été reporté de plus de 24 h : remboursement total possible (5 100 F CFA, frais de service compris) jusqu’au sam. 21 nov. 2026 à 21:00. », avec le bouton « Me faire rembourser » ; la confirmation « Me faire rembourser ? » dit « Remboursement de {montant}, frais de service compris, sur le compte Mobile Money qui a payé. Votre billet sera annulé. », ou, pour un billet reçu par transfert, « … Le remboursement est versé à l’acheteur d’origine. Votre billet sera annulé. », boutons « Me faire rembourser » et « Garder mon billet ». Boutons « Transférer », « WhatsApp », « Lien », « PDF », « Aide au transfert ». Billet utilisé : « Ce billet a déjà été contrôlé à l’entrée. », « Contrôlé le {date} », exemple « Contrôlé le sam. 14 nov. 2026 à 20:42 ». Preuve : `components/tickets/TicketCard.tsx:23-27`, `:539-563`, `:776-790`, `app/api/tickets/route.ts:26-28`, `:233-235`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Après « Me faire rembourser », le billet passe « Remboursement en cours » et les messages du remboursement d'un billet suivent (étape 15.2).

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Voir le billet d'un autre : « Vous ne pouvez consulter que vos propres billets. ». Demander le remboursement d'un report après le nouveau début, pour un billet acheté après le report, ou pour un billet gratuit. Vides : « Aucun billet à venir », « Vous n’avez encore aucun billet », « Aucun billet dans l’historique ». Panne : « Impossible d’afficher vos billets ». Preuve : `app/api/tickets/route.ts:32`.
7. **Test et essai.** Test : `tests/parcours/temps-reel-billets.test.ts:139` « garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien » ; `e2e/recette.spec.ts:487` « acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert » ; `tests/parcours/cycle9bis-carte-billet.test.ts` (prix, frais, état de l'événement, QR masqué) ; `tests/parcours/lot9bis-report.test.ts:246` « GET /api/tickets : postponementRefund { amount = prix + frais, until = nouveau début, toOriginalBuyer } » ; `tests/parcours/lot9bis-report.test.ts:261` « R32 reproduit : report de 48 h, POST /api/tickets/[id]/refund → 200 » ; `tests/parcours/lot9bis-report.test.ts:346` « après le nouveau début : 409 POSTPONEMENT_REFUND_CLOSED ». Essai : Essais 16 et 24 de `docs/recette-billetterie.md`, Essai 14 pour le report.

### Étape 7.17 — Le QR qui change

1. **Qui, où, quel bouton.** Fatou, `/tickets`, carte d'un billet « Valable ».
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Un code à 6 chiffres, renouvelé toutes les 20 secondes, un pas d'écart toléré. Textes : « Code renouvelé toutes les 20 s », « Une capture d’écran n’est pas acceptée au contrôle. », « Sans téléphone : numéro du billet et pièce d’identité au contrôle. », « Billet authentique, émis par Event Village », « Présentez ce code au contrôle, billet ouvert dans l’application. ». Sans réseau et sans billet enregistré : « Connexion requise pour afficher le code d’entrée. », « Le code s’affichera dès le retour du réseau. Une capture d’écran n’est pas acceptée. ». Preuve : `lib/security/totp.ts:14-15`, `:79`, `TicketCard.tsx:542-596`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Au scan, Fatou reçoit l'avis de l'étape 10.4.
6. **Ce qui est impossible.** Un code pour un billet qui n'est plus valable : « Ce billet n’est plus valable à l’entrée. », à l'écran « Ce billet n’a plus de code d’entrée. Actualisez la page. ». Trop de demandes : « Trop de demandes : patientez quelques secondes. ». Depuis le lot 9 bis, le serveur refuse aussi le code d'un événement suspendu, « Événement suspendu : l’entrée n’est pas possible pour le moment. », d'un événement annulé, « Événement annulé : ce billet n’est plus valable à l’entrée. », et d'un billet en cours de transfert, « Ce billet est en cours de transfert. » ; la carte n'affiche pas le QR dans ces cas, ni après la fin de l'événement. Preuve : `app/api/tickets/[id]/live-code/route.ts:44-59`, `M/20261109000008_lot9bis_cycle.sql` (`ticket_card_states`).
7. **Test et essai.** Test : `tests/parcours/acces-totp.test.ts:292` « transfert : code de l’ancien secret refusé, ancien porteur sans live-code, nouveau porteur accepté » ; `tests/parcours/cycle9bis-carte-billet.test.ts` (live-code refusé pour un événement suspendu ; QR et transfert masqués pendant la suspension et après la fin). Essai : Essai 24 de `docs/recette-billetterie.md`.

### Étape 7.18 — PDF du billet

1. **Qui, où, quel bouton.** Fatou, carte, « PDF ». Fichier `Billet-EventVillage-{numéro}.pdf`, message « Billet PDF téléchargé. ».
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Le PDF ne porte pas de QR. Il porte les frais et le total. Depuis le lot 9 bis, il garde les accents (« Événement », « Thiès ») et l'adresse de support unique, et il n'invente plus aucune valeur : si une donnée du billet ou de l'événement ne se lit pas, aucun PDF n'est produit. Preuve : `lib/tickets/ticket-pdf.service.ts:2`, `lib/pdf/pdf-text.ts`, `app/api/tickets/[id]/pdf/route.ts:10`, `:43-100`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Depuis le lot 9 bis, si l'événement ou une autre donnée ne se lit pas : « Billet momentanément indisponible : réessayez dans un instant. ». « Ce billet n'est plus valide et ne peut pas être téléchargé. » ; « Ce billet est actuellement engagé dans un transfert en attente et son accès est verrouillé. » ; « Accès refusé. Vous n'êtes pas le propriétaire de ce billet. ». Sur la carte : « Ce billet est en cours de transfert : le PDF sera disponible si le transfert est annulé. ». Preuve : `app/api/tickets/[id]/pdf/route.ts:67-82`.
7. **Test et essai.** Test : `tests/parcours/legacy-billet-pdf.test.ts:86` « témoin : le porteur télécharge son billet (200, application/pdf) » ; `tests/parcours/legacy-billet-pdf.test.ts:93` « T2 : un tiers connecté → 403, aucun document » ; `tests/parcours/finance-affichage.test.ts:149` « PDF du billet : frais de service et total payé » ; `tests/parcours/cycle9bis-billet-pdf.test.ts` (aucune valeur inventée, chaque lecture contrôlée) ; `tests/parcours/textes-pdf-9bis.test.ts` (accents gardés). Essai : Essai 23 de `docs/recette-billetterie.md`.

### Étape 7.19 — Billet hors ligne : enregistrement sur le téléphone

1. **Qui, où, quel bouton.** Automatique à l'ouverture de `/tickets` avec du réseau. Preuve : `TicketCard.tsx:173-206`, `components/tickets/OfflineTicketsSync.tsx:281-290`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** De 24 heures avant le début à la fin du contrôle, un lot de codes de 48 heures au plus est enregistré sur le téléphone. Mentions : « Disponible hors ligne », « Enregistrement du billet sur ce téléphone… », « Ouvrez ce billet avec du réseau avant d’arriver », « Disponible hors ligne à partir du {date} », exemple « Disponible hors ligne à partir du ven. 13 nov. à 20:00 », « Disponible hors ligne la veille de l’événement », « Codes expirés : ouvrez le billet avec du réseau ». Bouton « Afficher ce billet hors ligne ». Preuve : `M/20261105000004_lot7_billet_hors_ligne.sql:241`, `components/tickets/offline/OfflineStatusBadge.tsx:42-56`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** « Ce billet n'est plus valable à l'entrée. » ; « Cet événement n'est pas ouvert : les codes hors ligne ne sont pas disponibles. » ; « Ce billet est en cours de transfert : les codes hors ligne ne sont pas disponibles. » ; « Les codes hors ligne sont disponibles de 24 h avant le début de l'événement jusqu'à la fin du contrôle des entrées. » ; « Trop de téléchargements des codes hors ligne : réessayez plus tard. ». Preuve : `lib/tickets/offline-codes.service.ts:40-43`, `:117`.
7. **Test et essai.** Test : `tests/parcours/hors-ligne-codes.test.ts:149` « 1. 401 sans session ; 403 compte SUSPENDU ; 404 même corps pour le billet d’un autre, un UUID inconnu et un id non UUID » ; `tests/parcours/hors-ligne-codes.test.ts:174` « 2. 409 TICKET_NOT_VALID (UTILISE, ANNULE), EVENT_NOT_PUBLISHED (SUSPENDU, TERMINE), TRANSFER_PENDING » ; `tests/parcours/hors-ligne-codes.test.ts:209` « 3. début dans 23,9 h → 200 ; dans 24,1 h → 409 OFFLINE_WINDOW_CLOSED avec available_from ; fin passée, after = 0 → 409 (témoin after = 6 : 200) » ; `tests/parcours/hors-ligne-client.test.ts:201` « needsDownload : absent, autre version, expiré, incomplet à moins de 24 h → vrai ; à jour → faux ». Essai : Essais 25 et 26 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 11.

### Étape 7.20 — Billet hors ligne : présentation sans réseau

1. **Qui, où, quel bouton.** Fatou en mode avion, `/billet/hors-ligne?id={billet}`, titre « Billet hors ligne ».
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** La page vient de la mémoire du téléphone. Le QR suit l'heure du serveur. Il n'apparaît qu'à l'ouverture du contrôle (6 heures avant le début). Avant : « Le code d’entrée s’affichera ici à partir du {date}, même sans réseau. », exemple « Le code d’entrée s’affichera ici à partir du sam. 14 nov. à 14:00, même sans réseau. ». Rappels : « Une capture d’écran n’est pas acceptée : le code change toutes les {n} s. », exemple « Une capture d’écran n’est pas acceptée : le code change toutes les 20 s. », « Sur iPhone, ouvrez Event Village depuis son icône de l’écran d’accueil, avec du réseau, avant d’arriver : le billet y reste disponible sans réseau. ». Preuve : `components/tickets/offline/OfflineTicketView.tsx:148`, `:176`, `:180`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Le contrôleur scanne en ligne, normalement (étape 10.4).
6. **Ce qui est impossible.** Billet absent : « Ce billet n’est pas enregistré sur ce téléphone. Reconnectez-vous au réseau, ou présentez votre numéro de billet et votre pièce d’identité au contrôle. ». Heure reculée : « L’heure de ce téléphone a reculé depuis l’enregistrement du billet : le code ne peut plus être calculé. Remettez l’heure automatique, ou ouvrez le billet avec du réseau. ». « Stockage hors ligne indisponible sur ce téléphone. » ; « Le billet enregistré sur ce téléphone est illisible. Ouvrez-le avec du réseau pour l’enregistrer de nouveau. ». Le comportement sur un vrai téléphone (écran qui reste allumé, iPhone) est NON VÉRIFIÉ : aucun essai n'a été lancé pour ce document.
7. **Test et essai.** Test : `tests/parcours/hors-ligne-client.test.ts:145` « téléphone en avance ou en retard de 5 min : le code affiché est celui de l’heure du serveur » ; `tests/parcours/hors-ligne-client.test.ts:177` « avant scan_opens_at → not_yet ; à partir de valid_until → expired ; jamais de code hors du lot » ; `tests/parcours/hors-ligne-client.test.ts:191` « horloge reculée sous downloadedAtDevice − 60 s → clock_changed ; à − 59 s, encore un code » ; `tests/parcours/hors-ligne-client.test.ts:306` « page /billet/hors-ligne : client statique, id par window.location.search, ni useSearchParams ni import() ni next/dynamic, qrcode.react statique, aucun /api/ » ; `tests/parcours/hors-ligne-service-worker.test.ts:386` « navigation /billet/hors-ligne?id=… servie depuis le cache (réseau qui répond autre chose, puis réseau coupé) » ; `e2e/terrain.spec.ts:119` « 1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur ». Essai : Essai 26 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 11.

# Chapitre 8. Après l'achat

Le transfert et les invitations ne figurent pas dans le cahier des charges : ce sont des ajouts au projet (`docs/CDC-V3.md`).

### Étape 8.1 — Fatou transfère un billet à Lamine

1. **Qui, où, quel bouton.** Fatou, `/tickets`, carte, « Transférer ». Fenêtre « Transférer ce billet », bouton « Envoyer le billet ». Preuve : `components/tickets/TransferModal.tsx:185`, `:194`.
2. **Ce qu'il saisit.** Depuis le lot 9 bis, son mot de passe d'abord, s'il n'a pas été saisi depuis moins de 10 minutes sur cet appareil (fenêtre « Confirmez votre mot de passe » de l'étape 1.8). Puis « Numéro de téléphone du destinataire », obligatoire. Preuve : `app/api/tickets/[id]/transfer/route.ts:32`. Aide : « Le destinataire recevra un SMS. Il devra se connecter avec ce numéro pour accepter le billet sous 48 h. ». Mention « Transfert gratuit ». Erreurs : « Saisissez le numéro de téléphone du destinataire. » ; « Numéro invalide : saisissez un numéro de téléphone (par exemple 77 123 45 67). ». Preuve : `components/tickets/TransferModal.tsx:51`, `:113`, `:117`, `:240`.
3. **Ce que fait le système.** Un transfert en attente, valable 48 heures, verrouille le billet, qui reste à Fatou et reste « Valable ». Carte : « Transfert en attente », « Transfert en cours vers {numéro masqué} », exemple « Transfert en cours vers 77 *** ** 67 », « Le code d’entrée est suspendu. Dès que le destinataire accepte le billet, il lui appartient. ». Succès : « Transfert lancé », « Le billet est réservé pour le numéro {numéro}, qui va recevoir un SMS. », exemple « Le billet est réservé pour le numéro +221700009006, qui va recevoir un SMS. », « À accepter avant », « Verrouillé jusqu’à l’acceptation », boutons « Prévenir mon proche », « Terminer ». Les codes hors ligne sont supprimés sur ce navigateur seulement. Preuve : `M/20261103000005_lot6_billetterie.sql:78`, `TicketCard.tsx:429`, `:481-484`, `components/tickets/TransferModal.tsx:152`, `:167-170`, `:203-223`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Lamine, numéro saisi, avec ou sans compte | SMS | indispensable | prochain passage de la file | modèle « Event Village : un billet {title} vous est transféré. Connectez-vous avec ce numéro avant le {expires_at} : {APP_URL}/tickets » ; exemple « Event Village : un billet Gala de la Teranga vous est transféré. Connectez-vous avec ce numéro avant le 12 nov. à 18:30 : https://eventvillage.sn/tickets » (153 caractères, 1 segment) |
| Lamine, compte actif au numéro vérifié | cloche | indispensable | prochain passage de la file | titre « Un billet vous est transféré » ; modèle « Un billet pour « {title} » vous attend. Acceptez-le avant le {expires_at}. » ; exemple « Un billet pour « Gala de la Teranga » vous attend. Acceptez-le avant le jeu. 12 nov. 2026 à 18:30. » |
| Lamine, compte actif au numéro vérifié | push | indispensable | prochain passage de la file | titre « Un billet vous est transféré » ; modèle « Un billet pour « {title} » vous attend. Acceptez-le avant le {expires_at}. » ; exemple « Un billet pour « Gala de la Teranga » vous attend. Acceptez-le avant le jeu. 12 nov. 2026 à 18:30. » |
| Lamine, compte actif au numéro vérifié et adresse vérifiée | email | indispensable | prochain passage de la file | depuis le lot 9 bis, objet « Un billet vous est transféré — Event Village », texte de la cloche |

Le SMS compte dans le quota de Fatou, 30 par jour. Le lien du SMS mène à Mes billets, qui s'ouvre d'office sur « Reçus » quand un billet y attend (étape 7.16). Preuve : `TRANSFER_OFFERED` (`M/20261103000005_lot6_billetterie.sql:149`, `lib/tickets/ticket-transfer.service.ts:161`).

5. **Ce que les autres voient.** Lamine voit l'onglet « Reçus » avec un compteur. Mariama : rien.
6. **Ce qui est impossible.** « Le billet se transfère vers un numéro de téléphone. » ; « Numéro de téléphone du destinataire invalide. » ; « Vous n'êtes pas le porteur de ce billet. » ; « Seul un billet valide peut être transféré. » ; « Ce billet a déjà servi à l'entrée. » ; « Cet événement n'accepte plus les transferts de billets. » ; « Ce billet est déjà engagé dans un transfert en attente. ». Depuis le lot 9 bis, le transfert vers son propre numéro est refusé, sous ses deux formes (+221… et 221…) : « Vous ne pouvez pas transférer un billet à votre propre numéro. ». Sans mot de passe récent : « Par sécurité, saisissez votre mot de passe pour continuer. ». Preuve : `M/20261109000008_lot9bis_cycle.sql:1434-1440`, `lib/auth/password-confirm.ts:25`.
7. **Test et essai.** Test : `tests/parcours/controleur-9bis.test.ts:160` « ticket_transfer_initiate : SELF_TRANSFER pour +221… et 221…, sans transfert ni verrou » ; `tests/parcours/controleur-9bis.test.ts:174` « POST /api/tickets/[id]/transfer vers son propre numéro → 400 SELF_TRANSFER, aucun SMS au numéro » ; `tests/parcours/mot-de-passe-recent.test.ts` (transfert sans mot de passe récent refusé) ; `tests/parcours/notif-transferts.test.ts:180` « numéro vérifié : réponse QUEUED sans jeton ni lien, TRANSFER_OFFERED par SMS au numéro et in-app + push au compte ; SMS exact sans lien de réclamation » ; `tests/parcours/notif-transferts.test.ts:217` « numéro sans vérification : SMS au numéro seulement (aucune in-app à un compte non prouvé) » ; `tests/parcours/notif-transferts.test.ts:225` « cible email : 400 RECIPIENT_PHONE_REQUIRED, aucun transfert, billet libre » ; `tests/parcours/dette-transferts.test.ts:290` « initiation vers un téléphone : transfert PENDING et transfer_locked posés ensemble ; offre en file (QUEUED), SMS exact remis par l’envoyeur » ; `tests/parcours/dette-transferts.test.ts:341` « garde-fou : deux initiations simultanées du même billet → une seule réussit, un seul transfert PENDING » ; `tests/parcours/dette-transferts.test.ts:359` « ticket_transfer_initiate : transfert PENDING et verrou ensemble ; second transfert refusé ; tiers refusé sans effet ». Essai : Essai 27 de `docs/recette-billetterie.md`.

### Étape 8.2 — Lamine accepte

1. **Qui, où, quel bouton.** Lamine, `/tickets?tab=recus`, carte, « Accepter le billet », fenêtre « Accepter ce billet ? », « Le billet pour « {titre} » rejoint vos billets avec un nouveau QR code. L’expéditeur est prévenu et ne peut plus l’utiliser. », exemple « Le billet pour « Gala de la Teranga » rejoint vos billets avec un nouveau QR code. L’expéditeur est prévenu et ne peut plus l’utiliser. ». Preuve : `components/tickets/IncomingTransfers.tsx:272`, `:285-287`.
2. **Ce qu'il saisit.** Aucun. Carte : titre, « Envoyé par Fatou D. », date, lieu, « {catégorie} · {prix} » ou « · Gratuit », exemple « VIP · 10 000 F CFA », « À accepter avant le {date} », exemple « À accepter avant le jeu. 12 nov. 2026 à 18:30 ». Preuve : `components/tickets/IncomingTransfers.tsx:222-258`.
3. **Ce que fait le système.** Le billet change de propriétaire : nouveau numéro, nouveau QR, verrou levé. Il garde son paiement d'origine. Message « Billet ajouté à vos billets. ». Les rappels de Fatou s'annulent si elle n'a plus de billet valable de cet événement. Preuve : `M/20261108000002_lot9_invitations.sql:91`, `M/20261105000003_lot7_securite.sql:363`, `:391`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Lamine | cloche | indispensable | prochain passage de la file | titre « Billet reçu » ; modèle « Le billet {ticket_number} pour « {title} » du {start_at} est ajouté à Mes billets. » ; exemple « Le billet TCK-20261104-9E4B1C7A2F pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets. » |
| Lamine | push | indispensable | prochain passage de la file | titre « Billet reçu » ; modèle « Le billet {ticket_number} pour « {title} » du {start_at} est ajouté à Mes billets. » ; exemple « Le billet TCK-20261104-9E4B1C7A2F pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets. » |
| Lamine | email | indispensable | prochain passage de la file | objet « Billet reçu — Event Village » ; modèle : Billet reçu<br>Le billet {ticket_number} pour « {title} » du {start_at} est ajouté à Mes billets.<br>Événement : {title}<br>Date : {start_at}<br>Lieu : {location}, {city}<br>Catégorie : {category}<br>Numéro du billet : {ticket_number}<br>Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.<br>Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.<br>Voir mes billets : {APP_URL}/tickets<br>En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Billet reçu<br>Le billet TCK-20261104-9E4B1C7A2F pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets.<br>Événement : Gala de la Teranga<br>Date : sam. 14 nov. 2026 à 20:00<br>Lieu : CICAD, Diamniadio<br>Catégorie : VIP<br>Numéro du billet : TCK-20261104-9E4B1C7A2F<br>Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.<br>Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.<br>Voir mes billets : https://eventvillage.sn/tickets<br>En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Fatou | cloche | indispensable | prochain passage de la file | titre « Billet accepté » ; modèle « Votre billet pour « {title} » a été accepté par son destinataire. » ; exemple « Votre billet pour « Gala de la Teranga » a été accepté par son destinataire. » |
| Fatou | push | indispensable | prochain passage de la file | titre « Billet accepté » ; modèle « Votre billet pour « {title} » a été accepté par son destinataire. » ; exemple « Votre billet pour « Gala de la Teranga » a été accepté par son destinataire. » |
| Fatou, si son adresse est vérifiée | email | indispensable | prochain passage de la file | depuis le lot 9 bis, objet « Billet accepté — Event Village », texte de la cloche |

L'email de Lamine ne part, depuis le lot 9 bis, que si son adresse est vérifiée. Preuve : `TRANSFER_RECEIVED` (`M/20261108000002_lot9_invitations.sql:178`) ; `TRANSFER_CLAIMED_SENDER` (`M/20261108000002_lot9_invitations.sql:172`, `lib/tickets/ticket-transfer.service.ts:215`).

5. **Ce que les autres voient.** La carte disparaît chez Fatou et apparaît chez Lamine en direct.
6. **Ce qui est impossible.** « Ce transfert est introuvable. » ; « Confirmez d'abord votre numéro par un code SMS. » ; « Ce transfert n'est plus en attente. » ; depuis le lot 9 bis, sans durée inventée, « Ce billet ne peut plus être accepté : le délai est dépassé. » ; « Vous êtes déjà le propriétaire de ce billet. » ; « L'expéditeur n'est plus le propriétaire de ce billet. » ; « Ce billet n'est plus transférable. » ; « Cet événement n'accepte plus de transfert. ». À l'écran : « Billet non accepté ». Preuve : `lib/tickets/ticket-transfer.service.ts:146-162`.
7. **Test et essai.** Test : `tests/parcours/notif-transferts.test.ts:292` « destinataire vérifié : 200, billet transféré, identité du billet renouvelée, TRANSFER_CLAIMED_SENDER et TRANSFER_RECEIVED (in-app, push, email du destinataire, aucun SMS) ; second appel 409 » ; `tests/parcours/notif-transferts.test.ts:334` « refus : 404 identique (inconnu, transfert d’un autre, ancien transfert vers un email), 403 PHONE_NOT_VERIFIED, 410 TRANSFER_EXPIRED, 400 SELF_TRANSFER ; billet inchangé » ; `tests/parcours/acces-qr.test.ts:209` « identifiants régénérés ; ancien QR et ancien numéro refusés ; le QR du nouveau porteur passe » ; `tests/parcours/course-annulation-transfert.test.ts:213` « 2. ordre inverse : B tient event_cancel sans COMMIT, A attend ; après le COMMIT de B, A est refusé et le porteur ne change pas ». Essai : Essai 27 de `docs/recette-billetterie.md`.

### Étape 8.3 — Destinataire au numéro non vérifié, ou sans compte

1. **Qui, où, quel bouton.** Lamine, `/tickets?tab=recus`.
2. **Ce qu'il saisit.** Numéro non vérifié : bandeau « Un billet vous attend peut-être. Confirmez votre numéro pour le voir. », « Par sécurité, un billet transféré ne s’affiche qu’après la confirmation de votre numéro par un code SMS. », bouton « Confirmer mon numéro ». Fenêtre « Confirmer mon numéro », « Recevoir le code », « Code reçu par SMS », « Confirmer », « Renvoyer le code ». Sans compte : créer un compte sur `/register` avec ce numéro. Preuve : `components/tickets/IncomingTransfers.tsx:166-173`, `components/tickets/PhoneVerifyDialog.tsx:78`.
3. **Ce que fait le système.** Le code confirme le numéro. Message « Numéro confirmé. Les billets qui vous attendent s’affichent maintenant. ». Preuve : `M/20261103000002_lot6_outbox.sql:446`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Lamine, numéro à vérifier | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

Avant cette vérification, Lamine n'a reçu que le SMS de l'étape 8.1, ni cloche ni push. Preuve : `OTP_LOGIN`, `app/api/auth/send-otp/route.ts:99`.

5. **Ce que les autres voient.** Fatou : rien tant qu'il n'accepte pas.
6. **Ce qui est impossible.** Voir le détail avant la confirmation. Sans numéro sur le compte : « Aucun numéro sur votre compte ».
7. **Test et essai.** Test : `tests/parcours/notif-transferts.test.ts:248` « vérifié → l’élément ; non vérifié → phoneVerificationRequired sans détail ; autre compte → rien ; ancien transfert vers un email → rien » ; `tests/parcours/notif-transferts.test.ts:421` « code de connexion vérifié : phone_verified_at posé une fois (conservé ensuite) ; le transfert qui attendait devient visible » ; `tests/parcours/invitations-reclamation.test.ts:196` « compte au numéro non vérifié : aucun détail, 403 PHONE_NOT_VERIFIED, puis accepté une fois vérifié (AR15) ». Essai : Essai 63 de `docs/recette-billetterie.md` pour le parcours sans compte ; aucun pour un transfert vers un compte non vérifié.

### Étape 8.4 — Refus par le destinataire

1. **Qui, où, quel bouton.** Depuis le lot 9 bis, Lamine, `/tickets?tab=recus`, carte, bouton « Refuser ». Fenêtre « Refuser ce billet ? », « Le billet pour « {titre} » reste à son expéditeur, qui est prévenu. Vous ne pourrez plus l’accepter. », boutons « Refuser le billet » et « Revenir ». Pour une invitation : « Refuser cette invitation ? », « L’invitation pour « {titre} » est annulée et la place rendue à l’organisateur. Vous ne pourrez plus l’accepter. », bouton « Refuser l’invitation ». Preuve : `components/tickets/IncomingTransfers.tsx:22-24`, `:322-324`, `:347-358`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Transfert refusé, verrou levé : le billet redevient normal chez Fatou, avec son QR. Message « Billet refusé : il reste à son expéditeur. ». Une invitation refusée : billet « Annulé », place rendue au stock, « Invitation refusée. », et la liste de Mariama dit « Refusée ». Preuve : `app/api/tickets/transfers/[id]/decline/route.ts:29`, `M/20261109000008_lot9bis_cycle.sql` (`ticket_transfer_decline`).
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou | cloche, push, email si l'adresse est vérifiée | indispensable | prochain passage de la file | titre « Billet refusé » ; modèle « Le destinataire a refusé votre billet pour « {title} » : il reste dans vos billets. » ; exemple « Le destinataire a refusé votre billet pour « Gala de la Teranga » : il reste dans vos billets. » |

Une invitation refusée ne prévient personne. Preuve : `TRANSFER_DECLINED_SENDER` (`lib/notifications/catalog.ts:1430-1436`).

5. **Ce que les autres voient.** La carte disparaît de « Reçus » ; Fatou retrouve son billet sans attendre l'expiration.
6. **Ce qui est impossible.** Accepter ensuite. Un tiers et l'expéditeur reçoivent la même réponse qu'à l'acceptation, sans rien apprendre.
7. **Test et essai.** Test : `tests/parcours/cycle9bis-transfert.test.ts:277` « refus d’un transfert : 200, DECLINED et declined_at, verrou levé, TRANSFER_DECLINED_SENDER (in-app) à l’expéditeur » ; `tests/parcours/cycle9bis-transfert.test.ts:293` « refus d’une invitation : billet ANNULE, place rendue, liste partenaire « Refusée » » ; `tests/parcours/cycle9bis-transfert.test.ts:310` « tiers et expéditeur : même refus que l’acceptation (aucune fuite), transfert intact ». Essai : aucun.

### Étape 8.5 — Expiration du transfert

1. **Qui, où, quel bouton.** La tâche des transferts, chaque heure à la minute 17. Preuve : `supabase/ops/schedule-crons.sql:103`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Le transfert expire 48 heures après l'envoi, le verrou tombe, le billet revient à la normale. Depuis le lot 9 bis, il n'attend plus le passage horaire : un transfert échu est traité dès que Fatou ouvre Mes billets, ou dès que le billet est scanné. Preuve : `M/20261103000005_lot6_billetterie.sql:239`, `app/api/tickets/route.ts:60-64`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou | cloche | indispensable | passage horaire de l'expiration, puis prochain passage de la file | titre « Transfert expiré » ; modèle « Votre billet pour « {title} » n'a pas été accepté à temps : il reste dans vos billets. » ; exemple « Votre billet pour « Gala de la Teranga » n'a pas été accepté à temps : il reste dans vos billets. » |
| Fatou | push | indispensable | passage horaire de l'expiration, puis prochain passage de la file | titre « Transfert expiré » ; modèle « Votre billet pour « {title} » n'a pas été accepté à temps : il reste dans vos billets. » ; exemple « Votre billet pour « Gala de la Teranga » n'a pas été accepté à temps : il reste dans vos billets. » |
| Fatou, si son adresse est vérifiée | email | indispensable | prochain passage de la file | depuis le lot 9 bis, objet « Transfert expiré — Event Village », texte de la cloche |

Un seul avis par canal, que l'expiration vienne de la lecture, du scan ou de la tâche horaire. Lamine n'est pas prévenu. Preuve : `TRANSFER_EXPIRED` (`M/20261103000005_lot6_billetterie.sql:281`, `supabase/ops/schedule-crons.sql:103`).

5. **Ce que les autres voient.** La carte de Fatou redevient normale, QR revenu.
6. **Ce qui est impossible.** Accepter après l'échéance. Un nouveau transfert reste possible ensuite.
7. **Test et essai.** Test : `tests/parcours/dette-transferts.test.ts:417` « ticket_transfers_expire : transfert échu → EXPIRED et billet déverrouillé ; transfert en cours intact » ; `tests/parcours/dette-transferts.test.ts:552` « T15 : cron rejoué → le transfert expire une seule fois, sans second avis » ; `tests/parcours/dette-transferts.test.ts:571` « T16 : après expiration, nouveau transfert accepté sur le même billet, billet de nouveau verrouillé » ; `tests/parcours/notif-transferts.test.ts:334` « refus : 404 identique (inconnu, transfert d’un autre, ancien transfert vers un email), 403 PHONE_NOT_VERIFIED, 410 TRANSFER_EXPIRED, 400 SELF_TRANSFER ; billet inchangé » ; `tests/parcours/cycle9bis-transfert.test.ts:336` « GET /api/tickets : transfert EXPIRED, billet déverrouillé, un seul TRANSFER_EXPIRED par canal (même clé que le cron) » ; `tests/parcours/cycle9bis-transfert.test.ts:359` « scan d’un billet dont le transfert est échu : entrée acceptée (témoin) et transfert expiré par le scan ». Essai : aucun.

### Étape 8.6 — Fatou annule son transfert

1. **Qui, où, quel bouton.** Fatou, `/tickets`, carte, « Annuler le transfert », fenêtre « Annuler ce transfert ? », « Le billet reste à vous et son code d’entrée revient sur cette page. {numéro masqué} ne pourra plus l’accepter. », exemple « Le billet reste à vous et son code d’entrée revient sur cette page. 77 *** ** 67 ne pourra plus l’accepter. », boutons « Annuler le transfert », « Garder le transfert ». Preuve : `TicketCard.tsx:496`, `:681-684`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Transfert annulé, verrou levé. Message « Transfert annulé : votre billet est de nouveau disponible. ». Preuve : `M/20261103000005_lot6_billetterie.sql:174`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Lamine, numéro | SMS | indispensable | prochain passage de la file | modèle « Event Village : le transfert du billet {title} a été annulé par son propriétaire. » ; exemple « Event Village : le transfert du billet Gala de la Teranga a été annulé par son propriétaire. » (92 caractères, 1 segment) |
| Lamine, compte vérifié | cloche | indispensable | prochain passage de la file | titre « Transfert annulé » ; modèle « Le transfert du billet pour « {title} » a été annulé par son propriétaire. » ; exemple « Le transfert du billet pour « Gala de la Teranga » a été annulé par son propriétaire. » |
| Lamine, compte vérifié | push | indispensable | prochain passage de la file | titre « Transfert annulé » ; modèle « Le transfert du billet pour « {title} » a été annulé par son propriétaire. » ; exemple « Le transfert du billet pour « Gala de la Teranga » a été annulé par son propriétaire. » |
| Lamine, compte vérifié et adresse vérifiée | email | indispensable | prochain passage de la file | depuis le lot 9 bis, objet « Transfert annulé — Event Village », texte de la cloche |

Preuve : `TRANSFER_CANCELLED` (`M/20261103000005_lot6_billetterie.sql:212`).

5. **Ce que les autres voient.** La carte disparaît de « Reçus » chez Lamine.
6. **Ce qui est impossible.** « Ce transfert a déjà été réclamé : il ne peut plus être annulé. » ; « Ce transfert est déjà annulé. » ; « Ce transfert a déjà expiré. » ; « Vous n'êtes pas l'émetteur de ce transfert. ».
7. **Test et essai.** Test : `tests/parcours/dette-transferts.test.ts:399` « ticket_transfer_cancel : CANCELLED et billet déverrouillé ensemble ; annulation par un tiers refusée sans effet » ; `tests/parcours/dette-transferts.test.ts:528` « T11 : POST /api/tickets/transfers/[id]/cancel par l’émetteur → 200, CANCELLED, billet libre, porteur inchangé » ; `tests/parcours/dette-transferts.test.ts:541` « T12 : la même route par un tiers → 403 NOT_SENDER, transfert toujours PENDING, billet toujours verrouillé ». Essai : aucun.

### Étape 8.7 — Ancien QR invalide

1. **Qui, où, quel bouton.** Fatou présente une capture ou un ancien code après l'acceptation par Lamine.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Le QR change avec le propriétaire : l'ancien code ne passe plus. Écran du contrôleur, depuis le lot 9 bis : « QR expiré : demandez au client d’ouvrir son billet dans l’application ». L'ancien numéro n'existe plus en saisie manuelle. Preuve : `lib/scan/scan-result.ts`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Le QR de Lamine passe.
6. **Ce qui est impossible.** Entrer avec l'ancien code. Depuis le lot 9 bis, avant l'acceptation non plus : un billet en cours de transfert est refusé au scan comme en saisie manuelle, résultat « Transfert en cours » (étape 10.7). Preuve : `M/20261109000008_lot9bis_cycle.sql` (`ticket_scan`).
7. **Test et essai.** Test : `tests/parcours/acces-totp.test.ts:292` « transfert : code de l’ancien secret refusé, ancien porteur sans live-code, nouveau porteur accepté » ; `tests/parcours/acces-qr.test.ts:209` « identifiants régénérés ; ancien QR et ancien numéro refusés ; le QR du nouveau porteur passe » ; `e2e/recette.spec.ts:616` « acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture ». Essai : Essai 28 de `docs/recette-billetterie.md`.

### Étape 8.8 — Mariama envoie des invitations

1. **Qui, où, quel bouton.** Mariama, `/partner/events/{id}?tab=invitations`, « Inviter par SMS », bouton « Envoyer les invitations », fenêtre « Confirmer l’envoi », « Un SMS part aussitôt vers chaque numéro et les places sont prises sur le stock de la catégorie. ». L'envoi par un admin depuis un écran dédié est NON VÉRIFIÉ : le serveur l'autorise, et seul le pilotage du partenaire monte cet onglet. Preuve : `components/partner/pilotage/InvitationsTab.tsx:235`, `:308`, `:317-318`, `app/partner/events/[id]/page.tsx:247`.
2. **Ce qu'il saisit.** « Catégorie » ; « Billets par numéro », 1 à 4 ; « Numéros de téléphone », un par ligne, 10 au plus. Erreurs : « Choisissez une catégorie encore disponible. » ; « Saisissez au moins un numéro de téléphone. » ; « 10 numéros au plus par envoi. » ; « Numéro {n} : saisissez un numéro sénégalais à 9 chiffres (par exemple 77 123 45 67). », exemple « Numéro 2 : saisissez un numéro sénégalais à 9 chiffres (par exemple 77 123 45 67). » ; « Numéro {n} : ce numéro figure deux fois dans la liste. » ; « Choisissez de 1 à 4 billets par numéro. ».
3. **Ce que fait le système.** Pour un événement validé ou publié, tout ou rien. Toute catégorie active convient, quels que soient ses canaux et ses dates. Le stock baisse, chaque billet vaut 0 F. Résultat : « Invitations envoyées », « {n} billets pour {n} numéros. », exemple « 4 billets pour 2 numéros. ». Preuve : `M/20261108000002_lot9_invitations.sql:348`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Chaque numéro invité | SMS | indispensable | prochain passage de la file | modèle « Event Village : {ticket_count} invitations pour {title} le {start_at}. Connectez-vous avec ce numéro : {APP_URL}/tickets » ; exemple « Event Village : 2 invitations pour Gala de la Teranga le sam. 14 nov. à 20:00. Connectez-vous avec ce numéro : https://eventvillage.sn/tickets » (142 caractères, 1 segment) |
| Le compte actif au numéro vérifié, s'il existe | cloche, push, email si l'adresse est vérifiée | indispensable | prochain passage de la file | depuis le lot 9 bis, titre « Invitation reçue » ; modèle « {ticket_count} invitations pour « {title} » le {start_at} : vos billets sont dans Mes billets. » ; exemple « 2 invitations pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00 : vos billets sont dans Mes billets. » |

Preuve : `INVITATION_RECEIVED` (`lib/notifications/catalog.ts:680-689`, `M/20261109000009_lot9bis_messages.sql:45-47`).

5. **Ce que les autres voient.** Stock public en baisse. Le pilotage compte les invitations à part. Pas de « premier billet vendu ». Dernière place : étape 7.14.
6. **Ce qui est impossible.** « Les invitations ne peuvent être envoyées que pour un événement validé ou publié. » ; « Cet événement n’accepte pas d’invitations pour le moment. » ; « Vous n’avez pas le droit d’envoyer des invitations pour cet événement. ». Réseau : « Envoi non confirmé », « La connexion a été interrompue. Consultez l’historique ci-dessous avant de recommencer. ».
7. **Test et essai.** Test : `tests/parcours/invitations.test.ts:165` « partenaire propriétaire : 200 { ok, ticket_count, phone_count, message } » ; `tests/parcours/invitations.test.ts:187` « ADMIN sans events.write : 403 FORBIDDEN ; ADMIN avec events.write et SUPERADMIN : 200 » ; `tests/parcours/invitations.test.ts:216` « statuts BROUILLON, EN_ATTENTE, SUSPENDU, TERMINE, ANNULE : 409 EVENT_NOT_ACTIVE, sans écriture » ; `tests/parcours/invitations.test.ts:227` « statuts VALIDE et PUBLIE : acceptés, billets créés » ; `tests/parcours/invitations.test.ts:294` « catégorie sans canal, vente close, un billet maximum par commande : acceptée, décision à faux sur les deux canaux » ; `tests/parcours/invitations.test.ts:345` « stock : au-delà du restant (numéros × quantité) 409 INSUFFICIENT_STOCK sans écriture ; exactement le restant accepté, stock décrémenté, réservé à 0 » ; `e2e/recette.spec.ts:841` « acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée ». Essai : Essai 62 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.8 bis.

### Étape 8.9 — Invité avec un compte vérifié

1. **Qui, où, quel bouton.** Le numéro d'un compte actif au numéro vérifié, par exemple Lamine. Aucune action.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Les billets sont posés directement sur son compte, « Valable », visibles dans « À venir ». Preuve : `tests/parcours/invitations.test.ts:363`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Lamine | cloche, push, email si l'adresse est vérifiée | indispensable | prochain passage de la file | depuis le lot 9 bis, « Invitation reçue », texte de l'étape 8.8 |

En plus du SMS de l'étape 8.8.

5. **Ce que les autres voient.** La réponse à Mariama est la même avec ou sans compte.
6. **Ce qui est impossible.** Refuser l'invitation.
7. **Test et essai.** Test : `tests/parcours/messages-comptes-9bis.test.ts:293` « invitation à un compte vérifié : INVITATION_RECEIVED in-app et push au compte ; la ligne SMS reste sans compte ni acteur » ; `tests/parcours/invitations.test.ts:363` « compte ACTIF au numéro vérifié : billets au compte, canal INVITATION, prix 0, décision INVITATION, aucun paiement, aucun transfert » ; `tests/parcours/invitations.test.ts:421` « réponse identique avec ou sans compte : aucune énumération (L7) ». Essai : Essai 62 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.8 bis.

### Étape 8.10 — Invité au compte non vérifié, ou suspendu

1. **Qui, où, quel bouton.** Un compte dont le numéro n'est pas vérifié. `/tickets?tab=recus`, bandeau de l'étape 8.3.
2. **Ce qu'il saisit.** Le code SMS.
3. **Ce que fait le système.** Traité comme un invité sans compte (étape 8.11). Compte suspendu : les billets ne lui sont jamais attribués.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| L'invité, numéro à vérifier | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

Preuve : `OTP_LOGIN`, `app/api/auth/send-otp/route.ts:99`.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Voir le billet avant la vérification : « Confirmez d'abord votre numéro par un code SMS. ».
7. **Test et essai.** Test : `tests/parcours/invitations.test.ts:407` « compte au numéro non vérifié ou compte suspendu : attente (AR15), jamais attribué » ; `tests/parcours/invitations-reclamation.test.ts:196` « compte au numéro non vérifié : aucun détail, 403 PHONE_NOT_VERIFIED, puis accepté une fois vérifié (AR15) ». Essai : aucun essai numéroté, `docs/essai-local.md` section 8.8 bis.

### Étape 8.11 — Modou, invité sans compte

1. **Qui, où, quel bouton.** Modou. `/register` avec ce numéro, puis `/tickets?tab=recus`, « Accepter le billet ».
2. **Ce qu'il saisit.** Son inscription (chapitre 1).
3. **Ce que fait le système.** Les billets existent sans propriétaire, verrouillés, avec un transfert en attente par billet, jusqu'à la fin de l'événement. Depuis le lot 9 bis, « Reçus » distingue l'invitation d'un transfert : « Invitation de {organisateur} », « · Invitation » au lieu du prix, et la confirmation « L’invitation pour « {titre} » rejoint vos billets avec son QR code. ». Une acceptation par billet : 2 invitations font 2 cartes. Modou peut aussi refuser (étape 8.4). Preuve : `tests/parcours/invitations.test.ts:381`, `M/20261108000002_lot9_invitations.sql:639`, `components/tickets/IncomingTransfers.tsx:261`, `:288`, `:339-341`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Modou, à l'acceptation | cloche | indispensable | prochain passage de la file | titre « Billet reçu » ; modèle « Le billet {ticket_number} pour « {title} » du {start_at} est ajouté à Mes billets. » ; exemple « Le billet TCK-20261104-9E4B1C7A2F pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets. » |
| Modou, à l'acceptation | push | indispensable | prochain passage de la file | titre « Billet reçu » ; modèle « Le billet {ticket_number} pour « {title} » du {start_at} est ajouté à Mes billets. » ; exemple « Le billet TCK-20261104-9E4B1C7A2F pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets. » |
| Modou, à l'acceptation | email | indispensable | prochain passage de la file | objet « Billet reçu — Event Village » ; contenu cité intégralement à l’étape 8.2 |

Aucun avis à un expéditeur. Preuve : `TRANSFER_RECEIVED` (`M/20261108000002_lot9_invitations.sql:178`).

5. **Ce que les autres voient.** Export : « Invitation en attente » tant que le billet n'est pas pris. Historique : toujours « Envoyée », gardé par décision au lot 9 bis (aucune information sur l'existence d'un compte), sauf « Refusée » après un refus.
6. **Ce qui est impossible.** Autre compte : « Ce transfert est introuvable. ».
7. **Test et essai.** Test : `tests/parcours/invitations-reclamation.test.ts:121` « le billet est retrouvé dans « Reçus », accepté, numéro, QR et secret changés ; aucun avis à un expéditeur » ; `tests/parcours/invitations-reclamation.test.ts:168` « plusieurs billets : un transfert et une acceptation par billet » ; `tests/parcours/invitations-reclamation.test.ts:183` « autre compte : 404 identique à un transfert inconnu, billet intact » ; `tests/parcours/invitations-reclamation.test.ts:262` « report de date : échéance recalée sur la nouvelle fin pour l’invitation, inchangée pour un transfert ordinaire du même événement (L8) ». Essai : Essai 63 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.8 bis.

### Étape 8.12 — Annuler une invitation

1. **Qui, où, quel bouton.** Mariama, onglet Invitations, « Annuler l’invitation », fenêtre « Annuler cette invitation ? », « Le billet {catégorie} de {numéro masqué} ne sera plus valable. La place revient au stock et aucun SMS n’est envoyé. », exemple « Le billet VIP de 77 *** ** 67 ne sera plus valable. La place revient au stock et aucun SMS n’est envoyé. », boutons « Annuler l’invitation », « Garder l’invitation ».
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Billet « Annulé », place rendue. Marche aussi sur un billet déjà pris et sur un événement suspendu. Message « Invitation annulée : la place revient au stock. », statut « Annulée ». Depuis le lot 9 bis, l'invité est prévenu (tableau ci-dessous) : le texte de la fenêtre, « aucun SMS n’est envoyé », est devenu faux, et n'a pas été corrigé au lot (`components/partner/pilotage/InvitationsTab.tsx:449`). Preuve : `M/20261109000009_lot9bis_messages.sql:32-35` (`ticket_invitation_cancel`).
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le numéro de l'invitation non réclamée | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre invitation pour {title} du {start_at} est annulée par l'organisateur. » ; exemple « Event Village : votre invitation pour Gala de la Teranga du sam. 14 nov. à 20:00 est annulée par l'organisateur. » (112 caractères, 1 segment) |
| Le compte qui a pris l'invitation | SMS, cloche, email si l'adresse est vérifiée | indispensable | prochain passage de la file | SMS identique ; cloche titre « Invitation annulée », exemple « Votre invitation pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulée par l'organisateur. » |

Preuve : `TICKET_CANCELLED` (`lib/notifications/catalog.ts:1537-1558`).

5. **Ce que les autres voient.** L'invité : carte « Annulé », « Ce billet est annulé : il ne donne plus accès à l’événement. », ou disparition de « Reçus ». Stock public rendu.
6. **Ce qui est impossible.** « Ce billet a déjà été scanné : l’invitation ne peut plus être annulée. » ; « Cette invitation ne peut plus être annulée. » ; « Invitation introuvable. » ; « Vous n’avez pas le droit d’annuler les invitations de cet événement. ».
7. **Test et essai.** Test : `tests/parcours/invitations-annulation.test.ts:141` « invitation en attente : billet ANNULE et déverrouillé, transfert CANCELLED, stock rendu, audit ; seul avis : TICKET_CANCELLED au numéro (R22) » ; `tests/parcours/invitations-annulation.test.ts:167` « acceptation après annulation : 409 TRANSFER_NOT_PENDING, absente de « Reçus », billet resté annulé » ; `tests/parcours/invitations-annulation.test.ts:187` « après réclamation : billet au compte annulé, transfert CLAIMED conservé, stock rendu, seul avis : TICKET_CANCELLED au compte (R22) » ; `tests/parcours/messages-comptes-9bis.test.ts:133` « invitation non réclamée annulée : TICKET_CANCELLED par SMS au numéro, sans compte, texte exact » ; `tests/parcours/messages-comptes-9bis.test.ts:150` « invitation réclamée (attribuée au compte) annulée : TICKET_CANCELLED in-app et SMS au compte » ; `tests/parcours/invitations-annulation.test.ts:215` « événement suspendu : annulation permise, le statut n’est pas contrôlé » ; `tests/parcours/invitations-annulation.test.ts:227` « billet scanné : 409 TICKET_ALREADY_USED, billet et stock inchangés » ; `tests/parcours/invitations-annulation.test.ts:250` « droits : autre partenaire et client 404, admin sans events.write 403, billet intact ; admin avec events.write et SUPERADMIN 200 ». Essai : aucun essai numéroté, `docs/essai-local.md` section 8.8 bis.

### Étape 8.13 — Quotas d'invitations

1. **Qui, où, quel bouton.** Mariama, envoi au-delà des limites.
2. **Ce qu'il saisit.** Comme à l'étape 8.8.
3. **Ce que fait le système.** Deux règles, tout ou rien : 50 numéros par heure et par événement ; 3 envois par jour et par numéro, tous événements confondus. Un seul numéro au plafond refuse tout l'envoi. Preuve : `lib/env.ts:102-103`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Bandeau « Limite d’envoi atteinte », « Limite d'invitations atteinte pour cet événement. Réessayez plus tard. », « Ce numéro a déjà reçu le maximum d'invitations aujourd'hui. », « Nouvel essai possible dans environ {n} minutes. », exemple « Nouvel essai possible dans environ 12 minutes. ». Le numéro fautif n'est pas nommé.
7. **Test et essai.** Test : `tests/parcours/invitations-quotas.test.ts:94` « événement : 50 numéros par heure, le 51e est refusé, stock et billets inchangés » ; `tests/parcours/invitations-quotas.test.ts:110` « numéro : 3 envois par jour, tous événements confondus, quelle que soit la quantité ; le 4e est refusé » ; `tests/parcours/invitations-quotas.test.ts:130` « un numéro au plafond dans l’envoi : refus entier, rien pour les autres numéros, leur quota intact » ; `tests/parcours/invitations-quotas.test.ts:161` « un refus de stock ne consomme aucun quota ». Essai : aucun essai numéroté, `docs/essai-local.md` section 8.8 bis.

### Étape 8.14 — Invitation non réclamée à la fin de l'événement

1. **Qui, où, quel bouton.** La tâche des transferts.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Le transfert expire, le billet reste sans propriétaire, la place n'est pas rendue au stock. Preuve : `M/20261103000005_lot6_billetterie.sql:239`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Historique de Mariama : toujours « Envoyée », annulation encore proposée.
6. **Ce qui est impossible.** Prendre le billet.
7. **Test et essai.** Test : `tests/parcours/invitations-reclamation.test.ts:236` « expiration : 410 avant le passage du cron, puis EXPIRED sans aucun avis, billet déverrouillé et sans porteur, réclamation 409 ». Essai : aucun.

# Chapitre 9. Les rappels

La tâche des rappels tourne toutes les 5 minutes (`supabase/ops/schedule-crons.sql:99`), pour un événement « Publié » seulement, avec une tolérance de 15 minutes et sans rattrapage (`M/20261105000002_lot7_sms.sql:540`). Son exécution réelle sur event-village-dev est NON VÉRIFIÉ : le script de planification se lance à la main, hors du dépôt, et le projet distant n'a pas été interrogé.

### Étape 9.1 — La veille

1. **Qui, où, quel bouton.** Le système, la veille du début à 10 h, heure de Dakar. Preuve : `M/20261103000003_lot6_reglages.sql:24`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Une ligne par canal et par compte détenteur d'un billet « Valable » créé avant l'échéance. Après un report, un nouveau rappel est possible. Billet du guichet sans compte et invitation non réclamée : rien.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, détentrice | SMS | optionnel | échéance 10 h, puis prochain passage de la file | modèle « Event Village : rappel, {title} demain à {start_at}, {location}. Vos billets : {APP_URL}/tickets » ; exemple « Event Village : rappel, Gala de la Teranga demain à 20:00, CICAD. Vos billets : https://eventvillage.sn/tickets » (111 caractères, 1 segment) |
| Fatou, détentrice | cloche | optionnel | échéance 10 h, puis prochain passage de la file | titre « Rappel : c'est demain » ; modèle « « {title} » demain à {start_at}, {location}, {city}. Vos billets sont dans Mes billets. » ; exemple « « Gala de la Teranga » demain à 20:00, CICAD, Diamniadio. Vos billets sont dans Mes billets. » |
| Fatou, détentrice | push | optionnel | échéance 10 h, puis prochain passage de la file | titre « Rappel : c'est demain » ; modèle « « {title} » demain à {start_at}, {location}, {city}. Vos billets sont dans Mes billets. » ; exemple « « Gala de la Teranga » demain à 20:00, CICAD, Diamniadio. Vos billets sont dans Mes billets. » |
| Fatou, détentrice | email | optionnel | échéance 10 h, puis prochain passage de la file | objet « Rappel : c'est demain — Event Village » ; modèle : Rappel : c'est demain<br>« {title} » demain à {start_at}, {location}, {city}. Vos billets sont dans Mes billets.<br>Ouvrir Event Village : {APP_URL}/tickets<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : {APP_URL}/profile/notifications?topic=REMINDERS ; exemple : Rappel : c'est demain<br>« Gala de la Teranga » demain à 20:00, CICAD, Diamniadio. Vos billets sont dans Mes billets.<br>Ouvrir Event Village : https://eventvillage.sn/tickets<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn<br>Ne plus recevoir ces emails : https://eventvillage.sn/profile/notifications?topic=REMINDERS |

Preuve : `REMINDER_J1`, `M/20261105000002_lot7_sms.sql:638`. Le SMS est perdu en heures calmes ou au-delà du budget, sans report.

5. **Ce que les autres voient.** Contrôleurs : le rappel de la veille à 18 h (ci-dessous).

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima | SMS | optionnel | veille à 18 h, puis prochain passage de la file | modèle « Event Village : demain {title} à {start_at}, point {entry_point}, espèces autorisées. Connexion : {APP_URL}/login » ; exemple « Event Village : demain Gala de la Teranga à 20:00, point Porte Nord, espèces autorisées. Connexion : https://eventvillage.sn/login » (130 caractères, 1 segment) |
| Ibrahima | cloche | optionnel | veille à 18 h, puis prochain passage de la file | titre « Contrôle demain » ; modèle « Demain « {title} » à {start_at}, point d'entrée {entry_point}, espèces autorisées. » ; exemple « Demain « Gala de la Teranga » à 20:00, point d'entrée Porte Nord, espèces autorisées. » |
| Ibrahima | push | optionnel | veille à 18 h, puis prochain passage de la file | titre « Contrôle demain » ; modèle « Demain « {title} » à {start_at}, point d'entrée {entry_point}, espèces autorisées. » ; exemple « Demain « Gala de la Teranga » à 20:00, point d'entrée Porte Nord, espèces autorisées. » |

Preuve : `CONTROLLER_REMINDER`, `M/20261105000002_lot7_sms.sql:706`.

6. **Ce qui est impossible.** Un rattrapage : billet acheté après l'échéance, ou tâche arrêtée plus de 15 minutes. Rappels annulés à la suspension, à l'annulation, à la fin, au report, au changement de détenteur.
7. **Test et essai.** Test : `tests/parcours/notif-rappels.test.ts:320` « rien à 09:59 la veille ; à 10:00 une ligne par canal, clé avec le début, échéance 10:00 ; pas de H-3 à cette heure » ; `tests/parcours/notif-rappels.test.ts:335` « tolérance de 15 min : premier passage à 10:14 → créé (échéance 10:00) ; premier passage à 10:16 → rien, ni ensuite » ; `tests/parcours/notif-rappels.test.ts:354` « rappels désactivés (notif.reminder_j1_enabled, notif.reminder_h3_enabled = false) : rien ; réactivés dans la fenêtre : créés » ; `tests/parcours/notif-rappels.test.ts:460` « achat tardif (heure réelle) : billet acheté après l’échéance du H-3 → aucun rappel ; témoin acheté avant → rappel » ; `tests/parcours/notif-rappels.test.ts:554` « 5 billets d’un compte → une ligne par canal ; deux planifications et deux envois → aucun doublon, un seul SMS au texte exact » ; `tests/parcours/notif-rappels.test.ts:586` « invitation → rappel ; billet de guichet (sans porteur) → rien ; compte suspendu → lignes SKIPPED ACCOUNT_SUSPENDED (trace) ». Essai : Essai 48 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.7.

### Étape 9.2 — Trois heures avant

1. **Qui, où, quel bouton.** Le système, 3 heures avant le début. Preuve : `M/20261103000003_lot6_reglages.sql:28`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Comme à l'étape 9.1. Les billets déjà utilisés sont exclus.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, détentrice | SMS | optionnel | échéance, puis prochain passage de la file ; SMS seulement si le push n'est pas accepté, perdu en heures calmes ou au-delà du budget | modèle « Event Village : {title} à {start_at}. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga à 20:00. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. https://eventvillage.sn/tickets » (143 caractères, 1 segment) |
| Fatou, détentrice | cloche | optionnel | échéance, puis prochain passage de la file ; SMS seulement si le push n'est pas accepté, perdu en heures calmes ou au-delà du budget | titre « C'est bientôt » ; modèle « « {title} » commence à {start_at} ({location}). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau. » ; exemple « « Gala de la Teranga » commence à 20:00 (CICAD). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau. » |
| Fatou, détentrice | push | optionnel | échéance, puis prochain passage de la file ; SMS seulement si le push n'est pas accepté, perdu en heures calmes ou au-delà du budget | titre « C'est bientôt » ; modèle « « {title} » commence à {start_at} ({location}). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau. » ; exemple « « Gala de la Teranga » commence à 20:00 (CICAD). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau. » |

Pas d'email. Preuve : `REMINDER_H3`, `M/20261105000002_lot7_sms.sql:310-324`.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Identique à l'étape 9.1. Un événement qui commence entre 01:00 et 10:59 n'a jamais de SMS trois heures avant : l'échéance tombe en heures calmes.
7. **Test et essai.** Test : `tests/parcours/notif-rappels.test.ts:438` « rien à début - 3 h - 1 min, créé à début - 3 h (I P S, IF_NO_PUSH) ; le J-1 n’est pas rattrapé ; notif.reminder_h3_hours = 5 déplace l’échéance » ; `tests/parcours/notif-rappels.test.ts:482` « billets UTILISE : pas de H-3 pour un compte sans billet VALIDE ; un billet VALIDE restant suffit » ; `tests/parcours/notif-rappels.test.ts:505` « notif.h3_sms = IF_NO_PUSH : push accepté → SMS SKIPPED PUSH_DELIVERED ; sans appareil → SMS envoyé au texte exact ; push urgent » ; `tests/parcours/notif-rappels-annulation.test.ts:269` « suspension : rappels PENDING → CANCELLED EVENT_SUSPENDU dans la même transaction ; réactivation dans la tolérance → pas recréés, rien envoyé » ; `tests/parcours/notif-rappels-annulation.test.ts:310` « annulation (event_cancel) : CANCELLED EVENT_ANNULE et EVENT_CHANGED NO_LONGER_RELEVANT dans la transaction de l’annulation » ; `tests/parcours/notif-rappels-annulation.test.ts:337` « fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER PENDING → CANCELLED EVENT_TERMINE, EVENT_CHANGED → NO_LONGER_RELEVANT » ; `tests/parcours/notif-rappels-annulation.test.ts:363` « event_update (début déplacé d’un jour) : CANCELLED EVENT_RESCHEDULED dans la transaction de l’édition ; nouvelle clé au passage suivant, un seul SMS » ; `tests/parcours/notif-rappels-annulation.test.ts:421` « ancien porteur sans autre billet → CANCELLED NO_LONGER_HOLDER (transaction de l’acceptation) ; porteur qui garde un billet → intact ; nouveaux porteurs → rappels à venir ». Essai : Essai 48 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.7.

### Étape 9.3 — Préférences du client

1. **Qui, où, quel bouton.** Fatou, `/profile/notifications`, titre « Préférences de notification », « Choisissez comment Event Village vous prévient. Les messages indispensables partent toujours. ». Preuve : `app/profile/notifications/page.tsx:245`.
2. **Ce qu'il saisit.** Interrupteurs par sujet et par canal (« Application », « SMS », « Email », « Notifications push »). Sujets : « Rappels avant l'événement », « Changements d'un événement », et pour un partenaire « Activité de vos ventes ». Section « Toujours envoyées » : « Codes de connexion », « Confirmations d’achat et reçus », « Billets transférés », « Annulations », « Remboursements », « Sécurité du compte ».
3. **Ce que fait le système.** Sans réglage, tout est activé. Un canal coupé n'envoie rien pour ce sujet. Message « {sujet} : {canal} activé. » ou désactivé, exemple « Rappels avant l'événement : SMS désactivé. ». Preuve : `M/20261103000002_lot6_outbox.sql:389-398`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Supervision des admins : motif « non envoyée ».
6. **Ce qui est impossible.** Couper un message indispensable : « Préférence inconnue : seuls les rappels, les changements d’un événement et l’activité des ventes se règlent, canal par canal. Les messages indispensables sont toujours envoyés. ». Preuve : `M/20261103000002_lot6_outbox.sql:1328`.
7. **Test et essai.** Test : `tests/parcours/notif-preferences.test.ts:234` « client : sujets « Rappels avant l’événement » et « Changements d’un événement », 4 canaux activés, indispensables listés, pas d’« Activité de vos ventes » » ; `tests/parcours/notif-preferences.test.ts:254` « partenaire : « Activité de vos ventes » en plus ; RPC notification_preferences_get : is_partner » ; `tests/parcours/notif-preferences.test.ts:278` « PUT REMINDERS/SMS désactivé puis réactivé : seul ce canal change, ligne notification_preferences » ; `tests/parcours/notif-preferences.test.ts:297` « sujet inconnu, canal inconnu, valeur non booléenne, indispensable → 400 INVALID_PREFERENCE, aucune écriture » ; `tests/parcours/notif-preferences.test.ts:367` « à l’insertion : SMS SKIPPED PREFERENCE_DISABLED (stage ENQUEUE) ; autres canaux en attente ; préférence d’un autre sujet sans effet » ; `tests/parcours/notif-preferences.test.ts:414` « tous les optionnels coupés : l’achat crée sa confirmation sans PREFERENCE_DISABLED et le SMS part ». Essai : Essai 47 de `docs/recette-billetterie.md`.

### Étape 9.4 — Push contre SMS

1. **Qui, où, quel bouton.** La file des messages.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** La veille, SMS et push partent ensemble. Trois heures avant, le SMS attend le résultat du push, au plus 15 minutes. Push accepté par le service : pas de SMS. Push absent, sauté ou en échec : SMS envoyé. « Accepté » ne veut pas dire « affiché » sur le téléphone. Preuve : `M/20261105000002_lot7_sms.sql:310-324`, `lib/notifications/dispatcher.ts:450-475`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Les textes sont ceux de l'étape 9.2.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Régler ce choix depuis le profil : c'est un réglage du SUPERADMIN.
7. **Test et essai.** Test : `tests/parcours/notif-rappels.test.ts:505` « notif.h3_sms = IF_NO_PUSH : push accepté → SMS SKIPPED PUSH_DELIVERED ; sans appareil → SMS envoyé au texte exact ; push urgent ». Essai : aucun essai numéroté, `docs/essai-local.md` section 8.7.

### Étape 9.5 — Billets gratuits

1. **Qui, où, quel bouton.** Le système.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Un détenteur de billets gratuits ou d'invitations seuls reçoit la cloche, le push et l'email, pas le SMS. Un billet payant du même événement suffit à garder le SMS. La confirmation de réservation gratuite garde son SMS. Preuve : `M/20261105000001_lot7_reglages.sql:32`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Les textes sont ceux des étapes 9.1 et 9.2, sans le SMS.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Aucun.
7. **Test et essai.** Test : `tests/parcours/rappels-gratuits.test.ts:186` « billet FREE à 0 F : J-1 et H-3 créés (application et push), SMS SKIPPED FREE_TICKETS_ONLY, free_only ; aucun SMS » ; `tests/parcours/rappels-gratuits.test.ts:195` « invitation (INVITATION) et billet à 0 F vendu en ligne (ONLINE) : idem » ; `tests/parcours/rappels-gratuits.test.ts:205` « billet gratuit et billet payant du même événement : SMS du J-1 envoyé, free_only = false » ; `tests/parcours/rappels-gratuits.test.ts:223` « SAME_AS_PAID : porteur d’un billet gratuit seulement, SMS du J-1 envoyé » ; `tests/parcours/rappels-gratuits.test.ts:240` « FREE_TICKETS_CONFIRMED garde son SMS sous NEVER (couverture : déjà vrai) » ; `tests/parcours/rappels-gratuits.test.ts:264` « gratuit sur A, payant sur B (même porteur, même jour) : rappel de A sans SMS, rappel de B avec SMS ». Essai : aucun.

### Étape 9.6 — Heures calmes

1. **Qui, où, quel bouton.** La file des messages.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** De 22 h à 8 h, heure de Dakar, seuls les SMS optionnels sont touchés. Effet définitif : le SMS n'est jamais envoyé, il n'est pas reporté à 8 h. Cloche, push et email partent. Preuve : `M/20261103000003_lot6_reglages.sql:34-37`, `M/20261103000002_lot6_outbox.sql:347-351`, `M/20261105000002_lot7_sms.sql:293`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun SMS optionnel.

5. **Ce que les autres voient.** Supervision : « Plage sans SMS (nuit) ». Preuve : `lib/notifications/outbox-labels.ts:14-22`.
6. **Ce qui est impossible.** Reporter à 8 h.
7. **Test et essai.** Test : `tests/parcours/notif-rappels.test.ts:375` « plage de silence (J-1 réglé à 7 h) : application et push envoyés, SMS SKIPPED QUIET_HOURS sans report ; textes in-app et push ». Essai : Essai 48 de `docs/recette-billetterie.md`, qui impose un début entre 8 h et 19 h.

# Chapitre 10. Le jour J

**À partir de quand le scanner fonctionne.** Le contrôle ouvre 6 heures avant le début et ferme 6 heures après la fin. Sans date de fin saisie, la fin vaut 23:59 le jour du début. Pour le Gala de la Teranga, samedi 14 novembre à 20:00 sans fin saisie : ouvert de 14:00 à dimanche 05:59. Le serveur accepte les événements « Publié » et « Terminé ». L'écran, lui, n'accepte que « Validé » ou « Publié » : il se ferme plus tôt que le serveur (étape 10.1). Preuve : `M/20261101000009_lot4_reglages_acces.sql:14-15`, `M/20261102000003_lot5_cycle.sql:857-868`, `:886`, `lib/events/event-status.ts:14`.

### Étape 10.1 — Ouvrir le scanner

1. **Qui, où, quel bouton.** Ibrahima, `/controller/scanner`. Pendant le chargement : « Chargement de vos événements… ». Preuve : `middleware.ts:210-211`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Lit ses affectations. Rien n'est écrit. Si l'événement est passé à « Terminé » (vers 00:03 pour un événement sans date de fin), au prochain retour dans l'application ou rechargement la caméra est remplacée par « Événement terminé », « Les scans ne sont plus autorisés sur cet événement. », alors que le serveur accepterait encore les scans jusqu'à 05:59. Preuve : `app/controller/scanner/page.tsx:337`, `:500`, `:717`, `:853-865`, `M/20261102000003_lot5_cycle.sql:838-849`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Le rappel de la veille est à l'étape 9.1.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Sans affectation : « Aucun événement assigné ». Erreur : « Vos événements n’ont pas pu être chargés », « Réseau indisponible : vos événements n’ont pas pu être chargés. ». Compte non actif : « Votre compte n'est pas actif. Contactez le support. ». Preuve : `lib/auth/session.ts:60`.
7. **Test et essai.** Test : `tests/parcours/scan-controleur-stats.test.ts:318` « entry_point et counter_sale_enabled de l’affectation ; entrée de la veille à 23 h 50 comptée dans les arrivées » ; `e2e/recette.spec.ts:616` « acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture ». Essai : Essai 30 de `docs/recette-billetterie.md`, `docs/essai-local.md` sections 8.8 et 9.

### Étape 10.2 — Choisir l'événement

1. **Qui, où, quel bouton.** Ibrahima, écran « Commencer le contrôle », « {nom}, choisissez l’événement, vérifiez votre porte, puis lancez la caméra. », exemple « Ibrahima, choisissez l’événement, vérifiez votre porte, puis lancez la caméra. », liste « Événement à contrôler », bouton « Commencer le contrôle ». Preuve : `components/scan/ScannerStartScreen.tsx:45-47`, `:98`.
2. **Ce qu'il saisit.** Un événement. Événement fermé : « {statut} : contrôle fermé », exemple « Terminé : contrôle fermé ». Sans porte : « Aucune porte ne vous est attribuée : le compteur affichera vos propres entrées. Le téléphone vibre à chaque résultat ; aucun son n’est émis. ». Preuve : `components/scan/ScannerStartScreen.tsx:78`.
3. **Ce que fait le système.** Le choix est gardé sur l'appareil 24 heures au plus. Aucune contrainte d'heure n'empêche de démarrer, et l'heure d'ouverture n'est affichée nulle part. Preuve : `lib/scan/scan-session.ts:62`, `:143`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Événement non éligible à l'écran : pas de caméra, bandeau : « Événement non publié », « Le contrôle ouvrira quand l’événement sera publié. » ; « Événement suspendu », « Les contrôles d’accès sont suspendus sur cet événement. » ; « Événement terminé », « Les scans ne sont plus autorisés sur cet événement. » ; « Événement annulé », « Événement annulé : aucune entrée n’est possible, les billets sont remboursés. ». Preuve : `app/controller/scanner/page.tsx:856-864`.
7. **Test et essai.** Test : `tests/parcours/scanner-reprise.test.ts:360` « scanner : session relue, reprise seulement si l’affectation existe et que l’événement est ouvert, sinon message » ; `e2e/recette.spec.ts:616` « acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture ». Essai : Essai 30 de `docs/recette-billetterie.md`.

### Étape 10.3 — Mode et écran de contrôle

1. **Qui, où, quel bouton.** Ibrahima. En-tête : titre, « Porte {x} : {n} entrées » ou « Vos entrées : {n} entrées », exemple « Vos entrées : 12 entrées », « En ligne » ou « Hors ligne », bouton « Changer d’événement », « Se déconnecter ». Boutons « Caméra » et « Saisie manuelle ». Onglets « Contrôle », « Guichet », « Caisse » si l'affectation le permet. Preuve : `components/scan/ScanStatusBar.tsx:33-44`, `app/controller/scanner/page.tsx:827-831`, `:921`, `:931`.
2. **Ce qu'il saisit.** L'autorisation de la caméra. Erreurs : « Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur, ou passez en saisie manuelle. » ; « Aucune caméra compatible n’a été détectée sur cet appareil. » ; « La caméra est utilisée par une autre application. » ; « La caméra n’a pas pu démarrer. Réessayez ou passez en saisie manuelle. ». Veille : « Caméra en veille », « Aucun billet lu depuis 3 minutes : la caméra est coupée pour la batterie. ». Preuve : `components/scan/CameraQrScanner.tsx:73`, `:112-116`.
3. **Ce que fait le système.** « Derniers scans » : « Vous : {n} entrées, {m} refus », exemple « Vous : 12 entrées, 2 refus », 20 derniers. « Réglages de cet appareil » : « Retour au scan après une entrée validée » 1 s, 1,5 s, 2 s, 3 s. Preuve : `components/scan/ScanHistoryList.tsx:55`, `:68`, `app/controller/scanner/page.tsx:949-958`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Changer le thème : sombre forcé. Preuve : `app/controller/layout.tsx:49`.
7. **Test et essai.** Test : `tests/parcours/scanner-interface.test.ts:531` « app/controller/layout.tsx : classe dark et colorScheme: 'dark' » ; `tests/parcours/scanner-interface.test.ts:568` « detectScannerSupport : contexte sûr, getUserMedia et BarcodeDetector → native » ; `tests/parcours/scanner-interface.test.ts:592` « constantes caméra : cadence de lecture entre 120 et 150 ms, veille après 3 min sans lecture (D48) ». Essai : Essai 30 de `docs/recette-billetterie.md`.

### Étape 10.4 — Le scan : entrée validée

1. **Qui, où, quel bouton.** Ibrahima, onglet « Contrôle », caméra. « Envoi… », puis résultat en plein écran. Bas d'écran : « Retour automatique au scan · touchez pour passer ». Preuve : `components/scan/CombatFlashOverlay.tsx:206`.
2. **Ce qu'il saisit.** Le QR présenté, renouvelé toutes les 20 secondes. Le même QR qu'une entrée validée depuis moins de 20 secondes est ignoré : « Même billet que l’entrée validée à {HH:MM} : présentez le billet suivant. », exemple « Même billet que l’entrée validée à 20:42 : présentez le billet suivant. ». Preuve : `app/controller/scanner/page.tsx:663`, `lib/security/totp.ts:14-15`.
3. **Ce que fait le système.** Fond vert, texte noir, icône coche, titre « Entrée validée », une vibration courte. Le nom s'affiche en très grand, ou « Porteur non renseigné », puis « {catégorie} · {numéro} », exemple « VIP · TCK-20261104-3F9A1C7E2B ». Retour au scan après 1,5 seconde par défaut. Le billet passe « Utilisé », une ligne d'entrée acceptée est enregistrée. La vibration réelle sur un téléphone est NON VÉRIFIÉ : les motifs sont lus dans le code, et le code ne fait rien vibrer sur iPhone. Preuve : `M/20261108000005_lot9_nettoyage.sql:21-216`, `lib/hardware/feedback.ts:15-22`, `:45`, `app/globals.css:70-79`, `components/scan/CombatFlashOverlay.tsx:70-77`, `:128`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou | cloche | indispensable | prochain passage de la file | titre « Entrée validée » ; modèle « Votre billet pour « {title} » a été contrôlé à l'entrée. » ; exemple « Votre billet pour « Gala de la Teranga » a été contrôlé à l'entrée. » |
| Fatou | push | indispensable | prochain passage de la file | titre « Entrée validée » ; modèle « Votre billet pour « {title} » a été contrôlé à l'entrée. » ; exemple « Votre billet pour « Gala de la Teranga » a été contrôlé à l'entrée. » |

Pas de SMS, et rien pour une vente au guichet. Preuve : `TICKET_SCANNED` (`M/20261103000005_lot6_billetterie.sql:883-887`).

5. **Ce que les autres voient.** Fatou : billet à l'historique, cloche. Mariama : onglet Entrées du pilotage en direct. Les autres contrôleurs de la porte : compteur relu sous 5 secondes. Preuve : `app/partner/events/[id]/page.tsx:83`, `app/controller/scanner/page.tsx:148`, `:452-455`.
6. **Ce qui est impossible.** Valider une entrée sans le serveur. Un billet n'entre qu'une fois.
7. **Test et essai.** Test : `tests/parcours/acces-scan.test.ts:96` « partenaire B ou contrôleur de B visant l’événement de A → 403 SCAN_FORBIDDEN, sans donnée du billet » ; `tests/parcours/acces-scan.test.ts:108` « partenaire B présentant un billet de A sur son propre événement → wrong_event, sans donnée du billet » ; `tests/parcours/acces-scan.test.ts:117` « contrôleur affecté dont le compte est SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, sans donnée du billet, aucune ligne de scan (cas T3.2 porté) » ; `tests/parcours/scan-idempotence.test.ts:122` « même clé deux fois (réponse perdue) : second `valid`, `replayed: true`, même scan_id, une seule ligne, aucune ligne already_used » ; `tests/parcours/scan-idempotence.test.ts:177` « clés différentes, même code : valid puis already_used avec ticket.checked_in_by_me = true et checked_in_at » ; `tests/parcours/scanner-interface.test.ts:271` « vibrationPattern : accepte [60] ; deja_utilise, refuse, evenement_annule [120,60,120,60,120] ; hors_fenetre [250,100,250] ; technique null » ; `e2e/terrain.spec.ts:468` « 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture ». Essai : Essai 30 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.8.

### Étape 10.5 — Le scan : refus liés au billet

1. **Qui, où, quel bouton.** Ibrahima, comme à l'étape 10.4.
2. **Ce qu'il saisit.** Le QR présenté.
3. **Ce que fait le système.** Une ligne d'entrée refusée est enregistrée. Le billet ne change pas. Retour au scan après 3 secondes. Vibration « trois marquées » pour tous ces cas.

| Cas | Titre exact à l'écran | Couleur, icône | Lignes affichées |
|---|---|---|---|
| Billet déjà utilisé | « Billet déjà utilisé » | brun, flèche de retour | détenteur ; « Entré à {HH:MM} », exemple « Entré à 20:42 », ou « Déjà validé par vous à {HH:MM} » si par ce contrôleur depuis moins de 30 secondes ; « Billet : … » |
| Billet d'un autre événement | « Billet d’un autre événement » | rouge, octogone | aucune donnée du billet |
| QR expiré | « QR expiré : demandez au client de rafraîchir son billet » | rouge, octogone | détenteur, billet |
| Billet annulé | « Billet annulé » | rouge, octogone | détenteur, billet |
| Billet remboursé ou en cours | « Billet remboursé » | rouge, octogone | détenteur, billet |
| Billet inconnu | « Billet invalide » | rouge, octogone | aucune |
| Paiement absent | « Paiement requis » | rouge, octogone | détenteur, billet |
| QR qui n'est pas dynamique | « QR dynamique requis (billet ouvert dans l’application) » | rouge, octogone | aucune |

Ordre des contrôles : un QR périmé d'un billet déjà utilisé donne « QR expiré », pas « Billet déjà utilisé ». Preuve : `M/20261108000005_lot9_nettoyage.sql:144-203`, `lib/scan/scan-result.ts:9-27`, `lib/hardware/feedback.ts:15-22`, `app/controller/scanner/page.tsx:1001-1002`.

4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message pour un refus.

5. **Ce que les autres voient.** Mariama : compteur « Refus », « Tentatives multiples » dans l'onglet Entrées. Preuve : `components/partner/pilotage/EntriesTab.tsx:76-94`.
6. **Ce qui est impossible.** Forcer l'entrée. Le PDF ne porte aucun QR. Preuve : `app/api/tickets/[id]/pdf/route.ts:16`.
7. **Test et essai.** Test : `tests/parcours/acces-scan.test.ts:134` « double scan simultané depuis deux portes → un seul valid, l’autre already_used, une seule ligne acceptée » ; `tests/parcours/acces-scan.test.ts:154` « billet payant sans paiement ni commande, scanné par le partenaire propriétaire → payment_required, non composté » ; `tests/parcours/nettoyage-sur-place.test.ts:99` « scan caméra : payment_required, billet VALIDE sans paiement, aucune ligne cash_required, caisse ouverte non créditée » ; `tests/parcours/acces-tracabilite.test.ts:90` « une ligne par tentative (acceptée ou refusée), complète, sans payload en clair ; scan_id = ligne du journal ». Essai : Essais 28 et 31 de `docs/recette-billetterie.md`.

### Étape 10.6 — Le scan : refus liés à l'événement ou à l'heure

1. **Qui, où, quel bouton.** Ibrahima, comme à l'étape 10.4.
2. **Ce qu'il saisit.** Le QR présenté.
3. **Ce que fait le système.** Une ligne refusée est enregistrée. Retour après 3 secondes.

| Cas | Titre exact à l'écran | Couleur, icône | Vibration |
|---|---|---|---|
| Trop tôt, ou non publié | « Contrôle pas encore ouvert » | ambre, horloge | deux longues |
| Trop tard | « Événement terminé » | ambre, horloge | deux longues |
| Événement annulé | « Événement annulé » | rouge, calendrier barré | trois marquées |
| Événement suspendu | « Événement suspendu » | rouge, interdit | trois marquées |
| Saisie manuelle non autorisée | « Saisie manuelle refusée » | rouge, octogone | trois marquées |

Un QR périmé pendant une suspension donne « QR expiré ». Preuve : `M/20261102000003_lot5_cycle.sql:871-892`, `M/20261108000005_lot9_nettoyage.sql:158-186`, `lib/scan/scan-result.ts:52-54`, `lib/hardware/feedback.ts:15-22`.

4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Comme à l'étape 10.5.
6. **Ce qui est impossible.** Savoir à quelle heure ouvre le contrôle : aucune heure n'est affichée. Preuve : `lib/scan/scan-result.ts:54`.
7. **Test et essai.** Test : `tests/parcours/acces-fenetre.test.ts:95` « 8 h avant le début → event_not_open » ; `tests/parcours/acces-fenetre.test.ts:99` « 5 h avant le début, en cours, 5 h après la fin → valid » ; `tests/parcours/acces-fenetre.test.ts:105` « fin + 6 h dépassée → event_ended » ; `tests/parcours/acces-fenetre.test.ts:111` « non PUBLIE (VALIDE non publié, BROUILLON) → event_not_open » ; `tests/parcours/acces-fenetre.test.ts:116` « ANNULE → event_cancelled ; SUSPENDU → event_suspended ; TERMINE → event_ended » ; `tests/parcours/acces-fenetre.test.ts:126` « access.scan_window_before_hours : un événement dans 8 h s’ouvre avec 10 h, pas avec 6 h » ; `tests/parcours/acces-fenetre.test.ts:132` « access.scan_window_after_hours : un événement fini il y a 3 h se ferme avec 2 h, reste ouvert avec 6 h ». Essai : aucun essai numéroté dédié.

### Étape 10.7 — Le scan d'un billet en cours de transfert

1. **Qui, où, quel bouton.** Ibrahima présente le scanner à un billet dont le transfert à Lamine est en attente.
2. **Ce qu'il saisit.** Le QR (Fatou n'en a plus à l'écran, mais peut en avoir un en lot hors ligne sur un autre appareil), ou le numéro du billet en saisie manuelle.
3. **Ce que fait le système.** **Il n'y a pas de résultat « transfert en cours ».** Le scan ne regarde pas le verrou : le billet est validé au nom de l'expéditeur, écran de l'étape 10.4. Le sort d'un lot de codes hors ligne déjà téléchargé avant un transfert est NON VÉRIFIÉ sur un vrai téléphone : le serveur refuse seulement un nouveau lot. Preuve : `M/20261108000005_lot9_nettoyage.sql:174-186`, `:275-296`, `app/api/tickets/[id]/live-code/route.ts:42`, `TicketCard.tsx:209`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

L'avis d'entrée de l'étape 10.4 part à Fatou. Lamine n'est pas prévenu.

5. **Ce que les autres voient.** Lamine, s'il accepte ensuite : « Ce billet n'est plus transférable. ». Preuve : `lib/tickets/ticket-transfer.service.ts:135-146`.
6. **Ce qui est impossible.** Bloquer l'entrée d'un billet en transfert.
7. **Test et essai.** Test : aucun. Essai : aucun.

### Étape 10.8 — Incidents techniques

1. **Qui, où, quel bouton.** Ibrahima, pendant une lecture.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Fond gris, aucune vibration, jamais compté comme refus. Phrase ajoutée : « Le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif : faites patienter et réessayez. ». Le billet n'a pas changé.

| Cas | Titre exact | Message |
|---|---|---|
| Hors ligne | « Hors ligne : rien n’est validé » | « Hors ligne : rien n’est validé. Faites patienter le spectateur et reprenez au retour du réseau. » |
| Délai dépassé (3 essais) | « Réseau trop lent : rien n’est validé » | « Réseau trop lent : rien n’est validé. Faites patienter et réessayez. » |
| Coupure réseau | « Réseau indisponible : rien n’est validé » | « Erreur réseau : réessayez » |
| Erreur serveur | « Erreur serveur : réessayez » | « Erreur serveur pendant le contrôle. » |
| Cadence (30 scans en 10 s) | « Trop de scans : patientez quelques secondes » | Aucun. |
| Scan repris sans trace | « Scan non traité : scannez le billet de nouveau » | « Aucune entrée enregistrée. » |
| Non autorisé | « Contrôle non autorisé » | « Vous n’êtes pas autorisé à contrôler cet événement. » |
| Requête refusée | « Requête refusée par le serveur » | message du serveur |

Preuve : `components/scan/CombatFlashOverlay.tsx:198`, `components/scan/scan-client.ts:293`, `lib/hardware/feedback.ts:21`.

4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Mariama : incidents dans l'onglet Entrées, au retour du réseau.
6. **Ce qui est impossible.** Forcer une entrée.
7. **Test et essai.** Test : `tests/parcours/scanner-interface.test.ts:503` « textes des trois états réseau présents dans le scanner » ; `e2e/terrain.spec.ts:369` « 4. mesure du scan : billets neufs en réseau normal puis en 3G, relectures « déjà utilisé », puis une lecture hors ligne ». Essai : Essai 35 de `docs/recette-billetterie.md`.

### Étape 10.9 — Saisie manuelle

1. **Qui, où, quel bouton.** Ibrahima, bouton « Saisie manuelle ». Champ « Numéro du billet », aide « Spectateur sans téléphone : saisissez le numéro imprimé sur son billet, puis vérifiez le titulaire avant de valider. », exemple « TCK-20261101-XXXXXXXXXX ». Bouton « Vérifier le billet ». Preuve : `components/scan/ManualEntryForm.tsx:82-86`, `:94`.
2. **Ce qu'il saisit.** Le numéro, 4 caractères au moins. Puis la case « Pièce d’identité conforme au titulaire », « Le nom sur la pièce correspond au titulaire ci-dessus. Obligatoire. », bouton « Pièce conforme, valider l’entrée ». Réponses : « Aucun billet de cet événement ne porte ce numéro », « Vérifiez la saisie avec le spectateur. Aucune entrée n’a été validée. » ; « Vérification impossible », « Vous n’êtes pas autorisé à vérifier un billet de cet événement. », « Trop de vérifications : patientez quelques secondes. », « Réseau trop lent : réessayez la vérification. », « Réseau indisponible : réessayez la vérification. », « Hors ligne : la vérification reprendra au retour du réseau. ». Preuve : `components/scan/ManualEntryForm.tsx:143-151`.
3. **Ce que fait le système.** Premier temps : la lecture n'enregistre aucune entrée, et l'écran affiche « Titulaire », « Catégorie », « Billet », « Résultat prévu ». Second temps : l'entrée est validée, sans contrôle du QR. Preuve : `M/20261108000005_lot9_nettoyage.sql:222-308`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, si l'entrée est validée | cloche | indispensable | prochain passage de la file | titre « Entrée validée » ; modèle « Votre billet pour « {title} » a été contrôlé à l'entrée. » ; exemple « Votre billet pour « Gala de la Teranga » a été contrôlé à l'entrée. » |
| Fatou, si l'entrée est validée | push | indispensable | prochain passage de la file | titre « Entrée validée » ; modèle « Votre billet pour « {title} » a été contrôlé à l'entrée. » ; exemple « Votre billet pour « Gala de la Teranga » a été contrôlé à l'entrée. » |

Preuve : `TICKET_SCANNED` (`M/20261103000005_lot6_billetterie.sql:883-887`).

5. **Ce que les autres voient.** Comme à l'étape 10.4. Pilotage : méthode « Saisie manuelle ».
6. **Ce qui est impossible.** Résultat prévu autre qu'une entrée valable : « Entrée impossible : {libellé} », exemple « Entrée impossible : Billet déjà utilisé », « Ne laissez pas entrer le spectateur avec ce billet. ». Partenaire propriétaire et admin : refusés par défaut. Preuve : `components/scan/ManualEntryForm.tsx:155-156`, `M/20261101000009_lot4_reglages_acces.sql:13`.
7. **Test et essai.** Test : `tests/parcours/scan-controleur-stats.test.ts:351` « numéro de l’événement → found, titulaire, catégorie, statut lisible, preview valid ; aucune ligne ticket_scans, billet VALIDE, une ligne audit_logs MANUAL_LOOKUP sans numéro en clair » ; `tests/parcours/scan-controleur-stats.test.ts:397` « quota SCAN_LOOKUP_PER_SCANNER_MIN : au-delà → 429 avec Retry-After, sans journal ni lecture » ; `tests/parcours/scan-controleur-stats.test.ts:414` « périmètre access.manual_entry_scope : ASSIGNED_CONTROLLER refuse le partenaire propriétaire et un contrôleur non affecté (403 SCAN_FORBIDDEN, rien révélé) ; STAFF admet le propriétaire » ; `tests/parcours/nettoyage-sur-place.test.ts:119` « saisie manuelle : preview payment_required, aucune ligne de scan, billet VALIDE » ; `tests/parcours/scanner-reprise.test.ts:181` « saisie manuelle : numéro et pièce vérifiée gardés ; requête incomplète refusée ». Essai : Essai 33 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.8.

### Étape 10.10 — Réseau faible

1. **Qui, où, quel bouton.** Ibrahima, pendant une lecture.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Trois essais de 4, 6 et 8 secondes, même clé, soit 18,75 secondes au plus. Le serveur rend le verdict d'origine, sans double entrée. Après 1,5 seconde : « Réseau lent », « Ne refaites pas scanner : nouvel essai automatique (essai 2 sur 3). ». Preuve : `components/scan/scan-client.ts:33`, `:196`, `app/controller/scanner/page.tsx:137`, `:841-844`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Pilotage, onglet Entrées : colonne « Incidents ». Preuve : `components/partner/pilotage/EntriesTab.tsx:29`, `:41-43`.
6. **Ce qui est impossible.** Forcer une entrée.
7. **Test et essai.** Test : `tests/parcours/scanner-interface.test.ts:368` « coupure réseau puis succès : relance automatique avec la même clé, verdict valid » ; `tests/parcours/scanner-interface.test.ts:375` « 503 puis succès : relance avec la même clé ; 503 avec Retry-After: 1 → relance au plus tôt 1 s après » ; `tests/parcours/scanner-interface.test.ts:387` « 4xx jamais relancés : 400, 403, 409 et 429 → un seul envoi (avec sa clé) ; 429 → rate_limited » ; `tests/parcours/scanner-interface.test.ts:398` « réseau coupé à chaque essai : trois essais (délais de 4, 6 et 8 s), même clé, puis incident technique network_error » ; `tests/parcours/scan-idempotence.test.ts:122` « même clé deux fois (réponse perdue) : second `valid`, `replayed: true`, même scan_id, une seule ligne, aucune ligne already_used » ; `e2e/terrain.spec.ts:219` « 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée ». Essai : aucun pour le réseau lent.

### Étape 10.11 — Hors ligne

1. **Qui, où, quel bouton.** Ibrahima, réseau coupé.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Aucun envoi. Bandeau permanent : « Hors ligne : aucune entrée ne peut être validée », « Faites patienter, passez sur le routeur de secours, puis reprenez. ». Le scanner n'a aucun mode autonome. Côté client, un QR hors ligne déjà téléchargé reste présentable, mais le contrôleur doit être en ligne. Preuve : `components/scan/scan-client.ts:183`, `app/controller/scanner/page.tsx:1018-1019`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Valider une entrée hors ligne. En saisie manuelle : « Hors ligne : la saisie manuelle reprendra au retour du réseau. ». Preuve : `app/controller/scanner/page.tsx:893`.
7. **Test et essai.** Test : `tests/parcours/scanner-interface.test.ts:503` « textes des trois états réseau présents dans le scanner » ; `e2e/terrain.spec.ts:369` « 4. mesure du scan : billets neufs en réseau normal puis en 3G, relectures « déjà utilisé », puis une lecture hors ligne » ; `e2e/terrain.spec.ts:119` « 1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur ». Essai : Essais 32 et 35 de `docs/recette-billetterie.md`.

### Étape 10.12 — Reprise après sortie de l'application

1. **Qui, où, quel bouton.** Ibrahima revient : appel, verrouillage, rechargement, réouverture.
2. **Ce qu'il saisit.** Un toucher : écran « Contrôle retrouvé », « Même événement, même mode : rallumez la caméra. », ou « Caméra coupée », « Application en arrière-plan : la caméra est coupée, votre contrôle reste ouvert. », bouton « Reprendre le contrôle ». Preuve : `components/scan/CameraQrScanner.tsx:74-75`.
3. **Ce que fait le système.** Événement, mode et onglet sont repris pour 24 heures au plus, si l'affectation existe et si l'événement est « Validé » ou « Publié ». Un scan sans réponse est renvoyé pendant 2 minutes au plus, sans double entrée : « Résultat retrouvé : billet lu à {HH:MM}. », exemple « Résultat retrouvé : billet lu à 20:42. ». Délai dépassé : « Billet lu à {HH:MM} sans réponse : vérifiez « Derniers scans » ou scannez-le de nouveau. ». Hors ligne : « Billet lu à {HH:MM} sans réponse : renvoi au retour du réseau, sans double entrée. ». Preuve : `app/controller/scanner/page.tsx:616`, `:624`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Reprise refusée, bandeau « Contrôle précédent non repris » : « L’événement que vous contrôliez ne vous est plus affecté : choisissez un événement. » ; « Le contrôle de « {titre} » est fermé ({statut}) : choisissez un événement. », exemple « Le contrôle de « Gala de la Teranga » est fermé (Terminé) : choisissez un événement. » ; « Le contrôle de « {titre} » n’est pas ouvert : choisissez un événement. ». La déconnexion efface tout. Preuve : `app/controller/scanner/page.tsx:469`, `:477-478`.
7. **Test et essai.** Test : `tests/parcours/scanner-reprise.test.ts:116` « clé par compte, sans identifiant de compte en clair ; deux comptes ne se mélangent pas ; surfaces distinctes » ; `tests/parcours/scanner-reprise.test.ts:423` « module de mémoire : aucune donnée personnelle écrite (ni nom, ni téléphone, ni porteur) » ; `tests/parcours/scan-renvoi-seulement.test.ts:143` « 1. billet VALIDE, replayOnly: true, avec ou sans code : 200 not_processed, billet VALIDE, aucune ligne ticket_scans, aucun avis au porteur » ; `tests/parcours/scan-renvoi-seulement.test.ts:166` « 2. lecture acceptée puis renvoi : verdict d’origine, replayed: true, même scan_id, même billet, une seule ligne » ; `tests/parcours/scan-renvoi-seulement.test.ts:178` « 3. renvoi avec un code expiré, sans code ou avec un code illisible : même verdict, aucune ligne ; verdict de refus rendu tel quel » ; `e2e/terrain.spec.ts:604` « 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé » ; `e2e/terrain.spec.ts:853` « 11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact ». Essai : Essai 34 de `docs/recette-billetterie.md`.

### Étape 10.13 — Scan par la partenaire

1. **Qui, où, quel bouton.** Mariama, `/partner/scan` (`/scan` y renvoie), titre « Contrôle des entrées », liste « Événement contrôlé », événements publiés seulement. Boutons « Caméra », « Saisie manuelle », lien « Tableau de bord ». Preuve : `app/partner/scan/page.tsx:121`, `:132`, `:366`.
2. **Ce qu'il saisit.** Le QR. La saisie manuelle est refusée par défaut.
3. **Ce que fait le système.** Même contrôle que pour Ibrahima. Résultat dans une carte, 4 secondes, sans plein écran ni vibration. Preuve : `app/partner/scan/page.tsx:64-66`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou | cloche | indispensable | prochain passage de la file | titre « Entrée validée » ; modèle « Votre billet pour « {title} » a été contrôlé à l'entrée. » ; exemple « Votre billet pour « Gala de la Teranga » a été contrôlé à l'entrée. » |
| Fatou | push | indispensable | prochain passage de la file | titre « Entrée validée » ; modèle « Votre billet pour « {title} » a été contrôlé à l'entrée. » ; exemple « Votre billet pour « Gala de la Teranga » a été contrôlé à l'entrée. » |

Preuve : `TICKET_SCANNED` (`M/20261103000005_lot6_billetterie.sql:883-887`).

5. **Ce que les autres voient.** Comme à l'étape 10.4.
6. **Ce qui est impossible.** Caisse et guichet. « Aucun événement publié à contrôler. ».
7. **Test et essai.** Test : `tests/parcours/acces-scan.test.ts:173` « partenaire propriétaire : valid par la même route, données du billet renvoyées, ligne acceptée à son nom » ; `tests/parcours/acces-scan.test.ts:230` « /partner/scan appelle /api/controller/scan et partage un composant de résultat avec le scanner contrôleur » ; `tests/parcours/scanner-reprise.test.ts:310` « scan partenaire : useScannerReturn, chiffres et historique sur /api/controller/scans, au montage et après chaque scan » ; `tests/parcours/scanner-reprise.test.ts:375` « scan partenaire : session relue, événement encore publié exigé, choix explicite sinon ». Essai : aucun.

# Chapitre 11. Le guichet et la caisse

L'onglet « Caisse » apparaît si le contrôleur a le droit d'encaisser ; l'onglet « Guichet », si en plus le guichet est activé sur la plateforme. Preuve : `app/controller/scanner/page.tsx:822`, `:829-830`.

### Étape 11.1 — Ouvrir la caisse

1. **Qui, où, quel bouton.** Ibrahima, onglet « Caisse », état « Caisse fermée », « Encaissement en espèces bloqué », « Ouvrez votre caisse avec le régisseur avant de vendre au guichet. », bouton « Ouvrir ma caisse ». Fenêtre « Ouvrir ma caisse », bouton « Ouvrir la caisse ». Preuve : `components/scan/ScannerShiftBanner.tsx:86-95`, `components/shifts/ShiftModals.tsx:107`, `:139`.
2. **Ce qu'il saisit.** « Fonds de caisse remis par le régisseur (F CFA) », aide « Montant en espèces remis pour rendre la monnaie. 0 si aucun fonds n’est remis. » ; erreur « Saisissez un montant entier en francs, sans virgule (par exemple 2 750). ». « Code PIN du régisseur (facultatif) », aide « Facultatif à l’ouverture. Saisi, il est vérifié et l’ouverture est marquée confirmée par le régisseur. ». Le PIN n'est donc pas obligatoire à l'ouverture. Preuve : `components/shifts/ShiftModals.tsx:75`, `:116-117`, `:128-129`, `lib/shifts/shift.service.ts:324`.
3. **Ce que fait le système.** La caisse est « Ouverte », avec son fonds. Une seule caisse ouverte par personne et par événement. Preuve : `M/20261102000003_lot5_cycle.sql:963-999`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Ibrahima : « Caisse ouverte depuis {HH:MM} », exemple « Caisse ouverte depuis 19:30 », « Fonds de caisse », « Encaissé », « Total attendu en caisse », bouton « Clôturer ma caisse ». Mariama, en direct : onglet Caisse, badge « Caisse ouverte ». Preuve : `components/scan/ScannerShiftBanner.tsx:47-69`, `app/partner/events/[id]/page.tsx:85`.
6. **Ce qui est impossible.** Bandeau « Ouverture refusée » : « Cet événement n’est pas encore ouvert au contrôle. » ; « Cet événement est terminé. » ; « Cet événement est suspendu. » ; « Cet événement est annulé. » ; « Ouverture de caisse réservée au contrôleur affecté avec la permission espèces, au partenaire propriétaire ou à un admin. » ; « Une session de caisse est déjà ouverte pour cet événement. Clôturez-la avant d’en ouvrir une nouvelle. » ; « Code PIN régisseur incorrect. » ; « Code PIN régisseur incomplet (4 à 8 chiffres). » ; « Aucun code PIN régisseur n’a été généré par l’organisateur pour cet événement. » ; « Trop de tentatives de code PIN. Réessayez dans {n} s. », exemple « Trop de tentatives de code PIN. Réessayez dans 120 s. » ; « Réseau indisponible : la caisse n’est pas ouverte. Réessayez. ». Preuve : `lib/shifts/shift.service.ts:211-216`.
7. **Test et essai.** Test : `tests/parcours/acces-encaissement.test.ts:69` « ouverture de caisse : partenaire propriétaire et admin ouvrent leur caisse ; contrôleur sans permission espèces refusé » ; `tests/parcours/acces-encaissement.test.ts:85` « ouvertures simultanées pour le même contrôleur et le même événement : une seule caisse OUVERT » ; `tests/parcours/acces-encaissement.test.ts:155` « RPC shift_open : SECURITY DEFINER, search_path = public, réservée au service_role » ; `e2e/recette.spec.ts:632` « ouverture du contrôle à sa porte et de la caisse ». Essai : Essai 36 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.9.

### Étape 11.2 — Vente au guichet

1. **Qui, où, quel bouton.** Ibrahima, onglet « Guichet ». Sans caisse : « Caisse fermée », « Ouvrez votre caisse avec le régisseur avant de vendre un billet au guichet. », bouton « Ouvrir ma caisse ». Boutons « Ajouter un billet {catégorie} », « Retirer un billet {catégorie} ». Bouton final « J’ai reçu {montant} : valider la vente », exemple « J’ai reçu 10 000 F CFA : valider la vente », sinon « Choisissez au moins un billet ». Preuve : `components/scan/CounterSalePanel.tsx:193-195`, `:265`.
2. **Ce qu'il saisit.** Les quantités, 50 au plus par catégorie. Les catégories vendues au guichet seulement, avec la mention « Sur place uniquement » si elles ne sont pas vendues en ligne. « Numéro de l’acheteur (facultatif) », aide « Pour lui envoyer un reçu par SMS. Le billet n’est rattaché à aucun compte. ». Erreurs : « Aucune catégorie de billet n’est en vente pour cet événement. » ; « Vente au guichet fermée » ; « Votre affectation n’autorise pas l’encaissement d’espèces. » ; « La vente au guichet est désactivée pour la plateforme. » ; « Total indisponible » ; « Vente non enregistrée » ; « Réseau indisponible : la vente n’est pas confirmée. Réessayez, elle ne sera pas comptée deux fois. ». Preuve : `components/scan/CounterSalePanel.tsx:169`, `:212`, `:234-235`.
3. **Ce que fait le système.** En une seule fois : paiement en espèces, hors plateforme, au prix affiché, sans frais ; billets sans compte, déjà « Utilisé » ; stock pris ; total attendu de la caisse augmenté. Seule compte la fenêtre de contrôle, pas la fenêtre de vente en ligne. Écran : « Vente enregistrée : {n} entrées, {montant} encaissés. Reçu SMS envoyé à l’acheteur. », exemple « Vente enregistrée : 2 entrées, 10 000 F CFA encaissés. Reçu SMS envoyé à l’acheteur. », ou « Le reçu SMS n’a pas pu être envoyé. ». Preuve : `M/20261106000001_lot8_canaux.sql:314-478`, `:436-443`, `components/scan/CounterSalePanel.tsx:159-161`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le numéro saisi, sans compte | SMS | indispensable | prochain passage de la file | modèle « Event Village : achat au guichet pour {title}, {ticket_count} billets, {amount}. Entrée validée. Réf. {reference}. » ; exemple « Event Village : achat au guichet pour Gala de la Teranga, 2 billets, 10 000 F CFA. Entrée validée. Réf. 1F6E2B9C. » (113 caractères, 1 segment) |

Sans numéro : aucun message. L'avis d'entrée n'est pas émis pour le guichet. Preuve : `COUNTER_RECEIPT` (`M/20261106000001_lot8_canaux.sql:462`, `app/api/controller/counter-sale/route.ts:150`).

5. **Ce que les autres voient.** Mariama, en direct : Ventes, Entrées, Caisse. Rescanner un billet de guichet donne « Billet déjà utilisé ».
6. **Ce qui est impossible.** Vendre sans caisse. Vendre une catégorie sans canal guichet. Vente par la partenaire ou l'admin. Refus cités : « La vente au guichet est désactivée. » ; « Vente réservée au contrôleur affecté à l'événement. » ; « Permission espèces requise. » ; « Ouvrez une caisse avant de vendre. » ; « Cet événement n'est pas ouvert à la vente au guichet. » ; « Une catégorie de ce panier n'est pas vendue au guichet. » ; « Vente impossible : vérifiez les catégories et les quantités. » ; « Numéro de l’acheteur invalide : mobile sénégalais attendu. ».
7. **Test et essai.** Test : `tests/parcours/acces-guichet.test.ts:153` « vente sans caisse ouverte : refusée, aucun billet ni paiement » ; `tests/parcours/acces-guichet.test.ts:162` « contrôleur sans permission espèces, ou non affecté à l’événement : refusé » ; `tests/parcours/acces-guichet.test.ts:189` « réglage access.counter_sale_enabled = false : refusé » ; `tests/parcours/acces-guichet.test.ts:240` « lot 5 (C7) : aucun porteur, que le buyerPhone soit celui d’un compte ou inconnu (ni l’acheteur, ni le vendeur) » ; `tests/parcours/dette-guichet.test.ts:190` « Idempotency-Key absente → 400, rien vendu » ; `tests/parcours/dette-guichet.test.ts:258` « même Idempotency-Key rejouée : même vente, aucun billet ni paiement en double, caisse créditée une fois » ; `tests/parcours/canaux-vente.test.ts:343` « 4. counter_sale direct et route : CATEGORY_NOT_SOLD_AT_COUNTER, 409, rien vendu, caisse inchangée » ; `tests/parcours/canaux-vente.test.ts:491` « 10. GET du guichet : catégorie à sale_counter faux absente, on_site_only vrai si non vendue en ligne » ; `e2e/recette.spec.ts:684` « guichet : Sur place avec sa mention, Invitations et Découverte absentes, vente, reçu ». Essai : Essai 36 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.9.

### Étape 11.3 — Clôture sans écart

1. **Qui, où, quel bouton.** Ibrahima, « Clôturer ma caisse », fenêtre « Clôturer ma caisse », « Décompte des espèces avec le régisseur », bouton « Clôturer la caisse ». Rappel « Fonds de caisse », « Espèces encaissées (enregistrées) », « Total attendu en caisse ». Preuve : `components/shifts/ShiftModals.tsx:226-234`.
2. **Ce qu'il saisit.** « Espèces encaissées comptées, hors fonds de caisse (F CFA) », obligatoire, aide « Comptez les espèces avec le régisseur, mettez de côté le fonds de caisse, puis saisissez le reste. ». Erreur : « Saisissez le montant compté, en francs entiers, sans virgule. ». Réseau : « Réseau indisponible : la caisse n’est pas clôturée. Réessayez. ». Preuve : `components/shifts/ShiftModals.tsx:184`, `:259-260`.
3. **Ce que fait le système.** La caisse passe « Clôturée », écart 0, sans PIN. Réponse « Session de caisse clôturée sans écart. », puis le rapport (étape 11.5). Preuve : `M/20261103000006_lot6_pros_admin.sql:165-308`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Mariama : onglets Caisse et Clôture en direct.
6. **Ce qui est impossible.** Clôturer deux fois : « Cette session de caisse est déjà clôturée. ». Rouvrir ; une nouvelle caisse peut être ouverte.
7. **Test et essai.** Test : `tests/parcours/dette-cloture-caisse.test.ts:189` « clôture sans écart : sans PIN, CLOTURE, écart 0, déclaré = attendu, closed_by = contrôleur » ; `tests/parcours/dette-cloture-caisse.test.ts:276` « double clôture simultanée sans écart : une 200, une 409 SHIFT_NOT_OPEN ; une seule clôture journalisée » ; `tests/parcours/dette-cloture-caisse.test.ts:354` « deux appels simultanés sans écart : un ok, l’autre SHIFT_NOT_OPEN » ; `tests/parcours/dette-cloture-caisse.test.ts:369` « montant déclaré non entier ou négatif : refusé, caisse OUVERT » ; `e2e/recette.spec.ts:709` « clôture de caisse sans écart, Z de caisse ». Essai : Essai 37 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.9.

### Étape 11.4 — Clôture avec écart et justification

1. **Qui, où, quel bouton.** Ibrahima, même fenêtre. Après le premier envoi, bandeau « Écart constaté », « Écart de {montant} avec les encaissements enregistrés. Justifiez l’écart ; le régisseur co-signe la clôture avec son code PIN. », exemple « Écart de -2 500 F CFA avec les encaissements enregistrés. Justifiez l’écart ; le régisseur co-signe la clôture avec son code PIN. », bouton « Clôturer avec l’écart ». Preuve : `components/shifts/ShiftModals.tsx:234`, `:272-276`.
2. **Ce qu'il saisit.** « Justification de l’écart », 10 à 1 000 caractères, aide « 10 caractères au moins (par exemple : monnaie rendue en trop à un spectateur). ». « Code PIN du régisseur », aide « Le régisseur saisit lui-même son code. ». Bandeau « Clôture refusée » : « Un écart de caisse doit être justifié (10 caractères au moins). » ; « La justification est limitée à 1 000 caractères. » ; « Le code PIN régisseur est obligatoire pour co-signer une clôture avec écart. » ; « Code PIN régisseur incomplet (4 à 8 chiffres). » ; « Code PIN régisseur incorrect. » ; « Aucun code PIN régisseur n’a été généré par l’organisateur pour cet événement. » ; « Trop de tentatives de code PIN. Réessayez dans {n} s. », exemple « Trop de tentatives de code PIN. Réessayez dans 120 s. ».
3. **Ce que fait le système.** Écart égal au déclaré moins l'attendu. Caisse « Clôturée », justification enregistrée, clôture marquée co-signée. Réponse « Session de caisse clôturée avec un écart. L’organisateur a été alerté. ». L'écart n'a aucun effet financier automatique. Preuve : `M/20261103000006_lot6_pros_admin.sql:220`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : caisse de {controller_name} fermée ({title}) avec un écart de -{difference}. {APP_URL}/partner/events » ; exemple « Event Village : caisse de Ibrahima Sow fermée (Gala de la Teranga) avec un écart de -2 500 F CFA. https://eventvillage.sn/partner/events » (136 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Écart de caisse » ; modèle « La caisse de {controller_name} pour « {title} » est fermée avec un écart de -{difference}. Justification : {justification} » ; exemple « La caisse de Ibrahima Sow pour « Gala de la Teranga » est fermée avec un écart de -2 500 F CFA. Justification : Erreur de monnaie rendue. » |
| Mariama | push | indispensable | prochain passage de la file | titre « Écart de caisse » ; modèle « La caisse de {controller_name} pour « {title} » est fermée avec un écart de -{difference}. Justification : {justification} » ; exemple « La caisse de Ibrahima Sow pour « Gala de la Teranga » est fermée avec un écart de -2 500 F CFA. Justification : Erreur de monnaie rendue. » |

Preuve : `SHIFT_DISCREPANCY` (`M/20261103000006_lot6_pros_admin.sql:269`, `lib/shifts/shift.service.ts:409`).

5. **Ce que les autres voient.** Mariama : colonne « Écart » et justification, indicateur « Écart cumulé ». Aucun écran pour l'admin. Preuve : `components/partner/pilotage/CashTab.tsx:36-46`, `app/api/admin/shifts/audit/route.ts:20`.
6. **Ce qui est impossible.** Clôturer un écart sans justification ou sans PIN. Sans PIN généré : bloqué jusqu'à ce que Mariama en crée un (étape 6.8).
7. **Test et essai.** Test : `tests/parcours/dette-cloture-caisse.test.ts:202` « clôture avec écart justifié et PIN : CLOTURE, écart = déclaré − attendu, justification, co-signature, une alerte in-app sans emoji » ; `tests/parcours/dette-cloture-caisse.test.ts:220` « garde-fou : écart sans justification, ou justification de moins de 10 caractères → 400 JUSTIFICATION_REQUIRED, caisse OUVERT » ; `tests/parcours/dette-cloture-caisse.test.ts:233` « garde-fou : écart justifié avec un PIN faux → 401 PIN_INVALID ; sans PIN → 400 PIN_REQUIRED ; caisse OUVERT » ; `tests/parcours/dette-cloture-caisse.test.ts:247` « écart négatif (espèces manquantes) : JUSTIFICATION_REQUIRED puis PIN_REQUIRED portent expected, declared et discrepancy = −1000 ; caisse OUVERT » ; `tests/parcours/dette-cloture-caisse.test.ts:290` « double clôture simultanée avec écart justifié : une seule réussit, une seule alerte au partenaire » ; `tests/parcours/notif-pros.test.ts:455` « caisse clôturée avec écart : SHIFT_DISCREPANCY (in-app, SMS, push) au partenaire, alert_queued, SMS exact ; sans écart : rien » ; `e2e/terrain.spec.ts:924` « 12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste ». Essai : Essai 38 de `docs/recette-billetterie.md`.

### Étape 11.5 — Rapport de caisse

1. **Qui, où, quel bouton.** Ibrahima, juste après la clôture : fenêtre « Caisse clôturée », « Z de caisse », boutons « Imprimer le Z », « Terminé ». Mariama : `/partner/events/{id}?tab=caisse`, section « Sessions de caisse », et onglet Clôture, section « Z de caisse ». Preuve : `components/shifts/ShiftModals.tsx:338-345`, `components/partner/pilotage/ClosingTab.tsx:194`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Lignes du rapport : « Événement », « Contrôleur », « Ouverture », « Clôture », « Fonds de caisse », « Encaissements enregistrés », « Encaissements comptés », « Écart », « Justification : … », « Clôture co-signée par le code PIN du régisseur. » ou « Clôture sans co-signature (aucun écart). ». Fiche partenaire : « Fonds de caisse (hors recettes) », « Attendu », « Déclaré hors fonds », « Écart », « Co-signature par PIN ».
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Ibrahima ne peut pas rouvrir son rapport après l'avoir fermé. Autre compte : « Session de caisse introuvable. ». Preuve : `components/shifts/ShiftModals.tsx:320`.
7. **Test et essai.** Test : `tests/parcours/acces-caisse-pin.test.ts:190` « lisible par son contrôleur, le partenaire propriétaire et un admin » ; `tests/parcours/acces-caisse-pin.test.ts:198` « 404 pour un autre contrôleur (même du même événement), un autre partenaire, une caisse inexistante » ; `tests/parcours/pilotage-equipe-caisse.test.ts:134` « caisses ouvertes et clôturées : fonds, espèces encaissées, déclaré hors fonds, écart, justification » ; `tests/parcours/pilotage-equipe-caisse.test.ts:158` « espèces par contrôleur » ; `e2e/recette.spec.ts:728` « acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran ». Essai : Essai 37 de `docs/recette-billetterie.md`.

### Étape 11.6 — Clôture par la partenaire ou l'admin

1. **Qui, où, quel bouton.** Le serveur l'accepte, mais **aucun écran ne le permet** : seule la fenêtre du scanner appelle la clôture. Preuve : `components/shifts/ShiftModals.tsx:190`.
2. **Ce qu'il saisit.** Aucun, faute d'écran.
3. **Ce que fait le système.** Si cette voie est appelée directement, la caisse est clôturée au nom de la partenaire ou de l'admin.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima, seulement par la voie sans écran | cloche | indispensable | prochain passage de la file | titre « Caisse fermée » ; modèle « Votre caisse pour « {title} » a été fermée par l'organisateur. Montant déclaré : {declared}. » ; exemple « Votre caisse pour « Gala de la Teranga » a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA. » |
| Ibrahima, seulement par la voie sans écran | push | indispensable | prochain passage de la file | titre « Caisse fermée » ; modèle « Votre caisse pour « {title} » a été fermée par l'organisateur. Montant déclaré : {declared}. » ; exemple « Votre caisse pour « Gala de la Teranga » a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA. » |

Preuve : `SHIFT_CLOSED_BY_OTHER` (`M/20261103000006_lot6_pros_admin.sql:289`).

5. **Ce que les autres voient.** Aucun, faute d'écran.
6. **Ce qui est impossible.** Clôturer depuis l'interface. Conséquence : si le droit d'encaisser est retiré avec une caisse ouverte, la caisse reste ouverte sans sortie (revue critique).
7. **Test et essai.** Test : `tests/parcours/dette-cloture-caisse.test.ts:300` « le partenaire propriétaire clôture la caisse d’un contrôleur : 200, closed_by = partenaire » ; `tests/parcours/dette-cloture-caisse.test.ts:309` « un admin clôture avec écart justifié et PIN : 200, closed_by = admin » ; `tests/parcours/notif-controleurs.test.ts:314` « fermée par le partenaire ou par un admin : SHIFT_CLOSED_BY_OTHER (in-app, push) au contrôleur ; fermée par lui-même : rien ». Essai : aucun.

# Chapitre 12. Le pilotage pendant l'événement

### Étape 12.1 — Ouvrir le pilotage

1. **Qui, où, quel bouton.** Mariama, `/partner/events/{id}`, retour « Mes événements ». Onglets « Aperçu », « Ventes », « Invitations », « Entrées », « Équipe », « Caisse », « Clôture ». Boutons « Modifier », « Annuler l'événement » selon le statut. Preuve : `app/partner/events/[id]/page.tsx:46-54`, `:166`, `:205-213`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Lecture seule. La page se met à jour seule pour les scans, les incidents, les caisses et l'historique des statuts. **Pas pour les ventes** : une vente en ligne ne recharge rien. L'indicateur « En direct » est masqué pour un événement annulé ou terminé. Preuve : `app/partner/events/[id]/page.tsx:57-58`, `:80-90`, `:173`, `components/partner/useServerData.ts:60-66`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** L'admin n'a pas de lien vers cet écran, mais son adresse lui répond.
6. **Ce qui est impossible.** Autre partenaire, client, événement inconnu : « Événement introuvable. ». Compte non actif : « Votre compte n’est pas actif. ». Écran : « Le pilotage n’a pas pu être chargé », « Événement introuvable ou non autorisé. ». Preuve : `lib/events/pilotage.service.ts:67-72`, `app/partner/events/[id]/page.tsx:149-150`.
7. **Test et essai.** Test : `tests/parcours/pilotage-acces.test.ts:104` « propriétaire : 200 sur les six onglets et l’export (témoin) » ; `tests/parcours/pilotage-acces.test.ts:258` « onglets du composant partagé Tabs : Aperçu, Ventes, Entrées, Équipe, Caisse, Clôture » ; `tests/parcours/pilotage-acces.test.ts:268` « indicateurs KpiCard et temps réel par useRealtimeRefresh (ticket_scans, scan_incidents, controller_shifts) » ; `tests/parcours/pilotage-acces.test.ts:282` « aucun calcul d’agrégat dans le navigateur : ni reduce, ni filter(…).length, ni lecture directe des tables ou des anciennes routes ». Essai : Essai 39 de `docs/recette-billetterie.md`, sans section dédiée dans `docs/essai-local.md`.

### Étape 12.2 — Onglet « Aperçu » : les chiffres

1. **Qui, où, quel bouton.** Mariama, `/partner/events/{id}?tab=apercu`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** « Billetterie », « Billets valides et utilisés, hors invitations. » : « Billets vendus », « Places en vente », « Places restantes » (« Dans les catégories actives, sans compter {n} en cours de paiement », exemple « Dans les catégories actives, sans compter 3 en cours de paiement »), « Invitations ». Événement annulé : « Vente », « Arrêtée », « Événement annulé : aucune place n’est plus proposée ». « Contrôle d’accès », « Passages validés au scan et au guichet. » : « Entrées » (« dont {n} au guichet », exemple « dont 12 au guichet »), « Taux de présence ». « Recettes », « Montants des billets, remboursements déduits pour les ventes en ligne. » : « En ligne », « En espèces », « Remboursé ». Bas de page : « Chiffres calculés le {date}. ». Après une annulation, « Billets vendus » tombe au nombre de billets déjà utilisés. Preuve : `components/partner/pilotage/OverviewTab.tsx:27-63`, `:66-83`, `:85-100`, `M/20261102000005_lot5_pilotage.sql:212-301`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Modifier un chiffre.
7. **Test et essai.** Test : `tests/parcours/pilotage-apercu-ventes.test.ts:76` « billets : vendus hors invitations, invitations à part, capacité = Σ quotas actifs, en cours de paiement, restants » ; `tests/parcours/pilotage-apercu-ventes.test.ts:89` « chiffre d’affaires : en ligne (grand livre), espèces (paiements hors plateforme, billet impayé exclu), remboursé » ; `tests/parcours/pilotage-apercu-ventes.test.ts:98` « entrées : scans acceptés dont guichet, taux de présence = entrées / (vendus + invitations) » ; `tests/parcours/pilotage-apercu-ventes.test.ts:107` « admin : 200 et mêmes chiffres ; l’action « suspendre » lui est proposée avec motif obligatoire ». Essai : Essai 39 de `docs/recette-billetterie.md`.

### Étape 12.3 — Onglet « Ventes » et ventes par canal

1. **Qui, où, quel bouton.** Mariama, `?tab=ventes`.
2. **Ce qu'il saisit.** Aucun pour les chiffres. Le remboursement d'un billet est au chapitre 15.
3. **Ce que fait le système.** « Par catégorie » : « Catégorie », « Prix », « Vendus », « En cours de paiement », « Invitations », « Restants » (« {n} / {total} », exemple « 188 / 200 », ou « Vente fermée »), « Recettes en ligne ». « Évolution jour par jour », « Billets vendus chaque jour, à l’heure de Dakar. », détail « dont {n} en espèces ». **Il n'y a pas d'écran des ventes par canal** : les données existent, mais aucun composant n'affiche le nombre de billets par canal. Le seul découpage visible est « En ligne » et « En espèces » en montant. Preuve : `components/partner/pilotage/SalesTab.tsx:16-37`, `:70-82`, `M/20261106000001_lot8_canaux.sql:1187-1280`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Lire les ventes par canal en nombre de billets.
7. **Test et essai.** Test : `tests/parcours/pilotage-apercu-ventes.test.ts:129` « par catégorie : vendus, en cours de paiement, restants (Standard, VIP, Étudiant) ; catégorie inactive sans vente » ; `tests/parcours/pilotage-apercu-ventes.test.ts:147` « Σ par catégorie = totaux de l’aperçu (une seule source de vérité) » ; `tests/parcours/pilotage-apercu-ventes.test.ts:161` « jour par jour en Africa/Dakar : chaque jour = billets vendus émis ce jour-là, Σ = vendus, ordre chronologique ». Essai : aucun, hors l'Essai 41 de `docs/recette-billetterie.md` qui lit la séparation en ligne et espèces.

### Étape 12.4 — Onglet « Entrées »

1. **Qui, où, quel bouton.** Mariama, `?tab=entrees`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Cartes « Entrées validées », « Au guichet », « Refus ». Sections « Tentatives multiples », avec « Billets présentés plusieurs fois », « Vérifiez ces billets avec vos contrôleurs : il peut s’agir d’une capture d’écran partagée. » ; « Par contrôleur » ; « Par point d’entrée » ; « Par catégorie » ; « Flux par quart d’heure » ; « Refus par motif » ; « Incidents techniques ». Mise à jour seule à chaque scan. Vide : « Aucun scan pour le moment », « Les entrées s’affichent ici dès le premier scan, sans recharger la page. ». Preuve : `components/partner/pilotage/EntriesTab.tsx:76-94`, `:103`, `M/20261102000005_lot5_pilotage.sql:513-701`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Les scans d'Ibrahima alimentent cet onglet.
6. **Ce qui est impossible.** Aucun. Erreur : « Entrées indisponibles ».
7. **Test et essai.** Test : `tests/parcours/pilotage-entrees.test.ts:68` « total des entrées (scans acceptés), dont guichet, et total des refus » ; `tests/parcours/pilotage-entrees.test.ts:94` « par point d’entrée et par catégorie » ; `tests/parcours/pilotage-entrees.test.ts:138` « refus par motif, libellés français (forbidden compris) ; l’encaissement consommé n’est pas un refus » ; `tests/parcours/pilotage-entrees.test.ts:179` « le propriétaire abonné reçoit le scan, puis l’API entries le compte ; le partenaire B ne reçoit rien ». Essai : Essai 39 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.8.

### Étape 12.5 — Onglets « Caisse » et « Clôture » pendant l'événement

1. **Qui, où, quel bouton.** Mariama, `?tab=caisse` et `?tab=cloture`.
2. **Ce qu'il saisit.** Caisse : le code PIN (étape 6.8). Clôture : le formulaire d'export (étape 12.6).
3. **Ce que fait le système.** Caisse : « Espèces encaissées », « Caisses ouvertes », « Caisses clôturées ». **Mariama n'a aucun bouton pour clôturer une caisse.** Clôture : « Montant net organisateur », « Disponibilité des fonds », « Absents » ; « Rapport de clôture » ; « Z de caisse » ; « Export des participants ». La liste nominative des absents n'est donnée qu'après la fin. Preuve : `components/partner/pilotage/CashTab.tsx:118-120`, `components/partner/pilotage/ClosingTab.tsx:164-225`, `components/shifts/ShiftModals.tsx:190`, `M/20261102000005_lot5_pilotage.sql:789-893`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Lire la liste des absents avant la fin. Clôturer une caisse.
7. **Test et essai.** Test : `tests/parcours/pilotage-cloture-export.test.ts:179` « absents : nombre en direct (billets VALIDE), aucune liste nominative avant la fin » ; `tests/parcours/pilotage-cloture-export.test.ts:191` « Z de caisse de S1 : déclaré hors fonds, attendu, écart, détail SCAN / GUICHET et par catégorie » ; `tests/parcours/pilotage-cloture-export.test.ts:215` « montant net et plage de disponibilité des fonds (min et max des crédits VENTE de l’événement) » ; `tests/parcours/pilotage-cloture-export.test.ts:341` « après la fin : liste nominative des absents (nom, catégorie), même nombre ; fonds inchangés » ; `tests/parcours/pilotage-equipe-caisse.test.ts:134` « caisses ouvertes et clôturées : fonds, espèces encaissées, déclaré hors fonds, écart, justification ». Essai : Essai 41 de `docs/recette-billetterie.md`.

### Étape 12.6 — Export des participants

1. **Qui, où, quel bouton.** Mariama, onglet Clôture, section « Export des participants », bouton « Exporter les participants ». Texte : « Fichier CSV : nom, catégorie, statut du billet et heure d’entrée. Aucune donnée de paiement ni numéro de billet. ». Preuve : `components/partner/pilotage/ClosingTab.tsx:225`, `:280`.
2. **Ce qu'il saisit.** Case facultative « Inclure le téléphone et l’email des participants », « Seulement pour l’une des finalités ci-dessous. L’export et sa finalité sont journalisés. ». Si cochée, « Finalité de l’export » obligatoire : « Prévenir les participants d’un changement urgent (horaire, lieu, annulation) » ou « Sécurité et accueil des participants le jour de l’événement ». Erreur : « Choisissez la finalité de l’export des contacts. ». Preuve : `components/partner/pilotage/ClosingTab.tsx:20-23`, `:241-262`, `:267`.
3. **Ce que fait le système.** Billets « Valable » et « Utilisé », invitations comprises. Colonnes « Nom », « Catégorie », « Canal », « Statut du billet », « Heure d’entrée », puis « Téléphone » et « E-mail » si demandés. Canaux « En ligne », « Gratuit », « Guichet », « Invitation ». Sans nom : « Invitation en attente », « Vente au guichet », « Participant sans nom ». Fichier `participants-{titre}-{AAAA-MM-JJ}.csv`, exemple `participants-gala-de-la-teranga-2026-11-14.csv`. Après une annulation, les billets annulés sortent du fichier. Preuve : `M/20261108000002_lot9_invitations.sql:268-338`, `lib/events/pilotage.service.ts:184-201`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Message à l'écran : « Export téléchargé. Il est enregistré dans le journal des exports. ».

5. **Ce que les autres voient.** Le journal des exports n'a pas d'écran.
6. **Ce qui est impossible.** Contacts sans finalité : « Pour exporter le téléphone et l’email, choisissez une finalité : information urgente sur l’événement, ou sécurité et accueil. ». Erreurs : « L’export n’a pas abouti », « Export impossible pour le moment. », « Connexion impossible. Vérifiez votre réseau, puis réessayez. ».
7. **Test et essai.** Test : `tests/parcours/pilotage-cloture-export.test.ts:230` « sans contacts : CSV UTF-8 avec BOM, en-têtes français, nom / catégorie / statut (libellé) / heure d’entrée, sans paiement, numéro, téléphone ni email » ; `tests/parcours/pilotage-cloture-export.test.ts:279` « contacts sans finalité, ou finalité hors de la liste fermée : 400 PURPOSE_REQUIRED, aucun fichier » ; `tests/parcours/pilotage-cloture-export.test.ts:293` « contacts avec une finalité de la liste fermée : téléphone et email ajoutés, toujours sans donnée de paiement » ; `tests/parcours/pilotage-cloture-export.test.ts:312` « chaque export journalisé : acteur, contacts, finalité, nombre de lignes, sans donnée de participant ; l’admin aussi ». Essai : Essai 40 de `docs/recette-billetterie.md`.

# Chapitre 13. La suspension d'un événement par l'admin

Le second événement, « Nuit du Mbalax », sert ici. Une seule voie : un événement « Publié », un admin, un motif obligatoire. Un événement « Validé » non publié ne se suspend pas ; Mariama ne suspend pas. Preuve : `M/20261102000003_lot5_cycle.sql:49-65`, `tests/parcours/cycle-transitions.test.ts:375`, `:409`.

### Étape 13.1 — Suspendre

1. **Qui, où, quel bouton.** Aïda, ou Moussa avec `events.write`. `/admin/events/{id}`, bouton « Suspendre ». Preuve : `app/admin/events/[id]/page.tsx:529-538`.
2. **Ce qu'il saisit.** Fenêtre « Suspendre l’événement », « La vente et le contrôle d’accès s’arrêtent immédiatement. L’organisateur et les détenteurs de billets sont prévenus ; seul l’organisateur voit le motif. ». « Motif de la suspension », obligatoire, aide « Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique. ». Boutons « Annuler », « Suspendre ». Erreurs : « Le motif doit contenir au moins 3 caractères. » ; « Un motif d'au moins 3 caractères est obligatoire. ». Preuve : `app/admin/events/[id]/page.tsx:196-198`, `:778-779`, `components/ui/ReasonDialog.tsx:51`, `:65`.
3. **Ce que fait le système.** « Publié » devient « Suspendu ». Les rappels en attente sont annulés. La page publique reste accessible, avec le bandeau « Événement suspendu », « La billetterie est momentanément fermée par l’organisation. Les billets déjà achetés restent valables ; vous serez informé de la suite. », sans module d'achat. L'événement sort de l'accueil, d'Explorer et de Populaires. Le motif n'est jamais public. Message « Événement suspendu : la vente et le contrôle d’accès sont arrêtés. ». Preuve : `M/20261103000005_lot6_billetterie.sql:942-1054`, `M/20261103000004_lot6_rappels.sql:215-237`, `app/api/events/[id]/route.ts:15-18`, `M/20261108000003_lot9_decouverte.sql:40`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : événement {title} suspendu. Motif : {reason} {APP_URL}/partner/events » ; exemple « Event Village : événement Gala de la Teranga suspendu. Motif : Signalement en cours d'examen. https://eventvillage.sn/partner/events » (132 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Événement suspendu » ; modèle « « {title} » est suspendu par l'administration. Motif : {reason} » ; exemple « « Gala de la Teranga » est suspendu par l'administration. Motif : Signalement en cours d’examen. » |
| Mariama | push | indispensable | prochain passage de la file | titre « Événement suspendu » ; modèle « « {title} » est suspendu par l'administration. Motif : {reason} » ; exemple « « Gala de la Teranga » est suspendu par l'administration. Motif : Signalement en cours d’examen. » |
| Mariama | email | indispensable | prochain passage de la file | objet « Événement suspendu — Event Village » ; modèle : Événement suspendu<br>« {title} » est suspendu par l'administration. Motif : {reason}<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Événement suspendu<br>« Gala de la Teranga » est suspendu par l'administration. Motif : Signalement en cours d’examen.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Chaque compte détenteur d'un billet valable ou utilisé | cloche | optionnel | prochain passage de la file | titre « Événement suspendu » ; modèle « « {title} » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. » ; exemple « « Gala de la Teranga » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. » |
| Chaque compte détenteur d'un billet valable ou utilisé | push | optionnel | prochain passage de la file | titre « Événement suspendu » ; modèle « « {title} » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. » ; exemple « « Gala de la Teranga » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. » |

Pas de SMS ni d'email aux détenteurs. Rien aux contrôleurs, aux invités sans compte, aux acheteurs au guichet. Preuve : `EVENT_SUSPENDED` (`M/20261103000005_lot6_billetterie.sql:1260-1265`) ; `EVENT_SUSPENDED_HOLDER` (`M/20261103000005_lot6_billetterie.sql:1267-1275`).

5. **Ce que les autres voient.** Mariama : statut « Suspendu », bandeau « Suspendu par l’équipe Event Village », motif, date ; restent « Modifier » et « Annuler l’événement ». Aïda : bandeau « Motif de la suspension », « Communiqué à l’organisateur le {date}. ». Mes billets : aucun changement, le billet reste « Valable » avec son QR. Preuve : `app/partner/events/[id]/page.tsx:226-238`, `app/admin/events/[id]/page.tsx:553-564`, `app/api/tickets/route.ts:48`.
6. **Ce qui est impossible.** Sans `events.write` : « Permission manquante : events.write », boutons pourtant visibles. Autre statut : « Un événement « Validé » ne peut pas passer à « Suspendu ». ». Mariama : « Votre rôle ne permet pas de passer cet événement de « Publié » à « Suspendu ». ». Preuve : `lib/admin/admin-auth.ts:202-208`.
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:553` « suspendre (PUBLIE → SUSPENDU, motif obligatoire) puis réactiver (SUSPENDU → PUBLIE) » ; `tests/parcours/admin-evenements.test.ts:590` « ADMIN avec events.read seul : 403 sur /transition, statut inchangé, aucune ligne d’historique » ; `tests/parcours/cycle-transitions.test.ts:424` « motif obligatoire (REASON_REQUIRED) pour le refus admin et la suspension ; le retrait par le partenaire s’en passe » ; `tests/parcours/cycle-transitions.test.ts:624` « refus avec motif, validation, suspension avec motif : acteur de la session journalisé, partenaire notifié » ; `tests/parcours/notif-pros.test.ts:313` « suspension avec motif et réactivation : avis au partenaire et un seul avis par porteur distinct (billets VALIDE et UTILISE) » ; `tests/parcours/cycle-visibilite.test.ts:168` « SUSPENDU : 200 avec bandeau, purchasable false » ; `e2e/recette.spec.ts:987` « suspension de E1 sur sa fiche, avec motif : plus de vente, bandeau public ». Essai : aucun (l'Essai 55 suspend un partenaire, pas un événement).

### Étape 13.2 — Pendant la suspension

1. **Qui, où, quel bouton.** Tous les acteurs, sur leurs écrans habituels.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.**

| Action | Résultat | Preuve |
|---|---|---|
| Achat en ligne ou billet gratuit | refus « Cet événement n'est pas ouvert à la vente. » | `M/20261105000006_lot7_client.sql:77`, `M/20261105000007_lot7_confirmation.sql:232` |
| Paiement déjà lancé, confirmé après | panier refusé et remboursé | `M/20261106000003_lot8_paiement.sql:154-155` |
| Scan | résultat « Événement suspendu » | `M/20261108000005_lot9_nettoyage.sql:168` |
| Écran du contrôleur | « Événement suspendu », « Les contrôles d’accès sont suspendus sur cet événement. » | `app/controller/scanner/page.tsx:856-861` |
| Ouvrir une caisse | refus « Cet événement est suspendu. » | `lib/shifts/shift.service.ts:211-216` |
| Vendre au guichet | « Cet événement n'est pas ouvert à la vente au guichet. » | `M/20261106000001_lot8_canaux.sql:391` |
| Caisse déjà ouverte | reste ouverte, se clôture normalement | `M/20261103000006_lot6_pros_admin.sql:165-308` |
| Lancer un transfert | « Cet événement n'accepte plus les transferts de billets. » | `M/20261103000005_lot6_billetterie.sql:129-130` |
| Accepter un transfert | « Cet événement n'accepte plus de transfert. », il reste en attente | `M/20261108000002_lot9_invitations.sql:147-148` |
| Annuler son transfert | permis | `M/20261103000005_lot6_billetterie.sql:174-234` |
| Nouvelle invitation | « Cet événement n’accepte pas d’invitations pour le moment. » | `M/20261108000002_lot9_invitations.sql:419-420` |
| Annuler une invitation | permis | `tests/parcours/invitations-annulation.test.ts:215` |
| Modifier la fiche | permis à Mariama | `M/20261108000001_lot9_securite.sql:248` |
| Codes hors ligne | nouveau lot refusé, « Cet événement n’est pas ouvert : les codes hors ligne ne sont pas disponibles. » | `lib/tickets/offline-codes.service.ts:41` |
| QR dans Mes billets | reste affiché, billet « Valable » | `TicketCard.tsx:133` |
| Rappels | aucun tant que suspendu | `M/20261105000002_lot7_sms.sql:622` |
| Retrait de l'argent | **non bloqué** | `M/20261101000014_lot4_correctif_retraits_concurrents.sql:12-137` |

Le sort d'un lot de codes hors ligne déjà téléchargé pendant une suspension est NON VÉRIFIÉ sur un vrai téléphone : le refus se fait au scan, en ligne.

4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun autre, sauf ceux d'une transition.

5. **Ce que les autres voient.** Le pilotage reste consultable. « Places en vente » continue de s'afficher.
6. **Ce qui est impossible.** Voir le tableau. Mariama ne peut pas lever la suspension.
7. **Test et essai.** Test : `tests/parcours/cycle-annulation.test.ts:552` « paiement confirmé après la suspension de l’événement → refusé et remboursé » ; `tests/parcours/course-annulation-transfert.test.ts:281` « 4. événement ANNULE puis SUSPENDU (transaction annulée) → EVENT_NOT_ACTIVE ; témoin PUBLIE → réclamation réussie » ; `tests/parcours/notif-rappels-annulation.test.ts:269` « suspension : rappels PENDING → CANCELLED EVENT_SUSPENDU dans la même transaction ; réactivation dans la tolérance → pas recréés, rien envoyé » ; `tests/parcours/hors-ligne-codes.test.ts:174` « 2. 409 TICKET_NOT_VALID (UTILISE, ANNULE), EVENT_NOT_PUBLISHED (SUSPENDU, TERMINE), TRANSFER_PENDING ». Essai : aucun.

### Étape 13.3 — Réactiver

1. **Qui, où, quel bouton.** Aïda ou Moussa, `/admin/events/{id}`, bouton « Réactiver ». Fenêtre « Réactiver l’événement ? », « La page publique, la vente et le contrôle d’accès reprennent. L’organisateur et les détenteurs de billets sont prévenus. ». Preuve : `app/admin/events/[id]/page.tsx:204-205`.
2. **Ce qu'il saisit.** Aucun motif.
3. **Ce que fait le système.** « Suspendu » redevient « Publié ». Les rappels annulés ne sont pas recréés s'ils sont dépassés. Message « Événement réactivé : la vente reprend. ». Retour au catalogue. Preuve : `app/admin/events/[id]/page.tsx:206`, `tests/parcours/notif-rappels-annulation.test.ts:269`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre événement {title} est de nouveau en ligne. {APP_URL}/partner/events » ; exemple « Event Village : votre événement Gala de la Teranga est de nouveau en ligne. https://eventvillage.sn/partner/events » (114 caractères, 1 segment) |
| Mariama | cloche | indispensable | prochain passage de la file | titre « Événement réactivé » ; modèle « « {title} » est de nouveau en ligne. » ; exemple « « Gala de la Teranga » est de nouveau en ligne. » |
| Mariama | push | indispensable | prochain passage de la file | titre « Événement réactivé » ; modèle « « {title} » est de nouveau en ligne. » ; exemple « « Gala de la Teranga » est de nouveau en ligne. » |
| Mariama | email | indispensable | prochain passage de la file | objet « Événement réactivé — Event Village » ; modèle : Événement réactivé<br>« {title} » est de nouveau en ligne.<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Événement réactivé<br>« Gala de la Teranga » est de nouveau en ligne.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Chaque compte détenteur | cloche | optionnel | prochain passage de la file | titre « Événement de nouveau en ligne » ; modèle « « {title} » reprend comme prévu. Vos billets restent valables. » ; exemple « « Gala de la Teranga » reprend comme prévu. Vos billets restent valables. » |
| Chaque compte détenteur | push | optionnel | prochain passage de la file | titre « Événement de nouveau en ligne » ; modèle « « {title} » reprend comme prévu. Vos billets restent valables. » ; exemple « « Gala de la Teranga » reprend comme prévu. Vos billets restent valables. » |

Preuve : `EVENT_REACTIVATED` (`M/20261103000005_lot6_billetterie.sql:1277-1281`) ; `EVENT_REACTIVATED_HOLDER` (`M/20261103000005_lot6_billetterie.sql:1283-1291`).

5. **Ce que les autres voient.** Le scanner redevient utilisable. Les transferts sont de nouveau acceptables. Preuve : `lib/events/event-status.ts:14`.
6. **Ce qui est impossible.** Réactiver depuis un autre statut. Un événement annulé ne repasse jamais « Publié ». Preuve : `tests/parcours/cycle-transitions.test.ts:328`.
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:553` « suspendre (PUBLIE → SUSPENDU, motif obligatoire) puis réactiver (SUSPENDU → PUBLIE) » ; `tests/parcours/notif-pros.test.ts:313` « suspension avec motif et réactivation : avis au partenaire et un seul avis par porteur distinct (billets VALIDE et UTILISE) » ; `tests/parcours/temps-reel-public.test.ts:188` « PUBLIE → SUSPENDU → PUBLIE → ANNULE : chaque statut arrive à anon, sans le motif de suspension ni le motif interne ; l’événement annulé sort du catalogue ». Essai : aucun.

### Étape 13.4 — La fin passe pendant la suspension

1. **Qui, où, quel bouton.** Personne : c'est le temps. Aïda tente ensuite « Réactiver ».
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** La tâche de fin ne prend que les événements « Publié » : celui-ci reste « Suspendu » sans limite. Aucun passage « Suspendu » vers « Terminé » n'existe. L'argent devient quand même retirable à fin + 48 heures. Preuve : `M/20261102000003_lot5_cycle.sql:49-65`, `:844`, `tests/parcours/cycle-cron.test.ts:220`, `M/20261101000004_lot3_grand_livre.sql:107-132`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Les détenteurs ont lu « vous serez prévenu de la suite » et n'ont plus rien.

5. **Ce que les autres voient.** Le bouton « Réactiver » reste affiché.
6. **Ce qui est impossible.** « Réactiver » : « La fin de cet événement est passée : il ne peut plus être publié. ». Sorties restantes : annuler, donc rembourser tout le monde ; ou faire changer la date par Mariama, puis réactiver, ce qui publie un faux report. Preuve : `M/20261103000005_lot6_billetterie.sql:1036-1037`.
7. **Test et essai.** Test : `tests/parcours/cycle-cron.test.ts:220` « le cron ne touche ni un PUBLIE à venir, ni un SUSPENDU passé » ; `tests/parcours/cycle-transitions.test.ts:467` « publication d’un événement dont la fin est passée → EVENT_ENDED (fin renseignée, ou début la veille sans fin) ». Essai : aucun.

# Chapitre 14. L'annulation

Permise depuis « Validé », « Publié » ou « Suspendu », par Mariama ou par un admin. Pas depuis « Terminé », ni depuis un brouillon. Aucune limite d'heure : l'annulation reste possible pendant l'événement, après des entrées. Preuve : `M/20261102000003_lot5_cycle.sql:49-65`, `tests/parcours/cycle-transitions.test.ts:358`.

### Étape 14.1 — Mariama annule

1. **Qui, où, quel bouton.** Mariama, `/partner/events/{id}`, ou `/partner/events`, bouton « Annuler l’événement ». Preuve : `app/partner/events/[id]/page.tsx:211`, `app/partner/events/page.tsx:353`.
2. **Ce qu'il saisit.** Fenêtre « Annuler l’événement ? », « L’annulation est définitive : la vente s’arrête, les participants sont prévenus et les billets payés en ligne sont remboursés automatiquement. ». « Impact de l’annulation » : « Acheteurs à prévenir », « Billets payés en ligne », « Billets payés en espèces », « Billets gratuits et invitations », « Remboursement en ligne (automatique) », « Espèces à rembourser par l’organisateur », et si besoin « Paiements en cours (refusés puis remboursés) ». Obligatoires : « Avis public aux participants », aide « Affiché sur la page de l’événement et envoyé aux acheteurs. Expliquez la raison et la suite (remboursement, report éventuel). », 10 à 2 000 caractères ; « Motif interne », aide « Visible seulement de l’organisateur et de l’équipe Event Village, jamais publié. », 3 à 2 000 ; le titre retapé : « Pour confirmer, saisissez le titre exact de l’événement : « Nuit du Mbalax » ». Boutons « Garder l’événement », « Confirmer l’annulation ». Erreurs : « L’avis public doit contenir au moins 10 caractères. » ; « Le motif interne doit contenir au moins 3 caractères. ». Preuve : `components/events/EventCancelDialog.tsx:139`, `:161-168`.
3. **Ce que fait le système.** Voir l'étape 14.2.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

À cette étape, aucun. Voir l'étape 14.5.

5. **Ce que les autres voient.** Voir l'étape 14.5.
6. **Ce qui est impossible.** « Cet événement est déjà annulé. » ; « Un événement « {statut} » ne peut pas être annulé. », exemple « Un événement « Terminé » ne peut pas être annulé. » ; « Le titre saisi ne correspond pas au titre de l'événement. » ; « Seuls l'organisateur de l'événement et les administrateurs peuvent l'annuler. » ; « L'annulation passe par la procédure d'annulation, qui rembourse les acheteurs. » ; « Annulation impossible pour le moment. », bandeau « L’annulation n’a pas abouti ». Annuler une annulation : impossible. Preuve : `M/20261106000003_lot8_paiement.sql:266-414`, `tests/parcours/cycle-transitions.test.ts:328`.
7. **Test et essai.** Test : `tests/parcours/cycle-annulation.test.ts:233` « SUSPENDU → ANNULE accepté avec remboursements (route partenaire) » ; `tests/parcours/cycle-annulation.test.ts:271` « PUBLIE → ANNULE (route partenaire, titre retapé avec des espaces) et VALIDE → ANNULE (route admin) » ; `tests/parcours/cycle-annulation.test.ts:292` « titre retapé faux → TITLE_MISMATCH, rien d’écrit ; avis public ou motif interne trop courts refusés » ; `tests/parcours/cycle-annulation.test.ts:321` « ANNULE par event_transition → CANCELLATION_REQUIRED (RPC et route), rien d’écrit » ; `tests/parcours/cycle-annulation.test.ts:366` « practical_info.cancellation n’est plus écrit ; le motif interne reste dans event_cancellations et n’est jamais public » ; `tests/parcours/cycle-annulation.test.ts:429` « impact exact sur un jeu connu : 5 billets en ligne, 1 espèces, 1 gratuit, 1 invitation, 4 acheteurs, montants ». Essai : Essai 44 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.10.

### Étape 14.2 — Ce que fait l'annulation, en une seule opération

1. **Qui, où, quel bouton.** Le serveur, après la confirmation.
2. **Ce qu'il saisit.** L'avis public, le motif interne et le titre retapé. Sinon : « Données invalides : avis public, motif interne et titre retapé sont obligatoires. ».
3. **Ce que fait le système.** Dans l'ordre : contrôles ; avis et motif enregistrés ; statut « Annulé » ; transferts en attente annulés, verrous levés ; pour chaque paiement en ligne, une demande de remboursement du montant entier ; billets du paiement « Remboursement en cours » (les billets déjà utilisés ne changent pas, mais leur part est remboursée) ; billet gratuit ou invitation « Annulé », place rendue ; billet payé en espèces « Annulé », à rembourser par Mariama. Puis les versements partent un par un, après la fin de l'opération. Écran : « Événement annulé. {n} remboursement(s) envoyé(s), {m} en attente ou à vérifier. », exemple « Événement annulé. 12 remboursement(s) envoyé(s). ». Page publique : « Événement annulé », « Cet événement n’aura pas lieu. Les billets payés en ligne sont remboursés automatiquement. », « Message de l’organisateur », l'avis, « Annulé le {date} », et « Les billets payés en ligne sont remboursés automatiquement sur le compte Mobile Money utilisé pour l’achat, frais de service compris. Les billets réglés en espèces sont remboursés par l’organisateur. ». Le nombre de versements envoyés avant une éventuelle coupure de la requête est NON VÉRIFIÉ : la durée maximale d'une requête chez l'hébergeur n'est pas dans le dépôt. Preuve : `M/20261106000003_lot8_paiement.sql:362-405`, `lib/events/event-cancellation.service.ts:119-124`, `:155`, `app/events/[id]/page.tsx:767-775`, `:1087`, `app/api/events/[id]/route.ts:29-31`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

À cette étape, aucun. Voir l'étape 14.5.

5. **Ce que les autres voient.** Mes billets : « Remboursement en cours », « Le remboursement de ce billet est en cours : vous serez prévenu dès le versement. », puis « Remboursé ». Billet gratuit et invitation : « Annulé ». Scanner : « Événement annulé », « Événement annulé : aucune entrée n’est possible, les billets sont remboursés. ». Preuve : `lib/tickets/ticket-status.ts:23-49`.
6. **Ce qui est impossible.** Tout ou rien : un échec annule l'ensemble. Toute vente, tout scan, toute invitation, tout transfert. Preuve : `tests/parcours/dette-annulation-transferts.test.ts:201`.
7. **Test et essai.** Test : `tests/parcours/cycle-annulation.test.ts:233` « SUSPENDU → ANNULE accepté avec remboursements (route partenaire) » ; `tests/parcours/cycle-annulation.test.ts:271` « PUBLIE → ANNULE (route partenaire, titre retapé avec des espaces) et VALIDE → ANNULE (route admin) » ; `tests/parcours/dette-annulation-transferts.test.ts:178` « PUBLIE → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction ; le transfert d’un autre événement reste PENDING » ; `tests/parcours/dette-annulation-transferts.test.ts:231` « variante SUSPENDU → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction » ; `tests/parcours/course-confirmation-annulation.test.ts:210` « 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01 » ; `tests/parcours/course-confirmation-annulation.test.ts:246` « 2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B » ; `tests/parcours/course-annulation-transfert.test.ts:185` « 1. A accepte sans COMMIT, B annule et attend ; après le COMMIT de A, le destinataire reçoit EVENT_CANCELLED, l’expéditeur non » ; `tests/parcours/course-annulation-transfert.test.ts:240` « 3. course au milieu de event_cancel (C tient les catégories, B annule, A accepte) : aucun interblocage, A refusé, billet à l’expéditeur » ; `tests/parcours/cycle-visibilite.test.ts:175` « ANNULE : 200 avec bandeau, avis public, date et information de remboursement, sans motif interne, purchasable false ». Essai : Essais 44 et 45 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.10.

### Étape 14.3 — Frais rendus, finance de la partenaire, commissions

1. **Qui, où, quel bouton.** Automatique.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Le client récupère le montant payé, frais de service compris. Les frais de l'opérateur restent à la charge d'Event Village par défaut. Le compte de Mariama est débité du prix des billets, seulement si la vente lui avait été créditée ; solde insuffisant : une créance est créée. Commission de parrainage jamais versée : annulée. Déjà versée, même en partie : déduite des gains futurs. Le débit a lieu à la demande de remboursement, pas au versement. Preuve : `M/20261101000002_lot3_reglages.sql:66`, `M/20261101000005_lot3_remboursements.sql:42-82`, `M/20261106000004_lot8_commissions.sql:123-192`, `M/20261101000004_lot3_grand_livre.sql:166-218`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `payments.read`, si une créance est créée | cloche | indispensable | prochain passage de la file | titre « Créance sur un compte » ; modèle « Un débit de {amount} sur le compte organisateur dépasse le solde disponible : une créance de {debt} sera compensée sur les gains futurs. » ; exemple « Un débit de 5 000 F CFA sur le compte organisateur dépasse le solde disponible : une créance de 3 000 F CFA sera compensée sur les gains futurs. » |
| Aïda et les admins avec `payments.read`, si une créance est créée | email | indispensable | prochain passage de la file | objet « Créance sur un compte — Event Village » ; modèle : Créance sur un compte<br>Un débit de {amount} sur le compte organisateur dépasse le solde disponible : une créance de {debt} sera compensée sur les gains futurs.<br>Ouvrir Event Village : {APP_URL}/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Créance sur un compte<br>Un débit de 5 000 F CFA sur le compte organisateur dépasse le solde disponible : une créance de 3 000 F CFA sera compensée sur les gains futurs.<br>Ouvrir Event Village : https://eventvillage.sn/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Aucun message au parrain. Preuve : `ADMIN_FINANCE_DEBT` (`M/20261103000006_lot6_pros_admin.sql:526`).

5. **Ce que les autres voient.** Finance de Mariama et pilotage : « Remboursé » augmente.
6. **Ce qui est impossible.** Rien à la main.
7. **Test et essai.** Test : `tests/parcours/finance-commissions.test.ts:346` « remboursement total du billet : commissions EN ATTENTE et DISPONIBLE annulées avec motif, lignes conservées, débit PARRAINAGE » ; `tests/parcours/finance-commissions.test.ts:375` « remboursement partiel d’un panier de 2 billets : commission recalculée au prorata (ancienne CANCELLED RECALCUL_PRORATA, nouvelle ligne) » ; `tests/parcours/finance-commissions.test.ts:401` « commission déjà versée par un retrait de parrainage, puis remboursements : REGULARISATION négative, créance déduite des gains futurs (§103), ligne d’origine conservée ». Essai : aucun essai d'annulation avec commission.

### Étape 14.4 — Caisses ouvertes, paiements en cours, invitations et transferts en cours

1. **Qui, où, quel bouton.** Automatique.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Caisses ouvertes : elles restent ouvertes. Ibrahima peut encore clôturer, mais ni vendre ni ouvrir. Espèces du guichet : les billets vendus au guichet sont déjà « Utilisé », ils ne sont ni dans l'impact, ni dans les remboursements. Paiements en cours : refusés à leur confirmation, puis remboursés. Transferts en attente : annulés sans message. Invitations : avec compte, billet annulé et message d'annulation sans remboursement ; sans compte, billet annulé sans message. Preuve : `M/20261106000001_lot8_canaux.sql:436-440`, `M/20261106000003_lot8_paiement.sql:364-366`, `M/20261102000003_lot5_cycle.sql:687-758`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Transfert révoqué : aucun message à Lamine. Invité sans compte : aucun message à Modou. Les messages des détenteurs sont à l'étape 14.5.

5. **Ce que les autres voient.** Pilotage, onglet Caisse : la caisse reste « Ouverte ».
6. **Ce qui est impossible.** Nouvelle vente, ouverture de caisse, invitation, transfert.
7. **Test et essai.** Test : `tests/parcours/course-confirmation-annulation.test.ts:246` « 2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B » ; `tests/parcours/dette-annulation-transferts.test.ts:178` « PUBLIE → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction ; le transfert d’un autre événement reste PENDING » ; `tests/parcours/dette-annulation-transferts.test.ts:240` « réclamation après l’annulation par la route POST /api/tickets/transfers/[id]/claim → 409 TRANSFER_NOT_PENDING, billet resté au porteur ». Caisse ouverte pendant une annulation : aucun test. Essai : Essai 46 de `docs/recette-billetterie.md`, qui ne peut pas réussir (voir le plan de test).

### Étape 14.5 — Les messages de l'annulation

1. **Qui, où, quel bouton.** Le système, au moment du passage à « Annulé ».
2. **Ce qu'il saisit.** L'avis public alimente la cloche, l'email et le push, pas le SMS.
3. **Ce que fait le système.** Chaque compte détenteur reçoit un message selon qu'il détient un billet payé en ligne ou non. L'argent va à celui qui a payé, même si le billet a été transféré : Lamine reçoit donc l'annonce de remboursement, alors que le versement ira à Fatou. Preuve : `M/20261103000005_lot6_billetterie.sql:1293-1318`, `M/20261101000005_lot3_remboursements.sql:248`, `M/20261105000003_lot7_securite.sql:391`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Détenteur d'un billet payé en ligne | SMS | indispensable | prochain passage de la file, nuit comprise | modèle « Event Village : {title} du {start_at} est annulé. Remboursement automatique en cours. {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga du sam. 14 nov. à 20:00 est annulé. Remboursement automatique en cours. https://eventvillage.sn/tickets » (138 caractères, 1 segment) |
| Détenteur d'un billet payé en ligne | cloche | indispensable | prochain passage de la file, nuit comprise | titre « Événement annulé » ; modèle « « {title} » du {start_at} est annulé. {public_notice} Votre remboursement est en cours. » ; exemple « « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. Votre remboursement est en cours. » |
| Détenteur d'un billet payé en ligne | push | indispensable | prochain passage de la file, nuit comprise | titre « Événement annulé » ; modèle « « {title} » du {start_at} est annulé. {public_notice} Votre remboursement est en cours. » ; exemple « « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. Votre remboursement est en cours. » |
| Détenteur d'un billet payé en ligne | email | indispensable | prochain passage de la file, nuit comprise | objet « Événement annulé — Event Village » ; modèle : Événement annulé<br>« {title} » du {start_at} est annulé. {public_notice} Votre remboursement est en cours.<br>Ouvrir Event Village : {APP_URL}/tickets<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Événement annulé<br>« Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. Votre remboursement est en cours.<br>Ouvrir Event Village : https://eventvillage.sn/tickets<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Détenteur d'un billet gratuit ou d'une invitation | SMS | indispensable | prochain passage de la file, nuit comprise | modèle « Event Village : {title} du {start_at} est annulé. Détails : {APP_URL}/tickets » ; exemple « Event Village : Gala de la Teranga du sam. 14 nov. à 20:00 est annulé. Détails : https://eventvillage.sn/tickets » (112 caractères, 1 segment) |
| Détenteur d'un billet gratuit ou d'une invitation | cloche | indispensable | prochain passage de la file, nuit comprise | titre « Événement annulé » ; modèle « « {title} » du {start_at} est annulé. {public_notice} » ; exemple « « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. » |
| Détenteur d'un billet gratuit ou d'une invitation | push | indispensable | prochain passage de la file, nuit comprise | titre « Événement annulé » ; modèle « « {title} » du {start_at} est annulé. {public_notice} » ; exemple « « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. » |
| Détenteur d'un billet gratuit ou d'une invitation | email | indispensable | prochain passage de la file, nuit comprise | objet « Événement annulé — Event Village » ; modèle : Événement annulé<br>« {title} » du {start_at} est annulé. {public_notice}<br>Ouvrir Event Village : {APP_URL}/tickets<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Événement annulé<br>« Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar.<br>Ouvrir Event Village : https://eventvillage.sn/tickets<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Celui qui a payé, à chaque versement confirmé | SMS | indispensable | prochain passage de la file | modèle « Event Village : remboursement de {amount} versé sur votre compte Wave ({title}). » ; exemple « Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave (Gala de la Teranga). » (94 caractères, 1 segment) |
| Celui qui a payé, à chaque versement confirmé | cloche | indispensable | prochain passage de la file | titre « Remboursement versé » ; modèle « {amount} vous ont été remboursés sur votre compte Wave pour « {title} ». » ; exemple « 5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ». » |
| Celui qui a payé, à chaque versement confirmé | push | indispensable | prochain passage de la file | titre « Remboursement versé » ; modèle « {amount} vous ont été remboursés sur votre compte Wave pour « {title} ». » ; exemple « 5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ». » |
| Celui qui a payé, à chaque versement confirmé | email | indispensable | prochain passage de la file | objet « Remboursement versé — Event Village » ; contenu cité intégralement à l’étape 7.11 |
| Mariama, dernier remboursement confirmé | cloche | indispensable | prochain passage de la file | titre « Remboursements terminés » ; modèle « Tous les remboursements en ligne de « {title} » sont versés. » ; exemple « Tous les remboursements en ligne de « Gala de la Teranga » sont versés. » |
| Mariama, dernier remboursement confirmé | push | indispensable | prochain passage de la file | titre « Remboursements terminés » ; modèle « Tous les remboursements en ligne de « {title} » sont versés. » ; exemple « Tous les remboursements en ligne de « Gala de la Teranga » sont versés. » |
| Mariama, dernier remboursement confirmé | email | indispensable | prochain passage de la file | objet « Remboursements terminés — Event Village » ; modèle : Remboursements terminés<br>Tous les remboursements en ligne de « {title} » sont versés.<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Remboursements terminés<br>Tous les remboursements en ligne de « Gala de la Teranga » sont versés.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Mariama, remboursement bloqué ou refusé, une fois par jour | cloche | indispensable | prochain passage de la file | titre « Remboursements en attente » ; modèle « Des remboursements de « {title} » sont bloqués : l'administration les reprend. » ; exemple « Des remboursements de « Gala de la Teranga » sont bloqués : l'administration les reprend. » |
| Mariama, remboursement bloqué ou refusé, une fois par jour | push | indispensable | prochain passage de la file | titre « Remboursements en attente » ; modèle « Des remboursements de « {title} » sont bloqués : l'administration les reprend. » ; exemple « Des remboursements de « Gala de la Teranga » sont bloqués : l'administration les reprend. » |
| Mariama, remboursement bloqué ou refusé, une fois par jour | email | indispensable | prochain passage de la file | objet « Remboursements en attente — Event Village » ; modèle : Remboursements en attente<br>Des remboursements de « {title} » sont bloqués : l'administration les reprend.<br>Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Remboursements en attente<br>Des remboursements de « Gala de la Teranga » sont bloqués : l'administration les reprend.<br>Ouvrir Event Village : https://eventvillage.sn/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Aïda et les admins avec `refunds.manage` | cloche | indispensable | prochain passage de la file | titre « Remboursement à reprendre » ; modèle « Un remboursement de {amount} est bloqué : opérateur du paiement inconnu. » ; exemple « Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu. » |
| Aïda et les admins avec `refunds.manage` | push | indispensable | prochain passage de la file | titre « Remboursement à reprendre » ; modèle « Un remboursement de {amount} est bloqué : opérateur du paiement inconnu. » ; exemple « Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu. » |
| Aïda et les admins avec `refunds.manage` | email | indispensable | prochain passage de la file | objet « Remboursement à reprendre — Event Village » ; contenu cité intégralement à l’étape 7.12 |
| Aïda et les admins avec `refunds.manage`, issue incertaine | cloche | indispensable | prochain passage de la file | titre « Versement incertain » ; modèle « L'issue d'un versement de {amount} est incertaine : vérifiez-le avant toute action. » ; exemple « L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action. » |
| Aïda et les admins avec `refunds.manage`, issue incertaine | push | indispensable | prochain passage de la file | titre « Versement incertain » ; modèle « L'issue d'un versement de {amount} est incertaine : vérifiez-le avant toute action. » ; exemple « L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action. » |
| Aïda et les admins avec `refunds.manage`, issue incertaine | email | indispensable | prochain passage de la file | objet « Versement incertain — Event Village » ; modèle : Versement incertain<br>L'issue d'un versement de {amount} est incertaine : vérifiez-le avant toute action.<br>Ouvrir Event Village : {APP_URL}/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Versement incertain<br>L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action.<br>Ouvrir Event Village : https://eventvillage.sn/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |

Personne d'autre : Mariama n'est pas prévenue sur le moment d'une annulation faite par l'admin (elle reçoit plus tard « Remboursements terminés » ou « Remboursements en attente » s'il y a des versements en ligne) ; les admins ne sont pas prévenus d'une annulation faite par Mariama ; les contrôleurs ne sont prévenus de rien. Preuve : `EVENT_CANCELLED` (`M/20261106000003_lot8_paiement.sql:266`, `M/20261103000005_lot6_billetterie.sql:1293-1318`) ; `REFUND_PAID` (`M/20261103000006_lot6_pros_admin.sql:410`) ; `CANCEL_REFUNDS_DONE` (`M/20261103000006_lot6_pros_admin.sql:427`) ; `CANCEL_REFUNDS_BLOCKED` (`M/20261103000006_lot6_pros_admin.sql:392`) ; `ADMIN_REFUND_TO_RETRY` (`M/20261103000006_lot6_pros_admin.sql:384`) ; `ADMIN_CASHOUT_UNCERTAIN` (`M/20261103000006_lot6_pros_admin.sql:491`).

5. **Ce que les autres voient.** La cloche et `/notifications`. Mes billets : étape 14.2.
6. **Ce qui est impossible.** Relancer un SMS à la main, sauf une ligne en échec (étape 18.3).
7. **Test et essai.** Test : `tests/parcours/notif-canaux.test.ts:714` « annulation d’un événement : urgence haute, TTL 24 h, titre « Événement annulé », lien Mes billets » ; `tests/parcours/notif-pros.test.ts:592` « remboursements d’une annulation tous versés : CANCEL_REFUNDS_DONE une seule fois (in-app, email, push) ; un REFUND_PAID par cashout » ; `tests/parcours/notif-pros.test.ts:607` « remboursements d’une annulation bloqués (solde insuffisant) : CANCEL_REFUNDS_BLOCKED une seule fois pour le jour » ; `tests/parcours/notif-admins.test.ts:221` « remboursement bloqué (solde insuffisant) : ADMIN_REFUND_TO_RETRY BLOQUE aux admins refunds.manage, un signal REFUND_TO_RETRY » ; `tests/parcours/notif-admins.test.ts:244` « cashout incertain : ADMIN_CASHOUT_UNCERTAIN aux admins refunds.manage, un signal CASHOUT_UNCERTAIN » ; `tests/parcours/notif-rappels-annulation.test.ts:310` « annulation (event_cancel) : CANCELLED EVENT_ANNULE et EVENT_CHANGED NO_LONGER_RELEVANT dans la transaction de l’annulation ». Essai : Essais 44 et 45 de `docs/recette-billetterie.md`, `docs/essai-local.md` sections 8.10 et 8.11.

### Étape 14.6 — L'admin annule

1. **Qui, où, quel bouton.** Aïda ou Moussa avec `events.write`, `/admin/events/{id}`, bouton « Annuler l’événement », même fenêtre. Preuve : `app/admin/events/[id]/page.tsx:539-542`, `:786-796`.
2. **Ce qu'il saisit.** Identique à l'étape 14.1.
3. **Ce que fait le système.** Même opération. Après : bandeau « Événement annulé », avec « Avis public : » et « Motif interne : », et le suivi avec la carte « À reprendre ». Preuve : `app/admin/events/[id]/page.tsx:566-576`, `app/api/admin/events/[id]/cancel/route.ts:26`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Ceux de l'étape 14.5. Aucun à Mariama.

5. **Ce que les autres voient.** Mariama voit le statut et l'avancement dans son pilotage, sans notification.
6. **Ce qui est impossible.** Sans `events.write` sur la page d'administration : refus. Mais un appel direct au serveur par l'adresse réservée à la partenaire laisse passer un admin sans cette permission (revue critique). Preuve : `app/api/partner/events/[id]/cancel/route.ts:25-49`.
7. **Test et essai.** Test : `tests/parcours/admin-evenements.test.ts:577` « annuler : POST /api/admin/events/[id]/cancel exige le titre retapé (TITLE_MISMATCH), puis ANNULE journalisé (canal CANCELLATION) » ; `tests/parcours/cycle-annulation.test.ts:271` « PUBLIE → ANNULE (route partenaire, titre retapé avec des espaces) et VALIDE → ANNULE (route admin) ». Essai : aucun pour la voie admin.

### Étape 14.7 — Suivi des remboursements

1. **Qui, où, quel bouton.** Mariama, en tête de `/partner/events/{id}` ; Aïda, fiche admin. Bouton « Actualiser l’avancement des remboursements ». Preuve : `components/events/RefundProgress.tsx:43`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Section « Remboursements », « Avancement des remboursements des billets payés en ligne après l’annulation. ». Cartes : « Versés » ; « En cours » ; « En vérification » (« {n} remboursements : issue à confirmer auprès de l’opérateur ») ; pour l'admin seul : « À reprendre » (« {n} remboursements échoués ou bloqués, à reprendre ») ; si besoin : « Espèces à rembourser par l’organisateur ». Pas de mise à jour automatique. Preuve : `M/20261102000003_lot5_cycle.sql:761-824`, `components/events/RefundProgress.tsx:96-104`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Ceux de l'étape 14.5.

5. **Ce que les autres voient.** Mariama ne voit pas « À reprendre ».
6. **Ce qui est impossible.** Marquer un remboursement en espèces comme fait : aucun écran.
7. **Test et essai.** Test : `tests/parcours/cycle-annulation.test.ts:453` « avancement : versés, en cours, en vérification ; « à reprendre » pour l’admin seul ; espèces de l’organisateur » ; `tests/parcours/cycle-annulation.test.ts:511` « GET /api/partner/events/[id]/cancellation : 404 pour un client et pour le partenaire B ; 200 pour le propriétaire et l’admin ». Essai : Essais 45 et 46 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.11.

### Étape 14.8 — Échec d'un remboursement et relance

1. **Qui, où, quel bouton.** Aïda, ou Moussa avec `refunds.manage`, `/admin/finance`, section « Remboursements à reprendre », « Envois en échec, bloqués ou à l’issue incertaine, du plus ancien au plus récent. ». Bouton « Relancer », fenêtre « Relancer ce remboursement ? », « Le versement repart vers ce numéro dès votre confirmation. ». Preuve : `components/admin/RefundsToRetry.tsx:145`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Liste : envois en échec, bloqués, ou à issue incertaine, 100 lignes au plus. Motifs : « Opérateur du payeur inconnu », « Numéro du payeur inconnu », « Prénom ou nom du bénéficiaire manquant », « Solde du compte partenaire SamirPay insuffisant », « Opération créée en mode simulé : aucun versement ». États : « Envoi en échec », « Bloqué », « Issue incertaine ». Relance possible pour un échec ou un solde insuffisant. Résultats : « Relance envoyée », « Remboursement envoyé. » ; « Remboursement non relancé », « Remboursement non envoyé : {raison}. », exemple « Remboursement non envoyé : refusé par l'opérateur. » ; « Relance refusée » ; « Résultat inconnu », « La réponse du serveur n’est pas arrivée : le remboursement a pu partir. Relisez la liste avant de recommencer. ». **Un versement resté « à envoyer » sans motif de blocage n'apparaît pas dans cette liste.** Preuve : `app/api/admin/refunds/route.ts:9-11`, `:106-109`, `lib/payments/cashout.service.ts:281-283`, `:311`, `lib/events/event-cancellation.service.ts:186-222`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Au blocage ou à l'échec, les admins sont prévenus (étape 14.5), le client non.

5. **Ce que les autres voient.** Billet : reste « Remboursement en cours » tant qu'il n'y a pas de confirmation.
6. **Ce qui est impossible.** Relancer un envoi incertain : « Issue incertaine : vérifiez auprès de SamirPay avant toute nouvelle tentative (aucun renvoi automatique). ». Sans permission : « Reprise des remboursements réservée », « Votre compte n’a pas la permission de gérer les remboursements. ». Aucune action ne conclut un envoi incertain ; texte à l'écran : « À vérifier auprès de SamirPay avant toute décision : l’argent a pu partir. » ou « Aucune relance possible depuis cet écran. ». Preuve : `components/admin/RefundsToRetry.tsx:173-177`.
7. **Test et essai.** Test : `tests/parcours/admin-remboursements.test.ts:180` « sans session 401 ; client, partenaire, ADMIN sans la permission 403 ; SUSPENDU 403 ; avec la permission et SUPERADMIN 200 » ; `tests/parcours/admin-remboursements.test.ts:285` « refus de SamirPay : état ECHOUE, relance possible, titre de l’événement, numéro masqué » ; `tests/parcours/admin-remboursements.test.ts:296` « issue incertaine : état INCERTAIN, jamais de relance » ; `tests/parcours/admin-remboursements.test.ts:305` « solde insuffisant : état BLOQUE, relance possible, motif en français » ; `tests/parcours/admin-remboursements.test.ts:350` « le refund_id de la liste est celui de la relance : deuxième envoi, CONFIRME, la ligne quitte la liste » ; `tests/parcours/admin-remboursements.test.ts:367` « 100 lignes au plus : truncated vrai au-delà, faux une fois revenu sous le plafond » ; `tests/parcours/double-paiement.test.ts:365` « 9. refus de l’opérateur : ADMIN_REFUND_TO_RETRY à l’admin, la relance par la route aboutit » ; `e2e/recette.spec.ts:944` « acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus ». Essai : Essais 58 et 60 de `docs/recette-billetterie.md`, `docs/essai-local.md` section 8.11.

# Chapitre 15. Le remboursement d'un billet seul

**Il existe.** Depuis le pilotage, onglet « Ventes », section « Remboursement d’un billet ». Trois issues selon le billet : versement par Event Village, à rembourser par la partenaire, annulation sans argent. Le client ne peut pas demander lui-même un remboursement. Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:235`, `components/partner/pilotage/SalesTab.tsx:95-100`.

### Étape 15.1 — Retrouver le billet

1. **Qui, où, quel bouton.** Mariama, ou un admin, `/partner/events/{id}?tab=ventes`. Champ « Numéro du billet », bouton « Rechercher le billet ». Texte : « Retrouvez le billet par le numéro imprimé dessus. Rien n’est remboursé avant votre confirmation. ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:236`, `:242`, `:253`.
2. **Ce qu'il saisit.** Le numéro, exemple `TCK-20261101-XXXXXXXXXX`. Erreurs : « Saisissez le numéro du billet. » ; « Saisissez le numéro complet du billet. » ; « Billet introuvable pour cet événement. » ; « Recherche du billet impossible pour le moment. ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:165`, `:177`, `app/api/partner/events/[id]/tickets/lookup/route.ts:35`, `:80`.
3. **Ce que fait le système.** Lecture seule. Fiche : « Catégorie », « Porteur », « Vente », « État », « Prix », « Frais de service ». Billet non remboursable : « Ce billet n’est pas remboursable », « Seul un billet encore valable, dont le paiement est confirmé, peut être remboursé. ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:264-269`, `:288-289`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Client ou contrôleur : « Seul l’organisateur de l’événement ou un administrateur peut consulter ce billet. ». Autre partenaire : « Cet événement ne vous appartient pas. ». Aucun contrôle du statut de l'événement : le panneau marche aussi sur un événement terminé, suspendu ou annulé. Preuve : `app/api/partner/events/[id]/tickets/lookup/route.ts:71-75`, `:94`.
7. **Test et essai.** Test : `tests/parcours/pilotage-remboursement-billet.test.ts:138` « propriétaire et ADMIN 200 ; autre partenaire, contrôleur, client 403 ; sans session 401 » ; `tests/parcours/pilotage-remboursement-billet.test.ts:160` « partenaire SUSPENDU : 403 ACCOUNT_NOT_ACTIVE » ; `tests/parcours/pilotage-remboursement-billet.test.ts:170` « 404 TICKET_NOT_FOUND : numéro inconnu, autre événement du partenaire, billet d’autrui sur son propre événement » ; `tests/parcours/pilotage-remboursement-billet.test.ts:191` « billet payé en ligne : fiche exacte, mode CASHOUT, remboursable, rien de plus que le contrat » ; `tests/parcours/pilotage-remboursement-billet.test.ts:212` « billet payé en espèces : remboursé par l’organisateur, mode ORGANISATEUR » ; `tests/parcours/pilotage-remboursement-billet.test.ts:220` « billet gratuit : mode AUCUN, rien à verser » ; `tests/parcours/pilotage-remboursement-billet.test.ts:254` « billet utilisé par un vrai scan : la fiche dit non remboursable ». Essai : Essai 59 de `docs/recette-billetterie.md`, sans section dans `docs/essai-local.md`.

### Étape 15.2 — Billet payé en ligne

1. **Qui, où, quel bouton.** Fiche, bouton « Rembourser ce billet », fenêtre « Motif du remboursement », bouton « Continuer », puis « Confirmer le remboursement ? », bouton « Rembourser le client ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:62-66`, `:306-310`.
2. **Ce qu'il saisit.** Le motif, 3 à 500 caractères, aide « Au moins 3 caractères. Le motif est conservé avec cette opération. ». Erreurs : « Le motif doit contenir au moins 3 caractères. » ; « Le motif de remboursement est obligatoire (3 caractères au moins). ». Confirmation : « Event Village verse {montant} au client sur le compte qui a payé. Le billet ne donnera plus accès à l’événement. », exemple « Event Village verse 5 250 F CFA au client sur le compte qui a payé. Le billet ne donnera plus accès à l’événement. ». Preuve : `components/ui/ReasonDialog.tsx:65`, `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:47`.
3. **Ce que fait le système.** Billet « Remboursement en cours », place rendue, versement du prix et des frais du billet, vers le numéro qui a payé. Le compte de Mariama est débité du prix ; solde insuffisant : créance. Commission de parrainage annulée ou recalculée. Le QR devient invalide. Résultat : confirmé, « Remboursement versé », « {montant} ont été versés au client. », exemple « 5 250 F CFA ont été versés au client. » ; envoyé, « Remboursement envoyé », « {montant} sont en cours de versement. Le client sera prévenu dès la confirmation. », exemple « 5 250 F CFA sont en cours de versement. Le client sera prévenu dès la confirmation. » ; sinon, « Remboursement enregistré, versement en attente », « Les {montant} ne sont pas encore partis. L’équipe Event Village reprend ce versement. », exemple « Les 5 250 F CFA ne sont pas encore partis. L’équipe Event Village reprend ce versement. ». Preuve : `M/20261108000001_lot9_securite.sql:21-129`, `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:75-76`, `components/partner/pilotage/TicketRefundPanel.tsx:105-123`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, celle qui a payé | cloche | indispensable | prochain passage de la file, à la création du versement | titre « Remboursement demandé » ; modèle « Le remboursement de votre billet pour « {title} » ({amount}) est en cours. » ; exemple « Le remboursement de votre billet pour « Gala de la Teranga » (5 000 F CFA) est en cours. » |
| Fatou, celle qui a payé | SMS | indispensable | prochain passage de la file, à la confirmation | modèle « Event Village : remboursement de {amount} versé sur votre compte Wave ({title}). » ; exemple « Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave (Gala de la Teranga). » (94 caractères, 1 segment) |
| Fatou, celle qui a payé | cloche | indispensable | prochain passage de la file, à la confirmation | titre « Remboursement versé » ; modèle « {amount} vous ont été remboursés sur votre compte Wave pour « {title} ». » ; exemple « 5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ». » |
| Fatou, celle qui a payé | push | indispensable | prochain passage de la file, à la confirmation | titre « Remboursement versé » ; modèle « {amount} vous ont été remboursés sur votre compte Wave pour « {title} ». » ; exemple « 5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ». » |
| Fatou, celle qui a payé | email | indispensable | prochain passage de la file, à la confirmation | objet « Remboursement versé — Event Village » ; contenu cité intégralement à l’étape 7.11 |
| Aïda et les admins avec `refunds.manage`, si bloqué ou refusé | cloche | indispensable | prochain passage de la file | titre « Remboursement à reprendre » ; modèle « Un remboursement de {amount} est bloqué : opérateur du paiement inconnu. » ; exemple « Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu. » |
| Aïda et les admins avec `refunds.manage`, si bloqué ou refusé | push | indispensable | prochain passage de la file | titre « Remboursement à reprendre » ; modèle « Un remboursement de {amount} est bloqué : opérateur du paiement inconnu. » ; exemple « Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu. » |
| Aïda et les admins avec `refunds.manage`, si bloqué ou refusé | email | indispensable | prochain passage de la file | objet « Remboursement à reprendre — Event Village » ; contenu cité intégralement à l’étape 7.12 |
| Aïda et les admins avec `refunds.manage`, si incertain | cloche | indispensable | prochain passage de la file | titre « Versement incertain » ; modèle « L'issue d'un versement de {amount} est incertaine : vérifiez-le avant toute action. » ; exemple « L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action. » |
| Aïda et les admins avec `refunds.manage`, si incertain | push | indispensable | prochain passage de la file | titre « Versement incertain » ; modèle « L'issue d'un versement de {amount} est incertaine : vérifiez-le avant toute action. » ; exemple « L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action. » |
| Aïda et les admins avec `refunds.manage`, si incertain | email | indispensable | prochain passage de la file | objet « Versement incertain — Event Village » ; contenu cité intégralement à l’étape 14.5 |
| Aïda et les admins avec `payments.read`, si créance | cloche | indispensable | prochain passage de la file | titre « Créance sur un compte » ; modèle « Un débit de {amount} sur le compte organisateur dépasse le solde disponible : une créance de {debt} sera compensée sur les gains futurs. » ; exemple « Un débit de 5 000 F CFA sur le compte organisateur dépasse le solde disponible : une créance de 3 000 F CFA sera compensée sur les gains futurs. » |
| Aïda et les admins avec `payments.read`, si créance | email | indispensable | prochain passage de la file | objet « Créance sur un compte — Event Village » ; contenu cité intégralement à l’étape 14.3 |

Rien à Fatou en cas d'échec ou de blocage. Rien à Mariama. Preuve : `REFUND_REQUESTED` (`M/20261103000006_lot6_pros_admin.sql:372`) ; `REFUND_PAID` (`M/20261103000006_lot6_pros_admin.sql:410`) ; `ADMIN_REFUND_TO_RETRY` (`M/20261103000006_lot6_pros_admin.sql:384`) ; `ADMIN_CASHOUT_UNCERTAIN` (`M/20261103000006_lot6_pros_admin.sql:491`) ; `ADMIN_FINANCE_DEBT` (`M/20261103000006_lot6_pros_admin.sql:526`).

5. **Ce que les autres voient.** Fatou, carte : « Remboursement en cours », puis « Remboursé », onglet Historique. Mariama : chiffres de l'onglet Ventes relus, « Remboursé » du rapport, écriture « Remboursement d’un billet » sur `/partner/finance`. Aïda : `/admin/finance`. Contrôleur : « Billet remboursé » au scan. Preuve : `app/partner/finance/page.tsx:214`, `app/tickets/page.tsx:228`.
6. **Ce qui est impossible.** Billet utilisé ou déjà annulé : « Ce billet ne peut plus être remboursé. », écran « Remboursement refusé », « Ce billet n’est plus remboursable : son état a changé depuis la recherche. ». « Le paiement de ce billet ne peut pas être remboursé. » ; « Ce paiement est déjà entièrement remboursé. ». Second appel : « Remboursement déjà enregistré », « Aucune nouvelle opération : ce remboursement de {montant} avait déjà été demandé. », exemple « Aucune nouvelle opération : ce remboursement de 5 250 F CFA avait déjà été demandé. ». Réseau : « Remboursement non confirmé », « Réseau indisponible : le remboursement n’est pas confirmé. Réessayez, il ne sera pas compté deux fois. ». Annuler un remboursement lancé : rien ne le permet. Preuve : `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:20`, `components/partner/pilotage/TicketRefundPanel.tsx:93-95`, `:108`, `:211`, `:224`, `:328`.
7. **Test et essai.** Test : `tests/parcours/finance-remboursement-billet.test.ts:155` « panier de 3 : remboursement d’un billet (cashout REFUND-TKT, EN_COURS → REMBOURSE, PARTIAL), puis des deux autres (REFUNDED), débit au grand livre » ; `tests/parcours/finance-remboursement-billet.test.ts:129` « CONTROLEUR 403, partenaire étranger refusé, billet d’un autre événement 404, ADMIN accepté » ; `tests/parcours/pilotage-remboursement-billet.test.ts:235` « id accepté par la route, prix + frais = montant remboursé, billet ensuite non remboursable » ; `tests/parcours/pilotage-remboursement-billet.test.ts:266` « A36 : refus du remboursement d’un billet utilisé, sans statut technique dans la réponse » ; `tests/parcours/commissions-plafond.test.ts:226` « 5. panier 10 000 + 100 F, remboursement du gros billet, net effectif −154,08 F : commissions annulées, soldes à 0 » ; `tests/parcours/commissions-plafond.test.ts:308` « 8. relation à 80/30, 2 billets de 1 000 F, un remboursé : budget 18,50 F, N1 coupée avec sa trace, N2 annulée » ; `tests/parcours/finance-commissions.test.ts:346` « remboursement total du billet : commissions EN ATTENTE et DISPONIBLE annulées avec motif, lignes conservées, débit PARRAINAGE ». Essai : Essais 59 et 58 de `docs/recette-billetterie.md`.

### Étape 15.3 — Billet payé en espèces

1. **Qui, où, quel bouton.** Comme à l'étape 15.2. Confirmation « Confirmer le remboursement ? », bouton « Annuler le billet et rembourser ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:72`.
2. **Ce qu'il saisit.** Le motif. Texte : « Billet payé hors plateforme : Event Village ne verse rien, vous remettez vous-même {montant} au client. Le billet sera annulé. », exemple « Billet payé hors plateforme : Event Village ne verse rien, vous remettez vous-même 5 000 F CFA au client. Le billet sera annulé. ». Montant : le prix seul. Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:73`, `:101`.
3. **Ce que fait le système.** Billet « Annulé », place rendue, une ligne de remboursement à la charge de Mariama, qui ne se clôt jamais. Le total de la caisse ne bouge pas. Résultat : « Billet annulé, à vous de rembourser », « Remettez {montant} au client : Event Village ne verse rien pour ce billet. », exemple « Remettez 5 000 F CFA au client : Event Village ne verse rien pour ce billet. ». Depuis le retrait des billets à régler sur place, aucun parcours actuel ne crée ce cas : un billet vendu au guichet est déjà « Utilisé », donc non remboursable ici. L'existence de tels billets dans les données d'event-village-dev est NON VÉRIFIÉ, la base distante n'ayant pas été consultée. Preuve : `M/20261108000001_lot9_securite.sql:21-129`, `M/20261106000001_lot8_canaux.sql:436-443`, `components/partner/pilotage/TicketRefundPanel.tsx:114`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Détenteur avec compte : « Annulé », sans avis. Scan : « Billet annulé ».
6. **Ce qui est impossible.** Comme à l'étape 15.2. Marquer « remis au client » : aucun écran.
7. **Test et essai.** Test : `tests/parcours/finance-remboursement-billet.test.ts:231` « paiement hors plateforme : aucun cashout, remboursement à la charge de l’organisateur, billet ANNULE » ; `tests/parcours/pilotage-remboursement-billet.test.ts:212` « billet payé en espèces : remboursé par l’organisateur, mode ORGANISATEUR ». Essai : aucun.

### Étape 15.4 — Billet gratuit ou invitation

1. **Qui, où, quel bouton.** Comme à l'étape 15.2. Bouton « Annuler ce billet gratuit », « Motif de l’annulation », « Annuler ce billet gratuit ? », bouton « Annuler le billet ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:76-79`.
2. **Ce qu'il saisit.** Le motif, demandé mais non conservé. Texte : « Billet gratuit : rien n’est versé. Le billet sera annulé et ne donnera plus accès à l’événement. ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:80`.
3. **Ce que fait le système.** Billet « Annulé », place rendue. Résultat : « Billet annulé », « Rien n’a été versé : ce billet gratuit ne donne plus accès à l’événement. ». Preuve : `components/partner/pilotage/TicketRefundPanel.tsx:111`, `M/20261108000001_lot9_securite.sql:70`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message, à personne.

5. **Ce que les autres voient.** Détenteur : « Annulé ». Il l'apprend à l'écran ou à l'entrée.
6. **Ce qui est impossible.** Comme à l'étape 15.2.
7. **Test et essai.** Test : `tests/parcours/pilotage-remboursement-billet.test.ts:220` « billet gratuit : mode AUCUN, rien à verser ». Essai : aucun.

### Étape 15.5 — Billet transféré, ou en cours de transfert

1. **Qui, où, quel bouton.** Comme à l'étape 15.2. Lamine apparaît comme « Porteur » ; l'écran dit seulement « le compte qui a payé ».
2. **Ce qu'il saisit.** Le motif.
3. **Ce que fait le système.** Billet déjà accepté par Lamine : le versement va à Fatou, qui a payé. Transfert encore en attente : le remboursement est accepté, le transfert reste en attente et reste dans « Reçus ». Preuve : `M/20261108000001_lot9_securite.sql:21-129`, `M/20261105000003_lot7_securite.sql:391`, `M/20261108000002_lot9_invitations.sql:206`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Fatou, déjà remboursée, à l'expiration du transfert | cloche | indispensable | passage horaire de l'expiration, puis prochain passage de la file | titre « Transfert expiré » ; modèle « Votre billet pour « {title} » n'a pas été accepté à temps : il reste dans vos billets. » ; exemple « Votre billet pour « Gala de la Teranga » n'a pas été accepté à temps : il reste dans vos billets. » |
| Fatou, déjà remboursée, à l'expiration du transfert | push | indispensable | passage horaire de l'expiration, puis prochain passage de la file | titre « Transfert expiré » ; modèle « Votre billet pour « {title} » n'a pas été accepté à temps : il reste dans vos billets. » ; exemple « Votre billet pour « Gala de la Teranga » n'a pas été accepté à temps : il reste dans vos billets. » |

Fatou reçoit aussi les messages de remboursement de l'étape 15.2. Lamine ne reçoit rien. Preuve : `TRANSFER_EXPIRED` (`M/20261103000005_lot6_billetterie.sql:281`, `supabase/ops/schedule-crons.sql:103`).

5. **Ce que les autres voient.** Lamine perd son billet (« Remboursement en cours ») sans message.
6. **Ce qui est impossible.** Lamine accepte le transfert : « Ce billet n'est plus transférable. ».
7. **Test et essai.** Test : aucun de ce croisement. Essai : aucun.

# Chapitre 16. La fin de l'événement

### Étape 16.1 — Passage automatique à « Terminé »

1. **Qui, où, quel bouton.** Personne. La tâche de fin tourne toutes les 15 minutes, aux minutes 3, 18, 33, 48. Preuve : `supabase/ops/schedule-crons.sql:101`, `app/api/cron/events-finish/route.ts:18`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Un événement « Publié » dont la fin est passée devient « Terminé ». Fin : date et heure de fin ; sans heure, 23:59 ; sans date de fin, 23:59 le jour du début. Exemple : samedi 20:00 sans fin saisie, « Terminé » vers dimanche 00:03. Rappels et avis de changement en attente sont annulés. Un événement « Suspendu », « Validé », « En attente de validation » ou « Brouillon » ne passe jamais à « Terminé ». Public : la fiche reste en archive, « Événement terminé », « Cet événement a eu lieu. La billetterie est fermée. », absent d'Explorer, de l'accueil et de Populaires. Preuve : `M/20261102000003_lot5_cycle.sql:828-854`, `:149`, `M/20261103000004_lot6_rappels.sql:215-237`, `app/api/events/[id]/route.ts:23-26`, `lib/events/popular.service.ts:30`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message, à personne. Preuve : `M/20261103000005_lot6_billetterie.sql:1320`.

5. **Ce que les autres voient.** Mariama : pastille « Terminé », indicateur « En direct » masqué. Aïda : onglet « Terminé » de `/admin/events`. Fatou : étape 16.6. Preuve : `app/partner/events/[id]/page.tsx:58`, `:173`, `app/admin/events/page.tsx:40`.
6. **Ce qui est impossible.** Modifier : « Un événement terminé ou annulé ne peut plus être modifié. ». Annuler : aucune transition. Vendre : « Cet événement est terminé. ». Transférer : « Cet événement n'accepte plus les transferts de billets. ». Un paiement confirmé après coup est remboursé. La planification réelle de la tâche sur event-village-dev est NON VÉRIFIÉ : aucune lecture du projet distant. Preuve : `lib/events/event.service.ts:232`, `M/20261106000003_lot8_paiement.sql:156`.
7. **Test et essai.** Test : `tests/parcours/cycle-cron.test.ts:163` « refusée sans CRON_SECRET ou avec un faux secret (GET et POST), sans aucun effet » ; `tests/parcours/cycle-cron.test.ts:176` « PUBLIE dont la fin est passée → TERMINE, journalisé (SYSTEM, CRON) ; second passage sans effet ; ids rendus par la RPC » ; `tests/parcours/cycle-cron.test.ts:199` « sans fin, commencé la veille → TERMINE ; sans fin, commencé aujourd’hui → reste PUBLIE jusqu’à 23:59 » ; `tests/parcours/cycle-cron.test.ts:220` « le cron ne touche ni un PUBLIE à venir, ni un SUSPENDU passé » ; `tests/parcours/cycle-cron.test.ts:233` « event_end_at unique : fin renseignée à Dakar, sinon début à 23:59 ; fin_event_end et scan_window la reprennent » ; `tests/parcours/cycle-cron.test.ts:254` « même règle que ticket_sale_problems : un événement sans fin reste en vente jusqu’à 23:59 si la fin de vente le permet » ; `tests/parcours/notif-rappels-annulation.test.ts:337` « fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER PENDING → CANCELLED EVENT_TERMINE, EVENT_CHANGED → NO_LONGER_RELEVANT » ; `tests/parcours/cycle-visibilite.test.ts:194` « TERMINE : 200 en archive, bandeau, purchasable false ». Essai : aucun.

### Étape 16.2 — Passage manuel par l'admin

1. **Qui, où, quel bouton.** Aïda ou Moussa avec `events.write`, `/admin/events/{id}`, bouton « Terminer ». Fenêtre « Terminer l’événement ? », « La vente est close. Le contrôle des entrées reste possible jusqu’à la fermeture de la fenêtre de scan. ». Preuve : `app/admin/events/[id]/page.tsx:217-218`.
2. **Ce qu'il saisit.** Aucun, pas de motif.
3. **Ce que fait le système.** Mêmes effets qu'à l'étape 16.1. Message « Événement terminé. ». Preuve : `M/20261103000005_lot6_billetterie.sql:942-1054`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Comme à l'étape 16.1.
6. **Ce qui est impossible.** Mariama : « Votre rôle ne permet pas de passer cet événement de « Publié » à « Terminé ». ». Avant le début : « Un événement qui n'a pas commencé ne se termine pas : suspendez-le ou annulez-le. », bouton pourtant affiché. Autre statut : « Un événement « Suspendu » ne peut pas passer à « Terminé ». ». Sans permission : « Permission manquante : events.write ». Preuve : `M/20261103000005_lot6_billetterie.sql:1039-1042`.
7. **Test et essai.** Test : `tests/parcours/cycle-transitions.test.ts:287` « chaque transition permise au bon rôle passe et écrit sa ligne (acteur, ancien, nouveau, motif, canal) » ; `tests/parcours/cycle-transitions.test.ts:413` « transitions hors table de l’ancienne matrice refusées à l’admin : VALIDE → SUSPENDU, * → TERMINE, BROUILLON → EN_ATTENTE ou VALIDE » ; `tests/parcours/cycle-transitions.test.ts:463` « TERMINE manuel avant le début → EVENT_NOT_STARTED ». Essai : aucun.

### Étape 16.3 — Fin du scan

1. **Qui, où, quel bouton.** Ibrahima, `/controller/scanner`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Le serveur accepte un événement « Publié » ou « Terminé » jusqu'à la fin + 6 heures. Exemple sans fin saisie : fermeture dimanche 05:59. Au-delà : « Événement terminé ». La caisse peut s'ouvrir dans la même fenêtre. Les billets non scannés restent « Valable » sans limite : ce sont les « Absents ». L'écran du scanner se ferme plus tôt (étape 10.1). Preuve : `M/20261102000003_lot5_cycle.sql:857-868`, `:871-892`, `lib/scan/scan-result.ts:52`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Scanner après la fermeture. Ouvrir une caisse : « Cet événement est terminé. ». Preuve : `lib/shifts/shift.service.ts:213`.
7. **Test et essai.** Test : `tests/parcours/cycle-cron.test.ts:283` « scan accepté en TERMINE dans la fenêtre (fin + access.scan_window_after_hours), refusé après » ; `tests/parcours/cycle-cron.test.ts:309` « ouverture de caisse en TERMINE dans la fenêtre, refusée après » ; `tests/parcours/acces-fenetre.test.ts:105` « fin + 6 h dépassée → event_ended » ; `tests/parcours/acces-fenetre.test.ts:116` « ANNULE → event_cancelled ; SUSPENDU → event_suspended ; TERMINE → event_ended » ; `tests/parcours/acces-fenetre.test.ts:132` « access.scan_window_after_hours : un événement fini il y a 3 h se ferme avec 2 h, reste ouvert avec 6 h ». Essai : aucun pour la fin de fenêtre.

### Étape 16.4 — Rapport de clôture

1. **Qui, où, quel bouton.** Deux écrans sans lien. (a) Mariama, Aïda ou un admin, `/partner/events/{id}?tab=cloture`, section « Rapport de clôture », « Bilan complet de l’événement. ». (b) Mariama, `/partner/dashboard`, ligne de l'événement, colonne « Rapports » : bouton « Clôture », icônes « Rapport PDF » et « Export CSV ». Preuve : `components/partner/pilotage/ClosingTab.tsx:175`, `app/partner/dashboard/page.tsx:203-222`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Onglet : « Montant net organisateur », « Disponibilité des fonds », « Absents » ; « Billets vendus (hors invitations) », « Invitations », « Capacité mise en vente », « Entrées (dont guichet) », « Refus au contrôle », « Recettes en ligne », « Recettes en espèces », « Remboursé », « Frais de service payés par les acheteurs », « Déjà disponible / en attente ». Avant la fin : « La liste nominative est disponible après la fin de l’événement ; le nombre est tenu à jour en direct. », « {n} billets valides pas encore compostés. », exemple « 12 billets valides pas encore compostés. ». Fenêtre du tableau de bord : « Billets vendus », « Entrées validées », « Paiements confirmés », « Net à reverser », bouton « Télécharger le PDF », intitulé « Rapport de clôture ». Preuve : `components/partner/pilotage/ClosingTab.tsx:208`, `:220`, `lib/partner/partner-dashboard.service.ts:918`, `M/20261102000005_lot5_pilotage.sql:789-893`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Pas d'avis « votre rapport est prêt ».

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Autre partenaire : « Accès refusé. Cet événement appartient à un autre partenaire. ». Admin sans profil partenaire : « Profil partenaire introuvable. ». Arrêter officiellement une clôture : le rapport n'est qu'une lecture. Preuve : `app/api/partner/reports/closing/route.ts:36`.
7. **Test et essai.** Test : `tests/parcours/pilotage-cloture-export.test.ts:179` « absents : nombre en direct (billets VALIDE), aucune liste nominative avant la fin » ; `tests/parcours/pilotage-cloture-export.test.ts:191` « Z de caisse de S1 : déclaré hors fonds, attendu, écart, détail SCAN / GUICHET et par catégorie » ; `tests/parcours/pilotage-cloture-export.test.ts:215` « montant net et plage de disponibilité des fonds (min et max des crédits VENTE de l’événement) » ; `tests/parcours/pilotage-cloture-export.test.ts:341` « après la fin : liste nominative des absents (nom, catégorie), même nombre ; fonds inchangés » ; `tests/parcours/finance-rapports.test.ts:106` « rapport de clôture : net = faciaux des billets restants en ligne, frais acheteur informatifs, espèces séparées ». Essai : Essai 41 de `docs/recette-billetterie.md`.

### Étape 16.5 — Exports après la fin

1. **Qui, où, quel bouton.** Onglet Clôture, bouton « Exporter les participants » (détail à l'étape 12.6). Tableau de bord, icône « Export CSV ».
2. **Ce qu'il saisit.** Comme à l'étape 12.6.
3. **Ce que fait le système.** Les mêmes colonnes et règles qu'à l'étape 12.6. L'export comptable CSV est un second fichier ; le contenu détaillé de ses colonnes est NON VÉRIFIÉ, cette partie du code n'ayant pas été lue ligne à ligne. Preuve : `M/20261108000002_lot9_invitations.sql:268-338`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Les messages d'erreur sont ceux de l'étape 12.6. L'export reste ouvert après la fin, sans limite.
7. **Test et essai.** Test : `tests/parcours/pilotage-cloture-export.test.ts:230` « sans contacts : CSV UTF-8 avec BOM, en-têtes français, nom / catégorie / statut (libellé) / heure d’entrée, sans paiement, numéro, téléphone ni email » ; `tests/parcours/pilotage-cloture-export.test.ts:279` « contacts sans finalité, ou finalité hors de la liste fermée : 400 PURPOSE_REQUIRED, aucun fichier » ; `tests/parcours/pilotage-cloture-export.test.ts:293` « contacts avec une finalité de la liste fermée : téléphone et email ajoutés, toujours sans donnée de paiement » ; `tests/parcours/pilotage-cloture-export.test.ts:312` « chaque export journalisé : acteur, contacts, finalité, nombre de lignes, sans donnée de participant ; l’admin aussi ». Essai : Essai 40 de `docs/recette-billetterie.md`.

### Étape 16.6 — Ce que voit le client

1. **Qui, où, quel bouton.** Fatou, `/tickets`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Dès la fin, le billet passe à l'onglet « Historique ». Billet utilisé : « Utilisé ». Billet jamais scanné : **reste « Valable »**, le QR continue de tourner, « Transférer » reste affiché. Preuve : `app/api/tickets/route.ts:126`, `app/tickets/page.tsx:78`, `TicketCard.tsx:133`, `:625`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Transférer : refus au clic, étape 16.1.
7. **Test et essai.** Test : `tests/parcours/cycle-visibilite.test.ts:194` « TERMINE : 200 en archive, bandeau, purchasable false » pour la fiche, aucun pour le billet. Essai : aucun.

### Étape 16.7 — Finance de la partenaire

1. **Qui, où, quel bouton.** Mariama, `/partner/finance`, titre « Finances », « Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde. ». Preuve : `app/partner/finance/page.tsx:454-455`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Une vente est créditée à la confirmation du paiement, disponible à la fin de l'événement + 48 heures. Le passage à « Terminé » n'y change rien : seule compte l'heure. Le statut « Suspendu » non plus. Blocs : « Disponible au retrait », « En attente » (« Prochaine disponibilité : {date}. », exemple « Prochaine disponibilité : 16 novembre 2026. »), « Retraits en cours », « À compenser ». « Mes retraits », 20 derniers ; « Historique du compte », 50 dernières écritures. Preuve : `M/20261101000004_lot3_grand_livre.sql:107-132`, `M/20261101000002_lot3_reglages.sql:67-68`, `M/20261108000001_lot9_securite.sql:425-426`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message quand les fonds deviennent disponibles.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Un contrôleur : refusé.
7. **Test et essai.** Test : `tests/parcours/finance-retraits.test.ts:215` « solde organisateur : prix faciaux des billets payés en ligne seulement ; vente espèces et invitation n’ajoutent rien » ; `tests/parcours/finance-retraits.test.ts:242` « fonds en attente jusqu’à la fin de l’événement + 48 h ; disponibles dès la confirmation si payout_hold_enabled = false (non rétroactif) » ; `tests/parcours/finance-retraits.test.ts:269` « date de fin absente : date de début à 23:59 (Africa/Dakar) + 48 h » ; `tests/parcours/finance-retraits.test.ts:522` « GET /api/finance/balance : disponible, en attente, retraits en cours et historique ; 401 sans session » ; `tests/parcours/finance-rapports.test.ts:116` « finance partenaire : même net billetterie, mêmes lignes informatives ». Essai : Essais 42 et 56 de `docs/recette-billetterie.md`.

### Étape 16.8 — Retrait : demander le code

1. **Qui, où, quel bouton.** Mariama, `/partner/finance`, section « Demander un retrait », bouton « Recevoir le code de confirmation ». Même parcours pour Fatou sur `/wallet`. Si rien n'est disponible : « Aucun montant disponible au retrait ». Preuve : `app/partner/finance/page.tsx:536`, `:667`.
2. **Ce qu'il saisit.** « Recevoir sur », Wave ou Orange Money. « Numéro {opérateur} qui reçoit le retrait », exemple « Numéro Wave qui reçoit le retrait », prérempli et **modifiable**, aide « Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte. ». « Montant à retirer (F CFA) », aide « Disponible : {montant}. Frais calculés à la demande et déduits du montant versé. », exemple « Disponible : 25 000 F CFA. Frais calculés à la demande et déduits du montant versé. ». Erreurs : « Choisissez Wave ou Orange Money. » ; « Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78. » ; « Indiquez un montant entier en francs CFA. » ; « Le montant dépasse votre solde disponible au retrait ({montant}). », exemple « Le montant dépasse votre solde disponible au retrait (25 000 F CFA). ». Le minimum n'est pas contrôlé à cette étape. Preuve : `app/partner/finance/page.tsx:353-357`.
3. **Ce que fait le système.** Un code à 6 chiffres, valable 10 minutes, envoyé au numéro du compte, jamais au numéro saisi. Preuve : `app/api/withdrawals/otp/route.ts:39-53`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama, numéro du compte | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |

Message à l'écran : « Code de confirmation envoyé par SMS. ». Le SMS ne dit pas qu'il s'agit d'un retrait. Preuve : `OTP_WITHDRAWAL`, `app/api/withdrawals/otp/route.ts:53`.

5. **Ce que les autres voient.** Une ligne sans le code dans la supervision.
6. **Ce qui est impossible.** « Compte organisateur réservé aux partenaires. » ; « Aucun numéro de téléphone sur votre compte. » ; « Impossible d’envoyer le code par SMS. Réessayez. » ; « Impossible de préparer le code de confirmation. Réessayez. ».
7. **Test et essai.** Test : `tests/parcours/finance-retraits.test.ts:468` « compte SUSPENDU : retrait, code de retrait et solde refusés (ACCOUNT_NOT_ACTIVE) ». Essai : Essai 42 de `docs/recette-billetterie.md`.

### Étape 16.9 — Retrait : confirmer

1. **Qui, où, quel bouton.** Étape « Code SMS ». Récapitulatif « Montant demandé », « Vers », « Frais de retrait » : « Calculés à la confirmation ». Boutons « Confirmer le retrait », « Renvoyer un code », « Modifier la demande ». Preuve : `app/partner/finance/page.tsx:693-694`.
2. **Ce qu'il saisit.** Le code. Erreurs : « Saisissez le code à 6 chiffres reçu par SMS. », et celles de l'étape 1.2.
3. **Ce que fait le système.** Code consommé, puis sous verrou : minimum 5 000 F, montant inférieur ou égal au disponible, frais 1 % au franc supérieur, débit immédiat du montant brut, retrait « en cours », versement du net. Exemple : 6 000 F demandés, 60 F de frais, 5 940 F versés. Preuve : `M/20261101000014_lot4_correctif_retraits_concurrents.sql:12-137`, `M/20261101000002_lot3_reglages.sql:66-72`, `lib/env.ts:90`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun à la demande. Voir l'étape 16.10.

5. **Ce que les autres voient.** « Retraits en cours » augmente, « Disponible au retrait » baisse.
6. **Ce qui est impossible.** « Montant minimum de retrait : 5000 F. », renvoi à l'étape de demande, le code déjà consommé ; le rendu exact de ce montant est NON VÉRIFIÉ, déduit du code sans exécution. « Solde disponible insuffisant. » ; « Montant entier en FCFA attendu. » ; « Montant trop faible après frais. » ; « Aucun compte organisateur validé. » ; « Compte inactif. » ; « Les retraits par virement bancaire ne sont pas ouverts. » ; « Trop de demandes de retrait. Réessayez dans {n} min. », exemple « Trop de demandes de retrait. Réessayez dans 12 min. ». « Retrait impossible », « Connexion interrompue : la demande n’a peut-être pas abouti. Réessayez, elle ne sera pas dupliquée. ». Annuler un retrait lancé : aucun bouton.
7. **Test et essai.** Test : `tests/parcours/finance-retraits.test.ts:285` « deux retraits simultanés qui dépassent ensemble le solde : un seul accepté » ; `tests/parcours/finance-retraits.test.ts:301` « montants et comptes refusés : BELOW_MINIMUM (seuil 5 000 F), INVALID_AMOUNT, INSUFFICIENT_BALANCE, NOT_PARTNER » ; `tests/parcours/finance-retraits.test.ts:316` « virement bancaire refusé tant que finance.withdrawal_bank_enabled est désactivé (BANK_DISABLED) » ; `tests/parcours/finance-retraits.test.ts:325` « frais de 1 % arrondis au FCFA supérieur ; cashout WITHDRAWAL-<id> au montant net, vers le numéro déclaré » ; `tests/parcours/finance-retraits.test.ts:492` « Idempotency-Key : même clé → même retrait, un seul cashout, un seul envoi ; RPC : DUPLICATE avant le contrôle du solde ». Essai : Essais 42 et 43 de `docs/recette-billetterie.md`.

### Étape 16.10 — Retrait : les issues

1. **Qui, où, quel bouton.** Résultat à l'écran, puis « Mes retraits ». Preuve : `app/partner/finance/page.tsx:746-756`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Confirmé : « Retrait versé », « Le montant net a été envoyé sur votre compte Mobile Money. », badge « Versé ». Refusé : montant rendu, « Retrait refusé par l’opérateur », « Le montant a été rendu à votre solde disponible. Vérifiez le numéro puis refaites une demande. », badge « Refusé, montant rendu », « Motif : refusé par SamirPay (REJECTED) ». Envoyé, incertain ou bloqué : « Retrait en cours de traitement », « Le montant reste réservé jusqu’à la confirmation de l’opérateur. Il ne sera jamais versé deux fois ; suivez son état dans « Mes retraits ». », badge « En cours d’envoi ». Preuve : `app/partner/finance/page.tsx:816`, `lib/payments/cashout.service.ts:254`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Mariama, à la confirmation | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre retrait de {amount} a été versé sur votre compte Wave. » ; exemple « Event Village : votre retrait de 25 000 F CFA a été versé sur votre compte Wave. » (80 caractères, 1 segment) |
| Mariama, à la confirmation | cloche | indispensable | prochain passage de la file | titre « Retrait versé » ; modèle « Votre retrait de {amount} a été versé sur votre compte Wave. » ; exemple « Votre retrait de 25 000 F CFA a été versé sur votre compte Wave. » |
| Mariama, à la confirmation | push | indispensable | prochain passage de la file | titre « Retrait versé » ; modèle « Votre retrait de {amount} a été versé sur votre compte Wave. » ; exemple « Votre retrait de 25 000 F CFA a été versé sur votre compte Wave. » |
| Mariama, à la confirmation | email | indispensable | prochain passage de la file | objet « Retrait versé — Event Village » ; modèle : Retrait versé<br>Votre retrait de {amount} a été versé sur votre compte Wave.<br>Ouvrir Event Village : {APP_URL}/partner/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Retrait versé<br>Votre retrait de 25 000 F CFA a été versé sur votre compte Wave.<br>Ouvrir Event Village : https://eventvillage.sn/partner/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Mariama, au refus | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre retrait de {amount} a été refusé par l'opérateur. Le montant est revenu sur votre solde. » ; exemple « Event Village : votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde. » (114 caractères, 1 segment) |
| Mariama, au refus | cloche | indispensable | prochain passage de la file | titre « Retrait refusé » ; modèle « Votre retrait de {amount} a été refusé par l'opérateur. Le montant est revenu sur votre solde. » ; exemple « Votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde. » |
| Mariama, au refus | push | indispensable | prochain passage de la file | titre « Retrait refusé » ; modèle « Votre retrait de {amount} a été refusé par l'opérateur. Le montant est revenu sur votre solde. » ; exemple « Votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde. » |
| Mariama, au refus | email | indispensable | prochain passage de la file | objet « Retrait refusé — Event Village » ; modèle : Retrait refusé<br>Votre retrait de {amount} a été refusé par l'opérateur. Le montant est revenu sur votre solde.<br>Ouvrir Event Village : {APP_URL}/partner/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Retrait refusé<br>Votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde.<br>Ouvrir Event Village : https://eventvillage.sn/partner/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Mariama, si incertain | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre retrait de {amount} est en vérification auprès de l'opérateur. Aucune action de votre part. » ; exemple « Event Village : votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action de votre part. » (117 caractères, 1 segment) |
| Mariama, si incertain | cloche | indispensable | prochain passage de la file | titre « Retrait en vérification » ; modèle « Votre retrait de {amount} est en vérification auprès de l'opérateur. Aucune action n'est nécessaire. » ; exemple « Votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action n'est nécessaire. » |
| Mariama, si incertain | push | indispensable | prochain passage de la file | titre « Retrait en vérification » ; modèle « Votre retrait de {amount} est en vérification auprès de l'opérateur. Aucune action n'est nécessaire. » ; exemple « Votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action n'est nécessaire. » |
| Aïda et les admins avec `refunds.manage`, au refus | cloche | indispensable | prochain passage de la file | titre « Retrait refusé par l'opérateur » ; modèle « Le retrait de {amount} a été refusé ; le montant est revenu sur le solde du bénéficiaire. » ; exemple « Le retrait de 25 000 F CFA a été refusé ; le montant est revenu sur le solde du bénéficiaire. » |
| Aïda et les admins avec `refunds.manage`, au refus | email | indispensable | prochain passage de la file | objet « Retrait refusé par l'opérateur — Event Village » ; modèle : Retrait refusé par l'opérateur<br>Le retrait de {amount} a été refusé ; le montant est revenu sur le solde du bénéficiaire.<br>Ouvrir Event Village : {APP_URL}/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Retrait refusé par l'opérateur<br>Le retrait de 25 000 F CFA a été refusé ; le montant est revenu sur le solde du bénéficiaire.<br>Ouvrir Event Village : https://eventvillage.sn/admin/finance<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Aïda et les admins avec `refunds.manage`, si incertain | cloche | indispensable | prochain passage de la file | titre « Versement incertain » ; modèle « L'issue d'un versement de {amount} est incertaine : vérifiez-le avant toute action. » ; exemple « L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action. » |
| Aïda et les admins avec `refunds.manage`, si incertain | push | indispensable | prochain passage de la file | titre « Versement incertain » ; modèle « L'issue d'un versement de {amount} est incertaine : vérifiez-le avant toute action. » ; exemple « L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action. » |
| Aïda et les admins avec `refunds.manage`, si incertain | email | indispensable | prochain passage de la file | objet « Versement incertain — Event Village » ; contenu cité intégralement à l’étape 14.5 |

Retrait bloqué (solde SamirPay insuffisant, nom manquant) : aucun message, ni à Mariama ni aux admins. Preuve : `WITHDRAWAL_PAID` (`M/20261103000006_lot6_pros_admin.sql:437`) ; `WITHDRAWAL_REJECTED` (`M/20261103000006_lot6_pros_admin.sql:466`) ; `WITHDRAWAL_UNCERTAIN` (`M/20261103000006_lot6_pros_admin.sql:483`) ; `ADMIN_WITHDRAWAL_REJECTED` (`M/20261103000006_lot6_pros_admin.sql:474`) ; `ADMIN_CASHOUT_UNCERTAIN` (`M/20261103000006_lot6_pros_admin.sql:491`). Preuve : `M/20261103000006_lot6_pros_admin.sql:382`.

5. **Ce que les autres voient.** Aïda : total « Retraits versés » sur `/admin/finance`. Aucun détail des retraits, aucune action.
6. **Ce qui est impossible.** Relancer un retrait, ou conclure un retrait incertain : aucun moyen. Preuve : `app/api/admin/refunds/route.ts:9`.
7. **Test et essai.** Test : `tests/parcours/finance-retraits.test.ts:325` « frais de 1 % arrondis au FCFA supérieur ; cashout WITHDRAWAL-<id> au montant net, vers le numéro déclaré » ; `tests/parcours/finance-retraits.test.ts:369` « délai dépassé après envoi : cashout INCERTAIN, aucun second envoi, retrait non REJECTED, solde toujours réservé » ; `tests/parcours/finance-retraits.test.ts:400` « refus explicite de SamirPay : retrait REJECTED, écriture RETRAIT_ANNULE, solde rendu » ; `tests/parcours/notif-pros.test.ts:544` « retrait versé : WITHDRAWAL_PAID (quatre canaux), SMS exact au montant du cashout » ; `tests/parcours/notif-admins.test.ts:244` « cashout incertain : ADMIN_CASHOUT_UNCERTAIN aux admins refunds.manage, un signal CASHOUT_UNCERTAIN ». Essai : Essai 42 de `docs/recette-billetterie.md` pour le versement seulement.

### Étape 16.11 — Commission de parrainage : en attente

1. **Qui, où, quel bouton.** Personne : à la confirmation d'un paiement. Fatou, marraine, lit `/wallet`, titre « Portefeuille de parrainage ». Preuve : `app/wallet/page.tsx:516`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Une commission naît en attente, disponible 7 jours après le paiement, sans lien avec la date de l'événement. Exemple, billet de 1 000 F + 50 F, revenu net 34,25 F : niveau 1 1,71 F, niveau 2 0,69 F. Écran : carte « En attente », « Chaque commission devient disponible après son délai de validation. », liste avec « Commission sur un filleul direct » ou « Commission sur un filleul indirect ». Preuve : `M/20261106000004_lot8_commissions.sql:37`, `M/20261101000002_lot3_reglages.sql:168-171`, `app/wallet/page.tsx:243-253`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aïda : `/admin/finance`, « Commissions de parrainage ».
6. **Ce qui est impossible.** Paiement en espèces, invitation, billet gratuit : pas de commission. S'auto-parrainer. Preuve : `tests/parcours/parrainage-gardes.test.ts:90`.
7. **Test et essai.** Test : `tests/parcours/finance-commissions.test.ts:227` « grille referral_config : les quatre lignes de l’Annexe A (§95-§97), écrites par une migration » ; `tests/parcours/finance-commissions.test.ts:256` « achat d’un billet de 1 000 F par un filleul : N1 1,71 F et N2 0,69 F sur 34,25 F, EN ATTENTE jusqu’à la confirmation + 7 jours, crédit PARRAINAGE en attente » ; `tests/parcours/finance-commissions.test.ts:284` « délai réglable de 7 à 14 jours (finance.referral_availability_days), recopié sur la commission à sa naissance (non rétroactif) » ; `tests/parcours/commissions-plafond.test.ts:164` « 1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal » ; `tests/parcours/commissions-plafond.test.ts:203` « 3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond ». Essai : Essais 49 et 50 de `docs/recette-billetterie.md`.

### Étape 16.12 — Commission : disponible, retrait, annulation

1. **Qui, où, quel bouton.** La tâche des commissions, minute 37 de chaque heure. Fatou, `/wallet`. Preuve : `supabase/ops/schedule-crons.sql:105`.
2. **Ce qu'il saisit.** Pour un retrait : comme aux étapes 16.8 et 16.9.
3. **Ce que fait le système.** La commission passe disponible après son délai : « Disponible au retrait », « Commissions validées, retirables dès maintenant. ». Remboursement du filleul : annulée ou recalculée si jamais versée ; déduite des gains futurs si déjà versée. Écran : « Commission annulée (achat remboursé) », « Commission déjà versée sur un achat remboursé : déduite de vos prochains gains. ». Preuve : `M/20261101000006_lot3_commissions.sql:131`, `M/20261106000004_lot8_commissions.sql:123-192`, `app/wallet/page.tsx:226`, `:578`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun pour la disponibilité ni l'annulation. Retrait : étape 16.10.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** « Montant minimum de retrait : 5000 F. ». Virement : non ouvert.
7. **Test et essai.** Test : `tests/parcours/finance-commissions.test.ts:315` « cron /api/cron/referral-commissions : 401 sans CRON_SECRET ; les commissions échues deviennent DISPONIBLES, les autres restent EN ATTENTE » ; `tests/parcours/finance-commissions.test.ts:346` « remboursement total du billet : commissions EN ATTENTE et DISPONIBLE annulées avec motif, lignes conservées, débit PARRAINAGE » ; `tests/parcours/finance-commissions.test.ts:375` « remboursement partiel d’un panier de 2 billets : commission recalculée au prorata (ancienne CANCELLED RECALCUL_PRORATA, nouvelle ligne) » ; `tests/parcours/finance-commissions.test.ts:401` « commission déjà versée par un retrait de parrainage, puis remboursements : REGULARISATION négative, créance déduite des gains futurs (§103), ligne d’origine conservée » ; `tests/parcours/finance-commissions.test.ts:475` « /api/referrals/my-stats : total retiré = retraits de parrainage payés, solde disponible sans commission en attente, statuts distincts » ; `tests/parcours/finance-retraits.test.ts:424` « solde de parrainage distinct du solde organisateur ; retirable au FCFA inférieur ; commissions allouées ». Essai : Essai 50 de `docs/recette-billetterie.md`, 7 jours plus tard.

# Chapitre 17. Les cas transverses

### Étape 17.1 — Compte client suspendu avec des billets

1. **Qui, où, quel bouton.** Aïda, ou Moussa avec `users.write`, `/admin/users`, bouton « Suspendre ». Réactivation : même bouton, « Réactiver ». Preuve : `app/admin/users/page.tsx:423`.
2. **Ce qu'il saisit.** Aucun, ni motif ni confirmation. Erreur : « Erreur lors du changement de statut. ». Preuve : `app/admin/users/page.tsx:148`.
3. **Ce que fait le système.** Compte « Suspendu », sessions fermées, message « Le compte de {prénom} {nom} a été suspendu. », exemple « Le compte de Fatou Essai a été suspendu. ». **Les billets ne changent pas** : ils restent « Valable ». À l'entrée, le scan ne lit pas le statut du détenteur : un QR déjà enregistré hors ligne, ou la saisie manuelle avec pièce, valide l'entrée. Annulation de l'événement : remboursement normal. Transfert déjà envoyé par lui : accepté normalement. Transfert vers lui : invisible. La durée exacte d'accès après la suspension est NON VÉRIFIÉ : elle dépend de la durée du jeton, réglée hors du dépôt. Preuve : `app/api/admin/users/route.ts:318-358`, `M/20261108000005_lot9_nettoyage.sql:21-216`, `M/20261103000002_lot6_outbox.sql:446`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Aucun message pour la suspension ni la reprise. Ensuite, les messages liés à l'achat et à l'argent partent quand même ; rappels, transferts, entrée validée, changements et suspension d'un événement sont bloqués. Preuve : `M/20261103000002_lot6_outbox.sql:77-109`, `:377-386`.

5. **Ce que les autres voient.** Fatou ne peut plus se connecter, ni afficher un QR en ligne.
6. **Ce qui est impossible.** Tout ce qui passe par sa session : « Votre compte est suspendu. Veuillez contacter le support. », « Votre compte n'est pas actif. Contactez le support. ». Suspendre un SUPERADMIN : pas de bouton.
7. **Test et essai.** Test : `tests/parcours/statut-compte.test.ts:180` « client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE) » ; `tests/parcours/notif-rappels.test.ts:586` « invitation → rappel ; billet de guichet (sans porteur) → rien ; compte suspendu → lignes SKIPPED ACCOUNT_SUSPENDED (trace) » ; `tests/parcours/notif-outbox.test.ts:961` « compte suspendu ou partenaire suspendu : SKIPPED ACCOUNT_SUSPENDED sous politique BLOCK, avant la préférence ; ALLOW passe » ; `tests/parcours/finance-retraits.test.ts:468` « compte SUSPENDU : retrait, code de retrait et solde refusés (ACCOUNT_NOT_ACTIVE) ». Aucun test du scan d'un détenteur suspendu. Essai : aucun pour un client.

### Étape 17.2 — Partenaire suspendu avec un événement publié

1. **Qui, où, quel bouton.** Aïda, `/admin/users`, « Suspendre » (étape 2.9). Le second chemin, avec motif, n'a pas d'écran. Preuve : `app/api/admin/partners/[id]/status/route.ts:69`, `app/admin/dashboard/page.tsx:286`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Aucun des deux chemins ne touche les événements. **L'événement reste « Publié », visible, en vente.** Les ventes continuent d'être créditées à Mariama. Rappels maintenus. Scan et caisse maintenus. Preuve : `M/20261106000001_lot8_canaux.sql:211-277`, `M/20261102000003_lot5_cycle.sql:1112-1117`, `app/api/events/route.ts:38-41`, `M/20261101000010_lot4_scan.sql:60`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Par l'écran, aucun. Les avis destinés à Mariama (premier billet, catégorie complète) ne lui parviennent plus.

5. **Ce que les autres voient.** Clients : rien ne change, aucun signe sur la fiche. Aïda et Moussa peuvent encore suspendre ou annuler l'événement. Mariama : plus de connexion, plus de pilotage, plus de retrait.
6. **Ce qui est impossible.** Tout accès de Mariama.
7. **Test et essai.** Test : `tests/parcours/statut-compte.test.ts:172` « partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE) » ; `tests/parcours/dette-suspendu-temps-reel.test.ts:515` « suspendu (PATCH /api/admin/partners/[id]/status) puis reconnecté : rien sur les huit tables, le témoin reçoit chaque changement ». Aucun test d'une vente sous partenaire suspendu. Essai : Essai 55 de `docs/recette-billetterie.md`, déconnexion seulement.

### Étape 17.3 — Contrôleur retiré pendant le scan

1. **Qui, où, quel bouton.** Mariama, `/partner/events/{id}?tab=equipe` ou `/partner/team` (étapes 6.9 à 6.11).
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** L'affectation est supprimée, les scans déjà faits sont conservés. L'écran d'Ibrahima ne bouge pas. Au scan suivant, le serveur refuse : aucun billet n'est composté. Preuve : `M/20261101000010_lot4_scan.sql:60`, `app/controller/scanner/page.tsx:452`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Ibrahima | SMS | indispensable | prochain passage de la file | modèle « Event Village : votre affectation à l'entrée de {title} est retirée. » ; exemple « Event Village : votre affectation à l'entrée de Gala de la Teranga est retirée. » (79 caractères, 1 segment) |
| Ibrahima | cloche | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |
| Ibrahima | push | indispensable | prochain passage de la file | titre « Affectation retirée » ; modèle « Vous ne contrôlez plus l'entrée de « {title} ». » ; exemple « Vous ne contrôlez plus l'entrée de « Gala de la Teranga ». » |

Preuve : `CONTROLLER_UNASSIGNED` (`M/20261103000006_lot6_pros_admin.sql:588`).

5. **Ce que les autres voient.** Ibrahima, à chaque lecture : « Contrôle non autorisé », « Vous n’êtes pas autorisé à contrôler cet événement. ». À la relecture : « Contrôle précédent non repris », « Vous n’êtes plus affecté à l’événement que vous contrôliez : choisissez un événement. ». Mariama : il disparaît de l'équipe. Preuve : `components/scan/scan-client.ts:345`, `app/controller/scanner/page.tsx:323`, `:799`.
6. **Ce qui est impossible.** Retirer un contrôleur qui a une caisse ouverte : « Ce contrôleur a une caisse ouverte : clôturez-la avant de le retirer. ». Preuve : `lib/shifts/shift.service.ts:119`.
7. **Test et essai.** Test : `tests/parcours/dette-retrait-controleur.test.ts:214` « garde-fou : le partenaire A retire son contrôleur → 200, affectations de A supprimées » ; `tests/parcours/dette-retrait-controleur.test.ts:243` « garde-fou : bonne URL → 200, affectation retirée, l’autre affectation reste » ; `tests/parcours/dette-retrait-controleur.test.ts:267` « T3 : retrait de la dernière affectation → rôle CLIENT, statut ACTIF (jamais SUSPENDU), commande intacte » ; `tests/parcours/notif-controleurs.test.ts:236` « DELETE /api/partner/team/all : CONTROLLER_UNASSIGNED par affectation, un SMS agrégé, rappels PENDING du compte annulés NO_LONGER_ASSIGNED » ; `tests/parcours/acces-caisse-pin.test.ts:439` « ${p.label} : refusé (${p.kind === 'route' ? '409 ' : ''}CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés ». Essai : aucun.

### Étape 17.4 — Changement de numéro pendant un transfert

1. **Qui, où, quel bouton.** Fatou ou Lamine, `/profile`, « Changer de numéro » (étape 1.11).
2. **Ce qu'il saisit.** Le nouveau numéro, le code SMS.
3. **Ce que fait le système.** Un transfert vise un numéro, jamais un compte, et le changement de numéro ne le touche pas.

| Cas | Effet |
|---|---|
| Fatou (expéditrice) change de numéro | Rien ne change. Lamine peut accepter, Fatou peut annuler. |
| Lamine (destinataire) change de A vers B avant d'accepter | Le transfert reste visé sur A. Il disparaît de « Reçus ». En l'ouvrant : « Ce transfert est introuvable. ». Sortie : Fatou annule, ou attend 48 heures. |
| Le numéro A est repris par quelqu'un d'autre | Son nouveau titulaire, une fois son numéro vérifié, voit le transfert et peut l'accepter. |
| Un transfert était déjà adressé au nouveau numéro B | Il apparaît dans « Reçus » de Lamine dès la confirmation. |

Preuve : `M/20261108000004_lot9_compte.sql:203`, `M/20261108000002_lot9_invitations.sql:206`, `M/20261103000002_lot6_outbox.sql:446`, `tests/parcours/compte-numero.test.ts:563`, `:980`.

4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Le nouveau numéro | SMS | indispensable | immédiat | modèle « Event Village : votre code de vérification est {code}. Valable 10 minutes. » ; exemple « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) |
| L'ancien numéro | SMS | indispensable | prochain passage de la file | modèle « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » ; exemple « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » (100 caractères, 1 segment) |
| Le numéro A, si Fatou annule ensuite | SMS | indispensable | prochain passage de la file | modèle « Event Village : le transfert du billet {title} a été annulé par son propriétaire. » ; exemple « Event Village : le transfert du billet Gala de la Teranga a été annulé par son propriétaire. » (92 caractères, 1 segment) |

Rien sur le transfert au moment du changement. Preuve : `PHONE_CHANGED` (`M/20261108000004_lot9_compte.sql:252`, `app/api/account/phone/confirm/route.ts:101`) ; `TRANSFER_CANCELLED` (`M/20261103000005_lot6_billetterie.sql:212`).

5. **Ce que les autres voient.** Fatou : carte « Transfert en cours vers {numéro masqué} », sans changement ni signal.
6. **Ce qui est impossible.** Recibler un transfert sur le nouveau numéro. Numéro non vérifié : « Confirmez d'abord votre numéro par un code SMS. ».
7. **Test et essai.** Test : `tests/parcours/compte-numero.test.ts:980` « transfert vers l’ancien numéro : plus visible et non reciblé ; vers le nouveau : visible après le changement » ; `tests/parcours/compte-numero.test.ts:563` « email technique : l’ancien numéro peut de nouveau s’inscrire (D-cpt C3) ». Essai : Essais 27 et 67 de `docs/recette-billetterie.md` séparément, aucun sur le croisement, `docs/essai-local.md` section 8.15.

# Chapitre 18. Ce que voient l'admin et le SUPERADMIN

Aïda (SUPERADMIN) a toutes les permissions. Moussa (ADMIN) n'a que les siennes. Tout admin actif entre dans `/admin/*` ; le menu ne cache que le journal. Preuve : `lib/admin/admin-auth.ts:186`, `middleware.ts:218`, `components/layout/AppLayout.tsx:198`, `:237`, `:334`.

### Étape 18.1 — Tableau de bord

1. **Qui, où, quel bouton.** Aïda ou Moussa, `/admin/dashboard`, titre « Tableau de bord ».
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Cartes « Événements à valider », « Partenaires à valider » ; « Indicateurs » : « Volume des transactions », « Revenu net de la plateforme », « Partenaires validés », « Utilisateurs inscrits ». Bandeau « Configuration à compléter » si besoin. Rien sur les remboursements bloqués, les retraits ou les envois en échec. Preuve : `app/admin/dashboard/page.tsx:464-528`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Sans `events.read` : « Votre compte n’a pas accès à la modération des événements. ». Sans `partners.read` : « Votre compte n’a pas l’autorisation de consulter les partenaires. ». Sans `statistics.read` : « Indicateurs indisponibles ».
7. **Test et essai.** Test : aucun dédié au tableau de bord. Essai : aucun.

### Étape 18.2 — Supervision des notifications

1. **Qui, où, quel bouton.** `/admin/notifications`, permission `notifications.read`. Titre « Notifications », « Supervision des envois : application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar. ». Preuve : `app/admin/notifications/page.tsx:445`.
2. **Ce qu'il saisit.** Filtres : onglets par statut, « Rechercher », « Canal », « Type », « Du », « Au ». 20 par page.
3. **Ce que fait le système.** Compteurs « SMS aujourd'hui », « SMS optionnels aujourd'hui », « SMS ce mois-ci ». Liste : « Date », « Type », « Canal », « Destinataire » (masqué), « Statut », « Motif », « Détail ». Statuts : « En attente », « En cours d'envoi », « Envoyée », « En échec », « Non envoyée », « Annulée », « Incertaine ». Table « Par jour et par canal ». Preuve : `lib/notifications/outbox-labels.ts:14-22`, `M/20261105000002_lot7_sms.sql:849`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aïda et les admins avec `notifications.read` | cloche | indispensable | prochain passage de la file | titre « Envoi en échec » ; modèle « Une notification « Confirmation d’achat » par {channel} a échoué après {attempts} tentatives. » ; exemple « Une notification « Confirmation d’achat » par SMS a échoué après 5 tentatives. » |
| Aïda et les admins avec `notifications.read` | cloche | indispensable | prochain passage de la file | titre « SMS optionnels : 80 % du plafond » ; modèle « {used} SMS optionnels envoyés aujourd'hui sur un plafond de {cap}. Au-delà, rappels et annonces partent sans SMS. » ; exemple « 560 SMS optionnels envoyés aujourd'hui sur un plafond de 700. Au-delà, rappels et annonces partent sans SMS. » |
| Aïda et les admins avec `notifications.read` | email | indispensable | prochain passage de la file | objet « SMS optionnels : {percent} % du plafond — Event Village » ; modèle : SMS optionnels : {percent} % du plafond<br>{used} SMS optionnels envoyés aujourd'hui sur un plafond de {cap}. Au-delà, rappels et annonces partent sans SMS.<br>Ouvrir Event Village : {APP_URL}/admin/notifications<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : SMS optionnels : 80 % du plafond<br>560 SMS optionnels envoyés aujourd'hui sur un plafond de 700. Au-delà, rappels et annonces partent sans SMS.<br>Ouvrir Event Village : https://eventvillage.sn/admin/notifications<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Aïda et les admins avec `notifications.read` | cloche | indispensable | prochain passage de la file | titre « Budget SMS de demain insuffisant » ; modèle « {planned} SMS de rappel prévus le {day} pour {cap} disponibles (plafond {cap}). Les rappels au-delà partiront sans SMS. » ; exemple « 812 SMS de rappel prévus le ven. 6 nov. 2026 pour 700 disponibles (plafond 700). Les rappels au-delà partiront sans SMS. » |
| Aïda et les admins avec `notifications.read` | email | indispensable | prochain passage de la file | objet « Budget SMS de demain insuffisant — Event Village » ; modèle : Budget SMS de demain insuffisant<br>{planned} SMS de rappel prévus le {day} pour {cap} disponibles (plafond {cap}). Les rappels au-delà partiront sans SMS.<br>Ouvrir Event Village : {APP_URL}/admin/notifications<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn ; exemple : Budget SMS de demain insuffisant<br>812 SMS de rappel prévus le ven. 6 nov. 2026 pour 700 disponibles (plafond 700). Les rappels au-delà partiront sans SMS.<br>Ouvrir Event Village : https://eventvillage.sn/admin/notifications<br>—<br>Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn |
| Aïda et les admins avec `notifications.read` | cloche | indispensable | prochain passage de la file | titre « Plafond de SMS atteint » ; modèle « Le plafond de {cap} SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar). » ; exemple « Le plafond de 1 000 SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar). » |
| Aïda et les admins avec `notifications.read` | cloche | indispensable | prochain passage de la file | titre « Quota de SMS hors code atteint » ; modèle « La part des SMS hors codes de connexion ({limit} sur {cap} par jour) est atteinte : seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar). » ; exemple « La part des SMS hors codes de connexion (700 sur 1 000 par jour) est atteinte : seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar). » |

Aucun admin ne reçoit de SMS. Preuve : `ADMIN_NOTIFICATION_FAILED` (`M/20261103000002_lot6_outbox.sql:647`) ; `ADMIN_SMS_OPTIONAL_80` (`M/20261105000002_lot7_sms.sql:497`) ; `ADMIN_SMS_FORECAST` (`M/20261105000002_lot7_sms.sql:807`).

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Sans permission : « Accès refusé », « Vous n'avez pas la permission de consulter les notifications. ». Aucune relance depuis la liste. Preuve : `app/api/admin/notifications/route.ts:25`.
7. **Test et essai.** Test : `tests/parcours/notif-admin.test.ts:234` « statut FAILED : uniquement des FAILED, les 3 de la suite en tête (created_at DESC), can_retry vrai ; compteurs par statut » ; `tests/parcours/notif-admin.test.ts:252` « pagination : page_size 2, page 1 puis page 2, sans recouvrement ; 20 par défaut » ; `tests/parcours/notif-admin.test.ts:265` « canal, type et période : chaque filtre restreint la liste ; période en jours de Dakar » ; `tests/parcours/notif-admin.test.ts:285` « filtre inconnu (statut, canal, type) → 400 INVALID_FILTER » ; `tests/parcours/notif-admin.test.ts:293` « destinataire masqué : numéro « +221 77 *** ** 45 », email « aw***@domaine », compte par son nom, jamais d’endpoint push » ; `tests/parcours/notif-admin.test.ts:397` « par différence autour de lignes de la suite : SMS envoyés (journal OTP compris), échecs, incertains, non envoyés, annulés ; email ; seuil » ; `tests/parcours/notif-admin.test.ts:449` « sans session 401 ; client 403 ; ADMIN sans permission 403 partout ; lecture seule : lecture oui, relance 403 ; SUPERADMIN : lecture ». Essai : Essai 54 de `docs/recette-billetterie.md`.

### Étape 18.3 — Détail et relance d'une notification

1. **Qui, où, quel bouton.** `/admin/notifications/{id}`, sections « Envoi », « Destinataire », « Décision », « Contenu », « Tentatives ». Bouton « Relancer », permission `notifications.write`, fenêtre « Relancer cette notification ? », « Elle repartira au prochain passage de l'envoyeur. ». Preuve : `app/admin/notifications/[id]/page.tsx:465-519`.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Une ligne en échec seulement repart à zéro. Message « Notification remise en attente : elle repartira au prochain passage de l’envoyeur. ». Preuve : `M/20261103000008_lot6_supervision.sql:408`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

La notification relancée repart vers son destinataire, rien d'autre.

5. **Ce que les autres voient.** Le destinataire reçoit le message au prochain passage de la file.
6. **Ce qui est impossible.** « Seule une notification en échec peut être relancée. » ; « Un code à usage unique ne se renvoie pas : la personne doit en demander un nouveau. » ; « Un message plus récent sur ce changement est déjà en attente : cette notification ne repart pas. ». Bandeaux « Relance non proposée » ; « Remise non confirmée », « Le fournisseur a peut-être remis ce message : il n’est jamais renvoyé, ni automatiquement ni à la main, pour éviter un doublon. ». Moussa sans droit : bouton absent, « Permission manquante : notifications.write ».
7. **Test et essai.** Test : `tests/parcours/notif-admin.test.ts:317` « détail : ligne sans claim_token, destinataire, décision, données ; can_retry selon le statut ; inconnue → 404 NOT_FOUND » ; `tests/parcours/notif-admin.test.ts:348` « journal OTP : template_data réduit à { purpose }, aucun code ni lien, jamais relançable » ; `tests/parcours/notif-admin.test.ts:518` « RPC notification_retry : acteur ADMIN en lecture seule, ADMIN suspendu ou client → FORBIDDEN, ligne intacte » ; `tests/parcours/notif-admin.test.ts:530` « route : lecture seule 403, ADMIN suspendu 403 ; la ligne reste FAILED » ; `tests/parcours/notif-admin.test.ts:538` « notifications.write : FAILED → PENDING, tentatives remises à zéro, motif effacé, manual_retries 1, audit ; seconde relance 409 » ; `tests/parcours/notif-admin.test.ts:562` « SENT, UNCERTAIN, SKIPPED, CANCELLED, PENDING, SENDING → 409 NOT_RETRYABLE, message exact, ligne inchangée » ; `tests/parcours/notif-admin.test.ts:577` « SUPERADMIN : relance d’une ligne FAILED ; ligne inconnue → 404 ». Essai : Essai 54 de `docs/recette-billetterie.md`.

### Étape 18.4 — Réglages

1. **Qui, où, quel bouton.** `/admin/finance-settings`, titre « Réglages de la plateforme », « Chaque modification est historisée et ne s’applique qu’aux opérations futures. Modification réservée aux superadministrateurs. ». Accès par le lien de `/admin/finance`, ou l'adresse. Sections « Finance », « Contrôle d’accès », « Notifications », « Fonctionnalités ». Bouton « Modifier », puis « Enregistrer ». Preuve : `app/admin/finance-settings/page.tsx:245`.
2. **Ce qu'il saisit.** La valeur et un motif de 3 à 300 caractères. Erreurs : « Saisissez une valeur numérique. » ; « Indiquez le motif de la modification (3 caractères au moins). ».
3. **Ce que fait le système.** Message « Réglage « {libellé} » enregistré. Il s’applique aux prochaines opérations. », exemple « Réglage « Frais de retrait » enregistré. Il s’applique aux prochaines opérations. ». Non rétroactif.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Les opérations futures.
6. **Ce qui est impossible.** Moussa voit « Modifier » ; à l'enregistrement, bandeau « Réglage non enregistré », « Opération réservée exclusivement au SUPERADMIN. ». Preuve : `app/admin/finance-settings/page.tsx:302`, `app/api/admin/finance-settings/route.ts:21`, `:46`.
7. **Test et essai.** Test : `tests/parcours/finance-reglages.test.ts:78` « les 10 clés finance.* existent avec leur valeur par défaut » ; `tests/parcours/acces-reglages.test.ts:71` « GET : l’ADMIN et le SUPERADMIN lisent les réglages access.* et leur historique » ; `tests/parcours/notif-reglages.test.ts:162` « finance_setting_set (SUPERADMIN) : chaque valeur admise par le contrat est appliquée ». Essai : Essais 52 et 53 de `docs/recette-billetterie.md`.

### Étape 18.5 — Journal d'audit

1. **Qui, où, quel bouton.** Aïda seule, `/admin/audit`. Filtres « Action », « Entité / Objet ». Bouton « Examiner » : fenêtre « Audit Log #{id} • {action} », exemple « Audit Log #1042 • UPDATE_USER », « Ancienne Valeur (Old Value) », « Nouvelle Valeur (New Value) », « Métadonnées ». Preuve : `app/api/admin/audit/route.ts:18`, `app/admin/audit/page.tsx:140`.
2. **Ce qu'il saisit.** Les filtres.
3. **Ce que fait le système.** 100 lignes au plus, sans pagination. Colonnes « Horodatage », « Utilisateur », « Rôle à l’action », « Action », « Objet », « ID Objet », « Détails JSON », en codes bruts. Preuve : `app/admin/audit/page.tsx:61`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Moussa : lien absent ; adresse directe : « Réservé au superadmin », « Seul un compte superadmin peut consulter le journal d’audit. Si vous en avez besoin, adressez-vous à votre superadmin. ». En base aussi.
7. **Test et essai.** Test : `tests/parcours/admin-audit.test.ts:107` « sans session 401 ; partenaire et contrôleur 403 ; ADMIN 403 (A24, lot 9) ; SUPERADMIN 200 » ; `tests/parcours/admin-audit.test.ts:161` « action : exactement les lignes de cette action, de la plus récente à la plus ancienne » ; `tests/parcours/admin-audit.test.ts:166` « objectType et userRole, seuls et combinés » ; `tests/parcours/admin-audit.test.ts:174` « ALL n’est pas un filtre ; une valeur inconnue ne rend rien ; limit coupe aux plus récentes » ; `tests/parcours/admin-audit.test.ts:180` « chaque ligne porte utilisateur, rôle, date et heure, action, objet, ancienne et nouvelle valeur » ; `tests/parcours/admin-audit-lot9.test.ts:77` « ADMIN avec permissions : 403, aucune ligne servie, tentative non journalisée » ; `tests/parcours/admin-audit-lot9.test.ts:199` « A24 : la page distingue le refus 403 et affiche « Réservé au superadmin » sans bouton Réessayer » ; `tests/parcours/admin-audit-lot9.test.ts:218` « A24, AR10 : la barre latérale et le groupe Système masquent le lien pour un ADMIN » ; `tests/parcours/audit-logs-rls.test.ts:49` « SUPERADMIN lit la ligne témoin (la ligne existe et la politique la laisse passer) » ; `tests/parcours/audit-logs-rls.test.ts:53` « ADMIN ne lit rien du journal, même avec son propre jeton ». Essai : Essai 57 de `docs/recette-billetterie.md`.

### Étape 18.6 — Finance

1. **Qui, où, quel bouton.** `/admin/finance`, permission `payments.read`, titre « Rapprochement financier ». Preuve : `app/admin/finance/page.tsx:141`.
2. **Ce qu'il saisit.** « Statut », période « Tout », « 30 jours », « 7 jours ».
3. **Ce que fait le système.** Cartes « Volume encaissé », « Frais de service perçus », « Frais agrégateur (SamirPay) », « Revenu net Event Village », « Reversements partenaires », « Remboursements versés » ; « Commissions de parrainage », « Revenu net après parrainage », « Retraits versés », « Écarts de rapprochement ». Tableau « Paiements rapprochés ».
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Les alertes sont aux étapes 14.3, 14.5 et 15.2.

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Sans permission : « Permission manquante : payments.read ». Lister les retraits, les commissions, ou la fiche d'un partenaire : aucun écran.
7. **Test et essai.** Test : `tests/parcours/finance-hors-plateforme.test.ts:132` « vente en ligne de 1 000 F : volume admin + 1 050, revenu EV + 34,25 (net des paiements plateforme) ». Essai : Essai 56 de `docs/recette-billetterie.md`.

### Étape 18.7 — Remboursements à reprendre

1. **Qui, où, quel bouton.** `/admin/finance`, section « Remboursements à reprendre », permission `refunds.manage`. Détail à l'étape 14.8.
2. **Ce qu'il saisit.** Aucun.
3. **Ce que fait le système.** Comme à l'étape 14.8.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

Les alertes sont citées intégralement à l'étape 14.5.

5. **Ce que les autres voient.** Fatou : « Remboursé » après confirmation.
6. **Ce qui est impossible.** Conclure un envoi incertain. Moussa sans droit : « Reprise des remboursements réservée », « Votre compte n’a pas la permission de gérer les remboursements. ».
7. **Test et essai.** Test : `tests/parcours/admin-remboursements.test.ts:180` « sans session 401 ; client, partenaire, ADMIN sans la permission 403 ; SUSPENDU 403 ; avec la permission et SUPERADMIN 200 » ; `tests/parcours/admin-remboursements.test.ts:285` « refus de SamirPay : état ECHOUE, relance possible, titre de l’événement, numéro masqué » ; `tests/parcours/admin-remboursements.test.ts:296` « issue incertaine : état INCERTAIN, jamais de relance » ; `tests/parcours/remboursement-relance.test.ts:120` « ECHOUE : remis à envoyer puis envoyé, CONFIRME, billet REMBOURSE, audit REFUND_RETRY » ; `tests/parcours/remboursement-relance.test.ts:158` « SOLDE_INSUFFISANT : rebloqué sans envoi tant que le solde manque, envoyé une fois le solde revenu » ; `tests/parcours/remboursement-relance.test.ts:187` « INCERTAIN : refusé, aucun envoi, aucun audit, statut inchangé ». Essai : Essais 58 et 60 de `docs/recette-billetterie.md`.

### Étape 18.8 — Parrainage et ambassadeurs

1. **Qui, où, quel bouton.** `/admin/referral`, titre « Gestion des Ambassadeurs & Parrainage ». Bouton « Promouvoir Ambassadeur ⭐ » ou « Rétrograder ». Bandeau « La personnalisation des taux n’est pas disponible pour le moment. ». Preuve : `app/admin/referral/page.tsx:118`.
2. **Ce qu'il saisit.** Les filtres.
3. **Ce que fait le système.** Le statut du client change les taux des prochaines relations seulement. Non rétroactif. Preuve : `app/api/admin/users/route.ts:283`.
4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Aucun.
6. **Ce qui est impossible.** Moussa : « Seul un SUPERADMIN peut modifier le statut ambassadeur. ».
7. **Test et essai.** Test : `tests/parcours/admin-parrainage.test.ts:239` « aucun texte de la modale factice ne reste à l’écran ». Essai : Essai 51 de `docs/recette-billetterie.md`.

### Étape 18.9 — Moussa, avec puis sans permission

1. **Qui, où, quel bouton.** Aïda, `/admin/users`, bouton « Permissions » (étape 0.2).
2. **Ce qu'il saisit.** Les cases.
3. **Ce que fait le système.** Message « Les permissions de l'administrateur {prénom} {nom} ont été enregistrées. », exemple « Les permissions de l'administrateur Moussa Essai ont été enregistrées. ».

| Besoin | Permission | Sans la permission |
|---|---|---|
| Voir un événement | `events.read` | « Permission manquante : events.read » |
| Valider, publier, suspendre, réactiver, terminer, annuler | `events.write` | boutons affichés, au clic « Permission manquante : events.write » ; contournable (revue critique) |
| Voir la supervision | `notifications.read` | « Accès refusé » |
| Relancer une notification | `notifications.write` | bouton absent |
| Voir le rapprochement | `payments.read` | « Permission manquante : payments.read » |
| Voir et relancer les remboursements | `refunds.manage` | « Reprise des remboursements réservée » |
| Voir les partenaires | `partners.read` | « Votre compte n’a pas l’autorisation de consulter les partenaires. » |
| Valider ou refuser un partenaire | `partners.validate` | « Permission manquante : partners.validate » |
| Lire ou modifier les comptes | `users.read`, `users.write` | « Permission manquante : users.write » |
| Indicateurs | `statistics.read` | « Indicateurs indisponibles » |
| Tarifs | `pricing.manage` | « Permission manquante : pricing.manage » |
| Campagnes | `communications.manage` | « Permission manquante : communications.manage » |
| Rembourser un billet | aucune | tout admin (revue critique) |
| Pilotage, liste et contacts des participants | aucune | tout admin |
| Modifier les réglages | SUPERADMIN | « Opération réservée exclusivement au SUPERADMIN. » |
| Journal d'audit | SUPERADMIN | « Réservé au superadmin » |

Preuve : `lib/admin/admin-auth.ts:186`, `:204-210`, `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:34-35`, `M/20261102000005_lot5_pilotage.sql:135-157`.

4. **Messages reçus.**

| Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
|---|---|---|---|---|
| Aucun. | — | — | — | — |

5. **Ce que les autres voient.** Moussa : effet à sa prochaine lecture. Il reçoit aussi les alertes liées à ces permissions.
6. **Ce qui est impossible.** Pour un SUPERADMIN : « Le Superadmin dispose de toutes les permissions par défaut. ». Pour Moussa : « Opération réservée exclusivement au SUPERADMIN. ».
7. **Test et essai.** Test : `tests/parcours/securite-admin-lot7.test.ts:177` « témoin : admin ACTIF (users.read, notifications.read) → 200 sur /api/admin/users et /api/admin/notifications » ; `tests/parcours/securite-admin-lot7.test.ts:188` « admin ${status} (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth ». Essai : Essai 53 de `docs/recette-billetterie.md`, pour les réglages seulement.

# Annexe A. Les machines à états

Pour chaque passage : qui le déclenche, à quelle condition, ce qui est envoyé. Les libellés sont ceux de l'écran.

## A.1 L'événement

| De | Vers | Qui | Bouton | Condition | Envoyé | Preuve |
|---|---|---|---|---|---|---|
| (création) | Brouillon | partenaire validée | « Enregistrer le brouillon » | étape 3.6 | rien | `M/20261106000001_lot8_canaux.sql:690` |
| Brouillon | En attente de validation | partenaire | « Soumettre à la validation » | une affiche et une catégorie active | admins : cloche, push, email | `M/20261102000003_lot5_cycle.sql:50`, `M/20261103000005_lot6_billetterie.sql:1024-1035` |
| En attente de validation | Brouillon | partenaire | « Retirer de la validation » | aucune | rien | `M/20261102000003_lot5_cycle.sql:51` |
| En attente de validation | Brouillon | admin `events.write` | « Refuser » | motif de 3 caractères | partenaire : SMS, cloche, push, email | `M/20261102000003_lot5_cycle.sql:52` |
| En attente de validation | Validé | admin `events.write` | « Valider » | aucune | partenaire : SMS, cloche, push, email | `M/20261102000003_lot5_cycle.sql:53` |
| Validé | Publié | partenaire | « Publier » | fin non passée | rien | `M/20261102000003_lot5_cycle.sql:54`, `M/20261103000005_lot6_billetterie.sql:1036` |
| Validé | Publié | admin `events.write` | « Publier » | fin non passée | partenaire : cloche, push | `M/20261102000003_lot5_cycle.sql:55` |
| Publié | Suspendu | admin `events.write` | « Suspendre » | motif | partenaire : quatre canaux ; détenteurs : cloche, push | `M/20261102000003_lot5_cycle.sql:56` |
| Suspendu | Publié | admin `events.write` | « Réactiver » | fin non passée | partenaire : quatre canaux ; détenteurs : cloche, push | `M/20261102000003_lot5_cycle.sql:57` |
| Publié, Validé, Suspendu | Annulé | partenaire ou admin | « Annuler l’événement » | titre retapé, avis de 10 caractères, motif de 3 | détenteurs : étape 14.5 | `M/20261102000003_lot5_cycle.sql:58-63` |
| Publié | Terminé | système, toutes les 15 minutes | automatique | fin passée | rien | `M/20261102000003_lot5_cycle.sql:64`, `M/20261103000005_lot6_billetterie.sql:1320` |
| Publié | Terminé | admin `events.write` | « Terminer » | événement commencé | rien | `M/20261102000003_lot5_cycle.sql:65`, `M/20261103000005_lot6_billetterie.sql:1039-1042` |

Passages absents : Suspendu vers Terminé ; Annulé vers tout autre statut ; Terminé vers tout autre statut ; Publié vers Brouillon ; Validé vers Brouillon. Preuve : `M/20261102000003_lot5_cycle.sql:49-65`.

## A.2 Le billet

| De | Vers | Qui | Condition | Envoyé | Preuve |
|---|---|---|---|---|---|
| (rien) | Valable | confirmation du paiement | panier honorable | confirmation d'achat (étape 7.7) | `M/20261106000003_lot8_paiement.sql:84` |
| (rien) | Valable | réservation gratuite | limite respectée | étape 7.3 | `M/20261105000007_lot7_confirmation.sql:205` |
| (rien) | Valable | invitation | stock, quotas | étape 8.8 | `M/20261108000002_lot9_invitations.sql:348` |
| (rien) | Utilisé | vente au guichet | entrée immédiate | reçu si un numéro est saisi | `M/20261106000001_lot8_canaux.sql:438-443` |
| Valable | Utilisé | scan | QR bon ou saisie manuelle, contrôle ouvert | étape 10.4 | `M/20261108000005_lot9_nettoyage.sql:21-216` |
| Valable | Annulé | annulation de l'événement | billet gratuit, invitation, ou payé en espèces | étape 14.5 | `M/20261106000003_lot8_paiement.sql:395`, `:405` |
| Valable | Annulé | annulation d'une invitation | non scannée | rien | `M/20261108000002_lot9_invitations.sql:504-574` |
| Valable | Annulé | remboursement d'un billet | gratuit, invitation, ou espèces | rien | `M/20261108000001_lot9_securite.sql:70`, `:83` |
| Valable | Remboursement en cours | remboursement | versement demandé | seul pour un billet seul : étape 15.2 | `M/20261101000005_lot3_remboursements.sql:252`, `M/20261108000001_lot9_securite.sql:123` |
| Remboursement en cours | Remboursé | confirmation du versement | versement confirmé | étape 7.11 | `M/20261101000005_lot3_remboursements.sql:259-326` |

Le passage à « Terminé » ne change pas le billet. Un transfert ne change pas son statut, il pose seulement un verrou.

## A.3 Le paiement

| De | Vers | Qui | Condition | Envoyé | Preuve |
|---|---|---|---|---|---|
| (rien) | En attente | lancement du paiement | contrôles passés | rien | `M/20261105000006_lot7_client.sql:24` |
| En attente, Expiré, Annulé | Confirmé | confirmation | SamirPay confirme, panier honorable | étape 7.7 | `M/20261106000003_lot8_paiement.sql:84` |
| En attente, Expiré, Annulé | Remboursement en cours | confirmation | panier impossible, ou double paiement | admins si doublon (étape 7.11) | `M/20261106000003_lot8_paiement.sql:154-156` |
| En attente | Échoué | refus à l'envoi ou SamirPay | | rien | `M/20261031000013_lot2_reservations.sql:192` |
| En attente | Annulé | le client, ou SamirPay | | rien | `M/20261031000013_lot2_reservations.sql:192` |
| En attente | Expiré | tâche de rapprochement | 60 minutes | rien | `lib/payments/confirmation.service.ts:184-188` |
| Confirmé, Partiel, Remboursement en cours | Remboursé ou Partiel | confirmation d'un versement | total ou partiel | étape 7.11 | `M/20261101000005_lot3_remboursements.sql:259-326` |

Réservation de places : active, puis convertie, libérée ou expirée. Échoué est définitif.

## A.4 Le transfert

| De | Vers | Qui | Condition | Envoyé | Preuve |
|---|---|---|---|---|---|
| (rien) | En attente | Fatou | détenteur, billet valable, événement publié ou validé | étape 8.1 | `M/20261103000005_lot6_billetterie.sql:78-170` |
| En attente | Accepté | Lamine | numéro vérifié, non échu, événement actif | étape 8.2 | `M/20261108000002_lot9_invitations.sql:91` |
| En attente | Annulé | Fatou | | étape 8.6 | `M/20261103000005_lot6_billetterie.sql:174-234` |
| En attente | Annulé | annulation de l'événement, ou annulation d'une invitation | | rien | `M/20261106000003_lot8_paiement.sql:364-366` |
| En attente | Expiré | tâche des transferts | 48 heures, ou fin d'événement pour une invitation | étape 8.5 | `M/20261103000005_lot6_billetterie.sql:239` |

Aucun état « refusé » n'existe.

## A.5 L'invitation

Elle n'a pas de table propre : c'est un billet et, sauf compte vérifié, un transfert sans expéditeur.

| Situation | Billet | Transfert | Libellé de l'historique |
|---|---|---|---|
| Compte vérifié | Valable, au compte | aucun | « Envoyée » |
| Autre cas | Valable, sans propriétaire, verrouillé | En attente jusqu'à la fin | « Envoyée » |
| Réclamée | Valable, au compte | Accepté | « Envoyée » |
| Non réclamée, fin passée | Valable, sans propriétaire, déverrouillé | Expiré | « Envoyée » |
| Scannée | Utilisé | | « Entrée validée » |
| Annulée | Annulé | Annulé ou absent | « Annulée » |

Preuve : `M/20261108000002_lot9_invitations.sql:582`.

## A.6 La caisse

| De | Vers | Qui | Condition | Envoyé | Preuve |
|---|---|---|---|---|---|
| (rien) | Ouverte | contrôleur affecté avec espèces (voie aussi ouverte à la partenaire et à l'admin, sans écran) | compte actif, contrôle ouvert, aucune autre caisse ouverte, PIN vérifié s'il est saisi | rien | `M/20261102000003_lot5_cycle.sql:963-999` |
| Ouverte | Ouverte, attendu augmenté | vente au guichet | étape 11.2 | reçu si numéro | `M/20261106000001_lot8_canaux.sql:454` |
| Ouverte | Clôturée sans écart | contrôleur (voie aussi ouverte à la partenaire et à l'admin, sans écran) | déclaré égal à l'attendu | rien ; avis au contrôleur si un tiers clôture | `M/20261103000006_lot6_pros_admin.sql:165-308` |
| Ouverte | Clôturée avec écart | contrôleur (voie aussi ouverte à la partenaire et à l'admin, sans écran) | justification, PIN | étape 11.4 | `M/20261103000006_lot6_pros_admin.sql:220` |
| Clôturée | | | état final, pas de réouverture | | `lib/shifts/shift.service.ts:356` |
| tout | En litige | **personne** | aucune écriture | | `M/20260906000002_controller_shifts.sql:23` |

Aucun passage automatique : ni l'annulation ni la fin de l'événement ne ferment une caisse. Une caisse ouverte empêche de retirer le contrôleur. Preuve : `M/20261106000003_lot8_paiement.sql:266-414`, `M/20261101000011_lot4_caisse.sql:1`.

## A.7 Le remboursement et le versement

| De | Vers | Qui | Condition | Envoyé | Preuve |
|---|---|---|---|---|---|
| (création) | en attente, à verser par la plateforme | remboursement ou annulation | paiement en ligne, reste dû | rien, sauf billet seul | `M/20261101000005_lot3_remboursements.sql:194-256` |
| (création) | en attente, à la charge de la partenaire | remboursement d'un billet payé hors plateforme | | rien | `M/20261108000001_lot9_securite.sql:21-129` |
| en attente | versé | versement confirmé | | étape 7.11 | `M/20261101000005_lot3_remboursements.sql:259-326` |
| en attente | en échec | refus explicite | | admins ; partenaire si annulation | `M/20261103000006_lot6_pros_admin.sql:382-400` |
| en échec | en attente | admin `refunds.manage`, « Relancer » | versement en échec | rien | `lib/events/event-cancellation.service.ts:186-222` |
| en attente, à la charge de la partenaire | **aucune sortie** | | pas d'écran | rien | `M/20261108000001_lot9_securite.sql:21-129` |

Versement :

| De | Vers | Qui | Condition | Envoyé | Preuve |
|---|---|---|---|---|---|
| (création) | à envoyer | remboursement ou retrait | bloqué si opérateur, numéro ou nom manque | alerte si remboursement | `lib/payments/cashout.service.ts:216-220` |
| à envoyer | à envoyer, bloqué solde | envoi | solde insuffisant | admins (remboursement) | `lib/payments/cashout.service.ts:285-289` |
| à envoyer | **reste à envoyer** | envoi | solde illisible | **rien** | `lib/payments/cashout.service.ts:281-283` |
| à envoyer | envoyé | réponse SamirPay | pas encore final | rien | `lib/payments/cashout.service.ts:254` |
| à envoyer, envoyé | confirmé | réponse SamirPay, rapprochement | | étapes 7.11 et 16.10 | `lib/payments/cashout.service.ts:258-260` |
| à envoyer, envoyé | en échec | refus | | admins, partenaire | `lib/payments/cashout.service.ts:254` |
| à envoyer | incertain | délai, erreur serveur, réponse illisible | | admins | `app/api/cron/payments-reconcile/route.ts:69` |
| en échec | à envoyer | admin, « Relancer » | | rien | `lib/events/event-cancellation.service.ts:186-222` |
| incertain | **aucune sortie** | | aucune action écrite dans le code | rien | `components/admin/RefundsToRetry.tsx:173-177` |
| à envoyer, bloqué opérateur, numéro ou nom | **aucune sortie** | | « Aucune relance possible depuis cet écran. » | rien | `app/api/admin/refunds/route.ts:106-109` |
| à envoyer, ancien type de remboursement seul, non bloqué, plus de 5 minutes | envoi | tâche de rapprochement | **ce type seulement** | selon résultat | `lib/payments/cashout.service.ts:308-315` |

# Annexe B. Le catalogue complet des messages

Messages de la file, 66 types. Le texte du SMS est un exemple rempli ; ses modèles avec variables sont cités aux étapes.

| Type | Déclencheur | Destinataire | Canaux | Indispensable ou optionnel | Texte exact du SMS (caractères, segments) | Titre dans la cloche | Email |
|---|---|---|---|---|---|---|---|
| `PURCHASE_CONFIRMED` | Paiement de billets confirmé | SMS au numéro qui a payé ; cloche et email au compte acheteur | SMS, cloche, email | indispensable | « Event Village : achat confirmé, 2 billets Gala de la Teranga. Frais de service 100 F CFA, total payé 10 100 F CFA. https://eventvillage.sn/tickets » (146 caractères, 1 segment) | « Achat confirmé » | oui |
| `FREE_TICKETS_CONFIRMED` | Réservation de billets gratuits, une fois par réservation | Le compte qui réserve | SMS, cloche, email | indispensable | « Event Village : 2 billets gratuits pour Gala de la Teranga le sam. 14 nov. à 20:00. Vos billets : https://eventvillage.sn/tickets » (129 caractères, 1 segment) | « Billets confirmés » | oui |
| `COUNTER_RECEIPT` | Vente au guichet avec un numéro saisi | Le numéro saisi par le vendeur, sans compte | SMS | indispensable | « Event Village : achat au guichet pour Gala de la Teranga, 2 billets, 10 000 F CFA. Entrée validée. Réf. 1F6E2B9C. » (113 caractères, 1 segment) | Aucun. | non |
| `INVITATION_RECEIVED` | Invitation envoyée, un SMS par numéro | Le numéro invité, avec ou sans compte | SMS | indispensable | « Event Village : 2 invitations pour Gala de la Teranga le sam. 14 nov. à 20:00. Connectez-vous avec ce numéro : https://eventvillage.sn/tickets » (142 caractères, 1 segment) | Aucun. | non |
| `TRANSFER_OFFERED` | Transfert lancé | SMS au numéro cible, compté sur l'expéditeur ; cloche et push au compte actif dont ce numéro est vérifié | SMS, cloche, push | indispensable | « Event Village : un billet Gala de la Teranga vous est transféré. Connectez-vous avec ce numéro avant le 12 nov. à 18:30 : https://eventvillage.sn/tickets » (153 caractères, 1 segment) | « Un billet vous est transféré » | non |
| `TRANSFER_CANCELLED` | Annulation du transfert par l'expéditeur | SMS au numéro cible ; cloche et push au compte vérifié de ce numéro | SMS, cloche, push | indispensable | « Event Village : le transfert du billet Gala de la Teranga a été annulé par son propriétaire. » (92 caractères, 1 segment) | « Transfert annulé » | non |
| `TRANSFER_EXPIRED` | Délai de 48 heures dépassé | L'expéditeur seulement | cloche, push | indispensable | Aucun. | « Transfert expiré » | non |
| `TRANSFER_CLAIMED_SENDER` | Transfert accepté | L'expéditeur (aucun pour une invitation réclamée) | cloche, push | indispensable | Aucun. | « Billet accepté » | non |
| `TRANSFER_RECEIVED` | Transfert accepté | Le compte qui accepte | cloche, push, email | indispensable | Aucun. | « Billet reçu » | oui |
| `TICKET_SCANNED` | Entrée validée au scan ou en saisie manuelle, hors guichet | Le détenteur du billet | cloche, push | indispensable | Aucun. | « Entrée validée » | non |
| `EVENT_CANCELLED` | Annulation de l'événement | Chaque compte qui détient un billet valable ou utilisé | SMS, cloche, push, email | indispensable | « Event Village : Gala de la Teranga du sam. 14 nov. à 20:00 est annulé. Remboursement automatique en cours. https://eventvillage.sn/tickets » (138 caractères, 1 segment) | « Événement annulé » | oui |
| `EVENT_SUSPENDED_HOLDER` | Suspension par l'admin | Chaque compte détenteur d'un billet valable ou utilisé | cloche, push | optionnel | Aucun. | « Événement suspendu » | non |
| `EVENT_REACTIVATED_HOLDER` | Réactivation par l'admin | Chaque compte détenteur d'un billet valable ou utilisé | cloche, push | optionnel | Aucun. | « Événement de nouveau en ligne » | non |
| `EVENT_CHANGED` | Modification d'un événement publié : titre, date, heure, lieu, ville, adresse | Chaque compte détenteur d'un billet valable, et utilisé pour un événement de plusieurs jours | SMS, cloche, push | optionnel | « Event Village : Gala de la Teranga change de date : sam. 21 nov. à 21:00. Vos billets restent valables. https://eventvillage.sn/tickets » (135 caractères, 1 segment) | « Événement modifié » | non |
| `REMINDER_J1` | Tâche des rappels, la veille à 10 h | Chaque compte détenteur d'un billet valable à l'échéance | SMS, cloche, push, email | optionnel | « Event Village : rappel, Gala de la Teranga demain à 20:00, CICAD. Vos billets : https://eventvillage.sn/tickets » (111 caractères, 1 segment) | « Rappel : c'est demain » | oui |
| `REMINDER_H3` | Tâche des rappels, 3 heures avant le début | Chaque compte détenteur d'un billet valable à l'échéance | SMS, cloche, push | optionnel | « Event Village : Gala de la Teranga à 20:00. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. https://eventvillage.sn/tickets » (143 caractères, 1 segment) | « C'est bientôt » | non |
| `REFUND_REQUESTED` | Création du remboursement d'un billet seul | Le client du paiement, c'est-à-dire celui qui a payé | cloche | indispensable | Aucun. | « Remboursement demandé » | non |
| `REFUND_PAID` | Versement de remboursement confirmé | Le client du paiement, même si le billet a été transféré | SMS, cloche, push, email | indispensable | « Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave (Gala de la Teranga). » (94 caractères, 1 segment) | « Remboursement versé » | oui |
| `PASSWORD_CHANGED` | Mot de passe défini ou modifié | Le compte concerné | SMS, cloche, email | indispensable | « Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » (116 caractères, 1 segment) | « Mot de passe modifié » | oui |
| `PHONE_CHANGED` | Changement de numéro confirmé | L'ancien numéro, sans compte rattaché | SMS | indispensable | « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » (100 caractères, 1 segment) | Aucun. | non |
| `PUSH_TEST` | Bouton d'essai des préférences | Le compte qui clique | push | indispensable | Aucun. | Aucun. | non |
| `EVENT_VALIDATED` | Événement validé par l'admin | La partenaire | SMS, cloche, push, email | indispensable | « Event Village : votre événement Gala de la Teranga est validé. Publiez-le depuis votre espace : https://eventvillage.sn/partner/events » (134 caractères, 1 segment) | « Événement validé » | oui |
| `EVENT_REJECTED` | Événement refusé par l'admin, avec motif | La partenaire | SMS, cloche, push, email | indispensable | « Event Village : événement Gala de la Teranga non validé. Motif : Affiche illisible, merci d'en déposer... https://eventvillage.sn/partner/events » (144 caractères, 1 segment) | « Événement non validé » | oui |
| `EVENT_SUSPENDED` | Suspension par l'admin, avec motif | La partenaire | SMS, cloche, push, email | indispensable | « Event Village : événement Gala de la Teranga suspendu. Motif : Signalement en cours d'examen. https://eventvillage.sn/partner/events » (132 caractères, 1 segment) | « Événement suspendu » | oui |
| `EVENT_REACTIVATED` | Réactivation par l'admin | La partenaire | SMS, cloche, push, email | indispensable | « Event Village : votre événement Gala de la Teranga est de nouveau en ligne. https://eventvillage.sn/partner/events » (114 caractères, 1 segment) | « Événement réactivé » | oui |
| `EVENT_PUBLISHED_BY_ADMIN` | Publication par l'admin | La partenaire | cloche, push | indispensable | Aucun. | « Événement publié » | non |
| `FIRST_TICKET_SOLD` | Premier billet en ligne ou au guichet, hors gratuits et invitations | La partenaire | SMS, cloche, push, email | optionnel | « Event Village : premier billet vendu pour Gala de la Teranga. Suivez vos ventes : https://eventvillage.sn/partner/events » (120 caractères, 1 segment) | « Premier billet vendu » | oui |
| `NEW_ORDER` | Paiement de billets confirmé | La partenaire | cloche | optionnel | Aucun. | « Nouvelle commande » | non |
| `CATEGORY_SOLD_OUT` | Ventes égales à la quantité d'une catégorie | La partenaire | SMS, cloche, push, email | optionnel | « Event Village : la catégorie Carré VIP de Gala de la Teranga est complète. https://eventvillage.sn/partner/events » (113 caractères, 1 segment) | « Catégorie complète » | oui |
| `EVENT_SOLD_OUT` | Dernière catégorie active épuisée | La partenaire | SMS, cloche, push, email | optionnel | « Event Village : Gala de la Teranga est complet, toutes les catégories sont vendues. https://eventvillage.sn/partner/events » (122 caractères, 1 segment) | « Événement complet » | oui |
| `SHIFT_DISCREPANCY` | Clôture de caisse avec écart | La partenaire | SMS, cloche, push | indispensable | « Event Village : caisse de Ibrahima Sow fermée (Gala de la Teranga) avec un écart de -2 500 F CFA. https://eventvillage.sn/partner/events » (136 caractères, 1 segment) | « Écart de caisse » | non |
| `WITHDRAWAL_PAID` | Retrait versé | Le bénéficiaire du retrait | SMS, cloche, push, email | indispensable | « Event Village : votre retrait de 25 000 F CFA a été versé sur votre compte Wave. » (80 caractères, 1 segment) | « Retrait versé » | oui |
| `WITHDRAWAL_REJECTED` | Retrait refusé par l'opérateur | Le bénéficiaire du retrait | SMS, cloche, push, email | indispensable | « Event Village : votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde. » (114 caractères, 1 segment) | « Retrait refusé » | oui |
| `WITHDRAWAL_UNCERTAIN` | Issue d'un retrait incertaine | Le bénéficiaire du retrait | SMS, cloche, push | indispensable | « Event Village : votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action de votre part. » (117 caractères, 1 segment) | « Retrait en vérification » | non |
| `CANCEL_REFUNDS_DONE` | Dernier remboursement d'annulation confirmé | La partenaire | cloche, push, email | indispensable | Aucun. | « Remboursements terminés » | oui |
| `CANCEL_REFUNDS_BLOCKED` | Remboursement d'annulation bloqué ou refusé, une fois par jour | La partenaire | cloche, push, email | indispensable | Aucun. | « Remboursements en attente » | oui |
| `PARTNER_REGISTERED_ACK` | Création du dossier partenaire | La partenaire | cloche, email | indispensable | Aucun. | « Inscription reçue » | oui |
| `PARTNER_VALIDATED` | Dossier validé, depuis en attente ou refusé | La partenaire | SMS, cloche, email | indispensable | « Event Village : votre compte partenaire Sabar Events est validé. Connectez-vous : https://eventvillage.sn/login » (111 caractères, 1 segment) | « Compte partenaire validé » | oui |
| `PARTNER_REJECTED` | Dossier refusé, avec motif | La partenaire | SMS, cloche, email | indispensable | « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d'identité illisible. » (106 caractères, 1 segment) | « Demande refusée » | oui |
| `PARTNER_SUSPENDED` | Dossier suspendu, avec motif, par la route sans écran | La partenaire | SMS, cloche, email | indispensable | « Event Village : votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d'examen. Contactez le support. » (125 caractères, 1 segment) | « Compte suspendu » | oui |
| `PARTNER_REACTIVATED` | Dossier revalidé depuis suspendu, par la route sans écran | La partenaire | SMS, cloche, email | indispensable | « Event Village : votre compte partenaire est réactivé. Connectez-vous : https://eventvillage.sn/login » (100 caractères, 1 segment) | « Compte réactivé » | oui |
| `TRIAL_STARTED` | Première activation de la période d'essai | La partenaire | SMS, cloche | indispensable | « Event Village : votre période d'essai de 60 jours commence aujourd'hui. Bienvenue ! » (83 caractères, 1 segment) | « Période d'essai activée » | non |
| `SUBSCRIPTION_ACTIVATED` | Changement de formule | La partenaire | cloche | indispensable | Aucun. | « Abonnement activé » | non |
| `PAYMENT_SUCCESS` | Paiement réussi hors billetterie | Le client du paiement | cloche | indispensable | Aucun. | « Paiement confirmé » | non |
| `HALL_RESERVATION_REQUESTED` | Réservation de salle créée, service fermé par défaut | Le partenaire de la salle | cloche | indispensable | Aucun. | « Nouvelle demande de réservation » | non |
| `HALL_RESERVATION_CONFIRMED` | Réservation de salle confirmée, service fermé par défaut | Le client | cloche | indispensable | Aucun. | « Réservation confirmée » | non |
| `HALL_RESERVATION_CANCELLED` | Réservation de salle annulée, service fermé par défaut | Le client et le partenaire | cloche | indispensable | Aucun. | « Réservation annulée » | non |
| `PROMOTION_DECIDED` | Décision sur une mise en avant, sans écran | La partenaire | cloche | indispensable | Aucun. | « Mise en avant acceptée » | non |
| `CONTROLLER_ASSIGNED` | Affectation à un événement | Le contrôleur | SMS, cloche, push | indispensable | « Event Village : affectation à l'entrée de Gala de la Teranga, sam. 14 nov. à 20:00, point Porte Nord, et 1 autre. https://eventvillage.sn/login » (143 caractères, 1 segment) | « Nouvelle affectation » | non |
| `CONTROLLER_UNASSIGNED` | Retrait d'une affectation | Le contrôleur | SMS, cloche, push | indispensable | « Event Village : votre affectation à l'entrée de Gala de la Teranga est retirée, et 1 autre. » (91 caractères, 1 segment) | « Affectation retirée » | non |
| `CONTROLLER_REMINDER` | Tâche des rappels, la veille à 18 h | Chaque contrôleur affecté à l'échéance | SMS, cloche, push | optionnel | « Event Village : demain Gala de la Teranga à 20:00, point Porte Nord, espèces autorisées. Connexion : https://eventvillage.sn/login » (130 caractères, 1 segment) | « Contrôle demain » | non |
| `SHIFT_CLOSED_BY_OTHER` | Caisse fermée par la partenaire ou un admin, par la route sans écran | Le contrôleur de la caisse | cloche, push | indispensable | Aucun. | « Caisse fermée » | non |
| `CONTROLLER_ACTIVATED` | Activation du compte | Le contrôleur | SMS, cloche | indispensable | « Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets. » (91 caractères, 1 segment) | « Compte activé » | non |
| `ADMIN_EVENT_SUBMITTED` | Événement soumis à la validation | Admins avec events.read et tout SUPERADMIN | cloche, push, email | indispensable | Aucun. | « Événement à valider » | oui |
| `ADMIN_PARTNER_REGISTERED` | Création du dossier partenaire | Admins avec partners.read et tout SUPERADMIN | cloche, push, email | indispensable | Aucun. | « Nouvelle candidature » | oui |
| `ADMIN_REFUND_TO_RETRY` | Remboursement bloqué ou refusé | Admins avec refunds.manage et tout SUPERADMIN | cloche, push, email | indispensable | Aucun. | « Remboursement à reprendre » | oui |
| `ADMIN_DUPLICATE_PAYMENT` | Second paiement réussi du même panier | Admins avec refunds.manage et tout SUPERADMIN | cloche, push, email | indispensable | Aucun. | « Paiement en double remboursé » | oui |
| `ADMIN_CASHOUT_UNCERTAIN` | Versement à l'issue incertaine | Admins avec refunds.manage et tout SUPERADMIN | cloche, push, email | indispensable | Aucun. | « Versement incertain » | oui |
| `ADMIN_WITHDRAWAL_REJECTED` | Retrait refusé | Admins avec refunds.manage et tout SUPERADMIN | cloche, email | indispensable | Aucun. | « Retrait refusé par l'opérateur » | oui |
| `ADMIN_FINANCE_DEBT` | Créance créée sur un compte | Admins avec payments.read et tout SUPERADMIN | cloche, email | indispensable | Aucun. | « Créance sur un compte » | oui |
| `ADMIN_NOTIFICATION_FAILED` | Notification en échec après 5 tentatives | Admins avec notifications.read et tout SUPERADMIN | cloche | indispensable | Aucun. | « Envoi en échec » | non |
| `ADMIN_SMS_DAILY_THRESHOLD` | Aucun émetteur dans le code actuel | Sans objet | cloche, email | indispensable | Aucun. | « Volume de SMS élevé » | oui |
| `ADMIN_SMS_CAP_GLOBAL` | Plafond global de SMS atteint par un code | Admins avec notifications.read et tout SUPERADMIN | cloche | indispensable | Aucun. | « Plafond de SMS atteint » | non |
| `ADMIN_SMS_CAP_NON_OTP` | Part hors code du plafond atteinte | Admins avec notifications.read et tout SUPERADMIN | cloche | indispensable | Aucun. | « Quota de SMS hors code atteint » | non |
| `ADMIN_SMS_OPTIONAL_80` | 80 % du budget des SMS optionnels atteint | Admins avec notifications.read et tout SUPERADMIN | cloche, email | indispensable | Aucun. | « SMS optionnels : 80 % du plafond » | oui |
| `ADMIN_SMS_FORECAST` | Rappels SMS de demain au-delà du budget restant | Admins avec notifications.read et tout SUPERADMIN | cloche, email | indispensable | Aucun. | « Budget SMS de demain insuffisant » | oui |

Messages immédiats, 7 types, envoyés pendant la requête. Pas de relance automatique ni manuelle (`lib/notifications/catalog.ts:1248-1270`). Le numéro `OTP_AUTH_HOOK` est NON VÉRIFIÉ sur le projet hébergé : `supabase/config.toml` n'active pas de hook d'envoi SMS, et ce réglage ne se lit que sur le projet.

| Type | Déclencheur | Destinataire | Canaux | Indispensable ou optionnel | Texte exact du SMS (caractères, segments) | Titre dans la cloche | Email |
|---|---|---|---|---|---|---|---|
| `OTP_LOGIN` | Connexion par code ; vérification du numéro avant un transfert | Le numéro saisi | SMS | indispensable | « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) | Aucun. | non |
| `OTP_REGISTER` | Inscription d'un client ou d'un partenaire | Le numéro saisi | SMS | indispensable | « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) | Aucun. | non |
| `OTP_PASSWORD_RESET` | Mot de passe oublié | Le numéro du compte | SMS | indispensable | « Event Village : votre code de réinitialisation du mot de passe est 483920. Valable 10 minutes. » (94 caractères, 1 segment) | Aucun. | non |
| `OTP_WITHDRAWAL` | Demande de retrait | Le numéro du compte, jamais un numéro saisi | SMS | indispensable | « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) | Aucun. | non |
| `OTP_PHONE_CHANGE` | Changement de numéro | Le nouveau numéro | SMS | indispensable | « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) | Aucun. | non |
| `OTP_AUTH_HOOK` | Service de codes de l'authentification | Le numéro de l'appel | SMS | indispensable | « Event Village : votre code de vérification est 483920. Valable 10 minutes. » (74 caractères, 1 segment) | Aucun. | non |
| `CONTROLLER_INVITE` — avec prénom (Ibrahima), URL 23 | Invitation d'un contrôleur sans compte, ou d'un compte pas encore activé | Le numéro du contrôleur | SMS | indispensable | « Event Village : Bonjour Ibrahima, vous etes invite comme controleur. Code : 483920 (valable 24h). Activez votre compte : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (183 caractères, 2 segments) | Aucun. | non |
| `CONTROLLER_INVITE` — sans prénom, URL 23 | Même invitation, sans prénom | Le numéro du contrôleur | SMS | indispensable | « Event Village : Vous etes invite comme controleur. Code : 483920 (valable 24h). Activez votre compte : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (165 caractères, 2 segments) | Aucun. | non |
| `CONTROLLER_INVITE` — avec prénom (Ibrahima), URL 27 | Même invitation, avec une adresse de 27 caractères | Le numéro du contrôleur | SMS | indispensable | « Event Village : Bonjour Ibrahima, vous etes invite comme controleur. Code : 483920 (valable 24h). Activez votre compte : https://app.eventvillage.sn/controller/setup?phone=%2B221771234567 » (187 caractères, 2 segments) | Aucun. | non |
| `CONTROLLER_INVITE` — prénom hors GSM-7 (Maïmouna) | Même invitation, prénom hors de l'alphabet SMS de base | Le numéro du contrôleur | SMS | indispensable | « Event Village : Bonjour Maïmouna, vous etes invite comme controleur. Code : 483920 (valable 24h). Activez votre compte : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (183 caractères, 3 segments) | Aucun. | non |
| `CONTROLLER_INVITE` — prénom hors GSM-7 (Ousmanê) | Même invitation, prénom hors de l'alphabet SMS de base | Le numéro du contrôleur | SMS | indispensable | « Event Village : Bonjour Ousmanê, vous etes invite comme controleur. Code : 483920 (valable 24h). Activez votre compte : https://eventvillage.sn/controller/setup?phone=%2B221771234567 » (182 caractères, 3 segments) | Aucun. | non |

Un type n'a aucun émetteur dans le code actuel : `ADMIN_SMS_DAILY_THRESHOLD` (`M/20261105000002_lot7_sms.sql:449`). Aucun SMS ne part hors des deux tableaux ci-dessus.

# Annexe C. Les écrans par rôle

Valeurs : **oui** ; **login** = renvoi à la connexion ; **acc.** = renvoi à l'accueil avec le message d'accès ; **esp.** = renvoi vers son propre espace ; **404** = page introuvable ; **err** = la page s'ouvre, le serveur refuse ou ne trouve rien. Colonnes : V visiteur, C client, P partenaire validée, R contrôleur seul, A admin, S SUPERADMIN.

Une page peut s'ouvrir et rester vide si le serveur refuse : les permissions d'un admin sont lues par le serveur, jamais par la page. Preuve : `middleware.ts:219-223`, `lib/admin/admin-auth.ts:204-210`. Le rendu réel de chaque page est NON VÉRIFIÉ : aucune page n'a été ouverte pour ce document, tout vient de la lecture du code.

Valeurs : **oui** ; **login** = renvoi à la connexion ; **acc.** = renvoi à l'accueil avec le message d'accès ; **esp.** = renvoi vers son propre espace ; **404** = page introuvable ; **err** = la page s'ouvre, l'API refuse ou ne trouve rien (détail en section 2 à 7).

Colonnes : V visiteur, C client, P partenaire validé, R contrôleur seul, A ADMIN, S SUPERADMIN.

| Adresse | V | C | P | R | A | S |
|---|---|---|---|---|---|---|
| `/` | oui | oui | oui | oui | oui | oui |
| `/explore` | oui | oui | oui | oui | oui | oui |
| `/events/{id}` | oui si public, sinon 404 | oui si public, sinon 404 | oui si public, sinon 404 | oui si public, sinon 404 | oui si public, sinon 404 | oui si public, sinon 404 |
| `/billet/hors-ligne` | oui | oui | oui | oui | oui | oui |
| `/login` | oui | esp. | esp. | esp. | esp. | esp. |
| `/register` | oui | esp. | esp. | esp. | esp. | esp. |
| `/forgot-password` | oui | esp. | esp. | esp. | esp. | esp. |
| `/reset-password` | login sans session de récupération | oui | oui | oui | oui | oui |
| `/partner/register` | oui | message « Vous êtes déjà connecté » | message « Vous êtes déjà connecté » | message « Vous êtes déjà connecté » | message « Vous êtes déjà connecté » | message « Vous êtes déjà connecté » |
| `/controller/setup` | oui | acc. | acc. | oui | oui | oui |
| `/tickets` | login | oui | oui | oui | oui | oui |
| `/tickets/claim/{token}` | login | renvoi `/tickets?tab=recus` | renvoi `/tickets?tab=recus` | renvoi `/tickets?tab=recus` | renvoi `/tickets?tab=recus` | renvoi `/tickets?tab=recus` |
| `/wallet` | login | oui | oui | oui | oui | oui |
| `/paiement/{id}` | login | oui, son paiement | oui, son paiement | oui, son paiement | oui, son paiement | oui, son paiement |
| `/notifications` | login | oui | oui | oui | oui | oui |
| `/profile` | login | oui | oui | oui | oui | oui |
| `/profile/notifications` | login | oui | oui | oui | oui | oui |
| `/profile/payments` | login | oui | oui | oui | oui | oui |
| `/orders` (interrupteurs) | login | 404 tant que les 3 sont fermés | 404 tant que les 3 sont fermés | 404 tant que les 3 sont fermés | 404 tant que les 3 sont fermés | 404 tant que les 3 sont fermés |
| `/halls`, `/halls/{id}` (interrupteur) | 404 | 404 | 404 | 404 | 404 | 404 |
| `/restaurants/{id}/menu`, `/restaurants/{id}/tables` (interrupteurs) | 404 | 404 | 404 | 404 | 404 | 404 |
| `/partner`, `/partner/dashboard` | login | acc. | oui | acc. | err | err |
| `/partner/events` | login | acc. | oui | acc. | err | err |
| `/partner/events/new`, `/partner/events/{id}/edit` | login | acc. | oui | acc. | err à l'enregistrement | err à l'enregistrement |
| `/partner/events/{id}` (pilotage) | login | acc. | oui, ses événements | acc. | oui par l'adresse | oui par l'adresse |
| `/partner/events/{id}/team`, `/caisse` | login | acc. | renvoi à l'onglet du pilotage | acc. | acc. | acc. |
| `/partner/finance` | login | acc. | oui | acc. | oui, soldes nuls | oui, soldes nuls |
| `/partner/stats`, `/partner/subscription`, `/partner/profile` | login | acc. | oui | acc. | err | err |
| `/partner/team` | login | acc. | oui | acc. | oui, tous les événements | oui, tous les événements |
| `/partner/calendar` | login | acc. | oui | acc. | err | err |
| `/partner/scan`, `/scan` | login | acc. | oui | err + lien scanner | err + lien scanner | err + lien scanner |
| `/partner/halls*`, `/partner/products*`, `/partner/orders`, `/partner/tables` (interrupteurs) | login | acc. | 404 | acc. | 404 | 404 |
| `/controller/scanner`, `/controller/profile` | login | acc. | acc. | oui | oui, sans événement | oui, sans événement |
| `/admin`, `/admin/dashboard` | login | acc. | acc. | acc. | oui, selon permissions | oui |
| `/admin/events`, `/admin/events/{id}` | login | acc. | acc. | acc. | `events.read` | oui |
| `/admin/users` | login | acc. | acc. | acc. | `users.read` | oui |
| `/admin/referral` | login | acc. | acc. | acc. | `users.read` | oui |
| `/admin/services` | login | acc. | acc. | acc. | `events.read` | oui |
| `/admin/finance` | login | acc. | acc. | acc. | `payments.read` | oui |
| `/admin/finance-settings` | login | acc. | acc. | acc. | lecture seule | oui |
| `/admin/pricing` | login | acc. | acc. | acc. | lecture, écriture `pricing.manage` | oui |
| `/admin/communications` | login | acc. | acc. | acc. | `communications.manage` | oui |
| `/admin/notifications`, `/admin/notifications/{id}` | login | acc. | acc. | acc. | `notifications.read` | oui |
| `/admin/audit` | login | acc. | acc. | acc. | err « Réservé au superadmin » | oui |

#### Pages du visiteur

| Adresse | Ce que montre la page | Retour | Test, essai |
|---|---|---|---|
| `/` | Titre, recherche « Rechercher un événement » et placeholder « Artiste, lieu, organisateur… », « À l’affiche », filtres de catégorie, blocs Populaires et ville (`HomeDiscovery`), appel aux organisateurs, carte salles si ouverte, pied de page. Message d'accès refusé (`AccessNotice`). `app/page.tsx:165`, :176, :215, :311, :318, :342, :367 | menu | `tests/parcours/decouverte-ecrans.test.ts:317`. Essais 3, 64, 65. Guide 8.14 |
| `/explore` | « Explorer les événements », recherche, « Ville », « Trier par », catégories, résultats. `app/explore/page.tsx:189`, :198, :226, :232 | menu | `tests/parcours/decouverte-recherche.test.ts:88`. Essais 3, 4 |
| `/events/{id}` | Affiche, titre, « À propos de l’événement », « Programme », « Lieu et accès », « Organisateur », panneau « Choisissez vos billets » ou « Billetterie ». 404 serveur si non public (`app/events/[id]/layout.tsx:12-16`). `app/events/[id]/page.tsx:818`, :835, :840, :865, :923, :934, :1071 | « Retour aux événements » :751 | `tests/parcours/evenement-404.test.ts:198`. Essais 5, 6, 13, 21 |
| `/login` | « Connexion », « Accédez à vos billets, commandes, réservations et portefeuille. » `app/login/page.tsx:34-35` | menu | Essai 2. Guide 7 |
| `/register` | « Créer un compte » en deux étapes (numéro, code et informations), lien de connexion. `app/register/page.tsx:244-250`| menu | Essai 7. Guide 8.6 |
| `/forgot-password` | « Mot de passe oublié », téléphone ou email, « Retour à la connexion ». `app/forgot-password/page.tsx:387`, :589 | oui | Essai 8 |
| `/reset-password` | « Nouveau mot de passe ». Sans session : `/login?error=session_expired` (`app/reset-password/page.tsx:117`, :338) | menu | Essai 8 |
| `/partner/register` | « Devenir partenaire Event Village », dossier et pièces, écran « Vous êtes déjà connecté » pour un connecté. `app/partner/register/page.tsx:348`, :352-365 | « Se connecter » :552, menu | `e2e/recette.spec.ts:323`. Essai 9 |
| `/controller/setup` | « Activer votre compte contrôleur », code et mot de passe. Après succès « Compte activé ». `app/controller/setup/page.tsx:155`, :171 | « Mon espace client », « Se connecter » :263 | Essai 29|
| `/billet/hors-ligne` | « Billet hors ligne », QR des billets enregistrés sur le téléphone, page sans coquille, sans donnée serveur. `app/billet/hors-ligne/page.tsx:95` | « Mes billets » seulement si réseau, :87-92 | `e2e/terrain.spec.ts:119`. Essais 26, 32. Guide 11 |

#### Pages de tout compte connecté (client)

| Adresse | Ce que montre la page | Retour | Test, essai |
|---|---|---|---|
| `/tickets` | « Mes billets », onglets « À venir », « Tous mes billets », « Historique », « Reçus ». Carte : événement, organisateur, date, heure, lieu, catégorie, numéro, statut, QR, transfert, PDF, partage. Pas de prix (revue critique). `app/tickets/page.tsx:233-236`, :258 ; `components/tickets/TicketCard.tsx:60-85` | menu | `tests/parcours/acces-qr.test.ts:340`. Essais 16, 19, 23, 24, 26, 27, 45, 63 |
| `/tickets/claim/{token}` | Rien : ancienne réclamation par lien, renvoi à `/tickets?tab=recus`. `app/tickets/claim/[token]/page.tsx:12` | | |
| `/paiement/{id}` | Page d'attente et de résultat. États « Lien de paiement invalide », « Connexion requise », « Accès refusé », « Paiement introuvable », « Statut momentanément indisponible ». `app/paiement/[id]/page.tsx:664`, :692, :702, :713, :729| boutons de fin, menu | Essais 16, 18, 19. Guide 8.3, 8.4 |
| `/wallet` | « Portefeuille de parrainage » : soldes, « Votre lien de parrainage », retrait, « Mes retraits », « Historique du compte ». Compte PARRAINAGE seulement (`app/wallet/page.tsx:55`). `app/wallet/page.tsx:516`, :893, :969, :1009 | menu | `tests/parcours/finance-commissions.test.ts:475`. Essais 49, 50 |
| `/notifications` | « Notifications », filtres par catégorie, marquer lu. `app/notifications/page.tsx:344` | menu | Essais 14, 48 |
| `/profile` | « Mon profil » : coordonnées, photo, numéro, thème, raccourcis selon le rôle. `app/profile/page.tsx:164-208`, :211 | menu | `tests/parcours/compte-profil.test.ts:186`. Essais 66, 67, 68. Guide 8.13, 8.15 |
| `/profile/notifications` | « Préférences de notification ». `app/profile/notifications/page.tsx:245` | « Mon profil » | `tests/parcours/notif-preferences.test.ts:367`. Essai 47 |
| `/profile/payments` | « Mes paiements », totaux, liste paginée. `app/profile/payments/page.tsx:77` | « Mon profil » | `tests/parcours/compte-paiements.test.ts:132`. Essai 69. Guide 8.12 |

#### Pages du partenaire

| Adresse | Ce que montre la page | Retour | Test, essai |
|---|---|---|---|
| `/partner` | Rien : renvoi à `/partner/dashboard`. `app/partner/page.tsx:4` | | |
| `/partner/dashboard` | Surtitre « Espace organisateur », indicateurs « Ventes en ligne », « Net partenaire », « Billets vendus », « Disponible au retrait », événements, activité, « Export comptable ». Bandeaux d'état du compte. `app/partner/dashboard/page.tsx:232`, :319-343 | menu | `tests/parcours/partenaire-lot7.test.ts:750`. Essai 41 |
| `/partner/events` | « Mes événements », indicateurs, onglets par statut, « Créer un événement ». `app/partner/events/page.tsx:188`, :193, :218-221 | menu | Essais 12, 13. Guide 8.1, 8.2 |
| `/partner/events/new`, `/partner/events/{id}/edit` | « Créer un événement » ou « Modifier l’événement », quatre étapes. `components/events/EventForm.tsx:650-652` | « Retour à mes événements » | `tests/parcours/edition-formulaire.test.ts:378`. Essais 11, 14|
| `/partner/events/{id}` | Pilotage, onglets « Aperçu », « Ventes », « Invitations », « Entrées », « Équipe », « Caisse », « Clôture ». `app/partner/events/[id]/page.tsx:46-53` | « Mes événements » | `tests/parcours/pilotage-apercu-ventes.test.ts:76`. Essais 15, 39, 40, 41, 44, 46, 59, 62. Guide 8.8 bis, 8.10, 8.11 |
| `/partner/events/{id}/team`, `/caisse` | Rien : renvoi aux onglets `equipe`, `caisse`. `app/partner/events/[id]/team/page.tsx:8`, `caisse/page.tsx:8` | | |
| `/partner/scan` | « Contrôle des entrées », « Événement contrôlé », « Caméra », « Saisie manuelle », compteur. Événements PUBLIE du partenaire. `app/partner/scan/page.tsx:121`, :366-369 | « Tableau de bord » | `tests/parcours/scan-controleur-stats.test.ts:414`|
| `/scan` | Rien : renvoi à `/partner/scan`. `app/scan/page.tsx:4` | | |
| `/partner/finance` | « Finances » : soldes, retrait en étapes, « Mes retraits », « Historique du compte ». `app/partner/finance/page.tsx:454`, :788, :835 | menu | `tests/parcours/finance-retraits.test.ts:301`. Essais 42, 43 |
| `/partner/team` | « Équipe de contrôle », recherche, inviter, gérer les affectations. `app/partner/team/page.tsx:516`, :696 | menu | Essai 15|
| `/partner/stats` | Indicateurs « CA Total », « Billets vendus », « Commandes », « Réservations salles », répartition, « Catalogue Produits ». `app/partner/stats/page.tsx:245-248`, :364 | menu | aucun test d'affichage trouvé. Aucun essai |
| `/partner/calendar` | « Calendrier Événementiel », « Nouvel événement ». `app/partner/calendar/page.tsx:42` | menu | aucun. Aucun essai |
| `/partner/subscription` | « Abonnement », essai, offres publiées, « Le changement d’offre se fait avec l’équipe Event Village : il n’est pas encore possible en ligne. » `app/partner/subscription/page.tsx:74`, :223 | menu | aucun. Aucun essai |
| `/partner/profile` | « Page professionnelle », « Votre présentation publique sur Event Village : nom, activités, contact et visuels. » `app/partner/profile/page.tsx:160-161` | menu | `tests/parcours/partenaire-profil-rpc.test.ts:208`. Aucun essai |

#### Pages du contrôleur

| Adresse | Ce que montre la page | Retour | Test, essai |
|---|---|---|---|
| `/controller/scanner` | Choix de l'événement, onglets du contrôleur, scan plein écran, guichet, caisse, ou « Aucun événement assigné ». Thème sombre forcé. `app/controller/scanner/page.tsx:773`, :1026 ; `app/controller/layout.tsx:49` | « Mon espace client », « Retour à l’accueil » si vide | `e2e/terrain.spec.ts:119`. Essais 30 à 38. Guide 8.8, 8.9|
| `/controller/profile` | « Mon profil » : informations, événements, mot de passe. `app/controller/profile/page.tsx:187-189` | « Scanner » | Essai 34 |

Barre du bas d'un compte qui a le rôle contrôleur, hors espace contrôleur : « Accueil », « Explorer », « Scanner », « Billets », « Profil » (`AppLayout.tsx:178-184`).

#### Pages de l'administration (ADMIN, selon permissions)

| Adresse | Permission API | Ce que montre la page | Retour | Test, essai |
|---|---|---|---|---|
| `/admin` | | Rien : renvoi à `/admin/dashboard`. `app/admin/page.tsx:4` | | |
| `/admin/dashboard` | `statistics.read`, `partners.read`, `events.read` | « Tableau de bord » : « À traiter », « Indicateurs » (« Volume des transactions », « Revenu net de la plateforme », « Partenaires validés », « Utilisateurs inscrits »), « Candidatures des partenaires », onglets « En attente », « Validés », « Refusés », « Tous », « Raccourcis ». `app/admin/dashboard/page.tsx:350-353`, :441, :460, :494, :504-528, :586 | menu | `tests/parcours/notif-pros.test.ts:665`. Essai 10 |
| `/admin/events` | `events.read` | « Événements », 8 onglets par statut, recherche. `app/admin/events/page.tsx:331` | menu | `tests/parcours/admin-evenements.test.ts:346`. Essais 12, 13 |
| `/admin/events/{id}` | `events.read`, actions `events.write` | Fiche : « Dates et lieu », « Description », « Programme », « Catégories et prix », « Affiche », « Organisateur », « Historique des statuts ». `app/admin/events/[id]/page.tsx:582-705` | « Retour aux événements » | `tests/parcours/admin-evenements.test.ts:464`. Essais 12, 13 |
| `/admin/users` | `users.read`, écriture `users.write` | « Gestion des Utilisateurs & Permissions RBAC », filtres par rôle, créer un compte, suspendre, supprimer, permissions. `app/admin/users/page.tsx:256`, :300, :458, :728 | chevron vers `/admin/dashboard` :246 | `tests/parcours/securite-admin-lot7.test.ts:177`. Essai 55 |
| `/admin/referral` | `users.read`, statut SUPERADMIN | « Gestion des Ambassadeurs & Parrainage », compteurs, bascule du statut. `app/admin/referral/page.tsx:118`, :146-157 | chevron :108 | `tests/parcours/admin-parrainage.test.ts:239`. Essai 51 |
| `/admin/services` | `events.read` | « Catalogues et services », cinq onglets en lecture. `app/admin/services/page.tsx:31-35`, :281 | « Tableau de bord » | `tests/parcours/admin-services-mention.test.ts:189`. Aucun essai |
| `/admin/finance` | `payments.read`, relance `refunds.manage` | « Rapprochement financier », synthèse, « Remboursements à reprendre », « Paiements rapprochés », lien « Réglages de la plateforme ». `app/admin/finance/page.tsx:141`, :144, :236 | « Tableau de bord » | `tests/parcours/admin-remboursements.test.ts:180`. Essais 56, 58, 60. Guide 8.11 |
| `/admin/pricing` | lecture libre, `pricing.manage` | « Tarifs, Packs Partenaires & Monétisation (§117-§126) », trois sections à enregistrer. `app/admin/pricing/page.tsx:114`, :137, :217, :267 | chevron :104 | `tests/parcours/finance-reglages.test.ts:91` (réglages `finance.*` seulement). Aucun essai |
| `/admin/communications` | `communications.manage` | « Campagnes de communication », brouillon seul, « Envoi des campagnes désactivé ». `app/admin/communications/page.tsx:202`, :218 | « Administration » | aucun. Aucun essai |
| `/admin/notifications` | `notifications.read` | « Notifications », compteurs SMS, onglets de statut, filtres, par jour. `app/admin/notifications/page.tsx:445`, :469-483 | menu | `tests/parcours/notif-admin.test.ts:293`. Essai 54 |
| `/admin/notifications/{id}` | `notifications.read`, relance `notifications.write` | Détail : « Envoi », « Destinataire », « Décision », « Contenu », « Tentatives ». `app/admin/notifications/[id]/page.tsx:465-519` | lien de retour | Essai 54 |

Barre du bas de l'administration : « Accueil », « Validation », « Comptes », « Finance », « Audit » si SUPERADMIN (`AppLayout.tsx:170-176`, :334).

#### Pages du SUPERADMIN seul

| Adresse | Ce que montre la page | Retour | Test, essai |
|---|---|---|---|
| `/admin/audit` | « Journal d'Audit Inaltérable & Traçabilité », filtres action et objet, table, détail en JSON. ADMIN : « Réservé au superadmin ». `app/admin/audit/page.tsx:118`, :140, :219-220 | chevron :108 | `tests/parcours/admin-audit-lot9.test.ts:77`. Essai 57 |
| `/admin/finance-settings` | « Réglages de la plateforme » : finance, contrôle d'accès, notifications, fonctionnalités, avec historique. ADMIN : lecture, enregistrement refusé. `app/admin/finance-settings/page.tsx:245`, :94-97 ; `app/api/admin/finance-settings/route.ts:21`, :46 | « Administration » | `tests/parcours/finance-reglages.test.ts:91`, :159. Essais 52, 53 |

Actions réservées au SUPERADMIN sur des pages communes : créer un compte SUPERADMIN (`app/api/admin/users/route.ts:121`), statut Ambassadeur, permissions (`app/api/admin/permissions/route.ts:48`), lien « Journal d’audit » (`AppLayout.tsx:198`, :237).

#### Pages masquées ou hors billetterie

| Adresse | Interrupteur | État par défaut | Preuve |
|---|---|---|---|
| `/halls`, `/halls/{id}`, `/partner/halls`, `/partner/halls/new`, `/partner/halls/{id}/edit` | `features.halls_enabled` | fermé, 404 | `app/halls/layout.tsx`, `app/partner/halls/layout.tsx` |
| `/restaurants/{id}/tables`, `/partner/tables` | `features.tables_enabled` | fermé, 404 | `app/restaurants/[id]/tables/layout.tsx`, `app/partner/tables/layout.tsx` |
| `/restaurants/{id}/menu`, `/partner/products`, `/partner/products/new`, `/partner/orders` | `features.orders_enabled` | fermé, 404 | `app/restaurants/[id]/menu/layout.tsx`, `app/partner/products/layout.tsx`, `app/partner/orders/layout.tsx` |
| `/orders` | les trois : 404 si tous fermés, onglets selon ceux ouverts | fermé, 404 | `app/orders/layout.tsx`, `app/orders/page.tsx:40-43` |
| `/dev/paiements`, `/dev/paiements/{id}` | mode simulé en développement, jamais en production | absent | `app/dev/paiements/page.dev.tsx`, `next.config.mjs:102` |
| `/admin/services` onglets salles, tables, produits, commandes | visibles même fermés, bandeau « Service désactivé » | | `app/admin/services/page.tsx:228` |

Non coupés par un interrupteur, par construction (`lib/features/flags.ts:17-19`) : webhook, statut et annulation de paiement, tâches planifiées, supervision admin, statistiques, tableau de bord partenaire. Page d'abonnement `/partner/subscription` et `/partner/profile` : hors billetterie, sans interrupteur.

NON VÉRIFIÉ : la valeur réelle des interrupteurs sur event-village-dev. Seul le défaut `false` est établi par le code. Raison : aucune lecture du projet distant n'est autorisée.

L'adresse de support à utiliser réellement est NON VÉRIFIÉ : deux domaines figurent dans le code (revue critique), et leur validité n'est pas établie.

# Annexe D. Le coût SMS du scénario

Scénario : un événement, 100 billets payants, 20 gratuits, 5 invitations, 3 transferts, puis une annulation.

**On compte par commande ou par compte, pas par billet.** Le nombre dépend donc de la façon dont les billets sont achetés. Deux hypothèses bornent le résultat. Plafond par commande par défaut : 10 billets (`lib/validations/event.ts:57`).

- Hypothèse H1, la plus chère : 100 commandes d'un billet, 20 comptes qui prennent un billet gratuit, 5 numéros invités (un billet chacun, sans compte, non réclamés), 3 transferts acceptés d'un billet payant vers 3 comptes sans billet.
- Hypothèse H2 : 25 commandes de 4 billets, 5 réservations de 4 billets gratuits, 5 invitations réparties sur 2 numéros, 3 transferts vers 3 comptes nouveaux, l'expéditeur gardant ses autres billets.
- Dans les deux cas : annulation avant la veille à 10 h, donc aucun rappel ; heures de jour pour le SMS optionnel ; réglages par défaut.

| Étape | Type | H1 | H2 | Indispensable ou optionnel | Preuve |
|---|---|---|---|---|---|
| Validation par l'admin | `EVENT_VALIDATED` | 1 | 1 | indispensable | `M/20261103000005_lot6_billetterie.sql:1248` |
| Première vente | `FIRST_TICKET_SOLD` | 1 | 1 | optionnel | `M/20261103000005_lot6_billetterie.sql:852` |
| Paiements | `PURCHASE_CONFIRMED` | 100 | 25 | indispensable | `M/20261106000003_lot8_paiement.sql:231` |
| Billets gratuits | `FREE_TICKETS_CONFIRMED` | 20 | 5 | indispensable | `M/20261105000007_lot7_confirmation.sql:264` |
| Invitations | `INVITATION_RECEIVED` | 5 | 2 | indispensable | `M/20261108000002_lot9_invitations.sql:478` |
| Transferts, offre | `TRANSFER_OFFERED` | 3 | 3 | indispensable | `M/20261103000005_lot6_billetterie.sql:149` |
| Transferts, acceptation | aucun SMS | 0 | 0 | | |
| Annulation | `EVENT_CANCELLED` | 120 | 33 | indispensable | `M/20261103000005_lot6_billetterie.sql:1297-1303` |
| Remboursements | `REFUND_PAID` | 100 | 25 | indispensable | `M/20261103000006_lot6_pros_admin.sql:410` |
| **Total** | | **350** | **95** | 349 indispensables + 1 optionnel en H1 | |

Annulation H1 : 100 acheteurs + 20 détenteurs gratuits. H2 : 25 + 3 + 5. Les invités sans compte ne reçoivent rien. Tous ces SMS tiennent en un segment avec les données d'exemple.

Ajouts selon les cas :

| Cas | H1 | H2 |
|---|---|---|
| Invités avec compte vérifié, ou invitation déjà réclamée | + 5 | + 2 |
| Annulation après la veille à 10 h : rappel de la veille | + 100 | + 28 |
| Annulation après H-3 : rappel de 3 heures | + 0 à + 100 | + 0 à + 28 |
| Catégorie ou événement complet | + 1 par catégorie, + 1 | + 1 par catégorie, + 1 |
| Comptes à créer | + 1 code par nouveau compte | + 1 code par nouveau compte |
| Contrôleurs | invitation sur 2 segments, affectation, activation, mot de passe, rappel | invitation sur 2 segments, affectation, activation, mot de passe, rappel |

Maximum H1 avec invités ayant un compte et les deux rappels sans push : 350 + 5 + 100 + 100 = **555 SMS**, dont 201 optionnels, sous le budget de 700.

**Sensibilité.** Un seul caractère hors de l'alphabet SMS de base dans le titre fait passer chaque SMS qui le cite sur 2 ou 3 segments. Avec le titre `Gala Teranga 🎉`, H1 passe à **908 segments** pour 350 SMS. Preuve : `lib/notifications/sms-format.ts:74`, `:131`.

**Ce qui reste inconnu.**

- Le prix MTarget est NON VÉRIFIÉ : aucun tarif du fournisseur n'est dans le code. La seule valeur, `SMS: { cost: 8, price: 15, margin: 7 }`, est l'état initial d'un formulaire d'administration (`app/admin/pricing/page.tsx:41`) qui n'est jamais lu par l'envoi. À titre d'ordre de grandeur non prouvé, 8 F donneraient 2 800 F pour 350 SMS.
- La facturation par segment ou par message est NON VÉRIFIÉ : le dépôt enregistre le nombre de segments, pas de prix (`lib/notifications/dispatcher.ts:303-308`).
- Aucun accusé de réception n'existe : un SMS accepté par MTarget compte comme envoyé qu'il arrive ou non.
- Un SMS à l'issue incertaine est peut-être facturé.
- Le tarif selon l'opérateur du destinataire et le volume ne sont pas dans le code.

# Revue critique

Rédigée sur `7cca60f`, cette section n'est pas réécrite : chaque constat garde son texte d'origine, qui décrit le code d'avant le lot 9 bis. La dernière colonne dit ce que le lot 9 bis en a fait : corrigé (avec la tâche de la consigne et le test qui le prouve), non reproduit (le test n'a pas confirmé le constat), ou renvoyé à un lot suivant. Les étapes des chapitres 0 à 18 décrivent, elles, le comportement après le lot 9 bis. Cette section rassemble ce qui manque, ce qui est en double, ce qui est incohérent, et les risques vus en chemin. Les constats qui se recoupaient ont été fusionnés en une seule ligne. Les renvois « déjà A… » visent les anomalies A1 à A41 de `docs/recette-billetterie.md`. Tous les constats « bloquante » et « élevée » ci-dessous ont été relus dans le code au moment de la rédaction.

Gravités : **bloquante** = perte d'argent, faille ou impasse sans contournement, à ne pas lancer sans la traiter ; **élevée** = à traiter avant le lancement sauf décision écrite ; **moyenne** et **faible** = à arbitrer.

| N° | Type | Où | Constat | Conséquence pour l'utilisateur | Proposition | Gravité | État au lot 9 bis |
|---|---|---|---|---|---|---|---|
| R1 | risque pour l'argent, impasse | `lib/payments/cashout.service.ts:208-215`, `:281-283`, `:311` ; `app/api/admin/refunds/route.ts:9-10` ; `components/partner/pilotage/TicketRefundPanel.tsx:122` | Un versement de remboursement d'annulation ou de billet resté « à envoyer » sans motif de blocage n'est repris par rien : la reprise automatique ne prend qu'un seul type de remboursement, la liste de relance exige un motif, aucune alerte ne part. Cela arrive si le solde SamirPay ne se lit pas une seule fois, ou si la requête s'arrête avant la fin du lot. Vrai aussi pour un retrait. L'écran promet « L’équipe Event Village reprend ce versement. » | Tout un événement peut rester sans remboursement. Les clients ont lu « Remboursement automatique en cours. », l'écran dit « En cours » pour toujours, personne n'est prévenu, l'argent n'est jamais rendu | Étendre la reprise à tous les types de versement, et lister ces lignes au-delà d'un délai | bloquante | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) ; le cas « requête interrompue » n'est pas reproduit tel quel, il est couvert par la reprise de tous les versements |
| R2 | risque pour la sécurité et l'argent | `app/api/partner/events/[id]/transition/route.ts:22-50` ; `app/api/partner/events/[id]/cancel/route.ts:25-49` ; `middleware.ts:124` ; `M/20261102000003_lot5_cycle.sql:191-205` ; `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:34-35` ; `M/20261102000005_lot5_pilotage.sql:135-157` | Un admin sans aucune permission peut valider, suspendre ou annuler par l'adresse réservée à la partenaire, rembourser un billet, ouvrir le pilotage et exporter les contacts. La permission n'est contrôlée que sur les adresses d'administration. Aucun test ne vérifie qu’un admin sans permission est refusé ; `tests/parcours/pilotage-acces.test.ts:132` et `tests/parcours/finance-remboursement-billet.test.ts:147` valident l’accès admin sans regarder la permission | Un compte admin en lecture seule peut déclencher le remboursement de tous les acheteurs d'un événement et lire les téléphones des clients | Sur les adresses réservées à la partenaire, n'accepter que la propriétaire ou vérifier la permission ; exiger `refunds.manage` pour rembourser | élevée | corrigé au lot 9 bis (tâche 11, `tests/parcours/droits-partenaire-9bis.test.ts`) |
| R3 | impasse | `M/20261102000003_lot5_cycle.sql:49-65`, `:844` ; `M/20261103000005_lot6_billetterie.sql:1036-1037` ; `tests/parcours/cycle-cron.test.ts:220` | Un événement suspendu dont la date passe n'a plus de sortie normale : il ne passe jamais à « Terminé » et « Réactiver », encore affiché, est refusé. Il reste l'annulation, qui rembourse tout, ou un faux report par la partenaire | Un litige réglé après la date force un remboursement intégral, même si l'événement a eu lieu. Les détenteurs n'ont jamais « la suite » annoncée | Passage admin de « Suspendu » à « Terminé », avec motif et message | élevée | corrigé au lot 9 bis (tâche 20, `tests/parcours/cycle9bis-cloture-admin.test.ts`) |
| R4 | risque pour l'argent | `M/20261101000014_lot4_correctif_retraits_concurrents.sql:12-137` ; `M/20261101000004_lot3_grand_livre.sql:107-132` ; `M/20261101000002_lot3_reglages.sql:67-68` | La suspension ne gèle pas l'argent : les ventes deviennent retirables à fin + 48 heures, quel que soit le statut | Un événement suspendu pour fraude peut être vidé ; une annulation laisse ensuite une créance à Event Village | Bloquer les fonds d'un événement suspendu | élevée | corrigé au lot 9 bis (tâche 2, `tests/parcours/lot9bis-fonds-suspension.test.ts`) |
| R5 | règle absente, risque pour l'argent | `M/20261106000001_lot8_canaux.sql:211-277` ; `M/20261102000003_lot5_cycle.sql:1112-1117` ; `app/api/events/route.ts:38-41` ; `app/partner/dashboard/page.tsx:295-300` | Les événements d'une partenaire suspendue restent publics et en vente, et les ventes continuent de lui être créditées. Le bandeau, jamais affiché, affirme le contraire | Une partenaire suspendue pour fraude continue d'encaisser | Décider une règle (suspendre ses événements, ou bloquer la vente), puis l'appliquer ; corriger le texte | élevée | corrigé au lot 9 bis (tâche 2, `tests/parcours/lot9bis-fonds-suspension.test.ts`) ; non reproduit pour la partie « retrait » : un retrait demandé était déjà refusé à un compte suspendu (`M/20261101000014_lot4_correctif_retraits_concurrents.sql:63-71`) |
| R6 | message manquant, écran absent | `app/admin/users/page.tsx:136-146`, `:423` ; `app/api/admin/users/route.ts:318-343` ; `app/api/admin/partners/[id]/status/route.ts:69` ; `app/admin/dashboard/page.tsx:286` | « Suspendre » à l'écran ne pose que le statut du compte : pas de motif, pas de confirmation, pas de message, permission différente. La vraie suspension (motif, messages) existe sans écran. L'Essai 55 passe malgré cela | Mariama est coupée sans explication, sans motif, sans SMS. La recette laisse croire que c'est correct | Boutons « Suspendre » et « Réactiver » sur la fiche partenaire, avec motif, vers la route existante | élevée | corrigé au lot 9 bis (tâche 15, `tests/parcours/fiche-partenaire-9bis.test.ts`) |
| R7 | texte incohérent, impasse apparente | `M/20261108000001_lot9_securite.sql:664-666` ; `app/api/partner/dashboard/route.ts:15` ; `lib/auth/session.ts:51` ; `app/partner/dashboard/page.tsx:263-269`, `:279-284` | Tout partenaire qui se connecte après son inscription lit « Tableau de bord indisponible », « Votre compte n'est pas actif. Contactez le support. ». Le bandeau « Compte en cours de vérification » n'est jamais affiché | Une partenaire qui vient de suivre le parcours croit à une panne ou à un refus. Toute nouvelle inscription est touchée | Admettre le statut « en attente » sur le tableau de bord, et ajouter un test avec un vrai compte en attente | élevée | corrigé au lot 9 bis (tâche 16, `tests/parcours/partenaire-en-attente.test.ts`) |
| R8 | risque pour la sécurité et l'argent | `lib/payments/confirmation.service.ts:91`, `:116` ; `lib/payments/payment.service.ts:139` ; `app/api/payments/create/route.ts:14-40` ; `M/20261103000006_lot6_pros_admin.sql:741-744` | Un paiement d'abonnement réussi écrit « Validé » sur le dossier, sans regarder le statut précédent. Un dossier refusé garde un compte actif : il peut payer un abonnement par appel direct, sans écran | Un dossier refusé par l'équipe obtient les droits de créer des événements et de retirer de l'argent | Ne pas toucher au statut du dossier à l'activation, et refuser l'abonnement hors dossier validé | élevée | corrigé au lot 9 bis (tâche 8, `tests/parcours/lot9bis-abonnement.test.ts`) |
| R9 | impasse | `components/admin/RefundsToRetry.tsx:173-177` ; `app/api/admin/refunds/route.ts:9-10`, `:106-109` ; `lib/notifications/catalog.ts:1057-1060` ; `lib/payments/withdrawal.service.ts:8-9` | Un versement à l'issue incertaine, ou bloqué pour opérateur, numéro ou nom manquant, n'a aucune action possible. Un retrait incertain n'apparaît même pas sur la page vers laquelle l'alerte renvoie. Suite de A3 (corrigée), sans résolution prévue | Billet « Remboursement en cours » et retrait réservé pour toujours, sauf intervention en base. Ces lignes restent en tête d'une liste limitée à 100 | Écran de décision « Marquer versé » ou « Renvoyer », réservé, justifié, journalisé, avec liste des retraits | élevée | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) |
| R10 | impasse, message manquant | `M/20261103000006_lot6_pros_admin.sql:382` ; `lib/payments/cashout.service.ts:216-220` | Un retrait bloqué (solde SamirPay, nom manquant) ne prévient personne : pas d'alerte, pas de liste, pas de reprise | Mariama voit « En cours d’envoi » indéfiniment, son argent reste réservé, personne ne sait qu'il faut agir | Alerte admin, liste « Retraits à reprendre », relance et rendu du solde | élevée | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) |
| R11 | risque pour l'argent | `M/20261108000001_lot9_securite.sql:21-129` ; `M/20261101000004_lot3_grand_livre.sql:166-218` ; `components/partner/pilotage/SalesTab.tsx:95-100` | Le remboursement d'un billet ne regarde ni la date de l'événement ni le solde : après un retrait, la partenaire peut encore rembourser tout billet non scanné, des semaines après la fin. L'argent sort du compte SamirPay, la créance n'est compensée que sur de futures ventes | Une partenaire malveillante, ou qui cesse son activité, laisse la plateforme payer | Refus au-delà du solde, ou validation d'un admin, et limite après la fin | élevée | corrigé au lot 9 bis (tâche 3, `tests/parcours/lot9bis-remboursement-fin.test.ts`) |
| R12 | message manquant | `M/20261108000001_lot9_securite.sql:432-436` ; `M/20261103000005_lot6_billetterie.sql:1299` ; `M/20261108000002_lot9_invitations.sql:463-466` ; `M/20261106000001_lot8_canaux.sql:438` | Les invités sans compte et les acheteurs au guichet ne sont jamais prévenus d'un changement de date ou de lieu, ni d'une annulation. Le numéro de l’invité existe en base ; celui de l’acheteur au guichet seulement si le vendeur l’a saisi. L'écran dit pourtant « {n} détenteurs de billets prévenus » | Modou se déplace à la mauvaise date, ou pour un événement annulé | SMS au numéro de l'invitation non réclamée et au numéro du reçu de guichet | élevée | corrigé au lot 9 bis (tâche 30, `tests/parcours/messages-annulation-9bis.test.ts`) |
| R13 | texte faux | `M/20261103000005_lot6_billetterie.sql:1307-1312` ; `M/20261101000005_lot3_remboursements.sql:248` ; `M/20261105000003_lot7_securite.sql:391` | À l'annulation, le destinataire d'un transfert lit « Votre remboursement est en cours. » alors que l'argent va à l'acheteur d'origine. Celui-ci, s'il n'a plus de billet, ne reçoit pas l'annonce d'annulation | Lamine attend un remboursement qui n'arrivera jamais, sans moyen de le savoir | Message distinct pour un billet reçu par transfert, et annonce à l'acheteur d'origine | élevée | corrigé au lot 9 bis (tâche 31, `tests/parcours/messages-annulation-9bis.test.ts`) |
| R14 | règle absente | `lib/notifications/catalog.ts:668` ; `M/20261105000002_lot7_sms.sql:293-304`, `:350-368` | Le SMS de changement de date ou de lieu est optionnel : il est perdu sans report entre 22 h et 8 h, au-delà du budget, ou si le client a coupé ce sujet | Un lieu changé à 23 h la veille n'arrive que par la cloche ou le push. Le client peut se présenter au mauvais endroit | Passer date et lieu en indispensable, ou reporter à 8 h | élevée | corrigé au lot 9 bis (tâche 32, `tests/parcours/messages-changement-9bis.test.ts`) |
| R15 | message manquant | `M/20261103000005_lot6_billetterie.sql:1258-1318` ; | Quand un admin annule, la partenaire n’a aucun message au moment de l’annulation ; elle reçoit plus tard « Remboursements terminés » ou « Remboursements en attente » s’il y a des versements en ligne. Quand la partenaire annule, aucun admin n'est prévenu, alors que des versements partent. Les contrôleurs ne sont prévenus ni de la suspension, ni de l'annulation, ni de la réactivation | Une partenaire apprend l'annulation de son événement par ses clients. Un contrôleur se déplace pour rien | Message à la partenaire, alerte aux admins, avis aux contrôleurs | élevée | corrigé au lot 9 bis (tâche 33, `tests/parcours/messages-acteurs-9bis.test.ts`) |
| R16 | règle contradictoire | `lib/events/event-status.ts:14` ; `M/20261102000003_lot5_cycle.sql:838-849`, `:886` ; `app/controller/scanner/page.tsx:853-865`, `:473-479` ; `app/partner/scan/page.tsx:121` | Le serveur accepte les scans d'un événement « Terminé » pendant 6 heures, mais l'écran exige « Validé » ou « Publié ». Sans date de fin, l'événement passe à « Terminé » vers 00:03 et la caméra disparaît au prochain retour dans l'application | Soirée de 22 h à 3 h sans date de fin saisie : un appel reçu après minuit coupe le contrôle à la porte | Que le serveur dise si le contrôle est ouvert, et afficher la caméra tant qu'il l'autorise | élevée | corrigé au lot 9 bis (tâche 21, `tests/parcours/cycle9bis-fenetre-scan.test.ts`) |
| R17 | impasse | `app/controller/scanner/page.tsx:830`, `:1061` ; `components/shifts/ShiftModals.tsx:190` ; `components/partner/pilotage/TeamTab.tsx:112` | Si le droit d'encaisser est retiré, ou si le contrôleur part, avec une caisse ouverte, l'onglet Caisse disparaît et aucun écran ne permet à la partenaire ou à l'admin de la clôturer. Le retrait du contrôleur reste refusé Si seul le droit d’encaisser a été retiré, le rendre rouvre l’onglet Caisse ; l’impasse réelle est un contrôleur indisponible. | Espèces jamais arrêtées, rapport absent, contrôleur impossible à retirer | Bouton « Clôturer cette caisse » dans l'onglet Caisse de la partenaire (le serveur sait déjà le faire), et garder l'onglet tant qu'une caisse est ouverte | élevée | corrigé au lot 9 bis (tâche 22, `tests/parcours/cycle9bis-caisse.test.ts`) |
| R18 | règle absente | `M/20261108000001_lot9_securite.sql:248` ; `M/20261108000001_lot9_securite.sql:495` ; `app/admin/events/[id]/page.tsx:183` | Après validation, titre, affiche, lieu, date et nouvelles catégories changent sans nouvel examen ni alerte aux admins. C'est un choix écrit dans le code | Le contrôle porte sur une fiche qui peut être remplacée le lendemain | Alerte admin sur titre, affiche, lieu, date, nouvelle catégorie ; à arbitrer | moyenne | corrigé au lot 9 bis (tâche 36, `tests/parcours/messages-changement-9bis.test.ts`) |
| R19 | règle absente | `M/20261108000005_lot9_nettoyage.sql:174-186`, `:275-296` ; `app/api/tickets/[id]/live-code/route.ts:42` ; `TicketCard.tsx:209` | Un billet en cours de transfert reste scannable : aucun résultat « transfert en cours », ni le scan ni la saisie manuelle ne lisent le verrou. Seul l’écran retire le QR en ligne ; les codes hors ligne sont refusés. Aucun test | Fatou peut entrer par saisie manuelle, Lamine lit ensuite « Ce billet n'est plus transférable. » | Refuser le scan et le code quand le billet est verrouillé, avec un résultat dédié | moyenne | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R20 | règle absente | `M/20261106000001_lot8_canaux.sql:436-440` ; `M/20261102000003_lot5_cycle.sql:687-758` ; `M/20261108000001_lot9_securite.sql:21-129` ; `components/events/RefundProgress.tsx:96-104` ; `app/api/events/[id]/route.ts:29-31` | Les ventes au guichet sont déjà « Utilisé » : ni dans l'impact, ni dans le suivi, ni remboursables. La carte « Espèces à rembourser » n'apparaît donc pas ; il n'y a de toute façon ni liste, ni moyen de marquer un remboursement fait. La page promet que les billets réglés en espèces sont remboursés par l’organisateur | L'Essai 46 ne peut pas réussir. Sur une annulation en cours d'événement, la partenaire garde des espèces sans trace | Décider la règle ; à défaut, retirer la promesse et corriger l'Essai 46 | moyenne | corrigé au lot 9 bis (tâche 4, `tests/parcours/lot9bis-guichet-annulation.test.ts`) ; Essai 46 réécrit |
| R21 | texte incohérent | `app/admin/pricing/page.tsx:27-46`, `:143`, `:223`, `:273` ; `app/api/admin/pricing/route.ts:42-96` ; `M/20261101000003_lot3_moteur.sql:76-79` | Trois sections enregistrent sans aucun effet sur le calcul. L'écran annonce Wave à 1,0 % alors que le moteur applique 1,5 %. Même défaut que A1, sur un autre écran | Un SUPERADMIN croit avoir changé ses frais | Retirer ces sections, ou les rebrancher, et renvoyer vers les réglages | moyenne | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R22 | message manquant | `M/20261108000002_lot9_invitations.sql:504-574` ; `M/20261103000006_lot6_pros_admin.sql:371` | Invitation annulée, billet gratuit ou payé en espèces annulé : aucun message | L'invité l'apprend à l'entrée | SMS d'annulation | moyenne | corrigé au lot 9 bis (tâche 34, `tests/parcours/messages-comptes-9bis.test.ts`) |
| R23 | message manquant | `M/20261106000003_lot8_paiement.sql:364-366` | Transfert révoqué par l'annulation de l'événement : le destinataire n'est pas prévenu | Lamine n'apprend rien | Réutiliser le message d'annulation de transfert | moyenne | corrigé au lot 9 bis (tâche 34, `tests/parcours/messages-comptes-9bis.test.ts`) |
| R24 | message manquant | `lib/notifications/catalog.ts:656`, `:662` | Suspension et reprise : ni SMS ni email pour les détenteurs | Sans push ni ouverture de l'application, personne ne sait | SMS, ou décision écrite de s'en passer | moyenne | corrigé au lot 9 bis par décision écrite (tâche 35) : suspension et réactivation restent en cloche et push, plus l'email ; aucun SMS ; la suite définitive (annulation, fin) part en SMS |
| R25 | texte incohérent | `app/api/tickets/route.ts:48` ; `TicketCard.tsx:133`, `:625` ; `app/api/tickets/[id]/live-code/route.ts:42` | La carte reste « Valable », QR actif, sur un événement suspendu ; après la fin, QR et « Transférer » restent visibles | Détenteur rassuré à tort, refus seulement à l'entrée | Afficher l'état de l'événement, masquer QR et transfert après la fin | moyenne | corrigé au lot 9 bis (tâche 24, `tests/parcours/cycle9bis-carte-billet.test.ts`) |
| R26 | message en double | `M/20261108000001_lot9_securite.sql:458-480` | Le regroupement des SMS de changement ne dure pas plus d'une minute | 3 corrections espacées de 5 minutes envoient 3 SMS à chaque détenteur | Délai de regroupement de 10 à 15 minutes | moyenne | corrigé au lot 9 bis (tâche 32, `tests/parcours/messages-changement-9bis.test.ts`) |
| R27 | risque de coût | `lib/validations/event.ts:179-181` ; `lib/notifications/sms-format.ts:131` | Un emoji ou une lettre comme ŋ dans un titre fait passer les SMS sur 2 ou 3 segments | 908 segments au lieu de 350 pour le scénario | Retirer ces caractères des SMS, ou prévenir à la saisie | moyenne | corrigé au lot 9 bis (tâche 38, `tests/parcours/messages-sms-9bis.test.ts`) |
| R28 | règle absente | `M/20261105000002_lot7_sms.sql:319-320` ; `lib/notifications/outbox-labels.ts:53` | Le SMS de 3 heures est supprimé par un push seulement accepté, pas affiché. Libellé « Notification push déjà remise » | Téléphone éteint : aucun rappel | Corriger le libellé ; arbitrer | moyenne | libellé corrigé au lot 9 bis (tâche 39, `tests/parcours/messages-sms-9bis.test.ts`) ; le push garde la place du SMS de 3 heures, par décision de coût |
| R29 | message en double | `app/api/controller/setup/route.ts:145`, `:193` ; `M/20261103000006_lot6_pros_admin.sql:663`, `:900`, `:946` | Deux SMS à l'activation d'un contrôleur (trois avec l'invitation), au ton inquiétant ; deux SMS à la validation d'une partenaire | SMS redondants, coût | Ne pas envoyer l'alerte de mot de passe à l'activation ; essai en cloche seule | moyenne | corrigé au lot 9 bis (tâche 38, `tests/parcours/messages-sms-9bis.test.ts`) |
| R30 | message manquant | `M/20261106000003_lot8_paiement.sql:187` ; `M/20261103000006_lot6_pros_admin.sql:371`, `:382-400` | Paiement encaissé mais impossible à honorer, ou remboursement en échec : rien au client avant le versement | Argent débité, aucun message | Avis au client à la création et au blocage | moyenne | corrigé au lot 9 bis (tâche 6, `tests/parcours/paiement-attente-9bis.test.ts`) |
| R31 | risque de coût | `lib/sms/sms-guard.ts:105` | Aucun plafond sur les SMS indispensables, et l'alerte de volume n'a plus d'émetteur | Un événement gratuit de 5 000 réservations puis annulé : 10 000 SMS | Alerte de volume | moyenne | corrigé au lot 9 bis (tâche 38, `tests/parcours/messages-sms-9bis.test.ts`) |
| R32 | règle absente | `M/20261108000001_lot9_securite.sql:423-428` | Un report, sans limite, n'ouvre aucun droit au client | Client qui ne peut plus venir, sans recours dans l'application | Décision écrite ; à défaut, seuil de report qui ouvre un remboursement | moyenne | corrigé au lot 9 bis (tâche 5, `tests/parcours/lot9bis-report.test.ts`) |
| R33 | message manquant | `M/20261103000004_lot6_rappels.sql:257` | Contrôleurs non prévenus d'un changement de date ou de lieu | Contrôleur au mauvais endroit jusqu'au rappel de la veille à 18 h | Réutiliser le message d'affectation | moyenne | corrigé au lot 9 bis (tâche 33, `tests/parcours/messages-acteurs-9bis.test.ts`) |
| R34 | texte incohérent | `M/20261103000005_lot6_billetterie.sql:1032-1033` ; `app/partner/events/page.tsx:145-146` | Soumission refusée sans dire ce qui manque | Mariama ne sait pas s'il faut l'affiche ou une catégorie | Afficher ce qui manque | moyenne | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R35 | texte incohérent | `lib/events/catalog.server.ts:75-98` ; `app/events/[id]/page.tsx:1076` | « Bientôt en vente » pour un événement sur place uniquement ; « À partir de » sur une catégorie épuisée | Le public attend une vente qui n'arrivera pas | « Vente sur place », et prix sur les catégories achetables | moyenne | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R36 | écart au cahier des charges | `app/api/events/[id]/route.ts:183-222` ; `app/events/[id]/page.tsx:828` | La fiche publique n'affiche jamais la fin de l'événement (§30) | Festival sur plusieurs jours présenté comme un jour unique | Afficher fin et durée | moyenne | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R37 | règle absente | `app/api/partner/team/invite/route.ts:201-223` ; `app/partner/team/page.tsx:765-800` | Pas de consentement d'un client existant invité comme contrôleur : la partenaire confirme seule | Un numéro saisi par erreur attache un inconnu à l'équipe | Acceptation par le titulaire, ou décision écrite | moyenne | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R38 | texte faux | `app/api/partner/team/invite/route.ts:375`, `:440-441` | « Renvoyer le SMS » sur un compte activé : rien ne part, mais l'écran dit « prévenu », et le quota est consommé | Mariama croit le contrôleur prévenu | Masquer le bouton, ou envoyer un rappel | moyenne | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R39 | texte faux | `app/api/partner/team/all/route.ts:186` | État « Actif » deviné d'après le prénom | Mariama ne sait pas qui peut se connecter | Lire l'état réel du compte | moyenne | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R40 | impasse | `app/api/partner/team/controller/[controllerId]/route.ts:105-107` ; `app/api/controller/setup/route.ts:118-123` | Contrôleur jamais activé, supprimé puis réinvité : plus de code, seul « Mot de passe oublié » s'en sort | Contrôleur bloqué le jour J | Ne retirer le marqueur que si le compte a été activé | moyenne | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R41 | texte incohérent | `app/api/partner/team/assignments/route.ts:224-236` ; `components/partner/pilotage/TeamTab.tsx:372` | « Gérer » applique un seul interrupteur à toutes les affectations, alors que l'onglet dit le contraire | Un contrôleur reçoit le droit d'encaisser sur un événement où il ne devait pas | Interrupteur par événement | moyenne | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R42 | règle absente | `lib/shifts/shift.service.ts:324` ; `components/shifts/ShiftModals.tsx:128-129` | PIN facultatif à l'ouverture et fonds de caisse jamais contrôlé | Un fonds manquant n'est détecté par rien | Décider si le PIN est obligatoire ; sinon corriger le texte | moyenne | corrigé au lot 9 bis (tâche 22, `tests/parcours/cycle9bis-caisse.test.ts`) |
| R43 | message manquant | `M/20261106000003_lot8_paiement.sql:266-414` ; `M/20261102000003_lot5_cycle.sql:838-849` | Une caisse peut rester ouverte après la fin ou l'annulation, sans alerte | Espèces non déclarées, personne n'est prévenu | Alerte à la fin de l'événement | moyenne | corrigé au lot 9 bis (tâche 22, `tests/parcours/cycle9bis-caisse.test.ts`) |
| R44 | impasse temporaire | `app/api/tickets/route.ts:71`, `:128` ; `TicketCard.tsx:488` ; `supabase/ops/schedule-crons.sql:103` | Après l'échéance, billet bloqué jusqu'à 1 heure sans QR ni bouton d'annulation | Le jour J, Fatou peut rester sans QR à l'entrée | Expirer à la lecture, ou toutes les 5 minutes | moyenne | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R45 | texte incohérent | `lib/notifications/catalog.ts:566`, `:571`, `:576` ; `app/tickets/page.tsx:133` | Le SMS de transfert et d'invitation mène à l'onglet « À venir », pas à « Reçus » | Lamine lit « Aucun billet à venir » | Ouvrir « Reçus » d'office si un billet attend | moyenne | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R46 | écran absent | `lib/tickets/ticket-transfer.service.ts:83` ; `components/tickets/IncomingTransfers.tsx:263-273` | Le destinataire ne peut pas refuser un billet | Le billet de Fatou reste verrouillé 48 heures | Bouton « Refuser », avec avis | moyenne | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R47 | risque pour l'argent | `M/20261105000006_lot7_client.sql:24` ; `lib/payments/confirmation.service.ts:185` ; `app/paiement/[id]/page.tsx:749` | Entre 15 et 60 minutes, un paiement est en attente sans issue claire, et un second débit reste possible | Double débit possible ; remboursement silencieux jusqu'au versement | Prévenir à l'écran, proposer d'abord l'annulation | moyenne | corrigé au lot 9 bis (tâche 6, `tests/parcours/paiement-attente-9bis.test.ts`) |
| R48 | règle absente | `M/20261106000003_lot8_paiement.sql:266-414` ; `M/20261102000003_lot5_cycle.sql:687-758` | Annulation possible en plein événement, et l'impact affiché ne compte pas les billets déjà utilisés, pourtant remboursés | Mariama confirme un montant sans comprendre qu'il inclut les personnes déjà entrées | Avertissement dédié | moyenne | corrigé au lot 9 bis (tâche 27, `tests/parcours/cycle9bis-annulation-en-cours.test.ts`) |
| R49 | texte incohérent | `app/partner/events/[id]/page.tsx:80-90`, `:173` | « En direct » ne concerne pas les ventes | Mariama croit voir ses ventes à l'instant | Ajouter un signal, ou limiter l'indicateur | moyenne | renvoyé, lot à désigner par le chef de projet |
| R50 | écran absent | `M/20261106000001_lot8_canaux.sql:1187-1280` ; `components/partner/pilotage/SalesTab.tsx:16-37` | Ventes par canal non affichées, alors que les données existent | Impossible de lire les ventes par canal | Tableau simple par canal | moyenne | corrigé au lot 9 bis (tâche 28, `tests/parcours/cycle9bis-ventes-canal.test.ts`) |
| R51 | texte technique | `app/admin/events/[id]/page.tsx:529-542` ; `app/admin/users/page.tsx:752` ; `app/admin/finance-settings/page.tsx:302` ; `lib/admin/admin-auth.ts:206` | Boutons visibles sans permission, puis « Permission manquante : events.write » à l'écran ; permissions affichées en code | Mot technique, travail perdu | Masquer selon la permission, traduire le refus | moyenne | corrigé au lot 9 bis (tâche 12, `tests/parcours/droits-boutons-9bis.test.ts`) |
| R52 | risque opérationnel | `lib/payments/cashout.service.ts:285-289` ; `components/admin/RefundsToRetry.tsx:145` | Si le solde ne couvre pas tout le lot, rien ne part ; la relance se fait ensuite ligne par ligne | 100 clients, 100 relances | Envoyer jusqu'à épuisement, ou relance groupée | moyenne | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) |
| R53 | risque | `app/api/partner/register/route.ts:101-178` ; `M/20261108000001_lot9_securite.sql:675` | Dossier partenaire créé avant la preuve du numéro, jamais montré comme vérifié à l'admin | Numéro immobilisé, candidatures fantômes, validation à l'aveugle | Ouvrir le dossier au code vérifié | moyenne | corrigé au lot 9 bis (tâche 17, `tests/parcours/dossier-partenaire-9bis.test.ts`) |
| R54 | impasse | `app/partner/dashboard/page.tsx:285-294` ; `app/api/partner/register/route.ts:77` | Partenaire refusée : ni redéposer une pièce, ni se réinscrire | Dossier bloqué pour un NINEA illisible | Écran « Compléter mon dossier » | moyenne | corrigé au lot 9 bis (tâche 17, `tests/parcours/dossier-partenaire-9bis.test.ts`) |
| R55 | risque | `app/admin/dashboard/page.tsx:366`, `:615` ; `M/20261103000006_lot6_pros_admin.sql:728` | « Refuser » est offert sur une partenaire déjà validée | Argent bloqué, ventes qui continuent | Réserver à un dossier en attente | moyenne | corrigé au lot 9 bis (tâche 15, `tests/parcours/fiche-partenaire-9bis.test.ts`) |
| R56 | écart au cahier des charges | `M/20261103000006_lot6_pros_admin.sql:793`, `:857` ; `supabase/seed.sql:9-23` ; `app/partner/subscription/page.tsx:223` | Période d'essai sans effet ni rappel, offre fondateur inatteignable, prix des offres hors cahier des charges (§25 à §27), aucun garde-fou d'abonnement à la création | Promesse d'essai sans suite, partenaires renvoyés vers un support sans outil | Décider et écrire la règle | moyenne | renvoyé au lot 13 |
| R57 | risque pour la sécurité | `app/api/account/phone/confirm/route.ts:32-40` ; `app/api/withdrawals/otp/route.ts:39` ; `app/api/tickets/[id]/transfer/route.ts:26-28` | Une session ouverte suffit : changer de numéro avec un code sur le nouveau seul, puis retirer ; envoyer tous ses billets sans code | Perte de compte, de solde ou de billets sur un téléphone prêté | Mot de passe ou code à l'ancien numéro, délai sur les retraits après changement | moyenne | corrigé au lot 9 bis (tâche 13, `tests/parcours/mot-de-passe-recent.test.ts`) |
| R58 | risque pour la sécurité | `app/api/auth/resolve-phone/route.ts:66-72` ; `lib/env.ts:81` | Sans session, un numéro rend email, identifiant, statut et rôle | Annuaire des clients, repérage des admins | Ne rendre que l'email, ou connexion côté serveur | moyenne | corrigé au lot 9 bis (tâche 14, `tests/parcours/connexion-serveur.test.ts`) |
| R59 | message manquant, règle absente | `app/api/admin/users/route.ts:321-343` ; `M/20261108000005_lot9_nettoyage.sql:21-216` ; `app/api/tickets/[id]/live-code/route.ts:42` | Client suspendu ou réactivé : aucun message, aucun motif. Il peut entrer avec un QR hors ligne ou par saisie manuelle, mais pas afficher son billet | Suspension pour fraude sans effet à l'entrée ; suspension par erreur qui prive d'entrée | SMS, motif, règle à décider | moyenne | corrigé au lot 9 bis (tâche 34, `tests/parcours/messages-comptes-9bis.test.ts`) pour les messages et le motif ; non reproduit pour l'entrée : le scan ne lit pas le statut du porteur, et la décision garde les billets payés valables à l'entrée |
| R60 | préparation | `scripts/dev/seed-dev.core.ts:202-205` ; `docs/recette-billetterie.md:1219` ; `app/api/admin/notifications/route.ts:25` | Moussa n'a aucune permission dans `seed:dev`, et l'Essai 54 le suppose | Fausse anomalie en recette | Ajouter la préparation (étape 0.2) | moyenne | corrigé au lot 9 bis (tâche 44, `tests/parcours/essai-seed-dev-9bis.test.ts`) |
| R61 | message manquant | `M/20261108000001_lot9_securite.sql:21-129` ; `M/20261108000002_lot9_invitations.sql:91`, `:206` | Remboursement pendant un transfert en cours : le transfert n'est pas annulé. Billet transféré remboursé : le détenteur n'est pas prévenu | Lamine perd son entrée sans message ; message faux à Fatou | Annuler le transfert dans la même opération, prévenir le détenteur | moyenne | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R62 | texte incohérent | `app/partner/finance/page.tsx:351-361`, `:693-694` | Le retrait ne dit ni le minimum ni les frais avant le code : à 4 999 F, un SMS perdu, et le net n'est connu qu'après l'envoi (§83, §105) | SMS payés pour rien, frais découverts après coup | Afficher le seuil, le taux et le net | moyenne | corrigé au lot 9 bis (tâche 10, `tests/parcours/lot9bis-retrait-devis.test.ts`) |
| R63 | impasse | `M/20261108000004_lot9_compte.sql:203` ; `tests/parcours/compte-numero.test.ts:980` | Changement de numéro du destinataire : transfert perdu sans message, ou numéro repris servi à un inconnu | Billet bloqué 48 heures, ou remis à un inconnu | Reciblage sur code SMS, ou annulation avec avis | moyenne | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R64 | écran incomplet | `app/admin/audit/page.tsx:61`, `:157-163`, `:268` ; `app/api/admin/audit/route.ts:27-28` | Journal limité à 100 lignes, codes bruts, langues mêlées ; remboursements et retraits absents ; motif conservé jamais montré (§134, §156). A13, A24, A25, A38 ont corrigé d'autres points | Enquête impossible après coup | Libellés, filtres réels, pagination, journal des opérations d'argent | moyenne | renvoyé au lot 14 |
| R65 | écran absent | `app/admin/finance/page.tsx:141` | Aucune liste des retraits ni des commissions côté admin (§131, §132). Rejoint A9 (listée) | Aucun suivi | Listes | moyenne | renvoyé au lot 13 |
| R66 | écart au cahier des charges | `app/api/tickets/route.ts:42`, `:128-149` ; `TicketCard.tsx:60-85` | Le prix n'est pas affiché dans Mes billets (§20, §138) ; la matrice de recette dit autre chose | Fatou doit ouvrir Mes paiements ou le PDF | Ajouter prix et frais à la carte | moyenne | corrigé au lot 9 bis (tâche 24, `tests/parcours/cycle9bis-carte-billet.test.ts`) |
| R67 | texte faux | `app/admin/referral/page.tsx:146`, `:150-152` ; `M/20261101000006_lot3_commissions.sql:49` | L'écran annonce « 24 Mois » pour tout filleul, le code applique 12 mois au client standard | L'admin renseigne mal un ambassadeur | Lire la configuration, ou retirer les cartes | moyenne | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R68 | impasse apparente | `components/layout/AppLayout.tsx:200`, `:239` ; `app/profile/page.tsx:180-186` | Les liens « Scanner » et « Espace partenaire » d'un admin mènent à une erreur ; aucun écran admin ne retrouve un billet (§130) | Au support, ni vérifier ni scanner | Retirer ces entrées, ajouter une recherche de billet | moyenne | renvoyé au lot 14 |
| R69 | risque de faux document | `app/api/tickets/[id]/pdf/route.ts:88-92`, `:104-106`, `:125-134` | Si la lecture échoue, le PDF porte un lieu et une date inventés (« Dakar Arena »). A32 et A34 ont corrigé ailleurs | Un document officiel peut être faux | Erreur si l'événement n'est pas lu | moyenne | corrigé au lot 9 bis (tâche 29, `tests/parcours/cycle9bis-billet-pdf.test.ts`) ; le défaut de lecture n'est pas reproduit en exécution, la preuve est la lecture du code |
| R70 | texte incohérent | `app/partner/dashboard/page.tsx:289`, `lib/notifications/email-layout.ts:71` ; `lib/tickets/ticket-pdf.service.ts:247`, `lib/partner/partner-dashboard.service.ts:955` | Deux domaines de support, `eventvillage.sn` et `event-village.sn` | Le client peut ne jamais avoir de réponse | Une constante unique | moyenne | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R71 | risque | `app/api/admin/users/route.ts:121`, `:283` | Un admin avec `users.write` peut créer ou promouvoir des admins (§12) | Un compte à droits limités fabrique un compte qui peut annuler un événement (R2) | Réserver au SUPERADMIN | moyenne | corrigé au lot 9 bis (tâche 11, `tests/parcours/droits-admin-9bis.test.ts`) |
| R72 | message manquant | `M/20261103000005_lot6_billetterie.sql:1320` ; `app/api/partner/reports/closing/route.ts:36` | Fin de l'événement, fonds disponibles, commission disponible : aucun message | Mariama ne sait pas quand son rapport ou son argent est prêt | Avis à la partenaire | faible | corrigé au lot 9 bis (tâche 37, `tests/parcours/messages-fin-9bis.test.ts`) |
| R73 | texte incohérent | `lib/notifications/catalog.ts:960`, `:976`, `:1257-1265` ; `app/api/partner/team/invite/route.ts:414` | SMS sans accents ni pluriel : « vous etes invite comme controleur », « et 1 autres », préfixes variables ; prénom non traité, 3 segments avec « Maïmouna » | Textes peu soignés, coût | Accents et singulier, traitement du prénom | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-sms-9bis.test.ts`) |
| R74 | texte incohérent | `lib/notifications/catalog.ts:524`, `:147-150` | Quatre points après une troncature | Lecture | Terminer proprement | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-sms-9bis.test.ts`) |
| R75 | texte technique | `lib/auth/otp-store.ts:108` ; `lib/partners/documents.ts:82-84` ; `app/api/partner/team/invite/route.ts:444` ; `lib/auth/account-status.ts:35` ; `lib/payments/cashout.service.ts:254` ; `app/admin/users/page.tsx:362`, `:374` | Mots techniques à l'écran : « Le code OTP », « id_card », « SMS_NOT_DELIVERED », « au statut SUSPENDU », « REJECTED ». Pages admin non migrées : déjà A22 | Compréhension | Libellés français | faible | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R76 | texte incohérent | `app/profile/page.tsx:222-224` ; `lib/validations/auth.ts:49` ; `app/register/page.tsx:159` ; `components/profile/PhoneChangeDialog.tsx:98` ; `app/events/[id]/page.tsx:1076` | Même chose, plusieurs noms : « Quantité » et « quota », « catégorie » et « formule », « Solde » et « Portefeuille », « organisateur » et « partenaire », « Refusé » et « rejetée » ; quatre messages pour un numéro invalide ; monnaie sous quatre formes | Confusion | Un glossaire unique | faible | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) ; glossaire unique `docs/glossaire.md` |
| R77 | texte incohérent | `lib/tickets/ticket-pdf.service.ts:247` ; `lib/partner/partner-dashboard.service.ts:918` | Accents absents des PDF et CSV (A39 n'a corrigé que l'intitulé) | Lecture | Traitement unique | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-pdf-9bis.test.ts`) |
| R78 | message en double | `M/20261103000005_lot6_billetterie.sql:875` | Une notification par billet scanné | 4 billets, 4 notifications | Regrouper | faible | corrigé au lot 9 bis (tâche 37, `tests/parcours/messages-fin-9bis.test.ts`) |
| R79 | message manquant | `lib/notifications/catalog.ts:565` ; `M/20261105000002_lot7_sms.sql:540` | Invité qui a un compte : ni cloche ni push. Rappels perdus après une reprise | Billet qui apparaît sans avis | Arbitrer | faible | corrigé au lot 9 bis (tâche 37, `tests/parcours/messages-comptes-9bis.test.ts`) |
| R80 | texte incohérent | `lib/notifications/catalog.ts:376-381` | Adresse supprimée : le SMS annonce l'ancien lieu | Message trompeur | Texte dédié | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R81 | texte incohérent | `M/20261105000002_lot7_sms.sql:449` ; `M/20261108000005_lot9_nettoyage.sql:17-18` | Types et branches sans usage | Sans effet | Nettoyer | faible | non reproduit pour `event_notify`, déjà supprimée (`tests/parcours/notif-migration.test.ts:343`) ; l'alerte de volume et la branche « organisateur » sont réemployées (R31, R12) |
| R82 | écart au cahier des charges | `lib/notifications/catalog-types.ts:22` | WhatsApp absent (§22, §70, §124) : déjà A8, Q1 | Canal absent | Décider | faible | renvoyé au lot 13 : WhatsApp hors de la V1 (question Q1 fermée) |
| R83 | écart au cahier des charges | `app/partner/register/page.tsx:356` ; `lib/validations/auth.ts:110-112` | Un client ne devient pas partenaire : déjà A12. Email facultatif : décision du lot 1C | Second compte nécessaire | Décision écrite | faible | renvoyé au lot 13 |
| R84 | texte incohérent | `app/forgot-password/page.tsx:213-217` ; `app/api/auth/send-otp/route.ts:70-74` | L'existence d'un compte est cachée par email, dite par téléphone | Sécurité | Choisir | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R85 | écran absent | `components/profile/ProfileForm.tsx:158` ; `middleware.ts:107-110` | Pas d'écran pour changer son mot de passe connecté | Passage forcé par « Mot de passe oublié » | Ajouter | faible | corrigé au lot 9 bis (tâche 42, `tests/parcours/compte-mot-de-passe.test.ts`) |
| R86 | texte incohérent | `app/api/auth/register/route.ts:32-35` | Code de parrainage inconnu ignoré sans rien dire | Parrainage perdu | Vérifier à la saisie | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R87 | risque | `app/api/auth/register/route.ts:146` ; `app/api/account/profile/route.ts:54` | Email jamais vérifié | Confirmations vers une adresse non prouvée | Lien de confirmation | faible | corrigé au lot 9 bis (tâche 48, `tests/parcours/email-verification.test.ts`) |
| R88 | texte incohérent | `components/auth/LoginForm.tsx:472-474` ; `app/forgot-password/page.tsx:325-331` | Échec de session après le code, ignoré | Retour à la connexion sans explication | Message et nouvel essai | faible | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R89 | risque | `components/auth/LoginForm.tsx:29-40` ; `app/api/auth/send-otp/route.ts:36-40`, `:58` | Verrou de connexion dans le navigateur seulement ; code de connexion envoyé à tout numéro valide par appel direct | SMS facturés, bornés par les quotas | Quota serveur par compte | faible | renvoyé au lot 14 |
| R90 | écran incomplet | `lib/validations/auth.ts:188-189` ; `app/api/partner/register/route.ts:157-177` | NINEA et RCCM saisis puis perdus | Champs inutiles | Enregistrer, ou retirer | faible | corrigé au lot 9 bis (tâche 17, `tests/parcours/dossier-partenaire-9bis.test.ts`) |
| R91 | préparation | `scripts/dev/seed-dev.core.ts:227` | Essai du seed incohérent (90 jours sans offre fondateur) | Sans effet hors test | Corriger | faible | corrigé au lot 9 bis (tâche 44, `tests/parcours/essai-seed-dev-9bis.test.ts`) |
| R92 | texte incohérent | `components/partner/events-list/PartnerEventCard.tsx:142` ; `M/20261103000001_lot6_dette.sql:218-221` | « Supprimer le brouillon » proposé alors qu'il échouera | Refus au clic | Masquer | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R93 | texte incohérent | `EventForm.tsx:732`, `:905`, `:427`, `:464-465` ; `components/events/EventTicketing.tsx:165-167` | Texte contradictoire sur la jauge ; verrous d'écran différents du serveur ; modifications de catégorie perdues sans alerte | Refus, perte de saisie | Aligner | faible | renvoyé, lot à désigner par le chef de projet |
| R94 | règle absente | `lib/validations/event.ts:510` ; `M/20261106000001_lot8_canaux.sql:1019-1024` ; `M/20261103000005_lot6_billetterie.sql:1024-1035` | Début de vente après la fin accepté en modification ; date passée non contrôlée à la soumission | Catégorie jamais en vente ; refus tardif | Contrôler | faible | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R95 | message manquant | `M/20261103000005_lot6_billetterie.sql:1233-1238` | Pas d'accusé à la soumission ; retrait de validation sans avis aux admins ; publication par la partenaire sans avis admin ; nouvelle catégorie, prix, canaux : personne | Moindre | Arbitrer | faible | corrigé au lot 9 bis (tâche 36, `tests/parcours/messages-changement-9bis.test.ts`) pour l'accusé de soumission et l'alerte des changements ; renvoyé pour le retrait de validation, la publication par la partenaire, les prix et les canaux |
| R96 | règle absente | `lib/validations/event.ts:187-189`, `:215` | Ville et téléphone en saisie libre | « Thies » et « Thiès » font deux entrées | Liste, format | faible | renvoyé, lot à désigner par le chef de projet ; les doublons d'accent des villes publiques sont réglés par la tâche 45 |
| R97 | texte faux | `app/partner/team/page.tsx:648`, `:724` ; `components/partner/pilotage/TeamTab.tsx:350` ; `components/partner/pilotage/CashTab.tsx:118-120`, `:149` | Texte de suppression faux pour un contrôleur partagé ; champ Email sans effet ; textes périmés de l'onglet Caisse (suite de A16, corrigée) | Lecture | Réécrire | faible | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R98 | règle absente | `app/api/partner/team/invite/route.ts:97-100` ; `M/20261103000006_lot6_pros_admin.sql:542-543` | Quota d'invitations qui compte aussi sans SMS ; aucun avis pour un changement d'espèces ou de porte | Refus inattendu | Ne compter que les SMS | faible | corrigé au lot 9 bis (tâche 43, `tests/parcours/invitations-controleur-quota.test.ts`) |
| R99 | écran incomplet | `components/shifts/ShiftModals.tsx:320` ; `app/api/admin/shifts/audit/route.ts:20` ; `lib/shifts/shift.service.ts:193`, `:458` | Rapport de caisse perdu à la fermeture ; écarts consolidés sans écran ; écart sans PIN généré découvert à la clôture | Traçabilité | Liste, avertissement préalable | faible | renvoyé au lot 14 |
| R100 | texte incohérent | `components/scan/scan-client.ts:206`, `:349-353` ; `app/api/controller/scans/route.ts:49` ; `components/scan/ManualEntryForm.tsx:124-125` ; `lib/scan/scan-result.ts:54`, `:56` | « rien n’est validé » peut être faux ; « Porte Porte Nord » ; « Résultat prévu : Entrée validée » ; heure d'ouverture jamais affichée ; ancien QR annoncé « à rafraîchir » | Contrôleur trompé | Textes clairs | faible | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R101 | écran incomplet | `app/partner/scan/page.tsx:441` ; `components/scan/CounterSalePanel.tsx:161` ; `app/api/partner/team/[eventId]/route.ts:1` | Saisie manuelle de la partenaire toujours refusée ; scan partenaire moins lisible ; vente au guichet sans preuve remise ; rôle conservé selon le chemin de retrait | Moindre | Harmoniser | faible | renvoyé au lot 14 |
| R102 | risque | `app/api/controller/setup/route.ts:71-75` ; `app/api/partner/team/assignments/route.ts:37`, `:186-221` | Activation possible sur un compte suspendu ; enregistrement des affectations en trois instructions | Moindre | Refus, opération unique | faible | corrigé au lot 9 bis (tâche 18, `tests/parcours/controleur-9bis.test.ts`) |
| R103 | règle absente | `M/20261103000005_lot6_billetterie.sql:78-170` ; `M/20261105000006_lot7_client.sql:24` ; `lib/payments/checkout.service.ts:165` ; `lib/payments/confirmation.service.ts:158` | Transfert vers son propre numéro ; panier mixte qui contourne la limite gratuite ; panier gratuit sans clé de reprise ; paiement inconnu de SamirPay en attente sans fin | Moindre | Contrôles | faible | corrigé au lot 9 bis (tâche 18, `tests/parcours/controleur-9bis.test.ts`) ; le paiement inconnu de SamirPay est traité par H5 (`tests/parcours/paiement-succes-tardif-v12.test.ts`) |
| R104 | texte incohérent | `app/events/[id]/page.tsx:361`, `:1059`, `:1076-1077` ; `components/tickets/IncomingTransfers.tsx:205`, `:286` ; `M/20261108000002_lot9_invitations.sql:582` | « Toutes les places ont été vendues » pendant des réservations ; « Revenez bientôt » après la fin des ventes ; panier perdu à la connexion ; textes de transfert appliqués aux invitations ; historique « Envoyée » uniforme | Lecture, confusion | Textes dédiés | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) ; l'historique « Envoyée » uniforme est gardé par décision (aucune énumération des comptes, décision L7 du lot 9) |
| R105 | écran incomplet | `components/events/RefundProgress.tsx:43` ; `lib/payments/cashout.service.ts:227` ; `M/20261102000003_lot5_cycle.sql:49-65` | Pas de lien de pilotage depuis la fiche admin ; « Places en vente » affiché pendant une suspension ; deuxième échec d'une relance sans alerte ; annulation par la partenaire d'un événement suspendu | Moindre | Arbitrer | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R106 | règle absente | `M/20261102000003_lot5_cycle.sql:828-854` ; `M/20261106000004_lot8_commissions.sql:37` ; `components/partner/pilotage/ClosingTab.tsx:175` ; `app/partner/finance/page.tsx:816` | Événement validé jamais publié, resté « Validé » après la date ; commission retirable avant l'événement ; deux rapports de clôture différents ; « Retraits en cours » au net alors que le brut est réservé | Moindre | Arbitrer | faible | corrigé au lot 9 bis (tâche 7, `tests/parcours/commissions-fin-evenement.test.ts`) pour la commission retirable avant l'événement ; renvoyé, lot à désigner, pour le reste |
| R107 | texte incohérent | `lib/notifications/catalog.ts:1257-1265` ; `app/controller/scanner/page.tsx:452` | Le SMS du code de retrait ne dit pas « retrait » ; l'écran du contrôleur n'est pas averti d'un retrait en direct | Moindre | Texte dédié, signal | faible | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-sms-9bis.test.ts`) |
| R108 | écart au cahier des charges | `app/partner/profile/page.tsx:161` ; `M/20261106000001_lot8_canaux.sql:421-426` ; `docs/CDC-V3.md:384`, `:719` ; `components/layout/AppLayout.tsx:140`, `:211-242` ; `app/partner/stats/page.tsx:245-248` ; `middleware.ts:235-251` | « Présentation publique » sans page publique ; hors plateforme limité aux espèces (§76) ; cahier des charges incohérent sur le niveau 2 ; réglages hors du menu ; lien « Restaurants et tables » codé en dur ; écrans qui parlent de services fermés ; activation refusée à un téléphone déjà connecté | Moindre | Arbitrer | faible | renvoyé au lot 13 |
| R109 | préparation | `docs/recette-billetterie.md:318` ; `instrumentation.ts:12` | Bannière de l'Essai 1 introuvable à l'écran : c'est une ligne de la fenêtre 2. Matrice à corriger aux paragraphes §20, §24, §130, §142, §153. Essais manquants : passage à « Terminé », fin du scan, client suspendu, numéro et transfert, retrait bloqué ou incertain | Fausses anomalies en recette | Préciser, compléter le plan de test | faible | corrigé au lot 9 bis (tâche 44, `tests/schema/recette-matrice.test.ts`) ; Essai 1 précisé, essais 70 à 76 ajoutés au cahier |

## Propositions classées

**À faire avant le lancement.** R1 (reprise des versements), R9 et R10 (issues incertaines et retraits bloqués), R2 et R71 (droits des admins), R3 et R4 (suspension : sortie et gel des fonds), R5 et R6 (suspension réelle d'une partenaire), R7 (partenaire en attente), R8 (abonnement sur dossier refusé), R11 (remboursement sans limite), R12 à R15 (messages manquants ou faux à l'annulation et au changement), R16 (scanner), R17 (caisse sans sortie), R19 (billet en transfert), R20 (décision sur les espèces), R25 (billet suspendu), R47 (double débit), R57 (session suffisante), R58 (identité par numéro), R60 (préparation du seed).

**À faire plus tard.** R18, R21 à R24, R26 à R46, R48 à R56, R59, R61 à R70, et toutes les lignes de gravité faible, sauf arbitrage du client sur R56 (offres) et R82 (WhatsApp).

**À ne pas faire, avec la raison.**

- Ajouter un mode de scan autonome hors ligne : le cahier des charges ne le demande pas (§40), et il ouvrirait la porte aux doubles entrées.
- Réintroduire les billets « à régler sur place » pour résoudre R20 : ils ont été retirés à l'anomalie A16, et une entrée non payée redevient possible.
- Relancer automatiquement un versement à l'issue incertaine (R9) : l'argent a pu partir, un renvoi automatique peut payer deux fois.
- Passer tous les SMS optionnels en indispensables pour R14 : le budget n'existerait plus. Seuls date et lieu sont à discuter.
- Ajouter un SMS à chaque entrée (R78) : coût sans gain, l'entrée est visible sur place.
- Remettre en validation toute modification après publication (R18) : un événement en vente serait bloqué ; une alerte aux admins suffit.
- Bloquer tous les retraits d'une partenaire pour un seul événement suspendu (R4) : le gel doit porter sur l'événement concerné.
